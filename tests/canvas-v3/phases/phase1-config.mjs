// tests/canvas-v3/phases/phase1-config.mjs

export async function phase1Config(api, report) {
  console.log('\n=== Phase 1: Factory + Canvas Config ===');
  const state = {};

  // 1.1 Create factory via internal API
  console.log('1.1 Creating test factory...');
  const createResp = await api.createFactory(
    `Canvas测试厂${Date.now()}`,
    'FOOD',
    '3101'
  );

  if (!createResp.success) {
    report.addCheckpoint('P1-1', '创建测试工厂', 'FAIL', { error: createResp.message });
    throw new Error(`Factory creation failed: ${createResp.message}`);
  }

  state.factoryId = createResp.data.factoryId;
  // users array contains multiple default users, find factory_super_admin
  const users = createResp.data.users || [];
  const adminUser = users.find(u =>
    u.role === 'factory_super_admin' ||
    u.roleCode === 'factory_super_admin' ||
    (u.username && u.username.includes('admin'))
  ) || users[0];

  state.adminUsername = adminUser?.username || adminUser?.account;
  // Default users are created with a random password — reset to a known test password
  const TEST_PASSWORD = 'CanvasTest2026';
  state.adminPassword = TEST_PASSWORD;
  report.factoryId = state.factoryId;

  // Reset admin password to known test value via bootstrap admin API
  try {
    api.resetUserPassword(state.factoryId, state.adminUsername, TEST_PASSWORD);
    console.log(`  ✅ Admin password reset to test password`);
  } catch (e) {
    report.addCheckpoint('P1-1', '创建测试工厂', 'FAIL', { error: `Password reset failed: ${e.message}` });
    throw new Error(`Password reset failed: ${e.message}`);
  }

  report.addCheckpoint('P1-1', `创建工厂 ${state.factoryId}`, 'PASS', {
    factoryId: state.factoryId,
    adminUsername: state.adminUsername,
    userCount: users.length,
  });
  console.log(`  ✅ Factory created: ${state.factoryId}, admin: ${state.adminUsername}`);

  // 1.2 Login as factory admin
  console.log('1.2 Logging in as factory admin...');
  const loginResp = await api.login(state.adminUsername, state.adminPassword);
  if (!loginResp.success) {
    report.addCheckpoint('P1-2', '登录新工厂管理员', 'FAIL', { error: loginResp.message });
    throw new Error(`Login failed: ${loginResp.message}`);
  }
  state.token = loginResp.data.accessToken;
  api.setToken(state.factoryId, state.token);
  report.addCheckpoint('P1-2', '登录新工厂管理员', 'PASS', {
    tokenLength: state.token.length,
  });
  console.log(`  ✅ Logged in, token length: ${state.token.length}`);

  // 1.3 Apply food_processing template
  console.log('1.3 Applying food_processing template...');
  try {
    const tmplResp = await api.authedPost(
      state.factoryId,
      '/config/v2/apply-template/food_processing',
      {}
    );
    const success = tmplResp.success !== false && !tmplResp._parseError;
    report.addCheckpoint(
      'P1-3',
      '应用行业模板 food_processing',
      success ? 'PASS' : 'WARN',
      { response: tmplResp }
    );
    console.log(`  ${success ? '✅' : '⚠️'} Template apply response`);
  } catch (e) {
    report.addCheckpoint('P1-3', '应用行业模板', 'WARN', { error: e.message });
    console.log(`  ⚠️ Template apply error: ${e.message}`);
  }

  // 1.4 Create 4 dynamic fields
  console.log('1.4 Creating 4 dynamic fields...');
  const fields = [
    {
      moduleCode: 'sales_order',
      fieldCode: 'customer_level',
      fieldType: 'SELECT',
      label: '客户等级',
      config: {
        options: [
          { value: 'A', label: 'A级' },
          { value: 'B', label: 'B级' },
          { value: 'C', label: 'C级' },
        ],
      },
    },
    {
      moduleCode: 'sales_order',
      fieldCode: 'delivery_priority',
      fieldType: 'TEXT',
      label: '交货优先级',
    },
    {
      moduleCode: 'sales_order',
      fieldCode: 'expected_margin',
      fieldType: 'DECIMAL',
      label: '预期毛利率',
    },
    {
      moduleCode: 'sales_order',
      fieldCode: 'prepayment_records',
      fieldType: 'SUB_TABLE',
      label: '预付款记录',
      config: {
        columns: [
          { code: 'amount', label: '金额', type: 'DECIMAL' },
          { code: 'date', label: '日期', type: 'DATE' },
          { code: 'remark', label: '备注', type: 'TEXT' },
        ],
      },
    },
  ];

  let createdCount = 0;
  const createdIds = [];
  for (const f of fields) {
    try {
      const resp = await api.authedPost(state.factoryId, '/config/v2/dynamic-fields', f);
      const id = resp.id || resp.data?.id;
      if (id) {
        createdCount++;
        createdIds.push({ code: f.fieldCode, id });
        console.log(`  ✅ Created: ${f.fieldCode} (${f.fieldType})`);
      } else {
        console.log(`  ❌ Failed: ${f.fieldCode} — ${JSON.stringify(resp).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ❌ Error creating ${f.fieldCode}: ${e.message}`);
    }
  }

  report.addCheckpoint(
    'P1-4',
    '创建 4 个动态字段',
    createdCount === 4 ? 'PASS' : 'FAIL',
    { createdCount, expected: 4, ids: createdIds }
  );

  // 1.4b Verify all 4 are PENDING_DDL
  const listResp = await api.authedGet(state.factoryId, '/config/v2/dynamic-fields', {
    moduleCode: 'sales_order',
  });
  // Response may be array or wrapped in {data: [...]}
  const items = Array.isArray(listResp) ? listResp : listResp.data || [];
  const pendingCount = items.filter(f => f.status === 'PENDING_DDL').length;

  report.addCheckpoint(
    'P1-4b',
    `4 字段状态为 PENDING_DDL (实际 ${pendingCount})`,
    pendingCount >= 4 ? 'PASS' : 'FAIL',
    { pendingCount, totalItems: items.length }
  );
  console.log(`  Dynamic fields status: ${pendingCount}/${items.length} PENDING_DDL`);

  // 1.5 Create validation rule
  console.log('1.5 Creating validation rule...');
  try {
    const ruleResp = await api.authedPut(
      state.factoryId,
      '/config/v2/validation-rules/so_amount_min',
      {
        moduleCode: 'sales_order',
        operation: 'CREATE',
        condition: 'totalAmount >= 100',
        errorMessage: '订单金额不能低于100元',
        severity: 'BLOCK',
        enabled: true,
        sortOrder: 1,
      }
    );
    const success = ruleResp.id || ruleResp.data?.id || ruleResp.success;
    report.addCheckpoint('P1-5', '创建校验规则 totalAmount>=100', success ? 'PASS' : 'FAIL', {
      response: ruleResp,
    });
    console.log(`  ${success ? '✅' : '❌'} Validation rule created`);
  } catch (e) {
    report.addCheckpoint('P1-5', '创建校验规则', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 1.6 Set visibleWhen on expected_margin
  console.log('1.6 Setting visibleWhen on expected_margin...');
  try {
    const visResp = await api.authedPut(
      state.factoryId,
      '/config/v2/dynamic-fields/expected_margin',
      {
        moduleCode: 'sales_order',
        visibleWhen: "customer_level == 'A'",
      }
    );
    const success = visResp.id || visResp.data?.id;
    report.addCheckpoint('P1-6', '配置 visibleWhen (expected_margin)', success ? 'PASS' : 'FAIL', {
      response: visResp,
    });
    console.log(`  ${success ? '✅' : '❌'} visibleWhen set`);
  } catch (e) {
    report.addCheckpoint('P1-6', '配置 visibleWhen', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 1.7 Create trigger chain
  console.log('1.7 Creating trigger chain...');
  try {
    const trigResp = await api.authedPut(
      state.factoryId,
      '/config/v2/trigger-chains/so_confirmed_chain',
      {
        eventType: 'SalesOrderConfirmedEvent',
        enabled: true,
        steps: [
          { order: 1, tool: 'scheduling_list', condition: '', enabled: true, params: {} },
        ],
        errorStrategy: 'CONTINUE',
      }
    );
    const success = trigResp.id || trigResp.data?.id || trigResp.success;
    report.addCheckpoint('P1-7', '创建触发链 so_confirmed_chain', success ? 'PASS' : 'FAIL', {
      response: trigResp,
    });
    console.log(`  ${success ? '✅' : '❌'} Trigger chain created`);
  } catch (e) {
    report.addCheckpoint('P1-7', '创建触发链', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 1.7b Create aggregate formula
  console.log('1.7b Creating aggregate formula...');
  try {
    const fmlResp = await api.authedPut(
      state.factoryId,
      '/config/v2/formulas/tax_group_sum',
      {
        moduleCode: 'sales_order',
        formulaCode: 'tax_group_sum',
        expression: "GROUP_BY(sales_order_items, 'tax_rate', SUM('amount'))",
        resultType: 'AGGREGATE',
        precisionVal: 2,
      }
    );
    const success = fmlResp.id || fmlResp.data?.id || fmlResp.success;
    report.addCheckpoint('P1-7b', '创建聚合公式 tax_group_sum', success ? 'PASS' : 'FAIL', {
      response: fmlResp,
    });
    console.log(`  ${success ? '✅' : '❌'} Aggregate formula created`);
  } catch (e) {
    report.addCheckpoint('P1-7b', '创建聚合公式', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 1.7d Set computedWhen on delivery_priority
  console.log('1.7d Setting computedWhen on delivery_priority...');
  try {
    const compResp = await api.authedPut(
      state.factoryId,
      '/config/v2/dynamic-fields/delivery_priority',
      {
        moduleCode: 'sales_order',
        computedWhen: "customer_level == 'A' ? '加急' : '普通'",
      }
    );
    const success = compResp.id || compResp.data?.id;
    report.addCheckpoint('P1-7d', '配置 computedWhen (delivery_priority)', success ? 'PASS' : 'FAIL', {
      response: compResp,
    });
    console.log(`  ${success ? '✅' : '❌'} computedWhen set`);
  } catch (e) {
    report.addCheckpoint('P1-7d', '配置 computedWhen', 'FAIL', { error: e.message });
    console.log(`  ❌ Error: ${e.message}`);
  }

  // 1.8 Change-set workflow → publish
  console.log('1.8 Publishing via change-set workflow...');
  try {
    // Step A: Create change set (configType must be a valid enum: OTHER, FORM_TEMPLATE, etc.)
    const csResp = await api.authedPost(state.factoryId, '/config-changes', {
      configType: 'OTHER',
      configId: 'canvas-v3-init',
      configName: 'Canvas V3 初始配置',
      afterSnapshot: '{"dynamicFields":4,"rules":1,"triggers":1,"formulas":1}',
    });
    const changeSetId = csResp.id || csResp.data?.id;
    report.addCheckpoint('P1-8a', '创建变更集', changeSetId ? 'PASS' : 'FAIL', {
      changeSetId,
      response: csResp,
    });
    console.log(`  ${changeSetId ? '✅' : '❌'} Change set created: ${changeSetId}`);

    if (changeSetId) {
      // Step B: Approve
      const apprResp = await api.authedPost(
        state.factoryId,
        `/config-changes/${changeSetId}/approve`,
        { comment: 'Canvas V3 初始配置审批' }
      );
      const apprSuccess = apprResp.success || apprResp.id || apprResp.status === 'APPROVED';
      report.addCheckpoint('P1-8b', '审批变更集', apprSuccess ? 'PASS' : 'FAIL', {
        response: apprResp,
      });
      console.log(`  ${apprSuccess ? '✅' : '❌'} Change set approved`);

      // Step C: Apply
      const applyResp = await api.authedPost(
        state.factoryId,
        `/config-changes/${changeSetId}/apply`,
        {}
      );
      const applySuccess = applyResp.success || applyResp.id || applyResp.status === 'APPLIED';
      report.addCheckpoint('P1-8c', '应用变更集', applySuccess ? 'PASS' : 'FAIL', {
        response: applyResp,
      });
      console.log(`  ${applySuccess ? '✅' : '❌'} Change set applied`);
    }

    // Step D-pre: Ensure a DRAFT FactoryConfiguration exists before publish
    // publishConfig() requires a draft in factory_configurations table.
    // Create one by calling saveModuleConfig (PUT /config/modules/sales_order).
    console.log('  Creating draft config for factory...');
    try {
      await api.authedPut(state.factoryId, '/config/modules/sales_order', {
        enabled: true,
        renderingMode: 'CANVAS',
      });
      console.log('  ✅ Draft config created');
    } catch (draftErr) {
      console.log(`  ⚠️ Draft create warning: ${draftErr.message}`);
    }

    // Step D: Publish config (triggers DDL)
    console.log('  Publishing config (triggers DDL)...');
    // publish endpoint uses query param ?summary=...
    const pubResp = await api.authedPost(
      state.factoryId,
      '/config/publish?summary=Canvas+V3+initial+publish',
      {}
    );
    const pubSuccess = pubResp.success !== false;
    report.addCheckpoint('P1-8d', '发布配置 (触发 DDL)', pubSuccess ? 'PASS' : 'FAIL', {
      response: pubResp,
    });
    console.log(`  ${pubSuccess ? '✅' : '❌'} Config published`);

    // Wait a moment for DDL to complete
    await new Promise(r => setTimeout(r, 2000));

    // Step E: Verify DDL executed
    console.log('  Verifying DDL execution...');
    const ddlLog = await api.authedGet(state.factoryId, '/config/v2/ddl-log');
    const ddlItems = Array.isArray(ddlLog) ? ddlLog : ddlLog.data || [];
    const executedCount = ddlItems.filter(d => d.status === 'EXECUTED').length;
    const failedCount = ddlItems.filter(d => d.status === 'FAILED').length;
    report.addCheckpoint(
      'P1-8e',
      `DDL 执行 (${executedCount} 执行, ${failedCount} 失败)`,
      executedCount >= 4 ? 'PASS' : 'FAIL',
      { executedCount, failedCount, total: ddlItems.length }
    );
    console.log(`  DDL: ${executedCount} executed, ${failedCount} failed`);

    // Step F: Verify dynamic fields are now ACTIVE
    const listAfter = await api.authedGet(state.factoryId, '/config/v2/dynamic-fields', {
      moduleCode: 'sales_order',
    });
    const listItems = Array.isArray(listAfter) ? listAfter : listAfter.data || [];
    const activeCount = listItems.filter(f => f.status === 'ACTIVE').length;
    const stillPendingCount = listItems.filter(f => f.status === 'PENDING_DDL').length;
    report.addCheckpoint(
      'P1-8f',
      `动态字段变 ACTIVE (${activeCount}/${listItems.length})`,
      activeCount >= 4 ? 'PASS' : 'FAIL',
      { activeCount, stillPendingCount, total: listItems.length }
    );
    console.log(`  Dynamic fields: ${activeCount} ACTIVE, ${stillPendingCount} still PENDING_DDL`);
  } catch (e) {
    console.error('Phase 1.8 error:', e.message);
    report.addCheckpoint('P1-8', '发布流程', 'FAIL', { error: e.message });
  }

  return state;
}
