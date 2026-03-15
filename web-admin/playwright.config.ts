import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  workers: 3,
  timeout: 300000,
  expect: {
    timeout: 10000,
  },
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  projects: [
    // Step 1: 登录一次，保存 storageState
    {
      name: 'vue-auth',
      testMatch: /auth\.setup\.ts/,
    },
    // Step 2: Vue 测试复用 factory_admin1 的 token
    {
      name: 'vue-web-admin',
      testMatch: 'process-mode-e2e.spec.ts',
      dependencies: ['vue-auth'],
      use: { storageState: 'test-results/.auth/factory-admin.json' },
    },
    // Step 3: RN 测试独立（自己登录）
    {
      name: 'rn-expo-web',
      testMatch: 'rn-expo-web-e2e.spec.ts',
    },
    // Step 4: 截图脚本
    {
      name: 'screenshots',
      testMatch: 'capture-guide-screenshots.spec.ts',
    },
    // Step 5: P0+P1+P2 验证
    {
      name: 'p0p1p2-verify',
      testMatch: 'p0-p1-p2-verify.spec.ts',
      dependencies: ['vue-auth'],
      use: { storageState: 'test-results/.auth/factory-admin.json' },
    },
    // Step 6: 新功能截图
    {
      name: 'new-features-screenshots',
      testMatch: 'capture-new-features.spec.ts',
    },
    // Step 7: Phase 2 workflow + governance
    {
      name: 'phase2-verify',
      testMatch: 'workflow-phase2-e2e.spec.ts',
      dependencies: ['vue-auth'],
      use: { storageState: 'test-results/.auth/factory-admin.json' },
    },
  ],
});
