import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against the built static site, the way GitHub Pages serves it.
 * Run `pnpm build` first, then `pnpm --filter @budgy/web e2e`.
 */
const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node e2e/serve.mjs",
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
