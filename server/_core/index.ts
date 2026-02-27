import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startIngestionScheduler } from "../engines/ingestion/scheduler";
import { startLearningScheduler } from "../engines/learning/scheduler";
import { startAlertScheduler } from "../engines/autonomous/alert-scheduler";
import { initSentry, captureException } from "./sentry";
import { registerSSE } from "./sse-notifications";
import { registerApiDocs } from "./api-docs";
import { requestLogger, logger, startPerfMonitor } from "./logger";

// Initialise Sentry error tracking (no-ops if SENTRY_DSN is not set)
initSentry();

// --- Global Error Boundary (V7-07) ---
process.on("uncaughtException", (error) => {
  console.error("🔥 [CRITICAL] Uncaught Exception:", error);
  captureException(error, { source: "uncaughtException" });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 [CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
  captureException(reason, { source: "unhandledRejection" });
});
// ------------------------------------

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // P3-7: Structured request logging
  app.use(requestLogger);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // P3-3: Server-Sent Events for real-time notifications
  registerSSE(app);

  // P3-5: API documentation endpoints
  registerApiDocs(app);

  // ─── Vercel Cron: Ingestion trigger (Phase B.1) ────────────────────────────
  // Triggered by Vercel Cron Jobs or external scheduler via GET /api/cron/ingestion
  // Protected by CRON_SECRET bearer token
  app.get("/api/cron/ingestion", async (req, res) => {
    try {
      // Verify cron secret (Vercel sends Authorization header automatically)
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;

      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      logger.info("[Cron Ingestion] Triggered via Vercel Cron");

      // Dynamic import to avoid circular deps
      const { getAllConnectors } = await import("../engines/ingestion/connectors/index");
      const { runIngestion } = await import("../engines/ingestion/orchestrator");

      const connectors = getAllConnectors();
      const report = await runIngestion(connectors, "scheduled");

      logger.info(`[Cron Ingestion] Complete: ${report.evidenceCreated} records, ${report.durationMs}ms`);

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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Cron Ingestion] Failed", { error: msg });
      captureException(error, { source: "cron-ingestion" });
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);

    // P3-7: Start performance monitor (log memory/uptime every 5 min)
    startPerfMonitor(5);

    // Start ingestion scheduler (V2-07)
    try {
      startIngestionScheduler().catch(e => {
        logger.error("[Ingestion Scheduler] Async start failed", { error: String(e) });
      });
    } catch (e) {
      logger.error("[Ingestion Scheduler] Failed to start", { error: String(e) });
    }

    // Start learning accuracy scheduler (V5-02)
    try {
      startLearningScheduler();
    } catch (e) {
      logger.error("[Learning Scheduler] Failed to start", { error: String(e) });
    }

    // Start alert evaluation scheduler (V7-00a)
    try {
      startAlertScheduler();
    } catch (e) {
      logger.error("[Alert Scheduler] Failed to start", { error: String(e) });
    }
  });
}

startServer().catch(console.error);
