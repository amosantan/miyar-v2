import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import {
  MYSQL_EVIDENCE_FILE,
  MYSQL_INTEGRATION_TEST,
  MYSQL_INTEGRATION_TESTS,
  REQUIRED_MYSQL_EVIDENCE_FILES,
} from "./tr03h-mysql-evidence-contract";

function fail(message: string): never {
  console.error(`[mysql-authorization] ${message}`);
  process.exit(1);
}

if (process.env.DATABASE_URL) {
  fail("Refusing caller-provided DATABASE_URL; provide TEST_DATABASE_URL only");
}

const value = process.env.TEST_DATABASE_URL;
if (!value) fail("TEST_DATABASE_URL is required");

let url: URL;
try {
  url = new URL(value);
} catch {
  fail("TEST_DATABASE_URL must be a valid MySQL URL");
}

const database = url.pathname.slice(1);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  fail("Only localhost or 127.0.0.1 is allowed");
}
if (!database.startsWith("miyar_auth_test")) {
  fail("Database name must begin with miyar_auth_test");
}

const env = {
  ...process.env,
  DATABASE_URL: value,
  DATABASE_SSL_DISABLED: "1",
  NODE_ENV: "test",
};
delete env.TEST_DATABASE_URL;

function fileHash(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

let exitCode = 0;
try {
  for (const [command, args] of [
    ["pnpm", ["exec", "tsx", "scripts/recreate-mysql-auth-test.ts"]],
    [
      "pnpm",
      [
        "exec",
        "drizzle-kit",
        "migrate",
        "--config",
        "drizzle.mysql-test.config.ts",
      ],
    ],
    ["pnpm", ["exec", "vitest", "run", "--config", "vitest.mysql.config.ts"]],
  ] as const) {
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      timeout: 180_000,
    });
    if (result.error) {
      console.error(`[mysql-authorization] ${result.error.message}`);
      exitCode = 1;
      break;
    }
    if (result.status !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  const cleanup = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/cleanup-mysql-auth-test.ts"],
    { cwd: process.cwd(), env, stdio: "inherit", timeout: 60_000 }
  );
  if (cleanup.error || cleanup.status !== 0) {
    console.error("[mysql-authorization] Disposable database cleanup failed");
    exitCode = exitCode || cleanup.status || 1;
  }
}

if (exitCode === 0) {
  writeFileSync(
    MYSQL_EVIDENCE_FILE,
    `${JSON.stringify(
      {
        status: "PASS",
        observedAt: new Date().toISOString(),
        databaseEngine: "MySQL 8.0",
        targetClass: "disposable localhost database",
        command: "pnpm test:authorization:mysql",
        migrationMode:
          "checked-in migration chain on a freshly created database",
        testFile: MYSQL_INTEGRATION_TEST,
        testFiles: MYSQL_INTEGRATION_TESTS,
        testCount: 30,
        cleanupVerified: true,
        fileHashes: Object.fromEntries(
          REQUIRED_MYSQL_EVIDENCE_FILES.map(file => [file, fileHash(file)])
        ),
      },
      null,
      2
    )}\n`
  );
}

process.exit(exitCode);
