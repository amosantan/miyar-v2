/**
 * Predictive Intelligence Router (V4-08/09/10)
 * Endpoints for cost range prediction, outcome prediction, and scenario cost projection.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { getPricingArea } from "../engines/area-utils";
import { predictCostRange, predictOutcome, projectScenarioCost } from "../engines/predictive";
import { matchScoreMatrixToPatterns } from "../engines/learning/pattern-extractor";
import { decisionPatterns } from "../../drizzle/schema";
import type { EvidenceDataPoint, TrendDataPoint, ComparableOutcome } from "../engines/predictive";

export const predictiveRouter = router({
  /**
   * V4-08: Get cost range prediction for a project category
   */
  getCostRange: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      category: z.string().optional(),
      geography: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      // Get evidence records for this project and globally
      const projectEvidence = await db.listEvidenceRecords({ projectId: input.projectId, limit: 500 });
      const allEvidence = await db.listEvidenceRecords({ limit: 1000 });

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
      const uaeWideEvidence = allEvidence.map(toDataPoint);

      // Get trend data
      const trends = await db.getTrendSnapshots({ category: input.category, limit: 10 });
      const trendData: TrendDataPoint[] = trends.map((t: any) => ({
        category: t.category,
        direction: t.direction,
        percentChange: Number(t.percentChange) || 0,
        confidence: t.confidence,
      }));

      return predictCostRange(evidence, trendData, {
        category: input.category,
        geography: input.geography || project.ctx04Location || undefined,
        uaeWideEvidence,
      });
    }),

  /**
   * V4-09: Get outcome prediction for a project
   */
  getOutcomePrediction: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      // Get latest score matrix for this project
      const matrices = await db.getScoreMatricesByProject(input.projectId);
      const latest = matrices[0]; // already ordered by computedAt desc
      if (!latest) {
        return predictOutcome(0, [], {}, {
          typology: project.ctx01Typology || "Residential",
          tier: project.mkt01Tier || "Mid",
        });
      }

      const compositeScore = Number(latest.compositeScore) || 0;
      const variableContributions = (latest.variableContributions as Record<string, any>) || {};

      // Get comparable outcomes from other projects
      const allScores = await db.getAllScoreMatrices();
      const outcomes: ComparableOutcome[] = [];
      for (const sm of allScores) {
        if (sm.projectId === input.projectId) continue;
        const proj = await db.getProjectById(sm.projectId);
        if (!proj) continue;
        outcomes.push({
          projectId: sm.projectId,
          compositeScore: Number(sm.compositeScore) || 0,
          decisionStatus: sm.decisionStatus as any,
          typology: proj.ctx01Typology || "Residential",
          tier: proj.mkt01Tier || "Mid",
          geography: proj.ctx04Location || undefined,
        });
      }

      return predictOutcome(compositeScore, outcomes, variableContributions, {
        typology: project.ctx01Typology || "Residential",
        tier: project.mkt01Tier || "Mid",
        geography: project.ctx04Location || undefined,
      });
    }),

  /**
   * V5-08: Get matched learning patterns for a project
   */
  getProjectPatterns: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const matrices = await db.getScoreMatricesByProject(input.projectId);
      const latest = matrices[0];
      if (!latest) return [];

      const ormDb = await db.getDb();
      const activePatterns = await ormDb.select().from(decisionPatterns);

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
  getScenarioProjection: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      horizonMonths: z.number().default(18),
      marketCondition: z.enum(["tight", "balanced", "soft"]).default("balanced"),
    }))
    .query(async ({ input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const gfa = getPricingArea(project);
      // Derive budget per sqm from budget cap / pricing area
      const budgetCap = Number(project.fin01BudgetCap) || 0;
      const budgetPerSqm = gfa > 0 ? budgetCap / gfa : 0;

      // Get trend data for cost projection
      const trends = await db.getTrendSnapshots({ limit: 10 });
      let trendPercentChange = 0;
      let trendDirection: "rising" | "falling" | "stable" | "insufficient_data" = "insufficient_data";

      if (trends.length > 0) {
        // Use the most recent trend with sufficient confidence
        const bestTrend = trends.find((t: any) => t.confidence !== "insufficient") || trends[0];
        trendPercentChange = Number((bestTrend as any).percentChange) || 0;
        trendDirection = (bestTrend as any).direction || "insufficient_data";
      }

      return projectScenarioCost({
        baseCostPerSqm: budgetPerSqm,
        gfa,
        trendPercentChange,
        trendDirection,
        marketCondition: input.marketCondition,
        horizonMonths: input.horizonMonths,
      });
    }),

  /**
   * V4-13: Get UAE-wide cost ranges by market tier for analytics dashboard
   */
  getUaeCostRanges: protectedProcedure
    .query(async () => {
      const allEvidence = await db.listEvidenceRecords({ limit: 2000 });
      const trends = await db.getTrendSnapshots({ limit: 50 });

      const tiers = ["Economy", "Mid", "Upper-mid", "Premium", "Luxury", "Ultra-luxury"];
      const categories = ["floors", "walls", "ceilings", "joinery", "lighting", "sanitary", "kitchen", "hardware", "ffe"];

      const results: Array<{
        tier: string;
        category: string;
        prediction: ReturnType<typeof predictCostRange>;
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
        results.push({ tier: "All", category, prediction });
      }

      return results;
    }),
});
