import { defineConfig, devices } from "@playwright/test";
import { availableParallelism } from "node:os";

export default defineConfig({
  testDir: "../tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: Math.max(2, Math.floor(availableParallelism() / 2)),
  outputDir: "../test-results",
  reporter: process.env.CI ? [["list"], ["github"]] : [["html", { outputFolder: "../playwright-report" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --strictPort",
    cwd: "..",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
