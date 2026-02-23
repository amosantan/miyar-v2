import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { outcomeComparisons, projectOutcomes, scoreMatrices, accuracySnapshots, logicChangeLog, benchmarkSuggestions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { compareOutcomeToPrediction } from "../engines/learning/outcome-comparator";
import { predictCostRange, predictOutcome } from "../engines/predictive";
import type { EvidenceDataPoint, TrendDataPoint, ComparableOutcome } from "../engines/predictive";

export const learningRouter = router({
    getAccuracyLedger: protectedProcedure
        .query(async () => {
            const ormDb = await db.getDb();
            const rows = await ormDb.select().from(accuracySnapshots)
                .orderBy(desc(accuracySnapshots.snapshotDate))
                .limit(1);
            return rows[0] || null;
        }),

    getAccuracyHistory: protectedProcedure
        .input(z.object({ limit: z.number().default(20) }).optional())
        .query(async ({ input }) => {
            const ormDb = await db.getDb();
            return await ormDb.select().from(accuracySnapshots)
                .orderBy(desc(accuracySnapshots.snapshotDate))
                .limit(input?.limit || 20);
        }),

    getPendingLogicProposals: protectedProcedure
        .query(async () => {
            const ormDb = await db.getDb();
            return await ormDb.select().from(logicChangeLog)
                .where(eq(logicChangeLog.status, "proposed"))
                .orderBy(desc(logicChangeLog.createdAt));
        }),

    getPendingBenchmarkSuggestions: protectedProcedure
        .query(async () => {
            const ormDb = await db.getDb();
            return await ormDb.select().from(benchmarkSuggestions)
                .where(eq(benchmarkSuggestions.status, "pending"))
                .orderBy(desc(benchmarkSuggestions.createdAt));
        }),
    getComparison: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }) => {
            const ormDb = await db.getDb();
            const rows = await ormDb.select().from(outcomeComparisons)
                .where(eq(outcomeComparisons.projectId, input.projectId))
                .orderBy(desc(outcomeComparisons.comparedAt))
                .limit(1);
            return rows[0] || null;
        }),

    runComparison: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .mutation(async ({ input }) => {
            const ormDb = await db.getDb();

            const outcomes = await ormDb.select().from(projectOutcomes)
                .where(eq(projectOutcomes.projectId, input.projectId))
                .limit(1);

            if (!outcomes.length) {
                throw new TRPCError({ code: "NOT_FOUND", message: "No outcome found for project" });
            }
            const outcome = outcomes[0];

            const matrices = await ormDb.select().from(scoreMatrices)
                .where(eq(scoreMatrices.projectId, input.projectId))
                .orderBy(desc(scoreMatrices.computedAt))
                .limit(1);

            if (!matrices.length) {
                throw new TRPCError({ code: "NOT_FOUND", message: "No score matrix found for project" });
            }
            const scoreMatrix = matrices[0];

            const project = await db.getProjectById(input.projectId);
            if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

            // Build cost prediction
            const projectEvidence = await db.listEvidenceRecords({ projectId: input.projectId, limit: 500 });
            const allEvidence = await db.listEvidenceRecords({ limit: 1000 });

            const toDataPoint = (e: any): EvidenceDataPoint => ({
                priceMin: Number(e.priceMin) || 0,
                priceTypical: Number(e.priceTypical) || 0,
                priceMax: Number(e.priceMax) || 0,
                unit: e.unit || "sqm",
                reliabilityGrade: e.reliabilityGrade,
                confidenceScore: e.confidenceScore,
                captureDate: e.captureDate,
                category: e.category,
                geography: project.ctx04Location || "UAE",
            });

            const evidence = projectEvidence.map(toDataPoint);
            const uaeWideEvidence = allEvidence.map(toDataPoint);
            const trends = await db.getTrendSnapshots({ limit: 10 });
            const trendData: TrendDataPoint[] = trends.map((t: any) => ({
                category: t.category,
                direction: t.direction,
                percentChange: Number(t.percentChange) || 0,
                confidence: t.confidence,
            }));

            const costPrediction = predictCostRange(evidence, trendData, {
                category: undefined,
                geography: project.ctx04Location || undefined,
                uaeWideEvidence,
            });

            // Build outcome prediction
            const allScores = await db.getAllScoreMatrices();
            const comparableOutcomes: ComparableOutcome[] = [];
            for (const sm of allScores) {
                if (sm.projectId === input.projectId) continue;
                const proj = await db.getProjectById(sm.projectId);
                if (!proj) continue;
                comparableOutcomes.push({
                    projectId: sm.projectId,
                    compositeScore: Number(sm.compositeScore) || 0,
                    decisionStatus: sm.decisionStatus as any,
                    typology: proj.ctx01Typology || "Residential",
                    tier: proj.mkt01Tier || "Mid",
                    geography: proj.ctx04Location || undefined,
                });
            }

            const outcomePrediction = predictOutcome(
                Number(scoreMatrix.compositeScore) || 0,
                comparableOutcomes,
                (scoreMatrix.variableContributions as Record<string, any>) || {},
                {
                    typology: project.ctx01Typology || "Residential",
                    tier: project.mkt01Tier || "Mid",
                    geography: project.ctx04Location || undefined,
                }
            );

            // Run Comparator
            const comparison = compareOutcomeToPrediction({
                projectId: input.projectId,
                outcome,
                scoreMatrix,
                costPrediction,
                outcomePrediction
            });

            // Save comparison
            const [insertResult] = await ormDb.insert(outcomeComparisons).values(comparison);
            return { success: true, comparisonId: Number((insertResult as any).insertId), comparison };
        }),
});
