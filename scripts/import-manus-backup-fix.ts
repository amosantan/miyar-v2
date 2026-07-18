/**
 * Import Manus DB Backup Data - Phase 2
 * Fix tables that failed due to [object Object] in JSON columns
 * 
 * Usage: npx tsx scripts/import-manus-backup-fix.ts
 */
import fs from 'fs';
import mysql from 'mysql2/promise';
import { initializeDatabaseSafety } from "../server/_core/database-safety";

const BACKUP_PATH = '/Users/amrosaleh/Downloads/db-backup/02_data.sql';

async function main() {
    initializeDatabaseSafety("ingest", { loadDotenv: true });
    console.log('📦 Reading Manus backup...');
    const sqlContent = fs.readFileSync(BACKUP_PATH, 'utf-8');

    // Connect to database - parse URL manually like the app does
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

    // ─── benchmark_categories ───
    // Insert rows one at a time, replacing [object Object] with proper NULL for JSON 'data' column
    console.log('📥 Importing benchmark_categories...');
    const bcRegex = /INSERT INTO `benchmark_categories`[^;]+;/g;
    const bcMatches = sqlContent.match(bcRegex);
    if (bcMatches) {
        for (const stmt of bcMatches) {
            // Replace ALL [object Object] (including comma-separated) with NULL
            const fixed = stmt.replace(/'(?:\[object Object\](?:,\[object Object\])*)+'/g, 'NULL');
            try {
                await connection.execute(fixed);
                console.log('  ✅ benchmark_categories inserted');
            } catch (e: any) {
                console.log('  ❌', e.message.substring(0, 150));
            }
        }
    }

    // ─── model_versions ───
    console.log('📥 Importing model_versions...');
    const mvRegex = /INSERT INTO `model_versions`[^;]+;/g;
    const mvMatches = sqlContent.match(mvRegex);
    if (mvMatches) {
        for (const stmt of mvMatches) {
            const fixed = stmt.replace(/'(?:\[object Object\](?:,\[object Object\])*)+'/g, 'NULL');
            try {
                await connection.execute(fixed);
                console.log('  ✅ model_versions inserted');
            } catch (e: any) {
                console.log('  ❌', e.message.substring(0, 150));
            }
        }
    }

    // ─── prompt_templates ───
    console.log('📥 Importing prompt_templates...');
    const ptRegex = /INSERT INTO `prompt_templates`[^;]+;/g;
    const ptMatches = sqlContent.match(ptRegex);
    if (ptMatches) {
        for (const stmt of ptMatches) {
            const fixed = stmt.replace(/'(?:\[object Object\](?:,\[object Object\])*)+'/g, 'NULL');
            try {
                await connection.execute(fixed);
                console.log('  ✅ prompt_templates inserted');
            } catch (e: any) {
                console.log('  ❌', e.message.substring(0, 150));
            }
        }
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Final counts
    console.log('\n📊 Final data counts:');
    const tables = ['benchmark_versions', 'benchmark_categories', 'benchmark_data', 'logic_versions', 'logic_weights', 'logic_thresholds', 'model_versions', 'prompt_templates', 'roi_configs', 'materials_catalog', 'evidence_records', 'projects'];
    for (const t of tables) {
        try {
            const [rows] = await connection.execute(`SELECT COUNT(*) as cnt FROM ${t}`);
            console.log(`  ${t}: ${(rows as any)[0].cnt} rows`);
        } catch (e: any) {
            console.log(`  ${t}: ❌`);
        }
    }

    await connection.end();
    console.log('\n✅ Done!');
}

main().catch(console.error);
