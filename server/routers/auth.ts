import { z } from "zod";
import * as db from "../db";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../_core/audit";
import { organizations, organizationMembers, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const authRouter = router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
        if (ctx.user) {
            await auditLog({
                userId: ctx.user.id,
                action: "auth.logout",
                entityType: "user",
                entityId: ctx.user.id,
                ipAddress: ((ctx.req as any)?.headers?.["x-forwarded-for"] as string) || (ctx.req as any)?.socket?.remoteAddress || "127.0.0.1",
            });
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true } as const;
    }),
    login: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input, ctx }) => {
            console.log("[Auth] Login attempt for:", input.email);
            const user = await db.getUserByEmail(input.email);
            console.log("[Auth] getUserByEmail result:", user ? `found (id=${user.id}, email=${user.email})` : "NOT FOUND");

            if (!user) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not found or incorrect credentials",
                });
            }

            if (user.password) {
                const isValid = await bcryptjs.compare(input.password, user.password);
                if (!isValid) {
                    // One-time auto-upgrade from legacy SHA256 hashes
                    const legacyHash = crypto.createHash("sha256").update(input.password).digest("hex");
                    if (legacyHash === user.password) {
                        console.log(`[Auth] Upgrading legacy SHA256 hash to bcrypt for user ${user.id}`);
                        const newBcryptHash = await bcryptjs.hash(input.password, 12);
                        await db.upsertUser({ ...user, password: newBcryptHash });
                    } else {
                        throw new TRPCError({
                            code: "UNAUTHORIZED",
                            message: "User not found or incorrect credentials",
                        });
                    }
                }
            } else {
                // They have no password (legacy OAuth login), let them set one by logging in or reject
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Please reset your password or sign in with your old method",
                });
            }

            const sessionToken = await sdk.createSessionToken(user.openId, {
                name: user.name || "",
                expiresInMs: ONE_YEAR_MS,
            });

            const cookieOptions = getSessionCookieOptions(ctx.req);
            (ctx.res as any).cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            // Auto-create org for existing users without one
            if (!user.orgId) {
                const drizzleDb = await getDb();
                if (drizzleDb) {
                    const orgName = `${(user.name || user.email?.split("@")[0] || "user")}'s Workspace`;
                    const orgSlug = `${(user.name || user.email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
                    const [orgResult] = await drizzleDb.insert(organizations).values({
                        name: orgName,
                        slug: orgSlug,
                        plan: "free",
                    });
                    const orgId = Number((orgResult as any).insertId);
                    await drizzleDb.insert(organizationMembers).values({
                        orgId,
                        userId: user.id,
                        role: "admin",
                    });
                    await drizzleDb.update(users).set({ orgId }).where(eq(users.id, user.id));
                }
            }

            await auditLog({
                userId: user.id,
                action: "auth.login",
                entityType: "user",
                entityId: user.id,
                ipAddress: ((ctx.req as any)?.headers?.["x-forwarded-for"] as string) || (ctx.req as any)?.socket?.remoteAddress || "127.0.0.1",
            });

            return { success: true };
        }),
    register: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const exists = await db.emailExists(input.email);
            if (exists) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Email already exists",
                });
            }

            const hash = await bcryptjs.hash(input.password, 12);
            const openId = crypto.randomUUID();

            await db.upsertUser({
                openId: openId,
                name: input.email.split("@")[0],
                email: input.email,
                loginMethod: "local",
                lastSignedIn: new Date(),
                password: hash,
            });

            const sessionToken = await sdk.createSessionToken(openId, {
                name: input.email.split("@")[0],
                expiresInMs: ONE_YEAR_MS,
            });

            const cookieOptions = getSessionCookieOptions(ctx.req);
            (ctx.res as any).cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            const createdUser = await db.getUserByEmail(input.email);
            if (createdUser) {
                // Auto-create a default organization for the new user
                const drizzleDb = await getDb();
                if (drizzleDb && !createdUser.orgId) {
                    const orgName = `${input.email.split("@")[0]}'s Workspace`;
                    const orgSlug = `${input.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
                    const [orgResult] = await drizzleDb.insert(organizations).values({
                        name: orgName,
                        slug: orgSlug,
                        plan: "free",
                    });
                    const orgId = Number((orgResult as any).insertId);
                    await drizzleDb.insert(organizationMembers).values({
                        orgId,
                        userId: createdUser.id,
                        role: "admin",
                    });
                    await drizzleDb.update(users).set({ orgId }).where(eq(users.id, createdUser.id));
                }

                await auditLog({
                    userId: createdUser.id,
                    action: "auth.register",
                    entityType: "user",
                    entityId: createdUser.id,
                    ipAddress: ((ctx.req as any)?.headers?.["x-forwarded-for"] as string) || (ctx.req as any)?.socket?.remoteAddress || "127.0.0.1",
                });
            }

            return { success: true };
        }),
});
