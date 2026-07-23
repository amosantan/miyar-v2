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
  createIntelligenceAuditEntry,
  insertConnectorHealth,
  insertPublicTrendSnapshot,
  getDb,
  getEvidenceRecordById,
  recordRejectedConfidenceAssessment,
  upsertPublicEvidenceObservation,
} from "../../db";
import { generateBenchmarkProposals } from "./proposal-generator";
import { classifyFinishLevelForObservation } from "../tier-policy";
import { triggerAlertEngine } from "../autonomous/alert-engine";
import { validateEvidence, type QualityResult } from "./data-quality";
import { detectPriceChange } from "./change-detector";
import { detectTrends, type DataPoint } from "../analytics/trend-detection";
import { evidenceRecords, ingestionRuns, sourceRegistry } from "../../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { assertDatabaseAccess } from "../../_core/database-safety";
import {
  evaluateConnectorConfidence,
  ConfidencePolicyError,
  resolveGradePolicy,
  type ConfidenceEvaluation,
  type GradePolicyMetadata,
  type QualityConfidenceStage,
} from "./connector";

const CONFIDENCE_MERGE_POLICY_VERSION = "evidence-confidence-merge-latest-v1";

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
  evidenceUpdated: number;
  evidenceSkipped: number;
  evidenceRejected: number;
  outliersFlagged: number;
  errors: Array<{ sourceId: string; sourceName: string; error: string }>;
  perSource: Array<{
    sourceId: string;
    sourceName: string;
    status: "success" | "failed";
    evidenceExtracted: number;
    evidenceCreated: number;
    evidenceUpdated: number;
    evidenceSkipped: number;
    evidenceRejected: number;
    outliersFlagged: number;
    error?: string;
  }>;
}

