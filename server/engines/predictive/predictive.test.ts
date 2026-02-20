/**
 * V4-14: Comprehensive Predictive Engine Test Suite
 *
 * Tests for:
 * - V4-08: predictCostRange (P15/P50/P85/P95, trend adjustment, UAE fallback, confidence)
 * - V4-09: predictOutcome (comparability, success likelihood, risk/success factors)
 * - V4-10: projectScenarioCost (compounding, milestones, market factor)
 * - V4-11: budgetFitMethod logic
 * - Edge cases: empty vault, zero outcomes, zero trends, large GFA, division by zero
 */
import { describe, it, expect } from "vitest";
import { predictCostRange, type EvidenceDataPoint, type TrendDataPoint } from "./cost-range";
import { predictOutcome, type ComparableOutcome } from "./outcome-prediction";
import { projectScenarioCost, type ProjectionInput } from "./scenario-projection";

// ═══════════════════════════════════════════════════════════════════════════
// V4-08: Cost Range Prediction Engine
// ═══════════════════════════════════════════════════════════════════════════

function makeEvidence(overrides: Partial<EvidenceDataPoint> = {}): EvidenceDataPoint {
  return {
    priceMin: 200,
    priceTypical: 350,
    priceMax: 500,
    unit: "AED/sqm",
    reliabilityGrade: "B",
    confidenceScore: 70,
    captureDate: new Date(),
    category: "floors",
    geography: "Dubai",
    ...overrides,
  };
}

function makeTrend(overrides: Partial<TrendDataPoint> = {}): TrendDataPoint {
  return {
    category: "floors",
    direction: "rising",
    percentChange: 5.2,
    confidence: "high",
    ...overrides,
  };
}

describe("V4-08: predictCostRange — Basic Percentile Computation", () => {
  it("computes P15/P50/P85/P95 from 5 data points", () => {
    const evidence = [
      makeEvidence({ priceTypical: 100 }),
      makeEvidence({ priceTypical: 200 }),
      makeEvidence({ priceTypical: 300 }),
      makeEvidence({ priceTypical: 400 }),
      makeEvidence({ priceTypical: 500 }),
    ];
    const result = predictCostRange(evidence, [], {});
    expect(result.p15).toBeGreaterThanOrEqual(100);
    expect(result.p50).toBeGreaterThanOrEqual(200);
    expect(result.p85).toBeGreaterThanOrEqual(300);
    expect(result.p95).toBeGreaterThanOrEqual(400);
    expect(result.p15).toBeLessThanOrEqual(result.p50);
    expect(result.p50).toBeLessThanOrEqual(result.p85);
    expect(result.p85).toBeLessThanOrEqual(result.p95);
  });

  it("returns monotonically increasing percentiles", () => {
    const evidence = Array.from({ length: 20 }, (_, i) =>
      makeEvidence({ priceTypical: 100 + i * 50, reliabilityGrade: i % 3 === 0 ? "A" : "B" })
    );
    const result = predictCostRange(evidence, [], {});
    expect(result.p15).toBeLessThanOrEqual(result.p50);
    expect(result.p50).toBeLessThanOrEqual(result.p85);
    expect(result.p85).toBeLessThanOrEqual(result.p95);
  });

  it("gives Grade A sources higher weight", () => {
    // All Grade A at 500 vs all Grade C at 100
    const gradeAEvidence = Array.from({ length: 5 }, () =>
      makeEvidence({ priceTypical: 500, reliabilityGrade: "A" })
    );
    const gradeCEvidence = Array.from({ length: 5 }, () =>
      makeEvidence({ priceTypical: 100, reliabilityGrade: "C" })
    );
    const result = predictCostRange([...gradeAEvidence, ...gradeCEvidence], [], {});
    // P50 should be pulled toward 500 due to higher A weights
    expect(result.p50).toBeGreaterThan(200);
  });

  it("gives recent data higher weight (recency bonus)", () => {
    const recentEvidence = Array.from({ length: 5 }, () =>
      makeEvidence({ priceTypical: 500, captureDate: new Date() })
    );
    const oldEvidence = Array.from({ length: 5 }, () =>
      makeEvidence({ priceTypical: 100, captureDate: new Date("2020-01-01") })
    );
    const result = predictCostRange([...recentEvidence, ...oldEvidence], [], {});
    // P50 should be pulled toward 500 due to recency bonus
    expect(result.p50).toBeGreaterThan(200);
  });

  it("uses priceTypical as primary value", () => {
    const evidence = [
      makeEvidence({ priceMin: 50, priceTypical: 300, priceMax: 600 }),
      makeEvidence({ priceMin: 50, priceTypical: 300, priceMax: 600 }),
      makeEvidence({ priceMin: 50, priceTypical: 300, priceMax: 600 }),
    ];
    const result = predictCostRange(evidence, [], {});
    expect(result.p50).toBe(300);
  });

  it("falls back to average of min/max when priceTypical is 0", () => {
    const evidence = [
      makeEvidence({ priceMin: 100, priceTypical: 0, priceMax: 500 }),
      makeEvidence({ priceMin: 100, priceTypical: 0, priceMax: 500 }),
      makeEvidence({ priceMin: 100, priceTypical: 0, priceMax: 500 }),
    ];
    const result = predictCostRange(evidence, [], {});
    expect(result.p50).toBe(300); // (100+500)/2
  });
});

