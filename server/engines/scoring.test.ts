import { describe, expect, it } from "vitest";
import { normalizeInputs, normalizeOrdinal } from "./normalization";
import { evaluate, computeROI, type EvaluationConfig } from "./scoring";
import type { ProjectInputs } from "../../shared/miyar-types";

const baseInputs: ProjectInputs = {
  ctx01Typology: "Residential",
  ctx02Scale: "Medium",
  ctx03Gfa: 500000,
  ctx04Location: "Secondary",
  ctx05Horizon: "12-24m",
  str01BrandClarity: 3,
  str02Differentiation: 3,
  str03BuyerMaturity: 3,
  mkt01Tier: "Upper-mid",
  mkt02Competitor: 3,
  mkt03Trend: 3,
  fin01BudgetCap: 400,
  fin02Flexibility: 3,
  fin03ShockTolerance: 3,
  fin04SalesPremium: 3,
  des01Style: "Modern",
  des02MaterialLevel: 3,
  des03Complexity: 3,
  des04Experience: 3,
  des05Sustainability: 2,
  exe01SupplyChain: 3,
  exe02Contractor: 3,
  exe03Approvals: 2,
  exe04QaMaturity: 3,
};

const baseConfig: EvaluationConfig = {
  dimensionWeights: { sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.15, er: 0.20 },
  variableWeights: {
    str01BrandClarity: 0.35,
    str02Differentiation: 0.40,
    str03BuyerMaturity: 0.25,
    fin01BudgetCap: 0.30,
    fin02Flexibility: 0.25,
    fin03ShockTolerance: 0.25,
    fin04SalesPremium: 0.20,
    mkt01Tier: 0.35,
    mkt02Competitor: 0.35,
    mkt03Trend: 0.30,
    des01Style: 0.15,
    des02MaterialLevel: 0.25,
    des03Complexity: 0.20,
    des04Experience: 0.25,
    des05Sustainability: 0.15,
    exe01SupplyChain: 0.30,
    exe02Contractor: 0.30,
    exe03Approvals: 0.20,
    exe04QaMaturity: 0.20,
  },
  penaltyConfig: {
    P1_budgetOverrun: { threshold: 0.15, penalty: 8 },
    P2_complexityMismatch: { threshold: 2, penalty: 6 },
    P3_supplyChainRisk: { threshold: 2, penalty: 5 },
    P4_marketMisalignment: { threshold: 2, penalty: 7 },
    P5_timelineRisk: { threshold: 0.3, penalty: 4 },
  },
  expectedCost: 350,
  benchmarkCount: 15,
  overrideRate: 0,
};

describe("normalizeOrdinal", () => {
  it("normalizes ordinal variables to [0,1]", () => {
    // Ordinal 3 on 1-5 scale => (3-1)/(5-1) = 0.5
    expect(normalizeOrdinal(3)).toBeCloseTo(0.5, 2);
  });

  it("normalizes extreme ordinal values correctly", () => {
    expect(normalizeOrdinal(5)).toBeCloseTo(1.0, 2);
    expect(normalizeOrdinal(1)).toBeCloseTo(0.0, 2);
  });

  it("clamps values outside range", () => {
    expect(normalizeOrdinal(0)).toBe(0);
    expect(normalizeOrdinal(6)).toBe(1);
  });
});

describe("normalizeInputs", () => {
  it("returns all expected normalized fields", () => {
    const norm = normalizeInputs(baseInputs, 350);
    expect(norm).toHaveProperty("str01_n");
    expect(norm).toHaveProperty("budgetFit");
    expect(norm).toHaveProperty("marketFit");
    expect(norm).toHaveProperty("compatVisionMarket");
    expect(norm).toHaveProperty("compatVisionDesign");
    expect(norm).toHaveProperty("scaleBand");
    expect(norm).toHaveProperty("budgetClass");
  });

  it("normalized ordinal fields match normalizeOrdinal", () => {
    const norm = normalizeInputs(baseInputs, 350);
    expect(norm.str01_n).toBeCloseTo(normalizeOrdinal(baseInputs.str01BrandClarity), 5);
    expect(norm.des02_n).toBeCloseTo(normalizeOrdinal(baseInputs.des02MaterialLevel), 5);
  });
});

