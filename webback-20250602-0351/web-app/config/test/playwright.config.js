/**
 * @file config/test/playwright.config.js
 * @description Playwright端到端测试配置
 * @see https://playwright.dev/docs/test-configuration
 */

const { devices } = require('@playwright/test');

/**
 * Playwright端到端测试配置
 * @type {import('@playwright/test').PlaywrightTestConfig}
 */
module.exports = {
  // 测试超时时间
  timeout: 30000,
  
  // 全局设置
  globalSetup: require.resolve('../../tests/e2e/global-setup'),
  
  // 测试目录
  testDir: '../../tests/e2e',
  
  // 测试文件模式
  testMatch: '**/*.test.js',
  
  // 失败重试次数
  retries: process.env.CI ? 2 : 0,
  
  // 并发运行测试
  workers: process.env.CI ? 1 : undefined,
  
  // 报告器配置
  reporter: [
    ['html', { outputFolder: '../../reports/playwright' }],
    ['json', { outputFile: '../../reports/playwright/results.json' }]
  ],
  
  // 浏览器配置
  use: {
    // 基础URL
    baseURL: 'http://localhost:8080',
    
    // 截屏设置
    screenshot: 'only-on-failure',
    
    // 录制设置
    video: 'on-first-retry',
    
    // 跟踪设置
    trace: 'on',
  },
  
  // 不同设备的测试项目
  projects: [
    {
      name: 'Chrome',
      use: { browserName: 'chromium' },
    },
    {
      name: 'Firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'WebKit',
      use: { browserName: 'webkit' },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
};