const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = {
  // 使用file协议访问本地文件
  baseDir: path.resolve(__dirname, '../..'),
  pages: [
    { name: '首页', path: '/index.html' },
    { name: '养殖-监控', path: '/pages/farming/farming-monitor.html' },
    { name: '溯源-地图', path: '/pages/trace/trace-map.html' },
    // 增加更多页面进行测试
    { name: '登录页', path: '/pages/auth/login.html' },
    { name: '功能模块选择', path: '/pages/home/home-selector.html' },
    { name: '养殖管理', path: '/pages/home/home-farming.html' },
    { name: '溯源详情', path: '/pages/trace/trace-detail.html' },
    { name: '溯源列表', path: '/pages/trace/trace-list.html' },
    { name: '系统设置', path: '/pages/profile/settings.html' }
  ],
  // 按资源类型分组检查
  resourceTypes: {
    critical: ['document', 'script', 'stylesheet'], // 关键资源
    media: ['image', 'font', 'media'], // 媒体资源
    other: ['xhr', 'fetch', 'websocket', 'manifest', 'other'] // 其他资源
  },
  screenshotsDir: path.join(__dirname, '../reports/screenshots'),
  reportPath: path.join(__dirname, '../reports/resource_report.json'),
  htmlReportPath: path.join(__dirname, '../reports/resource_report.html'),
  timeout: 60000, // 增加超时时间到60秒
  parallel: false, // 是否并行测试
  maxRetries: 2, // 加载失败重试次数
  verbose: true // 详细输出
};

// 确保目录存在
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

