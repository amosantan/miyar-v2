import { describe, it, expect } from "vitest";
import { benchmarkSpaceRatios } from "./design/space-benchmarking";
import type { FloorPlanAnalysis } from "./design/floor-plan-analyzer";

/**
 * Phase 9 Space Intelligence — Test Suite
 *
 * Tests deterministic space benchmarking, room classification, and scoring integration.
 */

function mockFloorPlan(override?: Partial<FloorPlanAnalysis>): FloorPlanAnalysis {
    return {
        totalEstimatedSqm: 186,
        bedroomCount: 2,
        bathroomCount: 2,
        balconyPercentage: 6,
        circulationPercentage: 17,
        unitType: "2BR",
        analysisConfidence: "high",
        rawNotes: "Mock floor plan for testing",
        rooms: [
            { name: "Living Room", type: "living", estimatedSqm: 52, percentOfTotal: 28, finishGrade: "A" },
            { name: "Master Bedroom", type: "bedroom", estimatedSqm: 37, percentOfTotal: 20, finishGrade: "A" },
            { name: "Kitchen", type: "kitchen", estimatedSqm: 19, percentOfTotal: 10, finishGrade: "A" },
            { name: "Bedroom 2", type: "bedroom", estimatedSqm: 22, percentOfTotal: 12, finishGrade: "B" },
            { name: "Bathroom 1", type: "bathroom", estimatedSqm: 7.5, percentOfTotal: 4, finishGrade: "A" },
            { name: "Bathroom 2", type: "bathroom", estimatedSqm: 5.5, percentOfTotal: 3, finishGrade: "B" },
            { name: "Balcony", type: "balcony", estimatedSqm: 11, percentOfTotal: 6, finishGrade: "C" },
            { name: "Corridor", type: "corridor", estimatedSqm: 32, percentOfTotal: 17, finishGrade: "C" },
        ],
        ...override,
    };
}

describe("V9 Space Benchmarking", () => {
    it("returns a valid benchmark result with all required fields", () => {
        const result = benchmarkSpaceRatios(mockFloorPlan(), "Dubai Marina", 500, 25000);

        expect(result).toBeDefined();
        expect(result.overallEfficiencyScore).toBeGreaterThanOrEqual(0);
        expect(result.overallEfficiencyScore).toBeLessThanOrEqual(100);
        expect(result.circulationWastePercent).toBeGreaterThanOrEqual(0);
        expect(result.totalCritical).toBeGreaterThanOrEqual(0);
        expect(result.totalAdvisory).toBeGreaterThanOrEqual(0);
        expect(result.totalOptimal).toBeGreaterThanOrEqual(0);
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.areaName).toBe("Dubai Marina");
        expect(result.unitType).toBeDefined();
    });

    it("classifies rooms into severity tiers (critical/advisory/optimal)", () => {
        const result = benchmarkSpaceRatios(mockFloorPlan(), "Downtown Dubai", 300, 30000);

        const severities = result.recommendations.map(r => r.severity);
        for (const sev of severities) {
            expect(["critical", "advisory", "optimal"]).toContain(sev);
        }

        // Total counts should match recommendations length
        expect(result.totalCritical + result.totalAdvisory + result.totalOptimal).toBe(result.recommendations.length);
    });

    it("calculates circulation waste from corridor + hallway rooms", () => {
        const result = benchmarkSpaceRatios(mockFloorPlan(), "JBR", 200, 20000);

        // Corridor is ~17% — should be detected
        expect(result.circulationWastePercent).toBeGreaterThan(10);
    });

    it("handles empty room list gracefully", () => {
        const emptyPlan = mockFloorPlan({
            rooms: [],
            totalEstimatedSqm: 100,
            bedroomCount: 0,
            bathroomCount: 0,
            balconyPercentage: 0,
            circulationPercentage: 0,
            unitType: "Studio",
        });
        const result = benchmarkSpaceRatios(emptyPlan, "Palm Jumeirah", 100, 40000);

        expect(result.overallEfficiencyScore).toBeDefined();
        expect(result.recommendations.length).toBe(0);
        expect(result.totalCritical).toBe(0);
        expect(result.totalAdvisory).toBe(0);
        expect(result.totalOptimal).toBe(0);
    });

    it("returns higher efficiency for well-proportioned layouts", () => {
        const balanced = mockFloorPlan({
            totalEstimatedSqm: 140,
            rooms: [
                { name: "Living", type: "living", estimatedSqm: 39, percentOfTotal: 28, finishGrade: "A" },
                { name: "Master", type: "bedroom", estimatedSqm: 25, percentOfTotal: 18, finishGrade: "A" },
                { name: "Kitchen", type: "kitchen", estimatedSqm: 17, percentOfTotal: 12, finishGrade: "A" },
                { name: "Bath", type: "bathroom", estimatedSqm: 7, percentOfTotal: 5, finishGrade: "A" },
                { name: "Corridor", type: "corridor", estimatedSqm: 10, percentOfTotal: 7, finishGrade: "C" },
            ],
            circulationPercentage: 7,
        });

        const unbalanced = mockFloorPlan({
            totalEstimatedSqm: 140,
            rooms: [
                { name: "Living", type: "living", estimatedSqm: 14, percentOfTotal: 10, finishGrade: "A" },
                { name: "Corridor", type: "corridor", estimatedSqm: 56, percentOfTotal: 40, finishGrade: "C" },
                { name: "Bath", type: "bathroom", estimatedSqm: 28, percentOfTotal: 20, finishGrade: "A" },
            ],
            circulationPercentage: 40,
        });

        const balancedResult = benchmarkSpaceRatios(balanced, "Dubai Marina", 200, 25000);
        const unbalancedResult = benchmarkSpaceRatios(unbalanced, "Dubai Marina", 200, 25000);

        expect(balancedResult.overallEfficiencyScore).toBeGreaterThan(unbalancedResult.overallEfficiencyScore);
        expect(balancedResult.totalCritical).toBeLessThanOrEqual(unbalancedResult.totalCritical);
    });
});

