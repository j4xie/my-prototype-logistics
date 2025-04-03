// 按钮测试脚本 - 带截图版本
// 版本: 1.0.0
// 这个脚本会测试原型HTML页面上的按钮并捕获页面截图

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 配置
const config = {
  baseUrl: 'http://localhost:8080',
  screenshotsDir: path.join(__dirname, '../reports/screenshots/buttons'),
  reportPath: path.join(__dirname, '../reports/button_test_report.json')
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

// 原型页面路径列表
const prototypePages = [
  // 溯源相关页面
  '/pages/trace/trace-map.html',
  '/pages/trace/trace-list.html',
  '/pages/trace/trace-detail.html',
  '/pages/trace/trace-certificate.html',
  '/pages/trace/trace-edit.html',
  
  // 首页与认证相关页面
  '/pages/home/home-selector.html',
  '/pages/home/home-farming.html',
  '/pages/home/home-processing.html',
  '/pages/home/home-logistics.html',
  '/pages/home/home-admin.html',
  '/pages/auth/login.html',
  '/pages/auth/register.html',
  '/pages/auth/forgot-password.html',
  '/pages/auth/reset-password.html',
  
  // 养殖管理页面
  '/pages/farming/farming-breeding.html',
  '/pages/farming/farming-feeding.html',
  '/pages/farming/farming-health.html',
  '/pages/farming/farming-environment.html',
  '/pages/farming/farming-statistics.html',
  '/pages/farming/farming-monitor.html',
  '/pages/farming/farming-vaccine.html',
  '/pages/farming/create-trace.html',
  
  // 加工管理页面
  '/pages/processing/processing-slaughter.html',
  '/pages/processing/processing-quality.html',
  '/pages/processing/processing-environment.html',
  '/pages/processing/processing-reports.html',
  
  // 物流管理页面
  '/pages/logistics/logistics-create.html',
  '/pages/logistics/logistics-list.html',
  '/pages/logistics/logistics-detail.html',
  '/pages/logistics/vehicle-monitor.html',
  '/pages/logistics/client-management.html',
  
  // 个人档案页面
  '/pages/profile/profile.html',
  '/pages/profile/notifications.html',
  '/pages/profile/settings.html',
  
  // 系统管理页面
  '/pages/admin/admin-dashboard.html',
  '/pages/admin/admin-system.html',
  '/pages/admin/admin-users.html',
  
  // 其他页面
  '/pages/product-trace.html'
];

/**
 * 检测页面是否为目录列表页面
 * @param {Object} page - Playwright页面对象
 * @returns {Promise<boolean>} 如果是目录列表页面返回true，否则返回false
 */
async function isDirectoryListingPage(page) {
  const title = await page.title();
  
  // 检查是否包含典型的目录列表标题
  if (title.includes('Index of') || title.includes('目录') || title === '') {
    return true;
  }
  
  // 检查是否有目录列表特有的结构元素
  const hasIndexHeader = await page.locator('h1:has-text("Index of")').count() > 0;
  const hasDirectoryTable = await page.locator('table tr th:has-text("Name")').count() > 0;
  
  return hasIndexHeader || hasDirectoryTable;
}

/**
 * 检测页面上的按钮元素
 * @param {Object} page - Playwright页面对象
 * @returns {Promise<Array>} 按钮元素信息数组
 */
async function detectButtons(page) {
  return await page.evaluate(() => {
    // 选择器 - 找到所有可能的按钮元素
    const buttonElements = [
      // 标准按钮
      ...Array.from(document.querySelectorAll('button:not([disabled])')),
      // role="button"的元素
      ...Array.from(document.querySelectorAll('[role="button"]:not([disabled])')),
      // 具有特定类名的可点击元素
      ...Array.from(document.querySelectorAll('.btn, .button, .tab-button, .module-card')),
      // 具有点击事件的链接
      ...Array.from(document.querySelectorAll('a[href="#"], a[onclick]')),
      // 可点击的图标和标签
      ...Array.from(document.querySelectorAll('.clickable, [data-action]'))
    ];
    
    // 过滤隐藏元素和太小的元素
    const visibleButtons = buttonElements.filter(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      // 排除隐藏元素
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      
      // 排除太小的元素 (可能是图标而非按钮)
      if (rect.width < 20 || rect.height < 20) {
        return false;
      }
      
      return true;
    });
    
    // 去重 (一个元素可能被多个选择器匹配)
    const uniqueButtons = [...new Set(visibleButtons)];
    
    // 提取每个按钮的信息
    return uniqueButtons.map(button => {
      // 获取按钮文本内容
      const text = button.innerText || button.textContent || '';
      return {
        text: text.trim(),
        tagName: button.tagName,
        classes: button.className,
        id: button.id,
        disabled: button.disabled || button.getAttribute('aria-disabled') === 'true',
        rect: {
          x: button.getBoundingClientRect().x,
          y: button.getBoundingClientRect().y, 
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height
        }
      };
    });
  });
}

/**
 * 测试一个页面上的所有按钮
 * @param {Object} page - Playwright页面对象
 * @param {string} pagePath - 页面路径
 * @returns {Promise<Object>} 测试结果
 */
async function testPage(page, pagePath) {
  const url = `${config.baseUrl}${pagePath}`;
  console.log(`测试页面: ${pagePath}`);
  
  try {
    // 导航到页面
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 检查是否是目录列表页面
    const isDirListing = await isDirectoryListingPage(page);
    if (isDirListing) {
      console.log(`  跳过目录列表页面: ${pagePath}`);
      return {
        path: pagePath,
        isPrototype: false,
        isDirectoryListing: true,
        buttons: [],
        error: null,
        screenshot: null
      };
    }
    
    // 获取页面标题
    const title = await page.title();
    
    // 截图
    const screenshotFileName = `${pagePath.replace(/\//g, '_').replace(/\.html$/, '')}.png`;
    const screenshotPath = path.join(config.screenshotsDir, screenshotFileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // 检测按钮
    const buttons = await detectButtons(page);
    console.log(`  检测到 ${buttons.length} 个按钮`);
    
    return {
      path: pagePath,
      isPrototype: true,
      isDirectoryListing: false,
      title: title,
      buttons: buttons,
      error: null,
      screenshot: screenshotFileName
    };
  } catch (error) {
    console.error(`  测试页面时出错: ${error.message}`);
    return {
      path: pagePath,
      isPrototype: false,
      isDirectoryListing: false,
      buttons: [],
      error: error.message,
      screenshot: null
    };
  }
}

async function run() {
  console.log('开始按钮测试，将捕获页面截图...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const results = [];
    
    for (const pagePath of prototypePages) {
      const result = await testPage(page, pagePath);
      results.push(result);
    }
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: config.baseUrl,
      results: results,
      status: 'success',
      summary: {
        totalPages: results.length,
        totalButtons: results.reduce((sum, r) => sum + r.buttons.length, 0),
        errorPages: results.filter(r => r.error).length
      }
    };
    
    // 保存报告
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    
    return report;
  } catch (error) {
    console.error('测试过程中出错:', error);
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: 'failed'
    };
  } finally {
    await browser.close();
  }
}

module.exports = { run }; 
 