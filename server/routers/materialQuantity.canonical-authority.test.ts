import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  getProjectGeometryAuthorityForOrg: vi.fn(),
  getAcceptedRoomFloorMeasurementsForOrg: vi.fn(),
  getSpaceProgramRooms: vi.fn(),
  getMaterialAllocations: vi.fn(),
  getMaterialLibrary: vi.fn(),
  replaceMaterialAllocationsForOrg: vi.fn(),
  createExplicitMaterialAllocationForOrg: vi.fn(),
  requireProjectForOrg: vi.fn(),
  resolveMaterialPriceSnapshots: vi.fn(),
  generateMaterialAllocations: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
  getProjectGeometryAuthorityForOrg:
    mocks.getProjectGeometryAuthorityForOrg,
  getAcceptedRoomFloorMeasurementsForOrg:
    mocks.getAcceptedRoomFloorMeasurementsForOrg,
  getSpaceProgramRooms: mocks.getSpaceProgramRooms,
  getMaterialAllocations: mocks.getMaterialAllocations,
  getMaterialLibrary: mocks.getMaterialLibrary,
  replaceMaterialAllocationsForOrg:
    mocks.replaceMaterialAllocationsForOrg,
  createExplicitMaterialAllocationForOrg:
    mocks.createExplicitMaterialAllocationForOrg,
}));

vi.mock(
  "../engines/design/material-quantity-engine",
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import("../engines/design/material-quantity-engine")
      >();
    return {
      ...actual,
      generateMaterialAllocations: mocks.generateMaterialAllocations,
    };
  }
);

vi.mock("../_core/project-access", () => ({
  requireProjectForOrg: mocks.requireProjectForOrg,
}));

vi.mock("../engines/material-pricing/material-resolution", () => ({
  resolveMaterialPriceSnapshots: mocks.resolveMaterialPriceSnapshots,
  resolveProjectMaterialPriceGeography: () => "uae",
}));

import { authorizationFixtures } from "../test-utils/authorization-fixtures";
import { materialQuantityRouter } from "./materialQuantity";

const { contexts, projects } = authorizationFixtures;

