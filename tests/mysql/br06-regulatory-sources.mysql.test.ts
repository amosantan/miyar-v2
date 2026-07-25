import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { createRegulatorySourceAssertion, createRegulatorySourceRelation, loadRegulatoryResolutionState, recordRegulatoryCapture, registerRegulatorySource, RegulatorySourceStoreError } from "../../server/db/regulatory-sources";
import { resolveRegulatoryReference } from "../../server/engines/regulatory-source-resolution";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(url);

const registration = {
  sourceKey: "dm.br06-test", title: "BR-06 disposable source", issuingAuthority: "dubai_municipality" as const,
  sourceClass: "building_code" as const, jurisdiction: "Dubai (test)", languages: ["en" as const],
  canonicalUrl: "https://www.dm.gov.ae/br06-test", approvedHosts: ["www.dm.gov.ae"],
  retentionPolicy: "metadata_only" as const, licensingStatus: "restricted" as const, coverageStatus: "candidate" as const,
  notes: "Disposable integration fixture.",
};

const requiredAssertionTypes = ["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"] as const;

// The version.status snapshot is computed against the assertion's write-time
// clock. Pin it to a fixed instant inside every fixture's validity window
// (after validFrom 2026-07-02, before any validTo used below) so the derived
// status is "asserted" regardless of the wall-clock date the suite runs on.
// Assertion expiry itself is still exercised through `basisAt` in the tests.
const ASSERTION_WRITE_CLOCK = new Date("2026-07-20T00:00:00Z");

async function assertVersion(sourceVersionId: number, options: { validTo?: Date } = {}) {
  for (const assertionType of requiredAssertionTypes) {
    await createRegulatorySourceAssertion({
      sourceVersionId,
      assertionType,
      decision: "accepted",
      assertedByUserId: 82001,
      reason: `BR-06 ${assertionType} review`,
      validFrom: new Date("2026-07-02T00:00:00Z"),
      validTo: options.validTo,
    }, { now: ASSERTION_WRITE_CLOCK });
  }
}

beforeEach(async () => {
  await pool.query("set foreign_key_checks=0");
  for (const table of ["regulatory_source_assertions", "regulatory_source_relations", "regulatory_clause_candidates", "regulatory_source_captures", "regulatory_source_versions", "regulatory_sources"]) await pool.query(`truncate table \`${table}\``);
  await pool.query("set foreign_key_checks=1");
  await pool.query("insert into users (id,openId,role) values (82001,'br06-platform-reviewer','admin') on duplicate key update role='admin'");
});
afterAll(async () => { await pool.end(); });

