/**
 * MIYAR — SCAD PDF Material Index Connector
 *
 * Fetches SCAD (Statistics Centre Abu Dhabi) publication PDFs,
 * extracts material price tables via pdf-parse + Gemini LLM,
 * and outputs structured evidence records for benchmark calibration.
 *
 * Data source: https://www.scad.gov.ae — Building Material Price Indices
 */

import {
    BaseSourceConnector,
    assignGrade,
    computeConfidence,
    type RawSourcePayload,
    type ExtractedEvidence,
    type NormalizedEvidenceInput,
} from "../connector";
import { invokeLLM } from "../../../_core/llm";

// Known SCAD publication URLs for building material statistics
const SCAD_PDF_URLS = [
    "https://www.scad.gov.ae/Release%20Documents/Construction%20Cost%20Index%20Report%20Q4%202024_EN.pdf",
    "https://www.scad.gov.ae/Release%20Documents/Construction%20Material%20Prices%202024_EN.pdf",
];

// Fallback: SCAD publications listing page
const SCAD_PUBLICATIONS_URL = "https://www.scad.gov.ae/en/pages/GeneralPublications.aspx";

const EXTRACTION_PROMPT = `You are a data extraction engine for MIYAR, a UAE real estate intelligence platform.

Extract material price data from this SCAD (Statistics Centre Abu Dhabi) PDF text.
Focus on: construction materials, building materials, finishing materials, and their price indices.

Return a JSON array of objects with these exact fields:
- materialName: string (e.g. "Portland Cement", "Steel Reinforcement Bar", "Ceramic Tiles 30x30")
- category: string (one of: "cement", "steel", "aggregate", "timber", "tiles", "glass", "paint", "insulation", "plumbing", "electrical", "stone", "other")
- priceAed: number|null (price in AED per unit, null if only index given)
- unit: string (e.g. "ton", "kg", "sqm", "piece", "bag", "meter", "cubic_meter")
- indexValue: number|null (price index value if available, base=100)
- yearQuarter: string|null (e.g. "2024-Q4", "2024")
- changePercent: number|null (year-over-year % change if stated)

Rules:
- Extract up to 30 items
- Only real data from the PDF — do NOT invent values
- If a row has an index but no absolute AED price, still include it with priceAed: null
- Return [] if no material data found

PDF text content:
`;

interface SCADMaterialItem {
    materialName: string;
    category: string;
    priceAed: number | null;
    unit: string;
    indexValue: number | null;
    yearQuarter: string | null;
    changePercent: number | null;
}

export class SCADPdfConnector extends BaseSourceConnector {
    sourceId = "scad-pdf-materials";
    sourceName = "SCAD Abu Dhabi — Material Price Index (PDF)";
    sourceUrl = SCAD_PUBLICATIONS_URL;

    /**
     * Fetch: download PDF(s) and extract text via pdf-parse.
     * Falls back to publications page HTML if PDF fetch fails.
     */
    async fetch(): Promise<RawSourcePayload> {
        let allText = "";

        for (const pdfUrl of SCAD_PDF_URLS) {
            try {
                const response = await fetch(pdfUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (MIYAR Intelligence Platform; +https://miyar.ai)",
                        "Accept": "application/pdf",
                    },
                    signal: AbortSignal.timeout(30_000),
                });

                if (!response.ok) {
                    console.warn(`[SCAD PDF] HTTP ${response.status} for ${pdfUrl}`);
                    continue;
                }

                const buffer = Buffer.from(await response.arrayBuffer());

                // Dynamic import to avoid hard dependency failures
                let pdfParse: any;
                try {
                    pdfParse = (await import("pdf-parse")).default;
                } catch {
                    console.error("[SCAD PDF] pdf-parse not available — run: npm install pdf-parse");
                    continue;
                }

                const parsed = await pdfParse(buffer);
                if (parsed.text && parsed.text.length > 100) {
                    allText += `\n--- Source: ${pdfUrl} ---\n${parsed.text}\n`;
                    console.log(`[SCAD PDF] Extracted ${parsed.text.length} chars from ${pdfUrl} (${parsed.numpages} pages)`);
                }
            } catch (err) {
                console.warn(`[SCAD PDF] Failed to fetch/parse ${pdfUrl}:`, err instanceof Error ? err.message : String(err));
            }
        }

