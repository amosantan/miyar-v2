import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("TR-09 integration contracts", () => {
  it("keeps public connector matching tenant-safe, append-only, and atomic", () => {
    const db = source("../db.ts");
    const helperStart = db.indexOf(
      "export async function upsertPublicEvidenceObservation"
    );
    const helperEnd = db.indexOf(
      "export async function recordRejectedConfidenceAssessment",
      helperStart
    );
    const helper = db.slice(helperStart, helperEnd);

    expect(helper).toContain("db.transaction");
    expect(helper).toContain("isNull(evidenceRecords.orgId)");
    expect(helper).toContain("isNull(evidenceRecords.projectId)");
    expect(helper).toContain(
      'eq(evidenceRecords.corpusScope, "platform_public")'
    );
    expect(helper).toContain("publicObservationKey");
    expect(helper).toContain("onDuplicateKeyUpdate");
    expect(helper).toContain("supersedesObservationId: latest.id");
    expect(helper).toContain(
      'mergeDecision: createdRoot ? "inserted" : "latest_accepted"'
    );
    expect(helper).not.toContain("latestObservation");
    expect(helper).not.toContain("Math.max");
  });

  it("preserves connector rejection identity and assessment attribution", () => {
    const orchestrator = source("ingestion/orchestrator.ts");
    expect(orchestrator).toContain("err instanceof ConfidencePolicyError");
    expect(orchestrator).toContain(
      'confidenceRejection?.rejectionCode ?? "normalization_failed"'
    );
    expect(orchestrator).toContain('corpusScope: "platform_public"');
    expect(orchestrator).toContain("sourceId: String(connector.sourceId)");
    expect(orchestrator).toContain("actorId");

    const csv = source("ingestion/csv-pipeline.ts");
    expect(csv).toContain("sourceId: String(source.id)");
    expect(csv).toContain("actorId: addedByUserId");
    expect(csv).toContain('corpusScope: "legacy_unscoped"');
  });

  it("feeds saved space provenance to live and report sensitivity", () => {
    const router = source("../routers/project.ts");
    expect(router).toContain("resolveSpaceEfficiencyEvidence(latestSnapshot)");
    expect(router).toMatch(
      /inputs\.spaceEfficiencyEvidence\s*=\s*savedEvidence\.status/
    );
    expect(router).toContain("const sensitivityInputs = {");
    expect(router).toContain(
      "runSensitivityAnalysis(sensitivityInputs, config)"
    );
    expect(router).toContain(
      'spaceResult.evidence.benchmarkBasis === "dld_area"'
    );
    expect(router).toMatch(/MIYAR UAE space benchmarks?/);
  });

  it("blocks both annex-bearing reports before generation or side effects", () => {
    const router = source("../routers/project.ts");
    const reportStart = router.indexOf(
      "generateReport: orgHeavyMutationProcedure"
    );
    const reportEnd = router.indexOf("listReports: orgProcedure", reportStart);
    const report = router.slice(reportStart, reportEnd);
    const boardRead = report.indexOf("getReportBoardSnapshotForOrg");

    expect(report).toMatch(
      /input\.reportType === "design_brief"\s*\|\|\s*input\.reportType === "full_report"/
    );
    expect(report).toContain('message: "REPORT_BOARD_RETRIEVAL_FAILED"');
    expect(boardRead).toBeGreaterThan(0);
    for (const laterOperation of [
      "getScoreMatricesByProject",
      "generateReportHTML",
      "storagePut",
      "createReportArtifactsForOrg",
      "createAuditLog",
      "dispatchWebhook",
    ]) {
      expect(report.indexOf(laterOperation)).toBeGreaterThan(boardRead);
    }
  });

  it("uses one scoped board snapshot with missing joins and newest-board ordering", () => {
    const db = source("../db.ts");
    const helperStart = db.indexOf(
      "export async function getReportBoardSnapshotForOrg"
    );
    const helperEnd = db.indexOf(
      "export async function getMaterialBoardById",
      helperStart
    );
    const helper = db.slice(helperStart, helperEnd);

    expect(helper).toMatch(/\.leftJoin\(\s*materialsToBoards/);
    expect(helper).toMatch(/\.leftJoin\(\s*materialsCatalog/);
    expect(helper).toContain("eq(projects.orgId, orgId)");
    expect(helper).toContain("desc(materialBoards.createdAt)");
    expect(helper).toContain("desc(materialBoards.id)");
    expect(helper).not.toContain("boardJson");
  });

  it("preserves an explicit zero maintenance factor in board-cost enrichment", () => {
    const router = source("../routers/project.ts");
    const reportStart = router.indexOf(
      "generateReport: orgHeavyMutationProcedure"
    );
    const reportEnd = router.indexOf("listReports: orgProcedure", reportStart);
    const report = router.slice(reportStart, reportEnd);

    expect(report).toContain('maintenanceFactor ?? "0.05"');
    expect(report).not.toContain('maintenanceFactor || "0.05"');
  });

  it("keeps migration 0049 additive and does not fabricate legacy history", () => {
    const migration = source(
      "../../drizzle/0049_tr09_confidence_provenance.sql"
    );
    expect(migration).toContain(
      "CREATE TABLE `evidence_confidence_assessments`"
    );
    expect(migration).toContain(
      "evidence_confidence_assessments_evidence_time_idx"
    );
    expect(migration).toContain(
      "evidence_confidence_assessments_run_outcome_idx"
    );
    expect(migration).toContain("ADD `currentConfidenceAssessmentId` int");
    expect(migration).toContain("ADD `confidencePolicyVersion` varchar(64)");
    expect(migration).toContain("ADD `publicObservationKey` varchar(64)");
    expect(migration).toContain(
      "evidence_records_public_observation_key_unique"
    );
    expect(migration).toContain("`sourceId` varchar(64)");
    expect(migration).toContain("`actorId` int");
    expect(migration).toContain("`assessmentCorpusScope`");
    expect(migration).toContain("ADD `recordsRejected` int DEFAULT 0 NOT NULL");
    expect(migration).not.toMatch(/UPDATE\s+`?evidence_records`?/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });
});
