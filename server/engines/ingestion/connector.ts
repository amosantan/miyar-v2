/**
 * MIYAR V2 — Source Connector Interface & Base Class
 *
 * All 12 UAE source connectors implement SourceConnector.
 * BaseSourceConnector provides shared fetch logic with timeout,
 * retry (exponential backoff, max 3 attempts), and error capture.
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

// ─── Types ───────────────────────────────────────────────────────

export interface SourceConnector {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  /** Optional: set by orchestrator before fetch to enable incremental ingestion */
  lastSuccessfulFetch?: Date;
  fetch(): Promise<RawSourcePayload>;
  extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]>;
  normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput>;
}

export interface RawSourcePayload {
  url: string;
  fetchedAt: Date;
  rawHtml?: string;
  rawJson?: object;
  statusCode: number;
  error?: string;
}

export interface ExtractedEvidence {
  title: string;
  rawText: string;
  publishedDate?: Date;
  category: string; // "material_cost" | "fitout_rate" | "market_trend" | "competitor_project"
  geography: string; // "Dubai" | "Abu Dhabi" | "UAE"
  sourceUrl: string;
}

export interface NormalizedEvidenceInput {
  metric: string;
  value: number | null;
  unit: string | null;
  confidence: number; // 0.0 – 1.0
  grade: "A" | "B" | "C";
  summary: string;
  tags: string[];
}

// ─── Zod Schemas (runtime validation) ────────────────────────────

export const rawSourcePayloadSchema = z.object({
  url: z.string().url(),
  fetchedAt: z.date(),
  rawHtml: z.string().optional(),
  rawJson: z.record(z.string(), z.unknown()).optional(),
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

/** Grade A sources: verified government, international research, official industry bodies */
const GRADE_A_SOURCE_IDS = new Set([
  "emaar-properties",
  "damac-properties",
  "nakheel-properties",
  "rics-market-reports",
  "jll-mena-research",
  "dubai-statistics-center",
]);

/** Grade B sources: established trade suppliers with published price lists */
const GRADE_B_SOURCE_IDS = new Set([
  "rak-ceramics-uae",
  "porcelanosa-uae",
  "hafele-uae",
  "gems-building-materials",
  "dragon-mart-dubai",
]);

/** Grade C sources: interior design / fit-out firms with project-based pricing */
const GRADE_C_SOURCE_IDS = new Set([
  "dera-interiors",
]);

export function assignGrade(sourceId: string): "A" | "B" | "C" {
  if (GRADE_A_SOURCE_IDS.has(sourceId)) return "A";
  if (GRADE_B_SOURCE_IDS.has(sourceId)) return "B";
  if (GRADE_C_SOURCE_IDS.has(sourceId)) return "C";
  return "C"; // default to lowest grade for unknown sources
}

// ─── Deterministic Confidence Rules ──────────────────────────────

const BASE_CONFIDENCE: Record<string, number> = { A: 0.85, B: 0.70, C: 0.55 };
const RECENCY_BONUS = 0.10;       // publishedDate within 90 days
const STALENESS_PENALTY = -0.15;  // publishedDate > 365 days or missing
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
  /** Set by orchestrator before fetch to enable incremental ingestion */
  lastSuccessfulFetch?: Date;

  /**
   * Shared fetch with timeout (15s) and exponential backoff retry (max 3 attempts).
   * Returns RawSourcePayload with error field populated on failure.
   */
  async fetch(): Promise<RawSourcePayload> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await globalThis.fetch(this.sourceUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "MIYAR-Intelligence-Engine/2.0",
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
          // Try to parse as JSON if it looks like JSON
          if (rawHtml.trim().startsWith("{") || rawHtml.trim().startsWith("[")) {
            try {
              rawJson = JSON.parse(rawHtml);
            } catch {
              // Keep as HTML
            }
          }
        }

        return {
          url: this.sourceUrl,
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
      url: this.sourceUrl,
      fetchedAt: new Date(),
      statusCode: 0,
      error: `Failed after ${MAX_RETRIES} attempts: ${lastError}`,
    };
  }

  abstract extract(raw: RawSourcePayload): Promise<ExtractedEvidence[]>;
  abstract normalize(evidence: ExtractedEvidence): Promise<NormalizedEvidenceInput>;
}
