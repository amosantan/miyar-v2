/**
 * Sales Premium & Yield Predictor Router — Phase 10
 *
 * Exposes value-add calculations via tRPC.
 * Fetches DLD area stats from DB, delegates math to the pure engine.
 */

import { z } from "zod";
import { router, orgProcedure } from "../_core/trpc";
import { computeValueAddBridge, computeBrandEquityForecast } from "../engines/value-add-engine";
import { getAreaSaleMedianSqm } from "../engines/dld-analytics";
import * as db from "../db";

export const salesPremiumRouter = router({
    /**
     * getValueAddBridge — Core endpoint
     *
     * Given a project's current and proposed fitout spend,
     * returns yield delta, sale premium, and payback period.
     */
    getValueAddBridge: orgProcedure
        .input(z.object({
            projectId: z.number(),
            currentFitoutPerSqm: z.number().min(0),
            proposedFitoutPerSqm: z.number().min(0),
        }))
        .query(async ({ input }) => {
            // 1. Fetch project data
            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            // 2. Get DLD area stats
            const saleMedianPerSqm = await getAreaSaleMedianSqm(project.dldAreaId ?? null);

            // 3. Get transaction count for confidence calculation
            let transactionCount = 0;
            if (project.dldAreaId) {
                const benchmark = await db.getDldAreaBenchmark(project.dldAreaId);
                transactionCount = benchmark?.saleTransactionCount
                    ? Number(benchmark.saleTransactionCount)
                    : 0;
            }

            // 4. Compute
            const result = computeValueAddBridge({
                currentFitoutPerSqm: input.currentFitoutPerSqm,
                proposedFitoutPerSqm: input.proposedFitoutPerSqm,
                gfa: Number(project.totalFitoutArea || project.ctx03Gfa || 0),
                saleMedianPerSqm,
                tier: project.mkt01Tier ?? "Upper-mid",
                handoverCondition: project.handoverCondition ?? undefined,
                transactionCount,
            });

            return result;
        }),

    /**
     * getBrandEquityForecast — Brand halo endpoint
     *
     * For trophy/flagship projects, estimates the portfolio
     * halo effect of a high-performing sale.
     */
    getBrandEquityForecast: orgProcedure
        .input(z.object({
            projectId: z.number(),
            salePerformancePct: z.number().min(0).max(100),
        }))
        .query(async ({ input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            return computeBrandEquityForecast({
                tier: project.mkt01Tier ?? "Upper-mid",
                targetValueAdd: project.targetValueAdd ?? "Balanced Return",
                salePerformancePct: input.salePerformancePct,
                brandedStatus: project.brandedStatus ?? "Unbranded",
            });
        }),
});
