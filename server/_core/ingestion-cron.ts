import type { Express } from "express";
import { logger } from "./logger";
import { isCronAuthorized } from "./runtime-safety";
import { captureException } from "./sentry";

/** Register the authenticated ingestion endpoint used by Vercel Cron. */
export function registerIngestionCronRoute(app: Express): void {
  app.get("/api/cron/ingestion", async (req, res) => {
    try {
      if (!isCronAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      logger.info("[Cron Ingestion] Triggered via Vercel Cron");

      const { getAllConnectors } = await import("../engines/ingestion/connectors/index");
      const { runIngestion } = await import("../engines/ingestion/orchestrator");
      const report = await runIngestion(getAllConnectors(), "scheduled");

      logger.info(
        `[Cron Ingestion] Complete: ${report.evidenceCreated} records, ${report.durationMs}ms`
      );

      res.status(200).json({
        ok: true,
        evidenceCreated: report.evidenceCreated,
        evidenceSkipped: report.evidenceSkipped,
        sourcesAttempted: report.sourcesAttempted,
        sourcesSucceeded: report.sourcesSucceeded,
        durationMs: report.durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[Cron Ingestion] Failed", { error: message });
      captureException(error, { source: "cron-ingestion" });
      res.status(500).json({ ok: false, error: message });
    }
  });
}
