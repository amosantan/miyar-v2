import express from "express";

let app: any;

try {
    // dotenv is not needed on Vercel - env vars are injected automatically
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { registerOAuthRoutes } = await import("../server/_core/oauth");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");

    app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    registerOAuthRoutes(app);

    app.use(
        "/api/trpc",
        createExpressMiddleware({
            router: appRouter,
            createContext,
        })
    );
} catch (error: any) {
    app = express();
    app.use("*", (_req: any, res: any) => {
        res.status(500).json({
            error: "Server initialization failed",
            message: error?.message || String(error),
            stack: error?.stack?.split("\n").slice(0, 5),
        });
    });
}

export default app;
