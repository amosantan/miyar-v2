import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../server/_core/database-safety";
import { TR13_DATABASE_PREFIX } from "./tr13-workflow-certification-contract";

const decision = initializeDatabaseSafety("integration-test", {
  loadDotenv: true,
});
const value = process.env.DATABASE_URL;
if (!value)
  throw new Error("DATABASE_URL is required in the guarded child process");
const target = new URL(value);
const database = decodeURIComponent(target.pathname.slice(1));
if (
  decision.target.class !== "safe-loopback" ||
  !database.startsWith(TR13_DATABASE_PREFIX)
) {
  throw new Error(
    "TR-13 preparation accepts only the validated disposable database target"
  );
}

const connection = await mysql.createConnection({
  host: target.hostname,
  port: target.port ? Number(target.port) : 3306,
  user: decodeURIComponent(target.username),
  password: decodeURIComponent(target.password),
});
try {
  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await connection.query(`CREATE DATABASE \`${database}\``);
} finally {
  await connection.end();
}
