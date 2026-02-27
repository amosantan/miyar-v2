/**
 * DLD Analytics Engine — Phase B.3
 *
 * 6 Calculation methods for interior design intelligence:
 * 1. Median sale price per area (AED/sqft)
 * 2. Fitout-to-sale ratio
 * 3. Gross & net rental yield
 * 4. Absorption rate by area
 * 5. Market positioning score
 * 6. Over/under-specification detection
 */

import * as db from "../db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AreaPriceStats {
    areaId: number;
    areaNameEn: string;
    propertyType: string;
    period: string;

    // Sales
    saleP25: number;
    saleP50: number; // Median
    saleP75: number;
    saleMean: number;
    saleTransactionCount: number;
    saleYoyChangePct: number | null;

    // Rentals
    rentP50: number | null;
    rentMean: number | null;
    rentTransactionCount: number;

    // Derived
    grossYield: number | null;
    absorptionRate: number | null;
}

export interface FitoutCalibration {
    areaId: number;
    areaNameEn: string;
    saleMedianPerSqft: number;
    fitoutRecommended: {
        lowPct: number;     // Economy fitout as % of sale price
        midPct: number;     // Mid-range
        highPct: number;    // Luxury
        lowAedPerSqft: number;
        midAedPerSqft: number;
        highAedPerSqft: number;
    };
}

export interface MarketPosition {
    score: number;        // 0-1 where the project sits
    label: string;        // "Economy", "Mid-market", "Premium", "Luxury"
    percentile: string;   // e.g. "Top 15%"
    fitoutRatio: number;  // user's fitout / area median sale price
    riskFlag: "OVER_SPEC" | "UNDER_SPEC" | null;
    riskMessage: string | null;
}

// ─── UAE Fitout Ratio Benchmarks ────────────────────────────────────────────
// Based on RICS, Cavendish Maxwell, and JLL UAE market reports

const FITOUT_RATIO_BENCHMARKS: Record<string, { min: number; max: number; typical: number }> = {
    economy: { min: 0.08, max: 0.12, typical: 0.10 },
    mid: { min: 0.12, max: 0.18, typical: 0.15 },
    premium: { min: 0.15, max: 0.22, typical: 0.18 },
    luxury: { min: 0.18, max: 0.28, typical: 0.23 },
    ultra_luxury: { min: 0.25, max: 0.35, typical: 0.30 },
};

// ─── 1. Percentile Calculation ──────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * computeAreaPriceStats — Core Method #1
 *
 * Given an array of transaction records, computes P25/P50/P75/mean
 * AED/sqft for each area + property type.
 */
