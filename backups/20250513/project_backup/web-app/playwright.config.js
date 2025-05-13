/**
 * 食品溯源系统 - Playwright端到端测试配置
 * @version 1.0.0
 */

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// 尝试导入环境设置
let testEnv = { testServerPort: 8080 };
try {
  // 尝试导入环境设置
  const setupPath = path.join(__dirname, 'tests', 'e2e', 'setup-env.js');
  if (fs.existsSync(setupPath)) {
    testEnv = require(setupPath);
    console.log('已加载环境设置:', testEnv);
  }
} catch (error) {
  console.warn('无法加载环境设置，使用默认配置:', error.message);
}

// 检查端口是否有效
const testPort = parseInt(testEnv.testServerPort) || 8080;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    actionTimeout: 0,
    baseURL: `http://localhost:${testPort}`,
    trace: 'on-first-retry',
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `cd ${process.cwd()} && npm run start`,
    port: testPort,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  // 测试项目配置
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
      },
    }
  ],
  // 保存测试结果和日志的目录
  outputDir: path.join(process.cwd(), 'tests', 'e2e', 'results'),
}); 