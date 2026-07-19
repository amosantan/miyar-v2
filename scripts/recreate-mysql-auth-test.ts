import mysql from "mysql2/promise";
import process from "node:process";
import { initializeDatabaseSafety } from "../server/_core/database-safety";

initializeDatabaseSafety("reset", { loadDotenv: true });

const value = process.env.DATABASE_URL;
if (!value) throw new Error("DATABASE_URL is required");
const url = new URL(value);
const database = url.pathname.slice(1);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("Recreation accepts only localhost or 127.0.0.1");
}
if (!/^miyar_auth_test[A-Za-z0-9_]*$/.test(database)) {
  throw new Error("Recreation database must use the miyar_auth_test prefix");
}

const connection = await mysql.createConnection({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
});

try {
  await connection.query(`drop database if exists \`${database}\``);
  await connection.query(
    `create database \`${database}\` character set utf8mb4 collate utf8mb4_unicode_ci`
  );
} finally {
  await connection.end();
}
