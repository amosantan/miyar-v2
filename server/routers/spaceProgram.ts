/**
 * MIYAR 3.0 Phase B — Space Program Router
 *
 * All procedures use orgProcedure (never publicProcedure for org data).
 * 8 endpoints: generate, extractFromFile, getForProject, updateRoom,
 *              toggleFitOut, addRoom, deleteRoom, resetToTypologyDefaults
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import {
  mergeRouters,
  orgHeavyMutationProcedure,
  orgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { requireProjectForOrg } from "../_core/project-access";
import { requireProjectOrgResourceForOrg } from "../_core/resource-access";
import { requireDesignAsset } from "../_core/design-resource-access";
import { requireLegacyGeometryWriterForProject } from "../_core/geometry-authority";
import { extractSpaceProgram } from "../engines/design/space-program-extractor";
import {
  getFitOutTag,
  type RoomCategory,
} from "../engines/design/typology-fitout-rules";
import { spaceProgramGeometryRouter } from "./spaceProgram-geometry";
import { storageRead } from "../storage";
import { DXF_BOUNDARY_LIMITS } from "../../shared/geometry";

const ROOM_CATEGORIES = [
  "lobby",
  "corridor",
  "office_floor",
  "guest_room",
  "suite",
  "fb_restaurant",
  "bathroom",
  "kitchen",
  "bedroom",
  "living",
  "utility",
  "amenity",
  "parking",
  "retail",
  "back_of_house",
  "other",
] as const;

/**
 * After any mutation that changes rooms, sync totalFitoutArea on the project.
 * This keeps the scoring engine, ROI bridge, and AI Advisor in sync with Phase B.
 */
async function writeFitOutArea(projectId: number, orgId: number) {
  const rooms = await db.getSpaceProgramRooms(projectId, orgId);
  const fitOutSqm = rooms
    .filter((r: any) => r.isFitOut)
    .reduce((sum: number, r: any) => sum + Number(r.sqm), 0);
  const result = await db.updateProjectWithLegacyGeometryAuthorityForOrg(
    projectId,
    orgId,
    { totalFitoutArea: String(fitOutSqm) }
  );
  if (result === "canonical") {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Legacy room and area values are read-only while canonical geometry is authoritative.",
    });
  }
  if (result === "not_found") {
    await requireProjectForOrg(projectId, orgId);
  }
}

