import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { auditLog } from "./_core/audit";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

vi.mock("./_core/audit", () => ({
  auditLog: vi.fn(async () => undefined),
}));

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const authenticatedUser: AuthenticatedUser = {
  id: 1,
  openId: "sample-user",
  email: "sample@example.com",
  name: "Sample User",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date("2026-07-17T00:00:00.000Z"),
  updatedAt: new Date("2026-07-17T00:00:00.000Z"),
  lastSignedIn: new Date("2026-07-17T00:00:00.000Z"),
  orgId: 1,
};

function createAuthContext(user: TrpcContext["user"]): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function expectSessionCookieCleared(clearedCookies: CookieCall[]) {
  expect(clearedCookies).toHaveLength(1);
  expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  expect(clearedCookies[0]?.options).toMatchObject({
    maxAge: -1,
    secure: true,
    sameSite: "none",
    httpOnly: true,
    path: "/",
  });
}

describe("auth.logout", () => {
  const auditLogMock = vi.mocked(auditLog);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("audits an authenticated logout and clears the session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext(authenticatedUser);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(auditLogMock).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith({
      userId: authenticatedUser.id,
      action: "auth.logout",
      entityType: "user",
      entityId: authenticatedUser.id,
      ipAddress: "127.0.0.1",
    });
    expectSessionCookieCleared(clearedCookies);
  });

  it("does not audit an unauthenticated logout and still clears the session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(auditLogMock).not.toHaveBeenCalled();
    expectSessionCookieCleared(clearedCookies);
  });
});