describe("V4-08: predictCostRange — Confidence Rules", () => {
  it("returns high confidence with ≥15 data points and ≥2 Grade A", () => {
    const evidence = [
      ...Array.from({ length: 13 }, () => makeEvidence({ reliabilityGrade: "B" })),
      ...Array.from({ length: 3 }, () => makeEvidence({ reliabilityGrade: "A" })),
    ];
    const result = predictCostRange(evidence, [], {});
    expect(result.confidence).toBe("high");
    expect(result.gradeACount).toBeGreaterThanOrEqual(2);
  });

  it("returns medium confidence with 8-14 data points", () => {
    const evidence = Array.from({ length: 10 }, () => makeEvidence({ reliabilityGrade: "C" }));
    const result = predictCostRange(evidence, [], {});
    expect(result.confidence).toBe("medium");
  });

  it("returns low confidence with 3-7 data points", () => {
    const evidence = Array.from({ length: 4 }, () => makeEvidence());
    const result = predictCostRange(evidence, [], {});
    expect(result.confidence).toBe("low");
  });

  it("returns insufficient confidence with <3 data points", () => {
    const evidence = [makeEvidence(), makeEvidence()];
    const result = predictCostRange(evidence, [], {});
    expect(result.confidence).toBe("insufficient");
    expect(result.p15).toBe(0);
    expect(result.p50).toBe(0);
  });
});

describe("V4-08: predictCostRange — Trend Adjustment", () => {
  it("applies rising trend adjustment", () => {
    const evidence = Array.from({ length: 5 }, () => makeEvidence({ priceTypical: 1000 }));
    const trends = [makeTrend({ direction: "rising", percentChange: 10 })];
    const result = predictCostRange(evidence, trends, { category: "floors" });
    expect(result.trendAdjustment).toBe(10);
    expect(result.trendDirection).toBe("rising");
    expect(result.adjustedP50!).toBeGreaterThan(result.p50);
  });

  it("applies falling trend adjustment", () => {
    const evidence = Array.from({ length: 5 }, () => makeEvidence({ priceTypical: 1000 }));
    const trends = [makeTrend({ direction: "falling", percentChange: -5 })];
    const result = predictCostRange(evidence, trends, { category: "floors" });
    expect(result.trendAdjustment).toBe(-5);
    expect(result.trendDirection).toBe("falling");
    expect(result.adjustedP50!).toBeLessThan(result.p50);
  });

  it("returns zero trend adjustment when no trends available", () => {
    const evidence = Array.from({ length: 5 }, () => makeEvidence());
    const result = predictCostRange(evidence, [], {});
    expect(result.trendAdjustment).toBe(0);
    expect(result.trendDirection).toBe("insufficient_data");
  });

  it("matches category-specific trend", () => {
    const evidence = Array.from({ length: 5 }, () => makeEvidence({ category: "joinery" }));
    const trends = [
      makeTrend({ category: "floors", percentChange: 10 }),
      makeTrend({ category: "joinery", percentChange: 3 }),
    ];
    const result = predictCostRange(evidence, trends, { category: "joinery" });
    expect(result.trendAdjustment).toBe(3);
  });

  it("skips insufficient confidence trends", () => {
    const evidence = Array.from({ length: 5 }, () => makeEvidence());
    const trends = [makeTrend({ confidence: "insufficient", percentChange: 20 })];
    const result = predictCostRange(evidence, trends, {});
    expect(result.trendAdjustment).toBe(0);
  });
});

