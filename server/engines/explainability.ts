/**
 * Explainability Engine (V2.12)
 * Per-output drivers: why each score, why each material, why each risk flag.
 * Produces structured evidence traces for audit packs.
 */

export interface ScoreDriver {
  variable: string;
  label: string;
  value: number | string;
  weight: number;
  contribution: number; // weighted contribution to dimension
  direction: "positive" | "negative" | "neutral";
  explanation: string;
}

export interface DimensionExplainability {
  dimension: string;
  label: string;
  score: number;
  weight: number;
  drivers: ScoreDriver[];
  topPositive: string;
  topNegative: string;
  summary: string;
}

export interface MaterialExplainability {
  materialName: string;
  reason: string;
  tierMatch: boolean;
  costBandMatch: boolean;
  availabilityMatch: boolean;
  riskFactors: string[];
}

export interface ExplainabilityReport {
  projectId: number;
  compositeScore: number;
  decisionStatus: string;
  dimensions: DimensionExplainability[];
  topDrivers: ScoreDriver[];
  topRisks: ScoreDriver[];
  materialExplanations: MaterialExplainability[];
  decisionRationale: string;
  confidenceExplanation: string;
  benchmarkVersionUsed: string;
  logicVersionUsed: string;
  generatedAt: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  sa: "Strategic Alignment",
  ff: "Financial Feasibility",
  mp: "Market Positioning",
  ds: "Design & Specification",
  er: "Execution Readiness",
};

const VARIABLE_LABELS: Record<string, string> = {
  str01BrandClarity: "Brand Clarity",
  str02Differentiation: "Differentiation Strategy",
  str03BuyerMaturity: "Buyer Maturity Understanding",
  fin01BudgetCap: "Budget Cap",
  fin02Flexibility: "Budget Flexibility",
  fin03ShockTolerance: "Shock Tolerance",
  fin04SalesPremium: "Sales Premium Potential",
  mkt01Tier: "Market Tier",
  mkt02Competitor: "Competitive Awareness",
  mkt03Trend: "Trend Alignment",
  des01Style: "Design Style",
  des02MaterialLevel: "Material Level",
  des03Complexity: "Design Complexity",
  des04Experience: "Experience Ambition",
  des05Sustainability: "Sustainability Commitment",
  exe01SupplyChain: "Supply Chain Readiness",
  exe02Contractor: "Contractor Capability",
  exe03Approvals: "Approval Complexity",
  exe04QaMaturity: "QA Maturity",
};

