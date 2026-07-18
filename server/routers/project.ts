import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  orgAdminProcedure,
  orgHeavyMutationProcedure,
  orgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import { requireProjectForOrg } from "../_core/project-access";
import { requireProjectResourceForOrg } from "../_core/resource-access";
import * as db from "../db";
import { evaluate, computeROI, type EvaluationConfig } from "../engines/scoring";
import { runSensitivityAnalysis } from "../engines/sensitivity";
import { generateValidationSummary, generateDesignBrief, generateFullReport } from "../engines/report";
import { generateReportHTML, type PDFReportInput } from "../engines/pdf-report";
import { buildBoardAnnexData, type BoardAnnexData } from "../engines/board-annex";
import { buildWorkflowSpaceMqiReconciliation } from "../engines/report-reconciliation";
import { generateDesignBrief as generateNewDesignBrief } from "../engines/design-brief";
import { storageGet, storagePut } from "../storage";
import { nanoid } from "nanoid";
import type { ProjectInputs } from "../../shared/miyar-types";
import {
  createInitialProvenance,
  EVALUATION_REQUIRED_FIELDS,
  getProjectReadiness,
  INPUT_PROVENANCE_STATUSES,
  type InputProvenance,
} from "../../shared/project-readiness";
import { tierToDes05 } from "../engines/sustainability/sustainability-multipliers";
import { computeRoi, type RoiInputs } from "../engines/roi";
import { computeFiveLens } from "../engines/five-lens";
import { computeDerivedFeatures } from "../engines/intelligence";
import { getPricingArea } from "../engines/area-utils";
import { SCENARIO_TEMPLATES, getScenarioTemplate, solveConstraints, type Constraint } from "../engines/scenario-templates";
import { dispatchWebhook } from "../engines/webhook";
import { generateInsights, type InsightInput } from "../engines/analytics/insight-generator";
import { generateAutonomousDesignBrief } from "../engines/autonomous/document-generator";
import {
  cleanupRejectedUpload,
  reportIndeterminateUploadPersistence,
} from "../_core/upload-compensation";
import { readValidatedProjectMedia } from "../_core/project-media";
import { resolveSpaceEfficiencyEvidence } from "../engines/space-evidence";

/**
 * Build evaluation config that respects the Logic Registry.
 * If a published logic version exists, its dimension weights override the model version defaults.
 * This ensures the scoring engine uses the weights configured in the Logic Registry admin UI.
 */
async function buildEvalConfig(
  modelVersion: NonNullable<Awaited<ReturnType<typeof db.getActiveModelVersion>>>,
  expectedCost: number,
  benchmarkCount: number,
  overrideRate = 0
): Promise<EvaluationConfig> {
  const baseWeights = modelVersion.dimensionWeights as Record<string, number>;

  // Check if a published logic version exists with custom weights
  const publishedLogic = await db.getPublishedLogicVersion();
  let dimensionWeights = baseWeights;

  if (publishedLogic) {
    const logicWeightRows = await db.getLogicWeights(publishedLogic.id);
    if (logicWeightRows.length > 0) {
      const logicWeightsMap: Record<string, number> = {};
      for (const w of logicWeightRows) {
        logicWeightsMap[w.dimension] = parseFloat(w.weight);
      }
      // Only override if we have all 5 dimensions
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
    overrideRate,
  };
}

// V4 — Typed schemas for archetype-specific data
const unitMixItemSchema = z.object({
  unitType: z.string(),
  areaSqm: z.number().min(0),
  count: z.number().int().min(1),
  includeInFitout: z.boolean().default(true),
});

const villaSpaceSchema = z.object({
  floor: z.string(),
  rooms: z.array(z.object({
    name: z.string(),
    areaSqm: z.number().min(0),
  })),
});

const projectInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  ctx01Typology: z.enum(["Residential", "Mixed-use", "Hospitality", "Office", "Villa", "Gated Community", "Villa Development"]).default("Residential"),
  ctx02Scale: z.enum(["Small", "Medium", "Large"]).default("Medium"),
  ctx03Gfa: z.number().nullable().optional(),
  // V4 — Fit-out area fields
  totalFitoutArea: z.number().nullable().optional(),
  totalNonFinishArea: z.number().nullable().optional(),
  projectArchetype: z.enum(["residential_multi", "office", "single_villa", "hospitality", "community"]).optional(),
  officeFitoutCategory: z.enum(["catA", "catB"]).optional(),
  officeCustomRatio: z.number().min(0).max(100).nullable().optional(),
  ctx04Location: z.enum(["Prime", "Secondary", "Emerging"]).default("Secondary"),
  ctx05Horizon: z.enum(["0-12m", "12-24m", "24-36m", "36m+"]).default("12-24m"),
  str01BrandClarity: z.number().min(1).max(5).default(3),
  str02Differentiation: z.number().min(1).max(5).default(3),
  str03BuyerMaturity: z.number().min(1).max(5).default(3),
  mkt01Tier: z.enum(["Mid", "Upper-mid", "Luxury", "Ultra-luxury"]).default("Upper-mid"),
  mkt02Competitor: z.number().min(1).max(5).default(3),
  mkt03Trend: z.number().min(1).max(5).default(3),
  fin01BudgetCap: z.number().nullable().optional(),
  fin02Flexibility: z.number().min(1).max(5).default(3),
  fin03ShockTolerance: z.number().min(1).max(5).default(3),
  fin04SalesPremium: z.number().min(1).max(5).default(3),
  des01Style: z.enum(["Modern", "Contemporary", "Minimal", "Classic", "Fusion", "Other"]).default("Modern"),
  des02MaterialLevel: z.number().min(1).max(5).default(3),
  des03Complexity: z.number().min(1).max(5).default(3),
  des04Experience: z.number().min(1).max(5).default(3),
  des05Sustainability: z.number().min(1).max(5).default(2),
  exe01SupplyChain: z.number().min(1).max(5).default(3),
  exe02Contractor: z.number().min(1).max(5).default(3),
  exe03Approvals: z.number().min(1).max(5).default(2),
  exe04QaMaturity: z.number().min(1).max(5).default(3),
  add01SampleKit: z.boolean().default(false),
  add02PortfolioMode: z.boolean().default(false),
  add03DashboardExport: z.boolean().default(true),

  // V5: Concrete Analytics Inputs
  developerType: z.enum(["Master Developer", "Private/Boutique", "Institutional Investor"]).optional(),
  targetDemographic: z.enum(["HNWI", "Families", "Young Professionals", "Investors"]).optional(),
  salesStrategy: z.enum(["Sell Off-Plan", "Sell on Completion", "Build-to-Rent"]).optional(),
  competitiveDensity: z.enum(["Low", "Moderate", "Saturated"]).optional(),
  projectUsp: z.enum(["Location/Views", "Amenities/Facilities", "Price/Value", "Design/Architecture"]).optional(),
  targetYield: z.enum(["< 5%", "5-7%", "7-9%", "> 9%"]).optional(),
  procurementStrategy: z.enum(["Turnkey", "Traditional", "Construction Management"]).optional(),
  amenityFocus: z.enum(["Wellness/Spa", "F&B/Social", "Minimal/Essential", "Business/Co-working"]).optional(),
  techIntegration: z.enum(["Basic", "Smart Home Ready", "Fully Integrated"]).optional(),
  materialSourcing: z.enum(["Local", "European", "Asian", "Global Mix"]).optional(),
  handoverCondition: z.enum(["Shell & Core", "Category A", "Category B", "Fully Furnished"]).optional(),
  brandedStatus: z.enum(["Unbranded", "Hospitality Branded", "Fashion/Automotive Branded"]).optional(),
  salesChannel: z.enum(["Local Brokerage", "International Roadshows", "Direct to VIP"]).optional(),
  lifecycleFocus: z.enum(["Short-term Resale", "Medium-term Hold", "Long-term Retention"]).optional(),
  brandStandardConstraints: z.enum(["High Flexibility", "Moderate Guidelines", "Strict Vendor List"]).optional(),
  timelineFlexibility: z.enum(["Highly Flexible", "Moderate Contingency", "Fixed / Zero Tolerance"]).optional(),
  targetValueAdd: z.enum(["Max Capital Appreciation", "Max Rental Yield", "Balanced Return", "Brand Flagship / Trophy"]).optional(),

  unitMix: z.array(unitMixItemSchema).optional(),
  villaSpaces: z.array(villaSpaceSchema).optional(),
  developerGuidelines: z.any().optional(),
  // DLD integration fields
  dldAreaId: z.number().nullable().optional(),
  dldAreaName: z.string().optional(),
  projectPurpose: z.enum(["sell_offplan", "sell_ready", "rent", "mixed"]).default("sell_ready"),
  // City & Sustainability Certification
  city: z.enum(["Dubai", "Abu Dhabi"]).default("Dubai"),
  sustainCertTarget: z.string().default("silver"),
  inputProvenance: z.record(z.string(), z.enum(INPUT_PROVENANCE_STATUSES)).optional(),
});

