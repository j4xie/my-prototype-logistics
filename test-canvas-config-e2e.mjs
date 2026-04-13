/**
 * Canvas Configuration System — E2E 验证测试
 * 12 个工厂配置场景 + API 验证 + 动态渲染页面检查
 */
import { chromium } from 'playwright';

// nginx on 139 proxies to active backend (green 10020)
const API_BASE = 'http://139.196.165.140:8086/api/mobile';
const WEB_URL = 'http://139.196.165.140:8086';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

const results = [];
let token = '';
let factoryId = '';

// ==================== Helpers ====================

async function login() {
  const res = await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  if (!data.success && !data.data) throw new Error('Login failed: ' + data.message);
  token = data.data.accessToken;
  factoryId = data.data.factoryId;
  console.log(`✅ Login OK: ${factoryId} / ${data.data.role}`);
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}/${factoryId}/config${path}`, opts);
  return res.json();
}

async function getEffective(moduleCode) {
  return api('GET', `/modules/${moduleCode}/effective`);
}

function record(name, pass, detail) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ name, status, detail });
  console.log(`${pass ? '✅' : '❌'} [${status}] ${name}: ${detail}`);
}

// ==================== Config Scenarios ====================

const SCENARIOS = [
  {
    id: 'S01',
    name: '默认配置 — 无工厂覆盖',
    test: async () => {
      const res = await getEffective('sales_order');
      const d = res.data;
      const checks = [
        d.moduleCode === 'sales_order',
        d.moduleName === '销售订单',
        d.enabled === true,
        d.fields.length >= 20,
        d.groups.length >= 5,
        d.workflowStates.length >= 9,
        d.renderingMode === 'LEGACY',
      ];
      return { pass: checks.every(Boolean), detail: `fields=${d.fields.length}, groups=${d.groups.length}, states=${d.workflowStates.length}, mode=${d.renderingMode}` };
    }
  },
  {
    id: 'S02',
    name: 'BOM 默认配置验证',
    test: async () => {
      const res = await getEffective('bom');
      const d = res.data;
      const checks = [
        d.moduleCode === 'bom',
        d.fields.length >= 9,
        d.groups.length === 3,
        d.workflowStates.length >= 3,
      ];
      return { pass: checks.every(Boolean), detail: `fields=${d.fields.length}, groups=${d.groups.length}, states=${d.workflowStates.length}` };
    }
  },
  {
    id: 'S03',
    name: '创建 DRAFT 配置 — 隐藏运费字段',
    test: async () => {
      // Save module config: hide shippingFee + shippingIncluded
      const saveRes = await api('PUT', '/modules/sales_order', {
        fieldConfig: {
          fields: {
            shippingFee: { visible: false },
            shippingIncluded: { visible: false },
          }
        },
        renderingMode: 'DYNAMIC',
      });
      // Draft exists but not published — effective should still show defaults
      const res = await getEffective('sales_order');
      const shippingField = res.data.fields.find(f => f.code === 'shippingFee');
      // In default (no published), shippingFee should still be visible
      return { pass: shippingField?.visible === true, detail: `shippingFee.visible=${shippingField?.visible} (draft not published yet)` };
    }
  },
  {
    id: 'S04',
    name: '发布配置 → 运费字段隐藏',
    test: async () => {
      const pubRes = await api('POST', '/publish?summary=隐藏运费字段');
      const res = await getEffective('sales_order');
      const shippingFee = res.data.fields.find(f => f.code === 'shippingFee');
      const shippingIncl = res.data.fields.find(f => f.code === 'shippingIncluded');
      const mode = res.data.renderingMode;
      return {
        pass: shippingFee?.visible === false && shippingIncl?.visible === false && mode === 'DYNAMIC',
        detail: `shippingFee.visible=${shippingFee?.visible}, shippingIncluded.visible=${shippingIncl?.visible}, mode=${mode}`
      };
    }
  },
  {
    id: 'S05',
    name: '关闭财务审核 → 工作流跳过审核状态',
    test: async () => {
      await api('PUT', '/modules/sales_order', {
        workflowConfig: { options: { hasFinanceReview: false } },
      });
      await api('POST', '/publish?summary=关闭财务审核');
      const res = await getEffective('sales_order');
      // With hasFinanceReview=false, CONFIRMED→PROCESSING should be enabled
      const directToProd = res.data.workflowTransitions.find(
        t => t.from === 'CONFIRMED' && t.to === 'PROCESSING'
      );
      // CONFIRMED→PENDING_FINANCE should be disabled by condition
      const toFinance = res.data.workflowTransitions.find(
        t => t.from === 'CONFIRMED' && t.to === 'PENDING_FINANCE_REVIEW'
      );
      return {
        pass: directToProd?.enabled === true,
        detail: `CONFIRMED→PROCESSING.enabled=${directToProd?.enabled}, CONFIRMED→PENDING_FINANCE.enabled=${toFinance?.enabled}`
      };
    }
  },
  {
    id: 'S06',
    name: '自定义标签 — 重命名字段',
    test: async () => {
      await api('PUT', '/modules/sales_order', {
        customLabels: { orderNumber: '合同编号', customerId: '签约方', remark: '特殊备注' },
      });
      await api('POST', '/publish?summary=自定义字段标签');
      const res = await getEffective('sales_order');
      const labels = res.data.customLabels || {};
      return {
        pass: labels.orderNumber === '合同编号' && labels.customerId === '签约方',
        detail: `orderNumber→${labels.orderNumber}, customerId→${labels.customerId}, remark→${labels.remark}`
      };
    }
  },
  {
    id: 'S07',
    name: '角色权限过滤 — warehouse 隐藏金额',
    test: async () => {
      const res = await fetch(`${API_BASE}/${factoryId}/config/modules/sales_order/effective?roleCode=warehouse`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const d = (await res.json()).data;
      const totalAmount = d.fields.find(f => f.code === 'totalAmount');
      const shippingFee = d.fields.find(f => f.code === 'shippingFee');
      return {
        pass: totalAmount?.visible === false,
        detail: `totalAmount.visible=${totalAmount?.visible} (warehouse role), shippingFee.visible=${shippingFee?.visible}`
      };
    }
  },
  {
    id: 'S08',
    name: '字段级更新 — 修改单个字段 required',
    test: async () => {
      await api('PATCH', '/modules/sales_order/fields/deliveryAddress', {
        required: true,
        label: '送货地址(必填)',
      });
      await api('POST', '/publish?summary=deliveryAddress改必填');
      const res = await getEffective('sales_order');
      const field = res.data.fields.find(f => f.code === 'deliveryAddress');
      return {
        pass: field?.required === true,
        detail: `deliveryAddress.required=${field?.required}, label=${field?.label}`
      };
    }
  },
  {
    id: 'S09',
    name: 'BOM 配置 — 隐藏成本字段 + 启用 DYNAMIC',
    test: async () => {
      await api('PUT', '/modules/bom', {
        fieldConfig: { fields: { unitPrice: { visible: false }, taxRate: { visible: false } } },
        renderingMode: 'DYNAMIC',
      });
      await api('POST', '/publish?summary=BOM隐藏成本字段');
      const res = await getEffective('bom');
      const unitPrice = res.data.fields.find(f => f.code === 'unitPrice');
      const taxRate = res.data.fields.find(f => f.code === 'taxRate');
      return {
        pass: unitPrice?.visible === false && taxRate?.visible === false && res.data.renderingMode === 'DYNAMIC',
        detail: `unitPrice.visible=${unitPrice?.visible}, taxRate.visible=${taxRate?.visible}, mode=${res.data.renderingMode}`
      };
    }
  },
  {
    id: 'S10',
    name: '模块开关 — 禁用 BOM',
    test: async () => {
      await api('PATCH', '/modules/bom/toggle?enabled=false');
      await api('POST', '/publish?summary=禁用BOM');
      const res = await getEffective('bom');
      return {
        pass: res.data.enabled === false,
        detail: `bom.enabled=${res.data.enabled}`
      };
    }
  },
  {
    id: 'S11',
    name: '版本回滚 — 恢复 BOM 启用',
    test: async () => {
      // Rollback to version before disable (version counting: we've published multiple times)
      // Get current version, rollback to version - 1
      await api('POST', '/rollback/4'); // version 4 was before BOM disable
      await api('POST', '/publish?summary=回滚恢复BOM');
      const res = await getEffective('bom');
      return {
        pass: res.data.enabled !== false, // Should be re-enabled after rollback
        detail: `bom.enabled=${res.data.enabled} after rollback`
      };
    }
  },
  {
    id: 'S12',
    name: '模块列表 API — 返回所有模块摘要',
    test: async () => {
      const res = await api('GET', '/modules');
      const modules = res.data || [];
      const salesOrder = modules.find(m => m.moduleCode === 'sales_order');
      const bom = modules.find(m => m.moduleCode === 'bom');
      return {
        pass: modules.length >= 2 && salesOrder && bom,
        detail: `modules=${modules.length}, sales_order=${salesOrder?.enabled}, bom=${bom?.enabled}`
      };
    }
  },
];

// ==================== Browser Tests ====================

async function browserTests() {
  console.log('\n🌐 Starting Playwright browser tests...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // Login via API, inject token into localStorage
    console.log('  Logging in via API + localStorage injection...');
    const loginRes = await fetch(`${WEB_URL}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const loginData = await loginRes.json();
    const webToken = loginData.data?.accessToken;
    const userData = loginData.data;

    // Navigate to any page first to set the origin
    await page.goto(`${WEB_URL}/login`, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Inject auth into localStorage (same keys as authStore)
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('cretas_access_token', token);
      localStorage.setItem('cretas_user', JSON.stringify({
        id: user.userId,
        userId: user.userId,
        username: user.username,
        role: user.role,
        factoryId: user.factoryId,
        factoryName: user.factoryName || 'Test Factory',
      }));
    }, { token: webToken, user: userData });

    // Set cookie for API calls
    await context.addCookies([{
      name: 'cretas_access_token',
      value: webToken,
      domain: new URL(WEB_URL).hostname,
      path: '/',
    }]);

    await page.waitForTimeout(500);

    // Test S13: Navigate to /modules/sales_order
    console.log('  Testing dynamic module page...');
    await page.goto(`${WEB_URL}/modules/sales_order`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const pageTitle = await page.textContent('h2').catch(() => null);
    const hasTable = await page.$('.el-table').catch(() => null);
    const hasEmpty = await page.$('.el-empty').catch(() => null);
    const hasConfig = pageTitle || hasTable || hasEmpty;

    record('S13-浏览器: /modules/sales_order 页面加载', !!hasConfig,
      `title="${pageTitle}", table=${!!hasTable}, empty=${!!hasEmpty}`);

    // Test S14: Navigate to /modules/bom
    await page.goto(`${WEB_URL}/modules/bom`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const bomTitle = await page.textContent('h2').catch(() => null);
    const bomContent = await page.$('.el-table, .el-empty, .schema-form-renderer').catch(() => null);

    record('S14-浏览器: /modules/bom 页面加载', !!bomContent || !!bomTitle,
      `title="${bomTitle}", hasContent=${!!bomContent}`);

    // Test S15: Check existing sales orders page still works (LEGACY)
    await page.goto(`${WEB_URL}/sales/orders`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const legacyTable = await page.$('.el-table').catch(() => null);
    record('S15-浏览器: 旧版销售订单页面仍可用(LEGACY)', !!legacyTable,
      `hasTable=${!!legacyTable}`);

  } catch (e) {
    record('Browser Tests', false, `Error: ${e.message}`);
  } finally {
    await browser.close();
  }
}

// ==================== Main ====================

async function main() {
  console.log('🧪 Canvas Configuration System — E2E 验证');
  console.log('=' .repeat(60));

  // Phase 1: Login
  await login();

  // Phase 2: API-driven config scenarios
  console.log('\n📡 Phase 1: API 配置场景 (12 scenarios)');
  console.log('-'.repeat(60));

  for (const scenario of SCENARIOS) {
    try {
      const result = await scenario.test();
      record(`${scenario.id}-${scenario.name}`, result.pass, result.detail);
    } catch (e) {
      record(`${scenario.id}-${scenario.name}`, false, `Error: ${e.message}`);
    }
  }

  // Phase 3: Browser tests
  console.log('\n🌐 Phase 2: Playwright 浏览器测试 (3 scenarios)');
  console.log('-'.repeat(60));
  await browserTests();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`  PASS: ${passed} / ${results.length}`);
  console.log(`  FAIL: ${failed} / ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.detail}`);
    });
  }

  // Write results
  const fs = await import('fs');
  fs.writeFileSync('test-canvas-config-results.json', JSON.stringify({ timestamp: new Date().toISOString(), results, summary: { passed, failed, total: results.length } }, null, 2));
  console.log('\n📁 Results saved to test-canvas-config-results.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
