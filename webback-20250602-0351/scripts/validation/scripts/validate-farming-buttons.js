/**
 * 农业相关页面按钮属性验证脚本
 * 专门检查farming目录下页面的按钮属性，包括唯一ID和视觉反馈覆盖率
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// 配置项
const config = {
  baseUrl: 'http://localhost:8080',
  outputPath: path.join(__dirname, '../../../validation/reports/farming_buttons_report.json'),
  htmlReportPath: path.join(__dirname, '../../../validation/reports/farming_buttons_report.html'),
  farmingPagesPath: path.join(__dirname, '../../../pages/farming'),
  thresholds: {
    uniqueId: 90, // 唯一ID覆盖率阈值
    accessibility: 90, // 无障碍属性覆盖率阈值
    visualFeedback: 90 // 视觉反馈覆盖率阈值
  }
};

/**
 * 验证农业相关页面按钮属性
 * 检查farming目录下页面的按钮属性
 */
async function validateFarmingButtons() {
  console.log('开始验证农业相关页面按钮属性...');

  try {
    // 获取farming目录下的所有HTML文件
    const farmingPages = await getFarmingPages();
    console.log(`找到 ${farmingPages.length} 个农业相关页面需要测试`);

    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 结果汇总
    const results = {
      summary: {
        totalButtons: 0,
        buttonsWithUniqueId: 0,
        buttonsWithAccessibility: 0,
        buttonsWithVisualFeedback: 0,
        percentageWithUniqueId: '0%',
        percentageWithAccessibility: '0%',
        percentageWithVisualFeedback: '0%'
      },
      pageResults: {},
      status: {
        uniqueId: false,
        accessibility: false,
        visualFeedback: false,
        overall: false
      }
    };

    // 测试每个页面
    for (const pagePath of farmingPages) {
      console.log(`正在测试页面: ${pagePath}`);
      
      const page = await browser.newPage();
      const url = `${config.baseUrl}/${pagePath}`;
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
      } catch (err) {
        console.error(`无法加载页面 ${url}: ${err.message}`);
        await page.close();
        continue;
      }
      
      // 获取页面按钮
      const buttons = await findButtons(page);
      
      // 将结果添加到汇总中
      const pageStats = {
        totalButtons: buttons.length,
        buttonsWithUniqueId: buttons.filter(btn => btn.hasUniqueId).length,
        buttonsWithAccessibility: buttons.filter(btn => btn.isAccessible).length,
        buttonsWithVisualFeedback: buttons.filter(btn => btn.hasVisualFeedback).length
      };
      
      results.summary.totalButtons += pageStats.totalButtons;
      results.summary.buttonsWithUniqueId += pageStats.buttonsWithUniqueId;
      results.summary.buttonsWithAccessibility += pageStats.buttonsWithAccessibility;
      results.summary.buttonsWithVisualFeedback += pageStats.buttonsWithVisualFeedback;
      
      results.pageResults[pagePath] = {
        url,
        stats: pageStats,
        buttons
      };
      
      console.log(`页面: ${pagePath}`);
      console.log(`- 按钮总数: ${pageStats.totalButtons}`);
      console.log(`- 具有唯一ID的按钮: ${pageStats.buttonsWithUniqueId}`);
      console.log(`- 具有无障碍属性的按钮: ${pageStats.buttonsWithAccessibility}`);
      console.log(`- 具有视觉反馈的按钮: ${pageStats.buttonsWithVisualFeedback}`);
      
      await page.close();
    }
    
    // 关闭浏览器
    await browser.close();
    
    // 计算百分比
    if (results.summary.totalButtons > 0) {
      results.summary.percentageWithUniqueId = `${(results.summary.buttonsWithUniqueId / results.summary.totalButtons * 100).toFixed(2)}%`;
      results.summary.percentageWithAccessibility = `${(results.summary.buttonsWithAccessibility / results.summary.totalButtons * 100).toFixed(2)}%`;
      results.summary.percentageWithVisualFeedback = `${(results.summary.buttonsWithVisualFeedback / results.summary.totalButtons * 100).toFixed(2)}%`;
      
      // 检查是否满足阈值
      const uniqueIdPercentage = results.summary.buttonsWithUniqueId / results.summary.totalButtons * 100;
      const accessibilityPercentage = results.summary.buttonsWithAccessibility / results.summary.totalButtons * 100;
      const visualFeedbackPercentage = results.summary.buttonsWithVisualFeedback / results.summary.totalButtons * 100;
      
      results.status.uniqueId = uniqueIdPercentage >= config.thresholds.uniqueId;
      results.status.accessibility = accessibilityPercentage >= config.thresholds.accessibility;
      results.status.visualFeedback = visualFeedbackPercentage >= config.thresholds.visualFeedback;
      results.status.overall = results.status.uniqueId && results.status.accessibility && results.status.visualFeedback;
    }
    
    // 输出结果
    console.log('\n按钮测试总结:');
    console.log(`总按钮数: ${results.summary.totalButtons}`);
    console.log(`具有唯一ID的按钮: ${results.summary.buttonsWithUniqueId} (${results.summary.percentageWithUniqueId})`);
    console.log(`具有无障碍属性的按钮: ${results.summary.buttonsWithAccessibility} (${results.summary.percentageWithAccessibility})`);
    console.log(`具有视觉反馈的按钮: ${results.summary.buttonsWithVisualFeedback} (${results.summary.percentageWithVisualFeedback})`);
    
    // 保存结果
    fs.writeFileSync(config.outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`JSON报告已保存到: ${config.outputPath}`);
    
    // 生成HTML报告
    generateHtmlReport(results);
    console.log(`HTML报告已保存到: ${config.htmlReportPath}`);
    
    // 返回验证结果
    return results.status.overall;
  } catch (err) {
    console.error(`验证过程出错: ${err.message}`);
    return false;
  }
}

