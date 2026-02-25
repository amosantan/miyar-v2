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
export async function generateBenchmarkProposals(
  options: {
    category?: string;
    minEvidenceCount?: number;
    actorId?: number;
    ingestionRunId?: string;
  } = {}
): Promise<ProposalGenerationResult> {
  const { category, minEvidenceCount = 3, actorId, ingestionRunId } = options;

  const runId = `PROP-${randomUUID().substring(0, 8)}`;
  const startedAt = new Date();

  // Get all evidence records, optionally filtered by category
  const evidence = await db.listEvidenceRecords({
    category,
    limit: 10000,
  });

  if (evidence.length === 0) {
    return { proposalsCreated: 0, groupsAnalyzed: 0, totalEvidence: 0, proposals: [] };
  }

  // Group evidence by category + finishLevel + unit (benchmark key)
  const groups = new Map<string, typeof evidence>();
  for (const rec of evidence) {
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
    } else if (confidence < 40) {
      recommendation = "reject";
      rejectionReason = `Low confidence score: ${confidence}`;
    }

    try {
      const result = await db.createBenchmarkProposal({
        benchmarkKey,
        proposedP25: String(p25.toFixed(2)) as any,
        proposedP50: String(p50.toFixed(2)) as any,
        proposedP75: String(p75.toFixed(2)) as any,
        weightedMean: String(weightedMean.toFixed(2)) as any,
        evidenceCount: records.length,
        sourceDiversity,
        reliabilityDist,
        recencyDist,
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
