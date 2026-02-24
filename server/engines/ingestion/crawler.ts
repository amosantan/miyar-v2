/**
 * MIYAR Phase 3 — Multi-Page Crawler
 *
 * Enhances the base connector to crawl multiple pages within a source site.
 * Discovers internal product/category links and follows them up to a configurable depth.
 *
 * Features:
 * - URL discovery from fetched HTML
 * - Depth-limited crawling (default: 2 levels)
 * - Page budget (default: 20 pages per session) to control LLM costs
 * - Rate limiting between requests
 * - Respects robots.txt via BaseSourceConnector
 * - Deduplication of discovered URLs
 */

import { BaseSourceConnector } from "./connector";
import type { RawSourcePayload, ExtractedEvidence, NormalizedEvidenceInput } from "./connector";
import { assignGrade, computeConfidence } from "./connector";
import { invokeLLM } from "../../_core/llm";

// ─── Types ──────────────────────────────────────────────────────

export interface CrawlConfig {
    /** Max depth of internal links to follow (0 = homepage only) */
    maxDepth: number;
    /** Maximum number of pages to fetch per crawl session */
    pageBudget: number;
    /** Delay between requests in ms */
    requestDelayMs: number;
    /** URL patterns to include (regex strings). Empty = all internal URLs */
    includePatterns: string[];
    /** URL patterns to exclude (regex strings) */
    excludePatterns: string[];
    /** CSS-like path hints for finding product/category links */
    linkHints: string;
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
    maxDepth: 1,
    pageBudget: 3,
    requestDelayMs: 1000,
    includePatterns: [],
    excludePatterns: [
        "\\.pdf$", "\\.jpg$", "\\.png$", "\\.gif$", "\\.svg$",
        "/cart", "/checkout", "/login", "/register", "/account",
        "/privacy", "/terms", "/cookie", "/sitemap\\.xml",
        "#", "mailto:", "tel:", "javascript:",
    ],
    linkHints: "",
};

// ─── URL Discovery ──────────────────────────────────────────────

/**
 * Extract internal links from HTML content.
 * Only returns absolute URLs that belong to the same domain.
 */
export function discoverLinks(html: string, baseUrl: string, config: CrawlConfig): string[] {
    const base = new URL(baseUrl);
    const seen = new Set<string>();
    const results: string[] = [];

    // Extract href attributes from <a> tags
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefRegex.exec(html)) !== null) {
        try {
            const href = match[1];
            if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
                continue;
            }

            // Resolve relative URLs
            const resolved = new URL(href, baseUrl);

            // Only same-domain links
            if (resolved.hostname !== base.hostname) continue;

            // Normalize: remove trailing slash, fragment, query params for dedup
            const normalized = `${resolved.origin}${resolved.pathname}`.replace(/\/$/, "");

            if (seen.has(normalized)) continue;
            seen.add(normalized);

            // Check exclude patterns
            const excluded = config.excludePatterns.some(pattern => {
                try { return new RegExp(pattern, "i").test(normalized); } catch { return false; }
            });
            if (excluded) continue;

            // Check include patterns (if specified, URL must match at least one)
            if (config.includePatterns.length > 0) {
                const included = config.includePatterns.some(pattern => {
                    try { return new RegExp(pattern, "i").test(normalized); } catch { return false; }
                });
                if (!included) continue;
            }

            results.push(normalized);
        } catch {
            // Invalid URL, skip
        }
    }

    return results;
}

// ─── Multi-Page Crawl Connector ─────────────────────────────────

const LLM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from raw HTML content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;

export class CrawlingConnector extends BaseSourceConnector {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    category: string;
    geography: string;
    crawlConfig: CrawlConfig;
    extractionHints: string;

    constructor(config: {
        id: number | string;
        name: string;
        url: string;
        category?: string;
        geography?: string;
        crawlConfig?: Partial<CrawlConfig>;
        extractionHints?: string;
        lastSuccessfulFetch?: Date | null;
        requestDelayMs?: number;
    }) {
        super();
        this.sourceId = String(config.id);
        this.sourceName = config.name;
        this.sourceUrl = config.url;
        this.category = config.category || "material_cost";
        this.geography = config.geography || "UAE";
        this.extractionHints = config.extractionHints || "";
        this.crawlConfig = { ...DEFAULT_CRAWL_CONFIG, ...config.crawlConfig };
        if (config.requestDelayMs) {
            this.crawlConfig.requestDelayMs = config.requestDelayMs;
            this.requestDelayMs = config.requestDelayMs;
        }
        if (config.lastSuccessfulFetch) {
            this.lastSuccessfulFetch = new Date(config.lastSuccessfulFetch);
        }
    }

