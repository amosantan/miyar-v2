/**
 * Phase 10 — Value-Add Engine Tests
 *
 * Validates the pure deterministic math for:
 * - computeValueAddBridge: yield delta, sale premium, payback period
 * - computeBrandEquityForecast: trophy asset halo effect
 */

import { describe, it, expect } from "vitest";
import { computeValueAddBridge, computeBrandEquityForecast, deriveConfidence } from "./value-add-engine";
import type { ValueAddInputs, BrandEquityInputs } from "../../shared/miyar-types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeValueAddInputs(overrides: Partial<ValueAddInputs> = {}): ValueAddInputs {
    return {
        currentFitoutPerSqm: 1500,
        proposedFitoutPerSqm: 3500,
        gfa: 1000,
        saleMedianPerSqm: 25000,
        tier: "Luxury",
        transactionCount: 20,
        ...overrides,
    };
}

function makeBrandEquityInputs(overrides: Partial<BrandEquityInputs> = {}): BrandEquityInputs {
    return {
        tier: "Ultra-luxury",
        targetValueAdd: "Brand Flagship / Trophy",
        salePerformancePct: 20,
        brandedStatus: "Unbranded",
        ...overrides,
    };
}

// ─── deriveConfidence ───────────────────────────────────────────────────────

describe("deriveConfidence", () => {
    it("returns high for >= 15 transactions", () => {
        expect(deriveConfidence(15)).toBe("high");
        expect(deriveConfidence(100)).toBe("high");
    });

    it("returns medium for 8-14 transactions", () => {
        expect(deriveConfidence(8)).toBe("medium");
        expect(deriveConfidence(14)).toBe("medium");
    });

    it("returns low for 3-7 transactions", () => {
        expect(deriveConfidence(3)).toBe("low");
        expect(deriveConfidence(7)).toBe("low");
    });

    it("returns insufficient for < 3 transactions", () => {
        expect(deriveConfidence(0)).toBe("insufficient");
        expect(deriveConfidence(2)).toBe("insufficient");
    });
});

// ─── computeValueAddBridge ──────────────────────────────────────────────────

describe("computeValueAddBridge", () => {
    it("returns positive yield delta when upgrading from Category A to Fully Furnished", () => {
        const result = computeValueAddBridge(makeValueAddInputs({
            currentFitoutPerSqm: 1500,
            proposedFitoutPerSqm: 4000,
            handoverCondition: "Fully Furnished",
        }));

        expect(result.yieldDelta.mid).toBeGreaterThan(0);
        expect(result.yieldDelta.conservative).toBeLessThan(result.yieldDelta.mid);
        expect(result.yieldDelta.aggressive).toBeGreaterThan(result.yieldDelta.mid);
        expect(result.confidence).toBe("high");
    });

    it("returns zero delta when current equals proposed", () => {
        const result = computeValueAddBridge(makeValueAddInputs({
            currentFitoutPerSqm: 3000,
            proposedFitoutPerSqm: 3000,
        }));

        expect(result.yieldDelta.mid).toBe(0);
        expect(result.incrementalFitoutCost).toBe(0);
        expect(result.paybackMonths.mid).toBe(0);
    });

    it("returns DIMINISHING_RETURNS risk flag when above over-spec threshold", () => {
        const result = computeValueAddBridge(makeValueAddInputs({
            proposedFitoutPerSqm: 8000,   // 32% of 25,000 — above 28% threshold
            saleMedianPerSqm: 25000,
        }));

        expect(result.riskFlag).toBe("DIMINISHING_RETURNS");
        expect(result.riskMessage).toContain("28%");
    });

    it("returns UNDER_SPEC risk flag when fitout is too low", () => {
        const result = computeValueAddBridge(makeValueAddInputs({
            currentFitoutPerSqm: 500,
            proposedFitoutPerSqm: 2000,   // 8% of 25,000 — below 10%
            saleMedianPerSqm: 25000,
        }));

        expect(result.riskFlag).toBe("UNDER_SPEC");
    });

    it("returns insufficient confidence when < 3 DLD comparables", () => {
        const result = computeValueAddBridge(makeValueAddInputs({
            transactionCount: 2,
        }));

        expect(result.confidence).toBe("insufficient");
        expect(result.riskMessage).toContain("Insufficient");
    });

    it("payback period is finite and positive", () => {
        const result = computeValueAddBridge(makeValueAddInputs());

        expect(result.paybackMonths.mid).toBeGreaterThan(0);
        expect(result.paybackMonths.mid).toBeLessThan(999);
    });

    it("handles zero GFA gracefully", () => {
        const result = computeValueAddBridge(makeValueAddInputs({ gfa: 0 }));

        expect(result.yieldDelta.mid).toBe(0);
        expect(result.incrementalFitoutCost).toBe(0);
        expect(result.confidence).toBe("insufficient");
    });

    it("handles zero sale median gracefully", () => {
        const result = computeValueAddBridge(makeValueAddInputs({ saleMedianPerSqm: 0 }));

        expect(result.yieldDelta.mid).toBe(0);
        expect(result.confidence).toBe("insufficient");
    });

    it("incremental fitout cost is calculated correctly", () => {
        const result = computeValueAddBridge(makeValueAddInputs({
            currentFitoutPerSqm: 2000,
            proposedFitoutPerSqm: 3500,
            gfa: 500,
        }));

        expect(result.incrementalFitoutCost).toBe(750000); // 1500 * 500
    });

    it("conservative payback is longer than aggressive", () => {
        const result = computeValueAddBridge(makeValueAddInputs());

        expect(result.paybackMonths.conservative).toBeGreaterThan(result.paybackMonths.mid);
        expect(result.paybackMonths.aggressive).toBeLessThan(result.paybackMonths.mid);
    });

    it("yield delta is capped at 4pp maximum", () => {
        // Extreme fitout upgrade that would otherwise produce > 4pp
        const result = computeValueAddBridge(makeValueAddInputs({
            currentFitoutPerSqm: 0,
            proposedFitoutPerSqm: 25000,  // 100% fitout ratio
            saleMedianPerSqm: 25000,
            tier: "Ultra-luxury",
        }));

        expect(result.yieldDelta.mid).toBeLessThanOrEqual(4.0);
    });
});

