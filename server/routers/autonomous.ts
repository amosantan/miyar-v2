import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { platformAlerts, nlQueryLog } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { processNlQuery } from "../engines/autonomous/nl-engine";
import { generateAutonomousDesignBrief } from "../engines/autonomous/document-generator";
import { generatePortfolioInsights } from "../engines/autonomous/portfolio-engine";

export const autonomousRouter = router({
    getAlerts: protectedProcedure
        .input(z.object({
            severity: z.string().optional(),
            type: z.string().optional(),
            status: z.enum(["active", "acknowledged", "resolved", "expired"]).optional(),
        }).optional())
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) return [];

            let conditions: any[] = [];
            const targetStatus = input?.status || "active";
            conditions.push(eq(platformAlerts.status, targetStatus as any));

            if (input?.severity) {
                conditions.push(eq(platformAlerts.severity, input.severity as any));
            }

            if (input?.type) {
                conditions.push(eq(platformAlerts.alertType, input.type as any));
            }

            return db.select()
                .from(platformAlerts)
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(desc(platformAlerts.createdAt));
        }),

    acknowledgeAlert: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            await db.update(platformAlerts)
                .set({
                    status: "acknowledged",
                    acknowledgedBy: ctx.user.id,
                    acknowledgedAt: new Date()
                })
                .where(eq(platformAlerts.id, input.id));

            return { success: true };
        }),

    resolveAlert: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            await db.update(platformAlerts)
                .set({
                    status: "resolved",
                })
                .where(eq(platformAlerts.id, input.id));

            return { success: true };
        }),

    nlQuery: protectedProcedure
        .input(z.object({ query: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });

            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const recentQueries = await db
                .select({ count: sql<number>`count(*)` })
                .from(nlQueryLog)
                .where(
                    and(
                        eq(nlQueryLog.userId, ctx.user.id),
                        sql`${nlQueryLog.createdAt} > ${oneHourAgo}`
                    )
                );

            const count = Number(recentQueries[0]?.count || 0);
            if (count >= 20) {
                throw new TRPCError({
                    code: "TOO_MANY_REQUESTS",
                    message: "Natural language query limit: 20 queries/hour"
                });
            }

            const result = await processNlQuery(ctx.user.id, input.query);
            return result;
        }),

    generateBrief: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .mutation(async ({ input }) => {
            const briefMarkdown = await generateAutonomousDesignBrief(input.projectId);
            return { markdown: briefMarkdown };
        }),

    portfolioInsights: protectedProcedure
        .query(async () => {
            const markdown = await generatePortfolioInsights();
            return { markdown };
        })
});
