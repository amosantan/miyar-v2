import { describe, it, expect } from "vitest";
import { computeRoi, type RoiInputs } from "./roi";
import { computeFiveLens } from "./five-lens";
import { computeDerivedFeatures } from "./intelligence";
import { SCENARIO_TEMPLATES, getScenarioTemplate, solveConstraints, type Constraint } from "./scenario-templates";
import { computeDistributions, computeComplianceHeatmap, detectFailurePatterns, computeImprovementLevers, type PortfolioProject } from "./portfolio";

// ─── ROI Narrative Engine Tests ─────────────────────────────────────────────

describe("ROI Narrative Engine", () => {
  const baseInput: RoiInputs = {
    compositeScore: 75,
    riskScore: 35,
    confidenceScore: 80,
    budgetCap: 500,
    gfa: 15000,
    complexity: 3,
    materialLevel: 4,
    tier: "Luxury",
    horizon: "12-24m",
  };

  it("computes ROI with all drivers", () => {
    const result = computeRoi(baseInput);
    expect(result).toBeDefined();
    expect(result.totalCostAvoided.mid).toBeGreaterThan(0);
    expect(result.totalHoursSaved.mid).toBeGreaterThan(0);
    expect(result.drivers).toBeInstanceOf(Array);
    expect(result.drivers.length).toBe(5);
  });

  it("returns different cost avoided for different composite scores", () => {
    const highScore = computeRoi({ ...baseInput, compositeScore: 90 });
    const lowScore = computeRoi({ ...baseInput, compositeScore: 50 });
    // Higher score changes the ROI profile (fewer rework cycles but better savings elsewhere)
    expect(highScore.totalCostAvoided.mid).not.toBe(lowScore.totalCostAvoided.mid);
  });

  it("includes assumptions array", () => {
    const result = computeRoi(baseInput);
    expect(result.assumptions).toBeInstanceOf(Array);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("produces conservative <= mid <= aggressive for each driver", () => {
    const result = computeRoi(baseInput);
    for (const driver of result.drivers) {
      expect(driver.costAvoided.conservative).toBeLessThanOrEqual(driver.costAvoided.mid);
      expect(driver.costAvoided.mid).toBeLessThanOrEqual(driver.costAvoided.aggressive);
    }
  });

  it("respects custom coefficients", () => {
    const defaultResult = computeRoi(baseInput);
    const customResult = computeRoi(baseInput, {
      hourlyRate: 2000,
      reworkCostPct: 0.3,
      tenderIterationCost: 100000,
      designCycleCost: 80000,
      budgetVarianceMultiplier: 0.15,
      timeAccelerationWeeks: 10,
      conservativeMultiplier: 0.5,
      aggressiveMultiplier: 2.0,
    });
    expect(customResult.totalCostAvoided.mid).not.toBe(defaultResult.totalCostAvoided.mid);
  });

  it("computes budget accuracy gain", () => {
    const result = computeRoi(baseInput);
    expect(result.budgetAccuracyGain.fromPct).toBeGreaterThan(result.budgetAccuracyGain.toPct);
  });

  it("computes decision confidence index", () => {
    const result = computeRoi(baseInput);
    expect(result.decisionConfidenceIndex).toBeGreaterThan(0);
    expect(result.decisionConfidenceIndex).toBeLessThanOrEqual(100);
  });

  it("computes time-to-brief acceleration", () => {
    const result = computeRoi(baseInput);
    expect(result.timeToBreifWeeks.before).toBeGreaterThan(result.timeToBreifWeeks.after);
  });
});

// ─── 5-Lens Defensibility Framework Tests ───────────────────────────────────

describe("5-Lens Defensibility Framework", () => {
  const mockProject = {
    ctx01Typology: "Residential",
    ctx04Location: "Prime",
    mkt01Tier: "Luxury",
    str01BrandClarity: 4,
    str02Differentiation: 4,
    str03BuyerMaturity: 3,
    des01Style: "Contemporary",
    des02MaterialLevel: 4,
    des03Complexity: 3,
    des04Experience: 4,
    des05Sustainability: 3,
    fin01BudgetCap: 500,
    fin02Flexibility: 3,
    fin03ShockTolerance: 3,
    fin04SalesPremium: 4,
    exe01SupplyChain: 3,
    exe02Contractor: 4,
    exe03Approvals: 3,
    exe04QaMaturity: 3,
    mkt02Competitor: 3,
    mkt03Trend: 4,
  };

  const mockScoreMatrix = {
    saScore: "78",
    ffScore: "72",
    mpScore: "80",
    dsScore: "75",
    erScore: "68",
    compositeScore: "75",
    riskScore: "35",
    confidenceScore: "80",
    variableContributions: {},
    penalties: [],
  };

  const mockBenchmarks = [
    { typology: "Residential", location: "Prime", marketTier: "Luxury", expectedCost: 450, minCost: 350, maxCost: 600 },
  ];

  it("returns 5 lenses", () => {
    const result = computeFiveLens(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any);
    expect(result.lenses).toHaveLength(5);
  });

  it("each lens has lensName, score, grade, evidence, rationale", () => {
    const result = computeFiveLens(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any);
    for (const lens of result.lenses) {
      expect(lens.lensName).toBeDefined();
      expect(typeof lens.score).toBe("number");
      expect(lens.score).toBeGreaterThanOrEqual(0);
      expect(lens.score).toBeLessThanOrEqual(100);
      expect(lens.grade).toBeDefined();
      expect(["A", "B", "C", "D", "F"]).toContain(lens.grade);
      expect(lens.evidence).toBeInstanceOf(Array);
      expect(lens.rationale).toBeDefined();
    }
  });

  it("computes overall score", () => {
    const result = computeFiveLens(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any);
    expect(result.overallScore).toBe(75);
  });

  it("provides overall grade", () => {
    const result = computeFiveLens(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any);
    expect(result.overallGrade).toBeDefined();
    expect(typeof result.overallGrade).toBe("string");
  });

  it("includes framework version and watermark", () => {
    const result = computeFiveLens(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any);
    expect(result.frameworkVersion).toContain("MIYAR");
    expect(result.watermark).toBeDefined();
    expect(result.attribution).toBeDefined();
  });
});

// ─── Intelligence Warehouse Tests ───────────────────────────────────────────

describe("Intelligence Warehouse", () => {
  const mockProject = {
    ctx01Typology: "Residential",
    ctx04Location: "Prime",
    mkt01Tier: "Luxury",
    des01Style: "Contemporary",
    des02MaterialLevel: 4,
    des03Complexity: 3,
    fin01BudgetCap: 500,
    fin02Flexibility: 3,
    exe01SupplyChain: 3,
    exe02Contractor: 4,
  };

  const mockScoreMatrix = {
    compositeScore: "75",
    riskScore: "35",
    confidenceScore: "80",
    saScore: "78",
    ffScore: "72",
    mpScore: "80",
    dsScore: "75",
    erScore: "68",
  };

  const mockBenchmarks = [
    { typology: "Residential", location: "Prime", tier: "Luxury", expectedCost: 450 },
  ];

  const mockAllScores = [
    { compositeScore: "70", riskScore: "40" },
    { compositeScore: "80", riskScore: "30" },
    { compositeScore: "60", riskScore: "50" },
  ];

  it("computes derived features", () => {
    const result = computeDerivedFeatures(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any, mockAllScores as any);
    expect(result).toBeDefined();
    expect(typeof result.costDeltaVsBenchmark).toBe("number");
    expect(typeof result.uniquenessIndex).toBe("number");
    expect(typeof result.reworkRiskIndex).toBe("number");
    expect(typeof result.procurementComplexity).toBe("number");
    expect(typeof result.tierPercentile).toBe("number");
  });

  it("computes feasibility flags", () => {
    const result = computeDerivedFeatures(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any, mockAllScores as any);
    expect(result.feasibilityFlags).toBeInstanceOf(Array);
  });

  it("assigns style family", () => {
    const result = computeDerivedFeatures(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any, mockAllScores as any);
    expect(result.styleFamily).toBeDefined();
    expect(typeof result.styleFamily).toBe("string");
  });

  it("assigns cost band", () => {
    const result = computeDerivedFeatures(mockProject as any, mockScoreMatrix as any, mockBenchmarks as any, mockAllScores as any);
    expect(result.costBand).toBeDefined();
    expect(typeof result.costBand).toBe("string");
  });
});

// ─── Scenario Templates Tests ───────────────────────────────────────────────

describe("Scenario Templates", () => {
  it("has at least 3 templates", () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it("each template has required fields", () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(t.key).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.description).toBeDefined();
      expect(t.overrides).toBeDefined();
      expect(typeof t.overrides).toBe("object");
      expect(t.tradeoffs).toBeInstanceOf(Array);
    }
  });

  it("getScenarioTemplate returns template by key", () => {
    const first = SCENARIO_TEMPLATES[0];
    const found = getScenarioTemplate(first.key);
    expect(found).toBeDefined();
    expect(found!.key).toBe(first.key);
  });

  it("getScenarioTemplate returns undefined for unknown key", () => {
    const found = getScenarioTemplate("nonexistent_key");
    expect(found).toBeUndefined();
  });

  it("solveConstraints returns results", () => {
    const constraints: Constraint[] = [
      { variable: "des02MaterialLevel", operator: "gte", value: 4 },
    ];
    const baseProject = { des02MaterialLevel: 3, des03Complexity: 3, fin02Flexibility: 3 };
    const results = solveConstraints(baseProject, constraints);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.name).toBeDefined();
      expect(r.constraintsSatisfied).toBeDefined();
      expect(r.constraintsTotal).toBeDefined();
      expect(r.overrides).toBeDefined();
    }
  });
});

