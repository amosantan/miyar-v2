import type { ProjectOutcome, ScoreMatrix } from "../../../drizzle/schema";
import type { CostRangePrediction } from "../predictive/cost-range";
import type { OutcomePrediction } from "../predictive/outcome-prediction";

export type CostAccuracyBand = "within_10pct" | "within_20pct" | "outside_20pct" | "no_prediction";
export type OverallAccuracyGrade = "A" | "B" | "C" | "insufficient_data";
export type LearningSignalType =
    | "cost_under_predicted"
    | "cost_over_predicted"
    | "risk_under_predicted"
    | "risk_over_predicted"
    | "score_correctly_predicted"
    | "score_incorrectly_predicted";

export interface OutcomeComparisonParams {
    projectId: number;
    outcome: ProjectOutcome;
    scoreMatrix: ScoreMatrix;
    costPrediction: CostRangePrediction | null;
    outcomePrediction: OutcomePrediction | null;
}

export interface LearningSignal {
    signalType: LearningSignalType;
    magnitude: number;
    affectedDimension: string | null;
    suggestedAdjustmentDirection: "increase" | "decrease" | "none";
}

export interface OutcomeComparison {
    projectId: number;
    comparedAt: Date;

    predictedCostMid: number | null;
    actualCost: number | null;
    costDeltaPct: number | null;
    costAccuracyBand: CostAccuracyBand;

    predictedComposite: number;
    predictedDecision: string;
    actualOutcomeSuccess: boolean;
    scorePredictionCorrect: boolean;

    predictedRisk: number;
    actualReworkOccurred: boolean;
    riskPredictionCorrect: boolean;

    overallAccuracyGrade: OverallAccuracyGrade;
    learningSignals: LearningSignal[];
    rawComparison: any;
}

