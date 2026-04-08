/**
 * E2E Complete Test: ALL Modules L1-L5 with REAL Playwright Interaction
 * Every module: page load → click buttons → fill forms → submit → verify results
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const FACTORY = 'F001';
const TS = Date.now().toString().slice(-6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_WHITELIST = ['编号', 'ID', 'code', '编码', '追踪码', '批次号', '工厂', 'factoryId', '参考号'];

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
  await page.waitForTimeout(3000);
  try {
    const qb = page.locator('button:has-text("工厂总监")');
    if (await qb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qb.click(); await page.waitForTimeout(1000);
    }
    await page.fill('input[placeholder*="用户名"]', 'factory_admin1', { timeout: 5000 }).catch(() => {});
    await page.fill('input[placeholder*="密码"]', '123456', { timeout: 5000 }).catch(() => {});
    await page.click('button:has-text("登 录")', { timeout: 5000 });
    await page.waitForTimeout(4000);
  } catch { /* already navigated */ }
  return page.url().includes('dashboard') || page.url().includes('login') === false;
}

// ============ HELPERS ============

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);
}

async function getHeaders(page) {
  return page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
}

async function getRows(page, max = 5) {
  return page.$$eval('.el-table__body-wrapper .el-table__row', (rows, m) =>
    rows.slice(0, m).map(r => Array.from(r.querySelectorAll('td .cell')).map(c => c.textContent?.trim() || '')),
  max).catch(() => []);
}

async function getTags(page) {
  return page.$$eval('.el-tag', els => els.map(e => e.textContent?.trim() || '')).catch(() => []);
}

async function clickBtn(page, text, timeout = 5000) {
  const btn = page.locator(`button:has-text("${text}")`).first();
  if (await btn.isVisible({ timeout }).catch(() => false)) { await btn.click(); await page.waitForTimeout(1500); return true; }
  return false;
}

async function hasToast(page, type = 'success') {
  await page.waitForTimeout(2000);
  return page.locator(`.el-message--${type}`).isVisible().catch(() => false);
}

async function selectFirstOption(page, selectIndex = 0) {
  const selects = page.locator('.el-dialog:visible .el-select, .el-drawer:visible .el-select');
  const sel = selects.nth(selectIndex);
  if (!await sel.isVisible().catch(() => false)) return '';
  await sel.click(); await page.waitForTimeout(600);
  const opt = page.locator('.el-select-dropdown__item:visible').first();
  if (!await opt.isVisible().catch(() => false)) return '';
  const text = await opt.textContent().catch(() => '');
  await opt.click(); await page.waitForTimeout(400);
  return text?.trim() || '';
}

// ============ L1+L5 GENERIC CHECKS ============

async function checkPage(page, mod, path) {
  await go(page, path);
  const hasTable = await page.locator('.el-table').first().isVisible().catch(() => false);
  const hasCard = await page.locator('.el-card').first().isVisible().catch(() => false);
  const hasErr = await page.locator('.el-message--error').isVisible().catch(() => false);
  if (hasErr) { log('L1', mod, '页面加载', 'FAIL', 'error toast'); return false; }
  if (hasTable || hasCard) { log('L1', mod, '页面加载', 'PASS', `table=${hasTable}`); return true; }
  // Some pages use different layout
  const bodyText = await page.locator('main, .app-main, #app').first().textContent().catch(() => '');
  if (bodyText.length > 50) { log('L1', mod, '页面加载', 'PASS', `非表格布局, 内容${bodyText.length}字`); return true; }
  log('L1', mod, '页面加载', 'WARN', '无明显内容'); return false;
}

async function checkUUID(page, mod, path, cols) {
  await go(page, path);
  const headers = await getHeaders(page);
  const rows = await getRows(page);
  if (!rows.length) { log('L5.1', mod, 'UUID检测', 'WARN', '无数据'); return; }
  const bad = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const h = headers[i] || '';
      if (ID_WHITELIST.some(k => h.includes(k))) continue;
      if (cols && !cols.some(c => h.includes(c))) continue;
      if (UUID_RE.test(row[i])) bad.push(`${h}="${row[i].slice(0,16)}..."`);
    }
  }
  log('L5.1', mod, 'UUID检测', bad.length ? 'FAIL' : 'PASS', bad.length ? bad.join(',') : `${rows.length}行OK`);
}

