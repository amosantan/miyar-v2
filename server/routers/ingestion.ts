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
import { getDb, getConnectorHealthByRun, getConnectorHealthHistory, getConnectorHealthSummary } from "../db";
import { ingestionRuns, connectorHealth, sourceRegistry, designTrends } from "../../drizzle/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getSchedulerStatus } from "../engines/ingestion/scheduler";
import { DynamicConnector } from "../engines/ingestion/connectors/dynamic";
import { seedUAESources } from "../engines/ingestion/seeds/uae-sources";

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
        (sum: number, r: any) => sum + (r.recordsInserted ?? 0),
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

  // ─── V3-02: Connector Health Endpoints ─────────────────────────

  /**
   * Get connector health records for a specific ingestion run.
   */
  getRunHealth: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input }) => {
      return getConnectorHealthByRun(input.runId);
    }),

  /**
   * Get health history for a specific connector (last 30 records).
   */
  getSourceHealth: protectedProcedure
    .input(z.object({
      sourceId: z.string(),
      limit: z.number().min(1).max(100).default(30),
    }))
    .query(async ({ input }) => {
      return getConnectorHealthHistory(input.sourceId, input.limit);
    }),

  /**
   * Get health summary across all connectors (last 30 days).
   * Returns aggregated success rates and response times.
   */
  getHealthSummary: protectedProcedure
    .query(async () => {
      const records = await getConnectorHealthSummary();

      // Aggregate by sourceId
      const bySource = new Map<string, {
        sourceId: string;
        sourceName: string;
        totalRuns: number;
        successes: number;
        partials: number;
        failures: number;
        avgResponseMs: number | null;
        totalExtracted: number;
        totalInserted: number;
        lastStatus: string;
        lastRunAt: Date | null;
        lastError: string | null;
      }>();

      for (const r of records) {
        const existing = bySource.get(r.sourceId) || {
          sourceId: r.sourceId,
          sourceName: r.sourceName,
          totalRuns: 0,
          successes: 0,
          partials: 0,
          failures: 0,
          avgResponseMs: null,
          totalExtracted: 0,
          totalInserted: 0,
          lastStatus: r.status,
          lastRunAt: r.createdAt,
          lastError: null,
        };

        existing.totalRuns++;
        if (r.status === "success") existing.successes++;
        else if (r.status === "partial") existing.partials++;
        else existing.failures++;

        existing.totalExtracted += r.recordsExtracted;
        existing.totalInserted += r.recordsInserted;

        if (r.responseTimeMs) {
          existing.avgResponseMs = existing.avgResponseMs
            ? Math.round((existing.avgResponseMs + r.responseTimeMs) / 2)
            : r.responseTimeMs;
        }

        // Track latest status and error
        if (!existing.lastRunAt || r.createdAt > existing.lastRunAt) {
          existing.lastStatus = r.status;
          existing.lastRunAt = r.createdAt;
          existing.lastError = r.errorMessage;
        }

        bySource.set(r.sourceId, existing);
      }

      return Array.from(bySource.values()).map((s) => ({
        ...s,
        successRate: s.totalRuns > 0
          ? Math.round(((s.successes + s.partials) / s.totalRuns) * 100)
          : 0,
      }));
    }),

  // ─── Source Registry Management ──────────────────────────────

  /**
   * List all sources from source_registry with health info.
   */
  listSources: protectedProcedure
    .input(z.object({
      activeOnly: z.boolean().default(true),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const filter = input?.activeOnly !== false ? eq(sourceRegistry.isActive, true) : undefined;
      const sources = filter
        ? await db.select().from(sourceRegistry).where(filter).orderBy(desc(sourceRegistry.updatedAt))
        : await db.select().from(sourceRegistry).orderBy(desc(sourceRegistry.updatedAt));
      return sources;
    }),

  /**
   * Create a new source in the registry.
   */
  createSource: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      url: z.string().url(),
      sourceType: z.enum(["supplier_catalog", "manufacturer_catalog", "developer_brochure", "industry_report", "government_tender", "procurement_portal", "trade_publication", "retailer_listing", "aggregator", "other"]),
      reliabilityDefault: z.enum(["A", "B", "C"]).default("B"),
      region: z.string().default("UAE"),
      scrapeMethod: z.enum(["html_llm", "html_rules", "json_api", "rss_feed", "csv_upload", "email_forward"]).default("html_llm"),
      scrapeSchedule: z.string().optional(),
      extractionHints: z.string().optional(),
      notes: z.string().optional(),
      requestDelayMs: z.number().default(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [result] = await db.insert(sourceRegistry).values({
        name: input.name,
        url: input.url,
        sourceType: input.sourceType,
        reliabilityDefault: input.reliabilityDefault,
        region: input.region,
        scrapeMethod: input.scrapeMethod,
        scrapeSchedule: input.scrapeSchedule,
        extractionHints: input.extractionHints,
        notes: input.notes,
        requestDelayMs: input.requestDelayMs,
        isActive: true,
        isWhitelisted: true,
        addedBy: ctx.user.id,
        lastScrapedStatus: "never",
        lastRecordCount: 0,
        consecutiveFailures: 0,
      });
      return { id: result.insertId, name: input.name };
    }),

  /**
   * Toggle source active/inactive.
   */
  toggleSource: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(sourceRegistry).set({ isActive: input.isActive }).where(eq(sourceRegistry.id, input.id));
      return { id: input.id, isActive: input.isActive };
    }),

  /**
   * Run a single DB-registered source via DynamicConnector.
   */
  runRegisteredSource: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [source] = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, input.id)).limit(1);
      if (!source) throw new Error("Source not found");
      const connector = new DynamicConnector(source);
      const report = await runIngestion([connector], "manual", ctx.user.id);
      // Update lastScrapedAt + status
      await db.update(sourceRegistry).set({
        lastScrapedAt: new Date(),
        lastScrapedStatus: report.sourcesFailed > 0 ? "failed" : "success",
        lastRecordCount: report.evidenceCreated,
        consecutiveFailures: report.sourcesFailed > 0
          ? sql`${sourceRegistry.consecutiveFailures} + 1`
          : 0,
      }).where(eq(sourceRegistry.id, input.id));
      return report;
    }),

  /**
   * Seed all UAE sources into source_registry.
   */
  seedSources: adminProcedure
    .mutation(async () => {
      return seedUAESources();
    }),

  // ─── Design Trends ──────────────────────────────────────────

  /**
   * List detected design trends, ordered by mention count.
   */
  getTrends: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      category: z.enum(["style", "material", "color", "layout", "technology", "sustainability", "other"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let query = db.select().from(designTrends).orderBy(desc(designTrends.mentionCount)).limit(input?.limit ?? 50);
      if (input?.category) {
        query = query.where(eq(designTrends.trendCategory, input.category)) as any;
      }
      return query;
    }),
});
