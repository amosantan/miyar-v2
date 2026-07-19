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
  reconcileRoomFloorAreas,
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
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function decimalSquareMetresToArea2(value: string): string | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const fraction = (match[2] ?? "").slice(0, 12).padEnd(12, "0");
  return (
    (BigInt(match[1]) * BigInt(1_000_000_000_000) + BigInt(fraction)) *
    BigInt(2)
  ).toString();
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

  commitShadowGeometry: orgHeavyMutationProcedure
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
      let rooms: db.ShadowGeometryRoomMetadata[];
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
          levelId: `elevation:${canonical.geometry.rooms.find(candidate => candidate.spaceId === room.spaceId)?.levelElevationMicrometres ?? "0"}`,
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
      });
      const result = await db.commitShadowGeometryForOrg({
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
      if (result.kind === "canonical") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Canonical projects cannot accept a shadow candidate.",
        });
      }
      return {
        geometryVersionId: result.graphVersionId,
        fingerprint: result.fingerprint,
        replayed: result.replayed,
        authorityMode: "shadow" as const,
      };
    }),

  reviewGeometryCandidate: orgAdminProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        geometryVersionId: z.number().int().positive(),
        expectedCurrentVersionId: z.number().int().positive().nullable(),
        decision: z.enum(["accepted", "rejected", "clarification_requested"]),
        note: z.string().max(5_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireProjectForOrg(input.projectId, ctx.orgId);
      const result = await db.reviewShadowGeometryForOrg({
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

  getGeometryComparison: orgProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProjectForOrg(input.projectId, ctx.orgId);
      const comparison = await db.getGeometryComparisonForOrg(
        input.projectId,
        ctx.orgId
      );
      const authorityMode = comparison?.authority?.mode ?? "legacy";
      const legacyRoomTotal = comparison?.legacyRooms.length
        ? comparison.legacyRooms.reduce(
            (sum, room) => sum + Number(room.sqm),
            0
          )
        : null;
      const legacyProjectTotal = project.totalFitoutArea
        ? Number(project.totalFitoutArea)
        : null;
      const legacyTotal = legacyRoomTotal ?? legacyProjectTotal;
      const candidate = comparison?.candidate;
      const canonical = candidate?.canonicalGeometry as
        | CanonicalGeometryResult["geometry"]
        | undefined;
      const exactCandidateArea2 = candidate?.totalAreaSquareMicrometresTwice;
      const exactLegacyArea2 =
        legacyRoomTotal !== null
          ? decimalSquareMetresToArea2(legacyRoomTotal.toFixed(2))
          : null;
      const reconciliation =
        exactCandidateArea2 && exactLegacyArea2
          ? reconcileRoomFloorAreas(exactLegacyArea2, exactCandidateArea2)
          : null;
      const sourceObservation = comparison?.source?.sourceObservation as
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
      const candidateStatus =
        comparison?.review?.reviewDecision === "accepted"
          ? "accepted"
          : comparison?.review?.reviewDecision === "rejected"
            ? "conflict"
            : comparison?.review?.reviewDecision === "needs_clarification"
              ? "insufficient"
              : "ready";
      return {
        authorityMode,
        currentGraphVersionId:
          comparison?.authority?.currentGraphVersionId ?? null,
        selectedGeometryVersionId:
          comparison?.authority?.selectedGeometryVersionId ?? null,
        canWrite: ctx.orgRole !== "viewer",
        canReview: ctx.orgRole === "admin",
        legacy:
          legacyTotal !== null && Number.isFinite(legacyTotal)
            ? {
                totalAreaSqm: legacyTotal,
                status:
                  comparison?.legacyRooms.length &&
                  comparison.legacyRooms.every(
                    room => room.source === "user_manual"
                  )
                    ? "user_entered"
                    : "legacy_estimate",
                basis: "legacy_unspecified",
              }
            : undefined,
        candidate:
          candidate && canonical
            ? {
                geometryVersionId: candidate.id,
                status: candidateStatus,
                totalAreaSqm: candidate.totalAreaSquareMetres,
                fingerprint: candidate.fingerprint,
                sourceType: comparison?.source?.acquisitionMethod,
                evidenceStatus:
                  comparison?.source?.acquisitionMethod === "dxf"
                    ? "imported"
                    : "user_entered",
                rooms: canonical.rooms.map(room => ({
                  spaceId: room.spaceId,
                  areaSqm: room.areaSquareMetres,
                  normalizedOuterRing: room.outerRing.points,
                  sourceOuterRing:
                    sourceRooms
                      .get(room.spaceId)
                      ?.outerRing.map(point =>
                        sourcePointInMicrometres(
                          point,
                          (comparison?.source?.sourceUnits ??
                            "m") as GeometrySourceUnit
                        )
                      ) ??
                    sourceDxfRooms
                      .get(room.spaceId)
                      ?.sourcePoints.map(point =>
                        sourcePointInMicrometres(
                          point,
                          (comparison?.source?.sourceUnits ??
                            "m") as GeometrySourceUnit
                        )
                      ),
                })),
              }
            : undefined,
        reconciliation: candidate
          ? reconciliation
            ? {
                status:
                  reconciliation.result === "conflict" ? "conflict" : "ready",
                deltaSqm: twiceSquareMicrometresToSquareMetres(
                  BigInt(reconciliation.differenceSquareMicrometresTwice)
                ),
                toleranceSqm: twiceSquareMicrometresToSquareMetres(
                  BigInt(reconciliation.toleranceSquareMicrometresTwice)
                ),
                message:
                  reconciliation.result === "conflict"
                    ? "Canonical room-floor area differs from the legacy estimate beyond tolerance."
                    : "Canonical room-floor area is within the comparison tolerance.",
              }
            : {
                status: "not_checked" as const,
                message:
                  "A comparable legacy room-area basis is unavailable; no equivalence claim was made.",
              }
          : { status: "not_checked" as const },
      };
    }),
});