function projectToInputs(p: any): ProjectInputs {
  return {
    ctx01Typology: p.ctx01Typology ?? "Residential",
    ctx02Scale: p.ctx02Scale ?? "Medium",
    ctx03Gfa: p.ctx03Gfa ? Number(p.ctx03Gfa) : null,
    totalFitoutArea: p.totalFitoutArea ? Number(p.totalFitoutArea) : null,
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
    des05Sustainability: p.des05Sustainability ?? tierToDes05(p.sustainCertTarget || "silver"),
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true,

    // V5 Concrete Analytics
    developerType: p.developerType,
    targetDemographic: p.targetDemographic,
    salesStrategy: p.salesStrategy,
    competitiveDensity: p.competitiveDensity,
    projectUsp: p.projectUsp,
    targetYield: p.targetYield,
    procurementStrategy: p.procurementStrategy,
    amenityFocus: p.amenityFocus,
    techIntegration: p.techIntegration,
    materialSourcing: p.materialSourcing,
    handoverCondition: p.handoverCondition,
    brandedStatus: p.brandedStatus,
    salesChannel: p.salesChannel,
    lifecycleFocus: p.lifecycleFocus,
    brandStandardConstraints: p.brandStandardConstraints,
    timelineFlexibility: p.timelineFlexibility,
    targetValueAdd: p.targetValueAdd,

    city: p.city ?? "Dubai",
    sustainCertTarget: p.sustainCertTarget || "silver",

    // Phase 9: Will be populated during evaluation if floor plan analyzed
    spaceEfficiencyScore: undefined,
    spaceCriticalCount: undefined,
    spaceEfficiencyEvidence: undefined,
  };
}

