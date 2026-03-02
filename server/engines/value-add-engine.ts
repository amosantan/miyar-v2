/**
 * Value-Add Engine — Phase 10 (Sales Premium & Yield Predictor)
 *
 * Pure deterministic functions — zero DB imports.
 * Computes the financial return of upgrading fitout quality:
 *   1. Yield delta (rental uplift from better finishes)
 *   2. Sale price premium (higher resale vs area median)
 *   3. Payback period (months to recoup incremental fitout cost)
 *   4. Brand equity halo (trophy/flagship portfolio effect)
 *
 * All monetary values in AED. Percentages to 1 decimal.
 */

import type {
    ValueAddInputs,
    ValueAddResult,
    ValueAddConfidence,
    ScenarioRange,
    BrandEquityInputs,
    BrandEquityResult,
    MarketTier,
    HandoverCondition,
} from "../../shared/miyar-types";

// ─── UAE Market Constants ───────────────────────────────────────────────────

/** Rental premium multipliers by handover condition (vs Shell & Core baseline) */
const RENTAL_PREMIUM_BY_CONDITION: Record<string, number> = {
    "Shell & Core": 0,
    "Category A": 0.075,   // +5–10% → midpoint 7.5%
    "Category B": 0.20,    // +15–25% → midpoint 20%
    "Fully Furnished": 0.40,    // +30–50% → midpoint 40%
};

/** Sale price impact by fitout ratio band (fitout cost / sale price per sqm) */
const SALE_IMPACT_BANDS = [
    { maxRatio: 0.10, label: "UNDER_SPEC" as const, salePremiumPct: -0.10 },
    { maxRatio: 0.18, label: "IN_SPEC" as const, salePremiumPct: 0.0 },
    { maxRatio: 0.28, label: "PREMIUM" as const, salePremiumPct: 0.085 },
    { maxRatio: Infinity, label: "OVER_SPEC" as const, salePremiumPct: 0.05 },
];

/** Scenario multipliers (conservative/aggressive vs mid estimate) */
const SCENARIO_MULT = { conservative: 0.65, aggressive: 1.35 };

/** Over-spec fitout ratio threshold — diminishing returns above this */
const OVER_SPEC_RATIO = 0.28;

/** Dubai average fitout-to-rent coefficient by tier */
const TIER_RENT_COEFF: Record<MarketTier, number> = {
    "Mid": 0.06,
    "Upper-mid": 0.08,
    "Luxury": 0.10,
    "Ultra-luxury": 0.14,
};

// ─── Confidence from DLD Comparables ────────────────────────────────────────