// ─── Portfolio Analytics Tests ──────────────────────────────────────────────

describe("Portfolio Analytics", () => {
  const mockProjects: PortfolioProject[] = [
    {
      project: { id: 1, name: "Project A", ctx01Typology: "Residential", mkt01Tier: "Luxury", ctx04Location: "Prime" } as any,
      scoreMatrix: { compositeScore: "80", riskScore: "30", confidenceScore: "85", saScore: "78", ffScore: "72", mpScore: "80", dsScore: "75", erScore: "68", decisionStatus: "validated" } as any,
      intelligence: { costDeltaVsBenchmark: 0.1, uniquenessIndex: 0.7, feasibilityFlags: [], reworkRiskIndex: 0.2, procurementComplexity: 0.4, tierPercentile: 0.8, styleFamily: "contemporary", costBand: "premium" },
    },
    {
      project: { id: 2, name: "Project B", ctx01Typology: "Hospitality", mkt01Tier: "Upper-mid", ctx04Location: "Secondary" } as any,
      scoreMatrix: { compositeScore: "55", riskScore: "50", confidenceScore: "60", saScore: "55", ffScore: "50", mpScore: "60", dsScore: "52", erScore: "48", decisionStatus: "conditional" } as any,
      intelligence: { costDeltaVsBenchmark: -0.1, uniquenessIndex: 0.4, feasibilityFlags: ["budget_tight"], reworkRiskIndex: 0.6, procurementComplexity: 0.5, tierPercentile: 0.4, styleFamily: "transitional", costBand: "standard" },
    },
    {
      project: { id: 3, name: "Project C", ctx01Typology: "Residential", mkt01Tier: "Mid", ctx04Location: "Emerging" } as any,
      scoreMatrix: { compositeScore: "40", riskScore: "65", confidenceScore: "45", saScore: "42", ffScore: "38", mpScore: "45", dsScore: "40", erScore: "35", decisionStatus: "not_validated" } as any,
      intelligence: { costDeltaVsBenchmark: -0.3, uniquenessIndex: 0.2, feasibilityFlags: ["budget_tight", "supply_chain_risk"], reworkRiskIndex: 0.8, procurementComplexity: 0.7, tierPercentile: 0.2, styleFamily: "minimal", costBand: "economy" },
    },
  ];

  it("generates distributions", () => {
    const result = computeDistributions(mockProjects);
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("detects failure patterns", () => {
    const result = detectFailurePatterns(mockProjects);
    expect(result).toBeInstanceOf(Array);
  });

  it("identifies improvement levers", () => {
    const result = computeImprovementLevers(mockProjects);
    expect(result).toBeInstanceOf(Array);
  });

  it("generates compliance heatmap", () => {
    const result = computeComplianceHeatmap(mockProjects);
    expect(result).toBeInstanceOf(Array);
  });
});
