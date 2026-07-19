import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const DI01_TABLES = [
  "project_geometry_authorities",
  "spatial_graph_versions",
  "space_identities",
  "space_versions",
  "geometry_sources",
  "measurement_records",
  "measurement_input_edges",
  "geometry_reconciliation_events",
  "legacy_space_links",
  "artifact_input_snapshots",
] as const;

describe("DI-01 additive schema contract", () => {
  const migration = source("../../drizzle/0051_brief_radioactive_man.sql");

  it("creates every tenant-owned foundation without destructive backfill", () => {
    for (const table of DI01_TABLES) {
      const start = migration.indexOf(`CREATE TABLE \`${table}\``);
      const end = migration.indexOf(");", start);
      const definition = migration.slice(start, end);

      expect(start, `${table} is missing`).toBeGreaterThanOrEqual(0);
      expect(definition).toContain("`organizationId` int NOT NULL");
      expect(definition).toContain("`projectId` int NOT NULL");
      expect(definition).toContain(`CONSTRAINT \`${table}_scope_id_unique\``);
    }

    expect(migration).not.toMatch(
      /^\s*(?:DROP\b|DELETE\s+FROM\b|UPDATE\s+`|TRUNCATE\b|RENAME\b)/im
    );
  });

  it("adds CAD assets and preserves tenant-scoped CAS and replay keys", () => {
    expect(migration).toContain("'text_note','cad'");
    expect(migration).toContain(
      "project_geometry_authorities_org_project_unique"
    );
    expect(migration).toContain("`currentGraphVersionId` int");
    expect(migration).toContain("`selectedGeometryVersionId` int");
    expect(migration).toContain("geometry_sources_idempotency_unique");
    expect(migration).toContain("spatial_graph_versions_graph_version_unique");
    expect(migration).toContain("space_versions_identity_version_unique");
    expect(migration).toContain("measurement_input_edges_pair_unique");
    expect(migration).toContain("legacy_space_links_source_unique");
    expect(migration).toContain("artifact_input_snapshots_artifact_unique");
    expect(migration).toContain("'draft_created','accepted'");
    expect(migration).toContain(
      "enum('legacy','canonical') NOT NULL DEFAULT 'canonical'"
    );
    expect(migration).not.toContain("'shadow'");
    expect(migration).toContain("'draft','canonical','needs_clarification'");
  });

  it("stores immutable geometry, measurement lineage, and append-only review facts", () => {
    for (const column of [
      "canonicalGeometry",
      "totalAreaSquareMetres",
      "totalAreaSquareMicrometresTwice",
      "fingerprintDomain",
      "sourceObservation",
      "sourceTransform",
      "sourceReferenceFrame",
      "derivedMeasurementRecordId",
      "inputMeasurementRecordId",
      "normalizedValueExact",
      "expectedCurrentGraphVersionId",
      "resultGraphVersionId",
      "reviewDecision",
      "snapshotDigest",
    ]) {
      expect(migration).toContain(`\`${column}\``);
    }
  });
});
