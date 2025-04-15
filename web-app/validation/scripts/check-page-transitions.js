const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseDir: path.resolve(__dirname, '../..'),
  timeout: 60000, // 增加超时到60秒
  pages: [
    // 主要入口页面
    { name: '首页', path: '/index.html' },
    
    // 养殖模块页面
    { name: '养殖-繁育信息', path: '/pages/farming/farming-breeding.html' },
    { name: '养殖-饲养管理', path: '/pages/farming/farming-monitor.html' },
    
    // 加工模块页面
    { name: '加工-屠宰处理', path: '/pages/processing/processing-slaughter.html' },
    
    // 物流模块页面
    { name: '物流-创建运单', path: '/pages/logistics/logistics-create.html' },
    
    // 溯源模块页面
    { name: '溯源-地图', path: '/pages/trace/trace-map.html' },
    
    // 系统管理页面
    { name: '系统管理', path: '/pages/admin/admin-system.html' },
    
    // 认证页面
    { name: '登录', path: '/pages/auth/login.html' },
    
    // 数据采集页面
    { name: '数据采集中心', path: '/pages/farming/data-collection-center.html' },
    { name: '手动采集', path: '/pages/farming/manual-collection.html' },
    { name: '二维码采集', path: '/pages/farming/qrcode-collection.html' },
    
    // 养殖监控页面
    { name: '自动监控', path: '/pages/farming/auto-monitoring.html' },
    { name: '指标详情', path: '/pages/farming/indicator-detail.html' },
    
    // 创建溯源页面
    { name: '创建溯源', path: '/pages/farming/create-trace.html' },
    
    // 预测分析页面
    { name: '预测分析', path: '/pages/farming/prediction-analytics.html' },
    { name: '预测配置', path: '/pages/farming/prediction-config.html' },
    { name: '模型管理', path: '/pages/farming/model-management.html' }
  ],
  screenshotsDir: path.join(__dirname, '../reports/screenshots'),
  reportPath: path.join(__dirname, '../reports/navigation_report.json'),
  detailedReportPath: path.join(__dirname, '../reports/detailed_navigation_report.html')
};

// 确保目录存在
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

// 确保reports目录存在
const reportsDir = path.dirname(config.reportPath);
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

