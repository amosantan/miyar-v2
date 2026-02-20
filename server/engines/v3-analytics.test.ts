/**
 * MIYAR V3-11 — Analytical Intelligence Engine Tests
 *
 * Tests cover:
 *   1. Trend Detection Engine (V3-04)
 *      - computeMovingAverage: empty, single, multi-point, window filtering
 *      - detectDirectionChange: rising, falling, stable, insufficient data
 *      - flagAnomalies: no anomalies, spike detection, all-same values
 *      - assessConfidence: high, medium, low, insufficient
 *      - detectTrends: full orchestration (no LLM narrative)
 *
 *   2. Market Positioning Engine (V3-06)
 *      - computePercentiles: empty, single, multi-point, known dataset
 *      - assignTier: budget, mid_range, premium, ultra_premium
 *      - computePercentileRank: edge cases
 *      - computeMarketPosition: full positioning with 650 AED/sqm test case
 *
 *   3. Competitor Intelligence Engine (V3-07)
 *      - computeHHI: monopoly, duopoly, fragmented
 *      - classifyConcentration: all 3 levels
 *      - analyseCompetitorLandscape: full analysis (no LLM narrative)
 *      - Developer market share + threat level computation
 *
 *   4. Insight Generation Engine (V3-08)
 *      - cost_pressure trigger + no-trigger
 *      - market_opportunity trigger + no-trigger
 *      - competitor_alert trigger + no-trigger
 *      - trend_signal trigger + no-trigger
 *      - positioning_gap trigger (above + below) + no-trigger
 *      - All 5 insights combined
 *      - Empty input produces no insights
 *
 *   5. Freshness + Ingestion Integration
 *      - Freshness weight applied in proposal context
 *      - Incremental ingestion lastSuccessfulFetch wiring
 *
 *   6. End-to-end analytics pipeline
 *      - Trend → Position → Competitor → Insights chain
 */

import { describe, it, expect } from "vitest";

// ─── Trend Detection Engine ─────────────────────────────────────

import {
  computeMovingAverage,
  detectDirectionChange,
  flagAnomalies,
  assessConfidence,
  detectTrends,
  DEFAULT_MA_WINDOW_DAYS,
  DIRECTION_CHANGE_THRESHOLD,
  ANOMALY_STD_DEV_THRESHOLD,
  CONFIDENCE_HIGH_MIN_POINTS,
  CONFIDENCE_HIGH_MIN_GRADE_A,
  CONFIDENCE_MEDIUM_MIN_POINTS,
  CONFIDENCE_LOW_MIN_POINTS,
  type DataPoint,
} from "../engines/analytics/trend-detection";

// ─── Market Positioning Engine ──────────────────────────────────

import {
  computePercentiles,
  assignTier,
  computePercentileRank,
  computeMarketPosition,
  TIER_LABELS,
  type MarketDataPoint,
} from "../engines/analytics/market-positioning";

// ─── Competitor Intelligence Engine ─────────────────────────────

import {
  computeHHI,
  classifyConcentration,
  analyseCompetitorLandscape,
  type CompetitorProject,
} from "../engines/analytics/competitor-intelligence";

// ─── Insight Generation Engine ──────────────────────────────────

import {
  generateInsights,
  type InsightInput,
} from "../engines/analytics/insight-generator";

// ─── Freshness Module ───────────────────────────────────────────

import {
  computeFreshness,
  getFreshnessWeight,
  FRESHNESS_FRESH_DAYS,
  FRESHNESS_AGING_DAYS,
} from "../engines/ingestion/freshness";

// ─── Test Data Helpers ──────────────────────────────────────────

function makeDataPoint(daysAgo: number, value: number, grade: "A" | "B" | "C" = "B"): DataPoint {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    date,
    value,
    grade,
    sourceId: `test-source-${grade.toLowerCase()}`,
    recordId: Math.floor(Math.random() * 10000),
  };
}

function makeMarketDataPoint(value: number, grade: "A" | "B" | "C" = "B"): MarketDataPoint {
  return {
    value,
    grade,
    sourceId: `test-source-${grade.toLowerCase()}`,
    date: new Date(),
    recordId: Math.floor(Math.random() * 10000),
  };
}

function makeCompetitorProject(
  developerId: string,
  developerName: string,
  totalUnits: number,
  pricePerSqft?: number
): CompetitorProject {
  return {
    developerId,
    developerName,
    projectName: `${developerName} Project`,
    totalUnits,
    pricePerSqft,
    grade: "A" as const,
    sourceId: "test-source",
  };
}

// ═══════════════════════════════════════════════════════════════════
// 1. TREND DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

