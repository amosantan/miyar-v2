/**
 * V11: Cognitive Bias Detection — Test Suite
 * Tests all 7 bias detectors with edge cases and boundary conditions.
 */

import { describe, it, expect } from "vitest";
import { detectBiases } from "./bias/bias-detector";
import type { ProjectInputs, ScoreResult } from "../../shared/miyar-types";
import type { DetectorContext } from "./bias/bias-types";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeInputs(overrides: Partial<ProjectInputs> = {}): ProjectInputs {
    return {
        ctx01Typology: "Residential",
        ctx02Scale: "Medium",
        ctx03Gfa: 500,
        ctx04Location: "Secondary",
        ctx05Horizon: "12-24m",
        str01BrandClarity: 3,
        str02Differentiation: 3,
        str03BuyerMaturity: 3,
        mkt01Tier: "Upper-mid",
        mkt02Competitor: 3,
        mkt03Trend: 3,
        fin01BudgetCap: 750000,
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
        ...overrides,
    };
}

function makeScore(overrides: Partial<ScoreResult> = {}): ScoreResult {
    return {
        dimensions: { sa: 70, ff: 65, mp: 60, ds: 55, er: 50 },
        dimensionWeights: { sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.20, er: 0.15 },
        compositeScore: 62,
        riskScore: 35,
        rasScore: 58,
        confidenceScore: 75,
        decisionStatus: "conditional",
        penalties: [],
        riskFlags: [],
        conditionalActions: [],
        variableContributions: {},
        inputSnapshot: makeInputs(),
        ...overrides,
    };
}

function makeCtx(overrides: Partial<DetectorContext> = {}): DetectorContext {
    return {
        projectId: 1,
        userId: 1,
        orgId: 1,
        evaluationCount: 1,
        previousScores: [],
        previousBudgets: [],
        overrideCount: 0,
        overrideNetEffect: 0,
        marketTrendActual: null,
        ...overrides,
    };
}

// ─── 1. Optimism Bias Tests ─────────────────────────────────────────────────

