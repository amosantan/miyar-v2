import { createHash } from "node:crypto";

import type { Connection, RowDataPacket } from "mysql2/promise";

import {
  evaluateDatabaseAccess,
  type DatabaseTarget,
} from "../../_core/database-safety";
import {
  EV02_SPEC_POLICY_VERSION,
  buildSpecificationKey,
  materialCatalogCategoryToCanonical,
  materialCatalogTierToFinish,
  materialLibraryCategoryToCanonical,
  materialLibraryTierToFinish,
  normalizeUnitBasis,
} from "./policy";

export const EV03_IDENTITY_BACKFILL_VERSION =
  "ev03-identity-backfill-v2" as const;
export const EV03_QUERY_TIMEOUT_MS = 30_000;
export const EV03_PRODUCTION_TARGET =
  "amr-saleh-hotmail/miyar-v2/main" as const;
export const EV03_PRODUCTION_DATABASE_TARGET =
  "aws.connect.psdb.cloud:3306/miyar-v2" as const;
export const EV03_MIGRATION_SHA256 =
  "650388f42e44bd4e270546df2feac952e890b08ad463d598b1b569510ad882ae" as const;
export const EV03_IDENTITY_BACKFILL_APPROVAL_REF =
  "user-approved:2026-07-29:ev03-0062-identity-backfill" as const;

export type Ev03BackfillExecutionTarget = {
  production: boolean;
  manifestTarget: string;
  safetyDatabaseUrl: string;
  databaseApproval?: string;
};

export function normalizeEv03ConnectionUrlForInspection(
  databaseUrl: string | undefined
): string | undefined {
  if (!databaseUrl?.startsWith("mysql2://")) return databaseUrl;
  return `mysql://${databaseUrl.slice("mysql2://".length)}`;
}

export function resolveEv03BackfillExecutionTarget(input: {
  connectionTarget: DatabaseTarget;
  productionTarget?: string;
  expectedMigrationSha256?: string;
  approvalRef?: string;
  databaseApproval?: string;
  providerAttestation?: string;
  environmentAttestation?: string;
  rollback?: boolean;
  writeQuiesced?: boolean;
}): Ev03BackfillExecutionTarget {
  const target = input.connectionTarget;
  if (!input.productionTarget) {
    if (
      target.class !== "safe-loopback" ||
      !target.canonical ||
      !target.database ||
      !/^(miyar_auth_test|miyar_test_)/.test(target.database)
    ) {
      throw new Error(
        "EV-03 identity backfill accepts only a disposable loopback test database by default"
      );
    }
    return {
      production: false,
      manifestTarget: target.canonical,
      safetyDatabaseUrl: `mysql://${target.canonical}`,
    };
  }
  if (input.productionTarget !== EV03_PRODUCTION_TARGET) {
    throw new Error(
      `Production EV-03 target must be exactly ${EV03_PRODUCTION_TARGET}`
    );
  }
  if (input.expectedMigrationSha256 !== EV03_MIGRATION_SHA256) {
    throw new Error("Production EV-03 migration digest mismatch");
  }
  if (input.approvalRef !== EV03_IDENTITY_BACKFILL_APPROVAL_REF) {
    throw new Error(
      `Production EV-03 approval must be exactly ${EV03_IDENTITY_BACKFILL_APPROVAL_REF}`
    );
  }
  if (
    !input.providerAttestation ||
    !/^[a-f0-9]{64}$/.test(input.providerAttestation) ||
    input.providerAttestation !== input.environmentAttestation
  ) {
    throw new Error(
      "Production EV-03 requires the provider-bound runner attestation"
    );
  }
  if (
    target.class !== "safe-loopback" ||
    target.database !== "miyar-v2" ||
    !target.canonical
  ) {
    throw new Error(
      "Production EV-03 must connect through the wrapper-owned loopback PlanetScale proxy for miyar-v2"
    );
  }
  if (input.rollback && !input.writeQuiesced) {
    throw new Error(
      "Production EV-03 rollback requires an explicitly verified write-quiescent maintenance window"
    );
  }
  const safetyDatabaseUrl = `mysql://${EV03_PRODUCTION_DATABASE_TARGET}`;
  const decision = evaluateDatabaseAccess({
    operation: "migrate",
    databaseUrl: safetyDatabaseUrl,
    runtimeProfile: "local",
    nodeEnv: "production",
    approval: input.databaseApproval,
  });
  if (!decision.allowed || decision.reasonCode !== "REMOTE_APPROVAL_ALLOWED") {
    throw new Error(
      `Production EV-03 database approval rejected: ${decision.reasonCode}`
    );
  }
  return {
    production: true,
    manifestTarget: EV03_PRODUCTION_DATABASE_TARGET,
    safetyDatabaseUrl,
    databaseApproval: input.databaseApproval,
  };
}

type SchemaContractRow = RowDataPacket & {
  tableName: string;
  columnName: string;
  columnType: string;
  isNullable: "YES" | "NO";
  columnDefault: string | number | null;
};

type IndexContractRow = RowDataPacket & {
  indexName: string;
  nonUnique: number;
  columns: string;
};

