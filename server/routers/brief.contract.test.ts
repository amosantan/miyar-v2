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

const commands = [
  "createStream", "createVersion", "reviseSection", "submitEvidence",
  "assignRole", "revokeRole", "recordFinding", "submitFindingResolution",
  "acceptFindingResolution", "decideApplicability", "raiseCondition",
  "submitConditionResolution", "acceptConditionResolution", "acceptReview",
  "approveSection", "withdrawApproval", "issue", "supersedeIssue",
  "requestIssueWithdrawal", "approveIssueWithdrawal",
] as const;

const queries = [
  "getStream", "listStreams", "getVersion", "getSectionHistory",
  "getAssignments", "getFindings", "getDependencyStatus",
  "getWorkflowHistory", "getIssueLedger", "getReadiness",
] as const;

describe("BR-03 canonical brief boundary", () => {
  it("registers every approved command and query behind organization procedures", () => {
    for (const name of [...commands, ...queries]) {
      expect(routerSource).toMatch(new RegExp(`\\b${name}: (?:orgAdminProcedure|orgMutationProcedure|orgProcedure)`));
    }
    expect(routerSource).not.toContain("publicProcedure");
  });

  it("keeps authoritative readiness on the server", () => {
    expect(routerSource).toContain("evaluateBriefReadiness");
    expect(containerSource).toContain("briefApi.getReadiness.useQuery");
    expect(containerSource).not.toContain("evaluateBriefReadiness");
  });

  it("labels working preview as non-issued and avoids legacy report/share APIs", () => {
    expect(workspaceSource).toContain("WORKING DRAFT — NOT ISSUED");
    expect(workspaceSource).toContain("not an immutable issue, export, report, or public share");
    expect(containerSource).not.toMatch(/generateReport|exportBrief|createShare|shareToken/);
  });

  it("keeps evaluation readiness separate from brief readiness", () => {
    expect(routerSource).not.toContain("project-readiness");
    expect(routerSource).toContain("@shared/brief-contract");
  });
});
