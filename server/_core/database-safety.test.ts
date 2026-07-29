import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DatabaseSafetyError,
  assertDatabaseAccess,
  evaluateDatabaseAccess,
  formatDatabaseDecision,
  initializeDatabaseSafety,
  inspectDatabaseTarget,
  resetDatabaseSafetyForTests,
  shouldStartBackgroundJobsForDecision,
} from "./database-safety";

const mysqlMocks = vi.hoisted(() => ({ createPool: vi.fn() }));
const mysqlPromiseMocks = vi.hoisted(() => ({ createConnection: vi.fn() }));

vi.mock("mysql2", () => ({
  default: { createPool: mysqlMocks.createPool },
}));

vi.mock("mysql2/promise", () => ({
  default: { createConnection: mysqlPromiseMocks.createConnection },
}));

const remoteUrl = "mysql://user:password@db.example.com:3306/miyar_dev?ssl=true";
const localUrl = "mysql://root:password@127.0.0.1:3306/miyar_local";
const testUrl = "mysql://root:password@[::1]:3306/miyar_auth_test_ci";

beforeEach(() => {
  resetDatabaseSafetyForTests();
  mysqlMocks.createPool.mockReset();
  mysqlPromiseMocks.createConnection.mockReset();
});

afterEach(() => {
  process.env.DATABASE_URL = "";
});

describe("database target inspection", () => {
  it.each([
    [undefined, "absent"],
    ["", "absent"],
    [localUrl, "safe-loopback"],
    [testUrl, "safe-loopback"],
    [remoteUrl, "remote-shared"],
  ] as const)("classifies %s as %s", (value, expected) => {
    expect(inspectDatabaseTarget(value).class).toBe(expected);
  });

  it.each([
    "postgres://user:password@db.example.com/miyar_dev",
    "mysql://user:password@0.0.0.0/miyar_dev",
    "mysql://user:password@db.example.com/",
    "mysql://user:password@db.example.com/a%2Fb",
    "mysql://user:password@db.example.com:99999/miyar_dev",
    "not-a-url",
  ])("fails closed for malformed or ambiguous target %s", value => {
    expect(inspectDatabaseTarget(value)).toMatchObject({ class: "malformed" });
  });

  it("normalizes target identity without credentials or query parameters", () => {
    expect(inspectDatabaseTarget(remoteUrl)).toMatchObject({
      canonical: "db.example.com:3306/miyar_dev",
      host: "db.example.com",
      port: 3306,
      database: "miyar_dev",
    });
  });
});

