/**
 * MIYAR V2-08 — Post-Ingestion Benchmark Proposal Generator
 *
 * After an ingestion run completes, this module:
 *   1. Reads all evidence records (no source filtering)
 *   2. Groups by category:unit (benchmark key)
 *   3. Computes P25/P50/P75 statistics
 *   4. Applies grade-weighted mean (A=3x, B=2x, C=1x)
 *   5. Computes source diversity and confidence
 *   6. Creates benchmark proposals for groups with sufficient data
 *
 * This is the same logic as proposals.generate but extracted
 * so it can be called programmatically after ingestion runs.
 */

import { randomUUID } from "crypto";
import * as db from "../../db";
import { getFreshnessWeight, FRESHNESS_WEIGHT_FRESH, FRESHNESS_WEIGHT_AGING, FRESHNESS_WEIGHT_STALE } from "./freshness";
import { isPlausibleMaterialPrice } from "./price-sanity";

export interface ProposalGenerationResult {
  proposalsCreated: number;
  groupsAnalyzed: number;
  totalEvidence: number;
  proposals: Array<{ id: number; benchmarkKey: string; recommendation: string }>;
}

/**
 * Generate benchmark proposals from all evidence records.
 * Called after ingestion runs to update P25/P50/P75 values.
 */
/**
 * ADR-0009: proposals generated after deterministic finish/category keying
 * are stamped `benchmark-key-v2`; pre-existing rows keep the schema default
 * `legacy-v0` and remain served until an admin re-approves v2 proposals.
 */
export const BENCHMARK_KEY_POLICY_VERSION = "benchmark-key-v2" as const;

