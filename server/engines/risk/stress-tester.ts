/**
 * BP 35: Scenario Stress Testing Framework
 * Simulates macro-economic shocks on a project scenario.
 */

export type StressCondition = "demand_collapse" | "cost_surge" | "data_disruption" | "market_shift";

export function simulateStressTest(
    condition: StressCondition,
    baselineBudgetAed: number,
    tier: string
) {
    let impactMagnitudePercent = 0;
    let resilienceScore = 100; // 1-100
    let failurePoints: string[] = [];

    switch (condition) {
        case "cost_surge":
            // Simulate 20% operational cost increase / material inflation
            impactMagnitudePercent = 20;
            break;
        case "demand_collapse":
            // Simulate 50% reduction in sales velocity
            impactMagnitudePercent = -50;
            break;
        case "market_shift":
            // Change in design trends (e.g. brutalism goes out of style)
            impactMagnitudePercent = -15;
            break;
        case "data_disruption":
            // Loss of benchmark source tracking
            impactMagnitudePercent = 0;
            break;
    }

    // Calculate resilience
    if (condition === "cost_surge") {
        // Ultra-luxury has higher margin buffers to absorb cost surges
        resilienceScore = tier === "Ultra-luxury" ? 85 : tier === "Luxury" ? 70 : 45;
        if (resilienceScore < 60) {
            failurePoints.push("margin_protection", "finishing_budget_saturation");
        }
    }

    if (condition === "demand_collapse") {
        resilienceScore = tier === "Ultra-luxury" ? 40 : tier === "Luxury" ? 50 : 80; // High end suffers most in demand collapse
        if (resilienceScore < 60) {
            failurePoints.push("sales_velocity", "carry_cost_overrun");
        }
    }

    if (condition === "market_shift") {
        resilienceScore = 65;
        failurePoints.push("design_obsolescence");
    }

    if (condition === "data_disruption") {
        resilienceScore = 50;
        failurePoints.push("model_robustness", "confidence_interval");
    }

    return {
        stressCondition: condition,
        impactMagnitudePercent,
        resilienceScore,
        failurePoints,
    };
}
