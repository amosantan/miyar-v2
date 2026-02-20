/**
 * Explainability Engine (V2.12 — fixed V1.5)
 * Per-output drivers: why each score, why each material, why each risk flag.
 * Produces structured evidence traces for audit packs.
 *
 * V1.5 fixes:
 * - variableContributions is nested Record<dim, Record<varKey, number>>;
 *   we now map raw input variable names → contribution keys per dimension.
 * - String enum variables (mkt01Tier, des01Style) are handled correctly
 *   instead of being force-parsed as numbers.
 * - driver.value is guaranteed to never be undefined.
 */

export interface ScoreDriver {
  variable: string;
  label: string;
  rawValue: number | string;       // actual raw input value (never undefined)
  normalizedValue: number | null;   // 0-1 normalized form (null for non-ordinal)
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
  // Context (6 variables)
  ctx01Typology: "Project Typology",
  ctx02Scale: "Project Scale",
  ctx03Gfa: "Gross Floor Area (sqm)",
  ctx04Location: "Location Category",
  ctx05Horizon: "Delivery Horizon",
  // Strategy (3 variables)
  str01BrandClarity: "Brand Clarity",
  str02Differentiation: "Differentiation Strategy",
  str03BuyerMaturity: "Buyer Maturity Understanding",
  // Financial (4 variables)
  fin01BudgetCap: "Budget Cap (AED/sqm)",
  fin02Flexibility: "Budget Flexibility",
  fin03ShockTolerance: "Shock Tolerance",
  fin04SalesPremium: "Sales Premium Potential",
  // Market (3 variables)
  mkt01Tier: "Market Tier",
  mkt02Competitor: "Competitive Awareness",
  mkt03Trend: "Trend Alignment",
  // Design (5 variables)
  des01Style: "Design Style",
  des02MaterialLevel: "Material Level",
  des03Complexity: "Design Complexity",
  des04Experience: "Experience Ambition",
  des05Sustainability: "Sustainability Commitment",
  // Execution (4 variables)
  exe01SupplyChain: "Supply Chain Readiness",
  exe02Contractor: "Contractor Capability",
  exe03Approvals: "Approval Complexity",
  exe04QaMaturity: "QA Maturity",
  // Add-ons (3 variables)
  add01SampleKit: "Sample Kit Requested",
  add02PortfolioMode: "Portfolio Mode",
  add03DashboardExport: "Dashboard Export",
};

/**
 * Map from raw input variable name → the contribution key used in
 * computeVariableContributions() for each dimension.
 * Some raw variables map to derived composites (e.g. str01BrandClarity → str01_n).
 * Some variables contribute to multiple dimensions via different derived keys.
 */
const VARIABLE_TO_CONTRIBUTION_KEY: Record<string, Record<string, string>> = {
  sa: {
    str01BrandClarity: "str01_n",
    str02Differentiation: "compatVisionDesign",  // str02 feeds into compatVisionDesign
    str03BuyerMaturity: "str03_n",
  },
  ff: {
    fin01BudgetCap: "budgetFit",           // fin01 feeds into budgetFit composite
    fin02Flexibility: "fin02_n",
    fin03ShockTolerance: "costStability",   // fin03 feeds into costStability = (1 - costVolatility)
    fin04SalesPremium: "executionResilience", // closest proxy in ff dimension
  },
  mp: {
    mkt01Tier: "marketFit",                // mkt01 feeds into marketFit composite
    mkt02Competitor: "differentiationPressure",
    mkt03Trend: "trendFit",
  },
  ds: {
    des01Style: "str02_n",                 // style feeds through differentiation in ds
    des02MaterialLevel: "des02_n",
    des03Complexity: "des04_n",            // complexity is in ds via des04 weight
    des04Experience: "des04_n",
    des05Sustainability: "competitorInverse", // closest proxy
  },
  er: {
    exe01SupplyChain: "supplyChainInverse",
    exe02Contractor: "executionResilience",
    exe03Approvals: "approvalsInverse",
    exe04QaMaturity: "executionResilience",
  },
};

