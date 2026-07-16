import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { orgProcedure, router } from "./trpc";
import { requireProjectResourceForOrg } from "./resource-access";
import {
  AUTH_ORG_A,
  authorizationFixtures,
} from "../test-utils/authorization-fixtures";

const { contexts, projects, resources } = authorizationFixtures;

const lookupResource = vi.fn();
const lookupProject = vi.fn();
const downstream = vi.fn();

const authorizationContractRouter = router({
  readResource: orgProcedure
    .input(z.object({ resourceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const authorized = await requireProjectResourceForOrg(
        input.resourceId,
        ctx.orgId,
        {
          lookupResource,
          getProjectId: resource => resource.projectId,
          lookupProject,
        }
      );
      downstream(authorized);
      return authorized.resource;
    }),
});

describe("authorization router contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupResource.mockImplementation(async (id: number) => {
      if (id === resources.orgA.id) return resources.orgA;
      if (id === resources.orgB.id) return resources.orgB;
      return undefined;
    });
    lookupProject.mockImplementation(async (id: number) => {
      if (id === projects.orgA.id) return projects.orgA;
      if (id === projects.orgB.id) return projects.orgB;
      return undefined;
    });
  });

  it("rejects unauthenticated callers before resource lookup", async () => {
    const caller = authorizationContractRouter.createCaller(
      contexts.unauthenticated
    );

    await expect(
      caller.readResource({ resourceId: resources.orgA.id })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(lookupResource).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it("rejects users without an organization before resource lookup", async () => {
    const caller = authorizationContractRouter.createCaller(
      contexts.withoutOrganization
    );

    await expect(
      caller.readResource({ resourceId: resources.orgA.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(lookupResource).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it("returns a same-organization resource", async () => {
    const caller = authorizationContractRouter.createCaller(contexts.orgA);

    await expect(
      caller.readResource({ resourceId: resources.orgA.id })
    ).resolves.toBe(resources.orgA);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["cross-organization", resources.orgB.id],
    ["missing", 9999],
  ])(
    "uses the same NOT_FOUND contract for %s resources",
    async (_label, resourceId) => {
      const caller = authorizationContractRouter.createCaller(contexts.orgA);

      await expect(caller.readResource({ resourceId })).rejects.toEqual(
        expect.objectContaining({
          code: "NOT_FOUND",
          message: "Resource not found",
        })
      );
      expect(downstream).not.toHaveBeenCalled();
    }
  );

  it("does not expose resource identifiers through authorization errors", async () => {
    const caller = authorizationContractRouter.createCaller(contexts.orgA);

    try {
      await caller.readResource({ resourceId: resources.orgB.id });
      expect.fail("Expected authorization rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect(String((error as Error).message)).not.toContain(
        String(resources.orgB.id)
      );
      expect(String((error as Error).message)).not.toContain("org");
    }
  });
});
