/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { z } from "zod";
import {
  adminProcedure,
  designOrgAdminProcedure,
  designOrgMutationProcedure,
  orgProcedure,
  protectedProcedure,
  publicRateLimitedProcedure,
  router,
} from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { storageCreatePresignedPut, storageGet, storagePut } from "../storage";
import { generateDesignBrief, type DesignBriefData } from "../engines/design-brief";
import { getAreaSaleMedianSqm } from "../engines/dld-analytics";
import { getLiveCategoryPricing } from "../engines/pricing-engine";
import { getPricingArea } from "../engines/area-utils";
import { buildRFQFromBrief } from "../engines/design/rfq-generator";
import { buildPromptContext, buildBoardAwarePromptContext, buildRoomPromptContext, interpolateTemplate, generateDefaultPrompt, generateRoomRenderPrompt, validatePrompt, buildMaterialAllocationPromptClause, type MqiAllocation } from "../engines/visual-gen";
import { analyzeFloorPlan as runFloorPlanAnalysis } from "../engines/design/floor-plan-analyzer";
import { benchmarkSpaceRatios } from "../engines/design/space-benchmarking";
import { deriveOverallFreshnessHealth } from "../engines/ingestion/freshness-health";
import { computeBoardSummary, generateRfqLines } from "../engines/board-composer";
import { matchVendorsForProject } from "../engines/procurement/vendor-matching";
import { generateImage } from "../_core/imageGeneration";
import type { ProjectInputs } from "../../shared/miyar-types";
import { generateDesignBriefDocx } from "../engines/docx-brief";
import { reportCopy } from "../engines/report-catalog";
import { calculateSurfaceAreas, buildQuantityCostSummary, type AllocationSlice, type AllocationResult as MqiAllocationResult } from "../engines/design/material-quantity-engine";
import { buildSpaceProgram } from "../engines/design/space-program";
import { nanoid } from "nanoid";
import crypto from "node:crypto";
import { requireActivePublicShare } from "../_core/public-share-access";
import {
  requireDesignAsset,
  requireDesignAssetLink,
  requireDesignBoard,
  requireDesignBoardJoin,
  requireDesignBrief,
  requireDesignCommentTarget,
  requireDesignLinkTarget,
  requireDesignProject,
  requireDesignPromptTemplate,
  requireDesignScenario,
  requireDesignVisual,
  requireMatchingDesignScenario,
  requireSameDesignProject,
  requireScopedDesignInsert,
  requireScopedDesignMutation,
} from "../_core/design-resource-access";
import {
  cleanupRejectedUpload,
  reportIndeterminateUploadPersistence,
} from "../_core/upload-compensation";
import { isSupportedMediaMimeType, MAX_MEDIA_BYTES, mediaTypeFromMime, validateMediaBuffer } from "../_core/media-validation";
import { readValidatedProjectMedia } from "../_core/project-media";
import { toAiOperationFailure } from "../_core/ai-operation";

const assetCategorySchema = z.enum([
  "brief", "brand", "budget", "competitor", "inspiration", "material", "sales", "legal",
  "mood_image", "material_board", "marketing_hero", "generated", "other",
]);
const MAX_LEGACY_BASE64_CHARS = Math.ceil(MAX_MEDIA_BYTES * 4 / 3) + 4;

function isOwnedUploadKey(orgId: number, projectId: number, key: string): boolean {
  return key.startsWith(`projects/${orgId}/${projectId}/uploads/`);
}

function isDuplicateKeyError(error: unknown): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as {
      code?: string;
      errno?: number;
      cause?: unknown;
    };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

async function bestEffortAudit(data: Parameters<typeof db.createAuditLog>[0]) {
  try {
    await db.createAuditLog(data);
  } catch {
    // Audit delivery must not turn a committed domain operation into an API error.
  }
}

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
    des05Sustainability: p.des05Sustainability ?? 2,
    exe01SupplyChain: p.exe01SupplyChain ?? 3,
    exe02Contractor: p.exe02Contractor ?? 3,
    exe03Approvals: p.exe03Approvals ?? 2,
    exe04QaMaturity: p.exe04QaMaturity ?? 3,
    add01SampleKit: p.add01SampleKit ?? false,
    add02PortfolioMode: p.add02PortfolioMode ?? false,
    add03DashboardExport: p.add03DashboardExport ?? true,
    city: p.city ?? "Dubai",
    sustainCertTarget: p.sustainCertTarget || "silver",
  };
}

