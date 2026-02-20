/**
 * MIYAR V3-04 — Trend Detection Engine
 *
 * Deterministic trend analysis on evidence_records data:
 *   - computeMovingAverage(): configurable window (default 30 days)
 *   - detectDirectionChange(): 30-day MA crosses prior 30-day MA by >5%
 *   - flagAnomalies(): >2 std deviations from moving average
 *   - detectTrends(): orchestrates all analysis for a given metric/category
 *
 * Confidence rules:
 *   - high:   ≥15 data points + ≥2 Grade A sources
 *   - medium: 8–14 data points
 *   - low:    5–7 data points
 *   - insufficient: <5 data points
 *
 * LLM is used ONLY for generating a 3-sentence narrative summary
 * from the structured trend fields. LLM NEVER computes trend direction,
 * confidence, or anomaly flags.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────

export interface DataPoint {
  date: Date;
  value: number;
  grade: "A" | "B" | "C";
  sourceId: string;
  recordId: number;
}

export interface MovingAveragePoint {
  date: Date;
  value: number;
  ma: number;
}

export interface TrendResult {
  metric: string;
  category: string;
  geography: string;
  dataPointCount: number;
  gradeACount: number;
  gradeBCount: number;
  gradeCCount: number;
  uniqueSources: number;
  dateRange: { start: Date; end: Date } | null;
  currentMA: number | null;
  previousMA: number | null;
  percentChange: number | null;
  direction: "rising" | "falling" | "stable" | "insufficient_data";
  anomalies: AnomalyFlag[];
  confidence: "high" | "medium" | "low" | "insufficient";
  narrative: string | null;
  movingAverages: MovingAveragePoint[];
}

export interface AnomalyFlag {
  date: Date;
  value: number;
  expectedMA: number;
  deviationMultiple: number; // how many std devs away
  recordId: number;
  sourceId: string;
}

// ─── Named Constants ─────────────────────────────────────────────

export const DEFAULT_MA_WINDOW_DAYS = 30;
export const DIRECTION_CHANGE_THRESHOLD = 0.05; // 5%
export const ANOMALY_STD_DEV_THRESHOLD = 2.0;

// Confidence thresholds
export const CONFIDENCE_HIGH_MIN_POINTS = 15;
export const CONFIDENCE_HIGH_MIN_GRADE_A = 2;
export const CONFIDENCE_MEDIUM_MIN_POINTS = 8;
export const CONFIDENCE_LOW_MIN_POINTS = 5;

// ─── Moving Average ──────────────────────────────────────────────

/**
 * Compute a simple moving average over a sorted array of data points.
 * Window is in days. Returns one MA value per data point.
 */
export function computeMovingAverage(
  points: DataPoint[],
  windowDays: number = DEFAULT_MA_WINDOW_DAYS
): MovingAveragePoint[] {
  if (points.length === 0) return [];

  // Sort by date ascending
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  return sorted.map((point) => {
    // Find all points within the window ending at this point's date
    const windowStart = point.date.getTime() - windowMs;
    const windowPoints = sorted.filter(
      (p) => p.date.getTime() >= windowStart && p.date.getTime() <= point.date.getTime()
    );

    const ma =
      windowPoints.length > 0
        ? windowPoints.reduce((sum, p) => sum + p.value, 0) / windowPoints.length
        : point.value;

    return {
      date: point.date,
      value: point.value,
      ma: Math.round(ma * 100) / 100,
    };
  });
}

// ─── Direction Change Detection ──────────────────────────────────

/**
 * Detect if the current 30-day MA has crossed the prior 30-day MA by >5%.
 * "Current" = last windowDays, "Prior" = the windowDays before that.
 *
 * Returns: { direction, currentMA, previousMA, percentChange }
 */
export function detectDirectionChange(
  points: DataPoint[],
  windowDays: number = DEFAULT_MA_WINDOW_DAYS
): {
  direction: "rising" | "falling" | "stable" | "insufficient_data";
  currentMA: number | null;
  previousMA: number | null;
  percentChange: number | null;
} {
  if (points.length < 2) {
    return { direction: "insufficient_data", currentMA: null, previousMA: null, percentChange: null };
  }

  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = sorted[sorted.length - 1].date.getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  // Current window: [latest - windowMs, latest]
  const currentWindowStart = latest - windowMs;
  const currentPoints = sorted.filter(
    (p) => p.date.getTime() >= currentWindowStart && p.date.getTime() <= latest
  );

  // Previous window: [latest - 2*windowMs, latest - windowMs)
  const prevWindowStart = latest - 2 * windowMs;
  const prevPoints = sorted.filter(
    (p) => p.date.getTime() >= prevWindowStart && p.date.getTime() < currentWindowStart
  );

  if (currentPoints.length === 0) {
    return { direction: "insufficient_data", currentMA: null, previousMA: null, percentChange: null };
  }

  const currentMA =
    currentPoints.reduce((sum, p) => sum + p.value, 0) / currentPoints.length;

  if (prevPoints.length === 0) {
    // No previous window data — can't determine direction
    return {
      direction: "stable",
      currentMA: Math.round(currentMA * 100) / 100,
      previousMA: null,
      percentChange: null,
    };
  }

  const previousMA =
    prevPoints.reduce((sum, p) => sum + p.value, 0) / prevPoints.length;

  if (previousMA === 0) {
    return {
      direction: "stable",
      currentMA: Math.round(currentMA * 100) / 100,
      previousMA: 0,
      percentChange: null,
    };
  }

  const percentChange = (currentMA - previousMA) / Math.abs(previousMA);

  let direction: "rising" | "falling" | "stable";
  if (percentChange > DIRECTION_CHANGE_THRESHOLD) {
    direction = "rising";
  } else if (percentChange < -DIRECTION_CHANGE_THRESHOLD) {
    direction = "falling";
  } else {
    direction = "stable";
  }

  return {
    direction,
    currentMA: Math.round(currentMA * 100) / 100,
    previousMA: Math.round(previousMA * 100) / 100,
    percentChange: Math.round(percentChange * 10000) / 10000, // 4 decimal places
  };
}

