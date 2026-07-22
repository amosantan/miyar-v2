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
import {
  assertUrlAllowedByRobots,
  evaluateRobotsPolicy,
} from "./robots-policy";
import {
  ConfidencePolicyError,
  REGISTRY_SOURCE_GRADE_POLICY_VERSION,
  STATIC_SOURCE_GRADE_POLICY_VERSION,
  classifyPublicationDate,
  computeConfidenceScore,
  evaluateConnectorConfidence,
  type AcceptedConfidenceEvaluation,
  type GradePolicyMetadata,
  type PublicationDateMetadata,
  type ReliabilityGrade,
} from "./confidence-policy";

export * from "./confidence-policy";

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

/**
 * ADR-0010: robots verdicts are evaluated with one stable browser product
 * token so the policy result is deterministic across the rotating request
 * user agents. The strict evaluation itself lives in ./robots-policy.
 */
const ROBOTS_CHECK_USER_AGENT = USER_AGENTS[0];

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
  /**
   * Resolved source_registry row id. Dynamic connectors set it from their
   * registry config; for static connectors the orchestrator resolves it by
   * slug before the run (ADR-0009/EV-00, audit F4/F5).
   */
  sourceRegistryId?: number;
  /** Optional: set by orchestrator before fetch to enable incremental ingestion */
  lastSuccessfulFetch?: Date;
  /** Optional: artificial delay applied before the specific request fires */
  requestDelayMs?: number;
  /** Grade provenance is exposed even when normalization rejects the item. */
  gradePolicy?: GradePolicyMetadata;
  fetch(): Promise<RawSourcePayload>;
  extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]>;
  normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput>;
}

export interface ConfidenceEvaluationContext {
  /** Immutable fetch/request receipt clock supplied by the caller. */
  evaluatedAt: Date;
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
  /** Raw provider value retained for audit and invalid-date visibility. */
  publishedDateRaw?: string;
  publicationDate?: PublicationDateMetadata;
  /** Immutable page fetch clock; required when normalize() has no context. */
  observedAt?: Date;
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
  confidencePolicy?: AcceptedConfidenceEvaluation;
  gradePolicy?: GradePolicyMetadata;
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
  publishedDateRaw: z.string().optional(),
  publicationDate: z.object({
    raw: z.string().nullable(),
    parsedAt: z.date().nullable(),
    precision: z.enum(["date", "datetime", "unknown"]),
    status: z.enum(["missing", "valid", "invalid", "future"]),
  }).optional(),
  observedAt: z.date().optional(),
  category: z.string().min(1), // Accept any category — validated at orchestrator level
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
  "graniti-uae", "dragon-mart-dubai", "property-monitor-dubai",
]);

// EV-00 registry prune: the sole Grade C static source (dera-interiors) was
// removed with its dead domain; the set stays for future classifications.
const GRADE_C_SOURCE_IDS = new Set<string>([]);

export function assignGrade(sourceId: string): "A" | "B" | "C" {
  if (GRADE_A_SOURCE_IDS.has(sourceId)) return "A";
  if (GRADE_B_SOURCE_IDS.has(sourceId)) return "B";
  if (GRADE_C_SOURCE_IDS.has(sourceId)) return "C";
  return "C";
}

export function resolveGradePolicy(
  sourceId: string,
  registryGrade?: ReliabilityGrade
): GradePolicyMetadata {
  if (registryGrade) {
    return {
      grade: registryGrade,
      policyVersion: REGISTRY_SOURCE_GRADE_POLICY_VERSION,
      source: "source_registry",
      sourceId,
    };
  }
  return {
    grade: assignGrade(sourceId),
    policyVersion: STATIC_SOURCE_GRADE_POLICY_VERSION,
    source: "static_source_registry",
    sourceId,
  };
}

// ─── Deterministic Confidence Rules ──────────────────────────────

export function computeConfidence(
  grade: "A" | "B" | "C",
  publishedDate: Date | undefined,
  fetchedAt: Date
): number {
  return computeConfidenceScore(grade, publishedDate, fetchedAt);
}

/** Convert an untrusted provider date into explicit extraction metadata. */
export function publicationDateFields(
  raw: unknown,
  evaluatedAt: Date
): Pick<ExtractedEvidence, "publishedDate" | "publishedDateRaw" | "publicationDate"> {
  const candidate =
    raw instanceof Date || typeof raw === "string" ? raw : raw == null ? undefined : String(raw);
  const publicationDate = classifyPublicationDate(candidate, evaluatedAt);
  return {
    publishedDate: publicationDate.parsedAt ?? undefined,
    publishedDateRaw: publicationDate.raw ?? undefined,
    publicationDate,
  };
}

/**
 * Evaluate connector confidence from an explicit clock. Orchestration should
 * catch ConfidencePolicyError and persist the rejection rather than fallback.
 */
