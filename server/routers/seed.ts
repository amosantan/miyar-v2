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

  seedMaterials: protectedProcedure.mutation(async () => {
    const existing = await db.getAllMaterials();
    if (existing.length > 0) {
      return { seeded: 0, message: "Materials already exist" };
    }

    const MATERIALS = [
      { name: "American Walnut Solid", category: "wood" as const, tier: "luxury" as const, typicalCostLow: "450.00", typicalCostHigh: "800.00", costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "long" as const, supplierName: "Havwoods", notes: "Rich dark tones, premium grain patterns" },
      { name: "Artisan Ceramic Vase", category: "accessory" as const, tier: "premium" as const, typicalCostLow: "800.00", typicalCostHigh: "2500.00", costUnit: "AED/piece", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Various", notes: "Hand-thrown ceramic, gallery quality" },
      { name: "Belgian Linen Upholstery", category: "fabric" as const, tier: "luxury" as const, typicalCostLow: "180.00", typicalCostHigh: "380.00", costUnit: "AED/m", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Libeco", notes: "Heavy-weight upholstery linen, 20+ colorways" },
      { name: "Blackened Steel Cladding", category: "metal" as const, tier: "premium" as const, typicalCostLow: "220.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short" as const, supplierName: "SteelArt", notes: "Hot-rolled steel with patina finish" },
      { name: "Brushed Brass Hardware", category: "fixture" as const, tier: "luxury" as const, typicalCostLow: "150.00", typicalCostHigh: "400.00", costUnit: "AED/piece", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Armac Martin", notes: "Solid brass, hand-finished" },
      { name: "Calacatta Gold Marble", category: "stone" as const, tier: "ultra_luxury" as const, typicalCostLow: "650.00", typicalCostHigh: "1500.00", costUnit: "AED/sqm", leadTimeDays: 80, leadTimeBand: "long" as const, supplierName: "Antolini", notes: "Premium Italian marble, book-matched slabs available" },
      { name: "Crema Marfil Marble", category: "stone" as const, tier: "mid" as const, typicalCostLow: "180.00", typicalCostHigh: "350.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Various", notes: "Versatile cream-toned marble" },
      { name: "Custom Joinery Unit", category: "furniture" as const, tier: "luxury" as const, typicalCostLow: "3500.00", typicalCostHigh: "12000.00", costUnit: "AED/unit", leadTimeDays: 120, leadTimeBand: "critical" as const, supplierName: "Local Craftsman", notes: "Bespoke built-in cabinetry" },
      { name: "Decorative Acoustic Panel", category: "wallpaper" as const, tier: "premium" as const, typicalCostLow: "200.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "BuzzrSpace", notes: "Felt-based acoustic panels, custom colors" },
      { name: "European Oak Engineered", category: "wood" as const, tier: "premium" as const, typicalCostLow: "280.00", typicalCostHigh: "520.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium" as const, supplierName: "Havwoods", notes: "Engineered oak, multiple finishes available" },
      { name: "Handmade Zellige Tile", category: "tile" as const, tier: "premium" as const, typicalCostLow: "320.00", typicalCostHigh: "650.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium" as const, supplierName: "Emery et Cie", notes: "Moroccan handmade glazed tiles" },
      { name: "Italian Pendant Light", category: "lighting" as const, tier: "luxury" as const, typicalCostLow: "1200.00", typicalCostHigh: "4500.00", costUnit: "AED/piece", leadTimeDays: 75, leadTimeBand: "long" as const, supplierName: "Flos", notes: "Designer pendant, dimmable LED" },
      { name: "Porcelain Large-Format Tile", category: "tile" as const, tier: "mid" as const, typicalCostLow: "120.00", typicalCostHigh: "280.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short" as const, supplierName: "RAK Ceramics", notes: "120x60cm format, marble-look finishes" },
      { name: "Venetian Plaster", category: "paint" as const, tier: "premium" as const, typicalCostLow: "180.00", typicalCostHigh: "400.00", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short" as const, supplierName: "Viero", notes: "Polished plaster, multi-layer application" },
      { name: "Miele Built-in Oven", category: "fixture" as const, tier: "luxury" as const, typicalCostLow: "8000.00", typicalCostHigh: "15000.00", costUnit: "AED/unit", leadTimeDays: 60, leadTimeBand: "medium" as const, supplierName: "Miele", notes: "Built-in pyrolytic oven, TouchControl" },
      { name: "Grohe Rainshower System", category: "fixture" as const, tier: "premium" as const, typicalCostLow: "2500.00", typicalCostHigh: "6000.00", costUnit: "AED/set", leadTimeDays: 30, leadTimeBand: "short" as const, supplierName: "Grohe", notes: "Thermostatic shower system with head rain" },
      { name: "Sheer Linen Curtain", category: "fabric" as const, tier: "mid" as const, typicalCostLow: "80.00", typicalCostHigh: "200.00", costUnit: "AED/m", leadTimeDays: 21, leadTimeBand: "short" as const, supplierName: "Various", notes: "Lightweight linen-blend sheers" },
      { name: "Recycled Glass Mosaic", category: "glass" as const, tier: "premium" as const, typicalCostLow: "350.00", typicalCostHigh: "700.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Sicis", notes: "Recycled glass mosaic, custom colorways" },
    ];

    let seeded = 0;
    for (const mat of MATERIALS) {
      await db.createMaterial({
        ...mat,
        regionAvailability: ["UAE", "GCC"],
        isActive: true,
      });
      seeded++;
    }

    return { seeded, message: `${seeded} materials seeded` };
  }),

  seedEvidence: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await db.listEvidenceRecords({});
    if (existing && existing.length > 0) {
      return { seeded: 0, message: "Evidence records already exist" };
    }

    const now = new Date();
    const EVIDENCE = [
      { recordId: "MYR-PE-0001", category: "floors" as const, itemName: "Porcelain Tile 60x120 — Mid Range", specClass: "Porcelain", priceMin: "120.00", priceTypical: "180.00", priceMax: "280.00", unit: "sqm", publisher: "RAK Ceramics", reliabilityGrade: "A" as const, confidenceScore: 85, sourceUrl: "https://rakceramics.com/uae/products", title: "RAK Ceramics UAE Product Catalog" },
      { recordId: "MYR-PE-0002", category: "floors" as const, itemName: "European Oak Engineered Flooring", specClass: "Engineered Wood", priceMin: "280.00", priceTypical: "400.00", priceMax: "520.00", unit: "sqm", publisher: "Havwoods", reliabilityGrade: "B" as const, confidenceScore: 70, sourceUrl: "https://havwoods.com/ae/products", title: "Havwoods UAE Price Guide" },
      { recordId: "MYR-PE-0003", category: "walls" as const, itemName: "Calacatta Gold Marble — Book-Matched", specClass: "Natural Stone", priceMin: "650.00", priceTypical: "950.00", priceMax: "1500.00", unit: "sqm", publisher: "Antolini", reliabilityGrade: "B" as const, confidenceScore: 75, sourceUrl: "https://antolini.com/en/materials", title: "Antolini Premium Stone Catalog" },
      { recordId: "MYR-PE-0004", category: "walls" as const, itemName: "Venetian Plaster — Premium", specClass: "Decorative Plaster", priceMin: "180.00", priceTypical: "280.00", priceMax: "400.00", unit: "sqm", publisher: "Viero", reliabilityGrade: "B" as const, confidenceScore: 70, sourceUrl: "https://vierodecorative.com/products", title: "Viero Decorative Finishes" },
      { recordId: "MYR-PE-0005", category: "joinery" as const, itemName: "Custom Kitchen Cabinetry — Luxury", specClass: "Bespoke Joinery", priceMin: "3500.00", priceTypical: "7500.00", priceMax: "12000.00", unit: "unit", publisher: "Local Craftsman", reliabilityGrade: "C" as const, confidenceScore: 55, sourceUrl: "https://dubaijoinery.com/pricing", title: "Dubai Joinery Market Report" },
      { recordId: "MYR-PE-0006", category: "lighting" as const, itemName: "Designer Pendant Light — Italian", specClass: "Decorative Lighting", priceMin: "1200.00", priceTypical: "2800.00", priceMax: "4500.00", unit: "piece", publisher: "Flos", reliabilityGrade: "A" as const, confidenceScore: 90, sourceUrl: "https://flos.com/professional", title: "Flos Professional Catalog" },
      { recordId: "MYR-PE-0007", category: "sanitary" as const, itemName: "Grohe Thermostatic Shower System", specClass: "Bathroom Fixtures", priceMin: "2500.00", priceTypical: "4000.00", priceMax: "6000.00", unit: "set", publisher: "Grohe", reliabilityGrade: "A" as const, confidenceScore: 88, sourceUrl: "https://grohe.ae/bathroom", title: "Grohe UAE Product Range" },
      { recordId: "MYR-PE-0008", category: "kitchen" as const, itemName: "Miele Built-in Appliance Package", specClass: "Kitchen Appliances", priceMin: "25000.00", priceTypical: "45000.00", priceMax: "75000.00", unit: "set", publisher: "Miele", reliabilityGrade: "A" as const, confidenceScore: 92, sourceUrl: "https://miele.ae/domestic/kitchen", title: "Miele UAE Kitchen Systems" },
      { recordId: "MYR-PE-0009", category: "ffe" as const, itemName: "Belgian Linen Upholstery Fabric", specClass: "Upholstery", priceMin: "180.00", priceTypical: "280.00", priceMax: "380.00", unit: "lm", publisher: "Libeco", reliabilityGrade: "B" as const, confidenceScore: 72, sourceUrl: "https://libeco.com/collections", title: "Libeco Fabric Collections" },
      { recordId: "MYR-PE-0010", category: "hardware" as const, itemName: "Brushed Brass Door Hardware Set", specClass: "Architectural Hardware", priceMin: "150.00", priceTypical: "250.00", priceMax: "400.00", unit: "piece", publisher: "Armac Martin", reliabilityGrade: "B" as const, confidenceScore: 68, sourceUrl: "https://armacmartin.co.uk/collections", title: "Armac Martin Hardware" },
      { recordId: "MYR-PE-0011", category: "floors" as const, itemName: "Crema Marfil Marble Floor Tile", specClass: "Natural Stone", priceMin: "180.00", priceTypical: "260.00", priceMax: "350.00", unit: "sqm", publisher: "UAE Stone Traders", reliabilityGrade: "B" as const, confidenceScore: 65, sourceUrl: "https://uaetraders.com/stone", title: "UAE Stone Trading Market" },
      { recordId: "MYR-PE-0012", category: "walls" as const, itemName: "Zellige Handmade Tile — Morocco", specClass: "Artisan Tile", priceMin: "320.00", priceTypical: "480.00", priceMax: "650.00", unit: "sqm", publisher: "Emery et Cie", reliabilityGrade: "C" as const, confidenceScore: 58, sourceUrl: "https://emeryetcie.com/tiles", title: "Emery et Cie Zellige" },
      { recordId: "MYR-PE-0013", category: "ceilings" as const, itemName: "Acoustic Felt Ceiling Panel", specClass: "Acoustic Treatment", priceMin: "200.00", priceTypical: "320.00", priceMax: "450.00", unit: "sqm", publisher: "BuzzrSpace", reliabilityGrade: "B" as const, confidenceScore: 70, sourceUrl: "https://buzzrspace.com/products", title: "BuzzrSpace Acoustic Solutions" },
      { recordId: "MYR-PE-0014", category: "walls" as const, itemName: "Recycled Glass Mosaic Tile", specClass: "Glass", priceMin: "350.00", priceTypical: "500.00", priceMax: "700.00", unit: "sqm", publisher: "Sicis", reliabilityGrade: "B" as const, confidenceScore: 73, sourceUrl: "https://sicis.com/mosaic", title: "Sicis Mosaic Collections" },
      { recordId: "MYR-PE-0015", category: "floors" as const, itemName: "American Walnut Solid Flooring", specClass: "Solid Wood", priceMin: "450.00", priceTypical: "620.00", priceMax: "800.00", unit: "sqm", publisher: "Havwoods", reliabilityGrade: "B" as const, confidenceScore: 71, sourceUrl: "https://havwoods.com/ae/walnut", title: "Havwoods Walnut Range" },
    ];

    let seeded = 0;
    for (const ev of EVIDENCE) {
      await db.createEvidenceRecord({
        ...ev,
        captureDate: now,
        currencyOriginal: "AED",
        evidencePhase: "concept",
        createdBy: ctx.user.id,
      });
      seeded++;
    }

    return { seeded, message: `${seeded} evidence records seeded` };
  }),

  seedEnrichedData: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();

    // 1. Enriched Materials
    const ENRICHED_MATERIALS = [
      { name: "Statuario Marble Natural", category: "stone" as const, tier: "ultra_luxury" as const, typicalCostLow: "3200.00", typicalCostHigh: "4500.00", costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "long" as const, supplierName: "Sanipex / Arifeen", notes: "Premium natural Statuario marble with distinct veining" },
      { name: "Calacatta Oro Natural", category: "stone" as const, tier: "luxury" as const, typicalCostLow: "675.00", typicalCostHigh: "950.00", costUnit: "AED/sqm", leadTimeDays: 75, leadTimeBand: "long" as const, supplierName: "Sanipex", notes: "Classic Italian Calacatta Oro marble" },
      { name: "Calacatta Gold Porcelain Big Slab", category: "tile" as const, tier: "premium" as const, typicalCostLow: "550.00", typicalCostHigh: "825.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short" as const, supplierName: "Tile King", notes: "160x320 cm format, 12mm thickness" },
      { name: "Statuario Porcelain 120x120", category: "tile" as const, tier: "mid" as const, typicalCostLow: "90.00", typicalCostHigh: "130.00", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short" as const, supplierName: "Tilesman", notes: "High-quality marble-look porcelain" },
      { name: "European Oak Herringbone", category: "wood" as const, tier: "premium" as const, typicalCostLow: "315.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Floors Dubai", notes: "Natural oak in herringbone pattern" },
      { name: "American Walnut Herringbone", category: "wood" as const, tier: "luxury" as const, typicalCostLow: "380.00", typicalCostHigh: "550.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium" as const, supplierName: "Floors Dubai", notes: "Premium walnut in herringbone pattern" },
      { name: "Jotun Fenomastic Wonderwall", category: "paint" as const, tier: "mid" as const, typicalCostLow: "75.00", typicalCostHigh: "85.00", costUnit: "AED/L", leadTimeDays: 2, leadTimeBand: "short" as const, supplierName: "Jotun / ACE", notes: "Durable interior paint with smooth finish" },
      { name: "RAK Bianco Vena High Glossy", category: "tile" as const, tier: "mid" as const, typicalCostLow: "45.00", typicalCostHigh: "65.00", costUnit: "AED/sqm", leadTimeDays: 7, leadTimeBand: "short" as const, supplierName: "RAK Ceramics", notes: "40x80 cm glossy porcelain tile" },
    ];

    let materialsSeeded = 0;
    for (const mat of ENRICHED_MATERIALS) {
      await db.createMaterial({
        ...mat,
        regionAvailability: ["UAE", "GCC"],
        isActive: true,
      });
      materialsSeeded++;
    }

    // 2. Enriched Evidence Records
    const ENRICHED_EVIDENCE = [
      { recordId: "MYR-EV-2024-001", category: "floors" as const, itemName: "Statuario A Slab 12mm", specClass: "Natural Stone", priceMin: "620.00", priceTypical: "880.00", priceMax: "1200.00", unit: "sqm", publisher: "Sanipex Group", reliabilityGrade: "A" as const, confidenceScore: 90, sourceUrl: "https://www.sanipexgroup.com", title: "Sanipex Statuario Pricing 2024" },
      { recordId: "MYR-EV-2024-002", category: "floors" as const, itemName: "Oak Distressed Engineered", specClass: "Engineered Wood", priceMin: "185.00", priceTypical: "275.00", priceMax: "350.00", unit: "sqm", publisher: "Floors Dubai", reliabilityGrade: "A" as const, confidenceScore: 85, sourceUrl: "https://www.floorsdubai.com", title: "Floors Dubai Oak Specials" },
      { recordId: "MYR-EV-2024-003", category: "floors" as const, itemName: "RAK 30x60 Bianco Vena", specClass: "Porcelain", priceMin: "22.50", priceTypical: "29.00", priceMax: "45.00", unit: "sqm", publisher: "Plaza Middle East", reliabilityGrade: "A" as const, confidenceScore: 95, sourceUrl: "https://plazamiddleeast.com", title: "RAK Ceramics Price List" },
      { recordId: "MYR-EV-2024-004", category: "floors" as const, itemName: "American Walnut 3-Strip", specClass: "Engineered Wood", priceMin: "172.00", priceTypical: "295.00", priceMax: "400.00", unit: "sqm", publisher: "Floors Dubai", reliabilityGrade: "A" as const, confidenceScore: 88, sourceUrl: "https://www.floorsdubai.com", title: "Walnut Flooring Benchmarks" },
      { recordId: "MYR-EV-2024-005", category: "walls" as const, itemName: "Jotun Fenomastic White 4L", specClass: "Paint", priceMin: "150.00", priceTypical: "190.00", priceMax: "220.00", unit: "unit", publisher: "Noon / Jotun", reliabilityGrade: "A" as const, confidenceScore: 92, sourceUrl: "https://www.noon.com", title: "Jotun Retail Pricing" },
    ];

    let evidenceSeeded = 0;
    for (const ev of ENRICHED_EVIDENCE) {
      await db.createEvidenceRecord({
        ...ev,
        captureDate: now,
        currencyOriginal: "AED",
        evidencePhase: "concept",
        createdBy: ctx.user.id,
      });
      evidenceSeeded++;
    }

    return {
      message: "Enriched data seeded successfully",
      materialsSeeded,
      evidenceSeeded
    };
  }),
});
