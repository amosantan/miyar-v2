import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  getProjectGeometryAuthorityModeForOrg: vi.fn(),
  getSpaceProgramRooms: vi.fn(),
  getSpaceProgramRoomById: vi.fn(),
  updateSpaceProgramRoomForOrg: vi.fn(),
  getAmenitySubSpacesForRoom: vi.fn(),
  updateProjectWithLegacyGeometryAuthorityForOrg: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
  getProjectById: mocks.getProjectById,
  getProjectGeometryAuthorityModeForOrg:
    mocks.getProjectGeometryAuthorityModeForOrg,
  getSpaceProgramRooms: mocks.getSpaceProgramRooms,
  getSpaceProgramRoomById: mocks.getSpaceProgramRoomById,
  updateSpaceProgramRoomForOrg: mocks.updateSpaceProgramRoomForOrg,
  getAmenitySubSpacesForRoom: mocks.getAmenitySubSpacesForRoom,
  updateProjectWithLegacyGeometryAuthorityForOrg:
    mocks.updateProjectWithLegacyGeometryAuthorityForOrg,
}));

import { authorizationFixtures } from "../test-utils/authorization-fixtures";
import { spaceProgramRouter } from "./spaceProgram";

const { contexts, projects } = authorizationFixtures;

describe("DI-01 space-program compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationMemberships.mockResolvedValue([
      {
        id: 1,
        userId: contexts.orgA.user!.id,
        orgId: projects.orgA.orgId,
        role: "member",
        createdAt: new Date(),
      },
    ]);
    mocks.getProjectById.mockResolvedValue({
      ...projects.orgA,
      totalFitoutArea: "999.00",
    });
    mocks.getProjectGeometryAuthorityModeForOrg.mockResolvedValue("legacy");
    mocks.getSpaceProgramRoomById.mockResolvedValue({
      id: 1,
      projectId: projects.orgA.id,
      organizationId: projects.orgA.orgId,
      sqm: "12.00",
      isFitOut: true,
    });
    mocks.updateSpaceProgramRoomForOrg.mockResolvedValue(true);
    mocks.updateProjectWithLegacyGeometryAuthorityForOrg.mockResolvedValue(
      "updated"
    );
    mocks.getSpaceProgramRooms.mockResolvedValue([
      {
        id: 1,
        projectId: projects.orgA.id,
        organizationId: projects.orgA.orgId,
        roomCode: "LIV-01",
        roomName: "Living",
        category: "living",
        sqm: "12.00",
        isFitOut: true,
        blockName: "Main",
        blockTypology: "residential",
      },
      {
        id: 2,
        projectId: projects.orgA.id,
        organizationId: projects.orgA.orgId,
        roomCode: "PARK-01",
        roomName: "Parking",
        category: "parking",
        sqm: "20.00",
        isFitOut: false,
        blockName: "Main",
        blockTypology: "residential",
      },
    ]);
  });

  it("returns legacy programme values without rewriting a divergent stored fit-out area", async () => {
    const result = await spaceProgramRouter
      .createCaller(contexts.orgA)
      .getForProject({ projectId: projects.orgA.id });

    expect(result).toMatchObject({
      geometryAuthorityMode: "legacy",
      summary: {
        totalSqm: 32,
        fitOutSqm: 12,
        shellCoreSqm: 20,
      },
    });
    expect(
      mocks.updateProjectWithLegacyGeometryAuthorityForOrg
    ).not.toHaveBeenCalled();
  });

  it("refreshes the legacy fit-out aggregate explicitly when a room area changes", async () => {
    mocks.getSpaceProgramRooms.mockResolvedValue([
      {
        id: 1,
        projectId: projects.orgA.id,
        organizationId: projects.orgA.orgId,
        sqm: "15.00",
        isFitOut: true,
      },
      {
        id: 2,
        projectId: projects.orgA.id,
        organizationId: projects.orgA.orgId,
        sqm: "20.00",
        isFitOut: false,
      },
    ]);

    await expect(
      spaceProgramRouter.createCaller(contexts.orgA).updateRoom({
        roomId: 1,
        sqm: 15,
      })
    ).resolves.toEqual({ success: true });

    expect(
      mocks.updateProjectWithLegacyGeometryAuthorityForOrg
    ).toHaveBeenCalledWith(
      projects.orgA.id,
      projects.orgA.orgId,
      { totalFitoutArea: "15" }
    );
  });

  it("rejects legacy fit-out toggles before they can overwrite canonical-project inputs", async () => {
    mocks.getProjectGeometryAuthorityModeForOrg.mockResolvedValue("canonical");

    await expect(
      spaceProgramRouter.createCaller(contexts.orgA).toggleFitOut({
        roomId: 1,
        projectId: projects.orgA.id,
        isFitOut: false,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.updateSpaceProgramRoomForOrg).not.toHaveBeenCalled();
    expect(
      mocks.updateProjectWithLegacyGeometryAuthorityForOrg
    ).not.toHaveBeenCalled();
  });

  it("fails the final aggregate write if canonical review wins after the route guard", async () => {
    mocks.updateProjectWithLegacyGeometryAuthorityForOrg.mockResolvedValue(
      "canonical"
    );

    await expect(
      spaceProgramRouter.createCaller(contexts.orgA).updateRoom({
        roomId: 1,
        sqm: 15,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.updateSpaceProgramRoomForOrg).toHaveBeenCalled();
    expect(
      mocks.updateProjectWithLegacyGeometryAuthorityForOrg
    ).toHaveBeenCalled();
  });
});
