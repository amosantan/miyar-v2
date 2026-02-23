import type { InsertBenchmarkSuggestion, OutcomeComparison, Project } from "../../../drizzle/schema";

export function generateBenchmarkSuggestions(
    comparisons: OutcomeComparison[],
    projects: Project[]
): InsertBenchmarkSuggestion[] {
    const suggestions: InsertBenchmarkSuggestion[] = [];

    // Group comparisons by typology and tier
    const groups: Record<string, { comparisons: OutcomeComparison[]; projectIds: number[] }> = {};

    for (const comp of comparisons) {
        const proj = projects.find(p => p.id === comp.projectId);
        if (!proj) continue;

        const typology = proj.ctx01Typology || "Residential";
        const tier = proj.mkt01Tier || "Mid";
        const key = `${typology}|${tier}`;

        if (!groups[key]) {
            groups[key] = { comparisons: [], projectIds: [] };
        }
        groups[key].comparisons.push(comp);
        groups[key].projectIds.push(comp.projectId);
    }

    for (const [key, group] of Object.entries(groups)) {
        if (group.comparisons.length < 3) continue; // Requires at least 3

        const [typology, tier] = key.split("|");

        // Aggregate learning signals
        let costUnderCount = 0;
        let costOverCount = 0;
        let riskUnderCount = 0;
        let riskOverCount = 0;

        let totalCostUnderMagnitude = 0;
        let totalCostOverMagnitude = 0;
        let totalRiskUnderMagnitude = 0;
        let totalRiskOverMagnitude = 0;

        for (const comp of group.comparisons) {
            const signals = comp.learningSignals as any[] || [];

            for (const sig of signals) {
                if (sig.signalType === "cost_under_predicted") {
                    costUnderCount++;
                    totalCostUnderMagnitude += Number(sig.magnitude) || 0;
                } else if (sig.signalType === "cost_over_predicted") {
                    costOverCount++;
                    totalCostOverMagnitude += Number(sig.magnitude) || 0;
                } else if (sig.signalType === "risk_under_predicted") {
                    riskUnderCount++;
                    totalRiskUnderMagnitude += Number(sig.magnitude) || 0;
                } else if (sig.signalType === "risk_over_predicted") {
                    riskOverCount++;
                    totalRiskOverMagnitude += Number(sig.magnitude) || 0;
                }
            }
        }

        const suggestedChanges: any = {};
        let dominantSignalCount = 0;

        // Cost logic
        if (costUnderCount >= 3 && costUnderCount > costOverCount * 2) {
            const avgMag = totalCostUnderMagnitude / costUnderCount;
            // Suggest increasing cost mid by avgMag %
            suggestedChanges.costPerSqftMid = `+${Math.min(avgMag, 15).toFixed(1)}%`;
            dominantSignalCount = Math.max(dominantSignalCount, costUnderCount);
        } else if (costOverCount >= 3 && costOverCount > costUnderCount * 2) {
            const avgMag = totalCostOverMagnitude / costOverCount;
            suggestedChanges.costPerSqftMid = `-${Math.min(avgMag, 15).toFixed(1)}%`;
            dominantSignalCount = Math.max(dominantSignalCount, costOverCount);
        }

        // Risk logic
        if (riskUnderCount >= 3 && riskUnderCount > riskOverCount * 2) {
            const avgMag = totalRiskUnderMagnitude / riskUnderCount;
            // Suggest increasing timelineRiskMultiplier
            suggestedChanges.timelineRiskMultiplier = `+0.10`; // Fixed delta suggestion based on risk points
            dominantSignalCount = Math.max(dominantSignalCount, riskUnderCount);
        } else if (riskOverCount >= 3 && riskOverCount > riskUnderCount * 2) {
            suggestedChanges.timelineRiskMultiplier = `-0.05`;
            dominantSignalCount = Math.max(dominantSignalCount, riskOverCount);
        }

        if (Object.keys(suggestedChanges).length > 0) {
            let confidence = 0.5; // low default
            if (dominantSignalCount >= 5) confidence = 0.9;
            else if (dominantSignalCount >= 3) confidence = 0.75;

            suggestions.push({
                basedOnOutcomesQuery: `typology=${typology}&tier=${tier}`,
                suggestedChanges,
                confidence: confidence.toFixed(4),
                status: "pending",
                reviewerNotes: `Auto-generated from ${group.comparisons.length} recent outcomes demonstrating consistent prediction drift.`,
            });
        }
    }

    return suggestions;
}
