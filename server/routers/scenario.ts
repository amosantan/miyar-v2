import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { runScenarioComparison } from "../engines/scenario";
import type { EvaluationConfig } from "../engines/scoring";
import type { ProjectInputs, ScenarioInput } from "../../shared/miyar-types";

function projectToInputs(p: any): ProjectInputs {
  return {
    ctx01Typology: p.ctx01Typology ?? "Residential",
    ctx02Scale: p.ctx02Scale ?? "Medium",
    ctx03Gfa: p.ctx03Gfa ? Number(p.ctx03Gfa) : null,
    ctx04Location: p.ctx04Location ?? "Secondary",
    ctx05Horizon: p.ctx05Horizon ?? "12-24m",
    str01BrandClarity: p.str01BrandClarity ?? 3,
    str02Differentiation: p.str02Differentiation ?? 3,
    str03BuyerMaturity: p.str03BuyerMaturity ?? 3,
    mkt01Tier: p.mkt01Tier ?? "Upper-mid",
    mkt02Competitor: p.mkt02Competitor ?? 3,
    mkt03Trend: p.mkt03Trend ?? 3,
    fin01BudgetCap: p.fin01BudgetCap ? Number(p.fin01BudgetCap) : null,
    fin02Flexibility: p.fin02Flexibility ?? 3,
    fin03ShockTolerance: p.fin03ShockTolerance ?? 3,
    fin04SalesPremium: p.fin04SalesPremium ?? 3,
    des01Style: p.des01Style ?? "Modern",
    des02MaterialLevel: p.des02MaterialLevel ?? 3,
    des03Complexity: p.des03Complexity ?? 3,
    des04Experience: p.des04Experience ?? 3,
    des05Sustainability: p.des05Sustainability ?? 2,
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true,
  };
}

export const scenarioRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return [];
      return db.getScenariosByProject(input.projectId);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      variableOverrides: z.record(z.string(), z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");

      const result = await db.createScenarioRecord({
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        variableOverrides: input.variableOverrides,
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "scenario.create",
        entityType: "scenario",
        entityId: result.id,
      });

      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteScenario(input.id);
      return { success: true };
    }),

  compare: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return [];

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) return [];

      const baseInputs = projectToInputs(project);
      const expectedCost = await db.getExpectedCost(
        baseInputs.ctx01Typology,
        baseInputs.ctx04Location,
        baseInputs.mkt01Tier
      );
      const benchmarks = await db.getBenchmarks(
        baseInputs.ctx01Typology,
        baseInputs.ctx04Location,
        baseInputs.mkt01Tier
      );

      const config: EvaluationConfig = {
        dimensionWeights: modelVersion.dimensionWeights as any,
        variableWeights: modelVersion.variableWeights as any,
        penaltyConfig: modelVersion.penaltyConfig as any,
        expectedCost,
        benchmarkCount: benchmarks.length,
        overrideRate: 0,
      };

      const scenarioRecords = await db.getScenariosByProject(input.projectId);
      if (scenarioRecords.length === 0) return [];

      const scenarioInputs: ScenarioInput[] = scenarioRecords.map((s) => ({
        name: s.name,
        description: s.description ?? undefined,
        variableOverrides: (s.variableOverrides ?? {}) as Partial<ProjectInputs>,
      }));

      return runScenarioComparison(baseInputs, scenarioInputs, config);
    }),
});