export function deriveConfidence(transactionCount: number): ValueAddConfidence {
    if (transactionCount >= 15) return "high";
    if (transactionCount >= 8) return "medium";
    if (transactionCount >= 3) return "low";
    return "insufficient";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildRange(mid: number): ScenarioRange {
    return {
        conservative: round2(mid * SCENARIO_MULT.conservative),
        mid: round2(mid),
        aggressive: round2(mid * SCENARIO_MULT.aggressive),
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

// ─── Core Engine: Value-Add Bridge ──────────────────────────────────────────

/**
 * computeValueAddBridge
 *
 * Given current vs proposed fitout spend, DLD area pricing, and tier:
 * → rental yield delta, sale price premium, and payback period.
 *
 * Pure function — no DB calls.
 */
export function computeValueAddBridge(inputs: ValueAddInputs): ValueAddResult {
    const {
        currentFitoutPerSqm,
        proposedFitoutPerSqm,
        gfa,
        saleMedianPerSqm,
        rentMedianPerSqm,
        tier,
        handoverCondition,
        transactionCount,
    } = inputs;

    // ── Guard: zero/negative GFA
    if (gfa <= 0 || saleMedianPerSqm <= 0) {
        return zeroResult("insufficient", null, null);
    }

    const confidence = deriveConfidence(transactionCount);

    // ── Incremental fitout investment
    const fitoutDelta = Math.max(0, proposedFitoutPerSqm - currentFitoutPerSqm);
    const incrementalFitoutCost = Math.round(fitoutDelta * gfa);

    // ── Fitout ratio (proposed vs sale price)
    const fitoutRatio = round2(proposedFitoutPerSqm / saleMedianPerSqm);

    // ── Risk flags
    let riskFlag: ValueAddResult["riskFlag"] = null;
    let riskMessage: string | null = null;

    if (fitoutRatio > OVER_SPEC_RATIO) {
        riskFlag = "DIMINISHING_RETURNS";
        riskMessage = `Fitout at ${(fitoutRatio * 100).toFixed(0)}% of sale price exceeds the ${(OVER_SPEC_RATIO * 100).toFixed(0)}% threshold. Payback extends significantly beyond 7 years.`;
    } else if (fitoutRatio < 0.10) {
        riskFlag = "UNDER_SPEC";
        riskMessage = `Fitout at ${(fitoutRatio * 100).toFixed(0)}% of sale price is below the 10% minimum for ${tier}. May not meet buyer expectations.`;
    }

    // ── If insufficient data, return structure with warnings
    if (confidence === "insufficient") {
        return {
            yieldDelta: buildRange(0),
            salePremiumPct: buildRange(0),
            salePremiumAed: buildRange(0),
            paybackMonths: buildRange(0),
            incrementalFitoutCost,
            fitoutRatio,
            confidence,
            riskFlag,
            riskMessage: "Insufficient DLD comparables (< 3 transactions). Results are indicative only.",
        };
    }

    // ── 1. Yield Delta
    //
    // Two approaches combined:
    // A) Handover condition rental premium (if handover condition provided)
    // B) Tier-based fitout-to-rent coefficient (always)
    //
    const rentCoeff = TIER_RENT_COEFF[tier] ?? 0.08;

    // Base: improvement from upgrading fitout specification
    // Higher fitout → captures more of the tier's rental premium potential
    const fitoutImprovementRatio = saleMedianPerSqm > 0
        ? fitoutDelta / saleMedianPerSqm
        : 0;
    let yieldDeltaMid = fitoutImprovementRatio * rentCoeff * 100; // convert to percentage points

    // Adjustment: handover condition premium (if known)
    if (handoverCondition) {
        const conditionPremium = RENTAL_PREMIUM_BY_CONDITION[handoverCondition] ?? 0;
        // Blend: condition data is stronger signal when available
        yieldDeltaMid = Math.max(yieldDeltaMid, conditionPremium * rentCoeff * 100);
    }

    // Cap yield delta at reasonable market bounds
    yieldDeltaMid = clamp(yieldDeltaMid, 0, 4.0); // max 4 pp uplift

    // ── 2. Sale Price Premium
    //
    // Where does the proposed fitout sit in the sale impact bands?
    const band = SALE_IMPACT_BANDS.find(b => fitoutRatio <= b.maxRatio) ?? SALE_IMPACT_BANDS[SALE_IMPACT_BANDS.length - 1];
    const currentBand = SALE_IMPACT_BANDS.find(b => (currentFitoutPerSqm / saleMedianPerSqm) <= b.maxRatio) ?? SALE_IMPACT_BANDS[0];

    const salePremiumMid = round1((band.salePremiumPct - currentBand.salePremiumPct) * 100); // as percentage
    const totalSaleValue = saleMedianPerSqm * gfa;
    const salePremiumAedMid = Math.round(totalSaleValue * (salePremiumMid / 100));

    // ── 3. Payback Period
    //
    // paybackMonths = incrementalFitoutCost / (annualRentalPremium / 12)
    //
    let paybackMid: number;
    if (incrementalFitoutCost <= 0) {
        paybackMid = 0;
    } else {
        // Estimate annual rental premium from yield delta
        const annualRentalPremium = totalSaleValue * (yieldDeltaMid / 100);
        if (annualRentalPremium <= 0) {
            paybackMid = 999; // Effectively infinite payback
        } else {
            paybackMid = round1(incrementalFitoutCost / (annualRentalPremium / 12));
        }
    }

    return {
        yieldDelta: buildRange(yieldDeltaMid),
        salePremiumPct: buildRange(salePremiumMid),
        salePremiumAed: buildRange(salePremiumAedMid),
        paybackMonths: {
            // Payback ranges are inverted: conservative = longer, aggressive = shorter
            conservative: round1(paybackMid / SCENARIO_MULT.conservative),
            mid: round1(paybackMid),
            aggressive: round1(paybackMid / SCENARIO_MULT.aggressive),
        },
        incrementalFitoutCost,
        fitoutRatio,
        confidence,
        riskFlag,
        riskMessage,
    };
}

// ─── Core Engine: Brand Equity Forecast ─────────────────────────────────────

/**
 * computeBrandEquityForecast
 *
 * For trophy/flagship projects: models the "halo effect" where a
 * high-performing project lifts perceived value of the developer's
 * next project by 3–8%.
 *
 * Formula: haloUpliftPct = (salePerformancePct - 10) * 0.35, clamped at 8%
 */
export function computeBrandEquityForecast(inputs: BrandEquityInputs): BrandEquityResult {
    const { tier, targetValueAdd, salePerformancePct, brandedStatus } = inputs;

    // Halo only applies to Trophy/Ultra-luxury flagships
    const isTrophy = targetValueAdd === "Brand Flagship / Trophy";
    const isUltraLuxury = tier === "Ultra-luxury";
    const isBranded = brandedStatus !== "Unbranded";

    const haloApplies = isTrophy || (isUltraLuxury && isBranded);

    if (!haloApplies) {
        return {
            haloUpliftPct: 0,
            haloApplies: false,
            reasoning: `Halo effect is not applicable for ${tier} ${targetValueAdd} projects. Trophy or Ultra-luxury branded projects qualify.`,
            portfolioImpactAed: { conservative: 0, mid: 0, aggressive: 0 },
        };
    }

    // Must be performing > 10% above area median to generate halo
    if (salePerformancePct <= 10) {
        return {
            haloUpliftPct: 0,
            haloApplies: true,
            reasoning: `Project is performing at +${round1(salePerformancePct)}% above area median. Halo effect activates at >10% outperformance. Current performance is at the threshold.`,
            portfolioImpactAed: { conservative: 0, mid: 0, aggressive: 0 },
        };
    }

    // Core formula from SKILL.md
    const rawHalo = (salePerformancePct - 10) * 0.35;
    const haloUpliftPct = round1(clamp(rawHalo, 0, 8));

    // Branded status bonus: branded projects carry stronger halo
    const brandBonus = isBranded ? 1.15 : 1.0;
    const adjustedHalo = round1(clamp(haloUpliftPct * brandBonus, 0, 8));

    // Portfolio impact: estimate AED uplift on next project at 3 GFA scenarios
    // Small (500 sqm), Medium (2000 sqm), Large (5000 sqm) at Dubai avg 25,000 AED/sqm
    const dubaiAvgPerSqm = 25000;
    const nextProjectGfas = { conservative: 500, mid: 2000, aggressive: 5000 };
    const portfolioImpactAed: ScenarioRange = {
        conservative: Math.round(nextProjectGfas.conservative * dubaiAvgPerSqm * (adjustedHalo / 100)),
        mid: Math.round(nextProjectGfas.mid * dubaiAvgPerSqm * (adjustedHalo / 100)),
        aggressive: Math.round(nextProjectGfas.aggressive * dubaiAvgPerSqm * (adjustedHalo / 100)),
    };

    const reasoning = [
        `Project performs at +${round1(salePerformancePct)}% above area median.`,
        `Halo formula: (${round1(salePerformancePct)} - 10) × 0.35 = ${round1(rawHalo)}%, clamped at 8%.`,
        isBranded ? `Branded status (${brandedStatus}) applies a 15% brand amplification bonus.` : "",
        `Expected uplift on next project: +${adjustedHalo}%.`,
    ].filter(Boolean).join(" ");

    return {
        haloUpliftPct: adjustedHalo,
        haloApplies: true,
        reasoning,
        portfolioImpactAed,
    };
}

// ─── Zero Result Helper ─────────────────────────────────────────────────────

function zeroResult(
    confidence: ValueAddConfidence,
    riskFlag: ValueAddResult["riskFlag"],
    riskMessage: string | null,
): ValueAddResult {
    return {
        yieldDelta: { conservative: 0, mid: 0, aggressive: 0 },
        salePremiumPct: { conservative: 0, mid: 0, aggressive: 0 },
        salePremiumAed: { conservative: 0, mid: 0, aggressive: 0 },
        paybackMonths: { conservative: 0, mid: 0, aggressive: 0 },
        incrementalFitoutCost: 0,
        fitoutRatio: 0,
        confidence,
        riskFlag,
        riskMessage,
    };
}
