import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { TrpcContext } from "./context";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  downstream: vi.fn(),
}));

vi.mock("../db", () => ({
  getOrganizationMemberships: mocks.getOrganizationMemberships,
}));

import {
  designOrgAdminProcedure,
  designOrgMutationProcedure,
  orgProcedure,
  router,
} from "./trpc";

const testRouter = router({
  read: orgProcedure.query(({ ctx }) => {
    mocks.downstream();
    return { orgId: ctx.orgId, role: ctx.orgRole };
  }),
  mutate: designOrgMutationProcedure
    .input(z.object({ value: z.string() }))
    .mutation(({ ctx, input }) => {
      mocks.downstream();
      return { role: ctx.orgRole, value: input.value };
    }),
  administer: designOrgAdminProcedure.mutation(({ ctx }) => {
    mocks.downstream();
    return { role: ctx.orgRole };
  }),
});

function context(options: {
  userId?: number;
  orgId?: number | null;
  globalRole?: "user" | "admin";
} = {}): TrpcContext {
  const userId = options.userId ?? 7;
  const orgId = options.orgId === undefined ? 11 : options.orgId;
  return {
    user: {
      id: userId,
      openId: `membership-${userId}`,
      password: null,
      name: "Membership Test",
      email: "membership@example.invalid",
      loginMethod: "test",
      role: options.globalRole ?? "user",
      orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function membership(role: "admin" | "member" | "viewer") {
  return {
    id: 1,
    userId: 7,
    orgId: 11,
    role,
    createdAt: new Date(),
  };
}

describe("organization membership middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated and organization-less callers before lookup", async () => {
    await expect(
      testRouter.createCaller({ ...context(), user: null }).read()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      testRouter.createCaller(context({ orgId: null })).read()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getOrganizationMemberships).not.toHaveBeenCalled();
  });

  it.each([
    [[]],
    [[membership("member"), membership("viewer")]],
  ])(
    "fails closed unless exactly one membership exists",
    async memberships => {
      mocks.getOrganizationMemberships.mockResolvedValue(memberships);
      await expect(
        testRouter.createCaller(context()).read()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.downstream).not.toHaveBeenCalled();
    }
  );

  it("preserves lookup failures as operational errors", async () => {
    mocks.getOrganizationMemberships.mockRejectedValue(
      new Error("membership lookup unavailable")
    );
    await expect(testRouter.createCaller(context()).read()).rejects.toThrow(
      "membership lookup unavailable"
    );
    expect(mocks.downstream).not.toHaveBeenCalled();
  });

  it.each(["admin", "member", "viewer"] as const)(
    "allows an active %s membership to read",
    async role => {
      mocks.getOrganizationMemberships.mockResolvedValue([membership(role)]);
      await expect(testRouter.createCaller(context()).read()).resolves.toEqual({
        orgId: 11,
        role,
      });
    }
  );

  it("keeps viewers read-only while members and admins may mutate", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([membership("viewer")]);
    await expect(
      testRouter.createCaller(context()).mutate({ value: "blocked" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    for (const role of ["member", "admin"] as const) {
      mocks.getOrganizationMemberships.mockResolvedValue([membership(role)]);
      await expect(
        testRouter.createCaller(context()).mutate({ value: role })
      ).resolves.toEqual({ role, value: role });
    }
  });

  it("requires organization admin even for a global administrator", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([membership("member")]);
    await expect(
      testRouter.createCaller(context({ globalRole: "admin" })).administer()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    mocks.getOrganizationMemberships.mockResolvedValue([membership("admin")]);
    await expect(
      testRouter.createCaller(context()).administer()
    ).resolves.toEqual({ role: "admin" });
  });
});