describe("profile and operation policy", () => {
  it("defaults missing profile signals to untrusted local even under NODE_ENV production", () => {
    expect(
      evaluateDatabaseAccess({ operation: "serve", databaseUrl: remoteUrl, nodeEnv: "production" })
    ).toMatchObject({
      allowed: false,
      profile: "local",
      trustedDeployment: false,
      reasonCode: "REMOTE_APPROVAL_REQUIRED",
    });
  });

  it.each(["qa", "staging", "prod"])("rejects invalid runtime profile %s", runtimeProfile => {
    expect(evaluateDatabaseAccess({ operation: "serve", runtimeProfile })).toMatchObject({
      allowed: false,
      reasonCode: "RUNTIME_PROFILE_INVALID",
    });
  });

  it("rejects contradictory test and runtime profiles", () => {
    expect(
      evaluateDatabaseAccess({ operation: "serve", nodeEnv: "test", runtimeProfile: "production" })
    ).toMatchObject({ allowed: false, reasonCode: "RUNTIME_PROFILE_MISMATCH" });
  });

  it.each([
    { vercelEnv: "production" },
    { vercel: "1", vercelEnv: "production" },
    { vercel: "1", vercelUrl: "example.vercel.app" },
    { vercel: "0", vercelEnv: "preview", vercelUrl: "example.vercel.app" },
  ])("rejects partial or spoof-prone deployment signals", signals => {
    expect(evaluateDatabaseAccess({ operation: "serve", databaseUrl: remoteUrl, ...signals })).toMatchObject({
      allowed: false,
      trustedDeployment: false,
      reasonCode: "DEPLOYMENT_IDENTITY_INVALID",
    });
  });

  it.each(["seed", "reset", "migrate", "ingest"] as const)(
    "requires a database target for %s",
    operation => {
      expect(evaluateDatabaseAccess({ operation })).toMatchObject({
        allowed: false,
        reasonCode: "DATABASE_TARGET_REQUIRED",
      });
    }
  );

  it("allows DB-free serve and unit-test operations", () => {
    expect(evaluateDatabaseAccess({ operation: "serve" })).toMatchObject({
      allowed: true,
      reasonCode: "DATABASE_DISABLED",
    });
    expect(evaluateDatabaseAccess({ operation: "unit-test" })).toMatchObject({
      allowed: true,
      reasonCode: "DATABASE_DISABLED",
    });
  });

  it("never permits a database in the unit-test operation", () => {
    expect(
      evaluateDatabaseAccess({
        operation: "unit-test",
        databaseUrl: remoteUrl,
        approval: "serve@db.example.com:3306/miyar_dev",
      })
    ).toMatchObject({ allowed: false, reasonCode: "UNIT_TEST_DATABASE_FORBIDDEN" });
  });

  it.each([
    "mysql://root:password@127.0.0.1:3306/miyar",
    "mysql://root:password@127.0.0.1:3306/production",
    "mysql://root:password@localhost:3306/miyar_test",
  ])("rejects a loopback target with the wrong profile-specific name %s", databaseUrl => {
    expect(evaluateDatabaseAccess({ operation: "serve", databaseUrl })).toMatchObject({
      allowed: false,
      reasonCode: "LOCAL_DATABASE_NAME_INVALID",
    });
  });

  it("accepts safe local and guarded integration targets", () => {
    expect(evaluateDatabaseAccess({ operation: "seed", databaseUrl: localUrl })).toMatchObject({
      allowed: true,
      reasonCode: "SAFE_LOOPBACK_ALLOWED",
    });
    expect(
      evaluateDatabaseAccess({ operation: "integration-test", databaseUrl: testUrl, nodeEnv: "test" })
    ).toMatchObject({ allowed: true, profile: "test", reasonCode: "SAFE_LOOPBACK_ALLOWED" });
  });

  it("rejects remote and wrongly named integration targets", () => {
    expect(
      evaluateDatabaseAccess({ operation: "integration-test", databaseUrl: remoteUrl, nodeEnv: "test" })
    ).toMatchObject({ allowed: false, reasonCode: "INTEGRATION_TARGET_INVALID" });
    expect(
      evaluateDatabaseAccess({ operation: "integration-test", databaseUrl: localUrl, nodeEnv: "test" })
    ).toMatchObject({ allowed: false, reasonCode: "INTEGRATION_TARGET_INVALID" });
  });
});

describe("remote target approvals", () => {
  it("requires an exact operation and target binding", () => {
    expect(
      evaluateDatabaseAccess({
        operation: "serve",
        databaseUrl: remoteUrl,
        approval: "serve@db.example.com:3306/miyar_dev",
      })
    ).toMatchObject({ allowed: true, reasonCode: "REMOTE_APPROVAL_ALLOWED" });

    expect(
      evaluateDatabaseAccess({
        operation: "migrate",
        databaseUrl: remoteUrl,
        approval: "serve@db.example.com:3306/miyar_dev",
      })
    ).toMatchObject({ allowed: false, reasonCode: "REMOTE_APPROVAL_MISMATCH" });
  });

  it.each([
    "ingest+serve@db.example.com:3306/miyar_dev",
    "serve+serve@db.example.com:3306/miyar_dev",
    "unit-test@db.example.com:3306/miyar_dev",
    "serve@127.0.0.1:3306/miyar_local",
    "serve@db.example.com/miyar_dev?ssl=true",
    "serve@db.example.com:3306/other",
  ])("rejects invalid, noncanonical, or mismatched approval %s", approval => {
    expect(
      evaluateDatabaseAccess({ operation: "serve", databaseUrl: remoteUrl, approval })
    ).toMatchObject({ allowed: false });
  });

  it("accepts canonical multi-operation approval in policy order", () => {
    expect(
      evaluateDatabaseAccess({
        operation: "ingest",
        databaseUrl: remoteUrl,
        approval: "serve+ingest@db.example.com:3306/miyar_dev",
      })
    ).toMatchObject({ allowed: true, reasonCode: "REMOTE_APPROVAL_ALLOWED" });
  });
});

