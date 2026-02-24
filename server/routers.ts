import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { projectRouter } from "./routers/project";
import { scenarioRouter } from "./routers/scenario";
import { adminRouter } from "./routers/admin";
import { seedRouter } from "./routers/seed";
import { designRouter } from "./routers/design";
import { intelligenceRouter } from "./routers/intelligence";
import { marketIntelligenceRouter } from "./routers/market-intelligence";
import { ingestionRouter } from "./routers/ingestion";
import { analyticsRouter } from "./routers/analytics";
import { predictiveRouter } from "./routers/predictive";
import { learningRouter } from "./routers/learning";
import { autonomousRouter } from "./routers/autonomous";
import { organizationRouter } from "./routers/organization";
import { economicsRouter } from "./routers/economics";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  project: projectRouter,
  scenario: scenarioRouter,
  admin: adminRouter,
  seed: seedRouter,
  design: designRouter,
  intelligence: intelligenceRouter,
  marketIntel: marketIntelligenceRouter,
  ingestion: ingestionRouter,
  analytics: analyticsRouter,
  predictive: predictiveRouter,
  learning: learningRouter,
  autonomous: autonomousRouter,
  organization: organizationRouter,
  economics: economicsRouter,
});

export type AppRouter = typeof appRouter;
