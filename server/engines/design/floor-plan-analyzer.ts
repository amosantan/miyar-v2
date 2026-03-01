/**
 * Floor Plan Analyzer (Phase 9 — Pillar B)
 *
 * Uses Gemini Vision to analyze uploaded floor plan images/PDFs.
 * Extracts room breakdown, areas, and spatial ratios.
 * Results stored in projects.floorPlanAnalysis for space benchmarking.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnalyzedRoom {
    name: string;
    type:
    | "bedroom"
    | "bathroom"
    | "living"
    | "dining"
    | "kitchen"
    | "corridor"
    | "balcony"
    | "utility"
    | "office"
    | "lobby"
    | "storage"
    | "maid"
    | "laundry"
    | "dressing"
    | "other";
    estimatedSqm: number;
    percentOfTotal: number;
    finishGrade: "A" | "B" | "C";
}

export interface FloorPlanAnalysis {
    rooms: AnalyzedRoom[];
    totalEstimatedSqm: number;
    bedroomCount: number;
    bathroomCount: number;
    balconyPercentage: number;
    circulationPercentage: number;
    unitType: string; // e.g., "3BR+Maid", "2BR", "Studio", "Penthouse"
    analysisConfidence: "high" | "medium" | "low";
    rawNotes: string; // any additional notes from the AI
}

// ─── Extraction Prompt ───────────────────────────────────────────────────────

const FLOOR_PLAN_PROMPT = `You are MIYAR, a UAE real estate intelligence engine analyzing an architectural floor plan.

Your task is to identify every room/space in this floor plan and estimate their areas.

RULES:
- Identify EVERY distinct room, including corridors, balconies, utility rooms, maid's rooms, laundry, dressing rooms, and storage
- Estimate each room's area in square meters based on the plan proportions
- If dimensions are labeled on the plan, use those exact measurements
- If no dimensions are labeled, estimate based on typical UAE residential proportions
- Calculate each room's percentage of the total floor area
- Determine the unit type (e.g., "3BR+Maid", "2BR", "Studio", "Penthouse", "4BR Duplex")
- Assign a finish grade: Grade A for primary/showcase rooms (living, master, kitchen), Grade B for secondary rooms, Grade C for utility/service areas
- Be as specific as possible with room names (e.g., "Master Bedroom" not just "Bedroom", "Guest Bathroom" not just "Bathroom")

Return ONLY valid JSON with this exact structure:
{
  "rooms": [
    {
      "name": "Living & Dining",
      "type": "living",
      "estimatedSqm": 42.5,
      "percentOfTotal": 28.3,
      "finishGrade": "A"
    }
  ],
  "totalEstimatedSqm": 150.0,
  "bedroomCount": 3,
  "bathroomCount": 2,
  "balconyPercentage": 8.5,
  "circulationPercentage": 12.0,
  "unitType": "3BR+Maid",
  "analysisConfidence": "high",
  "rawNotes": "Plan shows recessed balcony with city views. Kitchen is semi-open to living area."
}

Analyze the floor plan now.`;

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Analyze a floor plan image using Gemini Vision.
 * @param imageUrl - The URL of the uploaded floor plan image/PDF
 * @param mimeType - The MIME type of the uploaded file
 */
