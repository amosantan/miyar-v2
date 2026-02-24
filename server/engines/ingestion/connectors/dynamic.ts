import { BaseSourceConnector } from "../connector";
import type { RawSourcePayload, ExtractedEvidence, NormalizedEvidenceInput } from "../connector";
import { assignGrade, computeConfidence, isFirecrawlAvailable } from "../connector";
import { invokeLLM } from "../../../_core/llm";
import { discoverLinks, DEFAULT_CRAWL_CONFIG, type CrawlConfig } from "../crawler";

// ─── LLM Prompts ────────────────────────────────────────────────

const LLM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from website content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;

function buildDynamicPrompt(
    sourceName: string,
    category: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    lastFetch?: Date,
    pageUrl?: string,
): string {
    const dateFilter = lastFetch
        ? `\nFocus on content published or updated after ${lastFetch.toISOString().split("T")[0]}.`
        : "";

    const hintsFilter = hints ? `\nEXTRACTION HINTS: ${hints}` : "";
    const pageRef = pageUrl ? `\nPage URL: ${pageUrl}` : "";

    return `Extract evidence items from this ${sourceName} source content.
Category: ${category}
Geography: ${geography}${pageRef}${dateFilter}${hintsFilter}

Return a JSON array of objects with these exact fields:
- title: string (item/product/project name)
- rawText: string (relevant text snippet, max 500 chars)
- publishedDate: string|null (ISO date if found, null otherwise)
- metric: string (what is being measured, e.g. "Marble Tile 60x60 price")
- value: number|null (numeric value in AED if found, null otherwise)
- unit: string|null (e.g. "sqm", "sqft", "piece", "unit", null if not applicable)

Rules:
- Extract ALL items you can find, up to 50 maximum
- Only extract items with real data (titles, prices, descriptions)
- Do NOT invent data — if no items found, return empty array []
- Do NOT output confidence, grade, or scoring fields

Content (truncated to 16000 chars):
${contentSnippet.substring(0, 16000)}`;
}

// ─── Source types that benefit from multi-page crawling ──────────

const CRAWLABLE_TYPES = new Set([
    "supplier_catalog",
    "manufacturer_catalog",
    "retailer_listing",
    "aggregator",
]);

export class DynamicConnector extends BaseSourceConnector {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    category: string;
    geography: string;

    scrapeMethod: string;
    extractionHints: string;
    defaultUnit: string = "unit";
    defaultTags: string[] = [];

    private sourceType: string;
    private crawlConfig: CrawlConfig;

    /** Accumulates extracted evidence from all crawled pages */
    private _allPageEvidence: ExtractedEvidence[] = [];
    private _crawled = false;

    constructor(config: {
        id: number | string;
        name: string;
        url: string;
        sourceType?: string;
        region?: string;
        scrapeMethod?: string;
        extractionHints?: string;
        lastSuccessfulFetch?: Date | null;
        requestDelayMs?: number;
        scrapeConfig?: any;
    }) {
        super();
        this.sourceId = String(config.id);
        this.sourceName = config.name;
        this.sourceUrl = config.url;

        const typeCategoryMap: Record<string, string> = {
            supplier_catalog: "material_cost",
            manufacturer_catalog: "material_cost",
            retailer_listing: "material_cost",
            developer_brochure: "competitor_project",
            industry_report: "market_trend",
            government_tender: "project_award",
            trade_publication: "market_trend",
            aggregator: "material_cost",
            other: "other"
        };

        this.sourceType = config.sourceType || "other";
        this.category = typeCategoryMap[this.sourceType] || "other";
        this.geography = config.region || "UAE";
        this.scrapeMethod = config.scrapeMethod || "html_llm";
        this.extractionHints = config.extractionHints || "";

        if (config.lastSuccessfulFetch) {
            this.lastSuccessfulFetch = new Date(config.lastSuccessfulFetch);
        }

        const userCrawl = config.scrapeConfig?.crawl || {};
        this.crawlConfig = {
            ...DEFAULT_CRAWL_CONFIG,
            requestDelayMs: config.requestDelayMs || DEFAULT_CRAWL_CONFIG.requestDelayMs,
            ...userCrawl,
        };

        if (config.requestDelayMs) {
            this.requestDelayMs = config.requestDelayMs;
        }
    }

    private shouldCrawl(): boolean {
        return CRAWLABLE_TYPES.has(this.sourceType) && this.crawlConfig.maxDepth > 0;
    }

