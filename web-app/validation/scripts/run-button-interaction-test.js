// 按钮交互测试脚本
// 版本: 1.0.0
// 该脚本不仅检测HTML原型页面上的按钮，还会尝试点击它们并记录响应

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 配置
const config = {
  baseUrl: 'http://localhost:8080',
  screenshotsDir: path.join(__dirname, '../reports/screenshots/button-interactions'),
  reportPath: path.join(__dirname, '../reports/button_interaction_report.json'),
  visualReportPath: path.join(__dirname, '../reports/button_interaction_report.html')
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
  '/pages/trace/trace-map.html',
  '/pages/trace/trace-list.html',
  '/pages/trace/trace-detail.html',
  '/pages/home/home-selector.html',
  '/pages/auth/login.html',
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
    
    // 生成唯一的XPath，以便稍后定位元素
    function getXPath(element) {
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }
      
      // 如果没有ID，创建包含位置信息的XPath
      let parts = [];
      let current = element;
      
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = current;
        
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = current.tagName.toLowerCase();
        const position = index > 0 ? `[${index}]` : '';
        parts.unshift(`${tagName}${position}`);
        current = current.parentNode;
      }
      
      return `//${parts.join('/')}`;
    }
    
    // 提取每个按钮的信息
    return uniqueButtons.map((button, index) => {
      // 获取按钮文本内容
      const text = button.innerText || button.textContent || '';
      
      // 创建一个唯一ID (用于引用这个按钮)
      const buttonId = button.id || `button-${index}-${Date.now()}`;
      
      return {
        id: buttonId,
        text: text.trim(),
        tagName: button.tagName,
        classes: button.className,
        xpath: getXPath(button),
        disabled: button.disabled || button.getAttribute('aria-disabled') === 'true',
        rect: {
          x: button.getBoundingClientRect().x,
          y: button.getBoundingClientRect().y, 
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height
        },
        attributes: {
          href: button.getAttribute('href'),
          onclick: button.getAttribute('onclick'),
          role: button.getAttribute('role'),
          type: button.getAttribute('type')
        }
      };
    });
  });
}

/**
 * 对按钮进行交互测试
 * @param {Object} page - Playwright页面对象
 * @param {Object} button - 按钮信息
 * @returns {Promise<Object>} 交互测试结果
 */
