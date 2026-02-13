import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 120000,
  use: {
    baseURL: 'http://47.100.235.168:17728',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },
  reporter: 'list',
  projects: [{ name: 'check', use: { ...devices['Desktop Chrome'] } }],
  outputDir: 'test-results/',
});