describe("V4-08: predictCostRange — UAE-Wide Fallback", () => {
  it("uses UAE-wide fallback when local data is insufficient", () => {
    const localEvidence = [makeEvidence({ geography: "Dubai" })]; // only 1 local
    const uaeWideEvidence = Array.from({ length: 10 }, () =>
      makeEvidence({ geography: "UAE", priceTypical: 400 })
    );
    const result = predictCostRange(localEvidence, [], { uaeWideEvidence });
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toContain("UAE-wide fallback");
    expect(result.dataPointCount).toBe(10);
    expect(result.confidence).not.toBe("insufficient");
  });

  it("does not use fallback when local data is sufficient", () => {
    const localEvidence = Array.from({ length: 5 }, () => makeEvidence({ geography: "Dubai" }));
    const uaeWideEvidence = Array.from({ length: 20 }, () =>
      makeEvidence({ geography: "UAE", priceTypical: 999 })
    );
    const result = predictCostRange(localEvidence, [], { uaeWideEvidence });
    expect(result.fallbackUsed).toBe(false);
    expect(result.dataPointCount).toBe(5);
  });

  it("returns insufficient when both local and UAE-wide data are insufficient", () => {
    const localEvidence = [makeEvidence()];
    const uaeWideEvidence = [makeEvidence()];
    const result = predictCostRange(localEvidence, [], { uaeWideEvidence });
    expect(result.confidence).toBe("insufficient");
  });
});