export function evaluateEvidenceConfidence(
  evidence: ExtractedEvidence,
  grade: ReliabilityGrade,
  context?: ConfidenceEvaluationContext
): AcceptedConfidenceEvaluation {
  const evaluatedAt = context?.evaluatedAt ?? evidence.observedAt ?? new Date(Number.NaN);
  const publicationInput =
    evidence.publicationDate?.raw ?? evidence.publishedDateRaw ?? evidence.publishedDate;
  const result = evaluateConnectorConfidence({
    grade,
    publicationDate: publicationInput,
    evaluatedAt,
  });
  if (!result.accepted) throw new ConfidencePolicyError(result);
  return result;
}

// ─── Firecrawl Credit Cache ─────────────────────────────────────

let firecrawlExhaustedAt: number | null = null;
const FIRECRAWL_EXHAUST_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function markFirecrawlExhausted(): void {
  firecrawlExhaustedAt = Date.now();
  console.log(`[Connector] 🔥 Firecrawl credits exhausted — skipping for 6 hours`);
}

function isFirecrawlCreditExhausted(): boolean {
  if (!firecrawlExhaustedAt) return false;
  if (Date.now() - firecrawlExhaustedAt > FIRECRAWL_EXHAUST_TTL_MS) {
    firecrawlExhaustedAt = null; // Reset after TTL
    return false;
  }
  return true;
}

// ─── Fallback Scraping API Helpers ───────────────────────────────────

function isScrapingDogAvailable(): boolean {
  return !!process.env.SCRAPINGDOG_API_KEY;
}

function isScrapingAntAvailable(): boolean {
  return !!process.env.SCRAPINGANT_API_KEY;
}

function isApifyAvailable(): boolean {
  return !!process.env.APIFY_API_KEY;
}

function isParseHubAvailable(): boolean {
  return !!process.env.PARSEHUB_API_KEY;
}

// ─── Base Source Connector ────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

export abstract class BaseSourceConnector implements SourceConnector {
  abstract sourceId: string;
  abstract sourceName: string;
  abstract sourceUrl: string;
  sourceRegistryId?: number;
  lastSuccessfulFetch?: Date;
  requestDelayMs?: number;

  /**
   * ADR-0010: strict robots gate, evaluated BEFORE any provider — proxies
   * included. Returns a denial payload when the target may not be fetched,
   * or null when the fetch may proceed. The per-origin cache inside
   * robots-policy makes repeated assertions free.
   */
  protected async robotsDenial(url?: string): Promise<RawSourcePayload | null> {
    const targetUrl = url || this.sourceUrl;
    const verdict = await evaluateRobotsPolicy(targetUrl, ROBOTS_CHECK_USER_AGENT);
    if (verdict.allowed) return null;
    console.warn(`[Connector] Robots policy ${verdict.code} for ${targetUrl}: ${verdict.detail}`);
    return {
      url: targetUrl,
      fetchedAt: new Date(),
      statusCode: 403,
      error: `Blocked by robots policy (${verdict.code}): ${verdict.detail}`,
    };
  }

  /**
   * Defensive robots gate for direct provider-helper calls (e.g. crawl loops
   * that pass explicit URLs); throws RobotsPolicyError on denial.
   */
  protected async assertRobots(url?: string): Promise<void> {
    await assertUrlAllowedByRobots(url || this.sourceUrl, ROBOTS_CHECK_USER_AGENT);
  }

  /**
   * Fetch using Firecrawl's headless browser API.
   * Renders JavaScript, bypasses bot protection, returns clean markdown.
   */
  async fetchWithFirecrawl(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    await this.assertRobots(targetUrl);
    const client = await getFirecrawlClient();

    if (!client) {
      throw new Error("Firecrawl client not available");
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
        console.warn(`[Connector] Firecrawl returned too little content for ${targetUrl}`);
        throw new Error("Firecrawl returned insufficient content");
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
      // Cache credit exhaustion
      if (errorMsg.includes("Insufficient credits") || errorMsg.includes("insufficient credit")) {
        markFirecrawlExhausted();
      }
      throw err; // Let the main fetch() chain try other providers
    }
  }

