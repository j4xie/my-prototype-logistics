const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { assetsConfig } = require('../../config/assets');

// 配置信息
const config = {
  baseUrl: 'http://localhost:8080',
  pages: [
    '/',
    '/pages/trace/trace-map.html',
    '/pages/trace/trace-list.html',
    '/pages/home/home-selector.html'
  ],
  screenshotsDir: path.join(__dirname, '../reports/screenshots/functionality'),
  reportPath: path.join(__dirname, '../reports/functionality_report.json')
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

/**
 * 验证导航菜单
 * @param {Object} page - Playwright页面对象
 * @returns {Promise<Object>} 验证结果
 */
async function validateNavigation(page) {
  console.log('验证导航菜单...');
  
  // 截取导航菜单截图
  const navScreenshotPath = path.join(config.screenshotsDir, 'navigation.png');
  
  try {
    // 尝试多种导航选择器，以适应不同页面的导航结构
    const selectors = [
      '.trace-nav',      // 主导航类
      '.trace-top-nav',  // 顶部导航类
      '#nav-container',  // 导航容器ID
      'nav',             // 标准nav标签
      '[role="navigation"]', // ARIA角色
      'header'           // 通常包含导航的标签
    ];
    
    // 尝试找到一个有效的导航元素
    let navElement = null;
    let foundSelector = null;
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        navElement = element;
        foundSelector = selector;
        console.log(`找到导航元素: ${selector}`);
        break;
      }
    }
    
    // 如果找到了导航元素，则截图并验证
    if (navElement) {
      await navElement.screenshot({ path: navScreenshotPath });
      
      // 检查导航元素内的子元素
      const hasLinks = await page.evaluate(selector => {
        const nav = document.querySelector(selector);
        return nav && (nav.querySelectorAll('a').length > 0 || nav.querySelectorAll('.nav-item').length > 0);
      }, foundSelector);
      
      return {
        name: '导航菜单验证',
        success: true,
        screenshot: navScreenshotPath,
        details: {
          selector: foundSelector,
          hasLinks: hasLinks
        }
      };
    } else {
      // 尝试截取整个页面的顶部区域
      await page.screenshot({ 
        path: navScreenshotPath,
        clip: { x: 0, y: 0, width: await page.evaluate(() => window.innerWidth), height: 200 }
      });
      
      return {
        name: '导航菜单验证',
        success: false,
        screenshot: navScreenshotPath,
        error: '未找到导航菜单元素',
        details: {
          selectors: selectors,
          pageTitle: await page.title()
        }
      };
    }
  } catch (error) {
    console.error('验证导航菜单时出错:', error);
    return {
      name: '导航菜单验证',
      success: false,
      error: `验证导航菜单时出错: ${error.message}`
    };
  }
}

/**
 * 验证资源加载
 * @param {Object} page - Playwright页面对象
 * @returns {Promise<Object>} 验证结果
 */
async function validateResources(page) {
  console.log('验证资源加载...');
  
  // 要监控的特定资源类型
  const resourceTypes = ['script', 'stylesheet', 'image'];
  
  // 存储已请求的资源
  const requestedResources = {
    all: [],
    byType: {}
  };
  
  // 存储失败的资源请求
  const failedResources = [];
  
  // 设置资源请求监听器
  await page.route('**/*', async (route) => {
    const request = route.request();
    const resourceUrl = request.url();
    const resourceType = request.resourceType();
    
    // 添加到所有资源列表
    requestedResources.all.push({
      url: resourceUrl,
      type: resourceType
    });
    
    // 按类型分类
    if (!requestedResources.byType[resourceType]) {
      requestedResources.byType[resourceType] = [];
    }
    requestedResources.byType[resourceType].push(resourceUrl);
    
    // 继续请求
    await route.continue();
  });
  
  // 监听请求失败的资源
  page.on('requestfailed', request => {
    failedResources.push({
      url: request.url(),
      type: request.resourceType(),
      failure: request.failure()?.errorText || 'Unknown error'
    });
  });
  
  // 刷新页面以捕获所有资源请求
  await page.reload({ waitUntil: 'networkidle' });
  
  // 检查关键资源是否已加载
  const criticalResourcesCheck = [];
  
  // 检查关键脚本
  for (const script of assetsConfig.scripts.core) {
    const scriptPath = `${assetsConfig.scripts.base}${script}`;
    const loaded = requestedResources.all.some(r => r.url.includes(script));
    criticalResourcesCheck.push({
      resource: scriptPath,
      loaded: loaded
    });
  }
  
  // 检查关键样式表
  const stylesLoaded = requestedResources.all.some(r => 
    r.url.includes(assetsConfig.styles.common) && r.type === 'stylesheet'
  );
  criticalResourcesCheck.push({
    resource: `${assetsConfig.styles.base}${assetsConfig.styles.common}`,
    loaded: stylesLoaded
  });
  
  return {
    name: '资源加载验证',
    success: failedResources.length === 0,
    details: {
      resourceCounts: {
        total: requestedResources.all.length,
        byType: Object.fromEntries(
          Object.entries(requestedResources.byType).map(([type, urls]) => [type, urls.length])
        )
      },
      criticalResources: criticalResourcesCheck,
      failedResources: failedResources
    }
  };
}

/**
 * 运行功能测试
 */
async function run() {
  console.log('开始功能验证测试...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 选择一个页面进行测试
    const testPage = config.pages[1]; // 使用溯源地图页面
    console.log(`测试页面: ${testPage}`);
    
    await page.goto(`${config.baseUrl}${testPage}`, { waitUntil: 'networkidle' });
    
    // 执行功能测试
    const navigationResult = await validateNavigation(page);
    const resourcesResult = await validateResources(page);
    
    // 组合测试结果
    const testResults = {
      timestamp: new Date().toISOString(),
      page: testPage,
      tests: [
        navigationResult,
        resourcesResult
      ],
      status: (navigationResult.success && resourcesResult.success) ? 'success' : 'failed',
      summary: {
        total: 2,
        passed: [navigationResult, resourcesResult].filter(r => r.success).length,
        failed: [navigationResult, resourcesResult].filter(r => !r.success).length
      }
    };
    
    // 保存报告
    fs.writeFileSync(config.reportPath, JSON.stringify(testResults, null, 2));
    
    console.log('功能验证测试完成');
    return testResults;
    
  } catch (error) {
    console.error('功能验证测试过程中出错:', error);
    
    const errorResult = {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error.message,
      stack: error.stack
    };
    
    // 保存错误报告
    fs.writeFileSync(config.reportPath, JSON.stringify(errorResult, null, 2));
    
    return errorResult;
  } finally {
    await browser.close();
  }
}

module.exports = { run }; 