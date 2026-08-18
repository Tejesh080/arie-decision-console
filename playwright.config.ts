import { defineConfig, devices } from "@playwright/test";

/**
 * The dev server is started manually (not via Playwright's `webServer`)
 * because P4's QA runs the same suite twice against two different server
 * configurations — mock mode and real-API mode — which means restarting the
 * Next.js process with a different NEXT_PUBLIC_ARIE_DATA_MODE between runs,
 * not something a single auto-managed webServer entry can express.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
