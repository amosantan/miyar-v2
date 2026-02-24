/**
 * BP 21: Scenario Selection & Ranking
 * Compares multiple scenarios based on net ROI and aggregated resilience under stress.
 */

export interface ScenarioProfile {
    scenarioId: number;
    name: string;
    netRoiPercent: number;
    avgResilienceScore: number;
    compositeRiskScore: number; // Lower is better
}

export function rankScenarios(scenarios: ScenarioProfile[]) {
    // Rank heuristic:
    // Give 50% weight to Net ROI
    // Give 30% weight to Resilience (ability to survive shocks)
    // Give 20% weight to Inverse Risk (100 - riskScore)

    const scoredScenarios = scenarios.map((scenario) => {
        // Normalize to a hypothetical 100 pt index

        // Assume 100% net ROI is "perfect" for normalization purposes
        const roiScore = Math.min(scenario.netRoiPercent, 100);

        const riskInverted = 100 - scenario.compositeRiskScore;

        const strategicRankScore =
            (roiScore * 0.50) +
            (scenario.avgResilienceScore * 0.30) +
            (riskInverted * 0.20);

        return {
            ...scenario,
            strategicRankScore: Number(strategicRankScore.toFixed(2))
        };
    });

    // Sort descending by rank score
    return scoredScenarios.sort((a, b) => b.strategicRankScore - a.strategicRankScore);
}
