/**
 * Customer Success Router (Phase G)
 * Endpoints for health scores and activity feed.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import {
    auditLogs,
    customerHealthScores,
    biasAlerts,
    monteCarloSimulations,
} from "../../drizzle/schema";
import { eq, desc, gte, and, sql, count } from "drizzle-orm";
import { calculateHealthScore, type HealthMetrics } from "../engines/customer/health-score";

export const customerSuccessRouter = router({
    // Calculate and persist a fresh health score
    calculateHealth: protectedProcedure
        .mutation(async ({ ctx }: { ctx: any }) => {
            const d = await getDb();
            if (!d) throw new Error("Database unavailable");

            const userId = ctx.user.id;
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            // Engagement: audit log stats (last 30 days)
            const recentLogs = await d.select()
                .from(auditLogs)
                .where(and(
                    eq(auditLogs.userId, userId),
                    gte(auditLogs.createdAt, thirtyDaysAgo)
                ));

            const totalActions = recentLogs.length;
            const uniqueActiveDays = new Set(
                recentLogs.map((l: any) => new Date(l.createdAt).toISOString().split("T")[0])
            ).size;

            const lastAction = recentLogs.length > 0
                ? recentLogs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                : null;
            const daysSinceLastAction = lastAction
                ? Math.floor((now.getTime() - new Date(lastAction.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 30;

            // Adoption: project & feature counts
            const projects = await db.getProjectsByUser(userId);
            const totalProjects = projects?.length || 0;
            const evaluatedProjects = projects?.filter((p: any) => p.status === "evaluated").length || 0;

            // Count scenarios
            const scenarioActions = recentLogs.filter((l: any) => l.entityType === "scenario").length;

            // Count simulations
            const simRows = await d.select({ c: count() }).from(monteCarloSimulations)
                .where(eq(monteCarloSimulations.userId, userId));
            const simulationsRun = simRows[0]?.c || 0;

            // Bias scans
            const biasScanActions = recentLogs.filter((l: any) => l.action === "bias.scan").length;

            // Portfolios
            const portfolioActions = recentLogs.filter((l: any) => l.entityType === "portfolio").length;

            // Reports
            const reportActions = recentLogs.filter((l: any) =>
                l.action === "project.report" || l.action === "portfolio.report"
            ).length;

            // Quality: avg score, bias stats
            const evaluatedProjScores = projects
                ?.filter((p: any) => p.status === "evaluated" && p.compositeScore != null)
                .map((p: any) => Number(p.compositeScore)) || [];
            const avgProjectScore = evaluatedProjScores.length > 0
                ? evaluatedProjScores.reduce((s: number, v: number) => s + v, 0) / evaluatedProjScores.length
                : 0;

            const allBiasAlerts = await d.select().from(biasAlerts)
                .where(eq(biasAlerts.userId, userId));
            const biasAlertsTotal = allBiasAlerts.length;
            const biasAlertsDismissed = allBiasAlerts.filter((a: any) => a.dismissed).length;

            // Velocity: this month vs last month
            const thisMonthProjects = projects?.filter((p: any) =>
                new Date(p.createdAt) >= thisMonthStart
            ).length || 0;
            const lastMonthProjects = projects?.filter((p: any) =>
                new Date(p.createdAt) >= lastMonthStart && new Date(p.createdAt) < thisMonthStart
            ).length || 0;

            const thisMonthEvals = recentLogs.filter((l: any) =>
                l.action === "project.evaluate" && new Date(l.createdAt) >= thisMonthStart
            ).length;
            const lastMonthEvals = recentLogs.filter((l: any) =>
                l.action === "project.evaluate" &&
                new Date(l.createdAt) >= lastMonthStart &&
                new Date(l.createdAt) < thisMonthStart
            ).length;

            const metrics: HealthMetrics = {
                totalActions,
                daysSinceLastAction,
                uniqueActiveDays,
                totalProjects,
                evaluatedProjects,
                scenariosCreated: scenarioActions,
                simulationsRun: Number(simulationsRun),
                biasScansRun: biasScanActions,
                portfoliosCreated: portfolioActions > 0 ? 1 : 0,
                reportsGenerated: reportActions,
                avgProjectScore,
                biasAlertsTotal,
                biasAlertsDismissed,
                projectsThisMonth: thisMonthProjects,
                projectsLastMonth: lastMonthProjects,
                evaluationsThisMonth: thisMonthEvals,
                evaluationsLastMonth: lastMonthEvals,
            };

            const result = calculateHealthScore(metrics);

            // Persist
            await d.insert(customerHealthScores).values({
                userId,
                orgId: ctx.user.orgId || null,
                compositeScore: result.compositeScore,
                engagementScore: result.engagement.score,
                adoptionScore: result.adoption.score,
                qualityScore: result.quality.score,
                velocityScore: result.velocity.score,
                healthTier: result.tier,
                recommendations: result.recommendations,
                metrics: result.metrics,
            });

            return result;
        }),

    // Get latest health score
    getHealth: protectedProcedure
        .query(async ({ ctx }: { ctx: any }) => {
            const d = await getDb();
            if (!d) return null;
            const rows = await d.select().from(customerHealthScores)
                .where(eq(customerHealthScores.userId, ctx.user.id))
                .orderBy(desc(customerHealthScores.createdAt))
                .limit(1);
            return rows[0] || null;
        }),

    // Recent activity feed
    getActivityFeed: protectedProcedure
        .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
        .query(async ({ ctx, input }: { ctx: any; input?: any }) => {
            const d = await getDb();
            if (!d) return [];
            const limit = input?.limit || 20;
            return d.select().from(auditLogs)
                .where(eq(auditLogs.userId, ctx.user.id))
                .orderBy(desc(auditLogs.createdAt))
                .limit(limit);
        }),
});