/** Variables that are string enums (not ordinal 1-5) */
const STRING_ENUM_VARS = new Set(["mkt01Tier", "des01Style", "ctx01Typology", "ctx02Scale", "ctx04Location", "ctx05Horizon"]);

/** Variables that are boolean flags */
const BOOLEAN_VARS = new Set(["add01SampleKit", "add02PortfolioMode", "add03DashboardExport"]);

/** Variables that are numeric but not ordinal 1-5 (raw display, no normalization) */
const RAW_NUMERIC_VARS = new Set(["fin01BudgetCap", "ctx03Gfa"]);

/** Display label mapping for string enum variables */
const ENUM_DISPLAY_LABELS: Record<string, Record<string, string>> = {
  mkt01Tier: {
    Mid: "Mid-Market",
    "Upper-mid": "Upper Mid-Market",
    Luxury: "Luxury",
    "Ultra-luxury": "Ultra-Luxury",
  },
  des01Style: {
    Modern: "Modern",
    Contemporary: "Contemporary",
    Minimal: "Minimal",
    Classic: "Classic",
    Fusion: "Fusion",
    Other: "Other",
  },
  ctx01Typology: {
    Residential: "Residential",
    "Mixed-use": "Mixed-Use",
    Hospitality: "Hospitality",
    Office: "Office",
  },
  ctx02Scale: {
    Small: "Small (<10,000 sqm)",
    Medium: "Medium (10,000–50,000 sqm)",
    Large: "Large (>50,000 sqm)",
  },
  ctx04Location: {
    Prime: "Prime Location",
    Secondary: "Secondary Location",
    Emerging: "Emerging Location",
  },
  ctx05Horizon: {
    "0-12m": "0–12 Months",
    "12-24m": "12–24 Months",
    "24-36m": "24–36 Months",
    "36m+": "36+ Months",
  },
};

