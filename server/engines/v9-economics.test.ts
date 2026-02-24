import { describe, it, expect } from "vitest";
import { calculateCostAvoidance } from "./economic/cost-avoidance";
import { calculateProgrammeAcceleration } from "./economic/programme-acceleration";
import { calculateProjectRoi } from "./economic/roi-calculator";
import { evaluateRiskSurface } from "./risk/risk-evaluator";
import { simulateStressTest } from "./risk/stress-tester";
import { rankScenarios } from "./autonomous/scenario-ranking";

describe("V9 Strategic Risk & Economic Modeling Engines", () => {
    it("calculates cost avoidance correctly for large luxury projects", () => {
        const result = calculateCostAvoidance("Luxury", "Large", 1000000, 80);
        // Probability = Math.min(0.50, 0.15 + (80 * 0.0035)) = 0.15 + 0.28 = 0.43
        // Cost of Change = 1,000,000 * 0.20 = 200,000
        // Scope Ratio = 0.40
        // Expected = 0.43 * 200,000 * 0.40 = 34,400
        expect(result.reworkCostAvoided).toBe(34400);
        expect(result.probabilityPercent).toBe(43);
        expect(result.estimatedReplacementCost).toBe(200000);
        expect(result.scopeImpactRatio).toBe(0.40);
    });

    it("calculates programme acceleration accurately", () => {
        // 50,000,000 GDV, Mid tier
        const result = calculateProgrammeAcceleration(50000000, "Mid", 1.0);
        // Days Saved = 30
        // Annual Financing = 50,000,000 * 0.08 = 4,000,000
        // Daily Carry = 4,000,000 / 365 ≈ 10958.90
        // Val = 30 * 10958.90 ≈ 328767.12
        expect(result.daysSaved).toBe(30);
        expect(result.dailyCarryCost).toBeCloseTo(10958.90, 1);
        expect(result.programmeAccelerationValue).toBeCloseTo(328767.12, 1);
    });

    it("calculates aggregate net ROI correctly", () => {
        const result = calculateProjectRoi({
            tier: "Ultra-luxury",
            scale: "Medium",
            totalBudgetAed: 5000000,
            totalDevelopmentValue: 80000000,
            complexityScore: 90,
            decisionSpeedAdjustment: 1.0,
            serviceFeeAed: 15000
        });

        // Cost avoidance: Probability = Math.min(0.50, 0.15 + (90 * 0.0035)) = 0.465 -> 0.465
        // Cost of change: 5,000,000 * 0.25 = 1,250,000
        // Scope ratio: Medium = 0.60
        // Rework avoided = 0.465 * 1250000 * 0.60 = 348750

        // Acceleration: Ultra-luxury = 60 days
        // Annual Financing = 80,000,000 * 0.08 = 6,400,000
        // Daily Carry = 6400000 / 365 = 17534.246
        // Value = 60 * 17534.246 = 1052054.79

        // Total value = 348750 + 1052054.79 = 1400804.79
        // Net ROI = ((1400804.79 - 15000) / 15000) * 100

        expect(result.totalValueCreated).toBeGreaterThan(1400000);
        expect(result.netRoiPercent).toBeGreaterThan(9000); // Massive ROI vs 15k fee
        expect(result.confidenceMultiplier).toBe(0.85); // 90 complexity > 80
    });

    it("evaluates risk surface perfectly using PxIxV/C constraint", () => {
        const result = evaluateRiskSurface({
            domain: "Strategic",
            tier: "Mid",
            horizon: "12-24m",
            location: "Prime",
            complexityScore: 80
        });
        // Strategic Mid tier:
        // BaseProb = 70, BaseImpact = 95, BaseVuln = 40 (since < 36m), Control = 40
        // Runbounded = (70 * 95 * 40) / 40 = 6650
        // Composite = 6650 / 200 = 33
        expect(result.compositeRiskScore).toBe(33);
        expect(result.riskBand).toBe("Controlled");
    });

    it("simulates stress conditions on design scenarios", () => {
        const result = simulateStressTest("cost_surge", 1000000, "Mid");
        // Cost Surge on Mid tier = Resilience 45
        expect(result.resilienceScore).toBe(45);
        expect(result.impactMagnitudePercent).toBe(20);
        expect(result.failurePoints).toContain("margin_protection");
    });

    it("ranks scenarios heuristically based on ROI and Risk", () => {
        const scenarios = [
            { scenarioId: 1, name: "A", netRoiPercent: 50, avgResilienceScore: 80, compositeRiskScore: 30 },
            { scenarioId: 2, name: "B", netRoiPercent: 120, avgResilienceScore: 50, compositeRiskScore: 60 }
        ];
        // A rank: (50*0.5) + (80*0.3) + (70*0.2) = 25 + 24 + 14 = 63
        // B rank: (100*0.5) + (50*0.3) + (40*0.2) = 50 + 15 + 8 = 73 (ROI capped at 100)
        const ranked = rankScenarios(scenarios);
        expect(ranked[0].name).toBe("B");
        expect(ranked[0].strategicRankScore).toBe(73);
        expect(ranked[1].name).toBe("A");
        expect(ranked[1].strategicRankScore).toBe(63);
    });
});