describe("managed deployment policy", () => {
  const production = {
    vercel: "1",
    vercelEnv: "production",
    vercelUrl: "miyar.example.vercel.app",
  };
  const preview = {
    vercel: "1",
    vercelEnv: "preview",
    vercelUrl: "preview.example.vercel.app",
    deploymentDatabaseTarget: "db.example.com:3306/miyar_dev",
  };

  it.each(["serve", "ingest"] as const)("allows trusted production %s", operation => {
    expect(evaluateDatabaseAccess({ operation, databaseUrl: remoteUrl, ...production })).toMatchObject({
      allowed: true,
      profile: "production",
      trustedDeployment: true,
      reasonCode: "TRUSTED_PRODUCTION_TARGET",
    });
  });

  it.each(["seed", "reset", "migrate"] as const)(
    "requires exact approval for manual trusted-production %s",
    operation => {
      expect(evaluateDatabaseAccess({ operation, databaseUrl: remoteUrl, ...production })).toMatchObject({
        allowed: false,
        trustedDeployment: true,
        reasonCode: "REMOTE_APPROVAL_REQUIRED",
      });
      expect(
        evaluateDatabaseAccess({
          operation,
          databaseUrl: remoteUrl,
          approval: `${operation}@db.example.com:3306/miyar_dev`,
          ...production,
        })
      ).toMatchObject({ allowed: true, reasonCode: "REMOTE_APPROVAL_ALLOWED" });
    }
  );

  it("allows only bound preview serving by default", () => {
    expect(evaluateDatabaseAccess({ operation: "serve", databaseUrl: remoteUrl, ...preview })).toMatchObject({
      allowed: true,
      profile: "preview",
      reasonCode: "TRUSTED_PREVIEW_TARGET",
    });
    expect(evaluateDatabaseAccess({ operation: "ingest", databaseUrl: remoteUrl, ...preview })).toMatchObject({
      allowed: false,
      reasonCode: "REMOTE_APPROVAL_REQUIRED",
    });
  });

  it("rejects absent and mismatched preview bindings", () => {
    expect(
      evaluateDatabaseAccess({
        operation: "serve",
        databaseUrl: remoteUrl,
        ...preview,
        deploymentDatabaseTarget: undefined,
      })
    ).toMatchObject({ allowed: false, reasonCode: "PREVIEW_TARGET_BINDING_REQUIRED" });
    expect(
      evaluateDatabaseAccess({
        operation: "serve",
        databaseUrl: remoteUrl,
        ...preview,
        deploymentDatabaseTarget: "other.example.com:3306/miyar_dev",
      })
    ).toMatchObject({ allowed: false, reasonCode: "PREVIEW_TARGET_BINDING_MISMATCH" });
  });
});

