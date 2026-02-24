import { z } from "zod";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../_core/audit";

export const authRouter = router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
        if (ctx.user) {
            await auditLog({
                userId: ctx.user.id,
                action: "auth.logout",
                entityType: "user",
                entityId: ctx.user.id,
                ipAddress: (ctx.req?.headers?.["x-forwarded-for"] as string) || ctx.req?.socket?.remoteAddress || "127.0.0.1",
            });
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            await auditLog({
                userId: user.id,
                action: "auth.login",
                entityType: "user",
                entityId: user.id,
                ipAddress: (ctx.req?.headers?.["x-forwarded-for"] as string) || ctx.req?.socket?.remoteAddress || "127.0.0.1",
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
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            const createdUser = await db.getUserByEmail(input.email);
            if (createdUser) {
                await auditLog({
                    userId: createdUser.id,
                    action: "auth.register",
                    entityType: "user",
                    entityId: createdUser.id,
                    ipAddress: (ctx.req?.headers?.["x-forwarded-for"] as string) || ctx.req?.socket?.remoteAddress || "127.0.0.1",
                });
            }

            return { success: true };
        }),
});
