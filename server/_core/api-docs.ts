/**
 * API Documentation Endpoint (P3-5)
 *
 * Serves auto-generated API documentation for the tRPC router.
 * Since tRPC doesn't natively produce OpenAPI, we provide a
 * structured JSON schema describing all available procedures.
 *
 * GET /api/docs → JSON API reference
 * GET /api/docs/html → HTML documentation page
 */

import type { Express } from "express";
import { appRouter } from "../routers";

interface ProcedureDoc {
    name: string;
    type: "query" | "mutation" | "subscription";
    path: string;
    description?: string;
}

function extractProcedures(router: any, prefix = ""): ProcedureDoc[] {
    const docs: ProcedureDoc[] = [];

    for (const [key, value] of Object.entries(router._def.procedures || {})) {
        const proc = value as any;
        const procType = proc._def?.type || proc._type || "query";

        docs.push({
            name: key,
            type: procType as ProcedureDoc["type"],
            path: prefix ? `${prefix}.${key}` : key,
        });
    }

    // Check for nested routers
    for (const [key, value] of Object.entries(router._def.record || {})) {
        const sub = value as any;
        if (sub._def?.procedures || sub._def?.record) {
            docs.push(...extractProcedures(sub, prefix ? `${prefix}.${key}` : key));
        } else if (sub._def) {
            const procType = sub._def.type || sub._def.query ? "query" : "mutation";
            docs.push({
                name: key,
                type: procType as ProcedureDoc["type"],
                path: prefix ? `${prefix}.${key}` : key,
            });
        }
    }

    return docs;
}

export function registerApiDocs(app: Express) {
    // JSON schema endpoint
    app.get("/api/docs", (_req, res) => {
        const procedures = extractProcedures(appRouter);

        res.json({
            name: "MIYAR API",
            version: "2.0",
            protocol: "tRPC v11",
            baseUrl: "/api/trpc",
            totalProcedures: procedures.length,
            procedures: procedures.sort((a, b) => a.path.localeCompare(b.path)),
            authentication: {
                method: "Cookie-based session (Google OAuth)",
                header: "Set-Cookie",
                notes: "Sessions are managed automatically via the OAuth flow.",
            },
            rateLimits: {
                standard: "No limit on regular queries/mutations",
                heavy: "5 requests per minute per user (runMonteCarlo, computeTwin, calculateHealth)",
            },
            generatedAt: new Date().toISOString(),
        });
    });

    // HTML documentation page
    app.get("/api/docs/html", (_req, res) => {
        const procedures = extractProcedures(appRouter);
        const queries = procedures.filter((p) => p.type === "query");
        const mutations = procedures.filter((p) => p.type === "mutation");

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MIYAR API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1117; color: #e4e4e7; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #60d5db; }
    h2 { font-size: 1.3rem; margin: 2rem 0 1rem; color: #a1a1aa; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
    .badge { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-right: 8px; }
    .badge-query { background: #1a3a5c; color: #60a5fa; }
    .badge-mutation { background: #3a1a3c; color: #c084fc; }
    .proc { padding: 0.75rem 1rem; border: 1px solid #27272a; border-radius: 8px; margin-bottom: 0.5rem; transition: border-color 0.2s; }
    .proc:hover { border-color: #3f3f46; }
    .proc-path { font-family: monospace; font-size: 0.9rem; color: #e4e4e7; }
    .meta { color: #71717a; font-size: 0.8rem; margin-top: 1rem; }
    .stats { display: flex; gap: 1.5rem; margin: 1rem 0; }
    .stat { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 1rem; flex: 1; text-align: center; }
    .stat-num { font-size: 1.5rem; font-weight: 700; color: #60d5db; }
    .stat-label { font-size: 0.75rem; color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>MIYAR API</h1>
    <p class="meta">tRPC v11 &bull; Base URL: <code>/api/trpc</code></p>

    <div class="stats">
      <div class="stat"><div class="stat-num">${procedures.length}</div><div class="stat-label">Total Endpoints</div></div>
      <div class="stat"><div class="stat-num">${queries.length}</div><div class="stat-label">Queries</div></div>
      <div class="stat"><div class="stat-num">${mutations.length}</div><div class="stat-label">Mutations</div></div>
    </div>

    <h2>Queries (${queries.length})</h2>
    ${queries.map((p) => `<div class="proc"><span class="badge badge-query">GET</span><span class="proc-path">${p.path}</span></div>`).join("\n")}

    <h2>Mutations (${mutations.length})</h2>
    ${mutations.map((p) => `<div class="proc"><span class="badge badge-mutation">POST</span><span class="proc-path">${p.path}</span></div>`).join("\n")}

    <p class="meta" style="margin-top:2rem">Generated at ${new Date().toISOString()}</p>
  </div>
</body>
</html>`);
    });
}
