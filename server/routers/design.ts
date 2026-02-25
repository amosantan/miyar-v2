/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure, orgProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { storagePut } from "../storage";
import { generateDesignBrief } from "../engines/design-brief";
import { buildPromptContext, interpolateTemplate, generateDefaultPrompt, validatePrompt } from "../engines/visual-gen";
import { computeBoardSummary, generateRfqLines, recommendMaterials } from "../engines/board-composer";
import { generateImage } from "../_core/imageGeneration";
import type { ProjectInputs } from "../../shared/miyar-types";
import { generateDesignBriefDocx } from "../engines/docx-brief";
import { nanoid } from "nanoid";

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

export const designRouter = router({
  // ─── Evidence Vault ─────────────────────────────────────────────────────────

  listAssets: protectedProcedure
    .input(z.object({ projectId: z.number(), category: z.string().optional() }))
    .query(async ({ input }) => {
      return db.getProjectAssets(input.projectId, input.category);
    }),

  uploadAsset: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      filename: z.string(),
      mimeType: z.string(),
      base64Data: z.string(),
      category: z.enum(["brief", "brand", "budget", "competitor", "inspiration", "material", "sales", "legal", "mood_image", "material_board", "marketing_hero", "generated", "other"]).default("other"),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      isClientVisible: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const suffix = Math.random().toString(36).slice(2, 10);
      const storagePath = `projects/${input.projectId}/assets/${suffix}-${input.filename}`;
      const { url } = await storagePut(storagePath, buffer, input.mimeType);

      const result = await db.createProjectAsset({
        projectId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: buffer.length,
        storagePath,
        storageUrl: url,
        uploadedBy: ctx.user.id,
        category: input.category,
        tags: input.tags || [],
        notes: input.notes,
        isClientVisible: input.isClientVisible,
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "asset.upload",
        entityType: "project_asset",
        entityId: result.id,
        details: { projectId: input.projectId, filename: input.filename, category: input.category },
      });

      return { id: result.id, url };
    }),

  deleteAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await db.getProjectAssetById(input.assetId);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      await db.deleteProjectAsset(input.assetId);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "asset.delete",
        entityType: "project_asset",
        entityId: input.assetId,
        details: { filename: asset.filename },
      });
      return { success: true };
    }),

  updateAsset: protectedProcedure
    .input(z.object({
      assetId: z.number(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      isClientVisible: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { assetId, ...updates } = input;
      await db.updateProjectAsset(assetId, updates as any);
      return { success: true };
    }),

  linkAsset: protectedProcedure
    .input(z.object({
      assetId: z.number(),
      linkType: z.enum(["evaluation", "report", "scenario", "material_board", "design_brief", "visual"]),
      linkId: z.number(),
    }))
    .mutation(async ({ input }) => {
      return db.createAssetLink(input);
    }),

  getAssetLinks: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      return db.getAssetLinksByAsset(input.assetId);
    }),

  // ─── Design Brief Generator ─────────────────────────────────────────────────

  generateBrief: protectedProcedure
    .input(z.object({ projectId: z.number(), scenarioId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

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

      const briefData = generateDesignBrief(
        { name: project.name, description: project.description },
        inputs,
        scoreResult,
      );

      // Get latest version number
      const existing = await db.getDesignBriefsByProject(input.projectId);
      const nextVersion = existing.length > 0 ? (existing[0].version + 1) : 1;

      const result = await db.createDesignBrief({
        projectId: input.projectId,
        scenarioId: input.scenarioId,
        version: nextVersion,
        projectIdentity: briefData.projectIdentity,
        designNarrative: briefData.designNarrative,
        materialSpecifications: briefData.materialSpecifications,
        boqFramework: briefData.boqFramework,
        detailedBudget: briefData.detailedBudget,
        designerInstructions: briefData.designerInstructions,
        createdBy: ctx.user.id,
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "design_brief.generate",
        entityType: "design_brief",
        entityId: result.id,
        details: { projectId: input.projectId, version: nextVersion },
      });

      return { id: result.id, version: nextVersion, data: briefData };
    }),

  listBriefs: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return db.getDesignBriefsByProject(input.projectId);
    }),

  getBrief: protectedProcedure
    .input(z.object({ briefId: z.number() }))
    .query(async ({ input }) => {
      return db.getDesignBriefById(input.briefId);
    }),

  getLatestBrief: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return db.getLatestDesignBrief(input.projectId);
    }),

  exportBriefDocx: protectedProcedure
    .input(z.object({ briefId: z.number() }))
    .mutation(async ({ input }) => {
      const brief = await db.getDesignBriefById(input.briefId);
      if (!brief) throw new Error("Design brief not found");

      const project = await db.getProjectById(brief.projectId);

      const docxBuffer = await generateDesignBriefDocx({
        projectIdentity: (brief.projectIdentity ?? {}) as Record<string, unknown>,
        designNarrative: (brief.designNarrative ?? {}) as Record<string, unknown>,
        materialSpecifications: (brief.materialSpecifications ?? {}) as Record<string, unknown>,
        boqFramework: brief.boqFramework as any,
        detailedBudget: (brief.detailedBudget ?? {}) as Record<string, unknown>,
        designerInstructions: brief.designerInstructions as any,
        version: brief.version,
        projectName: project?.name,
      });

      const fileKey = `reports/${brief.projectId}/design-brief-v${brief.version}-${nanoid(8)}.docx`;
      const { url } = await storagePut(fileKey, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

      return { url };
    }),

  // ─── Visual Generation (nano banana) ────────────────────────────────────────

  generateVisual: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      type: z.enum(["mood", "material_board", "hero"]),
      scenarioId: z.number().optional(),
      customPrompt: z.string().optional(),
      templateId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

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

      const context = buildPromptContext(inputs);

      // Build prompt
      let prompt: string;
      if (input.customPrompt) {
        prompt = input.customPrompt;
      } else if (input.templateId) {
        const templates = await db.getAllPromptTemplates(input.type, ctx.user.orgId ?? undefined);
        const tmpl = templates.find((t: any) => t.id === input.templateId);
        prompt = tmpl ? interpolateTemplate(tmpl.templateText, context) : generateDefaultPrompt(input.type, context);
      } else {
        // Use active template or default
        const tmpl = await db.getActivePromptTemplate(input.type, ctx.user.orgId ?? undefined);
        prompt = tmpl ? interpolateTemplate(tmpl.templateText, context) : generateDefaultPrompt(input.type, context);
      }

      // Validate prompt
      const validation = validatePrompt(prompt);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.reason });
      }

      // Create visual record
      const visualResult = await db.createGeneratedVisual({
        projectId: input.projectId,
        scenarioId: input.scenarioId,
        type: input.type,
        promptJson: { prompt, context, templateId: input.templateId },
        status: "generating",
        createdBy: ctx.user.id,
      });

      // Generate image asynchronously (but we await it for simplicity)
      try {
        const { url } = await generateImage({ prompt });

        // Create asset record
        const assetResult = await db.createProjectAsset({
          projectId: input.projectId,
          filename: `${input.type}-${Date.now()}.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          storagePath: `projects/${input.projectId}/visuals/${input.type}-${Date.now()}.png`,
          storageUrl: url,
          uploadedBy: ctx.user.id,
          category: input.type === "mood" ? "mood_image" : input.type === "material_board" ? "material_board" : "marketing_hero",
        });

        // Update visual record
        await db.updateGeneratedVisual(visualResult.id, {
          status: "completed",
          imageAssetId: assetResult.id,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          action: "visual.generate",
          entityType: "generated_visual",
          entityId: visualResult.id,
          details: { type: input.type, projectId: input.projectId },
        });

        return { id: visualResult.id, assetId: assetResult.id, url, status: "completed" as const };
      } catch (error: any) {
        await db.updateGeneratedVisual(visualResult.id, {
          status: "failed",
          errorMessage: error.message || "Image generation failed",
        });
        return { id: visualResult.id, assetId: null, url: null, status: "failed" as const, error: error.message };
      }
    }),

  listVisuals: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const visuals = await db.getGeneratedVisualsByProject(input.projectId);
      // Join with project_assets to get image URLs
      const enriched = await Promise.all(visuals.map(async (v: any) => {
        let imageUrl: string | null = null;
        if (v.imageAssetId) {
          const asset = await db.getProjectAssetById(v.imageAssetId);
          imageUrl = asset?.storageUrl ?? null;
        }
        return { ...v, imageUrl };
      }));
      return enriched;
    }),

  // V4-05: Attach a completed visual's asset to a report/pack as an evidence reference
  attachVisualToPack: protectedProcedure
    .input(z.object({
      visualId: z.number(),
      targetType: z.enum(["report", "design_brief", "material_board", "pack_section"]),
      targetId: z.number(),
      sectionLabel: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const visual = await db.getGeneratedVisualById(input.visualId);
      if (!visual || !visual.imageAssetId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Visual not found or has no image" });
      }
      // Create an evidence reference linking the visual's asset to the target
      await db.createEvidenceReference({
        evidenceRecordId: visual.imageAssetId, // asset ID as evidence
        targetType: input.targetType,
        targetId: input.targetId,
        sectionLabel: input.sectionLabel || `Visual #${visual.id}`,
        citationText: `AI-generated ${visual.type} visual (prompt: ${((visual.promptJson as any)?.prompt || "").slice(0, 100)}...)`,
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "visual.attach_to_pack",
        entityType: "generated_visual",
        entityId: visual.id,
        details: { targetType: input.targetType, targetId: input.targetId },
      });
      return { success: true };
    }),

  // ─── Material Board Composer ────────────────────────────────────────────────

  createBoard: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      boardName: z.string(),
      scenarioId: z.number().optional(),
      materialIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get materials for board JSON
      const materials: any[] = [];
      if (input.materialIds && input.materialIds.length > 0) {
        for (const id of input.materialIds) {
          const mat = await db.getMaterialById(id);
          if (mat) materials.push(mat);
        }
      }

      const boardResult = await db.createMaterialBoard({
        projectId: input.projectId,
        scenarioId: input.scenarioId,
        boardName: input.boardName,
        boardJson: materials,
        createdBy: ctx.user.id,
      });

      // Add materials to board join table
      if (input.materialIds) {
        for (const materialId of input.materialIds) {
          await db.addMaterialToBoard({ boardId: boardResult.id, materialId });
        }
      }

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "board.create",
        entityType: "material_board",
        entityId: boardResult.id,
        details: { projectId: input.projectId, materialCount: materials.length },
      });

      return { id: boardResult.id };
    }),

  listBoards: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return db.getMaterialBoardsByProject(input.projectId);
    }),

  getBoard: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ input }) => {
      const board = await db.getMaterialBoardById(input.boardId);
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });
      const boardMaterials = await db.getMaterialsByBoard(input.boardId);
      // Get full material details
      const materialDetails = [];
      for (const bm of boardMaterials) {
        const mat = await db.getMaterialById(bm.materialId);
        if (mat) materialDetails.push({ ...mat, boardJoinId: bm.id, quantity: bm.quantity, unitOfMeasure: bm.unitOfMeasure, boardNotes: bm.notes, sortOrder: bm.sortOrder, specNotes: bm.specNotes, costBandOverride: bm.costBandOverride });
      }
      return { board, materials: materialDetails };
    }),

  addMaterialToBoard: protectedProcedure
    .input(z.object({
      boardId: z.number(),
      materialId: z.number(),
      quantity: z.number().optional(),
      unitOfMeasure: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.addMaterialToBoard({
        boardId: input.boardId,
        materialId: input.materialId,
        quantity: input.quantity ? String(input.quantity) as any : undefined,
        unitOfMeasure: input.unitOfMeasure,
        notes: input.notes,
      });
    }),

  removeMaterialFromBoard: protectedProcedure
    .input(z.object({ joinId: z.number() }))
    .mutation(async ({ input }) => {
      await db.removeMaterialFromBoard(input.joinId);
      return { success: true };
    }),

  deleteBoard: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteMaterialBoard(input.boardId);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "board.delete",
        entityType: "material_board",
        entityId: input.boardId,
      });
      return { success: true };
    }),

  updateBoardTile: protectedProcedure
    .input(z.object({
      joinId: z.number(),
      specNotes: z.string().nullish(),
      costBandOverride: z.string().nullish(),
      quantity: z.number().nullish(),
      unitOfMeasure: z.string().nullish(),
      notes: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { joinId, ...rest } = input;
      await db.updateBoardTile(joinId, {
        specNotes: rest.specNotes ?? undefined,
        costBandOverride: rest.costBandOverride ?? undefined,
        quantity: rest.quantity !== undefined && rest.quantity !== null ? String(rest.quantity) : undefined,
        unitOfMeasure: rest.unitOfMeasure ?? undefined,
        notes: rest.notes ?? undefined,
      });
      return { success: true };
    }),

  reorderBoardTiles: protectedProcedure
    .input(z.object({
      boardId: z.number(),
      orderedJoinIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      await db.reorderBoardTiles(input.boardId, input.orderedJoinIds);
      return { success: true };
    }),

  exportBoardPdf: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const board = await db.getMaterialBoardById(input.boardId);
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });
      const project = await db.getProjectById(board.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

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
      const html = generateBoardPdfHtml({
        boardName: board.boardName,
        projectName: project.name,
        items,
        summary,
        rfqLines,
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
        userId: ctx.user.id,
        action: "board.export_pdf",
        entityType: "material_board",
        entityId: input.boardId,
        details: { fileUrl, itemCount: items.length },
      });

      return { fileUrl, html };
    }),

  boardSummary: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ input }) => {
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

  recommendMaterials: protectedProcedure
    .input(z.object({ projectId: z.number(), maxItems: z.number().default(10) }))
    .query(async ({ input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const catalog = await db.getAllMaterials();
      return recommendMaterials(catalog as any, project.mkt01Tier || "Upper-mid", input.maxItems);
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
      leadTimeDays: z.number().optional(),
      supplierName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const mapped: any = { ...updates };
      if (updates.typicalCostLow !== undefined) mapped.typicalCostLow = String(updates.typicalCostLow);
      if (updates.typicalCostHigh !== undefined) mapped.typicalCostHigh = String(updates.typicalCostHigh);
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

  addComment: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      entityType: z.enum(["design_brief", "material_board", "visual", "general"]),
      entityId: z.number().optional(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.createComment({
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: ctx.user.id,
        content: input.content,
      });
    }),

  listComments: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      if (input.entityType) {
        return db.getCommentsByEntity(input.projectId, input.entityType, input.entityId);
      }
      return db.getCommentsByProject(input.projectId);
    }),

  // ─── Approval Gates ─────────────────────────────────────────────────────────

  updateApprovalState: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      approvalState: z.enum(["draft", "review", "approved_rfq", "approved_marketing"]),
      rationale: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateProjectApprovalState(input.projectId, input.approvalState);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "approval.update",
        entityType: "project",
        entityId: input.projectId,
        details: { approvalState: input.approvalState, rationale: input.rationale },
      });
      return { success: true };
    }),
});
