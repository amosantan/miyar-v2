import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../server/_core/database-safety";

initializeDatabaseSafety("integration-test", { loadDotenv: true });
const value = process.env.DATABASE_URL;
if (!value)
  throw new Error("Guarded TR-13 Playwright seeding requires DATABASE_URL");
const target = new URL(value);
const database = decodeURIComponent(target.pathname.slice(1));
if (!database.startsWith("miyar_test_tr13_"))
  throw new Error(
    "TR-13 Playwright seeding requires the disposable database prefix"
  );

const credentials = [
  [13_101, "tr13-admin@example.invalid", "tr13-local-admin"],
  [13_102, "tr13-member@example.invalid", "tr13-local-member"],
  [13_103, "tr13-viewer@example.invalid", "tr13-local-viewer"],
  [13_201, "tr13-foreign@example.invalid", "tr13-local-foreign"],
] as const;
const connection = await mysql.createConnection({
  host: target.hostname,
  port: target.port ? Number(target.port) : 3306,
  user: decodeURIComponent(target.username),
  password: decodeURIComponent(target.password),
  database,
});
try {
  for (const [id, email, password] of credentials) {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await connection.query(
      "update users set email = ?, password = ?, loginMethod = 'local' where id = ?",
      [email, hash, id]
    );
    if ((result as { affectedRows: number }).affectedRows !== 1)
      throw new Error("Synthetic local-login user is missing");
  }
  await writeFile(
    path.join(
      process.cwd(),
      "tmp",
      "tr13-workflow-certification",
      "playwright-fixture.json"
    ),
    `${JSON.stringify({ syntheticOnly: true, users: credentials.map(([id, email]) => ({ id, email })), projectSource: "created-by-playwright" }, null, 2)}\n`
  );
} finally {
  await connection.end();
}
