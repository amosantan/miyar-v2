/**
 * Predictive Intelligence Router (V4-08/09/10)
 * Endpoints for cost range prediction, outcome prediction, and scenario cost projection.
 */
import { z } from "zod";
import { orgProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { getPricingArea } from "../engines/area-utils";
import {
  predictCostRange,
  predictOutcome,
  projectScenarioCost,
} from "../engines/predictive";
import { matchScoreMatrixToPatterns } from "../engines/learning/pattern-extractor";
import type {
  EvidenceDataPoint,
  TrendDataPoint,
  ComparableOutcome,
} from "../engines/predictive";
import { requireProjectForOrg } from "../_core/project-access";
import { ORGANIZATION_CORPUS_POLICY_VERSION } from "../../shared/data-corpus";

export const predictiveRouter = router({
  /**
   * V4-08: Get cost range prediction for a project category
   */
  getCostRange: orgProcedure
    .input(
      z.object({
        projectId: z.number(),
        category: z.string().optional(),
        geography: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const [projectEvidence, organizationEvidence, publicEvidence, trends] =
        await Promise.all([
          db.listOrganizationEvidenceRecords(ctx.orgId, {
            projectId: input.projectId,
            category: input.category,
            limit: 500,
          }),
          db.listOrganizationEvidenceRecords(ctx.orgId, {
            category: input.category,
            limit: 1000,
          }),
          db.listPublicCorpusEvidence({
            category: input.category,
            limit: 1000,
          }),
          db.getTrendSnapshotsForOrg(ctx.orgId, {
            category: input.category,
            limit: 10,
          }),
        ]);

      // Transform to EvidenceDataPoint format
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
      const uaeWideEvidence = [...organizationEvidence, ...publicEvidence].map(
        toDataPoint
      );
      const trendData: TrendDataPoint[] = trends.map((t: any) => ({
        category: t.category,
        direction: t.direction,
        percentChange: Number(t.percentChange) || 0,
        confidence: t.confidence,
      }));

      const prediction = predictCostRange(evidence, trendData, {
        category: input.category,
        geography: input.geography || project.ctx04Location || undefined,
        uaeWideEvidence,
      });
      return {
        ...prediction,
        status:
          prediction.confidence === "insufficient"
            ? ("insufficient_data" as const)
            : ("ok" as const),
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        organizationSampleCount: organizationEvidence.length,
        publicSampleCount: publicEvidence.length,
        insufficiencyReason:
          prediction.confidence === "insufficient"
            ? ("below_minimum_sample" as const)
            : undefined,
      };
    }),

  /**
   * V4-09: Get outcome prediction for a project
   */
  getOutcomePrediction: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      // Get latest score matrix for this project
      const matrices = await db.getScoreMatricesByProject(input.projectId);
      const latest = matrices[0]; // already ordered by computedAt desc
      if (!latest) {
        const prediction = predictOutcome(
          0,
          [],
          {},
          {
            typology: project.ctx01Typology || "Residential",
            tier: project.mkt01Tier || "Mid",
          }
        );
        return {
          ...prediction,
          status: "insufficient_data" as const,
          corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
          organizationSampleCount: 0,
          publicSampleCount: 0,
          insufficiencyReason: "no_same_organization_comparables" as const,
        };
      }

      const compositeScore = Number(latest.compositeScore) || 0;
      const variableContributions =
        (latest.variableContributions as Record<string, any>) || {};

      // Get comparable outcomes from other projects
      const comparableRows = await db.getComparableScoreMatricesForOrg(
        ctx.orgId,
        input.projectId
      );
      const outcomes: ComparableOutcome[] = comparableRows.map(
        ({ scoreMatrix, project: comparableProject }: any) => ({
          projectId: scoreMatrix.projectId,
          compositeScore: Number(scoreMatrix.compositeScore) || 0,
          decisionStatus: scoreMatrix.decisionStatus,
          typology: comparableProject.ctx01Typology || "Residential",
          tier: comparableProject.mkt01Tier || "Mid",
          geography: comparableProject.ctx04Location || undefined,
          targetYield: comparableProject.targetYield || undefined,
          salesStrategy: comparableProject.salesStrategy || undefined,
        })
      );

      const prediction = predictOutcome(
        compositeScore,
        outcomes,
        variableContributions,
        {
          typology: project.ctx01Typology || "Residential",
          tier: project.mkt01Tier || "Mid",
          geography: project.ctx04Location || undefined,
          targetYield: project.targetYield || undefined,
          salesStrategy: project.salesStrategy || undefined,
        }
      );
      return {
        ...prediction,
        status:
          prediction.confidenceLevel === "insufficient"
            ? ("insufficient_data" as const)
            : ("ok" as const),
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        organizationSampleCount: outcomes.length,
        publicSampleCount: 0,
        insufficiencyReason:
          outcomes.length === 0
            ? ("no_same_organization_comparables" as const)
            : undefined,
      };
    }),

  /**
   * V5-08: Get matched learning patterns for a project
   */
  getProjectPatterns: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const matrices = await db.getScoreMatricesByProject(input.projectId);
      const latest = matrices[0];
      if (!latest) return [];

      const activePatterns = await db.getPublicDecisionPatterns();

      const scores = {
        SA: Number(latest.saScore) || 0,
        FF: Number(latest.ffScore) || 0,
        MP: Number(latest.mpScore) || 0,
        DS: Number(latest.dsScore) || 0,
        ER: Number(latest.erScore) || 0,
      };

      return matchScoreMatrixToPatterns(scores, activePatterns);
    }),

  /**
   * V4-10: Get scenario cost projection
   */
  getScenarioProjection: orgProcedure
    .input(
      z.object({
        projectId: z.number(),
        horizonMonths: z.number().default(18),
        marketCondition: z
          .enum(["tight", "balanced", "soft"])
          .default("balanced"),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const gfa = getPricingArea(project);
      // Derive budget per sqm from budget cap / pricing area
      const budgetCap = Number(project.fin01BudgetCap) || 0;
      const budgetPerSqm = gfa > 0 ? budgetCap / gfa : 0;

      // Get trend data for cost projection
      const trends = await db.getTrendSnapshotsForOrg(ctx.orgId, { limit: 10 });
      let trendPercentChange = 0;
      let trendDirection:
        | "rising"
        | "falling"
        | "stable"
        | "insufficient_data" = "insufficient_data";

      if (trends.length > 0) {
        // Use the most recent trend with sufficient confidence
        const bestTrend =
          trends.find((t: any) => t.confidence !== "insufficient") || trends[0];
        trendPercentChange = Number((bestTrend as any).percentChange) || 0;
        trendDirection = (bestTrend as any).direction || "insufficient_data";
      }

      // Phase 8: Vendor Bottom-Up Override check
      let boardMaterialsCost: number | undefined;
      let boardMaintenanceVariance = 0;

      const boards = await db.getMaterialBoardsByProject(input.projectId);
      if (boards && boards.length > 0) {
        // Just use the first/active board for projection
        const activeBoard = boards[0];
        const boardMaterials = await db.getMaterialsByBoard(activeBoard.id);

        let totalLow = 0;
        let totalHigh = 0;
        let totalVariance = 0;

        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            const qty = Number(bm.quantity) || 1; // Needs strict BOQ quantity to be perfectly accurate
            totalLow += (Number(mat.typicalCostLow) || 0) * qty;
            totalHigh += (Number(mat.typicalCostHigh) || 0) * qty;

            // Base baseline assumes 5% (0.05). If material OPEX is higher, variance increases.
            const matMaint = parseFloat(
              String(mat.maintenanceFactor || "0.05")
            );
            totalVariance += (matMaint - 0.05) * 100; // Store as relative percentage delta
          }
        }

        if (totalHigh > 0) {
          boardMaterialsCost = (totalLow + totalHigh) / 2; // Pass the average cost to baseline
          boardMaintenanceVariance = totalVariance;
        }
      }

      const projection = projectScenarioCost({
        baseCostPerSqm: budgetPerSqm,
        gfa,
        trendPercentChange,
        trendDirection,
        marketCondition: input.marketCondition,
        horizonMonths: input.horizonMonths,
        salesStrategy: project.salesStrategy,
        targetYield: project.targetYield,
        handoverCondition: project.handoverCondition,
        brandedStatus: project.brandedStatus,
        salesChannel: project.salesChannel,
        lifecycleFocus: project.lifecycleFocus,
        brandStandardConstraints: project.brandStandardConstraints,
        timelineFlexibility: project.timelineFlexibility,
        targetValueAdd: project.targetValueAdd,
        boardMaterialsCost,
        boardMaintenanceVariance,
      });
      const organizationSampleCount = trends.filter(
        (trend: any) => trend.corpusScope === "organization"
      ).length;
      const publicSampleCount = trends.filter(
        (trend: any) => trend.corpusScope === "platform_public"
      ).length;
      return {
        ...projection,
        status:
          trends.length > 0 ? ("ok" as const) : ("insufficient_data" as const),
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        organizationSampleCount,
        publicSampleCount,
        insufficiencyReason:
          trends.length === 0 ? ("no_governed_trend_data" as const) : undefined,
      };
    }),

  /**
   * V4-13: Get UAE-wide cost ranges by market tier for analytics dashboard
   */
  getUaeCostRanges: orgProcedure.query(async ({ ctx }) => {
    const [organizationEvidence, publicEvidence, trends] = await Promise.all([
      db.listOrganizationEvidenceRecords(ctx.orgId, { limit: 2000 }),
      db.listPublicCorpusEvidence({ limit: 2000 }),
      db.getTrendSnapshotsForOrg(ctx.orgId, { limit: 50 }),
    ]);
    const allEvidence = [...organizationEvidence, ...publicEvidence];

    const tiers = [
      "Economy",
      "Mid",
      "Upper-mid",
      "Premium",
      "Luxury",
      "Ultra-luxury",
    ];
    const categories = [
      "floors",
      "walls",
      "ceilings",
      "joinery",
      "lighting",
      "sanitary",
      "kitchen",
      "hardware",
      "ffe",
    ];

    const results: Array<{
      tier: string;
      category: string;
      prediction: ReturnType<typeof predictCostRange> & {
        status: "ok" | "insufficient_data";
        corpusPolicyVersion: string;
        organizationSampleCount: number;
        publicSampleCount: number;
        insufficiencyReason?: "below_minimum_sample";
      };
    }> = [];

    for (const category of categories) {
      const catEvidence: EvidenceDataPoint[] = allEvidence
        .filter((e: any) => e.category === category)
        .map((e: any) => ({
          priceMin: Number(e.priceMin) || 0,
          priceTypical: Number(e.priceTypical) || 0,
          priceMax: Number(e.priceMax) || 0,
          unit: e.unit || "sqm",
          reliabilityGrade: e.reliabilityGrade,
          confidenceScore: e.confidenceScore,
          captureDate: e.captureDate,
          category: e.category,
          geography: "UAE",
        }));

      const catTrends: TrendDataPoint[] = trends
        .filter((t: any) => t.category === category)
        .map((t: any) => ({
          category: t.category,
          direction: t.direction,
          percentChange: Number(t.percentChange) || 0,
          confidence: t.confidence,
        }));

      const prediction = predictCostRange(catEvidence, catTrends, { category });
      results.push({
        tier: "All",
        category,
        prediction: {
          ...prediction,
          status:
            prediction.confidence === "insufficient"
              ? ("insufficient_data" as const)
              : ("ok" as const),
          corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
          organizationSampleCount: organizationEvidence.filter(
            (e: any) => e.category === category
          ).length,
          publicSampleCount: publicEvidence.filter(
            (e: any) => e.category === category
          ).length,
          insufficiencyReason:
            prediction.confidence === "insufficient"
              ? ("below_minimum_sample" as const)
              : undefined,
        },
      });
    }

    return results;
  }),
});
