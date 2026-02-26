/**
 * WebSocket Real-Time Notification Hub (P3-3)
 *
 * Provides real-time push notifications to connected clients
 * via Server-Sent Events (SSE) — no extra dependencies needed.
 *
 * Usage:
 *   import { registerSSE } from "./sse-notifications";
 *   registerSSE(app);    // in server entry
 *
 *   import { pushNotification } from "./sse-notifications";
 *   pushNotification(userId, { type: "info", title: "...", body: "..." });
 */

import type { Express, Request, Response } from "express";

interface SSEClient {
    userId: number;
    res: Response;
}

const clients: SSEClient[] = [];

// ─── SSE Endpoint Registration ──────────────────────────────────────────────

export function registerSSE(app: Express) {
    app.get("/api/notifications/stream", (req: Request, res: Response) => {
        // Require auth (session cookie check)
        const userId = (req as any).session?.userId;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Set SSE headers
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // Disable nginx buffering
        });

        // Send initial connection event
        res.write(`event: connected\ndata: ${JSON.stringify({ userId, time: Date.now() })}\n\n`);

        // Register client
        const client: SSEClient = { userId, res };
        clients.push(client);

        // Heartbeat every 30s to keep connection alive
        const heartbeat = setInterval(() => {
            res.write(`: heartbeat ${Date.now()}\n\n`);
        }, 30000);

        // Cleanup on disconnect
        req.on("close", () => {
            clearInterval(heartbeat);
            const idx = clients.indexOf(client);
            if (idx >= 0) clients.splice(idx, 1);
        });
    });
}

// ─── Push Notification ──────────────────────────────────────────────────────

export interface PushPayload {
    type: "info" | "success" | "warning" | "error";
    title: string;
    body?: string;
    link?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Push a real-time notification to a specific user.
 * If the user has no active SSE connection, it's a no-op
 * (notification is still persisted via the normal notification system).
 */
export function pushNotification(userId: number, payload: PushPayload): void {
    const event = JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
    });

    clients
        .filter((c) => c.userId === userId)
        .forEach((c) => {
            try {
                c.res.write(`event: notification\ndata: ${event}\n\n`);
            } catch {
                // Client disconnected, will be cleaned up
            }
        });
}

/**
 * Broadcast a notification to ALL connected clients.
 */
export function broadcastNotification(payload: PushPayload): void {
    const event = JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
    });

    clients.forEach((c) => {
        try {
            c.res.write(`event: notification\ndata: ${event}\n\n`);
        } catch {
            // noop
        }
    });
}

/**
 * Get the count of currently connected clients.
 */
export function getConnectedCount(): number {
    return clients.length;
}
