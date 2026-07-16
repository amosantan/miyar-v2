import mysql from "mysql2/promise";
import process from "node:process";

const value = process.env.DATABASE_URL;
if (!value) throw new Error("DATABASE_URL is required");
const url = new URL(value);
const database = url.pathname.slice(1);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("Cleanup accepts only localhost or 127.0.0.1");
}
if (!database.startsWith("miyar_auth_test")) {
  throw new Error("Cleanup database must begin with miyar_auth_test");
}

const connection = await mysql.createConnection({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database,
});

const tables = [
  "asset_links",
  "comments",
  "materials_to_boards",
  "material_boards",
  "rfq_line_items",
  "generated_visuals",
  "design_briefs",
  "ai_design_briefs",
  "project_assets",
  "report_instances",
  "score_matrices",
  "scenarios",
  "evidence_records",
  "materials_catalog",
  "organization_members",
  "projects",
  "users",
  "organizations",
] as const;

try {
  await connection.query("set foreign_key_checks = 0");
  const [rows] = await connection.query(
    "select table_name as tableName from information_schema.tables where table_schema = database()"
  );
  const existing = new Set((rows as Array<{ tableName: string }>).map(row => row.tableName));
  for (const table of tables) {
    if (existing.has(table)) await connection.query(`truncate table \`${table}\``);
  }
  await connection.query("drop trigger if exists tr03h_fail_board_delete");
  await connection.query("drop trigger if exists tr03h_fail_project_update");
  await connection.query("drop trigger if exists tr03h_fail_rfq_insert");
} finally {
  await connection.query("set foreign_key_checks = 1").catch(() => undefined);
  await connection.end();
}
