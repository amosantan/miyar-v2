import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import {
  type Ev02BackfillManifest,
  type Ev02LinkChange,
} from "./backfill";
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

type ProductDescriptor = {
  identityKey: string;
  brand: string | null;
  productCode: string | null;
  productName: string;
  canonicalCategory: string;
  sourceRegistryId: number | null;
};

type ProductAssignment =
  | { kind: "id"; id: number }
  | { kind: "identity"; identityKey: string };

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

const CHUNK_SIZE = 400;

function emptyManifest(
  databaseTarget: string,
  appliedAt: Date
): Ev02BackfillManifest {
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

function chunks<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += CHUNK_SIZE) {
    result.push(values.slice(index, index + CHUNK_SIZE));
  }
  return result;
}

async function insertRows(
  connection: PoolConnection,
  prefix: string,
  rows: unknown[][]
): Promise<void> {
  for (const chunk of chunks(rows)) {
    const placeholders = chunk
      .map(row => `(${row.map(() => "?").join(",")})`)
      .join(",");
    await connection.query({
      sql: `${prefix} values ${placeholders}`,
      values: chunk.flat(),
      timeout: 30_000,
    });
  }
}

async function loadProductsByIdentity(
  connection: PoolConnection,
  identityKeys: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const chunk of chunks(identityKeys)) {
    if (chunk.length === 0) continue;
    const [rows] = await connection.query<RowDataPacket[]>({
      sql: `select id,identityKey from product
        where identityKey in (${chunk.map(() => "?").join(",")})`,
      values: chunk,
      timeout: 30_000,
    });
    for (const row of rows) {
      const key = String(row.identityKey);
      if (result.has(key)) {
        throw new Error(`Ambiguous stable product identity ${key}`);
      }
      result.set(key, Number(row.id));
    }
  }
  return result;
}

async function loadSpecificationsByKey(
  connection: PoolConnection,
  specKeys: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const chunk of chunks(specKeys)) {
    if (chunk.length === 0) continue;
    const [rows] = await connection.query<RowDataPacket[]>({
      sql: `select id,specKey from specification
        where specKey in (${chunk.map(() => "?").join(",")})`,
      values: chunk,
      timeout: 30_000,
    });
    for (const row of rows) {
      const key = String(row.specKey);
      if (result.has(key)) {
        throw new Error(`Ambiguous specification identity ${key}`);
      }
      result.set(key, Number(row.id));
    }
  }
  return result;
}

async function applyLinkChanges(
  connection: PoolConnection,
  table: "material_library" | "materials_catalog" | "evidence_records",
  column: "product_id" | "productId",
  changes: Ev02LinkChange[]
): Promise<void> {
  for (const chunk of chunks(changes)) {
    if (chunk.length === 0) continue;
    const cases = chunk.map(() => "when ? then ?").join(" ");
    const ids = chunk.map(change => change.id);
    const [result] = await connection.query({
      sql: `update \`${table}\`
        set \`${column}\` = case id ${cases} end
        where id in (${ids.map(() => "?").join(",")})
        and \`${column}\` is null`,
      values: [
        ...chunk.flatMap(change => [change.id, change.productId]),
        ...ids,
      ],
      timeout: 30_000,
    });
    if (Number((result as { affectedRows: number }).affectedRows) !== chunk.length) {
      throw new Error(`Concurrent ${table} product link change detected`);
    }
  }
}

function resolveProductId(
  assignment: ProductAssignment,
  productIds: Map<string, number>
): number {
  if (assignment.kind === "id") return assignment.id;
  const id = productIds.get(assignment.identityKey);
  if (!id) {
    throw new Error(`Missing product identity ${assignment.identityKey}`);
  }
  return id;
}

/**
 * PlanetScale-compatible set-based form of the EV-02 legacy backfill.
 *
 * It preserves the same deterministic keys and manifest contract as the
 * reference helper while reducing thousands of round trips to bounded bulk
 * statements so the whole rehearsal/apply fits Vitess' transaction limit.
 */
