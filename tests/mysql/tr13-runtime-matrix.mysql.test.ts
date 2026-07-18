import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../server/_core/context";
import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { PUBLIC_SHARE_HEADERS } from "../../server/_core/public-share-headers";
import { resetPublicRateLimitForTests } from "../../server/_core/rate-limit";

// The application factories import the normal serve bootstrap. This Vitest-only
// replacement keeps the test under the explicitly initialized integration-test
// database operation without adding a production fixture switch.
vi.mock("../../server/_core/runtime-bootstrap", () => ({
  serveDatabaseDecision: { profile: "test", trustedDeployment: false },
}));

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("TR-13 runtime matrix requires guarded DATABASE_URL");
}
const pool = mysql.createPool(connectionString);

const ID = {
  org: 14_001,
  admin: 14_101,
  project: 14_301,
  model: 14_401,
  score: 14_501,
  evidence: 14_601,
  materialLibrary: 14_702,
  affordableFloor: 14_703,
  affordableWall: 14_704,
  affordableCeiling: 14_705,
  benchmark: 14_801,
  logic: 14_901,
} as const;

const ACTIVE_TOKEN = "tr13-runtime-active-token-000001";
const EXPIRED_TOKEN = "tr13-runtime-expired-token-0001";
const INVALID_TOKEN = "tr13-runtime-invalid-token-0001";
const NEVER_ISSUED_TOKEN = "tr13-runtime-never-issued-00001";
const EXPECTED_RECONCILIATION = {
  fitOutAreaM2: 20,
  roomAreaM2: 20,
  allocationPct: 100,
  lockedAllocationCount: 1,
  manualRoomCount: 2,
  costAed: { min: 2494.7, mid: 3143.38, max: 3792.05 },
} as const;

const adminUser: NonNullable<TrpcContext["user"]> = {
  id: ID.admin,
  openId: `tr13-runtime-${ID.admin}`,
  password: null,
  name: "TR13 Runtime Admin",
  email: "tr13-runtime-admin@example.invalid",
  loginMethod: "tr13-synthetic",
  role: "user",
  orgId: ID.org,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
};

type RuntimeKind = "node" | "serverless";
type JsonRecord = Record<string, any>;
type NodeFactory =
  typeof import("../../server/_core/index").createNodeApplication;
type ServerlessFactory =
  typeof import("../../server/serverless").createServerlessApplication;

let createNodeApplication: NodeFactory;
let createServerlessApplication: ServerlessFactory;

const servers: Server[] = [];

function timeoutAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref?.();
  });
}

async function startRuntime(kind: RuntimeKind): Promise<string> {
  const contextFactory = ({
    req,
    res,
  }: CreateExpressContextOptions): TrpcContext => ({
    req,
    res,
    user: req.get("x-tr13-runtime-auth") === "admin" ? adminUser : null,
  });
  const created =
    kind === "node"
      ? createNodeApplication({ contextFactory })
      : {
          app: createServerlessApplication({ contextFactory }),
          server: undefined,
        };
  const server = created.server ?? createServer(created.app);
  servers.push(server);
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    }),
    timeoutAfter(5_000, `${kind} runtime did not bind within 5 seconds`),
  ]);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error(`${kind} runtime did not expose a TCP address`);
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeRuntime(server: Server): Promise<void> {
  server.closeIdleConnections?.();
  const force = setTimeout(() => server.closeAllConnections?.(), 1_000);
  force.unref?.();
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      }),
      timeoutAfter(
        5_000,
        "TR-13 runtime server did not close within 5 seconds"
      ),
    ]);
  } finally {
    clearTimeout(force);
  }
}

function trpcQuery(pathname: string, input: unknown): string {
  return `/api/trpc/${pathname}?input=${encodeURIComponent(
    JSON.stringify({ json: input })
  )}`;
}