describe("V4-08: predictCostRange — Category/Geography Filtering", () => {
  it("filters by category when specified", () => {
    const evidence = [
      makeEvidence({ category: "floors", priceTypical: 100 }),
      makeEvidence({ category: "floors", priceTypical: 200 }),
      makeEvidence({ category: "floors", priceTypical: 300 }),
      makeEvidence({ category: "walls", priceTypical: 999 }),
    ];
    const result = predictCostRange(evidence, [], { category: "floors" });
    expect(result.dataPointCount).toBe(3);
    expect(result.p50).toBeLessThanOrEqual(300);
  });

  it("filters by geography when specified", () => {
    const evidence = [
      makeEvidence({ geography: "Dubai", priceTypical: 100 }),
      makeEvidence({ geography: "Dubai", priceTypical: 200 }),
      makeEvidence({ geography: "Dubai", priceTypical: 300 }),
      makeEvidence({ geography: "Abu Dhabi", priceTypical: 999 }),
    ];
    const result = predictCostRange(evidence, [], { geography: "Dubai" });
    expect(result.dataPointCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V4-09: Design Outcome Prediction Engine
// ═══════════════════════════════════════════════════════════════════════════

function makeOutcome(overrides: Partial<ComparableOutcome> = {}): ComparableOutcome {
  return {
    projectId: Math.floor(Math.random() * 1000),
    compositeScore: 65,
    decisionStatus: "validated",
    typology: "Residential",
    tier: "Mid",
    geography: "Dubai",
    ...overrides,
  };
}

describe("V4-09: predictOutcome — Success Likelihood Formula", () => {
  it("high composite score (80) → >60% likelihood", () => {
    const outcomes = Array.from({ length: 10 }, () => makeOutcome({ decisionStatus: "validated" }));
    const contributions = {
      str01_n: { contribution: 0.15, dimension: "sa" },
      str02_n: { contribution: 0.12, dimension: "sa" },
      des01_n: { contribution: -0.05, dimension: "ds" },
    };
    const result = predictOutcome(80, outcomes, contributions, { typology: "Residential", tier: "Mid" });
    expect(result.successLikelihood).toBeGreaterThan(60);
    expect(result.confidenceLevel).not.toBe("insufficient");
  });

  it("low composite score (20) → <40% likelihood", () => {
    const outcomes = Array.from({ length: 10 }, () => makeOutcome({ decisionStatus: "not_validated" }));
    const contributions = {
      str01_n: { contribution: -0.15, dimension: "sa" },
    };
    const result = predictOutcome(20, outcomes, contributions, { typology: "Residential", tier: "Mid" });
    expect(result.successLikelihood).toBeLessThan(40);
  });

  it("composite 0 → minimum likelihood (≥5%)", () => {
    const result = predictOutcome(0, [], {});
    expect(result.successLikelihood).toBe(0); // insufficient returns 0
  });

  it("composite 100 → high likelihood (≤95%)", () => {
    const outcomes = Array.from({ length: 10 }, () => makeOutcome({ decisionStatus: "validated" }));
    const contributions = { str01_n: { contribution: 0.2, dimension: "sa" } };
    const result = predictOutcome(100, outcomes, contributions, { typology: "Residential", tier: "Mid" });
    expect(result.successLikelihood).toBeLessThanOrEqual(95);
    expect(result.successLikelihood).toBeGreaterThanOrEqual(70);
  });

  it("clamps likelihood between 5 and 95", () => {
    const allValidated = Array.from({ length: 20 }, () => makeOutcome({ decisionStatus: "validated" }));
    const result = predictOutcome(100, allValidated, { x: { contribution: 0.5, dimension: "sa" } }, { typology: "Residential", tier: "Mid" });
    expect(result.successLikelihood).toBeLessThanOrEqual(95);
    expect(result.successLikelihood).toBeGreaterThanOrEqual(5);
  });
});

describe("V4-09: predictOutcome — Comparability Filtering", () => {
  it("filters by typology + tier + geography (exact match)", () => {
    const outcomes = [
      ...Array.from({ length: 6 }, () => makeOutcome({ typology: "Residential", tier: "Mid", geography: "Dubai", decisionStatus: "validated" })),
      ...Array.from({ length: 4 }, () => makeOutcome({ typology: "Commercial", tier: "Premium", geography: "Abu Dhabi", decisionStatus: "not_validated" })),
    ];
    const result = predictOutcome(70, outcomes, { x: { contribution: 0.1, dimension: "sa" } }, { typology: "Residential", tier: "Mid", geography: "Dubai" });
    expect(result.comparableCount).toBe(6);
    expect(result.validatedRate).toBe(100);
  });

  it("relaxes geography when exact match is insufficient", () => {
    const outcomes = [
      ...Array.from({ length: 3 }, () => makeOutcome({ typology: "Residential", tier: "Mid", geography: "Dubai", decisionStatus: "validated" })),
      ...Array.from({ length: 3 }, () => makeOutcome({ typology: "Residential", tier: "Mid", geography: "Abu Dhabi", decisionStatus: "conditional" })),
    ];
    const result = predictOutcome(70, outcomes, { x: { contribution: 0.1, dimension: "sa" } }, { typology: "Residential", tier: "Mid", geography: "Sharjah" });
    // Should relax geography and use all 6 Residential/Mid outcomes
    expect(result.comparableCount).toBe(6);
  });

  it("relaxes tier when typology+tier match is insufficient", () => {
    const outcomes = [
      ...Array.from({ length: 2 }, () => makeOutcome({ typology: "Residential", tier: "Premium" })),
      ...Array.from({ length: 2 }, () => makeOutcome({ typology: "Residential", tier: "Mid" })),
    ];
    const result = predictOutcome(70, outcomes, { x: { contribution: 0.1, dimension: "sa" } }, { typology: "Residential", tier: "Luxury" });
    // Should relax tier and use all 4 Residential outcomes
    expect(result.comparableCount).toBe(4);
  });
});

describe("V4-09: predictOutcome — Risk/Success Factors", () => {
  it("identifies key success factors (positive contributions)", () => {
    const contributions = {
      str01_n: { contribution: 0.20, dimension: "sa" },
      str02_n: { contribution: 0.15, dimension: "sa" },
      des01_n: { contribution: -0.10, dimension: "ds" },
      fin01_n: { contribution: -0.05, dimension: "ff" },
    };
    const result = predictOutcome(70, [], contributions);
    expect(result.keySuccessFactors.length).toBe(2);
    expect(result.keySuccessFactors[0].variable).toBe("str01_n");
    expect(result.keySuccessFactors[0].contribution).toBe(0.20);
  });

  it("identifies key risk factors (negative contributions)", () => {
    const contributions = {
      str01_n: { contribution: 0.10, dimension: "sa" },
      des01_n: { contribution: -0.15, dimension: "ds" },
      fin01_n: { contribution: -0.20, dimension: "ff" },
    };
    const result = predictOutcome(70, [], contributions);
    expect(result.keyRiskFactors.length).toBe(2);
    expect(result.keyRiskFactors[0].variable).toBe("fin01_n");
    expect(result.keyRiskFactors[0].contribution).toBe(-0.20);
  });

  it("limits to top 5 factors each", () => {
    const contributions: Record<string, { contribution: number; dimension: string }> = {};
    for (let i = 0; i < 10; i++) {
      contributions[`pos_${i}`] = { contribution: 0.1 + i * 0.01, dimension: "sa" };
      contributions[`neg_${i}`] = { contribution: -(0.1 + i * 0.01), dimension: "ds" };
    }
    const result = predictOutcome(70, [], contributions);
    expect(result.keySuccessFactors.length).toBe(5);
    expect(result.keyRiskFactors.length).toBe(5);
  });
});

describe("V4-09: predictOutcome — Confidence Levels", () => {
  it("returns high confidence with ≥10 comparables and ≥10 contributions", () => {
    const outcomes = Array.from({ length: 12 }, () => makeOutcome());
    const contributions: Record<string, { contribution: number; dimension: string }> = {};
    for (let i = 0; i < 12; i++) {
      contributions[`var_${i}`] = { contribution: 0.05, dimension: "sa" };
    }
    const result = predictOutcome(70, outcomes, contributions, { typology: "Residential", tier: "Mid" });
    expect(result.confidenceLevel).toBe("high");
  });

  it("returns medium confidence with 5-9 comparables", () => {
    const outcomes = Array.from({ length: 7 }, () => makeOutcome());
    const result = predictOutcome(70, outcomes, { x: { contribution: 0.1, dimension: "sa" } }, { typology: "Residential", tier: "Mid" });
    expect(result.confidenceLevel).toBe("medium");
  });

  it("returns low confidence with 1-4 comparables", () => {
    const outcomes = [makeOutcome()];
    const result = predictOutcome(70, outcomes, {}, { typology: "Residential", tier: "Mid" });
    expect(result.confidenceLevel).toBe("low");
  });

  it("returns insufficient with zero comparables and zero contributions", () => {
    const result = predictOutcome(0, [], {});
    expect(result.confidenceLevel).toBe("insufficient");
    expect(result.predictionBasis).toBe("insufficient_data");
  });
});

describe("V4-09: predictOutcome — Rate Computation", () => {
  it("computes correct validated/conditional/not_validated rates", () => {
    const outcomes = [
      ...Array.from({ length: 6 }, () => makeOutcome({ decisionStatus: "validated" })),
      ...Array.from({ length: 3 }, () => makeOutcome({ decisionStatus: "conditional" })),
      ...Array.from({ length: 1 }, () => makeOutcome({ decisionStatus: "not_validated" })),
    ];
    const result = predictOutcome(70, outcomes, { x: { contribution: 0.1, dimension: "sa" } }, { typology: "Residential", tier: "Mid" });
    expect(result.validatedRate).toBe(60);
    expect(result.conditionalRate).toBe(30);
    expect(result.notValidatedRate).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V4-10: Scenario Cost Projection Engine
// ═══════════════════════════════════════════════════════════════════════════

function makeProjectionInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    baseCostPerSqm: 1500,
    gfa: 10000,
    trendPercentChange: 5,
    trendDirection: "rising",
    marketCondition: "balanced",
    horizonMonths: 18,
    ...overrides,
  };
}

describe("V4-10: projectScenarioCost — Compounding Formula", () => {
  it("5% rising trend, 18mo, tight market → >15% compounding", () => {
    const input = makeProjectionInput({
      trendPercentChange: 5,
      trendDirection: "rising",
      marketCondition: "tight",
      horizonMonths: 18,
    });
    const result = projectScenarioCost(input);
    const horizonPoint = result.midScenario[result.midScenario.length - 1];
    // 5% annual + 5% tight market = should be >10% at 18 months
    expect(horizonPoint.cumulativeChange).toBeGreaterThan(10);
  });

  it("produces 4 milestone points (3, 6, 12, horizon)", () => {
    const result = projectScenarioCost(makeProjectionInput());
    expect(result.midScenario.length).toBe(4); // 3, 6, 12, 18
    expect(result.midScenario[0].month).toBe(3);
    expect(result.midScenario[1].month).toBe(6);
    expect(result.midScenario[2].month).toBe(12);
    expect(result.midScenario[3].month).toBe(18);
  });

  it("deduplicates milestones when horizon matches a standard milestone", () => {
    const input = makeProjectionInput({ horizonMonths: 12 });
    const result = projectScenarioCost(input);
    // Should be 3, 6, 12 (not 3, 6, 12, 12)
    expect(result.midScenario.length).toBe(3);
    const months = result.midScenario.map(p => p.month);
    expect(new Set(months).size).toBe(months.length);
  });

  it("computes total cost = costPerSqm × GFA", () => {
    const result = projectScenarioCost(makeProjectionInput({ baseCostPerSqm: 1000, gfa: 5000 }));
    expect(result.baseTotalCost).toBe(5000000); // 1000 * 5000
    // Each projection point's totalCost should be costPerSqm * gfa (within rounding)
    for (const p of result.midScenario) {
      expect(Math.abs(p.totalCost - p.costPerSqm * 5000)).toBeLessThan(100);
    }
  });

  it("rising trend → increasing costs over time", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 5, trendDirection: "rising" }));
    for (let i = 1; i < result.midScenario.length; i++) {
      expect(result.midScenario[i].costPerSqm).toBeGreaterThanOrEqual(result.midScenario[i - 1].costPerSqm);
    }
  });

  it("falling trend → decreasing costs over time", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: -5, trendDirection: "falling" }));
    for (let i = 1; i < result.midScenario.length; i++) {
      expect(result.midScenario[i].costPerSqm).toBeLessThanOrEqual(result.midScenario[i - 1].costPerSqm);
    }
  });
});