export function compareOutcomeToPrediction(params: OutcomeComparisonParams): OutcomeComparison {
    const { projectId, outcome, scoreMatrix, costPrediction, outcomePrediction } = params;

    const actualCost = outcome.actualTotalCost ? Number(outcome.actualTotalCost) : null;
    const actualFitoutCost = outcome.actualFitoutCostPerSqm ? Number(outcome.actualFitoutCostPerSqm) : null;

    // Cost Accuracy
    let predictedCostMid: number | null = null;
    let costDeltaPct: number | null = null;
    let costAccuracyBand: CostAccuracyBand = "no_prediction";

    if (costPrediction && actualFitoutCost) {
        predictedCostMid = costPrediction.adjustedP50 ?? costPrediction.p50;
        if (predictedCostMid && predictedCostMid > 0) {
            costDeltaPct = ((actualFitoutCost - predictedCostMid) / predictedCostMid) * 100;
            const absDelta = Math.abs(costDeltaPct);
            if (absDelta <= 10) {
                costAccuracyBand = "within_10pct";
            } else if (absDelta <= 20) {
                costAccuracyBand = "within_20pct";
            } else {
                costAccuracyBand = "outside_20pct";
            }
        }
    }

    // Score Accuracy
    const predictedComposite = Number(scoreMatrix.compositeScore);
    const predictedDecision = scoreMatrix.decisionStatus || "not_validated";

    // Define actual outcome success deterministically
    // We consider it a success if it was delivered on time, client satisfaction >= 3, and no rework.
    const actualOutcomeSuccess = Boolean(
        outcome.projectDeliveredOnTime &&
        outcome.clientSatisfactionScore && outcome.clientSatisfactionScore >= 3 &&
        !outcome.reworkOccurred
    );

    let scorePredictionCorrect = false;
    if (predictedDecision === "validated" && actualOutcomeSuccess) scorePredictionCorrect = true;
    if (predictedDecision === "not_validated" && !actualOutcomeSuccess) scorePredictionCorrect = true;
    // conditional is a grey area, we can say it's correct if it was a mixed outcome

    // Risk Accuracy
    const predictedRisk = Number(scoreMatrix.riskScore);
    const actualReworkOccurred = Boolean(outcome.reworkOccurred);

    // If risk >= 60, we expect rework or issues.
    let riskPredictionCorrect = false;
    if (predictedRisk >= 60 && actualReworkOccurred) riskPredictionCorrect = true;
    if (predictedRisk < 60 && !actualReworkOccurred) riskPredictionCorrect = true;

    // Delta summary / Grade
    let overallAccuracyGrade: OverallAccuracyGrade = "insufficient_data";
    if (costAccuracyBand === "no_prediction" || outcome.actualTotalCost === null) {
        // Leave as insufficient_data
    } else if (costAccuracyBand === "within_10pct" && scorePredictionCorrect && riskPredictionCorrect) {
        overallAccuracyGrade = "A";
    } else if ((costAccuracyBand === "within_10pct" || costAccuracyBand === "within_20pct") &&
        (scorePredictionCorrect || riskPredictionCorrect)) {
        overallAccuracyGrade = "B";
    } else {
        overallAccuracyGrade = "C";
    }

    // Extract Learning Signals
    const learningSignals: LearningSignal[] = [];

    // 1. Cost Signals
    if (costDeltaPct !== null) {
        if (costDeltaPct > 5) { // actual > predicted
            learningSignals.push({
                signalType: "cost_under_predicted",
                magnitude: Math.abs(costDeltaPct),
                affectedDimension: null,
                suggestedAdjustmentDirection: "increase"
            });
        } else if (costDeltaPct < -5) { // actual < predicted
            learningSignals.push({
                signalType: "cost_over_predicted",
                magnitude: Math.abs(costDeltaPct),
                affectedDimension: null,
                suggestedAdjustmentDirection: "decrease"
            });
        }
    }

    // 2. Risk Signals
    if (actualReworkOccurred && predictedRisk < 60) {
        learningSignals.push({
            signalType: "risk_under_predicted",
            magnitude: 60 - predictedRisk,
            affectedDimension: "ER", // Execution Readiness usually ties to rework
            suggestedAdjustmentDirection: "increase"
        });
    } else if (!actualReworkOccurred && predictedRisk >= 60) {
        learningSignals.push({
            signalType: "risk_over_predicted",
            magnitude: predictedRisk - 59,
            affectedDimension: "ER",
            suggestedAdjustmentDirection: "decrease"
        });
    }

    // 3. Score Signals
    if (scorePredictionCorrect) {
        learningSignals.push({
            signalType: "score_correctly_predicted",
            magnitude: 1,
            affectedDimension: null,
            suggestedAdjustmentDirection: "none"
        });
    } else {
        learningSignals.push({
            signalType: "score_incorrectly_predicted",
            magnitude: 1,
            affectedDimension: null,
            suggestedAdjustmentDirection: "none" // precise dimension adjustment handled by weight-analyser
        });
    }

    if (overallAccuracyGrade === "insufficient_data") {
        return {
            projectId,
            comparedAt: new Date(),
            predictedCostMid,
            actualCost: actualFitoutCost,
            costDeltaPct,
            costAccuracyBand,
            predictedComposite,
            predictedDecision,
            actualOutcomeSuccess,
            scorePredictionCorrect,
            predictedRisk,
            actualReworkOccurred,
            riskPredictionCorrect,
            overallAccuracyGrade,
            learningSignals: [],
            rawComparison: {
                outcomeId: outcome.id,
                costDeltaRaw: costDeltaPct
            }
        };
    }

    return {
        projectId,
        comparedAt: new Date(),
        predictedCostMid,
        actualCost: actualFitoutCost,
        costDeltaPct,
        costAccuracyBand,
        predictedComposite,
        predictedDecision,
        actualOutcomeSuccess,
        scorePredictionCorrect,
        predictedRisk,
        actualReworkOccurred,
        riskPredictionCorrect,
        overallAccuracyGrade,
        learningSignals,
        rawComparison: {
            outcomeId: outcome.id,
            costDeltaRaw: costDeltaPct
        }
    };
}
