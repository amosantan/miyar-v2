import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../db";
import { runScenarioComparison } from "../engines/scenario";
import type { EvaluationConfig } from "../engines/scoring";
import type { ProjectInputs, ScenarioInput } from "../../shared/miyar-types";
import { simulateStressTest, type StressCondition } from "../engines/risk/stress-tester";
import { evaluateRiskSurface, type RiskInputParams } from "../engines/risk/risk-evaluator";
import { calculateProjectRoi } from "../engines/economic/roi-calculator";
import { rankScenarios, type ScenarioProfile } from "../engines/autonomous/scenario-ranking";
import {
  scenarioStressTests,
  riskSurfaceMaps,
  projectRoiModels,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

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

      const scenarioInputs: ScenarioInput[] = scenarioRecords.map((s: any) => ({
        name: s.name,
        description: s.description ?? undefined,
        variableOverrides: (s.variableOverrides ?? {}) as Partial<ProjectInputs>,
      }));

      return runScenarioComparison(baseInputs, scenarioInputs, config);
    }),

  // ─── D1: Stress Test ────────────────────────────────────────────────
  stressTest: protectedProcedure
    .input(z.object({
      scenarioId: z.number(),
      stressCondition: z.enum(["cost_surge", "demand_collapse", "market_shift", "data_disruption"]),
      baselineBudgetAed: z.number(),
      tier: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzle = await getDb();
      if (!drizzle) throw new Error("Database unavailable");

      const result = simulateStressTest(
        input.stressCondition as StressCondition,
        input.baselineBudgetAed,
        input.tier
      );

      // Persist to scenario_stress_tests
      await drizzle.insert(scenarioStressTests).values({
        scenarioId: input.scenarioId,
        stressCondition: input.stressCondition,
        impactMagnitudePercent: String(result.impactMagnitudePercent),
        resilienceScore: result.resilienceScore,
        failurePoints: result.failurePoints,
      });

      return result;
    }),

  listStressTests: protectedProcedure
    .input(z.object({ scenarioId: z.number() }))
    .query(async ({ input }) => {
      const drizzle = await getDb();
      if (!drizzle) return [];

      return drizzle
        .select()
        .from(scenarioStressTests)
        .where(eq(scenarioStressTests.scenarioId, input.scenarioId))
        .orderBy(desc(scenarioStressTests.createdAt));
    }),

  // ─── D2: Economic Model (ROI) ──────────────────────────────────────
  calculateRoi: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      scenarioId: z.number().optional(),
      tier: z.string(),
      scale: z.string(),
      totalBudgetAed: z.number(),
      totalDevelopmentValue: z.number(),
      complexityScore: z.number(),
      serviceFeeAed: z.number(),
      decisionSpeedAdjustment: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzle = await getDb();
      if (!drizzle) throw new Error("Database unavailable");

      const roi = calculateProjectRoi({
        tier: input.tier,
        scale: input.scale,
        totalBudgetAed: input.totalBudgetAed,
        totalDevelopmentValue: input.totalDevelopmentValue,
        complexityScore: input.complexityScore,
        serviceFeeAed: input.serviceFeeAed,
        decisionSpeedAdjustment: input.decisionSpeedAdjustment,
      });

      // Persist to project_roi_models
      await drizzle.insert(projectRoiModels).values({
        projectId: input.projectId,
        scenarioId: input.scenarioId ?? null,
        reworkCostAvoided: String(roi.reworkCostAvoided),
        programmeAccelerationValue: String(roi.programmeAccelerationValue),
        totalValueCreated: String(roi.totalValueCreated),
        netRoiPercent: String(roi.netRoiPercent),
        confidenceMultiplier: String(roi.confidenceMultiplier),
      });

      return roi;
    }),

  // ─── D3: Risk Surface Map ──────────────────────────────────────────
  generateRiskSurface: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      tier: z.string(),
      horizon: z.string(),
      location: z.string(),
      complexityScore: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const drizzle = await getDb();
      if (!drizzle) throw new Error("Database unavailable");

      const domains: RiskInputParams["domain"][] = [
        "Model", "Operational", "Commercial", "Technology",
        "Data", "Behavioural", "Strategic", "Regulatory",
      ];

      const results = domains.map((domain) =>
        evaluateRiskSurface({
          domain,
          tier: input.tier,
          horizon: input.horizon,
          location: input.location,
          complexityScore: input.complexityScore,
        })
      );

      // Persist each domain result
      for (const r of results) {
        await drizzle.insert(riskSurfaceMaps).values({
          projectId: input.projectId,
          domain: r.domain,
          probability: r.probability,
          impact: r.impact,
          vulnerability: r.vulnerability,
          controlStrength: r.controlStrength,
          compositeRiskScore: r.compositeRiskScore,
          riskBand: r.riskBand,
        });
      }

      return {
        projectId: input.projectId,
        domains: results,
        overallRisk: Math.round(
          results.reduce((s, r) => s + r.compositeRiskScore, 0) / results.length
        ),
      };
    }),

  getRiskSurface: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const drizzle = await getDb();
      if (!drizzle) return [];

      return drizzle
        .select()
        .from(riskSurfaceMaps)
        .where(eq(riskSurfaceMaps.projectId, input.projectId))
        .orderBy(desc(riskSurfaceMaps.createdAt));
    }),

  // ─── D4: Scenario Ranking ─────────────────────────────────────────
  rank: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const drizzle = await getDb();
      if (!drizzle) return [];

      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return [];

      const scenarios = await db.getScenariosByProject(input.projectId);
      if (scenarios.length === 0) return [];

      // Build ScenarioProfile[] from scenarios + stress tests + ROI data
      const profiles: ScenarioProfile[] = [];

      for (const s of scenarios) {
        // Get stress tests for this scenario
        const stressTests = await drizzle
          .select()
          .from(scenarioStressTests)
          .where(eq(scenarioStressTests.scenarioId, s.id));

        const avgResilience = stressTests.length > 0
          ? Math.round(stressTests.reduce((sum: number, t: any) => sum + t.resilienceScore, 0) / stressTests.length)
          : 70; // Default decent resilience if no stress tests run

        // Get ROI for this scenario
        const roiRows = await drizzle
          .select()
          .from(projectRoiModels)
          .where(eq(projectRoiModels.scenarioId, s.id))
          .orderBy(desc(projectRoiModels.createdAt))
          .limit(1);

        const netRoi = roiRows.length > 0
          ? Number(roiRows[0].netRoiPercent)
          : 0;

        // Get risk surface for the project (shared across scenarios)
        const riskMaps = await drizzle
          .select()
          .from(riskSurfaceMaps)
          .where(eq(riskSurfaceMaps.projectId, input.projectId));

        const avgRisk = riskMaps.length > 0
          ? Math.round(riskMaps.reduce((sum: number, r: any) => sum + r.compositeRiskScore, 0) / riskMaps.length)
          : 50; // Default moderate risk

        profiles.push({
          scenarioId: s.id,
          name: s.name,
          netRoiPercent: netRoi,
          avgResilienceScore: avgResilience,
          compositeRiskScore: avgRisk,
        });
      }

      return rankScenarios(profiles);
    }),
});