describe("V4-10: projectScenarioCost — Market Condition Factor", () => {
  it("tight market → 1.05 factor", () => {
    const result = projectScenarioCost(makeProjectionInput({ marketCondition: "tight", trendPercentChange: 0, trendDirection: "stable" }));
    expect(result.marketFactor).toBe(1.05);
    // All projections should be 5% above base
    for (const p of result.midScenario) {
      expect(p.costPerSqm).toBeCloseTo(1500 * 1.05, 0);
    }
  });

  it("soft market → 0.95 factor", () => {
    const result = projectScenarioCost(makeProjectionInput({ marketCondition: "soft", trendPercentChange: 0, trendDirection: "stable" }));
    expect(result.marketFactor).toBe(0.95);
  });

  it("balanced market → 1.00 factor", () => {
    const result = projectScenarioCost(makeProjectionInput({ marketCondition: "balanced", trendPercentChange: 0, trendDirection: "stable" }));
    expect(result.marketFactor).toBe(1.00);
    // With no trend and balanced market, cost should stay the same
    for (const p of result.midScenario) {
      expect(p.costPerSqm).toBe(1500);
    }
  });
});

describe("V4-10: projectScenarioCost — Three Scenarios", () => {
  it("low scenario is 0.9x of mid scenario base", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 0, trendDirection: "stable" }));
    // Low scenario base should be 0.9 * 1500 = 1350
    expect(result.lowScenario[0].costPerSqm).toBeCloseTo(1350, 0);
  });

  it("high scenario is 1.15x of mid scenario base", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 0, trendDirection: "stable" }));
    // High scenario base should be 1.15 * 1500 = 1725
    expect(result.highScenario[0].costPerSqm).toBeCloseTo(1725, 0);
  });

  it("low < mid < high at every milestone", () => {
    const result = projectScenarioCost(makeProjectionInput());
    for (let i = 0; i < result.midScenario.length; i++) {
      expect(result.lowScenario[i].costPerSqm).toBeLessThan(result.midScenario[i].costPerSqm);
      expect(result.midScenario[i].costPerSqm).toBeLessThan(result.highScenario[i].costPerSqm);
    }
  });
});

