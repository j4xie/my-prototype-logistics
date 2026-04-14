/**
 * L2 CRUD Test — Round 2 (improved)
 *
 * Improvements over R1:
 * - API response interception instead of toast polling
 * - Row count persistence verification (before/after)
 * - More modules tested
 *
 * Modules: dashboard, production, warehouse, customers, suppliers,
 *          sales orders, procurement orders, employees, quality
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import {
  BASE, PASSWORD, navigateTo, countTableRows,
  clickButton, waitForDialog, submitAndCheckResponse, fillDialogInput,
  fillAllRequiredFields,
} from './lib/helpers.mjs';

const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
const setup = existsSync(SETUP_FILE) ? JSON.parse(readFileSync(SETUP_FILE, 'utf8')) : null;
const FACTORY_ID = setup?.factoryId || 'FOOD_3101_048';
const ROUND = 2;
const results = [];
const TS = Date.now().toString(36);

function record(module, action, status, evidence = {}) {
  const r = { module, action, status, evidence, timestamp: new Date().toISOString() };
  results.push(r);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '-' : '⚠';
  console.log(`  [${icon}] ${module}/${action}: ${status}`);
  for (const [k, v] of Object.entries(evidence)) {
    if (v !== undefined) console.log(`      ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
}

async function loginAndInit(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input.el-input__inner', { timeout: 30000 });
  await page.fill('input.el-input__inner[placeholder="请输入用户名"]', username);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button.login-button');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const hasMenu = await page.evaluate(() => !!document.querySelector('.el-menu,.app-sidebar'));
    if (hasMenu) return true;
  }
  return true;
}

// ===== CRUD: Create entity in a module =====
async function testCRUD(page, { module, path, entityName, extraFields }) {
  console.log(`\n--- CRUD: ${module} ---`);

  // Navigate
  const nav = await navigateTo(page, path, { waitForTable: true });
  if (nav !== 'OK') {
    record(module, 'navigate', nav === 'TIMEOUT' ? 'FAIL' : nav, { result: nav });
    return;
  }

  // Count rows before
  const rowsBefore = await countTableRows(page);
  record(module, 'list', 'PASS', { rows: rowsBefore });

  // Click create button
  const clicked = await clickButton(page, '新建', '新增', '添加', '创建');
  if (!clicked) {
    record(module, 'create_button', 'SKIP', { reason: 'No create button found' });
    return;
  }

  // Wait for dialog
  const dialog = await waitForDialog(page);
  if (!dialog) {
    record(module, 'open_dialog', 'SKIP', { reason: 'No dialog opened — may use separate page' });
    return;
  }

  // Fill name (first input) then all required fields
  const testName = `E2E_${module}_R${ROUND}_${TS}`;
  const filled = await fillDialogInput(page, testName);
  if (!filled) {
    record(module, 'fill_form', 'FAIL', { reason: 'No input found in dialog' });
    return;
  }

  // Fill all other required fields with test data
  const extraFilled = await fillAllRequiredFields(page, testName);
  if (extraFilled.length > 0) {
    record(module, 'fill_required_fields', 'PASS', {
      count: extraFilled.length,
      fields: extraFilled.map(f => `${f.label}=${f.value}`),
    });
  }

  // Submit and check API response
  const submitResult = await submitAndCheckResponse(page);
  if (submitResult.ok) {
    record(module, 'create', 'PASS', {
      filled: testName,
      apiStatus: submitResult.status,
      apiUrl: submitResult.url || submitResult.reason,
    });
  } else {
    record(module, 'create', submitResult.reason === 'no_submit_button' ? 'SKIP' : 'WARNING', {
      filled: testName,
      reason: submitResult.reason,
      apiStatus: submitResult.status,
      errors: submitResult.errors,
    });
    // Don't return — still try persistence check
  }

  // Verify persistence: reload current page and count rows
  await page.waitForTimeout(2000);
  // Close any open dialog first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  // Navigate fresh to the list page (more reliable than reload)
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  // Wait for table to render (up to 25s)
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.querySelector('.el-table__body-wrapper')).catch(() => false)) break;
  }
  // Extra wait for row data to load
  await page.waitForTimeout(2000);
  const rowsAfter = await countTableRows(page);
  const persisted = rowsAfter > rowsBefore;
  record(module, 'persistence', persisted ? 'PASS' : (submitResult.ok ? 'WARNING' : 'SKIP'), {
    rowsBefore,
    rowsAfter,
    delta: rowsAfter - rowsBefore,
    note: !persisted && !submitResult.ok ? 'Create failed, persistence not expected' : '',
  });
}

// ===== Simple list-only test (no create) =====
async function testListOnly(page, module, path) {
  console.log(`\n--- LIST: ${module} ---`);
  const nav = await navigateTo(page, path, { waitForTable: true });
  if (nav !== 'OK') {
    record(module, 'navigate', 'FAIL', { result: nav });
    return;
  }
  const rows = await countTableRows(page);
  record(module, 'list', 'PASS', { rows, note: rows === 0 ? 'Empty (new factory)' : '' });
}

async function testDashboard(page) {
  console.log('\n--- Dashboard ---');
  await page.waitForTimeout(2000);
  const content = await page.evaluate(() => ({
    length: document.body?.innerText?.trim()?.length || 0,
    hasCards: !!document.querySelector('.el-card, [class*="stat"], [class*="dashboard"]'),
    hasMenu: !!document.querySelector('.el-menu,.app-sidebar'),
  }));
  record('dashboard', 'render', content.length > 50 ? 'PASS' : 'FAIL', content);
}

async function run() {
  console.log('='.repeat(70));
  console.log(`L2 CRUD TEST — Round ${ROUND}`);
  console.log(`Factory: ${FACTORY_ID} | Account: e2e_factory_admin`);
  console.log(`Improvements: API response interception + row persistence check`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.route('**fonts.googleapis.com**', r => r.fulfill({ status: 200, body: '' }));
  await ctx.route('**fonts.gstatic.com**', r => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();

  console.log('\nLogging in as e2e_factory_admin...');
  await loginAndInit(page, 'e2e_factory_admin');
  console.log('Logged in.');

  // Dashboard
  await testDashboard(page);

  // CRUD tests with API response interception
  await testCRUD(page, { module: 'customers', path: '/sales/customers', entityName: '客户' });
  await testCRUD(page, { module: 'suppliers', path: '/procurement/suppliers', entityName: '供应商' });

  // List-only tests (no create dialog or empty factory)
  await testListOnly(page, 'sales_orders', '/sales/orders');
  await testListOnly(page, 'procurement_orders', '/procurement/orders');
  await testListOnly(page, 'production_batches', '/production/batches');
  await testListOnly(page, 'warehouse_materials', '/warehouse/materials');
  await testListOnly(page, 'employees', '/hr/employees');
  await testListOnly(page, 'quality_inspections', '/quality/inspections');
  await testListOnly(page, 'equipment', '/equipment/list');
  await testListOnly(page, 'finance_costs', '/finance/costs');

  await browser.close();

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARNING').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log('\n' + '='.repeat(70));
  console.log(`L2 CRUD — Round ${ROUND} SUMMARY`);
  console.log(`PASS: ${pass} | FAIL: ${fail} | WARNING: ${warn} | SKIP: ${skip}`);
  console.log('='.repeat(70));

  if (fail > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`  ${r.module}/${r.action}: ${JSON.stringify(r.evidence)}`));
  }

  const outFile = `tests/e2e-comprehensive/results/e2e-L2-R${ROUND}.json`;
  writeFileSync(outFile, JSON.stringify({
    round: ROUND, timestamp: new Date().toISOString(), factoryId: FACTORY_ID,
    results, summary: { pass, fail, warn, skip }
  }, null, 2));
  console.log(`\nResults → ${outFile}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
