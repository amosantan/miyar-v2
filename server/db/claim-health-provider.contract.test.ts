import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLAIM_HEALTH_V1_POLICY_MANIFEST } from "../../shared/claim-health";

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap(name => {
    const path = join(root, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

const migration = readFileSync("drizzle/0063_ev04_claim_health.sql", "utf8");
const store = readFileSync("server/db/claim-health.ts", "utf8");
const guardedRunner = readFileSync(
  "scripts/run-guarded-mysql-tests.ts",
  "utf8"
);
const evidenceContract = readFileSync(
  "scripts/tr03h-mysql-evidence-contract.ts",
  "utf8"
);

describe("EV-04 PlanetScale-compatible persistence contract", () => {
  it("uses only deployable schema primitives and no trigger/routine fallback", () => {
    expect(migration).not.toMatch(/\bCREATE\s+TRIGGER\b/i);
    expect(migration).not.toMatch(
      /\bCREATE\s+(?:PROCEDURE|FUNCTION|EVENT)\b|\bSIGNAL\s+SQLSTATE\b/i
    );
    expect(migration).toContain(
      "claim_health_policy_version_document_identity_check"
    );
    expect(migration).toContain("claim_health_snapshot_project_org_fk");
    expect(migration).toContain("claim_health_snapshot_report_project_fk");
    expect(migration).toContain("source_incident_supplier_quote_org_fk");
    expect(migration).toContain("report_public_share_snapshot_binding_fk");
    expect(migration).toContain("source_incident_event_sequence_check");
    for (const rule of CLAIM_HEALTH_V1_POLICY_MANIFEST.incidentPolicy
      .catalogue) {
      expect(migration).toContain(`'${rule.type}'`);
    }
  });

  it("keeps immutable EV-04 tables behind one closed append-only store", () => {
    const protectedSymbols = [
      "claimHealthPolicyVersions",
      "claimHealthSnapshots",
      "sourceIncidents",
      "sourceIncidentEvents",
      "reportPublicShares",
    ];
    const foreignWriters = sourceFiles("server")
      .filter(
        path =>
          path !== "server/db/claim-health.ts" && !path.endsWith(".test.ts")
      )
      .filter(path => {
        const text = readFileSync(path, "utf8");
        return protectedSymbols.some(symbol => text.includes(symbol));
      });
    expect(foreignWriters).toEqual([]);
    const cleanupStart = store.indexOf(
      "export async function cleanupEv04ClaimHealthForDisposableTest"
    );
    const cleanupEnd = store.indexOf(
      "export async function listClaimHealthBenchmarkFacts",
      cleanupStart
    );
    const cleanup = store.slice(cleanupStart, cleanupEnd);
    const productionStore =
      store.slice(0, cleanupStart) + store.slice(cleanupEnd);
    expect(cleanup).toContain("assertDisposableIncidentPersistence()");
    expect(cleanup).toContain(".delete(reportPublicShares)");
    expect(cleanup).toContain(".delete(sourceIncidentEvents)");
    expect(cleanup).toContain(".delete(claimHealthSnapshots)");
    for (const symbol of protectedSymbols.slice(0, 4)) {
      expect(productionStore).not.toContain(`.update(${symbol})`);
      expect(productionStore).not.toContain(`.delete(${symbol})`);
    }
  });

  it("runs and pins the canonical policy seed after schema migration", () => {
    const migrationIndex = guardedRunner.indexOf(
      '"drizzle.mysql-test.config.ts"'
    );
    const seedIndex = guardedRunner.indexOf(
      '"scripts/seed-ev04-claim-health-policy.ts"'
    );
    const testIndex = guardedRunner.indexOf('"vitest.mysql.config.ts"');
    expect(migrationIndex).toBeGreaterThan(-1);
    expect(seedIndex).toBeGreaterThan(migrationIndex);
    expect(testIndex).toBeGreaterThan(seedIndex);
    expect(guardedRunner).toContain("postSchemaSeed:");
    expect(evidenceContract).toContain(
      '"scripts/seed-ev04-claim-health-policy.ts"'
    );
    expect(evidenceContract).toContain('"scripts/run-guarded-mysql-tests.ts"');
  });
});
