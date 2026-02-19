import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "verify-finance-tabs.spec.ts",
  timeout: 180000,
  use: {
    headless: true,
    viewport: { width: 1400, height: 900 },
    screenshot: "on",
  },
  reporter: [["list"]],
});
