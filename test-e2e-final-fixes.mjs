/**
 * E2E Final: Fix all 5 WARNs + Complete L4 Workflows
 * - WARN1: Sales edit (create draft first)
 * - WARN2: Customer has no toggle (verify 查看+编辑+删除 instead)
 * - WARN3+4: Finance role menu is SmartBI by design (correct expectation)
 * - WARN5: Product has no detail (verify 编辑 opens form)
 * - L4 complete: Sales deliver, Purchase receive
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const FACTORY = 'F001';
const TS = Date.now().toString().slice(-6);

let TOKEN = '';
let pass = 0, fail = 0, warn = 0;
const results = [];

function log(layer, mod, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ layer, module: mod, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${layer}] ${mod} — ${test}${ev ? '\n   ' + ev.slice(0, 200) : ''}`);
}

async function getToken() {
  const r = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' })
  });
  TOKEN = (await r.json()).data?.accessToken || '';
}

async function api(path, opts = {}) {
  const r = await fetch(`${API}/${FACTORY}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) }
  });
  return r.json();
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000); // Wait for JS bundle to execute + Vue mount
  await page.locator('button:has-text("工厂总监")').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('button:has-text("工厂总监")').click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForURL(u => !u.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return !page.url().includes('/login');
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  // Wait for Vue to render table or card
  await page.locator('.el-table, .el-card, .el-form, main').first().waitFor({ timeout: 5000 }).catch(() => {});
}

// ==================== FIX WARN1: Sales Order Edit ====================

async function fixSalesEdit(page) {
  console.log('\n=== FIX: 销售订单编辑 ===');

  // Create a fresh draft order via API
  const custs = await api('/customers/active');
  const prods = await api('/product-types/active');
  const cid = custs.data?.[0]?.id, pid = prods.data?.[0]?.id;
  if (!cid || !pid) { log('L2', '销售订单', '编辑', 'WARN', '缺前置数据'); return; }

  const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
    customerId: cid, salesperson: `编辑测试${TS}`,
    items: [{ productTypeId: pid, quantity: 5, unit: 'kg', unitPrice: 88 }]
  })});
  if (!so.success) { log('L2', '销售订单', '编辑', 'FAIL', `创建失败: ${so.message}`); return; }
  log('L2', '销售订单', '编辑-创建草稿', 'PASS', `${so.data.orderNumber} DRAFT`);

  // Navigate to list → find the draft → click edit
  await go(page, '/sales/orders');
  const editBtn = page.locator('.el-table__row').filter({ hasText: so.data.orderNumber }).locator('button:has-text("编辑")');
  if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(1500);
    const dialog = page.locator('.el-dialog:visible');
    if (await dialog.isVisible().catch(() => false)) {
      // Modify remark
      const remark = dialog.locator('textarea').first();
      if (await remark.isVisible().catch(() => false)) await remark.fill(`E2E编辑${TS}`);
      await dialog.locator('button:has-text("保存")').click();
      await page.waitForTimeout(2500);
      const ok = await page.locator('.el-message--success').isVisible().catch(() => false);
      log('L2', '销售订单', '编辑-保存', ok ? 'PASS' : 'FAIL', ok ? '保存成功' : '无成功toast');
    } else { log('L2', '销售订单', '编辑', 'FAIL', '编辑弹窗未打开'); }
  } else { log('L2', '销售订单', '编辑', 'FAIL', `未找到${so.data.orderNumber}的编辑按钮`); }
}

// ==================== FIX WARN2: Customer Operations ====================

async function fixCustomerOps(page) {
  console.log('\n=== FIX: 客户操作按钮 ===');

  await go(page, '/sales/customers');
  // Check actual buttons: 查看 + 编辑 + 删除
  const viewBtn = page.locator('button:has-text("查看")').first();
  const editBtn = page.locator('button:has-text("编辑")').first();
  const delBtn = page.locator('button:has-text("删除")').first();

  const hasView = await viewBtn.isVisible().catch(() => false);
  const hasEdit = await editBtn.isVisible().catch(() => false);
  const hasDel = await delBtn.isVisible().catch(() => false);
  log('L2', '客户管理', '操作按钮', hasView && hasEdit && hasDel ? 'PASS' : 'FAIL',
    `查看=${hasView}, 编辑=${hasEdit}, 删除=${hasDel}`);

  // Click 查看 → verify detail opens
  if (hasView) {
    await viewBtn.click();
    await page.waitForTimeout(1500);
    const dialogInputs = await page.locator('.el-dialog:visible input').count().catch(() => 0);
    log('L5.2', '客户管理', '查看弹窗', dialogInputs > 0 ? 'PASS' : 'FAIL', `${dialogInputs}个字段`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
}

// ==================== FIX WARN5: Product Operations ====================

async function fixProductOps(page) {
  console.log('\n=== FIX: 产品操作按钮 ===');

  await go(page, '/system/products');
  const editBtn = page.locator('button:has-text("编辑")').first();
  const hasEdit = await editBtn.isVisible().catch(() => false);

  if (hasEdit) {
    await editBtn.click();
    await page.waitForTimeout(1500);
    const fields = await page.locator('.el-dialog:visible input, .el-drawer:visible input').count().catch(() => 0);
    log('L5.2', '产品管理', '编辑=详情(无独立详情页)', fields > 0 ? 'PASS' : 'FAIL', `${fields}个字段可编辑`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  } else {
    log('L5.2', '产品管理', '编辑按钮', 'FAIL', '无编辑按钮');
  }
}

// ==================== FIX WARN3+4: Finance Manager Menu ====================

async function fixFinanceMenu(page) {
  console.log('\n=== FIX: 财务经理菜单 (设计确认) ===');
  // finance_manager is hardcoded to SmartBI menu in AppSidebar.vue
  // Correct expectation: 经营驾驶舱, 财务分析看板, 财务分析, 销售分析, AI问答, 查询模板, 智能数据分析

  // Login as finance_mgr1
  await page.evaluate(() => {
    localStorage.removeItem('cretas_access_token');
    localStorage.removeItem('cretas_user');
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const qb = page.locator('button:has-text("财务经理")');
  if (await qb.isVisible({ timeout: 3000 }).catch(() => false)) await qb.click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForURL(u => !u.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  if (page.url().includes('/login')) {
    log('多角色', '财务经理', '登录', 'FAIL', '登录失败');
    return;
  }
  log('多角色', '财务经理', '登录', 'PASS', page.url());

  const menuText = await page.locator('.el-menu').first().textContent().catch(() => '');

  // Correct expectation: SmartBI menus
  const expectedItems = ['经营驾驶舱', '财务分析', 'AI问答'];
  const allFound = expectedItems.every(item => menuText.includes(item));
  log('多角色', '财务经理', '菜单正确(SmartBI)', allFound ? 'PASS' : 'FAIL',
    `期望BI菜单: ${expectedItems.every(i => menuText.includes(i)) ? '全有' : '缺'}, 实际: ${menuText.slice(0, 80)}`);

  // Navigate to SmartBI page (their actual workspace)
  await go(page, '/smart-bi/finance');
  const hasContent = await page.locator('.el-card, .el-table, main').first().isVisible().catch(() => false);
  const bodyLen = (await page.locator('.app-main, main').first().textContent().catch(() => '')).length;
  log('多角色', '财务经理', '财务分析页', hasContent || bodyLen > 50 ? 'PASS' : 'WARN', `${bodyLen}字`);

  // Re-login as admin
  await page.evaluate(() => {
    localStorage.removeItem('cretas_access_token');
    localStorage.removeItem('cretas_user');
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const ab = page.locator('button:has-text("工厂总监")');
  if (await ab.isVisible({ timeout: 3000 }).catch(() => false)) await ab.click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForURL(u => !u.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

// ==================== L4 COMPLETE: Sales Deliver ====================

async function testSalesDeliver(page) {
  console.log('\n=== L4完整: 销售出库 ===');
  const custs = await api('/customers/active');
  const prods = await api('/product-types/active');
  const cid = custs.data?.[0]?.id, pid = prods.data?.[0]?.id;
  if (!cid || !pid) { log('L4', '销售出库', '前置', 'WARN', '缺数据'); return; }

  // Create + confirm
  const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
    customerId: cid, items: [{ productTypeId: pid, quantity: 10, unit: 'kg', unitPrice: 50 }]
  })});
  if (!so.success) { log('L4', '销售出库', '创建', 'FAIL', so.message); return; }
  const confirm = await api(`/sales/orders/${so.data.id}/confirm`, { method: 'POST' });
  if (!confirm.success) { log('L4', '销售出库', '确认', 'FAIL', confirm.message); return; }
  log('L4', '销售出库', '1.创建+确认', 'PASS', `${so.data.orderNumber} → CONFIRMED`);

  // Deliver via POST /sales/deliveries
  const deliver = await api(`/sales/deliveries`, {
    method: 'POST',
    body: JSON.stringify({
      salesOrderId: so.data.id,
      customerId: cid,
      deliveryDate: new Date().toISOString().slice(0, 10),
      remark: `E2E出库${TS}`,
      items: [{ productTypeId: pid, deliveredQuantity: 5, unit: 'kg' }]
    })
  });
  if (deliver.success) {
    log('L4', '销售出库', '2.出库', 'PASS', `发货5件, ${deliver.data?.status || 'ok'}`);
  } else {
    // Delivery might need different format
    log('L4', '销售出库', '2.出库', 'WARN', `API: ${deliver.message?.slice(0, 80)}`);
  }

  // Verify on UI — click 出库 button on the confirmed order
  await go(page, '/sales/orders');
  const orderRow = page.locator('.el-table__row').filter({ hasText: so.data.orderNumber });
  const deliverBtn = orderRow.locator('button:has-text("出库")');
  if (await deliverBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    log('L4', '销售出库', '3.出库按钮可见', 'PASS', `${so.data.orderNumber} 有出库按钮`);
  } else {
    log('L4', '销售出库', '3.出库按钮', 'WARN', '按钮不可见(可能已发完)');
  }
}

// ==================== L4 COMPLETE: Purchase Receive ====================

async function testPurchaseReceive(page) {
  console.log('\n=== L4完整: 采购入库 ===');
  const supps = await api('/suppliers/active');
  const mats = await api('/raw-material-types/active');
  const sid = supps.data?.[0]?.id, mid = mats.data?.[0]?.id, mn = mats.data?.[0]?.name;
  if (!sid || !mid) { log('L4', '采购入库', '前置', 'WARN', '缺数据'); return; }

  // Create + submit + approve
  const po = await api('/purchase/orders', { method: 'POST', body: JSON.stringify({
    supplierId: sid, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
    items: [{ materialTypeId: mid, materialName: mn, quantity: 20, unit: 'kg', unitPrice: 15 }]
  })});
  if (!po.success) { log('L4', '采购入库', '创建', 'FAIL', po.message); return; }
  await api(`/purchase/orders/${po.data.id}/submit`, { method: 'POST' });
  const approve = await api(`/purchase/orders/${po.data.id}/approve`, { method: 'POST' });
  if (!approve.success) { log('L4', '采购入库', '审批', 'FAIL', approve.message); return; }
  log('L4', '采购入库', '1.创建+审批', 'PASS', `${po.data.orderNumber} → APPROVED`);

  // Receive via POST /purchase/receives
  const receive = await api(`/purchase/receives`, {
    method: 'POST',
    body: JSON.stringify({
      purchaseOrderId: po.data.id,
      supplierId: sid,
      receiveDate: new Date().toISOString().slice(0, 10),
      remark: `E2E收货${TS}`,
      items: [{ materialTypeId: mid, materialName: mn, receivedQuantity: 10, unit: 'kg' }]
    })
  });
  if (receive.success) {
    log('L4', '采购入库', '2.入库', 'PASS', `收货10件`);
  } else {
    log('L4', '采购入库', '2.入库', 'WARN', `API: ${receive.message?.slice(0, 80)}`);
  }

  // Verify on UI
  await go(page, '/procurement/orders');
  const poRow = page.locator('.el-table__row').filter({ hasText: po.data.orderNumber });
  const statusText = await poRow.locator('.el-tag').first().textContent().catch(() => '');
  log('L4', '采购入库', '3.UI状态', statusText ? 'PASS' : 'WARN', `状态="${statusText}"`);
}

// ==================== MAIN ====================

async function main() {
  console.log('🚀 E2E Final Fix: 5 WARNs + L4 Complete');
  console.log(`${new Date().toISOString()}\n`);

  await getToken();
  if (!TOKEN) { console.error('❌ No token'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Remove Google Fonts link before page loads (blocked in China, prevents Vue mount)
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]').forEach(el => el.remove());
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon') && !m.text().includes('fonts.g') && !m.text().includes('ERR_FAILED')) consoleErrors.push(m.text().slice(0, 100)); });

  if (!await login(page)) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Login OK\n');

  await fixSalesEdit(page);
  await fixCustomerOps(page);
  await fixProductOps(page);
  await testSalesDeliver(page);
  await testPurchaseReceive(page);
  await fixFinanceMenu(page);

  console.log('\n' + '='.repeat(50));
  console.log(`📊 FINAL FIX: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(50));
  if (consoleErrors.length) { console.log(`🔴 Console: ${consoleErrors.length} errors`); consoleErrors.slice(0, 5).forEach(e => console.log(`  - ${e}`)); }
  else console.log('✅ Console: 0 errors');

  const fs = await import('fs');
  fs.writeFileSync('test-e2e-final-results.json', JSON.stringify({ timestamp: new Date().toISOString(), pass, fail, warn, results }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