export async function applyEv02LegacyBackfillBulk(
  connection: PoolConnection,
  options: { databaseTarget: string; now: Date }
): Promise<Ev02BackfillManifest> {
  const manifest = emptyManifest(options.databaseTarget, options.now);
  const [libraryRows] = await connection.query<LibraryRow[]>({
    sql: `select id, product_id as productId, category, tier,
      product_code as productCode, product_name as productName, brand,
      unit_label as unitLabel, price_aed_min as priceAedMin,
      price_aed_max as priceAedMax, source_label as sourceLabel,
      price_confidence as priceConfidence,
      provenance_policy_version as provenancePolicyVersion
      from material_library order by id`,
    timeout: 30_000,
  });
  const [catalogRows] = await connection.query<CatalogRow[]>({
    sql: "select id,productId,name,category from materials_catalog order by id",
    timeout: 30_000,
  });
  const [evidenceRows] = await connection.query<EvidenceRow[]>({
    sql: `select id,productId,sourceRegistryId,platformProductKey,
      supersedesObservationId,itemName,category
      from evidence_records order by id`,
    timeout: 30_000,
  });

  const descriptors = new Map<string, ProductDescriptor>();
  const libraryAssignments = new Map<number, ProductAssignment>();
  const catalogAssignments = new Map<number, ProductAssignment>();
  const evidenceAssignments = new Map<number, ProductAssignment>();

  function register(descriptor: ProductDescriptor): ProductAssignment {
    if (!descriptors.has(descriptor.identityKey)) {
      descriptors.set(descriptor.identityKey, descriptor);
    }
    return { kind: "identity", identityKey: descriptor.identityKey };
  }

  for (const row of libraryRows) {
    if (row.productId !== null) {
      libraryAssignments.set(row.id, { kind: "id", id: row.productId });
      continue;
    }
    const identityKey = row.productCode
      ? buildProductIdentityKey([
          "global",
          "brand-code",
          row.brand,
          row.productCode,
        ])
      : buildProductIdentityKey(["legacy", "material_library", row.id]);
    libraryAssignments.set(
      row.id,
      register({
        identityKey,
        brand: row.brand,
        productCode: row.productCode,
        productName: row.productName,
        canonicalCategory: materialLibraryCategoryToCanonical(row.category),
        sourceRegistryId: null,
      })
    );
  }

  for (const row of catalogRows) {
    if (row.productId !== null) {
      catalogAssignments.set(row.id, { kind: "id", id: row.productId });
      continue;
    }
    catalogAssignments.set(
      row.id,
      register({
        identityKey: buildProductIdentityKey([
          "legacy",
          "materials_catalog",
          row.id,
        ]),
        brand: null,
        productCode: `legacy-catalog:${row.id}`,
        productName: row.name,
        canonicalCategory: materialCatalogCategoryToCanonical(row.category),
        sourceRegistryId: null,
      })
    );
  }

  const stableEvidenceAssignments = new Map<string, ProductAssignment>();
  for (const row of evidenceRows) {
    if (row.productId !== null) {
      evidenceAssignments.set(row.id, { kind: "id", id: row.productId });
      continue;
    }
    if (row.supersedesObservationId !== null) {
      const predecessor = evidenceAssignments.get(row.supersedesObservationId);
      if (!predecessor) {
        throw new Error(
          `Unresolved predecessor identity for evidence_records ${row.id}`
        );
      }
      evidenceAssignments.set(row.id, predecessor);
      continue;
    }
    if (row.sourceRegistryId !== null && row.platformProductKey) {
      const stableKey = `${row.sourceRegistryId}:${row.platformProductKey}`;
      let assignment = stableEvidenceAssignments.get(stableKey);
      if (!assignment) {
        assignment = register({
          identityKey: buildProductIdentityKey([
            "global",
            "source-product",
            row.sourceRegistryId,
            row.platformProductKey,
          ]),
          brand: null,
          productCode: row.platformProductKey,
          productName: row.itemName,
          canonicalCategory: row.category,
          sourceRegistryId: row.sourceRegistryId,
        });
        stableEvidenceAssignments.set(stableKey, assignment);
      }
      evidenceAssignments.set(row.id, assignment);
      continue;
    }
    evidenceAssignments.set(
      row.id,
      register({
        identityKey: buildProductIdentityKey([
          "legacy",
          "evidence_records",
          row.id,
        ]),
        brand: null,
        productCode: `legacy-evidence:${row.id}`,
        productName: row.itemName,
        canonicalCategory: row.category,
        sourceRegistryId: row.sourceRegistryId,
      })
    );
  }

  const identityKeys = Array.from(descriptors.keys());
  const productIds = await loadProductsByIdentity(connection, identityKeys);
  const missingProducts = identityKeys
    .filter(key => !productIds.has(key))
    .map(key => descriptors.get(key)!);
  await insertRows(
    connection,
    `insert into product
      (identityKey,brand,productCode,productName,canonicalCategory,createdVia,sourceRegistryId)`,
    missingProducts.map(product => [
      product.identityKey,
      product.brand,
      product.productCode,
      product.productName,
      product.canonicalCategory,
      "scrape_dedup",
      product.sourceRegistryId,
    ])
  );
  const insertedProducts = await loadProductsByIdentity(
    connection,
    missingProducts.map(product => product.identityKey)
  );
  for (const product of missingProducts) {
    const id = insertedProducts.get(product.identityKey);
    if (!id) throw new Error(`Inserted product missing: ${product.identityKey}`);
    productIds.set(product.identityKey, id);
    manifest.insertedProductIds.push(id);
  }

  const libraryLinks = libraryRows
    .filter(row => row.productId === null)
    .map(row => ({
      table: "material_library" as const,
      id: row.id,
      previousProductId: null,
      productId: resolveProductId(libraryAssignments.get(row.id)!, productIds),
    }));
  const catalogLinks = catalogRows
    .filter(row => row.productId === null)
    .map(row => ({
      table: "materials_catalog" as const,
      id: row.id,
      previousProductId: null,
      productId: resolveProductId(catalogAssignments.get(row.id)!, productIds),
    }));
  const evidenceLinks = evidenceRows
    .filter(row => row.productId === null)
    .map(row => ({
      table: "evidence_records" as const,
      id: row.id,
      previousProductId: null,
      productId: resolveProductId(evidenceAssignments.get(row.id)!, productIds),
    }));
  await applyLinkChanges(
    connection,
    "material_library",
    "product_id",
    libraryLinks
  );
  await applyLinkChanges(
    connection,
    "materials_catalog",
    "productId",
    catalogLinks
  );
  await applyLinkChanges(
    connection,
    "evidence_records",
    "productId",
    evidenceLinks
  );
  manifest.linkChanges.push(...libraryLinks, ...catalogLinks, ...evidenceLinks);

  const [existingBenchmarkRows] = await connection.query<RowDataPacket[]>({
    sql: `select id,legacyMaterialLibraryId from benchmark_proposals
      where legacyMaterialLibraryId is not null`,
    timeout: 30_000,
  });
  const existingBenchmarkLibraryIds = new Set(
    existingBenchmarkRows.map(row => Number(row.legacyMaterialLibraryId))
  );
  const candidateRows: Array<{
    row: LibraryRow;
    productId: number;
    category: string;
    finishLevel: string;
    unitBasis: string;
    specKey: string;
    midpoint: string;
  }> = [];
  const specificationInputs = new Map<
    string,
    { category: string; finishLevel: string; unitBasis: string }
  >();
  for (const row of libraryRows) {
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
    if (existingBenchmarkLibraryIds.has(row.id)) continue;
    const category = materialLibraryCategoryToCanonical(row.category);
    const specKey = buildSpecificationKey({
      category,
      finishLevel,
      unitBasis,
      geography: "uae",
    });
    specificationInputs.set(specKey, { category, finishLevel, unitBasis });
    candidateRows.push({
      row,
      productId: resolveProductId(libraryAssignments.get(row.id)!, productIds),
      category,
      finishLevel,
      unitBasis,
      specKey,
      midpoint: exactDecimalMidpoint(row.priceAedMin, row.priceAedMax),
    });
  }

  const specificationKeys = Array.from(specificationInputs.keys());
  const specificationIds = await loadSpecificationsByKey(
    connection,
    specificationKeys
  );
  const missingSpecificationKeys = specificationKeys.filter(
    key => !specificationIds.has(key)
  );
  await insertRows(
    connection,
    `insert into specification
      (specKey,category,finishLevel,unitBasis,geography,policyVersion)`,
    missingSpecificationKeys.map(key => {
      const spec = specificationInputs.get(key)!;
      return [
        key,
        spec.category,
        spec.finishLevel,
        spec.unitBasis,
        "uae",
        EV02_SPEC_POLICY_VERSION,
      ];
    })
  );
  const insertedSpecifications = await loadSpecificationsByKey(
    connection,
    missingSpecificationKeys
  );
  for (const key of missingSpecificationKeys) {
    const id = insertedSpecifications.get(key);
    if (!id) throw new Error(`Inserted specification missing: ${key}`);
    specificationIds.set(key, id);
    manifest.insertedSpecificationIds.push(id);
  }

  await insertRows(
    connection,
    `insert into benchmark_proposals
      (benchmarkKey,specId,productId,priceScope,sourceKind,sourceLadderRung,
       legacyMaterialLibraryId,sourceLabel,priceConfidence,
       provenancePolicyVersion,keyPolicyVersion,proposedP25,proposedP50,
       proposedP75,weightedMean,evidenceCount,sourceDiversity,reliabilityDist,
       recencyDist,confidenceScore,impactNotes,recommendation,status,
       reviewerNotes,reviewedAt,createdAt)`,
    candidateRows.map(candidate => [
      candidate.specKey,
      specificationIds.get(candidate.specKey),
      candidate.productId,
      null,
      "assumption",
      "assumption",
      candidate.row.id,
      candidate.row.sourceLabel,
      candidate.row.priceConfidence,
      candidate.row.provenancePolicyVersion,
      EV02_BACKFILL_VERSION,
      candidate.row.priceAedMin,
      candidate.midpoint,
      candidate.row.priceAedMax,
      candidate.midpoint,
      0,
      0,
      JSON.stringify({ A: 0, B: 0, C: 0 }),
      JSON.stringify({ recent: 0, mid: 0, old: 0 }),
      0,
      "Legacy range preserved as an unknown-scope compatibility assumption.",
      "publish",
      "approved",
      "Deterministic EV-02 legacy backfill; scope was not inferable.",
      options.now,
      options.now,
    ])
  );
  for (const chunk of chunks(candidateRows)) {
    const [rows] = await connection.query<RowDataPacket[]>({
      sql: `select id,specId,productId,legacyMaterialLibraryId,proposedP25,
        proposedP50,proposedP75,weightedMean
        from benchmark_proposals
        where legacyMaterialLibraryId in (${chunk.map(() => "?").join(",")})`,
      values: chunk.map(candidate => candidate.row.id),
      timeout: 30_000,
    });
    const byLegacyId = new Map(
      rows.map(row => [Number(row.legacyMaterialLibraryId), row])
    );
    for (const candidate of chunk) {
      const row = byLegacyId.get(candidate.row.id);
      if (!row) {
        throw new Error(
          `Inserted governed value missing for material_library ${candidate.row.id}`
        );
      }
      const id = Number(row.id);
      manifest.insertedBenchmarkProposalIds.push(id);
      manifest.insertedBenchmarks.push({
        id,
        specId: Number(row.specId),
        productId: Number(row.productId),
        legacyMaterialLibraryId: Number(row.legacyMaterialLibraryId),
        p25: String(row.proposedP25),
        p50: String(row.proposedP50),
        p75: String(row.proposedP75),
        weightedMean: String(row.weightedMean),
      });
    }
  }
  return manifest;
}

