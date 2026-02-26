/**
 * Structured Logging + Performance Monitoring (P3-7)
 *
 * JSON-structured logger with request tracing, performance timing,
 * and configurable log levels. Zero external dependencies.
 *
 * Usage:
 *   import { logger, withTiming } from "./logger";
 *   logger.info("Server started", { port: 3000 });
 *   const result = await withTiming("monte-carlo", () => runSimulation());
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || "info"];
const IS_JSON = process.env.LOG_FORMAT !== "pretty";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    [key: string]: unknown;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < MIN_LEVEL) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        service: "miyar-api",
        ...meta,
    };

    if (IS_JSON) {
        const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        fn(JSON.stringify(entry));
    } else {
        const color =
            level === "error" ? "\x1b[31m" :
                level === "warn" ? "\x1b[33m" :
                    level === "debug" ? "\x1b[90m" :
                        "\x1b[36m";
        const reset = "\x1b[0m";
        const time = new Date().toLocaleTimeString("en-US", { hour12: false });
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
        console.log(`${color}[${time}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}${reset}`);
    }
}

// ─── Logger API ─────────────────────────────────────────────────────────────

export const logger = {
    debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};

// ─── Performance Timing ─────────────────────────────────────────────────────

/**
 * Wrap an async function with automatic duration logging.
 */
export async function withTiming<T>(
    label: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>,
): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        const durationMs = Math.round(performance.now() - start);
        logger.info(`${label} completed`, { durationMs, ...meta });
        return result;
    } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        logger.error(`${label} failed`, {
            durationMs,
            error: err instanceof Error ? err.message : String(err),
            ...meta,
        });
        throw err;
    }
}

// ─── Request Logger Middleware ───────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();
    const requestId = Math.random().toString(36).substring(2, 10);

    // Attach requestId for downstream use
    (req as any).requestId = requestId;

    res.on("finish", () => {
        const durationMs = Math.round(performance.now() - start);
        const meta: Record<string, unknown> = {
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
            userAgent: req.get("user-agent")?.substring(0, 80),
        };

        // Log at appropriate level based on status code
        if (res.statusCode >= 500) {
            logger.error("Request failed", meta);
        } else if (res.statusCode >= 400) {
            logger.warn("Request error", meta);
        } else if (durationMs > 5000) {
            logger.warn("Slow request", meta);
        } else {
            logger.info("Request completed", meta);
        }
    });

    next();
}

// ─── Performance Monitor ────────────────────────────────────────────────────

interface PerfSnapshot {
    uptimeSeconds: number;
    memoryMB: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
    };
    timestamp: string;
}

export function getPerformanceSnapshot(): PerfSnapshot {
    const mem = process.memoryUsage();
    return {
        uptimeSeconds: Math.round(process.uptime()),
        memoryMB: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
    };
}

/**
 * Start periodic performance monitoring (logs every N minutes).
 */
export function startPerfMonitor(intervalMinutes: number = 5) {
    setInterval(() => {
        const snap = getPerformanceSnapshot();
        logger.info("Performance snapshot", snap as unknown as Record<string, unknown>);
    }, intervalMinutes * 60 * 1000);

    logger.info("Performance monitor started", { intervalMinutes });
}