export const projectRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return db.getProjectsByOrg(ctx.orgId);
  }),

  listWithScores: orgProcedure.query(async ({ ctx }) => {
    const projectList = await db.getProjectsByOrg(ctx.orgId);
    const result = await Promise.all(
      projectList.map(async (p: any) => {
        const scores = await db.getScoreMatricesByProject(p.id);
        const latest = scores.length > 0 ? scores[0] : null;
        return {
          ...p,
          latestScore: latest
            ? {
              compositeScore: Number(latest.compositeScore),
              rasScore: Number(latest.rasScore),
              confidenceScore: Number(latest.confidenceScore),
              decisionStatus: latest.decisionStatus,
              computedAt: latest.computedAt,
            }
            : null,
        };
      })
    );
    return result;
  }),

  get: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return requireProjectForOrg(input.id, ctx.orgId);
    }),

  readiness: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.id, ctx.orgId);
      return getProjectReadiness(project as unknown as Record<string, unknown>);
    }),

  create: orgMutationProcedure
    .input(projectInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await db.createProject({
        ...input,
        inputProvenance: createInitialProvenance(input.inputProvenance),
        userId: ctx.user.id,
        orgId: ctx.orgId,
        status: "draft",
        ctx03Gfa: input.ctx03Gfa ? String(input.ctx03Gfa) as any : null,
        totalFitoutArea: input.totalFitoutArea ? String(input.totalFitoutArea) as any : null,
        totalNonFinishArea: input.totalNonFinishArea ? String(input.totalNonFinishArea) as any : null,
        fin01BudgetCap: input.fin01BudgetCap ? String(input.fin01BudgetCap) as any : null,
        officeCustomRatio: input.officeCustomRatio != null ? String(input.officeCustomRatio) as any : null,
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.create",
        entityType: "project",
        entityId: result.id,
      });
      // Dispatch webhook
      dispatchWebhook("project.created", { projectId: result.id, name: input.name, tier: input.mkt01Tier }).catch(() => { });
      return result;
    }),

  confirmInputs: orgMutationProcedure
    .input(z.object({
      id: z.number(),
      fields: z.array(z.enum(EVALUATION_REQUIRED_FIELDS)).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.id, ctx.orgId);
      const existing = createInitialProvenance(
        (project.inputProvenance ?? {}) as Partial<InputProvenance>
      );
      for (const field of input.fields) {
        const value = (project as any)[field];
        if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${field} must have a value before it can be confirmed`,
          });
        }
        existing[field] = "confirmed";
      }
      if (!(await db.updateProjectForOrg(input.id, ctx.orgId, { inputProvenance: existing }))) {
        await requireProjectForOrg(input.id, ctx.orgId);
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.inputs.confirm",
        entityType: "project",
        entityId: input.id,
        details: { fields: input.fields },
      });
      return getProjectReadiness({ ...project, inputProvenance: existing } as unknown as Record<string, unknown>);
    }),

  update: orgMutationProcedure
    .input(z.object({ id: z.number() }).merge(projectInputSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await requireProjectForOrg(id, ctx.orgId);
      if (project.status === "locked") {
        throw new Error("Cannot update a locked project");
      }
      const updateData: any = { ...data };
      if (data.ctx03Gfa !== undefined) updateData.ctx03Gfa = data.ctx03Gfa ? String(data.ctx03Gfa) : null;
      if (data.fin01BudgetCap !== undefined) updateData.fin01BudgetCap = data.fin01BudgetCap ? String(data.fin01BudgetCap) : null;
      if (data.officeCustomRatio !== undefined) updateData.officeCustomRatio = data.officeCustomRatio != null ? String(data.officeCustomRatio) : null;
      if (data.totalFitoutArea !== undefined) updateData.totalFitoutArea = data.totalFitoutArea ? String(data.totalFitoutArea) : null;
      if (data.totalNonFinishArea !== undefined) updateData.totalNonFinishArea = data.totalNonFinishArea ? String(data.totalNonFinishArea) : null;
      if (!(await db.updateProjectForOrg(id, ctx.orgId, updateData))) {
        await requireProjectForOrg(id, ctx.orgId);
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.update",
        entityType: "project",
        entityId: id,
        details: data,
      });
      return { success: true };
    }),

  delete: orgAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectForOrg(input.id, ctx.orgId);
      if (!(await db.deleteProjectForOrg(input.id, ctx.orgId))) {
        await requireProjectForOrg(input.id, ctx.orgId);
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.delete",
        entityType: "project",
        entityId: input.id,
      });
      return { success: true };
    }),

  evaluate: orgHeavyMutationProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.id, ctx.orgId);
      const readiness = getProjectReadiness(project as unknown as Record<string, unknown>);
      if (!readiness.canEvaluate) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Project inputs are incomplete: ${readiness.missingInputs.length} missing and ${readiness.unconfirmedAssumptions.length} unconfirmed`,
          cause: readiness,
        });
      }

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) throw new Error("No active model version found");

      const inputs = projectToInputs(project);

      let expectedCost = await db.getExpectedCost(
        inputs.ctx01Typology,
        inputs.ctx04Location,
        inputs.mkt01Tier
      );

      // Phase B.3: Override with DLD area-specific fitout benchmark if available
      if (project.dldAreaId) {
        const dldBenchmark = await db.getDldAreaBenchmark(project.dldAreaId);
        if (dldBenchmark?.recommendedFitoutMid) {
          expectedCost = Number(dldBenchmark.recommendedFitoutMid);
          console.log(`[Evaluate] Using DLD fitout benchmark: ${expectedCost} AED/sqm for area ${project.dldAreaName || project.dldAreaId}`);
        }
      }

      // Phase 8: Fetch real-world material costs from tied boards to override budgets
      const boards = await db.getMaterialBoardsByProject(input.id);
      if (boards && boards.length > 0) {
        const activeBoard = boards[0];
        const boardMaterials = await db.getMaterialsByBoard(activeBoard.id);

        let totalLow = 0;
        let totalHigh = 0;
        let totalVariance = 0;

        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            const qty = Number(bm.quantity) || 1;
            totalLow += (Number(mat.typicalCostLow) || 0) * qty;
            totalHigh += (Number(mat.typicalCostHigh) || 0) * qty;
            const matMaint = parseFloat(String(mat.maintenanceFactor || "0.05"));
            totalVariance += (matMaint - 0.05) * 100;
          }
        }

        if (totalHigh > 0) {
          inputs.boardMaterialsCost = (totalLow + totalHigh) / 2;
          inputs.boardMaintenanceVariance = totalVariance;
          console.log(`[Evaluate] Using vendor cost override: ${inputs.boardMaterialsCost} AED for project ${input.id}`);
        }
      }

      const benchmarks = await db.getBenchmarks(
        inputs.ctx01Typology,
        inputs.ctx04Location,
        inputs.mkt01Tier
      );

      // Phase 9: Inject space efficiency from floor plan analysis
      if (project.floorPlanAnalysis) {
        try {
          const { benchmarkSpaceRatios } = await import("../engines/design/space-benchmarking");
          const analysis = typeof project.floorPlanAnalysis === "string"
            ? JSON.parse(project.floorPlanAnalysis)
            : project.floorPlanAnalysis;

          // Get DLD area context for data-backed recommendations
          let areaNameForBench = project.dldAreaName || inputs.ctx04Location || "Dubai";
          let transCount = 0;
          let saleP50: number | null = null;
          if (project.dldAreaId) {
            const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
            if (dldBench) {
              areaNameForBench = dldBench.areaNameEn || areaNameForBench;
              transCount = dldBench.saleTransactionCount ? Number(dldBench.saleTransactionCount) : 0;
              saleP50 = dldBench.saleP50 ? Number(dldBench.saleP50) : null;
            }
          }

          const spaceResult = benchmarkSpaceRatios(
            analysis,
            areaNameForBench,
            transCount,
            saleP50
          );
          inputs.spaceEfficiencyScore = spaceResult.overallEfficiencyScore;
          inputs.spaceCriticalCount = spaceResult.totalCritical;
          inputs.spaceEfficiencyEvidence = spaceResult.evidence;
          console.log(`[Evaluate] Space efficiency: ${spaceResult.overallEfficiencyScore}/100, ${spaceResult.totalCritical} critical deviations`);

          // Phase 9 Gap 6: Space-critical tenant insight
          if (spaceResult.totalCritical >= 2) {
            try {
              const hasDldAreaContext =
                spaceResult.evidence.status === "measured" &&
                spaceResult.evidence.benchmarkBasis === "dld_area" &&
                spaceResult.evidence.transactionCount > 0;
              const criticalRooms = spaceResult.recommendations
                .filter(r => r.severity === "critical")
                .map(r => `${r.roomName} (${r.currentPercent}% vs ${r.benchmarkPercent}% benchmark)`)
                .join(", ");
              await db.insertProjectInsightForOrg({
                projectId: input.id,
                insightType: "positioning_gap",
                severity: "warning",
                title: `Space Planning: ${spaceResult.totalCritical} Critical Deviations`,
                body: hasDldAreaContext
                  ? `Project floor plan has ${spaceResult.totalCritical} rooms significantly outside MIYAR ratio guidelines: ${criticalRooms}. Efficiency score: ${spaceResult.overallEfficiencyScore}/100. DLD transaction count is shown separately as area context and does not calibrate the guideline.`
                  : `Project floor plan has ${spaceResult.totalCritical} rooms significantly outside MIYAR UAE space benchmarks: ${criticalRooms}. Efficiency score: ${spaceResult.overallEfficiencyScore}/100.`,
                actionableRecommendation: hasDldAreaContext
                  ? "Review floor plan allocations in Space Planner against the MIYAR ratio guideline; treat DLD records as separate area context."
                  : "Review floor plan allocations in Space Planner against the MIYAR UAE space benchmark.",
                dataPoints: { spaceResult },
              }, ctx.orgId);
            } catch (alertErr) {
              console.warn("[Phase9] Space insight creation failed (non-blocking):", alertErr);
            }
          }
        } catch (e) {
          console.warn("[Evaluate] Space benchmarking failed (non-blocking):", e);
        }
      }

      // V4-11: Check if we have enough evidence for evidence-backed cost
      const evidenceRecords = await db.listOrganizationEvidenceRecords(ctx.orgId, {
        projectId: input.id,
        limit: 500,
      });
      const budgetFitMethod = evidenceRecords.length >= 20 ? "evidence_backed" : "benchmark_static";

      const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);

      const scoreResult = evaluate(inputs, config);

      // Get active benchmark version for tracking
      const activeBV = await db.getActiveBenchmarkVersion();

      const matrixResult = await db.createScoreMatrix({
        projectId: input.id,
        modelVersionId: modelVersion.id,
        benchmarkVersionId: activeBV?.id ?? null,
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
        budgetFitMethod,
      });

      // Compute and store project intelligence
      try {
        const allBenchmarks = await db.getAllBenchmarkData();
        const allScores = (await db.getComparableScoreMatricesForOrg(ctx.orgId))
          .map((row: any) => row.scoreMatrix);
        const latestMatrix = await db.getScoreMatrixById(matrixResult.id);
        if (latestMatrix) {
          const derived = computeDerivedFeatures(project as any, latestMatrix as any, allBenchmarks as any, allScores as any);
          await db.createProjectIntelligence({
            projectId: input.id,
            scoreMatrixId: matrixResult.id,
            benchmarkVersionId: activeBV?.id ?? null,
            costDeltaVsBenchmark: String(derived.costDeltaVsBenchmark) as any,
            uniquenessIndex: String(derived.uniquenessIndex) as any,
            feasibilityFlags: derived.feasibilityFlags,
            reworkRiskIndex: String(derived.reworkRiskIndex) as any,
            procurementComplexity: String(derived.procurementComplexity) as any,
            tierPercentile: String(derived.tierPercentile) as any,
            styleFamily: derived.styleFamily,
            costBand: derived.costBand,
          });
        }
      } catch (e) {
        console.warn("[Intelligence] Failed to compute derived features:", e);
      }

      // V11: Cognitive Bias Detection
      try {
        const { detectBiases } = await import("../engines/bias/bias-detector");
        const evalHistory = await db.getProjectEvaluationHistory(input.id);
        const overrideStats = await db.getUserOverrideStats(input.id);

        const previousScores = evalHistory
          .filter((m: any) => m.id !== matrixResult.id)
          .map((m: any) => Number(m.compositeScore));
        const previousBudgets = evalHistory
          .filter((m: any) => m.id !== matrixResult.id)
          .map((m: any) => {
            const snap = m.inputSnapshot as any;
            return Number(snap?.fin01BudgetCap || 0);
          });

        const biasCtx = {
          projectId: input.id,
          userId: ctx.user.id,
          orgId: ctx.orgId,
          evaluationCount: evalHistory.length,
          previousScores,
          previousBudgets,
          overrideCount: overrideStats.count,
          overrideNetEffect: overrideStats.netEffect,
          marketTrendActual: null as number | null,
        };

        const biasAlerts = detectBiases(inputs, scoreResult, biasCtx);

        if (biasAlerts.length > 0) {
          const severityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
          await db.createBiasAlerts(
            biasAlerts.map(alert => ({
              projectId: input.id,
              scoreMatrixId: matrixResult.id,
              userId: ctx.user.id,
              orgId: ctx.orgId,
              biasType: alert.biasType as any,
              severity: alert.severity as any,
              confidence: String(alert.confidence) as any,
              title: alert.title,
              description: alert.description,
              intervention: alert.intervention,
              evidencePoints: alert.evidencePoints,
              mathExplanation: alert.mathExplanation,
            }))
          );

          // Update bias profiles
          for (const alert of biasAlerts) {
            await db.upsertBiasProfile(
              ctx.user.id,
              ctx.orgId,
              alert.biasType,
              severityMap[alert.severity] || 2
            );
          }

          console.log(`[V11] Detected ${biasAlerts.length} cognitive bias(es) for project ${input.id}`);
        }
      } catch (e) {
        console.warn("[V11] Bias detection failed (non-blocking):", e);
      }

      if (!(await db.updateProjectForOrg(input.id, ctx.orgId, {
        status: "evaluated",
        modelVersionId: modelVersion.id,
        benchmarkVersionId: activeBV?.id ?? null,
      }))) {
        await requireProjectForOrg(input.id, ctx.orgId);
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.evaluate",
        entityType: "score_matrix",
        entityId: matrixResult.id,
        details: { compositeScore: scoreResult.compositeScore, decisionStatus: scoreResult.decisionStatus },
        benchmarkVersionId: activeBV?.id,
      });

      // Dispatch webhook
      dispatchWebhook("project.evaluated", {
        projectId: input.id,
        name: project.name,
        compositeScore: scoreResult.compositeScore,
        decisionStatus: scoreResult.decisionStatus,
        riskScore: scoreResult.riskScore,
      }).catch(() => { });

      // V3-09: Generate project insights after evaluation
      try {
        const trendSnaps = await db.getTrendSnapshotsForOrg(ctx.orgId, { limit: 50 });
        const trends = trendSnaps.map((s: any) => ({
          metric: s.metric,
          category: s.category,
          direction: s.direction || "stable",
          percentChange: s.percentChange ? parseFloat(String(s.percentChange)) : null,
          confidence: s.confidence || "low",
          currentMA: s.currentMA ? parseFloat(String(s.currentMA)) : null,
          previousMA: s.previousMA ? parseFloat(String(s.previousMA)) : null,
          anomalyCount: s.anomalyCount || 0,
        }));

        const insightInput: InsightInput = {
          trends,
          projectContext: {
            projectId: input.id,
            projectName: project.name || `Project #${input.id}`,
            segment: (project as any).segment,
            geography: (project as any).location,
          },
        };

        const insights = await generateInsights(insightInput, { enrichWithLLM: true });

        for (const insight of insights) {
          await db.insertProjectInsightForOrg({
            projectId: input.id,
            insightType: insight.type as any,
            severity: insight.severity,
            title: insight.title,
            body: insight.body,
            actionableRecommendation: insight.actionableRecommendation,
            confidenceScore: String(insight.confidenceScore),
            triggerCondition: insight.triggerCondition,
            dataPoints: insight.dataPoints,
          }, ctx.orgId);
        }

        console.log(`[V3-09] Generated ${insights.length} insights for project ${input.id}`);
      } catch (e) {
        console.warn("[V3-09] Insight generation failed (non-blocking):", e);
      }

      // Phase C.1+C.2: DLD Market Positioning + Over/Under-Spec Detection
      let dldMarketPosition = null;
      if (project.dldAreaId) {
        const { computeMarketPosition } = await import("../engines/dld-analytics");
        const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
        if (dldBench?.saleP50) {
          const fitoutCost = Number(project.fin01BudgetCap || expectedCost);
          const tierMap: Record<string, string> = { "Entry": "economy", "Mid": "mid", "Upper-mid": "premium", "Luxury": "luxury", "Ultra-luxury": "ultra_luxury" };
          dldMarketPosition = computeMarketPosition(
            fitoutCost,
            Number(dldBench.saleP50),
            tierMap[inputs.mkt01Tier] || "mid",
            dldBench.saleP25 ? Number(dldBench.saleP25) : undefined,
            dldBench.saleP75 ? Number(dldBench.saleP75) : undefined,
          );
          if (dldMarketPosition.riskFlag) {
            console.log(`[Evaluate] DLD Spec Risk: ${dldMarketPosition.riskFlag} — ${dldMarketPosition.riskMessage}`);
          }
        }
      }

      return { scoreMatrixId: matrixResult.id, ...scoreResult, dldMarketPosition };
    }),

  getScores: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      return db.getScoreMatricesByProject(input.projectId);
    }),

  sensitivity: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.id, ctx.orgId);

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) return [];

      const inputs = projectToInputs(project);
      const scoreMatrices = await db.getScoreMatricesByProject(input.id);
      const latestSnapshot = scoreMatrices[0]?.inputSnapshot as any;
      if (latestSnapshot) {
        const savedEvidence = resolveSpaceEfficiencyEvidence(latestSnapshot);
        const savedScore = Number(latestSnapshot.spaceEfficiencyScore);
        if (Number.isFinite(savedScore)) inputs.spaceEfficiencyScore = savedScore;
        inputs.spaceEfficiencyEvidence = savedEvidence.status === "legacy_unknown"
          ? undefined
          : savedEvidence;
      }
      const expectedCost = await db.getExpectedCost(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
      const benchmarks = await db.getBenchmarks(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);

      const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);

      return runSensitivityAnalysis(inputs, config);
    }),

  // ─── V2: ROI Narrative Engine ──────────────────────────────────────
  roi: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const scores = await db.getScoreMatricesByProject(input.projectId);
      if (scores.length === 0) return null;
      const latest = scores[0];

      // Get active ROI config
      const roiConfig = await db.getActiveRoiConfig();
      const coefficients = roiConfig ? {
        hourlyRate: Number(roiConfig.hourlyRate),
        reworkCostPct: Number(roiConfig.reworkCostPct),
        tenderIterationCost: Number(roiConfig.tenderIterationCost),
        designCycleCost: Number(roiConfig.designCycleCost),
        budgetVarianceMultiplier: Number(roiConfig.budgetVarianceMultiplier),
        timeAccelerationWeeks: roiConfig.timeAccelerationWeeks ?? 6,
        conservativeMultiplier: Number(roiConfig.conservativeMultiplier),
        aggressiveMultiplier: Number(roiConfig.aggressiveMultiplier),
      } : undefined;

      const roiInputs: RoiInputs = {
        compositeScore: Number(latest.compositeScore),
        riskScore: Number(latest.riskScore),
        confidenceScore: Number(latest.confidenceScore),
        budgetCap: Number(project.fin01BudgetCap || 0),
        gfa: getPricingArea(project),
        complexity: project.des03Complexity || 3,
        materialLevel: project.des02MaterialLevel || 3,
        tier: project.mkt01Tier || "Upper-mid",
        horizon: project.ctx05Horizon || "12-24m",
        spaceEfficiencyScore: Number((latest.inputSnapshot as any)?.spaceEfficiencyScore) || undefined,
        spaceEfficiencyEvidence: (() => {
          const evidence = resolveSpaceEfficiencyEvidence(latest.inputSnapshot as any);
          return evidence.status === "legacy_unknown" ? undefined : evidence;
        })(),
      };

      const roiResult = computeRoi(roiInputs, coefficients);

      // Phase C.3: Enrich ROI with DLD rental yield context
      let dldContext = null;
      if (project.dldAreaId) {
        const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
        if (dldBench) {
          dldContext = {
            areaName: project.dldAreaName || dldBench.areaNameEn,
            grossYield: dldBench.grossYield ? Number(dldBench.grossYield) : null,
            saleP50: dldBench.saleP50 ? Number(dldBench.saleP50) : null,
            projectPurpose: project.projectPurpose || "sell_ready",
            fitoutMid: dldBench.recommendedFitoutMid ? Number(dldBench.recommendedFitoutMid) : null,
          };
        }
      }

      return { ...roiResult, dldContext };
    }),

  // ─── V2: 5-Lens Validation Framework ──────────────────────────────
  fiveLens: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const scores = await db.getScoreMatricesByProject(input.projectId);
      if (scores.length === 0) return null;
      const latest = scores[0];

      const benchmarks = await db.getAllBenchmarkData();
      return computeFiveLens(project as any, latest as any, benchmarks as any);
    }),

  // ─── V2: Project Intelligence ─────────────────────────────────────
  intelligence: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const intel = await db.getProjectIntelligenceByProject(input.projectId);
      return intel.length > 0 ? intel[0] : null;
    }),

  // ─── V2: Scenario Templates ───────────────────────────────────────
  scenarioTemplates: orgProcedure.query(async () => {
    return SCENARIO_TEMPLATES;
  }),

  applyScenarioTemplate: orgHeavyMutationProcedure
    .input(z.object({
      projectId: z.number(),
      templateKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const template = getScenarioTemplate(input.templateKey);
      if (!template) throw new Error("Template not found");

      // Create scenario with template overrides
      const baseInputs = projectToInputs(project);
      const scenarioInputs = { ...baseInputs, ...template.overrides };

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) throw new Error("No active model version");

      // Phase 8: Fetch real-world material costs from tied boards to override budgets
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      if (boards && boards.length > 0) {
        const activeBoard = boards[0];
        const boardMaterials = await db.getMaterialsByBoard(activeBoard.id);

        let totalLow = 0;
        let totalHigh = 0;
        let totalVariance = 0;

        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            const qty = Number(bm.quantity) || 1;
            totalLow += (Number(mat.typicalCostLow) || 0) * qty;
            totalHigh += (Number(mat.typicalCostHigh) || 0) * qty;
            const matMaint = parseFloat(String(mat.maintenanceFactor || "0.05"));
            totalVariance += (matMaint - 0.05) * 100;
          }
        }

        if (totalHigh > 0) {
          scenarioInputs.boardMaterialsCost = (totalLow + totalHigh) / 2;
          scenarioInputs.boardMaintenanceVariance = totalVariance;
        }
      }

      const expectedCost = await db.getExpectedCost(scenarioInputs.ctx01Typology, scenarioInputs.ctx04Location, scenarioInputs.mkt01Tier);
      const benchmarks = await db.getBenchmarks(scenarioInputs.ctx01Typology, scenarioInputs.ctx04Location, scenarioInputs.mkt01Tier);

      const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);

      const scoreResult = evaluate(scenarioInputs as ProjectInputs, config);

      const result = await db.createScenarioRecordForOrg({
        projectId: input.projectId,
        name: template.name,
        description: template.description,
        variableOverrides: template.overrides,
        isTemplate: true,
        templateKey: input.templateKey,
      }, ctx.orgId);
      if (!result) {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        throw new Error("Failed to create scenario");
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "scenario.template_applied",
        entityType: "scenario",
        entityId: result.id,
        details: { templateKey: input.templateKey, score: scoreResult.compositeScore },
      });

      return { id: result.id, ...scoreResult, tradeoffs: template.tradeoffs };
    }),

  // ─── V2: Constraint Solver ────────────────────────────────────────
  solveConstraints: orgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      constraints: z.array(z.object({
        variable: z.string(),
        operator: z.enum(["eq", "gte", "lte", "in"]),
        value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      const baseProject = projectToInputs(project) as Record<string, any>;
      return solveConstraints(baseProject, input.constraints as Constraint[]);
    }),

  // ─── V2: Enhanced Report Generation ───────────────────────────────
  generateReport: orgHeavyMutationProcedure
    .input(z.object({
      projectId: z.number(),
      reportType: z.enum(["validation_summary", "design_brief", "full_report", "autonomous_design_brief"]),
      locale: z.enum(["en", "ar"]).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);

      // Issued report types that make board assertions must acquire one truthful,
      // organization-scoped snapshot before scoring, AI work, storage, audit, or
      // webhook side effects. A retrieval failure is not equivalent to no boards.
      const requiresBoardAnnex = input.reportType === "design_brief" || input.reportType === "full_report";
      let reportBoardSnapshot: Awaited<ReturnType<typeof db.getReportBoardSnapshotForOrg>> | null = null;
      let boardAnnex: BoardAnnexData | undefined;
      if (requiresBoardAnnex) {
        try {
          reportBoardSnapshot = await db.getReportBoardSnapshotForOrg(input.projectId, ctx.orgId);
          boardAnnex = buildBoardAnnexData(reportBoardSnapshot);
        } catch (error) {
          console.error("[Report] Board annex retrieval failed", {
            projectId: input.projectId,
            reportType: input.reportType,
            error: error instanceof Error ? error.message : String(error),
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "REPORT_BOARD_RETRIEVAL_FAILED",
          });
        }
      }

      const scores = await db.getScoreMatricesByProject(input.projectId);
      if (scores.length === 0) throw new Error("No scores available. Evaluate first.");
      const latest = scores[0];

      const inputs = projectToInputs(project);
      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) throw new Error("No active model version");

      // Phase 8: Fetch real-world material costs from tied boards to override budgets
      let boardMaterials: Array<any> = [];
      if (reportBoardSnapshot && reportBoardSnapshot.length > 0) {
        const activeBoard = reportBoardSnapshot[0];
        boardMaterials = activeBoard.resolvedItems.map((item: any) => ({
              materialId: item.materialId,
              quantity: item.quantity,
              material: {
                typicalCostLow: item.costLow,
                typicalCostHigh: item.costHigh,
                maintenanceFactor: item.maintenanceFactor,
              },
            }));
      } else if (!reportBoardSnapshot) {
        const legacyBoards = await db.getMaterialBoardsByProject(input.projectId);
        if (legacyBoards.length > 0) {
          boardMaterials = (await db.getMaterialsByBoard(legacyBoards[0].id)).map(item => ({
              ...item,
              material: null,
            }));
        }
      }

      if (boardMaterials.length > 0) {
        let totalLow = 0;
        let totalHigh = 0;
        let totalVariance = 0;

        for (const bm of boardMaterials) {
          const mat = bm.material ?? await db.getMaterialById(bm.materialId);
          if (mat) {
            const qty = Number(bm.quantity) || 1;
            totalLow += (Number(mat.typicalCostLow) || 0) * qty;
            totalHigh += (Number(mat.typicalCostHigh) || 0) * qty;
            const matMaint = parseFloat(String((mat as any).maintenanceFactor ?? "0.05"));
            totalVariance += (matMaint - 0.05) * 100;
          }
        }

        if (totalHigh > 0) {
          inputs.boardMaterialsCost = (totalLow + totalHigh) / 2;
          inputs.boardMaintenanceVariance = totalVariance;
        }
      }

      const expectedCost = await db.getExpectedCost(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
      const benchmarks = await db.getBenchmarks(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);

      const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);

      const scoreResult = {
        dimensions: {
          sa: Number(latest.saScore),
          ff: Number(latest.ffScore),
          mp: Number(latest.mpScore),
          ds: Number(latest.dsScore),
          er: Number(latest.erScore),
        },
        dimensionWeights: latest.dimensionWeights as any,
        compositeScore: Number(latest.compositeScore),
        riskScore: Number(latest.riskScore),
        rasScore: Number(latest.rasScore),
        confidenceScore: Number(latest.confidenceScore),
        decisionStatus: latest.decisionStatus as any,
        penalties: (latest.penalties ?? []) as any,
        riskFlags: (latest.riskFlags ?? []) as any,
        conditionalActions: (latest.conditionalActions ?? []) as any,
        variableContributions: latest.variableContributions as any,
        inputSnapshot: latest.inputSnapshot as any,
      };

      const sensitivityInputs = {
        ...inputs,
        spaceEfficiencyScore: Number((latest.inputSnapshot as any)?.spaceEfficiencyScore) || undefined,
        spaceEfficiencyEvidence: (() => {
          const evidence = resolveSpaceEfficiencyEvidence(latest.inputSnapshot as any);
          return evidence.status === "legacy_unknown" ? undefined : evidence;
        })(),
      };
      const sensitivity = runSensitivityAnalysis(sensitivityInputs, config);

      // V2: Compute 5-lens and ROI for full reports
      const allBenchmarks = await db.getAllBenchmarkData();
      const fiveLens = computeFiveLens(project as any, latest as any, allBenchmarks as any);

      const roiConfig = await db.getActiveRoiConfig();
      const coefficients = roiConfig ? {
        hourlyRate: Number(roiConfig.hourlyRate),
        reworkCostPct: Number(roiConfig.reworkCostPct),
        tenderIterationCost: Number(roiConfig.tenderIterationCost),
        designCycleCost: Number(roiConfig.designCycleCost),
        budgetVarianceMultiplier: Number(roiConfig.budgetVarianceMultiplier),
        timeAccelerationWeeks: roiConfig.timeAccelerationWeeks ?? 6,
        conservativeMultiplier: Number(roiConfig.conservativeMultiplier),
        aggressiveMultiplier: Number(roiConfig.aggressiveMultiplier),
      } : undefined;

      const roiInputs: RoiInputs = {
        compositeScore: Number(latest.compositeScore),
        riskScore: Number(latest.riskScore),
        confidenceScore: Number(latest.confidenceScore),
        budgetCap: Number(project.fin01BudgetCap || 0),
        gfa: getPricingArea(project),
        complexity: project.des03Complexity || 3,
        materialLevel: project.des02MaterialLevel || 3,
        tier: project.mkt01Tier || "Upper-mid",
        horizon: project.ctx05Horizon || "12-24m",
        spaceEfficiencyScore: Number((latest.inputSnapshot as any)?.spaceEfficiencyScore) || undefined,
        spaceEfficiencyEvidence: (() => {
          const evidence = resolveSpaceEfficiencyEvidence(latest.inputSnapshot as any);
          return evidence.status === "legacy_unknown" ? undefined : evidence;
        })(),
      };
      const roiResult = computeRoi(roiInputs, coefficients);

      // Build ROI for legacy report format
      const roi = input.reportType === "full_report"
        ? computeROI(inputs, scoreResult.compositeScore, 150000)
        : undefined;

      let reportData;
      let designArtifacts:
        Parameters<typeof db.createReportArtifactsForOrg>[0]["designArtifacts"];
      if (input.reportType === "validation_summary") {
        reportData = generateValidationSummary(project.name, project.id, inputs, scoreResult, sensitivity);
      } else if (input.reportType === "design_brief") {
        const { buildDesignVocabulary } = await import("../engines/design/vocabulary");
        const { buildSpaceProgram } = await import("../engines/design/space-program");
        const { buildFinishSchedule } = await import("../engines/design/finish-schedule");
        const { buildColorPalette } = await import("../engines/design/color-palette");
        const { buildRFQPack } = await import("../engines/design/rfq-generator");
        const { buildDMComplianceChecklist } = await import("../engines/design/dm-compliance");

        const vocab = buildDesignVocabulary(project);
        const { totalFitoutBudgetAed, rooms } = buildSpaceProgram(project);
        const materials = await db.getAllMaterials();
        const finishSchedule = buildFinishSchedule(project, vocab, rooms, materials);
        const colorPalette = await buildColorPalette(project, vocab);
        const complianceChecklist = buildDMComplianceChecklist(
          project.id,
          ctx.orgId,
          project
        );
        const rfqPack = buildRFQPack(
          project.id,
          ctx.orgId,
          finishSchedule,
          rooms,
          materials
        );
        designArtifacts = {
          finishSchedule,
          colorPalette,
          complianceChecklist,
          brief: {
            projectId: project.id,
            version: 1,
            createdBy: ctx.user.id,
            projectIdentity: { name: project.name, location: project.ctx04Location },
            designNarrative: {
              positioningStatement:
                colorPalette.geminiRationale || "Curated aesthetic alignment.",
            },
            materialSpecifications: { vocab, finishSchedule },
            boqFramework: { coreAllocations: [] },
            detailedBudget: { totalFitoutBudgetAed, rfqMin: 0, rfqMax: 0 },
            designerInstructions: { deliverablesChecklist: complianceChecklist },
          },
          rfqItems: rfqPack,
        };

        // Output legacy format for the PDF template to continue working seamlessly
        reportData = generateDesignBrief(project.name, project.id, inputs, scoreResult, sensitivity);
      } else if (input.reportType === "autonomous_design_brief") {
        const mdContent = await generateAutonomousDesignBrief(project.id, input.locale);
        reportData = {
          reportType: "autonomous_design_brief",
          generatedAt: new Date().toISOString(),
          projectName: project.name,
          projectId: project.id,
          content: mdContent
        };
      } else {
        reportData = generateFullReport(project.name, project.id, inputs, scoreResult, sensitivity, roi!);
      }

      // Get active benchmark version for tracking
      const activeBV = await db.getActiveBenchmarkVersion();
      const benchmarkVersionTag = activeBV?.versionTag || "v1.0-baseline";

      // Get published logic version for evidence trace
      const publishedLV = await db.getPublishedLogicVersion();
      const logicVersionTag = publishedLV?.name || "v1.0-default";

      // Get evidence references linked to this project
      let evidenceRefs: NonNullable<PDFReportInput["evidenceRefs"]> = [];
      try {
        const allEvidence = await db.listOrganizationEvidenceRecords(ctx.orgId, {
          projectId: input.projectId,
        });
        if (allEvidence.length > 0) {
          evidenceRefs = allEvidence
            .map((e: any) => ({
              title: e.title || e.itemName,
              sourceUrl: e.sourceUrl || undefined,
              category: e.category || undefined,
              reliabilityGrade: e.reliabilityGrade || undefined,
              captureDate: e.captureDate ? String(e.captureDate) : undefined,
              confidenceStatus: !e.currentConfidenceAssessmentId || !e.confidencePolicyVersion
                ? "legacy_unknown"
                : e.confidencePolicyVersion === "manual-asserted-confidence-v1"
                  ? "asserted"
                  : "computed",
              confidencePolicyVersion: e.confidencePolicyVersion || undefined,
            }));
        }
      } catch { /* evidence refs are optional */ }

      let workflowReconciliation: PDFReportInput["workflowReconciliation"];
      if (input.reportType === "full_report") {
        const [storedRooms, storedAllocations, materialLibrary] = await Promise.all([
          db.getSpaceProgramRooms(input.projectId, ctx.orgId),
          db.getMaterialAllocations(input.projectId, ctx.orgId),
          db.getMaterialLibrary(),
        ]);
        workflowReconciliation = buildWorkflowSpaceMqiReconciliation({
          projectFitOutAreaM2: project.totalFitoutArea,
          rooms: storedRooms,
          allocations: storedAllocations,
          materialLibrary,
        });
      }

      const pdfInput: PDFReportInput = {
        projectName: project.name,
        projectId: project.id,
        inputs,
        scoreResult,
        sensitivity,
        roi,
        fiveLens,
        roiNarrative: roiResult,
        benchmarkVersion: benchmarkVersionTag,
        logicVersion: logicVersionTag,
        modelVersion: modelVersion.versionTag,
        locale: input.locale,
        evidenceRefs,
        boardAnnex,
        workflowReconciliation,
        autonomousContent: input.reportType === "autonomous_design_brief" ? (reportData as any).content : undefined,
        designBrief: input.reportType === "design_brief" || input.reportType === "full_report"
          ? generateNewDesignBrief({ name: project.name, description: project.description }, inputs, scoreResult)
          : undefined,
      };
      const html = generateReportHTML(input.reportType, pdfInput);

      let fileUrl: string | null = null;
      let storageKey: string | null = null;
      try {
        const fileKey = `reports/${project.id}/${input.reportType}-${nanoid(8)}.html`;
        const result = await storagePut(fileKey, html, "text/html");
        storageKey = result.persistent ? result.key : null;
        fileUrl = result.url;
      } catch (e) {
        console.warn("[Report] S3 upload failed, storing HTML content inline:", e);
      }

      let persistence;
      try {
        persistence = await db.createReportArtifactsForOrg({
          projectId: input.projectId,
          orgId: ctx.orgId,
          report: {
            projectId: input.projectId,
            scoreMatrixId: latest.id,
            reportType: input.reportType as any,
            // New persistent objects are re-signed after tenant authorization.
            // Legacy URLs and local data URLs remain read-only fallbacks.
            fileUrl: storageKey ? null : fileUrl,
            storageKey,
            content: storageKey
              ? { ...reportData, locale: input.locale }
              : { ...reportData, locale: input.locale, html },
            generatedBy: ctx.user.id,
            benchmarkVersionId: activeBV?.id ?? null,
            modelVersionId: modelVersion.id,
          },
          designArtifacts,
        });
      } catch (error) {
        if (storageKey) {
          reportIndeterminateUploadPersistence(storageKey, error);
        }
        throw error;
      }
      if (!persistence) {
        if (storageKey) await cleanupRejectedUpload(storageKey);
        await requireProjectForOrg(input.projectId, ctx.orgId);
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "report.generate",
        entityType: "report",
        entityId: input.projectId,
        details: { reportType: input.reportType, stored: Boolean(storageKey || fileUrl) },
        benchmarkVersionId: activeBV?.id,
      });

      // Dispatch webhook for report generation
      dispatchWebhook("report.generated", {
        projectId: input.projectId,
        name: project.name,
        reportType: input.reportType,
        stored: Boolean(storageKey || fileUrl),
        compositeScore: scoreResult.compositeScore,
      }).catch(() => { });

      return {
        ...reportData,
        locale: input.locale,
        fileUrl,
        fiveLens: input.reportType === "full_report" ? fiveLens : undefined,
        roiNarrative: input.reportType === "full_report" ? roiResult : undefined,
      };
    }),

  listReports: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const reports = await db.getReportsByProject(input.projectId);
      return Promise.all(reports.map(async report => {
        const { storageKey, ...publicReport } = report;
        if (!storageKey) return publicReport;
        try {
          const signed = await storageGet(storageKey);
          return { ...publicReport, fileUrl: signed.url };
        } catch (error) {
          console.warn("[Report] Failed to refresh stored report URL", {
            reportId: report.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return publicReport;
        }
      }));
    }),

  // ─── V4: Area Verification Gate ───────────────────────────────────────────

  extractAreas: orgHeavyMutationProcedure
    .input(z.object({
      projectId: z.number(),
      assetId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);
      const { resource: asset } = await requireProjectResourceForOrg(
        input.assetId,
        ctx.orgId,
        {
          lookupResource: db.getProjectAssetById,
          getProjectId: record => record.projectId,
        }
      );
      if (asset.projectId !== project.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      if (!asset.storagePath) throw new TRPCError({ code: "BAD_REQUEST", message: "Asset has no stored media" });

      // Create pending extraction record
      const extraction = await db.createPdfExtractionForOrg({
        projectId: input.projectId,
        assetId: input.assetId,
        extractionMethod: "vision_ai",
        status: "pending",
      }, ctx.orgId);
      if (!extraction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }

      try {
        const { extractRoomsFromMedia } = await import("../engines/pdf-extraction");
        const media = await readValidatedProjectMedia(asset, "project.area-extraction");

        const result = await extractRoomsFromMedia(
          media,
          {
            typology: project.ctx01Typology || undefined,
            gfa: getPricingArea(project) || undefined,
            archetype: (project as any).projectArchetype || undefined,
          }
        );

        // Update extraction with results
        if (!(await db.updatePdfExtractionForOrg(extraction.id, ctx.orgId, {
          status: "extracted",
          extractedRooms: result.rooms,
          totalExtractedArea: String(result.totalArea),
        }))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "area.extract",
          entityType: "pdf_extraction",
          entityId: extraction.id,
          details: {
            projectId: input.projectId,
            assetId: input.assetId,
            roomCount: result.rooms.length,
            totalArea: result.totalArea,
          },
        });

        return {
          id: extraction.id,
          rooms: result.rooms,
          totalArea: result.totalArea,
          warnings: result.warnings,
          status: "extracted" as const,
        };
      } catch (error) {
        await db.updatePdfExtractionForOrg(extraction.id, ctx.orgId, {
          status: "rejected",
        });
        throw error;
      }
    }),

  verifyAreas: orgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      extractionId: z.number(),
      action: z.enum(["verify", "reject"]),
      adjustedTotalArea: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);
      const { resource: extraction } = await requireProjectResourceForOrg(
        input.extractionId,
        ctx.orgId,
        {
          lookupResource: db.getPdfExtractionById,
          getProjectId: record => record.projectId,
        }
      );
      if (extraction.projectId !== project.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }

      if (input.action === "verify") {
        const verifiedArea = input.adjustedTotalArea ?? Number(extraction.totalExtractedArea);
        if (!(await db.verifyPdfExtractionForOrg(
          input.extractionId,
          input.projectId,
          ctx.orgId,
          ctx.user.id,
          verifiedArea
        ))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "area.verify",
          entityType: "pdf_extraction",
          entityId: input.extractionId,
          details: {
            projectId: input.projectId,
            verifiedArea,
            adjustedFromExtracted: input.adjustedTotalArea !== undefined,
          },
        });

        return { success: true, verifiedArea };
      } else {
        // Reject extraction
        if (!(await db.updatePdfExtractionForOrg(input.extractionId, ctx.orgId, {
          status: "rejected",
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
        }))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "area.reject",
          entityType: "pdf_extraction",
          entityId: input.extractionId,
          details: { projectId: input.projectId },
        });

        return { success: true, verifiedArea: null };
      }
    }),

  getExtractions: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      return db.getPdfExtractionsByProject(input.projectId);
    }),
});