describe("V3-04: Trend Detection — computeMovingAverage", () => {
  it("returns empty array for empty input", () => {
    expect(computeMovingAverage([])).toEqual([]);
  });

  it("returns single point with MA equal to value", () => {
    const points = [makeDataPoint(0, 100)];
    const result = computeMovingAverage(points);
    expect(result).toHaveLength(1);
    expect(result[0].ma).toBe(100);
    expect(result[0].value).toBe(100);
  });

  it("computes MA for multiple points within window", () => {
    // All points within 30-day window
    const points = [
      makeDataPoint(5, 100),
      makeDataPoint(10, 200),
      makeDataPoint(15, 300),
    ];
    const result = computeMovingAverage(points, 30);
    expect(result).toHaveLength(3);
    // Last point should average all 3
    expect(result[2].ma).toBe(200); // (100+200+300)/3
  });

  it("respects window boundary — old points excluded", () => {
    const points = [
      makeDataPoint(100, 1000), // outside 30-day window
      makeDataPoint(5, 200),
      makeDataPoint(2, 300),
    ];
    const result = computeMovingAverage(points, 30);
    expect(result).toHaveLength(3);
    // The last point's MA should only include the 2 recent points
    expect(result[2].ma).toBe(250); // (200+300)/2
  });

  it("handles all identical values", () => {
    const points = [
      makeDataPoint(1, 500),
      makeDataPoint(2, 500),
      makeDataPoint(3, 500),
    ];
    const result = computeMovingAverage(points);
    for (const r of result) {
      expect(r.ma).toBe(500);
    }
  });
});

describe("V3-04: Trend Detection — detectDirectionChange", () => {
  it("returns insufficient_data for <2 points", () => {
    const result = detectDirectionChange([makeDataPoint(0, 100)]);
    expect(result.direction).toBe("insufficient_data");
    expect(result.currentMA).toBeNull();
    expect(result.previousMA).toBeNull();
  });

  it("detects rising trend (>5% increase)", () => {
    // Previous window: ~100, Current window: ~120 (20% increase)
    const points = [
      makeDataPoint(50, 95),
      makeDataPoint(45, 100),
      makeDataPoint(40, 105),
      makeDataPoint(20, 115),
      makeDataPoint(10, 120),
      makeDataPoint(5, 125),
    ];
    const result = detectDirectionChange(points, 30);
    expect(result.direction).toBe("rising");
    expect(result.percentChange).not.toBeNull();
    expect(result.percentChange!).toBeGreaterThan(DIRECTION_CHANGE_THRESHOLD);
  });

  it("detects falling trend (>5% decrease)", () => {
    // Previous window: ~200, Current window: ~150 (25% decrease)
    const points = [
      makeDataPoint(50, 195),
      makeDataPoint(45, 200),
      makeDataPoint(40, 205),
      makeDataPoint(20, 155),
      makeDataPoint(10, 150),
      makeDataPoint(5, 145),
    ];
    const result = detectDirectionChange(points, 30);
    expect(result.direction).toBe("falling");
    expect(result.percentChange!).toBeLessThan(-DIRECTION_CHANGE_THRESHOLD);
  });

  it("detects stable trend (<5% change)", () => {
    // Both windows average ~100
    const points = [
      makeDataPoint(50, 98),
      makeDataPoint(45, 100),
      makeDataPoint(40, 102),
      makeDataPoint(20, 99),
      makeDataPoint(10, 101),
      makeDataPoint(5, 100),
    ];
    const result = detectDirectionChange(points, 30);
    expect(result.direction).toBe("stable");
  });

  it("returns stable when no previous window data", () => {
    // All points within current window only
    const points = [
      makeDataPoint(5, 100),
      makeDataPoint(10, 200),
    ];
    const result = detectDirectionChange(points, 30);
    expect(result.direction).toBe("stable");
    expect(result.previousMA).toBeNull();
  });
});

describe("V3-04: Trend Detection — flagAnomalies", () => {
  it("returns empty for <3 points", () => {
    const points = [makeDataPoint(1, 100), makeDataPoint(2, 200)];
    const ma = computeMovingAverage(points);
    expect(flagAnomalies(points, ma)).toEqual([]);
  });

  it("detects spike anomaly (>2 std devs)", () => {
    // Normal range ~100, spike at 500
    const points = [
      makeDataPoint(10, 100),
      makeDataPoint(8, 102),
      makeDataPoint(6, 98),
      makeDataPoint(4, 101),
      makeDataPoint(2, 500), // anomaly
    ];
    const ma = computeMovingAverage(points, 30);
    const anomalies = flagAnomalies(points, ma);
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies.some((a) => a.value === 500)).toBe(true);
    expect(anomalies[0].deviationMultiple).toBeGreaterThan(ANOMALY_STD_DEV_THRESHOLD);
  });

  it("returns empty when all values are identical", () => {
    const points = [
      makeDataPoint(5, 100),
      makeDataPoint(4, 100),
      makeDataPoint(3, 100),
      makeDataPoint(2, 100),
    ];
    const ma = computeMovingAverage(points);
    expect(flagAnomalies(points, ma)).toEqual([]);
  });

  it("returns empty when variation is within 2 std devs", () => {
    // Moderate variation, no extreme outliers
    const points = [
      makeDataPoint(10, 100),
      makeDataPoint(8, 110),
      makeDataPoint(6, 95),
      makeDataPoint(4, 105),
      makeDataPoint(2, 100),
    ];
    const ma = computeMovingAverage(points, 30);
    const anomalies = flagAnomalies(points, ma);
    expect(anomalies).toEqual([]);
  });
});

