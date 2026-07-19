import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "member" as "admin" | "member" | "viewer",
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  getProjectAssets: vi.fn(),
  createProjectAssetForOrg: vi.fn(),
  createAuditLog: vi.fn(),
  storageCreatePresignedPut: vi.fn(),
  storageRead: vi.fn(),
  storageDelete: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
  getProjectById: mocks.getProjectById,
  getProjectAssets: mocks.getProjectAssets,
  createProjectAssetForOrg: mocks.createProjectAssetForOrg,
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("../storage", () => ({
  storageCreatePresignedPut: mocks.storageCreatePresignedPut,
  storageRead: mocks.storageRead,
  storageDelete: mocks.storageDelete,
}));

import { authorizationFixtures } from "../test-utils/authorization-fixtures";
import { designGeometryAssetsRouter } from "./design-geometry-assets";

const { contexts, projects } = authorizationFixtures;
const key = `projects/${projects.orgA.orgId}/${projects.orgA.id}/geometry-uploads/source.dxf`;
const validDxf = Buffer.from(
  "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n" +
    "0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n5\nA1\n8\nRooms\n90\n4\n70\n1\n" +
    "10\n0\n20\n0\n10\n4\n20\n0\n10\n4\n20\n3\n10\n0\n20\n3\n" +
    "0\nENDSEC\n0\nEOF\n",
  "ascii"
);

function caller() {
  return designGeometryAssetsRouter.createCaller(contexts.orgA);
}

describe("DI-01 finalized CAD asset boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = "member";
    mocks.getOrganizationMemberships.mockImplementation(
      async (userId: number, orgId: number) => [
        { id: userId, userId, orgId, role: mocks.role, createdAt: new Date() },
      ]
    );
    mocks.getProjectById.mockImplementation(async (id: number) =>
      id === projects.orgA.id ? projects.orgA : id === projects.orgB.id ? projects.orgB : undefined
    );
    mocks.getProjectAssets.mockResolvedValue([]);
    mocks.createProjectAssetForOrg.mockResolvedValue({ id: 501 });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.storageCreatePresignedPut.mockResolvedValue({
      key,
      uploadUrl: "https://upload.example.invalid/geometry",
    });
    mocks.storageRead.mockResolvedValue({
      key,
      contentType: "application/dxf",
      sizeBytes: validDxf.byteLength,
      buffer: validDxf,
    });
    mocks.storageDelete.mockResolvedValue(undefined);
  });

  it("creates a short-lived project-owned DXF upload target", async () => {
    await expect(
      caller().createGeometrySourceUpload({
        projectId: projects.orgA.id,
        filename: "rooms.dxf",
        mimeType: "application/dxf",
        sizeBytes: validDxf.byteLength,
      })
    ).resolves.toEqual({
      storageKey: key,
      uploadUrl: "https://upload.example.invalid/geometry",
      expiresInSeconds: 900,
    });
  });

  it("blocks viewers and cross-organization projects before creating storage state", async () => {
    mocks.role = "viewer";
    await expect(
      caller().createGeometrySourceUpload({
        projectId: projects.orgA.id,
        filename: "rooms.dxf",
        mimeType: "application/dxf",
        sizeBytes: 100,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.role = "member";
    await expect(
      caller().createGeometrySourceUpload({
        projectId: projects.orgB.id,
        filename: "rooms.dxf",
        mimeType: "application/dxf",
        sizeBytes: 100,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storageCreatePresignedPut).not.toHaveBeenCalled();
  });

  it("finalizes validated bytes as a hidden CAD asset and returns only its assetId", async () => {
    const result = await caller().finalizeGeometrySourceUpload({
      projectId: projects.orgA.id,
      storageKey: key,
      filename: "rooms.dxf",
      mimeType: "application/dxf",
    });

    expect(result).toEqual({ assetId: 501 });
    expect(mocks.createProjectAssetForOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: projects.orgA.id,
        assetType: "cad",
        category: "floor_plan",
        isClientVisible: false,
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      projects.orgA.orgId
    );
  });

  it("deletes spoofed uploads and never creates a finalized asset", async () => {
    const spoofed = Buffer.from("not a dxf", "ascii");
    mocks.storageRead.mockResolvedValue({
      key,
      contentType: "application/dxf",
      sizeBytes: spoofed.byteLength,
      buffer: spoofed,
    });

    await expect(
      caller().finalizeGeometrySourceUpload({
        projectId: projects.orgA.id,
        storageKey: key,
        filename: "rooms.dxf",
        mimeType: "application/dxf",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storageDelete).toHaveBeenCalledWith(key);
    expect(mocks.createProjectAssetForOrg).not.toHaveBeenCalled();
  });
});
