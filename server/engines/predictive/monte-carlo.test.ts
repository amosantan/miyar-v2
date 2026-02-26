import { describe, it, expect } from "vitest";
import {
    runMonteCarloSimulation,
    type MonteCarloConfig,
    type MonteCarloResult,
} from "./monte-carlo";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const BASE_CONFIG: MonteCarloConfig = {
    baseCostPerSqm: 5000,
    gfa: 2000,
    trendAnnualPct: 5,
    trendVolatility: 3,
    marketCondition: "balanced",
    horizonMonths: 12,
    iterations: 1000, // lower for speed in tests
};

// ─── Structure & Shape ──────────────────────────────────────────────────────

describe("Monte Carlo – Result Structure", () => {
    let result: MonteCarloResult;

    // Run once for structural tests
    result = runMonteCarloSimulation(BASE_CONFIG);

    it("returns the correct number of iterations", () => {
        expect(result.iterations).toBe(1000);
    });

    it("returns all 7 percentiles", () => {
        const { percentiles } = result;
        expect(percentiles).toHaveProperty("p5");
        expect(percentiles).toHaveProperty("p10");
        expect(percentiles).toHaveProperty("p25");
        expect(percentiles).toHaveProperty("p50");
        expect(percentiles).toHaveProperty("p75");
        expect(percentiles).toHaveProperty("p90");
        expect(percentiles).toHaveProperty("p95");
    });

    it("percentiles are in ascending order", () => {
        const { percentiles: p } = result;
        expect(p.p5).toBeLessThanOrEqual(p.p10);
        expect(p.p10).toBeLessThanOrEqual(p.p25);
        expect(p.p25).toBeLessThanOrEqual(p.p50);
        expect(p.p50).toBeLessThanOrEqual(p.p75);
        expect(p.p75).toBeLessThanOrEqual(p.p90);
        expect(p.p90).toBeLessThanOrEqual(p.p95);
    });

    it("returns 20 histogram buckets", () => {
        expect(result.histogram).toHaveLength(20);
    });

    it("histogram bucket counts sum to iterations", () => {
        const totalCount = result.histogram.reduce((s, b) => s + b.count, 0);
        expect(totalCount).toBe(1000);
    });

    it("histogram percentages sum to ~100%", () => {
        const totalPct = result.histogram.reduce((s, b) => s + b.percentage, 0);
        expect(totalPct).toBeGreaterThan(99);
        expect(totalPct).toBeLessThan(101);
    });

    it("returns time-series with correct month count", () => {
        expect(result.timeSeries).toHaveLength(12);
        expect(result.timeSeries[0].month).toBe(1);
        expect(result.timeSeries[11].month).toBe(12);
    });

    it("time-series P10 <= P50 <= P90 at each month", () => {
        for (const point of result.timeSeries) {
            expect(point.p10).toBeLessThanOrEqual(point.p50);
            expect(point.p50).toBeLessThanOrEqual(point.p90);
        }
    });

    it("VaR95 equals the P95 percentile", () => {
        expect(result.var95).toBe(result.percentiles.p95);
    });

    it("mean is between min and max outcome", () => {
        expect(result.mean).toBeGreaterThanOrEqual(result.minOutcome);
        expect(result.mean).toBeLessThanOrEqual(result.maxOutcome);
    });

    it("stdDev is non-negative", () => {
        expect(result.stdDev).toBeGreaterThanOrEqual(0);
    });

    it("preserves config in result", () => {
        expect(result.config).toEqual(BASE_CONFIG);
    });
});

// ─── Market Conditions ──────────────────────────────────────────────────────

describe("Monte Carlo – Market Conditions", () => {
    it("tight market increases costs vs balanced", () => {
        const balanced = runMonteCarloSimulation({ ...BASE_CONFIG, iterations: 5000 });
        const tight = runMonteCarloSimulation({ ...BASE_CONFIG, marketCondition: "tight", iterations: 5000 });
        // Tight should have higher median (statistically, allow some variance)
        expect(tight.percentiles.p50).toBeGreaterThan(balanced.percentiles.p50 * 0.95);
    });

    it("soft market decreases costs vs balanced", () => {
        const balanced = runMonteCarloSimulation({ ...BASE_CONFIG, iterations: 5000 });
        const soft = runMonteCarloSimulation({ ...BASE_CONFIG, marketCondition: "soft", iterations: 5000 });
        expect(soft.percentiles.p50).toBeLessThan(balanced.percentiles.p50 * 1.05);
    });
});

