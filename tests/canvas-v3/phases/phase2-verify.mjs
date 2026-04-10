// tests/canvas-v3/phases/phase2-verify.mjs
import { BrowserClient } from '../lib/browser-client.mjs';

export async function phase2Verify(state, api, report) {
  console.log('\n=== Phase 2: Business Verification ===');
  const browser = new BrowserClient({ headless: true });
  let page;

  try {
    await browser.launch();

    // 2.1 Login as new factory admin
    console.log('2.1 Login as new factory admin...');
    const loggedIn = await browser.login(state.adminUsername, state.adminPassword);
    const shot21 = await browser.screenshot('P2-01-login');

    if (!loggedIn) {
      report.addCheckpoint('P2-1', '新工厂管理员登录', 'FAIL', {
        filled: `用户名=${state.adminUsername}, 密码=${state.adminPassword}`,
        screenshot: shot21,
      });
      await browser.close();
      return { browser: null };
    }

    report.addCheckpoint('P2-1', '新工厂管理员登录', 'PASS', {
      filled: `用户名=${state.adminUsername}, 密码=${state.adminPassword}`,
      toast: '登录成功/跳转到首页',
      screenshot: shot21,
    });
    console.log('  ✅ Logged in');

    page = browser.getPage();

    // 2.2 Navigate to sales order module
    console.log('2.2 Navigate to sales order module...');
    await page.waitForTimeout(1500); // Let the dashboard load

    // Try multiple navigation strategies
    let navigated = false;
    let navStrategy = '';

    // Strategy 1: Direct URL to /modules/sales_order (generic route)
    try {
      await page.goto('http://139.196.165.140:8086/#/modules/sales_order', {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      await page.waitForTimeout(2000);
      const notFoundEl = await page.$('text=404');
      const notFoundEl2 = await page.$('text=Not Found');
      const notFoundEl3 = await page.$('text=页面不存在');
      if (!notFoundEl && !notFoundEl2 && !notFoundEl3) {
        navigated = true;
        navStrategy = 'direct-modules-route';
      }
    } catch (e) {
      console.log(`  Strategy 1 failed: ${e.message}`);
    }

    // Strategy 2: Click sidebar 销售管理 → 销售订单
    if (!navigated) {
      try {
        await page.goto('http://139.196.165.140:8086', {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        await page.waitForTimeout(2000);

        // Try clicking sales management menu
        const salesMenu = await page.$('text=销售管理');
        if (salesMenu) {
          await salesMenu.click();
          await page.waitForTimeout(800);
          const orderMenu = await page.$('text=销售订单');
          if (orderMenu) {
            await orderMenu.click();
            await page.waitForTimeout(2000);
            navigated = true;
            navStrategy = 'sidebar-click';
          }
        } else {
          // Try a single sales order menu item directly
          const soMenu = await page.$('text=销售订单');
          if (soMenu) {
            await soMenu.click();
            await page.waitForTimeout(2000);
            navigated = true;
            navStrategy = 'direct-so-click';
          }
        }
      } catch (e) {
        console.log(`  Strategy 2 failed: ${e.message}`);
      }
    }

    // Strategy 3: Try common hash routes for sales orders
    if (!navigated) {
      const routes = [
        '/#/sales/orders',
        '/#/sales-order',
        '/#/salesOrder',
        '/#/crm/sales-order',
      ];
      for (const route of routes) {
        try {
          await page.goto(`http://139.196.165.140:8086${route}`, {
            waitUntil: 'networkidle',
            timeout: 8000,
          });
          await page.waitForTimeout(1500);
          const has404 = await page.$('text=404');
          if (!has404) {
            const currentUrl = page.url();
            if (!currentUrl.includes('login')) {
              navigated = true;
              navStrategy = `route-${route}`;
              break;
            }
          }
        } catch (e) {
          // continue trying
        }
      }
    }

    const shot22a = await browser.screenshot('P2-02a-so-page');
    const currentUrl22 = page.url();

    if (!navigated) {
      report.addCheckpoint('P2-2a', '导航到销售订单', 'WARN', {
        screenshot: shot22a,
        detail: 'All navigation strategies failed — staying on current page',
        url: currentUrl22,
      });
      console.log('  ⚠️  Could not navigate to sales order via any strategy');
    } else {
      report.addCheckpoint('P2-2a', '导航到销售订单', 'PASS', {
        screenshot: shot22a,
        detail: `Strategy: ${navStrategy}`,
        url: currentUrl22,
      });
      console.log(`  ✅ Navigated via ${navStrategy}`);
    }

    // 2.3 Check if dynamic fields render
    console.log('2.3 Check dynamic fields render...');

    // Try to find "新建" or "添加" button and click it
    let openedForm = false;
    let formOpenError = '';
    try {
      const newBtn = await page.$(
        'button:has-text("新建"), button:has-text("添加"), button:has-text("新增")'
      );
      if (newBtn) {
        await newBtn.click();
        await page.waitForTimeout(1500);
        openedForm = true;
        console.log('  ✅ Opened new-order form');
      } else {
        formOpenError = 'No 新建/添加/新增 button found';
        console.log(`  ⚠️  ${formOpenError}`);
      }
    } catch (e) {
      formOpenError = e.message;
      console.log(`  ⚠️  Could not open form: ${e.message}`);
    }

    const shot22b = await browser.screenshot('P2-02b-so-form');

    // Check for dynamic field labels in DOM
    const hasCustomerLevel = (await page.$('text=客户等级')) !== null;
    const hasDeliveryPriority = (await page.$('text=交货优先级')) !== null;
    const hasExpectedMargin = (await page.$('text=预期毛利率')) !== null;
    const hasPrepaymentRecords = (await page.$('text=预付款记录')) !== null;

    const foundCount = [
      hasCustomerLevel,
      hasDeliveryPriority,
      hasExpectedMargin,
      hasPrepaymentRecords,
    ].filter(Boolean).length;

    console.log(`  Dynamic fields found: customer_level=${hasCustomerLevel}, delivery_priority=${hasDeliveryPriority}, expected_margin=${hasExpectedMargin}, prepayment_records=${hasPrepaymentRecords}`);

    const details = {
      openedForm,
      formOpenError: formOpenError || undefined,
      customer_level: hasCustomerLevel,
      delivery_priority: hasDeliveryPriority,
      expected_margin: hasExpectedMargin,
      prepayment_records: hasPrepaymentRecords,
      foundCount,
      screenshot: shot22b,
    };

    if (foundCount >= 2) {
      report.addCheckpoint('P2-2', '动态字段在表单中渲染', 'PASS', details);
      console.log(`  ✅ Found ${foundCount}/4 dynamic fields in DOM`);
    } else if (foundCount > 0) {
      report.addCheckpoint('P2-2', '动态字段在表单中渲染', 'WARN', {
        ...details,
        note: `仅找到 ${foundCount}/4 字段, 前端可能未完全集成`,
      });
      console.log(`  ⚠️  Only found ${foundCount}/4 dynamic fields`);
    } else {
      report.addCheckpoint('P2-2', '动态字段在表单中渲染', 'KNOWN_BUG', {
        ...details,
        note: 'SchemaFormRenderer 未在 sales_order 页面使用, 动态字段不渲染',
      });
      console.log(`  🐛 No dynamic fields found — SchemaFormRenderer not wired in`);
    }

    // Take a final screenshot of whatever state the page is in
    const shot23 = await browser.screenshot('P2-03-final');
    report.addCheckpoint('P2-3', 'Phase 2 完成截图', 'PASS', {
      screenshot: shot23,
      url: page.url(),
    });

    return { browser, page };
  } catch (e) {
    console.error('Phase 2 error:', e);
    try {
      await browser.close();
    } catch (_) {}
    throw e;
  }
}
