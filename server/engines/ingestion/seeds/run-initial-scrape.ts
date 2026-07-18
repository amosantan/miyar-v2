/**
 * Quick scrape runner — triggers scrapes on seeded sources to populate evidence data.
 * Usage: npx tsx server/engines/ingestion/seeds/run-initial-scrape.ts
 */
import { getDb } from "../../../db";
import { sourceRegistry } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { DynamicConnector } from "../connectors/dynamic";
import { runSingleConnector } from "../orchestrator";
import { initializeDatabaseSafety } from "../../../_core/database-safety";

async function runInitialScrape() {
    initializeDatabaseSafety("ingest", { loadDotenv: true });
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Get all active sources
    const sources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.isActive, true));
    console.log(`[Scraper] Found ${sources.length} active sources. Running scrapes...\n`);

    let totalEvidence = 0;
    let successes = 0;
    let failures = 0;

    for (const source of sources) {
        try {
            console.log(`[Scraper] 🔄 Scraping: ${source.name} (${source.url})`);
            const connector = new DynamicConnector(source);
            const report = await runSingleConnector(connector, "manual");

            const created = report.evidenceCreated ?? 0;
            totalEvidence += created;

            if (report.sourcesFailed > 0) {
                console.log(`[Scraper] ❌ ${source.name}: FAILED`);

                // Update status
                await db.update(sourceRegistry).set({
                    lastScrapedAt: new Date(),
                    lastScrapedStatus: "failed",
                    consecutiveFailures: (source.consecutiveFailures || 0) + 1,
                }).where(eq(sourceRegistry.id, source.id));

                failures++;
            } else {
                console.log(`[Scraper] ✅ ${source.name}: Created ${created} evidence records`);

                // Update status
                await db.update(sourceRegistry).set({
                    lastScrapedAt: new Date(),
                    lastScrapedStatus: "success",
                    lastRecordCount: created,
                    consecutiveFailures: 0,
                }).where(eq(sourceRegistry.id, source.id));

                successes++;
            }
        } catch (err) {
            console.error(`[Scraper] ❌ ${source.name}: ${err instanceof Error ? err.message : String(err)}`);
            failures++;
        }

        // Rate limit between sources
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n[Scraper] ═══════════════════════════════════════`);
    console.log(`[Scraper] Done: ${successes} succeeded, ${failures} failed`);
    console.log(`[Scraper] Total evidence records created: ${totalEvidence}`);
}

runInitialScrape()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Scrape runner failed:", err);
        process.exit(1);
    });
