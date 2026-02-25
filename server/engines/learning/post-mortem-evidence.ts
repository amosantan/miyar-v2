/**
 * Post-Mortem Evidence Generator (V4)
 * Converts outcome deltas into evidence records that feed back into MIYAR's
 * scoring and pricing engines — enabling self-correcting intelligence.
 *
 * "No automatic learning without validation" — deltas are logged as evidence,
 * but weight/threshold adjustments require human approval.
 */

import type { OutcomeComparison, LearningSignal } from "./outcome-comparator";

export interface PostMortemEvidence {
    sourceId: string;            // "postmortem-{projectId}-{timestamp}"
    sourceType: "post_mortem";
    category: string;            // e.g. "cost_accuracy", "risk_accuracy", "timeline_accuracy"
    evidencePhase: "handover";
    priceMin: number | null;
    priceTypical: number | null;
    priceMax: number | null;
    unit: string;
    reliability: "A" | "B" | "C";
    confidenceScore: number;
    geography: string;
    notes: string;
    tags: string[];
}

/**
 * Generate evidence records from an outcome comparison.
 * Each significant delta becomes an evidence record in the "handover" phase,
 * flowing back into the ingestion pipeline for future predictions.
 */
export function generatePostMortemEvidence(
    projectId: number,
    comparison: OutcomeComparison,
    projectContext: {
        typology?: string;
        tier?: string;
        location?: string;
        gfa?: number | null;
    },
): PostMortemEvidence[] {
    const evidence: PostMortemEvidence[] = [];
    const ts = comparison.comparedAt.getTime();
    const geo = projectContext.location || "UAE";

    // ── 1. Cost Accuracy Evidence ─────────────────────────────────────────────
    if (comparison.costDeltaPct !== null && comparison.actualCost !== null) {
        const absDelta = Math.abs(comparison.costDeltaPct);

        // Only generate evidence for meaningful deltas (> 5%)
        if (absDelta > 5) {
            const direction = comparison.costDeltaPct > 0 ? "higher" : "lower";
            const reliability = absDelta <= 10 ? "A" as const : absDelta <= 20 ? "B" as const : "C" as const;

            evidence.push({
                sourceId: `postmortem-cost-${projectId}-${ts}`,
                sourceType: "post_mortem",
                category: "cost_accuracy",
                evidencePhase: "handover",
                priceMin: comparison.predictedCostMid ? comparison.predictedCostMid * 0.9 : null,
                priceTypical: comparison.actualCost,
                priceMax: comparison.predictedCostMid ? comparison.predictedCostMid * 1.1 : null,
                unit: "AED/sqm",
                reliability,
                confidenceScore: reliability === "A" ? 0.95 : reliability === "B" ? 0.8 : 0.6,
                geography: geo,
                notes: `Post-mortem: actual cost was ${absDelta.toFixed(1)}% ${direction} than predicted (${comparison.costAccuracyBand}). ` +
                    `Predicted: AED ${comparison.predictedCostMid?.toFixed(0)}/sqm, Actual: AED ${comparison.actualCost.toFixed(0)}/sqm. ` +
                    `Grade: ${comparison.overallAccuracyGrade}.`,
                tags: [
                    "post-mortem",
                    `accuracy-${comparison.costAccuracyBand}`,
                    `grade-${comparison.overallAccuracyGrade}`,
                    projectContext.typology || "unknown",
                    projectContext.tier || "unknown",
                ],
            });
        }
    }

    // ── 2. Risk Prediction Evidence ───────────────────────────────────────────
    if (!comparison.riskPredictionCorrect) {
        const riskSignal = comparison.learningSignals.find(
            s => s.signalType === "risk_under_predicted" || s.signalType === "risk_over_predicted"
        );

        if (riskSignal) {
            evidence.push({
                sourceId: `postmortem-risk-${projectId}-${ts}`,
                sourceType: "post_mortem",
                category: "risk_calibration",
                evidencePhase: "handover",
                priceMin: null,
                priceTypical: null,
                priceMax: null,
                unit: "score",
                reliability: "B",
                confidenceScore: 0.85,
                geography: geo,
                notes: `Risk prediction ${riskSignal.signalType === "risk_under_predicted" ? "underestimated" : "overestimated"}. ` +
                    `Predicted risk: ${comparison.predictedRisk.toFixed(0)}, Rework occurred: ${comparison.actualReworkOccurred}. ` +
                    `Suggested: ${riskSignal.suggestedAdjustmentDirection} ${riskSignal.affectedDimension || "ER"} dimension weight.`,
                tags: [
                    "post-mortem",
                    "risk-miss",
                    riskSignal.signalType,
                    riskSignal.affectedDimension || "ER",
                ],
            });
        }
    }

    // ── 3. Score Prediction Evidence ──────────────────────────────────────────
    if (!comparison.scorePredictionCorrect) {
        evidence.push({
            sourceId: `postmortem-score-${projectId}-${ts}`,
            sourceType: "post_mortem",
            category: "score_calibration",
            evidencePhase: "handover",
            priceMin: null,
            priceTypical: null,
            priceMax: null,
            unit: "composite",
            reliability: "B",
            confidenceScore: 0.8,
            geography: geo,
            notes: `Score prediction was ${comparison.scorePredictionCorrect ? "correct" : "incorrect"}. ` +
                `Predicted: ${comparison.predictedDecision} (score: ${comparison.predictedComposite.toFixed(3)}), ` +
                `Actual success: ${comparison.actualOutcomeSuccess}. ` +
                `Grade: ${comparison.overallAccuracyGrade}.`,
            tags: [
                "post-mortem",
                "score-miss",
                `decision-${comparison.predictedDecision}`,
                `outcome-${comparison.actualOutcomeSuccess ? "success" : "failure"}`,
            ],
        });
    }

    return evidence;
}

