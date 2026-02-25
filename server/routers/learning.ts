import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { outcomeComparisons, projectOutcomes, scoreMatrices, accuracySnapshots, logicChangeLog, benchmarkSuggestions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { compareOutcomeToPrediction } from "../engines/learning/outcome-comparator";
import { generatePostMortemEvidence, summarizeLearningSignals } from "../engines/learning/post-mortem-evidence";
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

    // ─── Post-Mortem / Handover (V4) ────────────────────────────────────────

    submitPostMortem: protectedProcedure
        .input(z.object({
            projectId: z.number(),
            // Actual costs
            actualTotalCost: z.string().optional(),
            actualFitoutCostPerSqm: z.string().optional(),
            procurementActualCosts: z.record(z.string(), z.number()).optional(),
            // Timeline
            projectDeliveredOnTime: z.boolean().optional(),
            leadTimesActual: z.record(z.string(), z.number()).optional(),
            // Quality
            reworkOccurred: z.boolean().optional(),
            reworkCostAed: z.string().optional(),
            clientSatisfactionScore: z.number().min(1).max(5).optional(),
            // Procurement
            tenderIterations: z.number().optional(),
            rfqResults: z.record(z.string(), z.number()).optional(),
            // Lessons
            keyLessonsLearned: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

            // 1. Save the outcome
            const outcomeId = await db.createProjectOutcome({
                projectId: input.projectId,
                actualTotalCost: input.actualTotalCost,
                actualFitoutCostPerSqm: input.actualFitoutCostPerSqm,
                procurementActualCosts: input.procurementActualCosts,
                projectDeliveredOnTime: input.projectDeliveredOnTime,
                leadTimesActual: input.leadTimesActual,
                reworkOccurred: input.reworkOccurred,
                reworkCostAed: input.reworkCostAed,
                clientSatisfactionScore: input.clientSatisfactionScore,
                tenderIterations: input.tenderIterations,
                rfqResults: input.rfqResults,
                keyLessonsLearned: input.keyLessonsLearned,
                capturedBy: ctx.user.id,
            });

            // 2. Auto-run comparison (if score matrix exists)
            let comparison = null;
            let learningSummary = null;
            let evidenceGenerated = 0;

            try {
                const ormDb = await db.getDb();

                const outcomes = await ormDb.select().from(projectOutcomes)
                    .where(eq(projectOutcomes.projectId, input.projectId))
                    .orderBy(desc(projectOutcomes.capturedAt))
                    .limit(1);

                const matrices = await ormDb.select().from(scoreMatrices)
                    .where(eq(scoreMatrices.projectId, input.projectId))
                    .orderBy(desc(scoreMatrices.computedAt))
                    .limit(1);

                if (outcomes.length > 0 && matrices.length > 0) {
                    const outcome = outcomes[0];
                    const scoreMatrix = matrices[0];

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

                    // Run comparator
                    comparison = compareOutcomeToPrediction({
                        projectId: input.projectId,
                        outcome,
                        scoreMatrix,
                        costPrediction,
                        outcomePrediction,
                    });

                    // Save comparison
                    await ormDb.insert(outcomeComparisons).values(comparison);

                    // Generate learning summary
                    learningSummary = summarizeLearningSignals(comparison.learningSignals);

                    // 3. Generate evidence records from deltas
                    const postMortemEvidence = generatePostMortemEvidence(
                        input.projectId,
                        comparison,
                        {
                            typology: project.ctx01Typology || undefined,
                            tier: project.mkt01Tier || undefined,
                            location: project.ctx04Location || undefined,
                            gfa: null,
                        },
                    );

                    // Insert evidence records
                    for (const ev of postMortemEvidence) {
                        try {
                            await db.createEvidenceRecord({
                                sourceId: ev.sourceId,
                                sourceType: ev.sourceType,
                                category: ev.category,
                                evidencePhase: ev.evidencePhase,
                                priceMin: ev.priceMin !== null ? String(ev.priceMin) : undefined,
                                priceTypical: ev.priceTypical !== null ? String(ev.priceTypical) : undefined,
                                priceMax: ev.priceMax !== null ? String(ev.priceMax) : undefined,
                                unit: ev.unit,
                                reliabilityGrade: ev.reliability,
                                confidenceScore: ev.confidenceScore,
                                geography: ev.geography,
                                notes: ev.notes,
                                tags: ev.tags,
                            } as any);
                            evidenceGenerated++;
                        } catch (evErr) {
                            console.warn("[PostMortem] Evidence insert failed:", evErr);
                        }
                    }
                }
            } catch (compErr) {
                console.warn("[PostMortem] Auto-comparison failed (non-fatal):", compErr);
            }

            // 4. Audit log
            await db.createAuditLog({
                userId: ctx.user.id,
                action: "project.submit_post_mortem",
                entityType: "project",
                entityId: input.projectId,
                details: {
                    outcomeId,
                    actualTotalCost: input.actualTotalCost,
                    comparisonRun: comparison !== null,
                    accuracyGrade: comparison?.overallAccuracyGrade || null,
                    evidenceGenerated,
                },
            });

            return {
                success: true,
                outcomeId,
                comparison,
                learningSummary,
                evidenceGenerated,
            };
        }),

    getPostMortemStatus: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }) => {
            const ormDb = await db.getDb();

            // Check if outcome exists
            const outcomes = await ormDb.select().from(projectOutcomes)
                .where(eq(projectOutcomes.projectId, input.projectId))
                .orderBy(desc(projectOutcomes.capturedAt))
                .limit(1);

            // Check if comparison exists
            const comparisons = await ormDb.select().from(outcomeComparisons)
                .where(eq(outcomeComparisons.projectId, input.projectId))
                .orderBy(desc(outcomeComparisons.comparedAt))
                .limit(1);

            return {
                hasOutcome: outcomes.length > 0,
                outcome: outcomes[0] || null,
                hasComparison: comparisons.length > 0,
                comparison: comparisons[0] || null,
                accuracyGrade: comparisons[0]?.overallAccuracyGrade || null,
                learningSummary: comparisons[0]?.learningSignals
                    ? summarizeLearningSignals(comparisons[0].learningSignals as any)
                    : null,
            };
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