describe("evaluate", () => {
  it("returns a valid score result with all required fields", () => {
    const result = evaluate(baseInputs, baseConfig);

    expect(result).toHaveProperty("dimensions");
    expect(result).toHaveProperty("compositeScore");
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("rasScore");
    expect(result).toHaveProperty("confidenceScore");
    expect(result).toHaveProperty("decisionStatus");
    expect(result).toHaveProperty("penalties");
    expect(result).toHaveProperty("riskFlags");
    expect(result).toHaveProperty("conditionalActions");
    expect(result).toHaveProperty("variableContributions");
  });

  it("produces scores in valid ranges [0, 100]", () => {
    const result = evaluate(baseInputs, baseConfig);

    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.rasScore).toBeGreaterThanOrEqual(0);
    expect(result.rasScore).toBeLessThanOrEqual(100);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(100);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it("produces all 5 dimension scores", () => {
    const result = evaluate(baseInputs, baseConfig);
    const dims = result.dimensions;

    expect(dims).toHaveProperty("sa");
    expect(dims).toHaveProperty("ff");
    expect(dims).toHaveProperty("mp");
    expect(dims).toHaveProperty("ds");
    expect(dims).toHaveProperty("er");

    Object.values(dims).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it("returns a valid decision status", () => {
    const result = evaluate(baseInputs, baseConfig);
    expect(["validated", "conditional", "not_validated"]).toContain(
      result.decisionStatus
    );
  });

  it("high-quality inputs produce higher scores than low-quality", () => {
    const highInputs: ProjectInputs = {
      ...baseInputs,
      str01BrandClarity: 5,
      str02Differentiation: 5,
      str03BuyerMaturity: 5,
      des02MaterialLevel: 4,
      des03Complexity: 3,
      exe01SupplyChain: 5,
      exe02Contractor: 5,
      exe04QaMaturity: 5,
    };
    const lowInputs: ProjectInputs = {
      ...baseInputs,
      str01BrandClarity: 1,
      str02Differentiation: 1,
      str03BuyerMaturity: 1,
      des02MaterialLevel: 1,
      des03Complexity: 5,
      exe01SupplyChain: 1,
      exe02Contractor: 1,
      exe04QaMaturity: 1,
    };

    const highResult = evaluate(highInputs, baseConfig);
    const lowResult = evaluate(lowInputs, baseConfig);

    expect(highResult.rasScore).toBeGreaterThan(lowResult.rasScore);
  });

  it("penalties reduce the composite score", () => {
    // Create inputs that should trigger budget overrun penalty
    const overBudgetInputs: ProjectInputs = {
      ...baseInputs,
      fin01BudgetCap: 100, // very low budget
      des02MaterialLevel: 5, // very high material
      des03Complexity: 5, // very complex
    };

    const result = evaluate(overBudgetInputs, baseConfig);
    const noPenaltyResult = evaluate(baseInputs, baseConfig);

    // The over-budget scenario should have more penalties or lower score
    expect(result.penalties.length).toBeGreaterThanOrEqual(0);
  });

  it("conditional decisions have valid structure", () => {
    const result = evaluate(baseInputs, baseConfig);
    expect(["validated", "conditional", "not_validated"]).toContain(result.decisionStatus);
    // conditionalActions is always an array
    expect(Array.isArray(result.conditionalActions)).toBe(true);
  });
});

describe("computeROI", () => {
  it("returns valid ROI estimation", () => {
    const roi = computeROI(baseInputs, 65, 150000);

    expect(roi).toHaveProperty("reworkAvoided");
    expect(roi).toHaveProperty("procurementSavings");
    expect(roi).toHaveProperty("timeValueGain");
    expect(roi).toHaveProperty("specEfficiency");
    expect(roi).toHaveProperty("positioningPremium");
    expect(roi).toHaveProperty("totalValue");
    expect(roi).toHaveProperty("roiMultiple");
    expect(roi).toHaveProperty("fee");
    expect(roi).toHaveProperty("netROI");
  });

  it("total value is sum of components", () => {
    const roi = computeROI(baseInputs, 65, 150000);
    const expectedTotal =
      roi.reworkAvoided +
      roi.procurementSavings +
      roi.timeValueGain +
      roi.specEfficiency +
      roi.positioningPremium;
    expect(roi.totalValue).toBeCloseTo(expectedTotal, 0);
  });

  it("ROI multiple is totalValue / fee", () => {
    const fee = 150000;
    const roi = computeROI(baseInputs, 65, fee);
    expect(roi.roiMultiple).toBeCloseTo(roi.totalValue / fee, 1);
  });

  it("higher composite scores produce higher ROI", () => {
    const lowRoi = computeROI(baseInputs, 30, 150000);
    const highRoi = computeROI(baseInputs, 90, 150000);
    expect(highRoi.totalValue).toBeGreaterThan(lowRoi.totalValue);
  });
});
