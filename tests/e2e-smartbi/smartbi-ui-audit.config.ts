import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://47.100.235.168:8088",
    headless: true,
    screenshot: "on",
    video: "off",
    trace: "off",
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "ui-audit",
      testMatch: /smartbi-ui-audit.spec.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results/",
});