/** Map string enum values to a quality/tier signal for direction assessment */
const ENUM_QUALITY_MAP: Record<string, Record<string, "positive" | "negative" | "neutral">> = {
  mkt01Tier: {
    "Ultra-luxury": "positive",
    Luxury: "positive",
    "Upper-mid": "neutral",
    Mid: "negative",
  },
  des01Style: {
    Modern: "neutral",
    Contemporary: "positive",
    Minimal: "neutral",
    Classic: "neutral",
    Fusion: "positive",
    Other: "negative",
  },
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
    variableContributions: Record<string, number | Record<string, number>>;
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

  // Flatten nested variableContributions for lookup
  // Structure: { sa: { str01_n: 0.35, ... }, ff: { budgetFit: 0.45, ... } }
  const flatContributions: Record<string, Record<string, number>> = {};
  for (const [dim, val] of Object.entries(scoreData.variableContributions)) {
    if (typeof val === "object" && val !== null) {
      flatContributions[dim] = val as Record<string, number>;
    }
  }

  // Build per-dimension explainability
  // All 25 ProjectInputs variables mapped to their primary scoring dimension.
  // Context variables (ctx*) are placed in the dimension they most influence.
  // Add-on booleans are placed in er (execution readiness).
  const dimensionVarMap: Record<string, string[]> = {
    sa: ["str01BrandClarity", "str02Differentiation", "str03BuyerMaturity", "ctx01Typology"],
    ff: ["fin01BudgetCap", "fin02Flexibility", "fin03ShockTolerance", "fin04SalesPremium", "ctx03Gfa"],
    mp: ["mkt01Tier", "mkt02Competitor", "mkt03Trend", "ctx04Location"],
    ds: ["des01Style", "des02MaterialLevel", "des03Complexity", "des04Experience", "des05Sustainability", "ctx02Scale"],
    er: ["exe01SupplyChain", "exe02Contractor", "exe03Approvals", "exe04QaMaturity", "ctx05Horizon", "add01SampleKit", "add02PortfolioMode", "add03DashboardExport"],
  };

  const allDrivers: ScoreDriver[] = [];

  const dimensions: DimensionExplainability[] = Object.entries(dimScores).map(([dim, score]) => {
    const weight = scoreData.dimensionWeights[dim] ?? 0.2;
    const vars = dimensionVarMap[dim] ?? [];
    const dimContribs = flatContributions[dim] ?? {};

    const drivers: ScoreDriver[] = vars.map((v) => {
      // Get raw value from inputSnapshot
      const rawVal = inputSnapshot[v];
      const isStringEnum = STRING_ENUM_VARS.has(v);
      const isBooleanVar = BOOLEAN_VARS.has(v);
      const isRawNumeric = RAW_NUMERIC_VARS.has(v);

      // Compute numeric value for ordinal variables (1-5 scale)
      let numVal: number | null = null;
      let normalizedValue: number | null = null;
      if (!isStringEnum && !isBooleanVar && !isRawNumeric && typeof rawVal === "number") {
        numVal = rawVal;
        normalizedValue = Math.max(0, Math.min(1, (rawVal - 1) / 4)); // ordinal normalization
      } else if (!isStringEnum && !isBooleanVar && !isRawNumeric && typeof rawVal === "string") {
        const parsed = parseFloat(rawVal);
        if (!isNaN(parsed)) {
          numVal = parsed;
          normalizedValue = Math.max(0, Math.min(1, (parsed - 1) / 4));
        }
      } else if (isRawNumeric && typeof rawVal === "number") {
        numVal = rawVal;
        normalizedValue = null; // raw numerics don't normalize to 0-1
      }

      // Look up contribution from the nested structure
      const contribKey = VARIABLE_TO_CONTRIBUTION_KEY[dim]?.[v];
      const contribution = contribKey ? (dimContribs[contribKey] ?? 0) : 0;

      // Determine direction
      let direction: "positive" | "negative" | "neutral";
      if (isStringEnum) {
        const enumMap = ENUM_QUALITY_MAP[v];
        direction = enumMap?.[String(rawVal)] ?? "neutral";
      } else if (isBooleanVar) {
        direction = rawVal === true ? "positive" : "neutral";
      } else if (isRawNumeric) {
        // Budget cap and GFA are contextual — always neutral in direction
        direction = "neutral";
      } else if (numVal !== null) {
        direction = numVal >= 4 ? "positive" : numVal <= 2 ? "negative" : "neutral";
      } else {
        direction = "neutral";
      }

      // Safe display value — NEVER undefined
      let displayValue: number | string;
      if (rawVal === undefined || rawVal === null) {
        displayValue = "N/A";
      } else if (isBooleanVar) {
        displayValue = rawVal ? "Yes" : "No";
      } else if (isStringEnum) {
        // Use display label if available, otherwise raw string
        const labelMap = ENUM_DISPLAY_LABELS[v];
        displayValue = labelMap?.[String(rawVal)] ?? String(rawVal);
      } else if (typeof rawVal === "number" || typeof rawVal === "string") {
        displayValue = rawVal;
      } else {
        displayValue = String(rawVal);
      }

      const explanation = buildVariableExplanation(v, displayValue, numVal, direction, isStringEnum || isBooleanVar);

      const driver: ScoreDriver = {
        variable: v,
        label: VARIABLE_LABELS[v] ?? v,
        rawValue: displayValue,
        normalizedValue,
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

function buildVariableExplanation(
  variable: string,
  displayValue: number | string,
  numVal: number | null,
  direction: string,
  isStringEnum: boolean
): string {
  const label = VARIABLE_LABELS[variable] ?? variable;
  if (isStringEnum) {
    return `${label} is set to "${displayValue}". This ${direction === "positive" ? "strengthens" : direction === "negative" ? "weakens" : "has a neutral effect on"} the dimension evaluation.`;
  }
  if (numVal !== null) {
    if (direction === "positive") {
      return `${label} scored ${numVal}/5, indicating strong positioning in this area. This contributes positively to the overall evaluation.`;
    } else if (direction === "negative") {
      return `${label} scored ${numVal}/5, indicating a gap that may require attention. This creates downward pressure on the dimension score.`;
    }
    return `${label} scored ${numVal}/5, representing a neutral baseline position.`;
  }
  return `${label} is set to ${displayValue}.`;
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
