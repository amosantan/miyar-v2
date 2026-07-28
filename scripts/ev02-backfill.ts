import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import mysql from "mysql2/promise";

import {
  initializeDatabaseSafety,
  inspectDatabaseTarget,
} from "../server/_core/database-safety";
import {
  applyEv02LegacyBackfill,
  rollbackEv02LegacyBackfill,
  type Ev02BackfillManifest,
} from "../server/engines/material-pricing/backfill";
import {
  applyEv02LegacyBackfillBulk,
  rollbackEv02LegacyBackfillBulk,
} from "../server/engines/material-pricing/backfill-bulk";
import {
  normalizeEv02ConnectionUrlForInspection,
  resolveEv02BackfillExecutionTarget,
} from "../server/engines/material-pricing/backfill-execution-target";
import { assertEv02ProductionSchemaContract } from "../server/engines/material-pricing/backfill-schema-contract";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rollback = args.has("--rollback");
function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const manifestPath = valueAfter("--manifest");
const productionTarget = valueAfter("--production-target");
const expectedMigrationSha256 = valueAfter("--expected-migration-sha256");
const approvalRef = valueAfter("--approval-ref");
const wrapperAttestation = valueAfter("--wrapper-attestation");
const writeQuiesced = args.has("--write-quiesced");
if (apply && rollback)
  throw new Error("Choose --apply or --rollback, not both");
if ((apply || rollback) && !manifestPath) {
  throw new Error("--apply and --rollback require --manifest <path>");
}

const databaseUrl = process.env.DATABASE_URL;
const target = inspectDatabaseTarget(
  normalizeEv02ConnectionUrlForInspection(databaseUrl)
);
const executionTarget = resolveEv02BackfillExecutionTarget({
  connectionTarget: target,
  productionTarget,
  expectedMigrationSha256,
  approvalRef,
  databaseApproval: process.env.MIYAR_DATABASE_APPROVAL,
  wrapperAttestation,
  environmentAttestation: process.env.EV02_PLANETSCALE_WRAPPER_ATTESTATION,
  rollback,
  writeQuiesced,
});
initializeDatabaseSafety("migrate", {
  loadDotenv: false,
  databaseUrl: executionTarget.safetyDatabaseUrl,
  approval: executionTarget.databaseApproval,
});
const connection = await mysql.createConnection({
  uri: databaseUrl!,
  connectTimeout: 15_000,
});
try {
  if (executionTarget.production) {
    await assertEv02ProductionSchemaContract(connection);
  }
  await connection.beginTransaction();
  if (rollback) {
    const manifest = JSON.parse(
      readFileSync(manifestPath!, "utf8")
    ) as Ev02BackfillManifest;
    await (executionTarget.production
      ? rollbackEv02LegacyBackfillBulk
      : rollbackEv02LegacyBackfill)(
      connection,
      manifest,
      executionTarget.manifestTarget
    );
    await connection.commit();
    console.log(
      `[ev02-backfill] rollback PASS target=${executionTarget.manifestTarget}`
    );
  } else {
    const manifest = await (executionTarget.production
      ? applyEv02LegacyBackfillBulk
      : applyEv02LegacyBackfill)(connection, {
      databaseTarget: executionTarget.manifestTarget,
      now: new Date(),
    });
    if (apply) {
      writeFileSync(manifestPath!, `${JSON.stringify(manifest, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      // Persist recovery data before commit: a process interruption after the
      // database commit must never leave applied links without a manifest.
      await connection.commit();
      console.log(
        `[ev02-backfill] apply PASS target=${executionTarget.manifestTarget} products=${manifest.insertedProductIds.length} specifications=${manifest.insertedSpecificationIds.length} governedValues=${manifest.insertedBenchmarkProposalIds.length} unresolved=${manifest.unresolved.length}`
      );
    } else {
      await connection.rollback();
      console.log(
        `[ev02-backfill] dry-run PASS target=${executionTarget.manifestTarget} products=${manifest.insertedProductIds.length} specifications=${manifest.insertedSpecificationIds.length} governedValues=${manifest.insertedBenchmarkProposalIds.length} unresolved=${manifest.unresolved.length}`
      );
    }
  }
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
