const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, 'validation');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

(async () => {
  console.log('启动UI元素验证...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
    
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
      path.join(screenshotDir, 'ui_validation_report.json'),
      JSON.stringify(uiReport, null, 2)
    );
    
    // 截取修复后的页面截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'fixed_homepage.png'),
      fullPage: true
    });
    
    console.log('UI元素验证完成');
    
  } finally {
    await browser.close();
  }
})(); 