  /**
   * Fetch using ScrapingDog API (fallback #1).
   * Free tier: 1,000 requests/month.
   * API: GET https://api.scrapingdog.com/scrape?api_key=KEY&url=URL&render=true
   */
  async fetchWithScrapingDog(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    await this.assertRobots(targetUrl);
    const apiKey = process.env.SCRAPINGDOG_API_KEY;

    if (!apiKey) {
      throw new Error("SCRAPINGDOG_API_KEY not set");
    }

    try {
      console.log(`[Connector] 🐕 ScrapingDog scraping: ${targetUrl}`);
      const apiUrl = `https://api.scrapingdog.com/scrape?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render=true&dynamic=true`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000); // 45s for JS-rendered pages

      const response = await globalThis.fetch(apiUrl, {
        signal: controller.signal,
        headers: { "Accept": "text/html" },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ScrapingDog HTTP ${response.status}: ${response.statusText}`);
      }

      const rawHtml = await response.text();

      if (rawHtml.length < 50) {
        throw new Error("ScrapingDog returned insufficient content");
      }

      console.log(`[Connector] 🐕 ScrapingDog success: ${targetUrl} (${rawHtml.length} chars)`);

      return {
        url: targetUrl,
        fetchedAt: new Date(),
        rawHtml,
        statusCode: 200,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Connector] ScrapingDog error for ${targetUrl}: ${errorMsg}`);
      throw err; // Let the failover chain handle it
    }
  }

  /**
   * Fetch using ScrapingAnt API (fallback #2).
   * Free tier: 10,000 API credits.
   * API: GET https://api.scrapingant.com/v2/general?url=URL&x-api-key=KEY
   */
  async fetchWithScrapingAnt(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    await this.assertRobots(targetUrl);
    const apiKey = process.env.SCRAPINGANT_API_KEY;

    if (!apiKey) {
      throw new Error("SCRAPINGANT_API_KEY not set");
    }

    try {
      console.log(`[Connector] 🐜 ScrapingAnt scraping: ${targetUrl}`);
      const apiUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&browser=true`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await globalThis.fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "Accept": "text/html",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ScrapingAnt HTTP ${response.status}: ${response.statusText}`);
      }

      const rawHtml = await response.text();

      if (rawHtml.length < 50) {
        throw new Error("ScrapingAnt returned insufficient content");
      }

      console.log(`[Connector] 🐜 ScrapingAnt success: ${targetUrl} (${rawHtml.length} chars)`);

