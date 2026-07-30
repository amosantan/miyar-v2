import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  EV02_MIGRATION_SHA256,
  EV02_PRODUCTION_DATABASE_TARGET,
} from "../server/engines/material-pricing/backfill-execution-target";
import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
} from "../server/engines/material-pricing/ev03-identity-backfill";
import {
  EXPECTED_EV02R_UNRESOLVED_ROWS,
  buildEv02rDecisionPacket,
  createEv02rSourceRowFingerprint,
  type Ev02rInventoryRow,
} from "../server/engines/material-pricing/unresolved-remediation";

const TRUSTED_MANIFEST_DIGEST =
  "d39ffebeedca686e4f0fa35c22b3d27ac246b2493f9f0595f05616cfcffc7508";
const wrapperUrl = new URL("./ev02r-planetscale-inventory.ts", import.meta.url);
const readerUrl = new URL("./ev02r-inventory.ts", import.meta.url);

function fixtureInventory(): Ev02rInventoryRow[] {
  return EXPECTED_EV02R_UNRESOLVED_ROWS.map(expected => {
    const legacyRow = {
      id: expected.legacyRowId,
      productId: expected.legacyRowId + 1_000,
      productName: `Legacy ${expected.legacyRowId}`,
      priceAedMin: "10",
      priceAedMax:
        expected.reason === "incomplete_price_range" ? null : "20",
      unitLabel:
        expected.reason === "unknown_unit_basis" ? "unknown" : "sqm",
    } as const;
    return {
      legacyRowId: expected.legacyRowId,
      unresolvedReason: expected.reason,
      legacyRow,
      sourceRowFingerprint: createEv02rSourceRowFingerprint(legacyRow),
      currentProductLink: {
        productId: expected.legacyRowId + 1_000,
        identityKey: `legacy:${expected.legacyRowId}`,
      },
      legacyProvenance: {
        sourceLabel: "MIYAR legacy assumption",
        sourceUrl: null,
        provenancePolicyVersion: "legacy-v0",
      },
      usageImpact: {
        downstreamConsumers: ["material_library_browse"],
        governedFinancialImpact: "Unavailable pending governed evidence.",
        currentEligibility: "insufficient",
      },
      proposedResolution: null,
      decision: "needs_evidence",
      decisionReason: "Authoritative evidence has not been approved.",
    };
  });
}

function sourceManifestBytes(): Buffer {
  return Buffer.from(
    JSON.stringify({
      version: "ev02-backfill-v1",
      databaseTarget: EV02_PRODUCTION_DATABASE_TARGET,
      appliedAt: "2026-07-28T20:34:26.493Z",
      unresolved: EXPECTED_EV02R_UNRESOLVED_ROWS.map(row => ({
        table: "material_library",
        id: row.legacyRowId,
        reason: row.reason,
      })),
    })
  );
}

function derivedWrapper(root: string, manifestDigest: string): string {
  const workspace = process.cwd();
  const serverUrl = `${pathToFileURL(join(workspace, "server")).href}/`;
  return readFileSync(wrapperUrl, "utf8")
    .replace(TRUSTED_MANIFEST_DIGEST, manifestDigest)
    .replaceAll('from "../server/', `from "${serverUrl}`)
    .replace(
      "../drizzle/0061_ev02_evidence_price_schema.sql",
      pathToFileURL(
        join(workspace, "drizzle/0061_ev02_evidence_price_schema.sql")
      ).href
    )
    .replace(
      "../drizzle/0062_ev03_material_consolidation.sql",
      pathToFileURL(
        join(workspace, "drizzle/0062_ev03_material_consolidation.sql")
      ).href
    );
}

