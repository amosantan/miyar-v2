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
import { getAllConnectors } from "./connectors/index";

// Default: Monday at 06:00 UTC
// node-cron v4 format: second minute hour day-of-month month day-of-week
const DEFAULT_CRON = "0 0 6 * * 1";

let scheduledTask: ScheduledTask | null = null;
let lastScheduledRunAt: Date | null = null;
let isSchedulerRunning = false;

/**
 * Get the cron expression (from env or default).
 */
export function getCronExpression(): string {
  return process.env.INGESTION_CRON_SCHEDULE || DEFAULT_CRON;
}

/**
 * Compute the next scheduled run time.
 * node-cron v4 has getNextRun() built in.
 */
export function getNextScheduledRun(): string | null {
  if (!scheduledTask) return null;
  try {
    const next = scheduledTask.getNextRun();
    return next ? next.toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * Start the ingestion scheduler.
 * Safe to call multiple times — will stop existing task first.
 */
export function startIngestionScheduler(): void {
  stopIngestionScheduler();

  let cronExpression = getCronExpression();

  // Validate the cron expression
  if (!cron.validate(cronExpression)) {
    console.error(
      `[Ingestion Scheduler] Invalid cron expression: "${cronExpression}". Falling back to default: "${DEFAULT_CRON}"`
    );
    cronExpression = DEFAULT_CRON;
  }

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      if (isSchedulerRunning) {
        console.log("[Ingestion Scheduler] Skipping — previous run still in progress");
        return;
      }

      isSchedulerRunning = true;
      const startTime = new Date();
      console.log(`[Ingestion Scheduler] Scheduled run started at ${startTime.toISOString()}`);

      try {
        const connectors = getAllConnectors();
        const report = await runIngestion(connectors, "scheduled");

        lastScheduledRunAt = new Date();
        console.log(
          `[Ingestion Scheduler] Run completed: ${report.sourcesSucceeded}/${report.sourcesAttempted} sources, ` +
          `${report.evidenceCreated} records created, ${report.evidenceSkipped} skipped ` +
          `(${report.durationMs}ms)`
        );
      } catch (error) {
        // CRITICAL: Never let scheduler crash the server
        console.error(
          "[Ingestion Scheduler] Run failed (server continues):",
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        isSchedulerRunning = false;
      }
    },
    {
      timezone: "UTC",
      name: "miyar-ingestion",
    }
  );

  console.log(
    `[Ingestion Scheduler] Started with cron: "${cronExpression}" (next run: ${getNextScheduledRun() ?? "unknown"})`
  );
}

/**
 * Stop the ingestion scheduler.
 */
export function stopIngestionScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Ingestion Scheduler] Stopped");
  }
}

/**
 * Get scheduler status for the API.
 */
export function getSchedulerStatus() {
  return {
    active: scheduledTask !== null,
    cronExpression: getCronExpression(),
    nextScheduledRun: getNextScheduledRun(),
    lastScheduledRunAt: lastScheduledRunAt?.toISOString() ?? null,
    isCurrentlyRunning: isSchedulerRunning,
  };
}