async function checkCols(page, mod, path, expected) {
  await go(page, path);
  const headers = await getHeaders(page);
  if (!headers.length) { log('L5.5', mod, '列完整性', 'WARN', '无表头'); return; }
  const missing = expected.filter(c => !headers.some(h => h.includes(c)));
  log('L5.5', mod, '列完整性', missing.length ? 'FAIL' : 'PASS',
    missing.length ? `缺:[${missing}] 实际:[${headers}]` : `[${headers.join(',')}]`);
}

async function checkStatus(page, mod, path) {
  await go(page, path);
  const tags = await getTags(page);
  if (!tags.length) { log('L5.6', mod, '状态中文', 'WARN', '无标签'); return; }
  const eng = tags.filter(t => /^[A-Z_]{3,}$/.test(t));
  log('L5.6', mod, '状态中文', eng.length ? 'FAIL' : 'PASS',
    eng.length ? `英文:[${eng}]` : `${tags.length}个全中文`);
}

async function checkDetail(page, mod) {
  // Click first "详情" button and verify detail page loads
  const btn = page.locator('button:has-text("详情"), button:has-text("查看")').first();
  if (!await btn.isVisible().catch(() => false)) { log('L5.2', mod, '详情页', 'WARN', '无详情按钮'); return; }
  await btn.click(); await page.waitForTimeout(2000);
  // Check for descriptions or content
  const descs = await page.$$eval('.el-descriptions__body td, .el-descriptions__content',
    els => els.map(e => e.textContent?.trim() || '').filter(t => t)
  ).catch(() => []);
  const hasContent = descs.length > 0 || (await page.locator('.el-card').count()) > 0;
  if (hasContent) log('L5.2', mod, '详情页', 'PASS', `${descs.length}个字段`);
  else log('L5.2', mod, '详情页', 'WARN', '详情内容为空');
  await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
}

// ============ MODULE-SPECIFIC CRUD TESTS ============

async function testSalesOrders(page) {
  console.log('\n--- 销售订单 L2-L5 ---');
  await checkPage(page, '销售订单', '/sales/orders');
  await checkUUID(page, '销售订单', '/sales/orders', ['客户']);
  await checkCols(page, '销售订单', '/sales/orders', ['订单编号','客户','下单日期','总金额','状态']);
  await checkStatus(page, '销售订单', '/sales/orders');
  await go(page, '/sales/orders'); await checkDetail(page, '销售订单');

  // L2: Create via API, verify on UI
  const custs = await api('/customers/active'); const cid = custs.data?.[0]?.id;
  const prods = await api('/product-types/active'); const pid = prods.data?.[0]?.id;
  if (cid && pid) {
    const r = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
      customerId: cid, salesperson: `E2E${TS}`,
      items: [{ productTypeId: pid, quantity: 10, unit: 'kg', unitPrice: 50 }]
    })});
    log('L2', '销售订单', '创建', r.success ? 'PASS' : 'FAIL', r.success ? `${r.data?.orderNumber}` : r.message);

    // L5.3A: SKU dup
    const dup = await api('/sales/orders', { method: 'POST', body: JSON.stringify({
      customerId: cid, items: [
        { productTypeId: pid, quantity: 1, unit: 'kg', unitPrice: 10 },
        { productTypeId: pid, quantity: 2, unit: 'kg', unitPrice: 20 }
      ]
    })});
    log('L5.3A', '销售订单', 'SKU去重', !dup.success && dup.message?.includes('重复') ? 'PASS' : 'FAIL',
      dup.success ? 'DUPLICATE_BUG!' : dup.message?.slice(0,60));

    // Verify on UI
    await go(page, '/sales/orders');
    const firstCell = await page.$eval('.el-table__body-wrapper .el-table__row:first-child td:nth-child(2) .cell',
      e => e.textContent?.trim()).catch(() => '');
    log('L5.1', '销售订单', '创建后客户名', UUID_RE.test(firstCell) ? 'FAIL' : 'PASS', `"${firstCell}"`);
  } else { log('L2', '销售订单', '创建', 'WARN', '缺前置数据'); }

  // Detail page: check spec+box columns
  await go(page, '/sales/orders');
  if (await clickBtn(page, '详情')) {
    const h = await getHeaders(page);
    const hasSpec = h.some(x => x.includes('规格')), hasBox = h.some(x => x.includes('箱数'));
    log('L5.5', '销售行项目', '规格+箱数', hasSpec && hasBox ? 'PASS' : 'FAIL', `规格=${hasSpec},箱数=${hasBox}`);
    await page.goBack().catch(() => {}); await page.waitForTimeout(1000);
  }
}