async function testButtonInteraction(page, button, pagePath) {
  console.log(`  测试按钮: "${button.text || '无文本'}" (${button.tagName})`);
  
  try {
    // 使用XPath定位按钮
    const buttonElement = page.locator(`xpath=${button.xpath}`);
    
    // 检查按钮是否存在
    const count = await buttonElement.count();
    if (count === 0) {
      return {
        success: false,
        error: '无法通过XPath定位按钮',
        response: null,
        beforeScreenshot: null,
        afterScreenshot: null
      };
    }
    
    // 确保按钮在视野中
    await buttonElement.scrollIntoViewIfNeeded();
    
    // 捕获点击前的截图
    const beforeScreenshotName = `${pagePath.replace(/\//g, '_')}_button_${button.id}_before.png`;
    const beforeScreenshotPath = path.join(config.screenshotsDir, beforeScreenshotName);
    await page.screenshot({ path: beforeScreenshotPath });
    
    // 点击按钮
    await Promise.all([
      // 等待页面网络活动或导航
      Promise.race([
        page.waitForNavigation({ timeout: 2000 }).catch(() => {}),
        page.waitForTimeout(2000) // 如果没有导航，等待2秒查看其他变化
      ]),
      // 点击按钮
      buttonElement.click({ force: true })
    ]);
    
    // 捕获点击后的截图
    const afterScreenshotName = `${pagePath.replace(/\//g, '_')}_button_${button.id}_after.png`;
    const afterScreenshotPath = path.join(config.screenshotsDir, afterScreenshotName);
    await page.screenshot({ path: afterScreenshotPath });
    
    // 检查页面变化
    const newUrl = page.url();
    const isUrlChanged = newUrl !== `${config.baseUrl}${pagePath}`;
    
    return {
      success: true,
      response: {
        urlChanged: isUrlChanged,
        newUrl: isUrlChanged ? newUrl : null
      },
      beforeScreenshot: beforeScreenshotName,
      afterScreenshot: afterScreenshotName
    };
  } catch (error) {
    console.error(`  测试按钮交互时出错: ${error.message}`);
    return {
      success: false,
      error: error.message,
      response: null,
      beforeScreenshot: null,
      afterScreenshot: null
    };
  }
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
    
    // 捕获页面完整截图
    const pageScreenshotName = `${pagePath.replace(/\//g, '_')}_page.png`;
    const pageScreenshotPath = path.join(config.screenshotsDir, pageScreenshotName);
    await page.screenshot({ path: pageScreenshotPath, fullPage: true });
    
    // 检测按钮
    const buttons = await detectButtons(page);
    console.log(`  检测到 ${buttons.length} 个按钮`);
    
    // 测试每个按钮的交互
    const buttonResults = [];
    for (const button of buttons) {
      // 重新加载页面，确保每次测试在相同的状态下进行
      await page.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
      
      const result = await testButtonInteraction(page, button, pagePath);
      buttonResults.push({
        button: button,
        interactionResult: result
      });
    }
    
    return {
      path: pagePath,
      isPrototype: true,
      isDirectoryListing: false,
      title: title,
      buttons: buttonResults,
      error: null,
      pageScreenshot: pageScreenshotName
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

/**
 * 创建HTML可视化报告
 * @param {Object} report - 测试报告数据
 */
function createHtmlReport(report) {
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>按钮交互测试报告 - 食品溯源系统</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        h1, h2, h3 {
            color: #00467F;
        }
        h1 {
            text-align: center;
            border-bottom: 2px solid #00467F;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .page-section {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            padding: 20px;
        }
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .page-info {
            flex: 1;
        }
        .page-stats {
            background-color: #e9f5ff;
            border-radius: 4px;
            padding: 5px 10px;
            color: #00467F;
            font-weight: bold;
        }
        .screenshot-container {
            margin: 20px 0;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 4px;
            max-width: 100%;
            overflow-x: auto;
        }
        .screenshot {
            max-width: 100%;
            height: auto;
            display: block;
        }
        .button-test {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 15px;
            padding: 15px;
        }
        .button-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .button-result {
            padding: 5px 10px;
            border-radius: 4px;
            font-weight: bold;
        }
        .result-success {
            background-color: #d4edda;
            color: #155724;
        }
        .result-failure {
            background-color: #f8d7da;
            color: #721c24;
        }
        .screenshots-row {
            display: flex;
            gap: 20px;
            margin-top: 15px;
        }
        .screenshot-box {
            flex: 1;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
        }
        .screenshot-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #555;
        }
        .summary {
            text-align: center;
            margin-top: 30px;
            background-color: #00467F;
            color: white;
            padding: 15px;
            border-radius: 8px;
        }
        .tag {
            display: inline-block;
            padding: 2px 6px;
            background-color: #e9f5ff;
            color: #00467F;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 5px;
        }
        .button-details {
            margin-top: 10px;
            background-color: #f2f2f2;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .collapsible {
            cursor: pointer;
            padding: 10px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            background-color: #eee;
            margin-top: 10px;
            border-radius: 4px;
        }
        .active, .collapsible:hover {
            background-color: #ddd;
        }
        .content {
            padding: 0 10px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.2s ease-out;
            background-color: #f1f1f1;
            border-radius: 0 0 4px 4px;
        }
    </style>
</head>
<body>
    <h1>按钮交互测试报告 - 食品溯源系统</h1>
    
    <div class="summary">
        <h2>测试总结</h2>
        <p>测试时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}</p>
        <p>总页面数: ${report.results.length}</p>
    </div>
  `;
  
  // 为每个页面生成报告部分
  report.results.forEach((page, pageIndex) => {
    if (page.isPrototype) {
      html += `
    <div class="page-section">
        <div class="page-header">
            <div class="page-info">
                <h2>${page.title || '无标题'}</h2>
                <p>路径: ${page.path}</p>
            </div>
            <div class="page-stats">
                检测到 ${page.buttons.length} 个按钮
            </div>
        </div>
        
        <div class="screenshot-container">
            <h3>页面截图</h3>
            <img src="interaction-screenshots/${page.pageScreenshot}" class="screenshot" alt="${page.path}页面截图">
        </div>
        
        <h3>按钮交互测试结果</h3>
      `;
      
      // 为每个按钮生成测试结果
      page.buttons.forEach((buttonData, buttonIndex) => {
        const { button, interactionResult } = buttonData;
        const isSuccess = interactionResult.success;
        
        html += `
        <div class="button-test">
            <div class="button-header">
                <h4>按钮 #${buttonIndex + 1}: ${button.text || '(无文本)'} <span class="tag">${button.tagName}</span></h4>
                <div class="button-result ${isSuccess ? 'result-success' : 'result-failure'}">
                    ${isSuccess ? '测试成功' : '测试失败'}
                </div>
            </div>
            
            <p><strong>按钮属性:</strong> ID: ${button.id || '(无ID)'}, 类名: ${button.classes}</p>
            
            <button class="collapsible">显示详细信息</button>
            <div class="content">
                <div class="button-details">
                    <pre>${JSON.stringify(button, null, 2)}</pre>
                </div>
            </div>
            
            <p><strong>交互结果:</strong> ${
              isSuccess 
                ? (interactionResult.response.urlChanged 
                    ? `导航到新URL: ${interactionResult.response.newUrl}` 
                    : '页面状态发生变化') 
                : `错误: ${interactionResult.error}`
            }</p>
        `;
        
        // 添加前后截图对比
        if (interactionResult.beforeScreenshot && interactionResult.afterScreenshot) {
          html += `
            <div class="screenshots-row">
                <div class="screenshot-box">
                    <div class="screenshot-title">点击前</div>
                    <img src="interaction-screenshots/${interactionResult.beforeScreenshot}" class="screenshot" alt="点击前截图">
                </div>
                <div class="screenshot-box">
                    <div class="screenshot-title">点击后</div>
                    <img src="interaction-screenshots/${interactionResult.afterScreenshot}" class="screenshot" alt="点击后截图">
                </div>
            </div>
          `;
        }
        
        html += `
        </div>
        `;
      });
      
      html += `
    </div>
      `;
    }
  });
  
  html += `
    <script>
    // 用于折叠面板的脚本
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
      coll[i].addEventListener("click", function() {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.maxHeight) {
          content.style.maxHeight = null;
        } else {
          content.style.maxHeight = content.scrollHeight + "px";
        }
      });
    }
    </script>
</body>
</html>
  `;
  
  return html;
}

async function run() {
  console.log('开始按钮交互测试，将捕获交互前后的页面截图...');
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
        totalButtons: results.reduce((sum, r) => sum + (r.buttons?.length || 0), 0),
        errorPages: results.filter(r => r.error).length,
        interactionErrors: results.reduce((sum, r) => 
          sum + (r.buttons?.filter(b => b.interactionResult?.error)?.length || 0), 0)
      }
    };
    
    // 保存报告
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    
    // 生成可视化报告
    const htmlReport = createHtmlReport(report);
    fs.writeFileSync(config.visualReportPath, htmlReport);
    
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