      return {
        url: targetUrl,
        fetchedAt: new Date(),
        rawHtml,
        statusCode: 200,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Connector] ScrapingAnt error for ${targetUrl}: ${errorMsg}`);
      throw err;
    }
  }

  /**
   * Fetch using Apify Web Scraper Actor (fallback #3).
   * Free tier: $5/month platform credits (~10,000 pages).
   * Uses the cheerio-scraper actor for fast HTML extraction.
   */
  async fetchWithApify(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    await this.assertRobots(targetUrl);
    const apiKey = process.env.APIFY_API_KEY;

    if (!apiKey) {
      throw new Error("APIFY_API_KEY not set");
    }

    try {
      console.log(`[Connector] 🐝 Apify scraping: ${targetUrl}`);

      // Use Apify's web-scraper actor via REST API
      const runUrl = `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000); // 60s for actor run

      const response = await globalThis.fetch(runUrl, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: targetUrl }],
          pageFunction: `async function pageFunction(context) {
            const { page, request } = context;
            const html = await page.content();
            return { url: request.url, html };
          }`,
          proxyConfiguration: { useApifyProxy: true },
          maxPagesPerCrawl: 1,
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Apify HTTP ${response.status}: ${response.statusText}`);
      }

      const results = await response.json() as any[];
      const rawHtml = results?.[0]?.html || "";

      if (rawHtml.length < 50) {
        throw new Error("Apify returned insufficient content");
      }

      console.log(`[Connector] 🐝 Apify success: ${targetUrl} (${rawHtml.length} chars)`);

      return {
        url: targetUrl,
        fetchedAt: new Date(),
        rawHtml,
        statusCode: 200,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Connector] Apify error for ${targetUrl}: ${errorMsg}`);
      throw err;
    }
  }

  /**
   * Fetch using ParseHub API (fallback #5).
   * ParseHub is project-based — it requires pre-configured scrape templates.
   * For ad-hoc URLs, it uses the generic web-scraper project if available.
   * Free tier: 200 pages per run, 5 projects.
   * API: POST https://www.parsehub.com/api/v2/projects/{token}/run
   */
  async fetchWithParseHub(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    await this.assertRobots(targetUrl);
    const apiKey = process.env.PARSEHUB_API_KEY;
    const projectToken = process.env.PARSEHUB_PROJECT_TOKEN; // optional default project

    if (!apiKey) {
      throw new Error("PARSEHUB_API_KEY not set");
    }

    if (!projectToken) {
      // Without a project token, ParseHub can't scrape ad-hoc URLs
      throw new Error("PARSEHUB_PROJECT_TOKEN not set — ParseHub requires pre-configured projects");
    }

    try {
      console.log(`[Connector] 🔷 ParseHub scraping: ${targetUrl}`);

      // Step 1: Run the project with custom start_url
      const runResponse = await globalThis.fetch(
        `https://www.parsehub.com/api/v2/projects/${projectToken}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
          body: new URLSearchParams({
            api_key: apiKey,
            start_url: targetUrl,
          }).toString(),
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!runResponse.ok) {
        throw new Error(`ParseHub run failed: HTTP ${runResponse.status}`);
      }

      const runData = await runResponse.json() as any;
      const runToken = runData?.run_token;
      if (!runToken) {
        throw new Error("ParseHub didn't return a run_token");
      }

      // Step 2: Poll for completion (max 90s)
      let dataReady = false;
      const pollStart = Date.now();
      while (!dataReady && (Date.now() - pollStart) < 90_000) {
        await new Promise(r => setTimeout(r, 5_000)); // Poll every 5s
        const statusRes = await globalThis.fetch(
          `https://www.parsehub.com/api/v2/runs/${runToken}?api_key=${apiKey}`,
          { signal: AbortSignal.timeout(10_000) }
        );
        const statusData = await statusRes.json() as any;
        dataReady = statusData?.data_ready === true || statusData?.status === "complete";
      }

      if (!dataReady) {
        throw new Error("ParseHub run timed out waiting for data");
      }

      // Step 3: Get the data
      const dataRes = await globalThis.fetch(
        `https://www.parsehub.com/api/v2/runs/${runToken}/data?api_key=${apiKey}`,
        { signal: AbortSignal.timeout(15_000) }
      );

      const rawData = await dataRes.text();

      if (rawData.length < 50) {
        throw new Error("ParseHub returned insufficient data");
      }

      console.log(`[Connector] 🔷 ParseHub success: ${targetUrl} (${rawData.length} chars)`);

      return {
        url: targetUrl,
        fetchedAt: new Date(),
        rawHtml: rawData,
        statusCode: 200,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Connector] ParseHub error for ${targetUrl}: ${errorMsg}`);
      throw err;
    }
  }

  /**
   * Basic HTTP fetch — used as last resort when all APIs are unavailable.
   */
  async fetchBasic(url?: string): Promise<RawSourcePayload> {
    const targetUrl = url || this.sourceUrl;
    let lastError: string | undefined;
    const userAgent = getRandomUserAgent();

    const robotsBlock = await this.robotsDenial(targetUrl);
    if (robotsBlock) return robotsBlock;

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
   * Main fetch method with automatic failover chain:
   *   Firecrawl → ScrapingDog → ScrapingAnt → Apify → ParseHub → Native fetch
   *
   * Each provider is attempted in order. If one fails or returns
   * insufficient content, the next provider is tried automatically.
   */
  async fetch(): Promise<RawSourcePayload> {
    if (this.requestDelayMs && this.requestDelayMs > 0) {
      await new Promise(r => setTimeout(r, this.requestDelayMs));
    }

    // ADR-0010: strict robots gate before ANY provider, proxies included.
    const robotsBlock = await this.robotsDenial();
    if (robotsBlock) return robotsBlock;

    // Provider 1: Firecrawl (best quality — markdown + JS rendering)
    if (isFirecrawlAvailable() && !isFirecrawlCreditExhausted()) {
      try {
        const result = await this.fetchWithFirecrawl();
        if (!result.error && ((result.rawHtml?.length || 0) > 50 || (result.markdown?.length || 0) > 50)) {
          return result;
        }
      } catch { /* fall through */ }
    }

    // Provider 2: ScrapingAnt (most reliable in audit — browser rendering)
    if (isScrapingAntAvailable()) {
      try {
        const result = await this.fetchWithScrapingAnt();
        if (!result.error && (result.rawHtml?.length || 0) > 50) {
          return result;
        }
      } catch { /* fall through */ }
    }

    // Provider 3: ScrapingDog (JS rendering, proxy rotation)
    if (isScrapingDogAvailable()) {
      try {
        const result = await this.fetchWithScrapingDog();
        if (!result.error && (result.rawHtml?.length || 0) > 50) {
          return result;
        }
      } catch { /* fall through */ }
    }

    // Provider 4: Apify (full browser Actor, proxy network)
    if (isApifyAvailable()) {
      try {
        const result = await this.fetchWithApify();
        if (!result.error && (result.rawHtml?.length || 0) > 50) {
          return result;
        }
      } catch { /* fall through */ }
    }

    // Provider 5: ParseHub (project-based, for recurring JS-heavy sources)
    if (isParseHubAvailable()) {
      try {
        const result = await this.fetchWithParseHub();
        if (!result.error && (result.rawHtml?.length || 0) > 50) {
          return result;
        }
      } catch { /* fall through */ }
    }

    // Provider 6: Native fetch (last resort — no JS rendering)
    console.log(`[Connector] 📡 Using native fetch for ${this.sourceUrl} (all API providers exhausted)`);
    return this.fetchBasic();
  }

  abstract extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]>;
  abstract normalize(
    evidence: ExtractedEvidence,
    context?: ConfidenceEvaluationContext
  ): Promise<NormalizedEvidenceInput>;
}