async function run() {
  console.log('启动页面导航验证...');
  
  // 强制生成详细报告
  const isDetailedReport = true;
  console.log('将生成详细报告...');
  
  const browser = await chromium.launch({ 
    headless: false,
    timeout: config.timeout
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const navigationResults = [];
    
    // 遍历每个导航路径并验证
    for (const pageConfig of config.pages) {
      const filePath = path.join(config.baseDir, pageConfig.path.replace(/^\//, ''));
      const url = `file://${filePath}`;
      console.log(`导航至${pageConfig.name}: ${url}`);
      
      try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          throw new Error(`文件不存在: ${filePath}`);
        }
        
        await page.goto(url, { 
          timeout: config.timeout, 
          waitUntil: 'networkidle' 
        });
        
        // 截取页面截图
        const screenshotPath = path.join(config.screenshotsDir, `${pageConfig.name}_page.png`);
        await page.screenshot({ path: screenshotPath });
        
        // 获取页面标题
        const title = await page.title();
        
        // 检查页面内容是否有错误信息
        const pageContent = await page.content();
        let hasError = false;
        let errorType = null;
        
        // 检查常见错误信息
        if (pageContent.includes('Cannot GET') || 
            pageContent.includes('404') || 
            pageContent.includes('页面未找到') ||
            pageContent.includes('页面不存在')) {
          hasError = true;
          errorType = '404 - 页面未找到';
        } else if (pageContent.includes('403') || 
                  pageContent.includes('禁止访问') || 
                  pageContent.includes('拒绝访问')) {
          hasError = true;
          errorType = '403 - 禁止访问';
        } else if (pageContent.includes('500') || 
                  pageContent.includes('服务器错误') || 
                  pageContent.includes('服务器内部错误')) {
          hasError = true;
          errorType = '500 - 服务器错误';
        } else if (pageContent.includes('Error') || 
                  pageContent.includes('错误')) {
          hasError = true;
          errorType = '未知错误';
          
          // 尝试提取更具体的错误信息
          const errorMatch = pageContent.match(/<[^>]*class=['"]error-message['"][^>]*>(.*?)<\/[^>]*>/i) ||
                            pageContent.match(/<[^>]*class=['"]error['"][^>]*>(.*?)<\/[^>]*>/i);
          if (errorMatch && errorMatch[1]) {
            errorType = errorMatch[1].trim();
          }
        }
        
        navigationResults.push({
          name: pageConfig.name,
          url,
          filePath,
          title,
          screenshot: screenshotPath,
          success: !hasError,
          errorMessage: hasError ? `页面错误: ${errorType}` : null
        });
        
        if (hasError) {
          console.error(`${pageConfig.name}页面包含错误: ${errorType}`);
        } else {
          console.log(`${pageConfig.name}页面加载成功`);
        }
        
      } catch (error) {
        // 处理导航错误
        navigationResults.push({
          name: pageConfig.name,
          url,
          filePath,
          title: null,
          screenshot: null,
          success: false,
          errorMessage: `导航错误: ${error.message}`
        });
        console.error(`导航到${pageConfig.name}失败:`, error.message);
      }
      
      // 等待一会儿，确保页面加载完成
      await page.waitForTimeout(2000);
    }
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      totalPages: config.pages.length,
      successCount: navigationResults.filter(r => r.success).length,
      failCount: navigationResults.filter(r => !r.success).length,
      results: navigationResults,
      status: 'success'
    };
    
    // 保存导航验证报告
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    
    // 生成详细HTML报告
    if (isDetailedReport) {
      const detailedHtmlReport = generateDetailedHtmlReport(report);
      fs.writeFileSync(config.detailedReportPath, detailedHtmlReport);
      console.log(`详细报告已保存到: ${config.detailedReportPath}`);
    }
    
    console.log('页面导航验证完成');
    return report;
    
  } catch (error) {
    console.error('验证过程中出错:', error);
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'failed'
    };
  } finally {
    await browser.close();
  }
}

// 生成详细的HTML报告
function generateDetailedHtmlReport(report) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>页面导航详细报告</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .summary { margin-bottom: 20px; }
      .page-result { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
      .success { border-left: 5px solid #4CAF50; }
      .failure { border-left: 5px solid #F44336; }
      .screenshot { max-width: 100%; margin-top: 10px; border: 1px solid #ddd; }
      .stats { display: flex; margin: 20px 0; }
      .stat-box { flex: 1; padding: 15px; margin: 0 10px; text-align: center; border-radius: 5px; }
      .total { background-color: #E3F2FD; }
      .success-stat { background-color: #E8F5E9; }
      .failure-stat { background-color: #FFEBEE; }
      .error-msg { color: #D32F2F; font-family: monospace; padding: 10px; background-color: #FFEBEE; }
    </style>
  </head>
  <body>
    <h1>页面导航详细报告</h1>
    <div class="summary">
      <h2>测试摘要</h2>
      <p>执行时间: ${new Date(report.timestamp).toLocaleString()}</p>
      
      <div class="stats">
        <div class="stat-box total">
          <h3>总页面数</h3>
          <div style="font-size: 2em;">${report.totalPages}</div>
        </div>
        <div class="stat-box success-stat">
          <h3>成功</h3>
          <div style="font-size: 2em;">${report.successCount}</div>
        </div>
        <div class="stat-box failure-stat">
          <h3>失败</h3>
          <div style="font-size: 2em;">${report.failCount}</div>
        </div>
      </div>
    </div>
    
    <h2>页面详情</h2>
    ${report.results.map(result => `
      <div class="page-result ${result.success ? 'success' : 'failure'}">
        <h3>${result.name}</h3>
        <p><strong>路径:</strong> ${result.filePath}</p>
        ${result.title ? `<p><strong>标题:</strong> ${result.title}</p>` : ''}
        <p><strong>状态:</strong> ${result.success ? '成功' : '失败'}</p>
        ${result.errorMessage ? `<p><strong>错误:</strong></p><div class="error-msg">${result.errorMessage}</div>` : ''}
        ${result.screenshot ? `<p><strong>截图:</strong></p><img src="${path.relative(path.dirname(config.detailedReportPath), result.screenshot)}" alt="${result.name}截图" class="screenshot">` : ''}
      </div>
    `).join('')}
  </body>
  </html>
  `;
}

module.exports = { run }; 