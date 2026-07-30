/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requireDesignProject } from "../_core/design-resource-access";
import { orgProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { benchmarkSpaceRatios } from "../engines/design/space-benchmarking";
import { evaluateClaimHealth } from "../engines/ingestion/claim-health";
import {
  buildDldMarketClaimHealthEvaluationInput,
  DLD_INDEXED_SOURCE_IDENTITIES,
} from "../engines/ingestion/market-claim-health";
import { loadProjectClaimHealth } from "../engines/ingestion/project-claim-health-loader";
import { resolveProjectMaterialPriceGeography } from "../engines/material-pricing/material-resolution";
import { getEffectiveClaimIncidentStates } from "../db/claim-health";

export const designMarketContextRouter = router({
  getDesignTrends: orgProcedure
    .input(
      z.object({
        projectId: z.number(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const style = project.des01Style ?? undefined;
      const trends = await db.getPublicDesignTrends({
        styleClassification: style,
        region: "UAE",
        limit: input.limit,
      });
      // If style-specific returned nothing, fall back to all UAE trends
      if (trends.length === 0) {
        return db.getPublicDesignTrends({ region: "UAE", limit: input.limit });
      }
      return trends;
    }),

  getBenchmarkForProject: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const typology = project.ctx01Typology ?? "Residential";
      const location = project.ctx04Location ?? "Secondary";
      const tier = project.mkt01Tier ?? "Upper-mid";
      const bm = await db.getBenchmarkForProject(typology, location, tier);
      if (!bm) return null;
      // Convert sqft → sqm (1 sqft ≈ 0.0929 sqm) and provide AED range
      const SQM_PER_SQFT = 10.7639;
      return {
        id: bm.id,
        typology: bm.typology,
        location: bm.location,
        marketTier: bm.marketTier,
        // Costs in AED/sqm (benchmark stored as AED/sqft)
        costPerSqmLow:
          bm.costPerSqftLow != null
            ? Math.round(Number(bm.costPerSqftLow) * SQM_PER_SQFT)
            : null,
        costPerSqmMid:
          bm.costPerSqftMid != null
            ? Math.round(Number(bm.costPerSqftMid) * SQM_PER_SQFT)
            : null,
        costPerSqmHigh:
          bm.costPerSqftHigh != null
            ? Math.round(Number(bm.costPerSqftHigh) * SQM_PER_SQFT)
            : null,
        avgSellingPrice:
          bm.avgSellingPrice != null ? Number(bm.avgSellingPrice) : null,
        absorptionRate:
          bm.absorptionRate != null ? Number(bm.absorptionRate) : null,
        differentiationIndex:
          bm.differentiationIndex != null
            ? Number(bm.differentiationIndex)
            : null,
        competitiveDensity: bm.competitiveDensity,
        sourceType: bm.sourceType,
        dataYear: bm.dataYear,
      };
    }),

  getDldAreas: orgProcedure.query(async () => {
    return db.getDldAreas();
  }),

  getDldAreaComparison: orgProcedure
    .input(z.object({ areaId: z.number() }))
    .query(async ({ input }) => {
      const [projects, comparison] = await Promise.all([
        db.getDldProjectsByArea(input.areaId),
        db.getDldAreaComparison(input.areaId),
      ]);
      return {
        projects,
        comparison,
        totalProjects: projects.length,
        activeProjects: projects.filter(
          (p: any) => p.projectStatus === "ACTIVE"
        ).length,
        finishedProjects: projects.filter(
          (p: any) => p.projectStatus === "FINISHED"
        ).length,
        totalUnits: projects.reduce(
          (s: number, p: any) => s + (p.noOfUnits ?? 0) + (p.noOfVillas ?? 0),
          0
        ),
      };
    }),

  getAreaBenchmarks: orgProcedure.query(async () => {
    return db.getAllAreaBenchmarks();
  }),

  getAreaBenchmark: orgProcedure
    .input(z.object({ areaId: z.number() }))
    .query(async ({ input }) => {
      return db.getDldAreaBenchmark(input.areaId);
    }),

  getDldDataStats: orgProcedure.query(async () => {
    const [transactionCount, rentCount] = await Promise.all([
      db.getDldTransactionCount(),
      db.getDldRentCount(),
    ]);
    return { transactionCount, rentCount };
  }),

  getProjectDldBenchmark: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      if (!project.dldAreaId) return null;
      const benchmark = await db.getDldAreaBenchmark(project.dldAreaId);
      return benchmark
        ? {
            areaName: project.dldAreaName || benchmark.areaNameEn,
            projectPurpose: project.projectPurpose || "sell_ready",
            saleP50: benchmark.saleP50 ? Number(benchmark.saleP50) : null,
            saleP25: benchmark.saleP25 ? Number(benchmark.saleP25) : null,
            saleP75: benchmark.saleP75 ? Number(benchmark.saleP75) : null,
            saleMean: benchmark.saleMean ? Number(benchmark.saleMean) : null,
            grossYield: benchmark.grossYield
              ? Number(benchmark.grossYield)
              : null,
            fitoutLow: benchmark.recommendedFitoutLow
              ? Number(benchmark.recommendedFitoutLow)
              : null,
            fitoutMid: benchmark.recommendedFitoutMid
              ? Number(benchmark.recommendedFitoutMid)
              : null,
            fitoutHigh: benchmark.recommendedFitoutHigh
              ? Number(benchmark.recommendedFitoutHigh)
              : null,
            transactionCount: benchmark.saleTransactionCount
              ? Number(benchmark.saleTransactionCount)
              : 0,
            rentContractCount: benchmark.rentTransactionCount
              ? Number(benchmark.rentTransactionCount)
              : 0,
          }
        : null;
    }),

  getDataFreshness: orgProcedure.query(async ({ ctx }) => {
      const evaluatedAt = new Date();
      const [counts, incidents] = await Promise.all([
        db.getPublicMarketEvidenceCounts(),
        getEffectiveClaimIncidentStates(
          {
            evaluationClock: evaluatedAt,
            organizationId: ctx.orgId,
            sourceIdentities: Object.values(DLD_INDEXED_SOURCE_IDENTITIES),
          },
          {
            kind: "organization_member",
            organizationId: ctx.orgId,
            userId: ctx.user.id,
            sessionIdentity: "design.getDataFreshness",
          }
        ),
      ]);
      const incidentByIdentity = new Map(
        incidents.map(row => [row.sourceIdentity, row.aggregate])
      );
      const governedDldInput = (
        dataset: keyof typeof DLD_INDEXED_SOURCE_IDENTITIES
      ) => ({
        // EV-05 owns approval of the exact DLD dataset/source governance.
        // Until then the indexed subset remains fail-closed.
        sourceEligibility: "ineligible" as const,
        incident:
          incidentByIdentity.get(DLD_INDEXED_SOURCE_IDENTITIES[dataset]) ??
          ("none" as const),
      });
      return evaluateClaimHealth(
        buildDldMarketClaimHealthEvaluationInput({
          evaluatedAt,
          transactions: {
            count: Number(counts?.transactionCount ?? 0),
            observedThrough: counts?.transactionObservedThrough ?? null,
            ...governedDldInput("transactions"),
          },
          rents: {
            count: Number(counts?.rentContractCount ?? 0),
            observedThrough: counts?.rentObservedThrough ?? null,
            ...governedDldInput("rents"),
          },
          projects: {
            count: Number(counts?.projectCount ?? 0),
            observedThrough: null,
            ...governedDldInput("projects"),
          },
        })
      ).safeProjection;
    }),

  getProjectDataFreshness: orgProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const evaluatedAt = new Date();
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const result = await loadProjectClaimHealth({
        projectId: input.projectId,
        organizationId: ctx.orgId,
        userId: ctx.user.id,
        requestedGeography: resolveProjectMaterialPriceGeography(
          project.materialPriceGeography
        ),
        evaluatedAt,
        consumer: "project_workspace",
      });
      return result.evaluation.safeProjection;
    }),

  getEvidenceChain: orgProcedure
    .input(
      z.object({
        category: z.string().optional(),
        projectId: z.number().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.projectId !== undefined)
        await requireDesignProject(input.projectId, ctx.orgId);
      const results = await db.getEvidenceWithSources({
        orgId: ctx.orgId,
        category: input.category,
        projectId: input.projectId,
        limit: input.limit,
      });
      return { evidence: results };
    }),

  getCompetitorContext: orgProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(6) }))
    .query(async ({ input }) => {
      return db.getActiveSourceRegistry(input.limit);
    }),

  getSpaceBenchmark: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);

      if (!project.floorPlanAnalysis) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Floor plan has not been analyzed yet. Upload a floor plan and run analysis first.",
        });
      }

      const analysis = project.floorPlanAnalysis as any;

      // Get DLD area data for data-backed recommendations
      let areaName = project.dldAreaName || project.ctx04Location || "Dubai";
      let transactionCount = 0;
      let saleP50: number | null = null;

      if (project.dldAreaId) {
        const benchmark = await db.getDldAreaBenchmark(project.dldAreaId);
        if (benchmark) {
          areaName = benchmark.areaNameEn || areaName;
          transactionCount = Number(benchmark.saleTransactionCount) || 0;
          saleP50 = benchmark.saleP50 ? Number(benchmark.saleP50) : null;
        }
      }

      const result = benchmarkSpaceRatios(
        analysis,
        areaName,
        transactionCount,
        saleP50
      );

      return result;
    }),
});
