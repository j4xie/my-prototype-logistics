/**
 * 按钮升级报告生成器
 * 版本: 1.0.0
 * 用于生成按钮升级前后的对比报告
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 配置
const config = {
  baseUrl: 'http://localhost:8080',
  reportsDir: path.join(__dirname, '../../reports'),
  screenshotsDir: path.join(__dirname, '../../reports/screenshots/button-upgrades'),
  upgradeJsonReport: path.join(__dirname, '../../reports/button_upgrade_report.json'),
  upgradeHtmlReport: path.join(__dirname, '../../reports/button_upgrade_report.html'),
  pagesListPath: path.join(__dirname, '../../reports/test_pages_list.json')
};

// 确保目录存在
if (!fs.existsSync(config.reportsDir)) {
  fs.mkdirSync(config.reportsDir, { recursive: true });
}
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

/**
 * 运行按钮升级测试并生成报告
 */
async function runUpgradeReport() {
  console.log('开始生成按钮升级报告...');
  let browser;
  let beforeData, afterData;
  
  try {
    // 获取之前的测试数据（如果有）
    try {
      const previousReportPath = path.join(config.reportsDir, 'button_improvements_report.json');
      if (fs.existsSync(previousReportPath)) {
        const rawData = fs.readFileSync(previousReportPath, 'utf8');
        beforeData = JSON.parse(rawData);
        console.log('已加载之前的按钮测试数据');
      } else {
        console.log('未找到之前的按钮测试报告，将只生成升级后的状态报告');
      }
    } catch (error) {
      console.error('读取之前的测试报告失败:', error);
    }
    
    // 获取页面列表
    let pages = [];
    try {
      if (fs.existsSync(config.pagesListPath)) {
        pages = JSON.parse(fs.readFileSync(config.pagesListPath, 'utf8'));
      } else {
        // 默认测试页面
        pages = [
          '/pages/auth/login.html',
          '/pages/trace/trace-map.html',
          '/pages/trace/trace-list.html',
          '/pages/trace/trace-detail.html',
          '/pages/home/home-selector.html',
          '/pages/product-trace.html',
          '/pages/demo/button-demo.html'
        ];
      }
    } catch (error) {
      console.error('读取页面列表失败:', error);
      // 回退到默认页面
      pages = [
        '/pages/auth/login.html',
        '/pages/trace/trace-map.html',
        '/pages/trace/trace-list.html'
      ];
    }
    
    console.log(`将测试 ${pages.length} 个页面`);
    
    // 启动浏览器
    browser = await chromium.launch({
      headless: true
    });
    
    // 创建上下文并启用JavaScript控制台日志捕获
    const context = await browser.newContext({
      logger: {
        isEnabled: () => true,
        log: (name, severity, message) => {
          if (name === 'api' && severity === 'warning') {
            console.log(`[Browser Warning] ${message}`);
          }
        }
      }
    });
    
    // 监听控制台消息
    context.on('console', msg => {
      const text = msg.text();
      if (text.includes('按钮自动升级') || text.includes('Button upgrade')) {
        console.log(`[浏览器控制台] ${text}`);
      }
    });
    
    // 创建报告数据结构
    afterData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalButtons: 0,
        buttonsWithUniqueId: 0,
        buttonsWithAccessibility: 0,
        buttonsWithVisualFeedback: 0,
        newIdsAdded: 0,
        newAccessibilityAdded: 0,
        newVisualFeedbackAdded: 0,
        percentageWithUniqueId: '0%',
        percentageWithAccessibility: '0%',
        percentageWithVisualFeedback: '0%'
      },
      pageResults: {},
      upgradeStats: {
        totalPagesProcessed: 0,
        pagesWithImprovements: 0,
        totalImprovementsMade: 0
      }
    };
    
    // 测试每个页面
    for (const pagePath of pages) {
      try {
        console.log(`\n测试页面: ${pagePath}`);
        const url = `${config.baseUrl}${pagePath}`;
        
        // 创建新的页面
        const page = await context.newPage();
        
        // 进入页面前先收集按钮升级前的数据
        let beforePageStats = null;
        if (beforeData && beforeData.pageResults && beforeData.pageResults[pagePath]) {
          beforePageStats = beforeData.pageResults[pagePath].stats;
        }
        
        // 访问页面
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // 等待页面加载完成，确保按钮升级脚本有足够时间运行
        await page.waitForTimeout(3000);
        
        // 截图
        const screenshotPath = path.join(config.screenshotsDir, `${pagePath.replace(/\//g, '-').replace(/^-/, '')}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // 收集页面上的按钮数据
        const buttonDetails = await page.evaluate(() => {
          // 选择所有按钮和类似按钮的元素
          const buttonSelectors = [
            'button',
            '[role="button"]',
            '.btn', '.button',
            'input[type="submit"]', 'input[type="button"]', 'input[type="reset"]',
            '.trace-button', '.trace-button-primary', '.trace-button-secondary', '.trace-button-danger',
            '.tab-button', '.action-button', '.icon-button',
            '.module-card', '[data-button="true"]',
            'a.btn', 'a.button', 'a[class*="btn-"]', 
            '.nav-link', '.card-link', '.dropdown-item'
          ].join(', ');
          
          const buttonElements = document.querySelectorAll(buttonSelectors);
          
          // 收集按钮数据
          return Array.from(buttonElements).map(button => {
            // 提取按钮文本
            let buttonText = button.textContent || '';
            buttonText = buttonText.trim().substring(0, 50);
            
            // 如果没有文本，尝试使用其他属性
            if (!buttonText) {
              buttonText = button.value || 
                          button.getAttribute('aria-label') || 
                          button.getAttribute('title') || 
                          button.id || 
                          '未命名按钮';
            }
            
            // 收集升级属性
            return {
              id: button.id || '',
              text: buttonText,
              hasUniqueId: (button.id && button.id.length > 0) || 
                           button.hasAttribute('data-has-unique-id'),
              isAccessible: button.hasAttribute('aria-label') || 
                            button.hasAttribute('aria-labelledby') ||
                            button.hasAttribute('data-is-accessible'),
              hasVisualFeedback: button.hasAttribute('data-has-visual-feedback') || 
                                  button.hasAttribute('data-feedback-added'),
              isNewIdAdded: button.hasAttribute('data-upgrade-id-added'),
              isNewAccessibilityAdded: button.hasAttribute('data-upgrade-accessibility-added'),
              isNewFeedbackAdded: button.hasAttribute('data-upgrade-feedback-added'),
              wasUpgraded: button.hasAttribute('data-upgraded'),
              buttonType: button.getAttribute('type') || 'button',
              tagName: button.tagName,
              className: button.className,
              accessibilityLabel: button.getAttribute('aria-label') || '',
              isHidden: button.hasAttribute('hidden') || 
                         window.getComputedStyle(button).display === 'none' ||
                         window.getComputedStyle(button).visibility === 'hidden'
            };
          });
        });
        
        // 计算页面统计数据
        const pageStats = {
          totalButtons: buttonDetails.length,
          visibleButtons: buttonDetails.filter(b => !b.isHidden).length,
          buttonsWithUniqueId: buttonDetails.filter(b => b.hasUniqueId).length,
          buttonsWithAccessibility: buttonDetails.filter(b => b.isAccessible).length,
          buttonsWithVisualFeedback: buttonDetails.filter(b => b.hasVisualFeedback).length,
          newIdsAdded: buttonDetails.filter(b => b.isNewIdAdded).length,
          newAccessibilityAdded: buttonDetails.filter(b => b.isNewAccessibilityAdded).length,
          newVisualFeedbackAdded: buttonDetails.filter(b => b.isNewFeedbackAdded).length,
          buttonsUpgraded: buttonDetails.filter(b => b.wasUpgraded).length
        };
        
        // 计算改进情况
        const improvements = pageStats.newIdsAdded + pageStats.newAccessibilityAdded + pageStats.newVisualFeedbackAdded;
        
        // 创建对比数据
        const comparisonStats = {
          before: beforePageStats || null,
          after: pageStats,
          improvements: {
            totalImprovements: improvements,
            idImprovement: beforePageStats ? 
              ((pageStats.buttonsWithUniqueId - beforePageStats.buttonsWithUniqueId) / beforePageStats.totalButtons * 100).toFixed(2) + '%' : 
              'N/A',
            accessibilityImprovement: beforePageStats ? 
              ((pageStats.buttonsWithAccessibility - beforePageStats.buttonsWithAccessibility) / beforePageStats.totalButtons * 100).toFixed(2) + '%' : 
              'N/A',
            visualFeedbackImprovement: beforePageStats ? 
              ((pageStats.buttonsWithVisualFeedback - beforePageStats.buttonsWithVisualFeedback) / beforePageStats.totalButtons * 100).toFixed(2) + '%' : 
              'N/A'
          }
        };
        
        // 更新报告数据
        afterData.pageResults[pagePath] = {
          url: url,
          stats: pageStats,
          comparison: comparisonStats,
          buttons: buttonDetails
        };
        
        // 更新总体统计
        afterData.summary.totalButtons += pageStats.totalButtons;
        afterData.summary.buttonsWithUniqueId += pageStats.buttonsWithUniqueId;
        afterData.summary.buttonsWithAccessibility += pageStats.buttonsWithAccessibility;
        afterData.summary.buttonsWithVisualFeedback += pageStats.buttonsWithVisualFeedback;
        afterData.summary.newIdsAdded += pageStats.newIdsAdded;
        afterData.summary.newAccessibilityAdded += pageStats.newAccessibilityAdded;
        afterData.summary.newVisualFeedbackAdded += pageStats.newVisualFeedbackAdded;
        
        // 更新升级统计
        afterData.upgradeStats.totalPagesProcessed++;
        if (improvements > 0) {
          afterData.upgradeStats.pagesWithImprovements++;
          afterData.upgradeStats.totalImprovementsMade += improvements;
        }
        
        // 输出当前页面的统计数据
        console.log(`页面按钮统计: ${pagePath}`);
        console.log(`- 按钮总数: ${pageStats.totalButtons} (可见按钮: ${pageStats.visibleButtons})`);
        console.log(`- 具有唯一ID的按钮: ${pageStats.buttonsWithUniqueId}`);
        console.log(`- 具有无障碍属性的按钮: ${pageStats.buttonsWithAccessibility}`);
        console.log(`- 具有视觉反馈的按钮: ${pageStats.buttonsWithVisualFeedback}`);
        console.log(`- 新增唯一ID的按钮: ${pageStats.newIdsAdded}`);
        console.log(`- 新增无障碍属性的按钮: ${pageStats.newAccessibilityAdded}`);
        console.log(`- 新增视觉反馈的按钮: ${pageStats.newVisualFeedbackAdded}`);
        console.log(`- 按钮总升级数: ${pageStats.buttonsUpgraded}`);
        
        // 关闭页面
        await page.close();
      } catch (error) {
        console.error(`测试页面 ${pagePath} 时出错: ${error.message}`);
        // 记录错误信息
        afterData.pageResults[pagePath] = {
          error: error.message,
          buttons: []
        };
      }
    }
    
    // 计算总体百分比
    if (afterData.summary.totalButtons > 0) {
      afterData.summary.percentageWithUniqueId = 
        ((afterData.summary.buttonsWithUniqueId / afterData.summary.totalButtons) * 100).toFixed(2) + '%';
      afterData.summary.percentageWithAccessibility = 
        ((afterData.summary.buttonsWithAccessibility / afterData.summary.totalButtons) * 100).toFixed(2) + '%';
      afterData.summary.percentageWithVisualFeedback = 
        ((afterData.summary.buttonsWithVisualFeedback / afterData.summary.totalButtons) * 100).toFixed(2) + '%';
    }
    
    // 添加对比总结
    if (beforeData && beforeData.summary) {
      afterData.comparison = {
        before: beforeData.summary,
        after: afterData.summary,
        improvements: {
          buttonIdImprovement: ((afterData.summary.buttonsWithUniqueId - beforeData.summary.buttonsWithUniqueId) / beforeData.summary.totalButtons * 100).toFixed(2) + '%',
          accessibilityImprovement: ((afterData.summary.buttonsWithAccessibility - beforeData.summary.buttonsWithAccessibility) / beforeData.summary.totalButtons * 100).toFixed(2) + '%',
          visualFeedbackImprovement: ((afterData.summary.buttonsWithVisualFeedback - beforeData.summary.buttonsWithVisualFeedback) / beforeData.summary.totalButtons * 100).toFixed(2) + '%'
        }
      };
    }
    
    // 输出总体统计
    console.log('\n==== 按钮升级总结 ====');
    console.log(`总按钮数: ${afterData.summary.totalButtons}`);
    console.log(`具有唯一ID的按钮: ${afterData.summary.buttonsWithUniqueId} (${afterData.summary.percentageWithUniqueId})`);
    console.log(`具有无障碍属性的按钮: ${afterData.summary.buttonsWithAccessibility} (${afterData.summary.percentageWithAccessibility})`);
    console.log(`具有视觉反馈的按钮: ${afterData.summary.buttonsWithVisualFeedback} (${afterData.summary.percentageWithVisualFeedback})`);
    console.log(`新增唯一ID的按钮: ${afterData.summary.newIdsAdded}`);
    console.log(`新增无障碍属性的按钮: ${afterData.summary.newAccessibilityAdded}`);
    console.log(`新增视觉反馈的按钮: ${afterData.summary.newVisualFeedbackAdded}`);
    console.log(`总改进数: ${afterData.upgradeStats.totalImprovementsMade}`);
    console.log(`有改进的页面数: ${afterData.upgradeStats.pagesWithImprovements}/${afterData.upgradeStats.totalPagesProcessed}`);
    
    // 如果有对比数据，显示改进情况
    if (afterData.comparison) {
      console.log('\n==== 升级前后对比 ====');
      console.log(`唯一ID覆盖率: ${beforeData.summary.percentageWithUniqueId} -> ${afterData.summary.percentageWithUniqueId} (改进: ${afterData.comparison.improvements.buttonIdImprovement})`);
      console.log(`无障碍属性覆盖率: ${beforeData.summary.percentageWithAccessibility} -> ${afterData.summary.percentageWithAccessibility} (改进: ${afterData.comparison.improvements.accessibilityImprovement})`);
      console.log(`视觉反馈覆盖率: ${beforeData.summary.percentageWithVisualFeedback} -> ${afterData.summary.percentageWithVisualFeedback} (改进: ${afterData.comparison.improvements.visualFeedbackImprovement})`);
    }
    
    // 保存JSON报告
    fs.writeFileSync(config.upgradeJsonReport, JSON.stringify(afterData, null, 2), 'utf8');
    console.log(`JSON报告已保存到: ${config.upgradeJsonReport}`);
    
    // 生成HTML报告
    const htmlReport = generateHtmlReport(afterData);
    fs.writeFileSync(config.upgradeHtmlReport, htmlReport, 'utf8');
    console.log(`HTML报告已保存到: ${config.upgradeHtmlReport}`);
    
    console.log('\n按钮升级报告生成完成');
    
  } catch (error) {
    console.error('运行按钮升级报告时出错:', error);
  } finally {
    // 关闭浏览器
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 生成HTML报告
 * @param {Object} data - 报告数据
 * @return {string} HTML报告
 */
function generateHtmlReport(data) {
  // 格式化时间
  const formattedTime = new Date(data.timestamp).toLocaleString();
  
  // 生成页面详情表格
  let pagesTableRows = '';
  let pageDetailsSections = '';
  
  Object.keys(data.pageResults).forEach(pagePath => {
    const pageData = data.pageResults[pagePath];
    
    // 如果页面有错误，显示错误信息
    if (pageData.error) {
      pagesTableRows += `
        <tr class="error-row">
          <td>${pagePath}</td>
          <td colspan="7">错误: ${pageData.error}</td>
        </tr>
      `;
      return;
    }
    
    const stats = pageData.stats;
    const comparison = pageData.comparison;
    
    // 计算改进百分比字符串
    let idImprovement = '';
    let accessibilityImprovement = '';
    let visualFeedbackImprovement = '';
    
    if (comparison && comparison.before) {
      idImprovement = comparison.improvements.idImprovement !== 'N/A' ? 
        `<span class="improvement">(+${comparison.improvements.idImprovement})</span>` : '';
      
      accessibilityImprovement = comparison.improvements.accessibilityImprovement !== 'N/A' ? 
        `<span class="improvement">(+${comparison.improvements.accessibilityImprovement})</span>` : '';
      
      visualFeedbackImprovement = comparison.improvements.visualFeedbackImprovement !== 'N/A' ? 
        `<span class="improvement">(+${comparison.improvements.visualFeedbackImprovement})</span>` : '';
    }
    
    // 添加页面概览行
    pagesTableRows += `
      <tr class="${comparison && comparison.improvements.totalImprovements > 0 ? 'improved-row' : ''}">
        <td><a href="#${pagePath.replace(/\//g, '-').replace(/\./g, '-')}">${pagePath}</a></td>
        <td>${stats.totalButtons}</td>
        <td>${stats.buttonsWithUniqueId} (${((stats.buttonsWithUniqueId / stats.totalButtons) * 100).toFixed(2)}%) ${idImprovement}</td>
        <td>${stats.buttonsWithAccessibility} (${((stats.buttonsWithAccessibility / stats.totalButtons) * 100).toFixed(2)}%) ${accessibilityImprovement}</td>
        <td>${stats.buttonsWithVisualFeedback} (${((stats.buttonsWithVisualFeedback / stats.totalButtons) * 100).toFixed(2)}%) ${visualFeedbackImprovement}</td>
        <td>${stats.newIdsAdded}</td>
        <td>${stats.newAccessibilityAdded}</td>
        <td>${stats.newVisualFeedbackAdded}</td>
      </tr>
    `;
    
    // 生成页面详情
    let buttonsTable = '';
    
    // 只有当页面有按钮时，才生成按钮表格
    if (pageData.buttons && pageData.buttons.length > 0) {
      // 按钮表格头部
      buttonsTable = `
        <table class="buttons-table">
          <thead>
            <tr>
              <th>按钮ID</th>
              <th>按钮文本</th>
              <th>唯一ID</th>
              <th>无障碍属性</th>
              <th>视觉反馈</th>
              <th>已升级</th>
              <th>标签</th>
              <th>类型</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      // 添加每个按钮的行
      pageData.buttons.forEach(button => {
        buttonsTable += `
          <tr ${button.wasUpgraded ? 'class="upgraded-row"' : ''}>
            <td>${button.id || '无ID'}</td>
            <td>${button.text}</td>
            <td class="${button.hasUniqueId ? 'yes' : 'no'}">${button.hasUniqueId ? '是' : '否'} ${button.isNewIdAdded ? '<span class="new-badge">新</span>' : ''}</td>
            <td class="${button.isAccessible ? 'yes' : 'no'}">${button.isAccessible ? '是' : '否'} ${button.isNewAccessibilityAdded ? '<span class="new-badge">新</span>' : ''}</td>
            <td class="${button.hasVisualFeedback ? 'yes' : 'no'}">${button.hasVisualFeedback ? '是' : '否'} ${button.isNewFeedbackAdded ? '<span class="new-badge">新</span>' : ''}</td>
            <td class="${button.wasUpgraded ? 'yes' : ''}">${button.wasUpgraded ? '是' : '否'}</td>
            <td>${button.accessibilityLabel || '无'}</td>
            <td>${button.tagName.toLowerCase()} ${button.buttonType ? `(${button.buttonType})` : ''}</td>
          </tr>
        `;
      });
      
      // 关闭按钮表格
      buttonsTable += `
          </tbody>
        </table>
      `;
    } else {
      buttonsTable = '<p>此页面没有按钮或未能检测到按钮。</p>';
    }
    
    // 添加页面详情部分
    const pageScreenshot = `/validation/reports/screenshots/button-upgrades/${pagePath.replace(/\//g, '-').replace(/^-/, '')}.png`;
    
    pageDetailsSections += `
      <div id="${pagePath.replace(/\//g, '-').replace(/\./g, '-')}" class="page-details">
        <h3>${pagePath}</h3>
        <p><a href="${pageData.url}" target="_blank">访问页面</a> | <a href="#top">返回顶部</a></p>
        
        <div class="page-stats">
          <h4>页面按钮统计</h4>
          <ul>
            <li>按钮总数: ${stats.totalButtons}</li>
            <li>可见按钮: ${stats.visibleButtons}</li>
            <li>具有唯一ID的按钮: ${stats.buttonsWithUniqueId} (${((stats.buttonsWithUniqueId / stats.totalButtons) * 100).toFixed(2)}%)</li>
            <li>具有无障碍属性的按钮: ${stats.buttonsWithAccessibility} (${((stats.buttonsWithAccessibility / stats.totalButtons) * 100).toFixed(2)}%)</li>
            <li>具有视觉反馈的按钮: ${stats.buttonsWithVisualFeedback} (${((stats.buttonsWithVisualFeedback / stats.totalButtons) * 100).toFixed(2)}%)</li>
            <li>新增唯一ID的按钮: ${stats.newIdsAdded}</li>
            <li>新增无障碍属性的按钮: ${stats.newAccessibilityAdded}</li>
            <li>新增视觉反馈的按钮: ${stats.newVisualFeedbackAdded}</li>
            <li>按钮总升级数: ${stats.buttonsUpgraded}</li>
          </ul>
        </div>
        
        <div class="page-screenshot">
          <h4>页面截图</h4>
          <p><a href="${pageScreenshot}" target="_blank">查看大图</a></p>
          <img src="${pageScreenshot}" alt="${pagePath} 截图" style="max-width: 100%; height: auto;">
        </div>
        
        <div class="buttons-details">
          <h4>按钮详情</h4>
          ${buttonsTable}
        </div>
      </div>
      <hr>
    `;
  });
  
  // 生成改进总结
  let improvementSummary = '';
  if (data.comparison) {
    improvementSummary = `
      <div class="improvement-summary">
        <h3>升级前后对比</h3>
        <table>
          <thead>
            <tr>
              <th>指标</th>
              <th>升级前</th>
              <th>升级后</th>
              <th>改进</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>唯一ID覆盖率</td>
              <td>${data.comparison.before.percentageWithUniqueId}</td>
              <td>${data.comparison.after.percentageWithUniqueId}</td>
              <td class="improvement">${data.comparison.improvements.buttonIdImprovement}</td>
            </tr>
            <tr>
              <td>无障碍属性覆盖率</td>
              <td>${data.comparison.before.percentageWithAccessibility}</td>
              <td>${data.comparison.after.percentageWithAccessibility}</td>
              <td class="improvement">${data.comparison.improvements.accessibilityImprovement}</td>
            </tr>
            <tr>
              <td>视觉反馈覆盖率</td>
              <td>${data.comparison.before.percentageWithVisualFeedback}</td>
              <td>${data.comparison.after.percentageWithVisualFeedback}</td>
              <td class="improvement">${data.comparison.improvements.visualFeedbackImprovement}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
  
  // 完整HTML报告
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>按钮升级报告 - ${formattedTime}</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2, h3 {
        color: #1a5276;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th, td {
        padding: 12px 15px;
        border: 1px solid #ddd;
        text-align: left;
      }
      th {
        background-color: #1a5276;
        color: white;
      }
      tr:nth-child(even) {
        background-color: #f2f2f2;
      }
      .improved-row {
        background-color: #d4efdf;
      }
      .error-row {
        background-color: #f9ebea;
      }
      .upgraded-row {
        background-color: #eaf2f8;
      }
      .yes {
        color: #2ecc71;
        font-weight: bold;
      }
      .no {
        color: #e74c3c;
      }
      .improvement {
        color: #27ae60;
        font-weight: bold;
      }
      .new-badge {
        background-color: #3498db;
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 0.8em;
        margin-left: 5px;
      }
      .summary-card {
        background-color: #f8f9f9;
        border-left: 5px solid #2980b9;
        padding: 15px;
        margin-bottom: 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      .summary-card h3 {
        margin-top: 0;
        color: #2980b9;
      }
      .page-details {
        margin-top: 30px;
      }
      hr {
        border: 0;
        height: 1px;
        background: #ddd;
        margin: 40px 0;
      }
      .buttons-table {
        font-size: 0.9em;
      }
      .toc {
        background-color: #f8f9f9;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 5px;
      }
      .toc h3 {
        margin-top: 0;
      }
      .toc ul {
        margin-bottom: 0;
      }
      a {
        color: #2980b9;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .chart-container {
        width: 100%;
        height: 400px;
        margin-bottom: 30px;
      }
    </style>
  </head>
  <body>
    <div id="top"></div>
    <h1>按钮升级报告</h1>
    <p>生成时间: ${formattedTime}</p>
    
    <div class="summary-card">
      <h3>总体统计</h3>
      <ul>
        <li>总按钮数: ${data.summary.totalButtons}</li>
        <li>具有唯一ID的按钮: ${data.summary.buttonsWithUniqueId} (${data.summary.percentageWithUniqueId})</li>
        <li>具有无障碍属性的按钮: ${data.summary.buttonsWithAccessibility} (${data.summary.percentageWithAccessibility})</li>
        <li>具有视觉反馈的按钮: ${data.summary.buttonsWithVisualFeedback} (${data.summary.percentageWithVisualFeedback})</li>
        <li>新增唯一ID的按钮: ${data.summary.newIdsAdded}</li>
        <li>新增无障碍属性的按钮: ${data.summary.newAccessibilityAdded}</li>
        <li>新增视觉反馈的按钮: ${data.summary.newVisualFeedbackAdded}</li>
      </ul>
    </div>
    
    <div class="summary-card">
      <h3>升级统计</h3>
      <ul>
        <li>总测试页面数: ${data.upgradeStats.totalPagesProcessed}</li>
        <li>有改进的页面数: ${data.upgradeStats.pagesWithImprovements}</li>
        <li>总改进数: ${data.upgradeStats.totalImprovementsMade}</li>
      </ul>
    </div>
    
    ${improvementSummary}
    
    <h2>页面概览</h2>
    <table>
      <thead>
        <tr>
          <th>页面</th>
          <th>按钮总数</th>
          <th>唯一ID</th>
          <th>无障碍属性</th>
          <th>视觉反馈</th>
          <th>新ID</th>
          <th>新无障碍</th>
          <th>新视觉反馈</th>
        </tr>
      </thead>
      <tbody>
        ${pagesTableRows}
      </tbody>
    </table>
    
    <div class="toc">
      <h3>页面目录</h3>
      <ul>
        ${Object.keys(data.pageResults).map(pagePath => 
          `<li><a href="#${pagePath.replace(/\//g, '-').replace(/\./g, '-')}">${pagePath}</a></li>`
        ).join('')}
      </ul>
    </div>
    
    <h2>详细页面报告</h2>
    ${pageDetailsSections}
    
    <footer>
      <p>按钮升级报告由测试框架自动生成。</p>
    </footer>
  </body>
  </html>
  `;
}

// 自动运行报告
runUpgradeReport()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('运行报告出错:', error);
    process.exit(1);
  }); 