const legacySpaceProgramRouter = router({
  /**
   * generate — Create space program from typology + GFA
   * Uses deterministic templates from typology-fitout-rules.ts
   */
  generate: orgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        blocks: z
          .array(
            z.object({
              blockName: z.string().min(1),
              blockTypology: z.string().min(1),
              gfaSqm: z.number().positive(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");

      const project = await requireProjectForOrg(input.projectId, orgId);
      await requireLegacyGeometryWriterForProject(input.projectId, orgId);

      const typology = project.ctx01Typology || "residential";
      const gfa = Number(project.ctx03Gfa) || 0;
      if (gfa <= 0) throw new Error("Project GFA must be > 0");

      // Extract using the orchestrator
      const result = await extractSpaceProgram({
        projectId: input.projectId,
        organizationId: orgId,
        typology,
        gfa,
        blocks: input.blocks,
      });

      if (
        !(await db.replaceSpaceProgramRoomsForOrg(
          input.projectId,
          orgId,
          result.rooms as any,
          result.amenitySubSpaces,
          true
        ))
      ) {
        await requireProjectForOrg(input.projectId, orgId);
      }

      // Sync totalFitoutArea on project for scoring engine + AI Advisor
      await writeFitOutArea(input.projectId, orgId);

      return {
        roomCount: result.rooms.length,
        source: result.source,
        warnings: result.warnings,
        fitOutRooms: result.rooms.filter(r => r.isFitOut).length,
        shellCoreRooms: result.rooms.filter(r => !r.isFitOut).length,
      };
    }),

  /**
   * extractFromFile — Parse DXF/DWG and create space program
   * The file must be a finalized CAD asset owned by the same project.
   */
  extractFromFile: orgHeavyMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        assetId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");

      const project = await requireProjectForOrg(input.projectId, orgId);
      await requireLegacyGeometryWriterForProject(input.projectId, orgId);
      const { resource: asset, project: assetProject } =
        await requireDesignAsset(input.assetId, orgId);
      if (
        assetProject.id !== input.projectId ||
        asset.assetType !== "cad" ||
        !asset.storagePath ||
        !asset.checksum
      ) {
        throw new Error("Finalized CAD asset not found");
      }

      const typology = project.ctx01Typology || "residential";
      const gfa = Number(project.ctx03Gfa) || 0;

      // Determine file extension
      const ext = asset.filename.split(".").pop()?.toLowerCase() || "";
      if (!["dxf", "dwg"].includes(ext)) {
        throw new Error("Only .dxf and .dwg files are supported");
      }

      const stored = await storageRead(
        asset.storagePath,
        DXF_BOUNDARY_LIMITS.sourceBytes
      );
      if (
        stored.sizeBytes <= 0 ||
        stored.sizeBytes > DXF_BOUNDARY_LIMITS.sourceBytes ||
        createHash("sha256").update(stored.buffer).digest("hex") !==
          asset.checksum
      ) {
        throw new Error("Finalized CAD asset failed integrity validation");
      }

      let fileContent: string | Buffer;
      if (ext === "dxf") {
        fileContent = stored.buffer.toString("utf8");
      } else {
        fileContent = stored.buffer;
      }

      const result = await extractSpaceProgram({
        projectId: input.projectId,
        organizationId: orgId,
        typology,
        gfa,
        fileContent,
        fileExtension: ext,
        originalFilename: asset.filename,
      });

      if (
        !(await db.replaceSpaceProgramRoomsForOrg(
          input.projectId,
          orgId,
          result.rooms as any,
          result.amenitySubSpaces,
          true
        ))
      ) {
        await requireProjectForOrg(input.projectId, orgId);
      }

      // Sync totalFitoutArea on project for scoring engine + AI Advisor
      await writeFitOutArea(input.projectId, orgId);

      return {
        roomCount: result.rooms.length,
        source: result.source,
        warnings: result.warnings,
        fitOutRooms: result.rooms.filter(r => r.isFitOut).length,
        shellCoreRooms: result.rooms.filter(r => !r.isFitOut).length,
      };
    }),

  /**
   * getForProject — Read stored space program
   */
  getForProject: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");
      await requireProjectForOrg(input.projectId, orgId);
      const geometryAuthorityMode =
        await db.getProjectGeometryAuthorityModeForOrg(input.projectId, orgId);

      const rooms = await db.getSpaceProgramRooms(input.projectId, orgId);
      if (rooms.length === 0) return null;

      // Load amenity sub-spaces for amenity rooms
      const roomsWithSubSpaces = await Promise.all(
        rooms.map(async (room: any) => {
          if (room.category === "amenity") {
            const subSpaces = await db.getAmenitySubSpacesForRoom(room.id);
            return { ...room, subSpaces };
          }
          return { ...room, subSpaces: [] };
        })
      );

      // Compute summary stats
      const totalSqm = rooms.reduce(
        (sum: number, r: any) => sum + Number(r.sqm),
        0
      );
      const fitOutSqm = rooms
        .filter((r: any) => r.isFitOut)
        .reduce((sum: number, r: any) => sum + Number(r.sqm), 0);
      const shellCoreSqm = totalSqm - fitOutSqm;

      // Group by block
      const blockMap = new Map<string, any[]>();
      for (const room of roomsWithSubSpaces) {
        const key = (room as any).blockName || "Main";
        if (!blockMap.has(key)) blockMap.set(key, []);
        blockMap.get(key)!.push(room);
      }

      return {
        rooms: roomsWithSubSpaces,
        blocks: Array.from(blockMap.entries()).map(([name, blockRooms]) => ({
          blockName: name,
          blockTypology: (blockRooms[0] as any)?.blockTypology || "residential",
          rooms: blockRooms,
        })),
        summary: {
          totalRooms: rooms.length,
          totalSqm,
          fitOutSqm,
          shellCoreSqm,
          fitOutPct:
            totalSqm > 0
              ? Number(((fitOutSqm / totalSqm) * 100).toFixed(1))
              : 0,
        },
        geometryAuthorityMode,
      };
    }),

  /**
   * updateRoom — Edit a single room's properties
   */
  updateRoom: orgMutationProcedure
    .input(
      z.object({
        roomId: z.number(),
        roomName: z.string().min(1).optional(),
        category: z.enum(ROOM_CATEGORIES).optional(),
        sqm: z.number().positive().optional(),
        floorLevel: z.string().optional().nullable(),
        finishGrade: z.enum(["A", "B", "C"]).optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        blockName: z.string().optional(),
        blockTypology: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const authorized = await requireProjectOrgResourceForOrg(
        input.roomId,
        ctx.orgId,
        {
          lookupResource: db.getSpaceProgramRoomById,
          getProjectId: room => room.projectId,
          getOrgId: room => room.organizationId,
        }
      );
      if (input.sqm !== undefined) {
        await requireLegacyGeometryWriterForProject(
          authorized.project.id,
          ctx.orgId
        );
      }
      const { roomId, ...updates } = input;
      const dbUpdates: any = {};
      if (updates.roomName) dbUpdates.roomName = updates.roomName;
      if (updates.category) dbUpdates.category = updates.category;
      if (updates.sqm) dbUpdates.sqm = String(updates.sqm);
      if (updates.floorLevel !== undefined)
        dbUpdates.floorLevel = updates.floorLevel;
      if (updates.finishGrade) dbUpdates.finishGrade = updates.finishGrade;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.blockName) dbUpdates.blockName = updates.blockName;
      if (updates.blockTypology)
        dbUpdates.blockTypology = updates.blockTypology;
      // Only an area edit changes the provenance of the legacy sqm value.
      if (updates.sqm !== undefined) dbUpdates.source = "user_manual";

      if (
        !(await db.updateSpaceProgramRoomForOrg(roomId, ctx.orgId, dbUpdates))
      ) {
        await requireProjectOrgResourceForOrg(roomId, ctx.orgId, {
          lookupResource: db.getSpaceProgramRoomById,
          getProjectId: room => room.projectId,
          getOrgId: room => room.organizationId,
        });
      }
      if (updates.sqm !== undefined) {
        await writeFitOutArea(authorized.project.id, ctx.orgId);
      }
      return { success: true };
    }),

  /**
   * toggleFitOut — Flip isFitOut for a room and mark fitOutOverridden = true
   */
  toggleFitOut: orgMutationProcedure
    .input(
      z.object({
        roomId: z.number(),
        isFitOut: z.boolean(),
        projectId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");
      const authorized = await requireProjectOrgResourceForOrg(
        input.roomId,
        orgId,
        {
          lookupResource: db.getSpaceProgramRoomById,
          getProjectId: room => room.projectId,
          getOrgId: room => room.organizationId,
        }
      );
      if (authorized.project.id !== input.projectId)
        throw new Error("Resource not found");
      await requireLegacyGeometryWriterForProject(input.projectId, orgId);
      await db.updateSpaceProgramRoomForOrg(input.roomId, orgId, {
        isFitOut: input.isFitOut,
        fitOutOverridden: true,
        fitOutReason: input.isFitOut
          ? "Manually included in fit-out scope by developer"
          : "Manually excluded from fit-out scope by developer",
      });
      // Sync totalFitoutArea so scoring engine reflects the toggle
      await writeFitOutArea(input.projectId, orgId);
      return { success: true };
    }),

  /**
   * addRoom — Add a manual room to the space program
   */
  addRoom: orgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        roomName: z.string().min(1),
        category: z.enum(ROOM_CATEGORIES),
        sqm: z.number().positive(),
        floorLevel: z.string().optional(),
        finishGrade: z.enum(["A", "B", "C"]).default("B"),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        blockName: z.string().default("Main"),
        blockTypology: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");
      await requireProjectForOrg(input.projectId, orgId);
      await requireLegacyGeometryWriterForProject(input.projectId, orgId);

      // Get existing rooms count for sort order and room code
      const existing = await db.getSpaceProgramRooms(input.projectId, orgId);
      const sortOrder = existing.length;
      const fitOut = getFitOutTag(
        input.blockTypology,
        input.category as RoomCategory
      );

      const roomCode = `MNL${sortOrder + 1}`;

      if (
        !(await db.insertSpaceProgramRoomForOrg(
          {
            projectId: input.projectId,
            organizationId: orgId,
            roomCode,
            roomName: input.roomName,
            category: input.category,
            sqm: String(input.sqm),
            floorLevel: input.floorLevel || null,
            source: "user_manual",
            isFitOut: fitOut.isFitOut,
            fitOutOverridden: false,
            fitOutReason: fitOut.fitOutReason,
            finishGrade: input.finishGrade,
            priority: input.priority,
            budgetPct: null,
            sortOrder,
            blockName: input.blockName,
            blockTypology: input.blockTypology,
          },
          orgId
        ))
      ) {
        await requireProjectForOrg(input.projectId, orgId);
      }

      // Sync totalFitoutArea
      await writeFitOutArea(input.projectId, orgId);
      return { success: true, roomCode };
    }),

  /**
   * deleteRoom — Remove a room from the space program
   */
  deleteRoom: orgMutationProcedure
    .input(z.object({ roomId: z.number(), projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");
      const authorized = await requireProjectOrgResourceForOrg(
        input.roomId,
        orgId,
        {
          lookupResource: db.getSpaceProgramRoomById,
          getProjectId: room => room.projectId,
          getOrgId: room => room.organizationId,
        }
      );
      if (authorized.project.id !== input.projectId)
        throw new Error("Resource not found");
      await requireLegacyGeometryWriterForProject(input.projectId, orgId);
      if (!(await db.deleteSpaceProgramRoomForOrg(input.roomId, orgId))) {
        throw new Error("Resource not found");
      }
      // Sync totalFitoutArea after deletion
      await writeFitOutArea(input.projectId, orgId);
      return { success: true };
    }),

  /**
   * resetToTypologyDefaults — Wipe non-overridden rooms and regenerate from template
   * Rooms with fitOutOverridden = true survive the reset
   */
  resetToTypologyDefaults: orgMutationProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = (ctx as any).orgId;
      if (!orgId) throw new Error("Organization context required");

      const project = await requireProjectForOrg(input.projectId, orgId);
      await requireLegacyGeometryWriterForProject(input.projectId, orgId);

      const typology = project.ctx01Typology || "residential";
      const gfa = Number(project.ctx03Gfa) || 0;

      // Fetch surviving overridden rooms to avoid duplicating their room codes
      const overriddenRooms = await db.getSpaceProgramRooms(
        input.projectId,
        orgId
      );
      const overriddenCodes = new Set(
        overriddenRooms.map((r: any) => r.roomCode)
      );

      // Regenerate defaults
      const result = await extractSpaceProgram({
        projectId: input.projectId,
        organizationId: orgId,
        typology,
        gfa,
      });

      // Filter out rooms whose roomCode is already covered by an overridden room
      const newRooms = result.rooms.filter(
        r => !overriddenCodes.has(r.roomCode)
      );
      if (
        !(await db.replaceSpaceProgramRoomsForOrg(
          input.projectId,
          orgId,
          newRooms as any,
          result.amenitySubSpaces,
          true
        ))
      ) {
        await requireProjectForOrg(input.projectId, orgId);
      }

      // Sync totalFitoutArea for scoring engine
      await writeFitOutArea(input.projectId, orgId);

      return {
        roomCount: result.rooms.length,
        warnings: result.warnings,
      };
    }),
});

export const spaceProgramRouter = mergeRouters(
  legacySpaceProgramRouter,
  spaceProgramGeometryRouter
);