    /**
     * Crawl multiple pages and aggregate all extracted evidence.
     */
    async crawl(): Promise<{ pages: RawSourcePayload[]; totalPages: number; errors: string[] }> {
        const visited = new Set<string>();
        const queue: Array<{ url: string; depth: number }> = [{ url: this.sourceUrl, depth: 0 }];
        const pages: RawSourcePayload[] = [];
        const errors: string[] = [];

        while (queue.length > 0 && pages.length < this.crawlConfig.pageBudget) {
            const { url, depth } = queue.shift()!;

            if (visited.has(url)) continue;
            visited.add(url);

            // Fetch the page
            const originalUrl = this.sourceUrl;
            (this as any).sourceUrl = url; // Temporarily override for fetch
            const payload = await this.fetch();
            (this as any).sourceUrl = originalUrl; // Restore

            if (payload.error) {
                errors.push(`[${url}] ${payload.error}`);
                continue;
            }

            pages.push({ ...payload, url });

            // Discover links if within depth limit
            if (depth < this.crawlConfig.maxDepth && payload.rawHtml) {
                const links = discoverLinks(payload.rawHtml, url, this.crawlConfig);
                for (const link of links) {
                    if (!visited.has(link) && !queue.some(q => q.url === link)) {
                        queue.push({ url: link, depth: depth + 1 });
                    }
                }
            }

            // Rate limiting
            if (queue.length > 0) {
                await new Promise(r => setTimeout(r, this.crawlConfig.requestDelayMs));
            }
        }

        return { pages, totalPages: pages.length, errors };
    }

    /**
     * Extract evidence from a single page using LLM.
     */
    async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
        if (!raw.rawHtml || raw.rawHtml.length < 50) return [];

        try {
            // Strip scripts/styles and extract text
            const textContent = raw.rawHtml
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();

            if (textContent.length < 50) return [];

            const hintsSection = this.extractionHints ? `\nEXTRACTION HINTS: ${this.extractionHints}` : "";
            const dateFilter = this.lastSuccessfulFetch
                ? `\nFocus on content published or updated after ${this.lastSuccessfulFetch.toISOString().split("T")[0]}.`
                : "";

            const response = await invokeLLM({
                messages: [
                    { role: "system", content: LLM_EXTRACTION_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: `Extract evidence items from this ${this.sourceName} page.
Category: ${this.category}
Geography: ${this.geography}
Page URL: ${raw.url}${dateFilter}${hintsSection}

Return a JSON array of objects with these exact fields:
- title: string (item/product/project name)
- rawText: string (relevant text snippet, max 500 chars)
- publishedDate: string|null (ISO date if found, null otherwise)
- metric: string (what is being measured, e.g. "Marble Tile 60x60 price")
- value: number|null (numeric value in AED if found, null otherwise)
- unit: string|null (e.g. "sqm", "sqft", "piece", "unit", null if not applicable)

Rules:
- Extract up to 15 items maximum per page
- Only extract items with real data (titles, prices, descriptions)
- Do NOT invent data — if no items found, return empty array []

Content (truncated to 8000 chars):
${textContent.substring(0, 8000)}`
                    },
                ],
                response_format: { type: "json_object" },
            });

            const resText = typeof response.choices[0]?.message?.content === "string"
                ? response.choices[0].message.content : "";

            if (!resText) return [];

            const parsed = JSON.parse(resText);
            const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
            if (!Array.isArray(items)) return [];

            return items
                .filter((item: any) => item && typeof item.title === "string" && item.title.length > 0)
                .slice(0, 15)
                .map((item: any) => ({
                    title: `${this.sourceName} - ${String(item.title).substring(0, 255)}`,
                    rawText: String(item.rawText || item.description || item.title || "").substring(0, 500),
                    publishedDate: item.publishedDate ? new Date(item.publishedDate) : undefined,
                    category: this.category,
                    geography: this.geography,
                    sourceUrl: raw.url,
                    _llmMetric: String(item.metric || item.title || "").substring(0, 255),
                    _llmValue: typeof item.value === "number" && isFinite(item.value) ? item.value : null,
                    _llmUnit: typeof item.unit === "string" ? item.unit : null,
                } as any));
        } catch (err) {
            console.error(`[CrawlingConnector] Extraction failed for ${raw.url}: `, err);
            return [];
        }
    }

    async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
        const grade = assignGrade(this.sourceId);
        const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
        const llmEvidence = evidence as any;

        return {
            metric: llmEvidence._llmMetric || evidence.title,
            value: llmEvidence._llmValue ?? null,
            unit: llmEvidence._llmUnit ?? "unit",
            confidence,
            grade,
            summary: (evidence.rawText || "").replace(/\s+/g, " ").trim().substring(0, 500),
            tags: [],
        };
    }
}