describe("BR-06 disposable MySQL regulatory boundary", () => {
  it("installs six separate regulatory tables with orphan protection", async () => {
    const [rows] = await pool.query<mysql.RowDataPacket[]>("select table_name from information_schema.tables where table_schema=database() and table_name like 'regulatory_%'");
    expect(new Set(rows.map(row => row.TABLE_NAME ?? row.table_name))).toEqual(new Set([
      "regulatory_sources", "regulatory_source_versions", "regulatory_source_captures", "regulatory_clause_candidates", "regulatory_source_relations", "regulatory_source_assertions",
    ]));
    await expect(pool.query("insert into regulatory_clause_candidates (sourceVersionId,clauseKey,locator,candidateSummary,candidateFingerprint,extractionMethod) values (999999,'x','p.1','x',?,'deterministic')", ["a".repeat(64)])).rejects.toMatchObject({ code: "ER_NO_REFERENCED_ROW_2" });
  });

  it("stores exact version and clause fingerprints but rejects prohibited raw retention", async () => {
    await registerRegulatorySource(registration);
    const captured = await recordRegulatoryCapture({
      sourceKey: registration.sourceKey, versionKey: "test-2026", contentFingerprint: "b".repeat(64), parserVersion: "test-v1",
      requestedUrl: registration.canonicalUrl, finalUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-21T00:00:00Z"),
      httpStatus: 200, mimeType: "application/pdf", byteLength: 12, fetchResult: "captured",
      clauseCandidates: [{ clauseKey: "clause-1", locator: "p. 1 / cl. 1", candidateSummary: "Candidate only", extractionMethod: "ai_extracted_candidate" }],
    });
    expect(captured.sourceVersionId).toBeTypeOf("number");
    const [clauses] = await pool.query<mysql.RowDataPacket[]>("select extractionMethod,candidateFingerprint from regulatory_clause_candidates");
    expect(clauses[0].extractionMethod).toBe("ai_extracted_candidate");
    expect(clauses[0].candidateFingerprint).toMatch(/^[a-f0-9]{64}$/);
    await expect(recordRegulatoryCapture({
      sourceKey: registration.sourceKey, versionKey: "test-2026", contentFingerprint: "b".repeat(64), parserVersion: "test-v1",
      requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-22T00:00:00Z"), fetchResult: "unchanged", storageReference: "private/raw.pdf",
    })).rejects.toBeInstanceOf(RegulatorySourceStoreError);
  });

  it("records disappearance as a capture candidate without withdrawing the version", async () => {
    await registerRegulatorySource(registration);
    const first = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "test-2026", contentFingerprint: "c".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-21T00:00:00Z"), fetchResult: "captured" });
    await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "test-2026", contentFingerprint: "c".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-22T00:00:00Z"), fetchResult: "disappeared_candidate", failureCode: "HTTP_404" });
    const [versions] = await pool.query<mysql.RowDataPacket[]>("select status from regulatory_source_versions where id=?", [first.sourceVersionId]);
    const [captures] = await pool.query<mysql.RowDataPacket[]>("select fetchResult from regulatory_source_captures order by id");
    expect(versions[0].status).toBe("candidate");
    expect(captures.map(row => row.fetchResult)).toEqual(["captured", "disappeared_candidate"]);
  });

  it("derives asserted/stale version state and preserves multiple clause-level relations", async () => {
    await registerRegulatorySource(registration);
    const oldVersion = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "test-2026-a", contentFingerprint: "d".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-01T00:00:00Z"), fetchResult: "captured" });
    await assertVersion(oldVersion.sourceVersionId!);
    const changed = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "test-2026-b", contentFingerprint: "e".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-03T00:00:00Z"), fetchResult: "changed_candidate" });
    const [versions] = await pool.query<mysql.RowDataPacket[]>("select id,status from regulatory_source_versions order by id");
    expect(versions.map(row => row.status)).toEqual(["stale", "candidate"]);
    const first = await createRegulatorySourceRelation({ sourceVersionId: changed.sourceVersionId!, targetSourceVersionId: oldVersion.sourceVersionId!, relationType: "amends", clauseScope: ["5.2"], effectiveFrom: new Date("2026-08-01T00:00:00Z") });
    const second = await createRegulatorySourceRelation({ sourceVersionId: changed.sourceVersionId!, targetSourceVersionId: oldVersion.sourceVersionId!, relationType: "amends", clauseScope: ["6.1"], effectiveFrom: new Date("2026-09-01T00:00:00Z") });
    expect(first.relationFingerprint).not.toBe(second.relationFingerprint);
  });

  it("rejects an out-of-order changed capture before it can stale the current version", async () => {
    await registerRegulatorySource(registration);
    const current = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "test-current", contentFingerprint: "f".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-10T00:00:00Z"), fetchResult: "captured" });
    await assertVersion(current.sourceVersionId!);
    await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "test-current", contentFingerprint: "f".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-20T00:00:00Z"), fetchResult: "unchanged" });

    await expect(recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "late-old-response", contentFingerprint: "1".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-15T00:00:00Z"), fetchResult: "changed_candidate" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    const [versions] = await pool.query<mysql.RowDataPacket[]>("select status,contentFingerprint from regulatory_source_versions order by id");
    const [captures] = await pool.query<mysql.RowDataPacket[]>("select retrievedAt from regulatory_source_captures order by id");
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ status: "asserted", contentFingerprint: "f".repeat(64) });
    expect(captures).toHaveLength(2);
  });

  it("loads changed-capture state and evaluates assertion expiry at the requested instant", async () => {
    await registerRegulatorySource(registration);
    const oldVersion = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "expiring", contentFingerprint: "2".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-10T00:00:00Z"), fetchResult: "captured" });
    await assertVersion(oldVersion.sourceVersionId!, { validTo: new Date("2026-07-25T00:00:00Z") });

    const current = await loadRegulatoryResolutionState({ sourceKey: registration.sourceKey, basisAt: new Date("2026-07-24T00:00:00Z") });
    expect(current.versions.find(version => version.contentFingerprint === "2".repeat(64))).toMatchObject({ status: "asserted", requiredAssertionsCurrent: true, latestCaptureResult: "captured" });
    expect(current.assertions).toHaveLength(5);
    expect(current.assertions[0]).toMatchObject({ sourceKey: registration.sourceKey, sourceVersionFingerprint: "2".repeat(64), decision: "accepted", assertedBy: "platform-user:82001" });
    const expired = await loadRegulatoryResolutionState({ sourceKey: registration.sourceKey, basisAt: new Date("2026-07-25T00:00:00Z") });
    expect(expired.assertions).toHaveLength(0);
    expect(resolveRegulatoryReference({ contentFingerprint: "2".repeat(64), clauseLocator: "1.1", basisAt: "2026-07-25T00:00:00Z", mode: "current", ...expired })).toMatchObject({ usable: false, reason: "not_asserted" });

    await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "changed", contentFingerprint: "3".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-26T00:00:00Z"), fetchResult: "changed_candidate" });
    const changed = await loadRegulatoryResolutionState({ sourceKey: registration.sourceKey, basisAt: new Date("2026-07-27T00:00:00Z") });
    expect(changed.versions.find(version => version.contentFingerprint === "2".repeat(64))).toMatchObject({ status: "stale", latestCaptureResult: "changed_candidate" });
  });

  it("loads persisted clause relations and governing version assertions for resolution", async () => {
    await registerRegulatorySource(registration);
    const target = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "base", contentFingerprint: "4".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-03T00:00:00Z"), fetchResult: "captured" });
    const amendment = await recordRegulatoryCapture({ sourceKey: registration.sourceKey, versionKey: "amendment", contentFingerprint: "5".repeat(64), parserVersion: "test-v1", requestedUrl: registration.canonicalUrl, retrievedAt: new Date("2026-07-04T00:00:00Z"), fetchResult: "captured" });
    await assertVersion(target.sourceVersionId!);
    await assertVersion(amendment.sourceVersionId!);
    await createRegulatorySourceRelation({ sourceVersionId: amendment.sourceVersionId!, targetSourceVersionId: target.sourceVersionId!, relationType: "amends", clauseScope: ["5.2"], effectiveFrom: new Date("2026-07-05T00:00:00Z") });

    const state = await loadRegulatoryResolutionState({ sourceKey: registration.sourceKey, basisAt: new Date("2026-07-06T00:00:00Z") });
    expect(state.versions).toHaveLength(2);
    expect(state.relations).toEqual([expect.objectContaining({ sourceVersionFingerprint: "5".repeat(64), targetVersionFingerprint: "4".repeat(64), relationType: "amends", clauseScope: ["5.2"] })]);
    expect(resolveRegulatoryReference({ contentFingerprint: "4".repeat(64), clauseLocator: "5.2.1", basisAt: "2026-07-06T00:00:00Z", mode: "current", ...state })).toMatchObject({ usable: false, reason: "amended" });
    expect(resolveRegulatoryReference({ contentFingerprint: "4".repeat(64), clauseLocator: "6.1", basisAt: "2026-07-06T00:00:00Z", mode: "current", ...state })).toMatchObject({ usable: true });
  });
});