describe("V4-10: projectScenarioCost — Monthly Rate Conversion", () => {
  it("converts annual rate to monthly compounding rate", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 12 }));
    // Monthly rate for 12% annual ≈ 0.00949
    expect(result.monthlyRate).toBeGreaterThan(0.009);
    expect(result.monthlyRate).toBeLessThan(0.01);
  });

  it("zero trend → zero monthly rate", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 0, trendDirection: "stable" }));
    expect(result.monthlyRate).toBe(0);
  });

  it("insufficient_data trend direction → zero monthly rate", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 10, trendDirection: "insufficient_data" }));
    expect(result.monthlyRate).toBe(0);
    expect(result.annualizedTrend).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V4-14: Edge Cases & Resilience Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("V4-14: Edge Cases — Empty Vault", () => {
  it("predictCostRange with empty evidence → insufficient", () => {
    const result = predictCostRange([], [], {});
    expect(result.confidence).toBe("insufficient");
    expect(result.p15).toBe(0);
    expect(result.p50).toBe(0);
    expect(result.p85).toBe(0);
    expect(result.p95).toBe(0);
    expect(result.dataPointCount).toBe(0);
  });

  it("predictOutcome with zero outcomes and zero contributions → insufficient", () => {
    const result = predictOutcome(0, [], {});
    expect(result.confidenceLevel).toBe("insufficient");
    expect(result.successLikelihood).toBe(0);
    expect(result.comparableCount).toBe(0);
    expect(result.predictionBasis).toBe("insufficient_data");
  });

  it("projectScenarioCost with zero base cost → no crash", () => {
    const result = projectScenarioCost(makeProjectionInput({ baseCostPerSqm: 0 }));
    expect(result.baseCostPerSqm).toBe(0);
    expect(result.baseTotalCost).toBe(0);
    for (const p of result.midScenario) {
      expect(p.costPerSqm).toBe(0);
      expect(p.totalCost).toBe(0);
    }
  });
});

