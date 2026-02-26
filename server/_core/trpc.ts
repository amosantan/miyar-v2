import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '../../shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

const requireOrg = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.user.orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "User does not belong to an organization" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId: ctx.user.orgId,
    },
  });
});

export const orgProcedure = t.procedure.use(requireOrg);

// ─── Rate-limited procedure for expensive compute mutations ─────────────────
import { createRateLimitMiddleware } from "./rate-limit";

/** Protected + rate limited: max 5 calls/minute per user */
export const heavyProcedure = t.procedure
  .use(requireUser)
  .use(createRateLimitMiddleware(t, { max: 5, windowMs: 60_000, keyPrefix: "heavy" }));

