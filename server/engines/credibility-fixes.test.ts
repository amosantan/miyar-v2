/**
 * Tests for Credibility Gap Fixes (Fix 2-4)
 * Fix 2: Scenario Comparison Pack PDF export
 * Fix 3: Logic Registry weights wiring
 * Fix 4: Design Brief DOCX export
 */
import { describe, it, expect } from "vitest";
import { generateScenarioComparisonHTML, type ScenarioComparisonPDFInput } from "./pdf-report";
import { evaluate, type EvaluationConfig } from "./scoring";
import { generateDesignBriefDocx } from "./docx-brief";

// ─── Fix 2: Scenario Comparison Pack PDF ──────────────────────────────────────

describe("Scenario Comparison Pack PDF", () => {
  const sampleInput: ScenarioComparisonPDFInput = {
    projectName: "Test Project",
    projectId: 1,
    baselineScenario: {
      id: 1,
      name: "Baseline Scenario",
      scores: { saScore: 75, ffScore: 60, mpScore: 70, dsScore: 65, erScore: 55, compositeScore: 65 },
      roi: { totalValue: 500000, reworkAvoided: 200000, procurementSavings: 150000, timeValueGain: 150000 },
    },
    comparedScenarios: [
      {
        id: 2,
        name: "Premium Upgrade",
        scores: { saScore: 80, ffScore: 55, mpScore: 75, dsScore: 72, erScore: 50, compositeScore: 66.4 },
        roi: { totalValue: 600000, reworkAvoided: 250000, procurementSavings: 180000, timeValueGain: 170000 },
        deltas: { saScore: 5, ffScore: -5, mpScore: 5, dsScore: 7, erScore: -5, compositeScore: 1.4 },
      },
      {
        id: 3,
        name: "Budget Optimization",
        scores: { saScore: 70, ffScore: 72, mpScore: 65, dsScore: 58, erScore: 62, compositeScore: 65.4 },
        roi: { totalValue: 450000, reworkAvoided: 180000, procurementSavings: 130000, timeValueGain: 140000 },
        deltas: { saScore: -5, ffScore: 12, mpScore: -5, dsScore: -7, erScore: 7, compositeScore: 0.4 },
      },
    ],
    decisionNote: "Comparing premium upgrade vs budget optimization paths",
    benchmarkVersion: "v2.0-calibrated",
    logicVersion: "MIYAR Logic v1.0",
  };

  it("should generate valid HTML with all sections", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Scenario Comparison Pack");
    expect(html).toContain("Test Project");
  });

  it("should include score comparison table with all dimensions", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("Scenario Score Comparison");
    expect(html).toContain("Strategic Alignment");
    expect(html).toContain("Financial Feasibility");
    expect(html).toContain("Market Positioning");
    expect(html).toContain("Differentiation Strength");
    expect(html).toContain("Execution Risk");
    expect(html).toContain("Composite Score");
  });

  it("should include baseline and compared scenario names", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("Baseline Scenario");
    expect(html).toContain("Premium Upgrade");
    expect(html).toContain("Budget Optimization");
  });

  it("should include ROI comparison section", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("ROI Comparison");
    expect(html).toContain("Total Value Created");
    expect(html).toContain("Rework Avoided");
  });

  it("should include trade-off analysis section", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("Trade-off Analysis");
    expect(html).toContain("Improvements vs Baseline");
    expect(html).toContain("Trade-offs vs Baseline");
  });

  it("should include decision note when provided", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("Decision Note");
    expect(html).toContain("Comparing premium upgrade vs budget optimization paths");
  });

  it("should include evidence trace and watermark", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    expect(html).toContain("Evidence Trace");
    expect(html).toContain("MYR-SCE-1-");
    expect(html).toContain("v2.0-calibrated");
  });

  it("should handle empty ROI data gracefully", () => {
    const noRoiInput: ScenarioComparisonPDFInput = {
      ...sampleInput,
      baselineScenario: { ...sampleInput.baselineScenario, roi: null },
      comparedScenarios: sampleInput.comparedScenarios.map((s) => ({ ...s, roi: null })),
    };
    const html = generateScenarioComparisonHTML(noRoiInput);
    expect(html).toContain("<!DOCTYPE html>");
    // ROI section should be omitted when no data
    expect(html).not.toContain("ROI Comparison");
  });

  it("should show delta arrows for positive and negative changes", () => {
    const html = generateScenarioComparisonHTML(sampleInput);
    // Positive delta arrow (▲)
    expect(html).toContain("▲");
    // Negative delta arrow (▼)
    expect(html).toContain("▼");
  });
});