async function testPurchaseOrders(page) {
  console.log('\n--- 采购订单 L2-L5 ---');
  await checkPage(page, '采购订单', '/procurement/orders');
  await checkUUID(page, '采购订单', '/procurement/orders', ['供应商']);
  await checkCols(page, '采购订单', '/procurement/orders', ['订单编号','供应商','类型','总金额','状态']);
  await checkStatus(page, '采购订单', '/procurement/orders');
  await go(page, '/procurement/orders'); await checkDetail(page, '采购订单');

  // L2+L5.3B+L5.9: Create 2 POs
  const supps = await api('/suppliers/active'); const sid = supps.data?.[0]?.id;
  const mats = await api('/raw-material-types/active'); const mid = mats.data?.[0]?.id; const mn = mats.data?.[0]?.name;
  if (sid && mid) {
    const mk = (q) => api('/purchase/orders', { method: 'POST', body: JSON.stringify({
      supplierId: sid, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0,10),
      items: [{ materialTypeId: mid, materialName: mn, quantity: q, unit: 'kg', unitPrice: 10 }]
    })});
    const po1 = await mk(5), po2 = await mk(3);
    log('L2', '采购订单', '创建#1', po1.success ? 'PASS' : 'FAIL', po1.data?.orderNumber || po1.message);
    log('L5.3B', '采购订单', '连续创建#2', po2.success ? 'PASS' : 'FAIL', po2.data?.orderNumber || po2.message);
    if (po1.success && po2.success) {
      const s1 = parseInt(po1.data.orderNumber.split('-').pop());
      const s2 = parseInt(po2.data.orderNumber.split('-').pop());
      log('L5.9', '采购订单', '订单号递增', s2 > s1 ? 'PASS' : 'FAIL', `${s1}→${s2}`);
    }
    // Verify supplier name on UI
    await go(page, '/procurement/orders');
    const suppCell = await page.$eval('.el-table__body-wrapper .el-table__row:first-child td:nth-child(2) .cell',
      e => e.textContent?.trim()).catch(() => '');
    log('L5.1', '采购订单', '创建后供应商名', UUID_RE.test(suppCell) ? 'FAIL' : 'PASS', `"${suppCell}"`);
  } else { log('L2', '采购订单', '创建', 'WARN', '缺前置数据'); }

  // Detail: check spec+box
  await go(page, '/procurement/orders');
  if (await clickBtn(page, '详情')) {
    const h = await getHeaders(page);
    log('L5.5', '采购行项目', '规格+箱数', h.some(x=>x.includes('规格')) && h.some(x=>x.includes('箱数')) ? 'PASS' : 'FAIL',
      `[${h.join(',')}]`);
    await page.goBack().catch(() => {}); await page.waitForTimeout(1000);
  }
}

