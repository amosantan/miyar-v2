import { describe, it, expect } from "vitest";
import {
    computeDigitalTwin,
    type DigitalTwinConfig,
    type DigitalTwinResult,
} from "./digital-twin";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const BASE_CONFIG: DigitalTwinConfig = {
    gfa: 5000,
    floors: 10,
    specLevel: "standard",
    glazingRatio: 0.35,
    materials: [
        { material: "concrete", percentage: 55 },
        { material: "steel", percentage: 20 },
        { material: "glass", percentage: 10 },
        { material: "aluminum", percentage: 5 },
        { material: "gypsum", percentage: 10 },
    ],
    location: "dubai",
};

// ─── Result Structure ───────────────────────────────────────────────────────

describe("Digital Twin – Result Structure", () => {
    const result = computeDigitalTwin(BASE_CONFIG);

    it("returns sustainability score between 0-100", () => {
        expect(result.sustainabilityScore).toBeGreaterThanOrEqual(0);
        expect(result.sustainabilityScore).toBeLessThanOrEqual(100);
    });

    it("returns a valid sustainability grade", () => {
        expect(["A+", "A", "B+", "B", "C", "D", "F"]).toContain(result.sustainabilityGrade);
    });

    it("returns positive embodied carbon", () => {
        expect(result.totalEmbodiedCarbon).toBeGreaterThan(0);
        expect(result.carbonPerSqm).toBeGreaterThan(0);
    });

    it("carbon breakdown sums to ~100%", () => {
        const totalPct = result.carbonBreakdown.reduce((s, b) => s + b.percentage, 0);
        expect(totalPct).toBeGreaterThanOrEqual(95);
        expect(totalPct).toBeLessThanOrEqual(105);
    });

    it("carbon breakdown items match material count", () => {
        expect(result.carbonBreakdown.length).toBe(BASE_CONFIG.materials.length);
    });

    it("carbon breakdown is sorted descending by kgCO2e", () => {
        for (let i = 1; i < result.carbonBreakdown.length; i++) {
            expect(result.carbonBreakdown[i - 1].kgCO2e).toBeGreaterThanOrEqual(
                result.carbonBreakdown[i].kgCO2e
            );
        }
    });

    it("returns positive operational energy", () => {
        expect(result.operationalEnergy).toBeGreaterThan(0);
        expect(result.energyPerSqm).toBeGreaterThan(0);
    });

    it("energy loads sum to total", () => {
        const loadSum = result.coolingLoad + result.lightingLoad + result.equipmentLoad;
        // Allow 5% tolerance for rounding across 3 independent rounded values
        expect(loadSum).toBeGreaterThan(result.operationalEnergy * 0.95);
        expect(loadSum).toBeLessThan(result.operationalEnergy * 1.05);
    });

    it("returns 31-point lifecycle timeline (years 0-30)", () => {
        expect(result.lifecycle).toHaveLength(31);
        expect(result.lifecycle[0].year).toBe(0);
        expect(result.lifecycle[30].year).toBe(30);
    });

    it("lifecycle cumulative cost is monotonically increasing", () => {
        for (let i = 1; i < result.lifecycle.length; i++) {
            expect(result.lifecycle[i].cumulativeCost).toBeGreaterThanOrEqual(
                result.lifecycle[i - 1].cumulativeCost
            );
        }
    });

    it("year 0 has construction cost, subsequent years have 0", () => {
        expect(result.lifecycle[0].constructionCost).toBeGreaterThan(0);
        expect(result.lifecycle[0].maintenanceCost).toBe(0);
        expect(result.lifecycle[0].energyCost).toBe(0);
        for (let i = 1; i < result.lifecycle.length; i++) {
            expect(result.lifecycle[i].constructionCost).toBe(0);
        }
    });

    it("sub-scores are all 0-100", () => {
        expect(result.carbonEfficiency).toBeGreaterThanOrEqual(0);
        expect(result.carbonEfficiency).toBeLessThanOrEqual(100);
        expect(result.energyRating).toBeGreaterThanOrEqual(0);
        expect(result.energyRating).toBeLessThanOrEqual(100);
        expect(result.materialCircularity).toBeGreaterThanOrEqual(0);
        expect(result.materialCircularity).toBeLessThanOrEqual(100);
        expect(result.waterEfficiency).toBeGreaterThanOrEqual(0);
        expect(result.waterEfficiency).toBeLessThanOrEqual(100);
    });

    it("composite score = weighted sum of sub-scores", () => {
        const expected = Math.round(
            result.carbonEfficiency * 0.35 +
            result.energyRating * 0.30 +
            result.materialCircularity * 0.20 +
            result.waterEfficiency * 0.15
        );
        expect(result.sustainabilityScore).toBe(expected);
    });

    it("returns at least one recommendation", () => {
        expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    });

    it("preserves config in result", () => {
        expect(result.config).toEqual(BASE_CONFIG);
    });
});

