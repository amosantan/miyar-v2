import type { InsertAccuracySnapshot, OutcomeComparison } from "../../../drizzle/schema";

type TrendDirection = "improving" | "stable" | "degrading" | "insufficient_data";

export function computeAccuracyLedger(comparisons: OutcomeComparison[]): InsertAccuracySnapshot {
    if (comparisons.length === 0) {
        return {
            totalComparisons: 0,
            withCostPrediction: 0,
            withOutcomePrediction: 0,
            costWithin10Pct: 0,
            costWithin20Pct: 0,
            costOutside20Pct: 0,
            costMaePct: "0.0000",
            costTrend: "insufficient_data",
            scoreCorrectPredictions: 0,
            scoreIncorrectPredictions: 0,
            scoreAccuracyRate: "0.0000",
            scoreTrend: "insufficient_data",
            riskCorrectPredictions: 0,
            riskIncorrectPredictions: 0,
            riskAccuracyRate: "0.0000",
            riskTrend: "insufficient_data",
            overallPlatformAccuracy: "0.0000",
            gradeA: 0,
            gradeB: 0,
            gradeC: 0,
        };
    }

    // Sort chronologically older to newer
    const sorted = [...comparisons].sort((a, b) =>
        new Date(a.comparedAt).getTime() - new Date(b.comparedAt).getTime()
    );

    let withCostPrediction = 0;
    let costWithin10Pct = 0;
    let costWithin20Pct = 0;
    let costOutside20Pct = 0;
    let sumCostDeltaPct = 0;

    let scoreCorrectPredictions = 0;
    let scoreIncorrectPredictions = 0;

    let riskCorrectPredictions = 0;
    let riskIncorrectPredictions = 0;

    let gradeA = 0;
    let gradeB = 0;
    let gradeC = 0;

    sorted.forEach(c => {
        if (c.costAccuracyBand !== "no_prediction") {
            withCostPrediction++;
            if (c.costDeltaPct !== null) sumCostDeltaPct += Math.abs(Number(c.costDeltaPct));
            if (c.costAccuracyBand === "within_10pct") costWithin10Pct++;
            else if (c.costAccuracyBand === "within_20pct") costWithin20Pct++;
            else costOutside20Pct++;
        }

        if (c.scorePredictionCorrect) scoreCorrectPredictions++;
        else scoreIncorrectPredictions++;

        if (c.riskPredictionCorrect) riskCorrectPredictions++;
        else riskIncorrectPredictions++;

        if (c.overallAccuracyGrade === "A") gradeA++;
        else if (c.overallAccuracyGrade === "B") gradeB++;
        else if (c.overallAccuracyGrade === "C") gradeC++;
    });

    const costMaePct = withCostPrediction > 0 ? sumCostDeltaPct / withCostPrediction : 0;

    const totalScore = scoreCorrectPredictions + scoreIncorrectPredictions;
    const scoreAccuracyRate = totalScore > 0 ? (scoreCorrectPredictions / totalScore) * 100 : 0;

    const totalRisk = riskCorrectPredictions + riskIncorrectPredictions;
    const riskAccuracyRate = totalRisk > 0 ? (riskCorrectPredictions / totalRisk) * 100 : 0;

    // Grades A/B count towards positive platform accuracy
    const overallPlatformAccuracy = (gradeA + gradeB) / Math.max(1, (gradeA + gradeB + gradeC)) * 100;

    // Trend calculation
    let costTrend: TrendDirection = "insufficient_data";
    let scoreTrend: TrendDirection = "insufficient_data";
    let riskTrend: TrendDirection = "insufficient_data";

    if (sorted.length >= 4) {
        const mid = Math.floor(sorted.length / 2);
        const older = sorted.slice(0, mid);
        const newer = sorted.slice(mid);

        // Helper
        const calcRate = (arr: OutcomeComparison[], check: (c: OutcomeComparison) => boolean) => {
            const valid = arr.filter(check);
            return valid.length / arr.length;
        };
        const calcCostMae = (arr: OutcomeComparison[]) => {
            const valid = arr.filter(c => c.costDeltaPct !== null);
            if (!valid.length) return 0;
            return valid.reduce((acc, c) => acc + Math.abs(Number(c.costDeltaPct)), 0) / valid.length;
        };

        const oldScore = calcRate(older, c => Boolean(c.scorePredictionCorrect));
        const newScore = calcRate(newer, c => Boolean(c.scorePredictionCorrect));
        if (newScore > oldScore + 0.05) scoreTrend = "improving";
        else if (newScore < oldScore - 0.05) scoreTrend = "degrading";
        else scoreTrend = "stable";

        const oldRisk = calcRate(older, c => Boolean(c.riskPredictionCorrect));
        const newRisk = calcRate(newer, c => Boolean(c.riskPredictionCorrect));
        if (newRisk > oldRisk + 0.05) riskTrend = "improving";
        else if (newRisk < oldRisk - 0.05) riskTrend = "degrading";
        else riskTrend = "stable";

        const oldCostMae = calcCostMae(older);
        const newCostMae = calcCostMae(newer);
        if (older.filter(c => c.costDeltaPct !== null).length > 0 && newer.filter(c => c.costDeltaPct !== null).length > 0) {
            // Lower MAE is better
            if (newCostMae < oldCostMae - 2) costTrend = "improving";
            else if (newCostMae > oldCostMae + 2) costTrend = "degrading";
            else costTrend = "stable";
        }
    }

    return {
        totalComparisons: comparisons.length,
        withCostPrediction,
        withOutcomePrediction: totalScore, // every comparison basically has outcome score validation logic
        costWithin10Pct,
        costWithin20Pct,
        costOutside20Pct,
        costMaePct: costMaePct.toFixed(4),
        costTrend,
        scoreCorrectPredictions,
        scoreIncorrectPredictions,
        scoreAccuracyRate: scoreAccuracyRate.toFixed(4),
        scoreTrend,
        riskCorrectPredictions,
        riskIncorrectPredictions,
        riskAccuracyRate: riskAccuracyRate.toFixed(4),
        riskTrend,
        overallPlatformAccuracy: overallPlatformAccuracy.toFixed(4),
        gradeA,
        gradeB,
        gradeC,
    };
}
