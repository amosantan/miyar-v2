import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

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
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createBenchmark({
          ...input,
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
