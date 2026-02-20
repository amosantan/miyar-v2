import { describe, it, expect } from "vitest";
import { generateExplainabilityReport } from "./explainability";

/**
 * V4-01: Comprehensive Explainability Tests
 * - All 25 variables → zero undefined
 * - Enum display labels resolved
 * - Boolean variables handled
 * - Raw numeric variables (budget, GFA) handled
 * - Missing/optional field fallback
 * - All 5 dimensions complete
 */

const FULL_SNAPSHOT: Record<string, unknown> = {
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
  add01SampleKit: true,
  add02PortfolioMode: false,
  add03DashboardExport: true,
};

const SCORE_DATA = {
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
  variableContributions: {
    sa: { str01_n: 0.263, str03_n: 0.125, compatVisionMarket: 0.25, compatVisionDesign: 0.15 },
    ff: { budgetFit: 0.36, fin02_n: 0.10, executionResilience: 0.15, costStability: 0.075 },
    mp: { marketFit: 0.28, differentiationPressure: 0.188, des04_n: 0.15, trendFit: 0.14 },
    ds: { str02_n: 0.30, competitorInverse: 0.063, des04_n: 0.15, des02_n: 0.15 },
    er: { executionResilience: 0.263, supplyChainInverse: 0.063, complexityInverse: 0.10, approvalsInverse: 0.15 },
  },
  penalties: [],
  riskFlags: [],
};

function gen(snapshot: Record<string, unknown> = FULL_SNAPSHOT) {
  return generateExplainabilityReport(1, snapshot, SCORE_DATA, "v1.0", "Logic v1.0");
}

