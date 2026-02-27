/**
 * Phase B.3 — DLD Transactions & Rents: Full ingestion + benchmark computation
 *
 * Run: npx tsx scripts/ingest-dld-data.ts
 *
 * 1. Drops and recreates dld_transactions, dld_rents (with correct schema)
 * 2. Adds project_purpose column to projects (if missing)
 * 3. Ingests 5,000 Transactions + 5,000 Rent Contracts
 * 4. Computes area benchmarks (P25/P50/P75/mean, yield) per area
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper: mysql2 requires null, never undefined
const n = (v: any): any => v === undefined || v === '' ? null : v;
const ns = (v: any, maxLen = 200): string | null => {
    if (v === undefined || v === null || v === '') return null;
    return String(v).substring(0, maxLen);
};

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");

    const parsed = new URL(url);
    const conn = await mysql.createConnection({
        host: parsed.hostname,
        port: parseInt(parsed.port || "3306"),
        user: parsed.username,
        password: parsed.password,
        database: parsed.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
    });
    console.log("✅ Connected to PlanetScale");

    // ─── Step 1: Drop and recreate tables with correct schema ──────────────
    console.log("\n🔨 Dropping old dld_transactions & dld_rents...");
    await conn.execute("DROP TABLE IF EXISTS dld_transactions");
    await conn.execute("DROP TABLE IF EXISTS dld_rents");

    console.log("🔨 Creating dld_transactions (correct schema)...");
    await conn.execute(`
    CREATE TABLE dld_transactions (
      id int AUTO_INCREMENT PRIMARY KEY,
      transaction_id varchar(50),
      trans_group_en varchar(50),
      procedure_name_en varchar(100),
      reg_type_en varchar(50),
      property_type_en varchar(50),
      property_sub_type_en varchar(100),
      property_usage_en varchar(50),
      area_id int,
      area_name_en varchar(200),
      project_name_en varchar(300),
      building_name_en varchar(300),
      master_project_en varchar(300),
      actual_worth decimal(14,2),
      procedure_area decimal(10,2),
      meter_sale_price decimal(10,2),
      rooms_en varchar(30),
      instance_date varchar(20),
      has_parking int,
      nearest_metro_en varchar(200),
      nearest_mall_en varchar(200),
      nearest_landmark_en varchar(200),
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log("✅ dld_transactions created");

    console.log("🔨 Creating dld_rents (correct schema)...");
    await conn.execute(`
    CREATE TABLE dld_rents (
      id int AUTO_INCREMENT PRIMARY KEY,
      contract_id varchar(50),
      contract_reg_type_en varchar(50),
      ejari_property_type_en varchar(100),
      ejari_property_sub_type_en varchar(100),
      property_usage_en varchar(100),
      area_id int,
      area_name_en varchar(200),
      project_name_en varchar(300),
      master_project_en varchar(300),
      annual_amount decimal(12,2),
      contract_amount decimal(12,2),
      actual_area decimal(10,2),
      rent_per_sqm decimal(10,2),
      contract_start_date varchar(20),
      contract_end_date varchar(20),
      tenant_type_en varchar(50),
      is_free_hold int,
      nearest_metro_en varchar(200),
      nearest_mall_en varchar(200),
      nearest_landmark_en varchar(200),
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log("✅ dld_rents created");

    // ─── Step 2: Add project_purpose to projects ──────────────────────────
    console.log("\n🔨 Adding project_purpose column to projects...");
    try {
        await conn.execute(
            "ALTER TABLE projects ADD COLUMN project_purpose ENUM('sell_offplan','sell_ready','rent','mixed') DEFAULT 'sell_ready'"
        );
        console.log("✅ project_purpose column added");
    } catch (e: any) {
        if (e.code === "ER_DUP_FIELDNAME") {
            console.log("ℹ️  project_purpose column already exists");
        } else throw e;
    }

    // ─── Step 3: Ingest Transactions ──────────────────────────────────────
    console.log("\n📥 Loading Transactions JSON...");
    const txnPath = resolve(__dirname, "../Transactions_2026-02-27.json");
    const transactions = JSON.parse(readFileSync(txnPath, "utf-8"));
    console.log(`  Total records: ${transactions.length}`);

    const txnBatchSize = 50;
    let txnInserted = 0;
    for (let i = 0; i < transactions.length; i += txnBatchSize) {
        const batch = transactions.slice(i, i + txnBatchSize);
        const values = batch.map((r: any) => [
            ns(r.transaction_id, 50),
            ns(r.trans_group_en, 50),
            ns(r.procedure_name_en, 100),
            ns(r.reg_type_en, 50),
            ns(r.property_type_en, 50),
            ns(r.property_sub_type_en, 100),
            ns(r.property_usage_en, 50),
            n(r.area_id),
            ns(r.area_name_en, 200),
            ns(r.project_name_en, 300),
            ns(r.building_name_en, 300),
            ns(r.master_project_en, 300),
            n(r.actual_worth),
            n(r.procedure_area),
            n(r.meter_sale_price),
            ns(r.rooms_en, 30),
            ns(r.instance_date, 20),
            n(r.has_parking),
            ns(r.nearest_metro_en, 200),
            ns(r.nearest_mall_en, 200),
            ns(r.nearest_landmark_en, 200),
        ]);
        const placeholders = values.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
        const flat = values.flat();
        await conn.execute(
            `INSERT INTO dld_transactions (transaction_id, trans_group_en, procedure_name_en, reg_type_en, property_type_en, property_sub_type_en, property_usage_en, area_id, area_name_en, project_name_en, building_name_en, master_project_en, actual_worth, procedure_area, meter_sale_price, rooms_en, instance_date, has_parking, nearest_metro_en, nearest_mall_en, nearest_landmark_en) VALUES ${placeholders}`,
            flat
        );
        txnInserted += batch.length;
        if (txnInserted % 500 === 0) console.log(`  ${txnInserted}/${transactions.length} transactions...`);
    }
    console.log(`✅ ${txnInserted} transactions inserted`);

    // ─── Step 4: Ingest Rents ─────────────────────────────────────────────
    console.log("\n📥 Loading Rent Contracts JSON...");
    const rentPath = resolve(__dirname, "../Rent_Contracts_2026-02-27.json");
    const rents = JSON.parse(readFileSync(rentPath, "utf-8"));
    console.log(`  Total records: ${rents.length}`);

    let rentInserted = 0;
    for (let i = 0; i < rents.length; i += txnBatchSize) {
        const batch = rents.slice(i, i + txnBatchSize);
        const values = batch.map((r: any) => {
            const annualAmount = r.annual_amount || null;
            const actualArea = r.actual_area || null;
            const rentPerSqm = annualAmount && actualArea && actualArea > 0
                ? Math.round((annualAmount / actualArea) * 100) / 100
                : null;
            return [
                ns(r.contract_id, 50),
                ns(r.contract_reg_type_en, 50),
                ns(r.ejari_property_type_en, 100),
                ns(r.ejari_property_sub_type_en, 100),
                ns(r.property_usage_en, 100),
                n(r.area_id),
                ns(r.area_name_en, 200),
                ns(r.project_name_en, 300),
                ns(r.master_project_en, 300),
                n(annualAmount),
                n(r.contract_amount),
                n(actualArea),
                n(rentPerSqm),
                ns(r.contract_start_date, 20),
                ns(r.contract_end_date, 20),
                ns(r.tenant_type_en, 50),
                n(r.is_free_hold),
                ns(r.nearest_metro_en, 200),
                ns(r.nearest_mall_en, 200),
                ns(r.nearest_landmark_en, 200),
            ];
        });
        const placeholders = values.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
        const flat = values.flat();
        await conn.execute(
            `INSERT INTO dld_rents (contract_id, contract_reg_type_en, ejari_property_type_en, ejari_property_sub_type_en, property_usage_en, area_id, area_name_en, project_name_en, master_project_en, annual_amount, contract_amount, actual_area, rent_per_sqm, contract_start_date, contract_end_date, tenant_type_en, is_free_hold, nearest_metro_en, nearest_mall_en, nearest_landmark_en) VALUES ${placeholders}`,
            flat
        );
        rentInserted += batch.length;
        if (rentInserted % 500 === 0) console.log(`  ${rentInserted}/${rents.length} rent contracts...`);
    }
    console.log(`✅ ${rentInserted} rent contracts inserted`);

    // ─── Step 5: Compute Area Benchmarks ──────────────────────────────────
    console.log("\n📊 Computing area benchmarks...");

    // Get sale stats per area (only Sales transactions)
    const [saleRows] = await conn.execute(`
    SELECT area_id, area_name_en,
           COUNT(*) as txn_count,
           AVG(meter_sale_price) as avg_price,
           MIN(meter_sale_price) as min_price,
           MAX(meter_sale_price) as max_price
    FROM dld_transactions
    WHERE trans_group_en = 'Sales' AND meter_sale_price > 0
    GROUP BY area_id, area_name_en
    ORDER BY txn_count DESC
  `) as any;

    // Get rent stats per area
    const [rentRows] = await conn.execute(`
    SELECT area_id, area_name_en,
           COUNT(*) as rent_count,
           AVG(rent_per_sqm) as avg_rent
    FROM dld_rents
    WHERE rent_per_sqm > 0
    GROUP BY area_id, area_name_en
  `) as any;
    const rentMap = new Map(rentRows.map((r: any) => [r.area_id, r]));

    // Compute percentiles per area (need individual prices)
    // Clear existing benchmarks
    await conn.execute("DELETE FROM dld_area_benchmarks");

    let benchmarkCount = 0;
    for (const row of saleRows) {
        // Get individual prices for percentile calculation
        const [prices] = await conn.execute(
            `SELECT meter_sale_price as price
       FROM dld_transactions
       WHERE area_id = ? AND trans_group_en = 'Sales' AND meter_sale_price > 0
       ORDER BY meter_sale_price ASC`,
            [row.area_id]
        ) as any;

        const priceArr: number[] = prices.map((p: any) => Number(p.price));
        const p25 = percentile(priceArr, 25);
        const p50 = percentile(priceArr, 50);
        const p75 = percentile(priceArr, 75);

        // Get rent data for this area
        const rentData = rentMap.get(row.area_id);
        const avgRent = rentData ? Number(rentData.avg_rent) : null;
        const rentCount = rentData ? Number(rentData.rent_count) : 0;

        // Gross yield = (annual rent per sqm / sale price per sqm) * 100
        const grossYield = avgRent && p50 > 0 ? (avgRent / p50) * 100 : null;

        // Fitout calibration: 10%, 18%, 28% of sale median
        const fitoutLow = Math.round(p50 * 0.10 * 100) / 100;
        const fitoutMid = Math.round(p50 * 0.18 * 100) / 100;
        const fitoutHigh = Math.round(p50 * 0.28 * 100) / 100;

        await conn.execute(
            `INSERT INTO dld_area_benchmarks
       (area_id, area_name_en, property_type, period, sale_p25, sale_p50, sale_p75, sale_mean,
        sale_transaction_count, rent_p50, rent_mean, rent_transaction_count, gross_yield,
        recommended_fitout_low, recommended_fitout_mid, recommended_fitout_high)
       VALUES (?, ?, 'ALL', '2025', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.area_id, row.area_name_en,
                Math.round(p25 * 100) / 100,
                Math.round(p50 * 100) / 100,
                Math.round(p75 * 100) / 100,
                Math.round(Number(row.avg_price) * 100) / 100,
                row.txn_count,
                avgRent ? Math.round(avgRent * 100) / 100 : null,
                avgRent ? Math.round(avgRent * 100) / 100 : null,
                rentCount,
                grossYield ? Math.round(grossYield * 100) / 100 : null,
                fitoutLow, fitoutMid, fitoutHigh
            ]
        );
        benchmarkCount++;
    }

    console.log(`✅ ${benchmarkCount} area benchmarks computed and stored`);

    // ─── Summary ──────────────────────────────────────────────────────────
    const [txnCountRes] = await conn.execute("SELECT COUNT(*) as cnt FROM dld_transactions") as any;
    const [rentCountRes] = await conn.execute("SELECT COUNT(*) as cnt FROM dld_rents") as any;
    const [benchCountRes] = await conn.execute("SELECT COUNT(*) as cnt FROM dld_area_benchmarks") as any;
    const [topAreas] = await conn.execute(
        "SELECT area_name_en, sale_p50, sale_transaction_count, gross_yield, recommended_fitout_mid FROM dld_area_benchmarks ORDER BY sale_transaction_count DESC LIMIT 10"
    ) as any;

    console.log("\n════════════════════════════════════════════");
    console.log("🎉 DLD Data Integration Complete!");
    console.log("════════════════════════════════════════════");
    console.log(`  Transactions: ${txnCountRes[0].cnt}`);
    console.log(`  Rent Contracts: ${rentCountRes[0].cnt}`);
    console.log(`  Area Benchmarks: ${benchCountRes[0].cnt}`);
    console.log("\n  Top 10 Areas by Volume:");
    for (const a of topAreas) {
        const yield_str = a.gross_yield ? `${Number(a.gross_yield).toFixed(1)}%` : "N/A";
        console.log(`    ${a.area_name_en}: P50 = ${Number(a.sale_p50).toLocaleString()} AED/sqm | Yield: ${yield_str} | Fitout: ${Number(a.recommended_fitout_mid).toLocaleString()} AED/sqm | Txns: ${a.sale_transaction_count}`);
    }

    await conn.end();
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

main().catch(console.error);
