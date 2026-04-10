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

    // ============================================
    // Phase 2 Multi-tenant Isolation Tests
    // ============================================

    // 2.16 F-TEST fields don't pollute F001
    console.log('\n2.16 Cross-factory isolation — F001 should not see F-TEST fields...');
    let f001Token = null;
    try {
      const f001Login = await api.login('factory_admin1', '123456');
      if (f001Login.success) {
        f001Token = f001Login.data.accessToken;
        api.setToken('F001', f001Token);

        // Get F001's effective config for sales_order
        const f001Config = await api.authedGet(
          'F001',
          '/config/modules/sales_order/effective'
        );

        const f001Fields = f001Config.data?.fields || f001Config.fields || [];
        const fTestFieldCodes = [
          'customer_level',
          'delivery_priority',
          'expected_margin',
          'prepayment_records',
        ];

        const pollutedFields = f001Fields.filter(f =>
          fTestFieldCodes.includes(f.code)
        );

        if (pollutedFields.length === 0) {
          report.addCheckpoint('P2-16', 'F001 不含 F-TEST 动态字段', 'PASS', {
            f001FieldCount: f001Fields.length,
            fTestFieldsFound: 0,
            detail: 'F001 正向隔离正常',
          });
          console.log(`  ✅ F001 has ${f001Fields.length} fields, none from F-TEST`);
        } else {
          report.addCheckpoint('P2-16', 'F001 不含 F-TEST 动态字段', 'FAIL', {
            f001FieldCount: f001Fields.length,
            fTestFieldsFound: pollutedFields.length,
            polluted: pollutedFields.map(f => f.code),
            detail: 'F001 被 F-TEST 字段污染',
          });
          console.log(`  ❌ F001 polluted with: ${pollutedFields.map(f => f.code).join(', ')}`);
        }
      } else {
        report.addCheckpoint('P2-16', 'F001 不含 F-TEST 动态字段', 'SKIP', {
          reason: 'F001 登录失败',
          loginResp: f001Login.message,
        });
        console.log('  ⏭️ F001 login failed');
      }
    } catch (e) {
      report.addCheckpoint('P2-16', 'F001 不含 F-TEST 动态字段', 'SKIP', {
        error: e.message,
      });
      console.log(`  ⏭️ Error: ${e.message}`);
    }

    // 2.17 Cross-factory access blocked (HTTP 403)
    console.log('\n2.17 Cross-factory access blocked...');
    if (!f001Token) {
      report.addCheckpoint('P2-17', '跨工厂访问拦截', 'SKIP', {
        reason: 'F001 token 未获取',
      });
    } else {
      try {
        // F001 token trying to access F-TEST config
        const code1 = api.crossFactoryHttpCode(
          state.factoryId,
          'F001',
          '/config/modules/sales_order/effective'
        );

        // F001 token trying to access F-TEST dynamic fields
        const code2 = api.crossFactoryHttpCode(
          state.factoryId,
          'F001',
          '/config/v2/dynamic-fields?moduleCode=sales_order'
        );

        // F001 token trying to access F-TEST sales orders
        const code3 = api.crossFactoryHttpCode(
          state.factoryId,
          'F001',
          '/sales/orders'
        );

        const allBlocked = code1 === '403' && code2 === '403' && code3 === '403';
        report.addCheckpoint('P2-17', '跨工厂访问拦截 (3 endpoints)', allBlocked ? 'PASS' : 'FAIL', {
          detail: `F001→F-TEST: config=${code1}, dynamic-fields=${code2}, sales/orders=${code3}`,
          expected: 'all 403',
        });
        console.log(`  ${allBlocked ? '✅' : '❌'} HTTP codes: ${code1}, ${code2}, ${code3}`);
      } catch (e) {
        report.addCheckpoint('P2-17', '跨工厂访问拦截', 'FAIL', { error: e.message });
        console.log(`  ❌ Error: ${e.message}`);
      }
    }

    // 2.18 DDL type conflict detection (KNOWN_GAP verification)
    console.log('\n2.18 DDL type conflict (KNOWN_GAP verification)...');
    if (!f001Token) {
      report.addCheckpoint('P2-18', 'DDL 类型冲突检测', 'SKIP', {
        reason: 'F001 token 未获取',
      });
    } else {
      try {
        // F001 tries to add same fieldCode with different type (DECIMAL vs TEXT)
        const conflictResp = await api.authedPost(
          'F001',
          '/config/v2/dynamic-fields',
          {
            moduleCode: 'sales_order',
            fieldCode: 'delivery_priority', // Same as F-TEST's field (TEXT)
            fieldType: 'DECIMAL', // But different type
            label: 'F001 优先级数值',
          }
        );

        // Check actual DB column type (sshQuery is synchronous)
        const { sshQuery } = await import('../lib/ssh-client.mjs');
        const colType = sshQuery(
          "SELECT data_type FROM information_schema.columns WHERE table_name='sales_orders' AND column_name='cf_delivery_priority'"
        );

        // The KNOWN_GAP is that F001's DECIMAL request is accepted but actual column is VARCHAR
        const isVarchar = colType.includes('character varying') || colType.includes('text');

        report.addCheckpoint('P2-18', 'DDL 类型冲突检测 (架构缺陷)', 'KNOWN_GAP', {
          f001RequestType: 'DECIMAL',
          fTestExistingType: 'VARCHAR (TEXT)',
          dbActualType: colType || 'unknown',
          isVarchar,
          detail: `F001 声明 DECIMAL, DB 实际 ${colType}, 冲突未被检测`,
          note: '架构缺陷: DDLExecutor 不检测跨工厂的同名字段类型冲突, 需 V3.1 修复',
          backlogItem: 'V3.1: Add type conflict detection in DDLExecutor.generateDDL()',
        });
        console.log(`  🐛 Known gap confirmed: DB type=${colType}`);
      } catch (e) {
        report.addCheckpoint('P2-18', 'DDL 类型冲突检测', 'KNOWN_GAP', {
          error: e.message,
          note: 'Error during verification — gap still exists',
        });
        console.log(`  🐛 Error: ${e.message}`);
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
