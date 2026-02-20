import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { evaluate, computeROI, type EvaluationConfig } from "../engines/scoring";
import { runSensitivityAnalysis } from "../engines/sensitivity";
import { generateValidationSummary, generateDesignBrief, generateFullReport } from "../engines/report";
import { generateReportHTML, type PDFReportInput } from "../engines/pdf-report";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import type { ProjectInputs } from "../../shared/miyar-types";
import { computeRoi, type RoiInputs } from "../engines/roi";
import { computeFiveLens } from "../engines/five-lens";
import { computeDerivedFeatures } from "../engines/intelligence";
import { SCENARIO_TEMPLATES, getScenarioTemplate, solveConstraints, type Constraint } from "../engines/scenario-templates";
import { dispatchWebhook } from "../engines/webhook";

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

const projectInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  ctx01Typology: z.enum(["Residential", "Mixed-use", "Hospitality", "Office"]).default("Residential"),
  ctx02Scale: z.enum(["Small", "Medium", "Large"]).default("Medium"),
  ctx03Gfa: z.number().nullable().optional(),
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
});

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

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getProjectsByUser(ctx.user.id);
  }),

  listWithScores: protectedProcedure.query(async ({ ctx }) => {
    const projectList = await db.getProjectsByUser(ctx.user.id);
    const result = await Promise.all(
      projectList.map(async (p) => {
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

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) return null;
      return project;
    }),

  create: protectedProcedure
    .input(projectInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await db.createProject({
        ...input,
        userId: ctx.user.id,
        status: "draft",
        ctx03Gfa: input.ctx03Gfa ? String(input.ctx03Gfa) as any : null,
        fin01BudgetCap: input.fin01BudgetCap ? String(input.fin01BudgetCap) as any : null,
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.create",
        entityType: "project",
        entityId: result.id,
      });
      // Dispatch webhook
      dispatchWebhook("project.created", { projectId: result.id, name: input.name, tier: input.mkt01Tier }).catch(() => {});
      return result;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(projectInputSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await db.getProjectById(id);
      if (!project || project.userId !== ctx.user.id) {
        throw new Error("Project not found");
      }
      if (project.status === "locked") {
        throw new Error("Cannot update a locked project");
      }
      const updateData: any = { ...data };
      if (data.ctx03Gfa !== undefined) updateData.ctx03Gfa = data.ctx03Gfa ? String(data.ctx03Gfa) : null;
      if (data.fin01BudgetCap !== undefined) updateData.fin01BudgetCap = data.fin01BudgetCap ? String(data.fin01BudgetCap) : null;
      await db.updateProject(id, updateData);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.update",
        entityType: "project",
        entityId: id,
        details: data,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) {
        throw new Error("Project not found");
      }
      await db.deleteProject(input.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "project.delete",
        entityType: "project",
        entityId: input.id,
      });
      return { success: true };
    }),

  evaluate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) {
        throw new Error("Project not found");
      }

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) throw new Error("No active model version found");

      const inputs = projectToInputs(project);

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
      });

      // Compute and store project intelligence
      try {
        const allBenchmarks = await db.getAllBenchmarkData();
        const allScores = await db.getAllScoreMatrices();
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

      await db.updateProject(input.id, {
        status: "evaluated",
        modelVersionId: modelVersion.id,
        benchmarkVersionId: activeBV?.id ?? null,
      });

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
      }).catch(() => {});

      return { scoreMatrixId: matrixResult.id, ...scoreResult };
    }),

  getScores: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return [];
      return db.getScoreMatricesByProject(input.projectId);
    }),

  sensitivity: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) return [];

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) return [];

      const inputs = projectToInputs(project);
      const expectedCost = await db.getExpectedCost(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);
      const benchmarks = await db.getBenchmarks(inputs.ctx01Typology, inputs.ctx04Location, inputs.mkt01Tier);

      const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);

      return runSensitivityAnalysis(inputs, config);
    }),

  // ─── V2: ROI Narrative Engine ──────────────────────────────────────
  roi: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return null;

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
        gfa: Number(project.ctx03Gfa || 0),
        complexity: project.des03Complexity || 3,
        materialLevel: project.des02MaterialLevel || 3,
        tier: project.mkt01Tier || "Upper-mid",
        horizon: project.ctx05Horizon || "12-24m",
      };

      return computeRoi(roiInputs, coefficients);
    }),

  // ─── V2: 5-Lens Validation Framework ──────────────────────────────
  fiveLens: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return null;

      const scores = await db.getScoreMatricesByProject(input.projectId);
      if (scores.length === 0) return null;
      const latest = scores[0];

      const benchmarks = await db.getAllBenchmarkData();
      return computeFiveLens(project as any, latest as any, benchmarks as any);
    }),

  // ─── V2: Project Intelligence ─────────────────────────────────────
  intelligence: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return null;

      const intel = await db.getProjectIntelligenceByProject(input.projectId);
      return intel.length > 0 ? intel[0] : null;
    }),

  // ─── V2: Scenario Templates ───────────────────────────────────────
  scenarioTemplates: protectedProcedure.query(async () => {
    return SCENARIO_TEMPLATES;
  }),

  applyScenarioTemplate: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      templateKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");

      const template = getScenarioTemplate(input.templateKey);
      if (!template) throw new Error("Template not found");

      // Create scenario with template overrides
      const baseInputs = projectToInputs(project);
      const scenarioInputs = { ...baseInputs, ...template.overrides };

      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) throw new Error("No active model version");

      const expectedCost = await db.getExpectedCost(scenarioInputs.ctx01Typology, scenarioInputs.ctx04Location, scenarioInputs.mkt01Tier);
      const benchmarks = await db.getBenchmarks(scenarioInputs.ctx01Typology, scenarioInputs.ctx04Location, scenarioInputs.mkt01Tier);

      const config = await buildEvalConfig(modelVersion, expectedCost, benchmarks.length);

      const scoreResult = evaluate(scenarioInputs as ProjectInputs, config);

      const result = await db.createScenarioRecord({
        projectId: input.projectId,
        name: template.name,
        description: template.description,
        variableOverrides: template.overrides,
        isTemplate: true,
        templateKey: input.templateKey,
      });

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
  solveConstraints: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      constraints: z.array(z.object({
        variable: z.string(),
        operator: z.enum(["eq", "gte", "lte", "in"]),
        value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");

      const baseProject = projectToInputs(project) as Record<string, any>;
      return solveConstraints(baseProject, input.constraints as Constraint[]);
    }),

  // ─── V2: Enhanced Report Generation ───────────────────────────────
  generateReport: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      reportType: z.enum(["validation_summary", "design_brief", "full_report"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new Error("Project not found");

      const scores = await db.getScoreMatricesByProject(input.projectId);
      if (scores.length === 0) throw new Error("No scores available. Evaluate first.");
      const latest = scores[0];

      const inputs = projectToInputs(project);
      const modelVersion = await db.getActiveModelVersion();
      if (!modelVersion) throw new Error("No active model version");

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

      const sensitivity = runSensitivityAnalysis(inputs, config);

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
        gfa: Number(project.ctx03Gfa || 0),
        complexity: project.des03Complexity || 3,
        materialLevel: project.des02MaterialLevel || 3,
        tier: project.mkt01Tier || "Upper-mid",
        horizon: project.ctx05Horizon || "12-24m",
      };
      const roiResult = computeRoi(roiInputs, coefficients);

      // Build ROI for legacy report format
      const roi = input.reportType === "full_report"
        ? computeROI(inputs, scoreResult.compositeScore, 150000)
        : undefined;

      let reportData;
      if (input.reportType === "validation_summary") {
        reportData = generateValidationSummary(project.name, project.id, inputs, scoreResult, sensitivity);
      } else if (input.reportType === "design_brief") {
        reportData = generateDesignBrief(project.name, project.id, inputs, scoreResult, sensitivity);
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
      let evidenceRefs: Array<{ title: string; sourceUrl?: string; category?: string; reliabilityGrade?: string; captureDate?: string }> = [];
      try {
        const refs = await db.getEvidenceForTarget("project", input.projectId);
        if (refs.length > 0) {
          const evidenceIds = refs.map((r: any) => r.evidenceRecordId);
          const allEvidence = await db.listEvidenceRecords({ projectId: input.projectId });
          evidenceRefs = allEvidence
            .filter((e: any) => evidenceIds.includes(e.id))
            .map((e: any) => ({
              title: e.title || e.itemName,
              sourceUrl: e.sourceUrl || undefined,
              category: e.category || undefined,
              reliabilityGrade: e.reliabilityGrade || undefined,
              captureDate: e.captureDate ? String(e.captureDate) : undefined,
            }));
        }
      } catch { /* evidence refs are optional */ }

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
        evidenceRefs,
      };
      const html = generateReportHTML(input.reportType, pdfInput);

      let fileUrl: string | null = null;
      try {
        const fileKey = `reports/${project.id}/${input.reportType}-${nanoid(8)}.html`;
        const result = await storagePut(fileKey, html, "text/html");
        fileUrl = result.url;
      } catch (e) {
        console.warn("[Report] S3 upload failed, storing content only:", e);
      }

      await db.createReportInstance({
        projectId: input.projectId,
        scoreMatrixId: latest.id,
        reportType: input.reportType as any,
        fileUrl,
        content: reportData,
        generatedBy: ctx.user.id,
        benchmarkVersionId: activeBV?.id ?? null,
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "report.generate",
        entityType: "report",
        entityId: input.projectId,
        details: { reportType: input.reportType, fileUrl },
        benchmarkVersionId: activeBV?.id,
      });

      // Dispatch webhook for report generation
      dispatchWebhook("report.generated", {
        projectId: input.projectId,
        name: project.name,
        reportType: input.reportType,
        fileUrl,
        compositeScore: scoreResult.compositeScore,
      }).catch(() => {});

      return {
        ...reportData,
        fileUrl,
        fiveLens: input.reportType === "full_report" ? fiveLens : undefined,
        roiNarrative: input.reportType === "full_report" ? roiResult : undefined,
      };
    }),

  listReports: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) return [];
      return db.getReportsByProject(input.projectId);
    }),
});
