import { writeFileSync } from "node:fs";
import process from "node:process";

import mysql, { type RowDataPacket } from "mysql2/promise";

import {
  assertDatabaseAccess,
  initializeDatabaseSafety,
  inspectDatabaseTarget,
} from "../server/_core/database-safety";
import { assertEv02ProductionSchemaContract } from "../server/engines/material-pricing/backfill-schema-contract";
import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_TARGET,
  assertEv03MigrationSchema,
} from "../server/engines/material-pricing/ev03-identity-backfill";
import {
  assertEv03ComparisonConnectionTargetStable,
  resolveEv03RolloutComparisonExecutionTarget,
} from "../server/engines/material-pricing/rollout-comparison";
import {
  EXPECTED_EV02R_UNRESOLVED_ROWS,
  buildEv02rDecisionPacket,
  createEv02rSourceRowFingerprint,
  type Ev02rInventoryRow,
  type Ev02rLegacyRow,
  type Ev02rUnresolvedReason,
} from "../server/engines/material-pricing/unresolved-remediation";
import {
  materialLibraryTierToFinish,
  normalizeUnitBasis,
} from "../server/engines/material-pricing/policy";

const EXPECTED_ROWS = new Map<number, Ev02rUnresolvedReason>(
  EXPECTED_EV02R_UNRESOLVED_ROWS.map(row => [row.legacyRowId, row.reason])
);

type InventoryRow = RowDataPacket & {
  id: number;
  productId: number;
  category: string;
  tier: string;
  style: string;
  productCode: string | null;
  productName: string;
  brand: string;
  supplierName: string;
  supplierLocation: string | null;
  supplierPhone: string | null;
  unitLabel: string;
  priceAedMin: string | null;
  priceAedMax: string | null;
  notes: string | null;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  priceObservedAt: string | null;
  priceConfidence: string;
  provenancePolicyVersion: string;
  isActive: number | boolean;
  productIdentityKey: string;
  productCanonicalCategory: string;
  allocationCount: number;
  allocationProjectCount: number;
  lockedAllocationCount: number;
  storedLegacyAllocationTotalMin: string | null;
  storedLegacyAllocationTotalMax: string | null;
  finishScheduleCount: number;
  finishScheduleProjectCount: number;
  rfqLineCount: number;
  issuedRfqLineCount: number;
  storedLegacyRfqTotalMin: string | null;
  storedLegacyRfqTotalMax: string | null;
  boardLinkCount: number;
};

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const outputPath = valueAfter("--output");
const productionTarget = valueAfter("--production-target");
const expectedMigrationSha256 = valueAfter("--expected-migration-sha256");
const providerAttestation = valueAfter("--provider-attestation");
const expectedEv02ManifestSha256 = valueAfter(
  "--expected-ev02-manifest-sha256"
);
if (
  !outputPath ||
  !productionTarget ||
  !providerAttestation ||
  !expectedEv02ManifestSha256
) {
  throw new Error("EV-02R inventory is missing its bound operational inputs");
}
if (!/^[a-f0-9]{64}$/.test(expectedEv02ManifestSha256)) {
  throw new Error("EV-02R manifest digest is malformed");
}

const databaseUrl = process.env.DATABASE_URL;
const inspectionDatabaseUrl = assertEv03ComparisonConnectionTargetStable({
  initialDatabaseUrl: databaseUrl,
  currentDatabaseUrl: process.env.DATABASE_URL,
});
process.env.DATABASE_URL = inspectionDatabaseUrl;
const target = inspectDatabaseTarget(inspectionDatabaseUrl);
const executionTarget = resolveEv03RolloutComparisonExecutionTarget({
  connectionTarget: target,
  productionTarget,
  expectedMigrationSha256,
  providerAttestation,
  environmentAttestation: process.env.EV02R_PLANETSCALE_WRAPPER_ATTESTATION,
  databaseApproval: process.env.MIYAR_DATABASE_APPROVAL,
});
if (
  !executionTarget.production ||
  expectedMigrationSha256 !== EV03_MIGRATION_SHA256 ||
  productionTarget !== EV03_PRODUCTION_TARGET
) {
  throw new Error("EV-02R inventory requires the exact governed production target");
}
initializeDatabaseSafety("migrate", {
  loadDotenv: false,
  databaseUrl: inspectionDatabaseUrl,
  approval: executionTarget.databaseApproval,
  providerProxyDatabaseTarget: executionTarget.evidenceTarget,
});

function bindCurrentDatabaseTarget(): void {
  process.env.DATABASE_URL = assertEv03ComparisonConnectionTargetStable({
    initialDatabaseUrl: databaseUrl,
    currentDatabaseUrl: process.env.DATABASE_URL,
  });
}

