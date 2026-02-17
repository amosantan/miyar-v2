import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { evaluate, type EvaluationConfig } from "../engines/scoring";
import type { ProjectInputs } from "../../shared/miyar-types";

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

// ─── Sample Project Definitions ─────────────────────────────────────────────

const SAMPLE_PROJECTS = [
  {
    name: "Al Wasl Residences — Mid-Market Residential",
    description:
      "A 350-unit mid-market residential tower in Dubai Marina targeting young professionals and first-time buyers. Modern design with cost-efficient material palette. Developer seeks validation that the interior direction balances market appeal with budget constraints.",
    ctx01Typology: "Residential" as const,
    ctx02Scale: "Large" as const,
    ctx03Gfa: 450000,
    ctx04Location: "Secondary" as const,
    ctx05Horizon: "12-24m" as const,
    str01BrandClarity: 3,
    str02Differentiation: 3,
    str03BuyerMaturity: 3,
    mkt01Tier: "Mid" as const,
    mkt02Competitor: 4,
    mkt03Trend: 3,
    fin01BudgetCap: 280,
    fin02Flexibility: 2,
    fin03ShockTolerance: 2,
    fin04SalesPremium: 2,
    des01Style: "Modern" as const,
    des02MaterialLevel: 2,
    des03Complexity: 2,
    des04Experience: 3,
    des05Sustainability: 2,
    exe01SupplyChain: 3,
    exe02Contractor: 3,
    exe03Approvals: 3,
    exe04QaMaturity: 3,
    add01SampleKit: false,
    add02PortfolioMode: false,
    add03DashboardExport: true,
  },
  {
    name: "One Palm Branded Residences — Premium Luxury",
    description:
      "A 45-unit ultra-luxury branded residence on Palm Jumeirah with bespoke interiors by an international design house. High material specification (Italian marble, custom joinery, smart home integration). Developer needs validation that the premium design direction justifies the cost premium and aligns with the ultra-luxury buyer profile.",
    ctx01Typology: "Residential" as const,
    ctx02Scale: "Medium" as const,
    ctx03Gfa: 180000,
    ctx04Location: "Prime" as const,
    ctx05Horizon: "24-36m" as const,
    str01BrandClarity: 5,
    str02Differentiation: 5,
    str03BuyerMaturity: 5,
    mkt01Tier: "Ultra-luxury" as const,
    mkt02Competitor: 3,
    mkt03Trend: 4,
    fin01BudgetCap: 850,
    fin02Flexibility: 4,
    fin03ShockTolerance: 4,
    fin04SalesPremium: 5,
    des01Style: "Contemporary" as const,
    des02MaterialLevel: 5,
    des03Complexity: 4,
    des04Experience: 5,
    des05Sustainability: 3,
    exe01SupplyChain: 4,
    exe02Contractor: 4,
    exe03Approvals: 3,
    exe04QaMaturity: 4,
    add01SampleKit: true,
    add02PortfolioMode: false,
    add03DashboardExport: true,
  },
];

export const seedRouter = router({
  seedProjects: protectedProcedure.mutation(async ({ ctx }) => {
    const results: Array<{
      projectId: number;
      name: string;
      compositeScore: number;
      decisionStatus: string;
    }> = [];

    for (const sample of SAMPLE_PROJECTS) {
      // Check if already seeded (by name)
      const existing = await db.getProjectsByUser(ctx.user.id);
      if (existing.some((p) => p.name === sample.name)) {
        continue; // Skip if already exists
      }

      // Create project
      const projectResult = await db.createProject({
        ...sample,
        userId: ctx.user.id,
        status: "draft",
        ctx03Gfa: String(sample.ctx03Gfa) as any,
        fin01BudgetCap: String(sample.fin01BudgetCap) as any,
      });

      const projectId = projectResult.id;
      const project = await db.getProjectById(projectId);
      if (!project) continue;

      // Get model version
      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) continue;

      const inputs = projectToInputs(project);

      // Get benchmark data
      const expectedCost = await db.getExpectedCost(
        inputs.ctx01Typology,
        inputs.ctx04Location,
        inputs.mkt01Tier
      );
      const benchmarks = await db.getBenchmarks(
        inputs.ctx01Typology,
        inputs.ctx04Location,
        inputs.mkt01Tier
      );

      const config: EvaluationConfig = {
        dimensionWeights: modelVersion.dimensionWeights as any,
        variableWeights: modelVersion.variableWeights as any,
        penaltyConfig: modelVersion.penaltyConfig as any,
        expectedCost,
        benchmarkCount: benchmarks.length,
        overrideRate: 0,
      };

      // Evaluate
      const scoreResult = evaluate(inputs, config);

      // Save score matrix
      await db.createScoreMatrix({
        projectId,
        modelVersionId: modelVersion.id,
        saScore: String(scoreResult.dimensions.sa) as any,
        ffScore: String(scoreResult.dimensions.ff) as any,
        mpScore: String(scoreResult.dimensions.mp) as any,
        dsScore: String(scoreResult.dimensions.ds) as any,
        erScore: String(scoreResult.dimensions.er) as any,
        compositeScore: String(scoreResult.compositeScore) as any,
        riskScore: String(scoreResult.riskScore) as any,
        rasScore: String(scoreResult.rasScore) as any,
        confidenceScore: String(scoreResult.confidenceScore) as any,
        decisionStatus: scoreResult.decisionStatus,
        penalties: scoreResult.penalties,
        riskFlags: scoreResult.riskFlags,
        dimensionWeights: scoreResult.dimensionWeights,
        variableContributions: scoreResult.variableContributions,
        conditionalActions: scoreResult.conditionalActions,
        inputSnapshot: scoreResult.inputSnapshot,
      });

      // Update project status
      await db.updateProject(projectId, {
        status: "evaluated",
        modelVersionId: modelVersion.id,
      });

      // Audit
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "seed.project",
        entityType: "project",
        entityId: projectId,
        details: {
          compositeScore: scoreResult.compositeScore,
          decisionStatus: scoreResult.decisionStatus,
        },
      });

      results.push({
        projectId,
        name: sample.name,
        compositeScore: scoreResult.compositeScore,
        decisionStatus: scoreResult.decisionStatus,
      });
    }

    return {
      seeded: results.length,
      projects: results,
    };
  }),
});
