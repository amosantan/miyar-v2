/**
 * MIYAR V3-05 — Analytics tRPC Router
 *
 * Endpoints:
 *   - analytics.getTrends: query current trend snapshots with filters
 *   - analytics.getTrendHistory: query historical trend snapshots for a metric
 *   - analytics.getAnomalies: query trend snapshots with anomalies
 *   - analytics.runTrendDetection: manually trigger trend detection for a metric
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getTrendSnapshots,
  getTrendHistory,
  getAnomalies,
  insertTrendSnapshot,
  getProjectInsights,
  insertProjectInsight,
  updateInsightStatus,
  getDb,
} from "../db";
import {
  detectTrends,
  type DataPoint,
} from "../engines/analytics/trend-detection";
import {
  computeMarketPosition,
  type MarketDataPoint,
} from "../engines/analytics/market-positioning";
import {
  analyseCompetitorLandscape,
  type CompetitorProject,
} from "../engines/analytics/competitor-intelligence";
import {
  generateInsights,
  type InsightInput,
} from "../engines/analytics/insight-generator";
import { evidenceRecords, competitorProjects, competitorEntities } from "../../drizzle/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";

export const analyticsRouter = router({
  getTrends: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        geography: z.string().optional(),
        direction: z.enum(["rising", "falling", "stable", "insufficient_data"]).optional(),
        confidence: z.enum(["high", "medium", "low", "insufficient"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const snapshots = await getTrendSnapshots({
        category: input?.category,
        geography: input?.geography,
        direction: input?.direction,
        confidence: input?.confidence,
        limit: input?.limit,
      });
      return { trends: snapshots };
    }),

  getTrendHistory: protectedProcedure
    .input(
      z.object({
        metric: z.string().min(1),
        geography: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const history = await getTrendHistory(input.metric, input.geography, input.limit);
      return { history };
    }),

  getAnomalies: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const anomalies = await getAnomalies(input?.limit);
      return { anomalies };
    }),

  getMarketPosition: protectedProcedure
    .input(
      z.object({
        targetValue: z.number().positive(),
        category: z.string().default("floors"),
        geography: z.string().default("UAE"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch evidence records for the category
      const records = await db
        .select()
        .from(evidenceRecords)
        .where(
          and(
            eq(evidenceRecords.category, input.category as any),
            isNotNull(evidenceRecords.priceMin)
          )
        );

      const dataPoints: MarketDataPoint[] = [];
      for (const record of records) {
        const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
        if (value === null || isNaN(value) || value <= 0) continue;
        dataPoints.push({
          value,
          grade: (record.reliabilityGrade as "A" | "B" | "C") || "C",
          sourceId: record.sourceRegistryId ? String(record.sourceRegistryId) : "unknown",
          date: new Date(record.captureDate || record.createdAt),
          recordId: record.id,
        });
      }

      const position = computeMarketPosition(input.targetValue, dataPoints);
      return { position };
    }),

  getCompetitorLandscape: protectedProcedure
    .input(
      z.object({
        geography: z.string().default("UAE"),
        generateNarrative: z.boolean().default(true),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch competitor projects joined with entities for developer name
      const dbProjects = await db.select({
        id: competitorProjects.id,
        competitorId: competitorProjects.competitorId,
        projectName: competitorProjects.projectName,
        location: competitorProjects.location,
        totalUnits: competitorProjects.totalUnits,
        priceIndicators: competitorProjects.priceIndicators,
        launchDate: competitorProjects.launchDate,
        sourceUrl: competitorProjects.sourceUrl,
        completenessScore: competitorProjects.completenessScore,
        entityName: competitorEntities.name,
      })
        .from(competitorProjects)
        .leftJoin(competitorEntities, eq(competitorProjects.competitorId, competitorEntities.id));

      const projects: CompetitorProject[] = dbProjects.map((p: any) => {
        // Extract price from priceIndicators JSON if available
        let pricePerSqft: number | undefined;
        if (p.priceIndicators && typeof p.priceIndicators === "object") {
          const pi = p.priceIndicators as any;
          if (pi.per_unit) pricePerSqft = parseFloat(String(pi.per_unit));
          else if (pi.min && pi.max) pricePerSqft = (parseFloat(String(pi.min)) + parseFloat(String(pi.max))) / 2;
        }

        return {
          developerId: String(p.competitorId),
          developerName: p.entityName || "Unknown",
          projectName: p.projectName,
          totalUnits: p.totalUnits || 0,
          pricePerSqft,
          completionDate: p.launchDate ? new Date(p.launchDate) : undefined,
          location: p.location || undefined,
          grade: (p.completenessScore && p.completenessScore >= 80 ? "A" : p.completenessScore && p.completenessScore >= 50 ? "B" : "C") as "A" | "B" | "C",
          sourceId: p.sourceUrl || "unknown",
        };
      });

      const landscape = await analyseCompetitorLandscape(projects, {
        generateNarrative: input?.generateNarrative ?? true,
      });
      return { landscape };
    }),

  runTrendDetection: protectedProcedure
    .input(
      z.object({
        category: z.string().min(1),
        geography: z.string().min(1),
        windowDays: z.number().int().min(7).max(365).default(30),
        generateNarrative: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch evidence records for this category/geography
      const records = await db
        .select()
        .from(evidenceRecords)
        .where(
          and(
            eq(evidenceRecords.category, input.category as any),
            isNotNull(evidenceRecords.priceMin)
          )
        );

      // Group by metric (itemName) and build data points
      const metricGroups = new Map<string, DataPoint[]>();

      for (const record of records) {
        const metric = record.itemName || "unknown";
        const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
        if (value === null || isNaN(value)) continue;

        const date = record.captureDate || record.createdAt;
        if (!date) continue;

        const grade = (record.reliabilityGrade as "A" | "B" | "C") || "C";
        const sourceId = record.sourceRegistryId ? String(record.sourceRegistryId) : "unknown";

        if (!metricGroups.has(metric)) {
          metricGroups.set(metric, []);
        }
        metricGroups.get(metric)!.push({
          date: new Date(date),
          value,
          grade,
          sourceId,
          recordId: record.id,
        });
      }

      // Run trend detection for each metric group
      const results = [];
      for (const [metric, points] of Array.from(metricGroups.entries())) {
        if (points.length < 2) continue;

        const trend = await detectTrends(metric, input.category, input.geography, points, {
          windowDays: input.windowDays,
          generateNarrative: input.generateNarrative,
        });

        // Save snapshot
        await insertTrendSnapshot({
          metric: trend.metric,
          category: trend.category,
          geography: trend.geography,
          dataPointCount: trend.dataPointCount,
          gradeACount: trend.gradeACount,
          gradeBCount: trend.gradeBCount,
          gradeCCount: trend.gradeCCount,
          uniqueSources: trend.uniqueSources,
          dateRangeStart: trend.dateRange?.start || null,
          dateRangeEnd: trend.dateRange?.end || null,
          currentMA: trend.currentMA !== null ? String(trend.currentMA) : null,
          previousMA: trend.previousMA !== null ? String(trend.previousMA) : null,
          percentChange: trend.percentChange !== null ? String(trend.percentChange) : null,
          direction: trend.direction,
          anomalyCount: trend.anomalies.length,
          anomalyDetails: trend.anomalies.length > 0 ? trend.anomalies : null,
          confidence: trend.confidence,
          narrative: trend.narrative,
          movingAverages: trend.movingAverages.length > 0 ? trend.movingAverages : null,
        });

        results.push(trend);
      }

      return {
        metricsAnalyzed: results.length,
        trends: results,
      };
    }),

  getProjectInsights: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
        insightType: z.string().optional(),
        severity: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const insights = await getProjectInsights({
        projectId: input?.projectId,
        insightType: input?.insightType,
        severity: input?.severity,
        status: input?.status,
        limit: input?.limit,
      });
      return { insights };
    }),

  generateProjectInsights: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
        enrichWithLLM: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Gather trend data
      const trendSnaps = await getTrendSnapshots({ limit: 50 });
      const trends = trendSnaps.map((s: any) => ({
        metric: s.metric,
        category: s.category,
        direction: s.direction || "stable",
        percentChange: s.percentChange ? parseFloat(String(s.percentChange)) : null,
        confidence: s.confidence || "low",
        currentMA: s.currentMA ? parseFloat(String(s.currentMA)) : null,
        previousMA: s.previousMA ? parseFloat(String(s.previousMA)) : null,
        anomalyCount: s.anomalyCount || 0,
      }));

      // Gather competitor data
      const dbProjects = await db.select({
        id: competitorProjects.id,
        competitorId: competitorProjects.competitorId,
        projectName: competitorProjects.projectName,
        totalUnits: competitorProjects.totalUnits,
        entityName: competitorEntities.name,
      })
        .from(competitorProjects)
        .leftJoin(competitorEntities, eq(competitorProjects.competitorId, competitorEntities.id));

      let competitorLandscape;
      if (dbProjects.length > 0) {
        const compProjects: CompetitorProject[] = dbProjects.map((p: any) => ({
          developerId: String(p.competitorId),
          developerName: p.entityName || "Unknown",
          projectName: p.projectName,
          totalUnits: p.totalUnits || 0,
          grade: "B" as const,
          sourceId: "db",
        }));
        const landscape = await analyseCompetitorLandscape(compProjects, { generateNarrative: false });
        competitorLandscape = {
          totalProjects: landscape.totalProjects,
          totalDevelopers: landscape.totalDevelopers,
          hhi: landscape.hhi,
          concentration: landscape.concentration,
          topDevelopers: landscape.topDevelopers.map((d) => ({
            developerName: d.developerName,
            marketShareByUnits: d.marketShareByUnits,
            threatLevel: d.threatLevel,
          })),
        };
      }

      const insightInput: InsightInput = {
        trends,
        competitorLandscape,
        projectContext: input.projectId ? {
          projectId: input.projectId,
          projectName: `Project #${input.projectId}`,
        } : undefined,
      };

      const generated = await generateInsights(insightInput, {
        enrichWithLLM: input.enrichWithLLM,
      });

      // Persist insights
      for (const insight of generated) {
        await insertProjectInsight({
          projectId: input.projectId || null,
          insightType: insight.type as any,
          severity: insight.severity,
          title: insight.title,
          body: insight.body,
          actionableRecommendation: insight.actionableRecommendation,
          confidenceScore: String(insight.confidenceScore),
          triggerCondition: insight.triggerCondition,
          dataPoints: insight.dataPoints,
        });
      }

      return {
        generated: generated.length,
        insights: generated,
      };
    }),

  updateInsightStatus: protectedProcedure
    .input(
      z.object({
        insightId: z.number(),
        status: z.enum(["active", "acknowledged", "dismissed", "resolved"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateInsightStatus(input.insightId, input.status, ctx.user?.id);
      return { success: true };
    }),
});
