/**
 * MIYAR V2 — Source Connector Interface & Base Class
 *
 * All UAE source connectors implement SourceConnector.
 * BaseSourceConnector provides shared fetch logic with timeout,
 * retry (exponential backoff, max 3 attempts), and error capture.
 *
 * Supports Firecrawl for JavaScript-rendered pages when
 * FIRECRAWL_API_KEY is set in environment.
 *
 * LLM is permitted ONLY for:
 *   - Extracting structured data from unstructured HTML
 *   - Normalizing free-text into metric/value/unit/summary
 *   - Generating evidence summary narrative
 *
 * LLM must NOT be used for: scoring, weighting, ranking,
 * deciding confidence levels, or any numerical computation.
 */

import { z } from "zod";
// @ts-ignore
import robotsParser from "robots-parser";

// ─── Constants & Resilience Data ─────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

const CAPTCHA_INDICATORS = ["cf-browser-verification", "g-recaptcha", "px-captcha", "Please verify you are a human"];
const PAYWALL_INDICATORS = ["subscribe to read", "premium content", "paywall"];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();

async function checkRobotsTxt(targetUrl: string, userAgent: string): Promise<boolean> {
  try {
    const urlObj = new URL(targetUrl);
    const origin = urlObj.origin;
    let robots = robotsCache.get(origin);

    if (!robots) {
      const robotsUrl = `${origin}/robots.txt`;
      const res = await globalThis.fetch(robotsUrl, { headers: { "User-Agent": userAgent } });
      if (res.ok) {
        const text = await res.text();
        robots = robotsParser(robotsUrl, text);
      } else {
        robots = robotsParser(robotsUrl, "");
      }
      robotsCache.set(origin, robots);
    }

    return robots.isAllowed(targetUrl, userAgent) !== false;
  } catch (err) {
    return true; // fail open
  }
}

// ─── Firecrawl Client (lazy-loaded) ─────────────────────────────

let _firecrawlClient: any = null;
let _firecrawlInitPromise: Promise<any> | null = null;

async function getFirecrawlClient(): Promise<any | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  if (!_firecrawlClient && !_firecrawlInitPromise) {
    _firecrawlInitPromise = (async () => {
      try {
        const mod = await import("@mendable/firecrawl-js");
        const FirecrawlApp = mod.default;
        _firecrawlClient = new FirecrawlApp({ apiKey });
      } catch (err) {
        console.warn("[Connector] Firecrawl SDK not available, falling back to basic fetch");
      }
      return _firecrawlClient;
    })();
  }

  if (_firecrawlInitPromise) await _firecrawlInitPromise;
  return _firecrawlClient;
}

/** Check if Firecrawl is available */
export function isFirecrawlAvailable(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}

// ─── Types ───────────────────────────────────────────────────────

export interface SourceConnector {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  /** Optional: set by orchestrator before fetch to enable incremental ingestion */
  lastSuccessfulFetch?: Date;
  /** Optional: artificial delay applied before the specific request fires */
  requestDelayMs?: number;
  fetch(): Promise<RawSourcePayload>;
  extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]>;
  normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput>;
}

export interface RawSourcePayload {
  url: string;
  fetchedAt: Date;
  rawHtml?: string;
  rawJson?: object;
  /** Markdown content from Firecrawl (cleaner than HTML for LLM) */
  markdown?: string;
  statusCode: number;
  error?: string;
}

export interface ExtractedEvidence {
  title: string;
  rawText: string;
  publishedDate?: Date;
  category: string;
  geography: string;
  sourceUrl: string;
}

export interface NormalizedEvidenceInput {
  metric: string;
  value: number | null;
  valueMax?: number | null;
  unit: string | null;
  confidence: number;
  grade: "A" | "B" | "C";
  summary: string;
  tags: string[];
  brand?: string | null;
  // V7: Design Intelligence Fields
  finishLevel?: string | null;
  designStyle?: string | null;
  brandsMentioned?: string[] | null;
  materialSpec?: string | null;
  intelligenceType?: string;
}

// ─── Zod Schemas (runtime validation) ────────────────────────────

export const rawSourcePayloadSchema = z.object({
  url: z.string().url(),
  fetchedAt: z.date(),
  rawHtml: z.string().optional(),
  rawJson: z.record(z.string(), z.unknown()).optional(),
  markdown: z.string().optional(),
  statusCode: z.number().int(),
  error: z.string().optional(),
});

