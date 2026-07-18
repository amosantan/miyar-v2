/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  requireDesignAsset,
  requireDesignLinkTarget,
  requireDesignProject,
  requireSameDesignProject,
  requireScopedDesignInsert,
  requireScopedDesignMutation,
} from "../_core/design-resource-access";
import {
  isSupportedMediaMimeType,
  MAX_MEDIA_BYTES,
  mediaTypeFromMime,
  validateMediaBuffer,
} from "../_core/media-validation";
import { readValidatedProjectMedia } from "../_core/project-media";
import {
  designOrgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import {
  cleanupRejectedUpload,
  reportIndeterminateUploadPersistence,
} from "../_core/upload-compensation";
import * as db from "../db";
import { analyzeFloorPlan as runFloorPlanAnalysis } from "../engines/design/floor-plan-analyzer";
import { storageCreatePresignedPut, storageGet, storagePut } from "../storage";

import { bestEffortAudit } from "./design-router-shared";

const assetCategorySchema = z.enum([
  "brief",
  "brand",
  "budget",
  "competitor",
  "inspiration",
  "material",
  "sales",
  "legal",
  "mood_image",
  "material_board",
  "marketing_hero",
  "generated",
  "other",
]);
const MAX_LEGACY_BASE64_CHARS = Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 4;

function isOwnedUploadKey(
  orgId: number,
  projectId: number,
  key: string
): boolean {
  return key.startsWith(`projects/${orgId}/${projectId}/uploads/`);
}

export const designAssetsRouter = router({
  listAssets: orgProcedure
    .input(z.object({ projectId: z.number(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      return db.getProjectAssets(input.projectId, input.category);
    }),

  createAssetUpload: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const mimeType = input.mimeType.toLowerCase();
      if (!isSupportedMediaMimeType(mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This file type is not supported. Please choose a supported image, PDF, audio, or video file.",
        });
      }
      const key = `projects/${ctx.orgId}/${input.projectId}/uploads/${crypto.randomUUID()}`;
      const upload = await storageCreatePresignedPut(key, mimeType);
      return {
        storageKey: upload.key,
        uploadUrl: upload.uploadUrl,
        expiresInSeconds: 900,
      };
    }),

  finalizeAssetUpload: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        storageKey: z.string().min(1),
        filename: z.string().min(1).max(512),
        mimeType: z.string(),
        category: assetCategorySchema.default("other"),
        tags: z.array(z.string().max(100)).max(30).optional(),
        notes: z.string().max(5_000).optional(),
        isClientVisible: z.boolean().default(true),
        purpose: z.enum(["asset", "floor_plan"]).default("asset"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (!isOwnedUploadKey(ctx.orgId, input.projectId, input.storageKey)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }

      let media;
      try {
        media = await readValidatedProjectMedia(
          {
            storagePath: input.storageKey,
            mimeType: input.mimeType,
          },
          "design.asset.finalize"
        );
      } catch (error) {
        try {
          await cleanupRejectedUpload(input.storageKey);
        } catch {
          /* telemetry is emitted by the cleanup helper */
        }
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
        category:
          input.purpose === "floor_plan"
            ? ("floor_plan" as const)
            : input.category,
        assetType: mediaTypeFromMime(media.mimeType),
        tags: input.tags || [],
        notes: input.notes,
        isClientVisible: input.isClientVisible,
      };

      const created =
        input.purpose === "floor_plan"
          ? await db.createFloorPlanAssetAndLinkForOrg(assetInput, ctx.orgId)
          : await db.createProjectAssetForOrg(assetInput, ctx.orgId);
      if (!created) {
        try {
          await cleanupRejectedUpload(input.storageKey);
        } catch {
          /* preserved by reconciliation telemetry */
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action:
          input.purpose === "floor_plan" ? "floor_plan.upload" : "asset.upload",
        entityType: "project_asset",
        entityId: created.id,
        details: {
          projectId: input.projectId,
          mediaType: media.mimeType,
          sizeBytes: media.sizeBytes,
        },
      });
      return {
        id: created.id,
        url: stored.url,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
      };
    }),

  uploadAsset: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string().max(MAX_LEGACY_BASE64_CHARS),
        category: z
          .enum([
            "brief",
            "brand",
            "budget",
            "competitor",
            "inspiration",
            "material",
            "sales",
            "legal",
            "mood_image",
            "material_board",
            "marketing_hero",
            "generated",
            "other",
          ])
          .default("other"),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        isClientVisible: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const buffer = Buffer.from(input.base64Data, "base64");
      const media = await validateMediaBuffer(
        buffer,
        input.mimeType,
        "design.asset.legacy-upload"
      );
      const suffix = Math.random().toString(36).slice(2, 10);
      const storagePath = `projects/${input.projectId}/assets/${suffix}-${input.filename}`;
      const uploaded = await storagePut(
        storagePath,
        media.buffer,
        media.mimeType
      );
      let created: Awaited<ReturnType<typeof db.createProjectAssetForOrg>>;
      try {
        created = await db.createProjectAssetForOrg(
          {
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
          },
          ctx.orgId
        );
      } catch (error) {
        reportIndeterminateUploadPersistence(uploaded.key, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Upload persistence could not be confirmed",
        });
      }
      if (!created) {
        try {
          await cleanupRejectedUpload(uploaded.key);
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Upload cleanup failed",
          });
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }
      const result = requireScopedDesignInsert(created);

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "asset.upload",
        entityType: "project_asset",
        entityId: result.id,
        details: {
          projectId: input.projectId,
          filename: input.filename,
          category: input.category,
        },
      });

      return { id: result.id, url: uploaded.url };
    }),

  deleteAsset: designOrgMutationProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { resource: asset } = await requireDesignAsset(
        input.assetId,
        ctx.orgId
      );
      requireScopedDesignMutation(
        await db.deleteProjectAssetForOrg(input.assetId, ctx.orgId)
      );
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
    .input(
      z.object({
        assetId: z.number(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        isClientVisible: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignAsset(input.assetId, ctx.orgId);
      const { assetId, ...updates } = input;
      requireScopedDesignMutation(
        await db.updateProjectAssetForOrg(assetId, ctx.orgId, updates as any)
      );
      return { success: true };
    }),

  linkAsset: designOrgMutationProcedure
    .input(
      z.object({
        assetId: z.number(),
        linkType: z.enum([
          "evaluation",
          "report",
          "scenario",
          "material_board",
          "design_brief",
          "visual",
        ]),
        linkId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await requireDesignAsset(input.assetId, ctx.orgId);
      const target = await requireDesignLinkTarget(
        input.linkType,
        input.linkId,
        ctx.orgId
      );
      requireSameDesignProject(asset.project.id, target.value.project.id);
      return requireScopedDesignInsert(
        await db.createAssetLinkForOrg(input, ctx.orgId)
      );
    }),

  getAssetLinks: orgProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ ctx, input }) => {
      const asset = await requireDesignAsset(input.assetId, ctx.orgId);
      const links = await db.getAssetLinksByAsset(input.assetId);
      for (const link of links) {
        const target = await requireDesignLinkTarget(
          link.linkType,
          link.linkId,
          ctx.orgId
        );
        requireSameDesignProject(asset.project.id, target.value.project.id);
      }
      return links;
    }),

  uploadFloorPlan: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string().max(MAX_LEGACY_BASE64_CHARS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);

      const buffer = Buffer.from(input.base64Data, "base64");
      const media = await validateMediaBuffer(
        buffer,
        input.mimeType,
        "design.floor-plan.legacy-upload"
      );
      const suffix = Math.random().toString(36).slice(2, 10);
      const storagePath = `projects/${input.projectId}/floor-plans/${suffix}-${input.filename}`;
      const uploaded = await storagePut(
        storagePath,
        media.buffer,
        media.mimeType
      );
      let created: Awaited<
        ReturnType<typeof db.createFloorPlanAssetAndLinkForOrg>
      >;
      try {
        created = await db.createFloorPlanAssetAndLinkForOrg(
          {
            projectId: input.projectId,
            filename: input.filename,
            mimeType: media.mimeType,
            sizeBytes: media.sizeBytes,
            checksum: media.checksum,
            storagePath: uploaded.key,
            storageUrl: uploaded.url,
            uploadedBy: ctx.user.id,
            category: "other",
          },
          ctx.orgId
        );
      } catch (error) {
        reportIndeterminateUploadPersistence(uploaded.key, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Upload persistence could not be confirmed",
        });
      }
      if (!created) {
        try {
          await cleanupRejectedUpload(uploaded.key);
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Upload cleanup failed",
          });
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
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

  analyzeFloorPlan: designOrgMutationProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);

      // Get the floor plan asset
      if (!project.floorPlanAssetId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No floor plan uploaded for this project",
        });
      }

      const { resource: asset, project: assetProject } =
        await requireDesignAsset(project.floorPlanAssetId, ctx.orgId);
      requireSameDesignProject(project.id, assetProject.id);
      if (!asset || !asset.storagePath) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Floor plan asset not found or has no URL",
        });
      }

      const media = await readValidatedProjectMedia(
        asset,
        "design.floor-plan.analyze"
      );
      const analysis = await runFloorPlanAnalysis(media);

      // Store in the project record
      requireScopedDesignMutation(
        await db.updateProjectForOrg(input.projectId, ctx.orgId, {
          floorPlanAnalysis: analysis as any,
          // Also update totalFitoutArea if not already set
          ...(!project.totalFitoutArea || Number(project.totalFitoutArea) === 0
            ? {
                totalFitoutArea: String(analysis.totalEstimatedSqm) as any,
              }
            : {}),
        })
      );

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
});
