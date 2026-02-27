/**
 * RICS NRM Alignment — Phase E.3
 *
 * Maps MIYAR space types and material categories to RICS NRM 
 * (New Rules of Measurement) element codes for institutional credibility.
 *
 * References:
 * - NRM 1: Order of Cost Estimating
 * - NRM 2: Detailed Measurement for Building Works
 * - RICS Guidance Note: Cost Analysis and Benchmarking (2022)
 */

// ─── NRM Element Groups ──────────────────────────────────────────────────────
export interface RicsElement {
    code: string;        // e.g., "3A"
    group: number;       // NRM group number (1–8)
    groupName: string;   // e.g., "Internal Finishes"
    element: string;     // e.g., "Wall Finishes"
}

// ─── Space Type → Primary NRM Group ──────────────────────────────────────────
const SPACE_TO_NRM_GROUP: Record<string, { group: number; groupName: string }> = {
    "Living Room": { group: 3, groupName: "Internal Finishes" },
    "Master Bedroom": { group: 3, groupName: "Internal Finishes" },
    "Kitchen": { group: 5, groupName: "Services & FF&E" },
    "Bathroom": { group: 3, groupName: "Internal Finishes" },
    "Dining Room": { group: 3, groupName: "Internal Finishes" },
    "Study": { group: 3, groupName: "Internal Finishes" },
    "Corridor": { group: 3, groupName: "Internal Finishes" },
    "Lobby": { group: 3, groupName: "Internal Finishes" },
    "Balcony": { group: 2, groupName: "Superstructure" },
    "Pool Area": { group: 8, groupName: "External Works" },
    "Spa": { group: 5, groupName: "Services & FF&E" },
    "Gym": { group: 5, groupName: "Services & FF&E" },
    "Cinema Room": { group: 5, groupName: "Services & FF&E" },
    "Guest Bedroom": { group: 3, groupName: "Internal Finishes" },
    "Powder Room": { group: 3, groupName: "Internal Finishes" },
    "Pantry": { group: 5, groupName: "Services & FF&E" },
    "Maid's Room": { group: 3, groupName: "Internal Finishes" },
    "Driver's Room": { group: 3, groupName: "Internal Finishes" },
    "Laundry": { group: 5, groupName: "Services & FF&E" },
    "Storage": { group: 3, groupName: "Internal Finishes" },
    "Garage": { group: 2, groupName: "Superstructure" },
    "Roof Terrace": { group: 2, groupName: "Superstructure" },
    "Garden": { group: 8, groupName: "External Works" },
};

// ─── Material Category → NRM Element Code ────────────────────────────────────
const MATERIAL_TO_NRM: Record<string, RicsElement> = {
    // Internal surface finishes
    "flooring": { code: "3A", group: 3, groupName: "Internal Finishes", element: "Floor Finishes" },
    "wall_cladding": { code: "3B", group: 3, groupName: "Internal Finishes", element: "Wall Finishes" },
    "ceiling": { code: "3C", group: 3, groupName: "Internal Finishes", element: "Ceiling Finishes" },
    "joinery": { code: "3D", group: 3, groupName: "Internal Finishes", element: "Fittings, Furnishings & Joinery" },

    // FF&E
    "lighting": { code: "5H", group: 5, groupName: "Services & FF&E", element: "Electrical Installation — Lighting" },
    "sanitary": { code: "5D", group: 5, groupName: "Services & FF&E", element: "Sanitary Appliances" },
    "kitchen_fit": { code: "5L", group: 5, groupName: "Services & FF&E", element: "Kitchen Fittings" },
    "furniture": { code: "3D", group: 3, groupName: "Internal Finishes", element: "Fittings, Furnishings & Equipment" },
    "metalwork": { code: "3E", group: 3, groupName: "Internal Finishes", element: "Metalwork & Balustrades" },

    // Building services
    "hvac": { code: "5E", group: 5, groupName: "Services & FF&E", element: "Heating, Ventilation & AC" },
    "plumbing": { code: "5C", group: 5, groupName: "Services & FF&E", element: "Hot & Cold Water" },
    "electrical": { code: "5G", group: 5, groupName: "Services & FF&E", element: "Electrical Installation" },
    "fire": { code: "5K", group: 5, groupName: "Services & FF&E", element: "Fire Protection" },
    "security": { code: "5J", group: 5, groupName: "Services & FF&E", element: "Security & Access" },
    "smart_home": { code: "5N", group: 5, groupName: "Services & FF&E", element: "Builder's Work in Connection with Services" },

    // External
    "landscaping": { code: "8A", group: 8, groupName: "External Works", element: "External Landscaping" },
    "pool": { code: "8C", group: 8, groupName: "External Works", element: "External Services — Swimming Pool" },
    "facade": { code: "2H", group: 2, groupName: "Superstructure", element: "External Walls — Cladding" },

    // Structure-related finishes
    "stone": { code: "3A", group: 3, groupName: "Internal Finishes", element: "Natural Stone Finishes" },
    "marble": { code: "3A", group: 3, groupName: "Internal Finishes", element: "Natural Stone — Marble" },
    "tile": { code: "3A", group: 3, groupName: "Internal Finishes", element: "Ceramic/Porcelain Tile" },
    "wood": { code: "3A", group: 3, groupName: "Internal Finishes", element: "Timber/Engineered Wood" },
    "carpet": { code: "3A", group: 3, groupName: "Internal Finishes", element: "Carpet & Soft Flooring" },
    "paint": { code: "3B", group: 3, groupName: "Internal Finishes", element: "Paint & Decorative Coatings" },
    "wallpaper": { code: "3B", group: 3, groupName: "Internal Finishes", element: "Wallcoverings" },
    "glass": { code: "2G", group: 2, groupName: "Superstructure", element: "Windows, Screens & Glazing" },
};

// ─── Default fallback ────────────────────────────────────────────────────────
const FALLBACK_RICS: RicsElement = {
    code: "3A",
    group: 3,
    groupName: "Internal Finishes",
    element: "General Finishes",
};

/**
 * Map a MIYAR material/category to RICS NRM element code.
 * Tries exact match first, then fuzzy keyword match.
 */
export function mapToRics(
    materialType: string,
    spaceType?: string,
): RicsElement {
    // 1. Exact material match
    const key = materialType.toLowerCase().replace(/[\s-]+/g, "_");
    if (MATERIAL_TO_NRM[key]) return MATERIAL_TO_NRM[key];

    // 2. Keyword search in material name
    const lowerMat = materialType.toLowerCase();
    for (const [k, v] of Object.entries(MATERIAL_TO_NRM)) {
        if (lowerMat.includes(k.replace(/_/g, " ")) || lowerMat.includes(k)) {
            return v;
        }
    }

    // 3. Fall back to space type's primary group
    if (spaceType && SPACE_TO_NRM_GROUP[spaceType]) {
        const { group, groupName } = SPACE_TO_NRM_GROUP[spaceType];
        return { code: `${group}A`, group, groupName, element: "General Finishes" };
    }

    return FALLBACK_RICS;
}

/**
 * Get the NRM group for a space type.
 */
export function getSpaceNrmGroup(
    spaceType: string,
): { group: number; groupName: string } {
    return SPACE_TO_NRM_GROUP[spaceType] ?? { group: 3, groupName: "Internal Finishes" };
}

/**
 * Format a RICS element code for display.
 * e.g., "3A — Wall Finishes"
 */
export function formatRicsLabel(rics: RicsElement): string {
    return `${rics.code} — ${rics.element}`;
}
