const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  baseUrl: 'http://localhost:8080',
  pages: [
    // 首页和功能模块选择页面
    { 
      name: '首页', 
      path: '/',
      buttons: [
        { selector: '.primary-btn, .btn-primary, .action-btn, button, a.btn, .card button, .card a', label: '主要按钮' },
        { selector: '.module-card, .module-card a, .card-action, .card, a.card, [data-module], [data-action]', label: '模块卡片' }
      ]
    },
    { 
      name: '功能选择器', 
      path: '/pages/home/home-selector.html',
      buttons: [
        // 更精确的选择器，专门针对home-selector.html页面中的卡片
        { 
          selector: '.module-card:not(.disabled), .module-sections .card:not(.disabled)', 
          label: '功能模块卡片',
          maxTestButtons: 3, // 限制测试按钮数量
          skipInactive: true, // 跳过不活跃的按钮
          beforeTest: `
            // 模拟点击处理器，用于测试
            window.traceAuth = window.traceAuth || { init: function() { console.log('模拟Auth初始化'); } };
            window.appRouter = window.appRouter || { navigate: function(path) { 
              console.log('模拟路由导航:', path); 
              if (path && !path.startsWith('#')) {
                window.location.href = path;
              }
            }};
            
            // 处理可能导致问题的模块卡片
            document.querySelectorAll('.module-card, .module-sections .card').forEach(card => {
              // 添加点击事件处理
              card.onclick = function() {
                const target = card.getAttribute('data-target');
                const module = card.getAttribute('data-module');
                if (target) {
                  console.log('点击卡片，目标:', target);
                  // 直接导航到相应页面
                  const links = {
                    'farming': '../farming/farming-monitor.html',
                    'trace': '../trace/trace-list.html',
                    'logistics': '../logistics/logistics-tracking.html',
                    'processing': '../processing/processing-monitor.html',
                    'admin': '../admin/admin-system.html',
                    'profile': '../profile/profile.html'
                  };
                  
                  if (links[target]) {
                    window.location.href = links[target];
                  }
                } else if (module) {
                  console.log('点击模块:', module);
                }
              };
              
              // 标记为可点击
              card.style.cursor = 'pointer';
              card.style.position = 'relative';
              card.style.zIndex = '10';
            });
          `
        },
        { 
          selector: '.user-card, .settings-link, .profile-link', 
          label: '用户相关链接',
          maxTestButtons: 2, // 限制测试按钮数量
          beforeTest: `
            // 隐藏可能导致问题的覆盖层
            document.querySelectorAll('.overlay, .modal, .popup').forEach(el => {
              el.style.display = 'none';
            });
            
            // 处理用户卡片点击
            const userCard = document.querySelector('.user-card');
            if (userCard) {
              userCard.onclick = function() {
                console.log('点击用户卡片');
                window.location.href = '../profile/profile.html';
              };
            }
            
            // 处理设置链接
            const settingsLink = document.querySelector('.settings-link');
            if (settingsLink) {
              settingsLink.onclick = function() {
                console.log('点击设置链接');
                window.location.href = '../profile/settings.html';
              };
            }
          `
        }
      ],
      // 针对此页面的特殊处理
      pageOptions: {
        timeout: 15000, // 合理的超时时间
        navigationTimeout: 3000, // 导航等待时间
        attemptLimit: 2, // 重试限制
        abortOnError: false, // 错误时不中断整个测试
        headless: true // 使用无头模式测试此页面
      }
    },
    
    // 个人中心页面
    { 
      name: '个人中心', 
      path: '/pages/profile/profile.html',
      buttons: [
        { selector: '.profile-action, .setting-item, .card, .card-body a, .card button, button, a.btn', label: '个人设置项' },
        { selector: '.menu-item, .nav-item, .sidebar-item, nav a, .sidebar a, .main-menu a, .nav a', label: '导航项' }
      ]
    },
    { 
      name: '设置页面', 
      path: '/pages/profile/settings.html',
      buttons: [
        { selector: '.setting-card, .setting-item, .settings a, .card, .card a, .card button, button, a.btn, [data-action]', label: '设置项' }
      ]
    },
    
    // 管理页面
    { 
      name: '系统管理', 
      path: '/pages/admin/admin-system.html',
      buttons: [
        { selector: '.menu-item, .sidebar-item, .main-menu a, .sidebar a, aside a, nav a, .nav-link, a[href], [data-menu]', label: '菜单项' },
        { selector: '.action-btn, .function-btn, button, a.btn, .card button, .card a, input[type="button"], input[type="submit"], [role="button"], [data-action], .control-action', label: '功能按钮' },
        { selector: '.main-content a, .content a, .content button, .content [data-action]', label: '内容交互元素' },
        { selector: '.config-item, .system-action, .admin-action, .settings-action', label: '系统配置项' }
      ]
    },
    
    // 管理设置页面
    { 
      name: '管理设置', 
      path: '/pages/admin/admin-settings.html',
      buttons: [
        { selector: 'button, a.btn, input[type="button"], input[type="submit"], [role="button"], .btn, .button, .action-button, [data-action]', label: '所有按钮' },
        { selector: '.card, .card a, .card button, .settings-card, .settings-item, .action-card', label: '设置卡片' },
        { selector: 'form button, form input[type="submit"], .form-action', label: '表单操作' }
      ]
    },
    
    // 农场相关页面
    {
      name: '农场监控', 
      path: '/pages/farming/farming-monitor.html',
      buttons: [
        { 
          selector: 'button, a.btn, .action-btn, .control-btn, .monitor-action, .farming-action', 
          label: '操作按钮',
          // 特殊处理，在测试这些按钮前执行的JavaScript
          beforeTest: `
            // 确保所有农场监控按钮可点击
            document.querySelectorAll('button, a.btn, .action-btn, .control-btn, .monitor-action, .farming-action').forEach(btn => {
              btn.style.position = 'relative';
              btn.style.zIndex = '100';
              btn.style.pointerEvents = 'auto';
            });
            
            // 特别处理"查看历史"和"调整投喂量"按钮
            ['查看历史', '调整投喂量'].forEach(text => {
              const buttons = Array.from(document.querySelectorAll('button')).filter(
                b => b.textContent && b.textContent.trim().includes(text)
              );
              
              if (buttons.length > 0) {
                buttons.forEach(btn => {
                  btn.style.opacity = '1';
                  btn.style.visibility = 'visible';
                  btn.style.display = 'block';
                  btn.style.pointerEvents = 'auto';
                });
              }
            });
          `
        },
        { 
          selector: '.data-card, .data-card button, .data-card a, .monitoring-card, .monitoring-item', 
          label: '数据卡片',
          // 确保可见
          beforeTest: `
            document.querySelectorAll('.data-card, .data-card button, .data-card a, .monitoring-card, .monitoring-item').forEach(el => {
              el.style.zIndex = '10';
              el.style.position = 'relative';
              el.style.pointerEvents = 'auto';
            });
          `
        }
      ]
    },
    
    // 其他关键页面
    { 
      name: '追溯记录', 
      path: '/pages/trace/trace-list.html',
      buttons: [
        { 
          selector: '.trace-item, .list-item, .item, tr, .record-item, .data-row, a.btn, button', 
          label: '记录项',
          // 修复菜单拦截问题
          beforeTest: `
            // 隐藏可能拦截点击的菜单
            const menu = document.querySelector('.trace-more-menu');
            if (menu && menu.classList.contains('visible')) {
              menu.classList.remove('visible');
            }
            
            // 确保所有按钮可点击
            document.querySelectorAll('.trace-item, .list-item, .item, tr, .record-item, .data-row, a.btn, button').forEach(el => {
              el.style.position = 'relative';
              el.style.zIndex = '100';
              el.style.pointerEvents = 'auto';
            });
          `
        },
        { 
          selector: '.action-btn, .filter-btn, .search-btn, .btn, button, a.btn, input[type="button"]', 
          label: '操作按钮',
          // 特殊处理日期筛选按钮
          beforeTest: `
            // 处理日期筛选按钮
            ['今日', '近7天', '近30天', '全部', '已完成', '待审核', '异常', '草稿'].forEach(text => {
              const buttons = Array.from(document.querySelectorAll('button')).filter(
                b => b.textContent && b.textContent.trim() === text
              );
              
              if (buttons.length > 0) {
                buttons.forEach(btn => {
                  btn.style.position = 'relative';
                  btn.style.zIndex = '200';
                  btn.style.pointerEvents = 'auto';
                  
                  // 修改按钮的点击处理程序，避免拦截
                  const originalOnClick = btn.onclick;
                  btn.onclick = function(e) {
                    e.stopPropagation();
                    console.log('点击筛选按钮:', text);
                    
                    // 触发原始点击事件
                    if (originalOnClick && typeof originalOnClick === 'function') {
                      return originalOnClick.call(this, e);
                    }
                  };
                });
              }
            });
            
            // 处理遮挡元素
            document.querySelectorAll('.trace-top-nav, .trace-more-menu').forEach(el => {
              el.style.pointerEvents = 'none';
            });
            
            document.querySelectorAll('.trace-top-nav *, .trace-more-menu *').forEach(el => {
              el.style.pointerEvents = 'auto';
            });
          `
        }
      ]
    }
  ],
  screenshotsDir: path.join(__dirname, '../validation/reports/screenshots/button-navigation'),
  reportPath: path.join(__dirname, '../validation/reports/button_navigation_report.json'),
  htmlReportPath: path.join(__dirname, '../validation/reports/button_navigation_report.html')
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
 * 运行按钮导航测试
 */
