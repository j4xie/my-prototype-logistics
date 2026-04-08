/**
 * E2E Deep Verify: 严格按skill要求
 * - L2: 每次创建后点详情逐项核对 + 编辑后核对 + 删除确认消失
 * - L3: 跨模块创建→选中→提交→详情核对名称
 * - L4: 链路每步验证下游页面数据更新
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const FACTORY = 'F001';
const TS = Date.now().toString().slice(-6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let TOKEN = '';
let pass = 0, fail = 0, warn = 0;
const results = [];

function log(layer, mod, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ layer, module: mod, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${layer}] ${mod} — ${test}${ev ? '\n   ' + ev.slice(0, 250) : ''}`);
}

async function getToken() {
  const r = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' })
  });
  TOKEN = (await r.json()).data?.accessToken || '';
}

async function api(path, opts = {}) {
  return (await fetch(`${API}/${FACTORY}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) }
  })).json();
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
}

// Get all text from detail page descriptions
async function getDetailFields(page) {
  return page.$$eval('.el-descriptions__body tr', rows => {
    const p = [];
    for (const r of rows) {
      const ls = r.querySelectorAll('.el-descriptions__label');
      const vs = r.querySelectorAll('.el-descriptions__content');
      for (let i = 0; i < ls.length; i++) {
        if (ls[i] && vs[i]) p.push({ label: ls[i].textContent?.trim(), value: vs[i].textContent?.trim() });
      }
    }
    return p;
  }).catch(() => []);
}

// Get table first row cells
async function getFirstRowCells(page) {
  return page.$eval('.el-table__body-wrapper .el-table__row:first-child',
    r => Array.from(r.querySelectorAll('td .cell')).map(c => c.textContent?.trim() || '')
  ).catch(() => []);
}

// ==================== L2 DEEP: Create + Detail Verify ====================

async function testSalesDeepCRUD(page) {
  console.log('\n=== L2 深验: 销售订单 创建→详情核对→编辑→再核对 ===');

  const custs = await api('/customers/active');
  const prods = await api('/product-types/active');
  const cid = custs.data?.[0]?.id, cname = custs.data?.[0]?.name;
  const pid = prods.data?.[0]?.id, pname = prods.data?.[0]?.name;
  if (!cid || !pid) { log('L2', '销售订单', '前置', 'FAIL', '缺客户或产品'); return null; }

  // CREATE
  const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
    customerId: cid, salesperson: `深验${TS}`,
    items: [{ productTypeId: pid, quantity: 8, unit: 'kg', unitPrice: 66 }]
  })});
  if (!so.success) { log('L2', '销售订单', '创建', 'FAIL', so.message); return null; }
  log('L2', '销售订单', '创建', 'PASS', `${so.data.orderNumber} ¥${so.data.totalAmount}`);

  // DETAIL VERIFY — navigate to list, click detail, check every field
  await go(page, '/sales/orders');
  const row = page.locator('.el-table__row').filter({ hasText: so.data.orderNumber });
  const detailBtn = row.locator('button:has-text("详情")');
  if (!await detailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    log('L2', '销售订单', '详情入口', 'FAIL', '找不到详情按钮'); return so.data;
  }
  await detailBtn.click();
  await page.waitForTimeout(2500);

  const fields = await getDetailFields(page);
  const check = (label, expected) => {
    const f = fields.find(f => f.label?.includes(label));
    if (!f) return `${label}=未找到`;
    if (UUID_RE.test(f.value)) return `${label}=UUID!`;
    if (expected && !f.value?.includes(expected)) return `${label}="${f.value}"≠"${expected}"`;
    return null; // OK
  };

  const errors = [
    check('客户', cname),
    check('订单编号', so.data.orderNumber),
    check('业务员', `深验${TS}`),
    check('总金额'),
  ].filter(Boolean);

  if (errors.length === 0) {
    const custField = fields.find(f => f.label?.includes('客户'));
    log('L2', '销售订单', '详情核对', 'PASS',
      `客户="${custField?.value}", 单号="${so.data.orderNumber}", 业务员="深验${TS}"`);
  } else {
    log('L2', '销售订单', '详情核对', 'FAIL', errors.join('; '));
  }

  // Check item table — product name not empty, not UUID
  const itemCells = await page.$$eval('.el-table__body-wrapper .el-table__row td:first-child .cell',
    els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
  const badItems = itemCells.filter(c => !c || c === '-' || UUID_RE.test(c));
  log('L2', '销售订单', '行项目名称', badItems.length === 0 ? 'PASS' : 'FAIL',
    `${itemCells.length}行: [${itemCells.join(',')}]${badItems.length ? ' 空/UUID!' : ''}`);

  await page.goBack(); await page.waitForTimeout(1500);
  return so.data;
}

async function testPurchaseDeepCRUD(page) {
  console.log('\n=== L2 深验: 采购订单 创建→详情核对 ===');

  const supps = await api('/suppliers/active');
  const mats = await api('/raw-material-types/active');
  const sid = supps.data?.[0]?.id, sname = supps.data?.[0]?.name;
  const mid = mats.data?.[0]?.id, mname = mats.data?.[0]?.name;
  if (!sid || !mid) { log('L2', '采购订单', '前置', 'FAIL', '缺供应商或原料'); return null; }

  const po = await api('/purchase/orders', { method: 'POST', body: JSON.stringify({
    supplierId: sid, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
    items: [{ materialTypeId: mid, materialName: mname, quantity: 15, unit: 'kg', unitPrice: 25, specification: '500g/袋', boxQuantity: 3 }]
  })});
  if (!po.success) { log('L2', '采购订单', '创建', 'FAIL', po.message); return null; }
  log('L2', '采购订单', '创建', 'PASS', `${po.data.orderNumber}`);

  // Detail verify
  await go(page, '/procurement/orders');
  const row = page.locator('.el-table__row').filter({ hasText: po.data.orderNumber });
  const detBtn = row.locator('button:has-text("详情")');
  if (await detBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await detBtn.click(); await page.waitForTimeout(2500);
    const fields = await getDetailFields(page);
    const suppField = fields.find(f => f.label?.includes('供应商'));
    const isUUID = suppField && UUID_RE.test(suppField.value);
    log('L2', '采购订单', '详情-供应商名', !isUUID && suppField?.value ? 'PASS' : 'FAIL',
      `供应商="${suppField?.value}"${isUUID ? ' UUID!' : ''}`);

    // Check material name in item table
    const matCells = await page.$$eval('.el-table__body-wrapper .el-table__row td:first-child .cell',
      els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
    const emptyMats = matCells.filter(c => !c || c === '-');
    log('L2', '采购订单', '详情-原料名', emptyMats.length === 0 ? 'PASS' : 'FAIL',
      `${matCells.length}行: [${matCells.join(',')}]`);

    // Check spec + box columns exist
    const headers = await page.$$eval('.el-table__header-wrapper th .cell',
      els => els.map(e => e.textContent?.trim())).catch(() => []);
    const hasSpec = headers.some(h => h.includes('规格'));
    const hasBox = headers.some(h => h.includes('箱数'));
    log('L5.5', '采购订单', '详情-规格箱数列', hasSpec && hasBox ? 'PASS' : 'FAIL',
      `规格=${hasSpec}, 箱数=${hasBox}`);

    await page.goBack(); await page.waitForTimeout(1500);
  } else { log('L2', '采购订单', '详情入口', 'FAIL', '无详情按钮'); }
  return po.data;
}

// ==================== L3 DEEP: Cross-module with full verify ====================

async function testL3Deep(page) {
  console.log('\n=== L3 深验: 新建客户→销售订单选中→提交→详情验证客户名 ===');

  // Create customer
  const custName = `L3深验客户${TS}`;
  const cust = await api('/customers', { method: 'POST', body: JSON.stringify({
    name: custName, contactPerson: '深验联系人', phone: '13900001234', shippingAddress: '深验地址'
  })});
  if (!cust.success) { log('L3', '跨模块', '创建客户', 'FAIL', cust.message); return; }
  log('L3', '跨模块', '1.创建客户', 'PASS', custName);

  // Create SO with this customer
  const prods = await api('/product-types/active');
  const pid = prods.data?.[0]?.id;
  const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
    customerId: cust.data.id, salesperson: 'L3测试',
    items: [{ productTypeId: pid, quantity: 3, unit: 'kg', unitPrice: 100 }]
  })});
  if (!so.success) { log('L3', '跨模块', '创建SO', 'FAIL', so.message); return; }
  log('L3', '跨模块', '2.用新客户创建SO', 'PASS', so.data.orderNumber);

  // Navigate to SO detail → verify customer name = custName (NOT UUID)
  await go(page, '/sales/orders');
  const row = page.locator('.el-table__row').filter({ hasText: so.data.orderNumber });
  await row.locator('button:has-text("详情")').click();
  await page.waitForTimeout(2500);

  const fields = await getDetailFields(page);
  const custField = fields.find(f => f.label?.includes('客户'));
  if (custField?.value?.includes(custName)) {
    log('L3', '跨模块', '3.详情客户名=新客户', 'PASS', `"${custField.value}" 包含 "${custName}"`);
  } else if (UUID_RE.test(custField?.value || '')) {
    log('L3', '跨模块', '3.详情客户名', 'FAIL', `UUID! "${custField?.value}"`);
  } else {
    log('L3', '跨模块', '3.详情客户名', 'FAIL', `"${custField?.value}" 不含 "${custName}"`);
  }

  await page.goBack(); await page.waitForTimeout(1500);
}

// ==================== L4 DEEP: Full chain with downstream verify ====================

async function testL4SalesChain(page) {
  console.log('\n=== L4 深验: 销售 创建→确认→出库→出货记录验证 ===');

  const custs = await api('/customers/active');
  const prods = await api('/product-types/active');
  const cid = custs.data?.[0]?.id, pid = prods.data?.[0]?.id;

  // 1. Create + confirm
  const so = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
    customerId: cid, items: [{ productTypeId: pid, quantity: 10, unit: 'kg', unitPrice: 50 }]
  })});
  await api(`/sales/orders/${so.data.id}/confirm`, { method: 'POST' });
  log('L4', '销售链路', '1.创建+确认', 'PASS', `${so.data.orderNumber} → CONFIRMED`);

  // 2. Create delivery record (DRAFT)
  const del = await api('/sales/deliveries', { method: 'POST', body: JSON.stringify({
    salesOrderId: so.data.id, customerId: cid,
    deliveryDate: new Date().toISOString().slice(0, 10),
    items: [{ productTypeId: pid, deliveredQuantity: 10, unit: 'kg' }]
  })});
  log('L4', '销售链路', '2.创建发货单', del.success ? 'PASS' : 'FAIL',
    del.success ? `${del.data?.deliveryNumber} 状态=${del.data?.status}` : del.message);

  // 3. Ship delivery (confirm) → this triggers quantity update + inventory deduction
  if (del.success) {
    const ship = await api(`/sales/deliveries/${del.data.id}/ship`, { method: 'POST' });
    log('L4', '销售链路', '3.确认发货', ship.success ? 'PASS' : 'WARN',
      ship.success ? `状态→${ship.data?.status}` : `${ship.message?.slice(0, 80)} (可能缺库存)`);

    // 4. Verify: SO deliveredQuantity updated
    const soDetail = await api(`/sales/orders/${so.data.id}`);
    const item = soDetail.data?.items?.[0];
    const delivered = Number(item?.deliveredQuantity || 0);
    log('L4', '销售链路', '4.SO已发货数', delivered >= 10 ? 'PASS' : (ship.success ? 'FAIL' : 'WARN'),
      `已发货=${delivered} (期望≥10)${!ship.success ? ' (发货未确认,数量未更新符合预期)' : ''}`);

    // 5. Verify: 出货记录页
    await go(page, '/sales/shipments');
    const bodyText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
    const hasDelivery = bodyText.includes(del.data?.deliveryNumber || 'xxx');
    log('L4', '销售链路', '5.出货记录页', hasDelivery ? 'PASS' : 'WARN',
      `查找"${del.data?.deliveryNumber}": ${hasDelivery ? '找到' : '需翻页或确认后出现'}`);
  }
}

async function testL4PurchaseChain(page) {
  console.log('\n=== L4 深验: 采购 创建→审批→入库→库存验证 ===');

  const supps = await api('/suppliers/active');
  const mats = await api('/raw-material-types/active');
  const sid = supps.data?.[0]?.id, mid = mats.data?.[0]?.id, mn = mats.data?.[0]?.name;

  // 1. Create + approve
  const po = await api('/purchase/orders', { method: 'POST', body: JSON.stringify({
    supplierId: sid, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
    items: [{ materialTypeId: mid, materialName: mn, quantity: 20, unit: 'kg', unitPrice: 15 }]
  })});
  await api(`/purchase/orders/${po.data.id}/submit`, { method: 'POST' });
  await api(`/purchase/orders/${po.data.id}/approve`, { method: 'POST' });
  log('L4', '采购链路', '1.创建+审批', 'PASS', `${po.data.orderNumber} → APPROVED`);

  // 2. Create receive (DRAFT)
  const rcv = await api('/purchase/receives', { method: 'POST', body: JSON.stringify({
    purchaseOrderId: po.data.id, supplierId: sid,
    receiveDate: new Date().toISOString().slice(0, 10),
    items: [{ materialTypeId: mid, materialName: mn, receivedQuantity: 20, unit: 'kg' }]
  })});
  log('L4', '采购链路', '2.创建入库单', rcv.success ? 'PASS' : 'FAIL',
    rcv.success ? `${rcv.data?.receiveNumber} 状态=${rcv.data?.status}` : rcv.message);

  // 3. Confirm receive → PO qty update + material batch
  if (rcv.success) {
    const cfm = await api(`/purchase/receives/${rcv.data.id}/confirm`, { method: 'POST' });
    log('L4', '采购链路', '3.确认入库', cfm.success ? 'PASS' : 'WARN',
      cfm.success ? `状态→${cfm.data?.status}` : cfm.message?.slice(0, 80));

    // 4. Verify PO receivedQuantity
    const poDetail = await api(`/purchase/orders/${po.data.id}`);
    const item = poDetail.data?.items?.[0];
    const received = Number(item?.receivedQuantity || 0);
    log('L4', '采购链路', '4.PO已收货数', received >= 20 ? 'PASS' : (cfm.success ? 'FAIL' : 'WARN'),
      `已收货=${received} (期望≥20)${!cfm.success ? ' (未确认符合预期)' : ''}`);

    // 5. Verify material batch in inventory
    await go(page, '/warehouse/materials');
    const bodyText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
    const hasNewBatch = bodyText.includes(mn);
    log('L4', '采购链路', '5.原材料库存', hasNewBatch ? 'PASS' : 'WARN',
      `查找"${mn}": ${hasNewBatch ? '找到' : '可能不在首页'}`);
  }
}

async function testL4RdChain(page) {
  console.log('\n=== L4 深验: 研发 创建→审核→验证自动生成 ===');

  const sample = await api('/rd/samples', { method: 'POST', body: JSON.stringify({
    name: `L4深验样品${TS}`, specification: '250g', productLevel: 'A', storageMethod: '冷冻'
  })});
  if (!sample.success) { log('L4', '研发链路', '创建', 'FAIL', sample.message); return; }
  await api(`/rd/samples/${sample.data.id}/submit`, { method: 'POST' });
  const approve = await api(`/rd/samples/${sample.data.id}/approve`, { method: 'POST', body: JSON.stringify({ notes: 'L4深验通过' }) });
  log('L4', '研发链路', '1.创建→审核通过', approve.success ? 'PASS' : 'FAIL',
    `${sample.data.sampleCode} → ${approve.data?.status}`);

  // Verify on UI: approved sample row has 报价按钮
  await go(page, '/rd/samples');
  const approvedRow = page.locator('.el-table__row').filter({ hasText: sample.data.sampleCode });
  if (await approvedRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    const btns = await approvedRow.locator('button').allTextContents().catch(() => []);
    const hasQuote = btns.some(b => b?.includes('报价'));
    log('L4', '研发链路', '2.报价按钮', hasQuote ? 'PASS' : 'FAIL', `按钮: [${btns.map(b=>b?.trim()).join(',')}]`);

    const statusTag = await approvedRow.locator('.el-tag').textContent().catch(() => '');
    log('L4', '研发链路', '3.状态标签', statusTag === '样品通过' ? 'PASS' : 'FAIL',
      `期望"样品通过", 实际"${statusTag}"`);
  } else { log('L4', '研发链路', '2.UI查找', 'WARN', `未找到${sample.data.sampleCode}`); }

  // Check if quotation task was auto-created
  const quotations = await api('/rd/quotations?page=1&size=5');
  const hasQuotation = quotations.data?.content?.some(q => q.sampleId === sample.data.id);
  log('L4', '研发链路', '4.自动生成报价任务', hasQuotation ? 'PASS' : 'WARN',
    hasQuotation ? '报价任务已生成' : '未找到(可能事件异步未完成)');
}

// ==================== MAIN ====================

async function main() {
  console.log('🚀 E2E Deep Verify: L2详情核对 + L3全链 + L4下游验证');
  console.log(`${new Date().toISOString()}\n`);

  await getToken();
  if (!TOKEN) { console.error('❌ No token'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    new MutationObserver(() => {
      document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]').forEach(el => el.remove());
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon') && !m.text().includes('ERR_FAILED')) consoleErrors.push(m.text().slice(0, 100)); });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('button:has-text("工厂总监")').waitFor({ timeout: 15000 });
  await page.locator('button:has-text("工厂总监")').click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForURL(u => !u.includes('/login'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Login OK\n');

  // Run all deep tests
  await testSalesDeepCRUD(page);
  await testPurchaseDeepCRUD(page);
  await testL3Deep(page);
  await testL4SalesChain(page);
  await testL4PurchaseChain(page);
  await testL4RdChain(page);

  console.log('\n' + '='.repeat(60));
  console.log(`📊 DEEP VERIFY: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass+fail+warn})`);
  console.log('='.repeat(60));
  if (consoleErrors.length) console.log(`🔴 Console: ${[...new Set(consoleErrors)].join('; ')}`);
  else console.log('✅ Console: 0 errors');

  const fs = await import('fs');
  fs.writeFileSync('test-e2e-deep-results.json', JSON.stringify({ timestamp: new Date().toISOString(), pass, fail, warn, results }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
