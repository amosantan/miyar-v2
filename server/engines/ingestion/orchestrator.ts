/**
 * MIYAR V2 — Ingestion Orchestrator
 *
 * Central orchestrator that manages connector execution, queuing,
 * and result persistence. Executes connectors in parallel (max 3
 * concurrent), handles failures gracefully, detects duplicates,
 * and logs all events to the audit log.
 */

import { randomUUID } from "crypto";
import type {
  SourceConnector,
  ExtractedEvidence,
  NormalizedEvidenceInput,
} from "./connector";
import {
  extractedEvidenceSchema,
  normalizedEvidenceInputSchema,
} from "./connector";
import {
  createEvidenceRecord,
  createIntelligenceAuditEntry,
  getDb,
} from "../../db";
import { generateBenchmarkProposals } from "./proposal-generator";
import { evidenceRecords, ingestionRuns } from "../../../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────

export interface IngestionRunReport {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  triggeredBy: "manual" | "scheduled" | "api";
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  evidenceCreated: number;
  evidenceSkipped: number;
  errors: Array<{ sourceId: string; sourceName: string; error: string }>;
  perSource: Array<{
    sourceId: string;
    sourceName: string;
    status: "success" | "failed";
    evidenceExtracted: number;
    evidenceCreated: number;
    evidenceSkipped: number;
    error?: string;
  }>;
}

interface ConnectorResult {
  sourceId: string;
  sourceName: string;
  status: "success" | "failed";
  evidenceExtracted: number;
  evidenceCreated: number;
  evidenceSkipped: number;
  error?: string;
}

// ─── Concurrency Limiter ─────────────────────────────────────────

const MAX_CONCURRENT = 3;

async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => runNext()
  );

  await Promise.all(workers);
  return results;
}

// ─── Duplicate Detection ─────────────────────────────────────────

/**
 * Check if an evidence record from the same source URL + item name
 * + capture date already exists. Uses sourceUrl + itemName + captureDate
 * as the composite uniqueness key.
 */
async function isDuplicate(
  sourceUrl: string,
  itemName: string,
  captureDate: Date
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const existing = await db
    .select({ id: evidenceRecords.id })
    .from(evidenceRecords)
    .where(
      and(
        eq(evidenceRecords.sourceUrl, sourceUrl),
        eq(evidenceRecords.itemName, itemName),
        sql`DATE(${evidenceRecords.captureDate}) = DATE(${captureDate})`
      )
    )
    .limit(1);

  return existing.length > 0;
}

// ─── Category Mapping ────────────────────────────────────────────

/** Map connector evidence categories to evidence_records table enum values */
const CATEGORY_MAP: Record<string, string> = {
  material_cost: "other",
  fitout_rate: "other",
  market_trend: "other",
  competitor_project: "other",
  floors: "floors",
  walls: "walls",
  ceilings: "ceilings",
  joinery: "joinery",
  lighting: "lighting",
  sanitary: "sanitary",
  kitchen: "kitchen",
  hardware: "hardware",
  ffe: "ffe",
  other: "other",
};

function mapCategory(category: string): string {
  return CATEGORY_MAP[category] || "other";
}

// ─── Record ID Generator ─────────────────────────────────────────

let recordCounter = 0;

function generateRecordId(): string {
  recordCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `MYR-PE-${ts}-${rand}`.toUpperCase();
}

// ─── Orchestrator ────────────────────────────────────────────────

