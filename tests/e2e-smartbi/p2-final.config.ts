import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: /p2-final.spec.ts/,
  timeout: 300 * 1000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    screenshot: 'on',
    video: 'off',
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: 'p2-final', use: { ...devices['Desktop Chrome'] } }],
  outputDir: 'test-results/',
});
