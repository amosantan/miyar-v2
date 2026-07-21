import { describe, expect, it } from "vitest";
import {
  ACHIEVED_STATES,
  BRIEF_SECTION_IDS,
  type BriefSectionId,
  type IssuePurpose,
} from "@shared/brief-contract";
import {
  evaluateBriefReadiness,
  type BriefReadinessFacts,
  type BriefSectionReadinessFacts,
} from "./brief-readiness";

function section(
  sectionId: BriefSectionId,
  overrides: Partial<BriefSectionReadinessFacts> = {}
): BriefSectionReadinessFacts {
  return {
    sectionId,
    applicability: "required",
    achievedState: "approved",
    revisionId: `revision-${sectionId}`,
    authorUserId: 1,
    reviewerUserId: 2,
    approverUserId: 3,
    requirements: [
      {
        ruleId: `${sectionId}-rule`,
        classified: true,
        required: true,
        hasContent: true,
        hasEvidence: true,
        authority: "governed_evidence",
        lineageComplete: true,
      },
    ],
    conditions: [],
    findings: [],
    reconciliations: [],
    ...overrides,
  };
}

function facts(
  overrides: Partial<BriefReadinessFacts> = {}
): BriefReadinessFacts {
  return {
    briefId: "brief-1",
    versionId: "version-1",
    streamRevision: 8,
    versionRevision: 4,
    purpose: "internal_coordination",
    profile: "apartment",
    componentIds: ["apartment"],
    sections: BRIEF_SECTION_IDS.map(id => section(id)),
    issuerUserId: 4,
    activeRoles: [
      { userId: 4, role: "issuer" },
      { userId: 4, role: "approver" },
    ],
    issueMetadata: {
      documentIdentity: true,
      disclaimerVersion: true,
      confidentiality: true,
      distributionPolicyVersion: true,
      reproducibilityIdentity: true,
    },
    ...overrides,
  };
}

