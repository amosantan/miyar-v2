/**
 * MIYAR V2 — UAE Source Connectors (12 total)
 *
 * Each connector extends BaseSourceConnector and implements:
 *   - sourceId / sourceName / sourceUrl
 *   - extract(): parse raw HTML/JSON into ExtractedEvidence[]
 *   - normalize(): convert evidence into NormalizedEvidenceInput
 *
 * Grading and confidence are deterministic (from connector.ts).
 * LLM is NOT used in any connector — all extraction is rule-based.
 *
 * Source types:
 *   - Manufacturer catalogs (RAK Ceramics, Porcelanosa, Hafele)
 *   - Supplier catalogs (DERA Interiors, GEMS Building Materials)
 *   - Retailer listings (Dragon Mart Dubai)
 *   - Developer brochures (Emaar, DAMAC, Nakheel)
 *   - Industry reports (RICS, JLL MENA)
 *   - Government data (Dubai Statistics Center)
 */

import {
  BaseSourceConnector,
  assignGrade,
  computeConfidence,
  type RawSourcePayload,
  type ExtractedEvidence,
  type NormalizedEvidenceInput,
} from "../connector";

// ─── Helper: Extract price from text ────────────────────────────

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

// ─── 1. RAK Ceramics UAE ────────────────────────────────────────

export class RAKCeramicsConnector extends BaseSourceConnector {
  sourceId = "rak-ceramics-uae";
  sourceName = "RAK Ceramics UAE";
  sourceUrl = "https://www.rakceramics.com/ae/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    // Extract product sections from HTML
    const productSections = html.match(/<(?:div|article|section)[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section)>/gi) || [];

    for (const section of productSections.slice(0, 20)) {
      const titleMatch = section.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `RAK Ceramics - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    // If no structured products found, extract from full page
    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "RAK Ceramics UAE - Product Catalog",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "sqm",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["ceramics", "tiles", "flooring", "manufacturer"],
    };
  }
}

// ─── 2. DERA Interiors ──────────────────────────────────────────

export class DERAInteriorsConnector extends BaseSourceConnector {
  sourceId = "dera-interiors";
  sourceName = "DERA Interiors";
  sourceUrl = "https://www.derainteriors.com/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    // Extract service/project sections
    const sections = html.match(/<(?:div|article|section)[^>]*class="[^"]*(?:service|project|portfolio)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section)>/gi) || [];

    for (const section of sections.slice(0, 15)) {
      const titleMatch = section.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `DERA Interiors - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "fitout_rate",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "DERA Interiors - Fit-out Services",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "fitout_rate",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "sqft",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["fitout", "interior-design", "contractor"],
    };
  }
}

// ─── 3. Dragon Mart Dubai ───────────────────────────────────────

export class DragonMartConnector extends BaseSourceConnector {
  sourceId = "dragon-mart-dubai";
  sourceName = "Dragon Mart Dubai";
  sourceUrl = "https://www.dragonmart.ae/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    // Extract product listings
    const listings = html.match(/<(?:div|li|article)[^>]*class="[^"]*(?:product|item|listing)[^"]*"[^>]*>[\s\S]*?<\/(?:div|li|article)>/gi) || [];

    for (const listing of listings.slice(0, 25)) {
      const titleMatch = listing.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i) ||
                          listing.match(/class="[^"]*(?:title|name)[^"]*"[^>]*>(.*?)</i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = listing.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `Dragon Mart - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "material_cost",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "Dragon Mart Dubai - Building Materials",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "material_cost",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "unit",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["retailer", "building-materials", "wholesale"],
    };
  }
}

// ─── 4. Porcelanosa UAE ─────────────────────────────────────────

export class PorcelanosaConnector extends BaseSourceConnector {
  sourceId = "porcelanosa-uae";
  sourceName = "Porcelanosa UAE";
  sourceUrl = "https://www.porcelanosa.com/ae/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    const productSections = html.match(/<(?:div|article)[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/(?:div|article)>/gi) || [];

    for (const section of productSections.slice(0, 20)) {
      const titleMatch = section.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `Porcelanosa - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "Porcelanosa UAE - Premium Tiles & Surfaces",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "sqm",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["tiles", "surfaces", "premium", "manufacturer"],
    };
  }
}

