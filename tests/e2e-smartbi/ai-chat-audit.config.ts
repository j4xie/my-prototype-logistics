import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /ai-chat-webadmin-audit\.spec\.ts/,
  timeout: 120 * 1000,
  expect: { timeout: 30 * 1000 },
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
    name: 'audit',
    use: { ...devices['Desktop Chrome'] },
  }],
  outputDir: 'test-results/',
});
