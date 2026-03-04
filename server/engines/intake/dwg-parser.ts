/**
 * MIYAR 3.0 Phase B — DXF/DWG File Parser
 *
 * Extracts room geometry from architectural drawings:
 *   1. DXF files → dxf-parser npm package → polyline boundaries → sqm
 *   2. DWG files → Gemini vision fallback → room extraction
 *
 * Returns ParsedRoom[] for the space-program-extractor to consume.
 */

import type { RoomCategory } from "../design/typology-fitout-rules";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRoom {
    name: string;
    category: RoomCategory;
    sqm: number;
    floorLevel: string | null;
    confidence: number;   // 0-1: how confident the parser is in this extraction
}

export interface ParseResult {
    rooms: ParsedRoom[];
    source: "dxf_geometry" | "dwg_vision";
    warnings: string[];
}

// ─── Room name → category mapping ─────────────────────────────────────────────

const ROOM_NAME_CATEGORY_MAP: Array<{ pattern: RegExp; category: RoomCategory }> = [
    { pattern: /lobby|reception|entrance|atrium/i, category: "lobby" },
    { pattern: /corridor|hallway|circulation|passage/i, category: "corridor" },
    { pattern: /office|open\s*plan|workstation|desk/i, category: "office_floor" },
    { pattern: /guest\s*room|hotel\s*room|standard\s*room/i, category: "guest_room" },
    { pattern: /suite|penthouse|presidential/i, category: "suite" },
    { pattern: /restaurant|f&?b|dining|cafe|bar|kitchen.*commercial/i, category: "fb_restaurant" },
    { pattern: /bath|toilet|wc|washroom|ensuite|shower/i, category: "bathroom" },
    { pattern: /kitchen|pantry|kitchenette/i, category: "kitchen" },
    { pattern: /bed\s*room|master\s*bed|mbr|guest\s*bed/i, category: "bedroom" },
    { pattern: /living|lounge|family|sitting|drawing/i, category: "living" },
    { pattern: /utility|service|maid|laundry|store|mechanical/i, category: "utility" },
    { pattern: /amenity|pool|gym|spa|fitness|sauna|steam/i, category: "amenity" },
    { pattern: /parking|garage|car\s*park|basement/i, category: "parking" },
    { pattern: /retail|shop|tenant|unit/i, category: "retail" },
    { pattern: /boh|back\s*of\s*house|loading|staff/i, category: "back_of_house" },
];

function classifyRoomName(name: string): RoomCategory {
    for (const entry of ROOM_NAME_CATEGORY_MAP) {
        if (entry.pattern.test(name)) return entry.category;
    }
    return "other";
}

// ─── DXF Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a DXF file buffer into rooms.
 * Uses the dxf-parser npm package for geometry extraction.
 * Extracts closed polylines from relevant layers, computes areas.
 */
export async function parseDxf(fileContent: string): Promise<ParseResult> {
    const warnings: string[] = [];
    const rooms: ParsedRoom[] = [];

    try {
        // Dynamic import to avoid bundling issues in browser
        const DxfParser = (await import("dxf-parser")).default;
        const parser = new DxfParser();
        const dxf = parser.parseSync(fileContent);

        if (!dxf || !dxf.entities) {
            return { rooms: [], source: "dxf_geometry", warnings: ["DXF file has no entities"] };
        }

        // Look for closed polylines (LWPOLYLINE, POLYLINE) — these typically represent room boundaries
        const closedPolylines = dxf.entities.filter(
            (e: any) =>
                (e.type === "LWPOLYLINE" || e.type === "POLYLINE") &&
                e.shape === true // closed polyline
        );

        // Also check for INSERT entities with block names that indicate rooms
        const insertEntities = dxf.entities.filter(
            (e: any) => e.type === "INSERT" && e.name
        );

        // Process closed polylines → compute area via shoelace formula
        for (const poly of closedPolylines) {
            const vertices = (poly as any).vertices;
            if (!vertices || vertices.length < 3) continue;

            const area = computePolygonArea(vertices);
            if (area < 1) continue; // Skip polygons smaller than 1 sqm

            // Try to find a room name from the layer or nearby TEXT entities
            const layer = poly.layer || "";
            const roomName = layer || `Room ${rooms.length + 1}`;
            const category = classifyRoomName(roomName);

            rooms.push({
                name: roomName,
                category,
                sqm: Number(area.toFixed(2)),
                floorLevel: null,
                confidence: 0.7,
            });
        }

        // Process INSERT entities — block names often indicate rooms
        for (const insert of insertEntities) {
            const blockName = (insert as any).name || "";
            const category = classifyRoomName(blockName);
            if (category !== "other") {
                // Block insertions don't have geometry — use placeholder sqm
                rooms.push({
                    name: blockName,
                    category,
                    sqm: 0, // Will need manual input
                    floorLevel: null,
                    confidence: 0.3,
                });
                warnings.push(`Block "${blockName}" found but sqm requires manual entry`);
            }
        }

        if (rooms.length === 0) {
            warnings.push("No room boundaries detected. DXF may not contain closed polylines on room layers.");
        }
    } catch (err: any) {
        warnings.push(`DXF parse error: ${err.message}`);
    }

    return { rooms, source: "dxf_geometry", warnings };
}

