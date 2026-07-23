/**
 * MIYAR V3 — UAE Source Connectors (12 total)
 *
 * V3 upgrade: All connectors now make REAL HTTP GET requests via
 * BaseSourceConnector.fetch(). HTML sources use a shared LLM extraction
 * prompt template. JSON/RSS sources parse directly without LLM.
 *
 * Connectors that are unreachable (DNS failure, 403, etc.) fail gracefully
 * with error logged — orchestrator continues to next connector.
 *
 * LLM is used ONLY for extracting structured data from HTML.
 * LLM NEVER outputs confidence, grade, or scoring fields.
 */

import {
  BaseSourceConnector,
  evaluateEvidenceConfidence,
  publicationDateFields,
  resolveGradePolicy,
  type ConfidenceEvaluationContext,
  type RawSourcePayload,
  type ExtractedEvidence,
  type NormalizedEvidenceInput,
} from "../connector";
import { invokeLLM } from "../../../_core/llm";
import { SCADPdfConnector } from "./scad-pdf-connector";

// ─── SOURCE_URLS Registry ──────────────────────────────────────

export const SOURCE_URLS: Record<string, string> = {
  // EV-00 registry prune (2026-07-23): dera-interiors (derainteriors.ae) and
  // gems-building-materials (gemsbuilding.com) were removed — both domains no
  // longer resolve; their deactivated seed rows retain the history.
  "rak-ceramics-uae": "https://www.rakceramics.com/",
  "graniti-uae": "https://www.granitiuae.com/",
  "dragon-mart-dubai": "https://www.dragonmart.ae/",
  "porcelanosa-uae": "https://www.porcelanosa.com/ae/",
  "emaar-properties": "https://www.emaar.com/en/",
  "damac-properties": "https://www.damacproperties.com/en/",
  "nakheel-properties": "https://www.nakheel.com/en/",
  "rics-market-reports": "https://www.rics.org/news-insights/research-and-insights/",
  "jll-mena-research": "https://www.jll.com/en/trends-and-insights/research",
  "dubai-statistics-center": "https://www.dsc.gov.ae/en-us/Themes/Pages/default.aspx",
  // EV-00 URL repair: the former hafele.com pointed at the US-dollar
  // storefront; the UAE storefront matches the seed row.
  "hafele-uae": "https://www.hafele.ae/en/",
  // ─── V4: New UAE Market Sources ─────────────────────────────────
  "dubai-pulse-materials": "https://www.dubaipulse.gov.ae/data/dsc_average-construction-material-prices/dsc_average_construction_material_prices-open",
  "scad-abu-dhabi": "https://www.scad.gov.ae/en/pages/GeneralPublications.aspx",
  "scad-pdf-materials": "https://www.scad.gov.ae/en/pages/GeneralPublications.aspx",
  "dld-transactions": "https://www.dubaipulse.gov.ae/data/dld_transactions/dld_transactions-open",
  "aldar-properties": "https://www.aldar.com/en/explore/businesses/aldar-development/residential",
  "cbre-uae-research": "https://www.cbre.ae/en/insights",
  "knight-frank-uae": "https://www.knightfrank.ae/research",
  "savills-me-research": "https://www.savills.me/insight-and-opinion/",
  "property-monitor-dubai": "https://www.propertymonitor.ae/market-reports",
  // ─── V5: Live Property Listing Sources ─────────────────────────
  "bayut-listings": "https://www.bayut.com/for-sale/property/dubai/",
  "propertyfinder-listings": "https://www.propertyfinder.ae/en/buy/dubai/",
};

// ─── Shared LLM Extraction Prompt Template ─────────────────────

const LLM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from raw HTML content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;

