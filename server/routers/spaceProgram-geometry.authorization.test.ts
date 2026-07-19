import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  role: "member" as "admin" | "member" | "viewer",
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  getProjectAssetById: vi.fn(),
  getGeometryReviewStateForOrg: vi.fn(),
  saveGeometryDraftForOrg: vi.fn(),
  reviewGeometryDraftForOrg: vi.fn(),
  storageRead: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
  getProjectById: mocks.getProjectById,
  getProjectAssetById: mocks.getProjectAssetById,
  getGeometryReviewStateForOrg: mocks.getGeometryReviewStateForOrg,
  saveGeometryDraftForOrg: mocks.saveGeometryDraftForOrg,
  reviewGeometryDraftForOrg: mocks.reviewGeometryDraftForOrg,
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

const validDxf = Buffer.from(
  "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n" +
    "0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n5\nA1\n8\nRooms\n" +
    "90\n4\n70\n1\n10\n0\n20\n0\n10\n4\n20\n0\n" +
    "10\n4\n20\n3\n10\n0\n20\n3\n0\nENDSEC\n0\nEOF\n"
);

describe("DI-01 canonical geometry draft and review authorization", () => {
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
    mocks.getGeometryReviewStateForOrg.mockResolvedValue({
      authority: undefined,
      latest: undefined,
      latestSource: undefined,
      latestReview: undefined,
      canonical: undefined,
      canonicalSource: undefined,
      acceptedMeasurements: { status: "insufficient", measurements: [] },
      legacyRooms: [],
    });
    mocks.saveGeometryDraftForOrg.mockResolvedValue({
      kind: "ok",
      replayed: false,
      graphVersionId: 71,
      geometrySourceId: 81,
      fingerprint: "b".repeat(64),
    });
    mocks.reviewGeometryDraftForOrg.mockResolvedValue({
      kind: "ok",
      currentGraphVersionId: 71,
      selectedGeometryVersionId: 71,
      decision: "approve_as_canonical",
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
    expect(mocks.saveGeometryDraftForOrg).not.toHaveBeenCalled();
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
        sourceLineageId: "drawing-lineage-001",
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
        sourceLineageId: "drawing-lineage-001",
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
        sourceLineageId: "drawing-lineage-001",
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
        sourceLineageId: "drawing-lineage-001",
        sourceUnit: "m",
        snapTransform: "none",
        levelElevation: "0",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("previews a finalized DXF, saves a draft, then lets an admin approve it as canonical", async () => {
    const checksum = createHash("sha256").update(validDxf).digest("hex");
    mocks.getProjectAssetById.mockResolvedValue({
      id: 111,
      projectId: projects.orgA.id,
      assetType: "cad",
      filename: "rooms.dxf",
      mimeType: "application/dxf",
      storagePath: "rooms.dxf",
      checksum,
    });
    mocks.storageRead.mockResolvedValue({
      sizeBytes: validDxf.byteLength,
      buffer: validDxf,
      contentType: "application/dxf",
    });

    await expect(
      caller().previewDxfGeometry({
        projectId: projects.orgA.id,
        assetId: 111,
        sourceLineageId: "drawing-lineage-001",
        sourceUnit: "m",
        snapTransform: "none",
        levelElevation: "0",
      })
    ).resolves.toMatchObject({
      status: "ready",
      totalAreaSqm: "12",
      rooms: [{ status: "imported" }],
    });

    await expect(
      caller().saveGeometryDraft({
        projectId: projects.orgA.id,
        expectedCurrentVersionId: null,
        source: {
          kind: "dxf",
          assetId: 111,
          sourceLineageId: "drawing-lineage-001",
          sourceUnit: "m",
          snapTransform: "none",
          levelElevation: "0",
        },
      })
    ).resolves.toMatchObject({
      geometryVersionId: 71,
      lifecycleState: "draft",
    });
    expect(mocks.saveGeometryDraftForOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          assetId: 111,
          acquisitionMethod: "dxf",
        }),
      })
    );

    mocks.role = "admin";
    await expect(
      caller().reviewGeometryDraft({
        projectId: projects.orgA.id,
        geometryVersionId: 71,
        expectedCurrentVersionId: 71,
        decision: "approve_as_canonical",
      })
    ).resolves.toMatchObject({
      selectedGeometryVersionId: 71,
      decision: "approve_as_canonical",
    });
  });

  it("lets viewers read review state but exposes no write capability", async () => {
    mocks.role = "viewer";

    const result = await caller().getGeometryReviewState({
      projectId: projects.orgA.id,
    });

    expect(result).toMatchObject({
      authorityMode: "legacy",
      canWrite: false,
      canReview: false,
      reconciliation: { status: "not_checked" },
    });
  });

  it("keeps a rejected latest version separate from both draft and selected canonical geometry", async () => {
    const geometryDocument = {
      measurementBasis: "room_floor_polygon_area",
      rooms: [],
    };
    mocks.getGeometryReviewStateForOrg.mockResolvedValue({
      authority: {
        mode: "canonical",
        currentGraphVersionId: 72,
        selectedGeometryVersionId: 71,
      },
      latest: {
        id: 72,
        status: "rejected",
        canonicalGeometry: geometryDocument,
      },
      latestSource: undefined,
      latestReview: {
        reviewDecision: "rejected",
        resultState: "not_checked",
        note: "Boundary does not match the issued drawing.",
        createdAt: new Date("2026-07-19T00:00:00Z"),
      },
      canonical: {
        id: 71,
        status: "canonical",
        canonicalGeometry: geometryDocument,
      },
      canonicalSource: undefined,
      acceptedMeasurements: { status: "ready", measurements: [] },
      legacyRooms: [],
    });

    const result = await caller().getGeometryReviewState({
      projectId: projects.orgA.id,
    });

    expect(result.draft).toBeUndefined();
    expect(result.canonical).toMatchObject({
      geometryVersionId: 71,
      status: "canonical",
    });
    expect(result.latestReviewed).toMatchObject({
      geometryVersionId: 72,
      status: "rejected",
    });
    expect(result.latestReview).toMatchObject({
      decision: "rejected",
      resultState: "not_checked",
      note: "Boundary does not match the issued drawing.",
    });
  });

  it("saves an immutable draft without selecting canonical authority", async () => {
    const result = await caller().saveGeometryDraft({
      projectId: projects.orgA.id,
      expectedCurrentVersionId: null,
      source: { kind: "manual", ...manualInput },
    });

    expect(result).toMatchObject({
      geometryVersionId: 71,
      lifecycleState: "draft",
      replayed: false,
    });
    expect(mocks.saveGeometryDraftForOrg).toHaveBeenCalledOnce();
    expect(mocks.saveGeometryDraftForOrg.mock.calls[0][0]).toMatchObject({
      projectId: projects.orgA.id,
      expectedCurrentVersionId: null,
      source: { sourceType: "manual", acquisitionMethod: "manual_entry" },
    });
  });

  it("reserves review decisions for organization admins", async () => {
    await expect(
      caller().reviewGeometryDraft({
        projectId: projects.orgA.id,
        geometryVersionId: 71,
        expectedCurrentVersionId: 71,
        decision: "approve_as_canonical",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.reviewGeometryDraftForOrg).not.toHaveBeenCalled();

    mocks.role = "admin";
    await expect(
      caller().reviewGeometryDraft({
        projectId: projects.orgA.id,
        geometryVersionId: 71,
        expectedCurrentVersionId: 71,
        decision: "approve_as_canonical",
      })
    ).resolves.toMatchObject({ decision: "approve_as_canonical" });
  });
});