// ─── 5. Emaar Properties ────────────────────────────────────────

export class EmaarConnector extends BaseSourceConnector {
  sourceId = "emaar-properties";
  sourceName = "Emaar Properties";
  sourceUrl = "https://www.emaar.com/en/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    // Extract project cards
    const projectCards = html.match(/<(?:div|article|section)[^>]*class="[^"]*(?:project|property|development|community)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section)>/gi) || [];

    for (const card of projectCards.slice(0, 15)) {
      const titleMatch = card.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = card.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `Emaar - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "competitor_project",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "Emaar Properties - Development Portfolio",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "competitor_project",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "sqft",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["developer", "luxury", "dubai", "residential"],
    };
  }
}

// ─── 6. DAMAC Properties ────────────────────────────────────────

export class DAMACConnector extends BaseSourceConnector {
  sourceId = "damac-properties";
  sourceName = "DAMAC Properties";
  sourceUrl = "https://www.damacproperties.com/en/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    const projectCards = html.match(/<(?:div|article|section)[^>]*class="[^"]*(?:project|property|development)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section)>/gi) || [];

    for (const card of projectCards.slice(0, 15)) {
      const titleMatch = card.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = card.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `DAMAC - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "competitor_project",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "DAMAC Properties - Development Portfolio",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "competitor_project",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "sqft",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["developer", "luxury", "dubai", "branded-residences"],
    };
  }
}

// ─── 7. Nakheel Properties ──────────────────────────────────────

export class NakheelConnector extends BaseSourceConnector {
  sourceId = "nakheel-properties";
  sourceName = "Nakheel Properties";
  sourceUrl = "https://www.nakheel.com/en/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    const projectCards = html.match(/<(?:div|article|section)[^>]*class="[^"]*(?:project|property|community|development)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section)>/gi) || [];

    for (const card of projectCards.slice(0, 15)) {
      const titleMatch = card.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = card.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `Nakheel - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "competitor_project",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "Nakheel Properties - Community Portfolio",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "competitor_project",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "sqft",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["developer", "master-plan", "dubai", "community"],
    };
  }
}

// ─── 8. RICS Market Reports ─────────────────────────────────────

export class RICSConnector extends BaseSourceConnector {
  sourceId = "rics-market-reports";
  sourceName = "RICS Market Reports";
  sourceUrl = "https://www.rics.org/news-insights/market-surveys";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    // Extract report/article sections
    const articles = html.match(/<(?:div|article)[^>]*class="[^"]*(?:article|report|insight|survey|card)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article)>/gi) || [];

    for (const article of articles.slice(0, 10)) {
      const titleMatch = article.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      // Look for date
      const dateMatch = article.match(/(?:Published|Date|Updated)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i) ||
                         article.match(/(\d{4}-\d{2}-\d{2})/);
      let publishedDate: Date | undefined;
      if (dateMatch) {
        const parsed = new Date(dateMatch[1]);
        if (!isNaN(parsed.getTime())) publishedDate = parsed;
      }

      const text = article.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `RICS - ${title}`,
        rawText: text,
        publishedDate,
        category: "market_trend",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "RICS Market Survey - UAE Construction",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "market_trend",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());

    return {
      metric: evidence.title,
      value: null, // Industry reports typically don't have single price values
      unit: null,
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["market-survey", "construction", "industry-report", "rics"],
    };
  }
}

// ─── 9. JLL MENA Research ───────────────────────────────────────

export class JLLConnector extends BaseSourceConnector {
  sourceId = "jll-mena-research";
  sourceName = "JLL MENA Research";
  sourceUrl = "https://www.jll.com/en/trends-and-insights/research";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    const articles = html.match(/<(?:div|article)[^>]*class="[^"]*(?:article|research|insight|card|report)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article)>/gi) || [];

    for (const article of articles.slice(0, 10)) {
      const titleMatch = article.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const dateMatch = article.match(/(\d{1,2}\s+\w+\s+\d{4})/i) ||
                         article.match(/(\d{4}-\d{2}-\d{2})/);
      let publishedDate: Date | undefined;
      if (dateMatch) {
        const parsed = new Date(dateMatch[1]);
        if (!isNaN(parsed.getTime())) publishedDate = parsed;
      }

      const text = article.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `JLL - ${title}`,
        rawText: text,
        publishedDate,
        category: "market_trend",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "JLL MENA - Real Estate Market Research",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "market_trend",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());

    return {
      metric: evidence.title,
      value: null,
      unit: null,
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["market-research", "real-estate", "mena", "jll"],
    };
  }
}

// ─── 10. Dubai Statistics Center ────────────────────────────────

export class DubaiStatisticsConnector extends BaseSourceConnector {
  sourceId = "dubai-statistics-center";
  sourceName = "Dubai Statistics Center";
  sourceUrl = "https://www.dsc.gov.ae/en-us";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    // Extract data sections and statistical reports
    const sections = html.match(/<(?:div|article|section)[^>]*class="[^"]*(?:stat|data|report|indicator|publication)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|section)>/gi) || [];

    for (const section of sections.slice(0, 10)) {
      const titleMatch = section.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `DSC - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "market_trend",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "Dubai Statistics Center - Economic Indicators",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "market_trend",
        geography: "Dubai",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : null,
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["government", "statistics", "dubai", "economic-indicators"],
    };
  }
}

