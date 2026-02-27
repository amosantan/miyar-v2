/**
 * MIYAR — Synthetic Benchmark Generator (Phase C.3)
 *
 * Fills remaining gaps in benchmark_data by interpolating from
 * nearest-neighbor real/curated benchmarks.
 *
 * ALL generated rows are labeled sourceType: "synthetic" with
 * a sourceNote explaining the interpolation method.
 *
 * This runs AFTER the benchmark seeder (C.2) — it only fills
 * combos that have zero coverage.
 */

import * as db from "../db";

const TYPOLOGIES = [
    "Residential", "Mixed-use", "Hospitality", "Office",
    "Villa", "Gated Community", "Villa Development",
];

const LOCATIONS = ["Prime", "Secondary", "Emerging"];
const TIERS = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];
const MATERIAL_LEVELS = [1, 2, 3, 4, 5];
const ROOM_TYPES = ["General", "Living", "Kitchen", "Bathroom", "Bedroom", "Lobby"];

// Tier adjacency for interpolation
const TIER_ORDER = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];

interface SyntheticResult {
    generated: number;
    gapsBefore: number;
    totalCombos: number;
}

/**
 * Find nearest real benchmark for interpolation.
 * Searches: same tier+typology, same tier, any.
 */
function findNearest(
    existing: Map<string, any>,
    typology: string,
    location: string,
    tier: string,
    materialLevel: number,
    roomType: string,
): any | null {
    // 1. Same typology, same tier, different location
    for (const loc of LOCATIONS) {
        const key = `${typology}|${loc}|${tier}|${materialLevel}|${roomType}`;
        if (existing.has(key)) return existing.get(key);
    }

    // 2. Same tier, same location, different typology
    for (const typ of TYPOLOGIES) {
        const key = `${typ}|${location}|${tier}|${materialLevel}|${roomType}`;
        if (existing.has(key)) return existing.get(key);
    }

    // 3. Adjacent tier, same typology+location
    const tierIdx = TIER_ORDER.indexOf(tier);
    for (const offset of [1, -1, 2, -2]) {
        const adjIdx = tierIdx + offset;
        if (adjIdx >= 0 && adjIdx < TIER_ORDER.length) {
            const adjTier = TIER_ORDER[adjIdx];
            const key = `${typology}|${location}|${adjTier}|${materialLevel}|${roomType}`;
            if (existing.has(key)) {
                // Apply tier scaling
                const tierScale = (tierIdx + 1) / (adjIdx + 1);
                const neighbor = existing.get(key);
                return {
                    ...neighbor,
                    _scaled: true,
                    _tierScale: tierScale,
                };
            }
        }
    }

    // 4. Same tier, General room type
    if (roomType !== "General") {
        const key = `${typology}|${location}|${tier}|${materialLevel}|General`;
        if (existing.has(key)) return existing.get(key);
    }

    return null;
}

export async function generateSyntheticBenchmarks(): Promise<SyntheticResult> {
    const allBenchmarks = await db.getAllBenchmarkData();

    // Build lookup map
    const existingMap = new Map<string, any>();
    for (const b of allBenchmarks) {
        const key = `${b.typology}|${b.location}|${b.marketTier}|${b.materialLevel}|${b.roomType || "General"}`;
        existingMap.set(key, b);
    }

    const totalCombos = TYPOLOGIES.length * LOCATIONS.length * TIERS.length * MATERIAL_LEVELS.length * ROOM_TYPES.length;

    // Find gaps
    const gaps: Array<{ typology: string; location: string; tier: string; materialLevel: number; roomType: string }> = [];

    for (const typology of TYPOLOGIES) {
        for (const location of LOCATIONS) {
            for (const tier of TIERS) {
                for (const materialLevel of MATERIAL_LEVELS) {
                    for (const roomType of ROOM_TYPES) {
                        const key = `${typology}|${location}|${tier}|${materialLevel}|${roomType}`;
                        if (!existingMap.has(key)) {
                            gaps.push({ typology, location, tier, materialLevel, roomType });
                        }
                    }
                }
            }
        }
    }

    const gapsBefore = gaps.length;
    let generated = 0;

    for (const gap of gaps) {
        const neighbor = findNearest(existingMap, gap.typology, gap.location, gap.tier, gap.materialLevel, gap.roomType);

        if (!neighbor) {
            console.warn(`[Synthetic] No neighbor found for ${gap.typology}|${gap.location}|${gap.tier}|${gap.materialLevel}|${gap.roomType}`);
            continue;
        }

        const scale = neighbor._tierScale || 1.0;
        const low = Math.round(Number(neighbor.costPerSqftLow || 0) * scale);
        const mid = Math.round(Number(neighbor.costPerSqftMid || 0) * scale);
        const high = Math.round(Number(neighbor.costPerSqftHigh || 0) * scale);

        if (mid <= 0) continue; // Skip if source has no valid data

        const sourceNote = neighbor._scaled
            ? `Synthetic: interpolated from ${neighbor.typology}/${neighbor.location}/${neighbor.marketTier} (tier-scaled ×${scale.toFixed(2)})`
            : `Synthetic: interpolated from ${neighbor.typology}/${neighbor.location}/${neighbor.marketTier}/L${neighbor.materialLevel}/${neighbor.roomType || "General"}`;

        await db.createBenchmark({
            typology: gap.typology,
            location: gap.location,
            marketTier: gap.tier,
            materialLevel: gap.materialLevel,
            roomType: gap.roomType,
            costPerSqftLow: String(low) as any,
            costPerSqftMid: String(mid) as any,
            costPerSqftHigh: String(high) as any,
            sourceType: "synthetic" as any,
            sourceNote,
            dataYear: 2025,
            region: "UAE",
        });

        generated++;
    }

    console.log(`[Synthetic] Done: ${generated} generated from ${gapsBefore} gaps (${totalCombos} total combos)`);
    return { generated, gapsBefore, totalCombos };
}
