import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "member" as "admin" | "member" | "viewer",
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  getProjectAssetById: vi.fn(),
  getGeometryComparisonForOrg: vi.fn(),
  commitShadowGeometryForOrg: vi.fn(),
  reviewShadowGeometryForOrg: vi.fn(),
  storageRead: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
  getProjectById: mocks.getProjectById,
  getProjectAssetById: mocks.getProjectAssetById,
  getGeometryComparisonForOrg: mocks.getGeometryComparisonForOrg,
  commitShadowGeometryForOrg: mocks.commitShadowGeometryForOrg,
  reviewShadowGeometryForOrg: mocks.reviewShadowGeometryForOrg,
}));

vi.mock("../storage", () => ({ storageRead: mocks.storageRead }));

import { authorizationFixtures } from "../test-utils/authorization-fixtures";
import { resetRateLimitForTests } from "../_core/rate-limit";
import {
  manualPreview,
  spaceProgramGeometryRouter,
} from "./spaceProgram-geometry";

const { contexts, projects } = authorizationFixtures;

function caller() {
  return spaceProgramGeometryRouter.createCaller(contexts.orgA);
}

const manualInput = {
  projectId: projects.orgA.id,
  sourceUnit: "m" as const,
  snapTransform: "none" as const,
  rooms: [
    {
      spaceId: "manual-room-001",
      roomName: "Living room",
      levelElevation: "0",
      outerRing: [
        { x: "0", y: "0" },
        { x: "4", y: "0" },
        { x: "4", y: "3" },
        { x: "0", y: "3" },
        { x: "0", y: "0" },
      ],
    },
  ],
};

