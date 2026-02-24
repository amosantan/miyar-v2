/**
 * Audit: What's actually in the evidence records?
 * Usage: npx tsx server/engines/ingestion/seeds/audit-evidence.ts
 */
import "dotenv/config";
import { getDb } from "../../../db";
import { evidenceRecords } from "../../../../drizzle/schema";
import { desc, sql } from "drizzle-orm";

async function main() {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // 1. Overview by publisher + category
    console.log("\n━━━ EVIDENCE BY PUBLISHER & CATEGORY ━━━");
    const byCat = await db.select({
        publisher: evidenceRecords.publisher,
        category: evidenceRecords.category,
        count: sql<number>`COUNT(*)`,
        avgPrice: sql<string>`ROUND(AVG(CAST(priceTypical AS DECIMAL)), 0)`,
        units: sql<string>`GROUP_CONCAT(DISTINCT unit)`,
    })
        .from(evidenceRecords)
        .groupBy(evidenceRecords.publisher, evidenceRecords.category)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(30);

    for (const row of byCat) {
        console.log(`  ${(row.publisher || "unknown").padEnd(30)} ${row.category.padEnd(12)} ${String(row.count).padStart(4)} records  avg: ${row.avgPrice || "?"} ${row.units}`);
    }

    // 2. Sample items from developer sources
    console.log("\n━━━ DEVELOPER SOURCE SAMPLES ━━━");
    const devSamples = await db.select({
        id: evidenceRecords.id,
        itemName: evidenceRecords.itemName,
        category: evidenceRecords.category,
        priceMin: evidenceRecords.priceMin,
        priceMax: evidenceRecords.priceMax,
        unit: evidenceRecords.unit,
        publisher: evidenceRecords.publisher,
        snippet: sql<string>`LEFT(extractedSnippet, 200)`,
    })
        .from(evidenceRecords)
        .where(sql`publisher LIKE '%DAMAC%' OR publisher LIKE '%Emaar%' OR publisher LIKE '%Nakheel%' OR publisher LIKE '%Meraas%' OR publisher LIKE '%Danube%' OR publisher LIKE '%Sobha%' OR publisher LIKE '%Aldar%' OR publisher LIKE '%Dubai Properties%'`)
        .orderBy(desc(evidenceRecords.createdAt))
        .limit(40);

    for (const row of devSamples) {
        console.log(`\n  [${row.publisher}] ${row.itemName}`);
        console.log(`    Category: ${row.category} | Price: ${row.priceMin}-${row.priceMax} ${row.unit}`);
        if (row.snippet) console.log(`    Snippet: ${row.snippet.substring(0, 150)}...`);
    }

    // 3. Sample items from material suppliers
    console.log("\n━━━ MATERIAL SUPPLIER SAMPLES ━━━");
    const matSamples = await db.select({
        id: evidenceRecords.id,
        itemName: evidenceRecords.itemName,
        category: evidenceRecords.category,
        priceMin: evidenceRecords.priceMin,
        priceMax: evidenceRecords.priceMax,
        unit: evidenceRecords.unit,
        publisher: evidenceRecords.publisher,
        snippet: sql<string>`LEFT(extractedSnippet, 200)`,
    })
        .from(evidenceRecords)
        .where(sql`publisher LIKE '%Graniti%' OR publisher LIKE '%Porcelanosa%' OR publisher LIKE '%RAK%' OR publisher LIKE '%Grohe%' OR publisher LIKE '%Hafele%' OR publisher LIKE '%IKEA%' OR publisher LIKE '%Home Centre%'`)
        .orderBy(desc(evidenceRecords.createdAt))
        .limit(30);

    for (const row of matSamples) {
        console.log(`\n  [${row.publisher}] ${row.itemName}`);
        console.log(`    Category: ${row.category} | Price: ${row.priceMin}-${row.priceMax} ${row.unit}`);
    }

    // 4. Total counts
    const totalResult = await db.select({
        totalRecords: sql<number>`COUNT(*)`,
        distinctPublishers: sql<number>`COUNT(DISTINCT publisher)`,
        distinctCategories: sql<number>`COUNT(DISTINCT category)`,
    }).from(evidenceRecords);

    console.log("\n━━━ TOTALS ━━━");
    console.log(`  Total evidence records: ${totalResult[0].totalRecords}`);
    console.log(`  Distinct publishers: ${totalResult[0].distinctPublishers}`);
    console.log(`  Distinct categories: ${totalResult[0].distinctCategories}`);
}

main()
    .then(() => { process.exit(0); })
    .catch((err) => { console.error("Failed:", err); process.exit(1); });
