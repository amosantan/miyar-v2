import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { evaluate, type EvaluationConfig } from "../engines/scoring";
import { generateDesignBrief } from "../engines/design-brief";
import { recommendMaterials } from "../engines/board-composer";
import type { ProjectInputs } from "../../shared/miyar-types";

async function buildEvalConfigForSeed(
  modelVersion: NonNullable<Awaited<ReturnType<typeof db.getActiveModelVersion>>>,
  expectedCost: number,
  benchmarkCount: number
): Promise<import("../engines/scoring").EvaluationConfig> {
  const baseWeights = modelVersion.dimensionWeights as Record<string, number>;
  const publishedLogic = await db.getPublishedLogicVersion();
  let dimensionWeights = baseWeights;
  if (publishedLogic) {
    const logicWeightRows = await db.getLogicWeights(publishedLogic.id);
    if (logicWeightRows.length > 0) {
      const logicWeightsMap: Record<string, number> = {};
      for (const w of logicWeightRows) {
        logicWeightsMap[w.dimension] = parseFloat(w.weight);
      }
      if (Object.keys(logicWeightsMap).length >= 5) {
        dimensionWeights = logicWeightsMap;
      }
    }
  }
  return {
    dimensionWeights: dimensionWeights as any,
    variableWeights: modelVersion.variableWeights as any,
    penaltyConfig: modelVersion.penaltyConfig as any,
    expectedCost,
    benchmarkCount,
    overrideRate: 0,
  };
}

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

      const config = await buildEvalConfigForSeed(modelVersion, expectedCost, benchmarks.length);

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

      // ─── V2.8 Design Enablement Seed Data ───────────────────────────────
      try {
        // 1. Generate Design Brief
        const briefData = generateDesignBrief(
          { name: project.name, description: project.description },
          inputs,
          {
            compositeScore: scoreResult.compositeScore,
            decisionStatus: scoreResult.decisionStatus,
            dimensions: { ...scoreResult.dimensions },
          },
        );

        await db.createDesignBrief({
          projectId,
          version: 1,
          projectIdentity: briefData.projectIdentity,
          positioningStatement: briefData.positioningStatement,
          styleMood: briefData.styleMood,
          materialGuidance: briefData.materialGuidance,
          budgetGuardrails: briefData.budgetGuardrails,
          procurementConstraints: briefData.procurementConstraints,
          deliverablesChecklist: briefData.deliverablesChecklist,
          createdBy: ctx.user.id,
        });

        // 2. Create Material Board with recommended materials
        const catalog = await db.getAllMaterials();
        const recommended = recommendMaterials(catalog as any, inputs.mkt01Tier || "Upper-mid", 8);

        if (recommended.length > 0) {
          const boardResult = await db.createMaterialBoard({
            projectId,
            boardName: `${sample.name.split("—")[0].trim()} — Primary Board`,
            boardJson: recommended,
            createdBy: ctx.user.id,
          });

          // Link materials to board
          for (const mat of recommended) {
            await db.addMaterialToBoard({
              boardId: boardResult.id,
              materialId: mat.materialId,
            });
          }
        }

        // 3. Add seed comments
        await db.createComment({
          projectId,
          entityType: "general",
          userId: ctx.user.id,
          content: `Project evaluated with composite score ${scoreResult.compositeScore.toFixed(1)} (${scoreResult.decisionStatus}). Design brief V1 generated. Material board created with ${recommended.length} recommended materials.`,
        });

        await db.createComment({
          projectId,
          entityType: "design_brief",
          userId: ctx.user.id,
          content: `Design brief generated based on ${inputs.des01Style} style direction for ${inputs.mkt01Tier} tier. Positioning statement and material guidance aligned with evaluation results.`,
        });
      } catch (e) {
        // V2.8 seed data is non-critical — log but don't fail
        console.error("V2.8 seed data error:", e);
      }

      // ─── V2.10-V2.13 Intelligence Seed Data ────────────────────────────
      try {
        // 1. Create scenario inputs/outputs for scenario comparison
        const scenarios = await db.getScenariosByProject(projectId);
        if (scenarios.length > 0) {
          for (const scenario of scenarios) {
            const scenarioInputData = {
              scenarioId: scenario.id,
              jsonInput: {
                variableOverrides: scenario.variableOverrides,
                description: scenario.description,
                source: "seed",
              },
            };
            await db.createScenarioInput(scenarioInputData);

            const scenarioOutputData = {
              scenarioId: scenario.id,
              scoreJson: {
                saScore: Number(scoreResult.dimensions.sa) + (Math.random() * 10 - 5),
                ffScore: Number(scoreResult.dimensions.ff) + (Math.random() * 10 - 5),
                mpScore: Number(scoreResult.dimensions.mp) + (Math.random() * 10 - 5),
                dsScore: Number(scoreResult.dimensions.ds) + (Math.random() * 10 - 5),
                erScore: Number(scoreResult.dimensions.er) + (Math.random() * 10 - 5),
                compositeScore: scoreResult.compositeScore + (Math.random() * 8 - 4),
              },
              roiJson: {
                hoursSaved: Math.round(40 + Math.random() * 80),
                costAvoided: Math.round(50000 + Math.random() * 200000),
                budgetAccuracyGain: Math.round(5 + Math.random() * 15),
              },
            };
            await db.createScenarioOutput(scenarioOutputData);
          }
        }

        // 2. Seed project outcomes for benchmark learning
        await db.createProjectOutcome({
          projectId,
          procurementActualCosts: {
            flooring: Math.round(20000 + Math.random() * 80000),
            fixtures: Math.round(15000 + Math.random() * 60000),
            joinery: Math.round(10000 + Math.random() * 40000),
          },
          leadTimesActual: {
            flooring: Math.round(45 + Math.random() * 90),
            fixtures: Math.round(30 + Math.random() * 60),
            joinery: Math.round(60 + Math.random() * 120),
          },
          rfqResults: {
            totalBids: Math.round(3 + Math.random() * 5),
            acceptedBid: Math.round(80000 + Math.random() * 200000),
          },
          capturedBy: ctx.user.id,
        });
      } catch (e) {
        console.error("V2.10-V2.13 seed data error:", e);
      }

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
