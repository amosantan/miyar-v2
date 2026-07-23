import { defineConfig, devices } from "@playwright/test";

const port = 34_313;

/**
 * Dedicated critical-workflow profile. The guarded runner owns the database,
 * process profile, and port; this config intentionally never reuses a server.
 */
export default defineConfig({
  testDir: "./e2e/tr13",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "tmp/tr13-workflow-certification/playwright-results.json" },
    ],
  ],
  outputDir: "tmp/tr13-workflow-certification/playwright-artifacts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // The share URL exists only in clipboard memory during certification. A
    // trace could persist it, so this profile deliberately disables tracing.
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "tr13-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `PORT=${port} MIYAR_RUNTIME_PROFILE=test ENABLE_BACKGROUND_JOBS=false pnpm dev`,
    port,
    reuseExistingServer: false,
    timeout: 60_000,
    // Both app-server streams must reach the guarded runner, which secret-scans
    // the combined output and persists only a sanitized copy as evidence.
    stdout: "pipe",
    stderr: "pipe",
  },
});
