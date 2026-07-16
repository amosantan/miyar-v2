export const MYSQL_INTEGRATION_TEST =
  "tests/mysql/design-authorization.mysql.test.ts";

export const MYSQL_EVIDENCE_FILE =
  ".agent/state/TR03H_MYSQL_EVIDENCE.json";

export const REQUIRED_MYSQL_EVIDENCE_FILES = [
  MYSQL_INTEGRATION_TEST,
  "server/db.ts",
  "server/routers/design.ts",
  "drizzle/schema.ts",
  "drizzle/0045_steady_amazoness.sql",
  "scripts/run-guarded-mysql-tests.ts",
  "scripts/cleanup-mysql-auth-test.ts",
  "scripts/tr03h-mysql-evidence-contract.ts",
  "drizzle.mysql-test.config.ts",
  "vitest.mysql.config.ts",
] as const;
