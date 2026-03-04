/**
 * MIYAR 3.0 Phase A — Material Supplier Seed Data
 *
 * Seeds 5 default UAE supplier sources for the MQI material scraping pipeline.
 * Run: npx tsx drizzle/seed-materials.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { materialSupplierSources } from "./schema";

async function seedMaterialSupplierSources() {
    const url = new URL(process.env.DATABASE_URL!);
    const pool = mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
    });

    const db = drizzle(pool);

    const defaultSources = [
        {
            supplierName: "RAK Ceramics",
            supplierUrl: "https://www.rakceramics.com/ae/tiles",
            materialCategory: "flooring" as const,
            tier: "mid" as const,
            notes: "UAE-based manufacturer. Tiles, sanitaryware, tabletops.",
        },
        {
            supplierName: "Porcelanosa",
            supplierUrl: "https://www.porcelanosa.com/ae/",
            materialCategory: "wall_tile" as const,
            tier: "premium" as const,
            notes: "Spanish premium tiles. Dubai showroom in D3.",
        },
        {
            supplierName: "Algedra",
            supplierUrl: "https://www.alfresco.ae/",
            materialCategory: "joinery" as const,
            tier: "ultra" as const,
            notes: "UAE luxury fit-out contractor. Custom joinery and finishes.",
        },
        {
            supplierName: "Danube Home",
            supplierUrl: "https://www.danubehome.com/uae/en",
            materialCategory: "flooring" as const,
            tier: "affordable" as const,
            notes: "Mass-market home furnishing. Good for affordable tier benchmarking.",
        },
        {
            supplierName: "Arabian Tile Company",
            supplierUrl: "https://www.arabiantile.com/",
            materialCategory: "flooring" as const,
            tier: "mid" as const,
            notes: "Regional tile distributor covering ceramic and porcelain.",
        },
    ];

    console.log("[Seed] Inserting 5 default material supplier sources...");

    for (const source of defaultSources) {
        try {
            await db.insert(materialSupplierSources).values({
                organizationId: null, // System-wide defaults
                ...source,
            });
            console.log(`  ✓ ${source.supplierName}`);
        } catch (err: any) {
            if (err.message?.includes("Duplicate")) {
                console.log(`  ⤳ ${source.supplierName} (already exists, skipped)`);
            } else {
                console.error(`  ✗ ${source.supplierName}: ${err.message}`);
            }
        }
    }

    console.log("[Seed] Done.");
    await pool.end();
}

seedMaterialSupplierSources().catch(console.error);
