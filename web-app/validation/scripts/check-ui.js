const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  baseDir: path.resolve(__dirname, '../..'),
  homePage: '/index.html',
  timeout: 60000, // 增加超时到60秒
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
  const browser = await chromium.launch({ 
    headless: false,
    timeout: config.timeout
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const filePath = path.join(config.baseDir, config.homePage.replace(/^\//, ''));
    const url = `file://${filePath}`;
    
    console.log('检查首页文件是否存在:', filePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`首页文件不存在: ${filePath}`);
    }
    
    console.log('正在访问页面:', url);
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: config.timeout
    });
    
    // 验证关键UI元素
    const uiReport = {
      timestamp: new Date().toISOString(),
      url: url,
      pagePath: filePath
    };
    
    const expectedElements = {
      'nav': '导航菜单',
      'header': '页眉',
      'button': '按钮',
      'a': '链接',
      'img': '图片',
      'h1, h2': '标题',
      'input': '输入框',
      'select': '选择框',
      'table': '表格',
      'footer': '页脚'
    };
    
    const elementResults = [];
    
    for (const [selector, name] of Object.entries(expectedElements)) {
      const count = await page.$$eval(selector, els => els.length);
      const result = {
        name,
        selector,
        count,
        status: count > 0 ? '通过' : '失败',
        details: count > 0 ? `找到${count}个元素` : '未找到元素'
      };
      
      elementResults.push(result);
      
      // 如果是链接，收集链接信息
      if (selector === 'a' && count > 0) {
        const links = await page.$$eval('a', els => 
          els.map(el => ({
            text: el.textContent.trim(),
            href: el.getAttribute('href'),
            visible: el.offsetParent !== null
          }))
        );
        result.links = links;
      }
      
      // 如果是按钮，收集按钮信息
      if (selector === 'button' && count > 0) {
        const buttons = await page.$$eval('button', els => 
          els.map(el => ({
            text: el.textContent.trim(),
            disabled: el.disabled,
            type: el.getAttribute('type'),
            visible: el.offsetParent !== null
          }))
        );
        result.buttons = buttons;
      }
    }
    
    uiReport.elements = elementResults;
    uiReport.summary = {
      totalChecks: elementResults.length,
      passed: elementResults.filter(r => r.status === '通过').length,
      failed: elementResults.filter(r => r.status === '失败').length
    };
    
    // 保存UI验证报告
    fs.writeFileSync(
      config.reportPath,
      JSON.stringify(uiReport, null, 2)
    );
    
    // 截取修复后的页面截图
    await page.screenshot({ 
      path: path.join(config.screenshotsDir, 'homepage.png'),
      fullPage: true
    });
    
    console.log('UI元素验证完成');
    console.log(`通过: ${uiReport.summary.passed}/${uiReport.summary.totalChecks}`);
    
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