// ─── Anomaly Detection ───────────────────────────────────────────

/**
 * Flag data points that are >2 standard deviations from the moving average.
 */
export function flagAnomalies(
  points: DataPoint[],
  maPoints: MovingAveragePoint[],
  stdDevThreshold: number = ANOMALY_STD_DEV_THRESHOLD
): AnomalyFlag[] {
  if (points.length < 3 || maPoints.length === 0) return [];

  // Compute standard deviation of residuals (value - MA)
  const residuals = maPoints.map((ma) => ma.value - ma.ma);
  const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
  const variance =
    residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) / residuals.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return []; // All values identical, no anomalies

  const anomalies: AnomalyFlag[] = [];
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    const maPoint = maPoints[i];
    if (!maPoint) continue;

    const deviation = Math.abs(point.value - maPoint.ma);
    const deviationMultiple = deviation / stdDev;

    if (deviationMultiple > stdDevThreshold) {
      anomalies.push({
        date: point.date,
        value: point.value,
        expectedMA: maPoint.ma,
        deviationMultiple: Math.round(deviationMultiple * 100) / 100,
        recordId: point.recordId,
        sourceId: point.sourceId,
      });
    }
  }

  return anomalies;
}

// ─── Confidence Assessment ───────────────────────────────────────

/**
 * Deterministic confidence based on data point count and Grade A source count.
 */
export function assessConfidence(
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

// ─── LLM Narrative ───────────────────────────────────────────────

/**
 * Generate a 3-sentence narrative summary from structured trend fields.
 * LLM is used ONLY for prose generation — all data is pre-computed.
 */
export async function generateTrendNarrative(
  trend: Omit<TrendResult, "narrative" | "movingAverages">
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a real estate market analyst. Write exactly 3 sentences summarizing a market trend. Be factual and concise. Do not add opinions or recommendations.",
        },
        {
          role: "user",
          content: `Summarize this trend:
Metric: ${trend.metric}
Category: ${trend.category}
Geography: ${trend.geography}
Direction: ${trend.direction}
Current 30-day average: ${trend.currentMA ?? "N/A"}
Previous 30-day average: ${trend.previousMA ?? "N/A"}
Change: ${trend.percentChange !== null ? `${(trend.percentChange * 100).toFixed(1)}%` : "N/A"}
Data points: ${trend.dataPointCount} (${trend.gradeACount} Grade A, ${trend.gradeBCount} Grade B, ${trend.gradeCCount} Grade C)
Sources: ${trend.uniqueSources}
Anomalies: ${trend.anomalies.length}
Date range: ${trend.dateRange ? `${trend.dateRange.start.toISOString().split("T")[0]} to ${trend.dateRange.end.toISOString().split("T")[0]}` : "N/A"}
Confidence: ${trend.confidence}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
  } catch (err) {
    console.error("[TrendDetection] Narrative generation failed:", err);
    return "";
  }
}

// ─── Main Orchestrator ───────────────────────────────────────────

/**
 * Run full trend detection for a given set of data points.
 * This is the main entry point called by tRPC endpoints.
 */
export async function detectTrends(
  metric: string,
  category: string,
  geography: string,
  points: DataPoint[],
  options?: {
    windowDays?: number;
    generateNarrative?: boolean;
  }
): Promise<TrendResult> {
  const windowDays = options?.windowDays ?? DEFAULT_MA_WINDOW_DAYS;
  const shouldGenerateNarrative = options?.generateNarrative ?? true;

  // Count grades and sources
  const gradeACount = points.filter((p) => p.grade === "A").length;
  const gradeBCount = points.filter((p) => p.grade === "B").length;
  const gradeCCount = points.filter((p) => p.grade === "C").length;
  const uniqueSources = new Set(points.map((p) => p.sourceId)).size;

  // Date range
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const dateRange =
    sorted.length > 0
      ? { start: sorted[0].date, end: sorted[sorted.length - 1].date }
      : null;

  // Compute moving averages
  const maPoints = computeMovingAverage(points, windowDays);

  // Detect direction change
  const { direction, currentMA, previousMA, percentChange } = detectDirectionChange(
    points,
    windowDays
  );

  // Flag anomalies
  const anomalies = flagAnomalies(points, maPoints);

  // Assess confidence
  const confidence = assessConfidence(points.length, gradeACount);

  // Build partial result for narrative generation
  const partialResult = {
    metric,
    category,
    geography,
    dataPointCount: points.length,
    gradeACount,
    gradeBCount,
    gradeCCount,
    uniqueSources,
    dateRange,
    currentMA,
    previousMA,
    percentChange,
    direction,
    anomalies,
    confidence,
  };

  // Generate narrative (LLM call)
  let narrative: string | null = null;
  if (shouldGenerateNarrative && points.length >= CONFIDENCE_LOW_MIN_POINTS) {
    narrative = await generateTrendNarrative(partialResult);
  }

  return {
    ...partialResult,
    narrative,
    movingAverages: maPoints,
  };
}
