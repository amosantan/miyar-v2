/**
 * MIYAR V2-07 — Ingestion Scheduler
 *
 * Uses node-cron v4 to schedule automatic ingestion runs.
 * Default: Monday 06:00 UTC (configurable via INGESTION_CRON_SCHEDULE env var).
 *
 * The scheduler:
 *   - Starts on server boot
 *   - Runs all 12 UAE connectors on schedule
 *   - Never crashes the server on failure
 *   - Exposes nextScheduledRun() for the status endpoint
 */

import cron, { type ScheduledTask } from "node-cron";
import { runIngestion } from "./orchestrator";
import { getDb } from "../../db";
import { sourceRegistry } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { DynamicConnector } from "./connectors/dynamic";

// Default: Monday at 06:00 UTC
const DEFAULT_CRON = "0 0 6 * * 1";

let scheduledTasks: ScheduledTask[] = [];
let lastScheduledRunAt: Date | null = null;
let isSchedulerRunning = false;
let activeSchedulesCount = 0;

/**
 * Get the global fallback cron expression (from env or default).
 */
export function getCronExpression(): string {
  return process.env.INGESTION_CRON_SCHEDULE || DEFAULT_CRON;
}

/**
 * Compute the next scheduled run time.
 * In a multi-cron setup, we look at the earliest next run across all tasks.
 */
export function getNextScheduledRun(): string | null {
  if (scheduledTasks.length === 0) return null;
  let earliest: Date | null = null;

  for (const task of scheduledTasks) {
    try {
      const nextDate = task.getNextRun();
      if (nextDate) {
        if (!earliest || nextDate < earliest) earliest = nextDate;
      }
    } catch { }
  }

  return earliest ? earliest.toISOString() : null;
}

/**
 * Start the ingestion scheduler.
 * Reads active sources from DB, groups them by schedule, and creates separate crons.
 */
export async function startIngestionScheduler(): Promise<void> {
  stopIngestionScheduler();
  const db = await getDb();
  if (!db) {
    console.warn("[Ingestion Scheduler] DB not available yet, cannot start multi-scheduler.");
    return;
  }

  const activeSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.isActive, true));

  // Group by schedule
  const sourcesBySchedule: Record<string, typeof activeSources> = {};
  const fallbackSchedule = getCronExpression();

  for (const source of activeSources) {
    const schedule = source.scrapeSchedule && cron.validate(source.scrapeSchedule)
      ? source.scrapeSchedule
      : fallbackSchedule;

    if (!sourcesBySchedule[schedule]) {
      sourcesBySchedule[schedule] = [];
    }
    sourcesBySchedule[schedule].push(source);
  }

  activeSchedulesCount = Object.keys(sourcesBySchedule).length;

  for (const [schedule, sources] of Object.entries(sourcesBySchedule)) {
    const task = cron.schedule(
      schedule,
      async () => {
        if (isSchedulerRunning) {
          console.log(`[Ingestion Scheduler] Skipping runs for schedule "${schedule}" — previous run still in progress`);
          return;
        }

        isSchedulerRunning = true;
        const startTime = new Date();
        console.log(`[Ingestion Scheduler] Starting batch for schedule "${schedule}" with ${sources.length} sources`);

        try {
          // Staggered execution within the batch (spawn runIngestion per source, stagger by 30s)
          let idx = 0;
          for (const source of sources) {
            idx++;
            console.log(`[Ingestion Scheduler] [${idx}/${sources.length}] Queuing source ${source.name}...`);
            const connector = new DynamicConnector(source);

            try {
              const report = await runIngestion([connector], "scheduled");
              console.log(
                `[Ingestion Scheduler] Source ${source.name} complete: ` +
                `${report.evidenceCreated} records created (${report.durationMs}ms)`
              );
            } catch (err) {
              console.error(`[Ingestion Scheduler] Individual run failed for ${source.name}:`, err);
            }

            lastScheduledRunAt = new Date();

            // Stagger next run in same schedule by 30 seconds
            if (idx < sources.length) {
              await new Promise(r => setTimeout(r, 30_000));
            }
          }
          console.log(`[Ingestion Scheduler] Batch for schedule "${schedule}" completed successfully.`);
        } catch (error) {
          console.error(
            `[Ingestion Scheduler] Batch failed for schedule "${schedule}":`,
            error instanceof Error ? error.message : String(error)
          );
        } finally {
          isSchedulerRunning = false;
        }
      },
      {
        timezone: "UTC",
        name: `miyar-ingestion-${schedule.replace(/\s+/g, "-")}`,
      }
    );

    scheduledTasks.push(task);
  }

  console.log(
    `[Ingestion Scheduler] Started ${scheduledTasks.length} cron jobs for ${activeSources.length} active sources.`
  );
}

/**
 * Stop the ingestion scheduler.
 */
export function stopIngestionScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];
  activeSchedulesCount = 0;
  console.log("[Ingestion Scheduler] Stopped all scheduled tasks");
}

/**
 * Get scheduler status for the API.
 */
export function getSchedulerStatus() {
  return {
    active: scheduledTasks.length > 0,
    cronExpression: `${activeSchedulesCount} configured schedules`,
    nextScheduledRun: getNextScheduledRun(),
    lastScheduledRunAt: lastScheduledRunAt?.toISOString() ?? null,
    isCurrentlyRunning: isSchedulerRunning,
  };
}
