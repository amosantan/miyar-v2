/**
 * Full local scrape — runs ALL sources with Firecrawl + higher page budgets.
 * No Vercel timeout limits, writes directly to production DB.
 * 
 * Usage: npx tsx server/engines/ingestion/seeds/run-full-scrape.ts
 */
import "dotenv/config";
import { getDb } from "../../../db";
import { sourceRegistry } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
    const db = await getDb();
    console.log("🕷️  MIYAR Full Local Scrape");
    console.log("━".repeat(60));

    // Check Firecrawl
    const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;
    console.log(`Firecrawl: ${hasFirecrawl ? "✅ Enabled" : "❌ Not set (basic fetch only)"}`);

    // Get all active sources
    const sources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.isActive, true));
    console.log(`Sources: ${sources.length} active\n`);

    // Temporarily increase crawl budget for local run
    const originalPageBudget = process.env.LOCAL_PAGE_BUDGET;
    process.env.LOCAL_PAGE_BUDGET = "8"; // Higher for local

    // Import the connectors and orchestrator
    const { DynamicConnector } = await import("../connectors/dynamic");
    const { runSingleConnector } = await import("../orchestrator");

    let totalRecords = 0;
    let totalFailed = 0;
    let sourceResults: Array<{ name: string; status: string; records: number; duration: string; error?: string }> = [];

    for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        const startTime = Date.now();
        console.log(`\n[${i + 1}/${sources.length}] 🔄 ${src.name}`);
        console.log(`   URL: ${src.url}`);

        try {
            const connector = new DynamicConnector({
                id: src.id,
                name: src.name,
                url: src.url,
                sourceType: src.sourceType || "other",
                region: src.region || "UAE",
                scrapeMethod: (src.scrapeConfig as any)?.method || "html_llm",
                extractionHints: (src.scrapeConfig as any)?.extractionHints || "",
                lastSuccessfulFetch: src.lastScrapedAt,
                requestDelayMs: (src.scrapeConfig as any)?.requestDelayMs,
                scrapeConfig: src.scrapeConfig,
            });

            const report = await runSingleConnector(connector, "manual");
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            const records = report.evidenceCreated || 0;
            totalRecords += records;

            console.log(`   ✅ ${records} records created in ${duration}s`);
            sourceResults.push({ name: src.name, status: "success", records, duration: `${duration}s` });
        } catch (err: any) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            const errMsg = err?.message || String(err);
            console.log(`   ❌ Failed in ${duration}s: ${errMsg.substring(0, 100)}`);
            totalFailed++;
            sourceResults.push({ name: src.name, status: "failed", records: 0, duration: `${duration}s`, error: errMsg.substring(0, 100) });
        }

        // Small delay between sources to be polite
        if (i < sources.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Summary
    console.log("\n" + "━".repeat(60));
    console.log("📊 SCRAPE COMPLETE");
    console.log("━".repeat(60));
    console.log(`Total sources:  ${sources.length}`);
    console.log(`Succeeded:      ${sources.length - totalFailed}`);
    console.log(`Failed:         ${totalFailed}`);
    console.log(`Total records:  ${totalRecords}`);
    console.log("\n📋 Results by source:");

    // Sort: successes first by records desc, then failures
    sourceResults.sort((a, b) => {
        if (a.status !== b.status) return a.status === "success" ? -1 : 1;
        return b.records - a.records;
    });

    for (const r of sourceResults) {
        const icon = r.status === "success" ? "✅" : "❌";
        const recordStr = r.status === "success" ? `${r.records} records` : r.error || "failed";
        console.log(`  ${icon} ${r.name.padEnd(35)} ${r.duration.padStart(8)}  ${recordStr}`);
    }

    // Restore
    if (originalPageBudget) process.env.LOCAL_PAGE_BUDGET = originalPageBudget;
    else delete process.env.LOCAL_PAGE_BUDGET;
}

main()
    .then(() => { console.log("\nDone!"); process.exit(0); })
    .catch((err) => { console.error("Fatal error:", err); process.exit(1); });
