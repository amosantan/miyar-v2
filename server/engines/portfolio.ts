/**
 * MIYAR Portfolio Analytics Engine
 * Computes cross-project comparisons, compliance heatmaps, failure patterns, and improvement levers.
 */

import type { Project, ScoreMatrix } from "../../drizzle/schema";
import type { DerivedFeatures } from "./intelligence";

export interface PortfolioProject {
  project: Project;
  scoreMatrix: ScoreMatrix;
  intelligence?: DerivedFeatures;
}

export interface PortfolioDistribution {
  dimension: string;
  buckets: { label: string; count: number; avgScore: number }[];
}

export interface ComplianceCell {
  row: string;
  col: string;
  score: number;
  status: "compliant" | "warning" | "non_compliant";
  projectCount: number;
}

export interface FailurePattern {
  pattern: string;
  description: string;
  frequency: number;
  severity: "high" | "medium" | "low";
  affectedProjects: number[];
}

export interface ImprovementLever {
  rank: number;
  lever: string;
  description: string;
  estimatedImpact: string;
  applicableProjects: number;
}

export function computeDistributions(items: PortfolioProject[]): PortfolioDistribution[] {
  // By tier
  const tierBuckets: Record<string, { count: number; scores: number[] }> = {};
  for (const item of items) {
    const tier = item.project.mkt01Tier || "Unknown";
    if (!tierBuckets[tier]) tierBuckets[tier] = { count: 0, scores: [] };
    tierBuckets[tier].count++;
    tierBuckets[tier].scores.push(Number(item.scoreMatrix.compositeScore));
  }

  // By style
  const styleBuckets: Record<string, { count: number; scores: number[] }> = {};
  for (const item of items) {
    const style = item.project.des01Style || "Unknown";
    if (!styleBuckets[style]) styleBuckets[style] = { count: 0, scores: [] };
    styleBuckets[style].count++;
    styleBuckets[style].scores.push(Number(item.scoreMatrix.compositeScore));
  }

  // By cost band
  const costBands = ["below_market", "market_low", "market_mid", "market_high"];
  const costBuckets: Record<string, { count: number; scores: number[] }> = {};
  for (const band of costBands) {
    costBuckets[band] = { count: 0, scores: [] };
  }
  for (const item of items) {
    const band = item.intelligence?.costBand || "market_mid";
    if (!costBuckets[band]) costBuckets[band] = { count: 0, scores: [] };
    costBuckets[band].count++;
    costBuckets[band].scores.push(Number(item.scoreMatrix.compositeScore));
  }

  // By risk level
  const riskBuckets: Record<string, { count: number; scores: number[] }> = {
    "Low (0-30)": { count: 0, scores: [] },
    "Medium (30-60)": { count: 0, scores: [] },
    "High (60+)": { count: 0, scores: [] },
  };
  for (const item of items) {
    const risk = Number(item.scoreMatrix.riskScore);
    const bucket = risk < 30 ? "Low (0-30)" : risk < 60 ? "Medium (30-60)" : "High (60+)";
    riskBuckets[bucket].count++;
    riskBuckets[bucket].scores.push(Number(item.scoreMatrix.compositeScore));
  }

  const toDistribution = (dimension: string, buckets: Record<string, { count: number; scores: number[] }>): PortfolioDistribution => ({
    dimension,
    buckets: Object.entries(buckets).map(([label, data]) => ({
      label,
      count: data.count,
      avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10 : 0,
    })),
  });

  return [
    toDistribution("Market Tier", tierBuckets),
    toDistribution("Design Style", styleBuckets),
    toDistribution("Cost Band", costBuckets),
    toDistribution("Risk Level", riskBuckets),
  ];
}

export function computeComplianceHeatmap(items: PortfolioProject[]): ComplianceCell[] {
  const dimensions = ["SA", "FF", "MP", "DS", "ER"];
  const tiers = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];
  const cells: ComplianceCell[] = [];

  for (const tier of tiers) {
    const tierItems = items.filter(i => i.project.mkt01Tier === tier);
    if (tierItems.length === 0) continue;

    for (const dim of dimensions) {
      const key = `${dim.toLowerCase()}Score` as keyof ScoreMatrix;
      const scores = tierItems.map(i => Number((i.scoreMatrix as any)[key] || 0));
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      cells.push({
        row: tier,
        col: dim,
        score: Math.round(avg * 10) / 10,
        status: avg >= 70 ? "compliant" : avg >= 50 ? "warning" : "non_compliant",
        projectCount: tierItems.length,
      });
    }
  }

  return cells;
}

