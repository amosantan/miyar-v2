import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { requireDesignAsset } from "../_core/design-resource-access";
import { requireProjectForOrg } from "../_core/project-access";
import {
  orgAdminProcedure,
  orgHeavyMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import {
  canonicalizeGeometry,
  decimalCoordinateToMicrometres,
  GeometryDeadlineError,
  twiceSquareMicrometresToSquareMetres,
} from "../engines/geometry/canonical-geometry";
import { inspectDxfGeometry } from "../engines/geometry/dxf-geometry-boundary";
import { storageRead } from "../storage";
import {
  DXF_ADAPTER_VERSION,
  DXF_BOUNDARY_LIMITS,
  GEOMETRY_CANONICALIZER_VERSION,
  GEOMETRY_SCHEMA_VERSION,
  GEOMETRY_TOLERANCE_POLICY_VERSION,
  ROOM_FLOOR_POLYGON_AREA,
  type CanonicalGeometryResult,
  type GeometryInputRoom,
  type GeometrySnapTransform,
  type GeometrySourceUnit,
} from "../../shared/geometry";

const pointSchema = z.object({
  x: z.string().min(1).max(64),
  y: z.string().min(1).max(64),
});
const roomSchema = z.object({
  spaceId: z.string().min(1).max(64),
  roomName: z.string().min(1).max(255).optional(),
  roomCode: z.string().min(1).max(64).optional(),
  category: z.string().min(1).max(64).optional(),
  levelElevation: z.string().min(1).max(64),
  outerRing: z.array(pointSchema).min(4).max(2_001),
  holes: z.array(z.array(pointSchema).min(4).max(2_001)).max(100).optional(),
});
const sourceUnitSchema = z.enum(["m", "mm"]);
const snapTransformSchema = z.enum(["none", "1mm"]);

export const MANUAL_GEOMETRY_LIMITS = {
  rooms: 100,
  vertices: 10_000,
  deadlineMilliseconds: 500,
} as const;

type RoomInput = z.infer<typeof roomSchema>;

function sourcePointInMicrometres(
  point: { x: string; y: string },
  unit: GeometrySourceUnit
) {
  return {
    x: decimalCoordinateToMicrometres(point.x, unit).toString(),
    y: decimalCoordinateToMicrometres(point.y, unit).toString(),
  };
}

function totalArea2(canonical: CanonicalGeometryResult): bigint {
  return canonical.geometry.rooms.reduce(
    (sum, room) => sum + BigInt(room.areaSquareMicrometresTwice),
    BigInt(0)
  );
}

export function manualPreview(
  rooms: RoomInput[],
  sourceUnit: GeometrySourceUnit,
  snapTransform: GeometrySnapTransform,
  deadlineAtMilliseconds = Date.now() +
    MANUAL_GEOMETRY_LIMITS.deadlineMilliseconds
) {
  const vertexCount = rooms.reduce(
    (total, room) =>
      total +
      room.outerRing.length +
      (room.holes ?? []).reduce((sum, ring) => sum + ring.length, 0),
    0
  );
  if (vertexCount > MANUAL_GEOMETRY_LIMITS.vertices) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Manual geometry exceeds the 10,000 vertex limit.",
    });
  }
  let canonical: CanonicalGeometryResult;
  try {
    canonical = canonicalizeGeometry(
      {
        schemaVersion: GEOMETRY_SCHEMA_VERSION,
        measurementBasis: ROOM_FLOOR_POLYGON_AREA,
        sourceUnit,
        snapTransform,
        rooms: rooms as GeometryInputRoom[],
      },
      {
        deadlineAtMilliseconds,
      }
    );
  } catch (error) {
    if (error instanceof GeometryDeadlineError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Manual geometry exceeded the 500 millisecond processing deadline.",
      });
    }
    throw error;
  }
  if (
    Buffer.byteLength(canonical.canonicalJson, "utf8") >
    DXF_BOUNDARY_LIMITS.canonicalJsonBytes
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Canonical geometry exceeds the 8 MiB JSON limit.",
    });
  }
  const sourceById = new Map(rooms.map(room => [room.spaceId, room] as const));
  return {
    status: "ready" as const,
    fingerprint: canonical.fingerprint,
    totalAreaSqm: twiceSquareMicrometresToSquareMetres(totalArea2(canonical)),
    rooms: canonical.geometry.rooms.map(room => ({
      spaceId: room.spaceId,
      roomName: sourceById.get(room.spaceId)?.roomName,
      areaSqm: room.areaSquareMetres,
      status: "user_entered" as const,
      sourceOuterRing: sourceById
        .get(room.spaceId)
        ?.outerRing.map(point => sourcePointInMicrometres(point, sourceUnit)),
      normalizedOuterRing: room.outerRing.points,
    })),
    warnings: [] as string[],
    insufficiencies: [] as string[],
    canonical,
  };
}

