const { chromium } = require('playwright');
const path = require('path');

async function convertHtmlToPdf() {
  console.log('🚀 启动浏览器...');
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    // Convert index.html
    console.log('📄 转换 index.html...');
    const page1 = await context.newPage();
    await page1.goto(`file://${path.join(__dirname, 'index.html')}`, {
      waitUntil: 'networkidle'
    });

    // 等待页面完全加载
    await page1.waitForTimeout(2000);

    await page1.pdf({
      path: path.join(__dirname, 'index.pdf'),
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: false
    });
    console.log('✅ index.html -> index.pdf');

    // Convert dashboard.html
    console.log('📄 转换 dashboard.html...');
    const page2 = await context.newPage();
    await page2.goto(`file://${path.join(__dirname, 'dashboard.html')}`, {
      waitUntil: 'networkidle'
    });

    // 等待页面完全加载
    await page2.waitForTimeout(2000);

    await page2.pdf({
      path: path.join(__dirname, 'dashboard.pdf'),
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: false
    });
    console.log('✅ dashboard.html -> dashboard.pdf');

  } catch (error) {
    console.error('❌ 转换失败:', error);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('🎉 转换完成！');
  }
}

convertHtmlToPdf();
