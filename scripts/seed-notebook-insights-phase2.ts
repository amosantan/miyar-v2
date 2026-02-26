/**
 * NotebookLM Insights Seed Script - Phase 2
 * Inserts Competitor Intel and HNWI Buyer Preferences extracted from new NotebookLM resources.
 *
 * Run: npx tsx scripts/seed-notebook-insights-phase2.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { trendTags, competitorEntities, competitorProjects } from "../drizzle/schema";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
}

async function main() {
    const url = new URL(DATABASE_URL!);
    const pool = mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
    });
    const db = drizzle(pool);

    console.log("🧠 NotebookLM Insights Seed (Phase 2) — Starting...\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2A: Seed HNWI Buyer Preferences into Trend Tags
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🌟 Seeding HNWI Buyer Preferences...");

    const preferences = [
        { name: "Branded Residences", type: "buyer_preference" as const, desc: "Partnering with globally recognized lifestyle and hospitality brands provides buyers with a badge of quality, security, and access to exclusive amenities. (Score: 9)" },
        { name: "Family-Sized Beachfront Villas", type: "buyer_preference" as const, desc: "Surging demand for spacious, ranch-style, and beachfront homes within amenity-rich communities for wealthy end-users relocating. (Score: 10)" },
        { name: "Integrated Wellness Facilities", type: "buyer_preference" as const, desc: "HNWIs increasingly prioritize properties that incorporate in-home wellness designs, private spa treatment rooms, and comprehensive health amenities. (Score: 8)" },
        { name: "Design Authenticity", type: "buyer_preference" as const, desc: "Luxury buyers demand architecturally significant homes with unique, authentic designs and high-quality bespoke craftsmanship. (Score: 8)" },
        { name: "Sustainable & Smart Homes", type: "buyer_preference" as const, desc: "Strong preference for modern developments that seamlessly integrate sustainable construction practices with advanced smart home technologies. (Score: 7)" }
    ];

    let prefCount = 0;
    for (const t of preferences) {
        try {
            await db.insert(trendTags).values({
                name: t.name,
                category: t.type,
                description: t.desc,
                createdBy: 1,
            }).onDuplicateKeyUpdate({ set: { description: t.desc } });
            console.log(`   ✅ Preference: ${t.name}`);
            prefCount++;
        } catch (e) {
            console.error(`   ❌ Failed preference ${t.name}:`, e);
        }
    }
    console.log(`   Inserted/Updated ${prefCount} HNWI buyer preferences.\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2B: Seed Competitor Insights
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📊 Seeding Competitor Intelligence...");

    const intelData = [
        { devName: "Emaar", psf: 4134, specs: "Nature-washed textures and earth-kissed hues that emphasize a connection to natural and equestrian heritage.", amenities: "Championship golf courses, polo fields, and equestrian stables." },
        { devName: "DAMAC", psf: 4053, specs: "Lifestyle-driven branded partnerships with fashion houses like Fendi Casa, Cavalli, and Versace to deliver premium finishes.", amenities: "Floating cinemas, wave simulators, lagoon waterfalls, and wildlife sanctuaries." },
        { devName: "Sobha", psf: 3247, specs: "Unique backward integration model allowing total quality control over custom furniture, façades, and joinery.", amenities: "Bespoke interiors paired with expansive biophilic green spaces and estates." },
        { devName: "Aldar", psf: 2960, specs: "Urban residences featuring modern kitchens with built-in appliances, smart access infrastructure, and curated interior palettes.", amenities: "Rooftop swimming pools with panoramic views, creative co-working lounges, and wellness zones." },
        { devName: "OMNIYAT", psf: 7695, specs: "Ultra-rare materials like Black Zebra marble and Italian sanitaryware by Gessi at the extreme end of the luxury spectrum.", amenities: "Properties managed by the Dorchester Collection, private cinemas, longevity therapies, and diagnosis pods." }
    ];

    // We will insert/update the competitor entities if they exist, or create a 'flagship' project representing this intel
    let compCount = 0;
    for (const intel of intelData) {
        try {

            // For simplicity, we insert a "Flagship 2025" project for each developer to hold these specs
            // 1. First, check if entity exists (we assume 1-5 IDs or we can just try to insert the entity first)
            const entityResult = await db.insert(competitorEntities).values({
                name: intel.devName,
                segmentFocus: "ultra_luxury", // mostly ultra-luxury per NotebookLM
                notes: `NotebookLM Profile: ${intel.specs}`,
                createdBy: 1,
            }).onDuplicateKeyUpdate({ set: { notes: `NotebookLM Profile: ${intel.specs}` } });

            // Need the ID, let's just do a quick select
            const [existingEntity] = await pool.promise().query(`SELECT id FROM competitor_entities WHERE name = '${intel.devName}' LIMIT 1`);

            const compId = (existingEntity as any)[0]?.id;

            if (compId) {
                await db.insert(competitorProjects).values({
                    competitorId: compId,
                    projectName: `${intel.devName} - 2025 Flagship Intel`,
                    location: "Dubai Prime",
                    segment: "ultra_luxury",
                    assetType: "residential",
                    positioningKeywords: ["NotebookLM_Intel", "Flagship 2025"],
                    interiorStyleSignals: [intel.specs],
                    amenityList: [intel.amenities],
                    priceIndicators: { currency: "AED", min: intel.psf, max: intel.psf + 1000, per_unit: "sqft" }
                });
                console.log(`   ✅ Competitor Project Intel logged for: ${intel.devName}`);
                compCount++;
            } else {
                console.log(`   ⚠️ Could not find/create competitor entity for ${intel.devName}`);
            }

        } catch (e) {
            console.error(`   ❌ Failed competitor ${intel.devName}:`, e);
        }
    }
    console.log(`   Inserted ${compCount} competitor intel records.\n`);

    console.log("═══════════════════════════════════════════════");
    console.log("✅ NotebookLM Insights Seed (Phase 2) — Complete!");
    console.log("═══════════════════════════════════════════════\n");

    pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
