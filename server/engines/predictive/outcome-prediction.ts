/**
 * Design Outcome Prediction Engine (V4-09)
 *
 * Predicts project success likelihood using:
 * - Comparable project outcomes (filtered by typology, tier, geography)
 * - Composite score contribution
 * - Key risk/success factors from variable contributions
 */

export interface ComparableOutcome {
  projectId: number;
  compositeScore: number;
  decisionStatus: "validated" | "conditional" | "not_validated";
  typology: string;
  tier: string;
  geography?: string;
  targetYield?: string;
  salesStrategy?: string;
  brandedStatus?: string;
  handoverCondition?: string;
  salesChannel?: string;
  lifecycleFocus?: string;
  brandStandardConstraints?: string;
  timelineFlexibility?: string;
  targetValueAdd?: string;
}

export interface VariableContribution {
  variable: string;
  contribution: number; // positive = success factor, negative = risk factor
  dimension: string;
}

export interface OutcomePrediction {
  successLikelihood: number; // 0-100
  confidenceLevel: "high" | "medium" | "low" | "insufficient";
  comparableCount: number;
  validatedRate: number; // % of comparables that were validated
  conditionalRate: number;
  notValidatedRate: number;
  keyRiskFactors: Array<{ variable: string; contribution: number; dimension: string }>;
  keySuccessFactors: Array<{ variable: string; contribution: number; dimension: string }>;
  predictionBasis: string;
}

/**
 * Filter comparable outcomes by similarity to the current project.
 * Matches on typology first, then tier, then geography.
 */
function filterComparables(
  outcomes: ComparableOutcome[],
  targetTypology: string,
  targetTier: string,
  targetGeography?: string,
  targetYield?: string,
  targetSalesStrategy?: string,
  targetHandoverCondition?: string,
  targetBrandedStatus?: string,
  targetSalesChannel?: string,
  targetLifecycleFocus?: string,
  targetBrandStandardConstraints?: string,
  targetTimelineFlexibility?: string,
  targetTargetValueAdd?: string
): ComparableOutcome[] {
  // Try ultra-specific match: typology + tier + geography + strategy + yield + v5 features
  let filtered = outcomes.filter(o =>
    o.typology === targetTypology &&
    o.tier === targetTier &&
    (!targetGeography || o.geography === targetGeography) &&
    (!targetSalesStrategy || o.salesStrategy === targetSalesStrategy) &&
    (!targetYield || o.targetYield === targetYield) &&
    (!targetHandoverCondition || o.handoverCondition === targetHandoverCondition) &&
    (!targetBrandedStatus || o.brandedStatus === targetBrandedStatus) &&
    (!targetSalesChannel || o.salesChannel === targetSalesChannel) &&
    (!targetLifecycleFocus || o.lifecycleFocus === targetLifecycleFocus) &&
    (!targetBrandStandardConstraints || o.brandStandardConstraints === targetBrandStandardConstraints) &&
    (!targetTimelineFlexibility || o.timelineFlexibility === targetTimelineFlexibility) &&
    (!targetTargetValueAdd || o.targetValueAdd === targetTargetValueAdd)
  );
  if (filtered.length >= 3) return filtered;

  // Fallback 1: typology + tier + geography
  filtered = outcomes.filter(o =>
    o.typology === targetTypology &&
    o.tier === targetTier &&
    (!targetGeography || o.geography === targetGeography)
  );
  if (filtered.length >= 5) return filtered;

  // Relax geography
  filtered = outcomes.filter(o =>
    o.typology === targetTypology &&
    o.tier === targetTier
  );
  if (filtered.length >= 5) return filtered;

  // Relax tier
  filtered = outcomes.filter(o =>
    o.typology === targetTypology
  );
  if (filtered.length >= 3) return filtered;

  // Use all outcomes as last resort
  return outcomes;
}

