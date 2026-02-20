/**
 * MIYAR V2-05 — Ingestion Router
 *
 * tRPC endpoints for the Live Market Ingestion Engine:
 *   - ingestion.runAll: Run all 12 UAE connectors (admin-only)
 *   - ingestion.runSource: Run a single connector by sourceId (admin-only)
 *   - ingestion.getHistory: List past ingestion runs (paginated)
 *   - ingestion.getStatus: Current ingestion status + next scheduled run
 *   - ingestion.getRunDetail: Get detailed breakdown for a specific run
 *   - ingestion.getAvailableSources: List all registered connector IDs
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { runIngestion, runSingleConnector } from "../engines/ingestion/orchestrator";
import {
  getAllConnectors,
  getConnectorById,
  ALL_CONNECTORS,
} from "../engines/ingestion/connectors/index";
import { getDb } from "../db";
import { ingestionRuns } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getSchedulerStatus } from "../engines/ingestion/scheduler";

export const ingestionRouter = router({
  /**
   * Run all 12 UAE source connectors.
   * Admin-only. Returns full IngestionRunReport.
   */
  runAll: adminProcedure
    .mutation(async ({ ctx }) => {
      const connectors = getAllConnectors();
      const report = await runIngestion(connectors, "manual", ctx.user.id);
      return report;
    }),

  /**
   * Run a single connector by sourceId.
   * Admin-only. Returns IngestionRunReport for that one source.
   */
  runSource: adminProcedure
    .input(z.object({
      sourceId: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const connector = getConnectorById(input.sourceId);
      if (!connector) {
        throw new Error(`Unknown source connector: ${input.sourceId}. Available: ${Object.keys(ALL_CONNECTORS).join(", ")}`);
      }
      const report = await runSingleConnector(connector, "manual", ctx.user.id);
      return report;
    }),

  /**
   * List past ingestion runs (paginated, newest first).
   */
  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { runs: [], total: 0 };

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const runs = await db
        .select()
        .from(ingestionRuns)
        .orderBy(desc(ingestionRuns.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const allRuns = await db.select({ id: ingestionRuns.id }).from(ingestionRuns);
      const total = allRuns.length;

      return { runs, total };
    }),

  /**
   * Get current ingestion status: last run info + next scheduled run time.
   */
  getStatus: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        return {
          lastRun: null,
          totalRuns: 0,
          totalRecordsIngested: 0,
          availableSources: Object.keys(ALL_CONNECTORS).length,
          scheduledCron: null,
          nextScheduledRun: null,
        };
      }

      // Get last run
      const lastRuns = await db
        .select()
        .from(ingestionRuns)
        .orderBy(desc(ingestionRuns.createdAt))
        .limit(1);

      const lastRun = lastRuns.length > 0 ? lastRuns[0] : null;

      // Get total counts
      const allRuns = await db.select().from(ingestionRuns);
      const totalRuns = allRuns.length;
      const totalRecordsIngested = allRuns.reduce(
        (sum, r) => sum + (r.recordsInserted ?? 0),
        0
      );

      // Get scheduler info
      const scheduler = getSchedulerStatus();

      return {
        lastRun: lastRun
          ? {
              runId: lastRun.runId,
              status: lastRun.status,
              trigger: lastRun.trigger,
              totalSources: lastRun.totalSources,
              sourcesSucceeded: lastRun.sourcesSucceeded,
              sourcesFailed: lastRun.sourcesFailed,
              recordsInserted: lastRun.recordsInserted,
              duplicatesSkipped: lastRun.duplicatesSkipped,
              startedAt: lastRun.startedAt,
              completedAt: lastRun.completedAt,
              durationMs: lastRun.durationMs,
            }
          : null,
        totalRuns,
        totalRecordsIngested,
        availableSources: Object.keys(ALL_CONNECTORS).length,
        scheduler,
      };
    }),

  /**
   * Get detailed breakdown for a specific ingestion run.
   */
  getRunDetail: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const runs = await db
        .select()
        .from(ingestionRuns)
        .where(eq(ingestionRuns.runId, input.runId))
        .limit(1);

      return runs.length > 0 ? runs[0] : null;
    }),

  /**
   * List all available source connector IDs with metadata.
   */
  getAvailableSources: protectedProcedure
    .query(() => {
      const connectors = getAllConnectors();
      return connectors.map((c) => ({
        sourceId: c.sourceId,
        sourceName: c.sourceName,
        sourceUrl: c.sourceUrl,
      }));
    }),
});