export const extractedEvidenceSchema = z.object({
  title: z.string().min(1),
  rawText: z.string().min(1),
  publishedDate: z.date().optional(),
  category: z.enum(["material_cost", "fitout_rate", "market_trend", "competitor_project"]),
  geography: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const normalizedEvidenceInputSchema = z.object({
  metric: z.string().min(1),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  grade: z.enum(["A", "B", "C"]),
  summary: z.string().min(1),
  tags: z.array(z.string()),
});

// ─── Deterministic Grade Assignment ──────────────────────────────

const GRADE_A_SOURCE_IDS = new Set([
  "emaar-properties", "damac-properties", "nakheel-properties",
  "rics-market-reports", "jll-mena-research", "dubai-statistics-center",
  "dubai-pulse-materials", "scad-abu-dhabi", "dld-transactions",
  "aldar-properties", "cbre-uae-research", "knight-frank-uae", "savills-me-research",
]);

const GRADE_B_SOURCE_IDS = new Set([
  "rak-ceramics-uae", "porcelanosa-uae", "hafele-uae",
  "gems-building-materials", "dragon-mart-dubai", "property-monitor-dubai",
]);

const GRADE_C_SOURCE_IDS = new Set(["dera-interiors"]);

export function assignGrade(sourceId: string): "A" | "B" | "C" {
  if (GRADE_A_SOURCE_IDS.has(sourceId)) return "A";
  if (GRADE_B_SOURCE_IDS.has(sourceId)) return "B";
  if (GRADE_C_SOURCE_IDS.has(sourceId)) return "C";
  return "C";
}

// ─── Deterministic Confidence Rules ──────────────────────────────

const BASE_CONFIDENCE: Record<string, number> = { A: 0.85, B: 0.70, C: 0.55 };
const RECENCY_BONUS = 0.10;
const STALENESS_PENALTY = -0.15;
const CONFIDENCE_CAP = 1.0;
const CONFIDENCE_FLOOR = 0.20;

export function computeConfidence(
  grade: "A" | "B" | "C",
  publishedDate: Date | undefined,
  fetchedAt: Date
): number {
  let confidence = BASE_CONFIDENCE[grade];

  if (!publishedDate) {
    confidence += STALENESS_PENALTY;
  } else {
    const daysSincePublished = Math.floor(
      (fetchedAt.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePublished <= 90) {
      confidence += RECENCY_BONUS;
    } else if (daysSincePublished > 365) {
      confidence += STALENESS_PENALTY;
    }
  }

  return Math.min(CONFIDENCE_CAP, Math.max(CONFIDENCE_FLOOR, confidence));
}

// ─── Base Source Connector ────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

export abstract class BaseSourceConnector implements SourceConnector {
  abstract sourceId: string;
  abstract sourceName: string;
  abstract sourceUrl: string;
  lastSuccessfulFetch?: Date;
  requestDelayMs?: number;

  /**
   * Fetch using Firecrawl's headless browser API.
   * Renders JavaScript, bypasses bot protection, returns clean markdown.
   */
  async fetchWithFirecrawl(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    const client = await getFirecrawlClient();

    if (!client) {
      return this.fetchBasic(targetUrl);
    }

    try {
      console.log(`[Connector] 🔥 Firecrawl scraping: ${targetUrl}`);
      // v4 SDK: scrape() returns Document directly (no success wrapper)
      const doc: any = await client.scrape(targetUrl, {
        formats: ["markdown", "html"],
      });

      const markdown = doc?.markdown || "";
      const html = doc?.html || "";

      if (markdown.length < 50 && html.length < 50) {
        console.warn(`[Connector] Firecrawl returned too little content for ${targetUrl}, falling back`);
        return this.fetchBasic(targetUrl);
      }

      console.log(`[Connector] 🔥 Firecrawl success: ${targetUrl} (${markdown.length} chars md, ${html.length} chars html)`);

      return {
        url: targetUrl,
        fetchedAt: new Date(),
        rawHtml: html,
        markdown,
        statusCode: doc?.metadata?.statusCode || 200,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Connector] Firecrawl error for ${targetUrl}: ${errorMsg}, falling back`);
      return this.fetchBasic(targetUrl);
    }
  }

  /**
   * Basic HTTP fetch — used as fallback when Firecrawl is unavailable.
   */
  async fetchBasic(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    let lastError: string | undefined;
    const userAgent = getRandomUserAgent();

    const isAllowed = await checkRobotsTxt(targetUrl, userAgent);
    if (!isAllowed) {
      return { url: targetUrl, fetchedAt: new Date(), statusCode: 403, error: "Blocked by origin robots.txt" };
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await globalThis.fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": userAgent,
            "Accept": "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
          },
        });

        clearTimeout(timeout);

        const contentType = response.headers.get("content-type") || "";
        let rawHtml: string | undefined;
        let rawJson: object | undefined;

        if (contentType.includes("application/json")) {
          rawJson = await response.json() as object;
        } else {
          rawHtml = await response.text();

          if (CAPTCHA_INDICATORS.some(ind => rawHtml!.includes(ind))) {
            throw new Error("CAPTCHA challenge detected on page");
          }
          if (PAYWALL_INDICATORS.some(ind => rawHtml!.toLowerCase().includes(ind))) {
            throw new Error("Paywall detected on page content");
          }

          if (rawHtml.trim().startsWith("{") || rawHtml.trim().startsWith("[")) {
            try { rawJson = JSON.parse(rawHtml); } catch { /* Keep as HTML */ }
          }
        }

        return {
          url: targetUrl,
          fetchedAt: new Date(),
          rawHtml,
          rawJson,
          statusCode: response.status,
          error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastError = errorMsg;

        if (attempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    return {
      url: targetUrl,
      fetchedAt: new Date(),
      statusCode: 0,
      error: `Failed after ${MAX_RETRIES} attempts: ${lastError}`,
    };
  }

  /**
   * Main fetch method. Uses Firecrawl when available, falls back to basic HTTP.
   */
  async fetch(): Promise<RawSourcePayload> {
    if (this.requestDelayMs && this.requestDelayMs > 0) {
      await new Promise(r => setTimeout(r, this.requestDelayMs));
    }

    if (isFirecrawlAvailable()) {
      return this.fetchWithFirecrawl();
    }

    return this.fetchBasic();
  }

  abstract extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]>;
  abstract normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput>;
}
