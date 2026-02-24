import { BaseSourceConnector } from "../connector";
import type { RawSourcePayload, ExtractedEvidence, NormalizedEvidenceInput } from "../connector";
import { assignGrade, computeConfidence, isFirecrawlAvailable } from "../connector";
import { invokeLLM } from "../../../_core/llm";
import { discoverLinks, DEFAULT_CRAWL_CONFIG, type CrawlConfig } from "../crawler";

// ─── LLM Prompts ────────────────────────────────────────────────

const LLM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from website content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;

// ─── Source-type-specific prompt builders ────────────────────────

/**
 * PROMPT A: Material Pricing — for supplier/manufacturer/retailer sources
 * Extracts: product names + AED prices + categories + brands
 */
function buildMaterialPricingPrompt(
    sourceName: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    pageUrl?: string,
): string {
    const hintsFilter = hints ? `\nEXTRACTION HINTS: ${hints}` : "";
    const pageRef = pageUrl ? `\nPage URL: ${pageUrl}` : "";

    return `Extract products with prices from this ${sourceName} supplier/retailer page.
Geography: ${geography}${pageRef}${hintsFilter}

IMPORTANT: Extract EXACT AED prices. If price is shown, include it. Skip items with no price.

Return a JSON array of objects with these EXACT fields:
- title: string (product name with specification, e.g. "Calacatta Marble Tile 60x60cm")
- rawText: string (product description or context, max 500 chars)
- value: number (price in AED — REQUIRED, skip items without price)
- valueMax: number|null (max price if a range is shown, e.g. for "85-110 AED/sqm" value=85, valueMax=110)
- unit: string (REQUIRED — "sqm", "piece", "unit", "m", "L", "set", etc.)
- category: string (one of: "floors", "walls", "ceilings", "sanitary", "lighting", "kitchen", "hardware", "joinery", "ffe", "other")
- brand: string|null (manufacturer/brand name if visible)
- publishedDate: string|null (ISO date if found)

Rules:
- Extract ALL priced items you can find, up to 50 maximum
- Price MUST be a number in AED — skip items with no visible price
- For price ranges like "85-110", set value=85 and valueMax=110
- Convert known currencies to AED (USD×3.67, EUR×4.0)
- Do NOT invent prices
- Return empty array [] if no priced items found

Content (truncated to 16000 chars):
${contentSnippet.substring(0, 16000)}`;
}

/**
 * PROMPT B: Developer Intelligence — for developer_brochure sources
 * Extracts: finish specs, design styles, brands, quality tier
 */
function buildDeveloperIntelPrompt(
    sourceName: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    pageUrl?: string,
): string {
    const hintsFilter = hints ? `\nEXTRACTION HINTS: ${hints}` : "";
    const pageRef = pageUrl ? `\nPage URL: ${pageUrl}` : "";

    return `Extract INTERIOR DESIGN intelligence from this ${sourceName} developer/project website.
Geography: ${geography}${pageRef}${hintsFilter}

FOCUS ON: finish specifications, material brands used, design aesthetic, quality tier.
DO NOT extract: property prices, bedroom counts, unit sizes, payment plans, or sales offers.

Return a JSON array of objects with these EXACT fields:
- title: string (project/development name)
- rawText: string (description of finishes and design, max 500 chars)
- finishLevel: string (one of: "basic", "standard", "premium", "luxury", "ultra_luxury")
- designStyle: string (aesthetic description, e.g. "Contemporary Italian", "Modern Arabic", "Minimalist Scandinavian", "Classic European")
- brands: string[] (brand names mentioned, e.g. ["Grohe", "Porcelanosa", "Miele", "Villeroy & Boch"])
- materialSpec: string (specific materials mentioned, e.g. "Imported marble flooring, engineered oak, quartz countertops, European kitchen appliances")
- category: string (main area — "floors", "walls", "sanitary", "kitchen", "joinery", "lighting", "ffe", "other")

Rules:
- ONE record per project/development (not per unit type)
- Focus on WHAT MATERIALS and FINISHES are used, not the property itself
- If the page describes kitchen specs, bathroom specs, floor specs — extract each as separate records
- If no interior design info found, return empty array []
- Look for words like: marble, granite, porcelain, hardwood, premium, luxury, European, imported, bespoke

Content (truncated to 16000 chars):
${contentSnippet.substring(0, 16000)}`;
}