const EV03_REQUIRED_SCHEMA_COLUMNS = [
  ["paint_coverage_profiles", "id", "int", "NO"],
  ["paint_coverage_profiles", "productId", "int", "NO"],
  ["paint_coverage_profiles", "specId", "int", "NO"],
  [
    "paint_coverage_profiles",
    "coverageM2PerLitrePerCoat",
    "decimal(10,3)",
    "NO",
  ],
  ["paint_coverage_profiles", "coatCount", "int", "NO"],
  ["paint_coverage_profiles", "wastePct", "decimal(6,3)", "NO"],
  ["paint_coverage_profiles", "packSizesLitres", "json", "NO"],
  ["paint_coverage_profiles", "effectiveAt", "timestamp", "NO"],
  ["paint_coverage_profiles", "policyVersion", "varchar(64)", "NO"],
  ["paint_coverage_profiles", "sourceDocumentUrl", "text", "NO"],
  ["paint_coverage_profiles", "sourceDocumentDigest", "varchar(128)", "NO"],
  [
    "paint_coverage_profiles",
    "status",
    "enum('pending','approved','rejected')",
    "NO",
  ],
  ["paint_coverage_profiles", "reviewedBy", "int", "YES"],
  ["paint_coverage_profiles", "reviewedAt", "timestamp", "YES"],
  ["paint_coverage_profiles", "supersedesId", "int", "YES"],
  ["paint_coverage_profiles", "createdAt", "timestamp", "NO"],
  ["sustainability_snapshots", "lifecycleCost", "decimal(18,2)", "YES"],
  [
    "sustainability_snapshots",
    "lifecycleCostResolutionState",
    "enum('resolved','insufficient','legacy_unverified')",
    "NO",
  ],
  [
    "digital_twin_models",
    "lifecycle_cost_resolution_state",
    "enum('resolved','insufficient','legacy_unverified')",
    "NO",
  ],
  [
    "finish_schedule_items",
    "element",
    "enum('floor','wall_primary','wall_feature','wall_wet','ceiling','joinery','hardware','sanitaryware')",
    "NO",
  ],
  ["finish_schedule_items", "product_id", "int", "YES"],
  ["finish_schedule_items", "spec_id", "int", "YES"],
  [
    "finish_schedule_items",
    "identity_state",
    "enum('resolved','unresolved','legacy_unverified')",
    "NO",
  ],
  [
    "material_allocations",
    "element",
    "enum('floor','walls','ceiling','joinery','hardware','sanitaryware')",
    "NO",
  ],
  ["material_allocations", "productId", "int", "YES"],
  ["material_allocations", "specId", "int", "YES"],
  ["material_allocations", "benchmarkProposalId", "int", "YES"],
  [
    "material_allocations",
    "resolutionState",
    "enum('resolved','insufficient','legacy_unverified')",
    "NO",
  ],
  ["material_allocations", "resolutionReason", "varchar(64)", "YES"],
  [
    "material_allocations",
    "resolvedPriceScope",
    "enum('supply_only','supply_and_install','legacy_unknown')",
    "YES",
  ],
  [
    "material_allocations",
    "requestedGeography",
    "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    "YES",
  ],
  [
    "material_allocations",
    "resolvedGeography",
    "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    "YES",
  ],
  [
    "material_allocations",
    "resolvedUnitBasis",
    "enum('per_piece','per_pack','per_sqm','per_lm','per_litre')",
    "YES",
  ],
  ["material_allocations", "resolutionAsOf", "timestamp", "YES"],
  ["material_allocations", "resolverPolicyVersion", "varchar(64)", "YES"],
  ["material_allocations", "benchmarkVersionId", "int", "YES"],
  ["material_allocations", "benchmarkVersion", "varchar(64)", "YES"],
  ["material_allocations", "provenancePolicyVersion", "varchar(64)", "YES"],
  ["material_allocations", "presentationProvenance", "json", "YES"],
  ["material_allocations", "quantityPolicyVersion", "varchar(64)", "YES"],
  ["material_allocations", "quantityConversionInputs", "json", "YES"],
  ["material_allocations", "explicitQuantity", "decimal(12,3)", "YES"],
  [
    "material_allocations",
    "explicitQuantityUnit",
    "enum('sqm','lm','piece','pack','litre')",
    "YES",
  ],
  ["materials_to_boards", "productId", "int", "YES"],
  ["materials_to_boards", "specId", "int", "YES"],
  [
    "materials_to_boards",
    "identityState",
    "enum('resolved','unresolved','legacy_unverified')",
    "NO",
  ],
  [
    "projects",
    "materialPriceGeography",
    "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    "YES",
  ],
  ["projects", "material_pricing_revision", "int", "NO"],
  ["rfq_line_items", "quantity", "decimal(12,3)", "YES"],
  ["rfq_line_items", "product_id", "int", "YES"],
  ["rfq_line_items", "spec_id", "int", "YES"],
  ["rfq_line_items", "benchmark_proposal_id", "int", "YES"],
  [
    "rfq_line_items",
    "resolution_state",
    "enum('resolved','insufficient','legacy_unverified')",
    "NO",
  ],
  ["rfq_line_items", "resolution_reason", "varchar(64)", "YES"],
  [
    "rfq_line_items",
    "resolved_price_scope",
    "enum('supply_only','supply_and_install','legacy_unknown')",
    "YES",
  ],
  [
    "rfq_line_items",
    "requested_geography",
    "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    "YES",
  ],
  [
    "rfq_line_items",
    "resolved_geography",
    "enum('dubai','abu_dhabi','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah','uae')",
    "YES",
  ],
  [
    "rfq_line_items",
    "resolved_unit_basis",
    "enum('per_piece','per_pack','per_sqm','per_lm','per_litre')",
    "YES",
  ],
  ["rfq_line_items", "resolution_as_of", "timestamp", "YES"],
  ["rfq_line_items", "resolver_policy_version", "varchar(64)", "YES"],
  ["rfq_line_items", "benchmark_version_id", "int", "YES"],
  ["rfq_line_items", "benchmark_version", "varchar(64)", "YES"],
  ["rfq_line_items", "provenance_policy_version", "varchar(64)", "YES"],
  ["rfq_line_items", "presentation_provenance", "json", "YES"],
  ["rfq_line_items", "quantity_policy_version", "varchar(64)", "YES"],
  ["rfq_line_items", "quantity_conversion_inputs", "json", "YES"],
  [
    "rfq_line_items",
    "line_kind",
    "enum('material','non_material_fee','legacy_unverified')",
    "NO",
  ],
  [
    "rfq_line_items",
    "artifact_state",
    "enum('draft','issued','legacy_unverified')",
    "NO",
  ],
  ["rfq_line_items", "non_material_policy_version", "varchar(64)", "YES"],
] as const;

/**
 * Proves the complete 0062 column contract and both new paint-profile indexes
 * are live before a provider-bound backfill or comparison is allowed to run.
 */
