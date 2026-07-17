import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '../../shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as db from "../db";
import { createRateLimitMiddleware } from "./rate-limit";
import { getAiOperationError } from "./ai-operation";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const aiError = getAiOperationError(error.cause ?? error);
    return {
      ...shape,
      message: aiError?.message ?? shape.message,
      data: {
        ...shape.data,
        aiCode: aiError?.code,
        retryable: aiError?.retryable,
        correlationId: aiError?.correlationId,
      },
    };
  },
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

// Platform-wide governance only. Tenant-owned resources must still use an
// organization procedure and an explicit resource resolver.
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

  const memberships = await db.getOrganizationMemberships(
    ctx.user.id,
    ctx.user.orgId
  );
  if (memberships.length !== 1) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User does not belong to this organization",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId: ctx.user.orgId,
      orgRole: memberships[0].role,
    },
  });
});

export const orgProcedure = t.procedure.use(requireOrg);

export const orgMutationProcedure = orgProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.orgRole === "viewer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Organization viewer access is read-only",
      });
    }
    return next({ ctx });
  }
);

export const orgAdminProcedure = orgProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.orgRole !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Organization administrator access is required",
      });
    }
    return next({ ctx });
  }
);

// Compatibility aliases retained for the design router while the generic
// organization procedures are adopted across the application.
export const designOrgMutationProcedure = orgMutationProcedure;
export const designOrgAdminProcedure = orgAdminProcedure;

/** Protected + rate limited: max 5 calls/minute per user */
const heavyRateLimit = createRateLimitMiddleware(t, {
  max: 5,
  windowMs: 60_000,
  keyPrefix: "heavy",
});

export const heavyProcedure = t.procedure
  .use(requireUser)
  .use(heavyRateLimit);

/** Current organization membership plus the existing expensive-call limit. */
export const orgRateLimitedProcedure = orgProcedure.use(heavyRateLimit);

/** Organization member/admin mutation plus the existing expensive-call limit. */
export const orgHeavyMutationProcedure =
  orgMutationProcedure.use(heavyRateLimit);
