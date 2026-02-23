import type { InsertLogicChangeLogEntry, OutcomeComparison, ScoreMatrix } from "../../../drizzle/schema";

export function analyzeWeightSensitivity(
    comparisons: OutcomeComparison[],
    scoreMatrices: ScoreMatrix[],
    activeLogicVersionId: number
): InsertLogicChangeLogEntry[] {
    const suggestions: InsertLogicChangeLogEntry[] = [];

    // We only care about missed predictions
    const misses = comparisons.filter(c => !c.scorePredictionCorrect);

    if (misses.length < 5) return []; // Need statistical significance

    // Track which dimension caused the biggest drag in false negatives (too pessimistic)
    // Track which dimension caused the biggest boost in false positives (too optimistic)
    const falseNegativeCauses: Record<string, number> = {};
    const falsePositiveCauses: Record<string, number> = {};

    let falseNegativeCount = 0;
    let falsePositiveCount = 0;

    for (const miss of misses) {
        // Find the corresponding score matrix manually
        const matrix = scoreMatrices.find(m => m.projectId === miss.projectId);
        if (!matrix || !matrix.variableContributions) continue;

        const contributions = matrix.variableContributions as Record<string, any>;
        if (Object.keys(contributions).length === 0) continue;

        // Was it a false negative or false positive?
        // False negative: Predicted not validated, but actually succeeded
        const isFalseNegative = miss.predictedDecision === "not_validated" && miss.actualOutcomeSuccess;
        // False positive: Predicted validated, but actually failed
        const isFalsePositive = miss.predictedDecision === "validated" && !miss.actualOutcomeSuccess;

        if (isFalseNegative) {
            falseNegativeCount++;
            // Find the dimension that dragged the score down the most
            let worstDim: string | null = null;
            let lowestScore = Infinity;

            for (const [vName, data] of Object.entries(contributions)) {
                if (data.contribution < lowestScore) {
                    lowestScore = data.contribution;
                    worstDim = data.dimension;
                }
            }

            if (worstDim) {
                falseNegativeCauses[worstDim] = (falseNegativeCauses[worstDim] || 0) + 1;
            }
        }
        else if (isFalsePositive) {
            falsePositiveCount++;
            // Find the dimension that boosted the score the most incorrectly
            let bestDim: string | null = null;
            let highestScore = -Infinity;

            for (const [vName, data] of Object.entries(contributions)) {
                if (data.contribution > highestScore) {
                    highestScore = data.contribution;
                    bestDim = data.dimension;
                }
            }

            if (bestDim) {
                falsePositiveCauses[bestDim] = (falsePositiveCauses[bestDim] || 0) + 1;
            }
        }
    }

    // Propose logic changes if a dimension is repeatedly the dominant cause of errors
    // Threshold: > 5 occurrences AND > 50% of total errors of that type

    for (const [dim, count] of Object.entries(falseNegativeCauses)) {
        if (count >= 5 && count > falseNegativeCount * 0.5) {
            suggestions.push({
                logicVersionId: activeLogicVersionId,
                actor: 0, // system
                changeSummary: `Suggested: Reduce penalty weighting for ${dim} by 5%`,
                rationale: `The ${dim} dimension was the dominant negative factor in ${count} projects that were predicted to fail but actually succeeded (False Negatives). The algorithm is currently too pessimistic regarding ${dim} penalties.`,
                status: "proposed"
            });
        }
    }

    for (const [dim, count] of Object.entries(falsePositiveCauses)) {
        if (count >= 5 && count > falsePositiveCount * 0.5) {
            suggestions.push({
                logicVersionId: activeLogicVersionId,
                actor: 0, // system
                changeSummary: `Suggested: Increase penalty stringency or reduce weight for ${dim} by 5%`,
                rationale: `The ${dim} dimension was the dominant positive factor in ${count} projects that were predicted to succeed but actually failed (False Positives). The algorithm is currently too lenient regarding ${dim}.`,
                status: "proposed"
            });
        }
    }

    return suggestions;
}
