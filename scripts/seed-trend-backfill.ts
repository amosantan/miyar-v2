/**
 * MIYAR Phase B4 — Trend Snapshots Backfill
 *
 * Seeds 3 months of historical trend snapshots across key categories
 * to enable trend detection and the autonomous alert engine.
 *
 * Run: npx tsx scripts/seed-trend-backfill.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { trendSnapshots } from "../drizzle/schema";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
}

// Categories and metrics to backfill
const TREND_SERIES = [
    // Material costs
    { metric: "Italian Marble Tile 60x60", category: "material_cost", geography: "Dubai", baseValue: 280, volatility: 5 },
    { metric: "Porcelain Tile 80x80", category: "material_cost", geography: "Dubai", baseValue: 120, volatility: 3 },
    { metric: "Engineered Oak Flooring", category: "material_cost", geography: "UAE", baseValue: 195, volatility: 4 },
    { metric: "Quartz Countertop", category: "material_cost", geography: "Dubai", baseValue: 450, volatility: 6 },
    { metric: "SPC Vinyl Flooring", category: "material_cost", geography: "UAE", baseValue: 55, volatility: 2 },
    { metric: "Ceramic Wall Tile 30x60", category: "material_cost", geography: "UAE", baseValue: 45, volatility: 3 },
    { metric: "Natural Stone Slab", category: "material_cost", geography: "Dubai", baseValue: 520, volatility: 8 },
    { metric: "Kitchen Cabinet Set (per lm)", category: "material_cost", geography: "Dubai", baseValue: 1200, volatility: 4 },
    { metric: "Bathroom Fixture Set", category: "material_cost", geography: "UAE", baseValue: 3500, volatility: 5 },
    { metric: "LED Lighting Package", category: "material_cost", geography: "UAE", baseValue: 180, volatility: 3 },

    // Fitout rates
    { metric: "Standard Residential Fitout", category: "fitout_rate", geography: "Dubai", baseValue: 350, volatility: 4 },
    { metric: "Premium Residential Fitout", category: "fitout_rate", geography: "Dubai", baseValue: 680, volatility: 5 },
    { metric: "Luxury Villa Fitout", category: "fitout_rate", geography: "Dubai", baseValue: 1200, volatility: 6 },
    { metric: "Commercial Office Fitout", category: "fitout_rate", geography: "Dubai", baseValue: 450, volatility: 3 },
    { metric: "Hospitality Room Fitout", category: "fitout_rate", geography: "UAE", baseValue: 850, volatility: 5 },

    // Market trends
    { metric: "Dubai Residential Avg Price/sqft", category: "market_trend", geography: "Dubai", baseValue: 1450, volatility: 7 },
    { metric: "Abu Dhabi Residential Avg Price/sqft", category: "market_trend", geography: "Abu Dhabi", baseValue: 1100, volatility: 5 },
    { metric: "Dubai Marina Avg Rent", category: "market_trend", geography: "Dubai", baseValue: 85000, volatility: 6 },
    { metric: "Palm Jumeirah Premium Index", category: "market_trend", geography: "Dubai", baseValue: 3200, volatility: 8 },
    { metric: "Business Bay Transaction Volume", category: "market_trend", geography: "Dubai", baseValue: 1800, volatility: 10 },

    // Property prices (new from Bayut / PropertyFinder connectors)
    { metric: "Bayut Avg Listing Price/sqft - Dubai Marina", category: "property_price", geography: "Dubai", baseValue: 1650, volatility: 6 },
    { metric: "Bayut Avg Listing Price/sqft - Downtown", category: "property_price", geography: "Dubai", baseValue: 2100, volatility: 7 },
    { metric: "PropertyFinder Avg Listing Price/sqft - JVC", category: "property_price", geography: "Dubai", baseValue: 850, volatility: 5 },
    { metric: "PropertyFinder Avg Listing Price/sqft - Business Bay", category: "property_price", geography: "Dubai", baseValue: 1350, volatility: 6 },
];

// Generate 12 weekly snapshots (3 months) for each series
function generateSnapshots() {
    const snapshots: any[] = [];
    const now = new Date();

    for (const series of TREND_SERIES) {
        let prevMA: number | null = null;
        const movingAverages: any[] = [];

        for (let week = 12; week >= 0; week--) {
            const date = new Date(now.getTime() - week * 7 * 24 * 60 * 60 * 1000);

            // Trending with variance — gradual trend + noise
            const trendFactor = 1 + ((12 - week) * 0.003); // ~3.6% trend over 3 months
            const noise = (Math.random() * 2 - 1) * (series.volatility / 100);
            const currentMA = Math.round(series.baseValue * trendFactor * (1 + noise) * 100) / 100;

            const percentChange = prevMA ? ((currentMA - prevMA) / prevMA) * 100 : null;
            const direction = percentChange === null ? "insufficient_data" :
                percentChange > 1 ? "rising" : percentChange < -1 ? "falling" : "stable";

            // Confidence depends on data point count + sources
            const dataPoints = 5 + Math.floor(Math.random() * 10);
            const gradeA = Math.floor(Math.random() * 3) + 1;
            const gradeB = Math.floor(Math.random() * 4) + 1;
            const gradeC = dataPoints - gradeA - gradeB;
            const sources = 2 + Math.floor(Math.random() * 4);
            const confidence = gradeA >= 2 && dataPoints >= 8 ? "high" :
                dataPoints >= 5 ? "medium" : "low";

            movingAverages.push({
                date: date.toISOString().split("T")[0],
                value: currentMA,
                dataPointCount: dataPoints,
            });

            snapshots.push({
                metric: series.metric,
                category: series.category,
                geography: series.geography,
                dataPointCount: dataPoints,
                gradeACount: gradeA,
                gradeBCount: gradeB,
                gradeCCount: Math.max(0, gradeC),
                uniqueSources: sources,
                dateRangeStart: new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000),
                dateRangeEnd: date,
                currentMA: String(currentMA),
                previousMA: prevMA ? String(prevMA) : null,
                percentChange: percentChange ? String(percentChange.toFixed(6)) : null,
                direction: direction as any,
                anomalyCount: Math.random() > 0.85 ? 1 : 0,
                confidence: confidence as any,
                narrative: `${series.metric} ${direction === "rising" ? "increased" : direction === "falling" ? "decreased" : "remained stable"} at ${currentMA} AED ${series.category === "material_cost" ? "per sqm" : "per sqft"} in ${series.geography}.`,
                movingAverages: JSON.stringify(movingAverages.slice(-5)),
                createdAt: date,
            });

            prevMA = currentMA;
        }
    }

    return snapshots;
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

    console.log("📈 Phase B4: Trend Snapshots Backfill — Starting...\n");

    const snapshots = generateSnapshots();
    console.log(`   Generated ${snapshots.length} trend snapshots`);
    console.log(`   Series: ${TREND_SERIES.length} metrics`);
    console.log(`   Period: 3 months (13 weekly snapshots per series)\n`);

    let inserted = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
        const batch = snapshots.slice(i, i + BATCH_SIZE);
        try {
            await db.insert(trendSnapshots).values(batch);
            inserted += batch.length;
        } catch (e: any) {
            // Fall back to individual inserts
            for (const s of batch) {
                try {
                    await db.insert(trendSnapshots).values(s);
                    inserted++;
                } catch { /* skip duplicates */ }
            }
        }
        process.stdout.write(`\r   Inserted: ${inserted}/${snapshots.length}`);
    }

    console.log(`\n\n═══════════════════════════════════════════════`);
    console.log(`✅ Phase B4 Complete!`);
    console.log(`   Inserted: ${inserted} trend snapshots`);
    console.log(`   Categories: material_cost, fitout_rate, market_trend, property_price`);
    console.log(`   Trend engine can now detect patterns over 3 months`);
    console.log(`═══════════════════════════════════════════════\n`);

    pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
