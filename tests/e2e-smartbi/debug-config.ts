import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './tests', timeout: 120000, fullyParallel: false, workers: 1, reporter: [['list']], use: { headless: true, viewport: { width: 1920, height: 1080 } }, projects: [{ name: 'debug', testMatch: /debug-login2.spec.ts/, use: { ...devices['Desktop Chrome'] } }] });
