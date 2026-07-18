/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  requireDesignProject,
  requireScopedDesignMutation,
} from "../_core/design-resource-access";
import { requireActivePublicShare } from "../_core/public-share-access";
import {
  designOrgAdminProcedure,
  publicRateLimitedProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { getPricingArea } from "../engines/area-utils";
import { benchmarkSpaceRatios } from "../engines/design/space-benchmarking";
import { reportCopy } from "../engines/report-catalog";

import { bestEffortAudit } from "./design-router-shared";

function isDuplicateKeyError(error: unknown): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as {
      code?: string;
      errno?: number;
      cause?: unknown;
    };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export const designSharingRouter = router({
  createShareLink: designOrgAdminProcedure
    .input(
      z.object({
        projectId: z.number(),
        expiryDays: z.number().min(1).max(90).default(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const brief = await db.getLatestAiDesignBrief(input.projectId, ctx.orgId);
      if (!brief)
        throw new Error("Generate a design brief first before sharing");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiryDays);
      let token = "";
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        token = nanoid(32);
        try {
          requireScopedDesignMutation(
            await db.updateAiDesignBriefShareTokenForOrg(
              brief.id,
              input.projectId,
              ctx.orgId,
              token,
              expiresAt
            )
          );
          break;
        } catch (error) {
          if (isDuplicateKeyError(error)) {
            if (attempt === 5) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Unable to create a unique share link",
              });
            }
            continue;
          }
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to create share link",
          });
        }
      }
      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "brief.share",
        entityType: "ai_design_brief",
        entityId: brief.id,
        details: { projectId: input.projectId, expiryDays: input.expiryDays },
      });
      return {
        token,
        shareUrl: `/share/${token}`,
        expiresAt: expiresAt.toISOString(),
        expiryDays: input.expiryDays,
      };
    }),

  revokeShareLinks: designOrgAdminProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const result = await db.revokeAiDesignBriefSharesForProjectForOrg(
        input.projectId,
        ctx.orgId
      );
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }
      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "brief.share.revoke_all",
        entityType: "project",
        entityId: input.projectId,
        details: {
          projectId: input.projectId,
          revokedCount: result.revokedCount,
        },
      });
      return { revokedCount: result.revokedCount, active: false as const };
    }),

  resolveShareLink: publicRateLimitedProcedure
    .input(
      z.object({
        token: z.string(),
        locale: z.enum(["en", "ar"]).default("en"),
      })
    )
    .query(async ({ input }) => {
      if (input.token.length < 8 || input.token.length > 64) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found or expired",
        });
      }
      const { brief, project } = await requireActivePublicShare(input.token);
      const [recs, benchmark, trends] = await Promise.all([
        db.getSpaceRecommendations(brief.projectId, brief.orgId),
        db.getBenchmarkForProject(
          project.ctx01Typology ?? "Residential",
          project.ctx04Location ?? "Secondary",
          project.mkt01Tier ?? "Upper-mid"
        ),
        db.getPublicDesignTrends({
          styleClassification: project.des01Style ?? undefined,
          region: "UAE",
          limit: 8,
        }),
      ]);

      // Phase 9: Compute space benchmark data for public share view
      let spaceEfficiency: any = undefined;
      if (project.floorPlanAnalysis) {
        try {
          const fpData =
            typeof project.floorPlanAnalysis === "string"
              ? JSON.parse(project.floorPlanAnalysis)
              : project.floorPlanAnalysis;
          if (fpData?.rooms?.length > 0 && project.dldAreaId) {
            const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
            const transactionCount = Number(dldBench?.saleTransactionCount);
            const medianSalePrice = Number(dldBench?.saleP50);
            if (
              dldBench &&
              Number.isSafeInteger(transactionCount) &&
              transactionCount > 0 &&
              Number.isFinite(medianSalePrice) &&
              medianSalePrice > 0
            ) {
              const spaceResult = benchmarkSpaceRatios(
                fpData,
                dldBench.areaNameEn || "Dubai",
                transactionCount,
                medianSalePrice
              );
              spaceEfficiency = {
                efficiencyScore: spaceResult.overallEfficiencyScore,
                criticalCount: spaceResult.totalCritical,
                advisoryCount: spaceResult.totalAdvisory,
                circulationPct: spaceResult.circulationWastePercent ?? 0,
                recommendations: (spaceResult.recommendations ?? []).slice(
                  0,
                  6
                ),
                guidanceBasis: {
                  kind: "miyar_ratio_guideline" as const,
                },
                marketContext: {
                  kind: "official_dld_observation" as const,
                  sourceName: "Dubai Land Department",
                  areaName: dldBench.areaNameEn || "Dubai",
                  period: dldBench.period,
                  transactionCount,
                },
              };
            }
          }
        } catch {
          /* skip if parsing fails */
        }
      }

      const totalFitoutBudget = (recs ?? []).reduce(
        (s: number, r: any) => s + Number(r.budgetAllocation || 0),
        0
      );
      const gfa = getPricingArea(project);
      const TIER_PREMIUM_PCT: Record<string, number> = {
        Entry: 0,
        Mid: 3,
        "Upper-mid": 8,
        Luxury: 18,
        "Ultra-luxury": 30,
      };
      const salePremiumPct =
        TIER_PREMIUM_PCT[project.mkt01Tier ?? "Upper-mid"] ?? 8;
      const SQF = 10.7639;
      return {
        locale: input.locale,
        readOnly: true as const,
        briefVersion: brief.version,
        disclaimer: reportCopy(input.locale, "disclaimer"),
        assumptions: [
          reportCopy(input.locale, "investorFallbackAssumptionHelp"),
        ],
        evidence: benchmark
          ? [
              {
                label: reportCopy(input.locale, "benchmarkVersion"),
                value: `${benchmark.typology} / ${benchmark.location} / ${benchmark.marketTier}${benchmark.dataYear ? ` / ${benchmark.dataYear}` : ""}`,
              },
            ]
          : [],
        projectName: project.name ?? "Untitled Project",
        typology: project.ctx01Typology ?? "Residential",
        location: project.ctx04Location ?? "UAE",
        tier: project.mkt01Tier ?? "Upper-mid",
        style: project.des01Style ?? "Modern",
        gfaSqm: gfa,
        execSummary: ((brief.briefData as any)?.executiveSummary ??
          "") as string,
        designDirection: ((brief.briefData as any)?.designDirection ??
          {}) as Record<string, any>,
        spaces: (recs ?? []).map((r: any) => ({
          name: r.roomName,
          budgetAed: Number(r.budgetAllocation || 0),
          sqm: Number(r.sqm || 0),
          pct:
            totalFitoutBudget > 0
              ? (Number(r.budgetAllocation || 0) / totalFitoutBudget) * 100
              : 0,
        })),
        totalFitoutBudget,
        costPerSqm:
          gfa > 0 && totalFitoutBudget > 0
            ? Math.round(totalFitoutBudget / gfa)
            : 0,
        salePremiumPct,
        estimatedSalesPremiumAed:
          gfa > 0 ? Math.round((gfa * 25000 * salePremiumPct) / 100) : 0,
        financialBasis: {
          fitout: "project_estimate" as const,
          salesPremium: "tier_assumption" as const,
          policyVersion: "share-tier-premium-v1",
          assumedSalePriceAedPerSqm: 25000,
        },
        benchmark: benchmark
          ? {
              costPerSqmLow:
                benchmark.costPerSqftLow != null
                  ? Math.round(Number(benchmark.costPerSqftLow) * SQF)
                  : null,
              costPerSqmMid:
                benchmark.costPerSqftMid != null
                  ? Math.round(Number(benchmark.costPerSqftMid) * SQF)
                  : null,
              costPerSqmHigh:
                benchmark.costPerSqftHigh != null
                  ? Math.round(Number(benchmark.costPerSqftHigh) * SQF)
                  : null,
              typology: benchmark.typology,
              location: benchmark.location,
              marketTier: benchmark.marketTier,
              dataYear: benchmark.dataYear,
              sourceType: benchmark.sourceType,
            }
          : null,
        designTrends: trends.map(trend => ({
          id: trend.id,
          trendName: trend.trendName,
          description: trend.description,
          trendCategory: trend.trendCategory,
          confidenceLevel: trend.confidenceLevel,
        })),
        expiresAt: brief.shareExpiresAt?.toISOString(),
        spaceEfficiency,
      };
    }),
});
