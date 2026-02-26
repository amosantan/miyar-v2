/**
 * NotebookLM Insights Seed Script
 * Inserts structured market intelligence extracted from NotebookLM into the database.
 * Corrected to match MIYAR v2 schema exactly.
 *
 * Run: npx tsx scripts/seed-notebook-insights.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { trendTags, benchmarkData } from "../drizzle/schema";
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

    console.log("🧠 NotebookLM Insights Seed — Starting...\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: Seed Trend Tags
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🌟 Phase 1: Seeding Interior Design & Construction Trends...");

    const trends = [
        { name: "Biophilic Design", type: "design_trend" as const, desc: "Integrating greenery, natural materials, indoor water features, and organic shapes to create a calming, wellness-focused environment that connects residents with nature." },
        { name: "AI-Powered Smart Homes", type: "technology" as const, desc: "Seamlessly incorporating AI-driven home automation, voice-controlled lighting, and biometric security systems into interiors without disrupting the luxury aesthetic." },
        { name: "Ultra-Rare Marble", type: "material_trend" as const, desc: "Utilizing exclusive, highly sought-after stones like Calacatta Viola, Portoro Gold, and Black Zebra for striking countertops, continuous flooring, and dramatic feature walls." },
        { name: "Wellness-Centric Layouts", type: "design_trend" as const, desc: "Designing dedicated in-house private spas featuring advanced amenities such as cryotherapy chambers, Himalayan salt walls, and chromotherapy hydrotherapy circuits." },
        { name: "Desert-Inspired Minimalism", type: "design_trend" as const, desc: "Embracing earthy tones, warm neutral palettes, and uncluttered, open layouts that reflect the local terrain and offer a serene, grounding atmosphere." },
        { name: "Sustainable Luxury", type: "sustainability" as const, desc: "Prioritizing eco-friendly elements such as reclaimed woods, recycled glass tiles, and low-VOC finishes to align with rigorous green building mandates like Estidama and Al Sa'fat." },
        { name: "Sensory-Rich Textures", type: "material_trend" as const, desc: "Layering highly tactile materials like velvet, ribbed oak, and handwoven cashmere wall coverings to create immersive and emotionally engaging 'Quiet Luxury' environments." },
        { name: "Sculptural Lighting", type: "design_trend" as const, desc: "Transforming lighting into monumental art pieces through the use of oversized, asymmetrical chandeliers, hand-blown glass, and precious gemstone accents." },
        { name: "Dual-Zone Kitchens", type: "design_trend" as const, desc: "Splitting culinary spaces into a high-end, aesthetically pleasing 'show kitchen' for entertaining and a separate, concealed 'wet kitchen' for heavy preparation and cooking." },
        { name: "Contemporary Arabian Opulence", type: "design_trend" as const, desc: "Fusing modern lines with traditional Emirati cultural heritage by integrating subtle Islamic geometry, ornate metal patterns, and elegant majlis-inspired seating." }
    ];

    let trendCount = 0;
    for (const t of trends) {
        try {
            await db.insert(trendTags).values({
                name: t.name,
                category: t.type,
                description: t.desc,
                createdBy: 1, // Created by User ID
            }).onDuplicateKeyUpdate({ set: { description: t.desc } });
            console.log(`   ✅ Tag: ${t.name}`);
            trendCount++;
        } catch (e) {
            console.error(`   ❌ Failed tag ${t.name}:`, e);
        }
    }
    console.log(`   Inserted/Updated ${trendCount} luxury trends.\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: Seed Benchmark Data
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📊 Phase 2: Seeding UAE Construction Cost Benchmarks...");

    const benchmarks = [
        { typology: "residential_villa" as const, tier: "mid", low: "300", mid: "400", high: "500", matLvl: 2 },
        { typology: "residential_villa" as const, tier: "luxury", low: "900", mid: "1150", high: "1400", matLvl: 4 },
        { typology: "residential_high_rise" as const, tier: "mid", low: "350", mid: "525", high: "700", matLvl: 2 },
        { typology: "commercial" as const, tier: "premium", low: "510", mid: "595", high: "680", matLvl: 3 },
        { typology: "commercial" as const, tier: "ultra_luxury", low: "850", mid: "1175", high: "1500", matLvl: 4 }
    ];

    let benchmarkCount = 0;
    for (const b of benchmarks) {
        try {
            await db.insert(benchmarkData).values({
                typology: b.typology,
                location: "UAE",
                marketTier: b.tier,
                costPerSqftLow: b.low,
                costPerSqftMid: b.mid,
                costPerSqftHigh: b.high,
                absorptionRate: "80.00", // Default realistic rate
                materialLevel: b.matLvl, // Integer (1 to 4)
                sourceType: "curated" as const, // Enum: 'synthetic', 'client_provided', 'curated'
                sourceNote: "NotebookLM UAE Market Intel 2025-2026",
                dataYear: 2025,
            });
            console.log(`   ✅ Benchmark: ${b.typology} (${b.tier})`);
            benchmarkCount++;
        } catch (e) {
            console.error(`   ❌ Failed benchmark ${b.typology}:`, e);
        }
    }
    console.log(`   Inserted ${benchmarkCount} cost benchmarks.\n`);

    console.log("═══════════════════════════════════════════════");
    console.log("✅ NotebookLM Insights Seed — Complete!");
    console.log("═══════════════════════════════════════════════\n");

    pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
