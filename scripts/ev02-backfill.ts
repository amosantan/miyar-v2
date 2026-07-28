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

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rollback = args.has("--rollback");
const manifestIndex = process.argv.indexOf("--manifest");
const manifestPath =
  manifestIndex >= 0 ? process.argv[manifestIndex + 1] : undefined;
if (apply && rollback) throw new Error("Choose --apply or --rollback, not both");
if ((apply || rollback) && !manifestPath) {
  throw new Error("--apply and --rollback require --manifest <path>");
}

const databaseUrl = process.env.DATABASE_URL;
const target = inspectDatabaseTarget(databaseUrl);
if (target.class !== "safe-loopback" || !target.canonical) {
  throw new Error("EV-02 backfill accepts only a disposable loopback MySQL target");
}
if (
  !target.database ||
  !/^(miyar_auth_test|miyar_test_)/.test(target.database)
) {
  throw new Error(
    "EV-02 backfill target must use a disposable miyar_auth_test* or miyar_test_* database"
  );
}
initializeDatabaseSafety("migrate", { loadDotenv: false });
const connection = await mysql.createConnection(databaseUrl!);
try {
  await connection.beginTransaction();
  if (rollback) {
    const manifest = JSON.parse(
      readFileSync(manifestPath!, "utf8")
    ) as Ev02BackfillManifest;
    await rollbackEv02LegacyBackfill(connection, manifest, target.canonical);
    await connection.commit();
    console.log(`[ev02-backfill] rollback PASS target=${target.canonical}`);
  } else {
    const manifest = await applyEv02LegacyBackfill(connection, {
      databaseTarget: target.canonical,
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
        `[ev02-backfill] apply PASS target=${target.canonical} products=${manifest.insertedProductIds.length} specifications=${manifest.insertedSpecificationIds.length} governedValues=${manifest.insertedBenchmarkProposalIds.length} unresolved=${manifest.unresolved.length}`
      );
    } else {
      await connection.rollback();
      console.log(
        `[ev02-backfill] dry-run PASS target=${target.canonical} products=${manifest.insertedProductIds.length} specifications=${manifest.insertedSpecificationIds.length} governedValues=${manifest.insertedBenchmarkProposalIds.length} unresolved=${manifest.unresolved.length}`
      );
    }
  }
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
