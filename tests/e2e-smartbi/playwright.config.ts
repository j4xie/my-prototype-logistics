import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * SmartBI E2E 全量审计测试配置
 *
 * 环境变量:
 * - BASE_URL: 测试目标地址 (默认: http://localhost:5173)
 * - HEADED: 是否显示浏览器窗口
 * - SLOW_MO: 操作延迟(ms)，便于观察
 */

const screenshotDir = path.resolve(__dirname, '../../test-screenshots/audit-20260208');

export default defineConfig({
  testDir: './tests',

  // 测试超时 - 长超时以支持上传+enrichment
  timeout: 180 * 1000,
  expect: {
    timeout: 15 * 1000,
  },

  // 顺序执行
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  // 报告器
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 目标地址 - 本地 Vite dev server
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // 浏览器设置
    headless: process.env.HEADED !== 'true',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,

    // 截图和录像
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // 视口
    viewport: { width: 1920, height: 1080 },

    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,
  },

  // 项目配置
  projects: [
    {
      name: 'audit',
      testMatch: /smartbi-audit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // 输出目录
  outputDir: 'test-results/',
});
