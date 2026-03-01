/**
 * MIYAR Scoring Engine
 * Core deterministic multi-criteria scoring across 5 dimensions.
 * All computations are pure functions: identical inputs → identical outputs.
 */
import type {
  ProjectInputs,
  NormalizedInputs,
  DimensionScores,
  DimensionWeights,
  Penalty,
  ConditionalAction,
  ScoreResult,
  DecisionStatus,
} from "../../shared/miyar-types";
import { normalizeInputs } from "./normalization";
import { getPricingArea } from "./area-utils";

// ─── Dimension Scoring ───────────────────────────────────────────────────────

export function computeStrategicAlignment(
  n: NormalizedInputs,
  w: Record<string, number>
): number {
  let raw =
    (w.str01 ?? 0.35) * n.str01_n +
    (w.str03 ?? 0.25) * n.str03_n +
    (w.compatVisionMarket ?? 0.25) * n.compatVisionMarket +
    (w.compatVisionDesign ?? 0.15) * n.compatVisionDesign;

  if (n.brandedPremiumMultiplier) raw *= n.brandedPremiumMultiplier;
  if (n.targetValueMultiplier) raw *= n.targetValueMultiplier;

  return Math.max(0, Math.min(100, raw * 100));
}

export function computeFinancialFeasibility(
  n: NormalizedInputs,
  w: Record<string, number>
): number {
  let raw =
    (w.budgetFit ?? 0.45) * n.budgetFit +
    (w.fin02 ?? 0.20) * n.fin02_n +
    (w.executionResilience ?? 0.20) * n.executionResilience +
    (w.costStability ?? 0.15) * (1 - n.costVolatility);

  if (n.salesVelocityMultiplier) raw *= n.salesVelocityMultiplier;
  // Strict brand standards severely reduce financial flexibility and crush FF score
  if (n.brandStandardMultiplier) raw *= (1 / n.brandStandardMultiplier);
  // High Capex for Long-term Opex retention reduces immediate Financial Feasibility score
  if (n.lifecycleOpexMultiplier) raw *= (1 / n.lifecycleOpexMultiplier);

  return Math.max(0, Math.min(100, raw * 100));
}

export function computeMarketPositioning(
  n: NormalizedInputs,
  w: Record<string, number>
): number {
  let raw =
    (w.marketFit ?? 0.35) * n.marketFit +
    (w.differentiationPressure ?? 0.25) * n.differentiationPressure +
    (w.des04 ?? 0.20) * n.des04_n +
    (w.trendFit ?? 0.20) * n.trendFit;

  if (n.brandedPremiumMultiplier) raw *= n.brandedPremiumMultiplier;

  return Math.max(0, Math.min(100, raw * 100));
}

export function computeDifferentiationStrength(
  n: NormalizedInputs,
  w: Record<string, number>
): number {
  const raw =
    (w.str02 ?? 0.20) * n.str02_n +
    (w.competitorInverse ?? 0.20) * (1 - n.mkt02_n) +
    (w.des04 ?? 0.15) * n.des04_n +
    (w.des02 ?? 0.15) * n.des02_n +
    (w.des05 ?? 0.15) * n.des05_n +
    (w.spaceEfficiency ?? 0.15) * n.spaceEfficiency_n; // Phase 9
  return Math.max(0, Math.min(100, raw * 100));
}

export function computeExecutionRisk(
  n: NormalizedInputs,
  w: Record<string, number>
): number {
  // Higher sustainability cert tiers increase procurement complexity
  const certRisk = n.sustainCertMultiplier > 1.10 ? (n.sustainCertMultiplier - 1.0) * 2 : 0;
  let raw =
    (w.executionResilience ?? 0.30) * n.executionResilience +
    (w.supplyChainInverse ?? 0.25) * (1 - n.exe01_n) +
    (w.complexityInverse ?? 0.20) * (1 - n.des03_n) +
    (w.approvalsInverse ?? 0.15) * (1 - n.exe03_n) +
    (w.certRisk ?? 0.10) * certRisk;

  // Apply V5 strategy risk modifiers (higher raw is better ER score)
  if (n.procurementRiskMultiplier) raw *= n.procurementRiskMultiplier;
  if (n.materialSourcingRiskMultiplier) raw *= n.materialSourcingRiskMultiplier;
  // Handover condition: high value (like 1.15) implies high risk, so it reduces the ER score
  if (n.handoverRiskMultiplier) raw *= (1 / n.handoverRiskMultiplier);
  // Timeline zero-tolerance radically inflates execution risk (reduces ER Score)
  if (n.timelineRiskMultiplier) raw *= (1 / n.timelineRiskMultiplier);

  return Math.max(0, Math.min(100, raw * 100));
}

