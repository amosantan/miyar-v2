import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InsertUser, User } from "../drizzle/schema";
import { auditLog } from "./_core/audit";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { authRouter } from "./routers/auth";

type AuthDbContract = Pick<
  typeof import("./db"),
  "getDb" | "emailExists" | "getUserByEmail" | "upsertUser"
>;

const FIXED_USER_TIME = new Date("2026-07-17T00:00:00.000Z");

let mockDbUsers: Record<string, User> = {};
let nextMockUserId = 1;

function makeMockUser(
  overrides: Pick<User, "id" | "openId" | "email"> & Partial<User>
): User {
  return {
    password: null,
    name: null,
    loginMethod: "local",
    role: "user",
    createdAt: FIXED_USER_TIME,
    updatedAt: FIXED_USER_TIME,
    lastSignedIn: FIXED_USER_TIME,
    orgId: null,
    ...overrides,
  };
}

vi.mock(
  "./db",
  () =>
    ({
      getDb: vi.fn(async () => null),
      emailExists: vi.fn(async (email: string) => Boolean(mockDbUsers[email])),
      getUserByEmail: vi.fn(async (email: string) => mockDbUsers[email]),
      upsertUser: vi.fn(async (user: InsertUser & { password?: string }) => {
        if (!user.email) throw new Error("Auth test users require an email");

        const existing = mockDbUsers[user.email];
        mockDbUsers[user.email] = makeMockUser({
          ...existing,
          id: existing?.id ?? nextMockUserId++,
          openId: user.openId,
          email: user.email,
          password: user.password ?? existing?.password ?? null,
          name: user.name ?? existing?.name ?? null,
          loginMethod: user.loginMethod ?? existing?.loginMethod ?? "local",
          role: user.role ?? existing?.role ?? "user",
          lastSignedIn:
            user.lastSignedIn ?? existing?.lastSignedIn ?? FIXED_USER_TIME,
          orgId: user.orgId ?? existing?.orgId ?? null,
        });
      }),
    }) satisfies AuthDbContract
);

vi.mock("./_core/audit", () => ({
  auditLog: vi.fn(async () => undefined),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("test-session-token"),
  },
}));

describe("Authentication: bcrypt password flow", () => {
  const dummyCtx = {
    req: { headers: {} },
    res: { cookie: vi.fn() },
  } as const;

  const auditLogMock = vi.mocked(auditLog);
  const getDbMock = vi.mocked(db.getDb);

  beforeEach(() => {
    mockDbUsers = {};
    nextMockUserId = 1;
    vi.clearAllMocks();
  });

  it("registers a user and logs in successfully", async () => {
    const caller = authRouter.createCaller(dummyCtx);
    const email = "test@miyar.test";
    const password = "SuperSecretPassword123!";

    const regResult = await caller.register({ email, password });
    expect(regResult.success).toBe(true);

    const storedUser = mockDbUsers[email];
    expect(storedUser).toBeDefined();
    expect(storedUser?.id).toBe(1);
    expect(storedUser?.password).toBeDefined();
    expect(storedUser?.password).not.toBe(password);
    expect(storedUser?.password?.length).toBeGreaterThan(50);
    expect(auditLogMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 1,
        action: "auth.register",
        entityType: "user",
        entityId: 1,
      })
    );

    const loginResult = await caller.login({ email, password });
    expect(loginResult.success).toBe(true);
    expect(auditLogMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 1,
        action: "auth.login",
        entityType: "user",
        entityId: 1,
      })
    );

    expect(auditLogMock).toHaveBeenCalledTimes(2);
    expect(getDbMock).toHaveBeenCalledTimes(2);
    expect(sdk.createSessionToken).toHaveBeenCalledTimes(2);
  });

  it("blocks a bad password without auditing or creating a session", async () => {
    const caller = authRouter.createCaller(dummyCtx);
    const email = "test@miyar.test";
    mockDbUsers[email] = makeMockUser({
      id: 2,
      openId: "password-test-open-id",
      email,
      password: "$2b$12$fQ1ECqwxY3SVR6QUZN5eH.RFVmbQ4lRO8oL9rf5VqYSoJ9qPy127m",
      orgId: 1,
    });

    try {
      await caller.login({ email, password: "WrongPassword" });
      expect.fail("Should have thrown UNAUTHORIZED");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(TRPCError);
      if (error instanceof TRPCError) expect(error.code).toBe("UNAUTHORIZED");
    }

    expect(auditLogMock).not.toHaveBeenCalled();
    expect(getDbMock).not.toHaveBeenCalled();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it("auto-upgrades a legacy SHA256 password to bcrypt on successful login", async () => {
    const caller = authRouter.createCaller(dummyCtx);
    const email = "legacy@miyar.test";
    const password = "LegacyPassword123!";

    const legacyHash = createHash("sha256").update(password).digest("hex");
    mockDbUsers[email] = makeMockUser({
      id: 999,
      openId: "legacy-open-id",
      email,
      password: legacyHash,
      orgId: 1,
    });

    const loginResult = await caller.login({ email, password });
    expect(loginResult.success).toBe(true);

    const upgradedUser = mockDbUsers[email];
    expect(upgradedUser?.password).not.toBe(legacyHash);
    expect(upgradedUser?.password?.length).toBeGreaterThan(50);
    expect(auditLogMock).toHaveBeenCalledOnce();
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 999,
        action: "auth.login",
        entityType: "user",
        entityId: 999,
      })
    );
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
