const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080',
  pages: [
    '/',
    '/pages/trace/trace-map.html',
    '/pages/trace/trace-list.html',
    '/pages/home/home-selector.html'
  ],
  screenshotsDir: path.join(__dirname, '../reports/screenshots/functionality'),
  reportPath: path.join(__dirname, '../reports/functionality_report.json')
};
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

async function run() {
  console.log('开始功能验证测试...');

  try {
    // 选择一个页面进行测试
    const testPage = config.pages[1]; // 使用溯源地图页面
    console.log(`测试页面: ${testPage}`);
    await page.goto(`${config.baseUrl}${testPage}`, { waitUntil: 'networkidle' });
    // 执行功能测试
    const navigationResult = await validateNavigation(page);
    const resourcesResult = await validateResources(page);
    // 组合测试结果
    const testResults = {
      timestamp: new Date().toISOString(),
      page: testPage,
      tests: [
        navigationResult,
        resourcesResult
      ],
      status: (navigationResult.success && resourcesResult.success) ? 'success' : 'failed',
      summary: {
        total: 2,
        passed: [navigationResult, resourcesResult].filter(r => r.success).length,
        failed: [navigationResult, resourcesResult].filter(r => !r.success).length
      }
    };

    // 保存报告
    fs.writeFileSync(config.reportPath, JSON.stringify(testResults, null, 2));

    return testResults;

  } catch (error) {
    console.error('功能验证测试过程中出错', error);

    const errorResult = {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error.message,
      stack: error.stack
    };

    // 保存错误报告
    fs.writeFileSync(config.reportPath, JSON.stringify(errorResult, null, 2));

    return errorResult;
  }
}

module.exports = { run }; 