// ─── 11. Hafele UAE ─────────────────────────────────────────────

export class HafeleConnector extends BaseSourceConnector {
  sourceId = "hafele-uae";
  sourceName = "Hafele UAE";
  sourceUrl = "https://www.hafele.ae/en/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    const productSections = html.match(/<(?:div|article)[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/(?:div|article)>/gi) || [];

    for (const section of productSections.slice(0, 20)) {
      const titleMatch = section.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `Hafele - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "Hafele UAE - Hardware & Fittings Catalog",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "piece",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["hardware", "fittings", "joinery", "manufacturer"],
    };
  }
}

// ─── 12. GEMS Building Materials ────────────────────────────────

export class GEMSConnector extends BaseSourceConnector {
  sourceId = "gems-building-materials";
  sourceName = "GEMS Building Materials";
  sourceUrl = "https://www.gemsbm.com/";

  async extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]> {
    const evidence: ExtractedEvidence[] = [];
    const html = raw.rawHtml || "";

    const productSections = html.match(/<(?:div|article|li)[^>]*class="[^"]*(?:product|item|category)[^"]*"[^>]*>[\s\S]*?<\/(?:div|article|li)>/gi) || [];

    for (const section of productSections.slice(0, 20)) {
      const titleMatch = section.match(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      evidence.push({
        title: `GEMS - ${title}`,
        rawText: text,
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    if (evidence.length === 0 && html.length > 100) {
      evidence.push({
        title: "GEMS Building Materials - Product Catalog",
        rawText: extractSnippet(html.replace(/<[^>]+>/g, " ")),
        publishedDate: undefined,
        category: "material_cost",
        geography: "UAE",
        sourceUrl: raw.url,
      });
    }

    return evidence;
  }

  async normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput> {
    const grade = assignGrade(this.sourceId);
    const confidence = computeConfidence(grade, evidence.publishedDate, new Date());
    const prices = extractPricesFromText(evidence.rawText);

    return {
      metric: evidence.title,
      value: prices.length > 0 ? prices[0].value : null,
      unit: prices.length > 0 ? prices[0].unit : "unit",
      confidence,
      grade,
      summary: extractSnippet(evidence.rawText),
      tags: ["building-materials", "supplier", "wholesale"],
    };
  }
}

// ─── Connector Registry ─────────────────────────────────────────

export const ALL_CONNECTORS: Record<string, () => BaseSourceConnector> = {
  "rak-ceramics-uae": () => new RAKCeramicsConnector(),
  "dera-interiors": () => new DERAInteriorsConnector(),
  "dragon-mart-dubai": () => new DragonMartConnector(),
  "porcelanosa-uae": () => new PorcelanosaConnector(),
  "emaar-properties": () => new EmaarConnector(),
  "damac-properties": () => new DAMACConnector(),
  "nakheel-properties": () => new NakheelConnector(),
  "rics-market-reports": () => new RICSConnector(),
  "jll-mena-research": () => new JLLConnector(),
  "dubai-statistics-center": () => new DubaiStatisticsConnector(),
  "hafele-uae": () => new HafeleConnector(),
  "gems-building-materials": () => new GEMSConnector(),
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