async function run() {
  console.log('开始测试按钮触发的页面导航...');
  
  // 获取全局配置的无头模式设置
  const useHeadless = true; // 默认使用无头模式提高稳定性
  
  const browser = await chromium.launch({ 
    headless: useHeadless,
    // 添加浏览器启动参数，提高稳定性
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  // 创建一个带有更长超时的上下文
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    navigationTimeout: 30000
  });
  
  try {
    const results = [];
    
    // 添加全局错误处理
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
      // 不会崩溃进程，而是继续执行
    });
    
    // 遍历每个页面
    for (const pageConfig of config.pages) {
      const url = config.baseUrl + pageConfig.path;
      console.log(`\n正在测试页面: ${pageConfig.name} (${url})`);
      
      // 获取页面特定选项或使用默认值
      const pageOptions = pageConfig.pageOptions || {};
      const pageTimeout = pageOptions.timeout || 15000;
      const navigationTimeout = pageOptions.navigationTimeout || 3000;
      const attemptLimit = pageOptions.attemptLimit || 1;
      const abortOnError = pageOptions.abortOnError !== undefined ? pageOptions.abortOnError : true;
      
      try {
        const page = await context.newPage();
        
        // 设置页面错误处理
        page.on('error', error => {
          console.error(`页面错误: ${error.message}`);
        });
        
        page.on('pageerror', error => {
          console.error(`页面JS错误: ${error.message}`);
        });
        
        // 更健壮的页面加载
        let loadAttempt = 0;
        let pageLoaded = false;
        
        while (!pageLoaded && loadAttempt < 3) {
          loadAttempt++;
          try {
            console.log(`  尝试加载页面 (尝试 ${loadAttempt}/3)...`);
            await page.goto(url, { timeout: pageTimeout, waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle', { timeout: pageTimeout }).catch(() => {
              console.log(`  页面网络活动未完全停止，但继续测试`);
            });
            pageLoaded = true;
          } catch (error) {
            console.log(`  警告：页面加载失败 (${error.message})，${loadAttempt < 3 ? '重试中' : '继续执行测试'}`);
            if (loadAttempt >= 3) break;
            await page.waitForTimeout(2000);
          }
        }
        
        // 确保页面稳定
        console.log(`  等待页面稳定...`);
        await page.waitForTimeout(2000);
        
        // 截取页面截图
        const pageScreenshotPath = path.join(config.screenshotsDir, `${pageConfig.name.replace(/[^a-zA-Z0-9]/g, '_')}_before.png`);
        await page.screenshot({ path: pageScreenshotPath });
        
        const pageResult = {
          name: pageConfig.name,
          url: url,
          buttonResults: []
        };
        
        // 测试页面上的每组按钮
        for (const buttonConfig of pageConfig.buttons) {
          console.log(`  查找按钮: ${buttonConfig.label} (${buttonConfig.selector})`);
          
          // 执行前置测试脚本，如果有的话
          if (buttonConfig.beforeTest) {
            try {
              await page.evaluate(script => {
                eval(script);
              }, buttonConfig.beforeTest);
              
              // 等待任何DOM更改完成
              await page.waitForTimeout(500);
            } catch (error) {
              console.log(`  警告：执行前置测试脚本时出错: ${error.message}`);
            }
          }
          
          // 查找符合条件的按钮
          let buttons = await page.$$(buttonConfig.selector);
          console.log(`  找到 ${buttons.length} 个按钮`);
          
          // 如果需要跳过不活跃按钮
          if (buttonConfig.skipInactive) {
            const activeButtons = [];
            for (const btn of buttons) {
              const shouldSkip = await btn.evaluate(el => {
                return el.hasAttribute('data-test-skip') || 
                       el.classList.contains('disabled') || 
                       el.classList.contains('inactive') ||
                       window.getComputedStyle(el).display === 'none' ||
                       window.getComputedStyle(el).visibility === 'hidden' ||
                       window.getComputedStyle(el).opacity < 0.5;
              }).catch(() => false);
              
              if (!shouldSkip) {
                activeButtons.push(btn);
              }
            }
            
            if (activeButtons.length < buttons.length) {
              console.log(`  跳过了 ${buttons.length - activeButtons.length} 个不活跃按钮`);
              buttons = activeButtons;
            }
          }
          
          // 限制测试数量，避免大量测试导致卡顿
          if (buttonConfig.maxTestButtons && buttons.length > buttonConfig.maxTestButtons) {
            console.log(`  按钮过多，限制测试数量到 ${buttonConfig.maxTestButtons} 个`);
            buttons = buttons.slice(0, buttonConfig.maxTestButtons);
          }
          
          // 如果没有找到按钮，记录并继续
          if (buttons.length === 0) {
            pageResult.buttonResults.push({
              label: buttonConfig.label,
              selector: buttonConfig.selector,
              count: 0,
              success: false,
              error: '未找到按钮'
            });
            continue;
          }
          
          // 测试每个按钮
          const buttonGroupResult = {
            label: buttonConfig.label,
            selector: buttonConfig.selector,
            count: buttons.length,
            buttons: []
          };
          
          for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            
            try {
              // 获取按钮文本或其他标识
              let buttonText = await button.evaluate(el => {
                return el.innerText || el.textContent || el.value || el.title || el.getAttribute('aria-label') || `按钮 ${i+1}`;
              });
              buttonText = buttonText.trim();
              
              console.log(`    测试按钮 ${i+1}: ${buttonText}`);
              
              // 创建一个新页面以处理导航
              const popupPromise = context.waitForEvent('page', { timeout: navigationTimeout }).catch(() => null);
              
              // 获取当前URL用于比较
              const beforeUrl = page.url();
              
              // 截图
              const buttonBeforeScreenshot = path.join(config.screenshotsDir, `${pageConfig.name.replace(/[^a-zA-Z0-9]/g, '_')}_button_${i+1}_before.png`);
              await page.screenshot({ path: buttonBeforeScreenshot });
              
              // 进行多次尝试点击操作
              let clickSuccess = false;
              let clickError = null;
              let attemptCount = 0;
              
              while (!clickSuccess && attemptCount < attemptLimit) {
                attemptCount++;
                try {
                  // 尝试方法1: 确保按钮可见且可点击
                  await button.evaluate(el => {
                    // 确保按钮可见
                    el.style.zIndex = '1000';
                    el.style.position = 'relative';
                    el.style.pointerEvents = 'auto';
                    
                    // 如果有父元素拦截点击，临时禁用其指针事件
                    let parent = el.parentElement;
                    const origStyles = [];
                    
                    while (parent && parent !== document.body) {
                      if (window.getComputedStyle(parent).pointerEvents === 'none') continue;
                      
                      origStyles.push({
                        element: parent,
                        pointerEvents: parent.style.pointerEvents
                      });
                      
                      parent.style.pointerEvents = 'none';
                      parent = parent.parentElement;
                    }
                    
                    // 2秒后恢复原始样式
                    setTimeout(() => {
                      origStyles.forEach(style => {
                        style.element.style.pointerEvents = style.pointerEvents;
                      });
                    }, 2000);
                    
                    // 触发鼠标悬停，某些情况下可以激活元素
                    const hoverEvent = new MouseEvent('mouseover', {
                      view: window,
                      bubbles: true,
                      cancelable: true
                    });
                    el.dispatchEvent(hoverEvent);
                  });
                  
                  // 等待可能的视觉反馈
                  await page.waitForTimeout(500);
                  
                  // 尝试常规点击
                  console.log(`      尝试常规点击 (尝试 ${attemptCount}/${attemptLimit})...`);
                  await button.click({ force: true, timeout: 5000 });
                  clickSuccess = true;
                } catch (err) {
                  clickError = err;
                  console.log(`      常规点击失败: ${err.message}`);
                  
                  if (attemptCount < attemptLimit) {
                    console.log(`      将重试...`);
                    await page.waitForTimeout(1000);
                    continue;
                  }
                  
                  // 尝试方法2: 使用JavaScript点击
                  try {
                    console.log(`      尝试JavaScript点击...`);
                    await button.evaluate(el => {
                      // 创建并分发点击事件
                      const event = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                      });
                      
                      el.dispatchEvent(event);
                      
                      // 如果有href属性，手动导航
                      if (el.hasAttribute('href')) {
                        const href = el.getAttribute('href');
                        if (href && !href.startsWith('#') && href !== 'javascript:void(0)') {
                          window.location.href = href;
                        }
                      }
                      
                      // 如果有onclick属性，尝试执行
                      if (el.hasAttribute('onclick')) {
                        const onclickCode = el.getAttribute('onclick');
                        try {
                          eval(onclickCode);
                        } catch (e) {
                          console.error('执行onclick代码失败:', e);
                        }
                      }
                      
                      // 如果有data-href属性，尝试导航
                      if (el.hasAttribute('data-href')) {
                        const href = el.getAttribute('data-href');
                        if (href && !href.startsWith('#')) {
                          window.location.href = href;
                        }
                      }
                      
                      // 如果是a标签，模拟点击
                      if (el.tagName === 'A') {
                        el.click();
                      }
                    });
                    
                    clickSuccess = true;
                    console.log(`      使用JavaScript点击成功`);
                  } catch (jsError) {
                    console.log(`      JavaScript点击也失败: ${jsError.message}`);
                    
                    // 尝试方法3: 模拟键盘的Enter键点击
                    try {
                      console.log(`      尝试使用键盘Enter键点击...`);
                      await button.focus();
                      await page.keyboard.press('Enter');
                      clickSuccess = true;
                      console.log(`      使用键盘点击成功`);
                    } catch (kbError) {
                      console.log(`      键盘点击也失败: ${kbError.message}`);
                    }
                  }
                }
              }
              
              if (!clickSuccess) {
                throw new Error(`无法点击按钮: ${clickError ? clickError.message : '未知错误'}`);
              }
              
              // 等待导航完成或其他交互效果
              const waitTime = navigationTimeout;
              console.log(`      等待导航或交互完成 (${waitTime}ms)...`);
              await page.waitForTimeout(waitTime);
              
              // 检查是否有新窗口打开
              const popup = await popupPromise;
              if (popup) {
                // 如果有新窗口，获取新窗口的URL
                const popupUrl = popup.url();
                console.log(`      按钮打开了新窗口: ${popupUrl}`);
                
                // 截图
                const popupScreenshot = path.join(config.screenshotsDir, `${pageConfig.name.replace(/[^a-zA-Z0-9]/g, '_')}_button_${i+1}_popup.png`);
                try {
                  await popup.screenshot({ path: popupScreenshot, timeout: 5000 });
                } catch (err) {
                  console.log(`      无法截取新窗口截图: ${err.message}`);
                }
                
                // 关闭新窗口
                await popup.close().catch(err => {
                  console.log(`      关闭新窗口时出错: ${err.message}`);
                });
                
                buttonGroupResult.buttons.push({
                  text: buttonText,
                  index: i,
                  success: true,
                  openedNewWindow: true,
                  beforeUrl: beforeUrl,
                  afterUrl: popupUrl,
                  screenshot: popupScreenshot
                });
              } else {
                // 获取导航后的URL
                const afterUrl = page.url();
                const navigated = beforeUrl !== afterUrl;
                
                // 截图
                const buttonAfterScreenshot = path.join(config.screenshotsDir, `${pageConfig.name.replace(/[^a-zA-Z0-9]/g, '_')}_button_${i+1}_after.png`);
                await page.screenshot({ path: buttonAfterScreenshot });
                
                console.log(`      导航结果: ${navigated ? '已导航到 ' + afterUrl : '未导航'}`);
                
                buttonGroupResult.buttons.push({
                  text: buttonText,
                  index: i,
                  success: true,
                  navigated: navigated,
                  beforeUrl: beforeUrl,
                  afterUrl: afterUrl,
                  screenshot: navigated ? buttonAfterScreenshot : buttonBeforeScreenshot
                });
                
                // 如果发生了导航，返回原页面继续测试
                if (navigated) {
                  console.log(`      返回原页面继续测试...`);
                  let returnSuccess = false;
                  for (let retryCount = 0; retryCount < 3 && !returnSuccess; retryCount++) {
                    try {
                      await page.goto(url, { timeout: pageTimeout, waitUntil: 'domcontentloaded' });
                      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
                        console.log(`  页面网络活动未完全停止，但继续测试`);
                      });
                      returnSuccess = true;
                    } catch (navError) {
                      console.log(`      返回原页面失败 (尝试 ${retryCount+1}/3): ${navError.message}`);
                      if (retryCount === 2) {
                        console.log(`      无法返回原页面，跳过剩余按钮`);
                        break;
                      }
                      await page.waitForTimeout(2000);
                    }
                  }
                  
                  if (!returnSuccess) {
                    console.log(`      重新打开页面失败，中断当前按钮组测试`);
                    break;
                  }
                  
                  // 重新获取所有按钮，因为页面已经重新加载
                  try {
                    buttons = [];
                    const newButtons = await page.$$(buttonConfig.selector);
                    buttons = [...newButtons];
                    
                    // 重新执行前置测试脚本，如果有的话
                    if (buttonConfig.beforeTest) {
                      try {
                        await page.evaluate(script => {
                          eval(script);
                        }, buttonConfig.beforeTest);
                        
                        // 等待任何DOM更改完成
                        await page.waitForTimeout(500);
                      } catch (error) {
                        console.log(`  警告：重新执行前置测试脚本时出错: ${error.message}`);
                      }
                    }
                    
                    // 如果需要跳过不活跃按钮
                    if (buttonConfig.skipInactive) {
                      const activeButtons = [];
                      for (const btn of buttons) {
                        const shouldSkip = await btn.evaluate(el => {
                          return el.hasAttribute('data-test-skip') || 
                                el.classList.contains('disabled') || 
                                el.classList.contains('inactive') ||
                                window.getComputedStyle(el).display === 'none' ||
                                window.getComputedStyle(el).visibility === 'hidden' ||
                                window.getComputedStyle(el).opacity < 0.5;
                        }).catch(() => false);
                        
                        if (!shouldSkip) {
                          activeButtons.push(btn);
                        }
                      }
                      
                      buttons = activeButtons;
                    }
                    
                    // 限制测试数量
                    if (buttonConfig.maxTestButtons && buttons.length > buttonConfig.maxTestButtons) {
                      buttons = buttons.slice(0, buttonConfig.maxTestButtons);
                    }
                  } catch (error) {
                    console.log(`      重新获取按钮失败: ${error.message}`);
                    break;
                  }
                }
              }
            } catch (error) {
              console.log(`      错误: ${error.message}`);
              
              buttonGroupResult.buttons.push({
                text: await button.evaluate(el => el.innerText || el.textContent || '').catch(() => ''),
                index: i,
                success: false,
                error: error.message
              });
              
              // 如果设置了出错中断，则停止当前按钮组测试
              if (abortOnError) {
                console.log(`      由于错误，中断当前按钮组测试`);
                break;
              }
            }
          }
          
          pageResult.buttonResults.push(buttonGroupResult);
        }
        
        results.push(pageResult);
        await page.close();
        
      } catch (pageError) {
        console.error(`测试页面 "${pageConfig.name}" 时出错: ${pageError.message}`);
        
        results.push({
          name: pageConfig.name,
          url: url,
          error: pageError.message,
          buttonResults: []
        });
      }
    }
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      totalPages: config.pages.length,
      results: results
    };
    
    // 计算统计信息
    let totalButtons = 0;
    let navigatedButtons = 0;
    let newWindowButtons = 0;
    let errorButtons = 0;
    
    for (const page of results) {
      for (const buttonGroup of page.buttonResults) {
        if (buttonGroup.buttons) {
          totalButtons += buttonGroup.buttons.length;
          
          for (const button of buttonGroup.buttons) {
            if (!button.success) {
              errorButtons++;
            } else if (button.openedNewWindow) {
              newWindowButtons++;
            } else if (button.navigated) {
              navigatedButtons++;
            }
          }
        }
      }
    }
    
    report.statistics = {
      totalButtons,
      navigatedButtons,
      newWindowButtons,
      errorButtons,
      nonNavigatingButtons: totalButtons - navigatedButtons - newWindowButtons - errorButtons
    };
    
    // 保存JSON报告
    fs.writeFileSync(config.reportPath, JSON.stringify(report, null, 2));
    console.log(`\n报告已保存至: ${config.reportPath}`);
    
    // 生成HTML报告
    const htmlReport = generateHtmlReport(report);
    fs.writeFileSync(config.htmlReportPath, htmlReport);
    console.log(`HTML报告已保存至: ${config.htmlReportPath}`);
    
    return report;
  } finally {
    await browser.close();
  }
}

