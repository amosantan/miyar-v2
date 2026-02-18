/**
 * MIYAR Project Intelligence Warehouse Engine
 * Computes derived features from scored projects for portfolio analytics.
 */

import type { Project, ScoreMatrix, BenchmarkData } from "../../drizzle/schema";

export interface DerivedFeatures {
  costDeltaVsBenchmark: number;
  uniquenessIndex: number;
  feasibilityFlags: FeasibilityFlag[];
  reworkRiskIndex: number;
  procurementComplexity: number;
  tierPercentile: number;
  styleFamily: string;
  costBand: string;
}

export interface FeasibilityFlag {
  flag: string;
  severity: "info" | "warning" | "critical";
  description: string;
}

function classifyCostBand(budgetCap: number, tier: string): string {
  const bands: Record<string, [number, number, number]> = {
    "Mid": [150, 250, 350],
    "Upper-mid": [250, 380, 500],
    "Luxury": [400, 600, 850],
    "Ultra-luxury": [650, 900, 1400],
  };
  const [low, mid, high] = bands[tier] || [200, 350, 500];
  if (budgetCap <= low) return "below_market";
  if (budgetCap <= mid) return "market_low";
  if (budgetCap <= high) return "market_mid";
  return "market_high";
}

function classifyStyleFamily(style: string): string {
  const families: Record<string, string> = {
    "Modern": "contemporary_minimalist",
    "Contemporary": "contemporary_minimalist",
    "Minimal": "contemporary_minimalist",
    "Classic": "traditional_heritage",
    "Fusion": "eclectic_fusion",
    "Other": "custom",
  };
  return families[style] || "custom";
}

export function computeDerivedFeatures(
  project: Project,
  scoreMatrix: ScoreMatrix,
  benchmarks: BenchmarkData[],
  allScores: ScoreMatrix[]
): DerivedFeatures {
  const budgetCap = Number(project.fin01BudgetCap || 0);
  const tier = project.mkt01Tier || "Upper-mid";
  const complexity = project.des03Complexity || 3;
  const materialLevel = project.des02MaterialLevel || 3;
  const supplyChain = project.exe01SupplyChain || 3;
  const compositeScore = Number(scoreMatrix.compositeScore);

  // Cost delta vs benchmark
  const relevantBenchmarks = benchmarks.filter(b =>
    b.typology === project.ctx01Typology &&
    b.marketTier === tier
  );
  const avgBenchmarkCost = relevantBenchmarks.length > 0
    ? relevantBenchmarks.reduce((s, b) => s + Number(b.costPerSqftMid || 0), 0) / relevantBenchmarks.length
    : 400;
  const costDeltaVsBenchmark = budgetCap > 0 ? ((budgetCap - avgBenchmarkCost) / avgBenchmarkCost) * 100 : 0;

  // Uniqueness index (0-1): based on differentiation, style, and material level
  const diff = project.str02Differentiation || 3;
  const uniquenessIndex = Math.min(1, Math.max(0, (diff * 0.4 + materialLevel * 0.3 + complexity * 0.3) / 5));

  // Feasibility flags
  const feasibilityFlags: FeasibilityFlag[] = [];
  if (budgetCap > 0 && budgetCap < avgBenchmarkCost * 0.7) {
    feasibilityFlags.push({
      flag: "budget_below_benchmark",
      severity: "critical",
      description: `Budget is ${Math.round((1 - budgetCap / avgBenchmarkCost) * 100)}% below market benchmark`,
    });
  }
  if (complexity >= 4 && supplyChain <= 2) {
    feasibilityFlags.push({
      flag: "complexity_supply_mismatch",
      severity: "warning",
      description: "High complexity with low supply chain readiness",
    });
  }
  if (materialLevel >= 4 && (project.ctx05Horizon === "0-12m")) {
    feasibilityFlags.push({
      flag: "timeline_material_risk",
      severity: "warning",
      description: "Premium materials may not be procurable within 12-month horizon",
    });
  }
  if (Number(scoreMatrix.riskScore) > 60) {
    feasibilityFlags.push({
      flag: "elevated_risk",
      severity: "warning",
      description: `Risk score ${Number(scoreMatrix.riskScore).toFixed(1)} exceeds threshold`,
    });
  }

  // Rework risk index (0-1)
  const riskNorm = Number(scoreMatrix.riskScore) / 100;
  const complexityNorm = complexity / 5;
  const reworkRiskIndex = Math.min(1, riskNorm * 0.5 + complexityNorm * 0.3 + (1 - compositeScore / 100) * 0.2);

  // Procurement complexity (0-1)
  const procurementComplexity = Math.min(1, (materialLevel * 0.4 + complexity * 0.3 + (6 - supplyChain) * 0.3) / 5);

  // Tier percentile: where this project's score falls among all scored projects
  const sameClassScores = allScores
    .filter(s => {
      const snap = s.inputSnapshot as any;
      return snap?.mkt01Tier === tier;
    })
    .map(s => Number(s.compositeScore))
    .sort((a, b) => a - b);
  let tierPercentile = 0.5;
  if (sameClassScores.length > 1) {
    const rank = sameClassScores.filter(s => s <= compositeScore).length;
    tierPercentile = rank / sameClassScores.length;
  }

  return {
    costDeltaVsBenchmark: Math.round(costDeltaVsBenchmark * 100) / 100,
    uniquenessIndex: Math.round(uniquenessIndex * 10000) / 10000,
    feasibilityFlags,
    reworkRiskIndex: Math.round(reworkRiskIndex * 10000) / 10000,
    procurementComplexity: Math.round(procurementComplexity * 10000) / 10000,
    tierPercentile: Math.round(tierPercentile * 10000) / 10000,
    styleFamily: classifyStyleFamily(project.des01Style || "Modern"),
    costBand: classifyCostBand(budgetCap, tier),
  };
}
