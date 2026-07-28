import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import {
  EV02_BACKFILL_VERSION,
  EV02_SPEC_POLICY_VERSION,
  buildProductIdentityKey,
  buildSpecificationKey,
  exactDecimalMidpoint,
  materialCatalogCategoryToCanonical,
  materialLibraryCategoryToCanonical,
  materialLibraryTierToFinish,
  normalizeUnitBasis,
} from "./policy";

type LegacyTable = "material_library" | "materials_catalog" | "evidence_records";

export type Ev02LinkChange = {
  table: LegacyTable;
  id: number;
  previousProductId: number | null;
  productId: number;
};

export type Ev02BackfillManifest = {
  version: typeof EV02_BACKFILL_VERSION;
  databaseTarget: string;
  appliedAt: string;
  insertedProductIds: number[];
  insertedSpecificationIds: number[];
  insertedBenchmarkProposalIds: number[];
  insertedBenchmarks: Array<{
    id: number;
    specId: number;
    productId: number;
    legacyMaterialLibraryId: number;
    p25: string;
    p50: string;
    p75: string;
    weightedMean: string;
  }>;
  linkChanges: Ev02LinkChange[];
  unresolved: Array<{ table: LegacyTable; id: number; reason: string }>;
};

type LibraryRow = RowDataPacket & {
  id: number;
  productId: number | null;
  category: string;
  tier: string;
  productCode: string | null;
  productName: string;
  brand: string;
  unitLabel: string;
  priceAedMin: string | null;
  priceAedMax: string | null;
  sourceLabel: string;
  priceConfidence: "assumption" | "indicative" | "quoted";
  provenancePolicyVersion: string;
};

type CatalogRow = RowDataPacket & {
  id: number;
  productId: number | null;
  name: string;
  category: string;
};

type EvidenceRow = RowDataPacket & {
  id: number;
  productId: number | null;
  sourceRegistryId: number | null;
  platformProductKey: string | null;
  supersedesObservationId: number | null;
  itemName: string;
  category: string;
};

function emptyManifest(databaseTarget: string, appliedAt: Date): Ev02BackfillManifest {
  return {
    version: EV02_BACKFILL_VERSION,
    databaseTarget,
    appliedAt: appliedAt.toISOString(),
    insertedProductIds: [],
    insertedSpecificationIds: [],
    insertedBenchmarkProposalIds: [],
    insertedBenchmarks: [],
    linkChanges: [],
    unresolved: [],
  };
}

async function insertProduct(
  connection: PoolConnection,
  input: {
    brand: string | null;
    identityKey: string;
    productCode: string | null;
    productName: string;
    canonicalCategory: string;
    sourceRegistryId?: number | null;
  },
  manifest: Ev02BackfillManifest
): Promise<number> {
  const [result] = await connection.execute(
    `insert into product
      (identityKey, brand, productCode, productName, canonicalCategory, createdVia, sourceRegistryId)
     values (?, ?, ?, ?, ?, 'scrape_dedup', ?)`,
    [
      input.identityKey,
      input.brand,
      input.productCode,
      input.productName,
      input.canonicalCategory,
      input.sourceRegistryId ?? null,
    ]
  );
  const id = Number((result as { insertId: number }).insertId);
  manifest.insertedProductIds.push(id);
  return id;
}

async function linkProduct(
  connection: PoolConnection,
  table: LegacyTable,
  id: number,
  previousProductId: number | null,
  productId: number,
  column: "product_id" | "productId"
): Promise<void> {
  const [result] = await connection.execute(
    `update \`${table}\` set \`${column}\`=? where id=? and \`${column}\` <=> ?`,
    [productId, id, previousProductId]
  );
  if (Number((result as { affectedRows: number }).affectedRows) !== 1) {
    throw new Error(`Concurrent ${table} product link change detected for ${id}`);
  }
}

