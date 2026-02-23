import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { platformAlerts } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
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
        .mutation(async ({ input }) => {
            const result = await processNlQuery(input.query);
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
