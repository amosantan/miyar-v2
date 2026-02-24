import { calculateCostAvoidance } from "./cost-avoidance";
import { calculateProgrammeAcceleration } from "./programme-acceleration";

export interface RoiCalculatorParams {
    tier: string;
    scale: string;
    totalBudgetAed: number;
    totalDevelopmentValue: number;
    complexityScore: number;
    decisionSpeedAdjustment?: number;
    serviceFeeAed: number; // MIYAR's fee to calculate Net ROI
}

export function calculateProjectRoi(params: RoiCalculatorParams) {
    const {
        tier,
        scale,
        totalBudgetAed,
        totalDevelopmentValue,
        complexityScore,
        decisionSpeedAdjustment = 1.0,
        serviceFeeAed,
    } = params;

    const costAvoidance = calculateCostAvoidance(tier, scale, totalBudgetAed, complexityScore);
    const acceleration = calculateProgrammeAcceleration(totalDevelopmentValue, tier, decisionSpeedAdjustment);

    const totalValueCreated = costAvoidance.reworkCostAvoided + acceleration.programmeAccelerationValue;

    // Net ROI = (Total Value Created – MIYAR Service Fee) / MIYAR Service Fee
    // Capped at 0 logic to prevent weird Infinity displays if fee is 0
    const netRoiPercent = serviceFeeAed > 0
        ? ((totalValueCreated - serviceFeeAed) / serviceFeeAed) * 100
        : 0;

    // Confidence Multiplier shrinks expected value slightly based on extreme complexity
    const confidenceMultiplier = complexityScore > 80 ? 0.85 : complexityScore > 60 ? 0.90 : 0.95;
    const riskAdjustedValue = totalValueCreated * confidenceMultiplier;

    return {
        reworkCostAvoided: costAvoidance.reworkCostAvoided,
        programmeAccelerationValue: acceleration.programmeAccelerationValue,
        totalValueCreated: Number(totalValueCreated.toFixed(2)),
        riskAdjustedValue: Number(riskAdjustedValue.toFixed(2)),
        netRoiPercent: Number(netRoiPercent.toFixed(2)),
        confidenceMultiplier: Number(confidenceMultiplier.toFixed(3)),
        breakdown: {
            costAvoidance,
            acceleration
        }
    };
}
