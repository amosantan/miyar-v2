import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { BRIEF_SECTION_CONTENT_SCHEMA_VERSION } from "@shared/brief-section-content";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  executeBriefCommand: vi.fn(),
  requireEvidenceRecordForOrg: vi.fn(),
  getBriefStudio: vi.fn(),
  listOrganizationEvidenceRecords: vi.fn(),
  listPublicCorpusEvidence: vi.fn(),
}));

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getOrganizationMemberships: mocks.getOrganizationMemberships,
    listOrganizationEvidenceRecords: mocks.listOrganizationEvidenceRecords,
    listPublicCorpusEvidence: mocks.listPublicCorpusEvidence,
  };
});

vi.mock("../db/brief-workflow", () => ({
  BriefWorkflowError: class BriefWorkflowError extends Error {},
  createBriefStream: vi.fn(),
  executeBriefCommand: mocks.executeBriefCommand,
  getBriefReadinessFacts: vi.fn(),
  getBriefSection: vi.fn(),
  getBriefStudio: mocks.getBriefStudio,
  getBriefSummary: vi.fn(),
  getBriefVersion: vi.fn(),
  listBriefAssignments: vi.fn(),
  listBriefDependencies: vi.fn(),
  listBriefEvents: vi.fn(),
  listBriefFindings: vi.fn(),
  listBriefIssues: vi.fn(),
  listBriefStreams: vi.fn(),
  hashBriefRequest: (value: unknown) => `hash-${JSON.stringify(value).length}`,
}));

vi.mock("../_core/market-resource-access", () => ({
  requireEvidenceRecordForOrg: mocks.requireEvidenceRecordForOrg,
}));

import { briefRouter } from "./brief";

function context(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "br04-user",
      password: null,
      name: "BR-04 User",
      email: "br04@example.invalid",
      loginMethod: "test",
      role: "user",
      orgId: 11,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const baseContent = {
  schemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
  sectionId: "intent" as const,
  summary: "Create a calm resident experience.",
  requirements: [{ ruleId: "intent.summary", requirement: "required" as const, authority: "explicit_user_input" as const, impacts: ["coordination" as const] }],
  assumptions: [],
  objectives: ["Improve resident experience"],
  successCriteria: [],
  targetUsers: ["Residents"],
};

describe("BR-04 brief router runtime contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationMemberships.mockResolvedValue([{ id: 1, orgId: 11, userId: 7, role: "member", createdAt: new Date() }]);
    mocks.executeBriefCommand.mockResolvedValue({ ok: true });
    mocks.listOrganizationEvidenceRecords.mockResolvedValue([]);
    mocks.listPublicCorpusEvidence.mockResolvedValue([]);
    mocks.requireEvidenceRecordForOrg.mockResolvedValue({
      evidence: {
        id: 91,
        recordId: "MYR-PE-0091",
        projectId: 21,
        orgId: 11,
        captureDate: new Date("2026-07-20T00:00:00Z"),
        createdAt: new Date("2026-07-20T00:00:00Z"),
        corpusPolicyVersion: "EV-v1",
        currentConfidenceAssessmentId: 3,
        runId: "run-4",
      },
      project: { id: 21 },
    });
  });

  it("normalizes structured content and resolves evidence metadata on the server", async () => {
    await expect(briefRouter.createCaller(context()).reviseSection({
      projectId: 21,
      briefId: "31",
      versionId: "41",
      expectedRevision: 2,
      idempotencyKey: "br04-valid-request",
      sectionId: "intent",
      contentSchemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
      content: baseContent,
      origin: "user",
      evidenceReferences: [{ kind: "evidence_record", id: 91, ruleId: "intent.summary", relevance: "Client requirement" }],
    })).resolves.toEqual({ ok: true });
    expect(mocks.executeBriefCommand).toHaveBeenCalledWith("reviseSection", expect.objectContaining({
      content: expect.objectContaining({ sectionId: "intent" }),
      dependencies: [expect.objectContaining({
        type: "evidence",
        recordId: "91",
        recordVersion: "run-4",
        authority: "governed_evidence",
        serverResolved: true,
      })],
    }), expect.objectContaining({ organizationId: 11, userId: 7 }));
  });

  it("rejects a content/section mismatch before mutation", async () => {
    await expect(briefRouter.createCaller(context()).reviseSection({
      projectId: 21, briefId: "31", versionId: "41", expectedRevision: 2,
      idempotencyKey: "br04-mismatch", sectionId: "asset_context",
      contentSchemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
      content: baseContent, origin: "user", evidenceReferences: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.executeBriefCommand).not.toHaveBeenCalled();
  });

  it("rejects cross-project evidence without revealing it", async () => {
    await expect(briefRouter.createCaller(context()).reviseSection({
      projectId: 99, briefId: "31", versionId: "41", expectedRevision: 2,
      idempotencyKey: "br04-cross-project", sectionId: "intent",
      contentSchemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
      content: baseContent, origin: "user",
      evidenceReferences: [{ kind: "evidence_record", id: 91, ruleId: "intent.summary", relevance: "Client requirement" }],
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.executeBriefCommand).not.toHaveBeenCalled();
  });

  it("returns one aggregate with only sanitized, in-scope picker choices", async () => {
    mocks.getBriefStudio.mockResolvedValue({
      identity: { projectId: 21, briefId: "31", versionId: "41", streamRevision: 2, versionRevision: 1 },
      sections: Array.from({ length: 10 }, (_, index) => ({ id: String(index + 1), sectionId: index === 0 ? "intent" : `section-${index}` })),
      choices: { members: [{ id: 7, label: "BR-04 User", organizationRole: "member" }] },
      permittedActions: { createVersion: true, issue: false, administerRoles: false },
    });
    mocks.listOrganizationEvidenceRecords.mockResolvedValue([
      { id: 91, projectId: 21, orgId: 11, title: "UAE finish evidence", itemName: "Finish", recordId: "MYR-PE-0091", category: "floors", reliabilityGrade: "A", captureDate: new Date("2026-07-20") },
      { id: 92, projectId: 99, orgId: 11, title: "Other project", itemName: "Other", recordId: "MYR-PE-0092", category: "walls", reliabilityGrade: "B", captureDate: new Date("2026-07-20") },
      { id: 93, projectId: 21, orgId: 12, title: "Other organization", itemName: "Foreign", recordId: "MYR-PE-0093", category: "walls", reliabilityGrade: "B", captureDate: new Date("2026-07-20") },
    ]);
    const studio = await briefRouter.createCaller(context()).getStudio({ projectId: 21, briefId: "31", versionId: "41" });
    expect(studio.identity).toEqual({ projectId: 21, briefId: "31", versionId: "41", streamRevision: 2, versionRevision: 1 });
    expect(studio.choices.evidence).toEqual([expect.objectContaining({ id: 91, label: "UAE finish evidence", scope: "organization" })]);
    expect(studio.choices.evidence[0]).not.toHaveProperty("sourceUrl");
  });
});
