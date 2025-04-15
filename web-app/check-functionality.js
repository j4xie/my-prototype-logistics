const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, 'validation');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir);
}

(async () => {
  console.log('启动功能验证测试...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 创建测试结果对象
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };
  
  async function runTest(name, testFn) {
    console.log(`执行测试: ${name}`);
    testResults.summary.total++;
    
    try {
      await testFn();
      testResults.tests[name] = {
        status: '通过',
        timestamp: new Date().toISOString()
      };
      testResults.summary.passed++;
      console.log(`✓ 测试通过: ${name}`);
    } catch (error) {
      testResults.tests[name] = {
        status: '失败',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      testResults.summary.failed++;
      console.error(`✗ 测试失败: ${name}`, error.message);
      
      // 错误时截图
      try {
        const errorScreenshot = path.join(screenshotDir, `error_${name.replace(/\s+/g, '_')}.png`);
        await page.screenshot({ path: errorScreenshot });
        testResults.tests[name].errorScreenshot = errorScreenshot;
      } catch (screenshotError) {
        console.error('无法保存错误截图:', screenshotError.message);
      }
    }
  }
  
  try {
    // 导航到首页
    await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
    
    // 测试1: 验证页面标题
    await runTest('页面标题验证', async () => {
      const title = await page.title();
      if (!title || title.trim() === '') {
        throw new Error('页面标题为空');
      }
    });
    
    // 测试2: 导航菜单存在
    await runTest('导航菜单验证', async () => {
      // 等待导航菜单加载
      await page.waitForTimeout(1000);
      
      // 使用多种可能的选择器查找导航
      const navExists = await page.evaluate(() => {
        // 查找我们的导航组件
        const traceNav = document.querySelector('.trace-nav');
        if (traceNav) return true;
        
        // 查找顶部导航
        const topNav = document.querySelector('.trace-top-nav');
        if (topNav) return true;
        
        // 查找导航容器
        const navContainer = document.getElementById('nav-container');
        if (navContainer && navContainer.children.length > 0) return true;
        
        // 查找任何标准导航元素
        const standardNavs = document.querySelectorAll('nav, [role="navigation"], .nav, .navbar, .navigation');
        return standardNavs.length > 0;
      });
      
      if (!navExists) {
        throw new Error('未找到导航菜单');
      }
    });
    
    // 测试3: 登录功能（如果未登录）
    await runTest('登录功能测试', async () => {
      // 检查是否已登录
      const isLoggedIn = await page.evaluate(() => {
        return window.traceCommon && 
          typeof window.traceCommon.isAuthenticated === 'function' && 
          window.traceCommon.isAuthenticated();
      });
      
      if (!isLoggedIn) {
        // 尝试找到登录链接并点击
        const loginLink = await page.$('a[href*="login"], a:text("登录"), .login-button');
        
        if (loginLink) {
          await loginLink.click();
          await page.waitForNavigation();
          
          // 填写登录表单（使用测试用户名和密码）
          await page.fill('input[type="text"], input[name="username"], input[id="username"]', 'testuser');
          await page.fill('input[type="password"], input[name="password"], input[id="password"]', 'testpassword');
          
          // 点击登录按钮
          await page.click('button[type="submit"], button:text("登录"), input[type="submit"]');
          
          // 等待登录完成
          await page.waitForNavigation();
          
          // 验证登录成功
          const loginSuccessful = await page.evaluate(() => {
            return window.traceCommon && 
              typeof window.traceCommon.isAuthenticated === 'function' && 
              window.traceCommon.isAuthenticated();
          });
          
          if (!loginSuccessful) {
            throw new Error('登录失败');
          }
        } else {
          console.log('未找到登录链接，可能已经登录或在其他页面');
        }
      } else {
        console.log('用户已登录，跳过登录测试');
      }
    });
    
    // 测试4: 数据导入功能
    await runTest('数据导入功能测试', async () => {
      // 导航到数据导入页面（假设在物流或加工模块中）
      await page.goto('http://localhost:8080/pages/processing/', { waitUntil: 'networkidle' });
      
      // 检查数据导入按钮或链接是否存在
      const importBtn = await page.$('button:text("导入"), button[id*="import"], a:text("导入")');
      
      if (importBtn) {
        // 点击导入按钮
        await importBtn.click();
        
        // 等待导入对话框显示
        await page.waitForSelector('.import-dialog, dialog, [role="dialog"]', { timeout: 5000 }).catch(() => {
          console.log('导入对话框未显示，继续测试');
        });
        
        // 检查导入功能是否存在于页面的JavaScript中
        const importFunctionExists = await page.evaluate(() => {
          return window.traceDataTools && 
            typeof window.traceDataTools.handleFileImport === 'function';
        });
        
        if (!importFunctionExists) {
          throw new Error('找不到数据导入功能');
        }
      } else {
        console.log('未找到导入按钮，数据导入功能可能位于其他位置');
      }
    });
    
    // 测试5: 检查错误处理功能
    await runTest('错误处理功能测试', async () => {
      // 先导航到首页确保组件加载
      await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
      
      // 等待2秒以确保脚本完全加载
      await page.waitForTimeout(2000);

      // 检查导航组件是否存在
      const navExists = await page.$eval('#nav-container', el => !!el);
      if (!navExists) {
        console.log('导航容器不存在，可能影响错误处理器加载');
      }
      
      // 检查错误处理器是否存在
      const errorHandlerExists = await page.evaluate(() => {
        console.log('检查错误处理器', window.traceErrorHandler);
        return window.traceErrorHandler && 
          typeof window.traceErrorHandler.handleError === 'function';
      });
      
      if (!errorHandlerExists) {
        throw new Error('找不到错误处理功能');
      }
    });
    
  } finally {
    // 保存测试结果
    fs.writeFileSync(
      path.join(screenshotDir, 'functionality_test_report.json'),
      JSON.stringify(testResults, null, 2)
    );
    
    // 保存总体测试截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'functionality_test_final.png'),
      fullPage: true 
    });
    
    await browser.close();
    console.log('功能验证测试完成');
  }
})(); 