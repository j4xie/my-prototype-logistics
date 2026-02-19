import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /audit-feb18-extra.spec.ts/,
  timeout: 360 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    screenshot: 'on',
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },
  projects: [{
    name: 'audit-extra',
    use: { ...devices['Desktop Chrome'] },
  }],
  outputDir: 'test-results/',
});