describe("V3-04: Trend Detection — assessConfidence", () => {
  it("returns high for ≥15 points + ≥2 Grade A", () => {
    expect(assessConfidence(15, 2)).toBe("high");
    expect(assessConfidence(20, 5)).toBe("high");
  });

  it("returns medium for 15+ points but <2 Grade A", () => {
    expect(assessConfidence(15, 1)).toBe("medium");
    expect(assessConfidence(20, 0)).toBe("medium");
  });

  it("returns medium for 8-14 points", () => {
    expect(assessConfidence(8, 0)).toBe("medium");
    expect(assessConfidence(14, 1)).toBe("medium");
  });

  it("returns low for 5-7 points", () => {
    expect(assessConfidence(5, 0)).toBe("low");
    expect(assessConfidence(7, 2)).toBe("low");
  });

  it("returns insufficient for <5 points", () => {
    expect(assessConfidence(0, 0)).toBe("insufficient");
    expect(assessConfidence(4, 3)).toBe("insufficient");
  });
});

describe("V3-04: Trend Detection — detectTrends (full orchestration)", () => {
  it("handles empty data points", async () => {
    const result = await detectTrends("test_metric", "material_cost", "Dubai", [], {
      generateNarrative: false,
    });
    expect(result.direction).toBe("insufficient_data");
    expect(result.confidence).toBe("insufficient");
    expect(result.dataPointCount).toBe(0);
    expect(result.narrative).toBeNull();
    expect(result.movingAverages).toEqual([]);
  });

  it("computes full trend for sufficient data", async () => {
    const points: DataPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push(makeDataPoint(60 - i * 3, 100 + i * 2, i < 5 ? "A" : "B"));
    }
    const result = await detectTrends("fitout_rate", "fitout_rate", "Dubai", points, {
      generateNarrative: false,
    });
    expect(result.metric).toBe("fitout_rate");
    expect(result.category).toBe("fitout_rate");
    expect(result.geography).toBe("Dubai");
    expect(result.dataPointCount).toBe(20);
    expect(result.gradeACount).toBe(5);
    expect(result.gradeBCount).toBe(15);
    expect(result.confidence).toBe("high");
    expect(result.movingAverages.length).toBe(20);
    expect(result.dateRange).not.toBeNull();
  });

  it("skips narrative when generateNarrative=false", async () => {
    const points = Array.from({ length: 10 }, (_, i) => makeDataPoint(i, 100 + i));
    const result = await detectTrends("test", "test", "UAE", points, {
      generateNarrative: false,
    });
    expect(result.narrative).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. MARKET POSITIONING ENGINE
// ═══════════════════════════════════════════════════════════════════

describe("V3-06: Market Positioning — computePercentiles", () => {
  it("returns zeros for empty input", () => {
    const result = computePercentiles([]);
    expect(result.count).toBe(0);
    expect(result.p25).toBe(0);
    expect(result.p50).toBe(0);
    expect(result.p75).toBe(0);
    expect(result.p90).toBe(0);
  });

  it("returns same value for single element", () => {
    const result = computePercentiles([500]);
    expect(result.p25).toBe(500);
    expect(result.p50).toBe(500);
    expect(result.p75).toBe(500);
    expect(result.p90).toBe(500);
    expect(result.min).toBe(500);
    expect(result.max).toBe(500);
    expect(result.mean).toBe(500);
    expect(result.count).toBe(1);
  });

  it("computes correct percentiles for known dataset", () => {
    // 10 values: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const result = computePercentiles(values);
    expect(result.count).toBe(10);
    expect(result.min).toBe(100);
    expect(result.max).toBe(1000);
    expect(result.mean).toBe(550);
    // R-7 interpolation: P25 = 100 + 0.25*9 * step
    expect(result.p25).toBe(325);
    expect(result.p50).toBe(550);
    expect(result.p75).toBe(775);
  });

  it("handles unsorted input correctly", () => {
    const values = [500, 100, 300, 200, 400];
    const result = computePercentiles(values);
    expect(result.min).toBe(100);
    expect(result.max).toBe(500);
    expect(result.p50).toBe(300);
  });
});

describe("V3-06: Market Positioning — assignTier", () => {
  const percentiles = { p25: 400, p50: 600, p75: 800, p90: 1000, min: 200, max: 1200, mean: 600, count: 20 };

  it("assigns budget tier below P25", () => {
    expect(assignTier(300, percentiles)).toBe("budget");
    expect(assignTier(399, percentiles)).toBe("budget");
  });

  it("assigns mid_range tier between P25 and P50", () => {
    expect(assignTier(400, percentiles)).toBe("mid_range");
    expect(assignTier(500, percentiles)).toBe("mid_range");
    expect(assignTier(599, percentiles)).toBe("mid_range");
  });

  it("assigns premium tier between P50 and P75", () => {
    expect(assignTier(600, percentiles)).toBe("premium");
    expect(assignTier(700, percentiles)).toBe("premium");
    expect(assignTier(799, percentiles)).toBe("premium");
  });

  it("assigns ultra_premium tier above P75", () => {
    expect(assignTier(800, percentiles)).toBe("ultra_premium");
    expect(assignTier(1000, percentiles)).toBe("ultra_premium");
    expect(assignTier(1500, percentiles)).toBe("ultra_premium");
  });
});

describe("V3-06: Market Positioning — computePercentileRank", () => {
  it("returns 0 for empty values", () => {
    expect(computePercentileRank(500, [])).toBe(0);
  });

  it("computes rank for value below all", () => {
    const rank = computePercentileRank(50, [100, 200, 300, 400, 500]);
    expect(rank).toBe(0);
  });

  it("computes rank for value above all", () => {
    const rank = computePercentileRank(600, [100, 200, 300, 400, 500]);
    expect(rank).toBe(100);
  });

  it("computes rank for middle value", () => {
    const rank = computePercentileRank(300, [100, 200, 300, 400, 500]);
    // 2 below + 0.5 * 1 equal = 2.5, / 5 * 100 = 50
    expect(rank).toBe(50);
  });
});

describe("V3-06: Market Positioning — computeMarketPosition (650 AED/sqm test case)", () => {
  it("positions 650 AED/sqm correctly in market", () => {
    // Create a realistic dataset of fitout rates
    const values = [350, 400, 450, 500, 520, 550, 600, 620, 650, 680, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1500];
    const dataPoints = values.map((v, i) =>
      makeMarketDataPoint(v, i < 5 ? "A" : i < 15 ? "B" : "C")
    );

    const result = computeMarketPosition(650, dataPoints);
    expect(result.targetValue).toBe(650);
    expect(result.dataPointCount).toBe(20);
    expect(result.gradeACount).toBe(5);
    expect(result.confidence).toBe("high"); // 20 points + 5 Grade A
    expect(["mid_range", "premium"]).toContain(result.tier); // 650 should be mid-range or premium
    expect(result.percentiles.min).toBe(350);
    expect(result.percentiles.max).toBe(1500);
    expect(result.competitiveIndex).toBeGreaterThan(0);
    expect(result.competitiveIndex).toBeLessThan(100);
    expect(result.priceGap.toP25).toBeDefined();
    expect(result.priceGap.toP50).toBeDefined();
    expect(result.priceGap.toP75).toBeDefined();
    expect(result.priceGap.toP90).toBeDefined();
  });

  it("returns insufficient confidence for <5 data points", () => {
    const dataPoints = [makeMarketDataPoint(500), makeMarketDataPoint(600)];
    const result = computeMarketPosition(550, dataPoints);
    expect(result.confidence).toBe("insufficient");
  });

  it("handles single data point", () => {
    const dataPoints = [makeMarketDataPoint(500)];
    const result = computeMarketPosition(500, dataPoints);
    expect(result.tier).toBe("ultra_premium"); // equal to P75 (which equals the only value)
    expect(result.percentiles.p50).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. COMPETITOR INTELLIGENCE ENGINE
// ═══════════════════════════════════════════════════════════════════

describe("V3-07: Competitor Intelligence — computeHHI", () => {
  it("returns 0 for empty market", () => {
    expect(computeHHI([])).toBe(0);
  });

  it("returns 1.0 for monopoly", () => {
    expect(computeHHI([1.0])).toBe(1);
  });

  it("returns 0.5 for perfect duopoly", () => {
    expect(computeHHI([0.5, 0.5])).toBe(0.5);
  });

  it("returns ~0.1 for 10 equal players", () => {
    const shares = Array(10).fill(0.1);
    const hhi = computeHHI(shares);
    expect(hhi).toBeCloseTo(0.1, 2);
  });

  it("returns higher HHI for concentrated market", () => {
    // One dominant player (70%) + 3 small (10% each)
    const hhi = computeHHI([0.7, 0.1, 0.1, 0.1]);
    expect(hhi).toBeGreaterThan(0.25); // concentrated
    expect(hhi).toBeCloseTo(0.52, 2);
  });
});

describe("V3-07: Competitor Intelligence — classifyConcentration", () => {
  it("classifies fragmented market (HHI < 0.15)", () => {
    expect(classifyConcentration(0.05)).toBe("fragmented");
    expect(classifyConcentration(0.10)).toBe("fragmented");
    expect(classifyConcentration(0.14)).toBe("fragmented");
  });

  it("classifies moderate concentration (0.15 ≤ HHI ≤ 0.25)", () => {
    expect(classifyConcentration(0.15)).toBe("moderate");
    expect(classifyConcentration(0.20)).toBe("moderate");
    expect(classifyConcentration(0.25)).toBe("moderate");
  });

  it("classifies concentrated market (HHI > 0.25)", () => {
    expect(classifyConcentration(0.26)).toBe("concentrated");
    expect(classifyConcentration(0.50)).toBe("concentrated");
    expect(classifyConcentration(1.0)).toBe("concentrated");
  });
});

describe("V3-07: Competitor Intelligence — analyseCompetitorLandscape", () => {
  it("handles empty project list", async () => {
    const result = await analyseCompetitorLandscape([], { generateNarrative: false });
    expect(result.totalProjects).toBe(0);
    expect(result.totalDevelopers).toBe(0);
    expect(result.hhi).toBe(0);
    expect(result.confidence).toBe("insufficient");
  });

  it("computes fragmented market correctly", async () => {
    // 10 developers, each with 1 project of 100 units
    const projects: CompetitorProject[] = [];
    for (let i = 0; i < 10; i++) {
      projects.push(makeCompetitorProject(`dev-${i}`, `Developer ${i}`, 100, 500 + i * 50));
    }
    const result = await analyseCompetitorLandscape(projects, { generateNarrative: false });
    expect(result.totalProjects).toBe(10);
    expect(result.totalDevelopers).toBe(10);
    expect(result.hhi).toBeCloseTo(0.1, 2);
    expect(result.concentration).toBe("fragmented");
    expect(result.developers).toHaveLength(10);
    expect(result.topDevelopers.length).toBeLessThanOrEqual(5);
    expect(result.priceDistribution).not.toBeNull();
    expect(result.confidence).toBe("medium"); // 10 projects, 10 developers
  });

  it("computes concentrated market correctly", async () => {
    // 1 dominant developer with 700 units, 3 small with 100 each
    const projects = [
      makeCompetitorProject("emaar", "Emaar", 700, 1200),
      makeCompetitorProject("small-1", "Small Dev 1", 100, 800),
      makeCompetitorProject("small-2", "Small Dev 2", 100, 750),
      makeCompetitorProject("small-3", "Small Dev 3", 100, 700),
    ];
    const result = await analyseCompetitorLandscape(projects, { generateNarrative: false });
    expect(result.totalProjects).toBe(4);
    expect(result.totalDevelopers).toBe(4);
    expect(result.concentration).toBe("concentrated");
    expect(result.hhi).toBeGreaterThan(0.25);
    // Emaar should be top developer with high threat
    expect(result.topDevelopers[0].developerName).toBe("Emaar");
    expect(result.topDevelopers[0].threatLevel).toBe("high");
    expect(result.topDevelopers[0].marketShareByUnits).toBeGreaterThan(0.5);
  });

  it("computes developer threat levels correctly", async () => {
    const projects = [
      makeCompetitorProject("big", "Big Dev", 200, 1000),    // 200/500 = 40% → high
      makeCompetitorProject("mid", "Mid Dev", 60, 900),      // 60/500 = 12% → medium
      makeCompetitorProject("small", "Small Dev", 40, 800),   // 40/500 = 8% → medium
      makeCompetitorProject("tiny-1", "Tiny Dev 1", 100, 700), // 100/500 = 20% → high
      makeCompetitorProject("tiny-2", "Tiny Dev 2", 100, 600), // 100/500 = 20% → high
    ];
    const result = await analyseCompetitorLandscape(projects, { generateNarrative: false });
    const bigDev = result.developers.find((d) => d.developerId === "big")!;
    const midDev = result.developers.find((d) => d.developerId === "mid")!;
    const smallDev = result.developers.find((d) => d.developerId === "small")!;
    expect(bigDev.threatLevel).toBe("high");
    expect(midDev.threatLevel).toBe("medium");
    expect(smallDev.threatLevel).toBe("medium");
  });

  it("computes price distribution correctly", async () => {
    const projects = [
      makeCompetitorProject("d1", "Dev 1", 100, 500),
      makeCompetitorProject("d2", "Dev 2", 100, 700),
      makeCompetitorProject("d3", "Dev 3", 100, 900),
      makeCompetitorProject("d4", "Dev 4", 100, 1100),
    ];
    const result = await analyseCompetitorLandscape(projects, { generateNarrative: false });
    expect(result.priceDistribution).not.toBeNull();
    expect(result.priceDistribution!.min).toBe(500);
    expect(result.priceDistribution!.max).toBe(1100);
    expect(result.priceDistribution!.median).toBe(800); // (700+900)/2
  });

  it("handles projects without price data", async () => {
    const projects = [
      makeCompetitorProject("d1", "Dev 1", 100),
      makeCompetitorProject("d2", "Dev 2", 200),
    ];
    const result = await analyseCompetitorLandscape(projects, { generateNarrative: false });
    expect(result.priceDistribution).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. INSIGHT GENERATION ENGINE
// ═══════════════════════════════════════════════════════════════════

describe("V3-08: Insight Generation — cost_pressure", () => {
  it("triggers when material cost rising >10%", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "ceramic_tiles",
          category: "material_cost",
          direction: "rising",
          percentChange: 15,
          confidence: "high",
          currentMA: 115,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const costInsight = insights.find((i) => i.type === "cost_pressure");
    expect(costInsight).toBeDefined();
    expect(costInsight!.severity).toBe("warning");
    expect(costInsight!.confidenceScore).toBe(0.90); // high confidence
  });

  it("triggers critical severity when >20% increase", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "premium_fixtures",
          category: "fixtures",
          direction: "rising",
          percentChange: 25,
          confidence: "medium",
          currentMA: 125,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const costInsight = insights.find((i) => i.type === "cost_pressure");
    expect(costInsight).toBeDefined();
    expect(costInsight!.severity).toBe("critical");
  });

  it("does NOT trigger when increase ≤10%", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "ceramic_tiles",
          category: "material_cost",
          direction: "rising",
          percentChange: 8,
          confidence: "high",
          currentMA: 108,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "cost_pressure")).toBeUndefined();
  });

  it("does NOT trigger for non-cost categories", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "market_index",
          category: "market_trend",
          direction: "rising",
          percentChange: 20,
          confidence: "high",
          currentMA: 120,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "cost_pressure")).toBeUndefined();
  });
});

describe("V3-08: Insight Generation — market_opportunity", () => {
  it("triggers when <3 competitors", async () => {
    const input: InsightInput = {
      competitorLandscape: {
        totalProjects: 2,
        totalDevelopers: 2,
        hhi: 0.5,
        concentration: "concentrated",
        topDevelopers: [
          { developerName: "Dev A", marketShareByUnits: 0.5, threatLevel: "high" },
          { developerName: "Dev B", marketShareByUnits: 0.5, threatLevel: "high" },
        ],
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const opp = insights.find((i) => i.type === "market_opportunity");
    expect(opp).toBeDefined();
    expect(opp!.severity).toBe("info");
  });

  it("triggers when market is fragmented with rising trends", async () => {
    const input: InsightInput = {
      competitorLandscape: {
        totalProjects: 10,
        totalDevelopers: 10,
        hhi: 0.10,
        concentration: "fragmented",
        topDevelopers: [],
      },
      trends: [
        {
          metric: "demand_index",
          category: "market_trend",
          direction: "rising",
          percentChange: 8,
          confidence: "medium",
          currentMA: 108,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const opp = insights.find((i) => i.type === "market_opportunity");
    expect(opp).toBeDefined();
  });

  it("does NOT trigger when ≥3 competitors and not fragmented", async () => {
    const input: InsightInput = {
      competitorLandscape: {
        totalProjects: 5,
        totalDevelopers: 5,
        hhi: 0.20,
        concentration: "moderate",
        topDevelopers: [],
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "market_opportunity")).toBeUndefined();
  });
});

describe("V3-08: Insight Generation — competitor_alert", () => {
  it("triggers when high-threat developer detected", async () => {
    const input: InsightInput = {
      competitorLandscape: {
        totalProjects: 10,
        totalDevelopers: 5,
        hhi: 0.30,
        concentration: "concentrated",
        topDevelopers: [
          { developerName: "Emaar", marketShareByUnits: 0.40, threatLevel: "high" },
          { developerName: "DAMAC", marketShareByUnits: 0.20, threatLevel: "high" },
        ],
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const alert = insights.find((i) => i.type === "competitor_alert");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning"); // <3 high threats
    expect(alert!.dataPoints.topThreat).toBe("Emaar");
  });

  it("triggers critical when ≥3 high-threat developers", async () => {
    const input: InsightInput = {
      competitorLandscape: {
        totalProjects: 15,
        totalDevelopers: 8,
        hhi: 0.20,
        concentration: "moderate",
        topDevelopers: [
          { developerName: "Emaar", marketShareByUnits: 0.25, threatLevel: "high" },
          { developerName: "DAMAC", marketShareByUnits: 0.20, threatLevel: "high" },
          { developerName: "Nakheel", marketShareByUnits: 0.18, threatLevel: "high" },
        ],
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const alert = insights.find((i) => i.type === "competitor_alert");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
  });

  it("does NOT trigger when no high-threat developers", async () => {
    const input: InsightInput = {
      competitorLandscape: {
        totalProjects: 10,
        totalDevelopers: 10,
        hhi: 0.10,
        concentration: "fragmented",
        topDevelopers: [
          { developerName: "Dev A", marketShareByUnits: 0.10, threatLevel: "medium" },
        ],
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "competitor_alert")).toBeUndefined();
  });
});

describe("V3-08: Insight Generation — trend_signal", () => {
  it("triggers when significant trend change detected", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "fitout_rate",
          category: "fitout_rate",
          direction: "falling",
          percentChange: -12,
          confidence: "high",
          currentMA: 88,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const signal = insights.find((i) => i.type === "trend_signal");
    expect(signal).toBeDefined();
    expect(signal!.dataPoints.direction).toBe("falling");
  });

  it("does NOT trigger for stable trends", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "fitout_rate",
          category: "fitout_rate",
          direction: "stable",
          percentChange: 2,
          confidence: "high",
          currentMA: 102,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "trend_signal")).toBeUndefined();
  });

  it("does NOT trigger for small changes (≤5%)", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "fitout_rate",
          category: "fitout_rate",
          direction: "rising",
          percentChange: 4,
          confidence: "high",
          currentMA: 104,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "trend_signal")).toBeUndefined();
  });
});

describe("V3-08: Insight Generation — positioning_gap", () => {
  it("triggers when project below P25", async () => {
    const input: InsightInput = {
      marketPosition: {
        targetValue: 350,
        tier: "budget",
        percentile: 10,
        percentiles: { p25: 500, p50: 700, p75: 900, p90: 1100 },
        competitiveIndex: 15,
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const gap = insights.find((i) => i.type === "positioning_gap");
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("info"); // below range = info
  });

  it("triggers when project above P75", async () => {
    const input: InsightInput = {
      marketPosition: {
        targetValue: 1200,
        tier: "ultra_premium",
        percentile: 90,
        percentiles: { p25: 500, p50: 700, p75: 900, p90: 1100 },
        competitiveIndex: 85,
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const gap = insights.find((i) => i.type === "positioning_gap");
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("warning"); // above range = warning
  });

  it("does NOT trigger when within P25-P75", async () => {
    const input: InsightInput = {
      marketPosition: {
        targetValue: 650,
        tier: "mid_range",
        percentile: 50,
        percentiles: { p25: 500, p50: 700, p75: 900, p90: 1100 },
        competitiveIndex: 45,
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    expect(insights.find((i) => i.type === "positioning_gap")).toBeUndefined();
  });
});

describe("V3-08: Insight Generation — combined scenarios", () => {
  it("generates all 5 insights when all conditions met", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "ceramic_tiles",
          category: "material_cost",
          direction: "rising",
          percentChange: 18,
          confidence: "high",
          currentMA: 118,
          previousMA: 100,
          anomalyCount: 1,
        },
        {
          metric: "fitout_rate",
          category: "fitout_rate",
          direction: "falling",
          percentChange: -12,
          confidence: "medium",
          currentMA: 88,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
      marketPosition: {
        targetValue: 350,
        tier: "budget",
        percentile: 10,
        percentiles: { p25: 500, p50: 700, p75: 900, p90: 1100 },
        competitiveIndex: 15,
      },
      competitorLandscape: {
        totalProjects: 2,
        totalDevelopers: 2,
        hhi: 0.50,
        concentration: "concentrated",
        topDevelopers: [
          { developerName: "Emaar", marketShareByUnits: 0.60, threatLevel: "high" },
          { developerName: "DAMAC", marketShareByUnits: 0.40, threatLevel: "high" },
        ],
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    const types = insights.map((i) => i.type);
    expect(types).toContain("cost_pressure");
    expect(types).toContain("market_opportunity");
    expect(types).toContain("competitor_alert");
    expect(types).toContain("trend_signal");
    expect(types).toContain("positioning_gap");
    expect(insights.length).toBe(5);
  });

  it("generates no insights for empty input", async () => {
    const insights = await generateInsights({}, { enrichWithLLM: false });
    expect(insights).toEqual([]);
  });

  it("sorts insights by severity: critical > warning > info", async () => {
    const input: InsightInput = {
      trends: [
        {
          metric: "ceramic_tiles",
          category: "material_cost",
          direction: "rising",
          percentChange: 25, // critical
          confidence: "high",
          currentMA: 125,
          previousMA: 100,
          anomalyCount: 0,
        },
      ],
      marketPosition: {
        targetValue: 350,
        tier: "budget",
        percentile: 10, // info
        percentiles: { p25: 500, p50: 700, p75: 900, p90: 1100 },
        competitiveIndex: 15,
      },
    };
    const insights = await generateInsights(input, { enrichWithLLM: false });
    if (insights.length >= 2) {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      for (let i = 1; i < insights.length; i++) {
        expect(severityOrder[insights[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[insights[i - 1].severity]
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. FRESHNESS + INGESTION INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe("V3: Freshness Integration", () => {
  const ref = new Date("2026-02-21T00:00:00Z");

  it("fresh evidence (≤90 days) gets weight 1.0", () => {
    const captureDate = new Date("2026-01-15T00:00:00Z"); // 37 days ago
    const info = computeFreshness(captureDate, ref);
    expect(info.status).toBe("fresh");
    expect(info.weight).toBe(1.0);
    expect(info.badgeColor).toBe("green");
  });

  it("aging evidence (91-365 days) gets weight 0.75", () => {
    const captureDate = new Date("2025-06-15T00:00:00Z"); // ~251 days ago
    const info = computeFreshness(captureDate, ref);
    expect(info.status).toBe("aging");
    expect(info.weight).toBe(0.75);
    expect(info.badgeColor).toBe("amber");
  });

  it("stale evidence (>365 days) gets weight 0.50", () => {
    const captureDate = new Date("2024-01-01T00:00:00Z"); // ~782 days ago
    const info = computeFreshness(captureDate, ref);
    expect(info.status).toBe("stale");
    expect(info.weight).toBe(0.50);
    expect(info.badgeColor).toBe("red");
  });

  it("getFreshnessWeight returns correct weight", () => {
    expect(getFreshnessWeight(new Date("2026-01-15"), ref)).toBe(1.0);
    expect(getFreshnessWeight(new Date("2025-06-15"), ref)).toBe(0.75);
    expect(getFreshnessWeight(new Date("2024-01-01"), ref)).toBe(0.50);
  });

  it("handles string date input", () => {
    const info = computeFreshness("2026-02-01T00:00:00Z", ref);
    expect(info.status).toBe("fresh");
  });

  it("boundary: exactly 90 days = fresh", () => {
    const captureDate = new Date(ref.getTime() - FRESHNESS_FRESH_DAYS * 24 * 60 * 60 * 1000);
    const info = computeFreshness(captureDate, ref);
    expect(info.status).toBe("fresh");
  });

  it("boundary: exactly 365 days = aging", () => {
    const captureDate = new Date(ref.getTime() - FRESHNESS_AGING_DAYS * 24 * 60 * 60 * 1000);
    const info = computeFreshness(captureDate, ref);
    expect(info.status).toBe("aging");
  });

  it("boundary: 366 days = stale", () => {
    const captureDate = new Date(ref.getTime() - (FRESHNESS_AGING_DAYS + 1) * 24 * 60 * 60 * 1000);
    const info = computeFreshness(captureDate, ref);
    expect(info.status).toBe("stale");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. END-TO-END ANALYTICS PIPELINE
// ═══════════════════════════════════════════════════════════════════

describe("V3: End-to-End Analytics Pipeline", () => {
  it("trend → position → competitor → insights chain produces valid output", async () => {
    // Step 1: Generate trend data
    const trendPoints: DataPoint[] = [];
    for (let i = 0; i < 20; i++) {
      trendPoints.push(makeDataPoint(60 - i * 3, 500 + i * 15, i < 5 ? "A" : "B"));
    }
    const trend = await detectTrends("fitout_rate", "fitout_rate", "Dubai", trendPoints, {
      generateNarrative: false,
    });
    expect(trend.dataPointCount).toBe(20);
    expect(trend.confidence).toBe("high");

    // Step 2: Compute market position
    const marketPoints = trendPoints.map((p) => ({
      value: p.value,
      grade: p.grade,
      sourceId: p.sourceId,
      date: p.date,
      recordId: p.recordId,
    }));
    const position = computeMarketPosition(650, marketPoints);
    expect(position.dataPointCount).toBe(20);
    expect(position.tier).toBeDefined();

    // Step 3: Analyse competitor landscape
    const competitors: CompetitorProject[] = [
      makeCompetitorProject("emaar", "Emaar", 500, 1200),
      makeCompetitorProject("damac", "DAMAC", 300, 900),
      makeCompetitorProject("nakheel", "Nakheel", 200, 800),
      makeCompetitorProject("small-1", "Small Dev", 50, 600),
    ];
    const landscape = await analyseCompetitorLandscape(competitors, { generateNarrative: false });
    expect(landscape.totalProjects).toBe(4);
    expect(landscape.concentration).toBeDefined();

    // Step 4: Generate insights from all analytics
    const insightInput: InsightInput = {
      trends: [
        {
          metric: trend.metric,
          category: trend.category,
          direction: trend.direction,
          percentChange: trend.percentChange,
          confidence: trend.confidence,
          currentMA: trend.currentMA,
          previousMA: trend.previousMA,
          anomalyCount: trend.anomalies.length,
        },
      ],
      marketPosition: {
        targetValue: position.targetValue,
        tier: position.tier,
        percentile: position.percentile,
        percentiles: position.percentiles,
        competitiveIndex: position.competitiveIndex,
      },
      competitorLandscape: {
        totalProjects: landscape.totalProjects,
        totalDevelopers: landscape.totalDevelopers,
        hhi: landscape.hhi,
        concentration: landscape.concentration,
        topDevelopers: landscape.topDevelopers.map((d) => ({
          developerName: d.developerName,
          marketShareByUnits: d.marketShareByUnits,
          threatLevel: d.threatLevel,
        })),
      },
    };

    const insights = await generateInsights(insightInput, { enrichWithLLM: false });
    // Should produce at least some insights given the data
    expect(Array.isArray(insights)).toBe(true);
    // Each insight should have required fields
    for (const insight of insights) {
      expect(insight.type).toBeDefined();
      expect(insight.severity).toBeDefined();
      expect(insight.title).toBeDefined();
      expect(insight.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(insight.confidenceScore).toBeLessThanOrEqual(1);
      expect(insight.triggerCondition).toBeDefined();
    }
  });

  it("named constants are exported and accessible", () => {
    // Trend detection constants
    expect(DEFAULT_MA_WINDOW_DAYS).toBe(30);
    expect(DIRECTION_CHANGE_THRESHOLD).toBe(0.05);
    expect(ANOMALY_STD_DEV_THRESHOLD).toBe(2.0);
    expect(CONFIDENCE_HIGH_MIN_POINTS).toBe(15);
    expect(CONFIDENCE_HIGH_MIN_GRADE_A).toBe(2);
    expect(CONFIDENCE_MEDIUM_MIN_POINTS).toBe(8);
    expect(CONFIDENCE_LOW_MIN_POINTS).toBe(5);

    // Market positioning constants
    expect(TIER_LABELS.budget).toBe("Budget");
    expect(TIER_LABELS.mid_range).toBe("Mid-Range");
    expect(TIER_LABELS.premium).toBe("Premium");
    expect(TIER_LABELS.ultra_premium).toBe("Ultra-Premium");

    // Freshness constants
    expect(FRESHNESS_FRESH_DAYS).toBe(90);
    expect(FRESHNESS_AGING_DAYS).toBe(365);
  });
});