async function ensureSpecification(
  connection: PoolConnection,
  input: {
    category: string;
    finishLevel: string;
    unitBasis: string;
    geography: "uae";
  },
  manifest: Ev02BackfillManifest
): Promise<number> {
  const specKey = buildSpecificationKey(input as Parameters<typeof buildSpecificationKey>[0]);
  const [existing] = await connection.execute<RowDataPacket[]>(
    "select id from specification where specKey=? limit 1",
    [specKey]
  );
  if (existing[0]) return Number(existing[0].id);
  const [result] = await connection.execute(
    `insert into specification
      (specKey, category, finishLevel, unitBasis, geography, policyVersion)
     values (?, ?, ?, ?, ?, ?)`,
    [
      specKey,
      input.category,
      input.finishLevel,
      input.unitBasis,
      input.geography,
      EV02_SPEC_POLICY_VERSION,
    ]
  );
  const id = Number((result as { insertId: number }).insertId);
  manifest.insertedSpecificationIds.push(id);
  return id;
}

export async function applyEv02LegacyBackfill(
  connection: PoolConnection,
  options: { databaseTarget: string; now: Date }
): Promise<Ev02BackfillManifest> {
  const manifest = emptyManifest(options.databaseTarget, options.now);
  const [libraryRows] = await connection.execute<LibraryRow[]>(
    `select id, product_id as productId, category, tier, product_code as productCode,
      product_name as productName, brand, unit_label as unitLabel,
      price_aed_min as priceAedMin, price_aed_max as priceAedMax,
      source_label as sourceLabel, price_confidence as priceConfidence,
      provenance_policy_version as provenancePolicyVersion
     from material_library order by id`
  );
  for (const row of libraryRows) {
    let productId = row.productId;
    if (productId === null) {
      if (row.productCode) {
        const identityKey = buildProductIdentityKey([
          "global",
          "brand-code",
          row.brand,
          row.productCode,
        ]);
        const [matches] = await connection.execute<RowDataPacket[]>(
          "select id from product where identityKey=? limit 2",
          [identityKey]
        );
        if (matches.length > 1) throw new Error(`Ambiguous stable product identity for material_library ${row.id}`);
        productId = matches[0]
          ? Number(matches[0].id)
          : await insertProduct(connection, {
              brand: row.brand,
              identityKey,
              productCode: row.productCode,
              productName: row.productName,
              canonicalCategory: materialLibraryCategoryToCanonical(row.category),
            }, manifest);
      } else {
        productId = await insertProduct(connection, {
          brand: row.brand,
          identityKey: buildProductIdentityKey([
            "legacy",
            "material_library",
            row.id,
          ]),
          productCode: null,
          productName: row.productName,
          canonicalCategory: materialLibraryCategoryToCanonical(row.category),
        }, manifest);
      }
      await linkProduct(connection, "material_library", row.id, null, productId, "product_id");
      manifest.linkChanges.push({
        table: "material_library",
        id: row.id,
        previousProductId: null,
        productId,
      });
    }

    const finishLevel = materialLibraryTierToFinish(row.tier);
    const unitBasis = normalizeUnitBasis(row.unitLabel);
    if (!finishLevel || !unitBasis) {
      manifest.unresolved.push({
        table: "material_library",
        id: row.id,
        reason: !finishLevel ? "unknown_finish_level" : "unknown_unit_basis",
      });
      continue;
    }
    if (row.priceAedMin === null || row.priceAedMax === null) {
      manifest.unresolved.push({
        table: "material_library",
        id: row.id,
        reason: "incomplete_price_range",
      });
      continue;
    }
    const [existingBenchmark] = await connection.execute<RowDataPacket[]>(
      "select id from benchmark_proposals where legacyMaterialLibraryId=? limit 1",
      [row.id]
    );
    if (existingBenchmark[0]) continue;
    const category = materialLibraryCategoryToCanonical(row.category);
    const specId = await ensureSpecification(
      connection,
      { category, finishLevel, unitBasis, geography: "uae" },
      manifest
    );
    const midpoint = exactDecimalMidpoint(row.priceAedMin, row.priceAedMax);
    const [result] = await connection.execute(
      `insert into benchmark_proposals
       (benchmarkKey, specId, productId, priceScope, sourceKind,
        sourceLadderRung, legacyMaterialLibraryId, sourceLabel, priceConfidence,
        provenancePolicyVersion, keyPolicyVersion, proposedP25, proposedP50,
        proposedP75, weightedMean, evidenceCount, sourceDiversity,
        reliabilityDist, recencyDist, confidenceScore, impactNotes,
        recommendation, status, reviewerNotes, reviewedAt, createdAt)
       values (?, ?, ?, null, 'assumption', 'assumption', ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 0, 0, ?, ?, 0, ?, 'publish', 'approved', ?, ?, ?)`,
      [
        buildSpecificationKey({ category, finishLevel, unitBasis, geography: "uae" }),
        specId,
        productId,
        row.id,
        row.sourceLabel,
        row.priceConfidence,
        row.provenancePolicyVersion,
        EV02_BACKFILL_VERSION,
        row.priceAedMin,
        midpoint,
        row.priceAedMax,
        midpoint,
        JSON.stringify({ A: 0, B: 0, C: 0 }),
        JSON.stringify({ recent: 0, mid: 0, old: 0 }),
        "Legacy range preserved as an unknown-scope compatibility assumption.",
        "Deterministic EV-02 legacy backfill; scope was not inferable.",
        options.now,
        options.now,
      ]
    );
    const benchmarkId = Number((result as { insertId: number }).insertId);
    manifest.insertedBenchmarkProposalIds.push(benchmarkId);
    manifest.insertedBenchmarks.push({
      id: benchmarkId,
      specId,
      productId,
      legacyMaterialLibraryId: row.id,
      p25: row.priceAedMin,
      p50: midpoint,
      p75: row.priceAedMax,
      weightedMean: midpoint,
    });
  }

  const [catalogRows] = await connection.execute<CatalogRow[]>(
    "select id, productId, name, category from materials_catalog order by id"
  );
  for (const row of catalogRows) {
    if (row.productId !== null) continue;
    const productId = await insertProduct(connection, {
      brand: null,
      identityKey: buildProductIdentityKey([
        "legacy",
        "materials_catalog",
        row.id,
      ]),
      productCode: `legacy-catalog:${row.id}`,
      productName: row.name,
      canonicalCategory: materialCatalogCategoryToCanonical(row.category),
    }, manifest);
    await linkProduct(connection, "materials_catalog", row.id, null, productId, "productId");
    manifest.linkChanges.push({
      table: "materials_catalog",
      id: row.id,
      previousProductId: null,
      productId,
    });
  }

  const [evidenceRows] = await connection.execute<EvidenceRow[]>(
    `select id, productId, sourceRegistryId, platformProductKey,
      supersedesObservationId, itemName, category
     from evidence_records order by id`
  );
  const stableEvidenceProducts = new Map<string, number>();
  for (const row of evidenceRows) {
    if (row.productId !== null) continue;
    let productId: number;
    if (row.supersedesObservationId !== null) {
      const [predecessors] = await connection.execute<RowDataPacket[]>(
        "select productId from evidence_records where id=? limit 1",
        [row.supersedesObservationId]
      );
      if (!predecessors[0]?.productId) {
        throw new Error(
          `Unresolved predecessor identity for evidence_records ${row.id}`
        );
      }
      productId = Number(predecessors[0].productId);
    } else if (row.sourceRegistryId !== null && row.platformProductKey) {
      const key = `${row.sourceRegistryId}:${row.platformProductKey}`;
      const identityKey = buildProductIdentityKey([
        "global",
        "source-product",
        row.sourceRegistryId,
        row.platformProductKey,
      ]);
      const cached = stableEvidenceProducts.get(key);
      if (cached) {
        productId = cached;
      } else {
        const [matches] = await connection.execute<RowDataPacket[]>(
          "select id from product where identityKey=? limit 2",
          [identityKey]
        );
        if (matches.length > 1) throw new Error(`Ambiguous stable evidence identity ${key}`);
        productId = matches[0]
          ? Number(matches[0].id)
          : await insertProduct(connection, {
              brand: null,
              identityKey,
              productCode: row.platformProductKey,
              productName: row.itemName,
              canonicalCategory: row.category,
              sourceRegistryId: row.sourceRegistryId,
            }, manifest);
        stableEvidenceProducts.set(key, productId);
      }
    } else {
      productId = await insertProduct(connection, {
        brand: null,
        identityKey: buildProductIdentityKey([
          "legacy",
          "evidence_records",
          row.id,
        ]),
        productCode: `legacy-evidence:${row.id}`,
        productName: row.itemName,
        canonicalCategory: row.category,
        sourceRegistryId: row.sourceRegistryId,
      }, manifest);
    }
    await linkProduct(connection, "evidence_records", row.id, null, productId, "productId");
    manifest.linkChanges.push({
      table: "evidence_records",
      id: row.id,
      previousProductId: null,
      productId,
    });
  }
  return manifest;
}

