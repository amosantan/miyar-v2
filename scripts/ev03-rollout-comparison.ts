import { existsSync, lstatSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

import {
  assertEv03MigrationSchema,
  normalizeEv03ConnectionUrlForInspection,
} from "../server/engines/material-pricing/ev03-identity-backfill";
import {
  assertDatabaseAccess,
  initializeDatabaseSafety,
  inspectDatabaseTarget,
} from "../server/_core/database-safety";
import { resolveGovernedMaterialPriceSnapshotsForRolloutEvidence } from "../server/engines/material-pricing/material-resolution";
import { createGlobalMaterialResolutionEvidenceDataSource } from "../server/db/material-pricing";
import {
  assertMaterialPricingComparisonEvidence,
  buildMaterialPricingComparisonEvidence,
  resolveEv03RolloutComparisonExecutionTarget,
  type LegacyPriceRange,
} from "../server/engines/material-pricing/rollout-comparison";

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const outputPath = valueAfter("--output");
const productionTarget = valueAfter("--production-target");
const expectedMigrationSha256 = valueAfter("--expected-migration-sha256");
const providerAttestation = valueAfter("--provider-attestation");
const databaseUrl = process.env.DATABASE_URL;
const inspectionDatabaseUrl =
  normalizeEv03ConnectionUrlForInspection(databaseUrl);
const target = inspectDatabaseTarget(inspectionDatabaseUrl);
const executionTarget = resolveEv03RolloutComparisonExecutionTarget({
  connectionTarget: target,
  productionTarget,
  expectedMigrationSha256,
  providerAttestation,
  environmentAttestation: process.env.EV03_PLANETSCALE_WRAPPER_ATTESTATION,
  databaseApproval: process.env.MIYAR_DATABASE_APPROVAL,
});
if (executionTarget.production) {
  initializeDatabaseSafety("migrate", {
    loadDotenv: false,
    databaseUrl: inspectionDatabaseUrl,
    approval: executionTarget.databaseApproval,
    providerProxyDatabaseTarget: executionTarget.evidenceTarget,
  });
} else {
  initializeDatabaseSafety("integration-test", {
    loadDotenv: false,
    databaseUrl: inspectionDatabaseUrl,
  });
}

function assertProductionEvidencePath(path: string | undefined): string {
  if (!path || !isAbsolute(path)) {
    throw new Error(
      "Production EV-03 comparison requires an absolute --output"
    );
  }
  if (existsSync(path)) {
    throw new Error(`Refusing to overwrite EV-03 comparison evidence: ${path}`);
  }
  const getUid = process.getuid;
  if (!getUid) {
    throw new Error("Production EV-03 owner-only path checks require POSIX");
  }
  const parent = lstatSync(dirname(path));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== getUid.call(process) ||
    (parent.mode & 0o077) !== 0
  ) {
    throw new Error(
      "Production EV-03 evidence parent must be an owner-only directory"
    );
  }
  return path;
}

if (executionTarget.production) {
  assertProductionEvidencePath(outputPath);
}

type EligibleRow = RowDataPacket & {
  legacyId: number;
  priceMin: string;
  priceMax: string;
};

const ELIGIBLE_EV02_LINKED_ASSUMPTIONS_SQL = `
  select ml.id as legacyId,
    ml.price_aed_min as priceMin,
    ml.price_aed_max as priceMax
  from material_library ml
  inner join benchmark_proposals bp
    on bp.legacyMaterialLibraryId=ml.id
   and bp.productId=ml.product_id
  where ml.product_id is not null
    and ml.price_aed_min is not null
    and ml.price_aed_max is not null
    and bp.sourceKind='assumption'
    and bp.sourceLadderRung='assumption'
    and bp.orgId is null
    and bp.priceScope is null
    and bp.keyPolicyVersion='ev02-backfill-v1'
    and bp.status='approved'
    and bp.recommendation='publish'
  order by ml.id`;

async function createProductionReader() {
  assertDatabaseAccess("migrate");
  const connection = await mysql.createConnection({
    uri: databaseUrl!,
    connectTimeout: 15_000,
  });
  assertDatabaseAccess("migrate");
  return { connection, evidenceDatabase: drizzle(connection) };
}

async function createDisposableReader() {
  assertDatabaseAccess("integration-test");
  const connection = await mysql.createConnection({
    uri: databaseUrl!,
    connectTimeout: 15_000,
  });
  assertDatabaseAccess("integration-test");
  return { connection, evidenceDatabase: drizzle(connection) };
}

const { connection, evidenceDatabase } = executionTarget.production
  ? await createProductionReader()
  : await createDisposableReader();
try {
  if (executionTarget.production) {
    await assertEv03MigrationSchema(connection);
  }
  const [rows] = await connection.query<EligibleRow[]>({
    sql: ELIGIBLE_EV02_LINKED_ASSUMPTIONS_SQL,
    timeout: 30_000,
  });
  const legacyRanges: LegacyPriceRange[] = rows.map(row => ({
    reference: {
      source: "material_library",
      legacyId: Number(row.legacyId),
    },
    priceMin: String(row.priceMin),
    priceMax: String(row.priceMax),
  }));
  if (legacyRanges.length === 0) {
    throw new Error("No eligible EV-02 linked legacy assumptions were found");
  }
  const asOf = new Date();
  const snapshots =
    await resolveGovernedMaterialPriceSnapshotsForRolloutEvidence(
      {
        references: legacyRanges.map(range => range.reference),
        // The evidence-only resolver uses dedicated global product/proposal
        // queries; organization zero is never treated as a tenant scope.
        organizationId: 0,
        priceScope: "supply_only",
        requestedGeography: "uae",
        asOf,
        allowLegacyUnknownScope: true,
        evidencePurpose: "ev03-full-eligible-comparison",
      },
      createGlobalMaterialResolutionEvidenceDataSource(evidenceDatabase)
    );
  const [rowsAfterResolution] = await connection.query<EligibleRow[]>({
    sql: ELIGIBLE_EV02_LINKED_ASSUMPTIONS_SQL,
    timeout: 30_000,
  });
  if (JSON.stringify(rowsAfterResolution) !== JSON.stringify(rows)) {
    throw new Error(
      "Eligible EV-02 source set changed during rollout comparison"
    );
  }
  const evidence = buildMaterialPricingComparisonEvidence({
    legacyRanges,
    snapshots,
    generatedAt: asOf,
  });
  assertMaterialPricingComparisonEvidence(evidence);
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (outputPath) {
    writeFileSync(outputPath, serialized, { flag: "wx", mode: 0o600 });
  }
  console.log(
    `[ev03-rollout-comparison] PASS target=${executionTarget.evidenceTarget} eligible=${evidence.eligibleRowCount} equal=${evidence.equalRowCount} different=${evidence.differentRowCount} insufficient=${evidence.insufficientRowCount} digest=${evidence.evidenceDigest}`
  );
} finally {
  await connection.end();
}