export function detectFailurePatterns(items: PortfolioProject[]): FailurePattern[] {
  const patterns: FailurePattern[] = [];

  // Pattern 1: Budget-Complexity Mismatch
  const budgetMismatch = items.filter(i => {
    const budget = Number(i.project.fin01BudgetCap || 0);
    const complexity = i.project.des03Complexity || 3;
    return budget < 300 && complexity >= 4;
  });
  if (budgetMismatch.length > 0) {
    patterns.push({
      pattern: "Budget-Complexity Mismatch",
      description: "Projects with high design complexity but below-market budget caps. This combination frequently leads to value engineering compromises.",
      frequency: budgetMismatch.length,
      severity: "high",
      affectedProjects: budgetMismatch.map(i => i.project.id),
    });
  }

  // Pattern 2: Low Supply Chain + Premium Materials
  const supplyRisk = items.filter(i => {
    const supply = i.project.exe01SupplyChain || 3;
    const material = i.project.des02MaterialLevel || 3;
    return supply <= 2 && material >= 4;
  });
  if (supplyRisk.length > 0) {
    patterns.push({
      pattern: "Procurement Risk Exposure",
      description: "Premium material specifications paired with low supply chain readiness. High probability of procurement delays and cost overruns.",
      frequency: supplyRisk.length,
      severity: "high",
      affectedProjects: supplyRisk.map(i => i.project.id),
    });
  }

  // Pattern 3: Weak Brand + High Differentiation Target
  const brandGap = items.filter(i => {
    const brand = i.project.str01BrandClarity || 3;
    const diff = i.project.str02Differentiation || 3;
    return brand <= 2 && diff >= 4;
  });
  if (brandGap.length > 0) {
    patterns.push({
      pattern: "Brand-Differentiation Gap",
      description: "High differentiation ambition without clear brand foundation. Differentiation claims lack credibility without brand clarity.",
      frequency: brandGap.length,
      severity: "medium",
      affectedProjects: brandGap.map(i => i.project.id),
    });
  }

  // Pattern 4: Timeline Pressure
  const timelinePressure = items.filter(i => {
    const horizon = i.project.ctx05Horizon;
    const complexity = i.project.des03Complexity || 3;
    return horizon === "0-12m" && complexity >= 3;
  });
  if (timelinePressure.length > 0) {
    patterns.push({
      pattern: "Timeline Compression Risk",
      description: "Short delivery horizon with moderate-to-high complexity. Projects may face quality compromises or deadline overruns.",
      frequency: timelinePressure.length,
      severity: "medium",
      affectedProjects: timelinePressure.map(i => i.project.id),
    });
  }

  // Pattern 5: Low QA + High Experience Targets
  const qaGap = items.filter(i => {
    const qa = i.project.exe04QaMaturity || 3;
    const exp = i.project.des04Experience || 3;
    return qa <= 2 && exp >= 4;
  });
  if (qaGap.length > 0) {
    patterns.push({
      pattern: "Quality Assurance Gap",
      description: "High experience quality targets with low QA maturity. Risk of delivery not meeting design intent.",
      frequency: qaGap.length,
      severity: "medium",
      affectedProjects: qaGap.map(i => i.project.id),
    });
  }

  return patterns.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    return (sev[b.severity] - sev[a.severity]) || (b.frequency - a.frequency);
  });
}

export function computeImprovementLevers(items: PortfolioProject[]): ImprovementLever[] {
  const levers: ImprovementLever[] = [];

  // Analyze which variables have the most room for improvement across portfolio
  const variableAnalysis: Record<string, { avgValue: number; lowCount: number; label: string; improvement: string }> = {
    str01BrandClarity: { avgValue: 0, lowCount: 0, label: "Brand Clarity", improvement: "Invest in brand strategy workshops and positioning documentation" },
    str02Differentiation: { avgValue: 0, lowCount: 0, label: "Differentiation", improvement: "Develop unique value propositions and design signatures" },
    fin02Flexibility: { avgValue: 0, lowCount: 0, label: "Budget Flexibility", improvement: "Build contingency buffers and value engineering options" },
    fin03ShockTolerance: { avgValue: 0, lowCount: 0, label: "Shock Tolerance", improvement: "Establish fixed-price contracts and hedging strategies" },
    des02MaterialLevel: { avgValue: 0, lowCount: 0, label: "Material Specification", improvement: "Upgrade material palette to match tier expectations" },
    des04Experience: { avgValue: 0, lowCount: 0, label: "Experience Quality", improvement: "Focus on sensory design elements and spatial experience" },
    exe01SupplyChain: { avgValue: 0, lowCount: 0, label: "Supply Chain Readiness", improvement: "Pre-qualify suppliers and establish dual-sourcing" },
    exe02Contractor: { avgValue: 0, lowCount: 0, label: "Contractor Capability", improvement: "Pre-qualify contractors with proven track records" },
    exe04QaMaturity: { avgValue: 0, lowCount: 0, label: "QA Maturity", improvement: "Implement structured QA processes and inspection protocols" },
    des05Sustainability: { avgValue: 0, lowCount: 0, label: "Sustainability", improvement: "Integrate sustainable materials and energy-efficient systems" },
  };

  for (const item of items) {
    for (const [key, analysis] of Object.entries(variableAnalysis)) {
      const val = (item.project as any)[key] || 3;
      analysis.avgValue += val;
      if (val <= 2) analysis.lowCount++;
    }
  }

  const n = items.length || 1;
  for (const [key, analysis] of Object.entries(variableAnalysis)) {
    analysis.avgValue /= n;
  }

  // Sort by improvement potential (low average + high low count)
  const sorted = Object.entries(variableAnalysis)
    .map(([key, a]) => ({
      key,
      ...a,
      potential: (5 - a.avgValue) * 0.6 + (a.lowCount / n) * 0.4,
    }))
    .sort((a, b) => b.potential - a.potential);

  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const s = sorted[i];
    levers.push({
      rank: i + 1,
      lever: s.label,
      description: s.improvement,
      estimatedImpact: s.avgValue < 2.5 ? "High" : s.avgValue < 3.5 ? "Medium" : "Low",
      applicableProjects: s.lowCount,
    });
  }

  return levers;
}
