import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DATABASE_ENTRYPOINT_ALLOWLIST,
  auditDatabaseEntrypoints,
  formatDatabaseEntrypointAudit,
  type DatabaseEntrypointAllowlistEntry,
} from "../../scripts/audit-database-entrypoints";

const temporaryRoots: string[] = [];

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "miyar-database-audit-"));
  temporaryRoots.push(root);
  for (const [relativeFile, source] of Object.entries(files)) {
    const absoluteFile = path.join(root, relativeFile);
    mkdirSync(path.dirname(absoluteFile), { recursive: true });
    writeFileSync(absoluteFile, source);
  }
  return root;
}

function auditFixture(
  files: Record<string, string>,
  allowlist: readonly DatabaseEntrypointAllowlistEntry[] = [],
) {
  return auditDatabaseEntrypoints({
    repositoryRoot: fixture(files),
    sourceRoots: ["src"],
    allowlist,
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("database entrypoint source audit", () => {
  it("enumerates aliased mysql2 and drizzle constructors after a central preflight", () => {
    const result = auditFixture({
      "src/guarded.ts": `
        import mysql from "mysql2/promise";
        import { createPool as openPool } from "mysql2";
        import { drizzle as openDrizzle } from "drizzle-orm/mysql2";
        import { initializeDatabaseSafety as preflight } from "../server/_core/database-safety.js";

        preflight("seed");
        const connection = mysql.createConnection("mysql://localhost/miyar_test");
        const pool = openPool("mysql://localhost/miyar_test");
        const db = openDrizzle(pool);
      `,
    });

    expect(result.findings).toEqual([]);
    expect(result.entrypoints.map(entrypoint => entrypoint.kind)).toEqual([
      "mysql2.createConnection",
      "mysql2.createPool",
      "drizzle.mysql2",
    ]);
    expect(result.entrypoints.every(entrypoint => entrypoint.preflight?.operation === "seed")).toBe(
      true,
    );
  });

  it("recognizes namespace imports and assertDatabaseAccess", () => {
    const result = auditFixture({
      "src/namespace.ts": `
        import * as mysql from "mysql2/promise";
        import * as mysqlDrizzle from "drizzle-orm/mysql2";
        import { assertDatabaseAccess } from "./database-safety";

        async function open() {
          assertDatabaseAccess("integration-test");
          const pool = mysql.createPool("mysql://localhost/miyar_test");
          return mysqlDrizzle.drizzle(pool);
        }
      `,
    });

    expect(result.findings).toEqual([]);
    expect(result.entrypoints).toHaveLength(2);
    expect(result.entrypoints[0].preflight?.functionName).toBe("assertDatabaseAccess");
  });

  it("allows an operationless assertion from the central module to use the active operation", () => {
    const result = auditFixture({
      "src/active-operation.ts": `
        import mysql from "mysql2";
        import { assertDatabaseAccess } from "./database-safety";
        assertDatabaseAccess();
        mysql.createPool("mysql://localhost/miyar_local");
      `,
    });

    expect(result.findings).toEqual([]);
    expect(result.entrypoints[0].preflight?.operation).toBe("active");
  });

  it("recognizes an explicit active-operation assertion", () => {
    const result = auditFixture({
      "src/active.ts": `
        import mysql from "mysql2";
        import { assertDatabaseAccess } from "./database-safety";
        assertDatabaseAccess();
        mysql.createPool("mysql://localhost/miyar_local");
      `,
    });

    expect(result.findings).toEqual([]);
    expect(result.entrypoints[0].preflight?.operation).toBe("active");
  });

  it("rejects missing, late, unrelated, and nested-callback preflights", () => {
    const result = auditFixture({
      "src/missing.ts": `
        import mysql from "mysql2";
        mysql.createPool("mysql://localhost/miyar_test");
      `,
      "src/late.ts": `
        import mysql from "mysql2";
        import { initializeDatabaseSafety } from "./database-safety";
        mysql.createPool("mysql://localhost/miyar_test");
        initializeDatabaseSafety("serve");
      `,
      "src/unrelated.ts": `
        import mysql from "mysql2";
        const initializeDatabaseSafety = () => undefined;
        initializeDatabaseSafety("serve");
        mysql.createPool("mysql://localhost/miyar_test");
      `,
      "src/nested.ts": `
        import mysql from "mysql2";
        import { initializeDatabaseSafety } from "./database-safety";
        const prepare = () => initializeDatabaseSafety("serve");
        mysql.createPool("mysql://localhost/miyar_test");
      `,
      "src/unreachable.ts": `
        import mysql from "mysql2";
        import { initializeDatabaseSafety } from "./database-safety";
        if (false) initializeDatabaseSafety("serve");
        mysql.createPool("mysql://localhost/miyar_test");
      `,
    });

    expect(result.findings).toHaveLength(5);
    expect(result.findings.every(finding => finding.rule === "missing-preflight")).toBe(true);
  });

  it("rejects a central preflight with an unsupported or non-literal operation", () => {
    const result = auditFixture({
      "src/invalid.ts": `
        import mysql from "mysql2";
        import { initializeDatabaseSafety } from "./database-safety";
        const operation = "serve";
        initializeDatabaseSafety(operation);
        mysql.createPool("mysql://localhost/miyar_test");
      `,
      "src/unsupported.ts": `
        import mysql from "mysql2";
        import { initializeDatabaseSafety } from "./database-safety";
        initializeDatabaseSafety("write");
        mysql.createPool("mysql://localhost/miyar_test");
      `,
    });

    expect(result.findings).toHaveLength(2);
    expect(result.findings.every(finding => finding.rule === "invalid-preflight-operation")).toBe(
      true,
    );
  });

  it("keeps legacy exceptions exact by file, constructor kind, and count", () => {
    const allowlist = [
      {
        file: "src/legacy.mjs",
        constructors: ["mysql2.createConnection"],
        owner: "Test owner",
        justification: "Fixture legacy module.",
      },
    ] as const satisfies readonly DatabaseEntrypointAllowlistEntry[];
    const result = auditFixture(
      {
        "src/legacy.mjs": `
          import mysql from "mysql2/promise";
          mysql.createConnection("mysql://localhost/miyar_test");
          mysql.createConnection("mysql://localhost/miyar_test");
        `,
      },
      allowlist,
    );

    expect(result.entrypoints.map(entrypoint => entrypoint.allowlisted)).toEqual([true, false]);
    expect(result.findings).toMatchObject([{ rule: "missing-preflight" }]);
  });

  it("fails when an allowlist entry no longer matches source", () => {
    const result = auditFixture(
      { "src/safe.ts": "export {};" },
      [
        {
          file: "src/removed.mjs",
          constructors: ["mysql2.createConnection"],
          owner: "Test owner",
          justification: "Fixture stale entry.",
        },
      ],
    );

    expect(result.findings).toMatchObject([{ rule: "stale-allowlist" }]);
  });

  it("does not confuse similarly named calls from unrelated modules with database constructors", () => {
    const result = auditFixture({
      "src/unrelated-library.ts": `
        import service from "some-service";
        import { drizzle } from "some-other-service";
        service.createPool();
        service.createConnection();
        drizzle();
      `,
    });

    expect(result).toEqual({ entrypoints: [], findings: [] });
  });

  it("inventories the canonical getDb wrapper as centrally guarded", () => {
    const result = auditFixture({
      "src/wrapper.ts": `
        import * as db from "../server/db";
        import { getDb as openDatabase } from "../server/db";
        await db.getDb();
        await openDatabase();
      `,
    });

    expect(result.findings).toEqual([]);
    expect(result.entrypoints.map(entrypoint => entrypoint.kind)).toEqual([
      "miyar.getDb",
      "miyar.getDb",
    ]);
    expect(formatDatabaseEntrypointAudit(result)).toContain("central guarded wrapper");
  });

  it("keeps the repository-wide direct-connection inventory governed", () => {
    const result = auditDatabaseEntrypoints({
      repositoryRoot: path.resolve(import.meta.dirname, "../.."),
    });
    const allowlistedFiles = [...new Set(
      result.entrypoints
        .filter(entrypoint => entrypoint.allowlisted)
        .map(entrypoint => entrypoint.file)
    )];

    expect(result.findings, formatDatabaseEntrypointAudit(result)).toEqual([]);
    expect(allowlistedFiles).toEqual(DATABASE_ENTRYPOINT_ALLOWLIST.map(entry => entry.file));
  });
});
