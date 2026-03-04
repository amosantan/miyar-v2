/**
 * MIYAR 3.0 Phase B — Amenity Taxonomy
 *
 * 9 amenity sub-space types with sqm ratio constants.
 * Pure function — no LLM, no DB.
 *
 * Used by:
 *   - space-program-extractor.ts (expand amenity rooms into sub-spaces)
 *   - seed script (generate reference rows)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AmenityType =
    | "pool" | "gym" | "spa" | "lounge" | "kids_club"
    | "business_center" | "concierge" | "prayer_room" | "theater";

export interface AmenitySubSpaceTemplate {
    subSpaceName: string;
    subSpaceType: AmenityType;
    pctOfParent: number;   // e.g., 0.30 = 30% of parent amenity sqm
    isFitOut: boolean;
}

// ─── Amenity Taxonomy ─────────────────────────────────────────────────────────

/**
 * Standard amenity breakdown for UAE luxury/hospitality projects.
 * Ratios are UAE market-typical from MIYAR benchmark data.
 * pctOfParent fractions summed across returned sub-spaces = 1.0
 */
const AMENITY_PROFILES: Record<string, AmenitySubSpaceTemplate[]> = {
    // Hospitality / Hotel
    hospitality: [
        { subSpaceName: "Swimming Pool & Deck", subSpaceType: "pool", pctOfParent: 0.25, isFitOut: true },
        { subSpaceName: "Fitness Center", subSpaceType: "gym", pctOfParent: 0.15, isFitOut: true },
        { subSpaceName: "Spa & Treatment Rooms", subSpaceType: "spa", pctOfParent: 0.20, isFitOut: true },
        { subSpaceName: "Residents' Lounge", subSpaceType: "lounge", pctOfParent: 0.15, isFitOut: true },
        { subSpaceName: "Kids Club", subSpaceType: "kids_club", pctOfParent: 0.08, isFitOut: true },
        { subSpaceName: "Business Center", subSpaceType: "business_center", pctOfParent: 0.07, isFitOut: true },
        { subSpaceName: "Concierge Desk", subSpaceType: "concierge", pctOfParent: 0.05, isFitOut: true },
        { subSpaceName: "Prayer Room", subSpaceType: "prayer_room", pctOfParent: 0.05, isFitOut: true },
    ],

    // Residential
    residential: [
        { subSpaceName: "Swimming Pool & Deck", subSpaceType: "pool", pctOfParent: 0.30, isFitOut: true },
        { subSpaceName: "Fitness Center", subSpaceType: "gym", pctOfParent: 0.20, isFitOut: true },
        { subSpaceName: "Residents' Lounge", subSpaceType: "lounge", pctOfParent: 0.15, isFitOut: true },
        { subSpaceName: "Kids Play Area", subSpaceType: "kids_club", pctOfParent: 0.10, isFitOut: true },
        { subSpaceName: "Prayer Room", subSpaceType: "prayer_room", pctOfParent: 0.08, isFitOut: true },
        { subSpaceName: "BBQ / Outdoor Lounge", subSpaceType: "lounge", pctOfParent: 0.10, isFitOut: true },
        { subSpaceName: "Concierge Area", subSpaceType: "concierge", pctOfParent: 0.07, isFitOut: true },
    ],

    // Commercial / Office
    commercial: [
        { subSpaceName: "Fitness Center", subSpaceType: "gym", pctOfParent: 0.30, isFitOut: true },
        { subSpaceName: "Business Lounge", subSpaceType: "lounge", pctOfParent: 0.25, isFitOut: true },
        { subSpaceName: "Prayer Room", subSpaceType: "prayer_room", pctOfParent: 0.10, isFitOut: true },
        { subSpaceName: "Concierge / Reception", subSpaceType: "concierge", pctOfParent: 0.10, isFitOut: true },
        { subSpaceName: "Outdoor Terrace", subSpaceType: "lounge", pctOfParent: 0.15, isFitOut: true },
        { subSpaceName: "Wellness Room", subSpaceType: "spa", pctOfParent: 0.10, isFitOut: true },
    ],

    // Retail / Mall
    retail: [
        { subSpaceName: "Entertainment Zone", subSpaceType: "theater", pctOfParent: 0.30, isFitOut: true },
        { subSpaceName: "Kids Play Zone", subSpaceType: "kids_club", pctOfParent: 0.20, isFitOut: true },
        { subSpaceName: "VIP Lounge", subSpaceType: "lounge", pctOfParent: 0.15, isFitOut: true },
        { subSpaceName: "Prayer Room", subSpaceType: "prayer_room", pctOfParent: 0.10, isFitOut: true },
        { subSpaceName: "Gym / Fitness", subSpaceType: "gym", pctOfParent: 0.15, isFitOut: true },
        { subSpaceName: "Spa & Wellness", subSpaceType: "spa", pctOfParent: 0.10, isFitOut: true },
    ],
};

// Map aliases
AMENITY_PROFILES["office"] = AMENITY_PROFILES["commercial"];

// ─── getAmenitySubSpaces ──────────────────────────────────────────────────────

/**
 * Generate sub-spaces for an amenity room.
 * Returns template rows with actual sqm calculated from parentSqm.
 *
 * @param typology  Project typology (determines which profile to use)
 * @param parentSqm Total sqm of the parent amenity room
 */
export function getAmenitySubSpaces(
    typology: string,
    parentSqm: number
): Array<AmenitySubSpaceTemplate & { sqm: number }> {
    const t = typology.toLowerCase().trim();
    const profile = AMENITY_PROFILES[t] ?? AMENITY_PROFILES["residential"];

    return profile.map((sub) => ({
        ...sub,
        sqm: Number((parentSqm * sub.pctOfParent).toFixed(2)),
    }));
}

/**
 * Returns all 9 amenity sub-space types for reference/display.
 */
export function getAllAmenityTypes(): AmenityType[] {
    return [
        "pool", "gym", "spa", "lounge", "kids_club",
        "business_center", "concierge", "prayer_room", "theater",
    ];
}
