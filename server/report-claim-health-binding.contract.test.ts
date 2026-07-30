import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectRouter = readFileSync(
  new URL("./routers/project.ts", import.meta.url),
  "utf8"
);
const database = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("EV-04 stored-report claim-health binding", () => {
  it("evaluates once at the report clock and renders/stores the same safe projection", () => {
    const generate = projectRouter.slice(
      projectRouter.indexOf("generateReport:"),
      projectRouter.indexOf("listReports:")
    );
    expect(generate).toContain("Math.trunc(Date.now() / 1_000) * 1_000");
    expect(generate).toContain("loadProjectClaimHealth");
    expect(generate).toContain("evaluatedAt: reportMaterialAsOf");
    expect(generate).toContain(
      "claimHealth: reportClaimHealth.evaluation.safeProjection"
    );
    expect(generate).toContain("claimHealthSnapshot:");
    expect(generate).toContain(
      "evaluationInput: reportClaimHealth.evaluationInput"
    );
    expect(generate).toContain(
      "authorityBinding: reportClaimHealth.authorityBinding"
    );
    expect(generate).toContain("createClaimHealthDigests");
    expect(generate).not.toContain('artifactSnapshot: "missing"');
  });

  it("binds the immutable snapshot in the report insert transaction", () => {
    const persistence = database.slice(
      database.indexOf("export async function createReportArtifactsForOrg"),
      database.indexOf("export async function getReportsByProject")
    );
    const reportInsert = persistence.indexOf(
      "tx.insert(reportInstances).values(input.report)"
    );
    const snapshotInsert = persistence.indexOf(
      "createClaimHealthSnapshotInTransaction"
    );
    expect(reportInsert).toBeGreaterThan(0);
    expect(snapshotInsert).toBeGreaterThan(reportInsert);
    expect(persistence).toContain("reportInstanceId: reportId");
    expect(persistence).toContain('consumer: "stored_project_report"');
    expect(persistence).not.toContain("createClaimHealthSnapshot(");
  });

  it("projects pre-EV-04 reports as legacy without a live health recomputation", () => {
    const list = projectRouter.slice(projectRouter.indexOf("listReports:"));
    expect(list).toContain('artifactSnapshot: "missing"');
    expect(list).toContain("getVerifiedReportClaimHealthProjection");
    expect(list).not.toContain("content.claimHealth");
    expect(list).not.toContain("loadProjectClaimHealth");
  });
});
