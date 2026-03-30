import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'e2e-customer-issues.spec.ts',
  timeout: 120000,
  expect: { timeout: 10000 },
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  reporter: [['list']],
  outputDir: 'test-results-issues',
});
