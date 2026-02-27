/**
 * Phase B.3 — DLD Transactions & Rents: Create tables
 *
 * Run: npx tsx scripts/migrate-dld-tables.ts
 */
import "dotenv/config";
import mysql from "mysql2/promise";

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

    // 1. dld_transactions
    console.log("\n🔨 Creating dld_transactions...");
    await conn.execute(`
    CREATE TABLE IF NOT EXISTS dld_transactions (
      id int AUTO_INCREMENT PRIMARY KEY,
      transaction_id bigint,
      transaction_type varchar(50),
      property_type varchar(100),
      area_id int,
      area_name_en varchar(200),
      project_name varchar(300),
      amount decimal(14,2),
      property_size_sqft decimal(10,2),
      price_per_sqft decimal(10,2),
      rooms varchar(20),
      transaction_date varchar(20),
      registration_date varchar(20),
      is_freehold boolean,
      master_project_en varchar(300),
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log("✅ dld_transactions ready");

    // 2. dld_rents
    console.log("\n🔨 Creating dld_rents...");
    await conn.execute(`
    CREATE TABLE IF NOT EXISTS dld_rents (
      id int AUTO_INCREMENT PRIMARY KEY,
      contract_id bigint,
      area_id int,
      area_name_en varchar(200),
      property_type varchar(100),
      property_usage varchar(100),
      rooms varchar(20),
      annual_amount decimal(12,2),
      property_size_sqft decimal(10,2),
      rent_per_sqft decimal(10,2),
      contract_start_date varchar(20),
      contract_end_date varchar(20),
      project_name varchar(300),
      master_project_en varchar(300),
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log("✅ dld_rents ready");

    // 3. dld_area_benchmarks
    console.log("\n🔨 Creating dld_area_benchmarks...");
    await conn.execute(`
    CREATE TABLE IF NOT EXISTS dld_area_benchmarks (
      id int AUTO_INCREMENT PRIMARY KEY,
      area_id int NOT NULL,
      area_name_en varchar(200) NOT NULL,
      property_type varchar(100),
      period varchar(10) NOT NULL,
      sale_p25 decimal(10,2),
      sale_p50 decimal(10,2),
      sale_p75 decimal(10,2),
      sale_mean decimal(10,2),
      sale_transaction_count int DEFAULT 0,
      sale_yoy_change_pct decimal(6,2),
      rent_p50 decimal(10,2),
      rent_mean decimal(10,2),
      rent_transaction_count int DEFAULT 0,
      gross_yield decimal(6,2),
      absorption_rate decimal(6,4),
      recommended_fitout_low decimal(10,2),
      recommended_fitout_mid decimal(10,2),
      recommended_fitout_high decimal(10,2),
      computed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log("✅ dld_area_benchmarks ready");

    console.log("\n🎉 All 3 tables created. Ready for DLD Transactions & Rents JSON ingestion.");
    await conn.end();
}

main().catch(console.error);
