/**
 * BP 17: Cost Avoidance Modeling
 * Expected Rework Cost = Probability of Late Change × Cost of Change × Scope Impact Ratio
 */

export function calculateCostAvoidance(
    tier: string,
    scale: string,
    totalBudgetAed: number,
    complexityScore: number // 1-100 derived from strategic clarity + market volatility
) {
    // Base probability of late change based on complexity (0.15 to 0.50)
    const probability = Math.min(0.50, 0.15 + (complexityScore * 0.0035));

    // Expected cost multiplier of an unvalidated change (approx 18% of interior budget)
    // Factor includes redesign fees, procurement replacement, scheduling
    const costOfChangeMultiplier = tier === "Ultra-luxury" ? 0.25 : tier === "Luxury" ? 0.20 : 0.18;
    const costOfChange = totalBudgetAed * costOfChangeMultiplier;

    // Scope impact ratio: How much of typical design is impacted per rework event
    // Smaller projects suffer higher proportional ratio of impact
    const scopeRatio = scale === "Large" ? 0.40 : scale === "Medium" ? 0.60 : 0.85;

    // Total Expected Risk Value averted by running MIYAR validation
    const reworkCostAvoided = probability * costOfChange * scopeRatio;

    return {
        reworkCostAvoided: Number(reworkCostAvoided.toFixed(2)),
        probabilityPercent: Number((probability * 100).toFixed(1)),
        estimatedReplacementCost: Number(costOfChange.toFixed(2)),
        scopeImpactRatio: Number(scopeRatio.toFixed(2)),
    };
}
