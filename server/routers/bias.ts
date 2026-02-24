/**
 * V11: Cognitive Bias Framework — TRPC Router
 * Endpoints for retrieving, dismissing, and profiling cognitive biases.
 */

import { z } from "zod";
import { orgProcedure, protectedProcedure } from "../_core/trpc";
import { router } from "../_core/trpc";
import * as db from "../db";

export const biasRouter = router({
    // Get all bias alerts for a project (active + dismissed)
    getAlerts: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || (project.orgId !== ctx.orgId && project.userId !== ctx.user.id)) return [];
            return db.getBiasAlertsByProject(input.projectId);
        }),

    // Get only active (non-dismissed) alerts
    getActiveAlerts: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || (project.orgId !== ctx.orgId && project.userId !== ctx.user.id)) return [];
            return db.getActiveBiasAlerts(input.projectId);
        }),

    // Dismiss a bias alert
    dismiss: orgProcedure
        .input(z.object({ alertId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            await db.dismissBiasAlert(input.alertId, ctx.user.id);
            await db.createAuditLog({
                userId: ctx.user.id,
                action: "bias.dismiss",
                entityType: "bias_alert",
                entityId: input.alertId,
                details: { alertId: input.alertId },
            });
            return { success: true };
        }),

    // Get user's aggregated bias profile
    getProfile: protectedProcedure
        .query(async ({ ctx }: { ctx: any }) => {
            return db.getUserBiasProfile(ctx.user.id);
        }),

    // Get intervention report for a project (structured summary for reports)
    getInterventionReport: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || (project.orgId !== ctx.orgId && project.userId !== ctx.user.id)) {
                return { alerts: [], hasBiases: false, summary: "No data available." };
            }

            const alerts = await db.getActiveBiasAlerts(input.projectId);

            if (alerts.length === 0) {
                return {
                    alerts: [],
                    hasBiases: false,
                    summary: "No cognitive biases detected. Input parameters appear objectively grounded.",
                };
            }

            const criticalCount = alerts.filter((a: any) => a.severity === "critical").length;
            const highCount = alerts.filter((a: any) => a.severity === "high").length;

            const summary = criticalCount > 0
                ? `⚠️ ${criticalCount} critical bias(es) detected. Immediate review recommended before proceeding.`
                : highCount > 0
                    ? `${highCount} high-severity bias(es) identified. Consider reviewing inputs before finalizing.`
                    : `${alerts.length} potential bias(es) identified at moderate confidence. Review at your discretion.`;

            return {
                alerts,
                hasBiases: true,
                summary,
                criticalCount,
                highCount,
                totalCount: alerts.length,
            };
        }),
});