export async function runIngestion(
  connectors: SourceConnector[],
  triggeredBy: "manual" | "scheduled" | "api" = "manual",
  actorId?: number
): Promise<IngestionRunReport> {
  const runId = `ING-${randomUUID().substring(0, 8)}`;
  const startedAt = new Date();

  const connectorResults: ConnectorResult[] = [];

  // Build tasks for parallel execution
  const tasks = connectors.map((connector) => async (): Promise<ConnectorResult> => {
    try {
      // Step 1: Fetch
      const raw = await connector.fetch();

      if (raw.error && raw.statusCode === 0) {
        // Total fetch failure (network error, timeout)
        return {
          sourceId: connector.sourceId,
          sourceName: connector.sourceName,
          status: "failed",
          evidenceExtracted: 0,
          evidenceCreated: 0,
          evidenceSkipped: 0,
          error: raw.error,
        };
      }

      if (raw.statusCode >= 400) {
        return {
          sourceId: connector.sourceId,
          sourceName: connector.sourceName,
          status: "failed",
          evidenceExtracted: 0,
          evidenceCreated: 0,
          evidenceSkipped: 0,
          error: raw.error || `HTTP ${raw.statusCode}`,
        };
      }

      // Step 2: Extract
      let extracted: ExtractedEvidence[];
      try {
        extracted = await connector.extract(raw);
      } catch (err) {
        return {
          sourceId: connector.sourceId,
          sourceName: connector.sourceName,
          status: "failed",
          evidenceExtracted: 0,
          evidenceCreated: 0,
          evidenceSkipped: 0,
          error: `Extract failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // Validate extracted evidence
      const validExtracted = extracted.filter((e) => {
        const result = extractedEvidenceSchema.safeParse(e);
        return result.success;
      });

      let created = 0;
      let skipped = 0;

      // Step 3: Normalize and persist each evidence item
      for (const evidence of validExtracted) {
        try {
          // Normalize
          let normalized: NormalizedEvidenceInput;
          try {
            normalized = await connector.normalize(evidence);
          } catch (err) {
            // Safe fallback for malformed normalization
            normalized = {
              metric: evidence.title,
              value: null,
              unit: null,
              confidence: 0.20,
              grade: "C",
              summary: evidence.rawText.substring(0, 500),
              tags: [],
            };
          }

          // Validate normalized output
          const validationResult = normalizedEvidenceInputSchema.safeParse(normalized);
          if (!validationResult.success) {
            // Use safe fallback
            normalized = {
              metric: evidence.title || "Unknown metric",
              value: null,
              unit: null,
              confidence: 0.20,
              grade: "C",
              summary: evidence.rawText.substring(0, 500) || "Extraction failed",
              tags: [],
            };
          }

          // Duplicate detection
          const captureDate = evidence.publishedDate || raw.fetchedAt;
          const duplicate = await isDuplicate(
            evidence.sourceUrl,
            normalized.metric,
            captureDate
          );

          if (duplicate) {
            skipped++;
            continue;
          }

          // Persist to evidence_records
          await createEvidenceRecord({
            recordId: generateRecordId(),
            sourceUrl: evidence.sourceUrl,
            category: mapCategory(evidence.category) as any,
            itemName: normalized.metric,
            priceTypical: normalized.value?.toString() ?? null,
            unit: normalized.unit || "unit",
            currencyOriginal: "AED",
            captureDate: captureDate,
            reliabilityGrade: normalized.grade,
            confidenceScore: Math.round(normalized.confidence * 100),
            extractedSnippet: normalized.summary,
            publisher: connector.sourceName,
            title: evidence.title,
            tags: normalized.tags,
            notes: `Auto-ingested from ${connector.sourceName} via V2 ingestion engine`,
            runId: runId,
          });

          created++;
        } catch (err) {
          // Individual record failure — continue with next
          console.error(`[Ingestion] Record persist failed for ${connector.sourceId}:`, err);
        }
      }

      return {
        sourceId: connector.sourceId,
        sourceName: connector.sourceName,
        status: "success",
        evidenceExtracted: validExtracted.length,
        evidenceCreated: created,
        evidenceSkipped: skipped,
      };
    } catch (err) {
      // Catch-all for any unhandled errors in the connector pipeline
      return {
        sourceId: connector.sourceId,
        sourceName: connector.sourceName,
        status: "failed",
        evidenceExtracted: 0,
        evidenceCreated: 0,
        evidenceSkipped: 0,
        error: `Unhandled: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  // Execute with concurrency limit
  const results = await runWithConcurrencyLimit(tasks, MAX_CONCURRENT);
  connectorResults.push(...results);

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Aggregate results
  const succeeded = connectorResults.filter((r) => r.status === "success").length;
  const failed = connectorResults.filter((r) => r.status === "failed").length;
  const totalCreated = connectorResults.reduce((sum, r) => sum + r.evidenceCreated, 0);
  const totalSkipped = connectorResults.reduce((sum, r) => sum + r.evidenceSkipped, 0);
  const errors = connectorResults
    .filter((r) => r.status === "failed" && r.error)
    .map((r) => ({
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      error: r.error!,
    }));

  // Persist ingestion run record
  try {
    const db = await getDb();
    if (db) {
      await db.insert(ingestionRuns).values({
        runId,
        trigger: triggeredBy,
        triggeredBy: actorId ?? null,
        status: failed === connectors.length ? "failed" : "completed",
        totalSources: connectors.length,
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        recordsExtracted: connectorResults.reduce((sum, r) => sum + r.evidenceExtracted, 0),
        recordsInserted: totalCreated,
        duplicatesSkipped: totalSkipped,
        sourceBreakdown: connectorResults.map((r) => ({
          sourceId: r.sourceId,
          name: r.sourceName,
          status: r.status,
          extracted: r.evidenceExtracted,
          inserted: r.evidenceCreated,
          duplicates: r.evidenceSkipped,
          error: r.error || null,
        })),
        errorSummary: errors.length > 0 ? errors : null,
        startedAt,
        completedAt,
        durationMs,
      });
    }
  } catch (err) {
    console.error("[Ingestion] Failed to persist ingestion run:", err);
  }

  // Log to intelligence audit log
  try {
    await createIntelligenceAuditEntry({
      runType: "price_extraction",
      runId: runId,
      actor: actorId ?? null,
      inputSummary: {
        triggeredBy,
        connectorCount: connectors.length,
        connectorIds: connectors.map((c) => c.sourceId),
      },
      outputSummary: {
        sourcesAttempted: connectors.length,
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        evidenceCreated: totalCreated,
        evidenceSkipped: totalSkipped,
      },
      sourcesProcessed: connectors.length,
      recordsExtracted: totalCreated,
      errors: failed,
      errorDetails: errors.length > 0 ? errors : null,
      startedAt: startedAt,
      completedAt: completedAt,
    });
  } catch (err) {
    console.error("[Ingestion] Failed to log audit entry:", err);
  }

  // V2-08: Auto-generate benchmark proposals after ingestion
  let proposalResult: { proposalsCreated: number } | null = null;
  if (totalCreated > 0) {
    try {
      proposalResult = await generateBenchmarkProposals({
        actorId,
        ingestionRunId: runId,
      });
      console.log(
        `[Ingestion] Post-run proposal generation: ${proposalResult.proposalsCreated} proposals created`
      );
    } catch (err) {
      console.error("[Ingestion] Post-run proposal generation failed:", err);
    }
  }

  const report: IngestionRunReport = {
    runId,
    startedAt,
    completedAt,
    durationMs,
    triggeredBy,
    sourcesAttempted: connectors.length,
    sourcesSucceeded: succeeded,
    sourcesFailed: failed,
    evidenceCreated: totalCreated,
    evidenceSkipped: totalSkipped,
    errors,
    perSource: connectorResults,
  };

  return report;
}

/**
 * Run a single connector by sourceId.
 */
export async function runSingleConnector(
  connector: SourceConnector,
  triggeredBy: "manual" | "scheduled" | "api" = "manual",
  actorId?: number
): Promise<IngestionRunReport> {
  return runIngestion([connector], triggeredBy, actorId);
}
