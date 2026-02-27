/**
 * Sustainability Certification Multipliers
 *
 * Provides cost multipliers based on sustainability certification tier.
 * Research-backed premiums from verified UAE market sources (Feb 2026).
 *
 * Dubai → Al Sa'fat (Bronze/Silver/Gold/Platinum)
 * Abu Dhabi → Estidama Pearl (Pearl 1–5)
 */

// ─── Tier → Multiplier Mapping ──────────────────────────────────────────────

export const CERT_MULTIPLIERS: Record<string, number> = {
    // Al Sa'fat (Dubai)
    bronze: 1.03,
    silver: 1.07,
    gold: 1.12,
    platinum: 1.22,
    // Estidama (Abu Dhabi)
    pearl_1: 1.03,
    pearl_2: 1.07,
    pearl_3: 1.12,
    pearl_4: 1.16,
    pearl_5: 1.22,
};

// ─── Tier → des05Sustainability Mapping ─────────────────────────────────────

export const CERT_TO_DES05: Record<string, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 5,
    pearl_1: 1,
    pearl_2: 2,
    pearl_3: 3,
    pearl_4: 4,
    pearl_5: 5,
};

// ─── City → Available Tiers ─────────────────────────────────────────────────

export const CITY_TIERS: Record<string, { value: string; label: string; mandatory?: boolean; premium: string }[]> = {
    Dubai: [
        { value: "bronze", label: "Bronze", premium: "+3%" },
        { value: "silver", label: "Silver", mandatory: true, premium: "+7%" },
        { value: "gold", label: "Gold", premium: "+12%" },
        { value: "platinum", label: "Platinum", premium: "+22%" },
    ],
    "Abu Dhabi": [
        { value: "pearl_1", label: "Pearl 1", mandatory: true, premium: "+3%" },
        { value: "pearl_2", label: "Pearl 2", premium: "+7%" },
        { value: "pearl_3", label: "Pearl 3", premium: "+12%" },
        { value: "pearl_4", label: "Pearl 4", premium: "+16%" },
        { value: "pearl_5", label: "Pearl 5", premium: "+22%" },
    ],
};

// ─── Default Tier by City ───────────────────────────────────────────────────

export const DEFAULT_TIER: Record<string, string> = {
    Dubai: "silver",
    "Abu Dhabi": "pearl_1",
};

// ─── Public API ─────────────────────────────────────────────────────────────

/** Get cost multiplier for a certification tier */
export function getCertMultiplier(tier: string): number {
    return CERT_MULTIPLIERS[tier] || 1.0;
}

/** Get human-readable label for a certification target */
export function getCertLabel(city: string, tier: string): string {
    const tiers = CITY_TIERS[city];
    if (!tiers) return tier;
    const found = tiers.find(t => t.value === tier);
    return found ? found.label : tier;
}

/** Get certification system name for a city */
export function getCertSystem(city: string): string {
    return city === "Abu Dhabi" ? "Estidama Pearl" : "Al Sa'fat";
}

/** Derive des05Sustainability from certification tier */
export function tierToDes05(tier: string): number {
    return CERT_TO_DES05[tier] || 2;
}

/** Get the minimum mandatory tier for a city */
export function getMandatoryTier(city: string): string {
    return DEFAULT_TIER[city] || "silver";
}
