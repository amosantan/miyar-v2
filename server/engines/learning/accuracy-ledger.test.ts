import { describe, it, expect } from "vitest";
import { computeAccuracyLedger } from "./accuracy-ledger";
import type { OutcomeComparison } from "../../../drizzle/schema";

const createMockComparison = (overrides: Partial<OutcomeComparison> = {}): OutcomeComparison => ({
    id: 1,
    projectId: 1,
    comparedAt: new Date(),
    predictedCostMid: "5000",
    actualCost: "5000",
    costDeltaPct: "0",
    costAccuracyBand: "within_10pct",
    predictedComposite: "85",
    predictedDecision: "validated",
    actualOutcomeSuccess: true,
    scorePredictionCorrect: true,
    predictedRisk: "45",
    actualReworkOccurred: false,
    riskPredictionCorrect: true,
    overallAccuracyGrade: "A",
    learningSignals: [],
    rawComparison: {},
    ...overrides
}) as any;

describe("Accuracy Ledger Engine", () => {
    it("should handle insufficient data trend correctly", () => {
        // Less than 4 items
        const comparisons = [
            createMockComparison(),
            createMockComparison(),
            createMockComparison()
        ];

        const ledger = computeAccuracyLedger(comparisons);
        expect(ledger.totalComparisons).toBe(3);
        expect(ledger.costTrend).toBe("insufficient_data");
        expect(ledger.scoreTrend).toBe("insufficient_data");
        expect(ledger.riskTrend).toBe("insufficient_data");
        expect(ledger.overallPlatformAccuracy).toBe("100.0000");
    });

    it("should detect an improving trend with 10 predictions", () => {
        const comparisons: OutcomeComparison[] = [];

        // 5 older comparisons (bad accuracy)
        for (let i = 0; i < 5; i++) {
            comparisons.push(createMockComparison({
                comparedAt: new Date(2023, 1, i + 1), // Old dates
                costAccuracyBand: "outside_20pct",
                costDeltaPct: "30",
                scorePredictionCorrect: false,
                riskPredictionCorrect: false,
                overallAccuracyGrade: "C"
            }));
        }

        // 5 newer comparisons (perfect accuracy)
        for (let i = 0; i < 5; i++) {
            comparisons.push(createMockComparison({
                comparedAt: new Date(2024, 1, i + 1), // New dates
            }));
        }

        const ledger = computeAccuracyLedger(comparisons);

        expect(ledger.totalComparisons).toBe(10);
        expect(ledger.costTrend).toBe("improving");
        expect(ledger.scoreTrend).toBe("improving");
        expect(ledger.riskTrend).toBe("improving");

        // 5 A grades, 5 C grades -> 5 / 10 = 50%
        expect(ledger.overallPlatformAccuracy).toBe("50.0000");
        expect(ledger.costMaePct).toBe("15.0000"); // (30 * 5 + 0 * 5) / 10
    });

    it("should detect a degrading trend", () => {
        const comparisons: OutcomeComparison[] = [];

        // 5 older (perfect)
        for (let i = 0; i < 5; i++) {
            comparisons.push(createMockComparison({
                comparedAt: new Date(2023, 1, i + 1),
            }));
        }

        // 5 newer (bad accuracy)
        for (let i = 0; i < 5; i++) {
            comparisons.push(createMockComparison({
                comparedAt: new Date(2024, 1, i + 1),
                costAccuracyBand: "outside_20pct",
                costDeltaPct: "30",
                scorePredictionCorrect: false,
                riskPredictionCorrect: false,
                overallAccuracyGrade: "C"
            }));
        }

        const ledger = computeAccuracyLedger(comparisons);

        expect(ledger.costTrend).toBe("degrading");
        expect(ledger.scoreTrend).toBe("degrading");
        expect(ledger.riskTrend).toBe("degrading");
    });
});
