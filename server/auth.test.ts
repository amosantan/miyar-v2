import { describe, expect, it, vi, beforeEach } from "vitest";
import { authRouter } from "./routers/auth";
import { TRPCError } from "@trpc/server";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { createHash } from "crypto";

let mockDbUsers: Record<string, any> = {};

vi.mock("./db", () => ({
    emailExists: vi.fn(async (email: string) => !!mockDbUsers[email]),
    getUserByEmail: vi.fn(async (email: string) => mockDbUsers[email] || null),
    upsertUser: vi.fn(async (user: any) => {
        mockDbUsers[user.email] = { ...user, id: Math.floor(Math.random() * 1000) };
    }),
}));

vi.mock("./_core/sdk", () => ({
    sdk: {
        createSessionToken: vi.fn().mockResolvedValue("test-session-token"),
    }
}));

describe("Authentication: bcrypt password flow", () => {
    const dummyCtx = {
        req: { headers: {} },
        res: { cookie: vi.fn() }
    } as any;

    beforeEach(() => {
        mockDbUsers = {};
        vi.clearAllMocks();
    });

    it("registers a user, logs in successfully, and blocks bad passwords", async () => {
        const caller = authRouter.createCaller(dummyCtx);
        const email = "test@miyar.test";
        const password = "SuperSecretPassword123!";

        // 1. Register
        const regResult = await caller.register({ email, password });
        expect(regResult.success).toBe(true);

        // Verify bcrypt hash is stored, not plaintext, not sha256 (sha256 is 64 hex chars)
        const storedUser = mockDbUsers[email];
        expect(storedUser).toBeDefined();
        expect(storedUser.password).toBeDefined();
        expect(storedUser.password).not.toBe(password);
        expect(storedUser.password.length).toBeGreaterThan(50); // bcrypt hash is 60 chars

        // 2. Login with correct password
        const loginResult = await caller.login({ email, password });
        expect(loginResult.success).toBe(true);

        // 3. Login with wrong password
        try {
            await caller.login({ email, password: "WrongPassword" });
            expect.fail("Should have thrown UNAUTHORIZED");
        } catch (err: any) {
            expect(err).toBeInstanceOf(TRPCError);
            expect(err.code).toBe("UNAUTHORIZED");
        }
    });

    it("auto-upgrades a legacy SHA256 password to bcrypt on successful login", async () => {
        const caller = authRouter.createCaller(dummyCtx);
        const email = "legacy@miyar.test";
        const password = "LegacyPassword123!";

        // Simulate legacy DB state
        const legacyHash = createHash("sha256").update(password).digest("hex");
        mockDbUsers[email] = {
            id: 999,
            email,
            password: legacyHash
        };

        // Login with correct password
        const loginResult = await caller.login({ email, password });
        expect(loginResult.success).toBe(true);

        // Verify DB was updated to bcrypt
        const upgradedUser = mockDbUsers[email];
        expect(upgradedUser.password).not.toBe(legacyHash);
        expect(upgradedUser.password.length).toBeGreaterThan(50);
    });
});