describe("DI-01 geometry API authorization and shadow behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitForTests();
    mocks.role = "member";
    mocks.getOrganizationMemberships.mockImplementation(
      async (userId: number, orgId: number) => [
        { id: userId, userId, orgId, role: mocks.role, createdAt: new Date() },
      ]
    );
    mocks.getProjectById.mockImplementation(async (id: number) =>
      id === projects.orgA.id
        ? { ...projects.orgA, totalFitoutArea: "10.00" }
        : id === projects.orgB.id
          ? { ...projects.orgB, totalFitoutArea: "20.00" }
          : undefined
    );
    mocks.getProjectAssetById.mockResolvedValue({
      id: 222,
      projectId: projects.orgB.id,
      assetType: "cad",
      filename: "other.dxf",
      mimeType: "application/dxf",
      storagePath: "other.dxf",
      checksum: "a".repeat(64),
    });
    mocks.getGeometryComparisonForOrg.mockResolvedValue({
      authority: undefined,
      candidate: undefined,
      source: undefined,
      review: undefined,
      legacyRooms: [],
    });
    mocks.commitShadowGeometryForOrg.mockResolvedValue({
      kind: "ok",
      replayed: false,
      graphVersionId: 71,
      geometrySourceId: 81,
      fingerprint: "b".repeat(64),
    });
    mocks.reviewShadowGeometryForOrg.mockResolvedValue({
      kind: "ok",
      currentGraphVersionId: 71,
      selectedGeometryVersionId: 71,
      decision: "accepted",
    });
  });

  it("previews a user-entered polygon deterministically without persistence", async () => {
    const result = await caller().previewManualGeometry(manualInput);

    expect(result.status).toBe("ready");
    expect(result.totalAreaSqm).toBe("12");
    expect(result.rooms[0]).toMatchObject({
      spaceId: "manual-room-001",
      status: "user_entered",
      areaSqm: "12",
    });
    expect(mocks.commitShadowGeometryForOrg).not.toHaveBeenCalled();
  });

  it("rejects manual input immediately above the room and vertex ceilings", async () => {
    const rooms = Array.from({ length: 101 }, (_, index) => ({
      ...manualInput.rooms[0],
      spaceId: `manual-room-${index}`,
    }));
    await expect(
      caller().previewManualGeometry({ ...manualInput, rooms })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const repeatedRing = Array.from({ length: 2_001 }, (_, index) => ({
      x: String(index),
      y: "0",
    }));
    const overVertexLimit = {
      ...manualInput.rooms[0],
      outerRing: repeatedRing,
      holes: Array.from({ length: 4 }, () => repeatedRing),
    };
    await expect(
      caller().previewManualGeometry({
        ...manualInput,
        rooms: [overVertexLimit],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Manual geometry exceeds the 10,000 vertex limit.",
    });
  });

  it("maps an exhausted manual CPU deadline to a fail-closed client error", () => {
    expect(() =>
      manualPreview(
        manualInput.rooms,
        manualInput.sourceUnit,
        manualInput.snapTransform,
        Date.now() - 1
      )
    ).toThrow(
      "Manual geometry exceeded the 500 millisecond processing deadline"
    );
  });

  it("rejects a sixth manual preview for one user within the heavy-operation window", async () => {
    for (let index = 0; index < 5; index += 1) {
      await expect(
        caller().previewManualGeometry(manualInput)
      ).resolves.toMatchObject({ status: "ready" });
    }

    await expect(
      caller().previewManualGeometry(manualInput)
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("keeps viewers read-only before project or geometry access", async () => {
    mocks.role = "viewer";

    await expect(
      caller().previewManualGeometry(manualInput)
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.getProjectById).not.toHaveBeenCalled();
  });

  it("fails a cross-organization asset ID closed before reading storage", async () => {
    await expect(
      caller().previewDxfGeometry({
        projectId: projects.orgA.id,
        assetId: 222,
        sourceUnit: "m",
        snapTransform: "none",
        levelElevation: "0",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storageRead).not.toHaveBeenCalled();
  });

  it("rejects unfinalized, checksum-mismatched, and oversized CAD assets", async () => {
    mocks.getProjectAssetById.mockResolvedValueOnce({
      id: 111,
      projectId: projects.orgA.id,
      assetType: "image",
      filename: "not-finalized.dxf",
      mimeType: "application/dxf",
      storagePath: "pending.dxf",
      checksum: null,
    });
    await expect(
      caller().previewDxfGeometry({
        projectId: projects.orgA.id,
        assetId: 111,
        sourceUnit: "m",
        snapTransform: "none",
        levelElevation: "0",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    mocks.getProjectAssetById.mockResolvedValueOnce({
      id: 112,
      projectId: projects.orgA.id,
      assetType: "cad",
      filename: "tampered.dxf",
      mimeType: "application/dxf",
      storagePath: "tampered.dxf",
      checksum: "a".repeat(64),
    });
    mocks.storageRead.mockResolvedValueOnce({
      sizeBytes: 3,
      buffer: Buffer.from("bad"),
      contentType: "application/dxf",
    });
    await expect(
      caller().previewDxfGeometry({
        projectId: projects.orgA.id,
        assetId: 112,
        sourceUnit: "m",
        snapTransform: "none",
        levelElevation: "0",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    mocks.getProjectAssetById.mockResolvedValueOnce({
      id: 113,
      projectId: projects.orgA.id,
      assetType: "cad",
      filename: "oversized.dxf",
      mimeType: "application/dxf",
      storagePath: "oversized.dxf",
      checksum: "b".repeat(64),
    });
    mocks.storageRead.mockResolvedValueOnce({
      sizeBytes: 10 * 1024 * 1024 + 1,
      buffer: Buffer.alloc(0),
      contentType: "application/dxf",
    });
    await expect(
      caller().previewDxfGeometry({
        projectId: projects.orgA.id,
        assetId: 113,
        sourceUnit: "m",
        snapTransform: "none",
        levelElevation: "0",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets viewers read comparison state but exposes no write capability", async () => {
    mocks.role = "viewer";

    const result = await caller().getGeometryComparison({
      projectId: projects.orgA.id,
    });

    expect(result).toMatchObject({
      authorityMode: "legacy",
      canWrite: false,
      canReview: false,
      legacy: { totalAreaSqm: 10, status: "legacy_estimate" },
      reconciliation: { status: "not_checked" },
    });
  });

  it("commits only through the shadow repository and never changes legacy authority", async () => {
    const result = await caller().commitShadowGeometry({
      projectId: projects.orgA.id,
      expectedCurrentVersionId: null,
      source: { kind: "manual", ...manualInput },
    });

    expect(result).toMatchObject({
      geometryVersionId: 71,
      authorityMode: "shadow",
      replayed: false,
    });
    expect(mocks.commitShadowGeometryForOrg).toHaveBeenCalledOnce();
    expect(mocks.commitShadowGeometryForOrg.mock.calls[0][0]).toMatchObject({
      projectId: projects.orgA.id,
      expectedCurrentVersionId: null,
      source: { sourceType: "manual", acquisitionMethod: "manual_entry" },
    });
  });

  it("reserves review decisions for organization admins", async () => {
    await expect(
      caller().reviewGeometryCandidate({
        projectId: projects.orgA.id,
        geometryVersionId: 71,
        expectedCurrentVersionId: 71,
        decision: "accepted",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.reviewShadowGeometryForOrg).not.toHaveBeenCalled();

    mocks.role = "admin";
    await expect(
      caller().reviewGeometryCandidate({
        projectId: projects.orgA.id,
        geometryVersionId: 71,
        expectedCurrentVersionId: 71,
        decision: "accepted",
      })
    ).resolves.toMatchObject({ decision: "accepted" });
  });
});