export async function generateBenchmarkProposals(
  options: {
    category?: string;
    minEvidenceCount?: number;
    actorId?: number;
    ingestionRunId?: string;
  } = {}
): Promise<ProposalGenerationResult> {
  // ADR-0009: the default minimum group size matches the recommendation
  // threshold below (< 5 → reject), so groups that could only ever produce
  // an auto-rejected proposal are no longer persisted.
  const { category, minEvidenceCount = 5, actorId, ingestionRunId } = options;

  const runId = `PROP-${randomUUID().substring(0, 8)}`;
  const startedAt = new Date();

  // EV-01b: the population a global material benchmark may be computed from.
  //   - `material_price` only. Property listings, developer brochures and
  //     consultancy research are evidence, but they are not material prices.
  //   - `platform_public` only, so organization evidence never keys a shared
  //     benchmark.
  //   - never confidential or restricted.
  // Previously this call passed only `category`, so all three leaked in.
  const evidence = await db.listEvidenceRecords({
    category,
    intelligenceType: "material_price",
    corpusScope: "platform_public",
    excludeConfidential: true,
    limit: 10000,
  });

  if (evidence.length === 0) {
    return { proposalsCreated: 0, groupsAnalyzed: 0, totalEvidence: 0, proposals: [] };
  }

  // A figure outside the plausible band for a material unit price is a parsing
  // artefact or a property value; it must not move a percentile.
  const sane = evidence.filter((rec: any) => isPlausibleMaterialPrice(rec));

  // Group evidence by category + finishLevel + unit (benchmark key)
  const groups = new Map<string, typeof evidence>();
  for (const rec of sane) {
    const finish = rec.finishLevel?.toLowerCase() || 'standard';
    const key = `${rec.category}:${finish}:${rec.unit}`;
    const existing = groups.get(key) ?? [];
    existing.push(rec);
    groups.set(key, existing);
  }

  const proposals: Array<{ id: number; benchmarkKey: string; recommendation: string }> = [];
  let proposalsCreated = 0;

  for (const [benchmarkKey, records] of Array.from(groups.entries())) {
    if (records.length < minEvidenceCount) continue;

    // Compute statistics
    const prices = records
      .map((r: any) => Number(r.priceTypical ?? r.currencyAed ?? 0))
      .filter((p: number) => p > 0)
      .sort((a: number, b: number) => a - b);

    if (prices.length === 0) continue;

    const p25 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
    const p50 = prices[Math.floor(prices.length * 0.5)] ?? prices[0];
    const p75 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];

    // Weighted mean: A-grade records get 3x weight, B=2x, C=1x
    // V2-09: Apply freshness multiplier (fresh=1.0, aging=0.75, stale=0.50)
    const weightMap: Record<string, number> = { A: 3, B: 2, C: 1 };
    let weightedSum = 0;
    let totalWeight = 0;
    for (const rec of records) {
      const price = Number(rec.priceTypical ?? rec.currencyAed ?? 0);
      if (price <= 0) continue;
      const gradeWeight = weightMap[rec.reliabilityGrade] ?? 1;
      const freshnessWeight = getFreshnessWeight(rec.captureDate);
      const combinedWeight = gradeWeight * freshnessWeight;
      weightedSum += price * combinedWeight;
      totalWeight += combinedWeight;
    }
    const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : p50;

    // Reliability distribution
    const reliabilityDist = { A: 0, B: 0, C: 0 };
    for (const rec of records) {
      reliabilityDist[rec.reliabilityGrade as "A" | "B" | "C"]++;
    }

    // Recency distribution
    const now = Date.now();
    const recencyDist = { recent: 0, mid: 0, old: 0 };
    for (const rec of records) {
      const age = now - new Date(rec.captureDate).getTime();
      const months = age / (30 * 24 * 60 * 60 * 1000);
      if (months <= 3) recencyDist.recent++;
      else if (months <= 12) recencyDist.mid++;
      else recencyDist.old++;
    }

    // Source diversity
    const uniqueSources = new Set(records.map((r: any) => r.sourceRegistryId ?? r.sourceUrl));
    const sourceDiversity = uniqueSources.size;

    // EV-01b: composition of the group, so a reviewer sees what the number is
    // actually made of rather than just its confidence score.
    const priceClassDist: Record<string, number> = {};
    const priceBasisDist: Record<string, number> = {};
    for (const rec of records) {
      const cls = (rec as any).priceClass ?? "unknown";
      const basis = (rec as any).priceBasis ?? "unknown";
      priceClassDist[cls] = (priceClassDist[cls] ?? 0) + 1;
      priceBasisDist[basis] = (priceBasisDist[basis] ?? 0) + 1;
    }

    const classesPresent = Object.keys(priceClassDist).filter(k => priceClassDist[k] > 0);
    const retailOnly =
      classesPresent.length > 0 &&
      classesPresent.every(cls => cls === "retail_listed");

    // Only records a versioned basis parser actually looked at can be said to
    // have an unresolved basis. Legacy records were never evaluated — their
    // basis signal is the `unit` field, which already keys the benchmark — so
    // this rule must not silently reject every pre-existing group.
    const basisEvaluated = records.filter(
      (rec: any) => rec.priceBasisPolicyVersion != null
    );
    const basisUnknownOnly =
      basisEvaluated.length === records.length &&
      basisEvaluated.length > 0 &&
      basisEvaluated.every((rec: any) => (rec.priceBasis ?? "unknown") === "unknown");

    // Confidence score
    let confidence = 50;
    if (records.length >= 10) confidence += 15;
    else if (records.length >= 5) confidence += 10;
    if (sourceDiversity >= 3) confidence += 15;
    else if (sourceDiversity >= 2) confidence += 10;
    if (reliabilityDist.A >= records.length * 0.5) confidence += 10;
    if (recencyDist.recent >= records.length * 0.5) confidence += 10;
    confidence = Math.min(100, confidence);

    // Recommendation
    let recommendation: "publish" | "reject" = "publish";
    let rejectionReason: string | undefined;

    if (records.length < 5) {
      recommendation = "reject";
      rejectionReason = `Insufficient sample size: ${records.length} < 5`;
    } else if (sourceDiversity < 2) {
      recommendation = "reject";
      rejectionReason = `Insufficient source diversity: ${sourceDiversity} < 2`;
    } else if (retailOnly) {
      // EV-01b: consumer retail listings are not trade rates. They may inform
      // a sanity band, but a published benchmark needs at least one other
      // price class — a trade quote, an official statistic, or a consultancy
      // benchmark.
      recommendation = "reject";
      rejectionReason =
        `Retail-only price class (${records.length} records): a published benchmark ` +
        `requires a second price class`;
    } else if (basisUnknownOnly) {
      // A price whose basis is unknown may be per piece, per box, or per m².
      // Percentiles over mixed bases are meaningless.
      recommendation = "reject";
      rejectionReason =
        `Price basis unresolved for all ${records.length} records; ` +
        `cannot key a benchmark on an unknown basis`;
    } else if (confidence < 40) {
      recommendation = "reject";
      rejectionReason = `Low confidence score: ${confidence}`;
    }

    try {
      const result = await db.createBenchmarkProposal({
        benchmarkKey,
        keyPolicyVersion: BENCHMARK_KEY_POLICY_VERSION,
        proposedP25: String(p25.toFixed(2)) as any,
        proposedP50: String(p50.toFixed(2)) as any,
        proposedP75: String(p75.toFixed(2)) as any,
        weightedMean: String(weightedMean.toFixed(2)) as any,
        evidenceCount: records.length,
        sourceDiversity,
        reliabilityDist,
        recencyDist,
        priceClassDist,
        priceBasisDist,
        confidenceScore: confidence,
        recommendation,
        rejectionReason,
        runId,
      });

      proposals.push({ id: result.id, benchmarkKey, recommendation });
      proposalsCreated++;
    } catch (err) {
      console.error(`[ProposalGenerator] Failed to create proposal for ${benchmarkKey}:`, err);
    }
  }

  // Log to intelligence audit
  try {
    await db.createIntelligenceAuditEntry({
      runType: "benchmark_proposal",
      runId,
      actor: actorId ?? null,
      inputSummary: {
        category,
        minEvidenceCount,
        totalEvidence: evidence.length,
        triggeredByIngestion: ingestionRunId ?? null,
      },
      outputSummary: { proposalsCreated, groups: groups.size },
      sourcesProcessed: evidence.length,
      recordsExtracted: proposalsCreated,
      errors: 0,
      startedAt,
      completedAt: new Date(),
    });
  } catch (err) {
    console.error("[ProposalGenerator] Failed to log audit entry:", err);
  }

  return {
    proposalsCreated,
    groupsAnalyzed: groups.size,
    totalEvidence: evidence.length,
    proposals,
  };
}
