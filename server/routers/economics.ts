import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { calculateProjectRoi } from "../engines/economic/roi-calculator";
import { evaluateRiskSurface } from "../engines/risk/risk-evaluator";
import { simulateStressTest } from "../engines/risk/stress-tester";
import { rankScenarios } from "../engines/autonomous/scenario-ranking";

// V9 Strategic Risk & Economic Modeling
export const economicsRouter = router({

    calculateRoi: publicProcedure
        .input(z.object({
            tier: z.string(),
            scale: z.string(),
            totalBudgetAed: z.number(),
            totalDevelopmentValue: z.number(),
            complexityScore: z.number(),
            decisionSpeedAdjustment: z.number().optional().default(1.0),
            serviceFeeAed: z.number()
        }))
        .query(({ input }) => {
            return calculateProjectRoi({
                tier: input.tier,
                scale: input.scale,
                totalBudgetAed: input.totalBudgetAed,
                totalDevelopmentValue: input.totalDevelopmentValue,
                complexityScore: input.complexityScore,
                decisionSpeedAdjustment: input.decisionSpeedAdjustment,
                serviceFeeAed: input.serviceFeeAed
            });
        }),

    evaluateRisk: publicProcedure
        .input(z.object({
            domain: z.enum([
                "Model", "Operational", "Commercial", "Technology",
                "Data", "Behavioural", "Strategic", "Regulatory"
            ]),
            tier: z.string(),
            horizon: z.string(),
            location: z.string(),
            complexityScore: z.number()
        }))
        .query(({ input }) => {
            return evaluateRiskSurface({
                domain: input.domain as any,
                tier: input.tier,
                horizon: input.horizon,
                location: input.location,
                complexityScore: input.complexityScore,
            });
        }),

    runStressTest: publicProcedure
        .input(z.object({
            condition: z.enum(["demand_collapse", "cost_surge", "data_disruption", "market_shift"]),
            baselineBudgetAed: z.number(),
            tier: z.string()
        }))
        .query(({ input }) => {
            return simulateStressTest(
                input.condition as any,
                input.baselineBudgetAed,
                input.tier
            );
        }),

    rankScenarios: publicProcedure
        .input(z.object({
            scenarios: z.array(z.object({
                scenarioId: z.number(),
                name: z.string(),
                netRoiPercent: z.number(),
                avgResilienceScore: z.number(),
                compositeRiskScore: z.number(),
            }))
        }))
        .query(({ input }) => {
            return rankScenarios(input.scenarios);
        }),
});