function buildExtractionUserPrompt(
  sourceName: string,
  category: string,
  geography: string,
  htmlSnippet: string,
  lastFetch?: Date
): string {
  const dateFilter = lastFetch
    ? `\nFocus on content published or updated after ${lastFetch.toISOString().split("T")[0]}.`
    : "";

  return `Extract evidence items from this ${sourceName} webpage HTML.
Source focus: ${category}
Geography: ${geography}${dateFilter}

Return a JSON array of objects with these exact fields:
- title: string (item/product/project name)
- rawText: string (relevant text snippet, max 500 chars)
- publishedDate: string|null (ISO date if found, null otherwise)
- metric: string (what is being measured, e.g. "Marble Tile 60x60 price")
- value: number|null (numeric value in AED if found, null otherwise)
- unit: string|null (e.g. "sqm", "sqft", "piece", "unit", null if not applicable)
- category: string (the item's own area — one of: "floors", "walls", "ceilings", "joinery", "lighting", "sanitary", "kitchen", "hardware", "ffe", "other")

Rules:
- Extract up to 15 items maximum
- Only extract items with real data (titles, prices, descriptions)
- Classify each item's category by what the item IS (tiles → floors or walls, taps → sanitary, cabinet handles → hardware); use "other" when unsure
- Do NOT invent data — if no items found, return empty array []
- Do NOT output confidence, grade, or scoring fields

HTML content (truncated to 8000 chars):
${htmlSnippet.substring(0, 8000)}`;
}

interface LLMExtractedItem {
  title: string;
  rawText: string;
  publishedDate: string | null;
  metric: string;
  value: number | null;
  unit: string | null;
  category?: string | null;
}

/**
 * Shared LLM extraction for HTML-based connectors.
 * Returns extracted items or empty array on failure.
 */