async function request(
  baseUrl: string,
  pathname: string,
  input: unknown,
  options: { mutation?: boolean; authenticated?: boolean } = {}
): Promise<{ response: Response; body: JsonRecord }> {
  const headers: Record<string, string> = {};
  if (options.authenticated) headers["x-tr13-runtime-auth"] = "admin";
  const response = options.mutation
    ? await fetch(`${baseUrl}/api/trpc/${pathname}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
        signal: AbortSignal.timeout(20_000),
      })
    : await fetch(`${baseUrl}${trpcQuery(pathname, input)}`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
  return { response, body: (await response.json()) as JsonRecord };
}

function resultJson(body: JsonRecord): any {
  const value = body?.result?.data?.json;
  if (value === undefined) {
    throw new Error("Expected a successful tRPC JSON result");
  }
  return value;
}

function expectPrivacyHeaders(response: Response): void {
  for (const [name, value] of Object.entries(PUBLIC_SHARE_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

function reportSnapshot(html: string) {
  const renderInputFingerprint =
    /Render-input fingerprint:<\/span>\s*([a-f0-9]{64})/i.exec(html)?.[1];
  expect(renderInputFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(html).toContain("Workflow, Space & MQI Reconciliation");
  expect(html).toContain("0.00 m² · PASS");
  expect(html).toContain("2 / 2 / 2");
  expect(html).toContain("6 / 6");
  expect(html).toMatch(/100\.00%<\/td>[\s\S]{0,300}>PASS<\/td>/);
  expect(html).toContain("AED 2,494.70");
  expect(html).toContain("AED 3,143.38");
  expect(html).toContain("AED 3,792.05");
  expect(html).not.toMatch(/share[_-]?token|tr13-runtime-active-token/i);
  return { renderInputFingerprint, reconciliation: EXPECTED_RECONCILIATION };
}

async function clearOwnedFixture(): Promise<void> {
  await pool.query("delete from audit_logs where entityId = ?", [ID.project]);
  await pool.query("delete from report_instances where projectId = ?", [
    ID.project,
  ]);
  await pool.query("delete from ai_design_briefs where project_id = ?", [
    ID.project,
  ]);
  await pool.query("delete from material_allocations where projectId = ?", [
    ID.project,
  ]);
  await pool.query("delete from space_program_rooms where projectId = ?", [
    ID.project,
  ]);
  await pool.query("delete from space_recommendations where project_id = ?", [
    ID.project,
  ]);
  await pool.query("delete from evidence_records where projectId = ?", [
    ID.project,
  ]);
  await pool.query("delete from score_matrices where projectId = ?", [
    ID.project,
  ]);
  await pool.query("delete from projects where id = ?", [ID.project]);
  await pool.query("delete from organization_members where orgId = ?", [
    ID.org,
  ]);
  await pool.query("delete from users where id = ?", [ID.admin]);
  await pool.query("delete from organizations where id = ?", [ID.org]);
  await pool.query("delete from benchmark_data where benchmarkVersionId = ?", [
    ID.benchmark,
  ]);
  await pool.query("delete from logic_weights where logicVersionId = ?", [
    ID.logic,
  ]);
  await pool.query("delete from logic_versions where id = ?", [ID.logic]);
  await pool.query("delete from benchmark_versions where id = ?", [
    ID.benchmark,
  ]);
  await pool.query("delete from model_versions where id = ?", [ID.model]);
  await pool.query("delete from material_library where id in (?, ?, ?, ?)", [
    ID.materialLibrary,
    ID.affordableFloor,
    ID.affordableWall,
    ID.affordableCeiling,
  ]);
}

async function seedBaseFixture(): Promise<void> {
  await clearOwnedFixture();
  await pool.query("update model_versions set isActive = false");
  await pool.query(
    "insert into organizations (id, name, slug) values (?, 'TR-13 Runtime Matrix', 'tr13-runtime-matrix')",
    [ID.org]
  );
  await pool.query(
    "insert into users (id, openId, name, email, loginMethod, role, orgId) values (?, ?, 'TR13 Runtime Admin', 'tr13-runtime-admin@example.invalid', 'tr13-synthetic', 'user', ?)",
    [ID.admin, adminUser.openId, ID.org]
  );
  await pool.query(
    "insert into organization_members (orgId, userId, role) values (?, ?, 'admin')",
    [ID.org, ID.admin]
  );
  await pool.query(
    `insert into model_versions
      (id, versionTag, dimensionWeights, variableWeights, penaltyConfig, isActive, createdBy)
     values (?, 'tr13-runtime-model-v1', '{"sa":0.25,"ff":0.2,"mp":0.2,"ds":0.2,"er":0.15}', '{}', '[]', true, ?)`,
    [ID.model, ID.admin]
  );
  await pool.query(
    `insert into benchmark_versions
      (id, versionTag, description, status, publishedAt, publishedBy, recordCount, createdBy)
     values (?, 'tr13-runtime-benchmark-v1', 'Synthetic runtime matrix benchmark', 'published', '2026-02-01', ?, 1, ?)`,
    [ID.benchmark, ID.admin, ID.admin]
  );
  await pool.query(
    `insert into logic_versions (id, name, status, createdBy, publishedAt, notes)
     values (?, 'tr13-runtime-logic-v1', 'published', ?, '2026-02-01', 'Synthetic runtime matrix logic')`,
    [ID.logic, ID.admin]
  );
  await pool.query(
    `insert into logic_weights (logicVersionId, dimension, weight) values
      (?, 'sa', 0.25), (?, 'ff', 0.20), (?, 'mp', 0.20), (?, 'ds', 0.20), (?, 'er', 0.15)`,
    [ID.logic, ID.logic, ID.logic, ID.logic, ID.logic]
  );
  await pool.query(
    `insert into benchmark_data
      (typology, location, marketTier, materialLevel, roomType, costPerSqftLow, costPerSqftMid, costPerSqftHigh, dataYear, benchmarkVersionId)
     values ('Residential', 'Prime', 'Upper-mid', 3, 'General', 300, 400, 500, 2026, ?)`,
    [ID.benchmark]
  );
  await pool.query(
    `insert into projects
      (id, userId, orgId, name, description, status, ctx01Typology, ctx02Scale, ctx03Gfa, totalFitoutArea, ctx04Location, ctx05Horizon, city, mkt01Tier, fin01BudgetCap, des01Style, inputProvenance, modelVersionId, benchmarkVersionId)
     values (?, ?, ?, 'TR-13 Runtime Residence', 'Synthetic only', 'evaluated', 'Residential', 'Medium', 100, 20, 'Prime', '12-24m', 'Dubai', 'Upper-mid', 1000, 'Modern', '{"ctx01Typology":"explicit","ctx03Gfa":"explicit","fin01BudgetCap":"explicit"}', ?, ?)`,
    [ID.project, ID.admin, ID.org, ID.model, ID.benchmark]
  );
  await pool.query(
    `insert into score_matrices
      (id, projectId, modelVersionId, saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore, decisionStatus, dimensionWeights, variableContributions, inputSnapshot)
     values (?, ?, ?, 80, 70, 75, 78, 72, 75, 25, 75, 90, 'validated', '{"sa":0.25,"ff":0.2,"mp":0.2,"ds":0.2,"er":0.15}', '{}', '{}')`,
    [ID.score, ID.project, ID.model]
  );
  await pool.query(
    `insert into evidence_records
      (id, recordId, projectId, orgId, category, itemName, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, confidentiality, corpusScope)
     values (?, 'TR13-RUNTIME-EVIDENCE-001', ?, ?, 'floors', 'Runtime synthetic stone evidence', 'sqm', 'https://example.invalid/tr13-runtime-evidence', '2026-02-01', 'A', 90, 'internal', 'organization')`,
    [ID.evidence, ID.project, ID.org]
  );
  await pool.query(
    `insert into material_library
      (id, category, tier, style, product_code, product_name, brand, supplier_name, unit_label, price_aed_min, price_aed_max, is_active)
     values
      (?, 'flooring', 'premium', 'modern', 'TR13-RUNTIME-STONE', 'TR-13 Runtime Stone', 'Synthetic', 'Synthetic Supplier', 'sqm', 100, 150, true),
      (?, 'flooring', 'affordable', 'modern', 'TR13-RUNTIME-FLOOR-C', 'TR-13 Runtime Grade C Floor', 'Synthetic', 'Synthetic Supplier', 'sqm', 50, 80, true),
      (?, 'wall_paint', 'affordable', 'modern', 'TR13-RUNTIME-WALL-C', 'TR-13 Runtime Grade C Wall', 'Synthetic', 'Synthetic Supplier', 'sqm', 10, 15, true),
      (?, 'ceiling', 'affordable', 'modern', 'TR13-RUNTIME-CEILING-C', 'TR-13 Runtime Grade C Ceiling', 'Synthetic', 'Synthetic Supplier', 'sqm', 20, 30, true)`,
    [ID.materialLibrary, ID.affordableFloor, ID.affordableWall, ID.affordableCeiling]
  );
  await pool.query(
    `insert into space_program_rooms
      (projectId, organizationId, roomCode, roomName, category, sqm, source, isFitOut, fitOutOverridden, finishGrade, priority, budgetPct, sortOrder, blockName, blockTypology)
     values
      (?, ?, 'LVG', 'Runtime Living', 'living', 10, 'user_manual', true, false, 'C', 'high', 0.5, 0, 'Main', 'residential'),
      (?, ?, 'MBR', 'Runtime Bedroom', 'bedroom', 10, 'user_manual', true, false, 'C', 'high', 0.5, 1, 'Main', 'residential')`,
    [ID.project, ID.org, ID.project, ID.org]
  );
  await pool.query(
    `insert into material_allocations
      (projectId, organizationId, roomId, roomName, element, materialLibraryId, materialName, allocationPct, surfaceAreaM2, unitCostMin, unitCostMax, totalCostMin, totalCostMax, aiReasoning, isLocked)
     values
      (?, ?, 'LVG', 'Runtime Living', 'floor', ?, 'TR-13 Runtime Stone', 100, 10, 100, 150, 1000, 1500, 'Synthetic locked allocation', true),
      (?, ?, 'LVG', 'Runtime Living', 'walls', ?, 'TR-13 Runtime Grade C Wall', 100, 30.94, 10, 15, 309.40, 464.10, 'Synthetic Grade C allocation', false),
      (?, ?, 'LVG', 'Runtime Living', 'ceiling', ?, 'TR-13 Runtime Grade C Ceiling', 100, 9.5, 20, 30, 190, 285, 'Synthetic Grade C allocation', false),
      (?, ?, 'MBR', 'Runtime Bedroom', 'floor', ?, 'TR-13 Runtime Grade C Floor', 100, 10, 50, 80, 500, 800, 'Synthetic Grade C allocation', false),
      (?, ?, 'MBR', 'Runtime Bedroom', 'walls', ?, 'TR-13 Runtime Grade C Wall', 100, 30.53, 10, 15, 305.30, 457.95, 'Synthetic Grade C allocation', false),
      (?, ?, 'MBR', 'Runtime Bedroom', 'ceiling', ?, 'TR-13 Runtime Grade C Ceiling', 100, 9.5, 20, 30, 190, 285, 'Synthetic Grade C allocation', false)`,
    [
      ID.project, ID.org, ID.materialLibrary,
      ID.project, ID.org, ID.affordableWall,
      ID.project, ID.org, ID.affordableCeiling,
      ID.project, ID.org, ID.affordableFloor,
      ID.project, ID.org, ID.affordableWall,
      ID.project, ID.org, ID.affordableCeiling,
    ]
  );
  await pool.query(
    `insert into space_recommendations
      (project_id, org_id, room_id, room_name, sqm, style_direction, color_scheme, material_package, budget_allocation, budget_breakdown, ai_rationale, special_notes, alternatives)
     values (?, ?, 'LVG', 'Runtime Living', 10, 'Synthetic Modern', 'Warm neutral', '[]', 10000, '[]', 'Synthetic recommendation', '[]', '[]')`,
    [ID.project, ID.org]
  );
}

async function resetProfileState(): Promise<void> {
  await pool.query("delete from audit_logs where entityId = ?", [ID.project]);
  await pool.query("delete from report_instances where projectId = ?", [
    ID.project,
  ]);
  await pool.query("delete from ai_design_briefs where project_id = ?", [
    ID.project,
  ]);
  await pool.query(
    `insert into ai_design_briefs
      (project_id, org_id, brief_data, version, share_token, share_expires_at)
     values
      (?, ?, '{"executiveSummary":"Runtime active public brief","designDirection":{"overallStyle":"Modern"}}', '1.0', ?, '2037-01-01'),
      (?, ?, '{"executiveSummary":"Runtime expired public brief","designDirection":{"overallStyle":"Modern"}}', '1.0', ?, '2020-01-01')`,
    [ID.project, ID.org, ACTIVE_TOKEN, ID.project, ID.org, EXPIRED_TOKEN]
  );
  const [reportRows] = await pool.query(
    "select id from report_instances where projectId = ?",
    [ID.project]
  );
  const [briefRows] = await pool.query(
    "select share_token from ai_design_briefs where project_id = ? order by share_token",
    [ID.project]
  );
  expect(reportRows).toHaveLength(0);
  expect(briefRows).toHaveLength(2);
  resetPublicRateLimitForTests();
}

async function exerciseRuntime(kind: RuntimeKind) {
  await resetProfileState();
  const baseUrl = await startRuntime(kind);
  const server = servers.at(-1)!;
  try {
    const generated = await request(
      baseUrl,
      "project.generateReport",
      { projectId: ID.project, reportType: "full_report", locale: "en" },
      { mutation: true, authenticated: true }
    );
    expect(generated.response.status).toBe(200);
    expect(resultJson(generated.body)).toMatchObject({
      projectId: ID.project,
      projectName: "TR-13 Runtime Residence",
    });

    const reports = await request(
      baseUrl,
      "project.listReports",
      { projectId: ID.project },
      { authenticated: true }
    );
    expect(reports.response.status).toBe(200);
    const reportRows = resultJson(reports.body);
    expect(reportRows).toHaveLength(1);
    expect(reportRows[0]).toMatchObject({
      projectId: ID.project,
      reportType: "full_report",
      benchmarkVersionId: ID.benchmark,
      modelVersionId: ID.model,
    });
    const html = reportRows[0]?.content?.html;
    expect(typeof html).toBe("string");
    const report = reportSnapshot(html);

    const active = await request(baseUrl, "design.resolveShareLink", {
      token: ACTIVE_TOKEN,
      locale: "en",
    });
    expect(active.response.status).toBe(200);
    expectPrivacyHeaders(active.response);
    const activeData = resultJson(active.body);
    expect(activeData).toMatchObject({
      projectName: "TR-13 Runtime Residence",
      readOnly: true,
      briefVersion: "1.0",
    });
    const activeSerialized = JSON.stringify(active.body);
    expect(activeSerialized).not.toContain(ACTIVE_TOKEN);
    expect(activeSerialized).not.toMatch(
      /shareToken|storageKey|fileUrl|orgId|userId|projectId/
    );

    const concealed: Array<{
      label: string;
      status: number;
      body: JsonRecord;
      headers: Record<string, string | null>;
    }> = [];
    for (const [label, token] of [
      ["invalid", INVALID_TOKEN],
      ["expired", EXPIRED_TOKEN],
      ["never-issued", NEVER_ISSUED_TOKEN],
    ] as const) {
      const result = await request(baseUrl, "design.resolveShareLink", {
        token,
        locale: "en",
      });
      expectPrivacyHeaders(result.response);
      concealed.push({
        label,
        status: result.response.status,
        body: result.body,
        headers: Object.fromEntries(
          Object.keys(PUBLIC_SHARE_HEADERS).map(name => [
            name,
            result.response.headers.get(name),
          ])
        ),
      });
    }

    const revoke = await request(
      baseUrl,
      "design.revokeShareLinks",
      { projectId: ID.project },
      { mutation: true, authenticated: true }
    );
    expect(revoke.response.status).toBe(200);
    expect(resultJson(revoke.body)).toEqual({ revokedCount: 2, active: false });
    const revoked = await request(baseUrl, "design.resolveShareLink", {
      token: ACTIVE_TOKEN,
      locale: "en",
    });
    expectPrivacyHeaders(revoked.response);
    concealed.push({
      label: "revoked",
      status: revoked.response.status,
      body: revoked.body,
      headers: Object.fromEntries(
        Object.keys(PUBLIC_SHARE_HEADERS).map(name => [
          name,
          revoked.response.headers.get(name),
        ])
      ),
    });

    expect(concealed.map(value => value.status)).toEqual([404, 404, 404, 404]);
    for (const value of concealed.slice(1)) {
      expect(value.body).toEqual(concealed[0]?.body);
    }
    expect(
      new Set(concealed.map(value => JSON.stringify(value.headers))).size
    ).toBe(1);

    return {
      kind,
      report,
      activePublicContractFingerprint: createHash("sha256")
        .update(JSON.stringify(activeData))
        .digest("hex"),
      concealedResponseFingerprint: createHash("sha256")
        .update(JSON.stringify(concealed[0]?.body))
        .digest("hex"),
      privacyHeaders: concealed[0]?.headers,
      security: {
        activeShareReadOnlyAndMinimized: true,
        invalidExpiredRevokedNeverIssuedConcealed: true,
        projectWideRevocationThroughActualRouter: true,
      },
    };
  } finally {
    servers.splice(servers.indexOf(server), 1);
    await closeRuntime(server);
  }
}

beforeAll(async () => {
  mkdirSync(path.join(process.cwd(), "tmp", "tr13-workflow-certification"), {
    recursive: true,
  });
  // Initialize the real appRouter under the deployed (non-development) error
  // contract so concealment compares the actual public wire shape, then restore
  // NODE_ENV=test before loading the Node entry point (which suppresses its
  // standalone startServer side effect).
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await import("../../server/routers");
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
  ({ createNodeApplication } = await import("../../server/_core/index"));
  ({ createServerlessApplication } = await import("../../server/serverless"));
  await seedBaseFixture();
});

afterAll(async () => {
  await Promise.all(servers.splice(0).map(closeRuntime));
  await pool.end();
});

describe("TR-13 real appRouter Node/serverless runtime matrix", () => {
  it("certifies actual stored-report and public-share paths with reset state", async () => {
    const node = await exerciseRuntime("node");
    const serverless = await exerciseRuntime("serverless");

    expect(node.report).toEqual(serverless.report);
    expect(node.activePublicContractFingerprint).toBe(
      serverless.activePublicContractFingerprint
    );
    expect(node.concealedResponseFingerprint).toBe(
      serverless.concealedResponseFingerprint
    );
    expect(node.privacyHeaders).toEqual(serverless.privacyHeaders);

    writeFileSync(
      path.join(
        process.cwd(),
        "tmp",
        "tr13-workflow-certification",
        "runtime-matrix-evidence.json"
      ),
      `${JSON.stringify(
        {
          status: "PASS",
          syntheticOnly: true,
          actualAppRouter: true,
          fixtureResetBeforeEachProfile: true,
          profiles: {
            node: {
              reportRenderInputFingerprint: node.report.renderInputFingerprint,
              reconciliation: node.report.reconciliation,
              activePublicContractFingerprint:
                node.activePublicContractFingerprint,
              concealedResponseFingerprint: node.concealedResponseFingerprint,
              privacyHeaders: node.privacyHeaders,
              security: node.security,
            },
            serverless: {
              reportRenderInputFingerprint:
                serverless.report.renderInputFingerprint,
              reconciliation: serverless.report.reconciliation,
              activePublicContractFingerprint:
                serverless.activePublicContractFingerprint,
              concealedResponseFingerprint:
                serverless.concealedResponseFingerprint,
              privacyHeaders: serverless.privacyHeaders,
              security: serverless.security,
            },
          },
          parity: {
            reportFingerprint: true,
            reconciliation: true,
            activePublicContract: true,
            concealed404Body: true,
            privacyHeaders: true,
          },
          limitations: [
            "The runtime matrix injects a synthetic authenticated context through the existing application-factory test seam; browser login is certified separately on Node.",
            "A Vitest-only integration-safety shim replaces automatic serve bootstrap; the real appRouter, application factories, middleware, and route handlers remain in use.",
            "Node-only application-shell, SSE, logging, documentation, and scheduler behavior is recorded but is not asserted as serverless parity.",
          ],
        },
        null,
        2
      )}\n`
    );
  }, 60_000);
});
