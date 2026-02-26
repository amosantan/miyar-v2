/**
 * Monte Carlo Simulation Engine (Phase F)
 *
 * Runs N iterations of randomized cost projections to produce:
 *   - Percentile distribution (P5, P10, P25, P50, P75, P90, P95)
 *   - Histogram buckets for visualisation
 *   - Time-series monthly paths with confidence bands
 *   - Value-at-Risk (VaR) at 95% confidence
 *   - Probability of exceeding a given budget cap
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MonteCarloConfig {
    baseCostPerSqm: number;       // P50 benchmark cost
    gfa: number;                  // gross floor area (sqm)
    trendAnnualPct: number;       // annualized trend, e.g. +5.2
    trendVolatility: number;      // ±% around trend (default 3)
    marketCondition: "tight" | "balanced" | "soft";
    horizonMonths: number;        // projection horizon (1-60)
    budgetCap?: number;           // optional total budget cap for P(exceed) calc
    iterations?: number;          // default 10,000
    costVolatilityPct?: number;   // ±% base cost randomness (default 12)
    gfaVariancePct?: number;      // ±% GFA variance (default 5)
}

export interface PercentileResult {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
}

export interface HistogramBucket {
    rangeMin: number;
    rangeMax: number;
    count: number;
    percentage: number;
}

export interface TimeSeriesPoint {
    month: number;
    p10: number;
    p50: number;
    p90: number;
}

export interface MonteCarloResult {
    iterations: number;
    percentiles: PercentileResult;
    histogram: HistogramBucket[];
    timeSeries: TimeSeriesPoint[];
    mean: number;
    stdDev: number;
    var95: number;              // Value at Risk: 95th percentile total cost
    budgetExceedProbability: number | null;  // P(total > budgetCap)
    minOutcome: number;
    maxOutcome: number;
    config: MonteCarloConfig;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Box-Muller transform: two uniform randoms → one standard normal */
function randNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Normal distribution with given mean & stdDev */
function sampleNormal(mean: number, stdDev: number): number {
    return mean + stdDev * randNormal();
}

/** Uniform distribution [min, max] */
function sampleUniform(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/** Market condition factor */
function marketFactor(condition: string): number {
    switch (condition) {
        case "tight": return 1.05;
        case "soft": return 0.95;
        default: return 1.00;
    }
}

/** Annualized % → monthly compounding rate */
function annualToMonthly(annualPct: number): number {
    return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/** Percentile from sorted array (linear interpolation) */
function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResult {
    const {
        baseCostPerSqm,
        gfa,
        trendAnnualPct,
        trendVolatility = 3,
        marketCondition,
        horizonMonths,
        budgetCap,
        iterations = 10_000,
        costVolatilityPct = 12,
        gfaVariancePct = 5,
    } = config;

    const N = Math.max(100, Math.min(iterations, 50_000));
    const mFactor = marketFactor(marketCondition);

    // Collect final total costs from each iteration
    const outcomes: number[] = new Array(N);

    // Time-series accumulators: for each month, collect all iteration values
    const months = Array.from({ length: horizonMonths }, (_, i) => i + 1);
    const monthlyPaths: number[][] = months.map(() => []);

    for (let i = 0; i < N; i++) {
        // Randomise base cost (normal distribution ± costVolatility%)
        const costStd = baseCostPerSqm * (costVolatilityPct / 100);
        const simCost = Math.max(baseCostPerSqm * 0.5, sampleNormal(baseCostPerSqm, costStd));

        // Randomise GFA (uniform ± gfaVariance%)
        const gfaMin = gfa * (1 - gfaVariancePct / 100);
        const gfaMax = gfa * (1 + gfaVariancePct / 100);
        const simGfa = sampleUniform(gfaMin, gfaMax);

        // Randomise trend (uniform around trend ± volatility)
        const simTrend = sampleUniform(
            trendAnnualPct - trendVolatility,
            trendAnnualPct + trendVolatility
        );
        const monthlyRate = annualToMonthly(simTrend);

        // Compute each monthly snapshot
        for (let m = 0; m < months.length; m++) {
            const month = months[m];
            const compounded = simCost * Math.pow(1 + monthlyRate, month) * mFactor;
            const totalAtMonth = compounded * simGfa;
            monthlyPaths[m].push(totalAtMonth);
        }

        // Final outcome = cost at horizon
        const finalCost = simCost * Math.pow(1 + monthlyRate, horizonMonths) * mFactor;
        outcomes[i] = finalCost * simGfa;
    }

    // Sort outcomes for percentile calculations
    outcomes.sort((a, b) => a - b);

    // Percentiles
    const percentiles: PercentileResult = {
        p5: Math.round(percentile(outcomes, 5)),
        p10: Math.round(percentile(outcomes, 10)),
        p25: Math.round(percentile(outcomes, 25)),
        p50: Math.round(percentile(outcomes, 50)),
        p75: Math.round(percentile(outcomes, 75)),
        p90: Math.round(percentile(outcomes, 90)),
        p95: Math.round(percentile(outcomes, 95)),
    };

    // Statistics
    const sum = outcomes.reduce((s, v) => s + v, 0);
    const mean = sum / N;
    const variance = outcomes.reduce((s, v) => s + (v - mean) ** 2, 0) / N;
    const stdDev = Math.sqrt(variance);

    // Histogram (20 buckets)
    const BUCKETS = 20;
    const minVal = outcomes[0];
    const maxVal = outcomes[N - 1];
    const range = maxVal - minVal || 1;
    const bucketWidth = range / BUCKETS;

    const histogram: HistogramBucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
        rangeMin: Math.round(minVal + i * bucketWidth),
        rangeMax: Math.round(minVal + (i + 1) * bucketWidth),
        count: 0,
        percentage: 0,
    }));

    for (const val of outcomes) {
        const idx = Math.min(Math.floor((val - minVal) / bucketWidth), BUCKETS - 1);
        histogram[idx].count++;
    }
    for (const b of histogram) {
        b.percentage = Math.round((b.count / N) * 10000) / 100;
    }

    // Time-series: compute P10/P50/P90 for each month
    const timeSeries: TimeSeriesPoint[] = months.map((month, m) => {
        const sorted = [...monthlyPaths[m]].sort((a, b) => a - b);
        return {
            month,
            p10: Math.round(percentile(sorted, 10)),
            p50: Math.round(percentile(sorted, 50)),
            p90: Math.round(percentile(sorted, 90)),
        };
    });

    // VaR at 95%
    const var95 = percentiles.p95;

    // Budget exceed probability
    let budgetExceedProbability: number | null = null;
    if (budgetCap && budgetCap > 0) {
        const exceedCount = outcomes.filter(v => v > budgetCap).length;
        budgetExceedProbability = Math.round((exceedCount / N) * 10000) / 100;
    }

    return {
        iterations: N,
        percentiles,
        histogram,
        timeSeries,
        mean: Math.round(mean),
        stdDev: Math.round(stdDev),
        var95,
        budgetExceedProbability,
        minOutcome: Math.round(minVal),
        maxOutcome: Math.round(maxVal),
        config,
    };
}