describe("1: Optimism Bias", () => {
    it("should detect when Ultra-luxury budget is 30%+ below median", () => {
        const inputs = makeInputs({
            mkt01Tier: "Ultra-luxury",
            ctx03Gfa: 500,
            fin01BudgetCap: 1_000_000, // median for Ultra-luxury × 500 = 3,000,000
            fin02Flexibility: 2,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const optimism = result.find(a => a.biasType === "optimism_bias");
        expect(optimism).toBeDefined();
        expect(optimism!.severity).toMatch(/high|critical/);
    });

    it("should not flag when budget matches tier", () => {
        const inputs = makeInputs({
            mkt01Tier: "Luxury",
            ctx03Gfa: 500,
            fin01BudgetCap: 2_000_000, // ≈ median for Luxury × 500 = 1,500,000
            fin02Flexibility: 4,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const optimism = result.find(a => a.biasType === "optimism_bias");
        expect(optimism).toBeUndefined();
    });

    it("should not flag for Mid tier regardless of budget", () => {
        const inputs = makeInputs({ mkt01Tier: "Mid", fin01BudgetCap: 100_000 });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const optimism = result.find(a => a.biasType === "optimism_bias");
        expect(optimism).toBeUndefined();
    });

    it("should increase confidence with low flexibility AND shock tolerance", () => {
        const inputs = makeInputs({
            mkt01Tier: "Ultra-luxury",
            ctx03Gfa: 500,
            fin01BudgetCap: 500_000,
            fin02Flexibility: 1,
            fin03ShockTolerance: 1,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const optimism = result.find(a => a.biasType === "optimism_bias");
        expect(optimism).toBeDefined();
        expect(optimism!.confidence).toBeGreaterThan(70);
    });
});

// ─── 2. Anchoring Bias Tests ────────────────────────────────────────────────

describe("2: Anchoring Bias", () => {
    it("should detect when budget unchanged across 3+ evaluations", () => {
        const inputs = makeInputs({ fin01BudgetCap: 1_000_000 });
        const score = makeScore({
            penalties: [{ id: "P_BUDGET_LOW", trigger: "budget < threshold", effect: -5, description: "Budget too low" }],
        });
        const ctx = makeCtx({
            evaluationCount: 4,
            previousBudgets: [1_000_000, 1_000_000, 1_000_000],
        });
        const result = detectBiases(inputs, score, ctx);
        const anchoring = result.find(a => a.biasType === "anchoring_bias");
        expect(anchoring).toBeDefined();
    });

    it("should not flag with only 2 evaluations", () => {
        const inputs = makeInputs({ fin01BudgetCap: 1_000_000 });
        const ctx = makeCtx({
            evaluationCount: 2,
            previousBudgets: [1_000_000],
        });
        const result = detectBiases(inputs, makeScore(), ctx);
        const anchoring = result.find(a => a.biasType === "anchoring_bias");
        expect(anchoring).toBeUndefined();
    });

    it("should not flag if budget changed significantly", () => {
        const inputs = makeInputs({ fin01BudgetCap: 1_500_000 });
        const ctx = makeCtx({
            evaluationCount: 4,
            previousBudgets: [1_000_000, 1_000_000, 1_000_000],
        });
        const result = detectBiases(inputs, makeScore(), ctx);
        const anchoring = result.find(a => a.biasType === "anchoring_bias");
        expect(anchoring).toBeUndefined();
    });
});

// ─── 3. Confirmation Bias Tests ─────────────────────────────────────────────

describe("3: Confirmation Bias", () => {
    it("should detect when multiple positive overrides on weak project", () => {
        const score = makeScore({ compositeScore: 45 });
        const ctx = makeCtx({ overrideCount: 3, overrideNetEffect: 8 });
        const result = detectBiases(makeInputs(), score, ctx);
        const confirm = result.find(a => a.biasType === "confirmation_bias");
        expect(confirm).toBeDefined();
        expect(confirm!.evidencePoints.length).toBeGreaterThanOrEqual(2);
    });

    it("should not flag when overrides are balanced (net effect ≤ 0)", () => {
        const score = makeScore({ compositeScore: 45 });
        const ctx = makeCtx({ overrideCount: 4, overrideNetEffect: -2 });
        const result = detectBiases(makeInputs(), score, ctx);
        const confirm = result.find(a => a.biasType === "confirmation_bias");
        expect(confirm).toBeUndefined();
    });

    it("should not flag when score is already good (≥ 65)", () => {
        const score = makeScore({ compositeScore: 72 });
        const ctx = makeCtx({ overrideCount: 3, overrideNetEffect: 5 });
        const result = detectBiases(makeInputs(), score, ctx);
        const confirm = result.find(a => a.biasType === "confirmation_bias");
        expect(confirm).toBeUndefined();
    });

    it("should not flag with only 1 override", () => {
        const score = makeScore({ compositeScore: 40 });
        const ctx = makeCtx({ overrideCount: 1, overrideNetEffect: 5 });
        const result = detectBiases(makeInputs(), score, ctx);
        const confirm = result.find(a => a.biasType === "confirmation_bias");
        expect(confirm).toBeUndefined();
    });
});

// ─── 4. Overconfidence Tests ────────────────────────────────────────────────

describe("4: Overconfidence", () => {
    it("should detect max brand + differentiation with low competitor awareness", () => {
        const inputs = makeInputs({
            str01BrandClarity: 5,
            str02Differentiation: 5,
            mkt02Competitor: 1,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const oc = result.find(a => a.biasType === "overconfidence");
        expect(oc).toBeDefined();
        expect(oc!.severity).toMatch(/high|critical/);
    });

    it("should flag with 4/4 brand+diff and low competitor", () => {
        const inputs = makeInputs({
            str01BrandClarity: 4,
            str02Differentiation: 4,
            mkt02Competitor: 2,
            str03BuyerMaturity: 5,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const oc = result.find(a => a.biasType === "overconfidence");
        expect(oc).toBeDefined();
    });

    it("should not flag when brand + differentiation are moderate (≤ 3)", () => {
        const inputs = makeInputs({
            str01BrandClarity: 3,
            str02Differentiation: 3,
            mkt02Competitor: 1,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const oc = result.find(a => a.biasType === "overconfidence");
        expect(oc).toBeUndefined();
    });

    it("should not flag when competitor awareness is high (≥ 3)", () => {
        const inputs = makeInputs({
            str01BrandClarity: 5,
            str02Differentiation: 5,
            mkt02Competitor: 4,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const oc = result.find(a => a.biasType === "overconfidence");
        expect(oc).toBeUndefined();
    });
});

// ─── 5. Scope Creep Tests ───────────────────────────────────────────────────

describe("5: Scope Creep Risk", () => {
    it("should detect high complexity + tight timeline + weak supply chain", () => {
        const inputs = makeInputs({
            des03Complexity: 5,
            des04Experience: 4,
            ctx05Horizon: "0-12m",
            exe01SupplyChain: 1,
            exe02Contractor: 2,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const scope = result.find(a => a.biasType === "scope_creep");
        expect(scope).toBeDefined();
        expect(scope!.evidencePoints.length).toBeGreaterThanOrEqual(3);
    });

    it("should not flag with low complexity", () => {
        const inputs = makeInputs({
            des03Complexity: 2,
            ctx05Horizon: "0-12m",
            exe01SupplyChain: 1,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const scope = result.find(a => a.biasType === "scope_creep");
        expect(scope).toBeUndefined();
    });

    it("should not flag with long horizon and strong supply chain", () => {
        const inputs = makeInputs({
            des03Complexity: 5,
            des04Experience: 5,
            ctx05Horizon: "36m+",
            exe01SupplyChain: 5,
            exe02Contractor: 5,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const scope = result.find(a => a.biasType === "scope_creep");
        expect(scope).toBeUndefined();
    });
});

// ─── 6. Sunk Cost Tests ────────────────────────────────────────────────────

describe("6: Sunk Cost Fallacy", () => {
    it("should detect declining score across 3+ evaluations", () => {
        const score = makeScore({
            compositeScore: 35,
            decisionStatus: "not_validated",
        });
        const ctx = makeCtx({
            evaluationCount: 5,
            previousScores: [60, 55, 48, 42],
        });
        const result = detectBiases(makeInputs(), score, ctx);
        const sunk = result.find(a => a.biasType === "sunk_cost");
        expect(sunk).toBeDefined();
        expect(sunk!.severity).toMatch(/high|critical/);
    });

    it("should not flag with only 2 evaluations", () => {
        const score = makeScore({ compositeScore: 40 });
        const ctx = makeCtx({
            evaluationCount: 2,
            previousScores: [50],
        });
        const result = detectBiases(makeInputs(), score, ctx);
        const sunk = result.find(a => a.biasType === "sunk_cost");
        expect(sunk).toBeUndefined();
    });

    it("should not flag when score is above 60", () => {
        const score = makeScore({ compositeScore: 65 });
        const ctx = makeCtx({
            evaluationCount: 4,
            previousScores: [72, 70, 68],
        });
        const result = detectBiases(makeInputs(), score, ctx);
        const sunk = result.find(a => a.biasType === "sunk_cost");
        expect(sunk).toBeUndefined();
    });

    it("should not flag when scores are improving", () => {
        const score = makeScore({ compositeScore: 55 });
        const ctx = makeCtx({
            evaluationCount: 4,
            previousScores: [30, 40, 50],
        });
        const result = detectBiases(makeInputs(), score, ctx);
        const sunk = result.find(a => a.biasType === "sunk_cost");
        expect(sunk).toBeUndefined();
    });
});

// ─── 7. Clustering Illusion Tests ───────────────────────────────────────────

describe("7: Clustering Illusion", () => {
    it("should detect overrated trend vs evidence data", () => {
        const inputs = makeInputs({ mkt03Trend: 5 });
        const ctx = makeCtx({ marketTrendActual: 2 });
        const result = detectBiases(inputs, makeScore(), ctx);
        const cluster = result.find(a => a.biasType === "clustering_illusion");
        expect(cluster).toBeDefined();
        expect(cluster!.confidence).toBeGreaterThanOrEqual(45);
    });

    it("should flag max trend on Emerging location without evidence data", () => {
        const inputs = makeInputs({
            mkt03Trend: 5,
            ctx04Location: "Emerging",
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const cluster = result.find(a => a.biasType === "clustering_illusion");
        expect(cluster).toBeDefined();
        expect(cluster!.severity).toBe("medium");
    });

    it("should not flag when trend is moderate (< 4)", () => {
        const inputs = makeInputs({ mkt03Trend: 3 });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        const cluster = result.find(a => a.biasType === "clustering_illusion");
        expect(cluster).toBeUndefined();
    });

    it("should not flag when evidence matches user assessment", () => {
        const inputs = makeInputs({ mkt03Trend: 4 });
        const ctx = makeCtx({ marketTrendActual: 3.5 });
        const result = detectBiases(inputs, makeScore(), ctx);
        const cluster = result.find(a => a.biasType === "clustering_illusion");
        expect(cluster).toBeUndefined();
    });
});

// ─── Integration / Edge Case Tests ──────────────────────────────────────────

describe("Integration: Multi-bias Detection", () => {
    it("should detect multiple biases simultaneously", () => {
        const inputs = makeInputs({
            mkt01Tier: "Ultra-luxury",
            fin01BudgetCap: 500_000,
            fin02Flexibility: 1,
            str01BrandClarity: 5,
            str02Differentiation: 5,
            mkt02Competitor: 1,
            des03Complexity: 5,
            des04Experience: 5,
            ctx05Horizon: "0-12m",
            exe01SupplyChain: 1,
            exe02Contractor: 1,
        });
        const result = detectBiases(inputs, makeScore({ compositeScore: 40 }), makeCtx());
        expect(result.length).toBeGreaterThanOrEqual(3); // optimism, overconfidence, scope_creep
    });

    it("should return empty array for a perfectly balanced project", () => {
        const result = detectBiases(makeInputs(), makeScore({ compositeScore: 70 }), makeCtx());
        expect(result.length).toBe(0);
    });

    it("should sort alerts by severity (critical first)", () => {
        const inputs = makeInputs({
            mkt01Tier: "Ultra-luxury",
            fin01BudgetCap: 100_000,
            fin02Flexibility: 1,
            fin03ShockTolerance: 1,
            str01BrandClarity: 5,
            str02Differentiation: 5,
            mkt02Competitor: 1,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        if (result.length >= 2) {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
            for (let i = 1; i < result.length; i++) {
                expect(severityOrder[result[i].severity]).toBeGreaterThanOrEqual(
                    severityOrder[result[i - 1].severity]
                );
            }
        }
    });

    it("should include evidence points in all alerts", () => {
        const inputs = makeInputs({
            mkt01Tier: "Ultra-luxury",
            fin01BudgetCap: 100_000,
            fin02Flexibility: 1,
        });
        const result = detectBiases(inputs, makeScore(), makeCtx());
        for (const alert of result) {
            expect(alert.evidencePoints.length).toBeGreaterThan(0);
            expect(alert.mathExplanation).toBeTruthy();
            expect(alert.intervention).toBeTruthy();
        }
    });

    it("should handle null/zero budget gracefully", () => {
        const inputs = makeInputs({
            mkt01Tier: "Ultra-luxury",
            fin01BudgetCap: null as any,
        });
        expect(() => detectBiases(inputs, makeScore(), makeCtx())).not.toThrow();
    });

    it("should handle empty evaluation history gracefully", () => {
        const ctx = makeCtx({ previousScores: [], previousBudgets: [] });
        expect(() => detectBiases(makeInputs(), makeScore(), ctx)).not.toThrow();
    });
});
