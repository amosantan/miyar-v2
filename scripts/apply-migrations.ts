#!/usr/bin/env node
/**
 * Migration Runner — Applies SQL migration files to the database
 *
 * Usage:  npx tsx scripts/apply-migrations.ts [file1.sql file2.sql ...]
 *         If no files specified, applies all .sql files in drizzle/ directory.
 *
 * Requires DATABASE_URL env var (auto-loaded from .env via dotenv).
 */

import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
}

// Strip ssl query param (mysql2 can't parse JSON-in-URL) and pass it directly
const cleanUrl = DATABASE_URL.replace(/[?&]ssl=[^&]*/g, "");

const MIGRATIONS_DIR = resolve(__dirname, "../drizzle");

async function main() {
    const specificFiles = process.argv.slice(2);

    let files: string[];
    if (specificFiles.length > 0) {
        files = specificFiles;
    } else {
        files = readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith(".sql"))
            .sort();
    }

    console.log(`📦 Connecting to database...`);
    const connection = await mysql.createConnection({
        uri: cleanUrl,
        ssl: { rejectUnauthorized: true },
        multipleStatements: false,
    });
    console.log(`✅ Connected\n`);

    for (const file of files) {
        const filePath = resolve(MIGRATIONS_DIR, file);
        const sql = readFileSync(filePath, "utf-8");

        const statements = sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !s.startsWith("--"));

        console.log(`🔄 Applying ${file} (${statements.length} statements)...`);

        for (const stmt of statements) {
            try {
                await connection.execute(stmt);
                console.log(`   ✅ ${stmt.substring(0, 60).replace(/\n/g, " ")}...`);
            } catch (err: any) {
                if (err.code === "ER_DUP_KEYNAME" || err.message?.includes("Duplicate key name")) {
                    console.log(`   ⏭️  Skipped (index already exists): ${stmt.substring(0, 50)}...`);
                } else if (err.message?.includes("already exists")) {
                    console.log(`   ⏭️  Skipped (already exists): ${stmt.substring(0, 50)}...`);
                } else {
                    console.error(`   ❌ Failed: ${err.message}`);
                    console.error(`      Statement: ${stmt.substring(0, 100)}...`);
                }
            }
        }

        console.log(`✅ ${file} done\n`);
    }

    await connection.end();
    console.log("🎉 All migrations applied!");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
