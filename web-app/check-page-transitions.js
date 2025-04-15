const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, 'validation');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

(async () => {
  console.log('启动页面导航验证...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 导航路径列表
    const navigationPaths = [
      { name: '首页', url: 'http://localhost:8080/' },
      { name: '种植', url: 'http://localhost:8080/pages/farming/' },
      { name: '加工', url: 'http://localhost:8080/pages/processing/' },
      { name: '物流', url: 'http://localhost:8080/pages/logistics/' },
      { name: '溯源', url: 'http://localhost:8080/pages/trace/' },
      { name: '个人档案', url: 'http://localhost:8080/pages/profile/' },
      { name: '系统管理', url: 'http://localhost:8080/pages/admin/' }
    ];
    
    const navigationResults = [];
    
    // 遍历每个导航路径并验证
    for (let i = 0; i < navigationPaths.length; i++) {
      const { name, url } = navigationPaths[i];
      console.log(`导航至${name}: ${url}`);
      
      try {
        const response = await page.goto(url, { timeout: 10000, waitUntil: 'networkidle' });
        const status = response.status();
        const title = await page.title();
        
        // 截取页面截图
        const screenshotPath = path.join(screenshotDir, `${name}_page.png`);
        await page.screenshot({ path: screenshotPath });
        
        navigationResults.push({
          name,
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
          name,
          url,
          status: 0,
          title: null,
          screenshot: null,
          success: false,
          errorMessage: `导航错误: ${error.message}`
        });
        console.error(`导航到${name}失败:`, error.message);
      }
      
      // 等待一会儿，确保页面加载完成
      await page.waitForTimeout(2000);
    }
    
    // 保存导航验证报告
    fs.writeFileSync(
      path.join(screenshotDir, 'navigation_validation_report.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalPages: navigationPaths.length,
        successCount: navigationResults.filter(r => r.success).length,
        failCount: navigationResults.filter(r => !r.success).length,
        results: navigationResults
      }, null, 2)
    );
    
    console.log('页面导航验证完成');
    
  } finally {
    await browser.close();
  }
})(); 