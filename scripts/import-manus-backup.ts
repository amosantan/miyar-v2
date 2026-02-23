/**
 * Import Manus DB Backup Data
 * 
 * This script reads the Manus backup SQL file and imports key tables
 * that are missing from the local PlanetScale database.
 * 
 * Usage: npx tsx scripts/import-manus-backup.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const BACKUP_PATH = '/Users/amrosaleh/Downloads/db-backup/02_data.sql';

// Tables to import (in dependency order)
const TABLES_TO_IMPORT = [
    'benchmark_versions',
    'benchmark_categories',
    'benchmark_data',
    'logic_versions',
    'logic_weights',
    'logic_thresholds',
    'model_versions',
    'prompt_templates',
    'roi_configs',
];

async function main() {
    console.log('📦 Reading Manus backup...');
    const sqlContent = fs.readFileSync(BACKUP_PATH, 'utf-8');

    // Parse INSERT statements for each table
    const tableInserts = new Map<string, string[]>();

    for (const tableName of TABLES_TO_IMPORT) {
        const regex = new RegExp(
            `INSERT INTO \`${tableName}\`[^;]+;`,
            'g'
        );
        const matches = sqlContent.match(regex);
        if (matches) {
            tableInserts.set(tableName, matches);
            console.log(`  Found ${matches.length} INSERT statement(s) for ${tableName}`);
        } else {
            console.log(`  ⚠️  No data found for ${tableName}`);
        }
    }

    // Connect to database
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL not found in .env');
        process.exit(1);
    }

    console.log('\n🔌 Connecting to database...');
    const url = new URL(dbUrl);
    const connection = await mysql.createConnection({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
        multipleStatements: true,
    });
    const db = drizzle(connection);

    // Check what's already populated
    console.log('\n📊 Checking current data...');
    for (const tableName of TABLES_TO_IMPORT) {
        try {
            const [rows] = await connection.execute(`SELECT COUNT(*) as cnt FROM ${tableName}`);
            const count = (rows as any)[0].cnt;
            console.log(`  ${tableName}: ${count} rows`);
            if (count > 0) {
                console.log(`    ⏭️  Skipping (already has data)`);
                tableInserts.delete(tableName);
            }
        } catch (e: any) {
            console.log(`  ${tableName}: ❌ Error: ${e.message}`);
            tableInserts.delete(tableName);
        }
    }

    // Import data
    console.log('\n🚀 Importing data...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    for (const [tableName, inserts] of tableInserts) {
        console.log(`\n  📥 Importing ${tableName}...`);
        for (const insert of inserts) {
            try {
                // Fix [object Object] issue - replace with NULL for JSON columns
                const fixed = insert.replace(/'\[object Object\](?:,\[object Object\])*'/g, 'NULL');
                await connection.execute(fixed);
                console.log(`    ✅ Inserted successfully`);
            } catch (e: any) {
                if (e.message.includes('Duplicate entry')) {
                    console.log(`    ⏭️  Skipped (duplicate)`);
                } else {
                    console.log(`    ❌ Error: ${e.message.substring(0, 100)}`);
                }
            }
        }
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Final counts
    console.log('\n📊 Final data counts:');
    for (const tableName of TABLES_TO_IMPORT) {
        try {
            const [rows] = await connection.execute(`SELECT COUNT(*) as cnt FROM ${tableName}`);
            const count = (rows as any)[0].cnt;
            console.log(`  ${tableName}: ${count} rows`);
        } catch (e: any) {
            console.log(`  ${tableName}: ❌ Error`);
        }
    }

    await connection.end();
    console.log('\n✅ Import complete!');
}

main().catch(console.error);
