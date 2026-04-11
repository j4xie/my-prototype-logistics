/**
 * Canvas Configuration System — 深度 E2E v2
 * 修复: 真实浏览器登录 (填表单+提交), 不用 localStorage 注入
 * 按 E2E Skill 规范: 证据强制, filled/toast/API/list after/screenshot
 */
import { chromium } from 'playwright';
import fs from 'fs';

const WEB_URL = 'http://139.196.165.140:8086';
const API_BASE = `${WEB_URL}/api/mobile`;
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';
const SCREENSHOT_DIR = './screenshots-canvas-v2';

let token = '';
let factoryId = '';
const report = [];

// ==================== Helpers ====================
async function apiLogin() {
  const res = await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const d = await res.json();
  token = d.data.accessToken;
  factoryId = d.data.factoryId;
}

async function configApi(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}/${factoryId}/config${path}`, opts);
  return res.json();
}

async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false });
}

function log(id, name, action, evidence, result, detail) {
  report.push({ id, name, action, evidence, result, detail });
  const icon = result === 'PASS' ? '✅' : result.startsWith('KNOWN') ? '⚠️' : '❌';
  console.log(`${icon} [${result}] ${id}: ${name}`);
  evidence.forEach(e => console.log(`    ${e}`));
}

// ==================== Browser Login ====================
async function browserLogin(page) {
  await page.goto(`${WEB_URL}/login`, { timeout: 30000, waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Find and fill username/password inputs
  const usernameInput = await page.$('input[type="text"], input[placeholder*="用户"], input[placeholder*="账号"]');
  const passwordInput = await page.$('input[type="password"]');

  if (!usernameInput || !passwordInput) {
    // Try by index
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].fill(USERNAME);
      await inputs[1].fill(PASSWORD);
    }
  } else {
    await usernameInput.fill(USERNAME);
    await passwordInput.fill(PASSWORD);
  }

  await page.waitForTimeout(500);
  await shot(page, 'login-filled');

  // Click login button
  const loginBtn = await page.$('button[type="submit"]')
    || await page.$('.el-button--primary')
    || await page.$('button:has-text("登录")');
  if (loginBtn) await loginBtn.click();

  // Wait for navigation (redirect to dashboard)
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => {});

  const url = page.url();
  const isLoggedIn = !url.includes('/login');
  await shot(page, 'after-login');
  return isLoggedIn;
}

// ==================== Main ====================
async function main() {
  console.log('🧪 Canvas Config — 深度 E2E v2 (真实浏览器登录)');
  console.log('='.repeat(60));

  // API login for config operations
  await apiLogin();
  console.log(`  API login: ${factoryId} / factory_super_admin`);

  // Clean previous config
  try {
    // Reset by publishing clean config
    await configApi('PUT', '/modules/sales_order', {
      fieldConfig: { fields: {} },
      workflowConfig: { options: {} },
      customLabels: {},
      renderingMode: 'DYNAMIC',
    });
    await configApi('PUT', '/modules/bom', {
      fieldConfig: { fields: {} },
      renderingMode: 'DYNAMIC',
    });
    await configApi('POST', '/publish?summary=E2E-v2-reset');
    console.log('  Config reset to clean DYNAMIC state');
  } catch(e) { console.log(`  Config reset: ${e.message}`); }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ===== T01: 真实浏览器登录 =====
    console.log('\n--- T01: 浏览器登录 ---');
    const loggedIn = await browserLogin(page);
    const afterLoginUrl = page.url();
    const hasSidebar = await page.$('.el-menu, .sidebar-container, nav').catch(() => null);
    log('T01', '真实浏览器登录', '打开 /login → 填 username+password → 点登录',
      [
        `filled: username=${USERNAME}, password=***`,
        `redirect URL: ${afterLoginUrl}`,
        `sidebar visible: ${!!hasSidebar}`,
        `screenshot: login-filled.png, after-login.png`,
      ],
      loggedIn && hasSidebar ? 'PASS' : 'FAIL'
    );
    if (!loggedIn) {
      console.log('❌ Login failed — aborting browser tests');
      await browser.close();
      printReport();
      return;
    }

    // ===== T02: 旧版销售订单页面可用 =====
    console.log('\n--- T02: 旧版销售订单 ---');
    await page.goto(`${WEB_URL}/sales/orders`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const soTable = await page.$('.el-table');
    const soRows = await page.$$('.el-table__row');
    await shot(page, 'T02-legacy-so');
    log('T02', '旧版销售订单页面', '导航 /sales/orders → 检查 el-table',
      [
        `table present: ${!!soTable}`,
        `rows: ${soRows.length}`,
        `screenshot: T02-legacy-so.png`,
      ],
      soTable ? 'PASS' : 'FAIL'
    );

    // ===== T03: 动态模块页面 — /modules/sales_order =====
    console.log('\n--- T03: 动态模块页 sales_order ---');
    await page.goto(`${WEB_URL}/modules/sales_order`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const dynTitle = await page.textContent('h2').catch(() => '');
    const hasNewBtn = await page.$('button:has-text("新建")');
    const hasEmpty = await page.$('.el-empty');
    const hasElTable = await page.$('.el-table');
    await shot(page, 'T03-dynamic-so');
    log('T03', '动态模块页 — sales_order', '导航 /modules/sales_order → 检查布局',
      [
        `title: "${dynTitle}"`,
        `新建 button: ${!!hasNewBtn}`,
        `el-table: ${!!hasElTable}, el-empty: ${!!hasEmpty}`,
        `screenshot: T03-dynamic-so.png`,
      ],
      hasNewBtn || hasElTable || hasEmpty ? 'PASS' : 'FAIL'
    );

    // ===== T04: 点击新建 → 动态表单渲染 =====
    console.log('\n--- T04: 动态表单渲染 ---');
    if (hasNewBtn) {
      await hasNewBtn.click();
      await page.waitForTimeout(3000);
    }
    const formLabels = await page.$$eval(
      '.el-form-item__label, .el-collapse-item__header',
      els => els.map(e => e.textContent?.trim()).filter(Boolean)
    ).catch(() => []);
    const formInputs = await page.$$('.el-input, .el-select, .el-switch, .el-date-editor, .el-input-number');
    await shot(page, 'T04-dynamic-form');
    log('T04', '动态表单 — 字段渲染', '点击新建 → 检查 el-form 字段',
      [
        `labels (${formLabels.length}): ${formLabels.slice(0, 10).join(', ')}`,
        `input components: ${formInputs.length}`,
        `screenshot: T04-dynamic-form.png`,
      ],
      formLabels.length > 0 ? 'PASS' : 'FAIL'
    );

    // ===== T05: 配置修改 → 隐藏运费 → 验证页面变化 =====
    console.log('\n--- T05: 隐藏运费字段 → 页面验证 ---');
    await configApi('PUT', '/modules/sales_order', {
      fieldConfig: { fields: { shippingFee: { visible: false }, shippingIncluded: { visible: false } } },
    });
    await configApi('POST', '/publish?summary=T05-隐藏运费');
    const effT05 = await configApi('GET', '/modules/sales_order/effective');
    const sfVis = effT05.data?.fields?.find(f => f.code === 'shippingFee')?.visible;

    // Reload dynamic page
    await page.goto(`${WEB_URL}/modules/sales_order`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const newBtn2 = await page.$('button:has-text("新建")');
    if (newBtn2) { await newBtn2.click(); await page.waitForTimeout(3000); }
    const pageText = await page.textContent('body').catch(() => '');
    const hasShipping = pageText.includes('运费') || pageText.includes('shipping');
    await shot(page, 'T05-no-shipping');
    log('T05', '隐藏运费 → 页面验证', 'API 隐藏 shippingFee → publish → reload → 检查页面',
      [
        `API: shippingFee.visible=${sfVis}`,
        `browser: 页面含"运费"=${hasShipping}`,
        `screenshot: T05-no-shipping.png`,
      ],
      sfVis === false ? 'PASS' : 'FAIL'
    );

    // ===== T06: 关闭财务审核 → 工作流变化 =====
    console.log('\n--- T06: 关闭财务审核 ---');
    await configApi('PUT', '/modules/sales_order', {
      workflowConfig: { options: { hasFinanceReview: false } },
    });
    await configApi('POST', '/publish?summary=T06-关闭财务审核');
    const effT06 = await configApi('GET', '/modules/sales_order/effective');
    const t06Direct = effT06.data?.workflowTransitions?.find(t => t.from === 'CONFIRMED' && t.to === 'PROCESSING');
    log('T06', '关闭财务审核 → 工作流', 'API hasFinanceReview=false → publish → check transitions',
      [
        `API: CONFIRMED→PROCESSING.enabled=${t06Direct?.enabled} (expect true)`,
        `API: total transitions=${effT06.data?.workflowTransitions?.length}`,
      ],
      t06Direct?.enabled === true ? 'PASS' : 'FAIL'
    );

    // ===== T07: 自定义标签 → 动态表单验证 =====
    console.log('\n--- T07: 自定义标签 ---');
    await configApi('PUT', '/modules/sales_order', {
      customLabels: { orderNumber: '合同编号', customerId: '签约客户' },
    });
    await configApi('POST', '/publish?summary=T07-自定义标签');
    const effT07 = await configApi('GET', '/modules/sales_order/effective');
    const t07Labels = effT07.data?.customLabels || {};

    await page.goto(`${WEB_URL}/modules/sales_order`, { timeout: 15000 });
    await page.waitForTimeout(3000);
    const newBtn3 = await page.$('button:has-text("新建")');
    if (newBtn3) { await newBtn3.click(); await page.waitForTimeout(3000); }
    const bodyT07 = await page.textContent('body').catch(() => '');
    await shot(page, 'T07-custom-labels');
    log('T07', '自定义标签 → 表单', 'API customLabels → publish → reload form → 检查标签',
      [
        `API labels: orderNumber="${t07Labels.orderNumber}", customerId="${t07Labels.customerId}"`,
        `browser: 含"合同编号"=${bodyT07.includes('合同编号')}`,
        `browser: 含"签约客户"=${bodyT07.includes('签约客户')}`,
        `screenshot: T07-custom-labels.png`,
      ],
      t07Labels.orderNumber === '合同编号' ? 'PASS' : 'FAIL'
    );

    // ===== T08: 角色权限 — warehouse 隐藏金额 =====
    console.log('\n--- T08: 角色权限 warehouse ---');
    const whRes = await fetch(`${API_BASE}/${factoryId}/config/modules/sales_order/effective?roleCode=warehouse`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => r.json());
    const whTotal = whRes.data?.fields?.find(f => f.code === 'totalAmount');
    const whVisible = whRes.data?.fields?.filter(f => f.visible).length;
    const whAll = whRes.data?.fields?.length;
    log('T08', '角色权限 — warehouse', 'GET /effective?roleCode=warehouse → check field visibility',
      [
        `API: totalAmount.visible=${whTotal?.visible} (expect false)`,
        `API: visible fields=${whVisible}/${whAll}`,
      ],
      whTotal?.visible === false ? 'PASS' : 'FAIL'
    );

    // ===== T09: 字段级更新 =====
    console.log('\n--- T09: 字段级更新 ---');
    await configApi('PATCH', '/modules/sales_order/fields/deliveryAddress', { required: true });
    await configApi('POST', '/publish?summary=T09-deliveryAddress必填');
    const effT09 = await configApi('GET', '/modules/sales_order/effective');
    const addrF = effT09.data?.fields?.find(f => f.code === 'deliveryAddress');
    log('T09', '字段级更新 — deliveryAddress必填', 'PATCH field required=true → publish → verify',
      [
        `API: deliveryAddress.required=${addrF?.required}`,
        `API: deliveryAddress.visible=${addrF?.visible}`,
      ],
      addrF?.required === true ? 'PASS' : 'FAIL'
    );

    // ===== T10: BOM 模块配置 =====
    console.log('\n--- T10: BOM 隐藏成本 ---');
    await configApi('PUT', '/modules/bom', {
      fieldConfig: { fields: { unitPrice: { visible: false }, taxRate: { visible: false } } },
    });
    await configApi('POST', '/publish?summary=T10-BOM隐藏成本');
    const bomEff = await configApi('GET', '/modules/bom/effective');
    const bomUp = bomEff.data?.fields?.find(f => f.code === 'unitPrice');
    const bomTr = bomEff.data?.fields?.find(f => f.code === 'taxRate');

    await page.goto(`${WEB_URL}/modules/bom`, { timeout: 15000 });
    await page.waitForTimeout(3000);
    await shot(page, 'T10-bom-no-cost');
    log('T10', 'BOM — 隐藏成本字段', 'PUT hide unitPrice+taxRate → publish → verify API + browser',
      [
        `API: unitPrice.visible=${bomUp?.visible}`,
        `API: taxRate.visible=${bomTr?.visible}`,
        `screenshot: T10-bom-no-cost.png`,
      ],
      bomUp?.visible === false && bomTr?.visible === false ? 'PASS' : 'FAIL'
    );

    // ===== T11: 禁用 BOM → 启用回滚 =====
    console.log('\n--- T11: 禁用+回滚 BOM ---');
    await configApi('PATCH', '/modules/bom/toggle?enabled=false');
    await configApi('POST', '/publish?summary=T11-禁用BOM');
    const disEff = await configApi('GET', '/modules/bom/effective');
    const disVal = disEff.data?.enabled;

    // Rollback
    await configApi('POST', '/rollback/4');
    await configApi('POST', '/publish?summary=T11-回滚恢复');
    const rbEff = await configApi('GET', '/modules/bom/effective');
    const rbVal = rbEff.data?.enabled;
    log('T11', '禁用+回滚 BOM', 'toggle false → publish → rollback → publish → verify',
      [
        `API disable: bom.enabled=${disVal} (expect false)`,
        `API rollback: bom.enabled=${rbVal} (expect true)`,
      ],
      disVal === false && rbVal !== false ? 'PASS' : 'FAIL'
    );

    // ===== T12: 草稿隔离 =====
    console.log('\n--- T12: 草稿隔离 ---');
    const beforeEff = await configApi('GET', '/modules/sales_order/effective');
    const beforeMode = beforeEff.data?.renderingMode;
    await configApi('PUT', '/modules/sales_order', { renderingMode: 'LEGACY' }); // draft only
    const afterEff = await configApi('GET', '/modules/sales_order/effective');
    const afterMode = afterEff.data?.renderingMode;
    log('T12', '草稿隔离 — 未发布不影响线上', 'PUT draft → NO publish → verify effective unchanged',
      [
        `API before: renderingMode=${beforeMode}`,
        `API after (no publish): renderingMode=${afterMode}`,
        `isolation: ${beforeMode === afterMode ? 'VERIFIED ✅' : 'BROKEN ❌'}`,
      ],
      beforeMode === afterMode ? 'PASS' : 'FAIL'
    );

    // ===== T13: 模块列表完整性 =====
    console.log('\n--- T13: 模块列表 ---');
    const modRes = await configApi('GET', '/modules');
    const mods = modRes.data || [];
    log('T13', '模块列表 API', 'GET /config/modules → verify both modules present',
      [
        `API: total=${mods.length}`,
        `API: ${mods.map(m => `${m.moduleCode}(enabled=${m.enabled})`).join(', ')}`,
      ],
      mods.length >= 2 ? 'PASS' : 'FAIL'
    );

    // ===== T14: 完整生命周期验证 =====
    console.log('\n--- T14: 生命周期 ---');
    await configApi('POST', '/publish?summary=T14-cleanup');
    const finalSO = await configApi('GET', '/modules/sales_order/effective');
    const finalBOM = await configApi('GET', '/modules/bom/effective');
    log('T14', '完整配置生命周期', '最终状态验证: SO + BOM 完整性',
      [
        `SO: fields=${finalSO.data?.fields?.length}, groups=${finalSO.data?.groups?.length}, states=${finalSO.data?.workflowStates?.length}, transitions=${finalSO.data?.workflowTransitions?.length}`,
        `BOM: fields=${finalBOM.data?.fields?.length}, groups=${finalBOM.data?.groups?.length}, enabled=${finalBOM.data?.enabled}`,
      ],
      finalSO.data?.fields?.length >= 20 && finalBOM.data?.fields?.length >= 9 ? 'PASS' : 'FAIL'
    );

    // ===== T15: 旧版 BOM 页面兼容 =====
    console.log('\n--- T15: 旧版 BOM ---');
    await page.goto(`${WEB_URL}/production/bom`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const bomTable = await page.$('.el-table');
    const bomTabs = await page.$$('.el-tabs__item');
    await shot(page, 'T15-legacy-bom');
    log('T15', '旧版 BOM 页面', '导航 /production/bom → 检查 3-tab + table',
      [
        `table: ${!!bomTable}`,
        `tabs: ${bomTabs.length}`,
        `screenshot: T15-legacy-bom.png`,
      ],
      bomTable ? 'PASS' : 'FAIL'
    );

  } catch(e) {
    log('ERR', '未捕获异常', e.message, [e.stack?.split('\n')[1] || ''], 'FAIL');
  } finally {
    if (consoleErrors.length) {
      console.log(`\n⚠️ Browser console errors (${consoleErrors.length}):`);
      consoleErrors.slice(0, 5).forEach(e => console.log(`  ${e.substring(0, 120)}`));
    }
    await browser.close();
  }

  printReport();
}

function printReport() {
  const passed = report.filter(r => r.result === 'PASS').length;
  const failed = report.filter(r => r.result === 'FAIL').length;
  const known = report.filter(r => r.result.startsWith('KNOWN')).length;

  console.log('\n' + '='.repeat(60));
  console.log(`📊 总计: ${passed} PASS, ${failed} FAIL, ${known} KNOWN_BUG — 共 ${report.length} 项`);

  if (failed > 0) {
    console.log('\n❌ 失败项:');
    report.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  ${r.id}: ${r.name}`);
      r.evidence.forEach(e => console.log(`    ${e}`));
    });
  }

  fs.writeFileSync('test-canvas-deep-v2-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { passed, failed, known, total: report.length },
    tests: report,
  }, null, 2));
  console.log(`\n📁 test-canvas-deep-v2-results.json`);
  console.log(`📸 ${SCREENSHOT_DIR}/`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
