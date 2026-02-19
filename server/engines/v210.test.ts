import { describe, it, expect } from "vitest";
import {
  generateExplainabilityReport,
  explainMaterialSelection,
  buildAuditPack,
} from "./explainability";
import {
  compareOutcomes,
  suggestBenchmarkAdjustments,
  computeAccuracy,
  generateLearningReport,
} from "./outcome-learning";

// ─── V2.12: Explainability Engine ──────────────────────────────────────────

describe("Explainability Engine", () => {
  const sampleInput: Record<string, unknown> = {
    str01BrandClarity: 4,
    str02Differentiation: 5,
    str03BuyerMaturity: 3,
    fin01BudgetCap: 2,
    fin02Flexibility: 3,
    fin03ShockTolerance: 2,
    fin04SalesPremium: 4,
    mkt01Tier: "premium",
    mkt02Competitor: 4,
    mkt03Trend: 3,
    des01Style: "modern",
    des02MaterialLevel: 4,
    des03Complexity: 3,
    des04Experience: 4,
    des05Sustainability: 3,
    exe01SupplyChain: 3,
    exe02Contractor: 4,
    exe03Approvals: 2,
    exe04QaMaturity: 3,
  };

  const sampleScoreData = {
    saScore: 78,
    ffScore: 55,
    mpScore: 72,
    dsScore: 68,
    erScore: 60,
    compositeScore: 66.6,
    riskScore: 35,
    confidenceScore: 72,
    decisionStatus: "Validated",
    dimensionWeights: { sa: 0.2, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.2 },
    variableContributions: {
      str01BrandClarity: 3.2,
      str02Differentiation: 4.0,
      str03BuyerMaturity: 2.4,
      fin01BudgetCap: 1.6,
      fin02Flexibility: 2.4,
      fin03ShockTolerance: 1.6,
      fin04SalesPremium: 3.2,
    },
    penalties: [{ rule: "low_ff", points: 5, reason: "Financial feasibility below threshold" }],
    riskFlags: [{ flag: "budget_risk", severity: "medium", detail: "Budget cap is tight" }],
  };

  it("generates a full explainability report with all dimensions", () => {
    const report = generateExplainabilityReport(
      1,
      sampleInput,
      sampleScoreData,
      "v1.0-2026Q1",
      "MIYAR Logic v1.0"
    );
    expect(report.projectId).toBe(1);
    expect(report.compositeScore).toBe(66.6);
    expect(report.decisionStatus).toBe("Validated");
    expect(report.dimensions).toHaveLength(5);
    expect(report.dimensions.map((d) => d.dimension).sort()).toEqual(["ds", "er", "ff", "mp", "sa"]);
    expect(report.benchmarkVersionUsed).toBe("v1.0-2026Q1");
    expect(report.logicVersionUsed).toBe("MIYAR Logic v1.0");
    expect(report.generatedAt).toBeTruthy();
  });

  it("identifies top positive and negative drivers per dimension", () => {
    const report = generateExplainabilityReport(1, sampleInput, sampleScoreData, "v1.0", "v1.0");
    const saDim = report.dimensions.find((d) => d.dimension === "sa")!;
    expect(saDim.topPositive).not.toBe("None identified"); // str01=4, str02=5 are positive
    expect(saDim.drivers.length).toBeGreaterThan(0);
  });

  it("builds decision rationale with penalties", () => {
    const report = generateExplainabilityReport(1, sampleInput, sampleScoreData, "v1.0", "v1.0");
    expect(report.decisionRationale).toContain("66.6");
    expect(report.decisionRationale).toContain("penalty");
    expect(report.decisionRationale).toContain("Financial feasibility");
  });

  it("builds confidence explanation based on input completeness", () => {
    const report = generateExplainabilityReport(1, sampleInput, sampleScoreData, "v1.0", "v1.0");
    expect(report.confidenceExplanation).toContain("72.0");
    expect(report.confidenceExplanation).toContain("Moderate confidence");
  });

  it("explains material selections with tier matching", () => {
    const materials = [
      { name: "Italian Marble", tier: "luxury", category: "flooring", typicalCostLow: 800, typicalCostHigh: 1500, leadTimeDays: 90 },
      { name: "Engineered Wood", tier: "mid", category: "flooring", typicalCostLow: 100, typicalCostHigh: 300, leadTimeDays: 30 },
      { name: "Gold Leaf Panels", tier: "ultra_luxury", category: "wall_finish", typicalCostLow: 2000, typicalCostHigh: 5000, leadTimeDays: 180 },
    ];
    const explanations = explainMaterialSelection(materials, "premium", 2000);
    expect(explanations).toHaveLength(3);
    // Italian Marble (luxury) is 1 tier above premium — should match
    expect(explanations[0].tierMatch).toBe(true);
    // Engineered Wood (mid) is 1 tier below premium — should match
    expect(explanations[1].tierMatch).toBe(true);
    // Gold Leaf (ultra_luxury) is 2 tiers above premium — should NOT match
    expect(explanations[2].tierMatch).toBe(false);
    expect(explanations[2].riskFactors.length).toBeGreaterThan(0);
  });

  it("builds a complete audit pack JSON", () => {
    const report = generateExplainabilityReport(1, sampleInput, sampleScoreData, "v1.0", "v1.0");
    const pack = buildAuditPack(
      report,
      sampleInput,
      { benchmarks: [] },
      { weights: [{ dimension: "sa", weight: "0.2" }], thresholds: [{ ruleKey: "min_composite", thresholdValue: "60", comparator: ">=" }] },
      [],
      []
    );
    expect(pack.version).toBe("2.12");
    expect(pack.projectId).toBe(1);
    expect(pack.decision).toBeTruthy();
    expect(pack.explainability).toBeTruthy();
    expect(pack.traceability).toBeTruthy();
    expect((pack.traceability as Record<string, unknown>).engineVersion).toBe("MIYAR v2.12");
  });
});