async function readAuthorizedDxf(input: {
  projectId: number;
  organizationId: number;
  assetId: number;
  sourceLineageId: string;
  sourceUnit: GeometrySourceUnit;
  snapTransform: GeometrySnapTransform;
  levelElevation: string;
}) {
  const { resource: asset, project } = await requireDesignAsset(
    input.assetId,
    input.organizationId
  );
  if (project.id !== input.projectId || asset.assetType !== "cad") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Geometry asset not found",
    });
  }
  if (!asset.storagePath || !asset.checksum) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Geometry asset has not completed server-side finalization.",
    });
  }
  const stored = await storageRead(
    asset.storagePath,
    DXF_BOUNDARY_LIMITS.sourceBytes
  );
  if (
    stored.sizeBytes <= 0 ||
    stored.sizeBytes > DXF_BOUNDARY_LIMITS.sourceBytes ||
    stored.buffer.byteLength !== stored.sizeBytes
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Geometry asset is unavailable or oversized.",
    });
  }
  const checksum = createHash("sha256").update(stored.buffer).digest("hex");
  if (checksum !== asset.checksum) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Geometry asset bytes no longer match the finalized checksum.",
    });
  }
  const inspection = await inspectDxfGeometry({
    bytes: stored.buffer,
    fileName: asset.filename,
    mediaType: stored.contentType ?? asset.mimeType,
    sourceLineageId: input.sourceLineageId,
    selectedUnit: input.sourceUnit,
    levelElevation: input.levelElevation,
    snapTransform: input.snapTransform,
  });
  return { asset, inspection };
}

function dxfPreview(
  inspection: Awaited<ReturnType<typeof inspectDxfGeometry>>,
  selectedUnit: GeometrySourceUnit
) {
  const status =
    inspection.status === "imported"
      ? "ready"
      : inspection.status === "conflicting_information"
        ? "conflict"
        : "insufficient";
  const overlayById = new Map(
    inspection.levelOverlays.flatMap(level =>
      level.rooms.map(room => [room.sourceRoomId, room] as const)
    )
  );
  return {
    status,
    fingerprint: inspection.canonical?.fingerprint,
    totalAreaSqm: inspection.canonical
      ? twiceSquareMicrometresToSquareMetres(totalArea2(inspection.canonical))
      : undefined,
    rooms:
      inspection.canonical?.geometry.rooms.map(room => {
        const overlay = overlayById.get(room.spaceId);
        return {
          spaceId: room.spaceId,
          roomName: overlay?.sourceLayer,
          areaSqm: room.areaSquareMetres,
          status: "imported" as const,
          sourceOuterRing: overlay?.sourcePoints.map(point =>
            sourcePointInMicrometres(point, selectedUnit)
          ),
          normalizedOuterRing: room.outerRing.points,
        };
      }) ?? [],
    warnings: inspection.warnings,
    insufficiencies: inspection.issue ? [inspection.issue.message] : [],
    evidence: inspection.evidence,
    inspection: inspection.inspection,
  };
}