        // If no PDFs succeeded, fall back to HTML publications page
        if (allText.length < 100) {
            try {
                const htmlResp = await fetch(this.sourceUrl, {
                    headers: { "User-Agent": "Mozilla/5.0 (MIYAR Intelligence Platform)" },
                    signal: AbortSignal.timeout(15_000),
                });
                if (htmlResp.ok) {
                    allText = await htmlResp.text();
                }
            } catch {
                // ignore
            }
        }

        return {
            url: SCAD_PDF_URLS[0] || this.sourceUrl,
            rawHtml: allText, // Using rawHtml field for the extracted text
            fetchedAt: new Date(),
            statusCode: allText.length > 100 ? 200 : 0,
        };
    }

    /**
     * Extract: send PDF text to Gemini for structured material price extraction.
     */
    async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
        const text = raw.rawHtml || "";
        if (!text || text.length < 100) return [];

        // Truncate to fit context window
        const truncated = text.substring(0, 15_000);

        try {
            const response = await invokeLLM({
                messages: [
                    {
                        role: "system",
                        content: "You extract structured data from SCAD Abu Dhabi construction material publications. Return ONLY valid JSON. No markdown fences.",
                    },
                    {
                        role: "user",
                        content: EXTRACTION_PROMPT + truncated,
                    },
                ],
                response_format: { type: "json_object" },
            });

            const content = typeof response.choices[0]?.message?.content === "string"
                ? response.choices[0].message.content
                : "";

            if (!content) return [];

            const parsed = JSON.parse(content);
            const items: SCADMaterialItem[] = Array.isArray(parsed) ? parsed : (parsed.items || parsed.materials || parsed.data || []);

            if (!Array.isArray(items)) return [];

            return items
                .filter((item) => item && typeof item.materialName === "string" && item.materialName.length > 0)
                .slice(0, 30)
                .map((item) => ({
                    title: `SCAD Material Index — ${item.materialName}`,
                    rawText: [
                        item.materialName,
                        item.priceAed ? `AED ${item.priceAed}/${item.unit}` : null,
                        item.indexValue ? `Index: ${item.indexValue}` : null,
                        item.changePercent ? `YoY: ${item.changePercent > 0 ? "+" : ""}${item.changePercent}%` : null,
                        item.yearQuarter,
                    ].filter(Boolean).join(" | "),
                    publishedDate: undefined,
                    category: "material_cost",
                    geography: "Abu Dhabi",
                    sourceUrl: raw.url,
                    // Pass through structured data for normalize()
                    _scadItem: item,
                } as any));
        } catch (err) {
            console.error("[SCAD PDF] LLM extraction failed:", err instanceof Error ? err.message : String(err));
            return [];
        }
    }

    /**
     * Normalize: convert extracted items into evidence record format.
     */
    async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
        const grade = assignGrade(this.sourceId);
        const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
        const scadItem: SCADMaterialItem | undefined = (evidence as any)._scadItem;

        const metric = scadItem
            ? `${scadItem.materialName} (${scadItem.category})`
            : evidence.title;

        const value = scadItem?.priceAed ?? scadItem?.indexValue ?? null;
        const unit = scadItem?.unit ?? "unit";

        const tags = [
            "government",
            "statistics",
            "abu-dhabi",
            "material-index",
            "scad",
            scadItem?.category,
        ].filter(Boolean) as string[];

        const summaryParts = [evidence.rawText];
        if (scadItem?.changePercent != null) {
            summaryParts.push(`Year-over-year change: ${scadItem.changePercent > 0 ? "+" : ""}${scadItem.changePercent}%`);
        }

        return {
            metric,
            value,
            unit,
            confidence,
            grade,
            summary: summaryParts.join(" — ").substring(0, 500),
            tags,
        };
    }
}
