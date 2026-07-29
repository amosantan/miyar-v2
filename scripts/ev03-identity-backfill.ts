import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import mysql from "mysql2/promise";

import {
  initializeDatabaseSafety,
  inspectDatabaseTarget,
} from "../server/_core/database-safety";
import {
  applyEv03IdentityBackfill,
  assertEv03MigrationSchema,
  createEv03IdentityBackfillManifest,
  normalizeEv03ConnectionUrlForInspection,
  resolveEv03BackfillExecutionTarget,
  rollbackEv03IdentityBackfill,
  type Ev03IdentityBackfillManifest,
} from "../server/engines/material-pricing/ev03-identity-backfill";

const argv = process.argv.slice(2);
const flags = new Set(argv);
const apply = flags.has("--apply");
const rollback = flags.has("--rollback");

function valueAfter(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

const manifestPath = valueAfter("--manifest");
const confirmedFingerprint = valueAfter("--confirm-fingerprint");
const productionTarget = valueAfter("--production-target");
const expectedMigrationSha256 = valueAfter("--expected-migration-sha256");
const approvalRef = valueAfter("--approval-ref");
const providerAttestation = valueAfter("--provider-attestation");
const writeQuiesced = flags.has("--write-quiesced");
const expectZeroActions = flags.has("--expect-zero-actions");
if (apply && rollback)
  throw new Error("Choose --apply or --rollback, not both");
if ((apply || rollback) && !manifestPath) {
  throw new Error("--apply and --rollback require --manifest <path>");
}
if (apply && !confirmedFingerprint) {
  throw new Error(
    "--apply requires --confirm-fingerprint <dry-run fingerprint>"
  );
}
if (expectZeroActions && (apply || rollback || !manifestPath)) {
  throw new Error(
    "--expect-zero-actions is valid only for a dry-run with --manifest"
  );
}

const databaseUrl = process.env.DATABASE_URL;
const target = inspectDatabaseTarget(
  normalizeEv03ConnectionUrlForInspection(databaseUrl)
);
const executionTarget = resolveEv03BackfillExecutionTarget({
  connectionTarget: target,
  productionTarget,
  expectedMigrationSha256,
  approvalRef,
  databaseApproval: process.env.MIYAR_DATABASE_APPROVAL,
  providerAttestation,
  environmentAttestation: process.env.EV03_PLANETSCALE_WRAPPER_ATTESTATION,
  rollback,
  writeQuiesced,
});
initializeDatabaseSafety("migrate", {
  loadDotenv: false,
  databaseUrl: executionTarget.safetyDatabaseUrl,
  approval: executionTarget.databaseApproval,
});

const migrationSource = readFileSync(
  new URL("../drizzle/0062_ev03_material_consolidation.sql", import.meta.url)
);
const migrationFingerprint = createHash("sha256")
  .update(migrationSource)
  .digest("hex");
if (
  executionTarget.production &&
  migrationFingerprint !== expectedMigrationSha256
) {
  throw new Error(
    "Production EV-03 checked-in migration differs from the approved digest"
  );
}

function assertProductionArtifactPath(
  path: string,
  options: { mustExist: boolean }
): void {
  if (!isAbsolute(path)) {
    throw new Error("Production EV-03 manifest path must be absolute");
  }
  const getUid = process.getuid;
  if (!getUid) {
    throw new Error("Production EV-03 owner-only path checks require POSIX");
  }
  const ownerUid = getUid.call(process);
  const parent = lstatSync(dirname(path));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== ownerUid ||
    (parent.mode & 0o077) !== 0
  ) {
    throw new Error(
      "Production EV-03 manifest parent must be an owner-only directory"
    );
  }
  if (options.mustExist) {
    const file = lstatSync(path);
    if (
      !file.isFile() ||
      file.isSymbolicLink() ||
      file.uid !== ownerUid ||
      (file.mode & 0o777) !== 0o600
    ) {
      throw new Error(
        "Production EV-03 manifest must be an owner-owned regular 0600 file"
      );
    }
  } else if (existsSync(path)) {
    throw new Error(`Refusing to overwrite existing EV-03 manifest: ${path}`);
  }
}

if (executionTarget.production) {
  if (!manifestPath) {
    throw new Error("Production EV-03 requires --manifest for every run");
  }
  assertProductionArtifactPath(manifestPath, {
    mustExist: apply || rollback,
  });
}

function writeManifest(
  path: string,
  manifest: Ev03IdentityBackfillManifest,
  replace: boolean
) {
  if (!replace && existsSync(path)) {
    throw new Error(`Refusing to overwrite existing EV-03 manifest: ${path}`);
  }
  const temporaryPath = `${path}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, path);
}

const connection = await mysql.createConnection({
  uri: databaseUrl!,
  connectTimeout: 15_000,
});
try {
  if (executionTarget.production) {
    await assertEv03MigrationSchema(connection);
  }
  if (rollback) {
    const manifest = JSON.parse(
      readFileSync(manifestPath!, "utf8")
    ) as Ev03IdentityBackfillManifest;
    await connection.beginTransaction();
    try {
      await rollbackEv03IdentityBackfill(
        connection,
        manifest,
        executionTarget.manifestTarget
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    console.log(
      `[ev03-identity-backfill] rollback PASS target=${executionTarget.manifestTarget} fingerprint=${manifest.recoveryFingerprint} rows=${manifest.actions.length} decisions=${manifest.decisions.length}`
    );
  } else if (apply) {
    const dryRunManifest = JSON.parse(
      readFileSync(manifestPath!, "utf8")
    ) as Ev03IdentityBackfillManifest;
    if (dryRunManifest.planFingerprint !== confirmedFingerprint) {
      throw new Error(
        "EV-03 explicit apply fingerprint does not match dry-run manifest"
      );
    }
    await connection.beginTransaction();
    try {
      const appliedManifest = await applyEv03IdentityBackfill(
        connection,
        dryRunManifest,
        {
          databaseTarget: executionTarget.manifestTarget,
          migrationFingerprint,
          now: new Date(),
        }
      );
      // Persist owner-only recovery evidence before commit so an interruption
      // cannot leave committed writes without their rollback manifest.
      writeManifest(manifestPath!, appliedManifest, true);
      await connection.commit();
      console.log(
        `[ev03-identity-backfill] apply PASS target=${executionTarget.manifestTarget} fingerprint=${appliedManifest.recoveryFingerprint} rows=${appliedManifest.actions.length} decisions=${appliedManifest.decisions.length}`
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } else {
    await connection.beginTransaction();
    try {
      const manifest = await createEv03IdentityBackfillManifest(connection, {
        databaseTarget: executionTarget.manifestTarget,
        migrationFingerprint,
        now: new Date(),
      });
      if (expectZeroActions && manifest.actions.length !== 0) {
        throw new Error(
          `EV-03 post-apply idempotency failed: ${manifest.actions.length} actions remain`
        );
      }
      await connection.rollback();
      if (manifestPath) writeManifest(manifestPath, manifest, false);
      console.log(
        `[ev03-identity-backfill] dry-run PASS target=${executionTarget.manifestTarget} fingerprint=${manifest.planFingerprint} rows=${manifest.actions.length} decisions=${manifest.decisions.length}${manifestPath ? ` manifest=${manifestPath}` : ""}`
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
