import { describe, it, expect } from "vitest";
import { compareOutcomeToPrediction } from "./outcome-comparator";

describe("Outcome Comparator Engine", () => {
    it("should grade A for a perfect prediction", () => {
        const result = compareOutcomeToPrediction({
            projectId: 1,
            outcome: {
                id: 1,
                projectId: 1,
                actualFitoutCostPerSqm: "5000",
                actualTotalCost: "1000000",
                projectDeliveredOnTime: true,
                clientSatisfactionScore: 4,
                reworkOccurred: false,
                reworkCostAed: null,
                tenderIterations: 1,
                keyLessonsLearned: null,
                capturedAt: new Date(),
                capturedBy: 1,
                procurementActualCosts: null,
                leadTimesActual: null,
                adoptionMetrics: null,
                rfqResults: null
            } as any,
            scoreMatrix: {
                compositeScore: "85.00",
                decisionStatus: "validated",
                riskScore: "45.00"
            } as any,
            costPrediction: {
                p15: 4500,
                p50: 5000, // perfect match
                p85: 5500,
                p95: 6000,
                adjustedP15: 4500,
                adjustedP50: 5000,
                adjustedP85: 5500,
                adjustedP95: 6000,
                unit: "AED/sqm",
                currency: "AED",
                trendAdjustment: 0,
                trendDirection: "stable",
                confidence: "high",
                dataPointCount: 15,
                gradeACount: 5,
                fallbackUsed: false
            },
            outcomePrediction: {
                successLikelihood: 80,
                confidenceLevel: "high",
                comparableCount: 10,
                validatedRate: 50,
                conditionalRate: 30,
                notValidatedRate: 20,
                predictionBasis: "test",
                keySuccessFactors: [],
                keyRiskFactors: []
            }
        });

        expect(result.overallAccuracyGrade).toBe("A");
        expect(result.costAccuracyBand).toBe("within_10pct");
        expect(result.scorePredictionCorrect).toBe(true);
        expect(result.riskPredictionCorrect).toBe(true);
        expect(result.learningSignals.length).toBe(1); // just score_correctly_predicted
        expect(result.learningSignals[0].signalType).toBe("score_correctly_predicted");
    });

    it("should grade C and outside_20pct when cost is 30% off", () => {
        const result = compareOutcomeToPrediction({
            projectId: 2,
            outcome: {
                actualFitoutCostPerSqm: "6500", // 30% over 5000
                actualTotalCost: "1500000",
                projectDeliveredOnTime: true,
                clientSatisfactionScore: 4,
                reworkOccurred: false,
            } as any,
            scoreMatrix: {
                compositeScore: "85.00",
                decisionStatus: "validated",
                riskScore: "45.00"
            } as any,
            costPrediction: {
                p50: 5000,
                adjustedP50: 5000,
            } as any,
            outcomePrediction: null
        });

        expect(result.costAccuracyBand).toBe("outside_20pct");
        expect(result.costDeltaPct).toBe(30);
        expect(result.overallAccuracyGrade).toBe("C");

        const costSignal = result.learningSignals.find(s => s.signalType === "cost_under_predicted");
        expect(costSignal).toBeDefined();
        expect(costSignal?.magnitude).toBe(30);
    });

    it("should handle insufficient data with no outcomes", () => {
        const result = compareOutcomeToPrediction({
            projectId: 3,
            outcome: {
                actualTotalCost: null,
                actualFitoutCostPerSqm: null,
            } as any,
            scoreMatrix: {
                compositeScore: "50.00",
                decisionStatus: "not_validated",
                riskScore: "75.00"
            } as any,
            costPrediction: null,
            outcomePrediction: null
        });

        expect(result.overallAccuracyGrade).toBe("insufficient_data");
        expect(result.costAccuracyBand).toBe("no_prediction");
        expect(result.learningSignals.length).toBe(0);
    });
});
