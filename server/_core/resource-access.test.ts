import { describe, expect, it, vi } from "vitest";
import {
  createPolymorphicResourceAuthorizer,
  requireNestedProjectResourceForOrg,
  requireOrgResourceForOrg,
  requireProjectOrgResourceForOrg,
  requireProjectResourceBatchForOrg,
  requireProjectResourceForOrg,
} from "./resource-access";
import {
  AUTH_ORG_A,
  AUTH_ORG_B,
  authorizationFixtures,
} from "../test-utils/authorization-fixtures";

const { projects, resources } = authorizationFixtures;

function projectLookup(
  projectsById = new Map([
    [projects.orgA.id, projects.orgA],
    [projects.orgB.id, projects.orgB],
    [projects.thirdParty.id, projects.thirdParty],
    [projects.legacyNull.id, projects.legacyNull],
  ])
) {
  return vi.fn(async (id: number) => projectsById.get(id));
}

function expectNotFound(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    code: "NOT_FOUND",
    message: "Resource not found",
  });
}

describe("organization resource authorization", () => {
  it("returns a direct project child with its authorized project", async () => {
    const lookupResource = vi.fn(async () => resources.orgA);
    const lookupProject = projectLookup();

    await expect(
      requireProjectResourceForOrg(resources.orgA.id, AUTH_ORG_A, {
        lookupResource,
        getProjectId: resource => resource.projectId,
        lookupProject,
      })
    ).resolves.toEqual({
      resource: resources.orgA,
      project: projects.orgA,
    });
  });

  it.each([
    ["missing resource", undefined],
    ["cross-organization resource", resources.orgB],
    ["third-party resource", resources.thirdParty],
    ["orphaned resource", resources.orphan],
    ["legacy-null project", resources.legacyNull],
  ])("conceals a %s", async (_label, resource) => {
    await expectNotFound(
      requireProjectResourceForOrg(1, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => resource),
        getProjectId: value => value.projectId,
        lookupProject: projectLookup(),
      })
    );
  });

  it("resolves a nested child through its parent and project", async () => {
    const child = { id: 7, boardId: 8 };
    const parent = { id: 8, projectId: projects.orgA.id };

    await expect(
      requireNestedProjectResourceForOrg(child.id, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => child),
        getParentId: value => value.boardId,
        lookupParent: vi.fn(async () => parent),
        getProjectId: value => value.projectId,
        lookupProject: projectLookup(),
      })
    ).resolves.toEqual({ resource: child, parent, project: projects.orgA });
  });

  it("conceals a missing nested parent", async () => {
    const child = { id: 7, boardId: 999 };

    await expectNotFound(
      requireNestedProjectResourceForOrg(child.id, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => child),
        getParentId: value => value.boardId,
        lookupParent: vi.fn(async () => undefined),
        getProjectId: (value: { projectId: number }) => value.projectId,
        lookupProject: projectLookup(),
      })
    );
  });

  it.each([
    ["cross-organization project", projects.orgB.id],
    ["legacy-null project", projects.legacyNull.id],
    ["missing project", 999],
  ])("conceals a nested resource with a %s", async (_label, projectId) => {
    const child = { id: 7, boardId: 8 };
    const parent = { id: 8, projectId };

    await expectNotFound(
      requireNestedProjectResourceForOrg(child.id, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => child),
        getParentId: value => value.boardId,
        lookupParent: vi.fn(async () => parent),
        getProjectId: value => value.projectId,
        lookupProject: projectLookup(),
      })
    );
  });

  it("authorizes a directly organization-owned resource", async () => {
    await expect(
      requireOrgResourceForOrg(resources.orgA.id, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => resources.orgA),
        getOrgId: resource => resource.organizationId,
      })
    ).resolves.toBe(resources.orgA);
  });

  it.each([
    ["missing", undefined],
    ["cross-organization", resources.orgB],
    ["legacy-null", resources.legacyNull],
  ])("conceals a %s direct organization resource", async (_label, resource) => {
    await expectNotFound(
      requireOrgResourceForOrg(1, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => resource),
        getOrgId: value => value.organizationId,
      })
    );
  });

  it("requires a record's organization and project ownership to agree", async () => {
    await expect(
      requireProjectOrgResourceForOrg(resources.orgA.id, AUTH_ORG_A, {
        lookupResource: vi.fn(async () => resources.orgA),
        getProjectId: resource => resource.projectId,
        getOrgId: resource => resource.organizationId,
        lookupProject: projectLookup(),
      })
    ).resolves.toEqual({
      resource: resources.orgA,
      project: projects.orgA,
    });
  });

  it.each([
    ["cross-organization", resources.orgB],
    ["legacy-null", resources.legacyNull],
    ["inconsistent", resources.inconsistent],
    ["orphaned", resources.orphan],
  ])(
    "conceals a %s project-and-organization record",
    async (_label, resource) => {
      await expectNotFound(
        requireProjectOrgResourceForOrg(resource.id, AUTH_ORG_A, {
          lookupResource: vi.fn(async () => resource),
          getProjectId: value => value.projectId,
          getOrgId: value => value.organizationId,
          lookupProject: projectLookup(),
        })
      );
    }
  );
});