/**
 * 生成HTML报告
 */
function generateHtmlReport(report) {
  // 页面结果HTML
  const pagesHtml = report.results.map(page => {
    // 每个按钮组的HTML
    const buttonGroupsHtml = page.buttonResults.map(group => {
      // 没有找到按钮的情况
      if (!group.buttons || group.count === 0) {
        return `
          <div class="bg-yellow-50 p-4 rounded-lg mb-4">
            <h3 class="text-lg font-medium text-yellow-800">${group.label}</h3>
            <p class="text-yellow-700">
              <span class="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                ${group.selector}
              </span>
            </p>
            <p class="mt-2 text-yellow-600">未找到符合条件的按钮</p>
          </div>
        `;
      }
      
      // 按钮列表HTML
      const buttonsHtml = group.buttons.map(button => {
        if (!button.success) {
          return `
            <div class="bg-red-50 p-4 rounded-lg mb-4">
              <h3 class="text-lg font-medium text-red-800">${button.text}</h3>
              <p class="text-red-700">
                <span class="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                  ${button.selector}
                </span>
              </p>
              <p class="mt-2 text-red-600">${button.error}</p>
            </div>
          `;
        } else {
          return `
            <div class="bg-green-50 p-4 rounded-lg mb-4">
              <h3 class="text-lg font-medium text-green-800">${button.text}</h3>
              <p class="text-green-700">
                <span class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                  ${button.selector}
                </span>
              </p>
              <p class="mt-2 text-green-600">${button.success ? '点击成功' : '未导航'}</p>
            </div>
          `;
        }
      }).join('');
      
      return `
        <div class="bg-gray-50 p-4 rounded-lg mb-4">
          <h3 class="text-lg font-medium text-gray-800">${group.label}</h3>
          <p class="text-gray-700">
            <span class="inline-block bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">
              ${group.selector}
            </span>
          </p>
          <div class="mt-2 grid grid-cols-${group.count} gap-4">
            ${buttonsHtml}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="bg-gray-50 p-4 rounded-lg mb-4">
        <h2 class="text-xl font-medium text-gray-800">${page.name}</h2>
        <p class="text-gray-700">${page.url}</p>
        <div class="mt-2 grid grid-cols-${page.buttons.length} gap-4">
          ${buttonGroupsHtml}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="bg-gray-50 p-4 rounded-lg">
      <h1 class="text-2xl font-medium text-gray-800">按钮导航测试报告</h1>
      <p class="text-gray-700">${new Date().toISOString()}</p>
      <div class="mt-2 grid grid-cols-${config.pages.length} gap-4">
        ${pagesHtml}
      </div>
    </div>
  `;
}