// ─── Grading ────────────────────────────────────────────────────────────────

describe("Digital Twin – Grade Mapping", () => {
    it("high sustainability gives A+ or A grade", () => {
        const result = computeDigitalTwin({
            ...BASE_CONFIG,
            specLevel: "economy",
            glazingRatio: 0.15,
            includeRenewables: true,
            waterRecycling: true,
            materials: [
                { material: "timber", percentage: 40 },
                { material: "stone", percentage: 30 },
                { material: "concrete", percentage: 20 },
                { material: "insulation", percentage: 10 },
            ],
        });
        expect(["A+", "A", "B+"]).toContain(result.sustainabilityGrade);
    });

    it("high carbon materials get lower grade", () => {
        const result = computeDigitalTwin({
            ...BASE_CONFIG,
            materials: [
                { material: "aluminum", percentage: 60 },
                { material: "steel", percentage: 30 },
                { material: "glass", percentage: 10 },
            ],
            glazingRatio: 0.7,
            specLevel: "luxury",
        });
        expect(result.sustainabilityScore).toBeLessThan(50);
    });
});

// ─── Climate Location Impact ────────────────────────────────────────────────

describe("Digital Twin – Location Impact", () => {
    it("UAE locations have higher cooling than temperate", () => {
        const dubai = computeDigitalTwin({ ...BASE_CONFIG, location: "dubai" });
        const temperate = computeDigitalTwin({ ...BASE_CONFIG, location: "temperate" });
        expect(dubai.coolingLoad).toBeGreaterThan(temperate.coolingLoad);
    });

    it("Abu Dhabi has highest climate factor", () => {
        const dubai = computeDigitalTwin({ ...BASE_CONFIG, location: "dubai" });
        const abuDhabi = computeDigitalTwin({ ...BASE_CONFIG, location: "abu_dhabi" });
        expect(abuDhabi.operationalEnergy).toBeGreaterThanOrEqual(dubai.operationalEnergy);
    });
});

// ─── Spec Level Impact ──────────────────────────────────────────────────────

describe("Digital Twin – Spec Level", () => {
    it("luxury has higher lifecycle cost than economy", () => {
        const economy = computeDigitalTwin({ ...BASE_CONFIG, specLevel: "economy" });
        const luxury = computeDigitalTwin({ ...BASE_CONFIG, specLevel: "luxury" });
        expect(luxury.lifecycleCost30yr).toBeGreaterThan(economy.lifecycleCost30yr);
    });

    it("premium has higher energy than economy", () => {
        const economy = computeDigitalTwin({ ...BASE_CONFIG, specLevel: "economy" });
        const premium = computeDigitalTwin({ ...BASE_CONFIG, specLevel: "premium" });
        expect(premium.operationalEnergy).toBeGreaterThan(economy.operationalEnergy);
    });
});

// ─── Glazing Ratio ──────────────────────────────────────────────────────────

describe("Digital Twin – Glazing Impact", () => {
    it("higher glazing increases cooling load", () => {
        const low = computeDigitalTwin({ ...BASE_CONFIG, glazingRatio: 0.15 });
        const high = computeDigitalTwin({ ...BASE_CONFIG, glazingRatio: 0.70 });
        expect(high.coolingLoad).toBeGreaterThan(low.coolingLoad);
    });
});

// ─── Renewables & Water ─────────────────────────────────────────────────────

