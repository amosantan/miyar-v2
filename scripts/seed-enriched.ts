import 'dotenv/config';
import * as db from '../server/db';

async function main() {
    const now = new Date();

    console.log("🌱 Seeding Enriched Materials...");
    const ENRICHED_MATERIALS = [
        { name: "Statuario Marble Natural", category: "stone" as const, tier: "ultra_luxury" as const, typicalCostLow: "3200.00", typicalCostHigh: "4500.00", costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "long" as const, supplierName: "Sanipex / Arifeen", notes: "Premium natural Statuario marble with distinct veining" },
        { name: "Calacatta Oro Natural", category: "stone" as const, tier: "luxury" as const, typicalCostLow: "675.00", typicalCostHigh: "950.00", costUnit: "AED/sqm", leadTimeDays: 75, leadTimeBand: "long" as const, supplierName: "Sanipex", notes: "Classic Italian Calacatta Oro marble" },
        { name: "Calacatta Gold Porcelain Big Slab", category: "tile" as const, tier: "premium" as const, typicalCostLow: "550.00", typicalCostHigh: "825.00", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "short" as const, supplierName: "Tile King", notes: "160x320 cm format, 12mm thickness" },
        { name: "Statuario Porcelain 120x120", category: "tile" as const, tier: "mid" as const, typicalCostLow: "90.00", typicalCostHigh: "130.00", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short" as const, supplierName: "Tilesman", notes: "High-quality marble-look porcelain" },
        { name: "European Oak Herringbone", category: "wood" as const, tier: "premium" as const, typicalCostLow: "315.00", typicalCostHigh: "450.00", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium" as const, supplierName: "Floors Dubai", notes: "Natural oak in herringbone pattern" },
        { name: "American Walnut Herringbone", category: "wood" as const, tier: "luxury" as const, typicalCostLow: "380.00", typicalCostHigh: "550.00", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "medium" as const, supplierName: "Floors Dubai", notes: "Premium walnut in herringbone pattern" },
        { name: "Jotun Fenomastic Wonderwall", category: "paint" as const, tier: "mid" as const, typicalCostLow: "75.00", typicalCostHigh: "85.00", costUnit: "AED/L", leadTimeDays: 2, leadTimeBand: "short" as const, supplierName: "Jotun / ACE", notes: "Durable interior paint with smooth finish" },
        { name: "RAK Bianco Vena High Glossy", category: "tile" as const, tier: "mid" as const, typicalCostLow: "45.00", typicalCostHigh: "65.00", costUnit: "AED/sqm", leadTimeDays: 7, leadTimeBand: "short" as const, supplierName: "RAK Ceramics", notes: "40x80 cm glossy porcelain tile" },
    ];

    for (const mat of ENRICHED_MATERIALS) {
        try {
            await db.createMaterial({
                ...mat,
                regionAvailability: ["UAE", "GCC"],
                isActive: true,
            });
            console.log(`  ✅ Seeded Material: ${mat.name}`);
        } catch (e) {
            console.error(`  ❌ Failed to seed Material ${mat.name}:`, e);
        }
    }

    console.log("\n🌱 Seeding Enriched Evidence...");
    const ENRICHED_EVIDENCE = [
        { recordId: "MYR-EV-2024-001", category: "floors" as const, itemName: "Statuario A Slab 12mm", specClass: "Natural Stone", priceMin: "620.00", priceTypical: "880.00", priceMax: "1200.00", unit: "sqm", publisher: "Sanipex Group", reliabilityGrade: "A" as const, confidenceScore: 90, sourceUrl: "https://www.sanipexgroup.com", title: "Sanipex Statuario Pricing 2024" },
        { recordId: "MYR-EV-2024-002", category: "floors" as const, itemName: "Oak Distressed Engineered", specClass: "Engineered Wood", priceMin: "185.00", priceTypical: "275.00", priceMax: "350.00", unit: "sqm", publisher: "Floors Dubai", reliabilityGrade: "A" as const, confidenceScore: 85, sourceUrl: "https://www.floorsdubai.com", title: "Floors Dubai Oak Specials" },
        { recordId: "MYR-EV-2024-003", category: "floors" as const, itemName: "RAK 30x60 Bianco Vena", specClass: "Porcelain", priceMin: "22.50", priceTypical: "29.00", priceMax: "45.00", unit: "sqm", publisher: "Plaza Middle East", reliabilityGrade: "A" as const, confidenceScore: 95, sourceUrl: "https://plazamiddleeast.com", title: "RAK Ceramics Price List" },
        { recordId: "MYR-EV-2024-004", category: "floors" as const, itemName: "American Walnut 3-Strip", specClass: "Engineered Wood", priceMin: "172.00", priceTypical: "295.00", priceMax: "400.00", unit: "sqm", publisher: "Floors Dubai", reliabilityGrade: "A" as const, confidenceScore: 88, sourceUrl: "https://www.floorsdubai.com", title: "Walnut Flooring Benchmarks" },
        { recordId: "MYR-EV-2024-005", category: "walls" as const, itemName: "Jotun Fenomastic White 4L", specClass: "Paint", priceMin: "150.00", priceTypical: "190.00", priceMax: "220.00", unit: "unit", publisher: "Noon / Jotun", reliabilityGrade: "A" as const, confidenceScore: 92, sourceUrl: "https://www.noon.com", title: "Jotun Retail Pricing" },
    ];

    for (const ev of ENRICHED_EVIDENCE) {
        try {
            await db.createEvidenceRecord({
                ...ev,
                captureDate: now,
                currencyOriginal: "AED",
                evidencePhase: "concept",
                createdBy: 1, // Defaulting to 1 for system/admin
            });
            console.log(`  ✅ Seeded Evidence: ${ev.recordId}`);
        } catch (e) {
            console.error(`  ❌ Failed to seed Evidence ${ev.recordId}:`, e);
        }
    }

    console.log("\n✅ Seeding complete.");
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
