const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080',
  pages: [
    // 主要入口页面
    { name: '首页', path: '/' },
    
    // 养殖模块页面
    { name: '养殖主页', path: '/pages/farming/' },
    { name: '养殖-繁育信息', path: '/pages/farming/farming-breeding.html' },
    { name: '养殖-饲养管理', path: '/pages/farming/farming-feeding.html' },
    
    // 加工模块页面
    { name: '加工主页', path: '/pages/processing/' },
    { name: '加工-屠宰处理', path: '/pages/processing/processing-slaughter.html' },
    
    // 物流模块页面
    { name: '物流主页', path: '/pages/logistics/' },
    { name: '物流-创建运单', path: '/pages/logistics/logistics-create.html' },
    
    // 溯源模块页面
    { name: '溯源主页', path: '/pages/trace/' },
    { name: '溯源-地图', path: '/pages/trace/trace-map.html' },
    
    // 个人档案页面
    { name: '个人档案', path: '/pages/profile/' },
    
    // 系统管理页面
    { name: '系统管理', path: '/pages/admin/' },
    
    // 首页选择器和认证页面
    { name: '首页选择器', path: '/pages/home/home-selector.html' },
    { name: '登录', path: '/pages/auth/login.html' }
  ],
  screenshotsDir: path.join(__dirname, '../reports/screenshots'),
  reportPath: path.join(__dirname, '../reports/navigation_report.json')
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
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const navigationResults = [];
    
    // 遍历每个导航路径并验证
    for (const pageConfig of config.pages) {
      const url = config.baseUrl + pageConfig.path;
      console.log(`导航至${pageConfig.name}: ${url}`);
      
      try {
        const response = await page.goto(url, { timeout: 10000, waitUntil: 'networkidle' });
        const status = response.status();
        const title = await page.title();
        
        // 截取页面截图
        const screenshotPath = path.join(config.screenshotsDir, `${pageConfig.name}_page.png`);
        await page.screenshot({ path: screenshotPath });
        
        navigationResults.push({
          name: pageConfig.name,
          url,
          status,
          title,
          screenshot: screenshotPath,
          success: status >= 200 && status < 400,
          errorMessage: status >= 400 ? `HTTP错误: ${status}` : null
        });
        
      } catch (error) {
        // 处理导航错误
        navigationResults.push({
          name: pageConfig.name,
          url,
          status: 0,
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

module.exports = { run }; 