describe("deterministic brief readiness", () => {
  it.each(["apartment", "villa", "office", "hospitality", "retail"] as const)(
    "issues a complete %s profile",
    profile => {
      const result = evaluateBriefReadiness(
        facts({ profile, componentIds: [profile] })
      );
      expect(result.canIssue).toBe(true);
      expect(result.sections).toHaveLength(10);
      expect(result.displayProgress).toBe(100);
    }
  );

  it.each([
    "internal_coordination",
    "client_board_approval",
    "tender_rfq",
  ] as const)("applies the %s purpose profile", purpose => {
    const result = evaluateBriefReadiness(facts({ purpose }));
    expect(result.canIssue).toBe(true);
    expect(result.purpose).toBe(purpose);
  });

  it("fails closed unless there is exactly one of every canonical section", () => {
    const sections = facts().sections.slice(1).concat(section("governance"));
    const result = evaluateBriefReadiness(facts({ sections }));
    expect(result.canIssue).toBe(false);
    expect(
      result.reasons
        .filter(r => r.code === "invalid_section_structure")
        .map(r => r.sectionId)
    ).toEqual(["intent", "governance"]);
  });

  it("keeps stale and blocked independent at brief, section, and component levels", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "supply"
        ? section("supply", {
            conditions: [
              {
                conditionId: "stale-1",
                kind: "stale",
                active: true,
                componentId: "apartment",
                dependencyId: "quote-1",
              },
              {
                conditionId: "blocked-1",
                kind: "blocked",
                active: true,
                componentId: "apartment",
              },
            ],
          })
        : item
    );
    const result = evaluateBriefReadiness(facts({ sections }));
    expect(result).toMatchObject({
      isStale: true,
      isBlocked: true,
      canIssue: false,
    });
    expect(result.sections.find(s => s.sectionId === "supply")).toMatchObject({
      isStale: true,
      isBlocked: true,
    });
    expect(result.components[0]).toMatchObject({
      isStale: true,
      isBlocked: true,
    });
  });

  it("reports stable gate, section, component and rule ordering", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "intent"
        ? section("intent", {
            requirements: [
              {
                ruleId: "z",
                componentId: "b",
                classified: false,
                required: true,
                hasContent: false,
                hasEvidence: false,
              },
              {
                ruleId: "a",
                componentId: "a",
                classified: false,
                required: true,
                hasContent: false,
                hasEvidence: false,
              },
            ],
          })
        : item
    );
    const first = evaluateBriefReadiness(facts({ sections })).reasons;
    const second = evaluateBriefReadiness(facts({ sections })).reasons;
    expect(first).toEqual(second);
    expect(
      first.slice(0, 2).map(r => [r.code, r.componentId, r.ruleId])
    ).toEqual([
      ["unclassified_requirement", "a", "a"],
      ["unclassified_requirement", "b", "z"],
    ]);
  });

  it("never accepts AI suggestion as evidence authority", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "intent"
        ? section("intent", {
            requirements: [
              {
                ruleId: "objective",
                classified: true,
                required: true,
                hasContent: true,
                hasEvidence: true,
                authority: "ai_suggestion",
                lineageComplete: true,
              },
            ],
          })
        : item
    );
    expect(evaluateBriefReadiness(facts({ sections })).reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_evidence",
          ruleId: "objective",
        }),
      ])
    );
  });

  it.each([
    ["client_board_approval", "decision"],
    ["tender_rfq", "procurement"],
  ] as const)("rejects %s-critical assumptions for %s", (purpose, impact) => {
    const sections = facts().sections.map(item =>
      item.sectionId === "cost_quantities"
        ? section("cost_quantities", {
            requirements: [
              {
                ruleId: "cost",
                classified: true,
                required: true,
                hasContent: true,
                hasEvidence: true,
                authority: "declared_assumption",
                assumptionImpacts: [impact],
                lineageComplete: true,
              },
            ],
          })
        : item
    );
    expect(
      evaluateBriefReadiness(
        facts({ purpose: purpose as IssuePurpose, sections })
      ).reasons.some(r => r.code === "prohibited_assumption")
    ).toBe(true);
  });

  it("permits a coordination assumption but still exposes no authority from progress", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "intent"
        ? section("intent", {
            achievedState: "reviewed",
            requirements: [
              {
                ruleId: "goal",
                classified: true,
                required: true,
                hasContent: true,
                hasEvidence: true,
                authority: "declared_assumption",
                assumptionImpacts: ["coordination"],
                lineageComplete: true,
              },
            ],
          })
        : item
    );
    const result = evaluateBriefReadiness(facts({ sections }));
    expect(result.displayProgress).toBe(98);
    expect(result.canIssue).toBe(false);
  });

  it.each(ACHIEVED_STATES.slice(0, 4))(
    "requires approval when achieved state is %s",
    achievedState => {
      const sections = facts().sections.map(item =>
        item.sectionId === "intent"
          ? section("intent", { achievedState })
          : item
      );
      expect(evaluateBriefReadiness(facts({ sections })).canIssue).toBe(false);
    }
  );

  it("requires a complete independently reviewed N/A decision", () => {
    const incomplete = facts().sections.map(item =>
      item.sectionId === "supply"
        ? section("supply", {
            applicability: "not_applicable",
            achievedState: "reviewed",
            requirements: [],
            applicabilityProposerUserId: 1,
            applicabilityReviewerUserId: 2,
          })
        : item
    );
    const result = evaluateBriefReadiness(facts({ sections: incomplete }));
    expect(result.reasons.map(r => r.code)).toContain("incomplete_na_approval");
    expect(result.reasons.map(r => r.code)).toContain(
      "role_separation_failure"
    );
  });

  it("does not treat resolution of a finding or condition as maturity advancement", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "intent"
        ? section("intent", {
            achievedState: "evidenced",
            findings: [
              { findingId: "f1", severity: "blocking", resolved: true },
            ],
            conditions: [{ conditionId: "c1", kind: "blocked", active: false }],
          })
        : item
    );
    const result = evaluateBriefReadiness(facts({ sections }));
    expect(result.sections[0].achievedState).toBe("evidenced");
    expect(result.canIssue).toBe(false);
  });

  it("enforces author/reviewer/approver and issuer separation", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "intent"
        ? section("intent", {
            authorUserId: 4,
            reviewerUserId: 4,
            approverUserId: 4,
          })
        : item
    );
    const messages = evaluateBriefReadiness(facts({ sections }))
      .reasons.filter(r => r.code === "role_separation_failure")
      .map(r => r.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cannot review"),
        expect.stringContaining("cannot approve"),
        expect.stringContaining("issuer-authored"),
      ])
    );
  });

  it("requires both issuer and approver assignments", () => {
    const result = evaluateBriefReadiness(
      facts({ activeRoles: [{ userId: 4, role: "issuer" }] })
    );
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "role_separation_failure" }),
      ])
    );
  });

  it("fails mixed-use when any component is incomplete or unreconciled", () => {
    const componentIds = ["residential", "retail"];
    const sections = facts().sections.map(item =>
      section(item.sectionId, {
        componentCoverage: componentIds.map(componentId => ({
          componentId,
          complete: componentId !== "retail" || item.sectionId !== "supply",
          reconciled:
            componentId !== "retail" || item.sectionId !== "governance",
        })),
      })
    );
    const result = evaluateBriefReadiness(
      facts({ profile: "mixed_use", componentIds, sections })
    );
    expect(result.canIssue).toBe(false);
    expect(
      result.components.find(c => c.componentId === "retail")?.reasons
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_content",
          sectionId: "supply",
        }),
        expect.objectContaining({
          code: "failed_reconciliation",
          sectionId: "governance",
        }),
      ])
    );
  });

  it("fails missing lineage, professional review, reconciliation, findings, and issue metadata explicitly", () => {
    const sections = facts().sections.map(item =>
      item.sectionId === "risk_compliance"
        ? section("risk_compliance", {
            requirements: [
              {
                ruleId: "code",
                classified: true,
                required: true,
                hasContent: true,
                hasEvidence: true,
                authority: "governed_evidence",
                lineageComplete: false,
                hasRequiredProfessionalReview: false,
              },
            ],
            findings: [
              { findingId: "finding", severity: "blocking", resolved: false },
            ],
            reconciliations: [{ ruleId: "risk_limitations", passed: false }],
          })
        : item
    );
    const result = evaluateBriefReadiness(
      facts({
        sections,
        issueMetadata: { ...facts().issueMetadata, disclaimerVersion: false },
      })
    );
    expect(result.reasons.map(r => r.code)).toEqual(
      expect.arrayContaining([
        "missing_evidence",
        "missing_lineage",
        "unresolved_finding",
        "failed_reconciliation",
        "missing_issue_metadata",
      ])
    );
  });
});