export const designRouter = router({
  // ─── Evidence Vault ─────────────────────────────────────────────────────────

  listAssets: orgProcedure
    .input(z.object({ projectId: z.number(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      return db.getProjectAssets(input.projectId, input.category);
    }),

  /**
   * Starts a browser-to-S3 media upload. The caller receives only a short-lived
   * write URL; finalization below is the security boundary that creates an asset.
   */
  createAssetUpload: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const mimeType = input.mimeType.toLowerCase();
      if (!isSupportedMediaMimeType(mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This file type is not supported. Please choose a supported image, PDF, audio, or video file." });
      }
      const key = `projects/${ctx.orgId}/${input.projectId}/uploads/${crypto.randomUUID()}`;
      const upload = await storageCreatePresignedPut(key, mimeType);
      return { storageKey: upload.key, uploadUrl: upload.uploadUrl, expiresInSeconds: 900 };
    }),

  /** Validates an uploaded object and is the only path that persists direct uploads. */
  finalizeAssetUpload: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      storageKey: z.string().min(1),
      filename: z.string().min(1).max(512),
      mimeType: z.string(),
      category: assetCategorySchema.default("other"),
      tags: z.array(z.string().max(100)).max(30).optional(),
      notes: z.string().max(5_000).optional(),
      isClientVisible: z.boolean().default(true),
      purpose: z.enum(["asset", "floor_plan"]).default("asset"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (!isOwnedUploadKey(ctx.orgId, input.projectId, input.storageKey)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }

      let media;
      try {
        media = await readValidatedProjectMedia({
          storagePath: input.storageKey,
          mimeType: input.mimeType,
        }, "design.asset.finalize");
      } catch (error) {
        try { await cleanupRejectedUpload(input.storageKey); } catch { /* telemetry is emitted by the cleanup helper */ }
        throw error;
      }

      const stored = await storageGet(input.storageKey);
      const assetInput = {
        projectId: input.projectId,
        filename: input.filename.replace(/[\\/\u0000]/g, "_").slice(0, 512),
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        checksum: media.checksum,
        storagePath: input.storageKey,
        storageUrl: stored.url,
        uploadedBy: ctx.user.id,
        category: input.purpose === "floor_plan" ? "floor_plan" as const : input.category,
        assetType: mediaTypeFromMime(media.mimeType),
        tags: input.tags || [],
        notes: input.notes,
        isClientVisible: input.isClientVisible,
      };

      const created = input.purpose === "floor_plan"
        ? await db.createFloorPlanAssetAndLinkForOrg(assetInput, ctx.orgId)
        : await db.createProjectAssetForOrg(assetInput, ctx.orgId);
      if (!created) {
        try { await cleanupRejectedUpload(input.storageKey); } catch { /* preserved by reconciliation telemetry */ }
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: input.purpose === "floor_plan" ? "floor_plan.upload" : "asset.upload",
        entityType: "project_asset",
        entityId: created.id,
        details: { projectId: input.projectId, mediaType: media.mimeType, sizeBytes: media.sizeBytes },
      });
      return { id: created.id, url: stored.url, mimeType: media.mimeType, sizeBytes: media.sizeBytes };
    }),

  uploadAsset: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      filename: z.string(),
      mimeType: z.string(),
      base64Data: z.string().max(MAX_LEGACY_BASE64_CHARS),
      category: z.enum(["brief", "brand", "budget", "competitor", "inspiration", "material", "sales", "legal", "mood_image", "material_board", "marketing_hero", "generated", "other"]).default("other"),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      isClientVisible: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const buffer = Buffer.from(input.base64Data, "base64");
      const media = await validateMediaBuffer(buffer, input.mimeType, "design.asset.legacy-upload");
      const suffix = Math.random().toString(36).slice(2, 10);
      const storagePath = `projects/${input.projectId}/assets/${suffix}-${input.filename}`;
      const uploaded = await storagePut(storagePath, media.buffer, media.mimeType);
      let created: Awaited<ReturnType<typeof db.createProjectAssetForOrg>>;
      try {
        created = await db.createProjectAssetForOrg({
          projectId: input.projectId,
          filename: input.filename,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          checksum: media.checksum,
          storagePath: uploaded.key,
          storageUrl: uploaded.url,
          uploadedBy: ctx.user.id,
          category: input.category,
          tags: input.tags || [],
          notes: input.notes,
          isClientVisible: input.isClientVisible,
        }, ctx.orgId);
      } catch (error) {
        reportIndeterminateUploadPersistence(uploaded.key, error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Upload persistence could not be confirmed" });
      }
      if (!created) {
        try {
          await cleanupRejectedUpload(uploaded.key);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Upload cleanup failed" });
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      const result = requireScopedDesignInsert(created);

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "asset.upload",
        entityType: "project_asset",
        entityId: result.id,
        details: { projectId: input.projectId, filename: input.filename, category: input.category },
      });

      return { id: result.id, url: uploaded.url };
    }),

  deleteAsset: designOrgMutationProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { resource: asset } = await requireDesignAsset(input.assetId, ctx.orgId);
      requireScopedDesignMutation(await db.deleteProjectAssetForOrg(input.assetId, ctx.orgId));
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "asset.delete",
        entityType: "project_asset",
        entityId: input.assetId,
        details: { filename: asset.filename },
      });
      return { success: true };
    }),

  updateAsset: designOrgMutationProcedure
    .input(z.object({
      assetId: z.number(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      isClientVisible: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignAsset(input.assetId, ctx.orgId);
      const { assetId, ...updates } = input;
      requireScopedDesignMutation(await db.updateProjectAssetForOrg(assetId, ctx.orgId, updates as any));
      return { success: true };
    }),

  linkAsset: designOrgMutationProcedure
    .input(z.object({
      assetId: z.number(),
      linkType: z.enum(["evaluation", "report", "scenario", "material_board", "design_brief", "visual"]),
      linkId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await requireDesignAsset(input.assetId, ctx.orgId);
      const target = await requireDesignLinkTarget(input.linkType, input.linkId, ctx.orgId);
      requireSameDesignProject(asset.project.id, target.value.project.id);
      return requireScopedDesignInsert(await db.createAssetLinkForOrg(input, ctx.orgId));
    }),

  getAssetLinks: orgProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ ctx, input }) => {
      const asset = await requireDesignAsset(input.assetId, ctx.orgId);
      const links = await db.getAssetLinksByAsset(input.assetId);
      for (const link of links) {
        const target = await requireDesignLinkTarget(link.linkType, link.linkId, ctx.orgId);
        requireSameDesignProject(asset.project.id, target.value.project.id);
      }
      return links;
    }),

  // ─── Design Brief Generator ─────────────────────────────────────────────────

  generateBrief: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      scenarioId: z.number().optional(),
      locale: z.enum(["en", "ar"]).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      if (input.scenarioId !== undefined) {
        const scenario = await requireDesignScenario(input.scenarioId, ctx.orgId);
        requireSameDesignProject(project.id, scenario.project.id);
      }

      const scores = await db.getScoreMatricesByProject(input.projectId);
      const latest = scores[0];
      if (!latest) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Project must be evaluated first" });

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
        "Mid": "standard", "Upper-mid": "premium",
        "Luxury": "luxury", "Ultra-luxury": "ultra_luxury",
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
          floorPlanAnalysis = typeof project.floorPlanAnalysis === "string"
            ? JSON.parse(project.floorPlanAnalysis)
            : project.floorPlanAnalysis;
          // Compute space benchmark if DLD area data is available
          if (floorPlanAnalysis?.rooms?.length > 0 && project.dldAreaId) {
            const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
            if (dldBench) {
              const areaName = dldBench.areaNameEn || "Dubai";
              const transCount = Number(dldBench.saleTransactionCount) || 100;
              const saleP50 = Number(dldBench.saleP50) || 25000;
              spaceBenchmarkResult = benchmarkSpaceRatios(floorPlanAnalysis, areaName, transCount, saleP50);
            }
          }
        } catch (e) {
          console.warn("[GenerateBrief] Floor plan analysis parsing failed:", e);
        }
      }

      // Phase C: Fetch MQI cost data for brief enrichment
      let mqiCostResult: import("../engines/design/material-quantity-engine").MaterialQuantityResult | undefined;
      try {
        const allocations = await db.getMaterialAllocations(input.projectId, ctx.orgId);
        if (allocations.length > 0) {
          // Rebuild space program rooms for surface area calculation
          const storedRooms = await db.getSpaceProgramRooms(input.projectId, ctx.orgId);
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
          const roomAllocMap = new Map<string, { roomId: string; floor: AllocationSlice[]; walls: AllocationSlice[]; ceiling: AllocationSlice[]; joinery: AllocationSlice[] }>();
          for (const alloc of allocations) {
            if (!roomAllocMap.has(alloc.roomId)) {
              roomAllocMap.set(alloc.roomId, { roomId: alloc.roomId, floor: [], walls: [], ceiling: [], joinery: [] });
            }
            const room = roomAllocMap.get(alloc.roomId)!;
            const slice: AllocationSlice = {
              materialLibraryId: alloc.materialLibraryId,
              materialName: alloc.materialName,
              percentage: Number(alloc.allocationPct),
              reasoning: alloc.aiReasoning || "",
            };
            const el = alloc.element as "floor" | "walls" | "ceiling" | "joinery";
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
              fin01BudgetCap: project.fin01BudgetCap ? Number(project.fin01BudgetCap) : null,
              ctx03Gfa: project.ctx03Gfa ? Number(project.ctx03Gfa) : null,
            }
          );
          console.log(`[GenerateBrief] MQI data enrichment: ${mqiCostResult.rooms.length} rooms, mid cost AED ${mqiCostResult.summary.totalFinishCostMid.toFixed(0)}`);
        }
      } catch (e) {
        console.warn("[GenerateBrief] MQI data fetch failed, continuing without:", e);
      }

      const briefData = generateDesignBrief(
        { name: project.name, description: project.description },
        inputs,
        scoreResult,
        Object.keys(livePricing).length > 0 ? livePricing : undefined,
        matConstants.length > 0 ? matConstants : undefined,
        areaSaleMedian, // DLD area median, replaces 25K fallback
        project.projectPurpose as any, // Purpose adjusts material tier
        floorPlanAnalysis,       // Phase 9: floor plan data
        spaceBenchmarkResult,    // Phase 9: space benchmark result
        mqiCostResult,           // Phase C: MQI cost summary
      );

      // Get latest version number
      const existing = await db.getDesignBriefsByProject(input.projectId);
      const nextVersion = existing.length > 0 ? (existing[0].version + 1) : 1;

      const result = requireScopedDesignInsert(await db.createDesignBriefForOrg({
        projectId: input.projectId,
        scenarioId: input.scenarioId,
        version: nextVersion,
        projectIdentity: briefData.projectIdentity,
        designNarrative: briefData.designNarrative,
        materialSpecifications: briefData.materialSpecifications,
        boqFramework: { ...briefData.boqFramework, pricingAnalytics: briefData.pricingAnalytics },
        detailedBudget: { ...briefData.detailedBudget, mqiSummary: briefData.mqiSummary, spaceAllocation: briefData.spaceAllocation },
        designerInstructions: briefData.designerInstructions,
        createdBy: ctx.user.id,
      }, ctx.orgId));

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
        await requireMatchingDesignScenario(brief.scenarioId, brief.projectId, ctx.orgId);
      }
      return briefs;
    }),

  getBrief: orgProcedure
    .input(z.object({ briefId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { resource } = await requireDesignBrief(input.briefId, ctx.orgId);
      await requireMatchingDesignScenario(resource.scenarioId, resource.projectId, ctx.orgId);
      return resource;
    }),

  getLatestBrief: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const brief = await db.getLatestDesignBrief(input.projectId);
      if (brief) await requireMatchingDesignScenario(brief.scenarioId, brief.projectId, ctx.orgId);
      return brief;
    }),

  // ─── RFQ from Brief (V4 Pipeline) ─────────────────────────────────────────

  generateRfqFromBrief: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      briefId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch the Design Brief
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const { resource: brief, project: briefProject } = await requireDesignBrief(input.briefId, ctx.orgId);
      requireSameDesignProject(project.id, briefProject.id);

      // 2. Reconstruct DesignBriefData from stored JSON columns
      const briefData: DesignBriefData = {
        projectIdentity: brief.projectIdentity as DesignBriefData["projectIdentity"],
        designNarrative: brief.designNarrative as DesignBriefData["designNarrative"],
        materialSpecifications: brief.materialSpecifications as DesignBriefData["materialSpecifications"],
        boqFramework: brief.boqFramework as DesignBriefData["boqFramework"],
        detailedBudget: brief.detailedBudget as DesignBriefData["detailedBudget"],
        designerInstructions: brief.designerInstructions as DesignBriefData["designerInstructions"],
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
        materialList,
      );

      if (result.items.length > 1000) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "RFQ exceeds the 1,000 line limit" });
      }
      requireScopedDesignMutation(await db.insertRfqLineItemsForOrg(
        result.items as any[],
        { projectId: input.projectId, briefId: input.briefId, orgId: ctx.orgId },
      ));

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
    .input(z.object({ briefId: z.number(), locale: z.enum(["en", "ar"]).default("en") }))
    .mutation(async ({ ctx, input }) => {
      const { resource: brief, project } = await requireDesignBrief(input.briefId, ctx.orgId);
      const [modelVersion, benchmarkVersion, logicVersion] = await Promise.all([
        db.getActiveModelVersion(), db.getActiveBenchmarkVersion(), db.getPublishedLogicVersion(),
      ]);

      const docxBuffer = await generateDesignBriefDocx({
        projectIdentity: (brief.projectIdentity ?? {}) as Record<string, unknown>,
        designNarrative: (brief.designNarrative ?? {}) as Record<string, unknown>,
        materialSpecifications: (brief.materialSpecifications ?? {}) as Record<string, unknown>,
        boqFramework: brief.boqFramework as any,
        detailedBudget: (brief.detailedBudget ?? {}) as Record<string, unknown>,
        designerInstructions: brief.designerInstructions as any,
        spaceAllocation: (brief as any).briefData?.spaceAllocation ?? (brief as any).spaceAllocation ?? undefined,
        version: brief.version,
        projectName: project?.name,
        locale: input.locale,
        modelVersion: modelVersion?.versionTag,
        benchmarkVersion: benchmarkVersion?.versionTag,
        logicVersion: logicVersion?.name,
      });

      const fileKey = `reports/${brief.projectId}/design-brief-v${brief.version}-${nanoid(8)}.docx`;
      const { url } = await storagePut(fileKey, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

      return { url };
    }),

  // ─── Visual Generation (nano banana) ────────────────────────────────────────

  generateVisual: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      type: z.enum(["mood", "material_board", "hero"]),
      scenarioId: z.number().optional(),
      customPrompt: z.string().optional(),
      templateId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      let selectedTemplate: Awaited<ReturnType<typeof requireDesignPromptTemplate>> | undefined;
      if (input.scenarioId !== undefined) {
        const scenario = await requireDesignScenario(input.scenarioId, ctx.orgId);
        requireSameDesignProject(project.id, scenario.project.id);
      }
      if (input.templateId !== undefined) {
        selectedTemplate = await requireDesignPromptTemplate(input.templateId, ctx.orgId);
      }

      let inputs = projectToInputs(project);

      // V4-05: When scenarioId is provided, overlay scenario overrides onto project inputs
      if (input.scenarioId) {
        const scenarioInput = await db.getScenarioInput(input.scenarioId);
        if (scenarioInput?.jsonInput) {
          const overrides = typeof scenarioInput.jsonInput === 'string'
            ? JSON.parse(scenarioInput.jsonInput)
            : scenarioInput.jsonInput;
          inputs = { ...inputs, ...overrides };
        }
      }

      // Phase 9: Try to use board-aware context for material-deterministic renders
      let context;
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      if (boards && boards.length > 0) {
        const activeBoard = boards[0];
        const boardMaterials = await db.getMaterialsByBoard(activeBoard.id);
        const enrichedMaterials = [];
        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            enrichedMaterials.push({
              name: mat.name,
              category: mat.category,
              tier: mat.tier,
              supplierName: mat.supplierName,
              costUnit: mat.costUnit,
              costLow: Number(mat.typicalCostLow) || 0,
              costHigh: Number(mat.typicalCostHigh) || 0,
              embodiedCarbon: mat.embodiedCarbon ? parseFloat(String(mat.embodiedCarbon)) : null,
              maintenanceFactor: mat.maintenanceFactor ? parseFloat(String(mat.maintenanceFactor)) : null,
              brandStandardApproval: mat.brandStandardApproval || null,
            });
          }
        }
        context = buildBoardAwarePromptContext(inputs, enrichedMaterials, project.brandStandardConstraints);
        console.log(`[Visual] Using board-aware context with ${enrichedMaterials.length} materials for project ${input.projectId}`);
      } else {
        context = buildPromptContext(inputs);
      }

      // Phase A (MQI): Fetch material allocations and inject allocationClause
      try {
        const allocations = await db.getMaterialAllocations(input.projectId, ctx.orgId);
        if (allocations && allocations.length > 0) {
          const mqiAllocs: MqiAllocation[] = allocations.map((a: any) => ({
            roomId: a.roomId,
            roomName: a.roomName,
            element: a.element,
            materialName: a.materialName,
            percentage: Number(a.percentage) || 100,
          }));
          const clause = buildMaterialAllocationPromptClause(mqiAllocs);
          if (clause) {
            context.materialSpec = (context.materialSpec || '') + clause;
            console.log(`[Visual] Injected MQI allocation clause with ${mqiAllocs.length} allocations`);
          }
        }
      } catch (e) {
        console.warn('[Visual] MQI allocation fetch failed, continuing without:', e);
      }

      // Build prompt
      let prompt: string;
      if (input.customPrompt) {
        prompt = input.customPrompt;
      } else if (selectedTemplate) {
        prompt = interpolateTemplate(selectedTemplate.templateText, context);
      } else {
        // Use active template or default
        const tmpl = await db.getActivePromptTemplate(input.type, ctx.orgId);
        prompt = tmpl ? interpolateTemplate(tmpl.templateText, context) : generateDefaultPrompt(input.type, context);
      }

      // Validate prompt
      const validation = validatePrompt(prompt);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      }

      // Create visual record
      const visualResult = requireScopedDesignInsert(await db.createGeneratedVisualForOrg({
        projectId: input.projectId,
        scenarioId: input.scenarioId,
        type: input.type,
        promptJson: { prompt, context, templateId: input.templateId },
        status: "generating",
        createdBy: ctx.user.id,
      }, ctx.orgId));

      // Generate image asynchronously (but we await it for simplicity)
      try {
        const generated = await generateImage({ prompt });
        const url = generated.url;

        // Create asset record
        const assetResult = requireScopedDesignInsert(await db.createProjectAssetForOrg({
          projectId: input.projectId,
          filename: `${input.type}-${Date.now()}.png`,
          mimeType: generated.mimeType,
          sizeBytes: generated.sizeBytes,
          checksum: generated.checksum,
          storagePath: generated.storageKey,
          storageUrl: url,
          uploadedBy: ctx.user.id,
          category: input.type === "mood" ? "mood_image" : input.type === "material_board" ? "material_board" : "marketing_hero",
        }, ctx.orgId));

        // Update visual record
        requireScopedDesignMutation(await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, {
          status: "completed",
          imageAssetId: assetResult.id,
        }));

        await db.createAuditLog({
          orgId: ctx.orgId,
          userId: ctx.user.id,
          action: "visual.generate",
          entityType: "generated_visual",
          entityId: visualResult.id,
          details: { type: input.type, projectId: input.projectId },
        });

        return { id: visualResult.id, assetId: assetResult.id, url, status: "completed" as const };
      } catch (error) {
        const failure = toAiOperationFailure(error, "design.visual-generation");
        requireScopedDesignMutation(await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, {
          status: "failed",
          errorMessage: failure.message,
        }));
        return { id: visualResult.id, assetId: null, url: null, status: "failed" as const, error: failure.message, referenceId: failure.referenceId };
      }
    }),

  listVisuals: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const visuals = await db.getGeneratedVisualsByProject(input.projectId);
      // Join with project_assets to get image URLs
      const enriched = await Promise.all(visuals.map(async (v: any) => {
        await requireMatchingDesignScenario(v.scenarioId, v.projectId, ctx.orgId);
        let imageUrl: string | null = null;
        if (v.imageAssetId) {
          const { resource: asset, project: assetProject } = await requireDesignAsset(v.imageAssetId, ctx.orgId);
          requireSameDesignProject(input.projectId, assetProject.id);
          imageUrl = asset?.storageUrl ?? null;
        }
        return { ...v, imageUrl };
      }));
      return enriched;
    }),

  // V4-05: Attach a completed visual's asset to a report/pack as an evidence reference
  attachVisualToPack: designOrgMutationProcedure
    .input(z.object({
      visualId: z.number(),
      targetType: z.enum(["report", "design_brief", "material_board", "pack_section"]),
      targetId: z.number(),
      sectionLabel: z.string().optional(),
    }))
    .mutation(async () => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Visual attachments are unavailable until a typed attachment model is configured",
      });
    }),

  // ─── Pin Visuals to Material Boards (V4) ────────────────────────────────────

  pinVisualToBoard: designOrgMutationProcedure
    .input(z.object({
      visualId: z.number(),
      boardId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { resource: visual, project: visualProject } = await requireDesignVisual(input.visualId, ctx.orgId);
      if (!visual || !visual.imageAssetId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Visual not found or has no image" });
      }
      const { project: boardProject } = await requireDesignBoard(input.boardId, ctx.orgId);
      const { project: assetProject } = await requireDesignAsset(visual.imageAssetId, ctx.orgId);
      requireSameDesignProject(visualProject.id, boardProject.id);
      requireSameDesignProject(visualProject.id, assetProject.id);
      // Create an asset link from the visual's image asset to the board
      const link = requireScopedDesignInsert(await db.createAssetLinkForOrg({
        assetId: visual.imageAssetId,
        linkType: "material_board",
        linkId: input.boardId,
      }, ctx.orgId));
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "visual.pin_to_board",
        entityType: "generated_visual",
        entityId: visual.id,
        details: { boardId: input.boardId, linkId: link.id },
      });
      return { success: true, linkId: link.id };
    }),

  listPinnedVisuals: orgProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { project: boardProject } = await requireDesignBoard(input.boardId, ctx.orgId);
      const links = await db.getAssetLinksByEntity("material_board", input.boardId);
      // Resolve each link to its visual + image URL
      const pinned = await Promise.all(links.map(async (link: { id: number; assetId: number; createdAt: Date }) => {
        const { resource: asset, project: assetProject } = await requireDesignAsset(link.assetId, ctx.orgId);
        requireSameDesignProject(boardProject.id, assetProject.id);
        return {
          linkId: link.id,
          assetId: link.assetId,
          imageUrl: asset?.storageUrl ?? null,
          fileName: asset?.filename ?? null,
          pinnedAt: link.createdAt,
        };
      }));
      return pinned;
    }),

  unpinVisual: designOrgMutationProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const authorizedLink = await requireDesignAssetLink(input.linkId, ctx.orgId);
      if (authorizedLink.resource.linkType !== "material_board") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      const target = await requireDesignLinkTarget(authorizedLink.resource.linkType, authorizedLink.resource.linkId, ctx.orgId);
      requireSameDesignProject(authorizedLink.project.id, target.value.project.id);
      requireScopedDesignMutation(await db.deleteAssetLinkForOrg(input.linkId, ctx.orgId));
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "visual.unpin_from_board",
        entityType: "asset_link",
        entityId: input.linkId,
      });
      return { success: true };
    }),

  // ─── Material Board Composer ────────────────────────────────────────────────

  createBoard: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      boardName: z.string(),
      scenarioId: z.number().optional(),
      materialIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      if (input.scenarioId !== undefined) {
        const scenario = await requireDesignScenario(input.scenarioId, ctx.orgId);
        requireSameDesignProject(project.id, scenario.project.id);
      }
      const materialIds = input.materialIds ?? [];
      if (new Set(materialIds).size !== materialIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate material IDs are not allowed" });
      }

      const boardResult = requireScopedDesignInsert(await db.createMaterialBoardWithMaterialsForOrg({
        projectId: input.projectId,
        scenarioId: input.scenarioId,
        boardName: input.boardName,
        createdBy: ctx.user.id,
      }, materialIds, ctx.orgId));

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "board.create",
        entityType: "material_board",
        entityId: boardResult.id,
        details: { projectId: input.projectId, materialCount: materialIds.length },
      });

      return { id: boardResult.id };
    }),

  listBoards: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      for (const board of boards) {
        await requireMatchingDesignScenario(board.scenarioId, board.projectId, ctx.orgId);
      }
      return boards;
    }),

  getBoard: orgProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { resource: board } = await requireDesignBoard(input.boardId, ctx.orgId);
      await requireMatchingDesignScenario(board.scenarioId, board.projectId, ctx.orgId);
      const boardMaterials = await db.getMaterialsByBoard(input.boardId);
      // Get full material details
      const materialDetails = [];
      for (const bm of boardMaterials) {
        const mat = await db.getMaterialById(bm.materialId);
        if (mat) materialDetails.push({ ...mat, boardJoinId: bm.id, quantity: bm.quantity, unitOfMeasure: bm.unitOfMeasure, boardNotes: bm.notes, sortOrder: bm.sortOrder, specNotes: bm.specNotes, costBandOverride: bm.costBandOverride });
      }
      return { board, materials: materialDetails };
    }),

  addMaterialToBoard: designOrgMutationProcedure
    .input(z.object({
      boardId: z.number(),
      materialId: z.number(),
      quantity: z.number().optional(),
      unitOfMeasure: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoard(input.boardId, ctx.orgId);
      return requireScopedDesignInsert(await db.addMaterialToBoardForOrg({
        boardId: input.boardId,
        materialId: input.materialId,
        quantity: input.quantity ? String(input.quantity) as any : undefined,
        unitOfMeasure: input.unitOfMeasure,
        notes: input.notes,
      }, ctx.orgId));
    }),

  removeMaterialFromBoard: designOrgMutationProcedure
    .input(z.object({ joinId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoardJoin(input.joinId, ctx.orgId);
      requireScopedDesignMutation(await db.removeMaterialFromBoardForOrg(input.joinId, ctx.orgId));
      return { success: true };
    }),

  deleteBoard: designOrgMutationProcedure
    .input(z.object({ boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoard(input.boardId, ctx.orgId);
      requireScopedDesignMutation(await db.deleteMaterialBoardForOrg(input.boardId, ctx.orgId));
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "board.delete",
        entityType: "material_board",
        entityId: input.boardId,
      });
      return { success: true };
    }),

  updateBoardTile: designOrgMutationProcedure
    .input(z.object({
      joinId: z.number(),
      specNotes: z.string().nullish(),
      costBandOverride: z.string().nullish(),
      quantity: z.number().nullish(),
      unitOfMeasure: z.string().nullish(),
      notes: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoardJoin(input.joinId, ctx.orgId);
      const { joinId, ...rest } = input;
      requireScopedDesignMutation(await db.updateBoardTileForOrg(joinId, ctx.orgId, {
        specNotes: rest.specNotes ?? undefined,
        costBandOverride: rest.costBandOverride ?? undefined,
        quantity: rest.quantity !== undefined && rest.quantity !== null ? String(rest.quantity) : undefined,
        unitOfMeasure: rest.unitOfMeasure ?? undefined,
        notes: rest.notes ?? undefined,
      }));
      return { success: true };
    }),

  reorderBoardTiles: designOrgMutationProcedure
    .input(z.object({
      boardId: z.number(),
      orderedJoinIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const board = await requireDesignBoard(input.boardId, ctx.orgId);
      if (new Set(input.orderedJoinIds).size !== input.orderedJoinIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Board tile identifiers must be unique" });
      }
      for (const joinId of input.orderedJoinIds) {
        const join = await requireDesignBoardJoin(joinId, ctx.orgId);
        requireSameDesignProject(board.project.id, join.project.id);
        if (join.parent.id !== input.boardId) throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      requireScopedDesignMutation(await db.reorderBoardTilesForOrg(input.boardId, input.orderedJoinIds, ctx.orgId));
      return { success: true };
    }),

  exportBoardPdf: designOrgMutationProcedure
    .input(z.object({ boardId: z.number(), locale: z.enum(["en", "ar"]).default("en") }))
    .mutation(async ({ ctx, input }) => {
      const { resource: board, project } = await requireDesignBoard(input.boardId, ctx.orgId);

      const boardMaterials = await db.getMaterialsByBoard(input.boardId);
      const items: Array<{ materialId: number; name: string; category: string; tier: string; costLow: number; costHigh: number; costUnit: string; leadTimeDays: number; leadTimeBand: string; supplierName: string; specNotes?: string; costBandOverride?: string; quantity?: string; unitOfMeasure?: string; notes?: string }> = [];
      for (const bm of boardMaterials) {
        const mat = await db.getMaterialById(bm.materialId);
        if (mat) {
          items.push({
            materialId: mat.id,
            name: mat.name,
            category: mat.category,
            tier: mat.tier,
            costLow: Number(mat.typicalCostLow) || 0,
            costHigh: Number(mat.typicalCostHigh) || 0,
            costUnit: mat.costUnit || "AED/unit",
            leadTimeDays: mat.leadTimeDays || 30,
            leadTimeBand: mat.leadTimeBand || "medium",
            supplierName: mat.supplierName || "TBD",
            specNotes: bm.specNotes || undefined,
            costBandOverride: bm.costBandOverride || undefined,
            quantity: bm.quantity ? String(bm.quantity) : undefined,
            unitOfMeasure: bm.unitOfMeasure || undefined,
            notes: bm.notes || undefined,
          });
        }
      }

      const { generateBoardPdfHtml } = await import("../engines/board-pdf");
      const summary = computeBoardSummary(items as any);
      const rfqLines = generateRfqLines(items as any);
      const [modelVersion, benchmarkVersion, logicVersion] = await Promise.all([
        db.getActiveModelVersion(), db.getActiveBenchmarkVersion(), db.getPublishedLogicVersion(),
      ]);
      const html = generateBoardPdfHtml({
        boardName: board.boardName,
        projectName: project.name,
        items,
        summary,
        rfqLines,
        locale: input.locale,
        modelVersion: modelVersion?.versionTag,
        benchmarkVersion: benchmarkVersion?.versionTag,
        logicVersion: logicVersion?.name,
      });

      let fileUrl: string | null = null;
      try {
        const fileKey = `boards/${board.projectId}/${board.id}-${nanoid(8)}.html`;
        const result = await storagePut(fileKey, html, "text/html");
        fileUrl = result.url;
      } catch (e) {
        console.warn("[Board PDF] S3 upload failed:", e);
      }

      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "board.export_pdf",
        entityType: "material_board",
        entityId: input.boardId,
        details: { fileUrl, itemCount: items.length },
      });

      return { fileUrl, html };
    }),

  boardSummary: orgProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignBoard(input.boardId, ctx.orgId);
      const boardMaterials = await db.getMaterialsByBoard(input.boardId);
      const items = [];
      for (const bm of boardMaterials) {
        const mat = await db.getMaterialById(bm.materialId);
        if (mat) {
          items.push({
            materialId: mat.id,
            name: mat.name,
            category: mat.category,
            tier: mat.tier,
            costLow: Number(mat.typicalCostLow) || 0,
            costHigh: Number(mat.typicalCostHigh) || 0,
            costUnit: mat.costUnit || "AED/unit",
            leadTimeDays: mat.leadTimeDays || 30,
            leadTimeBand: mat.leadTimeBand || "medium",
            supplierName: mat.supplierName || "TBD",
          });
        }
      }
      return {
        summary: computeBoardSummary(items),
        rfqLines: generateRfqLines(items),
      };
    }),

  recommendMaterials: orgProcedure
    .input(z.object({ projectId: z.number(), maxItems: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      // Phase 8: Vendor Matching Integration
      const matched = await matchVendorsForProject({
        projectId: input.projectId,
        orgId: ctx.orgId,
        maxItems: input.maxItems
      });

      // Map back to expected BoardItem format for frontend compatibility
      return matched.map((m: any) => ({
        materialId: m.id,
        name: m.name,
        category: m.category,
        tier: m.tier,
        costLow: Number(m.typicalCostLow) || 0,
        costHigh: Number(m.typicalCostHigh) || 0,
        costUnit: m.costUnit || "AED/unit",
        leadTimeDays: m.leadTimeDays || 30,
        leadTimeBand: m.leadTimeBand || "medium",
        supplierName: m.supplierName || "TBD",
      }));
    }),

  // ─── Materials Catalog ──────────────────────────────────────────────────────

  listMaterials: protectedProcedure
    .input(z.object({ category: z.string().optional(), tier: z.string().optional() }))
    .query(async ({ input }) => {
      return db.getAllMaterials(input.category, input.tier);
    }),

  getMaterial: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getMaterialById(input.id);
    }),

  createMaterial: adminProcedure
    .input(z.object({
      name: z.string(),
      category: z.enum(["tile", "stone", "wood", "metal", "fabric", "glass", "paint", "wallpaper", "lighting", "furniture", "fixture", "accessory", "other"]),
      tier: z.enum(["economy", "mid", "premium", "luxury", "ultra_luxury"]),
      typicalCostLow: z.number().optional(),
      typicalCostHigh: z.number().optional(),
      costUnit: z.string().default("AED/sqm"),
      leadTimeDays: z.number().optional(),
      leadTimeBand: z.enum(["short", "medium", "long", "critical"]).default("medium"),
      regionAvailability: z.array(z.string()).optional(),
      embodiedCarbon: z.number().optional(),
      maintenanceFactor: z.number().optional(),
      brandStandardApproval: z.enum(["open_market", "approved_vendor", "preferred_brand"]).default("open_market"),
      supplierName: z.string().optional(),
      supplierContact: z.string().optional(),
      supplierUrl: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.createMaterial({
        ...input,
        typicalCostLow: input.typicalCostLow ? String(input.typicalCostLow) as any : undefined,
        typicalCostHigh: input.typicalCostHigh ? String(input.typicalCostHigh) as any : undefined,
        embodiedCarbon: input.embodiedCarbon ? String(input.embodiedCarbon) as any : undefined,
        maintenanceFactor: input.maintenanceFactor ? String(input.maintenanceFactor) as any : undefined,
        createdBy: ctx.user.id,
      });
      return result;
    }),

  updateMaterial: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      typicalCostLow: z.number().optional(),
      typicalCostHigh: z.number().optional(),
      embodiedCarbon: z.number().optional(),
      maintenanceFactor: z.number().optional(),
      brandStandardApproval: z.enum(["open_market", "approved_vendor", "preferred_brand"]).optional(),
      leadTimeDays: z.number().optional(),
      supplierName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const mapped: any = { ...updates };
      if (updates.typicalCostLow !== undefined) mapped.typicalCostLow = String(updates.typicalCostLow);
      if (updates.typicalCostHigh !== undefined) mapped.typicalCostHigh = String(updates.typicalCostHigh);
      if (updates.embodiedCarbon !== undefined) mapped.embodiedCarbon = String(updates.embodiedCarbon);
      if (updates.maintenanceFactor !== undefined) mapped.maintenanceFactor = String(updates.maintenanceFactor);
      await db.updateMaterial(id, mapped);
      return { success: true };
    }),

  deleteMaterial: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteMaterial(input.id);
      return { success: true };
    }),

  // ─── Prompt Templates ───────────────────────────────────────────────────────

  listPromptTemplates: orgProcedure
    .input(z.object({ type: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getAllPromptTemplates(input.type, ctx.orgId);
    }),

  createPromptTemplate: adminProcedure
    .input(z.object({
      name: z.string(),
      type: z.enum(["mood", "material_board", "hero"]),
      templateText: z.string(),
      variables: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.createPromptTemplate({ ...input, createdBy: ctx.user.id, orgId: ctx.user.orgId ?? undefined });
    }),

  updatePromptTemplate: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      templateText: z.string().optional(),
      variables: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updatePromptTemplate(id, updates);
      return { success: true };
    }),

  // ─── Collaboration & Comments ───────────────────────────────────────────────

  addComment: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      entityType: z.enum(["design_brief", "material_board", "visual", "general"]),
      entityId: z.number().optional(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (input.entityType === "general") {
        if (input.entityId !== undefined) throw new TRPCError({ code: "BAD_REQUEST", message: "General comments cannot have an entity target" });
      } else {
        if (input.entityId === undefined) throw new TRPCError({ code: "BAD_REQUEST", message: "Entity comments require a target" });
        const target = await requireDesignCommentTarget(input.entityType, input.entityId, ctx.orgId);
        requireSameDesignProject(input.projectId, target.value.project.id);
      }
      return requireScopedDesignInsert(await db.createCommentForOrg({
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: ctx.user.id,
        content: input.content,
      }, ctx.orgId));
    }),

  listComments: orgProcedure
    .input(z.object({
      projectId: z.number(),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (input.entityType === "general" && input.entityId !== undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "General comments cannot have an entity target" });
      }
      if (input.entityType && input.entityType !== "general" && input.entityId !== undefined) {
        const target = await requireDesignCommentTarget(input.entityType, input.entityId, ctx.orgId);
        requireSameDesignProject(input.projectId, target.value.project.id);
      }
      if (input.entityType) {
        return db.getCommentsByEntity(input.projectId, input.entityType, input.entityId);
      }
      return db.getCommentsByProject(input.projectId);
    }),

  // ─── Approval Gates ─────────────────────────────────────────────────────────

  updateApprovalState: designOrgAdminProcedure
    .input(z.object({
      projectId: z.number(),
      approvalState: z.enum(["draft", "review", "approved_rfq", "approved_marketing"]),
      rationale: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      requireScopedDesignMutation(await db.updateProjectApprovalStateForOrg(input.projectId, ctx.orgId, input.approvalState));
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "approval.update",
        entityType: "project",
        entityId: input.projectId,
        details: { approvalState: input.approvalState, rationale: input.rationale },
      });
      return { success: true };
    }),

  // ─── Structural Analytics (Phase 1 Fix — material_constants bridge) ─────────

  /**
   * Returns all seeded material constants so the frontend can display
   * real AED/m² pricing without an additional roundtrip.
   */
  getMaterialConstants: protectedProcedure
    .query(async () => {
      return db.getMaterialConstants();
    }),

  /**
   * calculateSpec — given a list of {materialType, areaM2} pairs, computes:
   *   - total cost in AED
   *   - total carbon footprint in kg CO²
   *   - weighted average maintenance factor (1–5 scale)
   *   - sustainability grade (A–E)
   *
   * Crosses the caller's material mix with the material_constants table.
   * Unknown material types are skipped (graceful fallback).
   */
  calculateSpec: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        materialType: z.string(),  // e.g. "concrete", "stone", "glass"
        areaM2: z.number().positive(),
      })),
    }))
    .mutation(async ({ input }) => {
      const constants = await db.getMaterialConstants();
      const lookup = new Map(constants.map((c: any) => [c.materialType, c]));

      let totalCostAed = 0;
      let totalCarbonKg = 0;
      let weightedMaintenanceSum = 0;
      let totalArea = 0;
      const breakdown: Array<{
        materialType: string;
        areaM2: number;
        costPerM2: number;
        lineCostAed: number;
        carbonKg: number;
        maintenanceFactor: number;
        matched: boolean;
      }> = [];

      for (const item of input.items) {
        const c: any = lookup.get(item.materialType);
        if (!c) {
          breakdown.push({
            materialType: item.materialType,
            areaM2: item.areaM2,
            costPerM2: 0,
            lineCostAed: 0,
            carbonKg: 0,
            maintenanceFactor: 3,
            matched: false,
          });
          continue;
        }
        const costPerM2 = Number(c.costPerM2 ?? 0);
        const carbonIntensity = Number(c.carbonIntensity ?? 0); // kg CO²/m²
        const maintenanceFactor = Number(c.maintenanceFactor ?? 3);
        const lineCost = costPerM2 * item.areaM2;
        const lineCarbonKg = carbonIntensity * item.areaM2;

        totalCostAed += lineCost;
        totalCarbonKg += lineCarbonKg;
        weightedMaintenanceSum += maintenanceFactor * item.areaM2;
        totalArea += item.areaM2;

        breakdown.push({
          materialType: item.materialType,
          areaM2: item.areaM2,
          costPerM2,
          lineCostAed: lineCost,
          carbonKg: lineCarbonKg,
          maintenanceFactor,
          matched: true,
        });
      }

      const avgMaintenanceFactor = totalArea > 0 ? weightedMaintenanceSum / totalArea : 3;

      // Sustainability grade based on avg carbon intensity (kg/m²)
      const avgCarbonPerM2 = totalArea > 0 ? totalCarbonKg / totalArea : 0;
      let sustainabilityGrade: string;
      if (avgCarbonPerM2 < 30) sustainabilityGrade = "A";
      else if (avgCarbonPerM2 < 60) sustainabilityGrade = "B";
      else if (avgCarbonPerM2 < 100) sustainabilityGrade = "C";
      else if (avgCarbonPerM2 < 150) sustainabilityGrade = "D";
      else sustainabilityGrade = "E";

      return {
        totalCostAed: Math.round(totalCostAed),
        totalCarbonKg: Math.round(totalCarbonKg),
        avgMaintenanceFactor: Math.round(avgMaintenanceFactor * 10) / 10,
        sustainabilityGrade,
        totalAreaM2: totalArea,
        costPerM2Avg: totalArea > 0 ? Math.round(totalCostAed / totalArea) : 0,
        breakdown,
      };
    }),

  // ─── Phase 4: Market Grounding ──────────────────────────────────────────────

  /**
   * 4.1 Design Trends: Return UAE market trends filtered by project style.
   * Used to inject market signals into AI recommendations and display trend
   * context in the InvestorSummary / DesignBrief pages.
   */
  getDesignTrends: orgProcedure
    .input(z.object({
      projectId: z.number(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const style = project.des01Style ?? undefined;
      const trends = await db.getPublicDesignTrends({
        styleClassification: style,
        region: "UAE",
        limit: input.limit,
      });
      // If style-specific returned nothing, fall back to all UAE trends
      if (trends.length === 0) {
        return db.getPublicDesignTrends({ region: "UAE", limit: input.limit });
      }
      return trends;
    }),

  /**
   * 4.2 Benchmark Overlay: Return AED/sqm benchmark for the project's
   * typology + location + tier, with progressive fallback.
   */
  getBenchmarkForProject: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const typology = project.ctx01Typology ?? "Residential";
      const location = project.ctx04Location ?? "Secondary";
      const tier = project.mkt01Tier ?? "Upper-mid";
      const bm = await db.getBenchmarkForProject(typology, location, tier);
      if (!bm) return null;
      // Convert sqft → sqm (1 sqft ≈ 0.0929 sqm) and provide AED range
      const SQM_PER_SQFT = 10.7639;
      return {
        id: bm.id,
        typology: bm.typology,
        location: bm.location,
        marketTier: bm.marketTier,
        // Costs in AED/sqm (benchmark stored as AED/sqft)
        costPerSqmLow: bm.costPerSqftLow != null ? Math.round(Number(bm.costPerSqftLow) * SQM_PER_SQFT) : null,
        costPerSqmMid: bm.costPerSqftMid != null ? Math.round(Number(bm.costPerSqftMid) * SQM_PER_SQFT) : null,
        costPerSqmHigh: bm.costPerSqftHigh != null ? Math.round(Number(bm.costPerSqftHigh) * SQM_PER_SQFT) : null,
        avgSellingPrice: bm.avgSellingPrice != null ? Number(bm.avgSellingPrice) : null,
        absorptionRate: bm.absorptionRate != null ? Number(bm.absorptionRate) : null,
        differentiationIndex: bm.differentiationIndex != null ? Number(bm.differentiationIndex) : null,
        competitiveDensity: bm.competitiveDensity,
        sourceType: bm.sourceType,
        dataYear: bm.dataYear,
      };
    }),

  /**
   * 4.3 Competitor Context: Top active intel sources from source_registry,
   * used to surface the "where this data comes from" panel in briefs.
   */



  // ─── Phase B.3: DLD Area Intelligence ──────────────────────────────────────
  getDldAreas: orgProcedure
    .query(async () => {
      return db.getDldAreas();
    }),

  getDldAreaComparison: orgProcedure
    .input(z.object({ areaId: z.number() }))
    .query(async ({ input }) => {
      const [projects, comparison] = await Promise.all([
        db.getDldProjectsByArea(input.areaId),
        db.getDldAreaComparison(input.areaId),
      ]);
      return {
        projects,
        comparison,
        totalProjects: projects.length,
        activeProjects: projects.filter((p: any) => p.projectStatus === "ACTIVE").length,
        finishedProjects: projects.filter((p: any) => p.projectStatus === "FINISHED").length,
        totalUnits: projects.reduce((s: number, p: any) => s + (p.noOfUnits ?? 0) + (p.noOfVillas ?? 0), 0),
      };
    }),


  getAreaBenchmarks: orgProcedure
    .query(async () => {
      return db.getAllAreaBenchmarks();
    }),

  getAreaBenchmark: orgProcedure
    .input(z.object({ areaId: z.number() }))
    .query(async ({ input }) => {
      return db.getDldAreaBenchmark(input.areaId);
    }),

  getDldDataStats: orgProcedure
    .query(async () => {
      const [transactionCount, rentCount] = await Promise.all([
        db.getDldTransactionCount(),
        db.getDldRentCount(),
      ]);
      return { transactionCount, rentCount };
    }),

  /** Returns DLD benchmark data for a project's saved area — used by Investor Summary */
  getProjectDldBenchmark: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      if (!project.dldAreaId) return null;
      const benchmark = await db.getDldAreaBenchmark(project.dldAreaId);
      return benchmark ? {
        areaName: project.dldAreaName || benchmark.areaNameEn,
        projectPurpose: project.projectPurpose || "sell_ready",
        saleP50: benchmark.saleP50 ? Number(benchmark.saleP50) : null,
        saleP25: benchmark.saleP25 ? Number(benchmark.saleP25) : null,
        saleP75: benchmark.saleP75 ? Number(benchmark.saleP75) : null,
        saleMean: benchmark.saleMean ? Number(benchmark.saleMean) : null,
        grossYield: benchmark.grossYield ? Number(benchmark.grossYield) : null,
        fitoutLow: benchmark.recommendedFitoutLow ? Number(benchmark.recommendedFitoutLow) : null,
        fitoutMid: benchmark.recommendedFitoutMid ? Number(benchmark.recommendedFitoutMid) : null,
        fitoutHigh: benchmark.recommendedFitoutHigh ? Number(benchmark.recommendedFitoutHigh) : null,
        transactionCount: benchmark.saleTransactionCount ? Number(benchmark.saleTransactionCount) : 0,
        rentContractCount: benchmark.rentTransactionCount ? Number(benchmark.rentTransactionCount) : 0,
      } : null;
    }),

  // ─── Phase A.4: Data Freshness ─────────────────────────────────────────────
  getDataFreshness: orgProcedure
    .query(async () => {
      const [sources, healthRecords, runs] = await Promise.all([
        db.getActiveSourceRegistry(50),
        db.getConnectorHealthSummary(),
        db.getIngestionRunHistory(5),
      ]);

      // Latest ingestion run
      const latestRun = runs.length > 0 ? runs[0] : null;

      // Build per-source freshness from source_registry.lastSuccessfulFetch
      const sourceFreshness = (sources ?? []).map((s: any) => {
        // Find most recent health record for this source
        const healthRec = (healthRecords ?? []).find(
          (h: any) => String(h.sourceId) === String(s.id) || h.sourceName === s.name
        );

        const lastFetch = s.lastSuccessfulFetch ?? healthRec?.createdAt ?? null;
        const daysSince = lastFetch
          ? Math.floor((Date.now() - new Date(lastFetch).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          id: s.id,
          name: s.name,
          sourceType: s.sourceType,
          reliabilityGrade: s.reliabilityDefault,
          lastFetch,
          daysSince,
          freshness: daysSince === null ? "unknown" : daysSince <= 7 ? "fresh" : daysSince <= 30 ? "aging" : "stale",
          latestStatus: healthRec?.status ?? null,
          recordsExtracted: healthRec?.recordsExtracted ?? 0,
        };
      });

      // Aggregate stats
      const freshCount = sourceFreshness.filter((s: any) => s.freshness === "fresh").length;
      const agingCount = sourceFreshness.filter((s: any) => s.freshness === "aging").length;
      const staleCount = sourceFreshness.filter((s: any) => s.freshness === "stale").length;
      const unknownCount = sourceFreshness.filter((s: any) => s.freshness === "unknown").length;
      const totalSources = sourceFreshness.length;

      // Overall health status
      const overallHealth = deriveOverallFreshnessHealth({ totalSources, agingCount, staleCount, unknownCount });

      return {
        overallHealth,
        totalSources,
        freshCount,
        agingCount,
        staleCount,
        unknownCount,
        latestRun: latestRun ? {
          runId: latestRun.runId,
          status: latestRun.status,
          startedAt: latestRun.startedAt,
          totalSources: latestRun.totalSources,
          sourcesSucceeded: latestRun.sourcesSucceeded,
          sourcesFailed: latestRun.sourcesFailed,
          recordsExtracted: latestRun.recordsExtracted,
        } : null,
        sources: sourceFreshness,
      };
    }),

  // ─── Phase A.3: Evidence Chain ─────────────────────────────────────────────
  getEvidenceChain: orgProcedure
    .input(z.object({
      category: z.string().optional(),
      projectId: z.number().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      if (input.projectId !== undefined) await requireDesignProject(input.projectId, ctx.orgId);
      const results = await db.getEvidenceWithSources({
        orgId: ctx.orgId,
        category: input.category,
        projectId: input.projectId,
        limit: input.limit,
      });
      return { evidence: results };
    }),

  getCompetitorContext: orgProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(6) }))
    .query(async ({ input }) => {
      return db.getActiveSourceRegistry(input.limit);
    }),

  // ─── Phase 5: Export & Handover ─────────────────────────────────────────────

  exportInvestorPdf: designOrgMutationProcedure
    .input(z.object({ projectId: z.number(), locale: z.enum(["en", "ar"]).default("en") }))
    .mutation(async ({ ctx, input }) => {
      const { generateInvestorPdfHtml } = await import("../engines/investor-pdf");
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      const [brief, recs, materialConsts, benchmark, trends, modelVersion, activeBenchmarkVersion, logicVersion] = await Promise.all([
        db.getLatestAiDesignBrief(input.projectId, ctx.orgId),
        db.getSpaceRecommendations(input.projectId, ctx.orgId),
        db.getMaterialConstants(),
        db.getBenchmarkForProject(project.ctx01Typology ?? "Residential", project.ctx04Location ?? "Secondary", project.mkt01Tier ?? "Upper-mid"),
        db.getPublicDesignTrends({ styleClassification: project.des01Style ?? undefined, region: "UAE", limit: 8 }),
        db.getActiveModelVersion(),
        db.getActiveBenchmarkVersion(),
        db.getPublishedLogicVersion(),
      ]);
      const totalFitoutBudget = (recs ?? []).reduce((s: number, r: any) => s + Number(r.budgetAllocation || 0), 0);
      const gfa = getPricingArea(project);
      const costPerSqm = gfa > 0 && totalFitoutBudget > 0 ? Math.round(totalFitoutBudget / gfa) : 0;
      const TIER_PREMIUM_PCT: Record<string, number> = { "Entry": 0, "Mid": 3, "Upper-mid": 8, "Luxury": 18, "Ultra-luxury": 30 };
      const salePremiumPct = TIER_PREMIUM_PCT[project.mkt01Tier ?? "Upper-mid"] ?? 8;
      const estimatedSalesPremiumAed = gfa > 0 ? Math.round(gfa * 25000 * salePremiumPct / 100) : 0;
      const TIER_GRADE: Record<string, string> = { "Entry": "B", "Mid": "B", "Upper-mid": "C", "Luxury": "D", "Ultra-luxury": "D" };
      const sustainabilityGrade = TIER_GRADE[project.mkt01Tier ?? "Upper-mid"] ?? "C";
      const briefData = (brief?.briefData ?? {}) as any;
      const allMaterials = (recs ?? []).flatMap((r: any) =>
        (r.materialPackage || []).map((m: any) => ({ name: m.productName, brand: m.brand, price: m.priceRangeAed, room: r.roomName }))
      );
      const spaces = (recs ?? []).map((r: any) => ({
        name: r.roomName, budgetAed: Number(r.budgetAllocation || 0), sqm: Number(r.sqm || 0),
        pct: totalFitoutBudget > 0 ? (Number(r.budgetAllocation || 0) / totalFitoutBudget) * 100 : 0,
        styleDirection: r.styleDirection,
      }));
      const SQF = 10.7639;
      const bmFmt = benchmark ? {
        costPerSqmLow: benchmark.costPerSqftLow != null ? Math.round(Number(benchmark.costPerSqftLow) * SQF) : null,
        costPerSqmMid: benchmark.costPerSqftMid != null ? Math.round(Number(benchmark.costPerSqftMid) * SQF) : null,
        costPerSqmHigh: benchmark.costPerSqftHigh != null ? Math.round(Number(benchmark.costPerSqftHigh) * SQF) : null,
        typology: benchmark.typology, location: benchmark.location, marketTier: benchmark.marketTier, dataYear: benchmark.dataYear,
      } : null;
      const html = generateInvestorPdfHtml({
        projectName: project.name ?? "Untitled Project", typology: project.ctx01Typology ?? "Residential",
        location: project.ctx04Location ?? "UAE", tier: project.mkt01Tier ?? "Upper-mid",
        style: project.des01Style ?? "Modern", gfaSqm: gfa,
        execSummary: briefData.executiveSummary ?? "", designDirection: briefData.designDirection ?? {},
        spaces, materials: allMaterials,
        materialConstants: (materialConsts ?? []).map((c: any) => ({
          materialType: c.materialType, costPerM2: Number(c.costPerM2),
          carbonIntensity: Number(c.carbonIntensity), sustainabilityGrade,
        })),
        totalFitoutBudget, costPerSqm, sustainabilityGrade, salePremiumPct,
        estimatedSalesPremiumAed, benchmark: bmFmt, designTrends: trends,
        locale: input.locale,
        modelVersion: modelVersion?.versionTag,
        benchmarkVersion: activeBenchmarkVersion?.versionTag,
        logicVersion: logicVersion?.name,
      });
      return { html, projectName: project.name ?? "Project" };
    }),

  createShareLink: designOrgAdminProcedure
    .input(z.object({ projectId: z.number(), expiryDays: z.number().min(1).max(90).default(7) }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const brief = await db.getLatestAiDesignBrief(input.projectId, ctx.orgId);
      if (!brief) throw new Error("Generate a design brief first before sharing");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiryDays);
      let token = "";
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        token = nanoid(32);
        try {
          requireScopedDesignMutation(await db.updateAiDesignBriefShareTokenForOrg(
            brief.id,
            input.projectId,
            ctx.orgId,
            token,
            expiresAt,
          ));
          break;
        } catch (error) {
          if (isDuplicateKeyError(error)) {
            if (attempt === 5) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Unable to create a unique share link",
              });
            }
            continue;
          }
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to create share link",
          });
        }
      }
      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "brief.share",
        entityType: "ai_design_brief",
        entityId: brief.id,
        details: { projectId: input.projectId, expiryDays: input.expiryDays },
      });
      return { token, shareUrl: `/share/${token}`, expiresAt: expiresAt.toISOString(), expiryDays: input.expiryDays };
    }),

  revokeShareLinks: designOrgAdminProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const result = await db.revokeAiDesignBriefSharesForProjectForOrg(
        input.projectId,
        ctx.orgId,
      );
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "brief.share.revoke_all",
        entityType: "project",
        entityId: input.projectId,
        details: {
          projectId: input.projectId,
          revokedCount: result.revokedCount,
        },
      });
      return { revokedCount: result.revokedCount, active: false as const };
    }),

  resolveShareLink: publicRateLimitedProcedure
    .input(z.object({
      token: z.string(),
      locale: z.enum(["en", "ar"]).default("en"),
    }))
    .query(async ({ input }) => {
      if (input.token.length < 8 || input.token.length > 64) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found or expired",
        });
      }
      const { brief, project } = await requireActivePublicShare(input.token);
      const [recs, benchmark, trends] = await Promise.all([
        db.getSpaceRecommendations(brief.projectId, brief.orgId),
        db.getBenchmarkForProject(project.ctx01Typology ?? "Residential", project.ctx04Location ?? "Secondary", project.mkt01Tier ?? "Upper-mid"),
        db.getPublicDesignTrends({ styleClassification: project.des01Style ?? undefined, region: "UAE", limit: 8 }),
      ]);

      // Phase 9: Compute space benchmark data for public share view
      let spaceEfficiency: any = undefined;
      if (project.floorPlanAnalysis) {
        try {
          const fpData = typeof project.floorPlanAnalysis === "string"
            ? JSON.parse(project.floorPlanAnalysis)
            : project.floorPlanAnalysis;
          if (fpData?.rooms?.length > 0 && project.dldAreaId) {
            const dldBench = await db.getDldAreaBenchmark(project.dldAreaId);
            const transactionCount = Number(dldBench?.saleTransactionCount);
            const medianSalePrice = Number(dldBench?.saleP50);
            if (dldBench && Number.isSafeInteger(transactionCount) && transactionCount > 0 && Number.isFinite(medianSalePrice) && medianSalePrice > 0) {
              const spaceResult = benchmarkSpaceRatios(
                fpData,
                dldBench.areaNameEn || "Dubai",
                transactionCount,
                medianSalePrice,
              );
              spaceEfficiency = {
                efficiencyScore: spaceResult.overallEfficiencyScore,
                criticalCount: spaceResult.totalCritical,
                advisoryCount: spaceResult.totalAdvisory,
                circulationPct: spaceResult.circulationWastePercent ?? 0,
                recommendations: (spaceResult.recommendations ?? []).slice(0, 6),
                guidanceBasis: {
                  kind: "miyar_ratio_guideline" as const,
                },
                marketContext: {
                  kind: "official_dld_observation" as const,
                  sourceName: "Dubai Land Department",
                  areaName: dldBench.areaNameEn || "Dubai",
                  period: dldBench.period,
                  transactionCount,
                },
              };
            }
          }
        } catch { /* skip if parsing fails */ }
      }

      const totalFitoutBudget = (recs ?? []).reduce((s: number, r: any) => s + Number(r.budgetAllocation || 0), 0);
      const gfa = getPricingArea(project);
      const TIER_PREMIUM_PCT: Record<string, number> = { "Entry": 0, "Mid": 3, "Upper-mid": 8, "Luxury": 18, "Ultra-luxury": 30 };
      const salePremiumPct = TIER_PREMIUM_PCT[project.mkt01Tier ?? "Upper-mid"] ?? 8;
      const SQF = 10.7639;
      return {
        locale: input.locale,
        readOnly: true as const,
        briefVersion: brief.version,
        disclaimer: reportCopy(input.locale, "disclaimer"),
        assumptions: [reportCopy(input.locale, "investorFallbackAssumptionHelp")],
        evidence: benchmark ? [{
          label: reportCopy(input.locale, "benchmarkVersion"),
          value: `${benchmark.typology} / ${benchmark.location} / ${benchmark.marketTier}${benchmark.dataYear ? ` / ${benchmark.dataYear}` : ""}`,
        }] : [],
        projectName: project.name ?? "Untitled Project", typology: project.ctx01Typology ?? "Residential",
        location: project.ctx04Location ?? "UAE", tier: project.mkt01Tier ?? "Upper-mid",
        style: project.des01Style ?? "Modern", gfaSqm: gfa,
        execSummary: ((brief.briefData as any)?.executiveSummary ?? "") as string,
        designDirection: ((brief.briefData as any)?.designDirection ?? {}) as Record<string, any>,
        spaces: (recs ?? []).map((r: any) => ({
          name: r.roomName, budgetAed: Number(r.budgetAllocation || 0), sqm: Number(r.sqm || 0),
          pct: totalFitoutBudget > 0 ? (Number(r.budgetAllocation || 0) / totalFitoutBudget) * 100 : 0,
        })),
        totalFitoutBudget,
        costPerSqm: gfa > 0 && totalFitoutBudget > 0 ? Math.round(totalFitoutBudget / gfa) : 0,
        salePremiumPct, estimatedSalesPremiumAed: gfa > 0 ? Math.round(gfa * 25000 * salePremiumPct / 100) : 0,
        financialBasis: {
          fitout: "project_estimate" as const,
          salesPremium: "tier_assumption" as const,
          policyVersion: "share-tier-premium-v1",
          assumedSalePriceAedPerSqm: 25000,
        },
        benchmark: benchmark ? {
          costPerSqmLow: benchmark.costPerSqftLow != null ? Math.round(Number(benchmark.costPerSqftLow) * SQF) : null,
          costPerSqmMid: benchmark.costPerSqftMid != null ? Math.round(Number(benchmark.costPerSqftMid) * SQF) : null,
          costPerSqmHigh: benchmark.costPerSqftHigh != null ? Math.round(Number(benchmark.costPerSqftHigh) * SQF) : null,
          typology: benchmark.typology, location: benchmark.location, marketTier: benchmark.marketTier, dataYear: benchmark.dataYear,
          sourceType: benchmark.sourceType,
        } : null,
        designTrends: trends.map((trend) => ({
          id: trend.id,
          trendName: trend.trendName,
          description: trend.description,
          trendCategory: trend.trendCategory,
          confidenceLevel: trend.confidenceLevel,
        })),
        expiresAt: brief.shareExpiresAt?.toISOString(),
        spaceEfficiency,
      };
    }),

  // ─── Phase 9: Room-Specific Render ─────────────────────────────────────────

  generateRoomRender: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      roomName: z.string(),
      roomType: z.string(),
      roomSqm: z.number(),
      finishGrade: z.enum(["A", "B", "C"]).default("A"),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);

      const inputs = projectToInputs(project);

      // Fetch board materials for material-accurate renders
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      const enrichedMaterials: any[] = [];
      if (boards && boards.length > 0) {
        const boardMaterials = await db.getMaterialsByBoard(boards[0].id);
        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            enrichedMaterials.push({
              name: mat.name,
              category: mat.category,
              tier: mat.tier,
              supplierName: mat.supplierName,
              costUnit: mat.costUnit,
              costLow: Number(mat.typicalCostLow) || 0,
              costHigh: Number(mat.typicalCostHigh) || 0,
              embodiedCarbon: mat.embodiedCarbon ? parseFloat(String(mat.embodiedCarbon)) : null,
              maintenanceFactor: mat.maintenanceFactor ? parseFloat(String(mat.maintenanceFactor)) : null,
              brandStandardApproval: mat.brandStandardApproval || null,
            });
          }
        }
      }

      const context = buildRoomPromptContext(
        inputs, input.roomName, input.roomType, input.roomSqm,
        enrichedMaterials, project.brandStandardConstraints
      );

      const prompt = generateRoomRenderPrompt(context, input.roomName, input.roomSqm, input.finishGrade);

      const validation = validatePrompt(prompt);
      if (!validation.valid) throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });

      const visualResult = requireScopedDesignInsert(await db.createGeneratedVisualForOrg({
        projectId: input.projectId,
        type: "room_render" as any,
        promptJson: { prompt, context, roomName: input.roomName, roomType: input.roomType },
        status: "generating",
        createdBy: ctx.user.id,
      }, ctx.orgId));

      try {
        const generated = await generateImage({ prompt });
        const url = generated.url;

        const assetResult = requireScopedDesignInsert(await db.createProjectAssetForOrg({
          projectId: input.projectId,
          filename: `room-render-${input.roomName.replace(/\s+/g, "-")}-${Date.now()}.png`,
          mimeType: generated.mimeType,
          sizeBytes: generated.sizeBytes,
          checksum: generated.checksum,
          storagePath: generated.storageKey,
          storageUrl: url,
          uploadedBy: ctx.user.id,
          category: "mood_image",
        }, ctx.orgId));

        requireScopedDesignMutation(await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, { status: "completed", imageAssetId: assetResult.id }));

        return { id: visualResult.id, assetId: assetResult.id, url, status: "completed" as const };
      } catch (error) {
        const failure = toAiOperationFailure(error, "design.room-render");
        requireScopedDesignMutation(await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, { status: "failed", errorMessage: failure.message }));
        return { id: visualResult.id, assetId: null, url: null, status: "failed" as const, error: failure.message, referenceId: failure.referenceId };
      }
    }),

  // ─── Phase 9: Floor Plan Upload ────────────────────────────────────────────

  uploadFloorPlan: designOrgMutationProcedure
    .input(z.object({
      projectId: z.number(),
      filename: z.string(),
      mimeType: z.string(),
      base64Data: z.string().max(MAX_LEGACY_BASE64_CHARS),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);

      const buffer = Buffer.from(input.base64Data, "base64");
      const media = await validateMediaBuffer(buffer, input.mimeType, "design.floor-plan.legacy-upload");
      const suffix = Math.random().toString(36).slice(2, 10);
      const storagePath = `projects/${input.projectId}/floor-plans/${suffix}-${input.filename}`;
      const uploaded = await storagePut(storagePath, media.buffer, media.mimeType);
      let created: Awaited<ReturnType<typeof db.createFloorPlanAssetAndLinkForOrg>>;
      try {
        created = await db.createFloorPlanAssetAndLinkForOrg({
          projectId: input.projectId,
          filename: input.filename,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          checksum: media.checksum,
          storagePath: uploaded.key,
          storageUrl: uploaded.url,
          uploadedBy: ctx.user.id,
          category: "other",
        }, ctx.orgId);
      } catch (error) {
        reportIndeterminateUploadPersistence(uploaded.key, error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Upload persistence could not be confirmed" });
      }
      if (!created) {
        try {
          await cleanupRejectedUpload(uploaded.key);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Upload cleanup failed" });
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
      }
      const result = requireScopedDesignInsert(created);

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "floor_plan.upload",
        entityType: "project",
        entityId: input.projectId,
        details: { assetId: result.id, filename: input.filename },
      });

      return { assetId: result.id, url: uploaded.url };
    }),

  // ─── Phase 9: Floor Plan Analysis ──────────────────────────────────────────

  analyzeFloorPlan: designOrgMutationProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);

      // Get the floor plan asset
      if (!project.floorPlanAssetId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No floor plan uploaded for this project" });
      }

      const { resource: asset, project: assetProject } = await requireDesignAsset(project.floorPlanAssetId, ctx.orgId);
      requireSameDesignProject(project.id, assetProject.id);
      if (!asset || !asset.storagePath) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Floor plan asset not found or has no URL" });
      }

      const media = await readValidatedProjectMedia(asset, "design.floor-plan.analyze");
      const analysis = await runFloorPlanAnalysis(media);

      // Store in the project record
      requireScopedDesignMutation(await db.updateProjectForOrg(input.projectId, ctx.orgId, {
        floorPlanAnalysis: analysis as any,
        // Also update totalFitoutArea if not already set
        ...((!project.totalFitoutArea || Number(project.totalFitoutArea) === 0) ? {
          totalFitoutArea: String(analysis.totalEstimatedSqm) as any,
        } : {}),
      }));

      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "floor_plan.analyze",
        entityType: "project",
        entityId: input.projectId,
        details: {
          roomCount: analysis.rooms.length,
          totalSqm: analysis.totalEstimatedSqm,
          unitType: analysis.unitType,
          confidence: analysis.analysisConfidence,
        },
      });

      return analysis;
    }),

  // ─── Phase 9: Space Benchmarking ───────────────────────────────────────────

  getSpaceBenchmark: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);

      if (!project.floorPlanAnalysis) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Floor plan has not been analyzed yet. Upload a floor plan and run analysis first." });
      }

      const analysis = project.floorPlanAnalysis as any;

      // Get DLD area data for data-backed recommendations
      let areaName = project.dldAreaName || project.ctx04Location || "Dubai";
      let transactionCount = 0;
      let saleP50: number | null = null;

      if (project.dldAreaId) {
        const benchmark = await db.getDldAreaBenchmark(project.dldAreaId);
        if (benchmark) {
          areaName = benchmark.areaNameEn || areaName;
          transactionCount = Number(benchmark.saleTransactionCount) || 0;
          saleP50 = benchmark.saleP50 ? Number(benchmark.saleP50) : null;
        }
      }

      const result = benchmarkSpaceRatios(analysis, areaName, transactionCount, saleP50);

      return result;
    }),
});
