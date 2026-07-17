import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  orgHeavyMutationProcedure,
  orgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { compareOutcomeToPrediction } from "../engines/learning/outcome-comparator";
import { summarizeLearningSignals } from "../engines/learning/post-mortem-evidence";
import { predictCostRange, predictOutcome } from "../engines/predictive";
import type {
  ComparableOutcome,
  EvidenceDataPoint,
  TrendDataPoint,
} from "../engines/predictive";
import { requireProjectForOrg } from "../_core/project-access";
import {
  ORGANIZATION_CORPUS_POLICY_VERSION,
  type CorpusMetadata,
} from "../../shared/data-corpus";

function toEvidenceDataPoint(
  evidence: any,
  geography: string
): EvidenceDataPoint {
  return {
    priceMin: Number(evidence.priceMin) || 0,
    priceTypical: Number(evidence.priceTypical) || 0,
    priceMax: Number(evidence.priceMax) || 0,
    unit: evidence.unit || "sqm",
    reliabilityGrade: evidence.reliabilityGrade,
    confidenceScore: evidence.confidenceScore,
    captureDate: evidence.captureDate,
    category: evidence.category,
    geography,
  };
}

function toTrendDataPoint(trend: any): TrendDataPoint {
  return {
    category: trend.category,
    direction: trend.direction,
    percentChange: Number(trend.percentChange) || 0,
    confidence: trend.confidence,
  };
}

async function buildScopedComparisonInputs(
  project: any,
  projectId: number,
  orgId: number
) {
  const outcome = await db.getLatestProjectOutcomeForOrg(projectId, orgId);
  if (!outcome) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No outcome found for project",
    });
  }

  const matrices = await db.getScoreMatricesByProject(projectId);
  const scoreMatrix = matrices[0];
  if (!scoreMatrix) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No score matrix found for project",
    });
  }

  const [
    projectEvidence,
    organizationEvidence,
    publicEvidence,
    trends,
    comparableRows,
  ] = await Promise.all([
    db.listOrganizationEvidenceRecords(orgId, { projectId, limit: 500 }),
    db.listOrganizationEvidenceRecords(orgId, { limit: 1000 }),
    db.listPublicCorpusEvidence({ limit: 1000 }),
    db.getTrendSnapshotsForOrg(orgId, { limit: 10 }),
    db.getComparableScoreMatricesForOrg(orgId, projectId),
  ]);

  const geography = project.ctx04Location || "UAE";
  const evidence = projectEvidence.map((row: any) =>
    toEvidenceDataPoint(row, geography)
  );
  const safeFallbackEvidence = [...organizationEvidence, ...publicEvidence].map(
    (row: any) => toEvidenceDataPoint(row, geography)
  );
  const trendData = trends.map(toTrendDataPoint);
  const comparableOutcomes: ComparableOutcome[] = comparableRows.map(
    ({ scoreMatrix: matrix, project: comparableProject }: any) => ({
      projectId: matrix.projectId,
      compositeScore: Number(matrix.compositeScore) || 0,
      decisionStatus: matrix.decisionStatus,
      typology: comparableProject.ctx01Typology || "Residential",
      tier: comparableProject.mkt01Tier || "Mid",
      geography: comparableProject.ctx04Location || undefined,
    })
  );

  const costPrediction = predictCostRange(evidence, trendData, {
    geography: project.ctx04Location || undefined,
    uaeWideEvidence: safeFallbackEvidence,
  });
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

  const corpus: CorpusMetadata = {
    status:
      costPrediction.confidence === "insufficient" &&
      comparableOutcomes.length === 0
        ? "insufficient_data"
        : "ok",
    corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
    organizationSampleCount: organizationEvidence.length,
    publicSampleCount: publicEvidence.length,
    confidence:
      comparableOutcomes.length === 0
        ? costPrediction.confidence
        : outcomePrediction.confidenceLevel,
    insufficiencyReason:
      costPrediction.confidence === "insufficient" &&
      comparableOutcomes.length === 0
        ? "no_same_organization_comparables"
        : undefined,
  };

  return {
    outcome,
    scoreMatrix,
    costPrediction,
    outcomePrediction,
    corpus,
  };
}

