import { z } from "zod";
import * as db from "../db";
import { getCachedMarketEvidenceSnapshot } from "./market-evidence";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, publicRateLimitedProcedure, router } from "./trpc";

export const systemRouter = router({
  marketEvidenceSnapshot: publicRateLimitedProcedure
    .input(z.undefined())
    .query(() => getCachedMarketEvidenceSnapshot(db.getPublicMarketEvidenceCounts)),

  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