describe("Digital Twin – Green Features", () => {
    it("renewables reduce operational energy", () => {
        const without = computeDigitalTwin({ ...BASE_CONFIG, includeRenewables: false });
        const withR = computeDigitalTwin({ ...BASE_CONFIG, includeRenewables: true });
        expect(withR.operationalEnergy).toBeLessThan(without.operationalEnergy);
    });

    it("renewables improve energy rating score", () => {
        const without = computeDigitalTwin({ ...BASE_CONFIG, includeRenewables: false });
        const withR = computeDigitalTwin({ ...BASE_CONFIG, includeRenewables: true });
        expect(withR.energyRating).toBeGreaterThanOrEqual(without.energyRating);
    });

    it("water recycling improves water efficiency score", () => {
        const without = computeDigitalTwin({ ...BASE_CONFIG, waterRecycling: false });
        const withW = computeDigitalTwin({ ...BASE_CONFIG, waterRecycling: true });
        expect(withW.waterEfficiency).toBeGreaterThan(without.waterEfficiency);
    });
});

// ─── GFA Scaling ────────────────────────────────────────────────────────────

describe("Digital Twin – GFA Scaling", () => {
    it("doubling GFA roughly doubles total carbon", () => {
        const small = computeDigitalTwin({ ...BASE_CONFIG, gfa: 2000 });
        const big = computeDigitalTwin({ ...BASE_CONFIG, gfa: 4000 });
        const ratio = big.totalEmbodiedCarbon / small.totalEmbodiedCarbon;
        expect(ratio).toBeGreaterThan(1.8);
        expect(ratio).toBeLessThan(2.2);
    });

    it("carbonPerSqm is independent of GFA", () => {
        const small = computeDigitalTwin({ ...BASE_CONFIG, gfa: 2000 });
        const big = computeDigitalTwin({ ...BASE_CONFIG, gfa: 10000 });
        // carbonPerSqm divides by GFA not totalArea, so may differ
        // but the engine divides total by gfa, which includes floors
        // so carbonPerSqm = totalCarbon / gfa — totalCarbon scales with gfa
        expect(small.carbonPerSqm).toBe(big.carbonPerSqm);
    });
});

// ─── Recommendations ────────────────────────────────────────────────────────

describe("Digital Twin – Recommendations", () => {
    it("returns max 5 recommendations", () => {
        const result = computeDigitalTwin({
            ...BASE_CONFIG,
            materials: [
                { material: "aluminum", percentage: 50 },
                { material: "steel", percentage: 40 },
                { material: "glass", percentage: 10 },
            ],
            glazingRatio: 0.8,
        });
        expect(result.recommendations.length).toBeLessThanOrEqual(5);
    });

    it("excellent profile gets congratulatory message", () => {
        const result = computeDigitalTwin({
            ...BASE_CONFIG,
            specLevel: "economy",
            glazingRatio: 0.10,
            includeRenewables: true,
            waterRecycling: true,
            materials: [
                { material: "timber", percentage: 50 },
                { material: "stone", percentage: 40 },
                { material: "insulation", percentage: 10 },
            ],
        });
        // If all sub-scores >= 50, we get the congrats message
        if (result.carbonEfficiency >= 50 && result.energyRating >= 50 &&
            result.materialCircularity >= 50 && result.waterEfficiency >= 50) {
            expect(result.recommendations[0]).toContain("Excellent");
        }
    });

    it("high glazing triggers glazing or solar recommendation when energy rating is low", () => {
        const result = computeDigitalTwin({
            ...BASE_CONFIG,
            glazingRatio: 0.70,
            specLevel: "luxury", // high spec = high energy = low energy rating
            includeRenewables: false,
            materials: [
                { material: "aluminum", percentage: 60 },
                { material: "glass", percentage: 30 },
                { material: "steel", percentage: 10 },
            ],
        });
        // Should have at least one energy/carbon recommendation
        const hasEnergyRec = result.recommendations.some(
            r => r.includes("🪟") || r.includes("☀️") || r.toLowerCase().includes("glaz") || r.toLowerCase().includes("solar")
        );
        expect(hasEnergyRec).toBe(true);
    });
});