export const learningRouter = router({
  getAccuracyLedger: adminProcedure.query(async () => {
    const rows = await db.getGovernedAccuracySnapshots(1);
    return rows[0] || null;
  }),

  getAccuracyHistory: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(20) })
        .optional()
    )
    .query(({ input }) => db.getGovernedAccuracySnapshots(input?.limit || 20)),

  getPendingLogicProposals: adminProcedure.query(() =>
    db.getGovernedLogicChangeLog("proposed")
  ),

  getPendingBenchmarkSuggestions: adminProcedure.query(() =>
    db.getGovernedBenchmarkSuggestions("pending")
  ),

  getComparison: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      return (await db.getLatestOutcomeComparisonForOrg(
        input.projectId,
        ctx.orgId
      )) || null;
    }),

  submitPostMortem: orgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        actualTotalCost: z.string().optional(),
        actualFitoutCostPerSqm: z.string().optional(),
        procurementActualCosts: z.record(z.string(), z.number()).optional(),
        projectDeliveredOnTime: z.boolean().optional(),
        leadTimesActual: z.record(z.string(), z.number()).optional(),
        reworkOccurred: z.boolean().optional(),
        reworkCostAed: z.string().optional(),
        clientSatisfactionScore: z.number().min(1).max(5).optional(),
        tenderIterations: z.number().optional(),
        rfqResults: z.record(z.string(), z.number()).optional(),
        keyLessonsLearned: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);
      const outcomeId = await db.createProjectOutcomeForOrg(
        {
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
        },
        ctx.orgId
      );
      if (outcomeId === null) {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      let comparison = null;
      let learningSummary = null;
      let corpus: CorpusMetadata = {
        status: "insufficient_data",
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        organizationSampleCount: 0,
        publicSampleCount: 0,
        confidence: "insufficient",
        insufficiencyReason: "no_same_organization_comparables",
      };

      try {
        const inputs = await buildScopedComparisonInputs(
          project,
          input.projectId,
          ctx.orgId
        );
        corpus = inputs.corpus;
        comparison = compareOutcomeToPrediction({
          projectId: input.projectId,
          outcome: inputs.outcome,
          scoreMatrix: inputs.scoreMatrix,
          costPrediction: inputs.costPrediction,
          outcomePrediction: inputs.outcomePrediction,
        });
        const comparisonId = await db.createOutcomeComparisonForOrg(
          input.projectId,
          ctx.orgId,
          comparison
        );
        if (comparisonId === null) {
          await requireProjectForOrg(input.projectId, ctx.orgId);
        }
        learningSummary = summarizeLearningSignals(comparison.learningSignals);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.warn("[PostMortem] Auto-comparison failed (non-fatal):", error);
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.submit_post_mortem",
        entityType: "project",
        entityId: input.projectId,
        details: {
          outcomeId,
          comparisonRun: comparison !== null,
          accuracyGrade: comparison?.overallAccuracyGrade || null,
          evidenceGenerated: 0,
          corpusPolicyVersion: corpus.corpusPolicyVersion,
        },
      });

      return {
        success: true,
        outcomeId,
        comparison,
        learningSummary,
        evidenceGenerated: 0,
        corpus,
      };
    }),

  getPostMortemStatus: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const [outcome, comparison] = await Promise.all([
        db.getLatestProjectOutcomeForOrg(input.projectId, ctx.orgId),
        db.getLatestOutcomeComparisonForOrg(input.projectId, ctx.orgId),
      ]);
      return {
        hasOutcome: outcome !== undefined,
        outcome: outcome || null,
        hasComparison: comparison !== undefined,
        comparison: comparison || null,
        accuracyGrade: comparison?.overallAccuracyGrade || null,
        learningSummary: comparison?.learningSignals
          ? summarizeLearningSignals(comparison.learningSignals as any)
          : null,
      };
    }),

  runComparison: orgHeavyMutationProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);
      const inputs = await buildScopedComparisonInputs(
        project,
        input.projectId,
        ctx.orgId
      );
      const comparison = compareOutcomeToPrediction({
        projectId: input.projectId,
        outcome: inputs.outcome,
        scoreMatrix: inputs.scoreMatrix,
        costPrediction: inputs.costPrediction,
        outcomePrediction: inputs.outcomePrediction,
      });
      const comparisonId = await db.createOutcomeComparisonForOrg(
        input.projectId,
        ctx.orgId,
        comparison
      );
      if (comparisonId === null) {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        success: true,
        comparisonId,
        comparison,
        corpus: inputs.corpus,
      };
    }),
});
