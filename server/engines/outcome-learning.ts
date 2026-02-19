/**
 * Outcome Learning Engine (V2.13)
 * Compares predicted vs actual outcomes to suggest benchmark adjustments.
 * Deterministic — no ML, just statistical comparison.
 */

export interface OutcomeComparison {
  metric: string;
  predicted: number;
  actual: number;
  delta: number;
  deltaPct: number;
  direction: "over" | "under" | "aligned";
  significance: "high" | "medium" | "low";
}

export interface BenchmarkAdjustment {
  field: string;
  currentValue: number;
  suggestedValue: number;
  adjustmentPct: number;
  confidence: number;
  basedOnProjects: number;
  rationale: string;
}

export interface LearningReport {
  totalOutcomes: number;
  comparisons: OutcomeComparison[];
  suggestedAdjustments: BenchmarkAdjustment[];
  overallAccuracy: number;
  generatedAt: string;
}

/**
 * Compare predicted (from evaluation) vs actual (from outcomes) metrics
 */
export function compareOutcomes(
  outcomes: Array<{
    projectId: number;
    procurementActualCosts?: Record<string, number>;
    leadTimesActual?: Record<string, number>;
    rfqResults?: Record<string, number>;
  }>,
  predictions: Array<{
    projectId: number;
    estimatedCost?: number;
    estimatedLeadTime?: number;
    estimatedRfqRounds?: number;
  }>
): OutcomeComparison[] {
  const comparisons: OutcomeComparison[] = [];

  // Build prediction lookup
  const predMap = new Map(predictions.map((p) => [p.projectId, p]));

  // Aggregate cost comparisons
  const costDeltas: number[] = [];
  const leadTimeDeltas: number[] = [];

  for (const outcome of outcomes) {
    const pred = predMap.get(outcome.projectId);
    if (!pred) continue;

    // Cost comparison
    if (outcome.procurementActualCosts && pred.estimatedCost) {
      const totalActual = Object.values(outcome.procurementActualCosts).reduce((s, v) => s + v, 0);
      const delta = totalActual - pred.estimatedCost;
      const deltaPct = pred.estimatedCost > 0 ? (delta / pred.estimatedCost) * 100 : 0;
      costDeltas.push(deltaPct);
    }

    // Lead time comparison
    if (outcome.leadTimesActual && pred.estimatedLeadTime) {
      const maxActual = Math.max(...Object.values(outcome.leadTimesActual));
      const delta = maxActual - pred.estimatedLeadTime;
      const deltaPct = pred.estimatedLeadTime > 0 ? (delta / pred.estimatedLeadTime) * 100 : 0;
      leadTimeDeltas.push(deltaPct);
    }
  }

  // Aggregate cost comparison
  if (costDeltas.length > 0) {
    const avgDelta = costDeltas.reduce((s, d) => s + d, 0) / costDeltas.length;
    comparisons.push({
      metric: "Procurement Cost",
      predicted: 100, // normalized
      actual: 100 + avgDelta,
      delta: avgDelta,
      deltaPct: avgDelta,
      direction: avgDelta > 5 ? "over" : avgDelta < -5 ? "under" : "aligned",
      significance: Math.abs(avgDelta) > 15 ? "high" : Math.abs(avgDelta) > 5 ? "medium" : "low",
    });
  }

  // Aggregate lead time comparison
  if (leadTimeDeltas.length > 0) {
    const avgDelta = leadTimeDeltas.reduce((s, d) => s + d, 0) / leadTimeDeltas.length;
    comparisons.push({
      metric: "Lead Time",
      predicted: 100,
      actual: 100 + avgDelta,
      delta: avgDelta,
      deltaPct: avgDelta,
      direction: avgDelta > 5 ? "over" : avgDelta < -5 ? "under" : "aligned",
      significance: Math.abs(avgDelta) > 20 ? "high" : Math.abs(avgDelta) > 10 ? "medium" : "low",
    });
  }

  return comparisons;
}

/**
 * Generate benchmark adjustment suggestions based on outcome comparisons
 */
export function suggestBenchmarkAdjustments(
  comparisons: OutcomeComparison[],
  projectCount: number
): BenchmarkAdjustment[] {
  const adjustments: BenchmarkAdjustment[] = [];

  for (const comp of comparisons) {
    if (comp.significance === "low") continue; // only suggest for meaningful deviations

    const adjustmentPct = comp.deltaPct * 0.5; // conservative: adjust by half the observed delta
    const confidence = Math.min(0.95, 0.3 + (projectCount / 20) * 0.5); // more projects = more confidence

    if (comp.metric === "Procurement Cost") {
      adjustments.push({
        field: "costPerSqftMid",
        currentValue: 100,
        suggestedValue: 100 + adjustmentPct,
        adjustmentPct,
        confidence,
        basedOnProjects: projectCount,
        rationale: `Actual procurement costs were ${Math.abs(comp.deltaPct).toFixed(1)}% ${comp.direction === "over" ? "higher" : "lower"} than benchmarks across ${projectCount} projects. Suggesting a ${Math.abs(adjustmentPct).toFixed(1)}% ${adjustmentPct > 0 ? "increase" : "decrease"} to cost benchmarks.`,
      });
    }

    if (comp.metric === "Lead Time") {
      adjustments.push({
        field: "leadTimeDays",
        currentValue: 100,
        suggestedValue: 100 + adjustmentPct,
        adjustmentPct,
        confidence,
        basedOnProjects: projectCount,
        rationale: `Actual lead times were ${Math.abs(comp.deltaPct).toFixed(1)}% ${comp.direction === "over" ? "longer" : "shorter"} than benchmarks across ${projectCount} projects. Suggesting a ${Math.abs(adjustmentPct).toFixed(1)}% ${adjustmentPct > 0 ? "increase" : "decrease"} to lead time estimates.`,
      });
    }
  }

  return adjustments;
}

/**
 * Compute overall prediction accuracy
 */
export function computeAccuracy(comparisons: OutcomeComparison[]): number {
  if (comparisons.length === 0) return 0;
  const accuracies = comparisons.map((c) => Math.max(0, 100 - Math.abs(c.deltaPct)));
  return accuracies.reduce((s, a) => s + a, 0) / accuracies.length;
}

/**
 * Generate full learning report
 */
export function generateLearningReport(
  outcomes: Array<{
    projectId: number;
    procurementActualCosts?: Record<string, number>;
    leadTimesActual?: Record<string, number>;
    rfqResults?: Record<string, number>;
  }>,
  predictions: Array<{
    projectId: number;
    estimatedCost?: number;
    estimatedLeadTime?: number;
    estimatedRfqRounds?: number;
  }>
): LearningReport {
  const comparisons = compareOutcomes(outcomes, predictions);
  const suggestedAdjustments = suggestBenchmarkAdjustments(comparisons, outcomes.length);
  const overallAccuracy = computeAccuracy(comparisons);

  return {
    totalOutcomes: outcomes.length,
    comparisons,
    suggestedAdjustments,
    overallAccuracy,
    generatedAt: new Date().toISOString(),
  };
}