async function deleteIds(
  connection: PoolConnection,
  table: string,
  ids: number[]
): Promise<void> {
  for (const chunk of chunks(ids)) {
    if (chunk.length === 0) continue;
    const [result] = await connection.query({
      sql: `delete from \`${table}\`
        where id in (${chunk.map(() => "?").join(",")})`,
      values: chunk,
      timeout: 30_000,
    });
    if (Number((result as { affectedRows: number }).affectedRows) !== chunk.length) {
      throw new Error(`Rollback failed to remove every ${table} row`);
    }
  }
}

async function restoreLinkChanges(
  connection: PoolConnection,
  table: "material_library" | "materials_catalog" | "evidence_records",
  column: "product_id" | "productId",
  changes: Ev02LinkChange[]
): Promise<void> {
  for (const chunk of chunks(changes)) {
    if (chunk.length === 0) continue;
    const cases = chunk.map(() => "when ? then ?").join(" ");
    const tuples = chunk.map(() => "(?,?)").join(",");
    const [result] = await connection.query({
      sql: `update \`${table}\`
        set \`${column}\` = case id ${cases} end
        where (id,\`${column}\`) in (${tuples})`,
      values: [
        ...chunk.flatMap(change => [change.id, change.previousProductId]),
        ...chunk.flatMap(change => [change.id, change.productId]),
      ],
      timeout: 30_000,
    });
    if (Number((result as { affectedRows: number }).affectedRows) !== chunk.length) {
      throw new Error(`Rollback failed: ${table} links diverged`);
    }
  }
}