describe("V4-01: Zero undefined in explainability report", () => {
  it("no driver.rawValue is undefined across all 25 variables", () => {
    const report = gen();
    const allDrivers = report.dimensions.flatMap((d) => d.drivers);
    for (const driver of allDrivers) {
      expect(driver.rawValue, `${driver.variable} rawValue`).not.toBeUndefined();
      expect(String(driver.rawValue), `${driver.variable} string`).not.toBe("undefined");
    }
  });

  it("all 25 ProjectInputs variables appear as drivers", () => {
    const report = gen();
    const allVars = new Set(report.dimensions.flatMap((d) => d.drivers.map((dr) => dr.variable)));
    const expected = Object.keys(FULL_SNAPSHOT);
    for (const v of expected) {
      expect(allVars.has(v), `missing variable: ${v}`).toBe(true);
    }
  });

  it("all 5 dimensions have at least 3 drivers", () => {
    const report = gen();
    expect(report.dimensions).toHaveLength(5);
    for (const dim of report.dimensions) {
      expect(dim.drivers.length, `${dim.dimension} driver count`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("V4-01: Enum display labels", () => {
  it("mkt01Tier 'Luxury' displays as 'Luxury'", () => {
    const report = gen();
    const mp = report.dimensions.find((d) => d.dimension === "mp")!;
    const tier = mp.drivers.find((d) => d.variable === "mkt01Tier")!;
    expect(tier.rawValue).toBe("Luxury");
    expect(tier.normalizedValue).toBeNull();
    expect(tier.direction).toBe("positive");
  });

  it("des01Style 'Contemporary' displays as 'Contemporary'", () => {
    const report = gen();
    const ds = report.dimensions.find((d) => d.dimension === "ds")!;
    const style = ds.drivers.find((d) => d.variable === "des01Style")!;
    expect(style.rawValue).toBe("Contemporary");
    expect(style.normalizedValue).toBeNull();
    expect(style.direction).toBe("positive");
  });

  it("ctx01Typology 'Residential' displays as 'Residential'", () => {
    const report = gen();
    const sa = report.dimensions.find((d) => d.dimension === "sa")!;
    const typo = sa.drivers.find((d) => d.variable === "ctx01Typology")!;
    expect(typo.rawValue).toBe("Residential");
    expect(typo.normalizedValue).toBeNull();
  });

  it("ctx02Scale 'Medium' displays with label", () => {
    const report = gen();
    const ds = report.dimensions.find((d) => d.dimension === "ds")!;
    const scale = ds.drivers.find((d) => d.variable === "ctx02Scale")!;
    expect(scale.rawValue).toContain("Medium");
    expect(scale.normalizedValue).toBeNull();
  });

  it("ctx04Location 'Prime' displays with label", () => {
    const report = gen();
    const mp = report.dimensions.find((d) => d.dimension === "mp")!;
    const loc = mp.drivers.find((d) => d.variable === "ctx04Location")!;
    expect(loc.rawValue).toContain("Prime");
    expect(loc.normalizedValue).toBeNull();
  });

  it("ctx05Horizon '24-36m' displays with label", () => {
    const report = gen();
    const er = report.dimensions.find((d) => d.dimension === "er")!;
    const horizon = er.drivers.find((d) => d.variable === "ctx05Horizon")!;
    expect(horizon.rawValue).toContain("24");
    expect(horizon.normalizedValue).toBeNull();
  });

  it("Ultra-luxury tier displays correctly", () => {
    const snapshot = { ...FULL_SNAPSHOT, mkt01Tier: "Ultra-luxury" };
    const report = gen(snapshot);
    const mp = report.dimensions.find((d) => d.dimension === "mp")!;
    const tier = mp.drivers.find((d) => d.variable === "mkt01Tier")!;
    expect(tier.rawValue).toBe("Ultra-Luxury");
    expect(tier.direction).toBe("positive");
  });

  it("Mid tier displays correctly and is negative direction", () => {
    const snapshot = { ...FULL_SNAPSHOT, mkt01Tier: "Mid" };
    const report = gen(snapshot);
    const mp = report.dimensions.find((d) => d.dimension === "mp")!;
    const tier = mp.drivers.find((d) => d.variable === "mkt01Tier")!;
    expect(tier.rawValue).toBe("Mid-Market");
    expect(tier.direction).toBe("negative");
  });
});

describe("V4-01: Boolean variable handling", () => {
  it("add01SampleKit=true displays as 'Yes' with positive direction", () => {
    const report = gen();
    const er = report.dimensions.find((d) => d.dimension === "er")!;
    const sampleKit = er.drivers.find((d) => d.variable === "add01SampleKit")!;
    expect(sampleKit.rawValue).toBe("Yes");
    expect(sampleKit.direction).toBe("positive");
    expect(sampleKit.normalizedValue).toBeNull();
  });

  it("add02PortfolioMode=false displays as 'No' with neutral direction", () => {
    const report = gen();
    const er = report.dimensions.find((d) => d.dimension === "er")!;
    const portfolio = er.drivers.find((d) => d.variable === "add02PortfolioMode")!;
    expect(portfolio.rawValue).toBe("No");
    expect(portfolio.direction).toBe("neutral");
  });

  it("add03DashboardExport=true displays as 'Yes'", () => {
    const report = gen();
    const er = report.dimensions.find((d) => d.dimension === "er")!;
    const dash = er.drivers.find((d) => d.variable === "add03DashboardExport")!;
    expect(dash.rawValue).toBe("Yes");
    expect(dash.direction).toBe("positive");
  });
});

describe("V4-01: Raw numeric variables", () => {
  it("fin01BudgetCap shows raw AED value, not normalized", () => {
    const report = gen();
    const ff = report.dimensions.find((d) => d.dimension === "ff")!;
    const budget = ff.drivers.find((d) => d.variable === "fin01BudgetCap")!;
    expect(budget.rawValue).toBe(850);
    expect(budget.normalizedValue).toBeNull();
    expect(budget.direction).toBe("neutral"); // raw numerics are contextual
  });

  it("ctx03Gfa shows raw sqm value, not normalized", () => {
    const report = gen();
    const ff = report.dimensions.find((d) => d.dimension === "ff")!;
    const gfa = ff.drivers.find((d) => d.variable === "ctx03Gfa")!;
    expect(gfa.rawValue).toBe(180000);
    expect(gfa.normalizedValue).toBeNull();
    expect(gfa.direction).toBe("neutral");
  });

  it("null budget cap shows N/A", () => {
    const snapshot = { ...FULL_SNAPSHOT, fin01BudgetCap: null };
    const report = gen(snapshot);
    const ff = report.dimensions.find((d) => d.dimension === "ff")!;
    const budget = ff.drivers.find((d) => d.variable === "fin01BudgetCap")!;
    expect(budget.rawValue).toBe("N/A");
  });

  it("null GFA shows N/A", () => {
    const snapshot = { ...FULL_SNAPSHOT, ctx03Gfa: null };
    const report = gen(snapshot);
    const ff = report.dimensions.find((d) => d.dimension === "ff")!;
    const gfa = ff.drivers.find((d) => d.variable === "ctx03Gfa")!;
    expect(gfa.rawValue).toBe("N/A");
  });
});

describe("V4-01: Missing/optional field fallback", () => {
  it("completely empty inputSnapshot → all N/A, zero undefined", () => {
    const report = gen({});
    for (const dim of report.dimensions) {
      for (const driver of dim.drivers) {
        expect(driver.rawValue, `${driver.variable}`).toBe("N/A");
        expect(driver.normalizedValue).toBeNull();
        expect(driver.direction).toBe("neutral");
      }
    }
  });

  it("partial inputSnapshot (only strategy vars) → missing vars show N/A", () => {
    const partial = {
      str01BrandClarity: 5,
      str02Differentiation: 4,
      str03BuyerMaturity: 3,
    };
    const report = gen(partial);
    // SA dimension should have real values for str* vars
    const sa = report.dimensions.find((d) => d.dimension === "sa")!;
    const brand = sa.drivers.find((d) => d.variable === "str01BrandClarity")!;
    expect(brand.rawValue).toBe(5);
    expect(brand.direction).toBe("positive");

    // FF dimension should have N/A for all financial vars
    const ff = report.dimensions.find((d) => d.dimension === "ff")!;
    for (const driver of ff.drivers) {
      if (!partial.hasOwnProperty(driver.variable)) {
        expect(driver.rawValue, `${driver.variable}`).toBe("N/A");
      }
    }
  });

  it("undefined values in snapshot → N/A, not 'undefined' string", () => {
    const snapshot = { ...FULL_SNAPSHOT, str01BrandClarity: undefined, mkt01Tier: undefined };
    const report = gen(snapshot);
    const sa = report.dimensions.find((d) => d.dimension === "sa")!;
    const brand = sa.drivers.find((d) => d.variable === "str01BrandClarity")!;
    expect(brand.rawValue).toBe("N/A");
    expect(String(brand.rawValue)).not.toBe("undefined");
  });
});

describe("V4-01: Ordinal variable normalization", () => {
  it("ordinal 1 → normalizedValue 0.0", () => {
    const snapshot = { ...FULL_SNAPSHOT, str01BrandClarity: 1 };
    const report = gen(snapshot);
    const sa = report.dimensions.find((d) => d.dimension === "sa")!;
    const brand = sa.drivers.find((d) => d.variable === "str01BrandClarity")!;
    expect(brand.normalizedValue).toBeCloseTo(0.0, 5);
    expect(brand.direction).toBe("negative");
  });

  it("ordinal 3 → normalizedValue 0.5", () => {
    const snapshot = { ...FULL_SNAPSHOT, str01BrandClarity: 3 };
    const report = gen(snapshot);
    const sa = report.dimensions.find((d) => d.dimension === "sa")!;
    const brand = sa.drivers.find((d) => d.variable === "str01BrandClarity")!;
    expect(brand.normalizedValue).toBeCloseTo(0.5, 5);
    expect(brand.direction).toBe("neutral");
  });

  it("ordinal 5 → normalizedValue 1.0", () => {
    const snapshot = { ...FULL_SNAPSHOT, str01BrandClarity: 5 };
    const report = gen(snapshot);
    const sa = report.dimensions.find((d) => d.dimension === "sa")!;
    const brand = sa.drivers.find((d) => d.variable === "str01BrandClarity")!;
    expect(brand.normalizedValue).toBeCloseTo(1.0, 5);
    expect(brand.direction).toBe("positive");
  });
});

describe("V4-01: Report structure completeness", () => {
  it("report has all required top-level fields", () => {
    const report = gen();
    expect(report.projectId).toBe(1);
    expect(report.compositeScore).toBe(66.6);
    expect(report.decisionStatus).toBe("Validated");
    expect(report.dimensions).toHaveLength(5);
    expect(report.topDrivers).toBeDefined();
    expect(report.topRisks).toBeDefined();
    expect(report.decisionRationale).toBeTruthy();
    expect(report.confidenceExplanation).toBeTruthy();
    expect(report.benchmarkVersionUsed).toBe("v1.0");
    expect(report.logicVersionUsed).toBe("Logic v1.0");
    expect(report.generatedAt).toBeTruthy();
  });

  it("each dimension has label, score, weight, summary, topPositive, topNegative", () => {
    const report = gen();
    for (const dim of report.dimensions) {
      expect(dim.label).toBeTruthy();
      expect(typeof dim.score).toBe("number");
      expect(typeof dim.weight).toBe("number");
      expect(dim.summary).toBeTruthy();
      expect(dim.topPositive).toBeTruthy();
      expect(dim.topNegative).toBeTruthy();
    }
  });

  it("dimension labels match expected names", () => {
    const report = gen();
    const labels = report.dimensions.map((d) => d.label);
    expect(labels).toContain("Strategic Alignment");
    expect(labels).toContain("Financial Feasibility");
    expect(labels).toContain("Market Positioning");
    expect(labels).toContain("Design & Specification");
    expect(labels).toContain("Execution Readiness");
  });

  it("penalties are included in decision rationale", () => {
    const penaltyScore = {
      ...SCORE_DATA,
      penalties: [{ rule: "low_budget", points: 5, reason: "Budget below threshold" }],
    };
    const report = generateExplainabilityReport(1, FULL_SNAPSHOT, penaltyScore, "v1.0", "Logic v1.0");
    expect(report.decisionRationale).toContain("penalty");
    expect(report.decisionRationale).toContain("Budget below threshold");
  });
});