/**
 * Deterministic success likelihood formula:
 *
 * baseLikelihood = (compositeScore / 100) * 60 + 20
 *   → Maps composite 0→20%, composite 100→80%
 *
 * comparableBonus = (validatedRate - 50) * 0.2
 *   → If 70% of comparables validated, bonus = +4%
 *
 * successLikelihood = clamp(baseLikelihood + comparableBonus, 5, 95)
 */
export function predictOutcome(
  compositeScore: number,
  outcomes: ComparableOutcome[],
  variableContributions: Record<string, { contribution: number; dimension: string }>,
  options: {
    typology?: string;
    tier?: string;
    geography?: string;
    targetYield?: string;
    salesStrategy?: string;
  } = {}
): OutcomePrediction {
  const typology = options.typology || "Residential";
  const tier = options.tier || "Mid";

  const comparables = filterComparables(
    outcomes,
    typology,
    tier,
    options.geography,
    options.targetYield,
    options.salesStrategy,
    (options as any).handoverCondition,
    (options as any).brandedStatus,
    (options as any).salesChannel,
    (options as any).lifecycleFocus,
    (options as any).brandStandardConstraints,
    (options as any).timelineFlexibility,
    (options as any).targetValueAdd
  );

  // Extract risk and success factors from variable contributions
  const contributions: VariableContribution[] = Object.entries(variableContributions).map(([variable, data]) => ({
    variable,
    contribution: data.contribution,
    dimension: data.dimension,
  }));

  const keyRiskFactors = contributions
    .filter(c => c.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 5);

  const keySuccessFactors = contributions
    .filter(c => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);

  // Insufficient data check
  if (comparables.length === 0 && Object.keys(variableContributions).length === 0) {
    return {
      successLikelihood: 0,
      confidenceLevel: "insufficient",
      comparableCount: 0,
      validatedRate: 0,
      conditionalRate: 0,
      notValidatedRate: 0,
      keyRiskFactors,
      keySuccessFactors,
      predictionBasis: "insufficient_data",
    };
  }

  // Compute rates from comparables
  const validatedCount = comparables.filter(o => o.decisionStatus === "validated").length;
  const conditionalCount = comparables.filter(o => o.decisionStatus === "conditional").length;
  const notValidatedCount = comparables.filter(o => o.decisionStatus === "not_validated").length;
  const total = comparables.length || 1;

  const validatedRate = (validatedCount / total) * 100;
  const conditionalRate = (conditionalCount / total) * 100;
  const notValidatedRate = (notValidatedCount / total) * 100;

  // Deterministic formula
  const baseLikelihood = (compositeScore / 100) * 60 + 20;
  const comparableBonus = comparables.length >= 3 ? (validatedRate - 50) * 0.2 : 0;
  const successLikelihood = Math.max(5, Math.min(95, Math.round((baseLikelihood + comparableBonus) * 10) / 10));

  // Confidence level
  let confidenceLevel: OutcomePrediction["confidenceLevel"];
  if (comparables.length >= 10 && Object.keys(variableContributions).length >= 10) {
    confidenceLevel = "high";
  } else if (comparables.length >= 5 || Object.keys(variableContributions).length >= 5) {
    confidenceLevel = "medium";
  } else if (comparables.length >= 1 || Object.keys(variableContributions).length >= 1) {
    confidenceLevel = "low";
  } else {
    confidenceLevel = "insufficient";
  }

  const predictionBasis = comparables.length >= 3
    ? `Based on ${comparables.length} comparable projects and ${Object.keys(variableContributions).length} variable contributions`
    : `Based primarily on composite score (${compositeScore.toFixed(1)}) with limited comparable data`;

  return {
    successLikelihood,
    confidenceLevel,
    comparableCount: comparables.length,
    validatedRate: Math.round(validatedRate * 10) / 10,
    conditionalRate: Math.round(conditionalRate * 10) / 10,
    notValidatedRate: Math.round(notValidatedRate * 10) / 10,
    keyRiskFactors,
    keySuccessFactors,
    predictionBasis,
  };
}
