import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    headless: process.env.HEADED !== 'true',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'vue-admin',
      use: { baseURL: 'http://localhost:5173' },
      testMatch: /w1-s1.*\.spec\.ts/,
    },
    {
      name: 'rn-platform-admin',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w1-s2.*\.spec\.ts/,
    },
    {
      name: 'rn-dispatcher',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w1-s3.*\.spec\.ts/,
    },
    {
      name: 'rn-warehouse',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w1-s4.*\.spec\.ts/,
    },
    {
      name: 'rn-hr',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w1-s5.*\.spec\.ts/,
    },
    {
      name: 'rn-fa-reports',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w2-s1.*\.spec\.ts/,
    },
    {
      name: 'rn-fa-smartbi',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w2-s2.*\.spec\.ts/,
    },
    {
      name: 'rn-fa-management',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w2-s3.*\.spec\.ts/,
    },
    {
      name: 'rn-workshop',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w2-s4.*\.spec\.ts/,
    },
    {
      name: 'rn-qi-ai',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /w2-s5.*\.spec\.ts/,
    },
    // API Audit projects
    {
      name: 'api-audit-vue',
      use: { baseURL: 'http://localhost:5173' },
      testMatch: /api-audit-vue.*\.spec\.ts/,
    },
    {
      name: 'api-audit-rn',
      use: { baseURL: 'http://localhost:3010' },
      testMatch: /api-audit-rn.*\.spec\.ts/,
    },
  ],
});
