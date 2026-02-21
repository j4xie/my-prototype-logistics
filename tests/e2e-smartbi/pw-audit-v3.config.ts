import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180 * 1000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    screenshot: 'on',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  },
  projects: [{
    name: 'audit-v3',
    testMatch: /audit-v3.spec.ts/,
    use: { ...devices['Desktop Chrome'] },
  }],
  outputDir: 'test-results/',
});