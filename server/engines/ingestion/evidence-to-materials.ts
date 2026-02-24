/**
 * Evidence-to-Materials Sync
 * 
 * Post-ingestion step that converts Evidence Vault records into Materials Catalog entries.
 * Runs after each scrape to keep the Materials Library updated with live market data.
 * 
 * Target table: materials_catalog (used by Materials Library page via db.getAllMaterials())
 */
import { getDb } from "../../db";
import { materialsCatalog, evidenceRecords } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Category Mapping ────────────────────────────────────────────
// Evidence categories → Materials Catalog categories
// materials_catalog enum: tile, stone, wood, metal, fabric, glass, paint, wallpaper, lighting, furniture, fixture, accessory, other
const EVIDENCE_TO_CATALOG_CATEGORY: Record<string, string> = {
    floors: "tile",          // most floor evidence is tile/stone
    walls: "tile",           // most wall evidence is tile/finish
    ceilings: "other",
    joinery: "wood",         // joinery is woodwork
    lighting: "lighting",
    sanitary: "fixture",     // sanitary = fixtures
    kitchen: "fixture",      // kitchen fittings
    hardware: "accessory",   // hardware = accessories
    ffe: "furniture",        // FF&E → furniture
    other: "other",
};

// ─── Tier Detection ──────────────────────────────────────────────
// materials_catalog enum: economy, mid, premium, luxury, ultra_luxury
function detectTier(priceMin: number | null, priceMax: number | null, unit: string): "economy" | "mid" | "premium" | "luxury" | "ultra_luxury" {
    const price = priceMax || priceMin || 0;

    // Per-sqm pricing (tiles, flooring, paint)
    if (unit === "sqm" || unit === "m²" || unit === "sqft" || unit === "L") {
        if (price < 40) return "economy";
        if (price < 150) return "mid";
        if (price < 400) return "premium";
        if (price < 800) return "luxury";
        return "ultra_luxury";
    }

    // Per-unit pricing (sanitaryware, fixtures)
    if (price < 300) return "economy";
    if (price < 1500) return "mid";
    if (price < 5000) return "premium";
    if (price < 15000) return "luxury";
    return "ultra_luxury";
}

// ─── Main Sync Function ─────────────────────────────────────────

export interface MaterialSyncResult {
    created: number;
    updated: number;
    skipped: number;
}

