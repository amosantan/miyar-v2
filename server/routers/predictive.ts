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
  insufficientCostRangePrediction,
  predictCostRange,
  predictOutcome,
  projectScenarioCost,
} from "../engines/predictive";
import { matchScoreMatrixToPatterns } from "../engines/learning/pattern-extractor";
import type {
  ComparableOutcome,
  CostRangePrediction,
} from "../engines/predictive";
import { requireProjectForOrg } from "../_core/project-access";
import { ORGANIZATION_CORPUS_POLICY_VERSION } from "../../shared/data-corpus";
import { MATERIAL_RESOLUTION_POLICY_VERSION } from "../../shared/material-calculations";
import { resolveProjectMaterialPriceGeography } from "../engines/material-pricing/material-resolution";

function unavailableGovernedMaterialCostRange(): CostRangePrediction {
  return insufficientCostRangePrediction({
    reason:
      "No governed product/specification population is available for this predictive category",
  });
}

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
      const requestedGeography = resolveProjectMaterialPriceGeography(
        project.materialPriceGeography
      );
      const prediction = unavailableGovernedMaterialCostRange();
      return {
        ...prediction,
        status: "insufficient_data" as const,
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        materialResolutionPolicyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
        requestedGeography,
        organizationSampleCount: 0,
        publicSampleCount: 0,
        insufficiencyReason: "no_governed_material_population" as const,
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

      // EV-03: board catalogue prices are browse-only estimates and cannot
      // override predictive/scoring totals.
      let boardMaintenanceVariance = 0;

      const boards = await db.getMaterialBoardsByProject(input.projectId);
      if (boards && boards.length > 0) {
        // Just use the first/active board for projection
        const activeBoard = boards[0];
        const boardMaterials = await db.getMaterialsByBoard(activeBoard.id);

        let totalVariance = 0;

        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            // Base baseline assumes 5% (0.05). If material OPEX is higher, variance increases.
            const matMaint = parseFloat(
              String(mat.maintenanceFactor || "0.05")
            );
            totalVariance += (matMaint - 0.05) * 100; // Store as relative percentage delta
          }
        }

        if (totalVariance !== 0) {
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
  getUaeCostRanges: orgProcedure.query(async () => {
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
        status: "insufficient_data";
        corpusPolicyVersion: string;
        materialResolutionPolicyVersion: typeof MATERIAL_RESOLUTION_POLICY_VERSION;
        organizationSampleCount: number;
        publicSampleCount: number;
        insufficiencyReason: "no_governed_material_population";
      };
    }> = [];

    for (const category of categories) {
      const prediction = unavailableGovernedMaterialCostRange();
      results.push({
        tier: "All",
        category,
        prediction: {
          ...prediction,
          status: "insufficient_data" as const,
          corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
          materialResolutionPolicyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
          organizationSampleCount: 0,
          publicSampleCount: 0,
          insufficiencyReason: "no_governed_material_population" as const,
        },
      });
    }

    return results;
  }),
});
