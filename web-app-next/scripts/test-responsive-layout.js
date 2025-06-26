#!/usr/bin/env node

/**
 * 响应式布局测试脚本
 * 验证页面在不同屏幕尺寸下的布局表现
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 测试页面列表
const testPages = [
  { name: '存储管理', url: '/processing/storage' },
  { name: '疫苗管理', url: '/farming/vaccine' },
  { name: '预览系统', url: '/preview' },
  { name: '登录页面', url: '/login' }
];

// 不同屏幕尺寸
const viewports = [
  { name: '手机', width: 375, height: 667 },
  { name: '平板', width: 768, height: 1024 },
  { name: '桌面', width: 1200, height: 800 },
  { name: '大屏', width: 1920, height: 1080 }
];

async function testResponsiveLayout() {
  console.log('🚀 开始响应式布局测试...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  try {
    for (const page of testPages) {
      console.log(`📱 测试页面: ${page.name} (${page.url})`);

      for (const viewport of viewports) {
        console.log(`  📏 ${viewport.name} (${viewport.width}x${viewport.height})`);

        const tab = await browser.newPage();
        await tab.setViewport({
          width: viewport.width,
          height: viewport.height
        });

        try {
          // 访问页面
          await tab.goto(`http://localhost:3000${page.url}`, {
            waitUntil: 'networkidle0',
            timeout: 10000
          });

          // 等待页面渲染
          await tab.waitForTimeout(2000);

          // 检查布局宽度
          const layoutInfo = await tab.evaluate(() => {
            const body = document.body;
            const main = document.querySelector('main') || body;
            const container = document.querySelector('[class*="ResponsiveContainer"]') ||
                            document.querySelector('[class*="max-w"]') || main;

            return {
              bodyWidth: body.offsetWidth,
              containerWidth: container.offsetWidth,
              containerMaxWidth: window.getComputedStyle(container).maxWidth,
              isFullWidth: container.offsetWidth > 400, // 检查是否突破了390px限制
              hasResponsiveClass: container.className.includes('ResponsiveContainer') ||
                                container.className.includes('max-w-') &&
                                !container.className.includes('max-w-[390px]')
            };
          });

          const result = {
            page: page.name,
            viewport: viewport.name,
            ...layoutInfo,
            success: layoutInfo.isFullWidth && layoutInfo.hasResponsiveClass
          };

          results.push(result);

          console.log(`    ✅ 容器宽度: ${layoutInfo.containerWidth}px ${result.success ? '(已修复)' : '(需要修复)'}`);

          // 截图保存
          const screenshotPath = `./scripts/reports/layout-test-${page.name.replace(/[^a-zA-Z0-9]/g, '')}-${viewport.name}.png`;
          await tab.screenshot({ path: screenshotPath, fullPage: true });

        } catch (error) {
          console.log(`    ❌ 错误: ${error.message}`);
          results.push({
            page: page.name,
            viewport: viewport.name,
            error: error.message,
            success: false
          });
        }

        await tab.close();
      }

      console.log('');
    }

  } finally {
    await browser.close();
  }

  // 生成测试报告
  generateReport(results);
}

function generateReport(results) {
  console.log('📊 生成测试报告...\n');

  // 创建报告目录
  const reportsDir = './scripts/reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 统计结果
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;

  console.log(`总测试数: ${totalTests}`);
  console.log(`成功: ${successfulTests} ✅`);
  console.log(`失败: ${failedTests} ❌`);
  console.log(`成功率: ${((successfulTests / totalTests) * 100).toFixed(1)}%\n`);

  // 失败的测试详情
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('❌ 需要修复的页面:');
    failures.forEach(failure => {
      console.log(`  - ${failure.page} (${failure.viewport}): ${failure.error || '布局未适配'}`);
    });
    console.log('');
  }

  // 保存JSON报告
  const reportPath = path.join(reportsDir, 'responsive-layout-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { totalTests, successfulTests, failedTests },
    results
  }, null, 2));

  console.log(`📝 详细报告已保存: ${reportPath}`);
}

// 运行测试
if (require.main === module) {
  testResponsiveLayout().catch(console.error);
}

module.exports = { testResponsiveLayout };