/**
 * PROMPT C: Market Research — for industry_report/trade_publication sources
 * Extracts: market statistics, trends, forecasts, cost benchmarks
 */
function buildMarketResearchPrompt(
    sourceName: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    pageUrl?: string,
): string {
    const hintsFilter = hints ? `\nEXTRACTION HINTS: ${hints}` : "";
    const pageRef = pageUrl ? `\nPage URL: ${pageUrl}` : "";

    return `Extract market intelligence and construction/real estate statistics from this ${sourceName} report.
Geography: ${geography}${pageRef}${hintsFilter}

FOCUS ON: price indices, construction cost benchmarks, market trends, supply/demand data, forecasts.

Return a JSON array of objects with these EXACT fields:
- title: string (statistic or finding name, e.g. "Average Fitout Cost - Luxury Residential")
- rawText: string (the finding with context, max 500 chars)
- value: number|null (numeric value in AED if applicable)
- unit: string|null (e.g. "sqft", "sqm", "percent", "index", "AED/sqm")
- trend: string|null (one of: "rising", "stable", "falling", or null if not a trend)
- publishedDate: string|null (ISO date if found)
- category: string (one of: "floors", "walls", "ceilings", "sanitary", "lighting", "kitchen", "hardware", "joinery", "ffe", "other")

Rules:
- Extract ALL statistics, data points, and findings — up to 50 maximum
- Include forecasts and projections with timeframe in rawText
- Include percentage changes and growth rates
- If no relevant data found, return empty array []

Content (truncated to 16000 chars):
${contentSnippet.substring(0, 16000)}`;
}

/**
 * PROMPT D: Government Data — for government_tender/procurement sources
 * Extracts: permits, regulations, cost indices, tenders
 */
function buildGovernmentDataPrompt(
    sourceName: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    pageUrl?: string,
): string {
    const hintsFilter = hints ? `\nEXTRACTION HINTS: ${hints}` : "";
    const pageRef = pageUrl ? `\nPage URL: ${pageUrl}` : "";

    return `Extract construction and real estate data from this ${sourceName} government source.
Geography: ${geography}${pageRef}${hintsFilter}

FOCUS ON: building permits, construction statistics, cost indices, regulations, standards.

Return a JSON array of objects with these EXACT fields:
- title: string (data point, regulation, or statistic name)
- rawText: string (description or finding, max 500 chars)
- value: number|null (numeric value if applicable)
- unit: string|null (measurement unit)
- publishedDate: string|null (ISO date if found)
- category: string ("other" for most government data)

Rules:
- Extract data relevant to construction, interior design, and real estate
- Include regulatory changes affecting building standards
- If no relevant data found, return empty array []

Content (truncated to 16000 chars):
${contentSnippet.substring(0, 16000)}`;
}

// ─── Prompt selector ────────────────────────────────────────────

type SourceTypeKey = "supplier_catalog" | "manufacturer_catalog" | "retailer_listing" | "aggregator" |
    "developer_brochure" | "industry_report" | "trade_publication" |
    "government_tender" | "procurement_portal" | "other";

function selectPrompt(
    sourceType: string,
    sourceName: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    pageUrl?: string,
): string {
    switch (sourceType) {
        case "supplier_catalog":
        case "manufacturer_catalog":
        case "retailer_listing":
        case "aggregator":
            return buildMaterialPricingPrompt(sourceName, geography, contentSnippet, hints, pageUrl);
        case "developer_brochure":
            return buildDeveloperIntelPrompt(sourceName, geography, contentSnippet, hints, pageUrl);
        case "industry_report":
        case "trade_publication":
            return buildMarketResearchPrompt(sourceName, geography, contentSnippet, hints, pageUrl);
        case "government_tender":
        case "procurement_portal":
            return buildGovernmentDataPrompt(sourceName, geography, contentSnippet, hints, pageUrl);
        default:
            // Fallback: use material pricing as default
            return buildMaterialPricingPrompt(sourceName, geography, contentSnippet, hints, pageUrl);
    }
}

// ─── Intelligence type mapping ──────────────────────────────────

