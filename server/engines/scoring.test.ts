import { describe, expect, it } from "vitest";
import { normalizeInputs, normalizeOrdinal } from "./normalization";
import {
  computeStrategicAlignment,
  computeFinancialFeasibility,
  computeMarketPositioning,
  computeDifferentiationStrength,
  computeExecutionRisk,
  computeComposite,
  computeRiskScore,
  classifyDecision,
  computeConfidence,
  computePenalties,
  generateConditionalActions,
  computeVariableContributions,
  computeROI,
  evaluate,
  type EvaluationConfig,
} from "./scoring";
import type {
  ProjectInputs,
  DimensionScores,
  DimensionWeights,
} from "../../shared/miyar-types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const MIDMARKET: ProjectInputs = {
  ctx01Typology: "Residential",
  ctx02Scale: "Large",
  ctx03Gfa: 450000,
  ctx04Location: "Secondary",
  ctx05Horizon: "12-24m",
  str01BrandClarity: 3,
  str02Differentiation: 3,
  str03BuyerMaturity: 3,
  mkt01Tier: "Mid",
  mkt02Competitor: 4,
  mkt03Trend: 3,
  fin01BudgetCap: 280,
  fin02Flexibility: 2,
  fin03ShockTolerance: 2,
  fin04SalesPremium: 2,
  des01Style: "Modern",
  des02MaterialLevel: 2,
  des03Complexity: 2,
  des04Experience: 3,
  des05Sustainability: 2,
  exe01SupplyChain: 3,
  exe02Contractor: 3,
  exe03Approvals: 3,
  exe04QaMaturity: 3,
  add01SampleKit: false,
  add02PortfolioMode: false,
  add03DashboardExport: true,
};

const PREMIUM: ProjectInputs = {
  ctx01Typology: "Residential",
  ctx02Scale: "Medium",
  ctx03Gfa: 180000,
  ctx04Location: "Prime",
  ctx05Horizon: "24-36m",
  str01BrandClarity: 5,
  str02Differentiation: 5,
  str03BuyerMaturity: 5,
  mkt01Tier: "Ultra-luxury",
  mkt02Competitor: 3,
  mkt03Trend: 4,
  fin01BudgetCap: 850,
  fin02Flexibility: 4,
  fin03ShockTolerance: 4,
  fin04SalesPremium: 5,
  des01Style: "Contemporary",
  des02MaterialLevel: 5,
  des03Complexity: 4,
  des04Experience: 5,
  des05Sustainability: 3,
  exe01SupplyChain: 4,
  exe02Contractor: 4,
  exe03Approvals: 3,
  exe04QaMaturity: 4,
  add01SampleKit: true,
  add02PortfolioMode: false,
  add03DashboardExport: true,
};

const W: DimensionWeights = { sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.15, er: 0.20 };

const VW = {
  sa: { str01: 0.35, str03: 0.25, compatVisionMarket: 0.25, compatVisionDesign: 0.15 },
  ff: { budgetFit: 0.45, fin02: 0.20, executionResilience: 0.20, costStability: 0.15 },
  mp: { marketFit: 0.35, differentiationPressure: 0.25, des04: 0.20, trendFit: 0.20 },
  ds: { str02: 0.30, competitorInverse: 0.25, des04: 0.25, des02: 0.20 },
  er: { executionResilience: 0.35, supplyChainInverse: 0.25, complexityInverse: 0.20, approvalsInverse: 0.20 },
};

const CFG: EvaluationConfig = {
  dimensionWeights: W,
  variableWeights: VW,
  penaltyConfig: {},
  expectedCost: 300,
  benchmarkCount: 10,
  overrideRate: 0,
};

// ─── Normalization ──────────────────────────────────────────────────────────

describe("normalizeOrdinal", () => {
  it("maps 1→0, 3→0.5, 5→1", () => {
    expect(normalizeOrdinal(1)).toBeCloseTo(0, 2);
    expect(normalizeOrdinal(3)).toBeCloseTo(0.5, 2);
    expect(normalizeOrdinal(5)).toBeCloseTo(1, 2);
  });
  it("clamps out-of-range values", () => {
    expect(normalizeOrdinal(0)).toBe(0);
    expect(normalizeOrdinal(6)).toBe(1);
  });
});