function runFakeProvider(mode: "failure" | "success") {
  const root = mkdtempSync(join(tmpdir(), `miyar-ev02r-${mode}-`));
  const bin = join(root, "bin");
  const evidence = join(root, "evidence");
  mkdirSync(bin, { mode: 0o700 });
  mkdirSync(evidence, { mode: 0o700 });
  const output = join(evidence, "inventory.json");
  const manifest = join(root, "ev02-manifest.json");
  const manifestBytes = sourceManifestBytes();
  writeFileSync(manifest, manifestBytes, { mode: 0o600 });
  const manifestDigest = createHash("sha256").update(manifestBytes).digest("hex");
  const derived = join(root, "ev02r-wrapper.mts");
  writeFileSync(derived, derivedWrapper(root, manifestDigest), { mode: 0o600 });

  const packet = buildEv02rDecisionPacket(fixtureInventory());
  const artifact = {
    version: "ev02r-inventory-v1",
    databaseTarget: EV03_PRODUCTION_DATABASE_TARGET,
    generatedAt: "2026-07-30T10:00:00.000Z",
    ev02ManifestSha256: manifestDigest,
    rowCount: 43,
    unknownUnitBasisCount: 37,
    incompletePriceRangeCount: 6,
    decisionPacketSha256: packet.sha256,
    decisionPacket: packet.packet,
  };
  const pscale = join(bin, "pscale");
  writeFileSync(
    pscale,
    `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "auth") {
  process.stdout.write(JSON.stringify({ authenticated: true, organization: "amr-saleh-hotmail" }));
  process.exit(0);
}
if (args[0] === "deploy-request") {
  const request = Number(args[3]);
  process.stdout.write(JSON.stringify({
    into_branch: "main",
    deployment_state: "complete",
    notes: request <= 15 ? "${EV02_MIGRATION_SHA256}" : "${EV03_MIGRATION_SHA256}"
  }));
  process.exit(0);
}
if (args[0] === "connect") {
  if (args[args.indexOf("--role") + 1] !== "reader") process.exit(8);
  const command = args[args.indexOf("--execute") + 1] ?? "";
  const match = command.match(/--output ([^ ]+)/);
  if (!match) process.exit(7);
  writeFileSync(match[1], ${JSON.stringify(JSON.stringify(artifact))}, { flag: "wx", mode: 0o600 });
  if (${JSON.stringify(mode)} === "failure") process.exit(9);
  process.stdout.write("[ev02r-inventory] PASS target=${EV03_PRODUCTION_DATABASE_TARGET} rows=43 unknownUnit=37 incompleteRange=6 digest=${packet.sha256}\\n");
  process.exit(0);
}
process.exit(2);
`,
    { mode: 0o700 }
  );
  chmodSync(pscale, 0o700);

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      derived,
      "--output",
      output,
      "--ev02-manifest",
      manifest,
      "--ev02-deploy-requests",
      "10,11,12,13,14,15",
      "--ev03-deploy-requests",
      "16,17,18,19,20,21",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30_000,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        HOME: process.env.HOME,
        MIYAR_DATABASE_APPROVAL: `migrate@${EV02_PRODUCTION_DATABASE_TARGET}`,
      },
    }
  );
  return { root, evidence, output, result, packet };
}

