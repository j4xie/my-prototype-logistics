import { defineConfig, devices } from '@playwright/test';

/**
 * SmartBI E2E 测试配置
 *
 * 环境变量:
 * - BASE_URL: 测试目标地址 (默认: http://139.196.165.140:17400)
 * - HEADED: 是否显示浏览器窗口
 * - SLOW_MO: 操作延迟(ms)，便于观察
 */

export default defineConfig({
  testDir: './tests',

  // 测试超时
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },

  // 完整的测试报告
  fullyParallel: false, // 顺序执行，便于调试
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,

  // 报告器
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 目标地址
    baseURL: process.env.BASE_URL || 'http://139.196.165.140:8086',

    // 浏览器设置
    headless: process.env.HEADED !== 'true',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,

    // 截图和录像
    screenshot: 'on',
    video: 'on-first-retry',
    trace: 'on-first-retry',

    // 视口
    viewport: { width: 1920, height: 1080 },

    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 本地存储状态（登录后保存）
    storageState: './auth-state.json',
  },

  // 项目配置
  projects: [
    // 登录设置（先执行，保存登录状态）
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        storageState: undefined, // 登录时不使用已保存状态
      },
    },

    // Chrome 测试
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome', // 使用本地 Chrome
      },
      dependencies: ['setup'],
    },
  ],

  // 输出目录
  outputDir: 'test-results/',

  // Web Server（可选：本地开发时启动）
  // webServer: {
  //   command: 'cd ../../web-admin && npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});
