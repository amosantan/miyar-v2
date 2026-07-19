import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  getProjectGeometryAuthorityForOrg: vi.fn(),
  getAcceptedRoomFloorMeasurementsForOrg: vi.fn(),
  requireProjectForOrg: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
  getProjectGeometryAuthorityForOrg:
    mocks.getProjectGeometryAuthorityForOrg,
  getAcceptedRoomFloorMeasurementsForOrg:
    mocks.getAcceptedRoomFloorMeasurementsForOrg,
}));

vi.mock("../_core/project-access", () => ({
  requireProjectForOrg: mocks.requireProjectForOrg,
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
    mocks.requireProjectForOrg.mockResolvedValue(projects.orgA);
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
});
