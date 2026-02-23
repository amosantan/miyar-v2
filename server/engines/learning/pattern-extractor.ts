import type { OutcomeComparison, ScoreMatrix, InsertProjectPatternMatch, InsertDecisionPattern, DecisionPattern } from "../../../drizzle/schema";

// Seed Patterns - These would normally be inserted into the DB on startup
export const SEED_PATTERNS: InsertDecisionPattern[] = [
    {
        id: 1, // hardcoded IDs for seeds
        name: "High Complexity + Low Execution Readiness",
        description: "Projects with highly complex spatial configurations but poor execution planning correlate strongly with severe rework.",
        category: "risk_indicator",
        conditions: JSON.parse('[{"dimension": "SA", "operator": "<", "value": 40}, {"dimension": "ER", "operator": "<", "value": 40}]'),
    },
    {
        id: 2,
        name: "Excellent Delivery + Premium Materials",
        description: "Projects exhibiting strong execution readiness coupled with top-tier material provenances reliably deliver high client satisfaction.",
        category: "success_driver",
        conditions: JSON.parse('[{"dimension": "ER", "operator": ">", "value": 80}, {"dimension": "MP", "operator": ">", "value": 80}]'),
    },
    {
        id: 3,
        name: "Financial Friction + Poor Data Quality",
        description: "When procurement liquidity is tight and the underlying project data is poor, cost anomalies (overruns) are highly probable.",
        category: "cost_anomaly",
        conditions: JSON.parse('[{"dimension": "FF", "operator": "<", "value": 40}, {"dimension": "DS", "operator": "<", "value": 40}]'),
    },
    {
        id: 4,
        name: "Rushed Delivery Risk",
        description: "Very low execution readiness paired with average complexity often masks rushed timelines, leading to missed delivery dates.",
        category: "risk_indicator",
        conditions: JSON.parse('[{"dimension": "ER", "operator": "<", "value": 30}, {"dimension": "SA", "operator": ">", "value": 40}, {"dimension": "SA", "operator": "<", "value": 70}]'),
    },
    {
        id: 5,
        name: "Balanced Fundamentals Core",
        description: "Projects maintaining above-average scores across all five intelligence lenses demonstrate resilient success rates.",
        category: "success_driver",
        conditions: JSON.parse('[{"dimension": "SA", "operator": ">", "value": 60}, {"dimension": "FF", "operator": ">", "value": 60}, {"dimension": "MP", "operator": ">", "value": 60}, {"dimension": "DS", "operator": ">", "value": 60}, {"dimension": "ER", "operator": ">", "value": 60}]'),
    }
];

export function matchScoreMatrixToPatterns(
    scores: Record<string, number>,
    availablePatterns: InsertDecisionPattern[] | DecisionPattern[] | any[]
): any[] {
    const matchedPatterns = [];

    for (const pattern of availablePatterns) {
        const conditions = pattern.conditions as Array<{ dimension: string, operator: string, value: number }>;

        let isMatch = true;
        for (const cond of conditions) {
            const actualScore = scores[cond.dimension];
            if (actualScore === undefined) {
                isMatch = false;
                break;
            }

            if (cond.operator === "<" && !(actualScore < cond.value)) isMatch = false;
            if (cond.operator === ">" && !(actualScore > cond.value)) isMatch = false;
            if (cond.operator === "<=" && !(actualScore <= cond.value)) isMatch = false;
            if (cond.operator === ">=" && !(actualScore >= cond.value)) isMatch = false;
            if (cond.operator === "==" && !(actualScore === cond.value)) isMatch = false;
        }

        if (isMatch) {
            matchedPatterns.push(pattern);
        }
    }

    return matchedPatterns;
}

export function extractPatterns(
    comparisons: OutcomeComparison[],
    scoreMatrices: ScoreMatrix[],
    availablePatterns: typeof SEED_PATTERNS | DecisionPattern[] | any[]
): InsertProjectPatternMatch[] {
    const matches: InsertProjectPatternMatch[] = [];

    for (const comp of comparisons) {
        const matrix = scoreMatrices.find(m => m.projectId === comp.projectId);
        if (!matrix) continue;

        // Extract scores to make condition checking easy
        const scores: Record<string, number> = {
            SA: Number(matrix.saScore) || 0,
            FF: Number(matrix.ffScore) || 0,
            MP: Number(matrix.mpScore) || 0,
            DS: Number(matrix.dsScore) || 0,
            ER: Number(matrix.erScore) || 0,
        };

        const matchedPatterns = matchScoreMatrixToPatterns(scores, availablePatterns);

        for (const pattern of matchedPatterns) {
            let patternValidated = false;

            if (pattern.category === "risk_indicator") {
                // Risk indicator patterns are validated if rework occurred or the project failed
                if (comp.actualReworkOccurred || !comp.actualOutcomeSuccess) {
                    patternValidated = true;
                }
            }
            else if (pattern.category === "success_driver") {
                // Success drivers are validated if the project was delivered on time without rework
                if (comp.actualOutcomeSuccess && !comp.actualReworkOccurred) {
                    patternValidated = true;
                }
            }
            else if (pattern.category === "cost_anomaly") {
                // Cost anomaly is validated if the cost was significantly underestimated
                if (comp.costDeltaPct !== null && Number(comp.costDeltaPct) > 10) {
                    patternValidated = true;
                }
            }

            if (patternValidated) {
                matches.push({
                    projectId: comp.projectId,
                    patternId: pattern.id as number,
                    matchedAt: new Date(),
                    confidence: "1.00", // High confidence for hard validation
                    contextSnapshot: {
                        scores: scores,
                        outcomeDelta: comp.costDeltaPct,
                        success: comp.actualOutcomeSuccess
                    }
                });
            }
        }
    }

    return matches;
}