    /**
     * Fetch with multi-page crawling for catalog sources.
     * Uses Firecrawl when available for JS-rendered pages.
     */
    async fetch(): Promise<RawSourcePayload> {
        if (!this.shouldCrawl()) {
            // Single-page mode — use Firecrawl or basic fetch
            if (isFirecrawlAvailable()) {
                return this.fetchWithFirecrawl();
            }
            return super.fetch();
        }

        // Multi-page crawl mode
        console.log(`[DynamicConnector] 🕷️  Crawling ${this.sourceName} (max ${this.crawlConfig.pageBudget} pages, depth ${this.crawlConfig.maxDepth})`);

        const visited = new Set<string>();
        const queue: Array<{ url: string; depth: number }> = [{ url: this.sourceUrl, depth: 0 }];
        const allEvidence: ExtractedEvidence[] = [];
        let pagesProcessed = 0;
        let pagesFailed = 0;

        while (queue.length > 0 && pagesProcessed < this.crawlConfig.pageBudget) {
            const { url, depth } = queue.shift()!;
            const normalizedUrl = url.replace(/\/$/, "");

            if (visited.has(normalizedUrl)) continue;
            visited.add(normalizedUrl);

            // Fetch this page (using Firecrawl if available)
            let payload: RawSourcePayload;
            try {
                if (isFirecrawlAvailable()) {
                    payload = await this.fetchWithFirecrawl(url);
                } else {
                    payload = await this.fetchBasic(url);
                }
            } catch (err) {
                console.warn(`[DynamicConnector] Page fetch failed: ${url}`);
                pagesFailed++;
                continue;
            }

            if (payload.error || (!payload.rawHtml && !payload.markdown) ||
                ((payload.rawHtml?.length || 0) + (payload.markdown?.length || 0)) < 100) {
                pagesFailed++;
                continue;
            }

            pagesProcessed++;

            // Extract evidence from this page using LLM
            try {
                const content = payload.markdown || payload.rawHtml || "";
                const evidence = await this.extractFromContent(content, url, !!payload.markdown);
                if (evidence.length > 0) {
                    console.log(`[DynamicConnector]   📄 ${url} → ${evidence.length} items`);
                    allEvidence.push(...evidence);
                }
            } catch (err) {
                console.warn(`[DynamicConnector]   ⚠️  Extraction failed for ${url}`);
            }

            // Discover internal links if within depth limit (use HTML for link discovery)
            if (depth < this.crawlConfig.maxDepth && payload.rawHtml) {
                const links = discoverLinks(payload.rawHtml, url, this.crawlConfig);
                for (const link of links) {
                    const normLink = link.replace(/\/$/, "");
                    if (!visited.has(normLink) && !queue.some(q => q.url.replace(/\/$/, "") === normLink)) {
                        queue.push({ url: link, depth: depth + 1 });
                    }
                }
            }

            // Rate limit between pages
            if (queue.length > 0 && pagesProcessed < this.crawlConfig.pageBudget) {
                await new Promise(r => setTimeout(r, this.crawlConfig.requestDelayMs));
            }
        }

        console.log(`[DynamicConnector] 🕷️  Crawl complete: ${pagesProcessed} pages, ${allEvidence.length} items extracted, ${pagesFailed} failed`);

        this._allPageEvidence = allEvidence;
        this._crawled = true;

        return {
            url: this.sourceUrl,
            rawHtml: `<!-- Crawled ${pagesProcessed} pages, ${allEvidence.length} items extracted -->`,
            statusCode: 200,
            fetchedAt: new Date(),
        };
    }

    /**
     * Extract evidence from content using LLM.
     * Prefers markdown (from Firecrawl) over raw HTML.
     */
    private async extractFromContent(content: string, pageUrl: string, isMarkdown: boolean): Promise<ExtractedEvidence[]> {
        let textContent: string;

        if (isMarkdown) {
            // Markdown from Firecrawl is already clean — just trim
            textContent = content.trim();
        } else {
            // Strip scripts/styles from HTML
            textContent = content
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        if (textContent.length < 50) return [];

        try {
            const response = await invokeLLM({
                messages: [
                    { role: "system", content: LLM_EXTRACTION_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: buildDynamicPrompt(
                            this.sourceName,
                            this.category,
                            this.geography,
                            textContent,
                            this.extractionHints,
                            this.lastSuccessfulFetch,
                            pageUrl,
                        )
                    }
                ],
                response_format: { type: "json_object" }
            });

            const resText = typeof response.choices[0]?.message?.content === "string"
                ? response.choices[0].message.content : "";

            if (!resText) return [];

            const parsed = JSON.parse(resText);
            const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
            if (!Array.isArray(items)) return [];

            return items
                .filter((item: any) => item && typeof item.title === "string" && item.title.length > 0)
                .slice(0, 50)
                .map((item: any) => ({
                    title: `${this.sourceName} - ${String(item.title).substring(0, 255)}`,
                    rawText: String(item.rawText || item.description || item.title || "").substring(0, 500),
                    publishedDate: item.publishedDate ? new Date(item.publishedDate) : undefined,
                    category: this.category,
                    geography: this.geography,
                    sourceUrl: pageUrl,
                    _llmMetric: String(item.metric || item.title || "").substring(0, 255),
                    _llmValue: typeof item.value === "number" && isFinite(item.value) ? item.value : null,
                    _llmUnit: typeof item.unit === "string" ? item.unit : null,
                } as any));
        } catch (err) {
            console.error(`[DynamicConnector] LLM extraction failed for ${pageUrl}:`, err);
            return [];
        }
    }

    /**
     * Called by orchestrator after fetch().
     * For multi-page crawls, returns pre-accumulated evidence.
     * For single-page, runs LLM extraction on fetched content.
     */
    async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
        if (this._crawled && this._allPageEvidence.length > 0) {
            const evidence = [...this._allPageEvidence];
            this._allPageEvidence = [];
            this._crawled = false;
            return evidence;
        }

        // Single-page extraction — prefer markdown over HTML
        const content = raw.markdown || raw.rawHtml || JSON.stringify(raw.rawJson || {});
        if (!content || content.length < 50) return [];

        const isMarkdown = !!raw.markdown;
        return this.extractFromContent(
            isMarkdown ? content : (raw.rawHtml ? content : `<pre>${content}</pre>`),
            raw.url,
            isMarkdown,
        );
    }

    async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
        const grade = assignGrade(this.sourceId);
        const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
        const llmEvidence = evidence as any;

        return {
            metric: llmEvidence._llmMetric || evidence.title,
            value: llmEvidence._llmValue ?? null,
            unit: llmEvidence._llmUnit ?? this.defaultUnit,
            confidence,
            grade,
            summary: (evidence.rawText || "").replace(/\s+/g, " ").trim().substring(0, 500),
            tags: this.defaultTags
        };
    }
}