// ─── Fix 3: Logic Registry Weights Wiring ──────────────────────────────────

describe("Logic Registry Weights Wiring", () => {
  // This tests the scoring engine's ability to accept different dimension weights
  // The actual wiring is in the router (buildEvalConfig), but we verify the engine
  // correctly uses whatever weights are passed in

  it("should produce different composite scores with different dimension weights", async () => {
    const sampleInputs = {
      ctx01Typology: "Residential" as const,
      ctx02Scale: "Large" as const,
      ctx03Gfa: 500000,
      ctx04Location: "Primary" as const,
      ctx05Horizon: "12-24m" as const,
      str01BrandClarity: 4,
      str02Differentiation: 4,
      str03BuyerMaturity: 3,
      mkt01Tier: "Upper-mid" as const,
      mkt02Competitor: 3,
      mkt03Trend: 3,
      fin01BudgetCap: 400,
      fin02Flexibility: 3,
      fin03ShockTolerance: 3,
      fin04SalesPremium: 3,
      des01Style: "Modern" as const,
      des02MaterialLevel: 3,
      des03Complexity: 3,
      des04Experience: 3,
      des05Sustainability: 3,
      exe01SupplyChain: 3,
      exe02Contractor: 3,
      exe03Approvals: 3,
      exe04QaMaturity: 3,
      add01SampleKit: false,
      add02PortfolioMode: false,
      add03DashboardExport: true,
    };

    // Equal weights
    const configEqual: EvaluationConfig = {
      dimensionWeights: { sa: 0.2, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.2 },
      variableWeights: {},
      penaltyConfig: {},
      expectedCost: 350,
      benchmarkCount: 5,
      overrideRate: 0,
    };

    // SA-heavy weights (simulating Logic Registry override)
    const configSAHeavy: EvaluationConfig = {
      dimensionWeights: { sa: 0.4, ff: 0.15, mp: 0.15, ds: 0.15, er: 0.15 },
      variableWeights: {},
      penaltyConfig: {},
      expectedCost: 350,
      benchmarkCount: 5,
      overrideRate: 0,
    };

    const resultEqual = evaluate(sampleInputs, configEqual);
    const resultSAHeavy = evaluate(sampleInputs, configSAHeavy);

    // Same dimension scores but different composite due to different weights
    expect(resultEqual.dimensions.sa).toBe(resultSAHeavy.dimensions.sa);
    expect(resultEqual.dimensions.ff).toBe(resultSAHeavy.dimensions.ff);
    expect(resultEqual.compositeScore).not.toBe(resultSAHeavy.compositeScore);
  });

  it("should store dimension weights in score result", async () => {
    const sampleInputs = {
      ctx01Typology: "Residential" as const,
      ctx02Scale: "Medium" as const,
      ctx03Gfa: 200000,
      ctx04Location: "Secondary" as const,
      ctx05Horizon: "6-12m" as const,
      str01BrandClarity: 3,
      str02Differentiation: 3,
      str03BuyerMaturity: 3,
      mkt01Tier: "Mid" as const,
      mkt02Competitor: 3,
      mkt03Trend: 3,
      fin01BudgetCap: 280,
      fin02Flexibility: 3,
      fin03ShockTolerance: 3,
      fin04SalesPremium: 3,
      des01Style: "Modern" as const,
      des02MaterialLevel: 3,
      des03Complexity: 3,
      des04Experience: 3,
      des05Sustainability: 3,
      exe01SupplyChain: 3,
      exe02Contractor: 3,
      exe03Approvals: 3,
      exe04QaMaturity: 3,
      add01SampleKit: false,
      add02PortfolioMode: false,
      add03DashboardExport: true,
    };

    const config: EvaluationConfig = {
      dimensionWeights: { sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.20, er: 0.15 },
      variableWeights: {},
      penaltyConfig: {},
      expectedCost: 300,
      benchmarkCount: 3,
      overrideRate: 0,
    };

    const result = evaluate(sampleInputs, config);
    expect(result.dimensionWeights).toEqual({ sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.20, er: 0.15 });
  });
});

