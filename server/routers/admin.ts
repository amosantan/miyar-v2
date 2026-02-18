import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { computeDistributions, computeComplianceHeatmap, detectFailurePatterns, computeImprovementLevers, type PortfolioProject } from "../engines/portfolio";

export const adminRouter = router({
  // ─── Benchmarks ──────────────────────────────────────────────────────
  benchmarks: router({
    list: protectedProcedure
      .input(z.object({
        typology: z.string().optional(),
        location: z.string().optional(),
        marketTier: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getBenchmarks(input?.typology, input?.location, input?.marketTier);
      }),

    create: adminProcedure
      .input(z.object({
        typology: z.string(),
        location: z.string(),
        marketTier: z.string(),
        materialLevel: z.number(),
        costPerSqftLow: z.number().optional(),
        costPerSqftMid: z.number().optional(),
        costPerSqftHigh: z.number().optional(),
        avgSellingPrice: z.number().optional(),
        absorptionRate: z.number().optional(),
        competitiveDensity: z.number().optional(),
        sourceType: z.enum(["synthetic", "client_provided", "curated"]).default("synthetic"),
        dataYear: z.number().optional(),
        region: z.string().default("UAE"),
        benchmarkVersionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const activeBV = await db.getActiveBenchmarkVersion();
        const result = await db.createBenchmark({
          ...input,
          benchmarkVersionId: input.benchmarkVersionId ?? activeBV?.id ?? null,
          costPerSqftLow: input.costPerSqftLow ? String(input.costPerSqftLow) as any : null,
          costPerSqftMid: input.costPerSqftMid ? String(input.costPerSqftMid) as any : null,
          costPerSqftHigh: input.costPerSqftHigh ? String(input.costPerSqftHigh) as any : null,
          avgSellingPrice: input.avgSellingPrice ? String(input.avgSellingPrice) as any : null,
          absorptionRate: input.absorptionRate ? String(input.absorptionRate) as any : null,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark.create",
          entityType: "benchmark",
          entityId: result.id,
          benchmarkVersionId: activeBV?.id,
        });
        return result;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteBenchmark(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark.delete",
          entityType: "benchmark",
          entityId: input.id,
        });
        return { success: true };
      }),

    csvImport: adminProcedure
      .input(z.object({
        rows: z.array(z.object({
          typology: z.string(),
          location: z.string(),
          marketTier: z.string(),
          materialLevel: z.number(),
          costPerSqftLow: z.number().optional(),
          costPerSqftMid: z.number().optional(),
          costPerSqftHigh: z.number().optional(),
          avgSellingPrice: z.number().optional(),
          absorptionRate: z.number().optional(),
          competitiveDensity: z.number().optional(),
          sourceType: z.enum(["synthetic", "client_provided", "curated"]).default("client_provided"),
          dataYear: z.number().optional(),
          region: z.string().default("UAE"),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const activeBV = await db.getActiveBenchmarkVersion();
        let imported = 0;
        for (const row of input.rows) {
          await db.createBenchmark({
            ...row,
            benchmarkVersionId: activeBV?.id ?? null,
            costPerSqftLow: row.costPerSqftLow ? String(row.costPerSqftLow) as any : null,
            costPerSqftMid: row.costPerSqftMid ? String(row.costPerSqftMid) as any : null,
            costPerSqftHigh: row.costPerSqftHigh ? String(row.costPerSqftHigh) as any : null,
            avgSellingPrice: row.avgSellingPrice ? String(row.avgSellingPrice) as any : null,
            absorptionRate: row.absorptionRate ? String(row.absorptionRate) as any : null,
          });
          imported++;
        }
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark.csv_import",
          entityType: "benchmark",
          details: { rowCount: imported },
          benchmarkVersionId: activeBV?.id,
        });
        return { imported };
      }),
  }),

  // ─── Benchmark Versions (V2) ────────────────────────────────────────
  benchmarkVersions: router({
    list: adminProcedure.query(async () => {
      return db.getAllBenchmarkVersions();
    }),

    active: protectedProcedure.query(async () => {
      return db.getActiveBenchmarkVersion();
    }),

    create: adminProcedure
      .input(z.object({
        versionTag: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createBenchmarkVersion({
          ...input,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark_version.create",
          entityType: "benchmark_version",
          entityId: result.id,
          details: { versionTag: input.versionTag },
        });
        return result;
      }),

    publish: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.publishBenchmarkVersion(input.id, ctx.user.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark_version.publish",
          entityType: "benchmark_version",
          entityId: input.id,
        });
        return { success: true };
      }),

    diff: adminProcedure
      .input(z.object({
        oldVersionId: z.number(),
        newVersionId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getBenchmarkDiff(input.oldVersionId, input.newVersionId);
      }),

    impactPreview: adminProcedure
      .input(z.object({ versionId: z.number() }))
      .query(async ({ input }) => {
        // Get all scored projects and check which would materially change
        const allScores = await db.getAllScoreMatrices();
        const currentBV = await db.getActiveBenchmarkVersion();
        if (!currentBV) return { affectedProjects: [], totalProjects: allScores.length };

        const diff = await db.getBenchmarkDiff(currentBV.id, input.versionId);
        const totalChanges = diff.added + diff.removed + diff.changed;
        // If significant changes, flag all projects as potentially affected
        const threshold = 0.1; // 10% of benchmarks changed
        const allBenchmarks = await db.getAllBenchmarkData();
        const changeRatio = allBenchmarks.length > 0 ? totalChanges / allBenchmarks.length : 0;

        const affected = changeRatio > threshold
          ? allScores.map(s => ({ projectId: s.projectId, currentScore: Number(s.compositeScore), estimatedImpact: "may_change" as const }))
          : [];

        return { affectedProjects: affected, totalProjects: allScores.length, changeRatio, diff };
      }),
  }),

  // ─── Benchmark Categories (V2) ──────────────────────────────────────
  benchmarkCategories: router({
    list: adminProcedure
      .input(z.object({
        category: z.string().optional(),
        projectClass: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllBenchmarkCategories(input?.category, input?.projectClass);
      }),

    create: adminProcedure
      .input(z.object({
        category: z.enum(["materials", "finishes", "ffe", "procurement", "cost_bands", "tier_definitions", "style_families", "brand_archetypes", "risk_factors", "lead_times"]),
        name: z.string(),
        description: z.string().optional(),
        projectClass: z.enum(["mid", "upper", "luxury", "ultra_luxury"]),
        market: z.string().default("UAE"),
        submarket: z.string().default("Dubai"),
        confidenceLevel: z.enum(["high", "medium", "low"]).default("medium"),
        sourceType: z.enum(["manual", "admin", "imported", "curated"]).default("admin"),
        data: z.any(),
      }))
      .mutation(async ({ ctx, input }) => {
        const activeBV = await db.getActiveBenchmarkVersion();
        const result = await db.createBenchmarkCategory({
          ...input,
          benchmarkVersionId: activeBV?.id ?? null,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark_category.create",
          entityType: "benchmark_category",
          entityId: result.id,
        });
        return result;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        data: z.any().optional(),
        confidenceLevel: z.enum(["high", "medium", "low"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateBenchmarkCategory(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark_category.update",
          entityType: "benchmark_category",
          entityId: id,
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteBenchmarkCategory(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "benchmark_category.delete",
          entityType: "benchmark_category",
          entityId: input.id,
        });
        return { success: true };
      }),
  }),

  // ─── Model Versions ──────────────────────────────────────────────────
  modelVersions: router({
    list: adminProcedure.query(async () => {
      return db.getAllModelVersions();
    }),

    create: adminProcedure
      .input(z.object({
        versionTag: z.string(),
        dimensionWeights: z.any(),
        variableWeights: z.any(),
        penaltyConfig: z.any(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createModelVersion({
          ...input,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "model_version.create",
          entityType: "model_version",
          entityId: result.id,
          details: { versionTag: input.versionTag },
        });
        return result;
      }),

    active: protectedProcedure.query(async () => {
      return db.getActiveModelVersion();
    }),
  }),

  // ─── ROI Configurations (V2) ────────────────────────────────────────
  roiConfigs: router({
    list: adminProcedure.query(async () => {
      return db.getAllRoiConfigs();
    }),

    active: protectedProcedure.query(async () => {
      return db.getActiveRoiConfig();
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string(),
        hourlyRate: z.number().default(350),
        reworkCostPct: z.number().default(0.12),
        tenderIterationCost: z.number().default(25000),
        designCycleCost: z.number().default(45000),
        budgetVarianceMultiplier: z.number().default(0.08),
        timeAccelerationWeeks: z.number().default(6),
        conservativeMultiplier: z.number().default(0.60),
        aggressiveMultiplier: z.number().default(1.40),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createRoiConfig({
          ...input,
          hourlyRate: String(input.hourlyRate) as any,
          reworkCostPct: String(input.reworkCostPct) as any,
          tenderIterationCost: String(input.tenderIterationCost) as any,
          designCycleCost: String(input.designCycleCost) as any,
          budgetVarianceMultiplier: String(input.budgetVarianceMultiplier) as any,
          conservativeMultiplier: String(input.conservativeMultiplier) as any,
          aggressiveMultiplier: String(input.aggressiveMultiplier) as any,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "roi_config.create",
          entityType: "roi_config",
          entityId: result.id,
        });
        return result;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        hourlyRate: z.number().optional(),
        reworkCostPct: z.number().optional(),
        tenderIterationCost: z.number().optional(),
        designCycleCost: z.number().optional(),
        budgetVarianceMultiplier: z.number().optional(),
        timeAccelerationWeeks: z.number().optional(),
        conservativeMultiplier: z.number().optional(),
        aggressiveMultiplier: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, any> = {};
        for (const [key, val] of Object.entries(data)) {
          if (val !== undefined) {
            updateData[key] = typeof val === "number" ? String(val) : val;
          }
        }
        await db.updateRoiConfig(id, updateData);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "roi_config.update",
          entityType: "roi_config",
          entityId: id,
        });
        return { success: true };
      }),
  }),

  // ─── Webhook Configurations (V2) ────────────────────────────────────
  webhooks: router({
    list: adminProcedure.query(async () => {
      return db.getAllWebhookConfigs();
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string(),
        url: z.string().url(),
        secret: z.string().optional(),
        events: z.array(z.string()),
        fieldMapping: z.record(z.string(), z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createWebhookConfig({
          ...input,
          createdBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "webhook.create",
          entityType: "webhook",
          entityId: result.id,
        });
        return result;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        url: z.string().url().optional(),
        secret: z.string().optional(),
        events: z.array(z.string()).optional(),
        fieldMapping: z.record(z.string(), z.string()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateWebhookConfig(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "webhook.update",
          entityType: "webhook",
          entityId: id,
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteWebhookConfig(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "webhook.delete",
          entityType: "webhook",
          entityId: input.id,
        });
        return { success: true };
      }),
  }),

  // ─── Portfolio Analytics (V2) ───────────────────────────────────────
  portfolio: router({
    overview: adminProcedure.query(async () => {
      const allProjects = await db.getAllProjects();
      const allScores = await db.getAllScoreMatrices();
      const allIntel = await db.getAllProjectIntelligence();

      // Build portfolio items (latest score per project)
      const latestScoreByProject = new Map<number, typeof allScores[0]>();
      for (const score of allScores) {
        const existing = latestScoreByProject.get(score.projectId);
        if (!existing || new Date(score.computedAt) > new Date(existing.computedAt)) {
          latestScoreByProject.set(score.projectId, score);
        }
      }

      const intelByProject = new Map<number, typeof allIntel[0]>();
      for (const intel of allIntel) {
        const existing = intelByProject.get(intel.projectId);
        if (!existing || new Date(intel.computedAt) > new Date(existing.computedAt)) {
          intelByProject.set(intel.projectId, intel);
        }
      }

      const portfolioItems: PortfolioProject[] = [];
      for (const project of allProjects) {
        const score = latestScoreByProject.get(project.id);
        if (!score) continue;
        const intel = intelByProject.get(project.id);
        portfolioItems.push({
          project,
          scoreMatrix: score,
          intelligence: intel ? {
            costDeltaVsBenchmark: Number(intel.costDeltaVsBenchmark),
            uniquenessIndex: Number(intel.uniquenessIndex),
            feasibilityFlags: (intel.feasibilityFlags || []) as any,
            reworkRiskIndex: Number(intel.reworkRiskIndex),
            procurementComplexity: Number(intel.procurementComplexity),
            tierPercentile: Number(intel.tierPercentile),
            styleFamily: intel.styleFamily || "custom",
            costBand: intel.costBand || "market_mid",
          } : undefined,
        });
      }

      return {
        totalProjects: allProjects.length,
        scoredProjects: portfolioItems.length,
        distributions: computeDistributions(portfolioItems),
        complianceHeatmap: computeComplianceHeatmap(portfolioItems),
        failurePatterns: detectFailurePatterns(portfolioItems),
        improvementLevers: computeImprovementLevers(portfolioItems),
        projects: portfolioItems.map(p => ({
          id: p.project.id,
          name: p.project.name,
          tier: p.project.mkt01Tier,
          style: p.project.des01Style,
          compositeScore: Number(p.scoreMatrix.compositeScore),
          riskScore: Number(p.scoreMatrix.riskScore),
          status: p.scoreMatrix.decisionStatus,
          costBand: p.intelligence?.costBand,
          reworkRisk: p.intelligence?.reworkRiskIndex,
        })),
      };
    }),
  }),

  // ─── Audit Logs ──────────────────────────────────────────────────────
  auditLogs: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return db.getAuditLogs(input?.limit ?? 50);
      }),
  }),

  // ─── Override Records ────────────────────────────────────────────────
  overrides: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) return [];
        return db.getOverridesByProject(input.projectId);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        overrideType: z.enum(["strategic", "market_insight", "risk_adjustment", "experimental"]),
        authorityLevel: z.number().min(1).max(5),
        originalValue: z.any(),
        overrideValue: z.any(),
        justification: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");

        const result = await db.createOverrideRecord({
          ...input,
          userId: ctx.user.id,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "override.create",
          entityType: "override",
          entityId: result.id,
          details: { overrideType: input.overrideType, projectId: input.projectId },
        });

        return result;
      }),
  }),
});