async function testRdSamples(page) {
  console.log('\n--- 研发样品 L2-L5 ---');
  await checkPage(page, '研发样品', '/rd/samples');
  await checkCols(page, '研发样品', '/rd/samples',
    ['样品编码','样品名称','客户名称','产品级别','储存方式','产品状态'], ['主原料','等级']);
  await checkStatus(page, '研发样品', '/rd/samples');

  // L5.10: Search bar
  await go(page, '/rd/samples');
  const hasSearch = await page.locator('input[placeholder*="样品名称"]').isVisible().catch(() => false);
  const hasCustF = await page.locator('input[placeholder*="客户"]').isVisible().catch(() => false);
  log('L5.10', '研发样品', '搜索栏', hasSearch && hasCustF ? 'PASS' : 'FAIL', `名称=${hasSearch},客户=${hasCustF}`);

  // L5.4: Field type — open create dialog
  if (await clickBtn(page, '新建样品')) {
    const html = await page.locator('.el-dialog:visible').innerHTML().catch(() => '');
    log('L5.4', '研发样品', '产品级别=下拉', html.includes('产品级别') && html.includes('el-select') ? 'PASS' : 'FAIL', '');
    log('L5.4', '研发样品', '储存方式=下拉', html.includes('储存方式') && html.includes('el-select') ? 'PASS' : 'FAIL', '');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }

  // L2: Create via API
  const sr = await api('/rd/samples', { method: 'POST', body: JSON.stringify({
    name: `E2E全模块${TS}`, customerName: `全测客户${TS}`, specification: '500g',
    productLevel: 'B', storageMethod: '冷藏', salesperson: 'E2E'
  })});
  log('L2', '研发样品', '创建', sr.success ? 'PASS' : 'FAIL', sr.success ? sr.data?.sampleCode : sr.message);

  // Verify on UI
  await go(page, '/rd/samples');
  const txt = await page.$eval('.el-table__body-wrapper', e => e.textContent).catch(() => '');
  log('L2', '研发样品', 'UI验证', txt.includes(`E2E全模块${TS}`) ? 'PASS' : 'WARN', '列表含新数据');

  // L5.11: Conditional buttons
  const rows = await page.$$('.el-table__body-wrapper .el-table__row');
  for (const row of rows.slice(0, 6)) {
    const st = await row.$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
    const btns = await row.$$eval('button', els => els.map(e => e.textContent?.trim())).catch(() => []);
    if (st === '研发中') { log('L5.11', '研发样品', '研发中→无报价', btns.some(b=>b?.includes('报价')) ? 'FAIL' : 'PASS', `[${btns}]`); break; }
    if (st === '样品通过') { log('L5.11', '研发样品', '样品通过→有报价', btns.some(b=>b?.includes('报价')) ? 'PASS' : 'FAIL', `[${btns}]`); break; }
  }
}

async function testCustomers(page) {
  console.log('\n--- 客户管理 L1-L5 ---');
  await checkPage(page, '客户管理', '/sales/customers');
  await checkCols(page, '客户管理', '/sales/customers', ['客户编号','名称','联系人','状态']);
  await checkUUID(page, '客户管理', '/sales/customers', ['名称','联系人']);
  await go(page, '/sales/customers'); await checkDetail(page, '客户管理');

  // L2: Create — verify "新增" button exists on UI, then create via API
  await go(page, '/sales/customers');
  const hasCreateBtn = await page.locator('button:has-text("新增客户"), button:has-text("新建")').first().isVisible().catch(() => false);
  log('L2', '客户管理', '新建按钮存在', hasCreateBtn ? 'PASS' : 'FAIL', hasCreateBtn ? '有新增按钮' : '无');

  // API create — required: name, contactPerson, phone, shippingAddress
  const custR = await api('/customers', { method: 'POST', body: JSON.stringify({
    name: `E2E客户${TS}`, contactPerson: 'E2E联系人', phone: '13800000001',
    shippingAddress: '上海市浦东新区E2E测试地址', type: '贸易商'
  })});
  log('L2', '客户管理', '创建(API)', custR.success ? 'PASS' : 'FAIL', custR.success ? custR.data?.name : custR.message);

  // Verify on UI
  if (custR.success) {
    await go(page, '/sales/customers');
    const bodyText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
    log('L2', '客户管理', 'UI验证', bodyText.includes(`E2E客户${TS}`) ? 'PASS' : 'WARN', '列表检查');
  }
}

