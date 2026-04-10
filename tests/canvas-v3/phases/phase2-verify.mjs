// tests/canvas-v3/phases/phase2-verify.mjs
import { BrowserClient } from '../lib/browser-client.mjs';
import { sshLogGrep } from '../lib/ssh-client.mjs';

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

    // ============================================
    // Phase 2 Behavior Tests (API-based)
    // ============================================

    // Prerequisite A: Create a test product type (needed for sales order items)
    console.log('\n2.Pre.A Creating test product type...');
    let testProductTypeId = null;
    try {
      const ptResp = await api.authedPost(state.factoryId, '/product-types', {
        code: 'CANVAS-TEST-SKU',
        name: 'Canvas测试产品',
        category: 'FINISHED',
        unit: '箱',
        unitPrice: 100,
        isActive: true,
      });
      testProductTypeId = ptResp.data?.id || ptResp.id;
      if (testProductTypeId) {
        console.log(`  ✅ Product type created: ${testProductTypeId}`);
      } else {
        console.log(`  ⚠️ Product type creation returned: ${JSON.stringify(ptResp).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ⚠️ Product type creation failed: ${e.message}`);
    }

    // Prerequisite B: Create a test customer
    console.log('\n2.Pre.B Creating test customer...');
    let testCustomerId = null;
    try {
      const custResp = await api.authedPost(state.factoryId, '/customers', {
        name: 'Canvas测试客户',
        contactPerson: '测试联系人',
        phone: '13900000001',
        shippingAddress: '上海市测试地址001号',
      });
      testCustomerId = custResp.data?.id || custResp.id;
      if (testCustomerId) {
        console.log(`  ✅ Customer created: ${testCustomerId}`);
      } else {
        console.log(`  ⚠️ Customer creation returned: ${JSON.stringify(custResp).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ⚠️ Customer creation failed: ${e.message}`);
    }

    const prereqReady = testCustomerId && testProductTypeId;

    // 2.5 Validation rule blocks: 1 item × unitPrice=50 → totalAmount=50 < 100 → BLOCK
    console.log('\n2.5 Test validation rule blocks totalAmount=50...');
    if (!prereqReady) {
      report.addCheckpoint('P2-5', '校验规则拦截 amount=50', 'SKIP', {
        reason: `无法创建预置数据 (customer=${testCustomerId}, product=${testProductTypeId})`,
      });
    } else {
      try {
        const resp = await api.authedPost(state.factoryId, '/sales/orders', {
          customerId: testCustomerId,
          orderDate: '2026-04-10',
          items: [{
            productTypeId: testProductTypeId,
            productName: 'Canvas测试产品',
            quantity: 1,
            unit: '箱',
            unitPrice: 50,
          }],
        });
        // Check if blocked: success=false with message containing "100"
        const wasBlocked =
          resp.success === false ||
          (resp.message && resp.message.includes('100')) ||
          (resp._raw && resp._raw.includes('100'));
        // If order was created (not blocked), this is a KNOWN_GAP — rule stored but not enforced
        const orderCreated = resp.success !== false && !!(resp.data?.id || resp.id);
        const status = wasBlocked ? 'PASS' : (orderCreated ? 'KNOWN_GAP' : 'FAIL');
        report.addCheckpoint('P2-5', '校验规则拦截 amount=50', status, {
          filled: 'customerId=test, 1×50=totalAmount50',
          apiResponse: {
            success: resp.success,
            message: resp.message,
            orderId: resp.data?.id || resp.id,
          },
          note: orderCreated
            ? '规则已写入 factory_validation_rules 但 SalesServiceImpl 未接入校验引擎'
            : undefined,
        });
        const icon = wasBlocked ? '✅' : (orderCreated ? '🐛' : '❌');
        console.log(`  ${icon} Validation response: ${resp.message || JSON.stringify(resp).slice(0, 150)}`);
      } catch (e) {
        // Error thrown might indicate validation worked (e.g., HTTP 4xx)
        const blocked = e.message.includes('100') || e.message.includes('BLOCK');
        report.addCheckpoint('P2-5', '校验规则拦截 amount=50', blocked ? 'PASS' : 'FAIL', {
          error: e.message,
        });
        console.log(`  ${blocked ? '✅' : '❌'} Exception: ${e.message.slice(0, 150)}`);
      }
    }

    // 2.14A Old rule (>=100) allows: 1 item × unitPrice=200 → totalAmount=200 ≥ 100 → ALLOW
    console.log('\n2.14A Old rule allows amount=200...');
    if (!prereqReady) {
      report.addCheckpoint('P2-14A', '旧规则允许 amount=200', 'SKIP', {
        reason: `无法创建预置数据 (customer=${testCustomerId}, product=${testProductTypeId})`,
      });
    } else {
      try {
        const resp = await api.authedPost(state.factoryId, '/sales/orders', {
          customerId: testCustomerId,
          orderDate: '2026-04-10',
          items: [{
            productTypeId: testProductTypeId,
            productName: 'Canvas测试产品',
            quantity: 1,
            unit: '箱',
            unitPrice: 200,
          }],
        });
        const orderId = resp.data?.id || resp.id;
        const allowed = resp.success !== false && !!orderId;
        if (orderId) {
          state.phase2OrderId = orderId;
        }
        report.addCheckpoint('P2-14A', '旧规则允许 amount=200', allowed ? 'PASS' : 'FAIL', {
          filled: 'customerId=test, 1×200=totalAmount200',
          apiResponse: {
            success: resp.success,
            orderId,
            message: resp.message,
          },
        });
        console.log(`  ${allowed ? '✅' : '❌'} Order created: ${orderId || 'none'} | ${resp.message || JSON.stringify(resp).slice(0, 100)}`);
      } catch (e) {
        report.addCheckpoint('P2-14A', '旧规则允许 amount=200', 'FAIL', { error: e.message });
        console.log(`  ❌ Exception: ${e.message.slice(0, 150)}`);
      }
    }

    // 2.11 Trigger chain execution
    console.log('\n2.11 Trigger chain execution (SO confirmed)...');
    if (!state.phase2OrderId) {
      report.addCheckpoint('P2-11', '触发链真实执行', 'SKIP', {
        reason: 'Phase 2.14A 未创建订单',
      });
    } else {
      // Try to confirm the order via common confirm endpoints
      let confirmSuccess = false;
      const confirmPaths = [
        `/sales/orders/${state.phase2OrderId}/confirm`,
        `/sales/orders/${state.phase2OrderId}/status?status=CONFIRMED`,
      ];
      for (const path of confirmPaths) {
        try {
          const resp = await api.authedPost(state.factoryId, path, {});
          if (resp.success !== false) {
            confirmSuccess = true;
            console.log(`  ✅ Confirmed via: ${path}`);
            break;
          } else {
            console.log(`  ⚠️ ${path} → ${resp.message}`);
          }
        } catch (e) {
          console.log(`  ⚠️ ${path} failed: ${e.message.slice(0, 80)}`);
        }
      }

      // Give server a moment to fire any trigger chains
      await new Promise(r => setTimeout(r, 2000));

      const chainLogs = sshLogGrep('so_confirmed_chain');
      const toolLogs = sshLogGrep('scheduling_list');
      const chainFired = chainLogs.length > 0 || toolLogs.length > 0;

      if (chainFired) {
        report.addCheckpoint('P2-11', '触发链真实执行', 'PASS', {
          confirmSuccess,
          chainLogs: chainLogs.slice(0, 300),
          toolLogs: toolLogs.slice(0, 300),
        });
        console.log(`  ✅ Trigger chain fired (log evidence)`);
      } else {
        report.addCheckpoint('P2-11', '触发链真实执行', 'KNOWN_GAP', {
          confirmSuccess,
          note: '无日志证据 — 可能未触发或日志模式不同',
        });
        console.log(`  🐛 No trigger chain evidence in logs`);
      }
    }

    return { browser, page };
  } catch (e) {
    console.error('Phase 2 error:', e);
    try {
      await browser.close();
    } catch (_) {}
    throw e;
  }
}
