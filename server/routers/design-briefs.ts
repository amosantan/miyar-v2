/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  requireDesignBrief,
  requireDesignProject,
  requireDesignScenario,
  requireMatchingDesignScenario,
  requireSameDesignProject,
  requireScopedDesignInsert,
  requireScopedDesignMutation,
} from "../_core/design-resource-access";
import {
  designOrgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { getPricingArea } from "../engines/area-utils";
import {
  generateDesignBrief,
  type DesignBriefData,
} from "../engines/design-brief";
import {
  buildQuantityCostSummary,
  calculateSurfaceAreas,
  type AllocationSlice,
  type AllocationResult as MqiAllocationResult,
} from "../engines/design/material-quantity-engine";
import { buildRFQFromBrief } from "../engines/design/rfq-generator";
import { benchmarkSpaceRatios } from "../engines/design/space-benchmarking";
import { buildSpaceProgram } from "../engines/design/space-program";
import { getAreaSaleMedianSqm } from "../engines/dld-analytics";
import { generateDesignBriefDocx } from "../engines/docx-brief";
import { getLiveCategoryPricing } from "../engines/pricing-engine";
import { storagePut } from "../storage";

import { bestEffortAudit, projectToInputs } from "./design-router-shared";

export const designBriefsRouter = router({
  generateBrief: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        scenarioId: z.number().optional(),
        locale: z.enum(["en", "ar"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      if (input.scenarioId !== undefined) {
        const scenario = await requireDesignScenario(
          input.scenarioId,
          ctx.orgId
        );
        requireSameDesignProject(project.id, scenario.project.id);
      }

      const scores = await db.getScoreMatricesByProject(input.projectId);
      const latest = scores[0];
      if (!latest)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Project must be evaluated first",
        });

      const inputs = projectToInputs(project);
      const scoreResult = {
        compositeScore: Number(latest.compositeScore),
        decisionStatus: latest.decisionStatus,
        dimensions: {
          sa: Number(latest.saScore),
          ff: Number(latest.ffScore),
          mp: Number(latest.mpScore),
          ds: Number(latest.dsScore),
          er: Number(latest.erScore),
        },
      };

      // Fetch live market pricing for the project's finish level
      const tierToFinish: Record<string, string> = {
        Mid: "standard",
        "Upper-mid": "premium",
        Luxury: "luxury",
        "Ultra-luxury": "ultra_luxury",
      };
      const targetFinish = tierToFinish[inputs.mkt01Tier] || "standard";
      const livePricing = await getLiveCategoryPricing(targetFinish);
      // Phase 3: Fetch material_constants for structural cost analytics
      const matConstants = await db.getMaterialConstants();

      // Phase B.3: Look up DLD area median sale price (AED/sqm)
      const areaSaleMedian = await getAreaSaleMedianSqm(project.dldAreaId);

      // Phase 9: Resolve floor plan analysis and space benchmark for spaceAllocation section
      let floorPlanAnalysis: any = undefined;
      let spaceBenchmarkResult: any = undefined;
      if (project.floorPlanAnalysis) {
        try {
          floorPlanAnalysis =
            typeof project.floorPlanAnalysis === "string"
              ? JSON.parse(project.floorPlanAnalysis)
              : project.floorPlanAnalysis;
          // Compute space benchmark if DLD area data is available
          if (floorPlanAnalysis?.rooms?.length > 0 && project.dldAreaId) {
            const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
            if (dldBench) {
              const areaName = dldBench.areaNameEn || "Dubai";
              const transCount = Number(dldBench.saleTransactionCount) || 100;
              const saleP50 = Number(dldBench.saleP50) || 25000;
              spaceBenchmarkResult = benchmarkSpaceRatios(
                floorPlanAnalysis,
                areaName,
                transCount,
                saleP50
              );
            }
          }
        } catch (e) {
          console.warn(
            "[GenerateBrief] Floor plan analysis parsing failed:",
            e
          );
        }
      }

      // Phase C: Fetch MQI cost data for brief enrichment
      let mqiCostResult:
        | import("../engines/design/material-quantity-engine").MaterialQuantityResult
        | undefined;
      try {
        const allocations = await db.getMaterialAllocations(
          input.projectId,
          ctx.orgId
        );
        if (allocations.length > 0) {
          // Rebuild space program rooms for surface area calculation
          const storedRooms = await db.getSpaceProgramRooms(
            input.projectId,
            ctx.orgId
          );
          let rooms;
          if (storedRooms.length > 0) {
            rooms = storedRooms
              .filter((r: any) => r.isFitOut)
              .map((r: any) => ({
                id: r.roomCode as string,
                name: r.roomName as string,
                sqm: Number(r.sqm),
                budgetPct: Number(r.budgetPct) || 0,
                priority: (r.priority || "medium") as "high" | "medium" | "low",
                finishGrade: (r.finishGrade || "B") as "A" | "B" | "C",
              }));
          } else {
            const spaceProgram = buildSpaceProgram(project);
            rooms = spaceProgram.rooms;
          }

          const surfaces = calculateSurfaceAreas(rooms);

          // Reconstruct AllocationResult from stored DB allocations
          const roomAllocMap = new Map<
            string,
            {
              roomId: string;
              floor: AllocationSlice[];
              walls: AllocationSlice[];
              ceiling: AllocationSlice[];
              joinery: AllocationSlice[];
            }
          >();
          for (const alloc of allocations) {
            if (!roomAllocMap.has(alloc.roomId)) {
              roomAllocMap.set(alloc.roomId, {
                roomId: alloc.roomId,
                floor: [],
                walls: [],
                ceiling: [],
                joinery: [],
              });
            }
            const room = roomAllocMap.get(alloc.roomId)!;
            const slice: AllocationSlice = {
              materialLibraryId: alloc.materialLibraryId,
              materialName: alloc.materialName,
              percentage: Number(alloc.allocationPct),
              reasoning: alloc.aiReasoning || "",
            };
            const el = alloc.element as
              | "floor"
              | "walls"
              | "ceiling"
              | "joinery";
            if (room[el]) room[el].push(slice);
          }

          const allocationResult: MqiAllocationResult = {
            rooms: Array.from(roomAllocMap.values()),
            designRationale: "Reconstructed from stored allocations",
            estimatedQualityLabel: "Stored",
          };

          const materialLibrary = await db.getMaterialLibrary();
          mqiCostResult = buildQuantityCostSummary(
            surfaces,
            allocationResult,
            materialLibrary as any,
            {
              fin01BudgetCap: project.fin01BudgetCap
                ? Number(project.fin01BudgetCap)
                : null,
              ctx03Gfa: project.ctx03Gfa ? Number(project.ctx03Gfa) : null,
            }
          );
          console.log(
            `[GenerateBrief] MQI data enrichment: ${mqiCostResult.rooms.length} rooms, mid cost AED ${mqiCostResult.summary.totalFinishCostMid.toFixed(0)}`
          );
        }
      } catch (e) {
        console.warn(
          "[GenerateBrief] MQI data fetch failed, continuing without:",
          e
        );
      }

      const briefData = generateDesignBrief(
        { name: project.name, description: project.description },
        inputs,
        scoreResult,
        Object.keys(livePricing).length > 0 ? livePricing : undefined,
        matConstants.length > 0 ? matConstants : undefined,
        areaSaleMedian, // DLD area median, replaces 25K fallback
        project.projectPurpose as any, // Purpose adjusts material tier
        floorPlanAnalysis, // Phase 9: floor plan data
        spaceBenchmarkResult, // Phase 9: space benchmark result
        mqiCostResult // Phase C: MQI cost summary
      );

      // Get latest version number
      const existing = await db.getDesignBriefsByProject(input.projectId);
      const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

      const result = requireScopedDesignInsert(
        await db.createDesignBriefForOrg(
          {
            projectId: input.projectId,
            scenarioId: input.scenarioId,
            version: nextVersion,
            projectIdentity: briefData.projectIdentity,
            designNarrative: briefData.designNarrative,
            materialSpecifications: briefData.materialSpecifications,
            boqFramework: {
              ...briefData.boqFramework,
              pricingAnalytics: briefData.pricingAnalytics,
            },
            detailedBudget: {
              ...briefData.detailedBudget,
              mqiSummary: briefData.mqiSummary,
              spaceAllocation: briefData.spaceAllocation,
            },
            designerInstructions: briefData.designerInstructions,
            createdBy: ctx.user.id,
          },
          ctx.orgId
        )
      );

      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "design_brief.generate",
        entityType: "design_brief",
        entityId: result.id,
        details: { projectId: input.projectId, version: nextVersion },
      });

      return { id: result.id, version: nextVersion, data: briefData };
    }),

  listBriefs: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const briefs = await db.getDesignBriefsByProject(input.projectId);
      for (const brief of briefs) {
        await requireMatchingDesignScenario(
          brief.scenarioId,
          brief.projectId,
          ctx.orgId
        );
      }
      return briefs;
    }),

  getBrief: orgProcedure
    .input(z.object({ briefId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { resource } = await requireDesignBrief(input.briefId, ctx.orgId);
      await requireMatchingDesignScenario(
        resource.scenarioId,
        resource.projectId,
        ctx.orgId
      );
      return resource;
    }),

  getLatestBrief: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const brief = await db.getLatestDesignBrief(input.projectId);
      if (brief)
        await requireMatchingDesignScenario(
          brief.scenarioId,
          brief.projectId,
          ctx.orgId
        );
      return brief;
    }),

  generateRfqFromBrief: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        briefId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch the Design Brief
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const { resource: brief, project: briefProject } =
        await requireDesignBrief(input.briefId, ctx.orgId);
      requireSameDesignProject(project.id, briefProject.id);

      // 2. Reconstruct DesignBriefData from stored JSON columns
      const briefData: DesignBriefData = {
        projectIdentity:
          brief.projectIdentity as DesignBriefData["projectIdentity"],
        designNarrative:
          brief.designNarrative as DesignBriefData["designNarrative"],
        materialSpecifications:
          brief.materialSpecifications as DesignBriefData["materialSpecifications"],
        boqFramework: brief.boqFramework as DesignBriefData["boqFramework"],
        detailedBudget:
          brief.detailedBudget as DesignBriefData["detailedBudget"],
        designerInstructions:
          brief.designerInstructions as DesignBriefData["designerInstructions"],
      };

      // 3. Fetch project materials for enrichment
      const materials = await db.getAllMaterials();
      const materialList = materials.map((m: any) => ({
        id: m.id,
        name: m.name || m.productName || "",
        category: m.category || "",
        tier: m.tier || "mid",
        priceAedMin: m.typicalCostLow || m.priceAedMin || 0,
        priceAedMax: m.typicalCostHigh || m.priceAedMax || 0,
        supplierName: m.supplierName || "TBD",
      }));

      // 4. Generate RFQ from Brief
      const result = buildRFQFromBrief(
        input.projectId,
        ctx.orgId,
        briefData,
        input.briefId,
        materialList
      );

      if (result.items.length > 1000) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RFQ exceeds the 1,000 line limit",
        });
      }
      requireScopedDesignMutation(
        await db.insertRfqLineItemsForOrg(result.items as any[], {
          projectId: input.projectId,
          briefId: input.briefId,
          orgId: ctx.orgId,
        })
      );

      // 6. Audit log
      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "rfq.generate_from_brief",
        entityType: "design_brief",
        entityId: input.briefId,
        details: {
          projectId: input.projectId,
          lineItems: result.items.length,
          subtotalMin: result.summary.subtotalMin,
          subtotalMax: result.summary.subtotalMax,
          marketVerifiedCount: result.summary.marketVerifiedCount,
        },
      });

      return result;
    }),

  exportBriefDocx: designOrgMutationProcedure
    .input(
      z.object({
        briefId: z.number(),
        locale: z.enum(["en", "ar"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { resource: brief, project } = await requireDesignBrief(
        input.briefId,
        ctx.orgId
      );
      const [modelVersion, benchmarkVersion, logicVersion] = await Promise.all([
        db.getActiveModelVersion(),
        db.getActiveBenchmarkVersion(),
        db.getPublishedLogicVersion(),
      ]);

      const docxBuffer = await generateDesignBriefDocx({
        projectIdentity: (brief.projectIdentity ?? {}) as Record<
          string,
          unknown
        >,
        designNarrative: (brief.designNarrative ?? {}) as Record<
          string,
          unknown
        >,
        materialSpecifications: (brief.materialSpecifications ?? {}) as Record<
          string,
          unknown
        >,
        boqFramework: brief.boqFramework as any,
        detailedBudget: (brief.detailedBudget ?? {}) as Record<string, unknown>,
        designerInstructions: brief.designerInstructions as any,
        spaceAllocation:
          (brief as any).briefData?.spaceAllocation ??
          (brief as any).spaceAllocation ??
          undefined,
        version: brief.version,
        projectName: project?.name,
        locale: input.locale,
        modelVersion: modelVersion?.versionTag,
        benchmarkVersion: benchmarkVersion?.versionTag,
        logicVersion: logicVersion?.name,
      });

      const fileKey = `reports/${brief.projectId}/design-brief-v${brief.version}-${nanoid(8)}.docx`;
      const { url } = await storagePut(
        fileKey,
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      return { url };
    }),

  exportInvestorPdf: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        locale: z.enum(["en", "ar"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { generateInvestorPdfHtml } = await import(
        "../engines/investor-pdf"
      );
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const [
        brief,
        recs,
        materialConsts,
        benchmark,
        trends,
        modelVersion,
        activeBenchmarkVersion,
        logicVersion,
      ] = await Promise.all([
        db.getLatestAiDesignBrief(input.projectId, ctx.orgId),
        db.getSpaceRecommendations(input.projectId, ctx.orgId),
        db.getMaterialConstants(),
        db.getBenchmarkForProject(
          project.ctx01Typology ?? "Residential",
          project.ctx04Location ?? "Secondary",
          project.mkt01Tier ?? "Upper-mid"
        ),
        db.getPublicDesignTrends({
          styleClassification: project.des01Style ?? undefined,
          region: "UAE",
          limit: 8,
        }),
        db.getActiveModelVersion(),
        db.getActiveBenchmarkVersion(),
        db.getPublishedLogicVersion(),
      ]);
      const totalFitoutBudget = (recs ?? []).reduce(
        (s: number, r: any) => s + Number(r.budgetAllocation || 0),
        0
      );
      const gfa = getPricingArea(project);
      const costPerSqm =
        gfa > 0 && totalFitoutBudget > 0
          ? Math.round(totalFitoutBudget / gfa)
          : 0;
      const TIER_PREMIUM_PCT: Record<string, number> = {
        Entry: 0,
        Mid: 3,
        "Upper-mid": 8,
        Luxury: 18,
        "Ultra-luxury": 30,
      };
      const salePremiumPct =
        TIER_PREMIUM_PCT[project.mkt01Tier ?? "Upper-mid"] ?? 8;
      const estimatedSalesPremiumAed =
        gfa > 0 ? Math.round((gfa * 25000 * salePremiumPct) / 100) : 0;
      const TIER_GRADE: Record<string, string> = {
        Entry: "B",
        Mid: "B",
        "Upper-mid": "C",
        Luxury: "D",
        "Ultra-luxury": "D",
      };
      const sustainabilityGrade =
        TIER_GRADE[project.mkt01Tier ?? "Upper-mid"] ?? "C";
      const briefData = (brief?.briefData ?? {}) as any;
      const allMaterials = (recs ?? []).flatMap((r: any) =>
        (r.materialPackage || []).map((m: any) => ({
          name: m.productName,
          brand: m.brand,
          price: m.priceRangeAed,
          room: r.roomName,
        }))
      );
      const spaces = (recs ?? []).map((r: any) => ({
        name: r.roomName,
        budgetAed: Number(r.budgetAllocation || 0),
        sqm: Number(r.sqm || 0),
        pct:
          totalFitoutBudget > 0
            ? (Number(r.budgetAllocation || 0) / totalFitoutBudget) * 100
            : 0,
        styleDirection: r.styleDirection,
      }));
      const SQF = 10.7639;
      const bmFmt = benchmark
        ? {
            costPerSqmLow:
              benchmark.costPerSqftLow != null
                ? Math.round(Number(benchmark.costPerSqftLow) * SQF)
                : null,
            costPerSqmMid:
              benchmark.costPerSqftMid != null
                ? Math.round(Number(benchmark.costPerSqftMid) * SQF)
                : null,
            costPerSqmHigh:
              benchmark.costPerSqftHigh != null
                ? Math.round(Number(benchmark.costPerSqftHigh) * SQF)
                : null,
            typology: benchmark.typology,
            location: benchmark.location,
            marketTier: benchmark.marketTier,
            dataYear: benchmark.dataYear,
          }
        : null;
      const html = generateInvestorPdfHtml({
        projectName: project.name ?? "Untitled Project",
        typology: project.ctx01Typology ?? "Residential",
        location: project.ctx04Location ?? "UAE",
        tier: project.mkt01Tier ?? "Upper-mid",
        style: project.des01Style ?? "Modern",
        gfaSqm: gfa,
        execSummary: briefData.executiveSummary ?? "",
        designDirection: briefData.designDirection ?? {},
        spaces,
        materials: allMaterials,
        materialConstants: (materialConsts ?? []).map((c: any) => ({
          materialType: c.materialType,
          costPerM2: Number(c.costPerM2),
          carbonIntensity: Number(c.carbonIntensity),
          sustainabilityGrade,
        })),
        totalFitoutBudget,
        costPerSqm,
        sustainabilityGrade,
        salePremiumPct,
        estimatedSalesPremiumAed,
        benchmark: bmFmt,
        designTrends: trends,
        locale: input.locale,
        modelVersion: modelVersion?.versionTag,
        benchmarkVersion: activeBenchmarkVersion?.versionTag,
        logicVersion: logicVersion?.name,
      });
      return { html, projectName: project.name ?? "Project" };
    }),
});