// ─── Penalty System ──────────────────────────────────────────────────────────

export function computePenalties(
  inputs: ProjectInputs,
  n: NormalizedInputs,
  penaltyConfig: Record<string, any>
): { penalties: Penalty[]; riskFlags: string[] } {
  const penalties: Penalty[] = [];
  const riskFlags: string[] = [];

  // P1: Missing non-required > 30%
  const optionalFields = [
    inputs.mkt03Trend,
    inputs.fin03ShockTolerance,
    inputs.fin04SalesPremium,
    inputs.des04Experience,
    inputs.des05Sustainability,
    inputs.exe01SupplyChain,
    inputs.exe03Approvals,
    inputs.exe04QaMaturity,
  ];
  const missingCount = optionalFields.filter(
    (v) => v === null || v === undefined
  ).length;
  if (missingCount / optionalFields.length > 0.3) {
    penalties.push({
      id: "P1",
      trigger: "missing_non_required_gt_30pct",
      effect: penaltyConfig?.P1?.effect ?? -5,
      description: "Missing non-required inputs > 30%",
    });
  }

  // P2: Critical enum → 'Other'
  if (inputs.des01Style === "Other") {
    const effect = penaltyConfig?.P2?.effectEach ?? -3;
    penalties.push({
      id: "P2",
      trigger: "critical_enum_other",
      effect,
      description: "Design style set to 'Other'",
    });
  }

  // P3: budget_fit < 0.4
  if (n.budgetFit < 0.4) {
    penalties.push({
      id: "P3",
      trigger: "budget_fit_lt_0.4",
      effect: penaltyConfig?.P3?.effect ?? -10,
      flag: "FIN_SEVERE",
      description: "Budget fit below 0.4",
    });
    riskFlags.push("FIN_SEVERE");
  }

  // P4: ExecutionResilience < 0.35
  if (n.executionResilience < 0.35) {
    penalties.push({
      id: "P4",
      trigger: "execution_resilience_lt_0.35",
      effect: penaltyConfig?.P4?.effect ?? -8,
      flag: "EXE_FRAGILE",
      description: "Execution resilience below 0.35",
    });
    riskFlags.push("EXE_FRAGILE");
  }

  // P5: DES_03_n > 0.8 AND contractor < 0.5
  if (n.des03_n > 0.8 && n.exe02_n < 0.5) {
    penalties.push({
      id: "P5",
      trigger: "complexity_contractor_mismatch",
      effect: penaltyConfig?.P5?.effect ?? -12,
      flag: "COMPLEXITY_MISMATCH",
      description: "High complexity with low contractor capability",
    });
    riskFlags.push("COMPLEXITY_MISMATCH");
  }

  // P6: Sustainability budget underfunded — budget cap too low for cert tier
  if (n.sustainCertMultiplier > 1.05 && n.budgetFit < 0.5) {
    penalties.push({
      id: "P6",
      trigger: "sustain_underfunded",
      effect: penaltyConfig?.P6?.effect ?? -6,
      flag: "SUSTAIN_UNDERFUNDED",
      description: `Budget may not cover ${Math.round((n.sustainCertMultiplier - 1) * 100)}% sustainability certification premium`,
    });
    riskFlags.push("SUSTAIN_UNDERFUNDED");
  }

  // Phase 8: P7 - Live Vendor Board exceeds Budget Cap strictly
  if (inputs.boardMaterialsCost && inputs.fin01BudgetCap) {
    const area = inputs.totalFitoutArea || inputs.ctx03Gfa || 1;
    const totalBudgetCap = inputs.fin01BudgetCap * area;
    if (inputs.boardMaterialsCost > totalBudgetCap * 1.1) {
      penalties.push({
        id: "P7",
        trigger: "board_budget_breach",
        effect: -15, // Severe penalty: the actual physical items selected cost more than the cap
        flag: "BOARD_BUDGET_BREACH",
        description: "Live material board costs exceed project budget cap by >10%",
      });
      riskFlags.push("BOARD_BUDGET_BREACH");
    }
  }

  // Phase 9: P8 - Critical space allocation deviations from floor plan analysis
  if (inputs.spaceCriticalCount && inputs.spaceCriticalCount >= 2) {
    penalties.push({
      id: "P8",
      trigger: "space_critical_deviations",
      effect: penaltyConfig?.P8?.effect ?? -7,
      flag: "SPACE_CRITICAL",
      description: `Floor plan has ${inputs.spaceCriticalCount} critical room ratio deviations vs DLD benchmarks`,
    });
    riskFlags.push("SPACE_CRITICAL");
  }

  return { penalties, riskFlags };
}

