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

  return state;
}
