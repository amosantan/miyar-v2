import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";
import {
  TR13_BRIEF_CONTRACTS,
  TR13_WORKFLOW_FIXTURE,
  TR13_WORKFLOW_FIXTURE_VERSION,
} from "../../tests/fixtures/workflows/tr13-workflow-fixtures";
import {
  prepareSyntheticInlineReportPreview,
  seedSyntheticAdvisorSharePrerequisite,
} from "./support";

const users = {
  admin: { email: "tr13-admin@example.invalid", password: "tr13-local-admin" },
  member: {
    email: "tr13-member@example.invalid",
    password: "tr13-local-member",
  },
  viewer: {
    email: "tr13-viewer@example.invalid",
    password: "tr13-local-viewer",
  },
  foreign: {
    email: "tr13-foreign@example.invalid",
    password: "tr13-local-foreign",
  },
} as const;
const workflowProjectName = "TR-13 Browser Synthetic Project";
let workflowProjectId: number | undefined;
const diagnostics = new WeakMap<
  Page,
  {
    consoleErrors: string[];
    pageErrors: string[];
    requestFailures: string[];
    unexpectedHttpErrors: string[];
    expectingConcealed404: boolean;
    expectedConcealedConsoleErrors: number;
    expectedConcealedHttpErrors: number;
    expectingSessionTransition: boolean;
    expectedSessionTransitionErrors: number;
    expectedSessionTransitionRequestFailures: number;
  }
>();
const browserEvidencePath = path.join(
  process.cwd(),
  "tmp",
  "tr13-workflow-certification",
  "browser-evidence.json"
);

function writeBrowserEvidence(update: Record<string, unknown>) {
  const current = existsSync(browserEvidencePath)
    ? (JSON.parse(readFileSync(browserEvidencePath, "utf8")) as Record<
        string,
        unknown
      >)
    : { syntheticOnly: true };
  writeFileSync(
    browserEvidencePath,
    `${JSON.stringify({ ...current, ...update }, null, 2)}\n`
  );
}

async function login(
  page: import("@playwright/test").Page,
  user: (typeof users)[keyof typeof users]
) {
  const state = diagnostics.get(page);
  if (state) state.expectingSessionTransition = true;
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  if (state) state.expectingSessionTransition = false;
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const onboarding = page.getByRole("dialog", {
    name: /What moved in MIYAR|Start with MIYAR/,
  });
  await onboarding
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);
  if (await onboarding.isVisible()) {
    await onboarding.getByRole("button", { name: "Dismiss" }).click();
    await expect(onboarding).toBeHidden();
  }
}

function isConcealableResponse(response: Response): boolean {
  if (response.status() !== 404) return false;
  const url = response.url();
  return [
    "design.resolveShareLink",
    "project.get",
    "project.getScores",
    "designAdvisor.getDesignBrief",
    "designAdvisor.getRecommendations",
    "design.getDesignTrends",
    "design.getProjectDldBenchmark",
    "design.getSpaceBenchmark",
    "salesPremium.getValueAddBridge",
    "salesPremium.getBrandEquityForecast",
  ].some(procedure => url.includes(procedure));
}

async function withinExpectedConcealment(
  page: Page,
  action: () => Promise<void>
): Promise<void> {
  const state = diagnostics.get(page);
  if (!state) throw new Error("TR-13 diagnostics are not initialized");
  if (state.expectingConcealed404) {
    throw new Error("Nested concealed-404 windows are not allowed");
  }
  state.expectingConcealed404 = true;
  try {
    await action();
  } finally {
    state.expectingConcealed404 = false;
  }
}

function requireWorkflowProjectId(): number {
  if (!Number.isSafeInteger(workflowProjectId)) {
    throw new Error(
      "The serial TR-13 browser journey has not created its project"
    );
  }
  return workflowProjectId!;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1
    )
  ).toBe(true);
}

function hasLoadedClientModule(urls: string[], moduleName: string): boolean {
  return urls.some(url =>
    new RegExp(`/${moduleName}(?:\\.tsx?|-)[^/]*$`).test(new URL(url).pathname)
  );
}

