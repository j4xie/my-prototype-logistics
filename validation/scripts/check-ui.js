const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:8080',
  screenshotsDir: path.join(__dirname, '../reports/screenshots/check-ui'),
  reportPath: path.join(__dirname, '../reports/check-ui_report.json')
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
  console.log('启动UI元素验证...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
    
    // 验证关键UI元素
    const uiReport = {};
    const expectedElements = {
      'nav': '导航菜单',
      'button': '按钮',
      'a': '链接',
      'img': '图片',
      'h1': '标题',
      'footer': '页脚'
    };
    
    for (const [selector, name] of Object.entries(expectedElements)) {
      const count = await page.$$eval(selector, els => els.length);
      uiReport[name] = {
        selector,
        count,
        status: count > 0 ? '通过' : '失败',
        details: count > 0 ? `找到${count}个元素` : '未找到元素'
      };
      
      // 如果是链接，收集链接信息
      if (selector === 'a' && count > 0) {
        const links = await page.$$eval('a', els => 
          els.map(el => ({
            text: el.textContent.trim(),
            href: el.getAttribute('href'),
            visible: el.offsetParent !== null
          }))
        );
        uiReport[name].links = links;
      }
    }
    
    // 保存UI验证报告
    fs.writeFileSync(
      config.reportPath,
      JSON.stringify(uiReport, null, 2)
    );
    
    // 截取修复后的页面截图
    await page.screenshot({ 
      path: path.join(config.screenshotsDir, 'fixed_homepage.png'),
      fullPage: true
    });
    
    console.log('UI元素验证完成');
    return uiReport;
    
  } catch (error) {
    console.error('UI验证过程中出错:', error);
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