// ─── Conditional Actions ─────────────────────────────────────────────────────

export function generateConditionalActions(
  dimensions: DimensionScores,
  riskFlags: string[]
): ConditionalAction[] {
  const actions: ConditionalAction[] = [];

  if (riskFlags.includes("FIN_SEVERE")) {
    actions.push({
      trigger: "FIN_SEVERE",
      recommendation:
        "Adjust specification level or budget range. Consider 2 alternative material tiers.",
      variables: ["fin01BudgetCap", "des02MaterialLevel"],
    });
  }
  if (riskFlags.includes("EXE_FRAGILE")) {
    actions.push({
      trigger: "EXE_FRAGILE",
      recommendation:
        "Simplify design complexity or upgrade contractor plan.",
      variables: ["des03Complexity", "exe02Contractor"],
    });
  }
  if (riskFlags.includes("COMPLEXITY_MISMATCH")) {
    actions.push({
      trigger: "COMPLEXITY_MISMATCH",
      recommendation:
        "Reduce custom joinery; modularize; phase high-complexity elements.",
      variables: ["des03Complexity", "exe02Contractor"],
    });
  }
  if (dimensions.sa < 60) {
    actions.push({
      trigger: "LOW_SA",
      recommendation:
        "Clarify target user profile and brand narrative.",
      variables: ["str01BrandClarity", "str03BuyerMaturity"],
    });
  }
  if (dimensions.mp < 60) {
    actions.push({
      trigger: "LOW_MP",
      recommendation:
        "Reposition experience intensity; adjust differentiation strategy.",
      variables: ["mkt02Competitor", "des04Experience"],
    });
  }
  if (riskFlags.includes("SUSTAIN_UNDERFUNDED")) {
    actions.push({
      trigger: "SUSTAIN_UNDERFUNDED",
      recommendation:
        "Increase budget cap to account for sustainability certification material premium, or lower certification target tier.",
      variables: ["fin01BudgetCap", "sustainCertTarget"],
    });
  }

  // Phase 8
  if (riskFlags.includes("BOARD_BUDGET_BREACH")) {
    actions.push({
      trigger: "BOARD_BUDGET_BREACH",
      recommendation:
        "The current material board exceeds the maximum budget. Swap premium vendor items for approved market equivalents or increase Budget Cap.",
      variables: ["fin01BudgetCap", "brandStandardConstraints"],
    });
  }
  // Phase 9: Space Efficiency
  if (riskFlags.includes("SPACE_CRITICAL")) {
    actions.push({
      trigger: "SPACE_CRITICAL",
      recommendation:
        "Floor plan has critical space allocation deviations. Review room ratios in Space Planner — undersized rooms correlate with lower sale prices per DLD data.",
      variables: ["spaceEfficiencyScore"],
    });
  }

  return actions;
}

// ─── Composite Score ─────────────────────────────────────────────────────────

export function computeComposite(
  dimensions: DimensionScores,
  weights: DimensionWeights,
  penalties: Penalty[]
): number {
  const totalPenalty = penalties.reduce((sum, p) => sum + p.effect, 0);
  const raw =
    weights.sa * dimensions.sa +
    weights.ff * dimensions.ff +
    weights.mp * dimensions.mp +
    weights.ds * dimensions.ds +
    weights.er * dimensions.er;
  return Math.max(0, Math.min(100, raw + totalPenalty));
}

// ─── Risk Score ──────────────────────────────────────────────────────────────

export function computeRiskScore(dimensions: DimensionScores, n: NormalizedInputs): number {
  const risk =
    100 -
    (0.35 * dimensions.er +
      0.25 * dimensions.ff +
      0.20 * n.budgetFit * 100 +
      0.20 * n.executionResilience * 100);
  return Math.max(0, Math.min(100, risk));
}

// ─── Decision Classification ─────────────────────────────────────────────────

