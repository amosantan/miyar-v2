import { describe, expect, it } from "vitest";
import { BRIEF_SECTION_IDS, BriefWorkflowError, assertWorkingBriefVersion, decisionStage, derivePermittedBriefActions, hashBriefRequest, normalizeApplicabilityStage } from "./brief-workflow";

describe("canonical brief workflow foundations", () => {
  it("defines exactly the ten governed section containers", () => {
    expect(BRIEF_SECTION_IDS).toHaveLength(10);
    expect(new Set(BRIEF_SECTION_IDS).size).toBe(10);
  });

  it("hashes semantically identical request objects deterministically", () => {
    expect(hashBriefRequest({ b: 2, a: { y: 2, x: 1 } })).toBe(
      hashBriefRequest({ a: { x: 1, y: 2 }, b: 2 })
    );
  });

  it("binds array ordering into idempotency identity", () => {
    expect(hashBriefRequest({ values: [1, 2] })).not.toBe(
      hashBriefRequest({ values: [2, 1] })
    );
  });

  it("maps the public applicability review action to the persisted stage", () => {
    expect(normalizeApplicabilityStage("accept_review")).toBe("reviewed");
    expect(normalizeApplicabilityStage("withdraw")).toBe("withdrawn");
    expect(normalizeApplicabilityStage("unknown")).toBeNull();
  });

  it("preserves rejected governance outcomes", () => {
    expect(decisionStage("rejected")).toBe("rejected");
    expect(decisionStage("accepted")).toBe("accepted");
  });

  it("fails closed for locked and issued workflow versions", () => {
    expect(() => assertWorkingBriefVersion("locked")).toThrow(BriefWorkflowError);
    expect(() => assertWorkingBriefVersion("issued")).toThrow("Locked brief versions are immutable");
    expect(() => assertWorkingBriefVersion("working")).not.toThrow();
  });
});

describe("BR-04 studio action policy", () => {
  const assignment = (subjectUserId: number, role: string) => ({ subjectUserId, role, sectionId: null });

  it("shows only state-valid actions assigned by the server", () => {
    expect(derivePermittedBriefActions({ userId: 2, sectionId: "intent", achievedState: "evidenced", authorUserId: 1, activeAssignments: [assignment(2, "reviewer")] }))
      .toEqual(["record_finding", "review_not_applicable", "accept_review"]);
  });

  it("never permits an author to review or approve their own revision", () => {
    expect(derivePermittedBriefActions({ userId: 1, sectionId: "intent", achievedState: "reviewed", authorUserId: 1, activeAssignments: [assignment(1, "reviewer"), assignment(1, "approver")] }))
      .toEqual([]);
  });

  it("honours section-scoped assignments", () => {
    expect(derivePermittedBriefActions({ userId: 2, sectionId: "intent", achievedState: "drafted", authorUserId: 1, activeAssignments: [{ subjectUserId: 2, role: "section_owner", sectionId: "supply" }] }))
      .toEqual([]);
  });

  it("only advertises resolution actions for open findings and conditions", () => {
    expect(derivePermittedBriefActions({
      userId: 2,
      sectionId: "intent",
      achievedState: "drafted",
      authorUserId: 1,
      activeAssignments: [assignment(2, "section_owner")],
    })).not.toContain("submit_finding_resolution");
    expect(derivePermittedBriefActions({
      userId: 2,
      sectionId: "intent",
      achievedState: "drafted",
      authorUserId: 1,
      hasOpenFindings: true,
      hasOpenConditions: true,
      activeAssignments: [assignment(2, "section_owner")],
    })).toEqual(expect.arrayContaining(["submit_finding_resolution", "submit_condition_resolution"]));
  });
});