/**
 * Shoelace formula for polygon area from vertices.
 * Assumes vertices are [{x, y}, ...] in drawing units.
 * Converts to sqm assuming drawing units are mm (÷ 1,000,000) or m (÷ 1).
 */
function computePolygonArea(vertices: Array<{ x: number; y: number }>): number {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += vertices[i].x * vertices[j].y;
        area -= vertices[j].x * vertices[i].y;
    }
    area = Math.abs(area) / 2;

    // Heuristic: if area > 1,000,000 assume mm units
    if (area > 1_000_000) {
        area /= 1_000_000; // mm² → m²
    }

    return area;
}

// ─── DWG Vision Fallback ──────────────────────────────────────────────────────

/**
 * Fallback for DWG files: send to Gemini vision for room extraction.
 * DWG has no open-source parser — binary format requires proprietary tools.
 */
export async function parseDwgViaVision(
    fileBuffer: Buffer,
    originalFilename: string
): Promise<ParseResult> {
    const warnings: string[] = [];

    try {
        const { invokeLLM } = await import("../../_core/llm");

        const base64 = fileBuffer.toString("base64");
        const mimeType = "application/octet-stream";

        const response = await invokeLLM({
            messages: [
                {
                    role: "system",
                    content: `You are an architectural drawing analyst. Extract rooms from this DWG/architectural drawing file named "${originalFilename}".

For each room, provide:
- name: room name as shown on the drawing
- category: one of: lobby, corridor, office_floor, guest_room, suite, fb_restaurant, bathroom, kitchen, bedroom, living, utility, amenity, parking, retail, back_of_house, other
- sqm: estimated area in square meters (based on drawing scale or labels)
- floorLevel: floor level if visible (e.g., "Ground", "L1", "B1")

Return JSON with schema: { rooms: [{ name, category, sqm, floorLevel }] }`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text" as const,
                            text: "Extract all rooms from this architectural drawing. Return structured JSON.",
                        },
                        {
                            type: "image_url" as const,
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            responseFormat: { type: "json_object" },
        });

        const rawContent = response.choices[0]?.message?.content;
        const text = typeof rawContent === "string"
            ? rawContent
            : Array.isArray(rawContent)
                ? rawContent.map((p: any) => (typeof p === "string" ? p : p.text || "")).join("")
                : "";

        const parsed = JSON.parse(text);
        const rooms: ParsedRoom[] = (parsed.rooms || []).map((r: any) => ({
            name: r.name || "Unknown Room",
            category: classifyRoomName(r.name || r.category || ""),
            sqm: Number(r.sqm) || 0,
            floorLevel: r.floorLevel || null,
            confidence: 0.5,
        }));

        if (rooms.length === 0) {
            warnings.push("Gemini vision could not identify rooms in the DWG file");
        }

        return { rooms, source: "dwg_vision", warnings };
    } catch (err: any) {
        warnings.push(`DWG vision analysis failed: ${err.message}`);
        return { rooms: [], source: "dwg_vision", warnings };
    }
}
