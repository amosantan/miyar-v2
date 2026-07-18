/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  requireDesignAsset,
  requireDesignAssetLink,
  requireDesignBoard,
  requireDesignBoardJoin,
  requireDesignLinkTarget,
  requireDesignProject,
  requireDesignScenario,
  requireDesignVisual,
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
import {
  computeBoardSummary,
  generateRfqLines,
} from "../engines/board-composer";
import { storagePut } from "../storage";

import { bestEffortAudit } from "./design-router-shared";

export const designBoardsRouter = router({
  pinVisualToBoard: designOrgMutationProcedure
    .input(
      z.object({
        visualId: z.number(),
        boardId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { resource: visual, project: visualProject } =
        await requireDesignVisual(input.visualId, ctx.orgId);
      if (!visual || !visual.imageAssetId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Visual not found or has no image",
        });
      }
      const { project: boardProject } = await requireDesignBoard(
        input.boardId,
        ctx.orgId
      );
      const { project: assetProject } = await requireDesignAsset(
        visual.imageAssetId,
        ctx.orgId
      );
      requireSameDesignProject(visualProject.id, boardProject.id);
      requireSameDesignProject(visualProject.id, assetProject.id);
      // Create an asset link from the visual's image asset to the board
      const link = requireScopedDesignInsert(
        await db.createAssetLinkForOrg(
          {
            assetId: visual.imageAssetId,
            linkType: "material_board",
            linkId: input.boardId,
          },
          ctx.orgId
        )
      );
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
      const { project: boardProject } = await requireDesignBoard(
        input.boardId,
        ctx.orgId
      );
      const links = await db.getAssetLinksByEntity(
        "material_board",
        input.boardId
      );
      // Resolve each link to its visual + image URL
      const pinned = await Promise.all(
        links.map(
          async (link: { id: number; assetId: number; createdAt: Date }) => {
            const { resource: asset, project: assetProject } =
              await requireDesignAsset(link.assetId, ctx.orgId);
            requireSameDesignProject(boardProject.id, assetProject.id);
            return {
              linkId: link.id,
              assetId: link.assetId,
              imageUrl: asset?.storageUrl ?? null,
              fileName: asset?.filename ?? null,
              pinnedAt: link.createdAt,
            };
          }
        )
      );
      return pinned;
    }),

  unpinVisual: designOrgMutationProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const authorizedLink = await requireDesignAssetLink(
        input.linkId,
        ctx.orgId
      );
      if (authorizedLink.resource.linkType !== "material_board") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }
      const target = await requireDesignLinkTarget(
        authorizedLink.resource.linkType,
        authorizedLink.resource.linkId,
        ctx.orgId
      );
      requireSameDesignProject(
        authorizedLink.project.id,
        target.value.project.id
      );
      requireScopedDesignMutation(
        await db.deleteAssetLinkForOrg(input.linkId, ctx.orgId)
      );
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "visual.unpin_from_board",
        entityType: "asset_link",
        entityId: input.linkId,
      });
      return { success: true };
    }),

  createBoard: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        boardName: z.string(),
        scenarioId: z.number().optional(),
        materialIds: z.array(z.number()).optional(),
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
      const materialIds = input.materialIds ?? [];
      if (new Set(materialIds).size !== materialIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duplicate material IDs are not allowed",
        });
      }

      const boardResult = requireScopedDesignInsert(
        await db.createMaterialBoardWithMaterialsForOrg(
          {
            projectId: input.projectId,
            scenarioId: input.scenarioId,
            boardName: input.boardName,
            createdBy: ctx.user.id,
          },
          materialIds,
          ctx.orgId
        )
      );

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "board.create",
        entityType: "material_board",
        entityId: boardResult.id,
        details: {
          projectId: input.projectId,
          materialCount: materialIds.length,
        },
      });

      return { id: boardResult.id };
    }),

  listBoards: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      for (const board of boards) {
        await requireMatchingDesignScenario(
          board.scenarioId,
          board.projectId,
          ctx.orgId
        );
      }
      return boards;
    }),

  getBoard: orgProcedure
    .input(z.object({ boardId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { resource: board } = await requireDesignBoard(
        input.boardId,
        ctx.orgId
      );
      await requireMatchingDesignScenario(
        board.scenarioId,
        board.projectId,
        ctx.orgId
      );
      const boardMaterials = await db.getMaterialsByBoard(input.boardId);
      // Get full material details
      const materialDetails = [];
      for (const bm of boardMaterials) {
        const mat = await db.getMaterialById(bm.materialId);
        if (mat)
          materialDetails.push({
            ...mat,
            boardJoinId: bm.id,
            quantity: bm.quantity,
            unitOfMeasure: bm.unitOfMeasure,
            boardNotes: bm.notes,
            sortOrder: bm.sortOrder,
            specNotes: bm.specNotes,
            costBandOverride: bm.costBandOverride,
          });
      }
      return { board, materials: materialDetails };
    }),

  addMaterialToBoard: designOrgMutationProcedure
    .input(
      z.object({
        boardId: z.number(),
        materialId: z.number(),
        quantity: z.number().optional(),
        unitOfMeasure: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoard(input.boardId, ctx.orgId);
      return requireScopedDesignInsert(
        await db.addMaterialToBoardForOrg(
          {
            boardId: input.boardId,
            materialId: input.materialId,
            quantity: input.quantity
              ? (String(input.quantity) as any)
              : undefined,
            unitOfMeasure: input.unitOfMeasure,
            notes: input.notes,
          },
          ctx.orgId
        )
      );
    }),

  removeMaterialFromBoard: designOrgMutationProcedure
    .input(z.object({ joinId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoardJoin(input.joinId, ctx.orgId);
      requireScopedDesignMutation(
        await db.removeMaterialFromBoardForOrg(input.joinId, ctx.orgId)
      );
      return { success: true };
    }),

  deleteBoard: designOrgMutationProcedure
    .input(z.object({ boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoard(input.boardId, ctx.orgId);
      requireScopedDesignMutation(
        await db.deleteMaterialBoardForOrg(input.boardId, ctx.orgId)
      );
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
    .input(
      z.object({
        joinId: z.number(),
        specNotes: z.string().nullish(),
        costBandOverride: z.string().nullish(),
        quantity: z.number().nullish(),
        unitOfMeasure: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignBoardJoin(input.joinId, ctx.orgId);
      const { joinId, ...rest } = input;
      requireScopedDesignMutation(
        await db.updateBoardTileForOrg(joinId, ctx.orgId, {
          specNotes: rest.specNotes ?? undefined,
          costBandOverride: rest.costBandOverride ?? undefined,
          quantity:
            rest.quantity !== undefined && rest.quantity !== null
              ? String(rest.quantity)
              : undefined,
          unitOfMeasure: rest.unitOfMeasure ?? undefined,
          notes: rest.notes ?? undefined,
        })
      );
      return { success: true };
    }),

  reorderBoardTiles: designOrgMutationProcedure
    .input(
      z.object({
        boardId: z.number(),
        orderedJoinIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const board = await requireDesignBoard(input.boardId, ctx.orgId);
      if (new Set(input.orderedJoinIds).size !== input.orderedJoinIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Board tile identifiers must be unique",
        });
      }
      for (const joinId of input.orderedJoinIds) {
        const join = await requireDesignBoardJoin(joinId, ctx.orgId);
        requireSameDesignProject(board.project.id, join.project.id);
        if (join.parent.id !== input.boardId)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Resource not found",
          });
      }
      requireScopedDesignMutation(
        await db.reorderBoardTilesForOrg(
          input.boardId,
          input.orderedJoinIds,
          ctx.orgId
        )
      );
      return { success: true };
    }),

  exportBoardPdf: designOrgMutationProcedure
    .input(
      z.object({
        boardId: z.number(),
        locale: z.enum(["en", "ar"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { resource: board, project } = await requireDesignBoard(
        input.boardId,
        ctx.orgId
      );

      const boardMaterials = await db.getMaterialsByBoard(input.boardId);
      const items: Array<{
        materialId: number;
        name: string;
        category: string;
        tier: string;
        costLow: number;
        costHigh: number;
        costUnit: string;
        leadTimeDays: number;
        leadTimeBand: string;
        supplierName: string;
        specNotes?: string;
        costBandOverride?: string;
        quantity?: string;
        unitOfMeasure?: string;
        notes?: string;
      }> = [];
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
        db.getActiveModelVersion(),
        db.getActiveBenchmarkVersion(),
        db.getPublishedLogicVersion(),
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
});
