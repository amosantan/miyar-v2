import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEvidenceRecordById: vi.fn(),
  getProjectById: vi.fn(),
  getCompetitorProjectById: vi.fn(),
  getTaggedEntities: vi.fn(),
}));

vi.mock("../db", () => ({
  getEvidenceRecordById: mocks.getEvidenceRecordById,
  getProjectById: mocks.getProjectById,
  getCompetitorProjectById: mocks.getCompetitorProjectById,
  getTaggedEntities: mocks.getTaggedEntities,
  getScenarioById: vi.fn(),
  getDesignBriefById: vi.fn(),
  getReportById: vi.fn(),
  getMaterialBoardById: vi.fn(),
}));

import {
  requireEvidenceRecordForOrg,
  requireMarketTagTargetForOrg,
  requireTaggedEntitiesForOrg,
} from "./market-resource-access";

describe("market resource authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectById.mockImplementation(async (id: number) => {
      if (id === 11) return { id, orgId: 101 };
      if (id === 22) return { id, orgId: 202 };
      return undefined;
    });
  });

  it("allows organization-owned project evidence", async () => {
    const evidence = {
      id: 1,
      projectId: 11,
      orgId: 101,
      confidentiality: "confidential",
    };
    mocks.getEvidenceRecordById.mockResolvedValue(evidence);

    await expect(requireEvidenceRecordForOrg(1, 101)).resolves.toEqual({
      evidence,
      project: { id: 11, orgId: 101 },
    });
  });

  it.each([
    {
      label: "cross-organization project",
      evidence: { id: 2, projectId: 22, orgId: 202, confidentiality: "public" },
    },
    {
      label: "mismatched evidence owner",
      evidence: { id: 3, projectId: 11, orgId: 202, confidentiality: "public" },
    },
    {
      label: "legacy null owner",
      evidence: { id: 4, projectId: 11, orgId: null, confidentiality: "public" },
    },
    {
      label: "restricted global evidence",
      evidence: { id: 5, projectId: null, orgId: null, confidentiality: "restricted" },
    },
  ])("rejects $label without disclosing ownership", async ({ evidence }) => {
    mocks.getEvidenceRecordById.mockResolvedValue(evidence);
    await expect(requireEvidenceRecordForOrg(evidence.id, 101)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  });

  it("allows public global evidence and same-organization unlinked evidence", async () => {
    mocks.getEvidenceRecordById.mockResolvedValueOnce({
      id: 6,
      projectId: null,
      orgId: null,
      confidentiality: "public",
    });
    await expect(requireEvidenceRecordForOrg(6, 101)).resolves.toMatchObject({
      evidence: { id: 6 },
      project: null,
    });

    mocks.getEvidenceRecordById.mockResolvedValueOnce({
      id: 7,
      projectId: null,
      orgId: 101,
      confidentiality: "internal",
    });
    await expect(requireEvidenceRecordForOrg(7, 101)).resolves.toMatchObject({
      evidence: { id: 7 },
      project: null,
    });
  });

  it("allows platform-public confidence provenance without exposing tenant evidence", async () => {
    mocks.getEvidenceRecordById.mockResolvedValue({
      id: 8,
      projectId: null,
      orgId: null,
      corpusScope: "platform_public",
      confidentiality: "internal",
    });
    await expect(requireEvidenceRecordForOrg(8, 101)).resolves.toMatchObject({
      evidence: { id: 8, corpusScope: "platform_public" },
      project: null,
    });
  });

  it("keeps the market tag registry closed", async () => {
    await expect(
      requireMarketTagTargetForOrg("unsupported", 1, 101)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getEvidenceRecordById).not.toHaveBeenCalled();
  });

  it("filters tagged entities to targets visible to the organization", async () => {
    mocks.getTaggedEntities.mockResolvedValue([
      { id: 1, tagId: 9, entityType: "project", entityId: 11 },
      { id: 2, tagId: 9, entityType: "project", entityId: 22 },
    ]);
    await expect(requireTaggedEntitiesForOrg(9, 101)).resolves.toEqual([
      { id: 1, tagId: 9, entityType: "project", entityId: 11 },
    ]);
  });
});
