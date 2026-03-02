/**
 * LIVE SCRAPING AUDIT
 * 
 * Tests every active source in the registry, monitors scraping quality,
 * and reports on what works, what's broken, and what needs improvement.
 * 
 * Run: npx tsx server/engines/ingestion/scrape-audit.ts
 */

import "dotenv/config";
import { getDb, listSourceRegistry, listEvidenceRecords } from "../../db";
import { DynamicConnector } from "./connectors/dynamic";
import { runSingleConnector } from "./orchestrator";

interface AuditResult {
    sourceId: string | number;
    sourceName: string;
    sourceUrl: string;
    sourceType: string;
    scrapeStatus: "success" | "partial" | "failed" | "blocked";
    fetchProvider: string;     // Which provider succeeded
    contentLength: number;     // Raw content length
    itemsExtracted: number;    // Evidence items found
    subPagesFound: number;     // Sub-page URLs discovered
    sampleItems: string[];     // First 3 item titles
    error?: string;
    durationMs: number;
}

async function runAudit() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  MIYAR LIVE SCRAPING AUDIT");
    console.log("  " + new Date().toISOString());
    console.log("═══════════════════════════════════════════════════════\n");

    // Phase 1: Check database state
    console.log("📊 Phase 1: Database State\n");

    const sources = await listSourceRegistry();
    const activeSources = sources.filter((s: any) => s.isActive);
    console.log(`  Total sources: ${sources.length}`);
    console.log(`  Active sources: ${activeSources.length}`);

    const evidence = await listEvidenceRecords();
    console.log(`  Total evidence records: ${evidence.length}`);

    // Group evidence by source
    const bySource = new Map<string, number>();
    for (const rec of evidence) {
        const key = (rec as any).sourceUrl || "unknown";
        bySource.set(key, (bySource.get(key) || 0) + 1);
    }
    console.log(`  Unique source URLs with data: ${bySource.size}`);
    console.log("");

    // Phase 2: Test scraping each active source
    console.log("🔍 Phase 2: Live Scraping Test\n");

    const results: AuditResult[] = [];
    const maxSources = 8; // Test up to 8 sources
    const testSources = activeSources.slice(0, maxSources);

    for (let i = 0; i < testSources.length; i++) {
        const source = testSources[i] as any;
        console.log(`\n  [${i + 1}/${testSources.length}] Testing: ${source.name}`);
        console.log(`       URL: ${source.url}`);
        console.log(`       Type: ${source.sourceType}`);

        const startTime = Date.now();
        const result: AuditResult = {
            sourceId: source.id,
            sourceName: source.name,
            sourceUrl: source.url,
            sourceType: source.sourceType || "unknown",
            scrapeStatus: "failed",
            fetchProvider: "none",
            contentLength: 0,
            itemsExtracted: 0,
            subPagesFound: 0,
            sampleItems: [],
            durationMs: 0,
        };

        try {
            const connector = new DynamicConnector(source);

            // Test fetch (which provider works?)
            const payload = await connector.fetch();
            result.contentLength = (payload.rawHtml?.length || 0) + (payload.markdown?.length || 0);
            result.durationMs = Date.now() - startTime;

            if (payload.error) {
                result.error = payload.error;
                result.scrapeStatus = "failed";
                console.log(`       ❌ Fetch failed: ${payload.error}`);
            } else if (result.contentLength < 100) {
                result.scrapeStatus = "blocked";
                result.error = "Content too short — likely blocked or empty";
                console.log(`       ⚠️  Content too short: ${result.contentLength} chars`);
            } else {
                // Detect which provider was used from logs (check markdown presence)
                if (payload.markdown && payload.markdown.length > 50) {
                    result.fetchProvider = "firecrawl";
                } else {
                    result.fetchProvider = "fallback";
                }

                console.log(`       ✅ Fetched: ${result.contentLength} chars via ${result.fetchProvider}`);

                // Test extraction
                try {
                    const extracted = await connector.extract(payload);
                    result.itemsExtracted = extracted.length;
                    result.sampleItems = extracted.slice(0, 3).map(e => e.title || e.rawText?.substring(0, 60) || "?");

                    if (extracted.length > 0) {
                        result.scrapeStatus = "success";
                        console.log(`       📦 Extracted: ${extracted.length} items`);
                        for (const sample of result.sampleItems) {
                            console.log(`          → ${sample}`);
                        }
                    } else {
                        result.scrapeStatus = "partial";
                        console.log(`       ⚠️  Fetched OK but extracted 0 items`);
                    }
                } catch (extractErr) {
                    result.scrapeStatus = "partial";
                    result.error = `Extraction error: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`;
                    console.log(`       ⚠️  Extraction failed: ${result.error}`);
                }

                // Check for sub-page links
                const html = payload.rawHtml || payload.markdown || "";
                const linkMatches = html.match(/href=["']([^"']+)["']/gi) || [];
                const baseUrl = new URL(source.url).origin;
                const subPages = linkMatches
                    .map((m: string) => m.replace(/href=["']/i, "").replace(/["']$/, ""))
                    .filter((u: string) => u.startsWith("/") || u.startsWith(baseUrl))
                    .filter((u: string) => !u.includes("#") && !u.endsWith(".css") && !u.endsWith(".js"));
                result.subPagesFound = [...new Set(subPages)].length;
                console.log(`       🔗 Sub-pages found: ${result.subPagesFound}`);
            }
        } catch (err) {
            result.error = err instanceof Error ? err.message : String(err);
            result.scrapeStatus = "failed";
            result.durationMs = Date.now() - startTime;
            console.log(`       ❌ Error: ${result.error}`);
        }

        results.push(result);

        // Small delay between sources
        if (i < testSources.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Phase 3: Summary Report
    console.log("\n\n═══════════════════════════════════════════════════════");
    console.log("  AUDIT SUMMARY");
    console.log("═══════════════════════════════════════════════════════\n");

    const successful = results.filter(r => r.scrapeStatus === "success");
    const partial = results.filter(r => r.scrapeStatus === "partial");
    const failed = results.filter(r => r.scrapeStatus === "failed");
    const blocked = results.filter(r => r.scrapeStatus === "blocked");

    console.log(`  ✅ Successful: ${successful.length}/${results.length}`);
    console.log(`  ⚠️  Partial:    ${partial.length}/${results.length}`);
    console.log(`  ❌ Failed:     ${failed.length}/${results.length}`);
    console.log(`  🚫 Blocked:    ${blocked.length}/${results.length}`);
    console.log("");

    // Detail per source
    console.log("  Per-Source Results:");
    console.log("  ─────────────────────────────────────────────────────");
    for (const r of results) {
        const status = r.scrapeStatus === "success" ? "✅" :
            r.scrapeStatus === "partial" ? "⚠️" :
                r.scrapeStatus === "blocked" ? "🚫" : "❌";
        console.log(`  ${status} ${r.sourceName}`);
        console.log(`     ${r.sourceUrl}`);
        console.log(`     Content: ${r.contentLength} chars | Items: ${r.itemsExtracted} | Sub-pages: ${r.subPagesFound} | Time: ${r.durationMs}ms`);
        if (r.error) console.log(`     Error: ${r.error}`);
        console.log("");
    }

    // Output JSON for programmatic analysis
    console.log("\n📋 JSON Results:");
    console.log(JSON.stringify(results, null, 2));
}

runAudit().catch(err => {
    console.error("Audit failed:", err);
    process.exit(1);
});
