import type { Connection, RowDataPacket } from "mysql2/promise";

export type Ev02SchemaColumnRow = RowDataPacket & {
  tableName: string;
  columnName: string;
  columnType: string;
  nullable: "YES" | "NO";
  columnDefault: string | null;
  extra: string;
};

export type Ev02SchemaIndexRow = RowDataPacket & {
  tableName: string;
  indexName: string;
  nonUnique: number;
  columns: string;
};

const REQUIRED_COLUMNS: Record<
  string,
  { type: string; nullable: "YES" | "NO"; default?: string | null }
> = {
  "product.identityKey": { type: "varchar(64)", nullable: "NO" },
  "product.productName": { type: "varchar(255)", nullable: "NO" },
  "product.canonicalCategory": {
    type: "enum('floors','walls','ceilings','joinery','lighting','sanitary','kitchen','hardware','ffe','other')",
    nullable: "NO",
  },
  "product.createdVia": {
    type: "enum('manual','scrape_dedup','quote_import')",
    nullable: "NO",
  },
  "specification.specKey": { type: "varchar(255)", nullable: "NO" },
  "specification.category": {
    type: "enum('floors','walls','ceilings','joinery','lighting','sanitary','kitchen','hardware','ffe','other')",
    nullable: "NO",
  },
  "specification.finishLevel": {
    type: "enum('basic','standard','premium','luxury','ultra_luxury')",
    nullable: "NO",
  },
  "specification.unitBasis": {
    type: "enum('per_piece','per_pack','per_sqm','per_lm','per_litre')",
    nullable: "NO",
  },
  "specification.geography": {
    type: "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    nullable: "NO",
  },
  "specification.policyVersion": { type: "varchar(64)", nullable: "NO" },
  "supplier_quote.orgId": { type: "int", nullable: "NO" },
  "supplier_quote.quoteRef": { type: "varchar(255)", nullable: "NO" },
  "supplier_quote.confidentiality": {
    type: "enum('internal','confidential','restricted')",
    nullable: "NO",
    default: "confidential",
  },
  "supplier_quote.supersedesId": { type: "int", nullable: "YES" },
  "benchmark_proposals.specId": { type: "int", nullable: "YES" },
  "benchmark_proposals.productId": { type: "int", nullable: "YES" },
  "benchmark_proposals.orgId": { type: "int", nullable: "YES" },
  "benchmark_proposals.priceScope": {
    type: "enum('supply_only','supply_and_install')",
    nullable: "YES",
  },
  "benchmark_proposals.sourceKind": {
    type: "enum('observed','assumption')",
    nullable: "NO",
    default: "observed",
  },
  "benchmark_proposals.sourceLadderRung": {
    type: "enum('supplier_quote','official_statistic','consultancy_benchmark','market_observation','retail_sanity','assumption')",
    nullable: "YES",
  },
  "benchmark_proposals.benchmarkVersionId": { type: "int", nullable: "YES" },
  "benchmark_proposals.supplierQuoteId": { type: "int", nullable: "YES" },
  "benchmark_proposals.supersedesId": { type: "int", nullable: "YES" },
  "benchmark_proposals.legacyMaterialLibraryId": {
    type: "int",
    nullable: "YES",
  },
  "benchmark_proposals.sourceLabel": {
    type: "varchar(255)",
    nullable: "YES",
  },
  "benchmark_proposals.priceConfidence": {
    type: "enum('assumption','indicative','quoted')",
    nullable: "YES",
  },
  "benchmark_proposals.provenancePolicyVersion": {
    type: "varchar(64)",
    nullable: "YES",
  },
  "evidence_records.productId": { type: "int", nullable: "YES" },
  "evidence_records.specId": { type: "int", nullable: "YES" },
  "evidence_records.geography": {
    type: "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    nullable: "YES",
  },
  "evidence_records.priceScope": {
    type: "enum('supply_only','supply_and_install')",
    nullable: "YES",
  },
  "evidence_records.deliveryIncluded": { type: "tinyint(1)", nullable: "YES" },
  "evidence_records.moqValue": { type: "decimal(12,3)", nullable: "YES" },
  "evidence_records.moqUnit": { type: "varchar(32)", nullable: "YES" },
  "evidence_records.leadTimeDays": { type: "int", nullable: "YES" },
  "evidence_records.wasteBasis": { type: "varchar(64)", nullable: "YES" },
  "evidence_records.observationKind": {
    type: "enum('market_listing','official_statistic','consultancy_benchmark','supplier_quote','manual')",
    nullable: "YES",
  },
  "evidence_records.supplierQuoteId": { type: "int", nullable: "YES" },
  "evidence_records.supersedesObservationId": {
    type: "int",
    nullable: "YES",
  },
  "material_library.product_id": { type: "int", nullable: "YES" },
  "materials_catalog.productId": { type: "int", nullable: "YES" },
};

