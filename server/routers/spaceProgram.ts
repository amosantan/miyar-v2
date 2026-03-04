/**
 * MIYAR 3.0 Phase B — Space Program Router
 *
 * All procedures use orgProcedure (never publicProcedure for org data).
 * 8 endpoints: generate, extractFromFile, getForProject, updateRoom,
 *              toggleFitOut, addRoom, deleteRoom, resetToTypologyDefaults
 */

import { z } from "zod";
import { router, orgProcedure } from "../_core/trpc";
import * as db from "../db";
import { extractSpaceProgram } from "../engines/design/space-program-extractor";
import { getFitOutTag, type RoomCategory } from "../engines/design/typology-fitout-rules";

const ROOM_CATEGORIES = [
    "lobby", "corridor", "office_floor", "guest_room", "suite",
    "fb_restaurant", "bathroom", "kitchen", "bedroom", "living",
    "utility", "amenity", "parking", "retail", "back_of_house", "other",
] as const;

export const spaceProgramRouter = router({
    /**
     * generate — Create space program from typology + GFA
     * Uses deterministic templates from typology-fitout-rules.ts
     */
    generate: orgProcedure
        .input(
            z.object({
                projectId: z.number(),
                blocks: z.array(
                    z.object({
                        blockName: z.string().min(1),
                        blockTypology: z.string().min(1),
                        gfaSqm: z.number().positive(),
                    })
                ).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");

            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            const typology = project.ctx01Typology || "residential";
            const gfa = Number(project.ctx03Gfa) || 0;
            if (gfa <= 0) throw new Error("Project GFA must be > 0");

            // Clear existing (preserve overridden rooms)
            await db.resetSpaceProgramRooms(input.projectId, orgId, true);

            // Extract using the orchestrator
            const result = await extractSpaceProgram({
                projectId: input.projectId,
                organizationId: orgId,
                typology,
                gfa,
                blocks: input.blocks,
            });

            // Insert rooms
            if (result.rooms.length > 0) {
                await db.insertSpaceProgramRooms(result.rooms as any);
            }

            // Insert amenity sub-spaces (need to resolve roomCode → DB id)
            if (result.amenitySubSpaces.length > 0) {
                const insertedRooms = await db.getSpaceProgramRooms(input.projectId, orgId);
                for (const amenity of result.amenitySubSpaces) {
                    const dbRoom = insertedRooms.find((r: any) => r.roomCode === amenity.roomCode);
                    if (dbRoom && amenity.subSpaces.length > 0) {
                        await db.insertAmenitySubSpaces(
                            amenity.subSpaces.map((sub) => ({
                                ...sub,
                                spaceProgramRoomId: dbRoom.id,
                            }))
                        );
                    }
                }
            }

            return {
                roomCount: result.rooms.length,
                source: result.source,
                warnings: result.warnings,
                fitOutRooms: result.rooms.filter((r) => r.isFitOut).length,
                shellCoreRooms: result.rooms.filter((r) => !r.isFitOut).length,
            };
        }),

    /**
     * extractFromFile — Parse DXF/DWG and create space program
     * File is already uploaded to S3 — pass the S3 key
     */
    extractFromFile: orgProcedure
        .input(
            z.object({
                projectId: z.number(),
                s3Key: z.string().min(1),
                originalFilename: z.string().min(1),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");

            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            const typology = project.ctx01Typology || "residential";
            const gfa = Number(project.ctx03Gfa) || 0;

            // Determine file extension
            const ext = input.originalFilename.split(".").pop()?.toLowerCase() || "";
            if (!["dxf", "dwg"].includes(ext)) {
                throw new Error("Only .dxf and .dwg files are supported");
            }

            // For DXF files, we need the content string — fetch from S3
            // For DWG files, we need the Buffer — also fetch from S3
            const { storageGet } = await import("../storage");
            const { url } = await storageGet(input.s3Key);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch file from storage");

            let fileContent: string | Buffer;
            if (ext === "dxf") {
                fileContent = await response.text();
            } else {
                const arrayBuffer = await response.arrayBuffer();
                fileContent = Buffer.from(arrayBuffer);
            }

            // Clear existing rooms
            await db.resetSpaceProgramRooms(input.projectId, orgId, true);

            const result = await extractSpaceProgram({
                projectId: input.projectId,
                organizationId: orgId,
                typology,
                gfa,
                fileContent,
                fileExtension: ext,
                originalFilename: input.originalFilename,
            });

            // Insert rooms
            if (result.rooms.length > 0) {
                await db.insertSpaceProgramRooms(result.rooms as any);
            }

            // Insert amenity sub-spaces
            if (result.amenitySubSpaces.length > 0) {
                const insertedRooms = await db.getSpaceProgramRooms(input.projectId, orgId);
                for (const amenity of result.amenitySubSpaces) {
                    const dbRoom = insertedRooms.find((r: any) => r.roomCode === amenity.roomCode);
                    if (dbRoom && amenity.subSpaces.length > 0) {
                        await db.insertAmenitySubSpaces(
                            amenity.subSpaces.map((sub) => ({
                                ...sub,
                                spaceProgramRoomId: dbRoom.id,
                            }))
                        );
                    }
                }
            }

            return {
                roomCount: result.rooms.length,
                source: result.source,
                warnings: result.warnings,
                fitOutRooms: result.rooms.filter((r) => r.isFitOut).length,
                shellCoreRooms: result.rooms.filter((r) => !r.isFitOut).length,
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
            const totalSqm = rooms.reduce((sum: number, r: any) => sum + Number(r.sqm), 0);
            const fitOutSqm = rooms.filter((r: any) => r.isFitOut).reduce((sum: number, r: any) => sum + Number(r.sqm), 0);
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
                    fitOutPct: totalSqm > 0 ? Number(((fitOutSqm / totalSqm) * 100).toFixed(1)) : 0,
                },
            };
        }),

    /**
     * updateRoom — Edit a single room's properties
     */
    updateRoom: orgProcedure
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
        .mutation(async ({ input }) => {
            const { roomId, ...updates } = input;
            const dbUpdates: any = {};
            if (updates.roomName) dbUpdates.roomName = updates.roomName;
            if (updates.category) dbUpdates.category = updates.category;
            if (updates.sqm) dbUpdates.sqm = String(updates.sqm);
            if (updates.floorLevel !== undefined) dbUpdates.floorLevel = updates.floorLevel;
            if (updates.finishGrade) dbUpdates.finishGrade = updates.finishGrade;
            if (updates.priority) dbUpdates.priority = updates.priority;
            if (updates.blockName) dbUpdates.blockName = updates.blockName;
            if (updates.blockTypology) dbUpdates.blockTypology = updates.blockTypology;
            // Mark source as user_manual since developer edited it
            dbUpdates.source = "user_manual";

            await db.updateSpaceProgramRoom(roomId, dbUpdates);
            return { success: true };
        }),

    /**
     * toggleFitOut — Flip isFitOut for a room and mark fitOutOverridden = true
     */
    toggleFitOut: orgProcedure
        .input(
            z.object({
                roomId: z.number(),
                isFitOut: z.boolean(),
            })
        )
        .mutation(async ({ input }) => {
            await db.updateSpaceProgramRoom(input.roomId, {
                isFitOut: input.isFitOut,
                fitOutOverridden: true,
                fitOutReason: input.isFitOut
                    ? "Manually included in fit-out scope by developer"
                    : "Manually excluded from fit-out scope by developer",
            });
            return { success: true };
        }),

    /**
     * addRoom — Add a manual room to the space program
     */
    addRoom: orgProcedure
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

            // Get existing rooms count for sort order and room code
            const existing = await db.getSpaceProgramRooms(input.projectId, orgId);
            const sortOrder = existing.length;
            const fitOut = getFitOutTag(input.blockTypology, input.category as RoomCategory);

            const roomCode = `MNL${sortOrder + 1}`;

            await db.insertSpaceProgramRooms([
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
            ]);

            return { success: true, roomCode };
        }),

    /**
     * deleteRoom — Remove a room from the space program
     */
    deleteRoom: orgProcedure
        .input(z.object({ roomId: z.number() }))
        .mutation(async ({ input }) => {
            await db.deleteSpaceProgramRoom(input.roomId);
            return { success: true };
        }),

    /**
     * resetToTypologyDefaults — Wipe non-overridden rooms and regenerate from template
     * Rooms with fitOutOverridden = true survive the reset
     */
    resetToTypologyDefaults: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");

            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            const typology = project.ctx01Typology || "residential";
            const gfa = Number(project.ctx03Gfa) || 0;

            // Reset (preserves fitOutOverridden rooms)
            await db.resetSpaceProgramRooms(input.projectId, orgId, true);

            // Fetch surviving overridden rooms to avoid duplicating their room codes
            const overriddenRooms = await db.getSpaceProgramRooms(input.projectId, orgId);
            const overriddenCodes = new Set(overriddenRooms.map((r: any) => r.roomCode));

            // Regenerate defaults
            const result = await extractSpaceProgram({
                projectId: input.projectId,
                organizationId: orgId,
                typology,
                gfa,
            });

            // Filter out rooms whose roomCode is already covered by an overridden room
            const newRooms = result.rooms.filter((r) => !overriddenCodes.has(r.roomCode));
            if (newRooms.length > 0) {
                await db.insertSpaceProgramRooms(newRooms as any);
            }

            // Insert amenity sub-spaces
            if (result.amenitySubSpaces.length > 0) {
                const insertedRooms = await db.getSpaceProgramRooms(input.projectId, orgId);
                for (const amenity of result.amenitySubSpaces) {
                    const dbRoom = insertedRooms.find((r: any) => r.roomCode === amenity.roomCode);
                    if (dbRoom && amenity.subSpaces.length > 0) {
                        await db.insertAmenitySubSpaces(
                            amenity.subSpaces.map((sub) => ({
                                ...sub,
                                spaceProgramRoomId: dbRoom.id,
                            }))
                        );
                    }
                }
            }

            return {
                roomCount: result.rooms.length,
                warnings: result.warnings,
            };
        }),
});