/**
 * 获取farming目录下的所有HTML文件
 * @returns {Promise<string[]>} HTML文件路径数组
 */
async function getFarmingPages() {
  try {
    const files = fs.readdirSync(config.farmingPagesPath);
    return files
      .filter(file => file.endsWith('.html'))
      .map(file => `pages/farming/${file}`);
  } catch (err) {
    console.error(`获取farming页面失败: ${err.message}`);
    return [];
  }
}

/**
 * 在页面中查找所有按钮元素
 * @param {Object} page - Puppeteer页面对象
 * @returns {Promise<Array>} 按钮数组
 */
async function findButtons(page) {
  return await page.evaluate(() => {
    // 查找所有按钮元素
    const buttonElements = [
      ...Array.from(document.querySelectorAll('button')),
      ...Array.from(document.querySelectorAll('a[role="button"]')),
      ...Array.from(document.querySelectorAll('[role="button"]')),
      ...Array.from(document.querySelectorAll('input[type="button"]')),
      ...Array.from(document.querySelectorAll('input[type="submit"]'))
    ];
    
    // 去重
    const uniqueButtons = [...new Set(buttonElements)];
    
    return uniqueButtons.map(btn => {
      // 获取按钮属性
      const id = btn.id || '';
      const text = btn.innerText || btn.value || '';
      const classList = Array.from(btn.classList || []);
      const tagName = btn.tagName || '';
      const className = btn.className || '';
      const buttonType = btn.type || '';
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const role = btn.getAttribute('role') || '';
      const tabindex = btn.getAttribute('tabindex') || '';
      
      // 检查是否有唯一ID
      const hasUniqueId = !!id && id.trim() !== '';
      
      // 检查是否有无障碍属性
      const isAccessible = !!(
        ariaLabel || 
        role === 'button' || 
        tabindex !== null
      );
      
      // 检查是否有视觉反馈
      const hasVisualFeedback = (
        classList.includes('trace-button-hover') &&
        classList.includes('trace-button-focus') &&
        classList.includes('trace-button-active')
      ) || (
        classList.some(cls => cls.includes('hover:')) &&
        classList.some(cls => cls.includes('focus:')) &&
        classList.some(cls => cls.includes('active:'))
      );
      
      return {
        id,
        text,
        hasUniqueId,
        isAccessible,
        hasVisualFeedback,
        buttonType,
        tagName,
        className
      };
    });
  });
}

/**
 * 生成HTML报告
 * @param {Object} results - 测试结果
 */
