import express from "express";

const app = express();

// Catch-all error handler to surface initialization errors
app.use("*", async (_req: any, res: any) => {
    try {
        const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
        const { registerOAuthRoutes } = await import("../server/_core/oauth");
        const { appRouter } = await import("../server/routers");
        const { createContext } = await import("../server/_core/context");

        const innerApp = express();
        innerApp.use(express.json({ limit: "50mb" }));
        innerApp.use(express.urlencoded({ limit: "50mb", extended: true }));
        registerOAuthRoutes(innerApp);
        innerApp.use(
            "/api/trpc",
            createExpressMiddleware({
                router: appRouter,
                createContext,
            })
        );

        // Forward this request to the inner app  
        innerApp(_req, res);
    } catch (error: any) {
        res.status(500).json({
            error: "Server initialization failed",
            message: error?.message || String(error),
            stack: error?.stack?.split("\n").slice(0, 10),
        });
    }
});

export default app;