async function extractViaLLM(
  sourceName: string,
  category: string,
  geography: string,
  html: string,
  lastFetch?: Date
): Promise<LLMExtractedItem[]> {
  try {
    // Strip HTML tags and compress whitespace for a cleaner prompt
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (textContent.length < 50) return [];

    const response = await invokeLLM({
      messages: [
        { role: "system", content: LLM_EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildExtractionUserPrompt(
            sourceName,
            category,
            geography,
            textContent,
            lastFetch
          ),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = typeof response.choices[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";

    if (!content) return [];

    const parsed = JSON.parse(content);
    // Handle both { items: [...] } and direct array formats
    const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);

    if (!Array.isArray(items)) return [];

    return items
      .filter((item: any) => item && typeof item.title === "string" && item.title.length > 0)
      .slice(0, 15)
      .map((item: any) => ({
        title: String(item.title || "").substring(0, 255),
        rawText: String(item.rawText || item.description || item.text || "").substring(0, 500),
        publishedDate: item.publishedDate || null,
        metric: String(item.metric || item.title || "").substring(0, 255),
        value: typeof item.value === "number" && isFinite(item.value) ? item.value : null,
        unit: typeof item.unit === "string" ? item.unit : null,
        // ADR-0009 (audit F11): the per-item category must survive this
        // mapping. It was previously dropped here, so every static-connector
        // record fell back to the connector-level bucket.
        category: typeof item.category === "string" && item.category.trim()
          ? item.category.trim()
          : null,
      }));
  } catch (err) {
    console.error(`[LLM Extraction] Failed for ${sourceName}:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ─── Helper: Rule-based price extraction (fallback) ────────────

const AED_PRICE_REGEX = /(?:AED|Dhs?\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const NUMERIC_PRICE_REGEX = /([\d,]+(?:\.\d{1,2})?)\s*(?:AED|Dhs?\.?|per\s+(?:sqm|sqft|m²|unit|piece|set|roll))/gi;
const SQFT_REGEX = /(?:per\s+)?(?:sq\.?\s*ft\.?|sqft|square\s+foot|square\s+feet)/i;
const SQM_REGEX = /(?:per\s+)?(?:sq\.?\s*m\.?|sqm|m²|square\s+met(?:er|re))/i;

function extractPricesFromText(text: string): Array<{ value: number; unit: string }> {
  const prices: Array<{ value: number; unit: string }> = [];
  const seen = new Set<number>();

  for (const regex of [AED_PRICE_REGEX, NUMERIC_PRICE_REGEX]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0 && val < 100_000_000 && !seen.has(val)) {
        seen.add(val);
        const context = text.substring(
          Math.max(0, match.index - 30),
          Math.min(text.length, match.index + match[0].length + 30)
        );
        let unit = "unit";
        if (SQM_REGEX.test(context)) unit = "sqm";
        else if (SQFT_REGEX.test(context)) unit = "sqft";
        prices.push({ value: val, unit });
      }
    }
  }

  return prices;
}

function extractSnippet(text: string, maxLen = 500): string {
  return text.replace(/\s+/g, " ").trim().substring(0, maxLen);
}

// ─── Base class for HTML connectors with LLM extraction ────────

abstract class HTMLSourceConnector extends BaseSourceConnector {
  abstract category: string;
  abstract geography: string;
  abstract defaultTags: string[];
  abstract defaultUnit: string;

  protected confidenceMetadata(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ) {
    const gradePolicy = resolveGradePolicy(this.sourceId);
    const confidencePolicy = evaluateEvidenceConfidence(
      evidence,
      gradePolicy.grade,
      context
    );
    return {
      grade: gradePolicy.grade,
      confidence: confidencePolicy.initial.score,
      confidencePolicy,
      gradePolicy,
    };
  }

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const html = raw.rawHtml || "";
    if (!html || html.length < 50) return [];

    // Try LLM extraction first (V3-03: pass lastSuccessfulFetch for incremental filtering)
    const llmItems = await extractViaLLM(
      this.sourceName,
      this.category,
      this.geography,
      html,
      this.lastSuccessfulFetch
    );

    if (llmItems.length > 0) {
      return llmItems.map((item) => ({
        title: `${this.sourceName} - ${item.title}`,
        rawText: item.rawText || item.title,
        ...publicationDateFields(item.publishedDate, raw.fetchedAt),
        observedAt: raw.fetchedAt,
        // ADR-0009 (audit F11): prefer the item's own extracted category so
        // static material evidence stops pooling into one bucket; the
        // orchestrator validates it against the evidence enum and maps the
        // class-level fallback to "other".
        category: (typeof item.category === "string" && item.category) || this.category,
        geography: this.geography,
        sourceUrl: raw.url,
        // Store LLM-extracted metric/value/unit as metadata in rawText for normalize()
        _llmMetric: item.metric,
        _llmValue: item.value,
        _llmUnit: item.unit,
      })) as any[];
    }

    // Fallback: rule-based extraction from HTML structure
    return this.extractRuleBased(raw);
  }

  /** Rule-based fallback extraction — subclasses can override */
  protected extractRuleBased(raw: RawSourcePayload): ExtractedEvidence[] {
    const html = raw.rawHtml || "";
    const evidence: ExtractedEvidence[] = [];

    const sections = html.match(
      /<(?:div|article|section|li)[^>]*class="[^"]*(?:product|item|card|project|property|report|service)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section|li)>/gi
    ) || [];

    for (const section of sections.slice(0, 15)) {
      const titleMatch = section.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `${this.sourceName} - ${title}`,
        rawText: text,
        publishedDate: undefined,
        ...publicationDateFields(undefined, raw.fetchedAt),
        observedAt: raw.fetchedAt,
        category: this.category,
        geography: this.geography,
        sourceUrl: raw.url,
      });
    }

    // If nothing found, create a single fallback evidence from the full page
    if (evidence.length === 0 && html.length > 100) {
      const plainText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ");
      evidence.push({
        title: `${this.sourceName} - Page Content`,
        rawText: extractSnippet(plainText),
        publishedDate: undefined,
        ...publicationDateFields(undefined, raw.fetchedAt),
        observedAt: raw.fetchedAt,
        category: this.category,
        geography: this.geography,
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);

    // Check for LLM-extracted metadata
    const llmEvidence = evidence as any;
    if (llmEvidence._llmValue !== undefined) {
      return {
        metric: llmEvidence._llmMetric || evidence.title,
        value: llmEvidence._llmValue,
        unit: llmEvidence._llmUnit || this.defaultUnit,
        confidence,
        grade,
        confidencePolicy,
        gradePolicy,
        summary: extractSnippet(evidence.rawText),
        tags: this.defaultTags,
      };
    }

    // Fallback: rule-based price extraction
    const prices = extractPricesFromText(evidence.rawText);
    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : this.defaultUnit,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 1. RAK Ceramics UAE ────────────────────────────────────────

export class RAKCeramicsConnector extends HTMLSourceConnector {
  sourceId = "rak-ceramics-uae";
  sourceName = "RAK Ceramics UAE";
  sourceUrl = SOURCE_URLS["rak-ceramics-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["ceramics", "tiles", "flooring", "manufacturer"];
  defaultUnit = "sqm";
}

// ─── 2. Graniti UAE ─────────────────────────────────────────────
// EV-00: the only probed source that published recognisable AED prices;
// fully subject to the ADR-0010 robots gate — if granitiuae.com disallows,
// it fails closed by design.

export class GranitiUAEConnector extends HTMLSourceConnector {
  sourceId = "graniti-uae";
  sourceName = "Graniti UAE";
  sourceUrl = SOURCE_URLS["graniti-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["tiles", "marble", "granite", "sanitaryware", "supplier"];
  defaultUnit = "sqm";
  requestDelayMs = 3000; // Respect the supplier's site — modest pacing
}

// ─── 3. Dragon Mart Dubai ───────────────────────────────────────

export class DragonMartConnector extends HTMLSourceConnector {
  sourceId = "dragon-mart-dubai";
  sourceName = "Dragon Mart Dubai";
  sourceUrl = SOURCE_URLS["dragon-mart-dubai"];
  category = "material_cost";
  geography = "Dubai";
  defaultTags = ["retailer", "building-materials", "wholesale"];
  defaultUnit = "unit";
}

// ─── 4. Porcelanosa UAE ─────────────────────────────────────────

export class PorcelanosaConnector extends HTMLSourceConnector {
  sourceId = "porcelanosa-uae";
  sourceName = "Porcelanosa UAE";
  sourceUrl = SOURCE_URLS["porcelanosa-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["tiles", "surfaces", "premium", "manufacturer"];
  defaultUnit = "sqm";
}

// ─── 5. Emaar Properties ────────────────────────────────────────

export class EmaarConnector extends HTMLSourceConnector {
  sourceId = "emaar-properties";
  sourceName = "Emaar Properties";
  sourceUrl = SOURCE_URLS["emaar-properties"];
  category = "competitor_project";
  geography = "Dubai";
  defaultTags = ["developer", "luxury", "dubai", "residential"];
  defaultUnit = "sqft";
}

// ─── 6. DAMAC Properties ────────────────────────────────────────

export class DAMACConnector extends HTMLSourceConnector {
  sourceId = "damac-properties";
  sourceName = "DAMAC Properties";
  sourceUrl = SOURCE_URLS["damac-properties"];
  category = "competitor_project";
  geography = "Dubai";
  defaultTags = ["developer", "luxury", "dubai", "branded-residences"];
  defaultUnit = "sqft";
}

// ─── 7. Nakheel Properties ──────────────────────────────────────

export class NakheelConnector extends HTMLSourceConnector {
  sourceId = "nakheel-properties";
  sourceName = "Nakheel Properties";
  sourceUrl = SOURCE_URLS["nakheel-properties"];
  category = "competitor_project";
  geography = "Dubai";
  defaultTags = ["developer", "master-plan", "dubai", "community"];
  defaultUnit = "sqft";
}

// ─── 8. RICS Market Reports ─────────────────────────────────────

export class RICSConnector extends HTMLSourceConnector {
  sourceId = "rics-market-reports";
  sourceName = "RICS Market Reports";
  sourceUrl = SOURCE_URLS["rics-market-reports"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-survey", "construction", "industry-report", "rics"];
  defaultUnit = "sqm";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 9. JLL MENA Research ───────────────────────────────────────

export class JLLConnector extends HTMLSourceConnector {
  sourceId = "jll-mena-research";
  sourceName = "JLL MENA Research";
  sourceUrl = SOURCE_URLS["jll-mena-research"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-research", "real-estate", "mena", "jll"];
  defaultUnit = "sqm";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 10. Dubai Statistics Center ────────────────────────────────

export class DubaiStatisticsConnector extends HTMLSourceConnector {
  sourceId = "dubai-statistics-center";
  sourceName = "Dubai Statistics Center";
  sourceUrl = SOURCE_URLS["dubai-statistics-center"];
  category = "market_trend";
  geography = "Dubai";
  defaultTags = ["government", "statistics", "dubai", "economic-indicators"];
  defaultUnit = "sqm";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 11. Hafele UAE ─────────────────────────────────────────────

export class HafeleConnector extends HTMLSourceConnector {
  sourceId = "hafele-uae";
  sourceName = "Hafele UAE";
  sourceUrl = SOURCE_URLS["hafele-uae"];
  category = "material_cost";
  geography = "UAE";
  defaultTags = ["hardware", "fittings", "joinery", "manufacturer"];
  defaultUnit = "piece";
}

// ─── 13. Dubai Pulse — Construction Material Prices ─────────────

export class DubaiPulseConnector extends HTMLSourceConnector {
  sourceId = "dubai-pulse-materials";
  sourceName = "Dubai Pulse — Material Prices";
  sourceUrl = SOURCE_URLS["dubai-pulse-materials"];
  category = "material_cost";
  geography = "Dubai";
  defaultTags = ["government", "material-prices", "construction", "dubai-pulse"];
  defaultUnit = "unit";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? "unit",
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 14. SCAD Abu Dhabi — Building Material Statistics ──────────

export class SCADConnector extends HTMLSourceConnector {
  sourceId = "scad-abu-dhabi";
  sourceName = "SCAD Abu Dhabi Statistics";
  sourceUrl = SOURCE_URLS["scad-abu-dhabi"];
  category = "material_cost";
  geography = "Abu Dhabi";
  defaultTags = ["government", "statistics", "abu-dhabi", "material-prices"];
  defaultUnit = "unit";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? "unit",
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 15. DLD — Real Estate Transactions ─────────────────────────

export class DLDTransactionsConnector extends HTMLSourceConnector {
  sourceId = "dld-transactions";
  sourceName = "DLD Real Estate Transactions";
  sourceUrl = SOURCE_URLS["dld-transactions"];
  category = "market_trend";
  geography = "Dubai";
  defaultTags = ["government", "transactions", "real-estate", "dld"];
  defaultUnit = "sqft";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? "sqft",
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 16. Aldar Properties ───────────────────────────────────────

export class AldarPropertiesConnector extends HTMLSourceConnector {
  sourceId = "aldar-properties";
  sourceName = "Aldar Properties";
  sourceUrl = SOURCE_URLS["aldar-properties"];
  category = "competitor_project";
  geography = "Abu Dhabi";
  defaultTags = ["developer", "abu-dhabi", "residential", "master-plan"];
  defaultUnit = "sqft";
}

// ─── 17. CBRE UAE Research ──────────────────────────────────────

export class CBREResearchConnector extends HTMLSourceConnector {
  sourceId = "cbre-uae-research";
  sourceName = "CBRE UAE Research";
  sourceUrl = SOURCE_URLS["cbre-uae-research"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-research", "real-estate", "commercial", "cbre"];
  defaultUnit = "sqft";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 18. Knight Frank UAE ───────────────────────────────────────

export class KnightFrankConnector extends HTMLSourceConnector {
  sourceId = "knight-frank-uae";
  sourceName = "Knight Frank UAE";
  sourceUrl = SOURCE_URLS["knight-frank-uae"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-research", "real-estate", "residential", "knight-frank"];
  defaultUnit = "sqft";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 19. Savills Middle East ────────────────────────────────────

export class SavillsConnector extends HTMLSourceConnector {
  sourceId = "savills-me-research";
  sourceName = "Savills ME Research";
  sourceUrl = SOURCE_URLS["savills-me-research"];
  category = "market_trend";
  geography = "UAE";
  defaultTags = ["market-research", "real-estate", "investment", "savills"];
  defaultUnit = "sqft";

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    return {
      metric: llmEvidence._llmMetric || evidence.title,
      value: llmEvidence._llmValue ?? null,
      unit: llmEvidence._llmUnit ?? null,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: this.defaultTags,
    };
  }
}

// ─── 20. Property Monitor Dubai ─────────────────────────────────

export class PropertyMonitorConnector extends HTMLSourceConnector {
  sourceId = "property-monitor-dubai";
  sourceName = "Property Monitor Dubai";
  sourceUrl = SOURCE_URLS["property-monitor-dubai"];
  category = "market_trend";
  geography = "Dubai";
  defaultTags = ["market-reports", "property", "dubai", "analytics"];
  defaultUnit = "sqft";
}

// ─── 21. Bayut Property Listings ────────────────────────────────

export class BayutListingsConnector extends HTMLSourceConnector {
  sourceId = "bayut-listings";
  sourceName = "Bayut — UAE Property Listings";
  sourceUrl = SOURCE_URLS["bayut-listings"];
  category = "property_price";
  geography = "Dubai";
  defaultTags = ["property-listing", "prices", "residential", "bayut", "dubizzle"];
  defaultUnit = "sqft";
  requestDelayMs = 2000; // Respect rate limits

  // Bayut is JS-rendered; the base fetch() chain already prefers Firecrawl
  // and applies the ADR-0010 robots gate before any provider. No override.

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    // Bayut-specific: extract price per sqft when available
    let metric = llmEvidence._llmMetric || evidence.title;
    let value = llmEvidence._llmValue ?? null;
    let unit = llmEvidence._llmUnit ?? "sqft";

    // Try to compute price per sqft from listing data
    if (value && evidence.rawText) {
      const areaMatch = evidence.rawText.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft)/i);
      if (areaMatch) {
        const area = parseFloat(areaMatch[1].replace(/,/g, ""));
        if (area > 0 && value > area) {
          metric = `${metric} — AED/sqft`;
          value = Math.round(value / area);
          unit = "sqft";
        }
      }
    }

    return {
      metric,
      value,
      unit,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: [...this.defaultTags, "listing"],
    };
  }
}

// ─── 22. PropertyFinder Listings ────────────────────────────────

export class PropertyFinderListingsConnector extends HTMLSourceConnector {
  sourceId = "propertyfinder-listings";
  sourceName = "PropertyFinder — UAE Listings";
  sourceUrl = SOURCE_URLS["propertyfinder-listings"];
  category = "property_price";
  geography = "Dubai";
  defaultTags = ["property-listing", "prices", "residential", "propertyfinder"];
  defaultUnit = "sqft";
  requestDelayMs = 2000; // Respect rate limits

  // PropertyFinder is JS-rendered; the base fetch() chain already prefers
  // Firecrawl and applies the ADR-0010 robots gate. No override.

  async normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput> {
    const { grade, confidence, confidencePolicy, gradePolicy } =
      this.confidenceMetadata(evidence, context);
    const llmEvidence = evidence as any;

    let metric = llmEvidence._llmMetric || evidence.title;
    let value = llmEvidence._llmValue ?? null;
    let unit = llmEvidence._llmUnit ?? "sqft";

    // PropertyFinder-specific: extract price per sqft
    if (value && evidence.rawText) {
      const areaMatch = evidence.rawText.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft)/i);
      if (areaMatch) {
        const area = parseFloat(areaMatch[1].replace(/,/g, ""));
        if (area > 0 && value > area) {
          metric = `${metric} — AED/sqft`;
          value = Math.round(value / area);
          unit = "sqft";
        }
      }
    }

    return {
      metric,
      value,
      unit,
      confidence,
      grade,
      confidencePolicy,
      gradePolicy,
      summary: extractSnippet(evidence.rawText),
      tags: [...this.defaultTags, "listing"],
    };
  }
}

// ─── Connector Registry ─────────────────────────────────────────

export const ALL_CONNECTORS: Record<string, () => BaseSourceConnector> = {
  "rak-ceramics-uae": () => new RAKCeramicsConnector(),
  "graniti-uae": () => new GranitiUAEConnector(),
  "dragon-mart-dubai": () => new DragonMartConnector(),
  "porcelanosa-uae": () => new PorcelanosaConnector(),
  "emaar-properties": () => new EmaarConnector(),
  "damac-properties": () => new DAMACConnector(),
  "nakheel-properties": () => new NakheelConnector(),
  "rics-market-reports": () => new RICSConnector(),
  "jll-mena-research": () => new JLLConnector(),
  "dubai-statistics-center": () => new DubaiStatisticsConnector(),
  "hafele-uae": () => new HafeleConnector(),
  // V4: New UAE Market Sources
  "dubai-pulse-materials": () => new DubaiPulseConnector(),
  "scad-abu-dhabi": () => new SCADConnector(),
  "dld-transactions": () => new DLDTransactionsConnector(),
  "aldar-properties": () => new AldarPropertiesConnector(),
  "cbre-uae-research": () => new CBREResearchConnector(),
  "knight-frank-uae": () => new KnightFrankConnector(),
  "savills-me-research": () => new SavillsConnector(),
  "property-monitor-dubai": () => new PropertyMonitorConnector(),
  // V5: Live Property Listing Sources
  "bayut-listings": () => new BayutListingsConnector(),
  "propertyfinder-listings": () => new PropertyFinderListingsConnector(),
  // V6: PDF-based connectors
  "scad-pdf-materials": () => new SCADPdfConnector(),
};

export function getConnectorById(sourceId: string): BaseSourceConnector | null {
  const factory = ALL_CONNECTORS[sourceId];
  return factory ? factory() : null;
}

export function getAllConnectors(): BaseSourceConnector[] {
  return Object.values(ALL_CONNECTORS).map((factory) => factory());
}

export function getConnectorsByIds(sourceIds: string[]): BaseSourceConnector[] {
  return sourceIds
    .map((id) => getConnectorById(id))
    .filter((c): c is BaseSourceConnector => c !== null);
}
