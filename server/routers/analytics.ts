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
import {
  adminProcedure,
  orgHeavyMutationProcedure,
  orgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import {
  getTrendSnapshotsForOrg,
  getPublicTrendSnapshots,
  getTrendHistoryForOrg,
  getAnomaliesForOrg,
  insertOrganizationTrendSnapshot,
  insertPublicTrendSnapshot,
  getProjectInsightsForOrg,
  getGlobalProjectInsights,
  insertPublicProjectInsight,
  insertProjectInsightForOrg,
  getProjectInsightById,
  updateInsightStatusForOrg,
  getDb,
  listOrganizationEvidenceRecords,
  listPublicCorpusEvidence,
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
import { competitorProjects, competitorEntities } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { requireProjectForOrg } from "../_core/project-access";
import { requireProjectResourceForOrg } from "../_core/resource-access";
import {
  ORGANIZATION_CORPUS_POLICY_VERSION,
  PUBLIC_CORPUS_POLICY_VERSION,
} from "../../shared/data-corpus";

const trendDetectionInput = z.object({
  category: z.string().min(1),
  geography: z.string().min(1),
  windowDays: z.number().int().min(7).max(365).default(30),
  generateNarrative: z.boolean().default(true),
});

async function runTrendAnalysis(
  records: any[],
  input: z.infer<typeof trendDetectionInput>,
  persist: (snapshot: any) => Promise<unknown>
) {
  const metricGroups = new Map<string, DataPoint[]>();
  for (const record of records) {
    const metric = record.itemName || "unknown";
    const value = record.priceMin ? parseFloat(String(record.priceMin)) : null;
    if (value === null || Number.isNaN(value)) continue;
    const date = record.captureDate || record.createdAt;
    if (!date) continue;
    if (!metricGroups.has(metric)) metricGroups.set(metric, []);
    metricGroups.get(metric)!.push({
      date: new Date(date),
      value,
      grade: (record.reliabilityGrade as "A" | "B" | "C") || "C",
      sourceId: record.sourceRegistryId
        ? String(record.sourceRegistryId)
        : "unknown",
      recordId: record.id,
    });
  }

  const results = [];
  for (const [metric, points] of Array.from(metricGroups.entries())) {
    if (points.length < 2) continue;
    const trend = await detectTrends(
      metric,
      input.category,
      input.geography,
      points,
      {
        windowDays: input.windowDays,
        generateNarrative: input.generateNarrative,
      }
    );
    await persist({
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
      percentChange:
        trend.percentChange !== null ? String(trend.percentChange) : null,
      direction: trend.direction,
      anomalyCount: trend.anomalies.length,
      anomalyDetails: trend.anomalies.length > 0 ? trend.anomalies : null,
      confidence: trend.confidence,
      narrative: trend.narrative,
      movingAverages:
        trend.movingAverages.length > 0 ? trend.movingAverages : null,
    });
    results.push(trend);
  }
  return results;
}

function mapTrendSnapshots(trendSnaps: any[]) {
  return trendSnaps.map((snapshot: any) => ({
    metric: snapshot.metric,
    category: snapshot.category,
    direction: snapshot.direction || "stable",
    percentChange: snapshot.percentChange
      ? parseFloat(String(snapshot.percentChange))
      : null,
    confidence: snapshot.confidence || "low",
    currentMA: snapshot.currentMA
      ? parseFloat(String(snapshot.currentMA))
      : null,
    previousMA: snapshot.previousMA
      ? parseFloat(String(snapshot.previousMA))
      : null,
    anomalyCount: snapshot.anomalyCount || 0,
  }));
}

async function loadCompetitorLandscape() {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const rows = await database
    .select({
      id: competitorProjects.id,
      competitorId: competitorProjects.competitorId,
      projectName: competitorProjects.projectName,
      totalUnits: competitorProjects.totalUnits,
      entityName: competitorEntities.name,
    })
    .from(competitorProjects)
    .leftJoin(
      competitorEntities,
      eq(competitorProjects.competitorId, competitorEntities.id)
    );
  if (rows.length === 0) return undefined;
  const projects: CompetitorProject[] = rows.map((row: any) => ({
    developerId: String(row.competitorId),
    developerName: row.entityName || "Unknown",
    projectName: row.projectName,
    totalUnits: row.totalUnits || 0,
    grade: "B" as const,
    sourceId: "db",
  }));
  const landscape = await analyseCompetitorLandscape(projects, {
    generateNarrative: false,
  });
  return {
    totalProjects: landscape.totalProjects,
    totalDevelopers: landscape.totalDevelopers,
    hhi: landscape.hhi,
    concentration: landscape.concentration,
    topDevelopers: landscape.topDevelopers.map(developer => ({
      developerName: developer.developerName,
      marketShareByUnits: developer.marketShareByUnits,
      threatLevel: developer.threatLevel,
    })),
  };
}

export const analyticsRouter = router({
  getTrends: orgProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          geography: z.string().optional(),
          direction: z
            .enum(["rising", "falling", "stable", "insufficient_data"])
            .optional(),
          confidence: z
            .enum(["high", "medium", "low", "insufficient"])
            .optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const snapshots = await getTrendSnapshotsForOrg(ctx.orgId, {
        category: input?.category,
        geography: input?.geography,
        direction: input?.direction,
        confidence: input?.confidence,
        limit: input?.limit,
      });
      return { trends: snapshots };
    }),

  getTrendHistory: orgProcedure
    .input(
      z.object({
        metric: z.string().min(1),
        geography: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const history = await getTrendHistoryForOrg(
        ctx.orgId,
        input.metric,
        input.geography,
        input.limit
      );
      return { history };
    }),

  getAnomalies: orgProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const anomalies = await getAnomaliesForOrg(ctx.orgId, input?.limit);
      return { anomalies };
    }),

  getMarketPosition: orgProcedure
    .input(
      z.object({
        targetValue: z.number().positive(),
        category: z.string().default("floors"),
        geography: z.string().default("UAE"),
      })
    )
    .query(async ({ ctx, input }) => {
      const [organizationRecords, publicRecords] = await Promise.all([
        listOrganizationEvidenceRecords(ctx.orgId, {
          category: input.category,
          limit: 1000,
        }),
        listPublicCorpusEvidence({
          category: input.category,
          limit: 1000,
        }),
      ]);
      const records = [...organizationRecords, ...publicRecords];

      const dataPoints: MarketDataPoint[] = [];
      for (const record of records) {
        const value = record.priceMin
          ? parseFloat(String(record.priceMin))
          : null;
        if (value === null || isNaN(value) || value <= 0) continue;
        dataPoints.push({
          value,
          grade: (record.reliabilityGrade as "A" | "B" | "C") || "C",
          sourceId: record.sourceRegistryId
            ? String(record.sourceRegistryId)
            : "unknown",
          date: new Date(record.captureDate || record.createdAt),
          recordId: record.id,
        });
      }

      const position = computeMarketPosition(input.targetValue, dataPoints);
      return {
        position,
        status:
          position.confidence === "insufficient"
            ? ("insufficient_data" as const)
            : ("ok" as const),
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        organizationSampleCount: organizationRecords.length,
        publicSampleCount: publicRecords.length,
        insufficiencyReason:
          position.confidence === "insufficient"
            ? ("below_minimum_sample" as const)
            : undefined,
      };
    }),

  getCompetitorLandscape: orgProcedure
    .input(
      z
        .object({
          geography: z.string().default("UAE"),
          generateNarrative: z.boolean().default(true),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch competitor projects joined with entities for developer name
      const dbProjects = await db
        .select({
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
        .leftJoin(
          competitorEntities,
          eq(competitorProjects.competitorId, competitorEntities.id)
        );

      const projects: CompetitorProject[] = dbProjects.map((p: any) => {
        // Extract price from priceIndicators JSON if available
        let pricePerSqft: number | undefined;
        if (p.priceIndicators && typeof p.priceIndicators === "object") {
          const pi = p.priceIndicators as any;
          if (pi.per_unit) pricePerSqft = parseFloat(String(pi.per_unit));
          else if (pi.min && pi.max)
            pricePerSqft =
              (parseFloat(String(pi.min)) + parseFloat(String(pi.max))) / 2;
        }

        return {
          developerId: String(p.competitorId),
          developerName: p.entityName || "Unknown",
          projectName: p.projectName,
          totalUnits: p.totalUnits || 0,
          pricePerSqft,
          completionDate: p.launchDate ? new Date(p.launchDate) : undefined,
          location: p.location || undefined,
          grade: (p.completenessScore && p.completenessScore >= 80
            ? "A"
            : p.completenessScore && p.completenessScore >= 50
              ? "B"
              : "C") as "A" | "B" | "C",
          sourceId: p.sourceUrl || "unknown",
        };
      });

      const landscape = await analyseCompetitorLandscape(projects, {
        generateNarrative: input?.generateNarrative ?? true,
      });
      return { landscape };
    }),

  runTrendDetection: orgHeavyMutationProcedure
    .input(trendDetectionInput)
    .mutation(async ({ ctx, input }) => {
      const [organizationRecords, publicRecords] = await Promise.all([
        listOrganizationEvidenceRecords(ctx.orgId, {
          category: input.category,
          limit: 2000,
        }),
        listPublicCorpusEvidence({
          category: input.category,
          limit: 2000,
        }),
      ]);
      const results = await runTrendAnalysis(
        [...organizationRecords, ...publicRecords],
        input,
        snapshot => insertOrganizationTrendSnapshot(ctx.orgId, snapshot)
      );
      return {
        metricsAnalyzed: results.length,
        trends: results,
        status:
          results.length > 0 ? ("ok" as const) : ("insufficient_data" as const),
        corpusPolicyVersion: ORGANIZATION_CORPUS_POLICY_VERSION,
        organizationSampleCount: organizationRecords.length,
        publicSampleCount: publicRecords.length,
        insufficiencyReason:
          results.length === 0 ? ("below_minimum_sample" as const) : undefined,
      };
    }),

  runPublicTrendDetection: adminProcedure
    .input(trendDetectionInput)
    .mutation(async ({ input }) => {
      const publicRecords = await listPublicCorpusEvidence({
        category: input.category,
        limit: 2000,
      });
      const results = await runTrendAnalysis(publicRecords, input, snapshot =>
        insertPublicTrendSnapshot(snapshot)
      );
      return {
        metricsAnalyzed: results.length,
        trends: results,
        status:
          results.length > 0 ? ("ok" as const) : ("insufficient_data" as const),
        corpusPolicyVersion: PUBLIC_CORPUS_POLICY_VERSION,
        organizationSampleCount: 0,
        publicSampleCount: publicRecords.length,
        insufficiencyReason:
          results.length === 0
            ? ("no_governed_public_data" as const)
            : undefined,
      };
    }),

  getProjectInsights: orgProcedure
    .input(
      z
        .object({
          projectId: z.number().optional(),
          insightType: z.string().optional(),
          severity: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.projectId === undefined) {
        const insights = await getGlobalProjectInsights({
          insightType: input?.insightType,
          severity: input?.severity,
          status: input?.status,
          limit: input?.limit,
        });
        return { insights };
      }
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const insights = await getProjectInsightsForOrg(ctx.orgId, {
        projectId: input.projectId,
        insightType: input.insightType,
        severity: input.severity,
        status: input.status,
        limit: input.limit,
      });
      return { insights };
    }),

  generateProjectInsights: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        enrichWithLLM: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);
      const [trendSnaps, competitorLandscape] = await Promise.all([
        getTrendSnapshotsForOrg(ctx.orgId, { limit: 50 }),
        loadCompetitorLandscape(),
      ]);

      const insightInput: InsightInput = {
        trends: mapTrendSnapshots(trendSnaps),
        competitorLandscape,
        projectContext: {
          projectId: input.projectId,
          projectName: project.name || `Project #${input.projectId}`,
        },
      };

      const generated = await generateInsights(insightInput, {
        enrichWithLLM: input.enrichWithLLM,
      });

      for (const insight of generated) {
        if (
          !(await insertProjectInsightForOrg(
            {
              projectId: input.projectId,
              insightType: insight.type as any,
              severity: insight.severity,
              title: insight.title,
              body: insight.body,
              actionableRecommendation: insight.actionableRecommendation,
              confidenceScore: String(insight.confidenceScore),
              triggerCondition: insight.triggerCondition,
              dataPoints: insight.dataPoints,
            },
            ctx.orgId
          ))
        ) {
          await requireProjectForOrg(input.projectId, ctx.orgId);
        }
      }

      return {
        generated: generated.length,
        insights: generated,
      };
    }),

  generateGlobalProjectInsights: adminProcedure
    .input(
      z.object({
        enrichWithLLM: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const [trendSnaps, competitorLandscape] = await Promise.all([
        getPublicTrendSnapshots({ limit: 50 }),
        loadCompetitorLandscape(),
      ]);
      const generated = await generateInsights(
        {
          trends: mapTrendSnapshots(trendSnaps),
          competitorLandscape,
        },
        {
          enrichWithLLM: input.enrichWithLLM,
        }
      );
      for (const insight of generated) {
        await insertPublicProjectInsight({
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
        corpusPolicyVersion: PUBLIC_CORPUS_POLICY_VERSION,
      };
    }),

  updateInsightStatus: orgMutationProcedure
    .input(
      z.object({
        insightId: z.number(),
        status: z.enum(["active", "acknowledged", "dismissed", "resolved"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectResourceForOrg(input.insightId, ctx.orgId, {
        lookupResource: getProjectInsightById,
        getProjectId: insight => insight.projectId!,
      });
      if (
        !(await updateInsightStatusForOrg(
          input.insightId,
          ctx.orgId,
          input.status,
          ctx.user.id
        ))
      ) {
        await requireProjectResourceForOrg(input.insightId, ctx.orgId, {
          lookupResource: getProjectInsightById,
          getProjectId: insight => insight.projectId!,
        });
      }
      return { success: true };
    }),
});