export function generateExplainabilityReport(
  projectId: number,
  inputSnapshot: Record<string, unknown>,
  scoreData: {
    saScore: number;
    ffScore: number;
    mpScore: number;
    dsScore: number;
    erScore: number;
    compositeScore: number;
    riskScore: number;
    confidenceScore: number;
    decisionStatus: string;
    dimensionWeights: Record<string, number>;
    variableContributions: Record<string, number>;
    penalties: Array<{ rule: string; points: number; reason: string }>;
    riskFlags: Array<{ flag: string; severity: string; detail: string }>;
  },
  benchmarkVersionTag: string,
  logicVersionName: string
): ExplainabilityReport {
  const dimScores: Record<string, number> = {
    sa: scoreData.saScore,
    ff: scoreData.ffScore,
    mp: scoreData.mpScore,
    ds: scoreData.dsScore,
    er: scoreData.erScore,
  };

  // Build per-dimension explainability
  const dimensionVarMap: Record<string, string[]> = {
    sa: ["str01BrandClarity", "str02Differentiation", "str03BuyerMaturity"],
    ff: ["fin01BudgetCap", "fin02Flexibility", "fin03ShockTolerance", "fin04SalesPremium"],
    mp: ["mkt01Tier", "mkt02Competitor", "mkt03Trend"],
    ds: ["des01Style", "des02MaterialLevel", "des03Complexity", "des04Experience", "des05Sustainability"],
    er: ["exe01SupplyChain", "exe02Contractor", "exe03Approvals", "exe04QaMaturity"],
  };

  const allDrivers: ScoreDriver[] = [];

  const dimensions: DimensionExplainability[] = Object.entries(dimScores).map(([dim, score]) => {
    const weight = scoreData.dimensionWeights[dim] ?? 0.2;
    const vars = dimensionVarMap[dim] ?? [];
    const drivers: ScoreDriver[] = vars.map((v) => {
      const rawVal = inputSnapshot[v];
      const numVal = typeof rawVal === "number" ? rawVal : (typeof rawVal === "string" ? parseFloat(rawVal) || 3 : 3);
      const contribution = scoreData.variableContributions[v] ?? 0;
      const direction: "positive" | "negative" | "neutral" =
        numVal >= 4 ? "positive" : numVal <= 2 ? "negative" : "neutral";
      const explanation = buildVariableExplanation(v, numVal, direction);
      const driver: ScoreDriver = {
        variable: v,
        label: VARIABLE_LABELS[v] ?? v,
        value: rawVal as number | string,
        weight,
        contribution,
        direction,
        explanation,
      };
      allDrivers.push(driver);
      return driver;
    });

    const positiveDrivers = drivers.filter((d) => d.direction === "positive");
    const negativeDrivers = drivers.filter((d) => d.direction === "negative");

    return {
      dimension: dim,
      label: DIMENSION_LABELS[dim] ?? dim,
      score,
      weight,
      drivers,
      topPositive: positiveDrivers.length > 0 ? positiveDrivers[0].label : "None identified",
      topNegative: negativeDrivers.length > 0 ? negativeDrivers[0].label : "None identified",
      summary: buildDimensionSummary(dim, score, positiveDrivers, negativeDrivers),
    };
  });

  // Sort all drivers by contribution
  const sortedPositive = allDrivers
    .filter((d) => d.direction === "positive")
    .sort((a, b) => b.contribution - a.contribution);
  const sortedNegative = allDrivers
    .filter((d) => d.direction === "negative")
    .sort((a, b) => a.contribution - b.contribution);

  // Decision rationale
  const decisionRationale = buildDecisionRationale(
    scoreData.compositeScore,
    scoreData.decisionStatus,
    scoreData.penalties,
    sortedPositive.slice(0, 3),
    sortedNegative.slice(0, 3)
  );

  // Confidence explanation
  const confidenceExplanation = buildConfidenceExplanation(
    scoreData.confidenceScore,
    inputSnapshot
  );

  return {
    projectId,
    compositeScore: scoreData.compositeScore,
    decisionStatus: scoreData.decisionStatus,
    dimensions,
    topDrivers: sortedPositive.slice(0, 5),
    topRisks: sortedNegative.slice(0, 5),
    materialExplanations: [], // populated externally if materials are selected
    decisionRationale,
    confidenceExplanation,
    benchmarkVersionUsed: benchmarkVersionTag,
    logicVersionUsed: logicVersionName,
    generatedAt: new Date().toISOString(),
  };
}

function buildVariableExplanation(variable: string, value: number, direction: string): string {
  const label = VARIABLE_LABELS[variable] ?? variable;
  if (direction === "positive") {
    return `${label} scored ${value}/5, indicating strong positioning in this area. This contributes positively to the overall evaluation.`;
  } else if (direction === "negative") {
    return `${label} scored ${value}/5, indicating a gap that may require attention. This creates downward pressure on the dimension score.`;
  }
  return `${label} scored ${value}/5, representing a neutral baseline position.`;
}

function buildDimensionSummary(
  dim: string,
  score: number,
  positive: ScoreDriver[],
  negative: ScoreDriver[]
): string {
  const label = DIMENSION_LABELS[dim] ?? dim;
  const level = score >= 75 ? "strong" : score >= 55 ? "moderate" : "weak";
  let summary = `${label} shows ${level} performance at ${score.toFixed(1)}/100.`;
  if (positive.length > 0) {
    summary += ` Key strengths: ${positive.map((d) => d.label).join(", ")}.`;
  }
  if (negative.length > 0) {
    summary += ` Areas for improvement: ${negative.map((d) => d.label).join(", ")}.`;
  }
  return summary;
}

function buildDecisionRationale(
  composite: number,
  status: string,
  penalties: Array<{ rule: string; points: number; reason: string }>,
  topPositive: ScoreDriver[],
  topNegative: ScoreDriver[]
): string {
  let rationale = `The project achieved a composite score of ${composite.toFixed(1)}/100, resulting in a "${status}" decision. `;

  if (topPositive.length > 0) {
    rationale += `Primary strengths driving the score include ${topPositive.map((d) => d.label).join(", ")}. `;
  }

  if (topNegative.length > 0) {
    rationale += `Key areas requiring attention: ${topNegative.map((d) => d.label).join(", ")}. `;
  }

  if (penalties.length > 0) {
    const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0);
    rationale += `${penalties.length} penalty rule(s) applied, reducing the score by ${totalPenalty.toFixed(1)} points. `;
    rationale += `Penalty details: ${penalties.map((p) => `${p.reason} (-${p.points}pts)`).join("; ")}.`;
  }

  return rationale;
}

