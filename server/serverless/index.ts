import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../_core/oauth";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";
import { registerIngestionCronRoute } from "../_core/ingestion-cron";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerOAuthRoutes(app);
registerIngestionCronRoute(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
