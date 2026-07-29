/**
 * MIYAR V4 — Browse-only Catalog Estimate Engine
 *
 * Bridges the Market Intelligence Layer (V2) with the Design Translation Layer (V3).
 * Provides two core capabilities:
 * These estimates support catalog browsing/admin maintenance only. They are
 * never authoritative material prices and cannot feed calculations or issued
 * artifacts.
 */

import * as db from "../db";
import { catalogTierToFinish } from "./tier-policy";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CategoryPricing {
    authority: "browse_only_estimate";
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

// ADR-0009: catalog-tier → finish-level mapping is owned by the versioned
// tier policy (material-tier-policy-v1, values unchanged).

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Retrieves approved benchmark proposals and indexes them by category for a given finish level.
 *
 * @param finishLevel Target finish level (basic | standard | premium | luxury | ultra_luxury)
 * @returns Record keyed by evidence category (e.g. "floors", "walls") with pricing data
 */
export async function getBrowseOnlyCategoryEstimates(
    finishLevel: string
): Promise<Record<string, CategoryPricing>> {
    const normalizedFinish = finishLevel.toLowerCase();

    // Use the existing db function to retrieve all approved proposals
    const allApproved = await db.listBenchmarkProposals("approved");

    const pricingDict: Record<string, CategoryPricing> = {};

    // ADR-0009: when several approved proposals share a category at the target
    // finish (different units), select deterministically — prefer sqm, then
    // sqft, then the lexicographically smallest unit — instead of letting the
    // iteration order's last write win.
    const unitPreference = (unit: string): number =>
        unit === "sqm" ? 0 : unit === "sqft" ? 1 : 2;

    for (const proposal of allApproved) {
        // benchmarkKey format: "category:finishLevel:unit"
        const parts = proposal.benchmarkKey.split(":");
        if (parts.length < 3) continue;

        const [cat, finish, unit] = parts;
        if (finish !== normalizedFinish) continue;

        const existing = pricingDict[cat];
        if (existing) {
            const keepExisting =
                unitPreference(existing.unit) < unitPreference(unit) ||
                (unitPreference(existing.unit) === unitPreference(unit) &&
                    existing.unit <= unit);
            if (keepExisting) continue;
        }
        const p25 = Number(proposal.proposedP25);
        const p50 = Number(proposal.proposedP50);
        const p75 = Number(proposal.proposedP75);
        const weightedMean = Number(proposal.weightedMean);
        if (
            ![p25, p50, p75, weightedMean].every(value =>
                Number.isFinite(value) && value > 0
            ) ||
            p25 > p50 ||
            p50 > p75
        ) {
            continue;
        }
        pricingDict[cat] = {
            authority: "browse_only_estimate",
            category: cat,
            finishLevel: finish,
            unit,
            p25,
            p50,
            p75,
            weightedMean,
        };
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
export async function syncBrowseOnlyCatalogEstimates(): Promise<SyncResult> {
    // Fetch all active material catalog items
    const materials = await db.getAllMaterials();

    let updatedCount = 0;
    let matchedCount = 0;
    let skippedCount = 0;
    const estimateCache = new Map<string, Record<string, CategoryPricing>>();

    for (const material of materials) {
        const evidenceCat = MATERIAL_TO_EVIDENCE_CATEGORY[material.category] || "other";
        const targetFinishLevel = catalogTierToFinish(material.tier);
        let estimates = estimateCache.get(targetFinishLevel);
        if (!estimates) {
            estimates = await getBrowseOnlyCategoryEstimates(targetFinishLevel);
            estimateCache.set(targetFinishLevel, estimates);
        }
        const estimate = estimates[evidenceCat];
        if (!estimate) {
            skippedCount++;
            continue;
        }

        matchedCount++;

        const newLow = estimate.p25;
        const newHigh = estimate.p75;

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
