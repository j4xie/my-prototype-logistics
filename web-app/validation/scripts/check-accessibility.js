const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const axe = require('axe-core');

const config = {
  baseUrl: 'http://localhost:8080/',
  reportPath: path.join(__dirname, '../reports/accessibility_report.json'),
  screenshotDir: path.join(__dirname, '../screenshots')
};

// 确保目录存在
if (!fs.existsSync(config.screenshotDir)) {
  fs.mkdirSync(config.screenshotDir, { recursive: true });
}

async function run(options = {}) {
  console.log('开始可访问性检查...');
  
  // 合并选项
  const mergedConfig = {
    ...config,
    ...options
  };
  
  let browser;
  
  try {
    // 启动浏览器
    browser = await chromium.launch({
      headless: true
    });
    
    // 创建新上下文
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log(`访问页面: ${mergedConfig.baseUrl}`);
    await page.goto(mergedConfig.baseUrl, { waitUntil: 'domcontentloaded' });
    
    // 等待页面完全加载
    await page.waitForTimeout(3000);
    
    // 注入axe-core库
    await page.addScriptTag({
      content: axe.source
    });
    
    // 运行辅助功能检查
    const accessibilityViolations = await page.evaluate(() => {
      return new Promise(resolve => {
        axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'best-practice']
          }
        }, (err, results) => {
          if (err) resolve({ error: err.message });
          resolve(results);
        });
      });
    });
    
    // 捕获屏幕截图
    const screenshotPath = path.join(mergedConfig.screenshotDir, 'accessibility_test.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      url: mergedConfig.baseUrl,
      violations: accessibilityViolations.violations || [],
      passes: accessibilityViolations.passes || [],
      violationCount: accessibilityViolations.violations ? accessibilityViolations.violations.length : 0,
      passCount: accessibilityViolations.passes ? accessibilityViolations.passes.length : 0,
      screenshotPath,
      status: accessibilityViolations.violations && accessibilityViolations.violations.length === 0 ? 'success' : 'warning'
    };
    
    // 保存详细报告
    fs.writeFileSync(mergedConfig.reportPath, JSON.stringify(report, null, 2));
    
    console.log(`可访问性检查完成，发现 ${report.violationCount} 个问题，通过 ${report.passCount} 项测试`);
    
    // 生成简化报告，只包含错误信息和修复建议
    const simplifiedViolations = (accessibilityViolations.violations || []).map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      nodes: violation.nodes.map(node => ({
        html: node.html,
        failureSummary: node.failureSummary,
        target: node.target
      }))
    }));
    
    const simplifiedReport = {
      timestamp: report.timestamp,
      url: report.url,
      violationCount: report.violationCount,
      violations: simplifiedViolations,
      status: report.status
    };
    
    const simplifiedReportPath = mergedConfig.reportPath.replace('.json', '_simplified.json');
    fs.writeFileSync(simplifiedReportPath, JSON.stringify(simplifiedReport, null, 2));
    
    return simplifiedReport;
    
  } catch (error) {
    console.error('可访问性检查失败:', error);
    
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