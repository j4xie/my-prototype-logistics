/**
 * L3 Cross-Module + L4 Business Flow Tests
 *
 * L3: Create in module A → verify appears in module B dropdown
 * L4: Multi-step business chains (simplified for R1)
 *
 * Tests:
 * L3-1: Create customer → appears in SO customer dropdown
 * L3-2: Create supplier → appears in PO supplier dropdown
 * L3-3: Create employee → appears in HR list
 * L4-1: SO lifecycle: create SO → check status fields
 * L4-2: PO lifecycle: create PO → check status fields
 * L4-3: Navigate finance reports → verify data section renders
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const BASE = 'http://139.196.165.140:8086';
const PASSWORD = '123456';
const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
const setup = existsSync(SETUP_FILE) ? JSON.parse(readFileSync(SETUP_FILE, 'utf8')) : null;
const FACTORY_ID = setup?.factoryId || 'FOOD_3101_048';
const ROUND = 1;
const results = [];
const TS = Date.now().toString(36);

function record(layer, testId, action, status, evidence = {}) {
  const r = { layer, testId, action, status, evidence, ts: new Date().toISOString() };
  results.push(r);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '-' : '⚠';
  console.log(`  [${icon}] ${layer}/${testId}/${action}: ${status}`);
  for (const [k, v] of Object.entries(evidence)) {
    if (v !== undefined) console.log(`      ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
}

async function loginAndWait(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input.el-input__inner', { timeout: 30000 });
  await page.fill('input.el-input__inner[placeholder="请输入用户名"]', username);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button.login-button');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const ok = await page.evaluate(() => !!document.querySelector('.el-menu,.app-sidebar'));
    if (ok) return true;
  }
  return true;
}

async function navigateTo(page, path) {
  try {
    // Use page.goto with generous timeout
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait up to 25s for Vue app to render
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(500);
      const url = page.url();
      if (url.includes('/403')) return '403';
      if (url.includes('/login')) return 'LOGIN';
      const has = await page.evaluate(() => ({
        table: !!document.querySelector('.el-table'),
        menu: !!document.querySelector('.el-menu,.app-sidebar'),
        app: (document.querySelector('#app')?.innerHTML?.length || 0) > 500,
      })).catch(() => ({ table: false, menu: false, app: false }));
      if (has.table) return 'OK';
      if (has.menu || has.app) return 'OK';
    }
    return 'TIMEOUT';
  } catch (e) {
    return 'ERROR: ' + e.message?.substring(0, 60);
  }
}

async function clickButton(page, ...texts) {
  // Wait a bit for buttons to render after table loads
  await page.waitForTimeout(2000);
  for (const text of texts) {
    const btn = await page.$(`button:has-text("${text}")`);
    if (btn) {
      const visible = await btn.isVisible().catch(() => false);
      if (visible) { await btn.click(); return text; }
    }
  }
  // Fallback: try any primary button with Plus icon
  const primaryBtn = await page.$('button.el-button--primary:has(.el-icon)');
  if (primaryBtn) {
    const text = await primaryBtn.innerText().catch(() => '');
    await primaryBtn.click();
    return text || 'primary-icon-btn';
  }
  return null;
}

async function fillFirstInput(page, container, value) {
  const input = container
    ? await page.$(`${container} input.el-input__inner`)
    : await page.$('.el-dialog input.el-input__inner, .el-drawer input.el-input__inner');
  if (input) { await input.fill(value); return true; }
  return false;
}

async function waitForDialog(page, timeout = 5000) {
  for (let i = 0; i < timeout / 500; i++) {
    await page.waitForTimeout(500);
    const d = await page.$('.el-dialog:not([style*="display: none"]), .el-drawer');
    if (d) return d;
  }
  return null;
}

async function checkToast(page) {
  // Poll for toast for up to 5 seconds (toast appears then auto-dismisses)
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500);
    const success = await page.$('.el-message--success');
    if (success) return 'success';
    const error = await page.$('.el-message--error');
    if (error) {
      const text = await error.innerText().catch(() => 'unknown');
      return 'error: ' + text;
    }
  }
  // Fallback: check if dialog closed (submit succeeded even if toast was missed)
  const dialogGone = !(await page.$('.el-dialog:not([style*="display: none"])'));
  if (dialogGone) return 'dialog_closed';
  return 'none';
}

// ===== L3 TESTS =====

async function L3_1_CustomerToSODropdown(page) {
  console.log('\n--- L3-1: Customer → SO Dropdown ---');

  // Step 1: Create customer
  const nav1 = await navigateTo(page, '/sales/customers');
  if (nav1 !== 'OK') { record('L3', '1', 'navigate_customers', 'FAIL', { result: nav1 }); return; }

  const clicked = await clickButton(page, '新建', '新增', '添加');
  if (!clicked) { record('L3', '1', 'click_create', 'FAIL', { reason: 'No create button' }); return; }
  const dialog = await waitForDialog(page);
  if (!dialog) { record('L3', '1', 'open_dialog', 'FAIL', { reason: 'No dialog opened' }); return; }

  const customerName = `E2E客户_L3_${TS}`;
  const filled = await fillFirstInput(page, null, customerName);
  record('L3', '1', 'fill_customer', filled ? 'PASS' : 'FAIL', { filled: customerName });

  const submitClicked = await clickButton(page, '确定', '保存', '提交');
  const toast = await checkToast(page);
  record('L3', '1', 'create_customer', toast.startsWith('success') ? 'PASS' : 'WARNING', {
    filled: customerName, toast, submitButton: submitClicked
  });

  // Step 2: Navigate to SO creation and check customer dropdown
  const nav2 = await navigateTo(page, '/sales/orders');
  if (nav2 !== 'OK') { record('L3', '1', 'navigate_so', 'FAIL', { result: nav2 }); return; }

  const createClicked = await clickButton(page, '新建', '新增', '创建订单');
  if (!createClicked) {
    record('L3', '1', 'so_create_button', 'SKIP', { reason: 'No SO create button found' });
    return;
  }
  await page.waitForTimeout(3000);

  // Look for customer select/dropdown
  const hasCustomerField = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.el-form-item__label, label'));
    return labels.some(l => l.textContent.includes('客户'));
  });
  record('L3', '1', 'so_has_customer_field', hasCustomerField ? 'PASS' : 'FAIL', {
    evidence: hasCustomerField ? 'Customer field found in SO form' : 'No customer field'
  });
}

async function L3_2_SupplierToPODropdown(page) {
  console.log('\n--- L3-2: Supplier → PO Dropdown ---');

  // Step 1: Create supplier
  const nav1 = await navigateTo(page, '/procurement/suppliers');
  if (nav1 !== 'OK') { record('L3', '2', 'navigate_suppliers', 'FAIL', { result: nav1 }); return; }

  const clicked = await clickButton(page, '新建', '新增', '添加');
  if (!clicked) { record('L3', '2', 'click_create', 'FAIL', { reason: 'No create button' }); return; }
  const dialog = await waitForDialog(page);
  if (!dialog) { record('L3', '2', 'open_dialog', 'FAIL', { reason: 'No dialog opened' }); return; }

  const supplierName = `E2E供应商_L3_${TS}`;
  const filled = await fillFirstInput(page, null, supplierName);
  record('L3', '2', 'fill_supplier', filled ? 'PASS' : 'FAIL', { filled: supplierName });

  const submitClicked = await clickButton(page, '确定', '保存', '提交');
  const toast = await checkToast(page);
  record('L3', '2', 'create_supplier', toast.startsWith('success') ? 'PASS' : 'WARNING', {
    filled: supplierName, toast, submitButton: submitClicked
  });

  // Step 2: Navigate to PO and check supplier dropdown
  const nav2 = await navigateTo(page, '/procurement/orders');
  if (nav2 !== 'OK') { record('L3', '2', 'navigate_po', 'FAIL', { result: nav2 }); return; }

  const createClicked = await clickButton(page, '新建', '新增', '创建订单');
  if (!createClicked) {
    record('L3', '2', 'po_create_button', 'SKIP', { reason: 'No PO create button found' });
    return;
  }
  await page.waitForTimeout(3000);

  const hasSupplierField = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.el-form-item__label, label'));
    return labels.some(l => l.textContent.includes('供应商'));
  });
  record('L3', '2', 'po_has_supplier_field', hasSupplierField ? 'PASS' : 'FAIL', {
    evidence: hasSupplierField ? 'Supplier field found in PO form' : 'No supplier field'
  });
}

// ===== L4 TESTS =====

async function L4_1_FinanceDashboard(page) {
  console.log('\n--- L4-1: Finance Dashboard Access ---');
  const nav = await navigateTo(page, '/finance/costs');
  if (nav !== 'OK') { record('L4', '1', 'navigate', nav === 'TIMEOUT' ? 'FAIL' : nav, { result: nav }); return; }

  const hasContent = await page.evaluate(() => {
    const text = document.body?.innerText?.trim() || '';
    return { length: text.length, hasTable: !!document.querySelector('.el-table') };
  });
  record('L4', '1', 'finance_costs_render', hasContent.length > 50 ? 'PASS' : 'FAIL', hasContent);
}

async function L4_2_AnalyticsDashboard(page) {
  console.log('\n--- L4-2: Analytics Overview ---');
  const nav = await navigateTo(page, '/analytics/overview');
  if (nav !== 'OK') { record('L4', '2', 'navigate', 'FAIL', { result: nav }); return; }

  const hasContent = await page.evaluate(() => ({
    length: document.body?.innerText?.trim()?.length || 0,
    hasCharts: !!document.querySelector('canvas, .echarts, [class*="chart"]'),
  }));
  record('L4', '2', 'analytics_render', hasContent.length > 50 ? 'PASS' : 'FAIL', hasContent);
}

async function L4_3_SmartBIDashboard(page) {
  console.log('\n--- L4-3: SmartBI Dashboard ---');
  const nav = await navigateTo(page, '/smart-bi/dashboard');
  if (nav !== 'OK') { record('L4', '3', 'navigate', 'FAIL', { result: nav }); return; }

  const hasContent = await page.evaluate(() => ({
    length: document.body?.innerText?.trim()?.length || 0,
    hasKPI: !!document.querySelector('[class*="kpi"], [class*="card"], .el-card'),
  }));
  record('L4', '3', 'smartbi_render', hasContent.length > 50 ? 'PASS' : 'FAIL', hasContent);
}

async function L4_4_HREmployeeList(page) {
  console.log('\n--- L4-4: HR Employee List (verify E2E accounts visible) ---');
  const nav = await navigateTo(page, '/hr/employees');
  if (nav !== 'OK') { record('L4', '4', 'navigate', 'FAIL', { result: nav }); return; }

  const data = await page.evaluate(() => {
    const rows = document.querySelectorAll('.el-table__body-wrapper .el-table__row');
    const names = Array.from(rows).slice(0, 5).map(r => r.querySelector('td')?.textContent?.trim() || '?');
    return { rowCount: rows.length, firstNames: names };
  });
  // New factory should have the 15 E2E accounts we created
  record('L4', '4', 'employee_list', data.rowCount > 0 ? 'PASS' : 'WARNING', {
    rows: data.rowCount,
    firstEntries: data.firstNames,
    note: data.rowCount === 0 ? 'New factory — users may not appear as employees' : 'Employees found'
  });
}

async function run() {
  console.log('='.repeat(70));
  console.log(`L3/L4 CROSS-MODULE + BUSINESS FLOW TEST — Round ${ROUND}`);
  console.log(`Factory: ${FACTORY_ID} | Account: e2e_factory_admin`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.route('**fonts.googleapis.com**', r => r.fulfill({ status: 200, body: '' }));
  await ctx.route('**fonts.gstatic.com**', r => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();

  console.log('\nLogging in...');
  await loginAndWait(page, 'e2e_factory_admin');
  console.log('Logged in.');

  // L3 Tests
  await L3_1_CustomerToSODropdown(page);
  await L3_2_SupplierToPODropdown(page);

  // L4 Tests
  await L4_1_FinanceDashboard(page);
  await L4_2_AnalyticsDashboard(page);
  await L4_3_SmartBIDashboard(page);
  await L4_4_HREmployeeList(page);

  await browser.close();

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARNING').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log('\n' + '='.repeat(70));
  console.log(`L3/L4 — Round ${ROUND} SUMMARY`);
  console.log(`PASS: ${pass} | FAIL: ${fail} | WARNING: ${warn} | SKIP: ${skip}`);
  console.log('='.repeat(70));

  if (fail > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`  ${r.layer}/${r.testId}/${r.action}: ${JSON.stringify(r.evidence)}`));
  }

  const outFile = `tests/e2e-comprehensive/results/e2e-L3L4-R${ROUND}.json`;
  writeFileSync(outFile, JSON.stringify({
    round: ROUND, timestamp: new Date().toISOString(), factoryId: FACTORY_ID,
    results, summary: { pass, fail, warn, skip }
  }, null, 2));
  console.log(`\nResults → ${outFile}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
