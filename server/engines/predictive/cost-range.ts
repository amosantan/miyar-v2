/**
 * Predictive Cost Range Engine (V4-08)
 *
 * Computes P15/P50/P85/P95 cost ranges from evidence records,
 * applies trend adjustments from trendSnapshots, falls back to
 * UAE-wide data when local data is insufficient, and assigns
 * confidence levels.
 */

export interface EvidenceDataPoint {
  priceMin: number;
  priceTypical: number;
  priceMax: number;
  unit: string;
  reliabilityGrade: "A" | "B" | "C";
  confidenceScore: number;
  captureDate: Date | string;
  category: string;
  geography?: string;
}

export interface TrendDataPoint {
  category: string;
  direction: "rising" | "falling" | "stable" | "insufficient_data";
  percentChange: number;
  confidence: "high" | "medium" | "low" | "insufficient";
}

export interface CostRangePrediction {
  p15: number;
  p50: number;
  p85: number;
  p95: number;
  unit: string;
  currency: string;
  trendAdjustment: number; // percentage, e.g. +5.2 means +5.2%
  trendDirection: "rising" | "falling" | "stable" | "insufficient_data";
  confidence: "high" | "medium" | "low" | "insufficient";
  dataPointCount: number;
  gradeACount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  adjustedP15?: number;
  adjustedP50?: number;
  adjustedP85?: number;
  adjustedP95?: number;
}

/**
 * Compute a weighted percentile from evidence data points.
 * Grade A = weight 3, Grade B = weight 2, Grade C = weight 1.
 * Recency bonus: data < 90 days old gets +1 weight.
 */
function weightedPercentile(values: { value: number; weight: number }[], percentile: number): number {
  if (values.length === 0) return 0;

  // Sort by value
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) return 0;

  const target = (percentile / 100) * totalWeight;
  let cumWeight = 0;

  for (let i = 0; i < sorted.length; i++) {
    cumWeight += sorted[i].weight;
    if (cumWeight >= target) {
      return sorted[i].value;
    }
  }
  return sorted[sorted.length - 1].value;
}

function gradeWeight(grade: string): number {
  switch (grade) {
    case "A": return 3;
    case "B": return 2;
    case "C": return 1;
    default: return 1;
  }
}

function recencyBonus(captureDate: Date | string): number {
  const now = Date.now();
  const capture = new Date(captureDate).getTime();
  const daysDiff = (now - capture) / (1000 * 60 * 60 * 24);
  return daysDiff < 90 ? 1 : 0;
}

/**
 * Determine confidence level based on data quality.
 * - high: ≥ 15 data points AND ≥ 2 Grade A sources
 * - medium: ≥ 8 data points
 * - low: ≥ 3 data points
 * - insufficient: < 3 data points
 */
function determineConfidence(
  dataPointCount: number,
  gradeACount: number
): "high" | "medium" | "low" | "insufficient" {
  if (dataPointCount >= 15 && gradeACount >= 2) return "high";
  if (dataPointCount >= 8) return "medium";
  if (dataPointCount >= 3) return "low";
  return "insufficient";
}

export function predictCostRange(
  evidence: EvidenceDataPoint[],
  trends: TrendDataPoint[],
  options: {
    category?: string;
    geography?: string;
    uaeWideEvidence?: EvidenceDataPoint[];
  } = {}
): CostRangePrediction {
  // Filter evidence by category and geography if specified
  let filtered = evidence;
  if (options.category) {
    filtered = filtered.filter(e => e.category === options.category);
  }
  if (options.geography) {
    filtered = filtered.filter(e => e.geography === options.geography);
  }

  let fallbackUsed = false;
  let fallbackReason: string | undefined;

  // UAE-wide fallback if insufficient local data
  if (filtered.length < 3 && options.uaeWideEvidence && options.uaeWideEvidence.length >= 3) {
    let uaeFiltered = options.uaeWideEvidence;
    if (options.category) {
      uaeFiltered = uaeFiltered.filter(e => e.category === options.category);
    }
    if (uaeFiltered.length >= 3) {
      filtered = uaeFiltered;
      fallbackUsed = true;
      fallbackReason = `Insufficient local data (${evidence.filter(e => options.category ? e.category === options.category : true).length} records). Using UAE-wide fallback (${uaeFiltered.length} records).`;
    }
  }

  // If still insufficient, return insufficient result
  if (filtered.length < 3) {
    return {
      p15: 0,
      p50: 0,
      p85: 0,
      p95: 0,
      unit: "AED/sqm",
      currency: "AED",
      trendAdjustment: 0,
      trendDirection: "insufficient_data",
      confidence: "insufficient",
      dataPointCount: filtered.length,
      gradeACount: filtered.filter(e => e.reliabilityGrade === "A").length,
      fallbackUsed,
      fallbackReason: fallbackReason || "Insufficient data for prediction",
    };
  }

  // Build weighted value arrays from typical prices
  const weightedValues = filtered.map(e => ({
    value: e.priceTypical || ((e.priceMin + e.priceMax) / 2),
    weight: gradeWeight(e.reliabilityGrade) + recencyBonus(e.captureDate),
  }));

  const p15 = weightedPercentile(weightedValues, 15);
  const p50 = weightedPercentile(weightedValues, 50);
  const p85 = weightedPercentile(weightedValues, 85);
  const p95 = weightedPercentile(weightedValues, 95);

  // Determine the primary unit from evidence
  const unitCounts: Record<string, number> = {};
  for (const e of filtered) {
    unitCounts[e.unit] = (unitCounts[e.unit] || 0) + 1;
  }
  const primaryUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "AED/sqm";

  // Trend adjustment
  let trendAdjustment = 0;
  let trendDirection: CostRangePrediction["trendDirection"] = "insufficient_data";

  if (trends.length > 0) {
    // Find the most relevant trend (matching category if possible)
    const categoryTrend = options.category
      ? trends.find(t => t.category === options.category && t.confidence !== "insufficient")
      : undefined;
    const bestTrend = categoryTrend || trends.find(t => t.confidence !== "insufficient");

    if (bestTrend) {
      trendAdjustment = bestTrend.percentChange;
      trendDirection = bestTrend.direction;
    }
  }

  const gradeACount = filtered.filter(e => e.reliabilityGrade === "A").length;
  const confidence = determineConfidence(filtered.length, gradeACount);

  // Apply trend adjustment to get adjusted values
  const factor = 1 + (trendAdjustment / 100);
  const adjustedP15 = Math.round(p15 * factor * 100) / 100;
  const adjustedP50 = Math.round(p50 * factor * 100) / 100;
  const adjustedP85 = Math.round(p85 * factor * 100) / 100;
  const adjustedP95 = Math.round(p95 * factor * 100) / 100;

  return {
    p15: Math.round(p15 * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p85: Math.round(p85 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    unit: primaryUnit,
    currency: "AED",
    trendAdjustment: Math.round(trendAdjustment * 100) / 100,
    trendDirection,
    confidence,
    dataPointCount: filtered.length,
    gradeACount,
    fallbackUsed,
    fallbackReason,
    adjustedP15,
    adjustedP50,
    adjustedP85,
    adjustedP95,
  };
}