export async function syncEvidenceToMaterials(
    runId?: string,
    limit: number = 500,
): Promise<MaterialSyncResult> {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Fetch recent evidence records (from this run or most recent)
    let evidence;
    if (runId) {
        evidence = await db
            .select()
            .from(evidenceRecords)
            .where(eq(evidenceRecords.runId, runId))
            .limit(limit);
    } else {
        evidence = await db
            .select()
            .from(evidenceRecords)
            .orderBy(desc(evidenceRecords.createdAt))
            .limit(limit);
    }

    if (evidence.length === 0) {
        return { created: 0, updated: 0, skipped: 0 };
    }

    // Get all existing materials catalog entries for deduplication
    const existingMaterials = await db.select().from(materialsCatalog);
    const existingByName = new Map<string, typeof existingMaterials[0]>();
    for (const m of existingMaterials) {
        existingByName.set(normalizeProductName(m.name), m);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Valid categories for materials_catalog
    const validCategories = ["tile", "stone", "wood", "metal", "fabric", "glass", "paint", "wallpaper", "lighting", "furniture", "fixture", "accessory", "other"];

    for (const record of evidence) {
        try {
            // Skip records without useful data
            if (!record.itemName || record.itemName.length < 3) {
                skipped++;
                continue;
            }

            // Skip records without price data
            const hasPrice = record.priceMin || record.priceMax || record.priceTypical;
            if (!hasPrice) {
                skipped++;
                continue;
            }

            // Skip absurd prices (property values, not material costs)
            const maxRawPrice = Math.max(
                record.priceMin ? parseFloat(String(record.priceMin)) : 0,
                record.priceMax ? parseFloat(String(record.priceMax)) : 0,
                record.priceTypical ? parseFloat(String(record.priceTypical)) : 0,
            );
            if (maxRawPrice > 99_999_99) { // >10M AED is not a material price
                skipped++;
                continue;
            }

            // Map category — try to detect from name first
            let catalogCategory = EVIDENCE_TO_CATALOG_CATEGORY[record.category] || "other";
            const nameLower = record.itemName.toLowerCase();
            if (/marble|granite|travertine|onyx|limestone/.test(nameLower)) catalogCategory = "stone";
            else if (/tile|ceramic|porcelain/.test(nameLower)) catalogCategory = "tile";
            else if (/wood|oak|walnut|teak|parquet|veneer/.test(nameLower)) catalogCategory = "wood";
            else if (/metal|steel|iron|brass|copper|aluminum/.test(nameLower)) catalogCategory = "metal";
            else if (/glass|mirror/.test(nameLower)) catalogCategory = "glass";
            else if (/paint|coating/.test(nameLower)) catalogCategory = "paint";
            else if (/wallpaper/.test(nameLower)) catalogCategory = "wallpaper";
            else if (/fabric|textile|upholstery|linen/.test(nameLower)) catalogCategory = "fabric";
            else if (/light|lamp|chandelier|led/.test(nameLower)) catalogCategory = "lighting";
            else if (/furniture|sofa|chair|table|desk|cabinet/.test(nameLower)) catalogCategory = "furniture";
            else if (/faucet|mixer|tap|shower|toilet|basin|wc|sink/.test(nameLower)) catalogCategory = "fixture";

            if (!validCategories.includes(catalogCategory)) {
                catalogCategory = "other";
            }

            // Parse prices
            const priceMin = record.priceMin ? parseFloat(String(record.priceMin)) : null;
            const priceMax = record.priceMax ? parseFloat(String(record.priceMax)) : null;
            const priceTypical = record.priceTypical ? parseFloat(String(record.priceTypical)) : null;

            // Determine tier
            const tier = detectTier(priceMin, priceMax, record.unit);

            // Normalize the product name for dedup
            const normalizedName = normalizeProductName(record.itemName);

            // Check for existing match
            const existingMatch = existingByName.get(normalizedName);

            if (existingMatch) {
                // Update prices if we have better/newer data
                const existingLow = existingMatch.typicalCostLow ? parseFloat(String(existingMatch.typicalCostLow)) : null;
                const existingHigh = existingMatch.typicalCostHigh ? parseFloat(String(existingMatch.typicalCostHigh)) : null;

                const effectiveLow = priceMin || priceTypical;
                const effectiveHigh = priceMax || priceTypical;

                // Only update if the evidence data has different prices
                if (effectiveLow && effectiveHigh && (effectiveLow !== existingLow || effectiveHigh !== existingHigh)) {
                    await db
                        .update(materialsCatalog)
                        .set({
                            typicalCostLow: String(effectiveLow),
                            typicalCostHigh: String(effectiveHigh),
                            notes: `Updated from market data ${new Date().toISOString().split("T")[0]}. ${record.publisher || ""}`,
                        })
                        .where(eq(materialsCatalog.id, existingMatch.id));
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                // Create new material entry
                const effectiveLow = priceMin || priceTypical;
                const effectiveHigh = priceMax || priceTypical;
                const costUnit = record.unit === "sqm" || record.unit === "m²" ? "AED/sqm" : `AED/${record.unit || "unit"}`;

                await db.insert(materialsCatalog).values({
                    name: record.itemName.substring(0, 255),
                    category: catalogCategory as any,
                    tier: tier as any,
                    typicalCostLow: effectiveLow ? String(effectiveLow) : null,
                    typicalCostHigh: effectiveHigh ? String(effectiveHigh) : null,
                    costUnit,
                    supplierName: (record.publisher || "Market Data").substring(0, 255),
                    supplierUrl: record.sourceUrl?.substring(0, 500) || null,
                    regionAvailability: ["UAE"],
                    notes: `Auto-imported from evidence. Source: ${record.sourceUrl?.substring(0, 200) || "N/A"}`,
                    isActive: true,
                });

                existingByName.set(normalizedName, {} as any); // Track for dedup
                created++;
            }
        } catch (err) {
            // Log but don't fail the entire sync
            console.warn(`[MaterialSync] Error processing evidence ${record.id}: ${err instanceof Error ? err.message : String(err)}`);
            skipped++;
        }
    }

    return { created, updated, skipped };
}

// ─── Helpers ─────────────────────────────────────────────────────

function normalizeProductName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")  // Remove non-alphanumeric
        .substring(0, 100);         // Cap length
}
