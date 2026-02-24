/**
 * Quick test: Scrape Graniti UAE with Firecrawl v4 SDK
 * Usage: npx tsx server/engines/ingestion/seeds/test-firecrawl.ts
 */
import "dotenv/config";

async function testFirecrawl() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        console.error("❌ FIRECRAWL_API_KEY not set");
        return;
    }
    console.log(`✅ API key found: ${apiKey.substring(0, 8)}...`);

    // Firecrawl v4: default export is `Firecrawl` class extending v2 client
    // v2 API: scrape(url, opts) returns Document directly (no success wrapper)
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const client = new Firecrawl({ apiKey });

    const url = "https://www.granitiuae.com/";
    console.log(`\n🔥 Scraping: ${url}`);
    console.log("   (this may take 10-30 seconds...)\n");

    try {
        // v2 scrape() returns Document directly: { markdown, html, metadata, ... }
        const doc = await client.scrape(url, {
            formats: ["markdown"],
        }) as any;

        const md: string = doc?.markdown || "";
        console.log(`✅ Success! ${md.length} chars of markdown content`);

        if (md.length > 0) {
            console.log(`\n--- First 3000 chars ---\n`);
            console.log(md.substring(0, 3000));
            console.log(`\n--- (total: ${md.length} chars) ---`);

            // Count product-like items
            const lines = md.split("\n");
            const productLines = lines.filter((l: string) =>
                /marble|granite|tile|slab|porcelain|travertine|onyx|limestone|AED/i.test(l)
            );
            console.log(`\n📦 Lines mentioning products/prices: ${productLines.length}`);
            if (productLines.length > 0) {
                console.log("   Sample:");
                productLines.slice(0, 15).forEach((l: string) =>
                    console.log(`   → ${l.trim().substring(0, 120)}`)
                );
            }
        } else {
            console.log("No markdown. Full response keys:", Object.keys(doc || {}).join(", "));
            console.log("Response:", JSON.stringify(doc, null, 2).substring(0, 2000));
        }
    } catch (err: any) {
        console.error("❌ Error:", err.message || err);
    }
}

testFirecrawl()
    .then(() => process.exit(0))
    .catch((err: any) => {
        console.error("Test failed:", err.message);
        process.exit(1);
    });
