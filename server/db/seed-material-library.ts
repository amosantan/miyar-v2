import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import "dotenv/config";
import { materialLibrary } from "../../drizzle/schema.js"; // Need .js for ESM if running straight, or can use tsx. Let's assume we run via tsx, so we'll rename to .ts just in case, but user said .mjs. Let's stick to .ts and run with npx tsx. Actually, I will name it seed-material-library.ts so it matches the other TS files. Actually user explicitly requested "seed-material-library.mjs". Let's provide a ts version and mjs version to be safe, or just .ts since the project uses `tsx`. I will use .ts to avoid module issues.

const materials = [
    // FLOORING
    { category: "flooring", tier: "mid", style: "all", productCode: "FL-001", productName: "Porcelanosa Rodano Taupe 33x90cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", supplierLocation: "JLT Showroom", unitLabel: "sqm", priceAedMin: 75, priceAedMax: 95, notes: "style: all" },
    { category: "flooring", tier: "mid", style: "classic", productCode: "FL-002", productName: "Porcelanosa Dover Antique 45x90cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", unitLabel: "sqm", priceAedMin: 80, priceAedMax: 100, notes: "style: classic" },
    { category: "flooring", tier: "mid", style: "modern", productCode: "FL-003", productName: "Engineered Oak 14mm Natural", brand: "Danube Building Materials", supplierName: "Danube Building Materials", supplierLocation: "Al Quoz", unitLabel: "sqm", priceAedMin: 110, priceAedMax: 140, notes: "style: modern, contemporary" },
    { category: "flooring", tier: "mid", style: "contemporary", productCode: "FL-003b", productName: "Engineered Oak 14mm Natural", brand: "Danube Building Materials", supplierName: "Danube Building Materials", supplierLocation: "Al Quoz", unitLabel: "sqm", priceAedMin: 110, priceAedMax: 140, notes: "duplicate for contemporary" },
    { category: "flooring", tier: "mid", style: "all", productCode: "FL-004", productName: "Anti-slip Ceramic 30x60cm", brand: "Danube Home", supplierName: "Danube Home", supplierLocation: "Multiple UAE locations", unitLabel: "sqm", priceAedMin: 35, priceAedMax: 55, notes: "for kitchens, bathrooms, utility" },
    { category: "flooring", tier: "mid", style: "modern", productCode: "FL-005", productName: "SPC Vinyl Plank Light Oak", brand: "ACE", supplierName: "ACE Hardware UAE", unitLabel: "sqm", priceAedMin: 45, priceAedMax: 65, notes: "for bedrooms 2-3, maid's room. style: modern, minimalist" },
    { category: "flooring", tier: "mid", style: "minimalist", productCode: "FL-005b", productName: "SPC Vinyl Plank Light Oak", brand: "ACE", supplierName: "ACE Hardware UAE", unitLabel: "sqm", priceAedMin: 45, priceAedMax: 65, notes: "" },
    { category: "flooring", tier: "premium", style: "classic", productCode: "FL-006", productName: "Porcelanosa Marmol Perla 60x120cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", unitLabel: "sqm", priceAedMin: 145, priceAedMax: 180, notes: "style: classic, contemporary" },
    { category: "flooring", tier: "premium", style: "contemporary", productCode: "FL-006b", productName: "Porcelanosa Marmol Perla 60x120cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", unitLabel: "sqm", priceAedMin: 145, priceAedMax: 180, notes: "" },
    { category: "flooring", tier: "premium", style: "modern", productCode: "FL-007", productName: "Engineered Walnut 15mm Smoked", brand: "Danube Building Materials", supplierName: "Danube Building Materials", unitLabel: "sqm", priceAedMin: 175, priceAedMax: 220, notes: "style: modern, arabesque" },
    { category: "flooring", tier: "premium", style: "arabesque", productCode: "FL-007b", productName: "Engineered Walnut 15mm Smoked", brand: "Danube Building Materials", supplierName: "Danube Building Materials", unitLabel: "sqm", priceAedMin: 175, priceAedMax: 220, notes: "" },
    { category: "flooring", tier: "ultra", style: "classic", productCode: "FL-008", productName: "Calacatta Marble 60x120cm", brand: "Stone Gallery", supplierName: "Stone Gallery Dubai", unitLabel: "sqm", priceAedMin: 380, priceAedMax: 520, notes: "style: classic, ultra" },
    { category: "flooring", tier: "affordable", style: "all", productCode: "FL-009", productName: "Ceramic Tile 30x30cm", brand: "Danube Home", supplierName: "Danube Home", unitLabel: "sqm", priceAedMin: 22, priceAedMax: 38, notes: "style: all" },

    // WALL PAINT
    { category: "wall_paint", tier: "mid", style: "all", productCode: "WP-001", productName: "Jotun Fenomastic Mighty Walls", brand: "Jotun", supplierName: "ACE Hardware", unitLabel: "L", priceAedMin: 32, priceAedMax: 45, notes: "finish: matte, eggshell" },
    { category: "wall_paint", tier: "mid", style: "all", productCode: "WP-002", productName: "National Paints Ambiance", brand: "National Paints", supplierName: "National Paints UAE", supplierLocation: "Al Quoz factory", unitLabel: "L", priceAedMin: 28, priceAedMax: 40, notes: "" },
    { category: "wall_paint", tier: "mid", style: "all", productCode: "WP-003", productName: "Dulux EasyCare Washable", brand: "Dulux", supplierName: "ACE Hardware UAE", unitLabel: "L", priceAedMin: 35, priceAedMax: 48, notes: "" },
    { category: "wall_paint", tier: "premium", style: "all", productCode: "WP-004", productName: "Jotun Lady Perfection", brand: "Jotun", supplierName: "Jotun UAE", unitLabel: "L", priceAedMin: 55, priceAedMax: 75, notes: "finish: matte, silk" },
    { category: "wall_paint", tier: "ultra", style: "classic", productCode: "WP-005", productName: "Farrow & Ball Estate Emulsion", brand: "Farrow & Ball", supplierName: "Hive UAE", unitLabel: "L", priceAedMin: 145, priceAedMax: 180, notes: "style: classic, contemporary" },
    { category: "wall_paint", tier: "ultra", style: "contemporary", productCode: "WP-005b", productName: "Farrow & Ball Estate Emulsion", brand: "Farrow & Ball", supplierName: "Hive UAE", unitLabel: "L", priceAedMin: 145, priceAedMax: 180, notes: "" },

    // SANITARYWARE
    { category: "sanitaryware", tier: "mid", style: "modern", productCode: "SW-001", productName: "Grohe Eurosmart Basin Mixer", brand: "Grohe", supplierName: "Plaza Middle East", supplierLocation: "Sheikh Zayed Road", unitLabel: "unit", priceAedMin: 520, priceAedMax: 680, notes: "" },
    { category: "sanitaryware", tier: "mid", style: "modern", productCode: "SW-002", productName: "Grohe Eurosmart Shower Set", brand: "Grohe", supplierName: "Plaza Middle East", unitLabel: "unit", priceAedMin: 780, priceAedMax: 980, notes: "" },
    { category: "sanitaryware", tier: "mid", style: "contemporary", productCode: "SW-003", productName: "Hansgrohe Vernis Basin Mixer", brand: "Hansgrohe", supplierName: "Bulls Hardware", supplierLocation: "Deira", unitLabel: "unit", priceAedMin: 680, priceAedMax: 850, notes: "" },
    { category: "sanitaryware", tier: "mid", style: "all", productCode: "SW-004", productName: "Roca Gap WC Suite", brand: "Roca", supplierName: "Sanipex Group UAE", unitLabel: "unit", priceAedMin: 900, priceAedMax: 1200, notes: "" },
    { category: "sanitaryware", tier: "premium", style: "modern", productCode: "SW-005", productName: "Grohe Eurocube Basin Mixer", brand: "Grohe", supplierName: "Plaza Middle East", unitLabel: "unit", priceAedMin: 1400, priceAedMax: 1800, notes: "style: modern, minimalist" },
    { category: "sanitaryware", tier: "premium", style: "minimalist", productCode: "SW-005b", productName: "Grohe Eurocube Basin Mixer", brand: "Grohe", supplierName: "Plaza Middle East", unitLabel: "unit", priceAedMin: 1400, priceAedMax: 1800, notes: "" },
    { category: "sanitaryware", tier: "premium", style: "modern", productCode: "SW-006", productName: "Hansgrohe Metris Shower System", brand: "Hansgrohe", supplierName: "Bulls Hardware", unitLabel: "unit", priceAedMin: 2200, priceAedMax: 2800, notes: "" },
    { category: "sanitaryware", tier: "ultra", style: "contemporary", productCode: "SW-007", productName: "Axor Citterio Basin Mixer", brand: "Axor", supplierName: "Sanipex Group UAE", unitLabel: "unit", priceAedMin: 4500, priceAedMax: 6200, notes: "style: contemporary, minimalist" },
    { category: "sanitaryware", tier: "ultra", style: "minimalist", productCode: "SW-007b", productName: "Axor Citterio Basin Mixer", brand: "Axor", supplierName: "Sanipex Group UAE", unitLabel: "unit", priceAedMin: 4500, priceAedMax: 6200, notes: "" },
    { category: "sanitaryware", tier: "affordable", style: "all", productCode: "SW-008", productName: "Cera Standard Basin Mixer", brand: "Cera", supplierName: "ACE Hardware UAE", unitLabel: "unit", priceAedMin: 180, priceAedMax: 280, notes: "" },

    // WALL TILE (wet areas)
    { category: "wall_tile", tier: "mid", style: "modern", productCode: "WT-001", productName: "Porcelanosa Marmol Blanco 31.6x90cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", unitLabel: "sqm", priceAedMin: 85, priceAedMax: 110, notes: "style: modern, classic" },
    { category: "wall_tile", tier: "mid", style: "classic", productCode: "WT-001b", productName: "Porcelanosa Marmol Blanco 31.6x90cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", unitLabel: "sqm", priceAedMin: 85, priceAedMax: 110, notes: "" },
    { category: "wall_tile", tier: "mid", style: "modern", productCode: "WT-002", productName: "Ceramic Metro Tile 10x20cm White", brand: "Danube Home", supplierName: "Danube Home", unitLabel: "sqm", priceAedMin: 28, priceAedMax: 42, notes: "style: modern, minimalist" },
    { category: "wall_tile", tier: "mid", style: "minimalist", productCode: "WT-002b", productName: "Ceramic Metro Tile 10x20cm White", brand: "Danube Home", supplierName: "Danube Home", unitLabel: "sqm", priceAedMin: 28, priceAedMax: 42, notes: "" },
    { category: "wall_tile", tier: "premium", style: "contemporary", productCode: "WT-003", productName: "Porcelanosa Velvet Bone 33x100cm", brand: "Porcelanosa", supplierName: "Porcelanosa Dubai", unitLabel: "sqm", priceAedMin: 130, priceAedMax: 165, notes: "" },
    { category: "wall_tile", tier: "affordable", style: "all", productCode: "WT-004", productName: "Standard Ceramic Tile 20x40cm", brand: "Danube Home", supplierName: "Danube Home", unitLabel: "sqm", priceAedMin: 20, priceAedMax: 32, notes: "" },
];

async function seed() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is missing");
    }

    const url = new URL(process.env.DATABASE_URL);

    const connection = await mysql.createConnection({
        host: url.hostname,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        port: url.port ? parseInt(url.port) : 3306,
        ssl: { rejectUnauthorized: true }
    });

    const db = drizzle(connection);

    console.log("Seeding material library...");

    // Clear existing items if any to avoid duplicates on re-run
    try {
        await db.delete(materialLibrary);
    } catch (e) {
        console.log("Could not clear materialLibrary (maybe table doesn't exist yet?)");
        process.exit(1);
    }

    try {
        await db.insert(materialLibrary).values(materials as any[]);
        console.log(`Seeded ${materials.length} material items.`);
    } catch (err) {
        console.error("Failed to seed materials:", err);
    } finally {
        await connection.end();
    }
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
