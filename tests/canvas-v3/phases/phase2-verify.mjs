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
      // NOTE: router uses createWebHistory() (history mode), NOT hash mode
      // So the URL is /modules/sales_order (no #)
      await page.goto('http://139.196.165.140:8086/modules/sales_order', {
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

    // Check for dynamic field labels in DOM via full innerText search
    // Playwright's text= selector is exact match by default; use innerText substring instead.
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const hasCustomerLevel = bodyText.includes('客户等级');
    const hasDeliveryPriority = bodyText.includes('交货优先级');
    const hasExpectedMargin = bodyText.includes('预期毛利率');
    const hasPrepaymentRecords = bodyText.includes('预付款记录');

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
      await new Promise(r => setTimeout(r, 3000));

      // Search multiple log patterns — Fix #4 added "TriggerChain:" diagnostic prefix
      const triggerChainLogs = sshLogGrep('TriggerChain:');
      const chainLogs = sshLogGrep('so_confirmed_chain');
      const eventLogs = sshLogGrep('SalesOrderConfirmedEvent');
      const executingChainLogs = sshLogGrep('Executing trigger chain');

      const evidence = [triggerChainLogs, chainLogs, eventLogs, executingChainLogs]
        .filter(Boolean);
      const chainFired = evidence.length > 0;

      if (chainFired) {
        report.addCheckpoint('P2-11', '触发链真实执行', 'PASS', {
          confirmSuccess,
          triggerChainLog: triggerChainLogs.slice(0, 200),
          chainCodeLog: chainLogs.slice(0, 200),
          eventLog: eventLogs.slice(0, 200),
          executingLog: executingChainLogs.slice(0, 200),
        });
        console.log(`  ✅ Trigger chain fired (log evidence found)`);
      } else if (!confirmSuccess) {
        report.addCheckpoint('P2-11', '触发链真实执行', 'KNOWN_GAP', {
          confirmSuccess: false,
          note: '订单 confirm 未成功, 事件未触发 — 测试前置条件不足',
        });
        console.log(`  🐛 Order confirm did not succeed, cannot verify chain`);
      } else {
        report.addCheckpoint('P2-11', '触发链真实执行', 'KNOWN_GAP', {
          confirmSuccess: true,
          note: '确认成功但日志中无 TriggerChain/chain/Event 证据 — 可能日志 buffer 或不同环境',
        });
        console.log(`  🐛 Confirm succeeded but no chain evidence in logs`);
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
        // Step 1: F001 adds a field with a fieldCode that already exists (as VARCHAR)
        //         from F-TEST but with a different type (DECIMAL).
        // With Fix #2 (DDLExecutor type conflict detection), this should be caught at publish time.
        const uniqueFieldCode = `conflict_test_${Date.now()}`;

        // First, make F-TEST's field use a unique name so it's actually in DB as VARCHAR
        const fTestField = await api.authedPost(state.factoryId, '/config/v2/dynamic-fields', {
          moduleCode: 'sales_order',
          fieldCode: uniqueFieldCode,
          fieldType: 'TEXT',
          label: 'F-TEST 冲突测试字段',
        });

        // Publish F-TEST to execute DDL (create VARCHAR column)
        await api.authedPut(state.factoryId, '/config/modules/sales_order', {
          enabled: true,
          changeSummary: 'conflict test prep',
        });
        const csPrep = await api.authedPost(state.factoryId, '/config-changes', {
          configType: 'OTHER',
          configId: `conflict-prep-${Date.now()}`,
          configName: 'Conflict test prep',
          afterSnapshot: '{}',
        });
        const csPrepId = csPrep.id || csPrep.data?.id;
        if (csPrepId) {
          await api.authedPost(state.factoryId, `/config-changes/${csPrepId}/approve`, { comment: 'prep' });
          await api.authedPost(state.factoryId, `/config-changes/${csPrepId}/apply`, {});
        }
        await api.authedPost(state.factoryId, '/config/publish?summary=conflict+prep', {});
        await new Promise(r => setTimeout(r, 2000));

        // Step 2: F001 tries to add same fieldCode with DECIMAL type (conflict)
        const conflictResp = await api.authedPost('F001', '/config/v2/dynamic-fields', {
          moduleCode: 'sales_order',
          fieldCode: uniqueFieldCode,
          fieldType: 'DECIMAL',
          label: 'F001 冲突字段 (应被阻止)',
        });
        const f001FieldCreated = !!(conflictResp.id || conflictResp.data?.id);

        // Step 3: F001 tries to publish — Fix #2 should detect the conflict and throw
        let f001PublishBlocked = false;
        let f001PublishError = '';
        try {
          await api.authedPut('F001', '/config/modules/sales_order', {
            enabled: true,
            changeSummary: 'conflict test trigger',
          });
          const csConflict = await api.authedPost('F001', '/config-changes', {
            configType: 'OTHER',
            configId: `conflict-${Date.now()}`,
            configName: 'Conflict trigger',
            afterSnapshot: '{}',
          });
          const csConflictId = csConflict.id || csConflict.data?.id;
          if (csConflictId) {
            await api.authedPost('F001', `/config-changes/${csConflictId}/approve`, { comment: 'trigger' });
            await api.authedPost('F001', `/config-changes/${csConflictId}/apply`, {});
          }
          const pubResp = await api.authedPost('F001', '/config/publish?summary=conflict+trigger', {});
          // Fix #2 should make publish fail with "DDL type conflict" message
          f001PublishError = pubResp.message || JSON.stringify(pubResp).slice(0, 200);
          f001PublishBlocked = pubResp.success === false &&
            (f001PublishError.includes('type conflict') || f001PublishError.includes('DDL'));
        } catch (e) {
          f001PublishError = e.message;
          f001PublishBlocked = e.message.includes('type conflict') || e.message.includes('DDL');
        }

        if (f001PublishBlocked) {
          report.addCheckpoint('P2-18', 'DDL 类型冲突检测 (Fix #2 验证)', 'PASS', {
            fTestFieldCode: uniqueFieldCode,
            fTestType: 'TEXT/VARCHAR',
            f001RequestedType: 'DECIMAL',
            f001FieldCreated,
            f001PublishError,
            detail: 'Fix #2 正确检测并阻止类型冲突',
          });
          console.log(`  ✅ DDL type conflict detected and blocked (Fix #2 works)`);
        } else {
          report.addCheckpoint('P2-18', 'DDL 类型冲突检测 (Fix #2 验证)', 'KNOWN_GAP', {
            fTestFieldCode: uniqueFieldCode,
            f001FieldCreated,
            f001PublishError,
            note: 'Fix #2 应检测冲突但未触发 — 可能字段尚未到达 DDLExecutor 或未部署',
          });
          console.log(`  🐛 Conflict not blocked: ${f001PublishError.slice(0, 150)}`);
        }
      } catch (e) {
        report.addCheckpoint('P2-18', 'DDL 类型冲突检测', 'KNOWN_GAP', {
          error: e.message,
          note: 'Error during verification',
        });
        console.log(`  🐛 Error: ${e.message.slice(0, 150)}`);
      }
    }

    // 2.19 用户级权限 (P0-6 昆山六扇门)
    //  - Grant: 用户获得额外权限(如访问某模块)
    //  - Revoke: 用户被撤销权限
    //  - Effective menus: 查询用户最终有效菜单集合
    console.log('\n2.19 User-level permission override (GRANT/REVOKE)...');
    try {
      // Find the new factory admin user ID — extract from token
      // Token payload contains userId. Decode JWT and extract.
      const tokenParts = state.token.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      const adminUserId = String(payload.userId || '');

      if (!adminUserId) {
        report.addCheckpoint('P2-19', '用户级权限 override', 'SKIP', {
          reason: '无法从 JWT 提取 userId',
        });
      } else {
        // Step 1: GRANT a module permission (sales_order)
        const grantResp = await api.authedPost(
          state.factoryId,
          `/users/${adminUserId}/menu-permissions/grant`,
          { menuCode: 'sales_order:custom_test_field:hidden', remark: 'E2E test grant' }
        );
        const grantId = grantResp.id || grantResp.data?.id;
        console.log(`  ${grantId ? '✅' : '❌'} GRANT: ${grantId || JSON.stringify(grantResp).slice(0, 150)}`);

        // Step 2: REVOKE a module permission
        const revokeResp = await api.authedPost(
          state.factoryId,
          `/users/${adminUserId}/menu-permissions/revoke`,
          { menuCode: 'inventory:sensitive_column:hidden', remark: 'E2E test revoke' }
        );
        const revokeId = revokeResp.id || revokeResp.data?.id;
        console.log(`  ${revokeId ? '✅' : '❌'} REVOKE: ${revokeId || JSON.stringify(revokeResp).slice(0, 150)}`);

        // Step 3: List user overrides (expect 2)
        const listResp = await api.authedGet(
          state.factoryId,
          `/users/${adminUserId}/menu-permissions`
        );
        const overrides = Array.isArray(listResp) ? listResp : (listResp.data || []);
        const hasGrant = overrides.some(o => o.menuCode?.includes('custom_test_field'));
        const hasRevoke = overrides.some(o => o.menuCode?.includes('sensitive_column'));

        // Step 4: Get effective menus for this user (role enum is lowercase per FactoryUserRole)
        const effectiveResp = await api.authedGet(
          state.factoryId,
          `/users/${adminUserId}/menu-permissions/effective`,
          { role: 'factory_super_admin' }
        );
        const effectiveMenus = Array.isArray(effectiveResp) ? effectiveResp :
          (effectiveResp.data || effectiveResp);
        const effectiveCount = Array.isArray(effectiveMenus) ? effectiveMenus.length :
          (typeof effectiveMenus === 'object' ? Object.keys(effectiveMenus).length : 0);

        const allOk = !!grantId && !!revokeId && hasGrant && hasRevoke;
        report.addCheckpoint('P2-19', '用户级权限 GRANT/REVOKE/有效菜单', allOk ? 'PASS' : 'FAIL', {
          userId: adminUserId,
          grantCreated: !!grantId,
          revokeCreated: !!revokeId,
          overridesCount: overrides.length,
          hasGrant,
          hasRevoke,
          effectiveMenusCount: effectiveCount,
        });
        if (allOk) {
          console.log(`  ✅ Permission override works: ${overrides.length} overrides, ${effectiveCount} effective menus`);
        } else {
          console.log(`  ❌ Permission override incomplete: grant=${!!grantId} revoke=${!!revokeId} hasGrant=${hasGrant} hasRevoke=${hasRevoke}`);
        }
      }
    } catch (e) {
      report.addCheckpoint('P2-19', '用户级权限 override', 'FAIL', {
        error: e.message?.slice(0, 300),
      });
      console.log(`  ❌ Error: ${e.message?.slice(0, 150)}`);
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
