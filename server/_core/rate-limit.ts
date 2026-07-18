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
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    const keys = Array.from(store.keys());
    for (const key of keys) {
        const entry = store.get(key);
        if (!entry) continue;
        entry.timestamps = entry.timestamps.filter(t => now - t < 300_000);
        if (entry.timestamps.length === 0) store.delete(key);
    }
}, 300_000);
cleanupTimer.unref?.();

// ─── middleware factory ─────────────────────────────────────────────────────

export interface RateLimitOpts {
    windowMs?: number;   // sliding window size (default 60 000 = 1 min)
    max?: number;        // max requests per window (default 5)
    keyPrefix?: string;  // extra namespace for the limit
}

export function buildRateLimitKey(
    keyPrefix: string,
    userId: number | string,
    path: string,
) {
    return `${keyPrefix}:${userId}:${path}`;
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
        const key = buildRateLimitKey(keyPrefix, userId, path);
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

const publicStore = new Map<string, WindowEntry>();
const PUBLIC_MAX_KEYS = 1_024;
const PUBLIC_WINDOW_MS = 60_000;
const PUBLIC_PER_ADDRESS_MAX = 60;
const PUBLIC_GLOBAL_MAX = 600;

function trimWindow(entry: WindowEntry, now: number) {
  entry.timestamps = entry.timestamps.filter(timestamp => now - timestamp < PUBLIC_WINDOW_MS);
}

function publicSlot(key: string, now: number) {
  let entry = publicStore.get(key);
  if (!entry) {
    if (publicStore.size >= PUBLIC_MAX_KEYS) {
      const oldestKey = publicStore.keys().next().value as string | undefined;
      if (oldestKey) publicStore.delete(oldestKey);
    }
    entry = { timestamps: [] };
    publicStore.set(key, entry);
  }
  trimWindow(entry, now);
  // Refresh insertion order for bounded LRU-style eviction.
  publicStore.delete(key);
  publicStore.set(key, entry);
  return entry;
}

/**
 * Best-effort process-local public limiter with both per-address and global
 * ceilings. It deliberately uses the socket address unless trusted proxy mode
 * is explicitly enabled; distributed edge enforcement belongs to deployment.
 */
export function createPublicRateLimitMiddleware(t: { middleware: Function }) {
  return (t as any).middleware(async ({ ctx, next, path }: { ctx: any; next: Function; path: string }) => {
    const forwarded = process.env.TRUST_PROXY === "1"
      ? String(ctx?.req?.headers?.["x-forwarded-for"] ?? "").split(",")[0]?.trim()
      : "";
    const remoteAddress = forwarded || ctx?.req?.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const globalEntry = publicSlot(`public:global:${path}`, now);
    const addressEntry = publicSlot(`public:${remoteAddress}:${path}`, now);
    if (globalEntry.timestamps.length >= PUBLIC_GLOBAL_MAX || addressEntry.timestamps.length >= PUBLIC_PER_ADDRESS_MAX) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Try again shortly." });
    }
    // Commit both quotas only after both non-consuming checks pass.
    globalEntry.timestamps.push(now);
    addressEntry.timestamps.push(now);
    return next();
  });
}

export function resetPublicRateLimitForTests() {
  publicStore.clear();
}