export async function rollbackEv02LegacyBackfill(
  connection: PoolConnection,
  manifest: Ev02BackfillManifest,
  databaseTarget: string
): Promise<void> {
  if (manifest.version !== EV02_BACKFILL_VERSION) throw new Error("Unsupported rollback manifest");
  if (manifest.databaseTarget !== databaseTarget) throw new Error("Rollback target does not match manifest");

  // Preflight every mutable reference before changing anything. The caller
  // owns the transaction, but this also makes the helper fail closed even when
  // a caller catches the error without rolling back immediately.
  for (const link of manifest.linkChanges) {
    const column = link.table === "material_library" ? "product_id" : "productId";
    const [rows] = await connection.query<RowDataPacket[]>(
      `select \`${column}\` as productId from \`${link.table}\` where id=?`,
      [link.id]
    );
    if (rows.length !== 1 || Number(rows[0].productId) !== link.productId) {
      throw new Error(`Rollback refused: ${link.table} ${link.id} diverged`);
    }
  }
  for (const expected of manifest.insertedBenchmarks) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `select specId, productId, legacyMaterialLibraryId, proposedP25,
        proposedP50, proposedP75, weightedMean
       from benchmark_proposals where id=?`,
      [expected.id]
    );
    const row = rows[0];
    if (
      !row ||
      Number(row.specId) !== expected.specId ||
      Number(row.productId) !== expected.productId ||
      Number(row.legacyMaterialLibraryId) !== expected.legacyMaterialLibraryId ||
      row.proposedP25 !== expected.p25 ||
      row.proposedP50 !== expected.p50 ||
      row.proposedP75 !== expected.p75 ||
      row.weightedMean !== expected.weightedMean
    ) {
      throw new Error(`Rollback refused: governed value ${expected.id} diverged`);
    }
  }
  if (manifest.insertedBenchmarkProposalIds.length > 0) {
    const placeholders = manifest.insertedBenchmarkProposalIds.map(() => "?").join(",");
    const [successors] = await connection.query<RowDataPacket[]>(
      `select id from benchmark_proposals where supersedesId in (${placeholders}) limit 1`,
      manifest.insertedBenchmarkProposalIds
    );
    if (successors.length > 0) {
      throw new Error("Rollback refused: a governed value has a successor");
    }
  }
  if (manifest.insertedSpecificationIds.length > 0) {
    const placeholders = manifest.insertedSpecificationIds.map(() => "?").join(",");
    const [evidenceReferences] = await connection.query<RowDataPacket[]>(
      `select id from evidence_records where specId in (${placeholders}) limit 1`,
      manifest.insertedSpecificationIds
    );
    if (evidenceReferences.length > 0) {
      throw new Error("Rollback refused: a specification has an evidence reference");
    }
    const [otherBenchmarks] = await connection.query<RowDataPacket[]>(
      `select id from benchmark_proposals
       where specId in (${placeholders})
       and id not in (${manifest.insertedBenchmarkProposalIds.map(() => "?").join(",") || "null"})
       limit 1`,
      [
        ...manifest.insertedSpecificationIds,
        ...manifest.insertedBenchmarkProposalIds,
      ]
    );
    if (otherBenchmarks.length > 0) {
      throw new Error("Rollback refused: a specification has another governed value");
    }
  }
  for (const productId of manifest.insertedProductIds) {
    const expectedLinks = new Set(
      manifest.linkChanges
        .filter(link => link.productId === productId)
        .map(link => `${link.table}:${link.id}`)
    );
    const [legacyReferences] = await connection.query<RowDataPacket[]>(
      `select 'material_library' as sourceTable, id from material_library where product_id=?
       union all
       select 'materials_catalog' as sourceTable, id from materials_catalog where productId=?
       union all
       select 'evidence_records' as sourceTable, id from evidence_records where productId=?`,
      [productId, productId, productId]
    );
    if (
      legacyReferences.some(
        row => !expectedLinks.has(`${row.sourceTable}:${row.id}`)
      )
    ) {
      throw new Error(`Rollback refused: product ${productId} has another legacy reference`);
    }
    const expectedBenchmarkIds = new Set(
      manifest.insertedBenchmarks
        .filter(benchmark => benchmark.productId === productId)
        .map(benchmark => benchmark.id)
    );
    const [benchmarkReferences] = await connection.query<RowDataPacket[]>(
      "select id from benchmark_proposals where productId=?",
      [productId]
    );
    if (
      benchmarkReferences.some(row => !expectedBenchmarkIds.has(Number(row.id)))
    ) {
      throw new Error(`Rollback refused: product ${productId} has another governed value`);
    }
  }

  for (const link of [...manifest.linkChanges].reverse()) {
    const column = link.table === "material_library" ? "product_id" : "productId";
    const [result] = await connection.execute(
      `update \`${link.table}\` set \`${column}\`=? where id=? and \`${column}\`=?`,
      [link.previousProductId, link.id, link.productId]
    );
    if (Number((result as { affectedRows: number }).affectedRows) !== 1)
      throw new Error(`Rollback failed: ${link.table} ${link.id}`);
  }
  if (manifest.insertedBenchmarkProposalIds.length > 0) {
    const [result] = await connection.query(
      `delete from benchmark_proposals where id in (${manifest.insertedBenchmarkProposalIds.map(() => "?").join(",")})`,
      manifest.insertedBenchmarkProposalIds
    );
    if (
      Number((result as { affectedRows: number }).affectedRows) !==
      manifest.insertedBenchmarkProposalIds.length
    ) {
      throw new Error("Rollback failed to remove every governed value");
    }
  }
  if (manifest.insertedSpecificationIds.length > 0) {
    const [result] = await connection.query(
      `delete from specification where id in (${manifest.insertedSpecificationIds.map(() => "?").join(",")})`,
      manifest.insertedSpecificationIds
    );
    if (
      Number((result as { affectedRows: number }).affectedRows) !==
      manifest.insertedSpecificationIds.length
    ) throw new Error("Rollback failed to remove every specification");
  }
  if (manifest.insertedProductIds.length > 0) {
    const [result] = await connection.query(
      `delete from product where id in (${manifest.insertedProductIds.map(() => "?").join(",")})`,
      manifest.insertedProductIds
    );
    if (
      Number((result as { affectedRows: number }).affectedRows) !==
      manifest.insertedProductIds.length
    ) throw new Error("Rollback failed to remove every product");
  }
}