export async function rollbackEv02LegacyBackfillBulk(
  connection: PoolConnection,
  manifest: Ev02BackfillManifest,
  databaseTarget: string
): Promise<void> {
  if (manifest.version !== EV02_BACKFILL_VERSION) {
    throw new Error("Unsupported rollback manifest");
  }
  if (manifest.databaseTarget !== databaseTarget) {
    throw new Error("Rollback target does not match manifest");
  }

  const linkGroups = [
    {
      table: "material_library" as const,
      column: "product_id" as const,
      changes: manifest.linkChanges.filter(
        link => link.table === "material_library"
      ),
    },
    {
      table: "materials_catalog" as const,
      column: "productId" as const,
      changes: manifest.linkChanges.filter(
        link => link.table === "materials_catalog"
      ),
    },
    {
      table: "evidence_records" as const,
      column: "productId" as const,
      changes: manifest.linkChanges.filter(
        link => link.table === "evidence_records"
      ),
    },
  ];
  for (const group of linkGroups) {
    for (const chunk of chunks(group.changes)) {
      if (chunk.length === 0) continue;
      const [rows] = await connection.query<RowDataPacket[]>({
        sql: `select id,\`${group.column}\` as productId
          from \`${group.table}\`
          where id in (${chunk.map(() => "?").join(",")})`,
        values: chunk.map(link => link.id),
        timeout: 30_000,
      });
      const actual = new Map(
        rows.map(row => [Number(row.id), Number(row.productId)])
      );
      if (
        chunk.some(link => actual.get(link.id) !== link.productId) ||
        actual.size !== chunk.length
      ) {
        throw new Error(`Rollback refused: ${group.table} links diverged`);
      }
    }
  }

  const expectedBenchmarks = new Map(
    manifest.insertedBenchmarks.map(benchmark => [benchmark.id, benchmark])
  );
  for (const chunk of chunks(manifest.insertedBenchmarkProposalIds)) {
    if (chunk.length === 0) continue;
    const [rows] = await connection.query<RowDataPacket[]>({
      sql: `select id,specId,productId,legacyMaterialLibraryId,proposedP25,
        proposedP50,proposedP75,weightedMean
        from benchmark_proposals
        where id in (${chunk.map(() => "?").join(",")})`,
      values: chunk,
      timeout: 30_000,
    });
    if (rows.length !== chunk.length) {
      throw new Error("Rollback refused: governed values are missing");
    }
    for (const row of rows) {
      const expected = expectedBenchmarks.get(Number(row.id));
      if (
        !expected ||
        Number(row.specId) !== expected.specId ||
        Number(row.productId) !== expected.productId ||
        Number(row.legacyMaterialLibraryId) !==
          expected.legacyMaterialLibraryId ||
        String(row.proposedP25) !== expected.p25 ||
        String(row.proposedP50) !== expected.p50 ||
        String(row.proposedP75) !== expected.p75 ||
        String(row.weightedMean) !== expected.weightedMean
      ) {
        throw new Error(`Rollback refused: governed value ${row.id} diverged`);
      }
    }
    const [successors] = await connection.query<RowDataPacket[]>({
      sql: `select id from benchmark_proposals
        where supersedesId in (${chunk.map(() => "?").join(",")}) limit 1`,
      values: chunk,
      timeout: 30_000,
    });
    if (successors.length > 0) {
      throw new Error("Rollback refused: a governed value has a successor");
    }
  }

  const insertedBenchmarkIds = new Set(
    manifest.insertedBenchmarkProposalIds
  );
  for (const chunk of chunks(manifest.insertedSpecificationIds)) {
    if (chunk.length === 0) continue;
    const [evidenceReferences] = await connection.query<RowDataPacket[]>({
      sql: `select id from evidence_records
        where specId in (${chunk.map(() => "?").join(",")}) limit 1`,
      values: chunk,
      timeout: 30_000,
    });
    if (evidenceReferences.length > 0) {
      throw new Error(
        "Rollback refused: a specification has an evidence reference"
      );
    }
    const [benchmarkReferences] = await connection.query<RowDataPacket[]>({
      sql: `select id from benchmark_proposals
        where specId in (${chunk.map(() => "?").join(",")})`,
      values: chunk,
      timeout: 30_000,
    });
    if (
      benchmarkReferences.some(
        row => !insertedBenchmarkIds.has(Number(row.id))
      )
    ) {
      throw new Error(
        "Rollback refused: a specification has another governed value"
      );
    }
  }

  const expectedLegacyLinks = new Set(
    manifest.linkChanges.map(link => `${link.table}:${link.id}`)
  );
  const expectedProductBenchmarks = new Set(
    manifest.insertedBenchmarks.map(
      benchmark => `${benchmark.productId}:${benchmark.id}`
    )
  );
  for (const chunk of chunks(manifest.insertedProductIds)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "?").join(",");
    const [legacyReferences] = await connection.query<RowDataPacket[]>({
      sql: `select 'material_library' as sourceTable,id
          from material_library where product_id in (${placeholders})
        union all
        select 'materials_catalog' as sourceTable,id
          from materials_catalog where productId in (${placeholders})
        union all
        select 'evidence_records' as sourceTable,id
          from evidence_records where productId in (${placeholders})`,
      values: [...chunk, ...chunk, ...chunk],
      timeout: 30_000,
    });
    if (
      legacyReferences.some(
        row =>
          !expectedLegacyLinks.has(`${String(row.sourceTable)}:${Number(row.id)}`)
      )
    ) {
      throw new Error("Rollback refused: a product has another legacy reference");
    }
    const [benchmarkReferences] = await connection.query<RowDataPacket[]>({
      sql: `select id,productId from benchmark_proposals
        where productId in (${placeholders})`,
      values: chunk,
      timeout: 30_000,
    });
    if (
      benchmarkReferences.some(
        row =>
          !expectedProductBenchmarks.has(
            `${Number(row.productId)}:${Number(row.id)}`
          )
      )
    ) {
      throw new Error("Rollback refused: a product has another governed value");
    }
  }

  for (const group of [...linkGroups].reverse()) {
    await restoreLinkChanges(
      connection,
      group.table,
      group.column,
      [...group.changes].reverse()
    );
  }
  await deleteIds(
    connection,
    "benchmark_proposals",
    manifest.insertedBenchmarkProposalIds
  );
  await deleteIds(
    connection,
    "specification",
    manifest.insertedSpecificationIds
  );
  await deleteIds(connection, "product", manifest.insertedProductIds);
}