async function trpcRequest<T>(
  page: Page,
  procedure: string,
  input: Record<string, unknown>,
  method: "GET" | "POST"
): Promise<T> {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await page.request.fetch(
    method === "GET"
      ? `/api/trpc/${procedure}?input=${encoded}`
      : `/api/trpc/${procedure}`,
    method === "GET"
      ? { method }
      : {
          method,
          headers: { "content-type": "application/json" },
          data: { json: input },
        }
  );
  expect(response.ok(), `${procedure} must succeed`).toBe(true);
  const payload = (await response.json()) as {
    result: { data: { json: T } };
  };
  return payload.result.data.json;
}

test.describe("TR-13 critical workflow harness", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.route("https://fonts.googleapis.com/**", route =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" })
    );
    await page.route("https://fonts.gstatic.com/**", route =>
      route.fulfill({ status: 200, contentType: "font/woff2", body: "" })
    );
    const state = {
      consoleErrors: [] as string[],
      pageErrors: [] as string[],
      requestFailures: [] as string[],
      unexpectedHttpErrors: [] as string[],
      expectingConcealed404: false,
      expectedConcealedConsoleErrors: 0,
      expectedConcealedHttpErrors: 0,
      expectingSessionTransition: false,
      expectedSessionTransitionErrors: 0,
      expectedSessionTransitionRequestFailures: 0,
    };
    diagnostics.set(page, state);
    page.on("console", message => {
      if (message.type() !== "error") return;
      const text = message.text();
      const expectedConcealment =
        state.expectingConcealed404 &&
        (text ===
          "Failed to load resource: the server responded with a status of 404 (Not Found)" ||
          (/^\[API Query Error\] TRPCClientError:/.test(text) &&
            /not found|unavailable|expired/i.test(text)));
      if (expectedConcealment) state.expectedConcealedConsoleErrors += 1;
      else if (
        state.expectingSessionTransition &&
        /^\[API Query Error\] TRPCClientError: Failed to fetch/.test(text)
      )
        state.expectedSessionTransitionErrors += 1;
      else state.consoleErrors.push(text);
    });
    page.on("pageerror", error => state.pageErrors.push(error.message));
    page.on("requestfailed", request => {
      if (
        state.expectingSessionTransition &&
        request.url().includes("/api/trpc/auth.me")
      )
        state.expectedSessionTransitionRequestFailures += 1;
      else state.requestFailures.push(`${request.method()} ${request.url()}`);
    });
    page.on("response", response => {
      if (response.status() < 400) return;
      if (state.expectingConcealed404 && isConcealableResponse(response)) {
        state.expectedConcealedHttpErrors += 1;
      } else {
        state.unexpectedHttpErrors.push(
          `${response.status()} ${response.request().method()} ${response.url()}`
        );
      }
    });
  });

  test.afterEach(async ({ page }) => {
    const state = diagnostics.get(page);
    expect(state?.consoleErrors ?? []).toEqual([]);
    expect(state?.pageErrors ?? []).toEqual([]);
    expect(state?.requestFailures ?? []).toEqual([]);
    expect(state?.unexpectedHttpErrors ?? []).toEqual([]);
    writeBrowserEvidence({
      unexpectedConsoleErrors: 0,
      unexpectedPageErrors: 0,
      unexpectedRequestFailures: 0,
      unexpectedHttpErrors: 0,
      expectedConcealedConsoleErrors:
        state?.expectedConcealedConsoleErrors ?? 0,
      expectedConcealedHttpErrors: state?.expectedConcealedHttpErrors ?? 0,
      expectedSessionTransitionErrors:
        state?.expectedSessionTransitionErrors ?? 0,
      expectedSessionTransitionRequestFailures:
        state?.expectedSessionTransitionRequestFailures ?? 0,
    });
  });

  test("starts from a versioned synthetic fixture contract", () => {
    expect(TR13_WORKFLOW_FIXTURE.version).toBe(TR13_WORKFLOW_FIXTURE_VERSION);
    expect(TR13_WORKFLOW_FIXTURE.syntheticOnly).toBe(true);
    expect(TR13_WORKFLOW_FIXTURE.securityNegatives).toHaveLength(3);
    expect(TR13_BRIEF_CONTRACTS.structured.api).toBe("design.generateBrief");
    expect(TR13_BRIEF_CONTRACTS.aiAdvisor.api).toBe(
      "designAdvisor.generateDesignBrief"
    );
  });

  test("renders the public home and login entry routes", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Make defensible design decisions before committing capital.",
      })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    writeBrowserEvidence({
      publicHomeInspected: true,
      publicLoginInspected: true,
    });
  });

  test("keeps the unauthenticated application shell behind sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    writeBrowserEvidence({ unauthenticatedProtectedAccessDenied: true });
  });

  test("admin carries one UI-created project through evaluation, space, MQI, briefs, report, share, and revoke", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const scriptRequests: string[] = [];
    page.on("request", request => {
      if (request.resourceType() === "script") scriptRequests.push(request.url());
    });
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await login(page, users.admin);
    expect(hasLoadedClientModule(scriptRequests, "AIChatBox")).toBe(false);
    expect(hasLoadedClientModule(scriptRequests, "MarkdownRenderer")).toBe(false);
    await page.getByRole("button", { name: "Open MIYAR Intelligence" }).click();
    await expect(
      page.getByRole("heading", { name: "MIYAR Intelligence" })
    ).toBeVisible();
    await expect(
      page.getByText("Hello! I am the MIYAR AI Assistant.")
    ).toBeVisible();
    await expect
      .poll(
        () => hasLoadedClientModule(scriptRequests, "AIChatBox"),
        { message: "AI chat must load only after the assistant opens" }
      )
      .toBe(true);
    await expect
      .poll(
        () => hasLoadedClientModule(scriptRequests, "MarkdownRenderer"),
        { message: "rich Markdown must load only when assistant content renders" }
      )
      .toBe(true);
    await page.getByRole("button", { name: "Close" }).click();
    await page.goto("/projects/new");
    await page
      .getByPlaceholder("e.g. Creek residential concept")
      .fill(workflowProjectName);
    await page.locator("select").nth(0).selectOption("Residential");
    await page.locator("select").nth(1).selectOption("sell_ready");
    await page
      .getByPlaceholder("e.g. Dubai Creek Harbour")
      .fill("Synthetic Dubai");
    await page.locator("select").nth(2).selectOption("Prime");
    await page.locator('input[type="number"]').nth(0).fill("100");
    await page.locator('input[type="number"]').nth(1).fill("1000");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/projects\/\d+/);
    workflowProjectId = Number(/\/projects\/(\d+)/.exec(page.url())?.[1]);
    const projectId = requireWorkflowProjectId();
    const confirm = page.getByRole("button", {
      name: "Confirm current assumptions",
    });
    await expect(confirm).toBeVisible();
    await confirm.click();
    const runEvaluation = page
      .getByRole("button", { name: /Run evaluation/i })
      .first();
    await expect(runEvaluation).toBeEnabled();
    await runEvaluation.click();
    await expect
      .poll(
        async () =>
          (
            await trpcRequest<{ id: number; status: string }>(
              page,
              "project.get",
              { id: projectId },
              "GET"
            )
          ).status,
        { timeout: 20_000, message: "evaluation must persist before MQI" }
      )
      .toBe("evaluated");
    await expect(
      page.getByText(/Decision Score|Composite/i).first()
    ).toBeVisible({ timeout: 20_000 });

    const generatedSpace = await trpcRequest<{
      roomCount: number;
      source: string;
    }>(page, "spaceProgram.generate", { projectId }, "POST");
    expect(generatedSpace.roomCount).toBeGreaterThan(0);
    expect(generatedSpace.source).toBe("typology_default");
    const space = await trpcRequest<{
      rooms: Array<{ id: number; roomCode: string; sqm: string }>;
      summary: { fitOutSqm: number };
    }>(page, "spaceProgram.getForProject", { projectId }, "GET");
    expect(space.rooms.length).toBe(generatedSpace.roomCount);
    expect(space.summary.fitOutSqm).toBeGreaterThan(0);
    for (const room of space.rooms) {
      await trpcRequest(
        page,
        "spaceProgram.updateRoom",
        {
          roomId: room.id,
          finishGrade: "C",
        },
        "POST"
      );
    }
    await trpcRequest(
      page,
      "materialQuantity.generate",
      {
        projectId,
      },
      "POST"
    );
    await trpcRequest(
      page,
      "materialQuantity.lockAllocations",
      { projectId, isLocked: true },
      "POST"
    );
    await trpcRequest(page, "materialQuantity.generate", { projectId }, "POST");
    const mqi = await trpcRequest<{
      totalAllocations: number;
      rooms: Array<{
        elements: Array<{
          allocations: Array<{
            allocationPct: number;
            surfaceAreaM2: number;
            isLocked: boolean;
          }>;
        }>;
      }>;
    }>(page, "materialQuantity.getForProject", { projectId }, "GET");
    expect(mqi.totalAllocations).toBeGreaterThan(0);
    expect(
      mqi.rooms
        .flatMap(room => room.elements)
        .every(
          element =>
            element.allocations.reduce(
              (sum, allocation) => sum + allocation.allocationPct,
              0
            ) === 100
        )
    ).toBe(true);
    expect(
      mqi.rooms
        .flatMap(room => room.elements)
        .flatMap(element => element.allocations)
        .every(allocation => allocation.isLocked)
    ).toBe(true);

    const structuredBrief = await trpcRequest<{
      id: number;
      version: number;
      data: { projectIdentity: { projectName: string } };
    }>(page, "design.generateBrief", { projectId, locale: "en" }, "POST");
    expect(structuredBrief.data.projectIdentity.projectName).toBe(
      workflowProjectName
    );

    const storedReport = await trpcRequest<{
      projectId: number;
      projectName: string;
    }>(
      page,
      "project.generateReport",
      { projectId, reportType: "full_report", locale: "en" },
      "POST"
    );
    expect(storedReport).toMatchObject({
      projectId,
      projectName: workflowProjectName,
    });
    const reports = await trpcRequest<
      Array<{
        id: number;
        reportType: string;
      }>
    >(page, "project.listReports", { projectId }, "GET");
    expect(reports).toContainEqual(
      expect.objectContaining({ reportType: "full_report" })
    );
    const storedFullReport = reports.find(
      report => report.reportType === "full_report"
    );
    expect(storedFullReport?.id).toBeDefined();
    await prepareSyntheticInlineReportPreview(projectId, storedFullReport!.id);

    await seedSyntheticAdvisorSharePrerequisite(projectId, workflowProjectName);
    const advisorBrief = await trpcRequest<{
      shareStatus: { active: boolean; expiresAt: string | null };
    }>(page, "designAdvisor.getDesignBrief", { projectId }, "GET");
    expect(advisorBrief.shareStatus).toEqual({
      active: false,
      expiresAt: null,
    });
    expect(advisorBrief).not.toHaveProperty("shareToken");

    await page.goto(`/projects/${projectId}`);
    await page
      .getByRole("button", { name: "Design", exact: true })
      .last()
      .click();
    await page.getByRole("tab", { name: "Space programme" }).click();
    await expect(
      page.getByText(space.rooms[0]!.roomCode).first()
    ).toBeVisible();
    await page.getByRole("tab", { name: "Material cost" }).click();
    await expect(page.getByText("Finish Cost (Est.)")).toBeVisible();
    await page.goto(`/projects/${projectId}/investor-summary`);
    await page.getByRole("button", { name: "Create share link" }).click();
    await expect(page.getByRole("button", { name: /Copied!/ })).toBeVisible({
      timeout: 10_000,
    });
    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareUrl).toMatch(/\/share\//);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(shareUrl);
    await expect(
      page.getByRole("heading", { name: workflowProjectName })
    ).toBeVisible();
    await expect(page.getByText(/Read-only shared view/i)).toBeVisible();
    expect(await page.locator("button,input,select,textarea").count()).toBe(0);
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${projectId}/investor-summary`);
    await page
      .getByRole("button", { name: "Revoke all project share links" })
      .click();
    await expect(
      page
        .locator("[data-share-status]")
        .filter({ hasText: "Sharing inactive" })
    ).toHaveCount(1);
    await withinExpectedConcealment(page, async () => {
      await page.goto(shareUrl);
      await expect(
        page.getByText(/Link unavailable|invalid or expired/i)
      ).toBeVisible();
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Good decisions start here." })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Open MIYAR Intelligence" }).click();
    await expect(
      page.getByRole("heading", { name: "MIYAR Intelligence" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Close" }).click();
    await page.goto(`/projects/${projectId}`);
    await expect(
      page.getByRole("heading", { name: workflowProjectName })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(hasLoadedClientModule(scriptRequests, "ReportRenderer")).toBe(false);
    await page.getByRole("button", { name: "Open report preview" }).first().click();
    await expect
      .poll(
        () => hasLoadedClientModule(scriptRequests, "ReportRenderer"),
        { message: "report renderer must load only after preview opens" }
      )
      .toBe(true);
    await expectNoHorizontalOverflow(page);
    writeBrowserEvidence({
      createdProjectId: projectId,
      criticalWorkflowProjectId: projectId,
      sameProjectThroughoutCriticalJourney: true,
      quickCreate: true,
      assumptionsConfirmed: true,
      evaluationRun: true,
      adminShareCreated: true,
      structuredBriefGeneratedThroughApi: true,
      storedFullReportGeneratedThroughApi: true,
      aiAdvisorSharePrerequisite: "synthetic-browser-fixture",
      aiAdvisorGenerationCertifiedInVitestMysqlRouter: true,
      gradeCRoomsSetThroughScopedRoutes: true,
      gradeCDeterministicMqiGenerated: true,
      spaceProgrammeScreenInspected: true,
      mqiScreenInspected: true,
      allocationGroupsTotal100Pct: true,
      lockedAllocationPreserved: true,
      assistantDeferredUntilOpen: true,
      assistantMarkdownLoadedOnDemand: true,
      reportRendererLoadedOnDemand: true,
      mobileAuthenticatedDashboard: true,
      mobileAssistantPanel: true,
      mobileAuthenticatedProject: true,
      mobileAuthenticatedReports: true,
      mobileAuthenticatedHorizontalOverflow: false,
      mobilePublicShareReadOnly: true,
      mobileHorizontalOverflow: false,
      projectShareRevoked: true,
      priorShareConcealedAfterRevocation: true,
    });
  });

  test("member and viewer cannot expose admin share controls; foreign access is concealed", async ({
    page,
  }) => {
    const projectId = requireWorkflowProjectId();
    for (const user of [users.member, users.viewer]) {
      await login(page, user);
      await page.goto(`/projects/${projectId}/investor-summary`);
      await expect(page.locator("[data-share-controls]")).toHaveCount(0);
    }
    await login(page, users.foreign);
    await withinExpectedConcealment(page, async () => {
      const projectResponse = page.waitForResponse(
        response =>
          response.status() === 404 && response.url().includes("project.get"),
        { timeout: 10_000 }
      );
      await page.goto(`/projects/${projectId}/investor-summary`);
      await projectResponse;
      await expect(page.locator("[data-share-controls]")).toHaveCount(0);
      await page.waitForTimeout(250);
    });
    let concealed!: { status: number; body: string };
    await withinExpectedConcealment(page, async () => {
      concealed = await page.evaluate(async projectId => {
        const input = encodeURIComponent(
          JSON.stringify({ json: { id: projectId } })
        );
        const response = await fetch(`/api/trpc/project.get?input=${input}`, {
          credentials: "include",
        });
        return { status: response.status, body: await response.text() };
      }, projectId);
    });
    expect(concealed.status).toBe(404);
    expect(concealed.body).not.toContain(workflowProjectName);
    writeBrowserEvidence({
      memberShareControlsHidden: true,
      viewerShareControlsHidden: true,
      foreignProjectAccessConcealed: true,
    });
  });
});