/**
 * Summarize learning signals for human review.
 * Returns a structured summary suitable for display in the Post-Mortem UI.
 */
export function summarizeLearningSignals(signals: LearningSignal[]): {
    totalSignals: number;
    actionRequired: boolean;
    summary: string[];
    adjustments: Array<{
        dimension: string;
        direction: "increase" | "decrease" | "none";
        magnitude: number;
        rationale: string;
    }>;
} {
    const adjustments = signals
        .filter(s => s.suggestedAdjustmentDirection !== "none")
        .map(s => ({
            dimension: s.affectedDimension || "overall",
            direction: s.suggestedAdjustmentDirection,
            magnitude: s.magnitude,
            rationale: `${s.signalType}: magnitude ${s.magnitude.toFixed(1)}`,
        }));

    const summary: string[] = [];

    const costUnder = signals.find(s => s.signalType === "cost_under_predicted");
    const costOver = signals.find(s => s.signalType === "cost_over_predicted");
    const riskUnder = signals.find(s => s.signalType === "risk_under_predicted");
    const riskOver = signals.find(s => s.signalType === "risk_over_predicted");
    const scoreCorrect = signals.find(s => s.signalType === "score_correctly_predicted");

    if (costUnder) summary.push(`Cost was under-predicted by ${costUnder.magnitude.toFixed(1)}% — consider increasing cost benchmarks.`);
    if (costOver) summary.push(`Cost was over-predicted by ${costOver.magnitude.toFixed(1)}% — consider decreasing cost benchmarks.`);
    if (riskUnder) summary.push(`Risk was under-predicted — rework occurred despite low risk score. Review ${riskUnder.affectedDimension || "ER"} dimension.`);
    if (riskOver) summary.push(`Risk was over-predicted — no rework despite high risk score. Review ${riskOver.affectedDimension || "ER"} dimension.`);
    if (scoreCorrect) summary.push(`Score prediction was correct — current weights are calibrated well.`);

    return {
        totalSignals: signals.length,
        actionRequired: adjustments.length > 0,
        summary,
        adjustments,
    };
}
