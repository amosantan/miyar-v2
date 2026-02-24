/**
 * BP 17: Programme Acceleration Model
 * Decision Compression Value = Days Saved × Daily Project Carry Cost
 */

export function calculateProgrammeAcceleration(
    totalDevelopmentValue: number, // Estimated GDV or total Construction Budget
    tier: string,
    decisionSpeedAdjustment: number = 1.0 // Overrides based on client efficiency
) {
    // Time saved by removing manual pre-design feasibility & specification loops
    // Higher tiers traditionally face much longer design approval loops
    const baselineDaysSaved = tier === "Ultra-luxury" ? 60 : tier === "Luxury" ? 45 : 30;
    const actualDaysSaved = baselineDaysSaved * decisionSpeedAdjustment;

    // Daily carry cost: Driven by typical developer financing overhead (Assume 8% APR)
    // Includes financing cost, contractor standby, and overhead burn.
    const annualFinancingCost = totalDevelopmentValue * 0.08;
    const dailyCarryCost = annualFinancingCost / 365;

    // The economic value of starting construction/procurement exactly X days earlier
    const accelerationValue = actualDaysSaved * dailyCarryCost;

    return {
        programmeAccelerationValue: Number(accelerationValue.toFixed(2)),
        daysSaved: Number(actualDaysSaved.toFixed(0)),
        dailyCarryCost: Number(dailyCarryCost.toFixed(2)),
    };
}
