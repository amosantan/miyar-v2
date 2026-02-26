/**
 * In-memory rate limiter for TRPC procedures.
 *
 * Applies a sliding-window per-user limit with configurable
 * window (ms) and max requests. Used to protect expensive
 * compute mutations (Monte Carlo, Digital Twin, Health Score).
 */
import { TRPCError } from "@trpc/server";

// ─── sliding-window store ───────────────────────────────────────────────────

interface WindowEntry {
    timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Evict stale keys every 5 minutes
setInterval(() => {
    const now = Date.now();
    const keys = Array.from(store.keys());
    for (const key of keys) {
        const entry = store.get(key);
        if (!entry) continue;
        entry.timestamps = entry.timestamps.filter(t => now - t < 300_000);
        if (entry.timestamps.length === 0) store.delete(key);
    }
}, 300_000);

// ─── middleware factory ─────────────────────────────────────────────────────

export interface RateLimitOpts {
    windowMs?: number;   // sliding window size (default 60 000 = 1 min)
    max?: number;        // max requests per window (default 5)
    keyPrefix?: string;  // extra namespace for the limit
}

/**
 * Creates a TRPC middleware that rate-limits per-user.
 * Usage: `protectedProcedure.use(rateLimit({ max: 3, windowMs: 60_000 }))`
 *
 * @param t - The initTRPC instance (from initTRPC.context<Ctx>().create())
 */
export function createRateLimitMiddleware(
    t: { middleware: Function },
    opts: RateLimitOpts = {},
) {
    const { windowMs = 60_000, max = 5, keyPrefix = "rl" } = opts;

    return (t as any).middleware(async ({ ctx, next, path }: { ctx: any; next: Function; path: string }) => {
        const userId = ctx?.user?.id ?? "anon";
        const key = `${keyPrefix}:${userId}:${path}`;
        const now = Date.now();

        let entry = store.get(key);
        if (!entry) {
            entry = { timestamps: [] };
            store.set(key, entry);
        }

        // Evict timestamps outside the window
        entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

        if (entry.timestamps.length >= max) {
            const retryAfterMs = entry.timestamps[0] + windowMs - now;
            throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
            });
        }

        entry.timestamps.push(now);
        return next();
    });
}
