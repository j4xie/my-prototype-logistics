import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /visual-audit-0223\.spec\.ts/,
  timeout: 600 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://47.100.235.168:8088',
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'visual-audit',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
