/**
 * MIYAR 3.0 Phase B — Space Program Extractor (Orchestrator)
 *
 * Pipeline:
 *   1. If uploaded DXF/DWG file → dwg-parser → ParsedRoom[]
 *   2. If no file → getDefaultRoomTemplate(typology) → template rooms from GFA
 *   3. For each room → getFitOutTag() → isFitOut + fitOutReason
 *   4. For category "amenity" → getAmenitySubSpaces() → expand sub-spaces
 *   5. Return SpaceProgramRoomInput[] ready for DB insert
 *
 * Does NOT persist to DB — the router handles persistence.
 */

import {
    getFitOutTag,
    getDefaultRoomTemplate,
    type RoomCategory,
    type SpaceProgramRoomTemplate,
} from "./typology-fitout-rules";
import { getAmenitySubSpaces, type AmenitySubSpaceTemplate } from "./amenity-taxonomy";
import { parseDxf, parseDwgViaVision, type ParseResult } from "../intake/dwg-parser";
import type { InsertSpaceProgramRoom, InsertAmenitySubSpace } from "../../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractorInput {
    projectId: number;
    organizationId: number;
    typology: string;
    gfa: number;                     // total GFA in sqm
    /** If provided, try to extract rooms from the file */
    fileContent?: string | Buffer;
    fileExtension?: string;          // "dxf" | "dwg"
    originalFilename?: string;
    /** For mixed-use: block definitions */
    blocks?: Array<{
        blockName: string;
        blockTypology: string;
        gfaSqm: number;
    }>;
}

export interface ExtractorResult {
    rooms: Omit<InsertSpaceProgramRoom, "id" | "createdAt" | "updatedAt">[];
    amenitySubSpaces: Array<{
        roomCode: string;  // temporary ref for linking after DB insert
        subSpaces: Omit<InsertAmenitySubSpace, "id" | "spaceProgramRoomId" | "createdAt" | "updatedAt">[];
    }>;
    source: "typology_default" | "file_extraction";
    warnings: string[];
}

// ─── Main Extractor ───────────────────────────────────────────────────────────