describe("EV-02R production inventory source contract", () => {
  it("binds the exact trusted EV-02 manifest metadata, digest, and 43-row set", () => {
    const wrapper = readFileSync(wrapperUrl, "utf8");
    expect(wrapper).toContain(`"${TRUSTED_MANIFEST_DIGEST}"`);
    expect(wrapper).toContain(
      'ev02Manifest.version !== "ev02-backfill-v1"'
    );
    expect(wrapper).toContain(
      "ev02Manifest.databaseTarget !== EV02_PRODUCTION_DATABASE_TARGET"
    );
    expect(wrapper).toContain(
      'ev02Manifest.appliedAt !== "2026-07-28T20:34:26.493Z"'
    );
    expect(wrapper).toContain("ev02Manifest.unresolved?.length !== 43");
    expect(wrapper).toContain("row.table !== \"material_library\"");
    expect(wrapper).toContain("EXPECTED_EV02R_UNRESOLVED_ROWS.find(");
    expect(wrapper).toContain("EXPECTED_EV02R_UNRESOLVED_ROWS.some(");
  });

  it("requires exact ordered EV-02 and EV-03 deploy sets and checked-out digests", () => {
    const wrapper = readFileSync(wrapperUrl, "utf8");
    expect(wrapper).toContain(
      'const REQUIRED_EV02_DEPLOY_REQUESTS = ["10", "11", "12", "13", "14", "15"]'
    );
    expect(wrapper).toContain(
      'const REQUIRED_EV03_DEPLOY_REQUESTS = ["16", "17", "18", "19", "20", "21"]'
    );
    expect(wrapper).toContain("request !== requiredRequests[index]");
    expect(wrapper).toContain("deployment.into_branch !== BRANCH");
    expect(wrapper).toContain("deployment.notes?.includes(expectedDigest)");
    expect(wrapper).toContain(
      '"../drizzle/0061_ev02_evidence_price_schema.sql"'
    );
    expect(wrapper).toContain(
      '"../drizzle/0062_ev03_material_consolidation.sql"'
    );
    expect(wrapper).toContain("migrationDigest !== expectedDigest");
  });

  it("keeps the provider tunnel reader-only and normalizes safety before access", () => {
    const wrapper = readFileSync(wrapperUrl, "utf8");
    const reader = readFileSync(readerUrl, "utf8");
    expect(wrapper).toContain('"--role",\n      "reader"');
    expect(wrapper).toContain("providerEnvironment({");
    expect(wrapper).not.toContain("PLANETSCALE_SERVICE_TOKEN");
    expect(reader).toContain(
      "process.env.DATABASE_URL = inspectionDatabaseUrl"
    );
    expect(reader.indexOf("process.env.DATABASE_URL = inspectionDatabaseUrl")).toBeLessThan(
      reader.indexOf('initializeDatabaseSafety("migrate"')
    );
    expect(reader).toContain(
      "providerProxyDatabaseTarget: executionTarget.evidenceTarget"
    );
    expect(reader).toContain("bindCurrentDatabaseTarget()");
    expect(reader).toContain('assertDatabaseAccess("migrate")');
  });

  it("asserts both schemas and validates the canonical packet before output", () => {
    const wrapper = readFileSync(wrapperUrl, "utf8");
    const reader = readFileSync(readerUrl, "utf8");
    const ev02Schema = reader.indexOf(
      "await assertEv02ProductionSchemaContract(connection)"
    );
    const ev03Schema = reader.indexOf(
      "await assertEv03MigrationSchema(connection)"
    );
    const inventoryQuery = reader.indexOf(
      "const [rows] = await connection.query<InventoryRow[]>"
    );
    expect(ev02Schema).toBeGreaterThanOrEqual(0);
    expect(ev03Schema).toBeGreaterThan(ev02Schema);
    expect(inventoryQuery).toBeGreaterThan(ev03Schema);
    expect(reader.indexOf("buildEv02rDecisionPacket(normalizedRows)")).toBeLessThan(
      reader.indexOf("writeFileSync(outputPath")
    );
    expect(wrapper).toContain(
      "buildEv02rDecisionPacket(inventory.decisionPacket.inventory)"
    );
    expect(wrapper).toContain(
      "rebuiltPacket?.sha256 !== inventory.decisionPacketSha256"
    );
    expect(wrapper).toContain('inventory.version !== "ev02r-inventory-v1"');
    expect(wrapper).toContain("canonicalizeEv02rJson(");
  });

  it("fails closed on tenant identity, activation drift, and reason drift", () => {
    const reader = readFileSync(readerUrl, "utf8");
    expect(reader).toContain(
      "join product p on p.id=ml.product_id and p.orgId is null"
    );
    expect(reader).toContain("ml.is_active as isActive");
    expect(reader).toContain("isActive: Boolean(row.isActive)");
    expect(reader).toContain("normalizeUnitBasis(row.unitLabel)");
    expect(reader).toContain("unitBasis !== null");
    expect(reader).toContain("unitBasis === null");
    expect(reader).toContain("materialLibraryTierToFinish(row.tier)");
  });

  it("uses exclusive 0600 creation and fail-closed hard-link promotion rollback", () => {
    const wrapper = readFileSync(wrapperUrl, "utf8");
    const reader = readFileSync(readerUrl, "utf8");
    expect(reader).toContain('flag: "wx"');
    expect(reader).toContain("mode: 0o600");
    expect(wrapper).toContain("(evidenceStat.mode & 0o777) !== 0o600");
    expect(wrapper).toContain("linkSync(stagingPath, outputPath)");
    expect(wrapper).toContain("unlinkSync(stagingPath)");
    expect(wrapper).toMatch(
      /catch \{\s+try \{\s+unlinkSync\(outputPath\);\s+\} catch \{/
    );
    expect(wrapper).toContain(
      'throw new Error("EV-02R inventory promotion failed")'
    );
  });

  it("executes a fake-provider child failure and accepts no staged or final artifact", () => {
    const run = runFakeProvider("failure");
    try {
      expect(run.result.status).not.toBe(0);
      expect(`${run.result.stdout}${run.result.stderr}`).not.toContain(
        "[ev02r-inventory] PASS"
      );
      expect(`${run.result.stdout}${run.result.stderr}`).toContain(
        "EV-02R reader inventory failed; no output accepted"
      );
      expect(existsSync(run.output)).toBe(false);
      expect(readdirSync(run.evidence)).toEqual([]);
    } finally {
      rmSync(run.root, { recursive: true, force: true });
    }
  });

  it("promotes an exact fake-provider artifact at mode 0600", () => {
    const run = runFakeProvider("success");
    try {
      expect(run.result.status, run.result.stderr).toBe(0);
      expect(run.result.stdout).toContain("[ev02r-inventory] PASS");
      expect(existsSync(run.output)).toBe(true);
      expect(readdirSync(run.evidence)).toEqual(["inventory.json"]);
      expect(readFileSync(run.output, "utf8")).toBe(
        `${JSON.stringify({
          version: "ev02r-inventory-v1",
          databaseTarget: EV03_PRODUCTION_DATABASE_TARGET,
          generatedAt: "2026-07-30T10:00:00.000Z",
          ev02ManifestSha256: createHash("sha256")
            .update(sourceManifestBytes())
            .digest("hex"),
          rowCount: 43,
          unknownUnitBasisCount: 37,
          incompletePriceRangeCount: 6,
          decisionPacketSha256: run.packet.sha256,
          decisionPacket: run.packet.packet,
        })}`
      );
      const mode = Number(
        spawnSync("stat", ["-f", "%Lp", run.output], {
          encoding: "utf8",
        }).stdout.trim()
      );
      expect(mode).toBe(600);
    } finally {
      rmSync(run.root, { recursive: true, force: true });
    }
  });
});
