/**
 * MIYAR V4 — Area Utilities
 * Central utility for fit-out area calculations.
 * All pricing, scoring, and analytics engines should use these functions
 * instead of directly accessing ctx03Gfa.
 */
import type { ProjectInputs } from "../../shared/miyar-types";

/**
 * Get the area to use for pricing calculations.
 * Prefers totalFitoutArea (verified interior finish area) over ctx03Gfa (gross floor area).
 * This ensures pricing excludes structural voids, risers, and non-finish areas.
 */
export function getPricingArea(inputs: ProjectInputs): number {
    return inputs.totalFitoutArea ?? inputs.ctx03Gfa ?? 0;
}

/**
 * Get the structural gross floor area (GFA).
 * Used for scale classification, portfolio metrics, and property-level comparisons.
 */
export function getStructuralArea(inputs: ProjectInputs): number {
    return inputs.ctx03Gfa ?? 0;
}

/**
 * Compute fitout ratio = fitout area / GFA.
 * Typical ranges by typology:
 *   Residential towers: 70-80%
 *   Offices: 65-75%
 *   Villas: 85-95%
 *   Hospitality: 55-70%
 */
export function computeFitoutRatio(
    fitoutArea: number | null,
    gfa: number | null
): number {
    if (!fitoutArea || !gfa || gfa <= 0) return 1; // default 100% if unknown
    return fitoutArea / gfa;
}

/**
 * Standard non-finish area classifications.
 * Used to determine which areas are excluded from fitout calculations.
 */
export const NON_FINISH_AREAS = {
    /** Always excluded from fitout area — structural voids */
    ALWAYS_EXCLUDED: [
        "Elevator shafts",
        "Stairwells",
        "Risers & service ducts",
        "Structural columns",
        "Plant rooms",
        "MEP rooms",
        "Fire escape routes",
        "Transformer rooms",
    ],
    /** Conditionally included based on project scope */
    CONDITIONAL: [
        "Storage rooms", // Finish only if walk-in closet
        "Parking areas", // Finish only if show garage
        "Roof terraces", // Finish if covered/enclosed
        "Utility rooms", // May have basic finishes
        "Staff quarters", // Lower spec but still fitout
    ],
    /** Always included in fitout area */
    ALWAYS_INCLUDED: [
        "All habitable rooms",
        "Corridors & circulation",
        "Bathrooms & en-suites",
        "Kitchens",
        "Balconies (enclosed)",
        "Reception & lobby",
        "Dining areas",
        "Living areas",
        "Bedrooms",
        "Majlis",
        "Home offices",
    ],
} as const;

/** Benchmark fitout efficiency ratios by archetype */
export const ARCHETYPE_EFFICIENCY: Record<string, { low: number; mid: number; high: number }> = {
    residential_multi: { low: 0.70, mid: 0.75, high: 0.80 },
    office: { low: 0.65, mid: 0.70, high: 0.75 },
    single_villa: { low: 0.85, mid: 0.90, high: 0.95 },
    hospitality: { low: 0.55, mid: 0.62, high: 0.70 },
    community: { low: 0.72, mid: 0.78, high: 0.85 },
};

/**
 * Check if fitout ratio is within expected range for the given archetype.
 * Returns a warning message if outside range, null if OK.
 */
export function checkFitoutEfficiency(
    fitoutArea: number | null,
    gfa: number | null,
    archetype: string
): string | null {
    if (!fitoutArea || !gfa || gfa <= 0) return null;
    const ratio = fitoutArea / gfa;
    const benchmark = ARCHETYPE_EFFICIENCY[archetype];
    if (!benchmark) return null;

    if (ratio < benchmark.low) {
        return `Fitout ratio (${(ratio * 100).toFixed(1)}%) is below expected range for ${archetype} (${(benchmark.low * 100).toFixed(0)}-${(benchmark.high * 100).toFixed(0)}%). This may indicate excessive structural voids or incorrect GFA.`;
    }
    if (ratio > benchmark.high) {
        return `Fitout ratio (${(ratio * 100).toFixed(1)}%) exceeds expected range for ${archetype} (${(benchmark.low * 100).toFixed(0)}-${(benchmark.high * 100).toFixed(0)}%). Verify that GFA includes all structural areas.`;
    }
    return null;
}