describe("enforcement and logging", () => {
  it("keeps the standard Vitest process explicitly database-free", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.MIYAR_RUNTIME_PROFILE).toBe("test");
    expect(process.env.DATABASE_URL).toBe("");
    expect(process.env.MIYAR_DATABASE_APPROVAL).toBeUndefined();
  });

  it("ignores hostile dotenv safety controls and emits no credential fragments", () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "miyar-hostile-dotenv-"));
    const modulePath = path.resolve(import.meta.dirname, "database-safety.ts");
    writeFileSync(
      path.join(temporaryDirectory, ".env"),
      [
        "DATABASE_URL=mysql://dotenv-user:dotenv-secret@db.example.com:3306/miyar_dev",
        "MIYAR_RUNTIME_PROFILE=production",
        "MIYAR_DATABASE_APPROVAL=serve@db.example.com:3306/miyar_dev",
        "VERCEL=1",
        "VERCEL_ENV=production",
        "VERCEL_URL=spoof.example",
      ].join("\n")
    );
    const program = `
      (async () => {
        process.chdir(${JSON.stringify(temporaryDirectory)});
        const safety = await import(${JSON.stringify(modulePath)});
        try {
          safety.initializeDatabaseSafety("serve");
          process.exitCode = 2;
        } catch (error) {
          if (!(error instanceof safety.DatabaseSafetyError)) throw error;
          console.log(JSON.stringify({
            ...safety.formatDatabaseDecision(error.decision),
            approvalRemoved: process.env.MIYAR_DATABASE_APPROVAL === undefined,
          }));
        }
      })();
    `;
    const environment = { ...process.env, NODE_ENV: "development" };
    for (const key of [
      "DATABASE_URL",
      "MIYAR_RUNTIME_PROFILE",
      "MIYAR_DATABASE_APPROVAL",
      "MIYAR_DEPLOYMENT_DATABASE_TARGET",
      "VERCEL",
      "VERCEL_ENV",
      "VERCEL_URL",
    ]) delete environment[key];

    try {
      const result = spawnSync("pnpm", ["exec", "tsx", "-e", program], {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        env: environment,
        timeout: 30_000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        allowed: false,
        profile: "local",
        reasonCode: "REMOTE_APPROVAL_REQUIRED",
        approvalRemoved: true,
      });
      expect(`${result.stdout}${result.stderr}`).not.toContain("dotenv-user");
      expect(`${result.stdout}${result.stderr}`).not.toContain("dotenv-secret");
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("throws a branded safety error and reaches no pool constructor", async () => {
    process.env.DATABASE_URL = remoteUrl;
    expect(() =>
      initializeDatabaseSafety("serve", {
        databaseUrl: remoteUrl,
        runtimeProfile: "local",
        loadDotenv: false,
      })
    ).toThrow(DatabaseSafetyError);

    const { getDb } = await import("../db");
    await expect(getDb()).rejects.toBeInstanceOf(DatabaseSafetyError);
    expect(mysqlMocks.createPool).not.toHaveBeenCalled();
  });

  it("denies a direct connection script before createConnection", async () => {
    process.env.DATABASE_URL = remoteUrl;
    resetDatabaseSafetyForTests();

    await expect(import("../../scripts/check-tr03h-migration-preflight")).rejects.toBeInstanceOf(
      DatabaseSafetyError
    );
    expect(mysqlPromiseMocks.createConnection).not.toHaveBeenCalled();
  });

  it("rechecks a changed target immediately before the pool constructor", async () => {
    process.env.DATABASE_URL = testUrl;
    initializeDatabaseSafety("integration-test", { loadDotenv: false });
    process.env.DATABASE_URL = remoteUrl;

    const { getDb } = await import("../db");
    await expect(getDb()).rejects.toMatchObject({
      name: "DatabaseSafetyError",
      decision: { reasonCode: "INTEGRATION_TARGET_INVALID" },
    });
    expect(mysqlMocks.createPool).not.toHaveBeenCalled();
  });

  it("binds a provider loopback proxy to one externally approved remote migration target", () => {
    const proxyUrl = "mysql://root@127.0.0.1:3317/miyar-v2";
    const providerTarget = "aws.connect.psdb.cloud:3306/miyar-v2";
    const approval = `migrate@${providerTarget}`;
    const base = {
      operation: "migrate" as const,
      databaseUrl: proxyUrl,
      runtimeProfile: "local",
      approval,
      providerProxyDatabaseTarget: providerTarget,
    };
    expect(evaluateDatabaseAccess(base)).toMatchObject({
      allowed: true,
      reasonCode: "REMOTE_APPROVAL_ALLOWED",
    });
    expect(evaluateDatabaseAccess({ ...base, operation: "serve" }).allowed).toBe(false);
    expect(evaluateDatabaseAccess({ ...base, approval: undefined }).allowed).toBe(false);
    expect(
      evaluateDatabaseAccess({
        ...base,
        approval: "migrate@other.example:3306/miyar-v2",
      }).allowed
    ).toBe(false);
    expect(
      evaluateDatabaseAccess({
        ...base,
        providerProxyDatabaseTarget: "aws.connect.psdb.cloud:3306/other_database",
      }).allowed
    ).toBe(false);

    resetDatabaseSafetyForTests();
    process.env.DATABASE_URL = proxyUrl;
    initializeDatabaseSafety("migrate", {
      loadDotenv: false,
      databaseUrl: proxyUrl,
      runtimeProfile: "local",
      nodeEnv: "development",
      approval,
      providerProxyDatabaseTarget: providerTarget,
    });
    expect(process.env.MIYAR_DATABASE_APPROVAL).toBeUndefined();
    expect(assertDatabaseAccess("migrate")).toMatchObject({
      allowed: true,
      reasonCode: "REMOTE_APPROVAL_ALLOWED",
    });
    process.env.DATABASE_URL = "mysql://root@127.0.0.1:3317/other_database";
    expect(() => assertDatabaseAccess("migrate")).toThrow(DatabaseSafetyError);
  });

  it("defaults connection assertions to the database-free operation in Vitest", () => {
    resetDatabaseSafetyForTests();
    process.env.DATABASE_URL = testUrl;

    expect(() => assertDatabaseAccess()).toThrowError(DatabaseSafetyError);
    expect(mysqlMocks.createPool).not.toHaveBeenCalled();
  });

  it("formats only sanitized decision fields", () => {
    const result = evaluateDatabaseAccess({
      operation: "serve",
      databaseUrl: remoteUrl,
      approval: "serve@db.example.com:3306/miyar_dev",
    });
    const formatted = formatDatabaseDecision(result);
    expect(formatted).toMatchObject({
      host: "db.example.com",
      database: "miyar_dev",
      reasonCode: "REMOTE_APPROVAL_ALLOWED",
    });
    expect(JSON.stringify(formatted)).not.toContain("user");
    expect(JSON.stringify(formatted)).not.toContain("password");
    expect(JSON.stringify(formatted)).not.toContain("ssl=true");
  });

  it("starts workers only for trusted production or an explicit authorized ingest target", () => {
    const production = evaluateDatabaseAccess({
      operation: "ingest",
      databaseUrl: remoteUrl,
      vercel: "1",
      vercelEnv: "production",
      vercelUrl: "miyar.example.vercel.app",
    });
    const local = evaluateDatabaseAccess({ operation: "ingest", databaseUrl: localUrl });
    const previewServe = evaluateDatabaseAccess({
      operation: "serve",
      databaseUrl: remoteUrl,
      vercel: "1",
      vercelEnv: "preview",
      vercelUrl: "preview.example.vercel.app",
      deploymentDatabaseTarget: "db.example.com:3306/miyar_dev",
    });

    expect(shouldStartBackgroundJobsForDecision(production, undefined)).toBe(true);
    expect(shouldStartBackgroundJobsForDecision(local, undefined)).toBe(false);
    expect(shouldStartBackgroundJobsForDecision(local, "true")).toBe(true);
    expect(shouldStartBackgroundJobsForDecision(previewServe, "true")).toBe(false);
  });

  it("does not let a preview serve binding authorize ingestion", async () => {
    process.env.DATABASE_URL = remoteUrl;
    initializeDatabaseSafety("serve", {
      databaseUrl: remoteUrl,
      runtimeProfile: "preview",
      nodeEnv: "development",
      vercel: "1",
      vercelEnv: "preview",
      vercelUrl: "preview.example.vercel.app",
      deploymentDatabaseTarget: "db.example.com:3306/miyar_dev",
      loadDotenv: false,
    });

    const { runIngestion } = await import("../engines/ingestion/orchestrator");
    await expect(runIngestion([])).rejects.toMatchObject({
      name: "DatabaseSafetyError",
      decision: { operation: "ingest", reasonCode: "REMOTE_APPROVAL_REQUIRED" },
    });
    expect(mysqlMocks.createPool).not.toHaveBeenCalled();
  });
});
