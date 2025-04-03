const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 创建截图目录
const config = {
  baseUrl: 'http://localhost:8080',
  screenshotsDir: path.join(__dirname, '../reports/screenshots/check-page'),
  reportPath: path.join(__dirname, '../reports/check-page_report.json')
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


async function run() { {
  console.log('启动浏览器进行详细检查...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security']
  });
  const context = await browser.newContext();
  
  // 收集控制台日志
  const logs = [];
  const errors = [];
  
  // 创建页面并监听控制台事件
  const page = await context.newPage();
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`浏览器控制台: [${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error(`页面错误: ${error.message}`);
  });
  
  try {
    console.log('正在打开页面: http://localhost:8888/');
    await page.goto('http://localhost:8888/', { waitUntil: 'networkidle' });
    
    console.log('获取页面标题...');
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    // 截取主页截图
    console.log('截取主页截图...');
    await page.screenshot({ path: path.join(screenshotDir, 'homepage.png'), fullPage: true });
    
    // 检查重要元素是否存在
    console.log('检查重要页面元素...');
    const elements = {
      '导航菜单': 'nav',
      '页脚': 'footer',
      '主要内容': 'main',
      '标题': 'h1',
      '按钮': 'button',
      '链接': 'a',
      '图片': 'img'
    };
    
    for (const [name, selector] of Object.entries(elements)) {
      const count = await page.$$eval(selector, els => els.length);
      console.log(`找到 ${count} 个 ${name} (${selector})`);
    }
    
    // 检查所有链接
    console.log('检查所有链接...');
    const links = await page.$$('a');
    console.log(`找到 ${links.length} 个链接`);
    
    const linkData = [];
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = await link.innerText().catch(() => '<无文本>');
      const href = await link.getAttribute('href') || '<无链接>';
      
      linkData.push({ text, href });
      console.log(`链接 ${i+1}: ${text} -> ${href}`);
      
      // 对于真实HTTP链接，尝试导航
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && 
          !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          console.log(`  点击链接: ${text}`);
          
          // 创建新页面打开链接，这样不影响主页
          const newPage = await context.newPage();
          await newPage.goto(`http://localhost:8888/${href}`, { timeout: 5000 })
            .catch(e => console.log(`  导航错误: ${e.message}`));
          
          console.log(`  成功导航到: ${await newPage.url()}`);
          
          // 截取子页面截图
          const safeName = text.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `link_${i+1}`;
          await newPage.screenshot({ 
            path: path.join(screenshotDir, `${safeName}.png`), 
            fullPage: true 
          });
          
          await newPage.close();
        } catch (e) {
          console.error(`  点击链接错误: ${e.message}`);
        }
      } else {
        console.log(`  跳过非HTTP链接`);
      }
    }
    
    // 保存链接数据
    fs.writeFileSync(
      path.join(screenshotDir, 'links.json'), 
      JSON.stringify(linkData, null, 2)
    );
    
    // 保存控制台日志
    fs.writeFileSync(
      path.join(screenshotDir, 'console_logs.txt'),
      logs.join('\n')
    );
    
    // 保存错误日志
    fs.writeFileSync(
      path.join(screenshotDir, 'errors.txt'),
      errors.join('\n') || '没有检测到错误'
    );
    
    console.log('页面检查完成!');
    console.log(`截图和日志已保存到: ${screenshotDir}`);
  } catch (e) {
    console.error(`发生错误: ${e.message}`);
  } finally {
    console.log('关闭浏览器...');
    await browser.close();
  }
}}

module.exports = { run }; 