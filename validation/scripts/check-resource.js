const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080/',
  screenshotsDir: path.join(__dirname, '../reports/screenshots'),
  reportPath: path.join(__dirname, '../reports/resource_report.json')
};
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

async function run() {
  console.log('启动资源加载验证...');
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 收集网络请求
  const resourceRequests = [];
  const failedRequests = [];
  
  page.on('request', request => {
    resourceRequests.push({
      url: request.url(),
      resourceType: request.resourceType()
    });
  });
  
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText || '未知错误'
    });
  });
  
  try {
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
    
    // 保存资源请求日志
    fs.writeFileSync(
      path.join(config.screenshotsDir, 'resource_requests.json'),
      JSON.stringify(resourceRequests, null, 2)
    );
    
    // 保存失败请求日志
    fs.writeFileSync(
      path.join(config.screenshotsDir, 'failed_requests.json'),
      JSON.stringify(failedRequests, null, 2)
    );
    
    console.log(`成功请求: ${resourceRequests.length - failedRequests.length}`);
    console.log(`失败请求: ${failedRequests.length}`);
    
    // 生成验证报告
    const report = {
      timestamp: new Date().toISOString(),
      totalRequests: resourceRequests.length,
      failedRequests: failedRequests.length,
      failureRate: `${(failedRequests.length / resourceRequests.length * 100).toFixed(2)}%`,
      details: failedRequests
    };
    
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    
    return report;
  } finally {
    await browser.close();
  }
}

module.exports = { run }; 