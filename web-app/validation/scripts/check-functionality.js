const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080/',
  screenshotDir: path.join(__dirname, '../screenshots'),
  reportPath: path.join(__dirname, '../reports/functionality_report.json')
};

// 确保目录存在
if (!fs.existsSync(config.screenshotDir)) {
  fs.mkdirSync(config.screenshotDir, { recursive: true });
}

async function run(options = {}) {
  console.log('开始功能验证...');
  
  // 合并选项
  const mergedConfig = {
    ...config,
    ...options
  };
  
  console.log('使用配置:', JSON.stringify(mergedConfig, null, 2));
  
  let browser;
  
  try {
    // 启动浏览器
    browser = await chromium.launch({
      headless: false,
      slowMo: 100
    });
    
    // 创建新上下文
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log(`访问页面: ${mergedConfig.baseUrl}`);
    await page.goto(mergedConfig.baseUrl, { waitUntil: 'domcontentloaded' });
    
    // 等待页面加载
    await page.waitForTimeout(2000);
    
    // 检查页面是否包含主要元素
    const hasNavigation = await page.evaluate(() => {
      return !!document.querySelector('nav') || 
             !!document.querySelector('.nav') || 
             !!document.querySelector('.navbar') ||
             !!document.querySelector('.navigation');
    });
    
    const hasFooter = await page.evaluate(() => {
      return !!document.querySelector('footer') || 
             !!document.querySelector('.footer');
    });
    
    const hasMainContent = await page.evaluate(() => {
      return !!document.querySelector('main') || 
             !!document.querySelector('.main') || 
             !!document.querySelector('#main') ||
             !!document.querySelector('.content') ||
             !!document.querySelector('#content');
    });
    
    // 检查交互功能
    const buttons = await page.$$('button, .btn, [role="button"]');
    console.log(`找到 ${buttons.length} 个按钮元素`);
    
    // 尝试点击第一个按钮
    let buttonClicked = false;
    if (buttons.length > 0) {
      try {
        await buttons[0].click();
        buttonClicked = true;
        console.log('成功点击按钮');
      } catch (error) {
        console.log('按钮点击失败:', error.message);
      }
    }
    
    // 检查表单
    const forms = await page.$$('form');
    console.log(`找到 ${forms.length} 个表单元素`);
    
    // 捕获屏幕截图
    const screenshotPath = path.join(mergedConfig.screenshotDir, 'functionality_test_final.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`屏幕截图已保存至: ${screenshotPath}`);
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      url: mergedConfig.baseUrl,
      hasNavigation,
      hasFooter,
      hasMainContent,
      buttonCount: buttons.length,
      buttonClickable: buttonClicked,
      formCount: forms.length,
      screenshotPath,
      status: 'success'
    };
    
    // 保存报告
    fs.writeFileSync(mergedConfig.reportPath, JSON.stringify(report, null, 2));
    
    return report;
    
  } catch (error) {
    console.error('功能验证失败:', error);
    
    // 生成错误报告
    const errorReport = {
      timestamp: new Date().toISOString(),
      url: mergedConfig.baseUrl,
      error: error.message,
      status: 'error'
    };
    
    fs.writeFileSync(mergedConfig.reportPath, JSON.stringify(errorReport, null, 2));
    
    return errorReport;
  } finally {
    if (browser) {
    await browser.close();
    }
  }
}

module.exports = { run }; 