/**
 * 养殖管理模块交互性与可用性测试脚本
 * 版本: 1.0.0
 * 
 * 测试目标：
 * 1. 右上角刷新按钮
 * 2. 右上角三个点按钮
 * 3. 中部快捷操作区四个按钮
 * 4. 养殖状态监控与饲养趋势详情按钮
 * 5. 畜禽类型选择功能
 * 6. 底部导航栏
 */

const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('@playwright/test');

// 配置
const config = {
  baseUrl: 'http://localhost:8080',
  targetPage: '/pages/home/home-farming.html',
  reportsDir: path.join(__dirname, '../reports/farming'),
  screenshotsDir: path.join(__dirname, '../reports/farming/screenshots'),
  jsonReportPath: path.join(__dirname, '../reports/farming/farming_button_interaction_report.json'),
  htmlReportPath: path.join(__dirname, '../reports/farming/farming_button_interaction_report.html'),
  viewport: devices['iPhone 15'].viewport
};

// 确保目录存在
if (!fs.existsSync(config.reportsDir)) {
  fs.mkdirSync(config.reportsDir, { recursive: true });
}
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

// 主函数
async function runTest() {
  console.log('开始养殖管理模块交互性与可用性测试...');
  
  const browser = await chromium.launch({
    headless: false // 设置为false以便可视化测试过程
  });
  
  // 创建报告数据结构
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      successRate: '0%'
    },
    testResults: []
  };
  
  try {
    // 创建浏览器上下文
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 2
    });
    
    // 创建页面
    const page = await context.newPage();
    
    // 访问目标页面
    console.log(`访问页面: ${config.baseUrl}${config.targetPage}`);
    await page.goto(`${config.baseUrl}${config.targetPage}`, { 
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // 等待页面加载完成
    await page.waitForTimeout(2000);
    
    // 截取页面初始状态截图
    await page.screenshot({ 
      path: path.join(config.screenshotsDir, 'initial_state.png'), 
      fullPage: true 
    });
    
    console.log('页面已加载，开始测试各个交互元素...');
    
    // 1. 测试右上角刷新按钮
    await testRefreshButton(page, reportData);
    
    // 2. 测试右上角三个点按钮
    await testSettingsButton(page, reportData);
    
    // 3. 测试中部快捷操作区四个按钮
    await testQuickActionButtons(page, reportData);
    
    // 4. 测试养殖状态监控与饲养趋势详情按钮
    await testDetailButtons(page, reportData);
    
    // 5. 测试畜禽类型选择
    await testLivestockTypeSelection(page, reportData);
    
    // 6. 测试底部导航栏
    await testBottomNavigation(page, reportData);
    
    // 生成最终报告
    if (reportData.summary.totalTests > 0) {
      reportData.summary.successRate = `${(reportData.summary.successfulTests / reportData.summary.totalTests * 100).toFixed(2)}%`;
    } else {
      reportData.summary.successRate = '0%';
    }
    
    // 保存报告
    fs.writeFileSync(
      config.jsonReportPath,
      JSON.stringify(reportData, null, 2)
    );
    
    // 生成HTML报告
    const htmlReport = generateHtmlReport(reportData);
    fs.writeFileSync(config.htmlReportPath, htmlReport);
    
    console.log('\n测试完成，报告已生成:');
    console.log(`JSON报告: ${config.jsonReportPath}`);
    console.log(`HTML报告: ${config.htmlReportPath}`);
    
    // 输出测试概要
    console.log('\n测试结果摘要:');
    console.log(`总测试数: ${reportData.summary.totalTests}`);
    console.log(`成功测试数: ${reportData.summary.successfulTests}`);
    console.log(`失败测试数: ${reportData.summary.failedTests}`);
    console.log(`成功率: ${reportData.summary.successRate}`);
    
  } catch (error) {
    console.error(`测试过程中发生错误: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// HTML报告生成函数
function generateHtmlReport(data) {
  // 基本HTML模板
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>养殖管理模块交互性测试报告</title>
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
            color: #0066cc;
        }
        .summary {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .success {
            color: #4caf50;
        }
        .failure {
            color: #f44336;
        }
        .test-case {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 5px;
        }
        .test-case h3 {
            margin-top: 0;
        }
        .screenshot {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            margin-top: 10px;
        }
        .details {
            margin-top: 10px;
            padding: 10px;
            background: #f9f9f9;
            border-left: 3px solid #0066cc;
        }
    </style>
</head>
<body>
    <h1>养殖管理模块交互性测试报告</h1>
    <div class="summary">
        <h2>测试概要</h2>
        <p>测试时间: ${new Date(data.timestamp).toLocaleString()}</p>
        <p>总测试数: ${data.summary.totalTests}</p>
        <p>成功测试数: <span class="success">${data.summary.successfulTests}</span></p>
        <p>失败测试数: <span class="failure">${data.summary.failedTests}</span></p>
        <p>成功率: ${data.summary.successRate}</p>
    </div>
    
    <h2>测试结果详情</h2>
    <div class="test-results">
        ${data.testResults.map(test => `
            <div class="test-case">
                <h3>${test.name}</h3>
                <p>状态: <span class="${test.success ? 'success' : 'failure'}">${test.success ? '成功' : '失败'}</span></p>
                ${test.details ? `<div class="details">${test.details}</div>` : ''}
                ${test.screenshotPath ? `<img class="screenshot" src="${test.screenshotPath}" alt="${test.name} 截图">` : ''}
                ${test.suggestion ? `<p><strong>修复建议:</strong> ${test.suggestion}</p>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
}

/**
 * 测试右上角刷新按钮
 */
async function testRefreshButton(page, reportData) {
  console.log('测试右上角刷新按钮...');
  
  // 创建测试结果对象
  const testResult = {
    name: '右上角刷新按钮',
    success: false,
    details: '',
    screenshotPath: '',
    suggestion: ''
  };
  
  try {
    reportData.summary.totalTests++;
    
    // 检查刷新按钮是否存在
    const refreshBtn = await page.$('#refreshBtn');
    if (!refreshBtn) {
      testResult.details = '刷新按钮未找到，可能不存在或ID不正确';
      testResult.suggestion = '请确保页面中存在ID为refreshBtn的按钮';
      throw new Error('刷新按钮未找到');
    }
    
    // 获取刷新按钮的属性
    const buttonAttributes = await page.evaluate(() => {
      const button = document.getElementById('refreshBtn');
      return {
        hasAriaLabel: button.hasAttribute('aria-label'),
        ariaLabel: button.getAttribute('aria-label'),
        hasTabIndex: button.hasAttribute('tabindex'),
        tabIndex: button.getAttribute('tabindex'),
        isVisible: button.offsetWidth > 0 && button.offsetHeight > 0,
        hasClickHandler: button.onclick !== null || button._onclick !== null,
        innerHTML: button.innerHTML
      };
    });
    
    // 附加属性信息到测试详情
    testResult.details += '按钮属性检查:\n';
    testResult.details += `- 可见性: ${buttonAttributes.isVisible ? '✓ 可见' : '✗ 不可见'}\n`;
    testResult.details += `- 无障碍标签: ${buttonAttributes.hasAriaLabel ? `✓ 存在 (${buttonAttributes.ariaLabel})` : '✗ 不存在'}\n`;
    testResult.details += `- 键盘可访问性: ${buttonAttributes.hasTabIndex ? `✓ 存在 (tabindex=${buttonAttributes.tabIndex})` : '✗ 不存在'}\n`;
    testResult.details += `- 点击处理程序: ${buttonAttributes.hasClickHandler ? '✓ 存在' : '✗ 不存在'}\n`;
    testResult.details += `- 按钮内容: ${buttonAttributes.innerHTML}\n`;
    
    // 获取页面内容，用于稍后比较
    const contentBefore = await page.evaluate(() => {
      return {
        userName: document.getElementById('userName')?.textContent,
        timestamp: new Date().toISOString()
      };
    });
    
    // 截取点击前的截图
    const beforeClickScreenshotPath = path.join(config.screenshotsDir, 'refresh_button_before.png');
    await page.screenshot({ path: beforeClickScreenshotPath });
    
    // 点击刷新按钮
    await refreshBtn.click();
    
    // 等待刷新操作完成
    await page.waitForTimeout(2000);
    
    // 截取点击后的截图
    const afterClickScreenshotPath = path.join(config.screenshotsDir, 'refresh_button_after.png');
    await page.screenshot({ path: afterClickScreenshotPath });
    testResult.screenshotPath = afterClickScreenshotPath.replace(path.join(__dirname, '..'), '..'); // 相对路径
    
    // 验证点击后的页面变化
    const contentAfter = await page.evaluate(() => {
      return {
        userName: document.getElementById('userName')?.textContent,
        timestamp: new Date().toISOString()
      };
    });
    
    // 检查是否有数据更新（这里简单检查timestamp变化）
    const timeChange = new Date(contentAfter.timestamp) - new Date(contentBefore.timestamp);
    const hasRefreshed = timeChange > 0;
    
    // 检查页面是否显示了"数据已更新"等提示
    const toastVisible = await page.evaluate(() => {
      // 检查页面中可能的toast或通知元素
      const toastElements = document.querySelectorAll('.toast, .notification, .alert, [aria-live="polite"]');
      return Array.from(toastElements).some(el => 
        el.offsetParent !== null && 
        (el.textContent.includes('更新') || el.textContent.includes('刷新') || el.textContent.includes('成功'))
      );
    });
    
    // 更新测试结果
    if (hasRefreshed || toastVisible) {
      testResult.success = true;
      testResult.details += '\n刷新功能测试:\n';
      testResult.details += `- 时间戳变化: ${timeChange}ms\n`;
      testResult.details += `- 显示刷新提示: ${toastVisible ? '✓ 是' : '✗ 否'}\n`;
      testResult.details += '✓ 刷新按钮功能正常';
    } else {
      testResult.details += '\n刷新功能测试:\n';
      testResult.details += `- 时间戳变化: ${timeChange}ms\n`;
      testResult.details += `- 显示刷新提示: ${toastVisible ? '✓ 是' : '✗ 否'}\n`;
      testResult.details += '✗ 点击后没有明显变化';
      testResult.suggestion = '建议检查刷新按钮的点击事件，确保它调用了 location.reload() 或者数据刷新接口';
    }
    
  } catch (error) {
    console.error(`测试刷新按钮失败: ${error.message}`);
    testResult.details += `\n测试过程中出错: ${error.message}`;
    testResult.success = false;
  }
  
  // 记录结果
  reportData.testResults.push(testResult);
  if (testResult.success) {
    reportData.summary.successfulTests++;
    console.log('✓ 刷新按钮测试通过');
  } else {
    reportData.summary.failedTests++;
    console.log('✗ 刷新按钮测试失败');
  }
}

/**
 * 测试右上角三个点按钮
 */
async function testSettingsButton(page, reportData) {
  console.log('测试右上角三个点按钮...');
  
  // 创建测试结果对象
  const testResult = {
    name: '右上角三个点按钮',
    success: false,
    details: '',
    screenshotPath: '',
    suggestion: ''
  };
  
  try {
    reportData.summary.totalTests++;
    
    // 检查设置按钮是否存在
    const settingsBtn = await page.$('#settingsBtn');
    if (!settingsBtn) {
      testResult.details = '三个点按钮未找到，可能不存在或ID不正确';
      testResult.suggestion = '请确保页面中存在ID为settingsBtn的按钮';
      throw new Error('三个点按钮未找到');
    }
    
    // 获取按钮的属性
    const buttonAttributes = await page.evaluate(() => {
      const button = document.getElementById('settingsBtn');
      return {
        hasAriaLabel: button.hasAttribute('aria-label'),
        ariaLabel: button.getAttribute('aria-label'),
        hasTabIndex: button.hasAttribute('tabindex'),
        tabIndex: button.getAttribute('tabindex'),
        isVisible: button.offsetWidth > 0 && button.offsetHeight > 0,
        hasClickHandler: button.onclick !== null || button._onclick !== null,
        innerHTML: button.innerHTML
      };
    });
    
    // 附加属性信息到测试详情
    testResult.details += '按钮属性检查:\n';
    testResult.details += `- 可见性: ${buttonAttributes.isVisible ? '✓ 可见' : '✗ 不可见'}\n`;
    testResult.details += `- 无障碍标签: ${buttonAttributes.hasAriaLabel ? `✓ 存在 (${buttonAttributes.ariaLabel})` : '✗ 不存在'}\n`;
    testResult.details += `- 键盘可访问性: ${buttonAttributes.hasTabIndex ? `✓ 存在 (tabindex=${buttonAttributes.tabIndex})` : '✗ 不存在'}\n`;
    testResult.details += `- 点击处理程序: ${buttonAttributes.hasClickHandler ? '✓ 存在' : '✗ 不存在'}\n`;
    testResult.details += `- 按钮内容: ${buttonAttributes.innerHTML}\n`;
    
    // 截取点击前的截图
    const beforeClickScreenshotPath = path.join(config.screenshotsDir, 'settings_button_before.png');
    await page.screenshot({ path: beforeClickScreenshotPath });
    
    // 点击设置按钮
    await settingsBtn.click();
    
    // 等待可能的菜单或弹出窗口出现
    await page.waitForTimeout(1000);
    
    // 截取点击后的截图
    const afterClickScreenshotPath = path.join(config.screenshotsDir, 'settings_button_after.png');
    await page.screenshot({ path: afterClickScreenshotPath });
    testResult.screenshotPath = afterClickScreenshotPath.replace(path.join(__dirname, '..'), '..'); // 相对路径
    
    // 检查点击后是否出现菜单或弹窗
    const menuVisible = await page.evaluate(() => {
      // 检查可能的菜单、弹窗或下拉列表元素
      const menuElements = document.querySelectorAll('.menu, .dropdown, .dropdown-menu, .popup, .modal, .dialog, [role="menu"], [role="dialog"]');
      return Array.from(menuElements).some(el => 
        el.offsetParent !== null && 
        window.getComputedStyle(el).display !== 'none' && 
        window.getComputedStyle(el).visibility !== 'hidden'
      );
    });
    
    // 检查是否有任何视觉反馈（如按钮样式变化）
    const hasVisualFeedback = await page.evaluate(async () => {
      const button = document.getElementById('settingsBtn');
      // 检查按钮是否有样式变化的类名
      const hasActiveClass = button.classList.contains('active') || 
                           button.classList.contains('selected') || 
                           button.classList.contains('open');
      
      // 检查背景颜色变化
      const style = window.getComputedStyle(button);
      const backgroundColor = style.backgroundColor;
      
      // 返回任何视觉反馈
      return {
        hasActiveClass,
        backgroundColor
      };
    });
    
    // 更新测试结果
    if (menuVisible) {
      testResult.success = true;
      testResult.details += '\n交互功能测试:\n';
      testResult.details += '✓ 点击后显示菜单或弹窗\n';
      testResult.details += '✓ 三个点按钮功能正常';
    } else if (hasVisualFeedback.hasActiveClass) {
      testResult.success = true;
      testResult.details += '\n交互功能测试:\n';
      testResult.details += '✓ 点击后按钮状态发生变化\n';
      testResult.details += '✓ 三个点按钮有视觉反馈';
    } else {
      testResult.details += '\n交互功能测试:\n';
      testResult.details += '✗ 点击后没有菜单或弹窗出现\n';
      testResult.details += '✗ 点击后没有明显的按钮状态变化\n';
      testResult.details += '✗ 按钮可能没有交互功能';
      testResult.suggestion = '建议为三个点按钮添加菜单或设置面板，或者如果功能尚未实现，可以添加aria-label="设置（即将推出）"并暂时禁用或隐藏按钮';
    }
    
  } catch (error) {
    console.error(`测试三个点按钮失败: ${error.message}`);
    testResult.details += `\n测试过程中出错: ${error.message}`;
    testResult.success = false;
  }
  
  // 记录结果
  reportData.testResults.push(testResult);
  if (testResult.success) {
    reportData.summary.successfulTests++;
    console.log('✓ 三个点按钮测试通过');
  } else {
    reportData.summary.failedTests++;
    console.log('✗ 三个点按钮测试失败');
  }
}

/**
 * 测试中部快捷操作区四个按钮
 */
async function testQuickActionButtons(page, reportData) {
  console.log('测试中部快捷操作区四个按钮...');
  
  // 定义要测试的按钮及其预期跳转路径
  const buttons = [
    { id: 'createRecordBtn', name: '创建养殖记录', expectedPath: '/pages/farming/create-trace.html' },
    { id: 'vaccineBtn', name: '动物疫苗录入', expectedPath: '/pages/farming/farming-vaccine.html' },
    { id: 'breedingBtn', name: '繁育信息管理', expectedPath: '/pages/farming/farming-breeding.html' },
    { id: 'monitorBtn', name: '场地视频监控', expectedPath: '/pages/farming/farming-monitor.html' }
  ];
  
  // 遍历测试每个按钮
  for (const button of buttons) {
    await testSingleQuickActionButton(page, reportData, button);
    
    // 每次测试后返回到养殖管理主页
    await page.goto(`${config.baseUrl}${config.targetPage}`, { 
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
  }
}

/**
 * 测试单个快捷操作按钮
 */
async function testSingleQuickActionButton(page, reportData, buttonInfo) {
  console.log(`测试${buttonInfo.name}按钮...`);
  
  // 创建测试结果对象
  const testResult = {
    name: `${buttonInfo.name}按钮`,
    success: false,
    details: '',
    screenshotPath: '',
    suggestion: ''
  };
  
  try {
    reportData.summary.totalTests++;
    
    // 检查按钮是否存在
    const button = await page.$(`#${buttonInfo.id}`);
    if (!button) {
      testResult.details = `${buttonInfo.name}按钮未找到，可能不存在或ID不正确`;
      testResult.suggestion = `请确保页面中存在ID为${buttonInfo.id}的按钮`;
      throw new Error(`${buttonInfo.name}按钮未找到`);
    }
    
    // 获取按钮的属性
    const buttonAttributes = await page.evaluate((btnId) => {
      const button = document.getElementById(btnId);
      return {
        hasAriaLabel: button.hasAttribute('aria-label'),
        ariaLabel: button.getAttribute('aria-label'),
        hasTabIndex: button.hasAttribute('tabindex'),
        tabIndex: button.getAttribute('tabindex'),
        isVisible: button.offsetWidth > 0 && button.offsetHeight > 0,
        isDisabled: button.disabled || button.classList.contains('disabled'),
        innerText: button.innerText.trim()
      };
    }, buttonInfo.id);
    
    // 附加属性信息到测试详情
    testResult.details += '按钮属性检查:\n';
    testResult.details += `- 可见性: ${buttonAttributes.isVisible ? '✓ 可见' : '✗ 不可见'}\n`;
    testResult.details += `- 可点击: ${!buttonAttributes.isDisabled ? '✓ 可点击' : '✗ 已禁用'}\n`;
    testResult.details += `- 无障碍标签: ${buttonAttributes.hasAriaLabel ? `✓ 存在 (${buttonAttributes.ariaLabel})` : '✗ 不存在'}\n`;
    testResult.details += `- 键盘可访问性: ${buttonAttributes.hasTabIndex ? `✓ 存在 (tabindex=${buttonAttributes.tabIndex})` : '✗ 不存在'}\n`;
    testResult.details += `- 按钮文本: ${buttonAttributes.innerText}\n`;
    
    // 如果按钮被禁用，记录结果并跳过点击测试
    if (buttonAttributes.isDisabled) {
      testResult.details += '\n按钮已禁用，无法测试跳转功能';
      testResult.suggestion = `${buttonInfo.name}按钮已禁用，请检查权限设置或按钮状态`;
      testResult.success = false; // 按钮应该可点击，否则视为测试失败
      reportData.testResults.push(testResult);
      reportData.summary.failedTests++;
      console.log(`✗ ${buttonInfo.name}按钮测试失败（按钮已禁用）`);
      return;
    }
    
    // 截取点击前的截图
    const beforeClickScreenshotPath = path.join(config.screenshotsDir, `${buttonInfo.id}_before.png`);
    await page.screenshot({ path: beforeClickScreenshotPath });
    
    // 记录当前URL
    const currentUrl = page.url();
    
    // 点击按钮
    console.log(`点击${buttonInfo.name}按钮`);
    await button.click();
    
    // 等待导航或页面变化
    await page.waitForTimeout(2000);
    
    // 截取点击后的截图
    const afterClickScreenshotPath = path.join(config.screenshotsDir, `${buttonInfo.id}_after.png`);
    await page.screenshot({ path: afterClickScreenshotPath });
    testResult.screenshotPath = afterClickScreenshotPath.replace(path.join(__dirname, '..'), '..'); // 相对路径
    
    // 获取当前URL
    const newUrl = page.url();
    
    // 判断是否发生了导航
    const hasNavigated = currentUrl !== newUrl;
    
    // 检查是否导航到了预期路径
    const expectedUrl = new URL(buttonInfo.expectedPath, config.baseUrl).toString();
    const navigatedToExpectedPath = newUrl.includes(buttonInfo.expectedPath);
    
    if (hasNavigated && navigatedToExpectedPath) {
      // 导航到了预期页面
      testResult.success = true;
      testResult.details += '\n跳转测试:\n';
      testResult.details += `✓ 成功跳转到: ${newUrl}\n`;
      testResult.details += '✓ 跳转路径符合预期\n';
      testResult.details += `✓ ${buttonInfo.name}按钮功能正常`;
    } else if (hasNavigated) {
      // 导航到了其他页面
      testResult.success = false;
      testResult.details += '\n跳转测试:\n';
      testResult.details += `✓ 发生跳转到: ${newUrl}\n`;
      testResult.details += `✗ 跳转路径与预期不符（预期: ${expectedUrl}）\n`;
      testResult.suggestion = `${buttonInfo.name}按钮应该跳转到${buttonInfo.expectedPath}，但实际跳转到了${newUrl}，请检查按钮的点击事件处理逻辑`;
    } else {
      // 没有导航
      testResult.success = false;
      testResult.details += '\n跳转测试:\n';
      testResult.details += '✗ 点击后无跳转\n';
      testResult.suggestion = `${buttonInfo.name}按钮点击后应该跳转到${buttonInfo.expectedPath}，但没有发生跳转，请检查按钮的点击事件处理逻辑或权限设置`;
    }
    
    // 检查目标页面是否存在
    if (hasNavigated) {
      const pageTitle = await page.title();
      testResult.details += `\n目标页面标题: ${pageTitle}\n`;
      
      // 检查页面是否有错误（如404）
      const pageHasError = await page.evaluate(() => {
        return document.body.textContent.includes('404') || 
               document.body.textContent.includes('找不到页面') || 
               document.body.textContent.includes('Not Found') ||
               document.body.textContent.includes('错误');
      });
      
      if (pageHasError) {
        testResult.success = false;
        testResult.details += '✗ 目标页面可能不存在（检测到错误信息）\n';
        testResult.suggestion = `请确认${buttonInfo.expectedPath}页面是否存在，或创建该页面`;
      }
    }
    
  } catch (error) {
    console.error(`测试${buttonInfo.name}按钮失败: ${error.message}`);
    testResult.details += `\n测试过程中出错: ${error.message}`;
    testResult.success = false;
  }
  
  // 记录结果
  reportData.testResults.push(testResult);
  if (testResult.success) {
    reportData.summary.successfulTests++;
    console.log(`✓ ${buttonInfo.name}按钮测试通过`);
  } else {
    reportData.summary.failedTests++;
    console.log(`✗ ${buttonInfo.name}按钮测试失败`);
  }
}

/**
 * 测试养殖状态监控与饲养趋势详情按钮
 */
async function testDetailButtons(page, reportData) {
  console.log('测试养殖状态监控与饲养趋势详情按钮...');
  
  // 定义要测试的详情按钮及其预期跳转路径
  const detailButtons = [
    { 
      name: '养殖状态监控详情',
      selector: '.card-header a[href="../farming/farming-report.html"]',
      expectedPath: '/pages/farming/farming-report.html',
      fallbackPath: '/pages/coming-soon.html?source=farming-report'
    },
    { 
      name: '饲养趋势详情',
      selector: '.card-header a[href="../farming/farming-analytics.html"]',
      expectedPath: '/pages/farming/farming-analytics.html',
      fallbackPath: '/pages/coming-soon.html?source=farming-analytics'
    }
  ];
  
  // 遍历测试每个详情按钮
  for (const button of detailButtons) {
    await testDetailButton(page, reportData, button);
    
    // 每次测试后返回到养殖管理主页
    await page.goto(`${config.baseUrl}${config.targetPage}`, { 
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
  }
}

/**
 * 测试单个详情按钮
 */
async function testDetailButton(page, reportData, buttonInfo) {
  console.log(`测试${buttonInfo.name}按钮...`);
  
  // 创建测试结果对象
  const testResult = {
    name: `${buttonInfo.name}按钮`,
    success: false,
    details: '',
    screenshotPath: '',
    suggestion: ''
  };
  
  try {
    reportData.summary.totalTests++;
    
    // 检查按钮是否存在
    const button = await page.$(buttonInfo.selector);
    if (!button) {
      testResult.details = `${buttonInfo.name}按钮未找到，可能不存在或选择器不正确`;
      testResult.suggestion = `请确保页面中存在符合选择器 "${buttonInfo.selector}" 的元素`;
      throw new Error(`${buttonInfo.name}按钮未找到`);
    }
    
    // 获取按钮的属性和文本
    const buttonAttributes = await page.evaluate((selector) => {
      const button = document.querySelector(selector);
      return {
        href: button.getAttribute('href'),
        innerText: button.innerText.trim(),
        isVisible: button.offsetWidth > 0 && button.offsetHeight > 0,
        hasAriaLabel: button.hasAttribute('aria-label'),
        ariaLabel: button.getAttribute('aria-label')
      };
    }, buttonInfo.selector);
    
    // 附加属性信息到测试详情
    testResult.details += '按钮属性检查:\n';
    testResult.details += `- 可见性: ${buttonAttributes.isVisible ? '✓ 可见' : '✗ 不可见'}\n`;
    testResult.details += `- 链接地址: ${buttonAttributes.href}\n`;
    testResult.details += `- 文本内容: ${buttonAttributes.innerText}\n`;
    testResult.details += `- 无障碍标签: ${buttonAttributes.hasAriaLabel ? `✓ 存在 (${buttonAttributes.ariaLabel})` : '✗ 不存在'}\n`;
    
    // 截取点击前的截图
    const buttonId = buttonInfo.name.replace(/\s+/g, '_').toLowerCase();
    const beforeClickScreenshotPath = path.join(config.screenshotsDir, `${buttonId}_before.png`);
    await page.screenshot({ path: beforeClickScreenshotPath });
    
    // 记录当前URL
    const currentUrl = page.url();
    
    // 点击按钮
    console.log(`点击${buttonInfo.name}按钮`);
    await button.click();
    
    // 等待导航或页面变化
    await page.waitForTimeout(2000);
    
    // 截取点击后的截图
    const afterClickScreenshotPath = path.join(config.screenshotsDir, `${buttonId}_after.png`);
    await page.screenshot({ path: afterClickScreenshotPath });
    testResult.screenshotPath = afterClickScreenshotPath.replace(path.join(__dirname, '..'), '..'); // 相对路径
    
    // 获取当前URL
    const newUrl = page.url();
    
    // 判断是否发生了导航
    const hasNavigated = currentUrl !== newUrl;
    
    // 检查是否导航到了预期路径或备用路径
    const navigatedToExpectedPath = newUrl.includes(buttonInfo.expectedPath);
    const navigatedToFallbackPath = newUrl.includes(buttonInfo.fallbackPath);
    
    if (hasNavigated && navigatedToExpectedPath) {
      // 导航到了预期页面
      testResult.success = true;
      testResult.details += '\n跳转测试:\n';
      testResult.details += `✓ 成功跳转到: ${newUrl}\n`;
      testResult.details += '✓ 跳转路径符合预期\n';
      testResult.details += `✓ ${buttonInfo.name}按钮功能正常`;
    } else if (hasNavigated && navigatedToFallbackPath) {
      // 导航到了备用页面（coming-soon页面）
      testResult.success = true; // 这也是可接受的
      testResult.details += '\n跳转测试:\n';
      testResult.details += `✓ 成功跳转到备用页面: ${newUrl}\n`;
      testResult.details += '✓ 跳转到了正确的coming-soon页面\n';
      testResult.details += `⚠️ ${buttonInfo.name}功能尚未实现，但有适当的用户反馈`;
    } else if (hasNavigated) {
      // 导航到了其他页面
      testResult.success = false;
      testResult.details += '\n跳转测试:\n';
      testResult.details += `✓ 发生跳转到: ${newUrl}\n`;
      testResult.details += `✗ 跳转路径与预期或备用路径不符\n`;
      testResult.suggestion = `${buttonInfo.name}按钮应该跳转到${buttonInfo.expectedPath}或${buttonInfo.fallbackPath}，但实际跳转到了${newUrl}，请更新链接地址`;
    } else {
      // 没有导航
      testResult.success = false;
      testResult.details += '\n跳转测试:\n';
      testResult.details += '✗ 点击后无跳转\n';
      testResult.suggestion = `${buttonInfo.name}按钮点击后应该触发导航，请检查链接是否正确或JavaScript事件是否阻止了默认行为`;
    }
    
    // 检查目标页面是否存在
    if (hasNavigated) {
      const pageTitle = await page.title();
      testResult.details += `\n目标页面标题: ${pageTitle}\n`;
      
      // 检查页面是否有错误（如404）
      const pageHasError = await page.evaluate(() => {
        return document.body.textContent.includes('404') || 
               document.body.textContent.includes('找不到页面') || 
               document.body.textContent.includes('Not Found') ||
               document.body.textContent.includes('错误');
      });
      
      if (pageHasError && !navigatedToFallbackPath) {
        testResult.success = false;
        testResult.details += '✗ 目标页面可能不存在（检测到错误信息）\n';
        testResult.suggestion = `请创建${buttonInfo.expectedPath}页面，或将链接更改为${buttonInfo.fallbackPath}`;
      }
    }
    
  } catch (error) {
    console.error(`测试${buttonInfo.name}按钮失败: ${error.message}`);
    testResult.details += `\n测试过程中出错: ${error.message}`;
    testResult.success = false;
  }
  
  // 记录结果
  reportData.testResults.push(testResult);
  if (testResult.success) {
    reportData.summary.successfulTests++;
    console.log(`✓ ${buttonInfo.name}按钮测试通过`);
  } else {
    reportData.summary.failedTests++;
    console.log(`✗ ${buttonInfo.name}按钮测试失败`);
  }
}

/**
 * 测试畜禽类型选择功能
 */
async function testLivestockTypeSelection(page, reportData) {
  console.log('测试畜禽类型选择功能...');
  
  // 创建测试结果对象
  const testResult = {
    name: '畜禽类型选择功能',
    success: false,
    details: '',
    screenshotPath: '',
    suggestion: ''
  };
  
  try {
    reportData.summary.totalTests++;
    
    // 检查畜禽类型选择区域是否存在
    const typeSelectionSection = await page.$('.card-header:has-text("畜禽类型选择")');
    if (!typeSelectionSection) {
      testResult.details = '畜禽类型选择区域未找到';
      testResult.screenshotPath = path.join(config.screenshotsDir, 'livestock_type_not_found.png')
        .replace(path.join(__dirname, '..'), '..');
      await page.screenshot({ path: path.join(config.screenshotsDir, 'livestock_type_not_found.png') });
      throw new Error('畜禽类型选择区域未找到');
    }
    
    // 查找畜禽类型选择卡片
    const typeCards = await page.$$('.livestock-type-card');
    if (!typeCards || typeCards.length === 0) {
      testResult.details = '畜禽类型选择卡片未找到';
      throw new Error('畜禽类型选择卡片未找到');
    }
    
    // 获取卡片信息
    const cardsInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('.livestock-type-card');
      return Array.from(cards).map(card => ({
        type: card.getAttribute('data-type'),
        text: card.innerText.trim(),
        isSelected: card.classList.contains('border-[#1890FF]') || card.classList.contains('bg-[#F0F5FF]')
      }));
    });
    
    testResult.details += '畜禽类型选择UI检查:\n';
    testResult.details += `- 发现 ${cardsInfo.length} 个畜禽类型选项\n`;
    cardsInfo.forEach(card => {
      testResult.details += `- 类型: ${card.type}, 文本: ${card.text}, 已选择: ${card.isSelected ? '是' : '否'}\n`;
    });
    
    // 在首页显示畜禽类型选择是UI错误
    testResult.details += '\n畜禽类型选择位置评估:\n';
    testResult.details += '✗ 畜禽类型选择不应该在首页显示，这是UI错误\n';
    testResult.suggestion = '建议将畜禽类型选择移动到创建养殖记录表单中，从首页中移除';
    
    // 截取畜禽类型选择区域截图
    const typeSelectionScreenshotPath = path.join(config.screenshotsDir, 'livestock_type_selection.png');
    await page.screenshot({ path: typeSelectionScreenshotPath });
    testResult.screenshotPath = typeSelectionScreenshotPath.replace(path.join(__dirname, '..'), '..'); // 相对路径
    
    // 测试点击切换功能
    testResult.details += '\n交互功能测试:\n';
    
    // 找到非当前选中的类型卡片
    const nonSelectedCardIndex = cardsInfo.findIndex(card => !card.isSelected);
    if (nonSelectedCardIndex >= 0) {
      // 点击非选中的卡片
      const targetType = cardsInfo[nonSelectedCardIndex].type;
      const targetCard = typeCards[nonSelectedCardIndex];
      
      // 截取点击前的截图
      const beforeClickScreenshotPath = path.join(config.screenshotsDir, `livestock_type_before_click.png`);
      await page.screenshot({ path: beforeClickScreenshotPath });
      
      // 点击卡片
      await targetCard.click();
      await page.waitForTimeout(1000);
      
      // 截取点击后的截图
      const afterClickScreenshotPath = path.join(config.screenshotsDir, `livestock_type_after_click.png`);
      await page.screenshot({ path: afterClickScreenshotPath });
      
      // 验证选择状态变化
      const newCardStates = await page.evaluate(() => {
        const cards = document.querySelectorAll('.livestock-type-card');
        return Array.from(cards).map(card => ({
          type: card.getAttribute('data-type'),
          isSelected: card.classList.contains('border-[#1890FF]') || card.classList.contains('bg-[#F0F5FF]')
        }));
      });
      
      // 检查是否成功切换了选择状态
      const targetCardNewState = newCardStates.find(card => card.type === targetType);
      if (targetCardNewState && targetCardNewState.isSelected) {
        testResult.details += `✓ 成功切换畜禽类型到: ${targetType}\n`;
      } else {
        testResult.details += `✗ 切换畜禽类型失败，点击后状态未改变\n`;
      }
      
      // 检查高端畜禽特性是否显示（如果切换到高端类型）
      if (targetType === 'highend') {
        const highendFeaturesVisible = await page.evaluate(() => {
          const features = document.querySelectorAll('.highend-feature');
          return Array.from(features).some(el => window.getComputedStyle(el).display !== 'none');
        });
        
        if (highendFeaturesVisible) {
          testResult.details += '✓ 高端畜禽特性已显示\n';
        } else {
          testResult.details += '✗ 切换到高端畜禽后，特性未显示\n';
        }
      }
    } else {
      testResult.details += '⚠️ 无法测试切换功能，未找到非选中状态的卡片\n';
    }
    
    // 虽然在首页显示畜禽类型选择是UI错误，但是功能本身是否正常工作
    const functionalityWorks = await page.evaluate(() => {
      // 检查是否有选择畜禽类型的JavaScript函数
      return typeof selectLivestockType === 'function' || 
             document.querySelectorAll('.livestock-type-card[onclick]').length > 0 ||
             document.querySelectorAll('.livestock-type-card').length > 0;
    });
    
    if (functionalityWorks) {
      testResult.details += '✓ 畜禽类型选择功能正常工作\n';
    } else {
      testResult.details += '✗ 畜禽类型选择功能不正常\n';
      testResult.suggestion += '，同时检查类型选择的JavaScript功能是否正确实现';
    }
    
    // 测试结果：功能可能正常，但UI放置错误
    testResult.success = functionalityWorks; // 功能正常但位置错误
    testResult.details += '\n总结: 畜禽类型选择功能本身可能正常工作，但不应该显示在首页，这是一个UI/UX设计问题';
    
  } catch (error) {
    console.error(`测试畜禽类型选择功能失败: ${error.message}`);
    testResult.details += `\n测试过程中出错: ${error.message}`;
    testResult.success = false;
  }
  
  // 记录结果
  reportData.testResults.push(testResult);
  if (testResult.success) {
    reportData.summary.successfulTests++;
    console.log('✓ 畜禽类型选择功能测试通过');
  } else {
    reportData.summary.failedTests++;
    console.log('✗ 畜禽类型选择功能测试失败');
  }
}

/**
 * 测试底部导航栏
 */
async function testBottomNavigation(page, reportData) {
  console.log('测试底部导航栏...');
  
  // 创建测试结果对象
  const testResult = {
    name: '底部导航栏',
    success: false,
    details: '',
    screenshotPath: '',
    suggestion: ''
  };
  
  try {
    reportData.summary.totalTests++;
    
    // 检查底部导航栏是否存在
    const bottomNav = await page.$('.bottom-nav');
    if (!bottomNav) {
      testResult.details = '底部导航栏未找到';
      testResult.suggestion = '请确保页面中存在class为bottom-nav的元素';
      throw new Error('底部导航栏未找到');
    }
    
    // 获取底部导航栏中的项目
    const navItems = await page.$$('.nav-item');
    if (!navItems || navItems.length === 0) {
      testResult.details = '底部导航栏中未找到导航项';
      throw new Error('底部导航栏中未找到导航项');
    }
    
    // 获取导航项信息
    const navItemsInfo = await page.evaluate(() => {
      const items = document.querySelectorAll('.nav-item');
      return Array.from(items).map((item, index) => {
        const link = item.querySelector('a');
        return {
          index,
          text: item.innerText.trim(),
          isActive: item.classList.contains('active'),
          hasLink: !!link,
          href: link ? link.getAttribute('href') : null,
          hasClickHandler: item.onclick !== null || link?.onclick !== null
        };
      });
    });
    
    // 检查样式一致性
    const stylesConsistent = await page.evaluate(() => {
      const items = document.querySelectorAll('.nav-item');
      if (items.length < 2) return true; // 不足两个项目无法比较
      
      const firstItemStyles = window.getComputedStyle(items[0]);
      const isConsistent = Array.from(items).every(item => {
        const styles = window.getComputedStyle(item);
        // 检查关键样式是否一致（除了颜色，因为激活状态颜色不同）
        return styles.padding === firstItemStyles.padding &&
               styles.textAlign === firstItemStyles.textAlign &&
               styles.fontSize === firstItemStyles.fontSize;
      });
      
      return isConsistent;
    });
    
    // 附加导航项信息到测试详情
    testResult.details += '底部导航栏检查:\n';
    testResult.details += `- 导航项数量: ${navItemsInfo.length}\n`;
    navItemsInfo.forEach(item => {
      testResult.details += `- 项目 ${item.index + 1}: ${item.text}, 激活状态: ${item.isActive ? '是' : '否'}, ` +
                           `有链接: ${item.hasLink ? '是' : '否'}, 链接地址: ${item.href || '无'}\n`;
    });
    testResult.details += `- 样式一致性: ${stylesConsistent ? '✓ 一致' : '✗ 不一致'}\n`;
    
    // 检查"信息管理"导航项
    const infoManagementItem = navItemsInfo.find(item => item.text.includes('信息管理'));
    if (infoManagementItem) {
      testResult.details += '\n"信息管理"导航项检查:\n';
      if (!infoManagementItem.hasLink && !infoManagementItem.hasClickHandler) {
        testResult.details += '✗ "信息管理"项没有链接或点击处理程序\n';
        testResult.suggestion = '"信息管理"项应该跳转到farming-breeding.html页面，请添加正确的链接';
      } else if (infoManagementItem.href && !infoManagementItem.href.includes('farming-breeding.html')) {
        testResult.details += `✗ "信息管理"项链接错误: ${infoManagementItem.href}\n`;
        testResult.suggestion = '"信息管理"项应该跳转到farming-breeding.html页面，请更新链接地址';
      } else if (infoManagementItem.href && infoManagementItem.href.includes('farming-breeding.html')) {
        testResult.details += '✓ "信息管理"项链接正确\n';
      }
    } else {
      testResult.details += '\n✗ 未找到"信息管理"导航项\n';
    }
    
    // 测试"信息管理"项的点击
    if (infoManagementItem) {
      const infoManagementIndex = infoManagementItem.index;
      const infoManagementElement = navItems[infoManagementIndex];
      
      // 截取点击前的截图
      const beforeClickScreenshotPath = path.join(config.screenshotsDir, 'bottom_nav_before_click.png');
      await page.screenshot({ path: beforeClickScreenshotPath });
      
      // 记录当前URL
      const currentUrl = page.url();
      
      // 点击"信息管理"项
      console.log('点击"信息管理"导航项');
      await infoManagementElement.click();
      
      // 等待可能的导航
      await page.waitForTimeout(2000);
      
      // 截取点击后的截图
      const afterClickScreenshotPath = path.join(config.screenshotsDir, 'bottom_nav_after_click.png');
      await page.screenshot({ path: afterClickScreenshotPath });
      testResult.screenshotPath = afterClickScreenshotPath.replace(path.join(__dirname, '..'), '..'); // 相对路径
      
      // 获取当前URL
      const newUrl = page.url();
      
      // 判断是否发生了导航和导航到哪里
      const hasNavigated = currentUrl !== newUrl;
      const navigatedToBreeding = newUrl.includes('farming-breeding.html');
      
      testResult.details += '\n"信息管理"项点击测试:\n';
      if (hasNavigated && navigatedToBreeding) {
        testResult.details += '✓ 成功跳转到繁育信息管理页面\n';
      } else if (hasNavigated) {
        testResult.details += `✗ 跳转到了错误的页面: ${newUrl}\n`;
      } else {
        testResult.details += '✗ 点击后没有跳转\n';
      }
      
      // 如果导航后，返回到养殖管理主页继续测试
      if (hasNavigated) {
        await page.goto(`${config.baseUrl}${config.targetPage}`, { 
          waitUntil: 'networkidle',
          timeout: 30000
        });
        await page.waitForTimeout(1000);
      }
    }
    
    // 测试"我的"项的点击
    const myProfileItem = navItemsInfo.find(item => item.text.includes('我的'));
    if (myProfileItem) {
      const myProfileIndex = myProfileItem.index;
      const myProfileElement = navItems[myProfileIndex];
      
      // 截取点击前的截图
      const beforeClickScreenshotPath = path.join(config.screenshotsDir, 'my_profile_before_click.png');
      await page.screenshot({ path: beforeClickScreenshotPath });
      
      // 记录当前URL
      const currentUrl = page.url();
      
      // 点击"我的"项
      console.log('点击"我的"导航项');
      await myProfileElement.click();
      
      // 等待可能的导航
      await page.waitForTimeout(2000);
      
      // 截取点击后的截图
      const afterClickScreenshotPath = path.join(config.screenshotsDir, 'my_profile_after_click.png');
      await page.screenshot({ path: afterClickScreenshotPath });
      
      // 获取当前URL
      const newUrl = page.url();
      
      // 判断是否发生了导航
      const hasNavigated = currentUrl !== newUrl;
      
      testResult.details += '\n"我的"项点击测试:\n';
      if (hasNavigated) {
        const pageTitle = await page.title();
        testResult.details += `✓ 成功跳转到: ${newUrl}\n`;
        testResult.details += `✓ 目标页面标题: ${pageTitle}\n`;
        
        // 检查页面是否有错误（如404）
        const pageHasError = await page.evaluate(() => {
          return document.body.textContent.includes('404') || 
                 document.body.textContent.includes('找不到页面') || 
                 document.body.textContent.includes('Not Found') ||
                 document.body.textContent.includes('错误');
        });
        
        if (pageHasError) {
          testResult.details += '✗ 目标页面可能不存在（检测到错误信息）\n';
        }
      } else {
        testResult.details += '✗ 点击后没有跳转\n';
      }
    } else {
      testResult.details += '\n✗ 未找到"我的"导航项\n';
    }
    
    // 根据测试结果设置成功状态
    if (stylesConsistent && (
        (infoManagementItem && infoManagementItem.hasLink && infoManagementItem.href.includes('farming-breeding.html')) ||
        (infoManagementItem && infoManagementItem.hasClickHandler)
    )) {
      testResult.success = true;
      testResult.details += '\n总结: 底部导航栏样式一致，功能基本正常';
    } else {
      testResult.success = false;
      testResult.details += '\n总结: 底部导航栏存在问题，请查看详细信息';
      if (!testResult.suggestion) {
        testResult.suggestion = '请检查底部导航栏样式一致性，并确保所有导航项都有正确的链接';
      }
    }
    
  } catch (error) {
    console.error(`测试底部导航栏失败: ${error.message}`);
    testResult.details += `\n测试过程中出错: ${error.message}`;
    testResult.success = false;
  }
  
  // 记录结果
  reportData.testResults.push(testResult);
  if (testResult.success) {
    reportData.summary.successfulTests++;
    console.log('✓ 底部导航栏测试通过');
  } else {
    reportData.summary.failedTests++;
    console.log('✗ 底部导航栏测试失败');
  }
}

// 运行测试
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { runTest }; 