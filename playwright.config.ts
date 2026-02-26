import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 *
 * Install: npx playwright install --with-deps
 * Run:     npx playwright test
 * UI:      npx playwright test --ui
 * Report:  npx playwright show-report
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? "github" : "html",

    use: {
        baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },

    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", use: { ...devices["iPhone 14"] } },
    ],

    webServer: process.env.CI
        ? undefined
        : {
            command: "npm run dev",
            port: 3000,
            reuseExistingServer: true,
            timeout: 30000,
        },
});