export async function assertEv03MigrationSchema(
  connection: Pick<Connection, "query">
): Promise<void> {
  const [rows] = await connection.query<SchemaContractRow[]>({
    sql: `select table_name as tableName, column_name as columnName,
      lower(column_type) as columnType, is_nullable as isNullable,
      column_default as columnDefault
      from information_schema.columns
      where table_schema=database()
        and table_name in (
          'paint_coverage_profiles','sustainability_snapshots',
          'digital_twin_models','finish_schedule_items',
          'material_allocations','materials_to_boards','projects',
          'rfq_line_items'
        )`,
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  const actual = new Map(
    rows.map(row => [
      `${row.tableName}.${row.columnName}`,
      {
        columnType: String(row.columnType).toLowerCase(),
        isNullable: row.isNullable,
        columnDefault:
          row.columnDefault === null ? null : String(row.columnDefault),
      },
    ])
  );
  for (const [
    table,
    column,
    columnType,
    isNullable,
  ] of EV03_REQUIRED_SCHEMA_COLUMNS) {
    const observed = actual.get(`${table}.${column}`);
    if (
      !observed ||
      observed.columnType !== columnType ||
      observed.isNullable !== isNullable
    ) {
      throw new Error(`EV-03 production schema mismatch at ${table}.${column}`);
    }
  }
  for (const [table, column, expectedDefault] of [
    ["paint_coverage_profiles", "status", "pending"],
    [
      "digital_twin_models",
      "lifecycle_cost_resolution_state",
      "legacy_unverified",
    ],
    ["finish_schedule_items", "identity_state", "legacy_unverified"],
    ["material_allocations", "resolutionState", "legacy_unverified"],
    ["materials_to_boards", "identityState", "legacy_unverified"],
    ["projects", "material_pricing_revision", "1"],
    ["rfq_line_items", "resolution_state", "legacy_unverified"],
    ["rfq_line_items", "line_kind", "legacy_unverified"],
    ["rfq_line_items", "artifact_state", "legacy_unverified"],
    [
      "sustainability_snapshots",
      "lifecycleCostResolutionState",
      "legacy_unverified",
    ],
  ] as const) {
    if (actual.get(`${table}.${column}`)?.columnDefault !== expectedDefault) {
      throw new Error(
        `EV-03 production schema default mismatch at ${table}.${column}`
      );
    }
  }
  const [indexes] = await connection.query<IndexContractRow[]>({
    sql: `select index_name as indexName, non_unique as nonUnique,
      group_concat(column_name order by seq_in_index separator ',') as columns
      from information_schema.statistics
      where table_schema=database() and table_name='paint_coverage_profiles'
      group by index_name, non_unique`,
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  const indexMap = new Map(
    indexes.map(index => [
      index.indexName,
      { nonUnique: Number(index.nonUnique), columns: String(index.columns) },
    ])
  );
  if (
    indexMap.get("paint_coverage_profiles_supersedes_unique")?.nonUnique !==
      0 ||
    indexMap.get("paint_coverage_profiles_supersedes_unique")?.columns !==
      "supersedesId" ||
    indexMap.get("paint_coverage_profiles_resolution_idx")?.nonUnique !== 1 ||
    indexMap.get("paint_coverage_profiles_resolution_idx")?.columns !==
      "productId,specId,status,effectiveAt"
  ) {
    throw new Error("EV-03 production schema index contract mismatch");
  }
}

type IdentityTable =
  | "finish_schedule_items"
  | "material_allocations"
  | "materials_to_boards";

type LegacyIdentityState = "resolved" | "unresolved" | "legacy_unverified";

export type Ev03SourceRow = Readonly<Record<string, unknown>> & {
  id: number;
};

export type Ev03SpecificationRow = {
  id: number;
  specKey: string;
  category: string;
  finishLevel: string;
  unitBasis: string;
  geography: string;
  policyVersion: string;
};

export type Ev03IdentityBackfillInput = {
  finishScheduleItems: Ev03SourceRow[];
  materialAllocations: Ev03SourceRow[];
  materialsToBoards: Ev03SourceRow[];
  rfqLineItems: Ev03SourceRow[];
  materialLibrary: Ev03SourceRow[];
  materialsCatalog: Ev03SourceRow[];
  specifications: Ev03SpecificationRow[];
};

export type Ev03NumericalImpact = {
  fields: Readonly<Record<string, string | number | null>>;
  changesNumericalAuthority: false;
};

export type Ev03SafeMappingContext = {
  sourceTable: "material_library" | "materials_catalog" | null;
  sourceId: number | null;
  canonicalCategory: string | null;
  finishLevel: string | null;
  unitBasis: string | null;
};

export type Ev03AmbiguityDecision = {
  table: IdentityTable | "rfq_line_items";
  id: number;
  reason:
    | "missing_exact_source_reference"
    | "missing_exact_product_link"
    | "unknown_finish_level"
    | "unknown_unit_basis"
    | "missing_exact_ev02_specification"
    | "ambiguous_exact_ev02_specification"
    | "existing_ev03_identity_diverged"
    | "historical_rfq_requires_explicit_classification";
  proposedMapping: { productId: number; specId?: number } | null;
  mappingContext: Ev03SafeMappingContext;
  numericalImpact: Ev03NumericalImpact;
  requiredApprover:
    | "material_data_owner"
    | "commercial_and_material_data_owner";
};

export type Ev03IdentityAction = {
  table: IdentityTable;
  id: number;
  sourceTable: "material_library" | "materials_catalog";
  sourceId: number;
  sourceReferenceColumn:
    | "material_library_id"
    | "materialLibraryId"
    | "materialId";
  productId: number;
  specId: number;
  beforeRowFingerprint: string;
  stateAfter: LegacyIdentityState;
};

export type Ev03IdentityPlan = {
  version: typeof EV03_IDENTITY_BACKFILL_VERSION;
  sourceFingerprint: string;
  planFingerprint: string;
  actions: Ev03IdentityAction[];
  decisions: Ev03AmbiguityDecision[];
  alreadyLinked: Array<{ table: IdentityTable; id: number }>;
};

export type Ev03AppliedAction = Ev03IdentityAction & {
  afterRowFingerprint: string;
};

export type Ev03IdentityBackfillManifest = {
  version: typeof EV03_IDENTITY_BACKFILL_VERSION;
  databaseTarget: string;
  migrationFingerprint: string;
  planFingerprint: string;
  sourceFingerprint: string;
  createdAt: string;
  appliedAt: string | null;
  actions: Ev03AppliedAction[];
  decisions: Ev03AmbiguityDecision[];
  recoveryFingerprint: string | null;
};

type QueryConnection = Pick<
  Connection,
  "query" | "beginTransaction" | "commit" | "rollback"
>;

function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Cannot fingerprint a non-finite number");
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new Error("Cannot fingerprint an invalid date");
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  throw new Error(`Cannot fingerprint value of type ${typeof value}`);
}

export function fingerprintEv03Value(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function numericImpact(
  row: Ev03SourceRow,
  keys: readonly string[]
): Ev03NumericalImpact {
  const safeNumber = (value: unknown): string | number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string" && /^-?\d{1,18}(?:\.\d{1,6})?$/.test(value)) {
      return value;
    }
    return null;
  };
  return {
    fields: Object.fromEntries(keys.map(key => [key, safeNumber(row[key])])),
    changesNumericalAuthority: false,
  };
}

const FORBIDDEN_MANIFEST_KEY =
  /(?:organization|orgId|project|customer|tenant|supplier|description|notes?|aiReasoning|contact|email|phone|sourceRow|rawRow|fullRow)/i;
const FORBIDDEN_MANIFEST_CONTENT =
  /(?:https?:\/\/|mailto:|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i;

export function assertEv03ManifestSafety(
  value: unknown,
  path = "manifest"
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertEv03ManifestSafety(item, `${path}[${index}]`)
    );
    return;
  }
  if (typeof value === "string") {
    if (FORBIDDEN_MANIFEST_CONTENT.test(value)) {
      throw new Error(`Unsafe EV-03 manifest content at ${path}`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_MANIFEST_KEY.test(key)) {
      throw new Error(`Forbidden EV-03 manifest field at ${path}.${key}`);
    }
    assertEv03ManifestSafety(item, `${path}.${key}`);
  }
}

function currentIdentity(row: Ev03SourceRow, table: IdentityTable) {
  const snake = table === "finish_schedule_items";
  return {
    productId: row[snake ? "product_id" : "productId"],
    specId: row[snake ? "spec_id" : "specId"],
    state:
      row[
        table === "finish_schedule_items"
          ? "identity_state"
          : table === "materials_to_boards"
            ? "identityState"
            : "resolutionState"
      ],
  };
}

function isNullableId(value: unknown): value is number | null {
  return (
    value === null || (typeof value === "number" && Number.isInteger(value))
  );
}

function exactSpecification(
  input: {
    category: string;
    finishLevel: string;
    unitBasis: string;
  },
  specifications: Ev03SpecificationRow[]
):
  | { kind: "resolved"; specId: number }
  | { kind: "missing" }
  | { kind: "ambiguous" } {
  const specKey = buildSpecificationKey({
    category: input.category as Parameters<
      typeof buildSpecificationKey
    >[0]["category"],
    finishLevel: input.finishLevel as Parameters<
      typeof buildSpecificationKey
    >[0]["finishLevel"],
    unitBasis: input.unitBasis as Parameters<
      typeof buildSpecificationKey
    >[0]["unitBasis"],
    geography: "uae",
  });
  const matches = specifications.filter(
    spec =>
      spec.specKey === specKey &&
      spec.category === input.category &&
      spec.finishLevel === input.finishLevel &&
      spec.unitBasis === input.unitBasis &&
      spec.geography === "uae" &&
      spec.policyVersion === EV02_SPEC_POLICY_VERSION
  );
  if (matches.length === 0) return { kind: "missing" };
  if (matches.length !== 1) return { kind: "ambiguous" };
  return { kind: "resolved", specId: matches[0].id };
}

function createPlanFingerprint(
  sourceFingerprint: string,
  actions: Ev03IdentityAction[],
  decisions: Ev03AmbiguityDecision[]
): string {
  return fingerprintEv03Value({
    version: EV03_IDENTITY_BACKFILL_VERSION,
    sourceFingerprint,
    actions,
    decisions,
  });
}

export function buildEv03IdentityBackfillPlan(
  input: Ev03IdentityBackfillInput
): Ev03IdentityPlan {
  const libraryById = new Map(
    input.materialLibrary.map(row => [Number(row.id), row])
  );
  const catalogById = new Map(
    input.materialsCatalog.map(row => [Number(row.id), row])
  );
  const actions: Ev03IdentityAction[] = [];
  const decisions: Ev03AmbiguityDecision[] = [];
  const alreadyLinked: Ev03IdentityPlan["alreadyLinked"] = [];

  function decide(
    table: IdentityTable,
    row: Ev03SourceRow,
    reason: Ev03AmbiguityDecision["reason"],
    proposedMapping: Ev03AmbiguityDecision["proposedMapping"],
    numericalKeys: readonly string[],
    mappingContext: Ev03SafeMappingContext
  ) {
    decisions.push({
      table,
      id: Number(row.id),
      reason,
      proposedMapping,
      mappingContext,
      numericalImpact: numericImpact(row, numericalKeys),
      requiredApprover: "material_data_owner",
    });
  }

  function consider(inputRow: {
    table: IdentityTable;
    row: Ev03SourceRow;
    sourceIdColumn: "material_library_id" | "materialLibraryId" | "materialId";
    source: "library" | "catalog";
    numericalKeys: readonly string[];
  }) {
    const { table, row, sourceIdColumn, source, numericalKeys } = inputRow;
    const existing = currentIdentity(row, table);
    if (
      !isNullableId(existing.productId) ||
      !isNullableId(existing.specId) ||
      typeof existing.state !== "string"
    ) {
      throw new Error(`Invalid ${table} identity shape for ${row.id}`);
    }
    const sourceId = row[sourceIdColumn];
    const sourceRow =
      typeof sourceId === "number"
        ? source === "library"
          ? libraryById.get(sourceId)
          : catalogById.get(sourceId)
        : undefined;
    const sourceTable =
      source === "library" ? "material_library" : "materials_catalog";
    const baseContext: Ev03SafeMappingContext = {
      sourceTable,
      sourceId: typeof sourceId === "number" ? sourceId : null,
      canonicalCategory: null,
      finishLevel: null,
      unitBasis: null,
    };
    if (!sourceRow) {
      if (
        existing.productId === null &&
        existing.specId === null &&
        existing.state === "legacy_unverified"
      ) {
        decide(
          table,
          row,
          "missing_exact_source_reference",
          null,
          numericalKeys,
          baseContext
        );
      } else {
        decide(
          table,
          row,
          "existing_ev03_identity_diverged",
          null,
          numericalKeys,
          baseContext
        );
      }
      return;
    }
    const finishLevel =
      source === "library"
        ? materialLibraryTierToFinish(String(sourceRow.tier))
        : materialCatalogTierToFinish(String(sourceRow.tier));
    const unitBasis = normalizeUnitBasis(
      String(source === "library" ? sourceRow.unit_label : sourceRow.costUnit)
    );
    const category =
      source === "library"
        ? materialLibraryCategoryToCanonical(String(sourceRow.category))
        : materialCatalogCategoryToCanonical(String(sourceRow.category));
    const mappingContext: Ev03SafeMappingContext = {
      ...baseContext,
      canonicalCategory: category,
      finishLevel,
      unitBasis,
    };
    const sourceProductId =
      source === "library" ? sourceRow.product_id : sourceRow.productId;
    if (typeof sourceProductId !== "number") {
      decide(
        table,
        row,
        "missing_exact_product_link",
        null,
        numericalKeys,
        mappingContext
      );
      return;
    }
    if (!finishLevel) {
      decide(
        table,
        row,
        "unknown_finish_level",
        { productId: sourceProductId },
        numericalKeys,
        mappingContext
      );
      return;
    }
    if (!unitBasis) {
      decide(
        table,
        row,
        "unknown_unit_basis",
        { productId: sourceProductId },
        numericalKeys,
        mappingContext
      );
      return;
    }
    const specification = exactSpecification(
      { category, finishLevel, unitBasis },
      input.specifications
    );
    if (specification.kind !== "resolved") {
      decide(
        table,
        row,
        specification.kind === "missing"
          ? "missing_exact_ev02_specification"
          : "ambiguous_exact_ev02_specification",
        { productId: sourceProductId },
        numericalKeys,
        mappingContext
      );
      return;
    }
    const expectedState =
      table === "material_allocations" ? "legacy_unverified" : "resolved";
    if (
      existing.productId === sourceProductId &&
      existing.specId === specification.specId &&
      existing.state === expectedState
    ) {
      alreadyLinked.push({ table, id: Number(row.id) });
      return;
    }
    if (
      existing.productId !== null ||
      existing.specId !== null ||
      existing.state !== "legacy_unverified"
    ) {
      decide(
        table,
        row,
        "existing_ev03_identity_diverged",
        { productId: sourceProductId, specId: specification.specId },
        numericalKeys,
        mappingContext
      );
      return;
    }
    actions.push({
      table,
      id: Number(row.id),
      sourceTable:
        source === "library" ? "material_library" : "materials_catalog",
      sourceId: Number(sourceId),
      sourceReferenceColumn: sourceIdColumn,
      productId: sourceProductId,
      specId: specification.specId,
      beforeRowFingerprint: fingerprintEv03Value(row),
      stateAfter: expectedState,
    });
  }

  for (const row of input.finishScheduleItems) {
    consider({
      table: "finish_schedule_items",
      row,
      sourceIdColumn: "material_library_id",
      source: "library",
      numericalKeys: [],
    });
  }
  for (const row of input.materialAllocations) {
    consider({
      table: "material_allocations",
      row,
      sourceIdColumn: "materialLibraryId",
      source: "library",
      numericalKeys: [
        "allocationPct",
        "surfaceAreaM2",
        "unitCostMin",
        "unitCostMax",
        "totalCostMin",
        "totalCostMax",
      ],
    });
  }
  for (const row of input.materialsToBoards) {
    consider({
      table: "materials_to_boards",
      row,
      sourceIdColumn: "materialId",
      source: "catalog",
      numericalKeys: ["quantity", "costBandOverride"],
    });
  }
  for (const row of input.rfqLineItems) {
    decisions.push({
      table: "rfq_line_items",
      id: Number(row.id),
      reason: "historical_rfq_requires_explicit_classification",
      proposedMapping: null,
      mappingContext: {
        sourceTable: null,
        sourceId: null,
        canonicalCategory: null,
        finishLevel: null,
        unitBasis: normalizeUnitBasis(String(row.unit)),
      },
      numericalImpact: numericImpact(row, [
        "quantity",
        "unit_rate_aed_min",
        "unit_rate_aed_max",
        "total_aed_min",
        "total_aed_max",
      ]),
      requiredApprover: "commercial_and_material_data_owner",
    });
  }

  const sourceFingerprint = fingerprintEv03Value(input);
  const plan: Ev03IdentityPlan = {
    version: EV03_IDENTITY_BACKFILL_VERSION,
    sourceFingerprint,
    planFingerprint: createPlanFingerprint(
      sourceFingerprint,
      actions,
      decisions
    ),
    actions,
    decisions,
    alreadyLinked,
  };
  return plan;
}

async function selectRows(
  connection: QueryConnection,
  sql: string
): Promise<Ev03SourceRow[]> {
  const [rows] = await connection.query<RowDataPacket[]>({
    sql,
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  return rows.map(row => ({ ...row, id: Number(row.id) }));
}

export async function loadEv03IdentityBackfillInput(
  connection: QueryConnection
): Promise<Ev03IdentityBackfillInput> {
  const [
    finishScheduleItems,
    materialAllocations,
    materialsToBoards,
    rfqLineItems,
    materialLibrary,
    materialsCatalog,
    specifications,
  ] = await Promise.all([
    selectRows(connection, "select * from finish_schedule_items order by id"),
    selectRows(connection, "select * from material_allocations order by id"),
    selectRows(connection, "select * from materials_to_boards order by id"),
    selectRows(connection, "select * from rfq_line_items order by id"),
    selectRows(connection, "select * from material_library order by id"),
    selectRows(connection, "select * from materials_catalog order by id"),
    selectRows(connection, "select * from specification order by id"),
  ]);
  return {
    finishScheduleItems,
    materialAllocations,
    materialsToBoards,
    rfqLineItems,
    materialLibrary,
    materialsCatalog,
    specifications: specifications.map(row => ({
      id: Number(row.id),
      specKey: String(row.specKey),
      category: String(row.category),
      finishLevel: String(row.finishLevel),
      unitBasis: String(row.unitBasis),
      geography: String(row.geography),
      policyVersion: String(row.policyVersion),
    })),
  };
}

export async function createEv03IdentityBackfillManifest(
  connection: QueryConnection,
  input: {
    databaseTarget: string;
    migrationFingerprint: string;
    now: Date;
  }
): Promise<Ev03IdentityBackfillManifest> {
  if (!/^[a-f0-9]{64}$/.test(input.migrationFingerprint)) {
    throw new Error("EV-03 migration fingerprint must be SHA-256");
  }
  const plan = buildEv03IdentityBackfillPlan(
    await loadEv03IdentityBackfillInput(connection)
  );
  const manifest: Ev03IdentityBackfillManifest = {
    version: EV03_IDENTITY_BACKFILL_VERSION,
    databaseTarget: input.databaseTarget,
    migrationFingerprint: input.migrationFingerprint,
    planFingerprint: plan.planFingerprint,
    sourceFingerprint: plan.sourceFingerprint,
    createdAt: input.now.toISOString(),
    appliedAt: null,
    actions: plan.actions.map(action => ({
      ...action,
      afterRowFingerprint: "",
    })),
    decisions: plan.decisions,
    recoveryFingerprint: null,
  };
  assertEv03ManifestSafety(manifest);
  return manifest;
}

function tableContract(table: IdentityTable) {
  if (table === "finish_schedule_items") {
    return {
      product: "product_id",
      spec: "spec_id",
      state: "identity_state",
    };
  }
  if (table === "materials_to_boards") {
    return { product: "productId", spec: "specId", state: "identityState" };
  }
  return { product: "productId", spec: "specId", state: "resolutionState" };
}

function sourceProductColumn(
  sourceTable: Ev03IdentityAction["sourceTable"]
): "product_id" | "productId" {
  return sourceTable === "material_library" ? "product_id" : "productId";
}

async function lockRows(
  connection: QueryConnection,
  table: string,
  ids: readonly number[]
): Promise<void> {
  const uniqueIds = Array.from(new Set(ids)).sort((a, b) => a - b);
  if (uniqueIds.length === 0) return;
  const [rows] = await connection.query<RowDataPacket[]>({
    sql: `select id from \`${table}\`
      where id in (${uniqueIds.map(() => "?").join(",")})
      order by id for update`,
    values: uniqueIds,
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  if (
    rows.length !== uniqueIds.length ||
    rows.some((row, index) => Number(row.id) !== uniqueIds[index])
  ) {
    throw new Error(
      `EV-03 dependency lock could not resolve every ${table} row`
    );
  }
}

/**
 * Acquires every mutable dependency for planned writes in one canonical order.
 * The caller must already own a transaction. A concurrent target-reference or
 * source-product change therefore either commits before these locks and breaks
 * the re-plan fingerprint, or waits until this transaction commits.
 */
export async function lockEv03IdentityBackfillDependencies(
  connection: QueryConnection,
  actions: readonly Ev03IdentityAction[]
): Promise<void> {
  const lockGroups = [
    {
      table: "product",
      ids: actions.map(action => action.productId),
    },
    {
      table: "specification",
      ids: actions.map(action => action.specId),
    },
    {
      table: "material_library",
      ids: actions
        .filter(action => action.sourceTable === "material_library")
        .map(action => action.sourceId),
    },
    {
      table: "materials_catalog",
      ids: actions
        .filter(action => action.sourceTable === "materials_catalog")
        .map(action => action.sourceId),
    },
    {
      table: "finish_schedule_items",
      ids: actions
        .filter(action => action.table === "finish_schedule_items")
        .map(action => action.id),
    },
    {
      table: "material_allocations",
      ids: actions
        .filter(action => action.table === "material_allocations")
        .map(action => action.id),
    },
    {
      table: "materials_to_boards",
      ids: actions
        .filter(action => action.table === "materials_to_boards")
        .map(action => action.id),
    },
  ] as const;
  for (const group of lockGroups) {
    await lockRows(connection, group.table, group.ids);
  }
}

async function loadRowsByIds(
  connection: QueryConnection,
  table: IdentityTable,
  ids: readonly number[]
): Promise<Map<number, Ev03SourceRow>> {
  const uniqueIds = Array.from(new Set(ids)).sort((a, b) => a - b);
  if (uniqueIds.length === 0) return new Map();
  const [rows] = await connection.query<RowDataPacket[]>({
    sql: `select * from \`${table}\`
      where id in (${uniqueIds.map(() => "?").join(",")})
      order by id`,
    values: uniqueIds,
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  if (
    rows.length !== uniqueIds.length ||
    rows.some((row, index) => Number(row.id) !== uniqueIds[index])
  ) {
    throw new Error(`EV-03 source rows missing from ${table}`);
  }
  return new Map(
    rows.map(row => [Number(row.id), { ...row, id: Number(row.id) }])
  );
}

function assertUniqueIdentityActions(
  actions: readonly Ev03IdentityAction[]
): void {
  const identities = new Set<string>();
  for (const action of actions) {
    const identity = `${action.table}:${action.id}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate EV-03 identity action: ${identity}`);
    }
    identities.add(identity);
  }
}

async function applyIdentityActionBatch(
  connection: QueryConnection,
  table: IdentityTable,
  actions: readonly Ev03IdentityAction[]
): Promise<void> {
  if (actions.length === 0) return;
  const columns = tableContract(table);
  const preserveLegacyUpdatedAt =
    table === "material_allocations" ? ", `updatedAt`=`updatedAt`" : "";
  const caseExpression = (
    field: "productId" | "specId" | "stateAfter"
  ): { sql: string; values: unknown[] } => ({
    sql: actions.map(() => "when ? then ?").join(" "),
    values: actions.flatMap(action => [action.id, action[field]]),
  });
  const product = caseExpression("productId");
  const spec = caseExpression("specId");
  const state = caseExpression("stateAfter");
  const ids = actions.map(action => action.id);
  const [result] = await connection.query({
    sql: `update \`${table}\`
      set \`${columns.product}\`=case id ${product.sql} else \`${columns.product}\` end,
        \`${columns.spec}\`=case id ${spec.sql} else \`${columns.spec}\` end,
        \`${columns.state}\`=case id ${state.sql} else \`${columns.state}\` end${preserveLegacyUpdatedAt}
      where id in (${ids.map(() => "?").join(",")})
        and \`${columns.product}\` is null
        and \`${columns.spec}\` is null
        and \`${columns.state}\`='legacy_unverified'`,
    values: [...product.values, ...spec.values, ...state.values, ...ids],
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  if (
    Number((result as { affectedRows: number }).affectedRows) !== actions.length
  ) {
    throw new Error(`Concurrent EV-03 identity write detected in ${table}`);
  }
}

async function assertExactDependenciesBatch(
  connection: QueryConnection,
  actions: readonly Ev03IdentityAction[]
): Promise<void> {
  for (const sourceTable of [
    "material_library",
    "materials_catalog",
  ] as const) {
    const sourceActions = actions
      .filter(action => action.sourceTable === sourceTable)
      .sort((left, right) => left.id - right.id);
    if (sourceActions.length === 0) continue;
    const sourceProduct = sourceProductColumn(sourceTable);
    const requestedRows = sourceActions
      .map(
        (_, index) =>
          `${index === 0 ? "select" : "union all select"} ? as actionId, ? as specId, ? as sourceId, ? as productId`
      )
      .join(" ");
    const [rows] = await connection.query<RowDataPacket[]>({
      sql: `select requested.actionId
        from (${requestedRows}) requested
        join product p on p.id=requested.productId
        join specification s
          on s.id=requested.specId and s.policyVersion=?
        join \`${sourceTable}\` source
          on source.id=requested.sourceId
          and source.\`${sourceProduct}\`=requested.productId
        order by requested.actionId`,
      values: [
        ...sourceActions.flatMap(action => [
          action.id,
          action.specId,
          action.sourceId,
          action.productId,
        ]),
        EV02_SPEC_POLICY_VERSION,
      ],
      timeout: EV03_QUERY_TIMEOUT_MS,
    });
    if (
      rows.length !== sourceActions.length ||
      rows.some(
        (row, index) => Number(row.actionId) !== sourceActions[index].id
      )
    ) {
      throw new Error(`EV-03 rollback dependency diverged in ${sourceTable}`);
    }
  }
}

async function rollbackIdentityActionBatch(
  connection: QueryConnection,
  table: IdentityTable,
  actions: readonly Ev03AppliedAction[]
): Promise<void> {
  if (actions.length === 0) return;
  const columns = tableContract(table);
  const preserveLegacyUpdatedAt =
    table === "material_allocations" ? ", `updatedAt`=`updatedAt`" : "";
  const predicates = actions
    .map(
      () =>
        `(id=? and \`${columns.product}\`=? and \`${columns.spec}\`=? and \`${columns.state}\`=?)`
    )
    .join(" or ");
  const [result] = await connection.query({
    sql: `update \`${table}\`
      set \`${columns.product}\`=null, \`${columns.spec}\`=null,
        \`${columns.state}\`='legacy_unverified'${preserveLegacyUpdatedAt}
      where ${predicates}`,
    values: actions.flatMap(action => [
      action.id,
      action.productId,
      action.specId,
      action.stateAfter,
    ]),
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  if (
    Number((result as { affectedRows: number }).affectedRows) !== actions.length
  ) {
    throw new Error(`EV-03 rollback failed in ${table}`);
  }
}

function recoveryFingerprint(
  manifest: Omit<Ev03IdentityBackfillManifest, "recoveryFingerprint">
): string {
  return fingerprintEv03Value(manifest);
}

export function assertEv03ManifestIntegrity(
  manifest: Ev03IdentityBackfillManifest
): void {
  assertEv03ManifestSafety(manifest);
  if (manifest.version !== EV03_IDENTITY_BACKFILL_VERSION) {
    throw new Error("Unsupported EV-03 identity backfill manifest");
  }
  if (manifest.appliedAt === null || manifest.recoveryFingerprint === null) {
    throw new Error("EV-03 rollback requires an applied recovery manifest");
  }
  const { recoveryFingerprint: expected, ...unsigned } = manifest;
  if (recoveryFingerprint(unsigned) !== expected) {
    throw new Error("EV-03 recovery manifest fingerprint mismatch");
  }
}

function assertEv03DryRunManifestIntegrity(
  manifest: Ev03IdentityBackfillManifest
): Ev03IdentityAction[] {
  assertEv03ManifestSafety(manifest);
  if (
    manifest.version !== EV03_IDENTITY_BACKFILL_VERSION ||
    manifest.appliedAt !== null ||
    manifest.recoveryFingerprint !== null
  ) {
    throw new Error("EV-03 apply requires an intact dry-run manifest");
  }
  const actions = manifest.actions.map(({ afterRowFingerprint, ...action }) => {
    if (afterRowFingerprint !== "") {
      throw new Error("EV-03 dry-run manifest contains applied row evidence");
    }
    return action;
  });
  if (
    createPlanFingerprint(
      manifest.sourceFingerprint,
      actions,
      manifest.decisions
    ) !== manifest.planFingerprint
  ) {
    throw new Error("EV-03 dry-run manifest fingerprint mismatch");
  }
  return actions;
}

export function assertEv03CompletionSummaryBindsManifest(
  summary: {
    mode: "dry-run" | "apply" | "rollback";
    target: string;
    fingerprint: string;
    rowCount: number;
    decisionCount: number;
  },
  manifest: Ev03IdentityBackfillManifest
): void {
  assertEv03ManifestSafety(manifest);
  const expectedFingerprint =
    summary.mode === "dry-run"
      ? manifest.planFingerprint
      : manifest.recoveryFingerprint;
  if (summary.mode === "dry-run") {
    assertEv03DryRunManifestIntegrity(manifest);
  } else {
    assertEv03ManifestIntegrity(manifest);
  }
  if (
    summary.target !== manifest.databaseTarget ||
    expectedFingerprint === null ||
    summary.fingerprint !== expectedFingerprint ||
    summary.rowCount !== manifest.actions.length ||
    summary.decisionCount !== manifest.decisions.length
  ) {
    throw new Error(
      "EV-03 completion summary does not bind the produced manifest"
    );
  }
}

export async function applyEv03IdentityBackfill(
  connection: QueryConnection,
  dryRunManifest: Ev03IdentityBackfillManifest,
  input: { databaseTarget: string; migrationFingerprint: string; now: Date }
): Promise<Ev03IdentityBackfillManifest> {
  const dryRunActions = assertEv03DryRunManifestIntegrity(dryRunManifest);
  assertUniqueIdentityActions(dryRunActions);
  if (
    dryRunManifest.databaseTarget !== input.databaseTarget ||
    dryRunManifest.migrationFingerprint !== input.migrationFingerprint
  ) {
    throw new Error("EV-03 apply target or migration fingerprint mismatch");
  }
  await lockEv03IdentityBackfillDependencies(connection, dryRunActions);
  const current = await createEv03IdentityBackfillManifest(connection, input);
  if (
    current.planFingerprint !== dryRunManifest.planFingerprint ||
    current.sourceFingerprint !== dryRunManifest.sourceFingerprint
  ) {
    throw new Error(
      "EV-03 apply refused because source data changed after dry-run"
    );
  }

  const identityTables: readonly IdentityTable[] = [
    "finish_schedule_items",
    "material_allocations",
    "materials_to_boards",
  ];
  // The canonical dependency locks plus the exact in-transaction re-plan above
  // make these set-based CAS writes equivalent to the former per-row EXISTS
  // checks while keeping the provider transaction below its duration limit.
  for (const table of identityTables) {
    await applyIdentityActionBatch(
      connection,
      table,
      dryRunManifest.actions.filter(action => action.table === table)
    );
  }
  const afterRows = new Map<string, Ev03SourceRow>();
  for (const table of identityTables) {
    const actions = dryRunManifest.actions.filter(
      action => action.table === table
    );
    const rows = await loadRowsByIds(
      connection,
      table,
      actions.map(action => action.id)
    );
    rows.forEach((row, id) => afterRows.set(`${table}:${id}`, row));
  }
  const appliedActions: Ev03AppliedAction[] = dryRunManifest.actions.map(
    action => {
      const after = afterRows.get(`${action.table}:${action.id}`);
      if (!after) {
        throw new Error(
          `EV-03 applied row missing: ${action.table} ${action.id}`
        );
      }
      return {
        ...action,
        afterRowFingerprint: fingerprintEv03Value(after),
      };
    }
  );
  const {
    recoveryFingerprint: _discardedRecoveryFingerprint,
    ...dryRunUnsigned
  } = dryRunManifest;
  const unsigned: Omit<Ev03IdentityBackfillManifest, "recoveryFingerprint"> = {
    ...dryRunUnsigned,
    appliedAt: input.now.toISOString(),
    actions: appliedActions,
  };
  const appliedManifest: Ev03IdentityBackfillManifest = {
    ...unsigned,
    recoveryFingerprint: recoveryFingerprint(unsigned),
  };
  assertEv03ManifestSafety(appliedManifest);
  return appliedManifest;
}

async function assertNoEv03RecoveryConflict(
  connection: QueryConnection,
  input: {
    table: string;
    condition: string;
    ownedIds?: readonly number[];
  }
): Promise<void> {
  const ownedIds = Array.from(new Set(input.ownedIds ?? []));
  const exclusion =
    ownedIds.length === 0
      ? ""
      : ` and id not in (${ownedIds.map(() => "?").join(",")})`;
  const [rows] = await connection.query<RowDataPacket[]>({
    sql: `/* ev03 rollback compatibility */
      select id from \`${input.table}\`
      where (${input.condition})${exclusion}
      limit 1`,
    values: ownedIds,
    timeout: EV03_QUERY_TIMEOUT_MS,
  });
  if (rows.length > 0) {
    throw new Error(
      `EV-03 rollback refused after an external canonical write in ${input.table}`
    );
  }
}

/**
 * A recovery to the old application is representable only while no EV-03
 * canonical identity, pricing provenance, or quantity-policy write exists
 * outside the rows owned by this manifest. This is deliberately conservative.
 */
export async function assertEv03RollbackCompatibility(
  connection: QueryConnection,
  actions: readonly Ev03AppliedAction[]
): Promise<void> {
  const idsFor = (table: IdentityTable) =>
    actions.filter(action => action.table === table).map(action => action.id);
  await assertNoEv03RecoveryConflict(connection, {
    table: "finish_schedule_items",
    ownedIds: idsFor("finish_schedule_items"),
    condition:
      "`product_id` is not null or `spec_id` is not null or `identity_state`<>'legacy_unverified'",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "material_allocations",
    ownedIds: idsFor("material_allocations"),
    condition:
      "`productId` is not null or `specId` is not null or `benchmarkProposalId` is not null or `resolutionState`<>'legacy_unverified' or `presentationProvenance` is not null or `quantityPolicyVersion` is not null or `quantityConversionInputs` is not null",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "materials_to_boards",
    ownedIds: idsFor("materials_to_boards"),
    condition:
      "`productId` is not null or `specId` is not null or `identityState`<>'legacy_unverified'",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "rfq_line_items",
    condition:
      "`product_id` is not null or `spec_id` is not null or `benchmark_proposal_id` is not null or `resolution_state`<>'legacy_unverified' or `presentation_provenance` is not null or `quantity_policy_version` is not null or `quantity_conversion_inputs` is not null or `line_kind`<>'legacy_unverified' or `artifact_state`<>'legacy_unverified'",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "sustainability_snapshots",
    condition: "`lifecycleCostResolutionState`<>'legacy_unverified'",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "digital_twin_models",
    condition: "`lifecycle_cost_resolution_state`<>'legacy_unverified'",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "projects",
    condition:
      "`materialPriceGeography` is not null or `material_pricing_revision`<>1",
  });
  await assertNoEv03RecoveryConflict(connection, {
    table: "paint_coverage_profiles",
    condition: "1=1",
  });
}

export async function rollbackEv03IdentityBackfill(
  connection: QueryConnection,
  manifest: Ev03IdentityBackfillManifest,
  databaseTarget: string
): Promise<void> {
  assertEv03ManifestIntegrity(manifest);
  assertUniqueIdentityActions(manifest.actions);
  if (manifest.databaseTarget !== databaseTarget) {
    throw new Error("EV-03 rollback target does not match manifest");
  }
  await assertEv03RollbackCompatibility(connection, manifest.actions);
  await lockEv03IdentityBackfillDependencies(connection, manifest.actions);

  const identityTables: readonly IdentityTable[] = [
    "finish_schedule_items",
    "material_allocations",
    "materials_to_boards",
  ];
  for (const table of identityTables) {
    const actions = manifest.actions.filter(action => action.table === table);
    const currentRows = await loadRowsByIds(
      connection,
      table,
      actions.map(action => action.id)
    );
    for (const action of actions) {
      const current = currentRows.get(action.id);
      if (
        !current ||
        fingerprintEv03Value(current) !== action.afterRowFingerprint
      ) {
        throw new Error(
          `EV-03 rollback refused after a later write: ${action.table} ${action.id}`
        );
      }
    }
  }
  await assertExactDependenciesBatch(connection, manifest.actions);

  for (const table of [...identityTables].reverse()) {
    await rollbackIdentityActionBatch(
      connection,
      table,
      manifest.actions.filter(action => action.table === table)
    );
  }
}