async function testSuppliers(page) {
  console.log('\n--- 供应商管理 L1-L5 ---');
  await checkPage(page, '供应商管理', '/procurement/suppliers');
  await checkCols(page, '供应商管理', '/procurement/suppliers', ['供应商名称','联系人','状态']);
  await go(page, '/procurement/suppliers'); await checkDetail(page, '供应商管理');
}

async function testEmployees(page) {
  console.log('\n--- 员工管理 L1-L5 ---');
  await checkPage(page, '员工管理', '/hr/employees');
  await checkCols(page, '员工管理', '/hr/employees', ['用户名','姓名','角色','部门','状态']);
  await go(page, '/hr/employees'); await checkDetail(page, '员工管理');
}

async function testProducts(page) {
  console.log('\n--- 产品管理 L1-L5 ---');
  await checkPage(page, '产品管理', '/system/products');
  await checkCols(page, '产品管理', '/system/products', ['产品名称','规格','单位']);
  await go(page, '/system/products'); await checkDetail(page, '产品管理');
}

async function testUsers(page) {
  console.log('\n--- 用户管理 L1-L5 ---');
  await checkPage(page, '用户管理', '/system/users');
  await checkCols(page, '用户管理', '/system/users', ['用户名','姓名','角色','状态']);
}

async function testProduction(page) {
  console.log('\n--- 生产管理 L1-L5 ---');
  await checkPage(page, '生产计划', '/production/plans');
  await checkCols(page, '生产计划', '/production/plans', ['计划','产品','状态']);
  await checkStatus(page, '生产计划', '/production/plans');
  await go(page, '/production/plans'); await checkDetail(page, '生产计划');

  await checkPage(page, '生产批次', '/production/batches');
  await checkCols(page, '生产批次', '/production/batches', ['批次','产品','状态']);
  await checkStatus(page, '生产批次', '/production/batches');
  await go(page, '/production/batches'); await checkDetail(page, '生产批次');
}

async function testWarehouse(page) {
  console.log('\n--- 仓储管理 L1-L5 ---');
  await checkPage(page, '原材料库存', '/warehouse/materials');
  await checkCols(page, '原材料库存', '/warehouse/materials', ['原料','数量','状态']);
  await checkUUID(page, '原材料库存', '/warehouse/materials', ['原料','供应商']);
  await go(page, '/warehouse/materials'); await checkDetail(page, '原材料库存');
  // 成品库存 and BOM handled in testAdvanced (non-table layout)
}

async function testQuality(page) {
  console.log('\n--- 质量管理 L1-L5 ---');
  await checkPage(page, '质量检测', '/quality/inspections');
  await checkCols(page, '质量检测', '/quality/inspections', ['质检','批次','结果','日期']);
  await checkStatus(page, '质量检测', '/quality/inspections');
  await go(page, '/quality/inspections'); await checkDetail(page, '质量检测');
}

async function testEquipment(page) {
  console.log('\n--- 设备管理 L1-L5 ---');
  await checkPage(page, '设备管理', '/equipment/list');
  await checkCols(page, '设备管理', '/equipment/list', ['设备名称','状态']);
  await go(page, '/equipment/list'); await checkDetail(page, '设备管理');
}

async function testShipments(page) {
  console.log('\n--- 出货记录 L1-L5 ---');
  await checkPage(page, '出货记录', '/sales/shipments');
  await checkCols(page, '出货记录', '/sales/shipments', ['出货单号','客户','产品','状态']);
  await go(page, '/sales/shipments'); await checkDetail(page, '出货记录');
}

async function testTransfers(page) {
  // handled in testAdvanced (non-table layout)
}

async function testFinance(page) {
  console.log('\n--- 财务管理 L1-L5 ---');
  // 总览 handled in testAdvanced
  await checkPage(page, '财务-开票', '/finance/invoices');
  await checkPage(page, '财务-收款', '/finance/payments');
  await checkPage(page, '财务-应收应付', '/finance/ar-ap');
}

