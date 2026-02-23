import { describe, it, expect } from "vitest";
import { analyzeWeightSensitivity } from "./weight-analyzer";
import type { OutcomeComparison, ScoreMatrix } from "../../../drizzle/schema";

const createComparison = (id: number, projectId: number, isFN: boolean, isFP: boolean): OutcomeComparison => ({
    id,
    projectId,
    comparedAt: new Date(),
    costAccuracyBand: "no_prediction",
    actualOutcomeSuccess: isFN ? true : (isFP ? false : true), // true if false negative, false if false positive
    predictedDecision: isFN ? "not_validated" : (isFP ? "validated" : "validated"),
    scorePredictionCorrect: false, // all are misses in these tests
    overallAccuracyGrade: "C",
    learningSignals: [],
} as any);

const createMatrix = (projectId: number, worstDim: string, worstScore: number, bestDim: string, bestScore: number): ScoreMatrix => ({
    id: projectId,
    projectId,
    compositeScore: "50",
    decisionStatus: "not_validated",
    variableContributions: {
        [worstDim]: { dimension: worstDim, contribution: worstScore },
        [bestDim]: { dimension: bestDim, contribution: bestScore },
        "neutral": { dimension: "neutral", contribution: 0 },
    }
} as any);


describe("Logic Weight Sensitivity Analyzer", () => {
    it("should ignore if less than 5 missed predictions", () => {
        const comparisons = [createComparison(1, 1, true, false)];
        const matrices = [createMatrix(1, "FF", -50, "SA", 10)];
        const suggestions = analyzeWeightSensitivity(comparisons, matrices, 2);
        expect(suggestions.length).toBe(0);
    });

    it("should propose reducing penalty weighting if a dimension causes > 5 False Negatives", () => {
        const comparisons: OutcomeComparison[] = [];
        const matrices: ScoreMatrix[] = [];

        for (let i = 1; i <= 6; i++) {
            comparisons.push(createComparison(i, i, true, false)); // FN
            // FF is the dominant negative factor (-40 vs -10)
            matrices.push(createMatrix(i, "FF", -40, "SA", -10));
        }

        // Add some noise (1 false positive)
        comparisons.push(createComparison(7, 7, false, true)); // FP
        matrices.push(createMatrix(7, "DS", -10, "MP", 30));

        const suggestions = analyzeWeightSensitivity(comparisons, matrices, 99);

        expect(suggestions.length).toBe(1);
        const suggestion = suggestions[0];

        expect(suggestion.logicVersionId).toBe(99);
        expect(suggestion.status).toBe("proposed");
        expect(suggestion.changeSummary).toContain("Reduce penalty weighting for FF");
    });

    it("should propose increasing stringency if a dimension causes > 5 False Positives", () => {
        const comparisons: OutcomeComparison[] = [];
        const matrices: ScoreMatrix[] = [];

        for (let i = 1; i <= 6; i++) {
            comparisons.push(createComparison(i, i, false, true)); // FP
            // MP is the dominant positive factor (+50 vs +5)
            matrices.push(createMatrix(i, "SA", -5, "MP", 50));
        }

        const suggestions = analyzeWeightSensitivity(comparisons, matrices, 99);

        expect(suggestions.length).toBe(1);
        expect(suggestions[0].changeSummary).toContain("Increase penalty stringency or reduce weight for MP");
    });
});
