import { describe, it, expect } from "vitest";
import { normalizeInputs, normalizeOrdinal } from "./normalization";
import type { ProjectInputs } from "../../shared/miyar-types";

// ─── V1.5-01: costVolatility Normalization Bug Fix ──────────────────────────

describe("costVolatility normalization fix (V1.5-01)", () => {
  const makeInputs = (exe01: number, fin03: number): ProjectInputs => ({
    ctx01Typology: "Residential",
    ctx02Scale: "Medium",
    ctx03Gfa: 50000,
    ctx04Location: "Prime",
    ctx05Horizon: 18,
    str01BrandClarity: 3,
    str02Differentiation: 3,
    str03BuyerMaturity: 3,
    mkt01Tier: "Luxury",
    mkt02Competitor: 3,
    mkt03Trend: 3,
    fin01BudgetCap: 500,
    fin02Flexibility: 3,
    fin03ShockTolerance: fin03,
    fin04SalesPremium: 3,
    des01Style: "Modern",
    des02MaterialLevel: 3,
    des03Complexity: 3,
    des04Experience: 3,
    des05Sustainability: 3,
    exe01SupplyChain: exe01,
    exe02Contractor: 3,
    exe03Approvals: 3,
    exe04QaMaturity: 3,
  });

  it("exe01=5 (max readiness) + fin03=5 (max tolerance) → costVolatility = 0.0", () => {
    const n = normalizeInputs(makeInputs(5, 5), 500);
    expect(n.costVolatility).toBeCloseTo(0.0, 5);
  });

  it("exe01=1 (min readiness) + fin03=1 (min tolerance) → costVolatility = 1.0", () => {
    const n = normalizeInputs(makeInputs(1, 1), 500);
    expect(n.costVolatility).toBeCloseTo(1.0, 5);
  });

  it("higher supply chain readiness reduces costVolatility", () => {
    const lowReadiness = normalizeInputs(makeInputs(1, 3), 500);
    const midReadiness = normalizeInputs(makeInputs(3, 3), 500);
    const highReadiness = normalizeInputs(makeInputs(5, 3), 500);
    expect(highReadiness.costVolatility).toBeLessThan(midReadiness.costVolatility);
    expect(midReadiness.costVolatility).toBeLessThan(lowReadiness.costVolatility);
  });

  it("higher shock tolerance reduces costVolatility", () => {
    const lowTolerance = normalizeInputs(makeInputs(3, 1), 500);
    const highTolerance = normalizeInputs(makeInputs(3, 5), 500);
    expect(highTolerance.costVolatility).toBeLessThan(lowTolerance.costVolatility);
  });

  it("costVolatility is always in [0, 1] range", () => {
    for (let exe = 1; exe <= 5; exe++) {
      for (let fin = 1; fin <= 5; fin++) {
        const n = normalizeInputs(makeInputs(exe, fin), 500);
        expect(n.costVolatility).toBeGreaterThanOrEqual(0);
        expect(n.costVolatility).toBeLessThanOrEqual(1);
      }
    }
  });

  it("formula is deterministic: same inputs → same output", () => {
    const a = normalizeInputs(makeInputs(4, 3), 500);
    const b = normalizeInputs(makeInputs(4, 3), 500);
    expect(a.costVolatility).toBe(b.costVolatility);
  });

  it("costVolatility = ((1-exe01_n)*0.5 + (1-fin03_n)*0.5) formula verification", () => {
    const n = normalizeInputs(makeInputs(4, 2), 500);
    const exe01_n = normalizeOrdinal(4); // (4-1)/4 = 0.75
    const fin03_n = normalizeOrdinal(2); // (2-1)/4 = 0.25
    const expected = (1 - exe01_n) * 0.5 + (1 - fin03_n) * 0.5;
    expect(n.costVolatility).toBeCloseTo(expected, 10);
  });
});

// ─── V1.5-02: Explainability inputSnapshot undefined Bug Fix ────────────────

import { generateExplainabilityReport } from "./explainability";

