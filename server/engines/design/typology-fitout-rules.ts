/**
 * MIYAR 3.0 Phase B — Typology-Aware Fit-Out Rules
 *
 * Deterministic matrix: typology × room category → isFitOut + reason.
 * No LLM. No DB. Pure functions.
 *
 * Used by:
 *   - space-program-extractor.ts (auto-tag rooms on generation)
 *   - spaceProgram.ts router (resetToTypologyDefaults)
 *   - materialQuantity.ts (filter fit-out rooms before MQI)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoomCategory =
    | "lobby" | "corridor" | "office_floor" | "guest_room" | "suite"
    | "fb_restaurant" | "bathroom" | "kitchen" | "bedroom" | "living"
    | "utility" | "amenity" | "parking" | "retail" | "back_of_house" | "other";

export type Typology =
    | "residential" | "commercial" | "office" | "hospitality"
    | "mixed-use" | "retail" | "industrial"
    | "clinic_medical" | "restaurant" | "villa" | "apartment";

export interface FitOutTag {
    isFitOut: boolean;
    fitOutReason: string;
}

export interface SpaceProgramRoomTemplate {
    roomCode: string;
    roomName: string;
    category: RoomCategory;
    pctOfGfa: number;         // fraction of GFA, e.g. 0.28
    finishGrade: "A" | "B" | "C";
    priority: "high" | "medium" | "low";
    budgetPct: number;        // fraction of total finish budget
    isFitOut: boolean;
    fitOutReason: string;
}

// ─── Fit-Out Rules Matrix ─────────────────────────────────────────────────────

/**
 * Shell & core categories by typology.
 * Anything NOT in this set defaults to fit-out.
 */
const SHELL_CORE_CATEGORIES: Record<string, Set<RoomCategory>> = {
    residential: new Set<RoomCategory>([]),  // all fit-out
    villa: new Set<RoomCategory>([]),  // all fit-out (same as residential)
    apartment: new Set<RoomCategory>([]),  // all fit-out (same as residential)
    commercial: new Set<RoomCategory>(["office_floor", "parking"]),
    office: new Set<RoomCategory>(["office_floor", "parking"]),
    office_building: new Set<RoomCategory>(["office_floor", "parking"]),  // alias
    hospitality: new Set<RoomCategory>(["parking", "back_of_house"]),
    hotel: new Set<RoomCategory>(["parking", "back_of_house"]),  // alias
    "mixed-use": new Set<RoomCategory>(["parking"]),  // per-block rules apply
    mixed_use: new Set<RoomCategory>(["parking"]),  // underscore alias
    retail: new Set<RoomCategory>(["retail", "parking"]),  // tenanted units = shell
    retail_commercial: new Set<RoomCategory>(["retail", "parking"]),  // alias
    industrial: new Set<RoomCategory>(["office_floor", "parking", "back_of_house", "utility"]),
    restaurant: new Set<RoomCategory>(["parking"]),  // all interior is fit-out
    clinic_medical: new Set<RoomCategory>(["office_floor", "parking", "utility"]),  // clinical rooms = S&C (tenant fit-out)
};

const SHELL_CORE_REASONS: Record<RoomCategory, string> = {
    office_floor: "Tenant/clinical fit-out responsibility — developer delivers shell & core only",
    parking: "Parking structure — no interior finish required",
    back_of_house: "Back-of-house — basic utility finish, not developer scope",
    retail: "Retail unit — tenant fit-out responsibility",
    utility: "Utility space — minimal finish scope",
    // These never appear as shell & core but included for type completeness:
    lobby: "", corridor: "", guest_room: "", suite: "", fb_restaurant: "",
    bathroom: "", kitchen: "", bedroom: "", living: "", amenity: "", other: "",
};

// ─── getFitOutTag ─────────────────────────────────────────────────────────────

/**
 * Given a typology and room category, return whether the room is fit-out scope.
 * Pure deterministic — no LLM, no DB.
 */
export function getFitOutTag(typology: string, category: RoomCategory): FitOutTag {
    const normalizedTypology = typology.toLowerCase().trim();
    const shellSet = SHELL_CORE_CATEGORIES[normalizedTypology] ?? new Set<RoomCategory>();

    if (shellSet.has(category)) {
        return {
            isFitOut: false,
            fitOutReason: SHELL_CORE_REASONS[category] || `${category} is shell & core for ${normalizedTypology}`,
        };
    }

    return {
        isFitOut: true,
        fitOutReason: `${category} receives full interior fit-out for ${normalizedTypology} projects`,
    };
}

// ─── Room Templates by Typology ───────────────────────────────────────────────