function getIntelligenceType(sourceType: string): string {
    switch (sourceType) {
        case "supplier_catalog":
        case "manufacturer_catalog":
        case "retailer_listing":
        case "aggregator":
            return "material_price";
        case "developer_brochure":
            return "finish_specification";
        case "industry_report":
        case "trade_publication":
            return "market_statistic";
        case "government_tender":
        case "procurement_portal":
            return "regulation";
        default:
            return "material_price";
    }
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
            supplier_catalog: "floors",
            manufacturer_catalog: "floors",
            retailer_listing: "floors",
            developer_brochure: "other",
            industry_report: "other",
            government_tender: "other",
            trade_publication: "other",
            aggregator: "floors",
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

    shouldCrawl(): boolean {
        return CRAWLABLE_TYPES.has(this.sourceType) && this.crawlConfig.maxDepth > 0;
    }

    /**
     * Fetch with multi-page crawling for catalog sources.
     * Uses Firecrawl when available for JS-rendered pages.
     */
    async fetch(): Promise<RawSourcePayload> {
        const localBudget = process.env.LOCAL_PAGE_BUDGET
            ? parseInt(process.env.LOCAL_PAGE_BUDGET, 10)
            : undefined;

        if (localBudget) {
            this.crawlConfig = { ...this.crawlConfig, pageBudget: localBudget };
        }

        if (!this.shouldCrawl()) {
            // Single-page mode — use Firecrawl or basic fetch
            if (isFirecrawlAvailable()) {
                return this.fetchWithFirecrawl();
            }
            return super.fetch();
        }

        // Multi-page crawl mode (BFS)
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
     * Uses source-type-specific prompts for targeted extraction.
     */
    private async extractFromContent(content: string, pageUrl: string, isMarkdown: boolean): Promise<ExtractedEvidence[]> {
        let textContent: string;

        if (isMarkdown) {
            textContent = content.trim();
        } else {
            textContent = content
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        if (textContent.length < 50) return [];

        try {
            // Select prompt based on source type
            const prompt = selectPrompt(
                this.sourceType,
                this.sourceName,
                this.geography,
                textContent,
                this.extractionHints,
                pageUrl,
            );

            const response = await invokeLLM({
                messages: [
                    { role: "system", content: LLM_EXTRACTION_SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const resText = typeof response.choices[0]?.message?.content === "string"
                ? response.choices[0].message.content : "";

            if (!resText) return [];

            const parsed = JSON.parse(resText);
            const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
            if (!Array.isArray(items)) return [];

            const intelligenceType = getIntelligenceType(this.sourceType);

            return items
                .filter((item: any) => item && typeof item.title === "string" && item.title.length > 0)
                .slice(0, 50)
                .map((item: any) => ({
                    title: String(item.title).substring(0, 255),
                    rawText: String(item.rawText || item.description || item.title || "").substring(0, 500),
                    publishedDate: item.publishedDate ? new Date(item.publishedDate) : undefined,
                    category: item.category || this.category,
                    geography: this.geography,
                    sourceUrl: pageUrl,
                    // Material pricing fields
                    _llmMetric: String(item.metric || item.title || "").substring(0, 255),
                    _llmValue: typeof item.value === "number" && isFinite(item.value) ? item.value : null,
                    _llmValueMax: typeof item.valueMax === "number" && isFinite(item.valueMax) ? item.valueMax : null,
                    _llmUnit: typeof item.unit === "string" ? item.unit : null,
                    _llmBrand: typeof item.brand === "string" ? item.brand : null,
                    // Design intelligence fields
                    _llmFinishLevel: typeof item.finishLevel === "string" ? item.finishLevel : null,
                    _llmDesignStyle: typeof item.designStyle === "string" ? item.designStyle : null,
                    _llmBrands: Array.isArray(item.brands) ? item.brands : null,
                    _llmMaterialSpec: typeof item.materialSpec === "string" ? item.materialSpec : null,
                    _llmIntelligenceType: intelligenceType,
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
            valueMax: llmEvidence._llmValueMax ?? null,
            unit: llmEvidence._llmUnit ?? this.defaultUnit,
            confidence,
            grade,
            summary: (evidence.rawText || "").replace(/\s+/g, " ").trim().substring(0, 500),
            tags: this.defaultTags,
            brand: llmEvidence._llmBrand ?? null,
            // Design intelligence fields
            finishLevel: llmEvidence._llmFinishLevel ?? null,
            designStyle: llmEvidence._llmDesignStyle ?? null,
            brandsMentioned: llmEvidence._llmBrands ?? null,
            materialSpec: llmEvidence._llmMaterialSpec ?? null,
            intelligenceType: llmEvidence._llmIntelligenceType ?? "material_price",
        };
    }
}