describe("normalizeInputs", () => {
  it("all values in [0,1]", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    for (const v of Object.values(n)) {
      if (typeof v === "number") {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
  it("premium brand clarity > mid-market", () => {
    const nM = normalizeInputs(MIDMARKET, 300);
    const nP = normalizeInputs(PREMIUM, 800);
    expect(nP.str01_n).toBeGreaterThan(nM.str01_n);
  });
  it("premium material level > mid-market", () => {
    const nM = normalizeInputs(MIDMARKET, 300);
    const nP = normalizeInputs(PREMIUM, 800);
    expect(nP.des02_n).toBeGreaterThan(nM.des02_n);
  });
});

// ─── Dimension Scoring ──────────────────────────────────────────────────────

describe("dimension scoring", () => {
  it("SA in [0,100]", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const sa = computeStrategicAlignment(n, VW.sa);
    expect(sa).toBeGreaterThanOrEqual(0);
    expect(sa).toBeLessThanOrEqual(100);
  });
  it("FF in [0,100]", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const ff = computeFinancialFeasibility(n, VW.ff);
    expect(ff).toBeGreaterThanOrEqual(0);
    expect(ff).toBeLessThanOrEqual(100);
  });
  it("MP in [0,100]", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const mp = computeMarketPositioning(n, VW.mp);
    expect(mp).toBeGreaterThanOrEqual(0);
    expect(mp).toBeLessThanOrEqual(100);
  });
  it("DS in [0,100]", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const ds = computeDifferentiationStrength(n, VW.ds);
    expect(ds).toBeGreaterThanOrEqual(0);
    expect(ds).toBeLessThanOrEqual(100);
  });
  it("ER in [0,100]", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const er = computeExecutionRisk(n, VW.er);
    expect(er).toBeGreaterThanOrEqual(0);
    expect(er).toBeLessThanOrEqual(100);
  });
  it("premium SA > mid-market SA", () => {
    const nM = normalizeInputs(MIDMARKET, 300);
    const nP = normalizeInputs(PREMIUM, 800);
    expect(computeStrategicAlignment(nP, VW.sa)).toBeGreaterThan(
      computeStrategicAlignment(nM, VW.sa)
    );
  });
});

// ─── Composite ──────────────────────────────────────────────────────────────

describe("computeComposite", () => {
  const dims: DimensionScores = { sa: 70, ff: 65, mp: 60, ds: 55, er: 75 };
  it("in [0,100] with no penalties", () => {
    const c = computeComposite(dims, W, []);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(100);
  });
  it("penalties reduce score", () => {
    const base = computeComposite(dims, W, []);
    const penalized = computeComposite(dims, W, [
      { id: "P1", trigger: "t", effect: -10, description: "d" },
    ]);
    expect(penalized).toBeLessThan(base);
  });
  it("never below 0", () => {
    const low: DimensionScores = { sa: 10, ff: 10, mp: 10, ds: 10, er: 10 };
    const c = computeComposite(low, W, [
      { id: "P1", trigger: "t", effect: -50, description: "d" },
    ]);
    expect(c).toBeGreaterThanOrEqual(0);
  });
});

// ─── Risk Score ─────────────────────────────────────────────────────────────

describe("computeRiskScore", () => {
  it("in [0,100]", () => {
    const dims: DimensionScores = { sa: 70, ff: 65, mp: 60, ds: 55, er: 75 };
    const n = normalizeInputs(MIDMARKET, 300);
    expect(computeRiskScore(dims, n)).toBeGreaterThanOrEqual(0);
    expect(computeRiskScore(dims, n)).toBeLessThanOrEqual(100);
  });
});

// ─── Decision Classification ────────────────────────────────────────────────

describe("classifyDecision", () => {
  it("validated: high score + low risk", () => {
    expect(classifyDecision(80, 30)).toBe("validated");
  });
  it("not_validated: low composite", () => {
    expect(classifyDecision(50, 40)).toBe("not_validated");
  });
  it("not_validated: high risk", () => {
    expect(classifyDecision(70, 65)).toBe("not_validated");
  });
  it("conditional: middle range", () => {
    expect(classifyDecision(68, 50)).toBe("conditional");
  });
});

// ─── Confidence ─────────────────────────────────────────────────────────────

describe("computeConfidence", () => {
  it("in [0,100]", () => {
    const c = computeConfidence(MIDMARKET, 10, 0);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(100);
  });
  it("decreases with overrides", () => {
    const lo = computeConfidence(MIDMARKET, 10, 0);
    const hi = computeConfidence(MIDMARKET, 10, 0.5);
    expect(hi).toBeLessThan(lo);
  });
  it("increases with more benchmarks", () => {
    const few = computeConfidence(MIDMARKET, 1, 0);
    const many = computeConfidence(MIDMARKET, 10, 0);
    expect(many).toBeGreaterThan(few);
  });
});

// ─── Penalties ──────────────────────────────────────────────────────────────

describe("computePenalties", () => {
  it("P2 triggers for 'Other' style", () => {
    const inp = { ...MIDMARKET, des01Style: "Other" as any };
    const n = normalizeInputs(inp, 300);
    const { penalties } = computePenalties(inp, n, {});
    expect(penalties.some((p) => p.id === "P2")).toBe(true);
  });
  it("P2 does NOT trigger for 'Modern'", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const { penalties } = computePenalties(MIDMARKET, n, {});
    expect(penalties.some((p) => p.id === "P2")).toBe(false);
  });
});