describe("MQI canonical measurement-basis gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationMemberships.mockResolvedValue([
      {
        id: 1,
        orgId: contexts.orgA.orgId,
        userId: contexts.orgA.user.id,
        role: "admin",
        createdAt: new Date(),
      },
    ]);
    mocks.requireProjectForOrg.mockResolvedValue({
      ...projects.orgA,
      materialPricingRevision: 1,
      materialPriceGeography: null,
    });
    mocks.getProjectGeometryAuthorityForOrg.mockResolvedValue({
      mode: "canonical",
      selectedGeometryVersionId: 71,
    });
  });

  it("fails closed even when reviewed polygon floor area is ready", async () => {
    mocks.getAcceptedRoomFloorMeasurementsForOrg.mockResolvedValue({
      status: "ready",
      measurements: [{ spaceId: "stable-room-001", areaSquareMetres: "12" }],
    });

    await expect(
      materialQuantityRouter.createCaller(contexts.orgA).generate({
        projectId: projects.orgA.id,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("reviewed finish-scope mapping"),
    });
  });

  it("returns the canonical resolver insufficiency without legacy fallback", async () => {
    mocks.getAcceptedRoomFloorMeasurementsForOrg.mockResolvedValue({
      status: "insufficient",
      reason: "Every canonical room requires one exact accepted measurement.",
      measurements: [],
    });

    await expect(
      materialQuantityRouter.createCaller(contexts.orgA).generate({
        projectId: projects.orgA.id,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Every canonical room requires one exact accepted measurement.",
    });
  });

  it("clears both price and quantity provenance when a quantity changes", () => {
    const source = readFileSync(
      new URL("./materialQuantity.ts", import.meta.url),
      "utf8"
    );
    const start = source.indexOf("updateAllocation: orgMutationProcedure");
    const end = source.indexOf("lockAllocations:", start);
    const updateBlock = source.slice(start, end);

    expect(updateBlock).toContain("requestedGeography: null");
    expect(updateBlock).toContain("quantityPolicyVersion: null");
    expect(updateBlock).toContain("quantityConversionInputs: null");
  });

  it("rejects a bulk replacement when pricing inputs changed after resolution", async () => {
    mocks.getProjectGeometryAuthorityForOrg.mockResolvedValue(null);
    mocks.getSpaceProgramRooms.mockResolvedValue([
      {
        roomCode: "LVG",
        roomName: "Living",
        sqm: "10",
        budgetPct: "100",
        priority: "high",
        finishGrade: "A",
        isFitOut: true,
      },
    ]);
    mocks.getMaterialAllocations.mockResolvedValue([]);
    mocks.getMaterialLibrary.mockResolvedValue([
      {
        id: 77,
        productId: 770,
        productName: "Approved floor",
        category: "flooring",
        tier: "premium",
        style: "all",
        unitLabel: "sqm",
        isActive: true,
      },
    ]);
    mocks.generateMaterialAllocations.mockResolvedValue({
      rooms: [
        {
          roomId: "LVG",
          floor: [
            {
              materialLibraryId: 77,
              materialName: "Approved floor",
              percentage: 100,
              reasoning: "Reviewed allocation",
            },
          ],
          walls: [],
          ceiling: [],
          joinery: [],
        },
      ],
      designRationale: "Reviewed",
      estimatedQualityLabel: "Governed",
    });
    mocks.resolveMaterialPriceSnapshots.mockResolvedValue([
      {
        state: "resolved",
        policyVersion: "ev03-material-resolution-v1",
        reference: { source: "material_library", legacyId: 77 },
        productId: 770,
        specificationId: 771,
        benchmarkProposalId: 772,
        benchmarkVersionId: null,
        resolverAsOf: "2026-07-29T12:00:00.000Z",
        requestedGeography: "uae",
        resolvedGeography: "uae",
        usedUaeFallback: false,
        requestedPriceScope: "supply_only",
        resolvedPriceScope: "supply_only",
        currency: "AED",
        unitBasis: "per_sqm",
        priceMin: "100.00",
        priceMid: "120.00",
        priceMax: "140.00",
        weightedMean: "120.00",
        provenance: {
          sourceLadderRung: "assumption",
          sourceLabel: "MIYAR assumption",
          provenancePolicyVersion: "test-v1",
          benchmarkVersion: "test-v1",
          compatibilityFallback: false,
        },
      },
    ]);
    mocks.replaceMaterialAllocationsForOrg.mockResolvedValue(false);

    await expect(
      materialQuantityRouter.createCaller(contexts.orgA).generate({
        projectId: projects.orgA.id,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("pricing inputs changed"),
    });
    expect(mocks.replaceMaterialAllocationsForOrg).toHaveBeenCalledWith(
      projects.orgA.id,
      projects.orgA.orgId,
      expect.any(Array),
      {
        materialPricingRevision: 1,
        materialPriceGeography: null,
      }
    );
  });
});

describe("explicit non-surface material allocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationMemberships.mockResolvedValue([
      {
        id: 1,
        orgId: contexts.orgA.orgId,
        userId: contexts.orgA.user.id,
        role: "admin",
        createdAt: new Date(),
      },
    ]);
    mocks.requireProjectForOrg.mockResolvedValue({
      ...projects.orgA,
      materialPricingRevision: 1,
      materialPriceGeography: null,
    });
    mocks.getSpaceProgramRooms.mockResolvedValue([
      {
        roomCode: "BTH",
        roomName: "Bathroom",
        isFitOut: true,
      },
    ]);
    mocks.getMaterialLibrary.mockResolvedValue([
      {
        id: 77,
        productId: 770,
        productName: "Approved sanitary suite",
        category: "sanitaryware",
      },
    ]);
    mocks.resolveMaterialPriceSnapshots.mockResolvedValue([
      {
        state: "resolved",
        policyVersion: "ev03-material-resolution-v1",
        reference: { source: "material_library", legacyId: 77 },
        productId: 770,
        specificationId: 771,
        benchmarkProposalId: 772,
        benchmarkVersionId: null,
        resolverAsOf: "2026-07-29T12:00:00.000Z",
        requestedGeography: "uae",
        resolvedGeography: "uae",
        usedUaeFallback: false,
        requestedPriceScope: "supply_only",
        resolvedPriceScope: "supply_only",
        currency: "AED",
        unitBasis: "per_piece",
        priceMin: "100.00",
        priceMid: "120.00",
        priceMax: "140.00",
        weightedMean: "120.00",
        provenance: {
          sourceLadderRung: "market_observation",
          sourceLabel: "Governed benchmark",
          provenancePolicyVersion: "test-v1",
          benchmarkVersion: "test-v1",
          compatibilityFallback: false,
        },
      },
    ]);
    mocks.createExplicitMaterialAllocationForOrg.mockResolvedValue({ id: 91 });
  });

  it("persists a reviewed sanitaryware piece quantity through the governed resolver", async () => {
    await expect(
      materialQuantityRouter.createCaller(contexts.orgA).addExplicitAllocation({
        projectId: projects.orgA.id,
        roomId: "BTH",
        element: "sanitaryware",
        materialLibraryId: 77,
        explicitQuantity: 2,
        explicitQuantityUnit: "piece",
      })
    ).resolves.toEqual({ id: 91 });
    expect(mocks.createExplicitMaterialAllocationForOrg).toHaveBeenCalledWith(
      projects.orgA.id,
      projects.orgA.orgId,
      expect.objectContaining({
        roomId: "BTH",
        element: "sanitaryware",
        explicitQuantity: "2",
        explicitQuantityUnit: "piece",
        productId: 770,
        specId: 771,
        totalCostMin: "200",
        totalCostMax: "280",
      }),
      {
        materialPricingRevision: 1,
        materialPriceGeography: null,
      }
    );
  });

  it("rejects canonical category mismatches before persistence", async () => {
    mocks.getMaterialLibrary.mockResolvedValue([
      {
        id: 77,
        productId: 770,
        productName: "Lighting fitting",
        category: "lighting",
      },
    ]);
    await expect(
      materialQuantityRouter.createCaller(contexts.orgA).addExplicitAllocation({
        projectId: projects.orgA.id,
        roomId: "BTH",
        element: "sanitaryware",
        materialLibraryId: 77,
        explicitQuantity: 2,
        explicitQuantityUnit: "piece",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "MATERIAL_CATEGORY_INCOMPATIBLE",
    });
    expect(mocks.createExplicitMaterialAllocationForOrg).not.toHaveBeenCalled();
  });

  it("rejects linear-metre quantities beyond durable three-decimal precision", async () => {
    mocks.getMaterialLibrary.mockResolvedValue([
      {
        id: 78,
        productId: 780,
        productName: "Approved joinery",
        category: "joinery",
      },
    ]);
    await expect(
      materialQuantityRouter.createCaller(contexts.orgA).addExplicitAllocation({
        projectId: projects.orgA.id,
        roomId: "BTH",
        element: "joinery",
        materialLibraryId: 78,
        explicitQuantity: 2.1234,
        explicitQuantityUnit: "lm",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.resolveMaterialPriceSnapshots).not.toHaveBeenCalled();
  });

  it("conceals a foreign-private linked identity exactly like a nonexistent material", async () => {
    mocks.resolveMaterialPriceSnapshots.mockResolvedValueOnce([
      {
        state: "insufficient",
        policyVersion: "ev03-material-resolution-v1",
        reference: { source: "material_library", legacyId: 77 },
        resolverAsOf: "2026-07-29T12:00:00.000Z",
        requestedGeography: "uae",
        requestedPriceScope: "supply_only",
        reason: "identity_not_found",
      },
    ]);
    const caller = materialQuantityRouter.createCaller(contexts.orgA);
    const request = {
      projectId: projects.orgA.id,
      roomId: "BTH",
      element: "sanitaryware" as const,
      materialLibraryId: 77,
      explicitQuantity: 2,
      explicitQuantityUnit: "piece" as const,
    };
    await expect(caller.addExplicitAllocation(request)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
    mocks.getMaterialLibrary.mockResolvedValue([]);
    await expect(caller.addExplicitAllocation(request)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  });
});
