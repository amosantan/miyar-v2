/**
 * Trend Snapshot Backfill Script
 * Backfills percentChange and previousMA on trend_snapshots that have NULL values.
 * Clamps extreme values to ±999 to avoid DB overflow.
 *
 * Run: npx tsx scripts/backfill-trends.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { trendSnapshots } from "../drizzle/schema";
import { eq } from "drizzle-orm";
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

    console.log("📈 Trend Snapshot Backfill — Starting...\n");

    const allSnapshots = await db.select().from(trendSnapshots)
        .orderBy(trendSnapshots.category, trendSnapshots.createdAt);

    const grouped = new Map<string, typeof allSnapshots>();
    for (const s of allSnapshots) {
        const key = `${s.category}::${s.geography}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s);
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const [key, snaps] of grouped) {
        if (snaps.length < 2) continue;

        for (let i = 1; i < snaps.length; i++) {
            const prev = snaps[i - 1];
            const curr = snaps[i];

            if (prev.currentMA && curr.currentMA) {
                const prevMA = parseFloat(String(prev.currentMA));
                const currMA = parseFloat(String(curr.currentMA));

                if (prevMA > 0) {
                    let pctChange = ((currMA - prevMA) / prevMA) * 100;

                    // Clamp extreme values to avoid DB overflow
                    if (Math.abs(pctChange) > 999) {
                        console.log(`   ⚠️ Clamping extreme pctChange for ${key} id=${curr.id}: ${pctChange.toFixed(2)}% → clamped to ±999`);
                        pctChange = Math.max(-999, Math.min(999, pctChange));
                        skippedCount++;
                    }

                    const direction = pctChange > 3 ? "rising" as const : pctChange < -3 ? "falling" as const : "stable" as const;

                    await db.update(trendSnapshots)
                        .set({
                            previousMA: String(prevMA.toFixed(4)),
                            percentChange: String(pctChange.toFixed(2)),
                            direction,
                        })
                        .where(eq(trendSnapshots.id, curr.id));

                    updatedCount++;
                }
            }
        }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Clamped: ${skippedCount}\n`);

    pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