export function classifyDecision(
  compositeScore: number,
  riskScore: number
): DecisionStatus {
  if (compositeScore >= 75 && riskScore <= 45) return "validated";
  if (compositeScore < 60 || riskScore >= 60) return "not_validated";
  return "conditional";
}

// ─── Confidence Score ────────────────────────────────────────────────────────

export function computeConfidence(
  inputs: ProjectInputs,
  benchmarkCount: number,
  overrideRate: number
): number {
  // Input completeness
  const allFields = Object.values(inputs);
  const provided = allFields.filter(
    (v) => v !== null && v !== undefined
  ).length;
  const inputCompleteness = provided / allFields.length;

  // Benchmark density
  const minRequired = 3;
  const benchmarkDensity = Math.min(1, benchmarkCount / minRequired);

  // Model stability (placeholder: assume stable in v1)
  const modelStability = 0.95;

  // Override rate
  const overrideFactor = Math.max(0, 1 - overrideRate);

  const confidence =
    0.30 * inputCompleteness +
    0.25 * benchmarkDensity +
    0.25 * modelStability +
    0.20 * overrideFactor;

  return Math.max(0, Math.min(100, confidence * 100));
}

// ─── Variable Contributions ──────────────────────────────────────────────────

export function computeVariableContributions(
  n: NormalizedInputs,
  varWeights: Record<string, Record<string, number>>
): Record<string, Record<string, number>> {
  return {
    sa: {
      str01_n: n.str01_n * (varWeights.sa?.str01 ?? 0.35),
      str03_n: n.str03_n * (varWeights.sa?.str03 ?? 0.25),
      compatVisionMarket:
        n.compatVisionMarket * (varWeights.sa?.compatVisionMarket ?? 0.25),
      compatVisionDesign:
        n.compatVisionDesign * (varWeights.sa?.compatVisionDesign ?? 0.15),
    },
    ff: {
      budgetFit: n.budgetFit * (varWeights.ff?.budgetFit ?? 0.45),
      fin02_n: n.fin02_n * (varWeights.ff?.fin02 ?? 0.20),
      executionResilience:
        n.executionResilience * (varWeights.ff?.executionResilience ?? 0.20),
      costStability:
        (1 - n.costVolatility) * (varWeights.ff?.costStability ?? 0.15),
    },
    mp: {
      marketFit: n.marketFit * (varWeights.mp?.marketFit ?? 0.35),
      differentiationPressure:
        n.differentiationPressure *
        (varWeights.mp?.differentiationPressure ?? 0.25),
      des04_n: n.des04_n * (varWeights.mp?.des04 ?? 0.20),
      trendFit: n.trendFit * (varWeights.mp?.trendFit ?? 0.20),
    },
    ds: {
      str02_n: n.str02_n * (varWeights.ds?.str02 ?? 0.25),
      competitorInverse:
        (1 - n.mkt02_n) * (varWeights.ds?.competitorInverse ?? 0.20),
      des04_n: n.des04_n * (varWeights.ds?.des04 ?? 0.20),
      des02_n: n.des02_n * (varWeights.ds?.des02 ?? 0.15),
      des05_n: n.des05_n * (varWeights.ds?.des05 ?? 0.15),
      spaceEfficiency: n.spaceEfficiency_n * (varWeights.ds?.spaceEfficiency ?? 0.15), // Phase 9
    },
    er: {
      executionResilience:
        n.executionResilience * (varWeights.er?.executionResilience ?? 0.30),
      supplyChainInverse:
        (1 - n.exe01_n) * (varWeights.er?.supplyChainInverse ?? 0.25),
      complexityInverse:
        (1 - n.des03_n) * (varWeights.er?.complexityInverse ?? 0.20),
      approvalsInverse:
        (1 - n.exe03_n) * (varWeights.er?.approvalsInverse ?? 0.15),
      certRisk:
        (n.sustainCertMultiplier > 1.10 ? (n.sustainCertMultiplier - 1.0) * 2 : 0) * (varWeights.er?.certRisk ?? 0.10),
    },
  };
}

// ─── ROI Estimation ──────────────────────────────────────────────────────────

