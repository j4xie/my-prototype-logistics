const { chromium } = require('@playwright/test');


const config = {
  baseUrl: 'http://localhost:8080',
  screenshotsDir: path.join(__dirname, '../reports/screenshots/check-links'),
  reportPath: path.join(__dirname, '../reports/check-links_report.json')
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
  console.log('启动浏览器检查页面链接...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('正在打开页面: http://localhost:8888/');
    await page.goto('http://localhost:8888/', { waitUntil: 'networkidle' });
    
    console.log('获取页面标题...');
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    console.log('检查所有链接...');
    const links = await page.$$('a');
    console.log(`找到 ${links.length} 个链接`);
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = await link.innerText();
      const href = await link.getAttribute('href');
      
      console.log(`链接 ${i+1}: ${text} -> ${href}`);
      
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          console.log(`  点击链接: ${text}`);
          await Promise.all([
            page.waitForNavigation({ timeout: 5000 }).catch(e => console.log(`  导航超时: ${e.message}`)),
            link.click({ force: true })
          ]);
          
          console.log(`  成功导航到: ${await page.url()}`);
          
          // 返回主页
          console.log('  返回主页');
          await page.goto('http://localhost:8888/', { waitUntil: 'networkidle' });
          
          // 重新获取链接以防DOM结构变化
          const newLinks = await page.$$('a');
          links.length = 0;
          links.push(...newLinks);
        } catch (e) {
          console.error(`  点击链接错误: ${e.message}`);
        }
      } else {
        console.log(`  跳过非HTTP链接`);
      }
    }
    
    console.log('链接检查完成!');
  } catch (e) {
    console.error(`发生错误: ${e.message}`);
  } finally {
    console.log('关闭浏览器...');
    await browser.close();
  }
}}

module.exports = { run }; 