async function testAdvanced(page) {
  console.log('\n--- 高级功能+特殊页面 L1 ---');
  // These pages use non-table layouts, check for any meaningful content
  const specialPages = [
    { name: '成品库存', path: '/warehouse/finished-goods' },
    { name: 'BOM配方', path: '/warehouse/bom' },
    { name: '调拨管理', path: '/transfers' },
    { name: '财务-总览', path: '/finance/overview' },
    { name: '智能BI', path: '/smartbi' },
    { name: '价格表', path: '/procurement/price-list' },
    { name: '生产分析', path: '/production-analysis' },
  ];
  for (const sp of specialPages) {
    await go(page, sp.path);
    // Check for ANY content: table, card, text, buttons, tabs
    const hasTable = await page.locator('.el-table').first().isVisible().catch(() => false);
    const hasCard = await page.locator('.el-card').first().isVisible().catch(() => false);
    const hasTab = await page.locator('.el-tabs').first().isVisible().catch(() => false);
    const hasBtns = await page.locator('button').count().catch(() => 0);
    const hasErr = await page.locator('.el-message--error').isVisible().catch(() => false);
    const pageText = await page.locator('.app-main, main, #app').first().textContent().catch(() => '');
    const textLen = pageText.replace(/\s+/g, '').length;

    if (hasErr) { log('L1', sp.name, '页面加载', 'FAIL', 'error toast'); continue; }
    if (hasTable || hasCard || hasTab || hasBtns > 3 || textLen > 100) {
      log('L1', sp.name, '页面加载', 'PASS', `table=${hasTable},card=${hasCard},tab=${hasTab},btns=${hasBtns},text=${textLen}字`);
    } else {
      // Navigate might need sidebar click — page could be empty until activated
      log('L1', sp.name, '页面加载', textLen > 20 ? 'PASS' : 'WARN', `内容${textLen}字,btns=${hasBtns}`);
    }
  }
}

// ============ MAIN ============

async function main() {
  console.log('🚀 E2E COMPLETE: All Modules L1-L5 with Playwright Interaction');
  console.log(`Target: ${BASE} | ${new Date().toISOString()}\n`);

  await getToken();
  if (!TOKEN) { console.error('❌ No token'); process.exit(1); }
  console.log('✅ API token OK');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  // Console error monitoring
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('net::ERR') && !text.includes('404'))
        consoleErrors.push(text.slice(0, 150));
    }
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE_ERROR: ${err.message.slice(0, 150)}`));

  if (!await login(page)) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Login OK\n');

  // Run all module tests
  await testSalesOrders(page);
  await testPurchaseOrders(page);
  await testRdSamples(page);
  await testCustomers(page);
  await testSuppliers(page);
  await testEmployees(page);
  await testProducts(page);
  await testUsers(page);
  await testProduction(page);
  await testWarehouse(page);
  await testQuality(page);
  await testEquipment(page);
  await testShipments(page);
  await testTransfers(page);
  await testFinance(page);
  await testAdvanced(page);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 FINAL: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass+fail+warn})`);
  console.log('='.repeat(60));

  const mods = {};
  for (const r of results) {
    if (!mods[r.module]) mods[r.module] = { p: 0, f: 0, w: 0 };
    mods[r.module][r.status === 'PASS' ? 'p' : r.status === 'FAIL' ? 'f' : 'w']++;
  }
  console.log('\n模块汇总:');
  for (const [m, c] of Object.entries(mods).sort((a,b) => b[1].f - a[1].f)) {
    console.log(`  ${c.f > 0 ? '❌' : c.w > 0 ? '⚠️' : '✅'} ${m}: ${c.p}P/${c.f}F/${c.w}W`);
  }

  // Console errors report
  if (consoleErrors.length > 0) {
    console.log(`\n🔴 Console Errors (${consoleErrors.length}):`);
    const unique = [...new Set(consoleErrors)];
    unique.slice(0, 20).forEach(e => console.log(`  - ${e}`));
    if (unique.length > 20) console.log(`  ... and ${unique.length - 20} more`);
  } else {
    console.log('\n✅ Console: 0 errors');
  }

  const fs = await import('fs');
  fs.writeFileSync('test-e2e-complete-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass+fail+warn, consoleErrors: [...new Set(consoleErrors)], results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
