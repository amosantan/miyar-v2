export const MYSQL_INTEGRATION_TEST =
  "tests/mysql/design-authorization.mysql.test.ts";

export const MYSQL_EVIDENCE_FILE =
  ".agent/state/TR03H_MYSQL_EVIDENCE.json";

export const REQUIRED_MYSQL_EVIDENCE_FILES = [
  MYSQL_INTEGRATION_TEST,
  "server/db.ts",
  "server/_core/trpc.ts",
  "server/_core/market-resource-access.ts",
  "server/routers.ts",
  "server/serverless/index.ts",
  "server/engines/autonomous/portfolio-engine.ts",
  "server/routers/design.ts",
  "server/routers/project.ts",
  "server/routers/scenario.ts",
  "server/routers/intelligence.ts",
  "server/routers/intake.ts",
  "server/routers/spaceProgram.ts",
  "server/routers/materialQuantity.ts",
  "server/routers/analytics.ts",
  "server/routers/autonomous.ts",
  "server/routers/market-intelligence.ts",
  "server/routers/portfolio.ts",
  "drizzle/schema.ts",
  "drizzle/0045_steady_amazoness.sql",
  "drizzle/0046_far_blob.sql",
  "scripts/run-guarded-mysql-tests.ts",
  "scripts/cleanup-mysql-auth-test.ts",
  "scripts/tr03h-mysql-evidence-contract.ts",
  "drizzle.mysql-test.config.ts",
  "vitest.mysql.config.ts",
] as const;
