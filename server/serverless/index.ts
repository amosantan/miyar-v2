import "../_core/runtime-bootstrap";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../_core/oauth";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";
import { registerIngestionCronRoute } from "../_core/ingestion-cron";
import { publicShareHeaders } from "../_core/public-share-headers";

type AppOptions = {
  trpcRouter?: any;
  contextFactory?: any;
};

export function createServerlessApplication(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  registerIngestionCronRoute(app);
  app.use(publicShareHeaders);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: options.trpcRouter ?? appRouter,
      createContext: options.contextFactory ?? createContext,
    })
  );
  return app;
}

export default createServerlessApplication();
