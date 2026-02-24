/**
 * Test: Verify source-type-specific extraction
 * Re-scrapes one developer + one supplier source to check prompt quality.
 */
import "dotenv/config";
import { getDb } from "../../../db";
import { sourceRegistry } from "../../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { DynamicConnector } from "../connectors/dynamic";
import { runSingleConnector } from "../orchestrator";

async function main() {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Find one developer_brochure source and one supplier_catalog source
    const allSources = await db
        .select()
        .from(sourceRegistry)
        .where(eq(sourceRegistry.isActive, true));

    const developer = allSources.find(s => s.sourceType === "developer_brochure");
    const supplier = allSources.find(s => s.sourceType === "supplier_catalog" || s.sourceType === "manufacturer_catalog");

    console.log("\n━━━ TEST: Source-Type-Specific Extraction ━━━\n");

    for (const source of [developer, supplier].filter(Boolean)) {
        if (!source) continue;

        console.log(`\n🔍 Testing: ${source.name} (${source.sourceType})`);
        console.log(`   URL: ${source.url}`);

        const connector = new DynamicConnector({
            id: source.id,
            name: source.name,
            url: source.url,
            sourceType: source.sourceType,
            region: source.region || "UAE",
            scrapeMethod: source.scrapeMethod,
            extractionHints: source.extractionHints || undefined,
            lastSuccessfulFetch: source.lastSuccessfulFetch,
            requestDelayMs: source.requestDelayMs,
            scrapeConfig: source.scrapeConfig as any,
        });

        try {
            const report = await runSingleConnector(connector, "manual");
            console.log(`\n   📊 Results:`);
            console.log(`     Status: ${report.status}`);
            console.log(`     Extracted: ${report.evidenceExtracted}`);
            console.log(`     Created: ${report.evidenceCreated}`);
            console.log(`     Skipped: ${report.evidenceSkipped}`);
            if (report.error) console.log(`     Error: ${report.error}`);
        } catch (err: any) {
            console.error(`   ❌ Failed: ${err.message}`);
        }
    }

    // Now check what we got in the DB for these latest records
    console.log("\n━━━ LATEST EVIDENCE RECORDS (checking new fields) ━━━\n");

    const { evidenceRecords } = await import("../../../../drizzle/schema");
    const { desc } = await import("drizzle-orm");

    const latest = await db
        .select()
        .from(evidenceRecords)
        .orderBy(desc(evidenceRecords.createdAt))
        .limit(15);

    for (const rec of latest) {
        console.log(`  [${rec.publisher}] ${rec.itemName}`);
        console.log(`    Category: ${rec.category} | Intel Type: ${rec.intelligenceType || "?"}`);
        if (rec.finishLevel) console.log(`    Finish Level: ${rec.finishLevel}`);
        if (rec.designStyle) console.log(`    Design Style: ${rec.designStyle}`);
        if (rec.brandsMentioned) console.log(`    Brands: ${JSON.stringify(rec.brandsMentioned)}`);
        if (rec.materialSpec) console.log(`    Material Spec: ${rec.materialSpec}`);
        if (rec.priceMin || rec.priceMax) console.log(`    Price: ${rec.priceMin}-${rec.priceMax} ${rec.unit}`);
        console.log("");
    }
}

main()
    .then(() => { process.exit(0); })
    .catch((err) => { console.error("Failed:", err); process.exit(1); });