async function run() {
  console.log('启动资源加载验证...');
  console.log('使用配置:', JSON.stringify(config, null, 2));
  
  let browser;
  
  try {
    console.log('正在启动浏览器...');
    browser = await chromium.launch({
      headless: true, // 使用无头模式提高稳定性
      timeout: config.timeout // 增加启动超时
    });
    console.log('浏览器启动成功');
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 } // 设置一个固定的视口
    });
    
    // 收集所有页面的资源请求
    const allResourceRequests = [];
    const allFailedRequests = [];
    const pageResults = [];
    
    // 按资源类型分类统计
    const resourceTypeStats = {
      total: {},
      failed: {}
    };
    
    // 初始化资源类型统计
    Object.keys(config.resourceTypes).forEach(category => {
      config.resourceTypes[category].forEach(type => {
        resourceTypeStats.total[type] = 0;
        resourceTypeStats.failed[type] = 0;
      });
    });

    // 测试每个页面的资源加载情况
    for (let i = 0; i < config.pages.length; i++) {
      const pageConfig = config.pages[i];
      console.log(`\n检查页面 (${i+1}/${config.pages.length}): ${pageConfig.name}`);
      
      const filePath = path.join(config.baseDir, pageConfig.path.replace(/^\//, ''));
      const url = `file://${filePath}`;
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error(`页面文件不存在: ${filePath}`);
        pageResults.push({
          name: pageConfig.name,
          path: pageConfig.path,
          status: 'failed',
          error: '文件不存在',
          resourceCount: 0,
          failedCount: 0
        });
        continue;
      }
      
      // 创建新页面实例以避免之前的页面状态影响
      const page = await context.newPage();
      
      // 收集此页面的网络请求
      const resourceRequests = [];
      const failedRequests = [];
      
      // 监听网络请求
      page.on('request', request => {
        const resourceType = request.resourceType();
        if (config.verbose) {
          console.log(`请求: [${resourceType}] ${request.url()}`);
        }
        
        resourceRequests.push({
          url: request.url(),
          resourceType: resourceType,
          page: pageConfig.name,
          timestamp: new Date().toISOString()
        });
        
        allResourceRequests.push({
          url: request.url(),
          resourceType: resourceType,
          page: pageConfig.name
        });
        
        // 更新资源类型统计
        Object.keys(config.resourceTypes).forEach(category => {
          if (config.resourceTypes[category].includes(resourceType)) {
            resourceTypeStats.total[resourceType] = (resourceTypeStats.total[resourceType] || 0) + 1;
          }
        });
      });
      
      // 监听请求失败
      page.on('requestfailed', request => {
        const resourceType = request.resourceType();
        const failureText = request.failure()?.errorText || '未知错误';
        console.log(`请求失败: [${resourceType}] ${request.url()} - ${failureText}`);
        
        const failedRequest = {
          url: request.url(),
          resourceType: resourceType,
          failure: failureText,
          page: pageConfig.name,
          timestamp: new Date().toISOString()
        };
        
        failedRequests.push(failedRequest);
        allFailedRequests.push(failedRequest);
        
        // 更新失败资源类型统计
        Object.keys(config.resourceTypes).forEach(category => {
          if (config.resourceTypes[category].includes(resourceType)) {
            resourceTypeStats.failed[resourceType] = (resourceTypeStats.failed[resourceType] || 0) + 1;
          }
        });
      });
      
      // 尝试多次加载页面
      let loaded = false;
      let error = null;
      let retries = 0;
      
      while (!loaded && retries <= config.maxRetries) {
        try {
          if (retries > 0) {
            console.log(`重试加载页面 (${retries}/${config.maxRetries}): ${pageConfig.name}`);
          }
          
          console.log('正在访问页面:', url);
          await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: config.timeout // 增加导航超时
          });
          console.log('页面加载完成');
          
          // 等待额外时间以确保所有资源加载完成
          await page.waitForTimeout(2000); 
          
          // 获取页面标题
          const title = await page.title();
          
          // 获取页面元数据
          const metadata = await page.evaluate(() => {
            return {
              title: document.title,
              metaDescription: document.querySelector('meta[name="description"]')?.content || '',
              links: Array.from(document.querySelectorAll('a')).length,
              images: Array.from(document.querySelectorAll('img')).length,
              scripts: Array.from(document.querySelectorAll('script')).length,
              stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).length,
            };
          });
          
          // 截图保存
          const screenshotPath = path.join(config.screenshotsDir, `${pageConfig.name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          
          console.log(`页面 ${pageConfig.name} 资源请求: ${resourceRequests.length}`);
          console.log(`页面 ${pageConfig.name} 失败请求: ${failedRequests.length}`);
          
          // 记录页面结果
          pageResults.push({
            name: pageConfig.name,
            path: pageConfig.path,
            url: url,
            title: title,
            metadata: metadata,
            status: 'success',
            screenshot: screenshotPath,
            resourceCount: resourceRequests.length,
            failedCount: failedRequests.length,
            failureRate: resourceRequests.length > 0 
              ? (failedRequests.length / resourceRequests.length * 100).toFixed(2) + '%' 
              : '0%',
            resourcesByType: analyzeResourcesByType(resourceRequests, config.resourceTypes),
            failedResourcesByType: analyzeResourcesByType(failedRequests, config.resourceTypes)
          });
          
          loaded = true;
        } catch (err) {
          error = err;
          retries++;
          
          if (retries > config.maxRetries) {
            console.error(`页面 ${pageConfig.name} 加载失败:`, err.message);
            
            // 记录失败的页面
            pageResults.push({
              name: pageConfig.name,
              path: pageConfig.path,
              url: url,
              status: 'failed',
              error: err.message,
              resourceCount: resourceRequests.length,
              failedCount: failedRequests.length,
              resourcesByType: analyzeResourcesByType(resourceRequests, config.resourceTypes),
              failedResourcesByType: analyzeResourcesByType(failedRequests, config.resourceTypes)
            });
          }
          
          // 短暂等待后重试
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // 重置事件处理器，避免重复记录
      page.removeAllListeners('request');
      page.removeAllListeners('requestfailed');
      
      // 关闭当前页面
      await page.close();
    }
    
    // 保存资源请求日志
    fs.writeFileSync(
      path.join(config.screenshotsDir, 'resource_requests.json'),
      JSON.stringify(allResourceRequests, null, 2)
    );
    
    // 保存失败请求日志
    fs.writeFileSync(
      path.join(config.screenshotsDir, 'failed_requests.json'),
      JSON.stringify(allFailedRequests, null, 2)
    );
    
    // 计算资源类型统计百分比
    const resourceTypePercentages = {};
    Object.keys(resourceTypeStats.total).forEach(type => {
      const total = resourceTypeStats.total[type] || 0;
      const failed = resourceTypeStats.failed[type] || 0;
      resourceTypePercentages[type] = total > 0 
        ? (failed / total * 100).toFixed(2) + '%'
        : '0%';
    });
    
    // 按URL统计失败资源
    const failedByUrl = {};
    allFailedRequests.forEach(req => {
      failedByUrl[req.url] = failedByUrl[req.url] || {
        url: req.url,
        count: 0,
        pages: new Set(),
        failures: new Set()
      };
      failedByUrl[req.url].count++;
      failedByUrl[req.url].pages.add(req.page);
      failedByUrl[req.url].failures.add(req.failure);
    });
    
    // 转换为数组以便于排序
    const failedResourcesList = Object.values(failedByUrl)
      .map(item => ({
        ...item,
        pages: Array.from(item.pages),
        failures: Array.from(item.failures)
      }))
      .sort((a, b) => b.count - a.count);
    
    // 生成详细的验证报告
    const report = {
      timestamp: new Date().toISOString(),
      totalPages: config.pages.length,
      successPages: pageResults.filter(p => p.status === 'success').length,
      failedPages: pageResults.filter(p => p.status === 'failed').length,
      totalRequests: allResourceRequests.length,
      failedRequests: allFailedRequests.length,
      failureRate: allResourceRequests.length > 0
        ? `${(allFailedRequests.length / allResourceRequests.length * 100).toFixed(2)}%`
        : '0%',
      resourceTypeStats: {
        ...resourceTypeStats,
        percentages: resourceTypePercentages
      },
      pageResults: pageResults,
      failedResourceDetails: allFailedRequests,
      failedResourcesFrequency: failedResourcesList
    };
    
    // 保存JSON报告
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    
    // 生成HTML报告
    generateHtmlReport(report, config.htmlReportPath);
    
    console.log('\n资源加载验证总结:');
    console.log(`总页面数: ${report.totalPages}`);
    console.log(`成功页面: ${report.successPages}`);
    console.log(`失败页面: ${report.failedPages}`);
    console.log(`总资源请求: ${report.totalRequests}`);
    console.log(`失败请求: ${report.failedRequests}`);
    console.log(`失败率: ${report.failureRate}`);
    
    console.log('\n资源类型统计:');
    Object.keys(config.resourceTypes).forEach(category => {
      console.log(`\n${category.toUpperCase()} 资源:`);
      config.resourceTypes[category].forEach(type => {
        const total = resourceTypeStats.total[type] || 0;
        const failed = resourceTypeStats.failed[type] || 0;
        const rate = total > 0 ? (failed / total * 100).toFixed(2) + '%' : '0%';
        console.log(`  - ${type}: ${failed}/${total} (${rate})`);
      });
    });
    
    console.log(`\n详细报告已保存至: ${config.reportPath}`);
    console.log(`HTML报告已保存至: ${config.htmlReportPath}`);
    
    return report;
  } catch (error) {
    console.error('资源加载验证失败:', error);
    
    // 生成错误报告
    const errorReport = {
      timestamp: new Date().toISOString(),
      status: 'error',
      errorMessage: error.message,
      errorStack: error.stack
    };
    
    fs.writeFileSync(config.reportPath, JSON.stringify(errorReport, null, 2));
    
    return errorReport;
  } finally {
    if (browser) {
      await browser.close();
      console.log('浏览器已关闭');
    }
  }
}

/**
 * 按资源类型分析请求
 * @param {Array} requests - 请求数组
 * @param {Object} resourceTypes - 资源类型配置
 * @returns {Object} 按类型分组的请求统计
 */
function analyzeResourcesByType(requests, resourceTypes) {
  const result = {};
  
  Object.keys(resourceTypes).forEach(category => {
    result[category] = {
      count: 0,
      types: {}
    };
    
    resourceTypes[category].forEach(type => {
      result[category].types[type] = {
        count: 0,
        items: []
      };
    });
  });
  
  requests.forEach(req => {
    let matched = false;
    
    Object.keys(resourceTypes).forEach(category => {
      if (resourceTypes[category].includes(req.resourceType)) {
        result[category].count++;
        result[category].types[req.resourceType].count++;
        result[category].types[req.resourceType].items.push(req);
        matched = true;
      }
    });
    
    // 未分类的资源
    if (!matched) {
      if (!result.unclassified) {
        result.unclassified = {
          count: 0,
          types: {}
        };
      }
      
      if (!result.unclassified.types[req.resourceType]) {
        result.unclassified.types[req.resourceType] = {
          count: 0,
          items: []
        };
      }
      
      result.unclassified.count++;
      result.unclassified.types[req.resourceType].count++;
      result.unclassified.types[req.resourceType].items.push(req);
    }
  });
  
  return result;
}

/**
 * 生成HTML报告
 * @param {Object} report - JSON报告对象
 * @param {string} outputPath - 输出文件路径
 */
function generateHtmlReport(report, outputPath) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>资源加载验证报告 - ${new Date(report.timestamp).toLocaleString()}</title>
  <style>
    :root {
      --primary-color: #00467F;
      --secondary-color: #00A0E9;
      --success-color: #4CAF50;
      --warning-color: #FFC107;
      --error-color: #F44336;
      --gray-light: #f5f5f5;
      --gray: #E0E0E0;
    }
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: var(--primary-color);
    }
    .summary {
      background: var(--gray-light);
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0;
    }
    .success { color: var(--success-color); }
    .warning { color: var(--warning-color); }
    .error { color: var(--error-color); }
    .pages {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .page-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .page-header {
      background: var(--primary-color);
      color: white;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .page-content {
      padding: 15px;
    }
    .page-screenshot {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border: 1px solid var(--gray);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid var(--gray);
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: var(--gray-light);
    }
    .resource-bar {
      height: 20px;
      background: var(--gray-light);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 5px;
    }
    .resource-bar-fill {
      height: 100%;
      background: var(--success-color);
    }
    .failed {
      background: var(--error-color);
    }
    .expand-btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .details {
      display: none;
      margin-top: 10px;
    }
    .show {
      display: block;
    }
  </style>
</head>
<body>
  <h1>资源加载验证报告</h1>
  <p>生成时间: ${new Date(report.timestamp).toLocaleString()}</p>
  
  <div class="summary">
    <h2>总体概况</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div>测试页面数</div>
        <div class="stat-value">${report.totalPages}</div>
      </div>
      <div class="stat-card">
        <div>成功页面数</div>
        <div class="stat-value success">${report.successPages}</div>
      </div>
      <div class="stat-card">
        <div>失败页面数</div>
        <div class="stat-value ${report.failedPages > 0 ? 'error' : 'success'}">${report.failedPages}</div>
      </div>
      <div class="stat-card">
        <div>总资源请求数</div>
        <div class="stat-value">${report.totalRequests}</div>
      </div>
      <div class="stat-card">
        <div>失败请求数</div>
        <div class="stat-value ${report.failedRequests > 0 ? 'error' : 'success'}">${report.failedRequests}</div>
      </div>
      <div class="stat-card">
        <div>失败率</div>
        <div class="stat-value ${parseFloat(report.failureRate) > 5 ? 'error' : parseFloat(report.failureRate) > 0 ? 'warning' : 'success'}">${report.failureRate}</div>
      </div>
    </div>

    <h3>资源类型统计</h3>
    <table>
      <thead>
        <tr>
          <th>资源类型</th>
          <th>总数</th>
          <th>失败数</th>
          <th>失败率</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${Object.keys(report.resourceTypeStats.total).map(type => {
          const total = report.resourceTypeStats.total[type] || 0;
          const failed = report.resourceTypeStats.failed[type] || 0;
          const rate = report.resourceTypeStats.percentages[type];
          const status = parseFloat(rate) > 10 ? 'error' : parseFloat(rate) > 0 ? 'warning' : 'success';
          
          return `
        <tr>
          <td>${type}</td>
          <td>${total}</td>
          <td>${failed}</td>
          <td>${rate}</td>
          <td class="${status}">${status.toUpperCase()}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <h2>页面详情</h2>
  <div class="pages">
    ${report.pageResults.map(page => `
    <div class="page-card">
      <div class="page-header">
        <div>${page.name}</div>
        <div class="${page.status === 'success' ? 'success' : 'error'}">${page.status.toUpperCase()}</div>
      </div>
      <div class="page-content">
        ${page.status === 'success' ? `
        <img src="../../../${page.screenshot.split('\\').join('/')}" alt="${page.name} 截图" class="page-screenshot">
        <h3>${page.title || '无标题'}</h3>
        <div>路径: ${page.path}</div>
        <div>资源: ${page.resourceCount} 请求</div>
        <div>失败: ${page.failedCount} 请求 (${page.failureRate})</div>
        
        <div class="resource-bar">
          <div class="resource-bar-fill" style="width: ${100 - parseFloat(page.failureRate)}%"></div>
        </div>
        
        <button class="expand-btn" onclick="toggleDetails('page-${report.pageResults.indexOf(page)}')">显示详情</button>
        <div id="page-${report.pageResults.indexOf(page)}" class="details">
          <h4>资源类型分布</h4>
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>总数</th>
                <th>失败数</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(page.resourcesByType || {}).map(category => `
              <tr>
                <td>${category}</td>
                <td>${page.resourcesByType[category].count}</td>
                <td>${page.failedResourcesByType[category]?.count || 0}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : `
        <div class="error">加载失败: ${page.error}</div>
        <div>路径: ${page.path}</div>
        <div>资源: ${page.resourceCount} 请求</div>
        <div>失败: ${page.failedCount} 请求</div>
        `}
      </div>
    </div>
    `).join('')}
  </div>

  <h2>失败资源频率分析</h2>
  <table>
    <thead>
      <tr>
        <th>URL</th>
        <th>失败次数</th>
        <th>影响页面</th>
        <th>失败原因</th>
      </tr>
    </thead>
    <tbody>
      ${report.failedResourcesFrequency.slice(0, 20).map(item => `
      <tr>
        <td>${item.url}</td>
        <td>${item.count}</td>
        <td>${item.pages.join(', ')}</td>
        <td>${item.failures.join(', ')}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <script>
    function toggleDetails(id) {
      const element = document.getElementById(id);
      element.classList.toggle('show');
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}

if (require.main === module) {
  // 当直接运行此文件时执行测试
  run().catch(console.error);
} else {
  // 作为模块导出
  module.exports = { run };
} 