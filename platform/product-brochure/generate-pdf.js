const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function generateBrochure() {
  console.log('🚀 启动浏览器...');

  const browser = await chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 3508, height: 2480 }  // A4 landscape at 300dpi
    });

    const page = await context.newPage();

    const htmlPath = path.join(__dirname, 'index.html');
    console.log(`📄 加载 HTML: ${htmlPath}`);

    await page.goto(`file://${htmlPath}`, {
      waitUntil: 'networkidle'
    });

    // 等待字体和样式完全加载
    console.log('⏳ 等待页面渲染...');
    await page.waitForTimeout(3000);

    // 确保输出目录存在
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成电子版PDF（RGB，优化文件大小）
    console.log('📝 生成电子版PDF...');
    const electronPath = path.join(outputDir, 'product-brochure.pdf');
    await page.pdf({
      path: electronPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    const electronStats = fs.statSync(electronPath);
    const electronSizeMB = (electronStats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ 电子版PDF生成成功: ${electronPath}`);
    console.log(`   文件大小: ${electronSizeMB} MB`);

    // 生成打印版PDF（添加打印优化CSS）
    console.log('📝 生成打印版PDF...');
    await page.addStyleTag({ path: path.join(__dirname, 'css/print.css') });

    const printPath = path.join(outputDir, 'product-brochure-print.pdf');
    await page.pdf({
      path: printPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    const printStats = fs.statSync(printPath);
    const printSizeMB = (printStats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ 打印版PDF生成成功: ${printPath}`);
    console.log(`   文件大小: ${printSizeMB} MB`);

    console.log('\n🎉 所有PDF生成完成！');
    console.log('\n📊 生成摘要：');
    console.log(`   - 电子版: ${electronSizeMB} MB`);
    console.log(`   - 打印版: ${printSizeMB} MB`);
    console.log(`\n📁 输出目录: ${outputDir}`);

  } catch (error) {
    console.error('❌ PDF生成失败:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// 运行生成函数
generateBrochure().catch(error => {
  console.error('❌ 发生错误:', error);
  process.exit(1);
});