export async function extractSpaceProgram(input: ExtractorInput): Promise<ExtractorResult> {
    const warnings: string[] = [];
    let rooms: Omit<InsertSpaceProgramRoom, "id" | "createdAt" | "updatedAt">[] = [];
    let source: ExtractorResult["source"] = "typology_default";

    // ─── Path 1: File extraction ────────────────────────────────────────
    if (input.fileContent && input.fileExtension) {
        const parseResult = await parseFile(input);
        warnings.push(...parseResult.warnings);

        if (parseResult.rooms.length > 0) {
            source = "file_extraction";
            rooms = parseResult.rooms.map((r, i) => {
                const fitOut = getFitOutTag(input.typology, r.category);
                return {
                    projectId: input.projectId,
                    organizationId: input.organizationId,
                    roomCode: generateRoomCode(r.category, i),
                    roomName: r.name,
                    category: r.category,
                    sqm: String(r.sqm),
                    floorLevel: r.floorLevel || null,
                    source: "file_extraction" as const,
                    isFitOut: fitOut.isFitOut,
                    fitOutOverridden: false,
                    fitOutReason: fitOut.fitOutReason,
                    finishGrade: deriveFinishGrade(r.category, input.typology),
                    priority: derivePriority(r.category),
                    budgetPct: null,
                    sortOrder: i,
                    blockName: "Main",
                    blockTypology: input.typology,
                };
            });

            // Recompute budget percentages based on sqm proportions
            redistributeBudget(rooms);
        }
    }

    // ─── Path 2: Template generation from typology ──────────────────────
    if (rooms.length === 0) {
        if (input.blocks && input.blocks.length > 0) {
            // Mixed-use: generate per-block
            let sortOffset = 0;
            for (const block of input.blocks) {
                const template = getDefaultRoomTemplate(block.blockTypology);
                const blockRooms = templateToRooms(
                    template,
                    block.gfaSqm,
                    input.projectId,
                    input.organizationId,
                    block.blockName,
                    block.blockTypology,
                    sortOffset
                );
                rooms.push(...blockRooms);
                sortOffset += blockRooms.length;
            }
        } else {
            // Single typology
            const template = getDefaultRoomTemplate(input.typology);
            rooms = templateToRooms(
                template,
                input.gfa,
                input.projectId,
                input.organizationId,
                "Main",
                input.typology,
                0
            );
        }
    }

    // ─── Step 3: Expand amenity rooms into sub-spaces ───────────────────
    const amenitySubSpaces: ExtractorResult["amenitySubSpaces"] = [];

    for (const room of rooms) {
        if (room.category === "amenity" && Number(room.sqm) > 0) {
            const blockTypology = room.blockTypology || input.typology;
            const subTemplates = getAmenitySubSpaces(blockTypology, Number(room.sqm));
            amenitySubSpaces.push({
                roomCode: room.roomCode,
                subSpaces: subTemplates.map((sub) => ({
                    subSpaceName: sub.subSpaceName,
                    subSpaceType: sub.subSpaceType,
                    sqm: String(sub.sqm),
                    pctOfParent: String((sub.pctOfParent * 100).toFixed(2)),
                    isFitOut: sub.isFitOut,
                })),
            });
        }
    }

    return { rooms, amenitySubSpaces, source, warnings };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseFile(input: ExtractorInput): Promise<ParseResult> {
    const ext = (input.fileExtension || "").toLowerCase();

    if (ext === "dxf") {
        const content = typeof input.fileContent === "string"
            ? input.fileContent
            : input.fileContent!.toString("utf-8");
        return parseDxf(content);
    }

    if (ext === "dwg") {
        const buffer = Buffer.isBuffer(input.fileContent)
            ? input.fileContent
            : Buffer.from(input.fileContent as string, "utf-8");
        return parseDwgViaVision(buffer, input.originalFilename || "drawing.dwg");
    }

    return {
        rooms: [],
        source: "dxf_geometry",
        warnings: [`Unsupported file extension: .${ext}. Only .dxf and .dwg are supported.`],
    };
}

function templateToRooms(
    template: SpaceProgramRoomTemplate[],
    gfa: number,
    projectId: number,
    orgId: number,
    blockName: string,
    blockTypology: string,
    sortOffset: number
): Omit<InsertSpaceProgramRoom, "id" | "createdAt" | "updatedAt">[] {
    return template.map((t, i) => ({
        projectId,
        organizationId: orgId,
        roomCode: t.roomCode,
        roomName: t.roomName,
        category: t.category,
        sqm: String(Number((gfa * t.pctOfGfa).toFixed(2))),
        floorLevel: null,
        source: "typology_default" as const,
        isFitOut: t.isFitOut,
        fitOutOverridden: false,
        fitOutReason: t.fitOutReason,
        finishGrade: t.finishGrade,
        priority: t.priority,
        budgetPct: String(t.budgetPct),
        sortOrder: sortOffset + i,
        blockName,
        blockTypology,
    }));
}

function generateRoomCode(category: RoomCategory, index: number): string {
    const prefixes: Record<RoomCategory, string> = {
        lobby: "LBY", corridor: "COR", office_floor: "OPN", guest_room: "GRM",
        suite: "GRS", fb_restaurant: "FBB", bathroom: "BTH", kitchen: "KIT",
        bedroom: "BDR", living: "LVG", utility: "UTL", amenity: "AMN",
        parking: "PKG", retail: "RTL", back_of_house: "BOH", other: "OTH",
    };
    return `${prefixes[category] || "RM"}${index + 1}`;
}

function deriveFinishGrade(category: RoomCategory, typology: string): "A" | "B" | "C" {
    const highGradeCategories: RoomCategory[] = [
        "lobby", "suite", "fb_restaurant", "amenity", "living",
    ];
    const lowGradeCategories: RoomCategory[] = [
        "parking", "utility", "back_of_house",
    ];

    if (highGradeCategories.includes(category)) return "A";
    if (lowGradeCategories.includes(category)) return "C";
    return "B";
}

function derivePriority(category: RoomCategory): "high" | "medium" | "low" {
    const highPriority: RoomCategory[] = [
        "lobby", "suite", "fb_restaurant", "amenity", "living", "guest_room",
    ];
    const lowPriority: RoomCategory[] = [
        "parking", "utility", "back_of_house",
    ];

    if (highPriority.includes(category)) return "high";
    if (lowPriority.includes(category)) return "low";
    return "medium";
}

function redistributeBudget(
    rooms: Omit<InsertSpaceProgramRoom, "id" | "createdAt" | "updatedAt">[]
): void {
    const totalSqm = rooms.reduce((sum, r) => sum + Number(r.sqm), 0);
    if (totalSqm <= 0) return;

    // Grade-based multiplier for budget allocation
    const multipliers: Record<string, number> = { A: 1.3, B: 1.0, C: 0.7 };

    const rawWeights = rooms.map((r) => {
        const mult = multipliers[r.finishGrade as string] || 1.0;
        return (Number(r.sqm) / totalSqm) * mult;
    });
    const weightSum = rawWeights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < rooms.length; i++) {
        rooms[i].budgetPct = String(Number((rawWeights[i] / weightSum).toFixed(4)));
    }
}