export function computeROI(
  inputs: ProjectInputs,
  compositeScore: number,
  fee: number
): {
  reworkAvoided: number;
  procurementSavings: number;
  timeValueGain: number;
  specEfficiency: number;
  positioningPremium: number;
  totalValue: number;
  fee: number;
  netROI: number;
  roiMultiple: number;
} {
  // V4: Use fitout area for pricing calculations (falls back to GFA)
  const pricingArea = getPricingArea(inputs);
  const budgetCap = inputs.fin01BudgetCap ?? 400;
  const totalBudget = pricingArea * budgetCap;

  // Rework avoided: 8-15% of total budget, scaled by score
  const reworkRate = 0.08 + (compositeScore / 100) * 0.07;
  const reworkAvoided = totalBudget * reworkRate;

  // Procurement savings: 3-8% of total budget
  const procRate = 0.03 + (compositeScore / 100) * 0.05;
  const procurementSavings = totalBudget * procRate;

  // Time value gain: 2-5% of total budget
  const timeRate = 0.02 + (compositeScore / 100) * 0.03;
  const timeValueGain = totalBudget * timeRate;

  // Spec efficiency: 1-3% of total budget
  const specRate = 0.01 + (compositeScore / 100) * 0.02;
  const specEfficiency = totalBudget * specRate;

  // Positioning premium: 0-5% of total budget
  const posRate = (compositeScore / 100) * 0.05;
  const positioningPremium = totalBudget * posRate;

  const totalValue =
    reworkAvoided +
    procurementSavings +
    timeValueGain +
    specEfficiency +
    positioningPremium;
  const netROI = fee > 0 ? (totalValue - fee) / fee : 0;
  const roiMultiple = fee > 0 ? totalValue / fee : 0;

  return {
    reworkAvoided: Math.round(reworkAvoided),
    procurementSavings: Math.round(procurementSavings),
    timeValueGain: Math.round(timeValueGain),
    specEfficiency: Math.round(specEfficiency),
    positioningPremium: Math.round(positioningPremium),
    totalValue: Math.round(totalValue),
    fee,
    netROI: Math.round(netROI * 100) / 100,
    roiMultiple: Math.round(roiMultiple * 100) / 100,
  };
}

// ─── Full Evaluation Pipeline ────────────────────────────────────────────────

export interface EvaluationConfig {
  dimensionWeights: DimensionWeights;
  variableWeights: Record<string, Record<string, number>>;
  penaltyConfig: Record<string, any>;
  expectedCost: number;
  benchmarkCount: number;
  overrideRate: number;
}

export function evaluate(
  inputs: ProjectInputs,
  config: EvaluationConfig
): ScoreResult {
  // Step 1: Normalize
  const n = normalizeInputs(inputs, config.expectedCost);

  // Step 2: Compute dimension scores
  const dimensions: DimensionScores = {
    sa: computeStrategicAlignment(n, config.variableWeights.sa ?? {}),
    ff: computeFinancialFeasibility(n, config.variableWeights.ff ?? {}),
    mp: computeMarketPositioning(n, config.variableWeights.mp ?? {}),
    ds: computeDifferentiationStrength(n, config.variableWeights.ds ?? {}),
    er: computeExecutionRisk(n, config.variableWeights.er ?? {}),
  };

  // Step 3: Compute penalties
  const { penalties, riskFlags } = computePenalties(
    inputs,
    n,
    config.penaltyConfig
  );

  // Step 4: Composite score
  const compositeScore = computeComposite(
    dimensions,
    config.dimensionWeights,
    penalties
  );

  // Step 5: Risk score
  const riskScore = computeRiskScore(dimensions, n);

  // Step 6: RAS
  const rasScore = Math.max(0, compositeScore - 0.35 * riskScore);

  // Step 7: Confidence
  const confidenceScore = computeConfidence(
    inputs,
    config.benchmarkCount,
    config.overrideRate
  );

  // Step 8: Decision
  const decisionStatus = classifyDecision(compositeScore, riskScore);

  // Step 9: Conditional actions
  const conditionalActions = generateConditionalActions(dimensions, riskFlags);

  // Step 10: Variable contributions
  const variableContributions = computeVariableContributions(
    n,
    config.variableWeights
  );

  return {
    dimensions,
    dimensionWeights: config.dimensionWeights,
    compositeScore: Math.round(compositeScore * 100) / 100,
    riskScore: Math.round(riskScore * 100) / 100,
    rasScore: Math.round(rasScore * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    decisionStatus,
    penalties,
    riskFlags,
    conditionalActions,
    variableContributions,
    inputSnapshot: inputs,
  };
}
