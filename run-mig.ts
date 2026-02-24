import { getDb } from "./server/db";
import fs from "fs";
import path from "path";

async function run() {
    const db = await getDb();
    if (!db) { console.error("No DB"); return; }

    const sql = fs.readFileSync(path.join(process.cwd(), "drizzle/0024_sharp_slipstream.sql"), "utf-8");

    const cleanSql = sql.replace(/--> statement-breakpoint/g, "");
    const stmts = cleanSql.split(";").map(s => s.trim()).filter(s => s.length > 0);

    for (const stmt of stmts) {
        try {
            console.log("Executing:", stmt);
            await db.execute(stmt);
        } catch (e: any) {
            if (e.message?.includes("Duplicate column name") || e.message?.includes("already exists")) {
                console.log("Skipping (already exists)");
            } else {
                console.error("Failed:", e.message);
            }
        }
    }
    console.log("Migration complete");
    process.exit(0);
}
run();