// ─── computeBrandEquityForecast ─────────────────────────────────────────────

describe("computeBrandEquityForecast", () => {
    it("Ultra-luxury trophy returns positive haloUpliftPct", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs());

        expect(result.haloApplies).toBe(true);
        expect(result.haloUpliftPct).toBeGreaterThan(0);
    });

    it("haloUpliftPct is clamped at 8%", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs({
            salePerformancePct: 50,  // very high performance
        }));

        expect(result.haloUpliftPct).toBeLessThanOrEqual(8);
    });

    it("non-Trophy targetValueAdd returns zero halo effect", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs({
            targetValueAdd: "Balanced Return",
            tier: "Mid",
            brandedStatus: "Unbranded",
        }));

        expect(result.haloApplies).toBe(false);
        expect(result.haloUpliftPct).toBe(0);
    });

    it("performance below 10% threshold returns zero halo", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs({
            salePerformancePct: 8,
        }));

        expect(result.haloApplies).toBe(true);
        expect(result.haloUpliftPct).toBe(0);
    });

    it("branded status amplifies halo effect", () => {
        const unbrandedResult = computeBrandEquityForecast(makeBrandEquityInputs({
            brandedStatus: "Unbranded",
        }));
        const brandedResult = computeBrandEquityForecast(makeBrandEquityInputs({
            brandedStatus: "Hospitality Branded",
        }));

        expect(brandedResult.haloUpliftPct).toBeGreaterThanOrEqual(unbrandedResult.haloUpliftPct);
    });

    it("Ultra-luxury + Branded triggers halo even without Trophy targetValueAdd", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs({
            tier: "Ultra-luxury",
            targetValueAdd: "Max Capital Appreciation",
            brandedStatus: "Fashion/Automotive Branded",
            salePerformancePct: 25,
        }));

        expect(result.haloApplies).toBe(true);
        expect(result.haloUpliftPct).toBeGreaterThan(0);
    });

    it("portfolioImpactAed is non-zero when halo applies", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs());

        expect(result.portfolioImpactAed.mid).toBeGreaterThan(0);
        expect(result.portfolioImpactAed.conservative).toBeLessThan(result.portfolioImpactAed.mid);
        expect(result.portfolioImpactAed.aggressive).toBeGreaterThan(result.portfolioImpactAed.mid);
    });

    it("reasoning string is non-empty", () => {
        const result = computeBrandEquityForecast(makeBrandEquityInputs());

        expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it("follows the exact SKILL.md formula: (perf - 10) * 0.35", () => {
        // salePerformancePct = 20, so halo = (20 - 10) * 0.35 = 3.5%
        const result = computeBrandEquityForecast(makeBrandEquityInputs({
            salePerformancePct: 20,
            brandedStatus: "Unbranded",  // no brand bonus
        }));

        expect(result.haloUpliftPct).toBe(3.5);
    });
});
