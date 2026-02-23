import { BaseSourceConnector } from "../connector";
import type { RawSourcePayload, ExtractedEvidence, NormalizedEvidenceInput } from "../connector";
import { assignGrade, computeConfidence } from "../connector";
import { invokeLLM } from "../../../_core/llm";

// LLM extraction template similar to index.ts but leveraging extractionHints
const LLM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from raw HTML or JSON content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;

function buildDynamicPrompt(
    sourceName: string,
    category: string,
    geography: string,
    contentSnippet: string,
    hints?: string,
    lastFetch?: Date
): string {
    const dateFilter = lastFetch
        ? `\nFocus on content published or updated after ${lastFetch.toISOString().split("T")[0]}.`
        : "";

    const hintsFilter = hints ? `\nEXTRACTION HINTS: ${hints}` : "";

    return `Extract evidence items from this ${sourceName} source content.
Category: ${category}
Geography: ${geography}${dateFilter}${hintsFilter}

Return a JSON array of objects with these exact fields:
- title: string (item/product/project name)
- rawText: string (relevant text snippet, max 500 chars)
- publishedDate: string|null (ISO date if found, null otherwise)
- metric: string (what is being measured, e.g. "Marble Tile 60x60 price")
- value: number|null (numeric value in AED if found, null otherwise)
- unit: string|null (e.g. "sqm", "sqft", "piece", "unit", null if not applicable)

Rules:
- Extract up to 15 items maximum
- Only extract items with real data (titles, prices, descriptions)
- Do NOT invent data — if no items found, return empty array []
- Do NOT output confidence, grade, or scoring fields

Content (truncated to 8000 chars):
${contentSnippet.substring(0, 8000)}`;
}

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

    constructor(config: {
        id: number | string;
        name: string;
        url: string;
        sourceType?: string;
        region?: string;
        scrapeMethod?: string;
        extractionHints?: string;
        lastSuccessfulFetch?: Date | null;
    }) {
        super();
        this.sourceId = String(config.id);
        this.sourceName = config.name;
        this.sourceUrl = config.url;

        // Map sourceType to evidence category
        const typeCategoryMap: Record<string, string> = {
            supplier_catalog: "material_cost",
            manufacturer_catalog: "material_cost",
            retailer_listing: "material_cost",
            developer_brochure: "competitor_project",
            industry_report: "market_trend",
            government_tender: "project_award",
            trade_publication: "market_trend",
            other: "other"
        };

        this.category = typeCategoryMap[config.sourceType || "other"] || "other";
        this.geography = config.region || "UAE";
        this.scrapeMethod = config.scrapeMethod || "html_llm";
        this.extractionHints = config.extractionHints || "";

        if (config.lastSuccessfulFetch) {
            this.lastSuccessfulFetch = new Date(config.lastSuccessfulFetch);
        }
    }

    async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
        const isHtml = !!raw.rawHtml;
        const content = isHtml ? raw.rawHtml! : JSON.stringify(raw.rawJson || {});

        if (!content || content.length < 50) return [];

        // For DFE-01, implement html_llm as the universal baseline for HTML/JSON
        if (this.scrapeMethod === "html_llm" || this.scrapeMethod === "json_api") {
            try {
                const textContent = isHtml
                    ? content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
                    : content;

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
                                this.lastSuccessfulFetch
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
                console.error(`[DynamicConnector] Extraction failed for ${this.sourceName}: `, err);
                return [];
            }
        }

        return [];
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
