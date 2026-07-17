/**
 * Intelligence Router (V2.10-V2.13)
 * Logic Registry, Scenario Simulation, Explainability, Outcomes, Benchmark Learning
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  orgAdminProcedure,
  orgHeavyMutationProcedure,
  orgMutationProcedure,
  orgProcedure,
  protectedProcedure,
  router,
} from "../_core/trpc";
import { requireProjectForOrg } from "../_core/project-access";
import {
  requireProjectResourceBatchForOrg,
  requireProjectResourceForOrg,
} from "../_core/resource-access";
import {
  getPublishedLogicVersion,
  listLogicVersions,
  getLogicVersionById,
  createLogicVersion,
  publishLogicVersion,
  archiveLogicVersion,
  getLogicWeights,
  setLogicWeights,
  getLogicThresholds,
  setLogicThresholds,
  getLogicChangeLog,
  addLogicChangeLogEntry,
  createScenarioInputForOrg,
  getScenarioInput,
  createScenarioOutputForOrg,
  getScenarioOutput,
  listScenarioOutputs,
  createScenarioComparisonForOrg,
  listScenarioComparisons,
  getScenarioComparisonById,
  getScenarioById,
  createProjectOutcomeForOrg,
  getProjectOutcomesForOrg,
  listAllOutcomes,
  createBenchmarkSuggestion,
  listBenchmarkSuggestions,
  reviewBenchmarkSuggestion,
  getProjectById,
  getScoreMatricesByProject,
  getScenariosByProject,
  getActiveBenchmarkVersion,
} from "../db";
import { generateExplainabilityReport, buildAuditPack, explainMaterialSelection } from "../engines/explainability";
import { generateLearningReport, suggestBenchmarkAdjustments, compareOutcomes } from "../engines/outcome-learning";
import { computeRoi } from "../engines/roi";
import { computeFiveLens } from "../engines/five-lens";
import { storagePut } from "../storage";
import { generateScenarioComparisonHTML, type ScenarioComparisonPDFInput } from "../engines/pdf-report";
import { nanoid } from "nanoid";

export const intelligenceRouter = router({
  // ─── V2.10: Logic Registry ──────────────────────────────────────────────────

  logicVersions: router({
    list: adminProcedure.query(async () => {
      return listLogicVersions();
    }),

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const version = await getLogicVersionById(input.id);
        if (!version) return null;
        const weights = await getLogicWeights(input.id);
        const thresholds = await getLogicThresholds(input.id);
        const changeLog = await getLogicChangeLog(input.id);
        return { ...version, weights, thresholds, changeLog };
      }),

    getPublished: protectedProcedure.query(async () => {
      const version = await getPublishedLogicVersion();
      if (!version) return null;
      const weights = await getLogicWeights(version.id);
      const thresholds = await getLogicThresholds(version.id);
      return { ...version, weights, thresholds };
    }),

    create: adminProcedure
      .input(z.object({ name: z.string(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const id = await createLogicVersion({ ...input, createdBy: ctx.user.id });
        return { id };
      }),

    publish: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await publishLogicVersion(input.id);
        await addLogicChangeLogEntry({
          logicVersionId: input.id,
          actor: ctx.user.id,
          changeSummary: "Published logic version",
          rationale: "Set as active scoring logic",
        });
        return { success: true };
      }),

    archive: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await archiveLogicVersion(input.id);
        await addLogicChangeLogEntry({
          logicVersionId: input.id,
          actor: ctx.user.id,
          changeSummary: "Archived logic version",
          rationale: "Replaced by newer version",
        });
        return { success: true };
      }),

    setWeights: adminProcedure
      .input(
        z.object({
          logicVersionId: z.number(),
          weights: z.array(z.object({ dimension: z.string(), weight: z.string() })),
          rationale: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await setLogicWeights(input.logicVersionId, input.weights);
        await addLogicChangeLogEntry({
          logicVersionId: input.logicVersionId,
          actor: ctx.user.id,
          changeSummary: `Updated dimension weights: ${input.weights.map((w) => `${w.dimension}=${w.weight}`).join(", ")}`,
          rationale: input.rationale,
        });
        return { success: true };
      }),

    setThresholds: adminProcedure
      .input(
        z.object({
          logicVersionId: z.number(),
          thresholds: z.array(
            z.object({
              ruleKey: z.string(),
              thresholdValue: z.string(),
              comparator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
              notes: z.string().optional(),
            })
          ),
          rationale: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await setLogicThresholds(input.logicVersionId, input.thresholds);
        await addLogicChangeLogEntry({
          logicVersionId: input.logicVersionId,
          actor: ctx.user.id,
          changeSummary: `Updated ${input.thresholds.length} threshold rules`,
          rationale: input.rationale,
        });
        return { success: true };
      }),

    changeLog: adminProcedure
      .input(z.object({ logicVersionId: z.number() }))
      .query(async ({ input }) => {
        return getLogicChangeLog(input.logicVersionId);
      }),
  }),

  // ─── V2.10: Calibration ────────────────────────────────────────────────────

  calibrate: orgAdminProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      // Get current published logic version
      const logicVersion = await getPublishedLogicVersion();
      if (!logicVersion) return { error: "No published logic version" };

      const weights = await getLogicWeights(logicVersion.id);
      const thresholds = await getLogicThresholds(logicVersion.id);

      // Get project scores
      const scores = await getScoreMatricesByProject(input.projectId);
      const latestScore = scores[0];

      if (!latestScore) return { error: "No evaluation found for project" };

      return {
        logicVersion: { id: logicVersion.id, name: logicVersion.name, status: logicVersion.status },
        weights: weights.map((w: any) => ({ dimension: w.dimension, weight: w.weight })),
        thresholds: thresholds.map((t: any) => ({
          ruleKey: t.ruleKey,
          thresholdValue: t.thresholdValue,
          comparator: t.comparator,
          notes: t.notes,
        })),
        currentScores: {
          sa: latestScore.saScore,
          ff: latestScore.ffScore,
          mp: latestScore.mpScore,
          ds: latestScore.dsScore,
          er: latestScore.erScore,
          composite: latestScore.compositeScore,
          risk: latestScore.rasScore,
        },
      };
    }),

  // ─── V2.11: Scenario Simulation ────────────────────────────────────────────

  scenarios: router({
    saveInput: orgMutationProcedure
      .input(z.object({ scenarioId: z.number(), jsonInput: z.unknown() }))
      .mutation(async ({ ctx, input }) => {
        await requireProjectResourceForOrg(input.scenarioId, ctx.orgId, {
          lookupResource: getScenarioById,
          getProjectId: scenario => scenario.projectId,
        });
        const id = await createScenarioInputForOrg(
          { scenarioId: input.scenarioId, jsonInput: input.jsonInput },
          ctx.orgId
        );
        if (id === null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }
        return { id };
      }),

    getInput: orgProcedure
      .input(z.object({ scenarioId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireProjectResourceForOrg(input.scenarioId, ctx.orgId, {
          lookupResource: getScenarioById,
          getProjectId: scenario => scenario.projectId,
        });
        return getScenarioInput(input.scenarioId);
      }),

    saveOutput: orgMutationProcedure
      .input(
        z.object({
          scenarioId: z.number(),
          scoreJson: z.unknown(),
          roiJson: z.unknown().optional(),
          riskJson: z.unknown().optional(),
          boardCostJson: z.unknown().optional(),
          benchmarkVersionId: z.number().optional(),
          logicVersionId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireProjectResourceForOrg(input.scenarioId, ctx.orgId, {
          lookupResource: getScenarioById,
          getProjectId: scenario => scenario.projectId,
        });
        const id = await createScenarioOutputForOrg(input, ctx.orgId);
        if (id === null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }
        return { id };
      }),

    getOutput: orgProcedure
      .input(z.object({ scenarioId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireProjectResourceForOrg(input.scenarioId, ctx.orgId, {
          lookupResource: getScenarioById,
          getProjectId: scenario => scenario.projectId,
        });
        return getScenarioOutput(input.scenarioId);
      }),

    listOutputs: orgProcedure
      .input(z.object({ scenarioIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        await requireProjectResourceBatchForOrg(
          input.scenarioIds,
          ctx.orgId,
          (id, orgId) => requireProjectResourceForOrg(id, orgId, {
            lookupResource: getScenarioById,
            getProjectId: scenario => scenario.projectId,
          })
        );
        return listScenarioOutputs(input.scenarioIds);
      }),

    compare: orgMutationProcedure
      .input(
        z.object({
          projectId: z.number(),
          baselineScenarioId: z.number(),
          comparedScenarioIds: z.array(z.number()),
          decisionNote: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        const allIds = [input.baselineScenarioId, ...input.comparedScenarioIds];
        const authorized = await requireProjectResourceBatchForOrg(
          allIds,
          ctx.orgId,
          (id, orgId) => requireProjectResourceForOrg(id, orgId, {
            lookupResource: getScenarioById,
            getProjectId: scenario => scenario.projectId,
          })
        );
        if (authorized.some(item => item.project.id !== input.projectId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }
        const outputs = await listScenarioOutputs(allIds);

        // Build comparison result
        const baselineOutput = outputs.find((o: any) => o.scenarioId === input.baselineScenarioId);
        const comparedOutputs = outputs.filter((o: any) => input.comparedScenarioIds.includes(o.scenarioId));

        const comparisonResult = {
          baseline: {
            scenarioId: input.baselineScenarioId,
            scores: baselineOutput?.scoreJson ?? null,
            roi: baselineOutput?.roiJson ?? null,
          },
          compared: comparedOutputs.map((o: any) => ({
            scenarioId: o.scenarioId,
            scores: o.scoreJson,
            roi: o.roiJson,
            deltas: computeDeltas(baselineOutput?.scoreJson, o.scoreJson),
          })),
          generatedAt: new Date().toISOString(),
        };

        const id = await createScenarioComparisonForOrg({
          ...input,
          comparisonResult,
          createdBy: ctx.user.id,
        }, ctx.orgId);
        if (id === null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }
        return { id, comparisonResult };
      }),

    listComparisons: orgProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        return listScenarioComparisons(input.projectId);
      }),

    getComparison: orgProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const authorized = await requireProjectResourceForOrg(input.id, ctx.orgId, {
          lookupResource: getScenarioComparisonById,
          getProjectId: comparison => comparison.projectId,
        });
        return authorized.resource;
      }),

    exportComparisonPDF: orgHeavyMutationProcedure
      .input(z.object({ comparisonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { resource: comparison, project } =
          await requireProjectResourceForOrg(input.comparisonId, ctx.orgId, {
            lookupResource: getScenarioComparisonById,
            getProjectId: record => record.projectId,
          });

        // Get scenario names
        const allScenarios = await getScenariosByProject(comparison.projectId);
        const scenarioMap = new Map<number, string>(allScenarios.map((s: any) => [s.id, s.name as string]));

        const compResult = (comparison.comparisonResult ?? {}) as Record<string, unknown>;
        const baseline = (compResult.baseline ?? {}) as Record<string, unknown>;
        const compared = ((compResult.compared ?? []) as Array<Record<string, unknown>>);

        const benchmarkVersion = await getActiveBenchmarkVersion();
        const logicVersion = await getPublishedLogicVersion();

        const pdfInput: ScenarioComparisonPDFInput = {
          projectName: project.name,
          projectId: comparison.projectId,
          baselineScenario: {
            id: comparison.baselineScenarioId,
            name: scenarioMap.get(comparison.baselineScenarioId) ?? `Scenario #${comparison.baselineScenarioId}`,
            scores: (baseline.scores ?? null) as Record<string, number> | null,
            roi: (baseline.roi ?? null) as Record<string, number> | null,
          },
          comparedScenarios: compared.map((c: any) => {
            const sid = c.scenarioId as number;
            return {
              id: sid,
              name: scenarioMap.get(sid) ?? `Scenario #${sid}`,
              scores: (c.scores ?? null) as Record<string, number> | null,
              roi: (c.roi ?? null) as Record<string, number> | null,
              deltas: (c.deltas ?? null) as Record<string, number> | null,
            };
          }),
          decisionNote: comparison.decisionNote ?? undefined,
          benchmarkVersion: benchmarkVersion?.versionTag ?? "v1.0-baseline",
          logicVersion: logicVersion?.name ?? "Default",
        };

        const html = generateScenarioComparisonHTML(pdfInput);
        const fileKey = `reports/${comparison.projectId}/scenario-comparison-${nanoid(8)}.html`;
        const { url } = await storagePut(fileKey, html, "text/html");

        return { url, html };
      }),
  }),

  // ─── V2.12: Explainability ─────────────────────────────────────────────────

  explainability: router({
    generate: orgProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await requireProjectForOrg(input.projectId, ctx.orgId);

        const scores = await getScoreMatricesByProject(input.projectId);
        const latestScore = scores[0];
        if (!latestScore) return null;

        const logicVersion = await getPublishedLogicVersion();
        const weights = logicVersion ? await getLogicWeights(logicVersion.id) : [];
        const benchmarkVersion = await getActiveBenchmarkVersion();

        // Build dimension weights map
        const dimensionWeights: Record<string, number> = {};
        for (const w of weights) {
          dimensionWeights[w.dimension] = parseFloat(w.weight);
        }
        if (Object.keys(dimensionWeights).length === 0) {
          dimensionWeights.sa = 0.2;
          dimensionWeights.ff = 0.2;
          dimensionWeights.mp = 0.2;
          dimensionWeights.ds = 0.2;
          dimensionWeights.er = 0.2;
        }

        // Read inputSnapshot from score_matrices (where it's reliably stored after evaluation)
        const inputSnapshot = (latestScore.inputSnapshot as Record<string, unknown>) ??
          ((project as Record<string, unknown>).inputSnapshot as Record<string, unknown>) ?? {};
        const variableContributions = (latestScore.variableContributions as Record<string, number>) ?? {};
        const penalties = (latestScore.penalties as Array<{ rule: string; points: number; reason: string }>) ?? [];
        const riskFlags = (latestScore.riskFlags as Array<{ flag: string; severity: string; detail: string }>) ?? [];

        return generateExplainabilityReport(
          input.projectId,
          inputSnapshot,
          {
            saScore: Number(latestScore.saScore),
            ffScore: Number(latestScore.ffScore),
            mpScore: Number(latestScore.mpScore),
            dsScore: Number(latestScore.dsScore),
            erScore: Number(latestScore.erScore),
            compositeScore: Number(latestScore.compositeScore),
            riskScore: Number(latestScore.rasScore),
            confidenceScore: Number(latestScore.confidenceScore),
            decisionStatus: latestScore.decisionStatus ?? "pending",
            dimensionWeights,
            variableContributions,
            penalties,
            riskFlags,
          },
          benchmarkVersion?.versionTag ?? "v1.0",
          logicVersion?.name ?? "Default"
        );
      }),

    auditPack: orgHeavyMutationProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await requireProjectForOrg(input.projectId, ctx.orgId);

        const scores = await getScoreMatricesByProject(input.projectId);
        const latestScore = scores[0];
        if (!latestScore) return { error: "No evaluation found" };

        const logicVersion = await getPublishedLogicVersion();
        const weights = logicVersion ? await getLogicWeights(logicVersion.id) : [];
        const thresholds = logicVersion ? await getLogicThresholds(logicVersion.id) : [];
        const benchmarkVersion = await getActiveBenchmarkVersion();

        // Read inputSnapshot from score_matrices (where it's reliably stored after evaluation)
        const inputSnapshot = (latestScore.inputSnapshot as Record<string, unknown>) ??
          ((project as Record<string, unknown>).inputSnapshot as Record<string, unknown>) ?? {};
        const dimensionWeights: Record<string, number> = {};
        for (const w of weights) {
          dimensionWeights[w.dimension] = parseFloat(w.weight);
        }

        const variableContributions = (latestScore.variableContributions as Record<string, number>) ?? {};
        const penalties = (latestScore.penalties as Array<{ rule: string; points: number; reason: string }>) ?? [];
        const riskFlags = (latestScore.riskFlags as Array<{ flag: string; severity: string; detail: string }>) ?? [];

        const explainability = generateExplainabilityReport(
          input.projectId,
          inputSnapshot,
          {
            saScore: Number(latestScore.saScore),
            ffScore: Number(latestScore.ffScore),
            mpScore: Number(latestScore.mpScore),
            dsScore: Number(latestScore.dsScore),
            erScore: Number(latestScore.erScore),
            compositeScore: Number(latestScore.compositeScore),
            riskScore: Number(latestScore.rasScore),
            confidenceScore: Number(latestScore.confidenceScore),
            decisionStatus: latestScore.decisionStatus ?? "pending",
            dimensionWeights,
            variableContributions,
            penalties,
            riskFlags,
          },
          benchmarkVersion?.versionTag ?? "v1.0",
          logicVersion?.name ?? "Default"
        );

        const comparisons = await listScenarioComparisons(input.projectId);

        const auditPack = buildAuditPack(
          explainability,
          inputSnapshot,
          benchmarkVersion ?? {},
          {
            weights: weights.map((w: any) => ({ dimension: w.dimension, weight: w.weight })),
            thresholds: thresholds.map((t: any) => ({
              ruleKey: t.ruleKey,
              thresholdValue: t.thresholdValue,
              comparator: t.comparator ?? "gte",
            })),
          },
          comparisons,
          []
        );

        // Upload audit pack JSON to S3
        const jsonStr = JSON.stringify(auditPack, null, 2);
        const fileName = `audit-packs/${input.projectId}-${Date.now()}.json`;
        const { url } = await storagePut(fileName, Buffer.from(jsonStr), "application/json");

        return { url, auditPack };
      }),
  }),

  // ─── V2.13: Outcomes ───────────────────────────────────────────────────────

  outcomes: router({
    capture: orgMutationProcedure
      .input(
        z.object({
          projectId: z.number(),
          procurementActualCosts: z.record(z.string(), z.number()).optional(),
          leadTimesActual: z.record(z.string(), z.number()).optional(),
          rfqResults: z.record(z.string(), z.number()).optional(),
          adoptionMetrics: z.record(z.string(), z.unknown()).optional(),
          // V5 Fields
          actualFitoutCostPerSqm: z.number().optional(),
          reworkOccurred: z.boolean().optional(),
          clientSatisfactionScore: z.number().min(1).max(5).optional(),
          projectDeliveredOnTime: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        const id = await createProjectOutcomeForOrg({
          ...input,
          actualFitoutCostPerSqm: input.actualFitoutCostPerSqm?.toString(),
          capturedBy: ctx.user.id,
        }, ctx.orgId);
        if (id === null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
        }
        return { id };
      }),

    list: orgProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireProjectForOrg(input.projectId, ctx.orgId);
        return getProjectOutcomesForOrg(input.projectId, ctx.orgId);
      }),

    listAll: adminProcedure.query(async () => {
      return listAllOutcomes();
    }),
  }),

  // ─── V2.13: Benchmark Learning ─────────────────────────────────────────────

  benchmarkLearning: router({
    generateSuggestions: adminProcedure.mutation(async ({ ctx }) => {
      const outcomes = await listAllOutcomes();
      if (outcomes.length === 0) {
        return { message: "No outcomes captured yet. Capture project outcomes first." };
      }

      // Build predictions from project evaluations
      const predictions = [];
      for (const outcome of outcomes) {
        const scores = await getScoreMatricesByProject(outcome.projectId);
        const latest = scores[0];
        if (latest) {
          predictions.push({
            projectId: outcome.projectId,
            estimatedCost: Number(latest.compositeScore) * 100, // simplified proxy
            estimatedLeadTime: 90, // default estimate
            estimatedRfqRounds: 3,
          });
        }
      }

      const outcomesForLearning = outcomes.map((o: any) => ({
        projectId: o.projectId,
        procurementActualCosts: (o.procurementActualCosts as Record<string, number>) ?? undefined,
        leadTimesActual: (o.leadTimesActual as Record<string, number>) ?? undefined,
        rfqResults: (o.rfqResults as Record<string, number>) ?? undefined,
      }));

      const report = generateLearningReport(outcomesForLearning, predictions);

      // Save suggestions
      if (report.suggestedAdjustments.length > 0) {
        await createBenchmarkSuggestion({
          basedOnOutcomesQuery: `${outcomes.length} outcomes analyzed`,
          suggestedChanges: report.suggestedAdjustments,
          confidence: report.overallAccuracy > 70 ? "high" : report.overallAccuracy > 40 ? "medium" : "low",
        });
      }

      return report;
    }),

    listSuggestions: adminProcedure.query(async () => {
      return listBenchmarkSuggestions();
    }),

    reviewSuggestion: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["accepted", "rejected"]),
          reviewerNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await reviewBenchmarkSuggestion(input.id, {
          status: input.status,
          reviewerNotes: input.reviewerNotes,
          reviewedBy: ctx.user.id,
        });
        return { success: true };
      }),
  }),
});

// Helper: compute score deltas between baseline and compared scenario
function computeDeltas(baseline: unknown, compared: unknown): Record<string, number> {
  const deltas: Record<string, number> = {};
  if (!baseline || !compared) return deltas;

  const b = baseline as Record<string, number>;
  const c = compared as Record<string, number>;

  const fields = ["saScore", "ffScore", "mpScore", "dsScore", "erScore", "compositeScore"];
  for (const f of fields) {
    if (typeof b[f] === "number" && typeof c[f] === "number") {
      deltas[f] = c[f] - b[f];
    }
  }
  return deltas;
}