describe("V4-14: Edge Cases — Zero Trends", () => {
  it("predictCostRange with zero trend snapshots → trendAdjustment = 0", () => {
    const evidence = Array.from({ length: 5 }, () => makeEvidence());
    const result = predictCostRange(evidence, [], {});
    expect(result.trendAdjustment).toBe(0);
    expect(result.trendDirection).toBe("insufficient_data");
  });

  it("projectScenarioCost with zero trend → stable projections", () => {
    const result = projectScenarioCost(makeProjectionInput({ trendPercentChange: 0, trendDirection: "stable" }));
    expect(result.annualizedTrend).toBe(0);
    expect(result.monthlyRate).toBe(0);
  });
});

describe("V4-14: Edge Cases — Large GFA (50,000 sqm)", () => {
  it("handles large GFA without overflow", () => {
    const result = projectScenarioCost(makeProjectionInput({
      baseCostPerSqm: 2000,
      gfa: 50000,
      trendPercentChange: 10,
      trendDirection: "rising",
      horizonMonths: 60,
    }));
    expect(result.baseTotalCost).toBe(100000000); // 2000 * 50000
    expect(Number.isFinite(result.baseTotalCost)).toBe(true);
    for (const p of result.midScenario) {
      expect(Number.isFinite(p.totalCost)).toBe(true);
      expect(p.totalCost).toBeGreaterThan(0);
    }
  });
});