function importIdempotencyKey(input: {
  organizationId: number;
  projectId: number;
  assetChecksum: string;
  sourceUnit: GeometrySourceUnit;
  snapTransform: GeometrySnapTransform;
  sourceType: "manual" | "project_asset";
  sourceChecksum: string;
  levelElevation: string;
  sourceLineageId: string | null;
}) {
  const payload = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    assetChecksum: input.assetChecksum,
    adapterVersion:
      input.sourceType === "project_asset"
        ? DXF_ADAPTER_VERSION
        : "miyar-manual-v1",
    selectedUnits: input.sourceUnit,
    transform: input.snapTransform,
    referenceFrame: `project_local_xy:right_handed:elevation:${input.levelElevation}`,
    schemaVersion: GEOMETRY_SCHEMA_VERSION,
    canonicalizerVersion: GEOMETRY_CANONICALIZER_VERSION,
    tolerancePolicyVersion: GEOMETRY_TOLERANCE_POLICY_VERSION,
    sourceChecksum: input.sourceChecksum,
    sourceLineageId: input.sourceLineageId,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export const spaceProgramGeometryRouter = router({
  previewManualGeometry: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sourceUnit: sourceUnitSchema,
        snapTransform: snapTransformSchema,
        rooms: z.array(roomSchema).min(1).max(MANUAL_GEOMETRY_LIMITS.rooms),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const preview = manualPreview(
        input.rooms,
        input.sourceUnit,
        input.snapTransform
      );
      const { canonical: _canonical, ...response } = preview;
      return response;
    }),

  previewDxfGeometry: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        assetId: z.number().int().positive(),
        sourceLineageId: z.string().min(1).max(64),
        sourceUnit: sourceUnitSchema,
        snapTransform: snapTransformSchema,
        levelElevation: z.string().min(1).max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const { inspection } = await readAuthorizedDxf({
        ...input,
        organizationId: ctx.orgId,
      });
      return dxfPreview(inspection, input.sourceUnit);
    }),

  saveGeometryDraft: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        expectedCurrentVersionId: z.number().int().positive().nullable(),
        source: z.discriminatedUnion("kind", [
          z.object({
            kind: z.literal("manual"),
            sourceUnit: sourceUnitSchema,
            snapTransform: snapTransformSchema,
            rooms: z.array(roomSchema).min(1).max(MANUAL_GEOMETRY_LIMITS.rooms),
          }),
          z.object({
            kind: z.literal("dxf"),
            assetId: z.number().int().positive(),
            sourceLineageId: z.string().min(1).max(64),
            sourceUnit: sourceUnitSchema,
            snapTransform: snapTransformSchema,
            levelElevation: z.string().min(1).max(64),
          }),
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      let canonical: CanonicalGeometryResult;
      let rooms: db.GeometryDraftRoomMetadata[];
      let assetId: number | null = null;
      let assetChecksum: string;
      let sourceChecksum: string;
      let sourceObservation: unknown;
      let adapterVersion: string;

      if (input.source.kind === "manual") {
        const preview = manualPreview(
          input.source.rooms,
          input.source.sourceUnit,
          input.source.snapTransform
        );
        canonical = preview.canonical;
        rooms = input.source.rooms.map(room => ({
          spaceId: room.spaceId,
          roomName: room.roomName,
          roomCode: room.roomCode,
          category: room.category,
          levelId: `elevation:${canonical.geometry.rooms.find(draftRoom => draftRoom.spaceId === room.spaceId)?.levelElevationMicrometres ?? "0"}`,
        }));
        sourceObservation = { rooms: input.source.rooms };
        sourceChecksum = createHash("sha256")
          .update(JSON.stringify(sourceObservation))
          .digest("hex");
        assetChecksum = sourceChecksum;
        adapterVersion = "miyar-manual-v1";
      } else {
        const resolved = await readAuthorizedDxf({
          projectId: input.projectId,
          organizationId: ctx.orgId,
          assetId: input.source.assetId,
          sourceLineageId: input.source.sourceLineageId,
          sourceUnit: input.source.sourceUnit,
          snapTransform: input.source.snapTransform,
          levelElevation: input.source.levelElevation,
        });
        if (
          resolved.inspection.status !== "imported" ||
          !resolved.inspection.canonical
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              resolved.inspection.issue?.message ??
              "DXF geometry is insufficient and cannot be committed.",
          });
        }
        canonical = resolved.inspection.canonical;
        rooms = resolved.inspection.levelOverlays.flatMap(level =>
          level.rooms.map(room => ({
            spaceId: room.sourceRoomId,
            roomName: room.sourceLayer,
            category: "other",
            levelId: `elevation:${level.levelElevationMicrometres}`,
          }))
        );
        assetId = resolved.asset.id;
        assetChecksum = resolved.asset.checksum!;
        sourceChecksum = resolved.inspection.evidence.checksum.value;
        sourceObservation = {
          evidence: resolved.inspection.evidence,
          inspection: resolved.inspection.inspection,
          levelOverlays: resolved.inspection.levelOverlays,
          sourceLineageId: input.source.sourceLineageId,
        };
        adapterVersion = DXF_ADAPTER_VERSION;
      }

      const idempotencyKey = importIdempotencyKey({
        organizationId: ctx.orgId,
        projectId: input.projectId,
        assetChecksum,
        sourceUnit: input.source.sourceUnit,
        snapTransform: input.source.snapTransform,
        sourceType: input.source.kind === "manual" ? "manual" : "project_asset",
        sourceChecksum,
        levelElevation:
          input.source.kind === "manual"
            ? input.source.rooms.map(room => room.levelElevation).join(",")
            : input.source.levelElevation,
        sourceLineageId:
          input.source.kind === "dxf" ? input.source.sourceLineageId : null,
      });
      const result = await db.saveGeometryDraftForOrg({
        organizationId: ctx.orgId,
        projectId: input.projectId,
        userId: ctx.user.id,
        expectedCurrentVersionId: input.expectedCurrentVersionId,
        canonical,
        rooms,
        source: {
          sourceType:
            input.source.kind === "manual" ? "manual" : "project_asset",
          acquisitionMethod:
            input.source.kind === "manual" ? "manual_entry" : "dxf",
          assetId,
          sourceUnits: input.source.sourceUnit,
          sourceChecksum,
          assetChecksum,
          adapterName:
            input.source.kind === "manual"
              ? "MIYAR manual geometry"
              : "MIYAR ASCII DXF",
          adapterVersion,
          sourceObservation,
          sourceTransform: { snapTransform: input.source.snapTransform },
          idempotencyKey,
        },
      });
      if (result.kind === "not_found") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }
      if (result.kind === "conflict") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Geometry changed concurrently; current version is ${result.currentGraphVersionId ?? "none"}.`,
        });
      }
      return {
        geometryVersionId: result.graphVersionId,
        fingerprint: result.fingerprint,
        replayed: result.replayed,
        lifecycleState: "draft" as const,
      };
    }),

  reviewGeometryDraft: orgAdminProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        geometryVersionId: z.number().int().positive(),
        expectedCurrentVersionId: z.number().int().positive().nullable(),
        decision: z.enum([
          "approve_as_canonical",
          "reject",
          "request_clarification",
        ]),
        note: z.string().max(5_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const result = await db.reviewGeometryDraftForOrg({
        ...input,
        organizationId: ctx.orgId,
        userId: ctx.user.id,
      });
      if (result.kind === "not_found") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        });
      }
      if (result.kind === "conflict") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Geometry changed concurrently; current version is ${result.currentGraphVersionId ?? "none"}.`,
        });
      }
      return result;
    }),

  getGeometryReviewState: orgProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const reviewState = await db.getGeometryReviewStateForOrg(
        input.projectId,
        ctx.orgId
      );
      const authorityMode = reviewState?.authority?.mode ?? "legacy";
      const legacyRoomTotal = reviewState?.legacyRooms.length
        ? reviewState.legacyRooms.reduce(
            (sum, room) => sum + Number(room.sqm),
            0
          )
        : null;
      const latest = reviewState?.latest;
      const selected = reviewState?.canonical;
      const draft = latest?.status === "draft" ? latest : undefined;
      const latestReviewed =
        latest && latest.id !== selected?.id && latest.status !== "draft"
          ? latest
          : undefined;
      type ReviewState = NonNullable<typeof reviewState>;
      const roomPayload = (
        graph: ReviewState["latest"],
        source: ReviewState["latestSource"]
      ) => {
        if (!graph) return undefined;
        const canonicalDocument = graph.canonicalGeometry as
          | CanonicalGeometryResult["geometry"]
          | undefined;
        if (!canonicalDocument) return undefined;
        const sourceObservation = source?.sourceObservation as
          | {
              rooms?: RoomInput[];
              levelOverlays?: Array<{
                rooms: Array<{
                  sourceRoomId: string;
                  sourceLayer: string;
                  sourcePoints: Array<{ x: string; y: string }>;
                }>;
              }>;
            }
          | undefined;
        const sourceRooms = new Map(
          (sourceObservation?.rooms ?? []).map(
            room => [room.spaceId, room] as const
          )
        );
        const sourceDxfRooms = new Map(
          (sourceObservation?.levelOverlays ?? []).flatMap(level =>
            level.rooms.map(room => [room.sourceRoomId, room] as const)
          )
        );
        return {
          geometryVersionId: graph.id,
          status: graph.status,
          totalAreaSqm: graph.totalAreaSquareMetres,
          measurementBasis: ROOM_FLOOR_POLYGON_AREA,
          fingerprint: graph.fingerprint,
          sourceType: source?.acquisitionMethod,
          evidenceStatus:
            source?.acquisitionMethod === "dxf" ? "imported" : "user_entered",
          rooms: canonicalDocument.rooms.map(room => ({
            spaceId: room.spaceId,
            areaSqm: room.areaSquareMetres,
            measurementBasis: ROOM_FLOOR_POLYGON_AREA,
            normalizedOuterRing: room.outerRing.points,
            sourceOuterRing:
              sourceRooms
                .get(room.spaceId)
                ?.outerRing.map(point =>
                  sourcePointInMicrometres(
                    point,
                    (source?.sourceUnits ?? "m") as GeometrySourceUnit
                  )
                ) ??
              sourceDxfRooms
                .get(room.spaceId)
                ?.sourcePoints.map(point =>
                  sourcePointInMicrometres(
                    point,
                    (source?.sourceUnits ?? "m") as GeometrySourceUnit
                  )
                ),
          })),
        };
      };
      return {
        authorityMode,
        currentGraphVersionId:
          reviewState?.authority?.currentGraphVersionId ?? null,
        selectedGeometryVersionId:
          reviewState?.authority?.selectedGeometryVersionId ?? null,
        canWrite: ctx.orgRole !== "viewer",
        canReview: ctx.orgRole === "admin",
        legacy:
          legacyRoomTotal !== null && Number.isFinite(legacyRoomTotal)
            ? {
                totalAreaSqm: legacyRoomTotal,
                status: "legacy_unknown",
                basis: "legacy_unspecified",
              }
            : undefined,
        draft: roomPayload(draft, reviewState?.latestSource),
        canonical: roomPayload(selected, reviewState?.canonicalSource),
        latestReviewed: roomPayload(
          latestReviewed,
          reviewState?.latestSource
        ),
        latestReview: reviewState?.latestReview
          ? {
              decision: reviewState.latestReview.reviewDecision,
              resultState: reviewState.latestReview.resultState,
              note: reviewState.latestReview.note,
              createdAt: reviewState.latestReview.createdAt,
            }
          : undefined,
        acceptedRoomFloorMeasurements: reviewState?.acceptedMeasurements,
        reconciliation: {
          status: "not_checked" as const,
          message:
            "Legacy room totals have no declared room-floor polygon basis; GFA and fit-out area are never used for this comparison.",
        },
      };
    }),
});