// ─── Fix 4: Design Brief DOCX Export ──────────────────────────────────────

describe("Design Brief DOCX Export", () => {
  const sampleBriefData = {
    projectIdentity: {
      projectName: "Al Wasl Residences",
      typology: "Residential",
      scale: "Large",
      gfa: 450000,
      location: "Secondary",
      horizon: "12-24m",
      marketTier: "Mid",
      style: "Modern",
    },
    positioningStatement: "A mid-market residential tower targeting young professionals with modern, cost-efficient interiors.",
    styleMood: {
      primaryStyle: "Modern Minimalist",
      moodKeywords: ["Clean", "Functional", "Light"],
      colorPalette: ["Warm White", "Light Grey", "Teal Accent"],
      textureDirection: "Smooth surfaces with subtle texture contrasts",
      lightingApproach: "Layered ambient with task lighting",
      spatialPhilosophy: "Open plan with defined zones",
    },
    materialGuidance: {
      tierRecommendation: "Mid",
      qualityBenchmark: "Standard commercial grade",
      primaryMaterials: ["Porcelain tiles", "Engineered wood", "Painted drywall"],
      accentMaterials: ["Brushed metal", "Glass panels"],
      avoidMaterials: ["Natural stone", "Exotic hardwoods"],
      sustainabilityNotes: "Focus on locally sourced materials where possible",
    },
    budgetGuardrails: {
      costPerSqftTarget: "AED 280/sqft",
      costBand: "AED 250-310/sqft",
      contingencyRecommendation: "8% contingency",
      flexibilityLevel: "Moderate",
      valueEngineeringNotes: ["Consider alternative tile formats", "Standardize fixture specifications"],
    },
    procurementConstraints: {
      leadTimeWindow: "16-20 weeks",
      criticalPathItems: ["Custom joinery", "Imported fixtures"],
      importDependencies: ["European tile suppliers"],
      riskMitigations: ["Maintain 2 alternative suppliers per category"],
    },
    deliverablesChecklist: {
      phase1: ["Concept boards", "Material palette"],
      phase2: ["Technical drawings", "Specifications"],
      phase3: ["Shop drawings", "Installation guides"],
      qualityGates: ["Concept approval", "Material sign-off", "Mock-up review"],
    },
    version: 1,
    projectName: "Al Wasl Residences",
  };

  it("should generate a valid DOCX buffer", async () => {
    const buffer = await generateDesignBriefDocx(sampleBriefData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("should generate a DOCX with correct file signature", async () => {
    const buffer = await generateDesignBriefDocx(sampleBriefData);
    // DOCX files are ZIP archives, starting with PK signature
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("should handle missing optional fields gracefully", async () => {
    const minimalData = {
      projectIdentity: { projectName: "Minimal Project" },
      positioningStatement: "Test positioning",
      styleMood: {},
      materialGuidance: {},
      budgetGuardrails: {},
      procurementConstraints: {},
      deliverablesChecklist: {},
      version: 1,
    };
    const buffer = await generateDesignBriefDocx(minimalData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("should produce different sizes for different content volumes", async () => {
    const minimalData = {
      projectIdentity: {},
      positioningStatement: "Short",
      styleMood: {},
      materialGuidance: {},
      budgetGuardrails: {},
      procurementConstraints: {},
      deliverablesChecklist: {},
      version: 1,
    };
    const minimalBuffer = await generateDesignBriefDocx(minimalData);
    const fullBuffer = await generateDesignBriefDocx(sampleBriefData);
    expect(fullBuffer.length).toBeGreaterThan(minimalBuffer.length);
  });
});