export function computeAreaPriceStats(
    transactions: Array<{ areaId: number; areaNameEn: string; propertyType: string; pricePerSqft: number; transactionDate: string }>,
    rentals?: Array<{ areaId: number; areaNameEn: string; propertyType: string; rentPerSqft: number }>,
    dldProjects?: Array<{ areaId: number; noOfUnits: number; noOfVillas: number; projectStatus: string }>,
): AreaPriceStats[] {
    // Group transactions by areaId + propertyType
    const groups = new Map<string, typeof transactions>();

    for (const t of transactions) {
        if (!t.pricePerSqft || t.pricePerSqft <= 0) continue;
        const key = `${t.areaId}::${t.propertyType || "ALL"}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
    }

    // Group rentals similarly
    const rentalGroups = new Map<string, Array<{ rentPerSqft: number }>>();
    if (rentals) {
        for (const r of rentals) {
            if (!r.rentPerSqft || r.rentPerSqft <= 0) continue;
            const key = `${r.areaId}::${r.propertyType || "ALL"}`;
            if (!rentalGroups.has(key)) rentalGroups.set(key, []);
            rentalGroups.get(key)!.push(r);
        }
    }

    // Group DLD projects for absorption calculation
    const projectGroups = new Map<number, { totalUnits: number; activeUnits: number }>();
    if (dldProjects) {
        for (const p of dldProjects) {
            const units = (p.noOfUnits ?? 0) + (p.noOfVillas ?? 0);
            const current = projectGroups.get(p.areaId) ?? { totalUnits: 0, activeUnits: 0 };
            current.totalUnits += units;
            if (p.projectStatus === "ACTIVE") current.activeUnits += units;
            projectGroups.set(p.areaId, current);
        }
    }

    const results: AreaPriceStats[] = [];

    for (const [key, txns] of Array.from(groups.entries())) {
        const [areaIdStr, propertyType] = key.split("::");
        const areaId = parseInt(areaIdStr);
        const areaNameEn = txns[0].areaNameEn;

        // Sort prices for percentile calculation
        const prices = txns.map((t: { pricePerSqft: number }) => t.pricePerSqft).sort((a: number, b: number) => a - b);

        const saleP25 = percentile(prices, 25);
        const saleP50 = percentile(prices, 50);
        const saleP75 = percentile(prices, 75);
        const saleMean = prices.reduce((s: number, v: number) => s + v, 0) / prices.length;

        // Rental stats for matching area
        const rentalKey = key;
        const rents = rentalGroups.get(rentalKey);
        let rentP50: number | null = null;
        let rentMean: number | null = null;
        let rentCount = 0;

        if (rents && rents.length > 0) {
            const rentPrices = rents.map((r) => r.rentPerSqft).sort((a, b) => a - b);
            rentP50 = percentile(rentPrices, 50);
            rentMean = rentPrices.reduce((s, v) => s + v, 0) / rentPrices.length;
            rentCount = rents.length;
        }

        // Gross yield = (annual rent per sqft / sale price per sqft) * 100
        const grossYield = rentP50 && saleP50 > 0 ? (rentP50 / saleP50) * 100 : null;

        // Absorption rate
        const projData = projectGroups.get(areaId);
        const absorptionRate = projData && projData.activeUnits > 0
            ? Math.min(1, txns.length / projData.activeUnits)
            : null;

        // Determine current period
        const latestDate = txns[txns.length - 1]?.transactionDate || "";
        const year = latestDate.substring(0, 4);
        const month = parseInt(latestDate.substring(5, 7) || "1");
        const quarter = Math.ceil(month / 3);
        const period = `${year}-Q${quarter}`;

        results.push({
            areaId,
            areaNameEn,
            propertyType,
            period,
            saleP25: Math.round(saleP25 * 100) / 100,
            saleP50: Math.round(saleP50 * 100) / 100,
            saleP75: Math.round(saleP75 * 100) / 100,
            saleMean: Math.round(saleMean * 100) / 100,
            saleTransactionCount: txns.length,
            saleYoyChangePct: null, // Requires historical data — computed in a second pass
            rentP50: rentP50 ? Math.round(rentP50 * 100) / 100 : null,
            rentMean: rentMean ? Math.round(rentMean * 100) / 100 : null,
            rentTransactionCount: rentCount,
            grossYield: grossYield ? Math.round(grossYield * 100) / 100 : null,
            absorptionRate,
        });
    }

    return results.sort((a, b) => b.saleTransactionCount - a.saleTransactionCount);
}

// ─── 2. Fitout Calibration ──────────────────────────────────────────────────

/**
 * computeFitoutCalibration — Core Method #2
 *
 * Given the median sale price per area, returns recommended fitout
 * budget ranges (AED/sqft) based on UAE market benchmarks.
 */
export function computeFitoutCalibration(stats: AreaPriceStats[]): FitoutCalibration[] {
    return stats
        .filter((s) => s.saleP50 > 0)
        .map((s) => {
            const median = s.saleP50;
            return {
                areaId: s.areaId,
                areaNameEn: s.areaNameEn,
                saleMedianPerSqft: median,
                fitoutRecommended: {
                    lowPct: 10,
                    midPct: 18,
                    highPct: 28,
                    lowAedPerSqft: Math.round(median * 0.10),
                    midAedPerSqft: Math.round(median * 0.18),
                    highAedPerSqft: Math.round(median * 0.28),
                },
            };
        });
}

// ─── 3. Gross & Net Yield ───────────────────────────────────────────────────

/**
 * computeYield — Core Method #3
 *
 * Given sale price and annual rent for a property, returns gross and net yield.
 */
export function computeYield(
    salePrice: number,
    annualRent: number,
    operatingCostPct = 0.22, // UAE typical: 22% of gross rent
): { grossYield: number; netYield: number; operatingCost: number } {
    if (salePrice <= 0) return { grossYield: 0, netYield: 0, operatingCost: 0 };
    const grossYield = (annualRent / salePrice) * 100;
    const operatingCost = annualRent * operatingCostPct;
    const netYield = ((annualRent - operatingCost) / salePrice) * 100;
    return {
        grossYield: Math.round(grossYield * 100) / 100,
        netYield: Math.round(netYield * 100) / 100,
        operatingCost: Math.round(operatingCost),
    };
}

// ─── 5. Market Positioning Score ────────────────────────────────────────────

/**
 * computeMarketPosition — Core Method #5
 *
 * Where does the user's fitout budget sit relative to the area's price band?
 * Returns a 0-1 score and risk flags.
 */
export function computeMarketPosition(
    fitoutCostPerSqft: number,
    salePricePerSqft: number,
    tier: string, // "economy" | "mid" | "premium" | "luxury" | "ultra_luxury"
    areaP25?: number,
    areaP75?: number,
): MarketPosition {
    const fitoutRatio = salePricePerSqft > 0 ? fitoutCostPerSqft / salePricePerSqft : 0;

    // Market position within price band (if P25/P75 provided)
    let score = 0.5;
    if (areaP25 !== undefined && areaP75 !== undefined && areaP75 > areaP25) {
        score = (fitoutCostPerSqft - areaP25) / (areaP75 - areaP25);
        score = Math.max(0, Math.min(2, score)); // Clamp 0-2
    }

    // Determine label
    let label: string;
    if (score < 0.0) label = "Below Market";
    else if (score < 0.3) label = "Economy";
    else if (score < 0.7) label = "Mid-Market";
    else if (score <= 1.0) label = "Premium";
    else label = "Above Market";

    // Percentile approximation
    const pctile = Math.min(100, Math.max(0, Math.round(score * 100)));
    const percentile = pctile > 50 ? `Top ${100 - pctile}%` : `Bottom ${pctile}%`;

    // Over/under-spec detection (Method #6)
    const benchmarks = FITOUT_RATIO_BENCHMARKS[tier] ?? FITOUT_RATIO_BENCHMARKS.mid;
    let riskFlag: "OVER_SPEC" | "UNDER_SPEC" | null = null;
    let riskMessage: string | null = null;

    if (fitoutRatio > benchmarks.max) {
        riskFlag = "OVER_SPEC";
        riskMessage = `Fitout at ${(fitoutRatio * 100).toFixed(0)}% of sale price exceeds ${tier} norm of ${(benchmarks.max * 100).toFixed(0)}%. Consider reducing specification to improve ROI.`;
    } else if (fitoutRatio < benchmarks.min) {
        riskFlag = "UNDER_SPEC";
        riskMessage = `Fitout at ${(fitoutRatio * 100).toFixed(0)}% of sale price is below ${tier} minimum of ${(benchmarks.min * 100).toFixed(0)}%. May not meet buyer expectations.`;
    }

    return { score, label, percentile, fitoutRatio, riskFlag, riskMessage };
}

// ─── Get Area Benchmark for a Project ───────────────────────────────────────

/**
 * getAreaSaleMedian
 *
 * Returns the median sale price AED/sqft for a given DLD area.
 * Falls back to overall Dubai median if no area-specific data.
 */
export async function getAreaSaleMedian(areaId: number | null): Promise<number | null> {
    if (!areaId) return null;
    const benchmark = await db.getDldAreaBenchmark(areaId);
    if (!benchmark) return null;
    return Number(benchmark.saleP50) || null;
}

/**
 * getAreaSaleMedianSqm
 *
 * Same as above but converts sqft → sqm (×10.764).
 * MIYAR internally uses AED/sqm for design calculations.
 */
export async function getAreaSaleMedianSqm(areaId: number | null): Promise<number> {
    const perSqft = await getAreaSaleMedian(areaId);
    if (!perSqft) return 25000; // Fallback to hardcoded Dubai average
    return Math.round(perSqft * 10.764); // sqft → sqm conversion
}