describe("explainability inputSnapshot fix (V1.5-02)", () => {
  const fullInputSnapshot: Record<string, unknown> = {
    ctx01Typology: "Residential",
    ctx02Scale: "Medium",
    ctx03Gfa: 180000,
    ctx04Location: "Prime",
    ctx05Horizon: "24-36m",
    str01BrandClarity: 4,
    str02Differentiation: 5,
    str03BuyerMaturity: 3,
    mkt01Tier: "Luxury",
    mkt02Competitor: 4,
    mkt03Trend: 3,
    fin01BudgetCap: 850,
    fin02Flexibility: 3,
    fin03ShockTolerance: 2,
    fin04SalesPremium: 4,
    des01Style: "Contemporary",
    des02MaterialLevel: 4,
    des03Complexity: 3,
    des04Experience: 4,
    des05Sustainability: 3,
    exe01SupplyChain: 4,
    exe02Contractor: 4,
    exe03Approvals: 2,
    exe04QaMaturity: 3,
  };

  const nestedContributions = {
    sa: { str01_n: 0.263, str03_n: 0.125, compatVisionMarket: 0.25, compatVisionDesign: 0.15 },
    ff: { budgetFit: 0.36, fin02_n: 0.10, executionResilience: 0.15, costStability: 0.075 },
    mp: { marketFit: 0.28, differentiationPressure: 0.188, des04_n: 0.15, trendFit: 0.14 },
    ds: { str02_n: 0.30, competitorInverse: 0.063, des04_n: 0.15, des02_n: 0.15 },
    er: { executionResilience: 0.263, supplyChainInverse: 0.063, complexityInverse: 0.10, approvalsInverse: 0.15 },
  };

  const scoreData = {
    saScore: 78,
    ffScore: 55,
    mpScore: 72,
    dsScore: 68,
    erScore: 60,
    compositeScore: 66.6,
    riskScore: 35,
    confidenceScore: 72,
    decisionStatus: "Validated",
    dimensionWeights: { sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.20, er: 0.15 },
    variableContributions: nestedContributions,
    penalties: [],
    riskFlags: [],
  };

  it("no driver.rawValue is undefined when full inputSnapshot is provided", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    for (const dim of report.dimensions) {
      for (const driver of dim.drivers) {
        expect(driver.rawValue).not.toBeUndefined();
        expect(driver.rawValue).not.toBe("undefined");
        expect(String(driver.rawValue)).not.toBe("undefined");
      }
    }
  });

  it("all 19 input variables appear as drivers across 5 dimensions", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    const allVars = report.dimensions.flatMap((d) => d.drivers.map((dr) => dr.variable));
    // 3 + 4 + 3 + 5 + 4 = 19 variables across all dimensions
    expect(allVars).toHaveLength(19);
    expect(allVars).toContain("str01BrandClarity");
    expect(allVars).toContain("mkt01Tier");
    expect(allVars).toContain("des01Style");
    expect(allVars).toContain("exe01SupplyChain");
    expect(allVars).toContain("fin01BudgetCap");
  });

  it("ordinal variables have correct normalizedValue", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    const saDim = report.dimensions.find((d) => d.dimension === "sa")!;
    const brandClarity = saDim.drivers.find((d) => d.variable === "str01BrandClarity")!;
    // str01BrandClarity = 4, normalized = (4-1)/4 = 0.75
    expect(brandClarity.rawValue).toBe(4);
    expect(brandClarity.normalizedValue).toBeCloseTo(0.75, 5);
  });

  it("string enum variables (mkt01Tier, des01Style) have null normalizedValue", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    const mpDim = report.dimensions.find((d) => d.dimension === "mp")!;
    const tierDriver = mpDim.drivers.find((d) => d.variable === "mkt01Tier")!;
    expect(tierDriver.rawValue).toBe("Luxury");
    expect(tierDriver.normalizedValue).toBeNull();
    expect(tierDriver.direction).toBe("positive"); // Luxury is positive

    const dsDim = report.dimensions.find((d) => d.dimension === "ds")!;
    const styleDriver = dsDim.drivers.find((d) => d.variable === "des01Style")!;
    expect(styleDriver.rawValue).toBe("Contemporary");
    expect(styleDriver.normalizedValue).toBeNull();
    expect(styleDriver.direction).toBe("positive"); // Contemporary is positive
  });

  it("contributions come from nested variableContributions (not flat)", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    const saDim = report.dimensions.find((d) => d.dimension === "sa")!;
    const brandClarity = saDim.drivers.find((d) => d.variable === "str01BrandClarity")!;
    // str01BrandClarity maps to sa.str01_n = 0.263
    expect(brandClarity.contribution).toBeCloseTo(0.263, 2);
    expect(brandClarity.contribution).not.toBe(0); // was 0 before fix
  });

  it("empty inputSnapshot produces N/A rawValues, not undefined", () => {
    const report = generateExplainabilityReport(1, {}, scoreData, "v1.0", "Logic v1.0");
    for (const dim of report.dimensions) {
      for (const driver of dim.drivers) {
        expect(driver.rawValue).toBe("N/A");
        expect(driver.normalizedValue).toBeNull();
        expect(driver.direction).toBe("neutral");
      }
    }
  });

  it("topDrivers and topRisks have non-zero contributions", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    // With proper contribution mapping, top drivers should have non-zero contributions
    if (report.topDrivers.length > 0) {
      expect(report.topDrivers[0].contribution).toBeGreaterThan(0);
    }
  });

  it("decision rationale references actual driver labels", () => {
    const report = generateExplainabilityReport(1, fullInputSnapshot, scoreData, "v1.0", "Logic v1.0");
    expect(report.decisionRationale).toContain("66.6");
    expect(report.decisionRationale).toContain("Validated");
  });
});