/**
 * Default room breakdown per typology.
 * pctOfGfa fractions should sum to 1.0 within each template.
 * These are the same hardcoded templates from space-program.ts,
 * enhanced with category tags and fit-out flags.
 */
export function getDefaultRoomTemplate(typology: string): SpaceProgramRoomTemplate[] {
    const t = typology.toLowerCase().trim();

    if (t === "hospitality") {
        return [
            { roomCode: "LBY", roomName: "Hotel Lobby", category: "lobby", pctOfGfa: 0.15, finishGrade: "A", priority: "high", budgetPct: 0.25, ...getFitOutTag(t, "lobby") },
            { roomCode: "GRM", roomName: "Guest Room (std)", category: "guest_room", pctOfGfa: 0.25, finishGrade: "A", priority: "high", budgetPct: 0.20, ...getFitOutTag(t, "guest_room") },
            { roomCode: "GRS", roomName: "Guest Room (suite)", category: "suite", pctOfGfa: 0.10, finishGrade: "A", priority: "high", budgetPct: 0.18, ...getFitOutTag(t, "suite") },
            { roomCode: "FBB", roomName: "F&B / Restaurant", category: "fb_restaurant", pctOfGfa: 0.12, finishGrade: "A", priority: "high", budgetPct: 0.15, ...getFitOutTag(t, "fb_restaurant") },
            { roomCode: "AMN", roomName: "Amenities (Pool/Spa/Gym)", category: "amenity", pctOfGfa: 0.08, finishGrade: "A", priority: "high", budgetPct: 0.10, ...getFitOutTag(t, "amenity") },
            { roomCode: "COR", roomName: "Corridors", category: "corridor", pctOfGfa: 0.10, finishGrade: "B", priority: "medium", budgetPct: 0.04, ...getFitOutTag(t, "corridor") },
            { roomCode: "BTH", roomName: "Common Bathrooms", category: "bathroom", pctOfGfa: 0.05, finishGrade: "B", priority: "medium", budgetPct: 0.04, ...getFitOutTag(t, "bathroom") },
            { roomCode: "BOH", roomName: "Back of House", category: "back_of_house", pctOfGfa: 0.08, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "back_of_house") },
            { roomCode: "PKG", roomName: "Parking", category: "parking", pctOfGfa: 0.07, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "parking") },
        ];
    }

    if (t === "commercial" || t === "office" || t === "office_building") {
        return [
            { roomCode: "RCP", roomName: "Reception / Lobby", category: "lobby", pctOfGfa: 0.08, finishGrade: "A", priority: "high", budgetPct: 0.22, ...getFitOutTag(t, "lobby") },
            { roomCode: "OPN", roomName: "Open Plan Office", category: "office_floor", pctOfGfa: 0.40, finishGrade: "B", priority: "medium", budgetPct: 0.08, ...getFitOutTag(t, "office_floor") },
            { roomCode: "MET", roomName: "Meeting Rooms", category: "office_floor", pctOfGfa: 0.10, finishGrade: "A", priority: "high", budgetPct: 0.18, ...getFitOutTag(t, "office_floor") },
            { roomCode: "COR", roomName: "Circulation / Corridors", category: "corridor", pctOfGfa: 0.08, finishGrade: "B", priority: "medium", budgetPct: 0.05, ...getFitOutTag(t, "corridor") },
            { roomCode: "BTH", roomName: "Toilet Cores", category: "bathroom", pctOfGfa: 0.06, finishGrade: "B", priority: "medium", budgetPct: 0.12, ...getFitOutTag(t, "bathroom") },
            { roomCode: "AMN", roomName: "Amenities", category: "amenity", pctOfGfa: 0.05, finishGrade: "A", priority: "high", budgetPct: 0.15, ...getFitOutTag(t, "amenity") },
            { roomCode: "BRK", roomName: "Break / Pantry Areas", category: "kitchen", pctOfGfa: 0.05, finishGrade: "B", priority: "medium", budgetPct: 0.08, ...getFitOutTag(t, "kitchen") },
            { roomCode: "UTL", roomName: "Utility / Services", category: "utility", pctOfGfa: 0.06, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "utility") },
            { roomCode: "PKG", roomName: "Parking", category: "parking", pctOfGfa: 0.12, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "parking") },
        ];
    }

    if (t === "retail" || t === "retail_commercial") {
        return [
            { roomCode: "LBY", roomName: "Mall Entrance / Atrium", category: "lobby", pctOfGfa: 0.10, finishGrade: "A", priority: "high", budgetPct: 0.25, ...getFitOutTag(t, "lobby") },
            { roomCode: "RTL", roomName: "Retail Units", category: "retail", pctOfGfa: 0.45, finishGrade: "B", priority: "medium", budgetPct: 0.05, ...getFitOutTag(t, "retail") },
            { roomCode: "COR", roomName: "Common Corridors", category: "corridor", pctOfGfa: 0.12, finishGrade: "A", priority: "high", budgetPct: 0.20, ...getFitOutTag(t, "corridor") },
            { roomCode: "FBB", roomName: "Food Court / F&B", category: "fb_restaurant", pctOfGfa: 0.08, finishGrade: "A", priority: "high", budgetPct: 0.18, ...getFitOutTag(t, "fb_restaurant") },
            { roomCode: "BTH", roomName: "Common Bathrooms", category: "bathroom", pctOfGfa: 0.04, finishGrade: "B", priority: "medium", budgetPct: 0.08, ...getFitOutTag(t, "bathroom") },
            { roomCode: "AMN", roomName: "Amenities / Entertainment", category: "amenity", pctOfGfa: 0.05, finishGrade: "A", priority: "high", budgetPct: 0.10, ...getFitOutTag(t, "amenity") },
            { roomCode: "BOH", roomName: "Back of House / Loading", category: "back_of_house", pctOfGfa: 0.06, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "back_of_house") },
            { roomCode: "PKG", roomName: "Parking", category: "parking", pctOfGfa: 0.10, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "parking") },
        ];
    }

    // Restaurant — all interior is fit-out scope
    if (t === "restaurant") {
        return [
            { roomCode: "DNR", roomName: "Dining Room", category: "fb_restaurant", pctOfGfa: 0.40, finishGrade: "A", priority: "high", budgetPct: 0.30, ...getFitOutTag(t, "fb_restaurant") },
            { roomCode: "LNG", roomName: "Lounge / Bar", category: "living", pctOfGfa: 0.12, finishGrade: "A", priority: "high", budgetPct: 0.18, ...getFitOutTag(t, "living") },
            { roomCode: "KIT", roomName: "Kitchen", category: "kitchen", pctOfGfa: 0.18, finishGrade: "B", priority: "high", budgetPct: 0.20, ...getFitOutTag(t, "kitchen") },
            { roomCode: "LBY", roomName: "Entrance / Reception", category: "lobby", pctOfGfa: 0.08, finishGrade: "A", priority: "high", budgetPct: 0.12, ...getFitOutTag(t, "lobby") },
            { roomCode: "BTH", roomName: "Guest Washrooms", category: "bathroom", pctOfGfa: 0.06, finishGrade: "A", priority: "medium", budgetPct: 0.08, ...getFitOutTag(t, "bathroom") },
            { roomCode: "BOH", roomName: "Back of House / Storage", category: "back_of_house", pctOfGfa: 0.08, finishGrade: "C", priority: "low", budgetPct: 0.04, ...getFitOutTag(t, "back_of_house") },
            { roomCode: "COR", roomName: "Service Corridor", category: "corridor", pctOfGfa: 0.04, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "corridor") },
            { roomCode: "PKG", roomName: "Parking", category: "parking", pctOfGfa: 0.04, finishGrade: "C", priority: "low", budgetPct: 0.06, ...getFitOutTag(t, "parking") },
        ];
    }

    // Clinic / Medical — reception fit-out, clinical rooms shell & core
    if (t === "clinic_medical") {
        return [
            { roomCode: "RCP", roomName: "Reception / Waiting", category: "lobby", pctOfGfa: 0.12, finishGrade: "A", priority: "high", budgetPct: 0.25, ...getFitOutTag(t, "lobby") },
            { roomCode: "CLN", roomName: "Clinical Rooms", category: "office_floor", pctOfGfa: 0.35, finishGrade: "B", priority: "medium", budgetPct: 0.05, ...getFitOutTag(t, "office_floor") },
            { roomCode: "COR", roomName: "Corridors", category: "corridor", pctOfGfa: 0.10, finishGrade: "B", priority: "medium", budgetPct: 0.10, ...getFitOutTag(t, "corridor") },
            { roomCode: "BTH", roomName: "Patient Washrooms", category: "bathroom", pctOfGfa: 0.06, finishGrade: "A", priority: "medium", budgetPct: 0.12, ...getFitOutTag(t, "bathroom") },
            { roomCode: "PHR", roomName: "Pharmacy / Retail", category: "retail", pctOfGfa: 0.05, finishGrade: "B", priority: "medium", budgetPct: 0.08, ...getFitOutTag(t, "retail") },
            { roomCode: "ADM", roomName: "Admin / Back Office", category: "office_floor", pctOfGfa: 0.08, finishGrade: "B", priority: "low", budgetPct: 0.05, ...getFitOutTag(t, "office_floor") },
            { roomCode: "UTL", roomName: "Utility / Medical Gas", category: "utility", pctOfGfa: 0.06, finishGrade: "C", priority: "low", budgetPct: 0.03, ...getFitOutTag(t, "utility") },
            { roomCode: "BOH", roomName: "Back of House", category: "back_of_house", pctOfGfa: 0.06, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "back_of_house") },
            { roomCode: "PKG", roomName: "Parking", category: "parking", pctOfGfa: 0.12, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "parking") },
        ];
    }

    // Mixed-Use — composite template (when blocks are NOT defined, single-block fallback)
    if (t === "mixed-use" || t === "mixed_use") {
        return [
            { roomCode: "LBY", roomName: "Main Lobby / Atrium", category: "lobby", pctOfGfa: 0.10, finishGrade: "A", priority: "high", budgetPct: 0.22, ...getFitOutTag(t, "lobby") },
            { roomCode: "RTL", roomName: "Retail Units", category: "retail", pctOfGfa: 0.30, finishGrade: "B", priority: "medium", budgetPct: 0.08, ...getFitOutTag(t, "retail") },
            { roomCode: "RES", roomName: "Residential Units", category: "living", pctOfGfa: 0.25, finishGrade: "A", priority: "high", budgetPct: 0.28, ...getFitOutTag(t, "living") },
            { roomCode: "FBB", roomName: "F&B / Restaurant", category: "fb_restaurant", pctOfGfa: 0.10, finishGrade: "A", priority: "high", budgetPct: 0.15, ...getFitOutTag(t, "fb_restaurant") },
            { roomCode: "AMN", roomName: "Amenities", category: "amenity", pctOfGfa: 0.05, finishGrade: "A", priority: "high", budgetPct: 0.10, ...getFitOutTag(t, "amenity") },
            { roomCode: "COR", roomName: "Corridors / Circulation", category: "corridor", pctOfGfa: 0.08, finishGrade: "B", priority: "medium", budgetPct: 0.05, ...getFitOutTag(t, "corridor") },
            { roomCode: "PKG", roomName: "Parking", category: "parking", pctOfGfa: 0.07, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "parking") },
            { roomCode: "UTL", roomName: "Utility / Services", category: "utility", pctOfGfa: 0.05, finishGrade: "C", priority: "low", budgetPct: 0.02, ...getFitOutTag(t, "utility") },
        ];
    }

    // Default: Residential (all fit-out)
    return [
        { roomCode: "LVG", roomName: "Living & Dining", category: "living", pctOfGfa: 0.28, finishGrade: "A", priority: "high", budgetPct: 0.28, ...getFitOutTag("residential", "living") },
        { roomCode: "MBR", roomName: "Master Bedroom", category: "bedroom", pctOfGfa: 0.18, finishGrade: "A", priority: "high", budgetPct: 0.22, ...getFitOutTag("residential", "bedroom") },
        { roomCode: "MEN", roomName: "Master Ensuite", category: "bathroom", pctOfGfa: 0.08, finishGrade: "A", priority: "high", budgetPct: 0.14, ...getFitOutTag("residential", "bathroom") },
        { roomCode: "KIT", roomName: "Kitchen", category: "kitchen", pctOfGfa: 0.10, finishGrade: "A", priority: "high", budgetPct: 0.16, ...getFitOutTag("residential", "kitchen") },
        { roomCode: "BD2", roomName: "Bedroom 2", category: "bedroom", pctOfGfa: 0.10, finishGrade: "B", priority: "medium", budgetPct: 0.07, ...getFitOutTag("residential", "bedroom") },
        { roomCode: "BD3", roomName: "Bedroom 3", category: "bedroom", pctOfGfa: 0.08, finishGrade: "B", priority: "medium", budgetPct: 0.05, ...getFitOutTag("residential", "bedroom") },
        { roomCode: "BTH", roomName: "Bathroom 2", category: "bathroom", pctOfGfa: 0.05, finishGrade: "B", priority: "medium", budgetPct: 0.05, ...getFitOutTag("residential", "bathroom") },
        { roomCode: "ENT", roomName: "Entry & Corridors", category: "corridor", pctOfGfa: 0.08, finishGrade: "B", priority: "low", budgetPct: 0.02, ...getFitOutTag("residential", "corridor") },
        { roomCode: "UTL", roomName: "Utility & Maid's", category: "utility", pctOfGfa: 0.05, finishGrade: "C", priority: "low", budgetPct: 0.01, ...getFitOutTag("residential", "utility") },
    ];
}