interface ConnectorResult {
  sourceId: string;
  sourceName: string;
  status: "success" | "failed";
  evidenceExtracted: number;
  evidenceCreated: number;
  evidenceUpdated: number;
  evidenceSkipped: number;
  evidenceRejected: number;
  outliersFlagged: number;
  rejectionReasons: Record<string, number>;
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

// ─── Category Mapping ────────────────────────────────────────────

/** Map connector evidence categories to evidence_records table enum values */
const CATEGORY_MAP: Record<string, string> = {
  // ADR-0009 (audit F11): connector-level buckets carry no per-item meaning,
  // so they map to "other" instead of silently pooling every static
  // connector's material evidence into the flooring benchmark. Per-item
  // categories from extraction take precedence via validCategories below.
  material_cost: "other",
  property_price: "other",
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

/**
 * ADR-0009 (audit F11): extraction returns a per-item category in the
 * evidence vocabulary, but models routinely answer with a near-miss term
 * ("tiles", "marble", "bathroom"). These synonyms map such answers onto the
 * evidence enum deterministically. Anything still unrecognized stays "other"
 * — an honest unknown, never a guess pooled into a priced category.
 */
const CATEGORY_SYNONYMS: Record<string, string> = {
  floor: "floors", flooring: "floors", tile: "floors", tiles: "floors",
  ceramic: "floors", ceramics: "floors", porcelain: "floors", marble: "floors",
  granite: "floors", stone: "floors", slab: "floors", slabs: "floors",
  parquet: "floors", vinyl: "floors", laminate: "floors", carpet: "floors",
  wall: "walls", paint: "walls", paints: "walls", wallpaper: "walls",
  cladding: "walls", plaster: "walls", partition: "walls", partitions: "walls",
  ceiling: "ceilings", gypsum: "ceilings", falseceiling: "ceilings",
  carpentry: "joinery", cabinetry: "joinery", millwork: "joinery",
  door: "joinery", doors: "joinery", wardrobe: "joinery", wardrobes: "joinery",
  light: "lighting", lights: "lighting", luminaire: "lighting", lamps: "lighting",
  sanitaryware: "sanitary", bathroom: "sanitary", bath: "sanitary",
  plumbing: "sanitary", tap: "sanitary", taps: "sanitary", faucet: "sanitary",
  faucets: "sanitary", basin: "sanitary", shower: "sanitary", wc: "sanitary",
  kitchens: "kitchen", appliance: "kitchen", appliances: "kitchen",
  countertop: "kitchen", countertops: "kitchen", worktop: "kitchen",
  ironmongery: "hardware", handle: "hardware", handles: "hardware",
  hinge: "hardware", hinges: "hardware", lock: "hardware", locks: "hardware",
  furniture: "ffe", furnishing: "ffe", furnishings: "ffe", fixture: "ffe",
  fixtures: "ffe", decor: "ffe", rug: "ffe", rugs: "ffe", curtain: "ffe",
  curtains: "ffe", fabric: "ffe",
};

function mapCategory(category: string): string {
  if (CATEGORY_MAP[category]) return CATEGORY_MAP[category];
  const normalized = category.toLowerCase().replace(/[\s_-]+/g, "");
  return CATEGORY_MAP[normalized] || CATEGORY_SYNONYMS[normalized] || "other";
}

// ─── Record ID Generator ─────────────────────────────────────────

let recordCounter = 0;

function generateRecordId(): string {
  recordCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `MYR-PE-${ts}-${rand}`.toUpperCase();
}

function persistedDatePrecision(
  precision: "date" | "datetime" | "unknown",
  status?: "missing" | "valid" | "invalid" | "future"
) {
  if (status === "missing") return "missing" as const;
  return precision === "datetime" ? "timestamp" as const : precision;
}

function confidenceAssessmentStages(input: {
  runId: string;
  sourceId: string;
  actorId?: number;
  evaluation: Extract<ConfidenceEvaluation, { accepted: true }>;
  gradePolicy: GradePolicyMetadata;
  quality: QualityConfidenceStage;
}) {
  const { evaluation, gradePolicy, quality } = input;
  return {
    runId: input.runId,
    sourceId: input.sourceId,
    actorId: input.actorId ?? null,
    corpusScope: "platform_public" as const,
    origin: "connector" as const,
    outcome: "accepted" as const,
    evaluationClock: evaluation.evaluatedAt,
    rawPublicationText: evaluation.publicationDate.raw,
    datePrecision: persistedDatePrecision(
      evaluation.publicationDate.precision,
      evaluation.publicationDate.status
    ),
    parsingStatus: evaluation.publicationDate.status,
    parsedPublicationDate: evaluation.publicationDate.parsedAt,
    staticGradePolicyId: gradePolicy.source === "static_source_registry" ? gradePolicy.policyVersion : null,
    registryGradePolicyId: gradePolicy.source === "source_registry" ? gradePolicy.policyVersion : null,
    confidencePolicyId: evaluation.initial.policyVersion,
    qualityPolicyId: quality.policyVersion,
    mergePolicyId: CONFIDENCE_MERGE_POLICY_VERSION,
    grade: gradePolicy.grade,
    baseConfidence: evaluation.initial.baseScore,
    recencyAdjustment: evaluation.initial.dateAdjustment,
    confidenceAfterRecency: evaluation.initial.score,
    qualityMultiplier: quality.multiplier,
    qualityFloor: quality.floor,
    qualityFlags: quality.flags,
    candidateScore: Math.round(quality.score * 100),
    finalScore: Math.round(quality.score * 100),
    mergeDecision: "inserted" as const,
  };
}

async function persistConnectorRejection(input: {
  runId: string;
  sourceId: string;
  actorId?: number;
  evaluationClock: Date;
  rawPublicationText: string | null;
  datePrecision?: "missing" | "date" | "timestamp" | "unknown";
  parsingStatus?: "valid" | "missing" | "invalid" | "future";
  parsedPublicationDate?: Date | null;
  rejectionCode: string;
  gradePolicy?: GradePolicyMetadata;
}) {
  await recordRejectedConfidenceAssessment({
    runId: input.runId,
    sourceId: input.sourceId,
    actorId: input.actorId ?? null,
    corpusScope: "platform_public",
    origin: "connector",
    outcome: "rejected",
    evaluationClock: input.evaluationClock,
    rawPublicationText: input.rawPublicationText,
    datePrecision: input.datePrecision ?? "unknown",
    parsingStatus: input.parsingStatus ?? "invalid",
    parsedPublicationDate: input.parsedPublicationDate ?? null,
    staticGradePolicyId: input.gradePolicy?.source === "static_source_registry"
      ? input.gradePolicy.policyVersion
      : null,
    registryGradePolicyId: input.gradePolicy?.source === "source_registry"
      ? input.gradePolicy.policyVersion
      : null,
    confidencePolicyId: "ingestion-confidence-v1",
    qualityPolicyId: "evidence-quality-confidence-v1",
    mergePolicyId: CONFIDENCE_MERGE_POLICY_VERSION,
    grade: input.gradePolicy?.grade ?? null,
    mergeDecision: "rejected",
    rejectionCode: input.rejectionCode,
  });
}

// ─── Orchestrator ────────────────────────────────────────────────

export async function runIngestion(
  connectors: SourceConnector[],
  triggeredBy: "manual" | "scheduled" | "api" = "manual",
  actorId?: number
): Promise<IngestionRunReport> {
  assertDatabaseAccess("ingest");
  const runId = `ING-${randomUUID().substring(0, 8)}`;
  const startedAt = new Date();

  const connectorResults: ConnectorResult[] = [];

  // ADR-0009/EV-00 (audit F4): resolve each connector's source_registry row
  // by numeric id (dynamic connectors) or slug (static connectors). The
  // former name-vs-sourceId join matched zero rows on both scheduled paths,
  // so lastSuccessfulFetch was never read or written.
  const registryIdBySourceId = new Map<string, number>();
  try {
    const db = await getDb();
    if (db) {
      for (const connector of connectors) {
        const rows = await db.select({
          id: sourceRegistry.id,
          lastSuccessfulFetch: sourceRegistry.lastSuccessfulFetch,
        })
          .from(sourceRegistry)
          .where(
            connector.sourceRegistryId !== undefined
              ? eq(sourceRegistry.id, connector.sourceRegistryId)
              : eq(sourceRegistry.slug, connector.sourceId)
          )
          .limit(1);
        if (rows.length > 0) {
          connector.sourceRegistryId = rows[0].id;
          registryIdBySourceId.set(String(connector.sourceId), rows[0].id);
          if (rows[0].lastSuccessfulFetch) {
            connector.lastSuccessfulFetch = rows[0].lastSuccessfulFetch;
          }
        } else {
          console.warn(`[Ingestion] No source_registry row resolves for connector ${connector.sourceId}; health metrics will be skipped`);
        }
      }
    }
  } catch (err) {
    console.warn("[Ingestion] Failed to load lastSuccessfulFetch:", err);
  }

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
          evidenceUpdated: 0,
          evidenceSkipped: 0,
          evidenceRejected: 0,
          outliersFlagged: 0,
          rejectionReasons: {},
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
          evidenceUpdated: 0,
          evidenceSkipped: 0,
          evidenceRejected: 0,
          outliersFlagged: 0,
          rejectionReasons: {},
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
          evidenceUpdated: 0,
          evidenceSkipped: 0,
          evidenceRejected: 0,
          outliersFlagged: 0,
          rejectionReasons: {},
          error: `Extract failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // Validate extracted evidence. Invalid items are visible rejections; they
      // are never converted into fabricated Grade C / 0.20 evidence.
      const validExtracted = extracted.filter((e) => extractedEvidenceSchema.safeParse(e).success);

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let outliers = 0;
      let rejected = extracted.length - validExtracted.length;
      const rejectionReasons: Record<string, number> = {};
      if (rejected > 0) rejectionReasons.invalid_extracted_evidence = rejected;

      for (let i = 0; i < rejected; i++) {
        await persistConnectorRejection({
          runId,
          sourceId: String(connector.sourceId),
          actorId,
          evaluationClock: raw.fetchedAt,
          rawPublicationText: null,
          rejectionCode: "invalid_extracted_evidence",
        });
      }

      // Step 3: Normalize, validate, and upsert each evidence item
      for (const evidence of validExtracted) {
        try {
          let normalized: NormalizedEvidenceInput;
          try {
            normalized = await connector.normalize(evidence, { evaluatedAt: raw.fetchedAt });
          } catch (err) {
            const confidenceRejection = err instanceof ConfidencePolicyError
              ? err.rejection
              : null;
            const reason = confidenceRejection?.rejectionCode ?? "normalization_failed";
            rejected++;
            rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
            await persistConnectorRejection({
              runId,
              sourceId: String(connector.sourceId),
              actorId,
              evaluationClock: raw.fetchedAt,
              rawPublicationText: confidenceRejection?.publicationDate.raw
                ?? evidence.publishedDateRaw
                ?? evidence.publicationDate?.raw
                ?? null,
              datePrecision: confidenceRejection
                ? persistedDatePrecision(
                    confidenceRejection.publicationDate.precision,
                    confidenceRejection.publicationDate.status
                  )
                : undefined,
              parsingStatus: confidenceRejection?.publicationDate.status,
              parsedPublicationDate: confidenceRejection?.publicationDate.parsedAt,
              rejectionCode: reason,
              gradePolicy: confidenceRejection
                ? connector.gradePolicy ?? resolveGradePolicy(String(connector.sourceId))
                : undefined,
            });
            continue;
          }

          const validationResult = normalizedEvidenceInputSchema.safeParse(normalized);
          if (!validationResult.success) {
            const reason = "invalid_normalization";
            rejected++;
            rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
            await persistConnectorRejection({
              runId,
              sourceId: String(connector.sourceId),
              actorId,
              evaluationClock: raw.fetchedAt,
              rawPublicationText: evidence.publishedDateRaw ?? evidence.publicationDate?.raw ?? null,
              rejectionCode: reason,
            });
            continue;
          }

          const gradePolicy = normalized.gradePolicy ?? resolveGradePolicy(String(connector.sourceId));
          const publicationInput = evidence.publicationDate?.raw
            ?? evidence.publishedDateRaw
            ?? evidence.publishedDate
            ?? null;
          const confidenceEvaluation = evaluateConnectorConfidence({
            grade: gradePolicy.grade,
            publicationDate: publicationInput,
            evaluatedAt: raw.fetchedAt,
          });
          if (!confidenceEvaluation.accepted) {
            const reason = confidenceEvaluation.rejectionCode;
            rejected++;
            rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
            await persistConnectorRejection({
              runId,
              sourceId: String(connector.sourceId),
              actorId,
              evaluationClock: raw.fetchedAt,
              rawPublicationText: confidenceEvaluation.publicationDate.raw,
              datePrecision: persistedDatePrecision(
                confidenceEvaluation.publicationDate.precision,
                confidenceEvaluation.publicationDate.status
              ),
              parsingStatus: confidenceEvaluation.publicationDate.status,
              parsedPublicationDate: confidenceEvaluation.publicationDate.parsedAt,
              rejectionCode: reason,
              gradePolicy,
            });
            continue;
          }

          // Data Quality Validation
          const qualityResult = validateEvidence({
            category: evidence.category,
            itemName: normalized.metric,
            value: normalized.value ?? null,
            valueMax: normalized.valueMax ?? null,
            unit: normalized.unit,
            confidence: confidenceEvaluation.initial.score,
          });

          const qualityStage = qualityResult.confidencePolicy;

          if (qualityResult.status === "outlier_flagged") {
            outliers++;
            console.warn(`[Ingestion] 🚩 Outlier flagged: ${normalized.metric} = ${normalized.value} (${qualityResult.flags.join(", ")})`);
          }

          const captureDate = confidenceEvaluation.publicationDate.parsedAt || raw.fetchedAt;

          // Map category: use LLM-provided category if valid, otherwise fallback
          const validCategories = ["floors", "walls", "ceilings", "joinery", "lighting", "sanitary", "kitchen", "hardware", "ffe", "other"];
          const evidenceCategory = validCategories.includes(evidence.category)
            ? evidence.category
            : mapCategory(evidence.category);

          // ADR-0009/EV-00 (audit F5): use the resolved registry row id; the
          // former parseInt(slug) produced NaN → undefined for every static
          // connector, so their evidence lost source linkage.
          const sourceRegistryId = connector.sourceRegistryId;

          // ADR-0009 (audit F6/F7): finishLevel — the price tier that keys
          // benchmarks — is assigned only by the deterministic tier policy
          // from the observation's price and unit. The model's suggestion is
          // demoted to metadata and never becomes numerical authority.
          const deterministicFinishLevel = classifyFinishLevelForObservation(
            normalized.value ?? null,
            normalized.valueMax ?? null,
            normalized.unit || "unit",
          );

          const candidateScore = Math.round(qualityStage.score * 100);
          const persisted = await upsertPublicEvidenceObservation({
            recordId: generateRecordId(),
            projectId: null,
            orgId: null,
            sourceRegistryId,
            sourceUrl: evidence.sourceUrl,
            category: evidenceCategory as any,
            itemName: normalized.metric,
            priceMin: normalized.value?.toString() ?? null,
            priceMax: normalized.valueMax?.toString() ?? normalized.value?.toString() ?? null,
            priceTypical: normalized.value?.toString() ?? null,
            unit: normalized.unit || "unit",
            currencyOriginal: "AED",
            captureDate,
            reliabilityGrade: gradePolicy.grade,
            confidenceScore: candidateScore,
            extractedSnippet: normalized.summary,
            publisher: connector.sourceName,
            title: evidence.title,
            tags: normalized.tags,
            notes: `Auto-ingested from ${connector.sourceName} via V2 ingestion engine${qualityResult.status === "outlier_flagged" ? " [OUTLIER_FLAGGED: " + qualityResult.flags.join("; ") + "]" : ""}`,
            runId,
            finishLevel: deterministicFinishLevel,
            modelSuggestedFinishLevel: normalized.finishLevel ?? null,
            designStyle: normalized.designStyle ?? null,
            brandsMentioned: normalized.brandsMentioned ?? null,
            materialSpec: normalized.materialSpec ?? null,
            intelligenceType: (normalized.intelligenceType as any) ?? "material_price",
            corpusScope: "platform_public",
            corpusPolicyVersion: "public-v1",
          }, confidenceAssessmentStages({
            runId,
            sourceId: String(connector.sourceId),
            actorId,
            evaluation: confidenceEvaluation,
            gradePolicy,
            quality: qualityStage,
          }));

          const currentRecord = await getEvidenceRecordById(persisted.id);
          if (currentRecord) await detectPriceChange(currentRecord);
          if (persisted.created) created++;
          else updated++;
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
        evidenceUpdated: updated,
        evidenceSkipped: skipped,
        evidenceRejected: rejected,
        outliersFlagged: outliers,
        rejectionReasons,
      };
    } catch (err) {
      // Catch-all for any unhandled errors in the connector pipeline
      return {
        sourceId: connector.sourceId,
        sourceName: connector.sourceName,
        status: "failed",
        evidenceExtracted: 0,
        evidenceCreated: 0,
        evidenceUpdated: 0,
        evidenceSkipped: 0,
        evidenceRejected: 0,
        outliersFlagged: 0,
        rejectionReasons: {},
        error: `Unhandled: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  // Execute with concurrency limit
  const results = await runWithConcurrencyLimit(tasks, MAX_CONCURRENT);
  connectorResults.push(...results);

  // V3-02: Record connector health for each connector
  for (const result of connectorResults) {
    try {
      const healthStatus = result.status === "success"
        ? (result.evidenceCreated > 0 ? "success" : "partial")
        : "failed";

      let errorType: string | null = null;
      if (result.error) {
        if (result.error.includes("ENOTFOUND") || result.error.includes("DNS") || result.error.includes("resolve")) {
          errorType = "dns_failure";
        } else if (result.error.includes("timeout") || result.error.includes("ETIMEDOUT")) {
          errorType = "timeout";
        } else if (result.error.includes("HTTP")) {
          errorType = "http_error";
        } else if (result.error.includes("Extract") || result.error.includes("parse")) {
          errorType = "parse_error";
        } else if (result.error.includes("LLM") || result.error.includes("invokeLLM")) {
          errorType = "llm_error";
        } else {
          errorType = "unknown";
        }
      }

      await insertConnectorHealth({
        runId,
        sourceId: result.sourceId,
        sourceName: result.sourceName,
        status: healthStatus as any,
        httpStatusCode: null,
        responseTimeMs: null,
        recordsExtracted: result.evidenceExtracted,
        recordsInserted: result.evidenceCreated,
        duplicatesSkipped: result.evidenceSkipped,
        errorMessage: result.error || null,
        errorType,
      });
    } catch (err) {
      console.error(`[Ingestion] Failed to record health for ${result.sourceId}:`, err);
    }
  }

  // ADR-0009/EV-00 (audit F4): update health metrics by the resolved registry
  // row id so lastSuccessfulFetch and consecutiveFailures finally accumulate
  // for both connector families. Unresolved connectors are skipped (already
  // logged at load time) instead of silently matching zero rows.
  try {
    const db = await getDb();
    if (db) {
      for (const result of connectorResults) {
        const resolvedId = registryIdBySourceId.get(String(result.sourceId));
        if (resolvedId === undefined) continue;

        // Get current consecutive failures to increment
        const current = await db.select({ consecutiveFailures: sourceRegistry.consecutiveFailures })
          .from(sourceRegistry).where(eq(sourceRegistry.id, resolvedId)).limit(1);

        const currentFailures = current.length > 0 ? current[0].consecutiveFailures : 0;
        const isSuccess = result.status === "success";
        const statusEnum = isSuccess ? (result.evidenceExtracted > 0 ? "success" : "partial") : "failed";

        const updates: any = {
          lastScrapedAt: new Date(),
          lastScrapedStatus: statusEnum,
          lastRecordCount: result.evidenceCreated,
          consecutiveFailures: isSuccess ? 0 : currentFailures + 1,
        };
        if (isSuccess) {
          updates.lastSuccessfulFetch = new Date();
        }

        await db.update(sourceRegistry)
          .set(updates)
          .where(eq(sourceRegistry.id, resolvedId));
      }
    }
  } catch (err) {
    console.warn("[Ingestion] Failed to update sourceRegistry metrics:", err);
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Aggregate results
  const succeeded = connectorResults.filter((r) => r.status === "success").length;
  const failed = connectorResults.filter((r) => r.status === "failed").length;
  const totalCreated = connectorResults.reduce((sum, r) => sum + r.evidenceCreated, 0);
  const totalUpdated = connectorResults.reduce((sum, r) => sum + r.evidenceUpdated, 0);
  const totalSkipped = connectorResults.reduce((sum, r) => sum + r.evidenceSkipped, 0);
  const totalRejected = connectorResults.reduce((sum, r) => sum + r.evidenceRejected, 0);
  const totalOutliers = connectorResults.reduce((sum, r) => sum + r.outliersFlagged, 0);
  const sourceErrors = connectorResults
    .filter((r) => r.status === "failed" && r.error)
    .map((r) => ({
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      error: r.error!,
    }));
  const rejectionErrors = connectorResults.flatMap((result) =>
    Object.entries(result.rejectionReasons).map(([reason, count]) => ({
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      error: `record_rejected:${reason} (${count})`,
    }))
  );
  const errors = [...sourceErrors, ...rejectionErrors];

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
        recordsRejected: totalRejected,
        duplicatesSkipped: totalSkipped,
        sourceBreakdown: connectorResults.map((r) => ({
          sourceId: r.sourceId,
          name: r.sourceName,
          status: r.status,
          extracted: r.evidenceExtracted,
          inserted: r.evidenceCreated,
          updated: r.evidenceUpdated,
          duplicates: r.evidenceSkipped,
          rejected: r.evidenceRejected,
          rejectionReasons: r.rejectionReasons,
          outliers: r.outliersFlagged,
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
        evidenceUpdated: totalUpdated,
        evidenceSkipped: totalSkipped,
        evidenceRejected: totalRejected,
        outliersFlagged: totalOutliers,
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
  if (totalCreated > 0 || totalUpdated > 0) {
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

  // V3-05: Auto-generate trend snapshots after ingestion
  if (totalCreated > 0 || totalUpdated > 0) {
    try {
      const db = await getDb();
      if (db) {
        // Get distinct category/geography combos from recent evidence
        const recentEvidence = await db.select().from(evidenceRecords)
          .orderBy(sql`${evidenceRecords.createdAt} DESC`)
          .limit(500);

        // Group by category:finishLevel
        const categoryGroups = new Map<string, { category: string; points: DataPoint[] }>();
        for (const record of recentEvidence) {
          const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
          if (value === null || isNaN(value)) continue;
          const date = record.captureDate || record.createdAt;
          if (!date) continue;
          const category = record.category || "other";
          const finishLevel = record.finishLevel?.toLowerCase() || "standard";
          const metric = `${category}:${finishLevel}`;
          const grade = (record.reliabilityGrade as "A" | "B" | "C") || "C";

          if (!categoryGroups.has(metric)) categoryGroups.set(metric, { category, points: [] });
          categoryGroups.get(metric)!.points.push({
            date: new Date(date),
            value,
            grade,
            sourceId: record.sourceRegistryId ? String(record.sourceRegistryId) : "unknown",
            recordId: record.id,
          });
        }

        let trendsGenerated = 0;
        for (const [metric, group] of Array.from(categoryGroups.entries())) {
          if (group.points.length < 2) continue;
          const trend = await detectTrends(metric, group.category, "UAE", group.points, {
            generateNarrative: group.points.length >= 5,
          });
          await insertPublicTrendSnapshot({
            metric: trend.metric,
            category: trend.category,
            geography: trend.geography,
            dataPointCount: trend.dataPointCount,
            gradeACount: trend.gradeACount,
            gradeBCount: trend.gradeBCount,
            gradeCCount: trend.gradeCCount,
            uniqueSources: trend.uniqueSources,
            dateRangeStart: trend.dateRange?.start || null,
            dateRangeEnd: trend.dateRange?.end || null,
            currentMA: trend.currentMA !== null ? String(trend.currentMA) : null,
            previousMA: trend.previousMA !== null ? String(trend.previousMA) : null,
            percentChange: trend.percentChange !== null ? String(trend.percentChange) : null,
            direction: trend.direction,
            anomalyCount: trend.anomalies.length,
            anomalyDetails: trend.anomalies.length > 0 ? trend.anomalies : null,
            confidence: trend.confidence,
            narrative: trend.narrative,
            movingAverages: trend.movingAverages.length > 0 ? trend.movingAverages : null,
            ingestionRunId: runId,
          });
          trendsGenerated++;
        }
        console.log(`[Ingestion] Post-run trend detection: ${trendsGenerated} trend snapshots created`);
      }
    } catch (err) {
      console.error("[Ingestion] Post-run trend detection failed:", err);
    }
  }

  // V6: Autonomous Alert Generation
  try {
    const alerts = await triggerAlertEngine();
    console.log(`[Ingestion] Post-run alert generation: ${alerts.length} new alerts created`);
  } catch (err) {
    console.error("[Ingestion] Post-run alert generation failed:", err);
  }

  // V7: Auto-sync Evidence → Materials Library
  if (totalCreated > 0 || totalUpdated > 0) {
    try {
      const { syncEvidenceToMaterials } = await import("./evidence-to-materials");
      const materialSync = await syncEvidenceToMaterials(runId);
      console.log(
        `[Ingestion] Post-run materials sync: ${materialSync.created} created, ${materialSync.updated} updated, ${materialSync.skipped} skipped`
      );
    } catch (err) {
      console.error("[Ingestion] Post-run materials sync failed:", err);
    }
  }

  console.log(`[Ingestion] Run ${runId} complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalRejected} rejected, ${totalOutliers} outliers flagged`);

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
    evidenceUpdated: totalUpdated,
    evidenceSkipped: totalSkipped,
    evidenceRejected: totalRejected,
    outliersFlagged: totalOutliers,
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

/**
 * Run a connector for testing purposes only. Does not save to the database.
 * Returns the raw payload size and up to 5 extracted valid records.
 */
export async function testScrape(connector: SourceConnector) {
  const startedAt = new Date();

  const raw = await connector.fetch();
  if (raw.error) {
    return { success: false, error: raw.error, statusCode: raw.statusCode };
  }

  const extracted = await connector.extract(raw);
  const normalizedRecords = [];

  for (const evidence of extracted) {
    if (!extractedEvidenceSchema.safeParse(evidence).success) continue;
    try {
      const normalized = await connector.normalize(evidence);
      if (normalizedEvidenceInputSchema.safeParse(normalized).success) {
        normalizedRecords.push(normalized);
      }
    } catch { }
  }

  return {
    success: true,
    statusCode: raw.statusCode,
    rawPayloadSize: (raw.rawHtml?.length || 0) + JSON.stringify(raw.rawJson || {}).length,
    extractedCount: extracted.length,
    validNormalizedCount: normalizedRecords.length,
    previewRecords: normalizedRecords.slice(0, 5),
    durationMs: new Date().getTime() - startedAt.getTime()
  };
}