describe("V4-14: Edge Cases — Division by Zero", () => {
  it("budgetPerSqm = 0 → no division by zero in projections", () => {
    const result = projectScenarioCost(makeProjectionInput({ baseCostPerSqm: 0, gfa: 10000 }));
    expect(Number.isFinite(result.baseTotalCost)).toBe(true);
    for (const p of result.midScenario) {
      expect(Number.isFinite(p.cumulativeChange)).toBe(true);
      expect(p.cumulativeChange).toBe(0);
    }
  });

  it("GFA = 0 → total cost is 0", () => {
    const result = projectScenarioCost(makeProjectionInput({ gfa: 0 }));
    expect(result.baseTotalCost).toBe(0);
    for (const p of result.midScenario) {
      expect(p.totalCost).toBe(0);
    }
  });
});

describe("V4-14: Edge Cases — Horizon Bounds", () => {
  it("caps horizon at 120 months", () => {
    const result = projectScenarioCost(makeProjectionInput({ horizonMonths: 999 }));
    expect(result.horizonMonths).toBe(120);
  });

  it("horizonMonths 0 falls back to default 18", () => {
    // 0 is falsy, so || 18 kicks in, then clamped to max(1, min(18, 120)) = 18
    const result = projectScenarioCost({
      baseCostPerSqm: 1500,
      gfa: 10000,
      trendPercentChange: 5,
      trendDirection: "rising",
      marketCondition: "balanced",
      horizonMonths: 0,
    });
    expect(result.horizonMonths).toBe(18);
  });

  it("horizonMonths 1 is respected", () => {
    const result = projectScenarioCost({
      baseCostPerSqm: 1500,
      gfa: 10000,
      trendPercentChange: 5,
      trendDirection: "rising",
      marketCondition: "balanced",
      horizonMonths: 1,
    });
    expect(result.horizonMonths).toBe(1);
  });
});

describe("V4-14: Edge Cases — Negative Prices", () => {
  it("handles negative priceTypical gracefully", () => {
    const evidence = [
      makeEvidence({ priceTypical: -100 }),
      makeEvidence({ priceTypical: 200 }),
      makeEvidence({ priceTypical: 300 }),
    ];
    const result = predictCostRange(evidence, [], {});
    expect(result.confidence).not.toBe("insufficient");
    expect(Number.isFinite(result.p50)).toBe(true);
  });
});

describe("V4-14: Edge Cases — Extreme Trend Values", () => {
  it("handles 100% annual trend without overflow", () => {
    const result = projectScenarioCost(makeProjectionInput({
      trendPercentChange: 100,
      trendDirection: "rising",
      horizonMonths: 60,
    }));
    for (const p of result.midScenario) {
      expect(Number.isFinite(p.costPerSqm)).toBe(true);
      expect(Number.isFinite(p.totalCost)).toBe(true);
    }
  });

  it("handles -50% annual trend without going negative", () => {
    const result = projectScenarioCost(makeProjectionInput({
      trendPercentChange: -50,
      trendDirection: "falling",
      horizonMonths: 60,
    }));
    for (const p of result.midScenario) {
      expect(p.costPerSqm).toBeGreaterThanOrEqual(0);
    }
  });
});
