/**
 * 食品溯源系统 - 资源加载测试脚本
 * 
 * 本脚本用于检查页面中的资源是否正确加载，特别是图标和样式资源。
 * 测试修复后的路径计算逻辑是否能够正确加载资源。
 * 
 * @version 1.0.0
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 设置测试报告目录
const reportsDir = path.join(__dirname, '..', 'reports', 'resource-tests');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 定义基本URL和页面路径
const BASE_URL = 'http://localhost:8888';
const PAGES_TO_TEST = [
  '/pages/trace/trace-map.html',
  '/pages/home/home-selector.html',
  '/pages/auth/login.html'
];

// 主测试函数
async function checkResourceLoading() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 创建测试报告
  const reportPath = path.join(reportsDir, `resource-test-report-${new Date().toISOString().replace(/:/g, '-')}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPages: PAGES_TO_TEST.length,
      testedPages: 0,
      pagesWithErrors: 0,
      totalResources: 0,
      failedResources: 0
    },
    pageResults: []
  };
  
  try {
    // 为每个页面运行测试
    for (const pagePath of PAGES_TO_TEST) {
      const pageUrl = `${BASE_URL}${pagePath}`;
      console.log(`测试页面: ${pageUrl}`);
      
      const pageReport = {
        url: pageUrl,
        resources: {
          total: 0,
          failed: 0,
          items: []
        },
        networkRequests: [],
        consoleMessages: []
      };
      
      // 收集控制台消息
      page.on('console', message => {
        const text = message.text();
        pageReport.consoleMessages.push({
          type: message.type(),
          text: text
        });
      });
      
      // 监听网络请求
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/icons/') || url.includes('.css') || url.includes('.js')) {
          pageReport.networkRequests.push({
            url: url,
            resourceType: request.resourceType(),
            method: request.method(),
            status: 'pending'
          });
        }
      });
      
      // 监听网络响应
      page.on('response', response => {
        const url = response.url();
        const status = response.status();
        
        // 更新对应请求的状态
        const requestIndex = pageReport.networkRequests.findIndex(r => r.url === url);
        if (requestIndex !== -1) {
          pageReport.networkRequests[requestIndex].status = status;
          
          // 如果是资源文件且加载失败
          if (status >= 400) {
            pageReport.resources.failed++;
            pageReport.resources.items.push({
              url: url,
              status: status,
              success: false
            });
          } else if (status === 200) {
            pageReport.resources.items.push({
              url: url,
              status: status,
              success: true
            });
          }
        }
      });
      
      // 导航到页面
      await page.goto(pageUrl, { waitUntil: 'networkidle' });
      
      // 检查页面中的图片资源
      const imgSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          isLoaded: img.complete && img.naturalWidth > 0
        }));
      });
      
      // 更新资源数据
      pageReport.resources.total = imgSrcs.length + pageReport.resources.items.length;
      
      // 统计失败的图片
      const failedImages = imgSrcs.filter(img => !img.isLoaded);
      pageReport.resources.failed += failedImages.length;
      
      // 添加图片资源到报告
      imgSrcs.forEach(img => {
        pageReport.resources.items.push({
          url: img.src,
          type: 'image',
          success: img.isLoaded,
          dimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        });
      });
      
      // 更新报告
      report.pageResults.push(pageReport);
      report.summary.testedPages++;
      report.summary.totalResources += pageReport.resources.total;
      report.summary.failedResources += pageReport.resources.failed;
      
      if (pageReport.resources.failed > 0) {
        report.summary.pagesWithErrors++;
      }
      
      console.log(`页面测试完成: ${pagePath}`);
      console.log(`资源总数: ${pageReport.resources.total}, 失败: ${pageReport.resources.failed}`);
    }
    
    // 保存测试报告
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`测试报告已保存至: ${reportPath}`);
    
    // 打印简要总结
    console.log('\n--- 资源加载测试报告摘要 ---');
    console.log(`总页面数: ${report.summary.testedPages}`);
    console.log(`有错误的页面数: ${report.summary.pagesWithErrors}`);
    console.log(`总资源数: ${report.summary.totalResources}`);
    console.log(`失败资源数: ${report.summary.failedResources}`);
    console.log(`成功率: ${((report.summary.totalResources - report.summary.failedResources) / report.summary.totalResources * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  } finally {
    await browser.close();
  }
}

// 运行测试
checkResourceLoading().catch(console.error); 