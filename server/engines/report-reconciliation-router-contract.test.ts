import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function projectReportSource(): string {
  const router = readFileSync(new URL("../routers/project.ts", import.meta.url), "utf8");
  const start = router.indexOf("generateReport: orgHeavyMutationProcedure");
  const end = router.indexOf("listReports: orgProcedure", start);
  return router.slice(start, end);
}

describe("full-report reconciliation router contract", () => {
  it("builds the contract from stored organization-scoped workflow data before rendering", () => {
    const report = projectReportSource();
    const reconciliationStart = report.indexOf("if (input.reportType === \"full_report\")");
    const renderStart = report.indexOf("generateReportHTML");

    expect(reconciliationStart).toBeGreaterThan(0);
    expect(report).toContain("db.getSpaceProgramRooms(input.projectId, ctx.orgId)");
    expect(report).toContain("db.getMaterialAllocations(input.projectId, ctx.orgId)");
    expect(report).toContain("db.getMaterialLibrary()");
    expect(report).toContain("buildWorkflowSpaceMqiReconciliation({");
    expect(report).toContain("projectFitOutAreaM2: project.totalFitoutArea");
    expect(report).toContain("workflowReconciliation,");
    expect(renderStart).toBeGreaterThan(reconciliationStart);
  });
});
