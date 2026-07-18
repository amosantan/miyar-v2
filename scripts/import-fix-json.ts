/**
 * Import Phase 3 - Fix JSON NOT NULL columns
 * Replace [object Object] with '{}' for JSON NOT NULL columns
 * 
 * Usage: npx tsx scripts/import-fix-json.ts
 */
import fs from 'fs';
import mysql from 'mysql2/promise';
import { initializeDatabaseSafety } from "../server/_core/database-safety";

const BACKUP_PATH = '/Users/amrosaleh/Downloads/db-backup/02_data.sql';

async function main() {
    initializeDatabaseSafety("ingest", { loadDotenv: true });
    const sqlContent = fs.readFileSync(BACKUP_PATH, 'utf-8');

    const dbUrl = process.env.DATABASE_URL!;
    const url = new URL(dbUrl);
    const connection = await mysql.createConnection({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
    });

    console.log('🔌 Connected!\n');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    const TABLES = ['benchmark_categories', 'model_versions', 'prompt_templates'];

    for (const tableName of TABLES) {
        // Check if already has data
        const [existing] = await connection.execute(`SELECT COUNT(*) as cnt FROM ${tableName}`);
        if ((existing as any)[0].cnt > 0) {
            console.log(`⏭️  ${tableName} already has data, skipping`);
            continue;
        }

        const regex = new RegExp(`INSERT INTO \`${tableName}\`[^;]+;`, 'g');
        const matches = sqlContent.match(regex);
        if (!matches) {
            console.log(`⚠️ No data found for ${tableName}`);
            continue;
        }

        for (const stmt of matches) {
            // Replace [object Object] chains with empty JSON object string
            // This handles both single and comma-separated [object Object] values
            let fixed = stmt.replace(/'(?:\[object Object\](?:,\[object Object\])*)+'/g, "'{}'");
            try {
                await connection.execute(fixed);
                console.log(`✅ ${tableName} inserted`);
            } catch (e: any) {
                console.log(`❌ ${tableName}: ${e.message.substring(0, 200)}`);
            }
        }
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Final counts
    console.log('\n📊 Final counts:');
    for (const t of TABLES) {
        const [rows] = await connection.execute(`SELECT COUNT(*) as cnt FROM ${t}`);
        console.log(`  ${t}: ${(rows as any)[0].cnt}`);
    }

    await connection.end();
    console.log('\n✅ Done!');
}

main().catch(console.error);
