/**
 * PDF / Floor Plan Extraction Engine (V4 — Fit-out Oracle)
 * Uses Gemini Vision to extract room names and areas from floor plan images.
 */
import { invokeLLM } from "../_core/llm";

export interface ExtractedRoom {
    name: string;
    areaSqm: number;
    confidence: number; // 0-1
    category?: string;  // "living", "bedroom", "bathroom", "kitchen", "corridor", "utility", "balcony"
}

export interface ExtractionResult {
    rooms: ExtractedRoom[];
    totalArea: number;
    warnings: string[];
}

const EXTRACTION_PROMPT = `You are an expert architectural floor plan analyst working in the UAE interior design market.

Analyze the provided floor plan image and extract ALL rooms/spaces with their approximate areas.

For each room, provide:
- name: The room label as shown on the plan (e.g., "Master Bedroom", "Living Room", "Kitchen", "Bathroom 1")
- areaSqm: The area in square meters. If dimensions are labeled, calculate area precisely. If not, estimate based on visual proportions and any scale reference.
- confidence: Your confidence level (0.0 to 1.0) in the area measurement
- category: One of: living, bedroom, bathroom, kitchen, corridor, utility, balcony, dining, study, storage, terrace, other

Rules:
1. Include ALL spaces shown on the plan, including corridors, storage, and utility rooms
2. If the plan shows dimensions in feet, convert to sqm (1 sqft = 0.0929 sqm)
3. If no scale is provided, estimate areas based on standard UAE residential proportions (typical bedroom ~15-20 sqm, bathroom ~5-8 sqm, living room ~25-40 sqm)
4. Do NOT include external areas (parking, garden) unless they are enclosed balconies/terraces
5. Label rooms exactly as shown on the plan; if no label is visible, use descriptive names like "Room 1", "Corridor"
6. Round areas to one decimal place`;

/**
 * Extract rooms from a floor plan image using Gemini Vision
 */
export async function extractRoomsFromImage(
    imageUrl: string,
    projectContext?: { typology?: string; gfa?: number; archetype?: string }
): Promise<ExtractionResult> {
    const contextNote = projectContext
        ? `\nProject context: ${projectContext.typology || "Residential"} project, GFA: ${projectContext.gfa || "unknown"} sqm, Archetype: ${projectContext.archetype || "unknown"}`
        : "";

    const result = await invokeLLM({
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: EXTRACTION_PROMPT + contextNote + "\n\nAnalyze this floor plan and extract all rooms with their areas.",
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageUrl, detail: "high" },
                    },
                ],
            },
        ],
        outputSchema: {
            name: "floor_plan_extraction",
            schema: {
                type: "object",
                properties: {
                    rooms: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                areaSqm: { type: "number" },
                                confidence: { type: "number" },
                                category: { type: "string" },
                            },
                            required: ["name", "areaSqm", "confidence"],
                        },
                    },
                    totalArea: { type: "number" },
                    notes: { type: "string" },
                },
                required: ["rooms", "totalArea"],
            },
        },
    });

    const content = result.choices[0]?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c: any) => c.text || "").join("") : "";

    let parsed: { rooms: ExtractedRoom[]; totalArea: number; notes?: string };
    try {
        parsed = JSON.parse(text);
    } catch {
        // Fallback: try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error("Failed to parse Gemini extraction response");
        }
    }

    // Validate and clean extracted rooms
    const warnings: string[] = [];
    const rooms = (parsed.rooms || []).map((r) => ({
        name: r.name || "Unknown Room",
        areaSqm: Math.round((r.areaSqm || 0) * 10) / 10,
        confidence: Math.min(1, Math.max(0, r.confidence || 0.5)),
        category: r.category || "other",
    }));

    // Calculate the sum from individual rooms
    const summedTotal = rooms.reduce((acc, r) => acc + r.areaSqm, 0);
    const reportedTotal = parsed.totalArea || summedTotal;

    // Warn if Gemini's reported total differs significantly from the sum
    if (Math.abs(reportedTotal - summedTotal) > summedTotal * 0.05) {
        warnings.push(
            `Gemini reported total (${reportedTotal.toFixed(1)} sqm) differs from sum of rooms (${summedTotal.toFixed(1)} sqm) by ${Math.abs(reportedTotal - summedTotal).toFixed(1)} sqm`
        );
    }

    // Warn about low-confidence rooms
    const lowConfidence = rooms.filter((r) => r.confidence < 0.6);
    if (lowConfidence.length > 0) {
        warnings.push(
            `${lowConfidence.length} room(s) have low extraction confidence: ${lowConfidence.map((r) => r.name).join(", ")}`
        );
    }

    if (parsed.notes) {
        warnings.push(`AI note: ${parsed.notes}`);
    }

    return {
        rooms,
        totalArea: Math.round(summedTotal * 10) / 10,
        warnings,
    };
}