function generateHtmlReport(results) {
  const statusClass = status => status ? 'pass' : 'fail';
  const statusText = status => status ? '通过' : '未通过';
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>农业相关页面按钮属性验证报告</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .summary {
      background-color: #f8f9fa;
      border-radius: 5px;
      padding: 20px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .pass {
      color: #28a745;
    }
    .fail {
      color: #dc3545;
    }
    .page-section {
      margin-bottom: 30px;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 5px;
    }
    .progress-bar-container {
      width: 100%;
      background-color: #e9ecef;
      border-radius: 5px;
      margin: 5px 0;
    }
    .progress-bar {
      height: 20px;
      border-radius: 5px;
      text-align: center;
      color: white;
      font-weight: bold;
    }
    .progress-bar.good {
      background-color: #28a745;
    }
    .progress-bar.warning {
      background-color: #ffc107;
    }
    .progress-bar.danger {
      background-color: #dc3545;
    }
  </style>
</head>
<body>
  <h1>农业相关页面按钮属性验证报告</h1>
  
  <div class="summary">
    <h2>总体结果</h2>
    <p>测试时间: ${new Date().toLocaleString()}</p>
    <p>总体状态: <span class="${statusClass(results.status.overall)}">${statusText(results.status.overall)}</span></p>
    
    <h3>按钮属性覆盖率</h3>
    <p>按钮总数: ${results.summary.totalButtons}</p>
    
    <div>
      <p>唯一ID覆盖率: ${results.summary.percentageWithUniqueId} (阈值: ${config.thresholds.uniqueId}%) - 
        <span class="${statusClass(results.status.uniqueId)}">${statusText(results.status.uniqueId)}</span>
      </p>
      <div class="progress-bar-container">
        <div class="progress-bar ${getProgressBarClass(results.summary.buttonsWithUniqueId / results.summary.totalButtons * 100)}" 
             style="width: ${results.summary.percentageWithUniqueId}">
          ${results.summary.percentageWithUniqueId}
        </div>
      </div>
    </div>
    
    <div>
      <p>无障碍属性覆盖率: ${results.summary.percentageWithAccessibility} (阈值: ${config.thresholds.accessibility}%) - 
        <span class="${statusClass(results.status.accessibility)}">${statusText(results.status.accessibility)}</span>
      </p>
      <div class="progress-bar-container">
        <div class="progress-bar ${getProgressBarClass(results.summary.buttonsWithAccessibility / results.summary.totalButtons * 100)}" 
             style="width: ${results.summary.percentageWithAccessibility}">
          ${results.summary.percentageWithAccessibility}
        </div>
      </div>
    </div>
    
    <div>
      <p>视觉反馈覆盖率: ${results.summary.percentageWithVisualFeedback} (阈值: ${config.thresholds.visualFeedback}%) - 
        <span class="${statusClass(results.status.visualFeedback)}">${statusText(results.status.visualFeedback)}</span>
      </p>
      <div class="progress-bar-container">
        <div class="progress-bar ${getProgressBarClass(results.summary.buttonsWithVisualFeedback / results.summary.totalButtons * 100)}" 
             style="width: ${results.summary.percentageWithVisualFeedback}">
          ${results.summary.percentageWithVisualFeedback}
        </div>
      </div>
    </div>
  </div>
  
  <h2>页面详情</h2>
  
  ${Object.entries(results.pageResults).map(([pagePath, pageData]) => {
    const uniqueIdPercentage = pageData.stats.buttonsWithUniqueId / pageData.stats.totalButtons * 100;
    const accessibilityPercentage = pageData.stats.buttonsWithAccessibility / pageData.stats.totalButtons * 100;
    const visualFeedbackPercentage = pageData.stats.buttonsWithVisualFeedback / pageData.stats.totalButtons * 100;
    
    return `
      <div class="page-section">
        <h3>${pagePath}</h3>
        <p>URL: ${pageData.url}</p>
        <p>按钮总数: ${pageData.stats.totalButtons}</p>
        
        <div>
          <p>唯一ID覆盖率: ${uniqueIdPercentage.toFixed(2)}%</p>
          <div class="progress-bar-container">
            <div class="progress-bar ${getProgressBarClass(uniqueIdPercentage)}" 
                 style="width: ${uniqueIdPercentage}%">
              ${uniqueIdPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div>
          <p>无障碍属性覆盖率: ${accessibilityPercentage.toFixed(2)}%</p>
          <div class="progress-bar-container">
            <div class="progress-bar ${getProgressBarClass(accessibilityPercentage)}" 
                 style="width: ${accessibilityPercentage}%">
              ${accessibilityPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div>
          <p>视觉反馈覆盖率: ${visualFeedbackPercentage.toFixed(2)}%</p>
          <div class="progress-bar-container">
            <div class="progress-bar ${getProgressBarClass(visualFeedbackPercentage)}" 
                 style="width: ${visualFeedbackPercentage}%">
              ${visualFeedbackPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <h4>按钮详情</h4>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>文本</th>
              <th>唯一ID</th>
              <th>无障碍属性</th>
              <th>视觉反馈</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.buttons.map(button => `
              <tr>
                <td>${button.id || '(无)'}</td>
                <td>${button.text || '(无文本)'}</td>
                <td class="${button.hasUniqueId ? 'pass' : 'fail'}">${button.hasUniqueId ? '✓' : '✗'}</td>
                <td class="${button.isAccessible ? 'pass' : 'fail'}">${button.isAccessible ? '✓' : '✗'}</td>
                <td class="${button.hasVisualFeedback ? 'pass' : 'fail'}">${button.hasVisualFeedback ? '✓' : '✗'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('')}
</body>
</html>`;

  fs.writeFileSync(config.htmlReportPath, html, 'utf-8');
}

/**
 * 获取进度条类名
 * @param {number} percentage - 百分比
 * @returns {string} 类名
 */
function getProgressBarClass(percentage) {
  if (percentage >= 90) return 'good';
  if (percentage >= 60) return 'warning';
  return 'danger';
}

// 如果直接运行脚本则执行验证
if (require.main === module) {
  validateFarmingButtons().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = validateFarmingButtons; 