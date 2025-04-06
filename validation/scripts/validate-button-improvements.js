/**
 * 按钮改进验证脚本
 * 版本: 2.0.0
 * 检查页面按钮是否符合可用性和无障碍标准
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 配置
const config = {
  baseUrl: 'http://localhost:8080',
  reportsDir: path.join(__dirname, '../reports'),
  screenshotsDir: path.join(__dirname, '../reports/screenshots/button-improvements'),
  pagesDir: path.join(__dirname, '../../pages'),
  jsonReportPath: path.join(__dirname, '../reports/button_improvements_report.json'),
  htmlReportPath: path.join(__dirname, '../reports/button_improvements_report.html')
};

// 确保目录存在
if (!fs.existsSync(config.reportsDir)) {
  fs.mkdirSync(config.reportsDir, { recursive: true });
}
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

// 递归查找所有HTML页面
function findAllHtmlPages(dir, excludePatterns = []) {
  console.log(`查找目录中的HTML页面: ${dir}`);
  
  try {
    const results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      
      // 如果是目录，递归查找
      if (item.isDirectory()) {
        // 忽略node_modules和其他不需要的目录
        if (!item.name.startsWith('.') && item.name !== 'node_modules') {
          const subResults = findAllHtmlPages(itemPath, excludePatterns);
          results.push(...subResults);
        }
      } 
      // 如果是HTML文件
      else if (item.isFile() && item.name.endsWith('.html')) {
        // 检查是否匹配排除模式
        let shouldExclude = false;
        for (const pattern of excludePatterns) {
          if (typeof pattern === 'string' && item.name.includes(pattern)) {
            shouldExclude = true;
            break;
          } else if (pattern instanceof RegExp && pattern.test(item.name)) {
            shouldExclude = true;
            break;
          }
        }
        
        if (!shouldExclude) {
          // 将页面路径转换为URL路径格式
          let urlPath = itemPath.replace(path.join(__dirname, '../../'), '').replace(/\\/g, '/');
          if (!urlPath.startsWith('/')) {
            urlPath = '/' + urlPath;
          }
          results.push(urlPath);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`查找HTML页面时出错: ${error.message}`);
    return [];
  }
}

// 获取要测试的页面列表
async function getPagesList() {
  try {
    // 从pages目录递归查找所有HTML文件
    const allPages = findAllHtmlPages(config.pagesDir, [
      // 排除不需要测试的页面类型
      'test-', 'demo-', 'example', 'template', '_layout'
    ]);
    
    console.log(`找到 ${allPages.length} 个页面需要测试`);
    return allPages;
  } catch (error) {
    console.error(`获取页面列表失败: ${error.message}`);
    // 如果自动查找失败，回退到预定义列表
    return [
      '/pages/auth/login.html',
      '/pages/trace/trace-map.html',
      '/pages/trace/trace-list.html',
      '/pages/trace/trace-detail.html',
      '/pages/home/home-selector.html',
      '/pages/product-trace.html',
      '/pages/admin/admin-products.html',
      '/pages/admin/admin-roles.html',
      '/pages/admin/admin-settings.html',
      '/pages/admin/admin-system.html',
      '/pages/admin/admin-templates.html',
      '/pages/admin/admin-users.html',
      '/pages/admin/data-import.html',
      '/pages/admin/product-register.html',
      '/pages/admin/system-logs.html',
      '/pages/admin/template.html',
      '/pages/admin/user-management.html',
      '/pages/farming/index.html',
      '/pages/processing/index.html',
      '/pages/logistics/index.html',
      '/pages/profile/index.html'
    ];
  }
}

// 验证按钮改进
async function validateButtonImprovements() {
  console.log('开始验证按钮改进...');
  let browser;
  
  try {
    // 获取页面列表
    const pages = await getPagesList();
    console.log(`即将测试 ${pages.length} 个页面`);
    
    // 启动浏览器
    browser = await chromium.launch({
      headless: true
    });
    
    // 创建报告数据结构
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalButtons: 0,
        buttonsWithUniqueId: 0,
        buttonsWithAccessibility: 0,
        buttonsWithVisualFeedback: 0,
        percentageWithUniqueId: '0%',
        percentageWithAccessibility: '0%',
        percentageWithVisualFeedback: '0%'
      },
      pageResults: {}
    };
    
    // 创建浏览器上下文
    const context = await browser.newContext();
    
    // 遍历每个页面进行检查
    for (const pagePath of pages) {
      try {
        const url = `${config.baseUrl}${pagePath}`;
        console.log(`\n正在测试页面: ${pagePath}`);
        
        // 创建新的页面对象
        const page = await context.newPage();
        
        // 访问页面
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        if (!response || response.status() !== 200) {
          console.error(`无法访问页面: ${pagePath}, 状态码: ${response?.status() || 'unknown'}`);
          reportData.pageResults[pagePath] = {
            error: `无法访问页面，状态码: ${response?.status() || 'unknown'}`,
            buttons: []
          };
          await page.close();
          continue;
        }
        
        // 等待页面加载完成，确保所有按钮都已经初始化
        await page.waitForTimeout(2000);
        
        // 截图
        const screenshotPath = path.join(config.screenshotsDir, `${pagePath.replace(/\//g, '-').replace(/^-/, '')}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // 获取页面中所有按钮信息
        const buttonDetails = await page.evaluate(() => {
          // 选择所有按钮和类似按钮的元素
          const buttonElements = document.querySelectorAll(
            'button, [role="button"], .btn, .button, input[type="submit"], input[type="button"], input[type="reset"], ' + 
            '.trace-button, .tab-button, .module-card, [data-button="true"]'
          );
          
          // 收集按钮数据
          return Array.from(buttonElements).map(button => {
            // 提取按钮文本
            let buttonText = button.textContent || '';
            // 修剪文本长度
            buttonText = buttonText.trim().substring(0, 50);
            
            // 如果没有文本，尝试使用其他属性
            if (!buttonText) {
              buttonText = button.value || 
                           button.getAttribute('aria-label') || 
                           button.getAttribute('title') || 
                           button.id || 
                           '未命名按钮';
            }
            
            return {
              id: button.id || '',
              text: buttonText,
              hasUniqueId: button.hasAttribute('data-has-unique-id') || button.hasAttribute('data-upgraded'),
              isAccessible: button.hasAttribute('data-is-accessible') || 
                            button.hasAttribute('aria-label') || 
                            button.hasAttribute('aria-labelledby'),
              hasVisualFeedback: button.hasAttribute('data-has-visual-feedback') || 
                                  button.hasAttribute('data-feedback-added'),
              buttonType: button.getAttribute('type') || 'button',
              tagName: button.tagName,
              className: button.className
            };
          });
        });
        
        // 统计页面上的按钮数量和符合条件的按钮数量
        const pageStats = {
          totalButtons: buttonDetails.length,
          buttonsWithUniqueId: buttonDetails.filter(b => b.hasUniqueId).length,
          buttonsWithAccessibility: buttonDetails.filter(b => b.isAccessible).length,
          buttonsWithVisualFeedback: buttonDetails.filter(b => b.hasVisualFeedback).length
        };
        
        // 更新报告数据
        reportData.pageResults[pagePath] = {
          url: url,
          stats: pageStats,
          buttons: buttonDetails
        };
        
        // 更新总体统计
        reportData.summary.totalButtons += pageStats.totalButtons;
        reportData.summary.buttonsWithUniqueId += pageStats.buttonsWithUniqueId;
        reportData.summary.buttonsWithAccessibility += pageStats.buttonsWithAccessibility;
        reportData.summary.buttonsWithVisualFeedback += pageStats.buttonsWithVisualFeedback;
        
        // 输出当前页面测试结果
        console.log(`页面: ${pagePath}`);
        console.log(`- 按钮总数: ${pageStats.totalButtons}`);
        console.log(`- 具有唯一ID的按钮: ${pageStats.buttonsWithUniqueId}`);
        console.log(`- 具有无障碍属性的按钮: ${pageStats.buttonsWithAccessibility}`);
        console.log(`- 具有视觉反馈的按钮: ${pageStats.buttonsWithVisualFeedback}`);
        
        // 关闭当前页面
        await page.close();
      } catch (error) {
        console.error(`测试页面 ${pagePath} 时出错: ${error.message}`);
        // 记录错误信息
        reportData.pageResults[pagePath] = {
          error: error.message,
          buttons: []
        };
      }
    }
    
    // 计算百分比
    if (reportData.summary.totalButtons > 0) {
      reportData.summary.percentageWithUniqueId = 
        `${((reportData.summary.buttonsWithUniqueId / reportData.summary.totalButtons) * 100).toFixed(2)}%`;
      reportData.summary.percentageWithAccessibility = 
        `${((reportData.summary.buttonsWithAccessibility / reportData.summary.totalButtons) * 100).toFixed(2)}%`;
      reportData.summary.percentageWithVisualFeedback = 
        `${((reportData.summary.buttonsWithVisualFeedback / reportData.summary.totalButtons) * 100).toFixed(2)}%`;
    }
    
    // 输出测试总结
    console.log('\n按钮测试总结:');
    console.log(`总按钮数: ${reportData.summary.totalButtons}`);
    console.log(`具有唯一ID的按钮: ${reportData.summary.buttonsWithUniqueId} (${reportData.summary.percentageWithUniqueId})`);
    console.log(`具有无障碍属性的按钮: ${reportData.summary.buttonsWithAccessibility} (${reportData.summary.percentageWithAccessibility})`);
    console.log(`具有视觉反馈的按钮: ${reportData.summary.buttonsWithVisualFeedback} (${reportData.summary.percentageWithVisualFeedback})`);
    
    // 保存JSON报告
    try {
      fs.writeFileSync(config.jsonReportPath, JSON.stringify(reportData, null, 2), 'utf8');
      console.log(`JSON报告已保存到: ${config.jsonReportPath}`);
    } catch (error) {
      console.error(`保存JSON报告失败: ${error.message}`);
    }
    
    // 生成HTML报告
    try {
      const htmlReport = generateHtmlReport(reportData);
      fs.writeFileSync(config.htmlReportPath, htmlReport, 'utf8');
      console.log(`HTML报告已保存到: ${config.htmlReportPath}`);
    } catch (error) {
      console.error(`生成HTML报告失败: ${error.message}`);
    }
    
    return {
      success: true,
      message: '按钮改进测试完成',
      data: reportData
    };
  } catch (error) {
    console.error(`按钮改进验证失败: ${error.message}`);
    return {
      success: false,
      message: `按钮改进验证失败: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 生成HTML报告
function generateHtmlReport(data) {
  // 制作页面数据表格HTML
  let pagesTableRows = '';
  for (const [pagePath, pageData] of Object.entries(data.pageResults)) {
    if (pageData.error) {
      pagesTableRows += `
        <tr>
          <td>${pagePath}</td>
          <td colspan="4" class="error">${pageData.error}</td>
        </tr>
      `;
    } else {
      const { stats } = pageData;
      const uniqueIdPercentage = stats.totalButtons ? ((stats.buttonsWithUniqueId / stats.totalButtons) * 100).toFixed(2) : '0';
      const accessibilityPercentage = stats.totalButtons ? ((stats.buttonsWithAccessibility / stats.totalButtons) * 100).toFixed(2) : '0';
      const feedbackPercentage = stats.totalButtons ? ((stats.buttonsWithVisualFeedback / stats.totalButtons) * 100).toFixed(2) : '0';
      
      pagesTableRows += `
        <tr>
          <td>
            <a href="${pageData.url}" target="_blank">${pagePath}</a>
            <button class="toggle-details" data-page="${pagePath}">详情</button>
          </td>
          <td>${stats.totalButtons}</td>
          <td>${stats.buttonsWithUniqueId} (${uniqueIdPercentage}%)</td>
          <td>${stats.buttonsWithAccessibility} (${accessibilityPercentage}%)</td>
          <td>${stats.buttonsWithVisualFeedback} (${feedbackPercentage}%)</td>
        </tr>
        <tr class="button-details" id="details-${pagePath.replace(/\//g, '-').replace(/^-/, '')}" style="display: none;">
          <td colspan="5">
            <table class="details-table">
              <thead>
                <tr>
                  <th>按钮文本</th>
                  <th>ID</th>
                  <th>唯一ID</th>
                  <th>无障碍</th>
                  <th>视觉反馈</th>
                  <th>类型</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      // 添加每个按钮的详细信息
      pageData.buttons.forEach(button => {
        pagesTableRows += `
          <tr>
            <td>${button.text}</td>
            <td>${button.id || "无"}</td>
            <td class="${button.hasUniqueId ? 'pass' : 'fail'}">${button.hasUniqueId ? '是' : '否'}</td>
            <td class="${button.isAccessible ? 'pass' : 'fail'}">${button.isAccessible ? '是' : '否'}</td>
            <td class="${button.hasVisualFeedback ? 'pass' : 'fail'}">${button.hasVisualFeedback ? '是' : '否'}</td>
            <td>${button.tagName.toLowerCase()} | ${button.buttonType}</td>
          </tr>
        `;
      });
      
      pagesTableRows += `
              </tbody>
            </table>
          </td>
        </tr>
      `;
    }
  }
  
  // 生成HTML报告
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>按钮改进测试报告</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    h1, h2 {
      color: #2c974b;
    }
    .report-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .summary-card {
      background-color: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .summary-stats {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .stat-card {
      background-color: white;
      border: 1px solid #e1e4e8;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 10px;
      flex: 1;
      min-width: 200px;
      margin-right: 10px;
    }
    .stat-card:last-child {
      margin-right: 0;
    }
    .stat-title {
      font-size: 14px;
      color: #586069;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c974b;
    }
    .stat-percentage {
      font-size: 14px;
      color: #586069;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #e1e4e8;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f6f8fa;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .pass {
      color: #2c974b;
      font-weight: bold;
    }
    .fail {
      color: #cb2431;
    }
    .error {
      color: #cb2431;
      font-style: italic;
    }
    .details-table {
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .details-table th, .details-table td {
      padding: 6px 10px;
      font-size: 0.9em;
    }
    .toggle-details {
      background-color: #f1f8ff;
      border: 1px solid #c8e1ff;
      border-radius: 3px;
      color: #0366d6;
      font-size: 12px;
      padding: 2px 6px;
      margin-left: 10px;
      cursor: pointer;
    }
    .toggle-details:hover {
      background-color: #dbedff;
    }
    .timestamp {
      color: #586069;
      font-size: 14px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>按钮改进测试报告</h1>
    <p class="timestamp">生成时间: ${new Date(data.timestamp).toLocaleString()}</p>
    
    <div class="summary-card">
      <h2>测试总结</h2>
      <p>此报告评估了页面按钮的实现是否符合最佳实践标准，包括唯一ID、无障碍属性和视觉反馈效果。</p>
      
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-title">总按钮数</div>
          <div class="stat-value">${data.summary.totalButtons}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-title">具有唯一ID的按钮</div>
          <div class="stat-value">${data.summary.buttonsWithUniqueId}</div>
          <div class="stat-percentage">${data.summary.percentageWithUniqueId}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-title">具有无障碍属性的按钮</div>
          <div class="stat-value">${data.summary.buttonsWithAccessibility}</div>
          <div class="stat-percentage">${data.summary.percentageWithAccessibility}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-title">具有视觉反馈的按钮</div>
          <div class="stat-value">${data.summary.buttonsWithVisualFeedback}</div>
          <div class="stat-percentage">${data.summary.percentageWithVisualFeedback}</div>
        </div>
      </div>
    </div>
    
    <h2>页面详细结果</h2>
    <table>
      <thead>
        <tr>
          <th>页面路径</th>
          <th>按钮总数</th>
          <th>具有唯一ID</th>
          <th>具有无障碍属性</th>
          <th>具有视觉反馈</th>
        </tr>
      </thead>
      <tbody>
        ${pagesTableRows}
      </tbody>
    </table>
  </div>
  
  <script>
    // 添加按钮详情切换功能
    document.querySelectorAll('.toggle-details').forEach(button => {
      button.addEventListener('click', function() {
        const pagePath = this.getAttribute('data-page');
        const detailsId = 'details-' + pagePath.replace(/\\//g, '-').replace(/^-/, '');
        const detailsRow = document.getElementById(detailsId);
        
        if (detailsRow.style.display === 'none') {
          detailsRow.style.display = 'table-row';
          this.textContent = '隐藏';
        } else {
          detailsRow.style.display = 'none';
          this.textContent = '详情';
        }
      });
    });
  </script>
</body>
</html>
  `;
}

// 执行验证
validateButtonImprovements().catch(error => {
  console.error('执行验证脚本时出错:', error);
  process.exit(1);
});

// 导出run函数，供其他脚本调用
module.exports = {
  run: validateButtonImprovements
}; 