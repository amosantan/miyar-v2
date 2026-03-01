/**
 * MIYAR 5-Lens Validation Framework
 * Maps the existing 5 scoring dimensions to the proprietary lens framework
 * with evidence traces, rationale paragraphs, and benchmark references.
 */

import type { ScoreMatrix, Project, BenchmarkData } from "../../drizzle/schema";

export interface LensEvidence {
  variable: string;
  label: string;
  value: number | string;
  weight: number;
  contribution: number;
  benchmarkRef?: string;
}

export interface LensResult {
  lensId: number;
  lensName: string;
  lensKey: string;
  score: number;
  maxScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  evidence: LensEvidence[];
  penalties: string[];
  rationale: string;
}

export interface FiveLensOutput {
  frameworkVersion: string;
  lenses: LensResult[];
  overallGrade: string;
  overallScore: number;
  watermark: string;
  attribution: string;
}

function grade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function overallGradeFromScore(score: number): string {
  if (score >= 80) return "Validated";
  if (score >= 60) return "Conditionally Validated";
  return "Not Validated";
}

export function computeFiveLens(
  project: Project,
  scoreMatrix: ScoreMatrix,
  benchmarks: BenchmarkData[]
): FiveLensOutput {
  const contributions = (scoreMatrix.variableContributions || {}) as Record<string, any>;
  const penalties = (scoreMatrix.penalties || []) as any[];
  const penaltyNames = penalties.map((p: any) => p.name || p.type || "Unknown");

  // Lens 1: Market Fit
  const mpScore = Number(scoreMatrix.mpScore);
  const marketEvidence: LensEvidence[] = [
    { variable: "mkt01Tier", label: "Market Tier", value: project.mkt01Tier || "Upper-mid", weight: 0.35, contribution: contributions.mkt01Tier?.contribution || 0 },
    { variable: "mkt02Competitor", label: "Competitor Intensity", value: project.mkt02Competitor || 3, weight: 0.30, contribution: contributions.mkt02Competitor?.contribution || 0 },
    { variable: "mkt03Trend", label: "Trend Sensitivity", value: project.mkt03Trend || 3, weight: 0.20, contribution: contributions.mkt03Trend?.contribution || 0 },
    { variable: "str03BuyerMaturity", label: "Buyer Maturity", value: project.str03BuyerMaturity || 3, weight: 0.15, contribution: contributions.str03BuyerMaturity?.contribution || 0 },
  ];
  const relevantBenchmarks = benchmarks.filter(b => b.marketTier === project.mkt01Tier);
  if (relevantBenchmarks.length > 0) {
    marketEvidence[0].benchmarkRef = `${relevantBenchmarks.length} benchmark records for ${project.mkt01Tier} tier`;
  }

  // Lens 2: Cost Discipline
  const ffScore = Number(scoreMatrix.ffScore);
  const costEvidence: LensEvidence[] = [
    { variable: "fin01BudgetCap", label: "Budget Cap (AED/sqm)", value: Number(project.fin01BudgetCap || 0), weight: 0.30, contribution: contributions.fin01BudgetCap?.contribution || 0 },
    { variable: "fin02Flexibility", label: "Budget Flexibility", value: project.fin02Flexibility || 3, weight: 0.25, contribution: contributions.fin02Flexibility?.contribution || 0 },
    { variable: "fin03ShockTolerance", label: "Shock Tolerance", value: project.fin03ShockTolerance || 3, weight: 0.25, contribution: contributions.fin03ShockTolerance?.contribution || 0 },
    { variable: "fin04SalesPremium", label: "Sales Premium Potential", value: project.fin04SalesPremium || 3, weight: 0.20, contribution: contributions.fin04SalesPremium?.contribution || 0 },
  ];

  // Lens 3: Differentiation
  const saScore = Number(scoreMatrix.saScore);
  const diffEvidence: LensEvidence[] = [
    { variable: "str01BrandClarity", label: "Brand Clarity", value: project.str01BrandClarity || 3, weight: 0.35, contribution: contributions.str01BrandClarity?.contribution || 0 },
    { variable: "str02Differentiation", label: "Differentiation Score", value: project.str02Differentiation || 3, weight: 0.40, contribution: contributions.str02Differentiation?.contribution || 0 },
    { variable: "des01Style", label: "Design Style", value: project.des01Style || "Modern", weight: 0.25, contribution: contributions.des01Style?.contribution || 0 },
  ];

  // Lens 4: Procurement Feasibility
  const erScore = Number(scoreMatrix.erScore);
  const procEvidence: LensEvidence[] = [
    { variable: "exe01SupplyChain", label: "Supply Chain Readiness", value: project.exe01SupplyChain || 3, weight: 0.30, contribution: contributions.exe01SupplyChain?.contribution || 0 },
    { variable: "exe02Contractor", label: "Contractor Capability", value: project.exe02Contractor || 3, weight: 0.25, contribution: contributions.exe02Contractor?.contribution || 0 },
    { variable: "exe03Approvals", label: "Approvals Readiness", value: project.exe03Approvals || 2, weight: 0.20, contribution: contributions.exe03Approvals?.contribution || 0 },
    { variable: "exe04QaMaturity", label: "QA Maturity", value: project.exe04QaMaturity || 3, weight: 0.25, contribution: contributions.exe04QaMaturity?.contribution || 0 },
  ];

  // Lens 5: Brand/Vision Alignment
  const dsScore = Number(scoreMatrix.dsScore);
  const brandEvidence: LensEvidence[] = [
    { variable: "des02MaterialLevel", label: "Material Level", value: project.des02MaterialLevel || 3, weight: 0.25, contribution: contributions.des02MaterialLevel?.contribution || 0 },
    { variable: "des03Complexity", label: "Design Complexity", value: project.des03Complexity || 3, weight: 0.20, contribution: contributions.des03Complexity?.contribution || 0 },
    { variable: "des04Experience", label: "Experience Quality", value: project.des04Experience || 3, weight: 0.30, contribution: contributions.des04Experience?.contribution || 0 },
    { variable: "des05Sustainability", label: "Sustainability", value: project.des05Sustainability || 2, weight: 0.25, contribution: contributions.des05Sustainability?.contribution || 0 },
  ];
  // Phase 9: Add space efficiency evidence when available
  if ((project as any).spaceEfficiencyScore) {
    brandEvidence.push({
      variable: "spaceEfficiency",
      label: "Floor Plan Efficiency",
      value: Number((project as any).spaceEfficiencyScore),
      weight: 0.15,
      contribution: contributions.spaceEfficiency?.contribution || 0,
      benchmarkRef: "DLD area benchmark comparison",
    });
  }

  const lenses: LensResult[] = [
    {
      lensId: 1,
      lensName: "Market Fit Lens",
      lensKey: "market_fit",
      score: mpScore,
      maxScore: 100,
      grade: grade(mpScore),
      evidence: marketEvidence,
      penalties: penaltyNames.filter((p: string) => p.toLowerCase().includes("market") || p.toLowerCase().includes("tier")),
      rationale: `The project scores ${mpScore.toFixed(1)}/100 on market fit, positioning it within the ${project.mkt01Tier} tier with ${project.mkt02Competitor === 5 ? "high" : project.mkt02Competitor === 1 ? "low" : "moderate"} competitive intensity. ${mpScore >= 70 ? "Strong alignment with target market benchmarks." : mpScore >= 50 ? "Adequate market positioning with room for improvement." : "Significant gaps in market alignment require attention."}`,
    },
    {
      lensId: 2,
      lensName: "Cost Discipline Lens",
      lensKey: "cost_discipline",
      score: ffScore,
      maxScore: 100,
      grade: grade(ffScore),
      evidence: costEvidence,
      penalties: penaltyNames.filter((p: string) => p.toLowerCase().includes("budget") || p.toLowerCase().includes("cost") || p.toLowerCase().includes("financial")),
      rationale: `Financial feasibility scores ${ffScore.toFixed(1)}/100. Budget cap of AED ${Number(project.fin01BudgetCap || 0).toLocaleString()}/sqm with flexibility rating ${project.fin02Flexibility}/5. ${ffScore >= 70 ? "Budget is well-calibrated to market expectations." : ffScore >= 50 ? "Budget is within acceptable range but may face pressure." : "Budget constraints pose significant risk to project delivery."}`,
    },
    {
      lensId: 3,
      lensName: "Differentiation Lens",
      lensKey: "differentiation",
      score: saScore,
      maxScore: 100,
      grade: grade(saScore),
      evidence: diffEvidence,
      penalties: penaltyNames.filter((p: string) => p.toLowerCase().includes("brand") || p.toLowerCase().includes("differentiation") || p.toLowerCase().includes("strategic")),
      rationale: `Strategic alignment scores ${saScore.toFixed(1)}/100. Brand clarity at ${project.str01BrandClarity}/5 with differentiation at ${project.str02Differentiation}/5 in ${project.des01Style} style. ${saScore >= 70 ? "Strong differentiation positions this project competitively." : saScore >= 50 ? "Moderate differentiation — consider strengthening unique value proposition." : "Weak differentiation may lead to commoditization risk."}`,
    },
    {
      lensId: 4,
      lensName: "Procurement Feasibility Lens",
      lensKey: "procurement_feasibility",
      score: erScore,
      maxScore: 100,
      grade: grade(erScore),
      evidence: procEvidence,
      penalties: penaltyNames.filter((p: string) => p.toLowerCase().includes("execution") || p.toLowerCase().includes("supply") || p.toLowerCase().includes("procurement")),
      rationale: `Execution readiness scores ${erScore.toFixed(1)}/100. Supply chain readiness at ${project.exe01SupplyChain}/5 with contractor capability at ${project.exe02Contractor}/5. ${erScore >= 70 ? "Strong execution infrastructure supports timely delivery." : erScore >= 50 ? "Execution capabilities are adequate but may need reinforcement." : "Significant execution gaps require mitigation before proceeding."}`,
    },
    {
      lensId: 5,
      lensName: "Brand/Vision Alignment Lens",
      lensKey: "brand_vision",
      score: dsScore,
      maxScore: 100,
      grade: grade(dsScore),
      evidence: brandEvidence,
      penalties: penaltyNames.filter((p: string) => p.toLowerCase().includes("design") || p.toLowerCase().includes("material") || p.toLowerCase().includes("complexity")),
      rationale: `Design specification scores ${dsScore.toFixed(1)}/100. Material level ${project.des02MaterialLevel}/5 with complexity ${project.des03Complexity}/5 and experience quality ${project.des04Experience}/5. ${dsScore >= 70 ? "Design vision is coherent and achievable." : dsScore >= 50 ? "Design ambition is moderate — ensure alignment with budget." : "Design specifications may be misaligned with project constraints."}`,
    },
  ];

  const overallScore = Number(scoreMatrix.compositeScore);

  return {
    frameworkVersion: "MIYAR-5L-v2.0",
    lenses,
    overallGrade: overallGradeFromScore(overallScore),
    overallScore,
    watermark: `MIYAR Decision Intelligence Platform — Proprietary 5-Lens Validation Framework v2.0`,
    attribution: `This analysis was generated using the MIYAR 5-Lens Validation Framework, a proprietary decision intelligence methodology. All scores, insights, and recommendations are produced through deterministic algorithms calibrated against UAE/Dubai market benchmarks. © ${new Date().getFullYear()} MIYAR. All rights reserved.`,
  };
}
