import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./brief.ts", import.meta.url), "utf8");
const workspaceSource = readFileSync(
  new URL("../../client/src/components/brief-workflow/BriefWorkspace.tsx", import.meta.url),
  "utf8"
);
const containerSource = readFileSync(
  new URL("../../client/src/components/brief-workflow/BriefWorkspaceContainer.tsx", import.meta.url),
  "utf8"
);
const workflowDbSource = readFileSync(
  new URL("../db/brief-workflow.ts", import.meta.url),
  "utf8"
);

const commands = [
  "createStream", "createVersion", "reviseSection", "submitEvidence",
  "assignRole", "revokeRole", "recordFinding", "submitFindingResolution",
  "acceptFindingResolution", "decideApplicability", "raiseCondition",
  "submitConditionResolution", "acceptConditionResolution", "acceptReview",
  "approveSection", "withdrawApproval", "issue", "supersedeIssue",
  "requestIssueWithdrawal", "approveIssueWithdrawal",
] as const;

const queries = [
  "getStream", "listStreams", "getVersion", "getStudio", "getSectionHistory",
  "getAssignments", "getFindings", "getDependencyStatus",
  "getWorkflowHistory", "getIssueLedger", "getReadiness",
] as const;

describe("BR-04 canonical brief studio boundary", () => {
  it("registers every approved command and query behind organization procedures", () => {
    for (const name of [...commands, ...queries]) {
      expect(routerSource).toMatch(new RegExp(`\\b${name}: (?:orgAdminProcedure|orgMutationProcedure|orgProcedure)`));
    }
    expect(routerSource).not.toContain("publicProcedure");
  });

  it("keeps authoritative readiness on the server", () => {
    expect(routerSource).toContain("evaluateBriefReadiness");
    expect(containerSource).toContain("briefApi.getStudio.useQuery");
    expect(containerSource).not.toContain("evaluateBriefReadiness");
  });

  it("labels working preview as non-issued and avoids legacy report/share APIs", () => {
    expect(workspaceSource).toContain("WORKING DRAFT — NOT ISSUED");
    expect(workspaceSource).toContain("does not create a report, export, share token, public artifact, or issued brief");
    expect(containerSource).not.toMatch(/generateReport|exportBrief|createShare|shareToken/);
  });

  it("keeps evaluation readiness separate from brief readiness", () => {
    expect(routerSource).not.toContain("project-readiness");
    expect(routerSource).toContain("@shared/brief-contract");
  });

  it("returns the bound section revision using the client contract field", () => {
    expect(workflowDbSource).toContain("revisionId: binding.sectionRevisionId");
    expect(containerSource).toContain("section.revisionId");
  });

  it("uses structured content, authorized references and no raw-ID controls", () => {
    expect(routerSource).toContain("BRIEF_SECTION_CONTENT_SCHEMA_VERSION");
    expect(routerSource).toContain("briefSectionContentV1InputSchema");
    expect(routerSource).toContain("requireEvidenceRecordForOrg");
    expect(containerSource).toContain("evidenceReferences");
    expect(workspaceSource).not.toContain('aria-label="Target ID"');
    expect(workspaceSource).not.toContain('Owner user ID');
    expect(workspaceSource).not.toContain('Grant event ID');
  });
});