const REQUIRED_INDEXES: Record<string, { unique: boolean; columns: string }> = {
  "product.PRIMARY": { unique: true, columns: "id" },
  "product.product_identity_key_unique": {
    unique: true,
    columns: "identityKey",
  },
  "product.product_scope_brand_code_idx": {
    unique: false,
    columns: "orgId,brand,productCode",
  },
  "product.product_scope_category_name_idx": {
    unique: false,
    columns: "orgId,canonicalCategory,productName",
  },
  "specification.specification_spec_key_unique": {
    unique: true,
    columns: "specKey",
  },
  "specification.PRIMARY": { unique: true, columns: "id" },
  "specification.specification_resolution_idx": {
    unique: false,
    columns: "category,finishLevel,unitBasis,geography",
  },
  "supplier_quote.supplier_quote_org_ref_unique": {
    unique: true,
    columns: "orgId,quoteRef",
  },
  "supplier_quote.PRIMARY": { unique: true, columns: "id" },
  "supplier_quote.supplier_quote_supersedes_unique": {
    unique: true,
    columns: "supersedesId",
  },
  "supplier_quote.supplier_quote_org_validity_idx": {
    unique: false,
    columns: "orgId,validUntil",
  },
  "benchmark_proposals.benchmark_proposals_supersedes_unique": {
    unique: true,
    columns: "supersedesId",
  },
  "benchmark_proposals.benchmark_proposals_legacy_library_unique": {
    unique: true,
    columns: "legacyMaterialLibraryId",
  },
  "benchmark_proposals.benchmark_proposals_governed_resolver_idx": {
    unique: false,
    columns: "specId,orgId,productId,priceScope,status,recommendation",
  },
  "benchmark_proposals.benchmark_proposals_supplier_quote_idx": {
    unique: false,
    columns: "supplierQuoteId",
  },
  "evidence_records.evidence_records_supersedes_unique": {
    unique: true,
    columns: "supersedesObservationId",
  },
  "evidence_records.evidence_records_governed_price_idx": {
    unique: false,
    columns: "specId,productId,priceScope,captureDate",
  },
  "evidence_records.evidence_records_supplier_quote_idx": {
    unique: false,
    columns: "supplierQuoteId",
  },
};

export function findEv02SchemaContractViolations(
  columnRows: Ev02SchemaColumnRow[],
  indexRows: Ev02SchemaIndexRow[]
): string[] {
  const violations: string[] = [];
  const expectedTableCounts = new Map([
    ["product", 20],
    ["specification", 9],
    ["supplier_quote", 14],
  ]);
  for (const [table, expectedCount] of Array.from(expectedTableCounts)) {
    const actualCount = columnRows.filter(
      row => row.tableName === table
    ).length;
    if (actualCount !== expectedCount) {
      violations.push(
        `column count mismatch ${table}: ${actualCount}/${expectedCount}`
      );
    }
  }
  const columns = new Map(
    columnRows.map(row => [`${row.tableName}.${row.columnName}`, row])
  );
  for (const [key, expected] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = columns.get(key);
    if (!actual) {
      violations.push(`missing column ${key}`);
      continue;
    }
    if (
      actual.columnType !== expected.type ||
      actual.nullable !== expected.nullable ||
      ("default" in expected &&
        String(actual.columnDefault) !== String(expected.default))
    ) {
      violations.push(
        `column mismatch ${key}: ${actual.columnType}/${actual.nullable}/${String(actual.columnDefault)}`
      );
    }
  }
  const indexes = new Map(
    indexRows.map(row => [`${row.tableName}.${row.indexName}`, row])
  );
  for (const [key, expected] of Object.entries(REQUIRED_INDEXES)) {
    const actual = indexes.get(key);
    if (!actual) {
      violations.push(`missing index ${key}`);
      continue;
    }
    if (
      Number(actual.nonUnique) !== (expected.unique ? 0 : 1) ||
      actual.columns !== expected.columns
    ) {
      violations.push(
        `index mismatch ${key}: ${actual.nonUnique}/${actual.columns}`
      );
    }
  }
  return violations;
}

export async function assertEv02ProductionSchemaContract(
  connection: Connection
): Promise<void> {
  const tables = Array.from(
    new Set(Object.keys(REQUIRED_COLUMNS).map(key => key.split(".")[0]))
  );
  const placeholders = tables.map(() => "?").join(",");
  const [columnRows] = await connection.query<Ev02SchemaColumnRow[]>(
    `select table_name as tableName, column_name as columnName,
      lower(column_type) as columnType, is_nullable as nullable,
      column_default as columnDefault, lower(extra) as extra
     from information_schema.columns
     where table_schema=database() and table_name in (${placeholders})`,
    tables
  );
  const [indexRows] = await connection.query<Ev02SchemaIndexRow[]>(
    `select table_name as tableName, index_name as indexName,
      min(non_unique) as nonUnique,
      group_concat(column_name order by seq_in_index separator ',') as columns
     from information_schema.statistics
     where table_schema=database() and table_name in (${placeholders})
     group by table_name,index_name`,
    tables
  );
  const violations = findEv02SchemaContractViolations(columnRows, indexRows);
  if (violations.length) {
    throw new Error(
      `EV-02 production schema contract failed: ${violations.join("; ")}`
    );
  }
}