export async function analyzeFloorPlan(
    imageUrl: string,
    mimeType: string = "image/jpeg"
): Promise<FloorPlanAnalysis> {
    // Fetch the image as a buffer for Gemini Vision
    let imageBuffer: Buffer;
    try {
        const response = await fetch(imageUrl, {
            signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        imageBuffer = Buffer.from(await response.arrayBuffer());
    } catch (err) {
        throw new Error(
            `Failed to fetch floor plan image: ${err instanceof Error ? err.message : String(err)}`
        );
    }

    const base64Image = imageBuffer.toString("base64");

    // Use Gemini with vision capability
    const result = await invokeLLM({
        messages: [
            {
                role: "system",
                content:
                    "You are an expert architectural analyzer. Extract room data from floor plans with extreme precision. Return ONLY valid JSON.",
            },
            {
                role: "user",
                content: [
                    { type: "text", text: FLOOR_PLAN_PROMPT },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                        },
                    },
                ] as any,
            },
        ],
        response_format: { type: "json_object" },
    });

    const content =
        typeof result.choices[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : "";

    if (!content) {
        throw new Error("Gemini returned empty response for floor plan analysis");
    }

    const parsed = JSON.parse(content);

    // Validate the response
    if (!parsed.rooms || !Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
        throw new Error("Gemini could not identify any rooms in the floor plan");
    }

    // Normalize and validate each room
    const rooms: AnalyzedRoom[] = parsed.rooms
        .filter((r: any) => r.name && r.estimatedSqm > 0)
        .map((r: any) => ({
            name: String(r.name).substring(0, 100),
            type: validateRoomType(r.type),
            estimatedSqm: Math.round(Number(r.estimatedSqm) * 100) / 100,
            percentOfTotal: Math.round(Number(r.percentOfTotal) * 100) / 100,
            finishGrade: (["A", "B", "C"].includes(r.finishGrade) ? r.finishGrade : "B") as
                | "A"
                | "B"
                | "C",
        }));

    const totalSqm = rooms.reduce((sum, r) => sum + r.estimatedSqm, 0);

    // Recalculate percentages to ensure they sum to 100
    for (const room of rooms) {
        room.percentOfTotal =
            Math.round((room.estimatedSqm / totalSqm) * 10000) / 100;
    }

    return {
        rooms,
        totalEstimatedSqm: Math.round(totalSqm * 100) / 100,
        bedroomCount: Number(parsed.bedroomCount) || rooms.filter((r) => r.type === "bedroom").length,
        bathroomCount: Number(parsed.bathroomCount) || rooms.filter((r) => r.type === "bathroom").length,
        balconyPercentage:
            Math.round(
                rooms
                    .filter((r) => r.type === "balcony")
                    .reduce((sum, r) => sum + r.percentOfTotal, 0) * 100
            ) / 100,
        circulationPercentage:
            Math.round(
                rooms
                    .filter((r) => r.type === "corridor")
                    .reduce((sum, r) => sum + r.percentOfTotal, 0) * 100
            ) / 100,
        unitType: String(parsed.unitType || deriveUnitType(rooms)),
        analysisConfidence: validateConfidence(parsed.analysisConfidence),
        rawNotes: String(parsed.rawNotes || "").substring(0, 500),
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_ROOM_TYPES = [
    "bedroom", "bathroom", "living", "dining", "kitchen", "corridor",
    "balcony", "utility", "office", "lobby", "storage", "maid", "laundry", "dressing", "other",
];

function validateRoomType(type: string): AnalyzedRoom["type"] {
    const normalized = String(type).toLowerCase().replace(/\s+/g, "_");
    if (VALID_ROOM_TYPES.includes(normalized)) return normalized as AnalyzedRoom["type"];
    // Common mappings
    if (/bed|master|guest.*room/.test(normalized)) return "bedroom";
    if (/bath|wc|toilet|shower|ensuite/.test(normalized)) return "bathroom";
    if (/living|lounge|family/.test(normalized)) return "living";
    if (/dining/.test(normalized)) return "dining";
    if (/kitchen|pantry/.test(normalized)) return "kitchen";
    if (/corridor|hall|entry|foyer|circulation/.test(normalized)) return "corridor";
    if (/balcony|terrace|patio/.test(normalized)) return "balcony";
    if (/maid|helper|staff/.test(normalized)) return "maid";
    if (/laundry|wash/.test(normalized)) return "laundry";
    if (/dress|walk.*in|closet|wardrobe/.test(normalized)) return "dressing";
    if (/store|storage/.test(normalized)) return "storage";
    if (/office|study|work/.test(normalized)) return "office";
    return "other";
}

function validateConfidence(val: string): "high" | "medium" | "low" {
    if (val === "high" || val === "medium" || val === "low") return val;
    return "medium";
}

function deriveUnitType(rooms: AnalyzedRoom[]): string {
    const bedrooms = rooms.filter((r) => r.type === "bedroom").length;
    const hasMaid = rooms.some((r) => r.type === "maid");
    if (bedrooms === 0) return "Studio";
    return `${bedrooms}BR${hasMaid ? "+Maid" : ""}`;
}