function buildConfidenceExplanation(confidenceScore: number, inputs: Record<string, unknown>): string {
  const filledCount = Object.values(inputs).filter((v) => v !== null && v !== undefined && v !== "").length;
  const totalVars = Object.keys(inputs).length;
  const completeness = totalVars > 0 ? (filledCount / totalVars) * 100 : 0;

  let explanation = `Confidence score: ${confidenceScore.toFixed(1)}/100. `;
  explanation += `Input completeness: ${completeness.toFixed(0)}% (${filledCount}/${totalVars} variables provided). `;

  if (confidenceScore >= 75) {
    explanation += "High confidence — sufficient data points and benchmark coverage for reliable evaluation.";
  } else if (confidenceScore >= 50) {
    explanation += "Moderate confidence — some data gaps or limited benchmark coverage may affect precision.";
  } else {
    explanation += "Low confidence — significant data gaps or missing benchmarks. Results should be treated as directional only.";
  }

  return explanation;
}

/**
 * Generate material explainability for a board
 */
export function explainMaterialSelection(
  materials: Array<{
    name: string;
    tier: string;
    category: string;
    typicalCostLow?: number;
    typicalCostHigh?: number;
    leadTimeDays?: number;
  }>,
  projectTier: string,
  budgetCap: number | null
): MaterialExplainability[] {
  const tierRank: Record<string, number> = {
    economy: 1,
    mid: 2,
    premium: 3,
    luxury: 4,
    ultra_luxury: 5,
  };

  const projectTierRank = tierRank[projectTier.toLowerCase().replace("-", "_")] ?? 3;

  return materials.map((m) => {
    const matTierRank = tierRank[m.tier] ?? 3;
    const tierMatch = Math.abs(matTierRank - projectTierRank) <= 1;
    const costBandMatch = budgetCap
      ? (m.typicalCostHigh ?? 0) <= budgetCap * 1.15
      : true;
    const availabilityMatch = true; // simplified — would check regionAvailability
    const riskFactors: string[] = [];

    if (!tierMatch) riskFactors.push(`Tier mismatch: material is ${m.tier}, project targets ${projectTier}`);
    if (!costBandMatch) riskFactors.push("Cost exceeds budget cap by >15%");
    if (m.leadTimeDays && m.leadTimeDays > 120) riskFactors.push(`Long lead time: ${m.leadTimeDays} days`);

    const reason = tierMatch && costBandMatch
      ? `${m.name} aligns with ${projectTier} tier positioning and falls within budget parameters.`
      : `${m.name} selected but has ${riskFactors.length} risk factor(s) requiring review.`;

    return {
      materialName: m.name,
      reason,
      tierMatch,
      costBandMatch,
      availabilityMatch,
      riskFactors,
    };
  });
}

/**
 * Build a full audit pack JSON for export
 */
export function buildAuditPack(
  explainability: ExplainabilityReport,
  inputSnapshot: Record<string, unknown>,
  benchmarkSnapshot: unknown,
  logicSnapshot: {
    weights: Array<{ dimension: string; weight: string }>;
    thresholds: Array<{ ruleKey: string; thresholdValue: string; comparator: string }>;
  },
  scenarioComparisons: unknown[],
  materialExplanations: MaterialExplainability[]
): Record<string, unknown> {
  return {
    version: "2.12",
    generatedAt: new Date().toISOString(),
    projectId: explainability.projectId,
    decision: {
      compositeScore: explainability.compositeScore,
      status: explainability.decisionStatus,
      rationale: explainability.decisionRationale,
      confidenceExplanation: explainability.confidenceExplanation,
    },
    explainability: {
      dimensions: explainability.dimensions,
      topDrivers: explainability.topDrivers,
      topRisks: explainability.topRisks,
    },
    inputs: inputSnapshot,
    benchmarkSnapshot,
    logicSnapshot,
    scenarioComparisons,
    materialExplanations,
    traceability: {
      benchmarkVersion: explainability.benchmarkVersionUsed,
      logicVersion: explainability.logicVersionUsed,
      engineVersion: "MIYAR v2.12",
    },
  };
}
