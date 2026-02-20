/**
 * MIYAR V3-06 — Market Positioning Analytics Engine
 *
 * Deterministic market positioning based on fitout_rate evidence:
 *   - computePercentiles(): P25/P50/P75/P90 from evidence data
 *   - assignTier(): Budget/Mid-Range/Premium/Ultra-Premium
 *   - computeMarketPosition(): full positioning analysis
 *
 * Tier boundaries:
 *   - Budget:        < P25
 *   - Mid-Range:     P25 – P50
 *   - Premium:       P50 – P75
 *   - Ultra-Premium: > P75
 *
 * LLM is NOT used in this engine. All computations are deterministic.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface MarketDataPoint {
  value: number;
  grade: "A" | "B" | "C";
  sourceId: string;
  date: Date;
  recordId: number;
}

export interface Percentiles {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
  mean: number;
  count: number;
}

export type MarketTier = "budget" | "mid_range" | "premium" | "ultra_premium";

export interface MarketPositionResult {
  targetValue: number;
  tier: MarketTier;
  tierLabel: string;
  percentile: number; // 0-100, where the target sits
  percentiles: Percentiles;
  dataPointCount: number;
  gradeACount: number;
  uniqueSources: number;
  confidence: "high" | "medium" | "low" | "insufficient";
  competitiveIndex: number; // 0-100, how competitive the price is (lower = more competitive)
  priceGap: {
    toP25: number;
    toP50: number;
    toP75: number;
    toP90: number;
  };
}

// ─── Named Constants ─────────────────────────────────────────────

export const TIER_LABELS: Record<MarketTier, string> = {
  budget: "Budget",
  mid_range: "Mid-Range",
  premium: "Premium",
  ultra_premium: "Ultra-Premium",
};

// Confidence thresholds (same as trend detection for consistency)
const CONFIDENCE_HIGH_MIN_POINTS = 15;
const CONFIDENCE_HIGH_MIN_GRADE_A = 2;
const CONFIDENCE_MEDIUM_MIN_POINTS = 8;
const CONFIDENCE_LOW_MIN_POINTS = 5;

// ─── Percentile Computation ──────────────────────────────────────

/**
 * Compute percentiles using linear interpolation.
 * This is the standard "R-7" method used by Excel, NumPy, etc.
 */
export function computePercentiles(values: number[]): Percentiles {
  if (values.length === 0) {
    return { p25: 0, p50: 0, p75: 0, p90: 0, min: 0, max: 0, mean: 0, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const percentile = (p: number): number => {
    if (n === 1) return sorted[0];
    const rank = (p / 100) * (n - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const fraction = rank - lower;
    if (lower === upper) return sorted[lower];
    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
  };

  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;

  return {
    p25: Math.round(percentile(25) * 100) / 100,
    p50: Math.round(percentile(50) * 100) / 100,
    p75: Math.round(percentile(75) * 100) / 100,
    p90: Math.round(percentile(90) * 100) / 100,
    min: sorted[0],
    max: sorted[n - 1],
    mean: Math.round(mean * 100) / 100,
    count: n,
  };
}

// ─── Tier Assignment ─────────────────────────────────────────────

/**
 * Assign market tier based on where the target value falls
 * relative to percentile boundaries.
 */
export function assignTier(targetValue: number, percentiles: Percentiles): MarketTier {
  if (targetValue < percentiles.p25) return "budget";
  if (targetValue < percentiles.p50) return "mid_range";
  if (targetValue < percentiles.p75) return "premium";
  return "ultra_premium";
}

/**
 * Compute the percentile rank of a target value within the dataset.
 * Returns 0-100.
 */
export function computePercentileRank(targetValue: number, values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < targetValue).length;
  const equal = sorted.filter((v) => v === targetValue).length;
  const rank = ((below + 0.5 * equal) / sorted.length) * 100;
  return Math.round(Math.min(100, Math.max(0, rank)) * 100) / 100;
}

// ─── Confidence Assessment ───────────────────────────────────────

function assessConfidence(
  dataPointCount: number,
  gradeACount: number
): "high" | "medium" | "low" | "insufficient" {
  if (dataPointCount >= CONFIDENCE_HIGH_MIN_POINTS && gradeACount >= CONFIDENCE_HIGH_MIN_GRADE_A) {
    return "high";
  }
  if (dataPointCount >= CONFIDENCE_MEDIUM_MIN_POINTS) {
    return "medium";
  }
  if (dataPointCount >= CONFIDENCE_LOW_MIN_POINTS) {
    return "low";
  }
  return "insufficient";
}

// ─── Competitive Index ───────────────────────────────────────────

/**
 * Compute competitive index: 0 = most competitive (lowest price),
 * 100 = least competitive (highest price).
 * This is essentially the percentile rank.
 */
function computeCompetitiveIndex(targetValue: number, percentiles: Percentiles): number {
  if (percentiles.max === percentiles.min) return 50;
  const normalized = (targetValue - percentiles.min) / (percentiles.max - percentiles.min);
  return Math.round(Math.min(100, Math.max(0, normalized * 100)) * 100) / 100;
}

// ─── Main Entry Point ────────────────────────────────────────────

/**
 * Compute full market position for a target fitout rate.
 */
export function computeMarketPosition(
  targetValue: number,
  dataPoints: MarketDataPoint[]
): MarketPositionResult {
  const values = dataPoints.map((d) => d.value);
  const percentiles = computePercentiles(values);
  const tier = assignTier(targetValue, percentiles);
  const percentile = computePercentileRank(targetValue, values);
  const gradeACount = dataPoints.filter((d) => d.grade === "A").length;
  const uniqueSources = new Set(dataPoints.map((d) => d.sourceId)).size;
  const confidence = assessConfidence(dataPoints.length, gradeACount);
  const competitiveIndex = computeCompetitiveIndex(targetValue, percentiles);

  return {
    targetValue,
    tier,
    tierLabel: TIER_LABELS[tier],
    percentile,
    percentiles,
    dataPointCount: dataPoints.length,
    gradeACount,
    uniqueSources,
    confidence,
    competitiveIndex,
    priceGap: {
      toP25: Math.round((targetValue - percentiles.p25) * 100) / 100,
      toP50: Math.round((targetValue - percentiles.p50) * 100) / 100,
      toP75: Math.round((targetValue - percentiles.p75) * 100) / 100,
      toP90: Math.round((targetValue - percentiles.p90) * 100) / 100,
    },
  };
}
