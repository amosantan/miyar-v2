/**
 * Phase B.3 — DLD Projects: Schema migration + JSON ingestion
 *
 * Run: npx tsx scripts/migrate-dld.ts
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");

    // Parse DATABASE_URL and connect with proper SSL
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

    // 1. Create dld_projects table
    console.log("\n🔨 Creating dld_projects table...");
    await conn.execute(`
    CREATE TABLE IF NOT EXISTS dld_projects (
      id int AUTO_INCREMENT NOT NULL,
      project_id bigint NOT NULL,
      project_number int,
      project_name varchar(500),
      project_description_en text,
      project_status varchar(50),
      project_classification varchar(50),
      project_type varchar(50),
      area_id int,
      area_name_en varchar(200),
      area_name_ar varchar(200),
      master_project_en varchar(300),
      master_project_ar varchar(300),
      developer_name varchar(500),
      developer_number int,
      master_developer_name varchar(500),
      zoning_authority_en varchar(200),
      escrow_agent_name varchar(500),
      no_of_units int DEFAULT 0,
      no_of_villas int DEFAULT 0,
      no_of_buildings int DEFAULT 0,
      no_of_lands int DEFAULT 0,
      percent_completed int DEFAULT 0,
      project_start_date varchar(20),
      project_end_date varchar(20),
      completion_date varchar(20),
      property_id bigint,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
    console.log("✅ dld_projects table ready");

    // 2. Add dld_area columns to projects
    console.log("\n🔨 Adding dld_area_id and dld_area_name to projects...");
    try {
        await conn.execute(`ALTER TABLE projects ADD COLUMN dld_area_id int`);
        console.log("✅ dld_area_id added");
    } catch (e: any) {
        if (e.message?.includes("Duplicate column")) console.log("⏭️  dld_area_id already exists");
        else throw e;
    }
    try {
        await conn.execute(`ALTER TABLE projects ADD COLUMN dld_area_name varchar(200)`);
        console.log("✅ dld_area_name added");
    } catch (e: any) {
        if (e.message?.includes("Duplicate column")) console.log("⏭️  dld_area_name already exists");
        else throw e;
    }

    // 3. Check if data already loaded
    const [existingRows] = await conn.execute("SELECT COUNT(*) as cnt FROM dld_projects") as any;
    const existingCount = existingRows[0].cnt;
    if (existingCount > 0) {
        console.log(`\n⏭️  dld_projects already has ${existingCount} rows — skipping ingestion`);
        await conn.end();
        return;
    }

    // 4. Load JSON
    console.log("\n📂 Loading Projects JSON...");
    const jsonPath = resolve(__dirname, "../Projects_2026-02-27.json");
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    console.log(`📊 ${data.length} DLD projects found`);

    // 5. Insert one at a time (PlanetScale limits bulk insert size)
    let inserted = 0;
    for (const p of data) {
        await conn.execute(
            `INSERT INTO dld_projects
        (project_id, project_number, project_name, project_description_en,
         project_status, project_classification, project_type,
         area_id, area_name_en, area_name_ar,
         master_project_en, master_project_ar,
         developer_name, developer_number, master_developer_name,
         zoning_authority_en, escrow_agent_name,
         no_of_units, no_of_villas, no_of_buildings, no_of_lands,
         percent_completed, project_start_date, project_end_date,
         completion_date, property_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                p.project_id,
                p.project_number,
                p.project_name?.substring(0, 500) ?? null,
                p.project_description_en?.substring(0, 5000) ?? null,
                p.project_status ?? null,
                p.project_classification_ar ?? null,
                p.project_type_ar ?? null,
                p.area_id ?? null,
                p.area_name_en?.substring(0, 200) ?? null,
                p.area_name_ar?.substring(0, 200) ?? null,
                p.master_project_en?.substring(0, 300) ?? null,
                p.master_project_ar?.substring(0, 300) ?? null,
                p.developer_name?.substring(0, 500) ?? null,
                p.developer_number ?? null,
                p.master_developer_name?.substring(0, 500) ?? null,
                p.zoning_authority_en?.substring(0, 200) ?? null,
                p.escrow_agent_name?.substring(0, 500) ?? null,
                p.no_of_units ?? 0,
                p.no_of_villas ?? 0,
                p.no_of_buildings ?? 0,
                p.no_of_lands ?? 0,
                p.percent_completed ?? 0,
                p.project_start_date ?? null,
                p.project_end_date ?? null,
                p.completion_date ?? null,
                p.property_id ?? null,
            ]
        );

        inserted++;
        if (inserted % 500 === 0 || inserted === data.length) {
            console.log(`  ✅ ${inserted}/${data.length} inserted`);
        }
    }

    console.log(`\n🎉 Done! ${inserted} DLD projects ingested into dld_projects table`);
    await conn.end();
}

main().catch(console.error);