// ─── Conditional Actions ────────────────────────────────────────────────────

describe("generateConditionalActions", () => {
  it("FIN_SEVERE flag → action", () => {
    const dims: DimensionScores = { sa: 70, ff: 65, mp: 60, ds: 55, er: 75 };
    const a = generateConditionalActions(dims, ["FIN_SEVERE"]);
    expect(a.some((x) => x.trigger === "FIN_SEVERE")).toBe(true);
  });
  it("LOW_SA when SA < 60", () => {
    const dims: DimensionScores = { sa: 45, ff: 65, mp: 60, ds: 55, er: 75 };
    const a = generateConditionalActions(dims, []);
    expect(a.some((x) => x.trigger === "LOW_SA")).toBe(true);
  });
  it("empty when healthy", () => {
    const dims: DimensionScores = { sa: 80, ff: 75, mp: 70, ds: 65, er: 80 };
    expect(generateConditionalActions(dims, []).length).toBe(0);
  });
});

// ─── Variable Contributions ─────────────────────────────────────────────────

describe("computeVariableContributions", () => {
  it("returns 5 dimensions", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const c = computeVariableContributions(n, VW);
    expect(Object.keys(c)).toEqual(["sa", "ff", "mp", "ds", "er"]);
  });
  it("all values >= 0", () => {
    const n = normalizeInputs(MIDMARKET, 300);
    const c = computeVariableContributions(n, VW);
    for (const dim of Object.values(c)) {
      for (const v of Object.values(dim)) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─── ROI ────────────────────────────────────────────────────────────────────

describe("computeROI", () => {
  it("positive total value", () => {
    const r = computeROI(MIDMARKET, 70, 50000);
    expect(r.totalValue).toBeGreaterThan(0);
    expect(r.roiMultiple).toBeGreaterThan(0);
  });
  it("higher score → higher ROI", () => {
    const lo = computeROI(MIDMARKET, 40, 50000);
    const hi = computeROI(MIDMARKET, 90, 50000);
    expect(hi.totalValue).toBeGreaterThan(lo.totalValue);
  });
  it("total = sum of components", () => {
    const r = computeROI(MIDMARKET, 65, 150000);
    const sum = r.reworkAvoided + r.procurementSavings + r.timeValueGain + r.specEfficiency + r.positioningPremium;
    expect(r.totalValue).toBeCloseTo(sum, 0);
  });
  it("includes all fields", () => {
    const r = computeROI(MIDMARKET, 70, 50000);
    for (const k of ["reworkAvoided", "procurementSavings", "timeValueGain", "specEfficiency", "positioningPremium", "totalValue", "fee", "netROI", "roiMultiple"]) {
      expect(r).toHaveProperty(k);
    }
  });
});

// ─── Full Pipeline ──────────────────────────────────────────────────────────

describe("evaluate (full pipeline)", () => {
  it("mid-market: complete result", () => {
    const r = evaluate(MIDMARKET, CFG);
    expect(r.compositeScore).toBeGreaterThan(0);
    expect(r.compositeScore).toBeLessThanOrEqual(100);
    expect(r.riskScore).toBeGreaterThanOrEqual(0);
    expect(r.rasScore).toBeGreaterThanOrEqual(0);
    expect(r.confidenceScore).toBeGreaterThan(0);
    expect(["validated", "conditional", "not_validated"]).toContain(r.decisionStatus);
    expect(r.dimensions).toBeDefined();
    expect(r.variableContributions).toBeDefined();
    expect(r.inputSnapshot).toBeDefined();
  });
  it("premium: complete result", () => {
    const r = evaluate(PREMIUM, { ...CFG, expectedCost: 800 });
    expect(r.compositeScore).toBeGreaterThan(0);
    expect(r.decisionStatus).toBeDefined();
  });
  it("premium composite > mid-market composite", () => {
    const rM = evaluate(MIDMARKET, CFG);
    const rP = evaluate(PREMIUM, { ...CFG, expectedCost: 800 });
    expect(rP.compositeScore).toBeGreaterThan(rM.compositeScore);
  });
  it("deterministic: same in → same out", () => {
    const r1 = evaluate(MIDMARKET, CFG);
    const r2 = evaluate(MIDMARKET, CFG);
    expect(r1.compositeScore).toBe(r2.compositeScore);
    expect(r1.riskScore).toBe(r2.riskScore);
    expect(r1.rasScore).toBe(r2.rasScore);
    expect(r1.decisionStatus).toBe(r2.decisionStatus);
  });
});
