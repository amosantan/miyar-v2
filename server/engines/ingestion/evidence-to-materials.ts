/**
 * Evidence-to-Materials Sync
 * 
 * Post-ingestion step that converts Evidence Vault records into Materials Library entries.
 * Runs after each scrape to keep the Materials Library updated with live market data.
 */
import { getDb } from "../../db";
import { materialLibrary, evidenceRecords } from "../../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ─── Category Mapping ────────────────────────────────────────────
// Evidence categories → Material Library categories
const EVIDENCE_TO_MATERIAL_CATEGORY: Record<string, string> = {
    floors: "flooring",
    walls: "wall_tile",       // most wall evidence is tile/finish
    ceilings: "ceiling",
    joinery: "joinery",
    lighting: "lighting",
    sanitary: "sanitaryware",
    kitchen: "fittings",      // kitchen fittings
    hardware: "hardware",
    ffe: "specialty",         // FF&E → specialty
    other: "specialty",
};

// ─── Tier Detection ──────────────────────────────────────────────
// Determines price tier from AED price range
function detectTier(priceMin: number | null, priceMax: number | null, unit: string): "affordable" | "mid" | "premium" | "ultra" {
    const price = priceMax || priceMin || 0;

    // Per-sqm pricing (tiles, flooring, paint)
    if (unit === "sqm" || unit === "m²" || unit === "sqft" || unit === "L") {
        if (price < 40) return "affordable";
        if (price < 150) return "mid";
        if (price < 400) return "premium";
        return "ultra";
    }

    // Per-unit pricing (sanitaryware, fixtures)
    if (price < 300) return "affordable";
    if (price < 1500) return "mid";
    if (price < 5000) return "premium";
    return "ultra";
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

    // Get all existing material library entries for deduplication
    const existingMaterials = await db.select().from(materialLibrary);
    const existingNames = new Set(
        existingMaterials.map((m) => normalizeProductName(m.productName))
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

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
            const maxPrice = Math.max(
                record.priceMin ? parseFloat(String(record.priceMin)) : 0,
                record.priceMax ? parseFloat(String(record.priceMax)) : 0,
                record.priceTypical ? parseFloat(String(record.priceTypical)) : 0,
            );
            if (maxPrice > 99_999_99) { // >10M AED is not a material price
                skipped++;
                continue;
            }

            // Map category
            const materialCategory = EVIDENCE_TO_MATERIAL_CATEGORY[record.category] || "specialty";

            // Check if valid enum value
            const validCategories = ["flooring", "wall_paint", "wall_tile", "ceiling", "joinery", "sanitaryware", "fittings", "lighting", "hardware", "specialty"];
            if (!validCategories.includes(materialCategory)) {
                skipped++;
                continue;
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
            const existingMatch = existingMaterials.find(
                (m) => normalizeProductName(m.productName) === normalizedName
            );

            if (existingMatch) {
                // Update prices if we have better data
                const existingMin = existingMatch.priceAedMin ? parseFloat(String(existingMatch.priceAedMin)) : null;
                const existingMax = existingMatch.priceAedMax ? parseFloat(String(existingMatch.priceAedMax)) : null;

                const effectiveMin = priceMin || priceTypical;
                const effectiveMax = priceMax || priceTypical;

                // Only update if the evidence data has newer/different prices
                if (effectiveMin && effectiveMax && (effectiveMin !== existingMin || effectiveMax !== existingMax)) {
                    await db
                        .update(materialLibrary)
                        .set({
                            priceAedMin: effectiveMin ? String(effectiveMin) : null,
                            priceAedMax: effectiveMax ? String(effectiveMax) : null,
                            notes: `Last updated from market data: ${new Date().toISOString().split("T")[0]}. Source: ${record.publisher || record.sourceUrl}`,
                        })
                        .where(eq(materialLibrary.id, existingMatch.id));
                    updated++;
                } else {
                    skipped++;
                }
            } else if (!existingNames.has(normalizedName)) {
                // Create new material entry
                const effectiveMin = priceMin || priceTypical;
                const effectiveMax = priceMax || priceTypical;
                const brand = record.publisher || "Market Data";

                await db.insert(materialLibrary).values({
                    category: materialCategory as any,
                    tier: tier as any,
                    style: "all" as any,
                    productCode: `MKT-${record.id}`,
                    productName: record.itemName.substring(0, 300),
                    brand: brand.substring(0, 150),
                    supplierName: (record.publisher || "Various UAE Suppliers").substring(0, 200),
                    unitLabel: (record.unit || "sqm").substring(0, 30),
                    priceAedMin: effectiveMin ? String(effectiveMin) : null,
                    priceAedMax: effectiveMax ? String(effectiveMax) : null,
                    notes: `Auto-imported from evidence. Source: ${record.sourceUrl?.substring(0, 200)}`,
                    isActive: true,
                });

                existingNames.add(normalizedName);
                created++;
            } else {
                skipped++;
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
        .replace(/\s+/g, "")        // Remove whitespace
        .substring(0, 100);         // Cap length
}
