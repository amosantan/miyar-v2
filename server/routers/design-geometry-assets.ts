import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { z } from "zod";

import { requireDesignProject } from "../_core/design-resource-access";
import { orgHeavyMutationProcedure, router } from "../_core/trpc";
import {
  cleanupRejectedUpload,
  reportIndeterminateUploadPersistence,
} from "../_core/upload-compensation";
import * as db from "../db";
import { inspectDxfGeometry } from "../engines/geometry/dxf-geometry-boundary";
import { storageCreatePresignedPut, storageRead } from "../storage";
import { DXF_BOUNDARY_LIMITS } from "../../shared/geometry";
import { bestEffortAudit } from "./design-router-shared";

const DXF_MIME_TYPES = [
  "application/dxf",
  "application/x-dxf",
  "application/octet-stream",
  "image/vnd.dxf",
  "image/x-dxf",
  "text/plain",
] as const;

const dxfMimeSchema = z
  .string()
  .transform(value => value.split(";", 1)[0].trim().toLowerCase())
  .pipe(z.enum(DXF_MIME_TYPES));

function isOwnedGeometryUploadKey(
  organizationId: number,
  projectId: number,
  key: string
): boolean {
  return key.startsWith(
    `projects/${organizationId}/${projectId}/geometry-uploads/`
  );
}

async function rejectUpload(
  storageKey: string,
  message: string
): Promise<never> {
  try {
    await cleanupRejectedUpload(storageKey);
  } catch {
    // The cleanup helper records reconciliation telemetry. Keep the client error
    // about the untrusted file and never persist an asset row.
  }
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** Additive asset endpoints; finalized rows are the only CAD identities APIs accept. */
export const designGeometryAssetsRouter = router({
  createGeometrySourceUpload: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        filename: z.string().min(1).max(512),
        mimeType: dxfMimeSchema,
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(DXF_BOUNDARY_LIMITS.sourceBytes),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (!/\.dxf$/i.test(input.filename)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only an ASCII .dxf source can enter the geometry boundary.",
        });
      }
      const key = `projects/${ctx.orgId}/${input.projectId}/geometry-uploads/${crypto.randomUUID()}.dxf`;
      const upload = await storageCreatePresignedPut(key, input.mimeType);
      return {
        storageKey: upload.key,
        uploadUrl: upload.uploadUrl,
        expiresInSeconds: 900,
      };
    }),

  finalizeGeometrySourceUpload: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        storageKey: z.string().min(1),
        filename: z.string().min(1).max(512),
        mimeType: dxfMimeSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (
        !isOwnedGeometryUploadKey(ctx.orgId, input.projectId, input.storageKey)
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }

      let stored;
      try {
        stored = await storageRead(
          input.storageKey,
          DXF_BOUNDARY_LIMITS.sourceBytes
        );
      } catch {
        return rejectUpload(
          input.storageKey,
          "The DXF upload could not be read safely."
        );
      }
      if (
        stored.sizeBytes <= 0 ||
        stored.sizeBytes > DXF_BOUNDARY_LIMITS.sourceBytes ||
        stored.buffer.byteLength !== stored.sizeBytes
      ) {
        return rejectUpload(
          input.storageKey,
          "The DXF upload is empty, changed during validation, or exceeds 10 MiB."
        );
      }

      const inspected = await inspectDxfGeometry({
        bytes: stored.buffer,
        fileName: input.filename,
        mediaType: stored.contentType ?? input.mimeType,
        levelElevation: "0",
      });
      const acceptableUnknownUnits =
        inspected.status === "insufficient_information" &&
        inspected.issue?.code === "unknown_source_units";
      if (inspected.status !== "imported" && !acceptableUnknownUnits) {
        return rejectUpload(
          input.storageKey,
          inspected.issue?.message ?? "The DXF upload was rejected."
        );
      }

      const existing = (await db.getProjectAssets(input.projectId)).find(
        asset => asset.storagePath === input.storageKey
      );
      if (existing) {
        if (existing.checksum !== inspected.evidence.checksum.value) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A finalized asset no longer matches its stored checksum.",
          });
        }
        return { assetId: existing.id };
      }

      let created: Awaited<ReturnType<typeof db.createProjectAssetForOrg>>;
      try {
        created = await db.createProjectAssetForOrg(
          {
            projectId: input.projectId,
            filename: input.filename.replace(/[\\/\u0000]/g, "_").slice(0, 512),
            mimeType: input.mimeType,
            sizeBytes: stored.sizeBytes,
            storagePath: input.storageKey,
            checksum: inspected.evidence.checksum.value,
            uploadedBy: ctx.user.id,
            category: "floor_plan",
            assetType: "cad",
            notes: "Finalized deterministic ASCII DXF geometry source.",
            tags: ["di01", "ascii-dxf"],
            isClientVisible: false,
          },
          ctx.orgId
        );
      } catch (error) {
        reportIndeterminateUploadPersistence(input.storageKey, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Geometry upload persistence could not be confirmed.",
        });
      }
      if (!created) {
        try {
          await cleanupRejectedUpload(input.storageKey);
        } catch {
          /* cleanup telemetry preserves the orphan reconciliation signal */
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }

      await bestEffortAudit({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "geometry_source.finalize",
        entityType: "project_asset",
        entityId: created.id,
        details: {
          projectId: input.projectId,
          checksum: inspected.evidence.checksum.value,
          byteLength: stored.sizeBytes,
          unitState: inspected.issue?.code ?? "explicit",
        },
      });
      return { assetId: created.id };
    }),
});
