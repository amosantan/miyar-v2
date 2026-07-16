/**
 * V11: Cognitive Bias Framework — TRPC Router
 * Endpoints for retrieving, dismissing, and profiling cognitive biases.
 */

import { z } from "zod";
import {
    orgMutationProcedure,
    orgProcedure,
    protectedProcedure,
} from "../_core/trpc";
import { router } from "../_core/trpc";
import * as db from "../db";
import { requireProjectForOrg } from "../_core/project-access";
import { requireProjectOrgResourceForOrg } from "../_core/resource-access";

export const biasRouter = router({
    // Get all bias alerts for a project (active + dismissed)
    getAlerts: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            await requireProjectForOrg(input.projectId, ctx.orgId);
            return db.getBiasAlertsByProject(input.projectId);
        }),

    // Get only active (non-dismissed) alerts
    getActiveAlerts: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            await requireProjectForOrg(input.projectId, ctx.orgId);
            return db.getActiveBiasAlerts(input.projectId);
        }),

    // Dismiss a bias alert
    dismiss: orgMutationProcedure
        .input(z.object({ alertId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            await requireProjectOrgResourceForOrg(input.alertId, ctx.orgId, {
                lookupResource: db.getBiasAlertById,
                getProjectId: alert => alert.projectId,
                getOrgId: alert => alert.orgId,
            });
            if (!(await db.dismissBiasAlertForOrg(
                input.alertId,
                ctx.orgId,
                ctx.user.id
            ))) {
                await requireProjectOrgResourceForOrg(input.alertId, ctx.orgId, {
                    lookupResource: db.getBiasAlertById,
                    getProjectId: alert => alert.projectId,
                    getOrgId: alert => alert.orgId,
                });
            }
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
            await requireProjectForOrg(input.projectId, ctx.orgId);

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
    // On-demand bias scan (without re-evaluating project)
    scan: orgMutationProcedure
        .input(z.object({ projectId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const project = await requireProjectForOrg(input.projectId, ctx.orgId);

            // Get latest score matrix
            const matrices = await db.getScoreMatricesByProject(input.projectId);
            if (!matrices || matrices.length === 0) {
                throw new Error("Project has no evaluations yet. Evaluate the project first.");
            }
            const latestMatrix = matrices[0];
            const scoreResult = {
                compositeScore: Number(latestMatrix.compositeScore),
                penalties: (latestMatrix.penalties as any[]) || [],
                decisionStatus: latestMatrix.decisionStatus,
            };
            const inputs = (latestMatrix.inputSnapshot || project) as any;

            // Build detector context
            const evalHistory = await db.getProjectEvaluationHistory(input.projectId);
            const overrideStats = await db.getUserOverrideStats(input.projectId);

            const previousScores = evalHistory
                .filter((m: any) => m.id !== latestMatrix.id)
                .map((m: any) => Number(m.compositeScore));
            const previousBudgets = evalHistory
                .filter((m: any) => m.id !== latestMatrix.id)
                .map((m: any) => Number((m.inputSnapshot as any)?.fin01BudgetCap || 0));

            const biasCtx = {
                projectId: input.projectId,
                userId: ctx.user.id,
                orgId: ctx.orgId,
                evaluationCount: evalHistory.length,
                previousScores,
                previousBudgets,
                overrideCount: overrideStats.count,
                overrideNetEffect: overrideStats.netEffect,
                marketTrendActual: null as number | null,
            };

            const { detectBiases } = await import("../engines/bias/bias-detector");
            const biasAlerts = detectBiases(inputs, scoreResult as any, biasCtx);

            const severityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

            if (biasAlerts.length > 0) {
                await db.createBiasAlerts(
                    biasAlerts.map(alert => ({
                        projectId: input.projectId,
                        scoreMatrixId: latestMatrix.id,
                        userId: ctx.user.id,
                        orgId: ctx.orgId,
                        biasType: alert.biasType as any,
                        severity: alert.severity as any,
                        confidence: String(alert.confidence) as any,
                        title: alert.title,
                        description: alert.description,
                        intervention: alert.intervention,
                        evidencePoints: alert.evidencePoints,
                        mathExplanation: alert.mathExplanation,
                    }))
                );

                for (const alert of biasAlerts) {
                    await db.upsertBiasProfile(
                        ctx.user.id,
                        ctx.orgId,
                        alert.biasType,
                        severityMap[alert.severity] || 2
                    );
                }
            }

            await db.createAuditLog({
                userId: ctx.user.id,
                action: "bias.scan",
                entityType: "project",
                entityId: input.projectId,
                details: { detected: biasAlerts.length },
            });

            return {
                detected: biasAlerts.length,
                alerts: biasAlerts,
            };
        }),

    // Get all active alerts across all user projects (for dashboard)
    getAllActiveAlerts: orgProcedure
        .query(async ({ ctx }) => {
            const projects = await db.getProjectsByOrg(ctx.orgId);
            if (!projects || projects.length === 0) return [];
            const allAlerts: any[] = [];
            for (const p of projects) {
                const alerts = await db.getActiveBiasAlerts(p.id);
                allAlerts.push(...alerts.map((a: any) => ({
                    ...a,
                    projectName: p.name,
                })));
            }
            return allAlerts.sort((a, b) => {
                const sev: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                return (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4);
            });
        }),
});