describe("V9 Scoring Integration", () => {
    it("spaceEfficiencyScore normalizes to 0-1 range", () => {
        const { normalizeInputs } = require("./normalization");

        const inputsWithSpace: any = {
            ctx01Typology: "Residential",
            ctx02Scale: "Medium",
            ctx03Gfa: 1000,
            totalFitoutArea: null,
            ctx04Location: "Primary",
            ctx05Horizon: "12-24m",
            str01BrandClarity: 3,
            str02Differentiation: 3,
            str03BuyerMaturity: 3,
            mkt01Tier: "Upper-mid",
            mkt02Competitor: 3,
            mkt03Trend: 3,
            fin01BudgetCap: 200,
            fin02Flexibility: 3,
            fin03ShockTolerance: 3,
            fin04SalesPremium: 3,
            des01Style: "Modern",
            des02MaterialLevel: 3,
            des03Complexity: 3,
            des04Experience: 3,
            des05Sustainability: 2,
            exe01SupplyChain: 3,
            exe02Contractor: 3,
            exe03Approvals: 2,
            exe04QaMaturity: 3,
            add01SampleKit: false,
            add02PortfolioMode: false,
            add03DashboardExport: true,
            city: "Dubai",
            sustainCertTarget: "silver",
            spaceEfficiencyScore: 75,
            spaceCriticalCount: 1,
        };

        const normalized = normalizeInputs(inputsWithSpace);
        expect(normalized.spaceEfficiency_n).toBeCloseTo(0.75, 2);
    });

    it("defaults spaceEfficiency_n to 0.5 when no score", () => {
        const { normalizeInputs } = require("./normalization");

        const inputsNoSpace: any = {
            ctx01Typology: "Residential",
            ctx02Scale: "Medium",
            ctx03Gfa: 1000,
            totalFitoutArea: null,
            ctx04Location: "Primary",
            ctx05Horizon: "12-24m",
            str01BrandClarity: 3,
            str02Differentiation: 3,
            str03BuyerMaturity: 3,
            mkt01Tier: "Upper-mid",
            mkt02Competitor: 3,
            mkt03Trend: 3,
            fin01BudgetCap: 200,
            fin02Flexibility: 3,
            fin03ShockTolerance: 3,
            fin04SalesPremium: 3,
            des01Style: "Modern",
            des02MaterialLevel: 3,
            des03Complexity: 3,
            des04Experience: 3,
            des05Sustainability: 2,
            exe01SupplyChain: 3,
            exe02Contractor: 3,
            exe03Approvals: 2,
            exe04QaMaturity: 3,
            add01SampleKit: false,
            add02PortfolioMode: false,
            add03DashboardExport: true,
            city: "Dubai",
            sustainCertTarget: "silver",
        };

        const normalized = normalizeInputs(inputsNoSpace);
        expect(normalized.spaceEfficiency_n).toBeCloseTo(0.5, 2);
    });
});