describe("batch authorization", () => {
  it("preserves order and duplicate IDs", async () => {
    const authorize = vi.fn(async (id: number) => ({ id }));

    await expect(
      requireProjectResourceBatchForOrg([3, 1, 3], AUTH_ORG_A, authorize)
    ).resolves.toEqual([{ id: 3 }, { id: 1 }, { id: 3 }]);
    expect(authorize.mock.calls.map(call => call[0])).toEqual([3, 1, 3]);
  });

  it("supports an empty batch", async () => {
    const authorize = vi.fn();
    await expect(
      requireProjectResourceBatchForOrg([], AUTH_ORG_A, authorize)
    ).resolves.toEqual([]);
    expect(authorize).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", 404],
    ["cross-organization", resources.orgB.id],
  ])(
    "returns no partial batch when one resource is %s",
    async (_label, deniedId) => {
      const downstream = vi.fn();
      const authorize = vi.fn(async (id: number) => {
        if (id === deniedId) {
          throw Object.assign(new Error("Resource not found"), {
            code: "NOT_FOUND",
          });
        }
        return { id };
      });

      await expect(
        requireProjectResourceBatchForOrg(
          [resources.orgA.id, deniedId],
          AUTH_ORG_A,
          authorize
        ).then(result => downstream(result))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(downstream).not.toHaveBeenCalled();
    }
  );
});

describe("polymorphic authorization", () => {
  it("returns a discriminated result for registered resource types", async () => {
    const authorize = createPolymorphicResourceAuthorizer({
      asset: async (id: number, orgId: number) => ({
        id,
        orgId,
        kind: "asset" as const,
      }),
      board: async (id: number, orgId: number) => ({
        id,
        orgId,
        kind: "board" as const,
      }),
    });

    await expect(authorize("asset", 5, AUTH_ORG_A)).resolves.toEqual({
      type: "asset",
      value: { id: 5, orgId: AUTH_ORG_A, kind: "asset" },
    });
  });

  it("fails closed for unsupported resource types", async () => {
    const authorize = createPolymorphicResourceAuthorizer({
      asset: async (id: number) => ({ id }),
    });

    await expectNotFound(authorize("report", 5, AUTH_ORG_A));
  });

  it("does not observe registry expansion after construction", async () => {
    const registry: Record<
      string,
      (id: number, orgId: number) => Promise<unknown>
    > = {
      asset: async id => ({ id }),
    };
    const authorize = createPolymorphicResourceAuthorizer(registry);
    registry.board = async id => ({ id });

    await expectNotFound(authorize("board", 5, AUTH_ORG_B));
  });

  it("preserves non-authorization resolver failures", async () => {
    const authorize = createPolymorphicResourceAuthorizer({
      asset: async () => {
        throw new Error("Lookup unavailable");
      },
    });

    await expect(authorize("asset", 5, AUTH_ORG_A)).rejects.toThrow(
      "Lookup unavailable"
    );
  });
});
