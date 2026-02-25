/**
 * MIYAR V4 — Dynamic Pricing Engine
 *
 * Bridges the Market Intelligence Layer (V2) with the Design Translation Layer (V3).
 * Provides two core capabilities:
 *   1. getLiveCategoryPricing — retrieves approved benchmark P25/P50/P75 prices per category & finish level
 *   2. syncMaterialsWithBenchmarks — bulk-updates the materials catalog pricing from approved benchmarks
 */

import * as db from "../db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CategoryPricing {
    category: string;
    finishLevel: string;
    unit: string;
    p25: number;
    p50: number; // Typical / median
    p75: number;
    weightedMean: number;
}

export interface SyncResult {
    updatedCount: number;
    matchedCount: number;
    skippedCount: number;
}

// ─── Category Mapping ───────────────────────────────────────────────────────
// Maps material catalog categories → evidence record categories used in benchmarks
const MATERIAL_TO_EVIDENCE_CATEGORY: Record<string, string> = {
    tile: "floors",
    stone: "floors",
    wood: "floors",
    metal: "joinery",
    fabric: "ffe",
    glass: "joinery",
    paint: "walls",
    wallpaper: "walls",
    lighting: "lighting",
    furniture: "ffe",
    fixture: "sanitary",
    accessory: "ffe",
    other: "other",
};

// Maps material catalog tiers → evidence record finish levels
const TIER_TO_FINISH: Record<string, string> = {
    economy: "basic",
    mid: "standard",
    premium: "premium",
    luxury: "luxury",
    ultra_luxury: "ultra_luxury",
};

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Retrieves approved benchmark proposals and indexes them by category for a given finish level.
 *
 * @param finishLevel Target finish level (basic | standard | premium | luxury | ultra_luxury)
 * @returns Record keyed by evidence category (e.g. "floors", "walls") with pricing data
 */
export async function getLiveCategoryPricing(
    finishLevel: string
): Promise<Record<string, CategoryPricing>> {
    const normalizedFinish = finishLevel.toLowerCase();

    // Use the existing db function to retrieve all approved proposals
    const allApproved = await db.listBenchmarkProposals("approved");

    const pricingDict: Record<string, CategoryPricing> = {};

    for (const proposal of allApproved) {
        // benchmarkKey format: "category:finishLevel:unit"
        const parts = proposal.benchmarkKey.split(":");
        if (parts.length < 3) continue;

        const [cat, finish, unit] = parts;

        if (finish === normalizedFinish) {
            pricingDict[cat] = {
                category: cat,
                finishLevel: finish,
                unit,
                p25: Number(proposal.proposedP25) || 0,
                p50: Number(proposal.proposedP50) || 0,
                p75: Number(proposal.proposedP75) || 0,
                weightedMean: Number(proposal.weightedMean) || 0,
            };
        }
    }

    return pricingDict;
}

/**
 * Synchronizes the materials catalog pricing limits (typicalCostLow, typicalCostHigh)
 * using the currently approved benchmark proposals.
 *
 * For each active material, we look up the corresponding evidence category and finish level,
 * find a matching approved benchmark, and update the material's cost range.
 */
export async function syncMaterialsWithBenchmarks(): Promise<SyncResult> {
    // Fetch all approved benchmarks
    const allApproved = await db.listBenchmarkProposals("approved");

    // Fetch all active material catalog items
    const materials = await db.getAllMaterials();

    let updatedCount = 0;
    let matchedCount = 0;
    let skippedCount = 0;

    for (const material of materials) {
        const evidenceCat = MATERIAL_TO_EVIDENCE_CATEGORY[material.category] || "other";
        const targetFinishLevel = TIER_TO_FINISH[material.tier] || "standard";
        const searchPrefix = `${evidenceCat}:${targetFinishLevel}:`;

        // Find the matching approved benchmark proposal
        const matchedProposal = allApproved.find(
            (p: { benchmarkKey: string }) => p.benchmarkKey.startsWith(searchPrefix)
        );

        if (!matchedProposal) {
            skippedCount++;
            continue;
        }

        matchedCount++;

        const newLow = Number(matchedProposal.proposedP25);
        const newHigh = Number(matchedProposal.proposedP75);

        // Only update if prices have actually changed
        if (
            Number(material.typicalCostLow) !== newLow ||
            Number(material.typicalCostHigh) !== newHigh
        ) {
            await db.updateMaterial(material.id, {
                typicalCostLow: newLow.toFixed(2),
                typicalCostHigh: newHigh.toFixed(2),
            });
            updatedCount++;
        }
    }

    return { updatedCount, matchedCount, skippedCount };
}
