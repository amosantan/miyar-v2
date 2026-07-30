import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ClaimHealthStoreError,
  createReportPublicShare,
  listActiveReportPublicShares,
  resolveReportPublicShare,
  revokeReportPublicShare,
  type OrganizationAdminContext,
} from "../db/claim-health";
import {
  orgAdminProcedure,
  publicRateLimitedProcedure,
  router,
} from "../_core/trpc";

function adminContext(ctx: {
  orgId: number;
  user: { id: number };
}): OrganizationAdminContext {
  return {
    kind: "organization_admin",
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    sessionIdentity: "report-share-router-v1",
  };
}

function concealedShareError(): TRPCError {
  return new TRPCError({
    code: "NOT_FOUND",
    message: "Report share not found or expired",
  });
}

function translateAuthenticatedError(error: unknown, operation: string): never {
  if (error instanceof ClaimHealthStoreError) {
    if (error.code === "CONCEALED") throw concealedShareError();
    if (error.code === "FORBIDDEN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Organization administrator access is required",
      });
    }
    if (error.code === "CONFLICT") {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Unable to ${operation} because the resource changed`,
      });
    }
    if (error.code === "INVALID") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unable to ${operation} report share`,
      });
    }
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Unable to ${operation} report share`,
  });
}

export const reportShareRouter = router({
  list: orgAdminProcedure
    .input(z.object({ reportInstanceId: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => {
      try {
        const shares = await listActiveReportPublicShares(
          {
            organizationId: ctx.orgId,
            reportInstanceId: input.reportInstanceId,
          },
          adminContext(ctx)
        );
        return shares.map(share => ({
          shareId: share.shareId,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
          revokedAt: share.revokedAt,
          active: share.active,
        }));
      } catch (error) {
        translateAuthenticatedError(error, "list");
      }
    }),

  create: orgAdminProcedure
    .input(
      z
        .object({
          reportInstanceId: z.number().int().positive(),
          expiryDays: z.number().int().min(1).max(90).default(7),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = new Date();
      expiresAt.setUTCDate(expiresAt.getUTCDate() + input.expiryDays);
      try {
        const share = await createReportPublicShare(
          {
            organizationId: ctx.orgId,
            reportInstanceId: input.reportInstanceId,
            expiresAt,
          },
          adminContext(ctx)
        );
        return {
          shareId: share.shareId,
          token: share.token,
          shareUrl: `/report-share/${share.token}`,
          expiresAt: share.expiresAt,
        };
      } catch (error) {
        translateAuthenticatedError(error, "create");
      }
    }),

  revoke: orgAdminProcedure
    .input(z.object({ shareId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      try {
        const revoked = await revokeReportPublicShare(
          { organizationId: ctx.orgId, shareId: input.shareId },
          adminContext(ctx)
        );
        if (!revoked) throw concealedShareError();
        return { revoked: true as const };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        translateAuthenticatedError(error, "revoke");
      }
    }),

  resolve: publicRateLimitedProcedure
    .input(
      z
        .object({
          // Shape is validated here; the persistence boundary applies the
          // exact token format so malformed strings remain indistinguishable
          // from missing, expired, revoked, and tampered shares.
          token: z.string(),
        })
        .strict()
    )
    .query(async ({ input }) => {
      try {
        const resolved = await resolveReportPublicShare({
          token: input.token,
          asOf: new Date(),
        });
        if (!resolved) throw concealedShareError();
        return {
          report: {
            reportType: resolved.report.reportType,
            locale: resolved.report.locale,
            generatedAt: resolved.report.generatedAt,
          },
          claimHealth: resolved.claimHealth,
          expiresAt: resolved.expiresAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        // Public callers must not distinguish malformed, missing, expired,
        // revoked, tampered, or temporarily unavailable private records.
        throw concealedShareError();
      }
    }),
});
