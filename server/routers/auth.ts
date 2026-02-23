import { z } from "zod";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { TRPCError } from "@trpc/server";

export const authRouter = router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true } as const;
    }),
    login: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const dbUsers = await db.getAllUsers();
            const user = dbUsers.find((u) => u.email === input.email);

            if (!user) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not found or incorrect credentials",
                });
            }

            if (user.password) {
                // Very basic simple hash checking for drop-in demo
                const hash = crypto.createHash("sha256").update(input.password).digest("hex");
                if (hash !== user.password) {
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "User not found or incorrect credentials",
                    });
                }
            } else {
                // They have no password (legacy manus login), let them set one by logging in or reject
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

            return { success: true };
        }),
    register: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const dbUsers = await db.getAllUsers();
            if (dbUsers.some((u) => u.email === input.email)) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Email already exists",
                });
            }

            const hash = crypto.createHash("sha256").update(input.password).digest("hex");
            const openId = crypto.randomUUID();

            await db.upsertUser({
                openId: openId,
                name: input.email.split("@")[0],
                email: input.email,
                loginMethod: "local",
                lastSignedIn: new Date(),
                // @ts-expect-error - added via schema but types may not reflect yet
                password: hash,
            });

            const sessionToken = await sdk.createSessionToken(openId, {
                name: input.email.split("@")[0],
                expiresInMs: ONE_YEAR_MS,
            });

            const cookieOptions = getSessionCookieOptions(ctx.req);
            ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

            return { success: true };
        }),
});
