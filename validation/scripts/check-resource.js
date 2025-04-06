const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080/',
  screenshotsDir: path.join(__dirname, '../reports/screenshots'),
  reportPath: path.join(__dirname, '../reports/resource_report.json')
};

// 确保目录存在
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

async function run() {
  console.log('启动资源加载验证...');
  console.log('使用配置:', JSON.stringify(config, null, 2));
  
  let browser;
  
  try {
    console.log('正在启动浏览器...');
    browser = await chromium.launch({
      headless: false
    });
    console.log('浏览器启动成功');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('新页面创建成功');
    
    // 收集网络请求
    const resourceRequests = [];
    const failedRequests = [];
    
    page.on('request', request => {
      console.log('请求:', request.url());
      resourceRequests.push({
        url: request.url(),
        resourceType: request.resourceType()
      });
    });
    
    page.on('requestfailed', request => {
      console.log('请求失败:', request.url());
      failedRequests.push({
        url: request.url(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText || '未知错误'
      });
    });
    
    console.log('正在访问页面:', config.baseUrl);
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
    console.log('页面加载完成');
    
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
  } catch (error) {
    console.error('资源加载验证失败:', error);
    
    // 生成错误报告
    const errorReport = {
      timestamp: new Date().toISOString(),
      status: 'error',
      errorMessage: error.message,
      errorStack: error.stack
    };
    
    fs.writeFileSync(config.reportPath, JSON.stringify(errorReport, null, 2));
    
    return errorReport;
  } finally {
    if (browser) {
      await browser.close();
      console.log('浏览器已关闭');
    }
  }
}

module.exports = { run }; 