// ─── V2.13: Outcome Learning Engine ────────────────────────────────────────

describe("Outcome Learning Engine", () => {
  const sampleOutcomes = [
    {
      projectId: 1,
      procurementActualCosts: { flooring: 50000, fixtures: 30000 },
      leadTimesActual: { flooring: 120, fixtures: 60 },
    },
    {
      projectId: 2,
      procurementActualCosts: { flooring: 60000, fixtures: 40000 },
      leadTimesActual: { flooring: 100, fixtures: 45 },
    },
  ];

  const samplePredictions = [
    { projectId: 1, estimatedCost: 70000, estimatedLeadTime: 90 },
    { projectId: 2, estimatedCost: 80000, estimatedLeadTime: 80 },
  ];

  it("compares outcomes and produces comparisons", () => {
    const comparisons = compareOutcomes(sampleOutcomes, samplePredictions);
    expect(comparisons.length).toBeGreaterThan(0);
    // Each comparison should have required fields
    for (const c of comparisons) {
      expect(c.metric).toBeTruthy();
      expect(["over", "under", "aligned"]).toContain(c.direction);
      expect(["high", "medium", "low"]).toContain(c.significance);
    }
  });

  it("suggests benchmark adjustments for significant deviations", () => {
    // Create outcomes with large deviation
    const bigDevOutcomes = [
      { projectId: 1, procurementActualCosts: { total: 150000 } },
    ];
    const bigDevPredictions = [
      { projectId: 1, estimatedCost: 100000 },
    ];
    const comparisons = compareOutcomes(bigDevOutcomes, bigDevPredictions);
    const adjustments = suggestBenchmarkAdjustments(comparisons, 1);
    // 50% deviation should trigger adjustment
    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments[0].field).toBe("costPerSqftMid");
    expect(adjustments[0].rationale).toContain("higher");
  });

  it("computes accuracy from comparisons", () => {
    const comparisons = compareOutcomes(sampleOutcomes, samplePredictions);
    const accuracy = computeAccuracy(comparisons);
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  it("generates a full learning report", () => {
    const report = generateLearningReport(sampleOutcomes, samplePredictions);
    expect(report.totalOutcomes).toBe(2);
    expect(report.comparisons).toBeDefined();
    expect(report.suggestedAdjustments).toBeDefined();
    expect(report.overallAccuracy).toBeGreaterThanOrEqual(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it("returns empty comparisons when no matching predictions", () => {
    const comparisons = compareOutcomes(
      [{ projectId: 99, procurementActualCosts: { total: 50000 } }],
      [{ projectId: 1, estimatedCost: 50000 }]
    );
    expect(comparisons).toHaveLength(0);
  });

  it("handles empty outcomes gracefully", () => {
    const report = generateLearningReport([], []);
    expect(report.totalOutcomes).toBe(0);
    expect(report.comparisons).toHaveLength(0);
    expect(report.suggestedAdjustments).toHaveLength(0);
    expect(report.overallAccuracy).toBe(0);
  });
});
