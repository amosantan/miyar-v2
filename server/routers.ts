import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { projectRouter } from "./routers/project";
import { scenarioRouter } from "./routers/scenario";
import { adminRouter } from "./routers/admin";
import { seedRouter } from "./routers/seed";
import { designRouter } from "./routers/design";
import { intelligenceRouter } from "./routers/intelligence";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  project: projectRouter,
  scenario: scenarioRouter,
  admin: adminRouter,
  seed: seedRouter,
  design: designRouter,
  intelligence: intelligenceRouter,
});

export type AppRouter = typeof appRouter;
