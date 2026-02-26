/**
 * Sentry Error Tracking Integration
 *
 * Initialise Sentry for the server-side process.
 * Import this file early in the server entry point.
 *
 * Required env vars:
 *   SENTRY_DSN        — project DSN from sentry.io
 *   SENTRY_ENV        — e.g. "production", "staging"   (default "development")
 *   NODE_ENV           — used for environment fallback
 *
 * NOTE: The actual @sentry/node package must be installed:
 *   npm install @sentry/node @sentry/profiling-node
 *
 * Until the package is installed, the server will still function —
 * sentry.ts simply no-ops when SENTRY_DSN is absent.
 */

let Sentry: any = null;

export function initSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        console.log("[sentry] SENTRY_DSN not set — error tracking disabled");
        return;
    }

    try {
        // Dynamic import so the server doesn't crash if @sentry/node isn't installed
        Sentry = require("@sentry/node");

        Sentry.init({
            dsn,
            environment: process.env.SENTRY_ENV || process.env.NODE_ENV || "development",
            tracesSampleRate: 0.2,       // 20% of transactions
            profilesSampleRate: 0.1,     // 10% of profiled transactions

            // Ignore certain expected errors
            ignoreErrors: [
                "TOO_MANY_REQUESTS",
                "UNAUTHORIZED",
                "FORBIDDEN",
            ],

            beforeSend(event: any) {
                // Scrub sensitive data
                if (event.request?.headers) {
                    delete event.request.headers.cookie;
                    delete event.request.headers.authorization;
                }
                return event;
            },
        });

        console.log("[sentry] Error tracking initialised ✓");
    } catch (err) {
        console.warn("[sentry] Failed to initialise — @sentry/node may not be installed.", err);
    }
}

/**
 * Capture an exception and send it to Sentry (if initialised).
 */
export function captureException(err: unknown, context?: Record<string, any>) {
    if (!Sentry) return;
    Sentry.withScope((scope: any) => {
        if (context) {
            Object.entries(context).forEach(([key, val]) => {
                scope.setExtra(key, val);
            });
        }
        Sentry.captureException(err);
    });
}

/**
 * Capture a message (e.g. warning, info) to Sentry.
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    if (!Sentry) return;
    Sentry.captureMessage(message, level);
}