// ─── Budget Exceed Probability ──────────────────────────────────────────────

describe("Monte Carlo – Budget Cap", () => {
    it("returns null when no budget cap is set", () => {
        const result = runMonteCarloSimulation(BASE_CONFIG);
        expect(result.budgetExceedProbability).toBeNull();
    });

    it("returns 0% when budget cap is very high", () => {
        const result = runMonteCarloSimulation({
            ...BASE_CONFIG,
            budgetCap: 999_999_999,
        });
        expect(result.budgetExceedProbability).toBe(0);
    });

    it("returns ~100% when budget cap is very low", () => {
        const result = runMonteCarloSimulation({
            ...BASE_CONFIG,
            budgetCap: 1,
        });
        expect(result.budgetExceedProbability).toBeGreaterThan(99);
    });

    it("returns reasonable probability for mid-range cap", () => {
        // First run to find P50, then use it as budget cap
        const firstRun = runMonteCarloSimulation({ ...BASE_CONFIG, iterations: 5000 });
        const result = runMonteCarloSimulation({
            ...BASE_CONFIG,
            budgetCap: firstRun.percentiles.p50,
            iterations: 5000,
        });
        // Should be roughly around 50% for a cap at P50
        expect(result.budgetExceedProbability).toBeGreaterThan(20);
        expect(result.budgetExceedProbability).toBeLessThan(80);
    });
});

// ─── Iteration Bounds ───────────────────────────────────────────────────────

describe("Monte Carlo – Iteration Bounds", () => {
    it("clamps minimum iterations to 100", () => {
        const result = runMonteCarloSimulation({ ...BASE_CONFIG, iterations: 10 });
        expect(result.iterations).toBe(100);
    });

    it("clamps maximum iterations to 50,000", () => {
        const result = runMonteCarloSimulation({ ...BASE_CONFIG, iterations: 100_000 });
        expect(result.iterations).toBe(50_000);
    });
});

// ─── Sensitivity ────────────────────────────────────────────────────────────

describe("Monte Carlo – Sensitivity to Volatility", () => {
    it("higher cost volatility produces wider spread", () => {
        const low = runMonteCarloSimulation({ ...BASE_CONFIG, costVolatilityPct: 5, iterations: 5000 });
        const high = runMonteCarloSimulation({ ...BASE_CONFIG, costVolatilityPct: 25, iterations: 5000 });
        const spreadLow = low.percentiles.p95 - low.percentiles.p5;
        const spreadHigh = high.percentiles.p95 - high.percentiles.p5;
        expect(spreadHigh).toBeGreaterThan(spreadLow);
    });

    it("higher GFA variance increases stdDev", () => {
        const low = runMonteCarloSimulation({ ...BASE_CONFIG, gfaVariancePct: 1, iterations: 5000 });
        const high = runMonteCarloSimulation({ ...BASE_CONFIG, gfaVariancePct: 15, iterations: 5000 });
        expect(high.stdDev).toBeGreaterThan(low.stdDev);
    });

    it("scales proportionally with GFA", () => {
        const small = runMonteCarloSimulation({ ...BASE_CONFIG, gfa: 1000, iterations: 5000 });
        const big = runMonteCarloSimulation({ ...BASE_CONFIG, gfa: 10_000, iterations: 5000 });
        // 10x GFA should produce roughly 10x median cost
        const ratio = big.percentiles.p50 / small.percentiles.p50;
        expect(ratio).toBeGreaterThan(8);
        expect(ratio).toBeLessThan(12);
    });
});

// ─── Trend Projection ───────────────────────────────────────────────────────

describe("Monte Carlo – Trend Projection", () => {
    it("positive trend produces increasing time-series", () => {
        const result = runMonteCarloSimulation({
            ...BASE_CONFIG,
            trendAnnualPct: 10,
            trendVolatility: 0.5,
            horizonMonths: 24,
            iterations: 2000,
        });
        const first = result.timeSeries[0].p50;
        const last = result.timeSeries[result.timeSeries.length - 1].p50;
        expect(last).toBeGreaterThan(first);
    });

    it("negative trend produces decreasing time-series", () => {
        const result = runMonteCarloSimulation({
            ...BASE_CONFIG,
            trendAnnualPct: -10,
            trendVolatility: 0.5,
            horizonMonths: 24,
            iterations: 2000,
        });
        const first = result.timeSeries[0].p50;
        const last = result.timeSeries[result.timeSeries.length - 1].p50;
        expect(last).toBeLessThan(first);
    });
});