bindCurrentDatabaseTarget();
assertDatabaseAccess("migrate");
const connection = await mysql.createConnection({
  uri: databaseUrl!,
  connectTimeout: 15_000,
});
try {
  bindCurrentDatabaseTarget();
  assertDatabaseAccess("migrate");
  await assertEv02ProductionSchemaContract(connection);
  await assertEv03MigrationSchema(connection);
  bindCurrentDatabaseTarget();
  assertDatabaseAccess("migrate");
  const ids = [...EXPECTED_ROWS.keys()];
  const [rows] = await connection.query<InventoryRow[]>({
    sql: `select
      ml.id,
      ml.product_id as productId,
      ml.category,
      ml.tier,
      ml.style,
      ml.product_code as productCode,
      ml.product_name as productName,
      ml.brand,
      ml.supplier_name as supplierName,
      ml.supplier_location as supplierLocation,
      ml.supplier_phone as supplierPhone,
      ml.unit_label as unitLabel,
      ml.price_aed_min as priceAedMin,
      ml.price_aed_max as priceAedMax,
      ml.notes,
      ml.source_type as sourceType,
      ml.source_label as sourceLabel,
      ml.source_url as sourceUrl,
      ml.price_observed_at as priceObservedAt,
      ml.price_confidence as priceConfidence,
      ml.provenance_policy_version as provenancePolicyVersion,
      ml.is_active as isActive,
      p.identityKey as productIdentityKey,
      p.canonicalCategory as productCanonicalCategory,
      (select count(*) from material_allocations ma
        where ma.materialLibraryId=ml.id) as allocationCount,
      (select count(distinct ma.projectId) from material_allocations ma
        where ma.materialLibraryId=ml.id) as allocationProjectCount,
      (select count(*) from material_allocations ma
        where ma.materialLibraryId=ml.id and ma.isLocked=1) as lockedAllocationCount,
      (select cast(sum(ma.totalCostMin) as char) from material_allocations ma
        where ma.materialLibraryId=ml.id) as storedLegacyAllocationTotalMin,
      (select cast(sum(ma.totalCostMax) as char) from material_allocations ma
        where ma.materialLibraryId=ml.id) as storedLegacyAllocationTotalMax,
      (select count(*) from finish_schedule_items fsi
        where fsi.material_library_id=ml.id) as finishScheduleCount,
      (select count(distinct fsi.project_id) from finish_schedule_items fsi
        where fsi.material_library_id=ml.id) as finishScheduleProjectCount,
      (select count(*) from rfq_line_items rli
        where rli.product_id=ml.product_id) as rfqLineCount,
      (select count(*) from rfq_line_items rli
        where rli.product_id=ml.product_id and rli.artifact_state='issued')
        as issuedRfqLineCount,
      (select cast(sum(rli.total_aed_min) as char) from rfq_line_items rli
        where rli.product_id=ml.product_id) as storedLegacyRfqTotalMin,
      (select cast(sum(rli.total_aed_max) as char) from rfq_line_items rli
        where rli.product_id=ml.product_id) as storedLegacyRfqTotalMax,
      (select count(*) from materials_to_boards mtb
        where mtb.productId=ml.product_id) as boardLinkCount
      from material_library ml
      join product p on p.id=ml.product_id and p.orgId is null
      where ml.id in (${ids.map(() => "?").join(",")})
      order by ml.id`,
    values: ids,
    timeout: 30_000,
  });

  if (rows.length !== EXPECTED_ROWS.size) {
    throw new Error("EV-02R production inventory row count changed");
  }
  const normalizedRows: Ev02rInventoryRow[] = rows.map(row => {
    const unresolvedReason = EXPECTED_ROWS.get(Number(row.id));
    if (!unresolvedReason) {
      throw new Error("EV-02R production inventory contains an unexpected row");
    }
    if (!row.productId || !row.productIdentityKey) {
      throw new Error("EV-02R unresolved row lacks its EV-02 product identity");
    }
    const finishLevel = materialLibraryTierToFinish(row.tier);
    const unitBasis = normalizeUnitBasis(row.unitLabel);
    if (
      unresolvedReason === "unknown_unit_basis" &&
      (!finishLevel ||
        unitBasis !== null ||
        !row.priceAedMin ||
        !row.priceAedMax)
    ) {
      throw new Error("EV-02R unresolved reason no longer matches live row");
    }
    if (
      unresolvedReason === "incomplete_price_range" &&
      (!finishLevel ||
        unitBasis === null ||
        (row.priceAedMin !== null && row.priceAedMax !== null))
    ) {
      throw new Error("EV-02R incomplete range is no longer incomplete");
    }
    const sourceRow: Ev02rLegacyRow = {
      id: Number(row.id),
      productId: Number(row.productId),
      category: String(row.category),
      tier: String(row.tier),
      style: String(row.style),
      productCode: row.productCode,
      productName: String(row.productName),
      brand: String(row.brand),
      supplierName: String(row.supplierName),
      supplierLocation: row.supplierLocation,
      supplierPhone: row.supplierPhone,
      unitLabel: String(row.unitLabel),
      priceAedMin: row.priceAedMin,
      priceAedMax: row.priceAedMax,
      notes: row.notes,
      sourceType: String(row.sourceType),
      sourceLabel: String(row.sourceLabel),
      sourceUrl: row.sourceUrl,
      priceObservedAt: row.priceObservedAt,
      priceConfidence: String(row.priceConfidence),
      provenancePolicyVersion: String(row.provenancePolicyVersion),
      isActive: Boolean(row.isActive),
      productIdentityKey: String(row.productIdentityKey),
      productCanonicalCategory: String(row.productCanonicalCategory),
    };
    const legacyUsageSnapshot = {
      allocationCount: Number(row.allocationCount),
      allocationProjectCount: Number(row.allocationProjectCount),
      lockedAllocationCount: Number(row.lockedAllocationCount),
      storedLegacyAllocationTotalMin: row.storedLegacyAllocationTotalMin,
      storedLegacyAllocationTotalMax: row.storedLegacyAllocationTotalMax,
      finishScheduleCount: Number(row.finishScheduleCount),
      finishScheduleProjectCount: Number(row.finishScheduleProjectCount),
      rfqLineCount: Number(row.rfqLineCount),
      issuedRfqLineCount: Number(row.issuedRfqLineCount),
      storedLegacyRfqTotalMin: row.storedLegacyRfqTotalMin,
      storedLegacyRfqTotalMax: row.storedLegacyRfqTotalMax,
      boardLinkCount: Number(row.boardLinkCount),
    };
    const downstreamConsumers = [
      legacyUsageSnapshot.allocationCount > 0 ? "material_allocations" : null,
      legacyUsageSnapshot.finishScheduleCount > 0
        ? "finish_schedule_items"
        : null,
      legacyUsageSnapshot.rfqLineCount > 0 ? "rfq_line_items" : null,
      legacyUsageSnapshot.boardLinkCount > 0 ? "materials_to_boards" : null,
    ].filter((value): value is string => value !== null);
    if (downstreamConsumers.length === 0) {
      downstreamConsumers.push("material_library_browse");
    }
    return {
      legacyRowId: Number(row.id),
      unresolvedReason,
      legacyRow: sourceRow,
      sourceRowFingerprint: createEv02rSourceRowFingerprint(sourceRow),
      currentProductLink: {
        productId: Number(row.productId),
        identityKey: String(row.productIdentityKey),
      },
      legacyProvenance: {
        sourceLabel: String(row.sourceLabel),
        sourceUrl: row.sourceUrl,
        provenancePolicyVersion: String(row.provenancePolicyVersion),
      },
      usageImpact: {
        downstreamConsumers,
        governedFinancialImpact:
          "Unavailable until unit, scope, geography, and a complete governed value are approved.",
        currentEligibility: "insufficient",
        legacyUsageSnapshot,
      },
      proposedResolution: null,
      decision: "needs_evidence",
      decisionReason:
        "Authoritative supplier or manufacturer evidence has not yet been reviewed.",
    };
  });

  const decisionPacket = buildEv02rDecisionPacket(normalizedRows);
  const inventory = {
    version: "ev02r-inventory-v1",
    databaseTarget: executionTarget.evidenceTarget,
    generatedAt: new Date().toISOString(),
    ev02ManifestSha256: expectedEv02ManifestSha256,
    rowCount: normalizedRows.length,
    unknownUnitBasisCount: normalizedRows.filter(
      row => row.unresolvedReason === "unknown_unit_basis"
    ).length,
    incompletePriceRangeCount: normalizedRows.filter(
      row => row.unresolvedReason === "incomplete_price_range"
    ).length,
    decisionPacketSha256: decisionPacket.sha256,
    decisionPacket: decisionPacket.packet,
  };
  writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    `[ev02r-inventory] PASS target=${executionTarget.evidenceTarget} rows=${inventory.rowCount} unknownUnit=${inventory.unknownUnitBasisCount} incompleteRange=${inventory.incompletePriceRangeCount} digest=${inventory.decisionPacketSha256}`
  );
} finally {
  await connection.end();
}
