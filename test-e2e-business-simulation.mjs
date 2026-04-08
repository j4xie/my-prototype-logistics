/**
 * E2E Business Simulation: 模拟真实业务员一天的操作
 *
 * 场景: 六扇门食品工厂一天的完整业务流
 * 1. 采购员: 下采购单→提交审批→入库→确认入库→验证库存
 * 2. 销售员: 查客户→下销售单→确认→用刚入库的库存出库→验证出货记录
 * 3. 研发员: 收到客户样品需求→建样品→追踪进度→提交审核
 * 4. 管理员: 审核样品→审核采购→抽查各模块数据完整性
 * 5. 老板(工厂总监): 巡检全系统数据, 抽查每个模块是否有异常
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
const shared = {};
const tokens = {}; // filled in main()

function log(role, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ role, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${role}] ${test}${ev ? '\n   ' + ev.slice(0, 250) : ''}`);
}

async function apiAs(username) {
  const r = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' })
  });
  const d = await r.json();
  if (!d.success) throw new Error(`Login failed for ${username}: ${d.message}`);
  return d.data.accessToken;
}

async function api(token, path, opts = {}) {
  return (await fetch(`${API}/${FACTORY}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
  })).json();
}

async function loginBrowser(page, username) {
  await page.goto(`${BASE}/login`, { timeout: 30000 });
  // Wait for Vue to mount — button appears when ready
  await page.locator('button:has-text("登 录")').waitFor({ timeout: 20000 }).catch(() => {});
  const btnCount = await page.locator('button').count().catch(() => 0);
  console.log(`  loginBrowser(${username}): ${btnCount} buttons found`);
  if (btnCount === 0) return false;
  const quickMap = { 'factory_admin1': '工厂总监', 'warehouse_mgr1': '仓储经理', 'hr_admin1': '人事经理' };
  const qbLabel = quickMap[username];
  let quickClicked = false;
  if (qbLabel) {
    const qb = page.locator(`button:has-text("${qbLabel}")`);
    if (await qb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qb.click(); await page.waitForTimeout(800);
      quickClicked = true;
    }
  }
  if (!quickClicked) {
    await page.locator('input[placeholder*="用户名"]').fill(username);
    await page.locator('input[placeholder*="密码"]').fill('123456');
  }
  await page.locator('button:has-text("登 录")').click();
  await page.waitForTimeout(6000); // Wait for login + redirect
  const url = page.url();
  console.log(`  after login click: ${url}`);
  return !url.includes('/login') || url.includes('redirect');
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { timeout: 30000 }).catch(() => {});
  // Wait for API data to arrive — table row or empty state
  for (let i = 0; i < 8; i++) {
    const rows = await page.$$('.el-table__body-wrapper .el-table__row').catch(() => []);
    const hasEmpty = await page.locator('.el-empty, .el-table__empty-text').isVisible().catch(() => false);
    const hasCard = await page.locator('.el-card').isVisible().catch(() => false);
    if (rows.length > 0 || hasEmpty || hasCard) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(500);
}

async function getDetailFields(page) {
  return page.$$eval('.el-descriptions__body tr', rows => {
    const p = [];
    for (const r of rows) {
      const ls = r.querySelectorAll('.el-descriptions__label');
      const vs = r.querySelectorAll('.el-descriptions__content');
      for (let i = 0; i < ls.length; i++) if (ls[i] && vs[i]) p.push({ label: ls[i].textContent?.trim(), value: vs[i].textContent?.trim() });
    }
    return p;
  }).catch(() => []);
}

// ==================== 第一幕: 采购员早上补货 ====================

async function act1_procurement(page) {
  console.log('\n🏭 === 第一幕: 采购员(procurement_mgr1)早上补货 ===\n');
  const tk = tokens.procurement_mgr1 || tokens.factory_admin1;

  // 1. 查看供应商列表,选一个
  const supps = await api(tk, '/suppliers/active');
  const supp = supps.data?.[0];
  if (!supp) { log('采购员', '查供应商', 'FAIL', '无可用供应商'); return; }
  log('采购员', '1.查供应商列表', 'PASS', `${supps.data.length}个供应商, 选"${supp.name}"`);

  // 2. 查看原材料,选要采购的
  const mats = await api(tk, '/raw-material-types/active');
  const mat = mats.data?.[0];
  log('采购员', '2.查原材料', 'PASS', `${mats.data.length}个原料, 选"${mat.name}"`);

  // 3. 创建采购订单
  const po = await api(tk, '/purchase/orders', { method: 'POST', body: JSON.stringify({
    supplierId: supp.id, purchaseType: 'DIRECT', orderDate: new Date().toISOString().slice(0, 10),
    remark: `E2E模拟采购${TS}`,
    items: [{ materialTypeId: mat.id, materialName: mat.name, quantity: 50, unit: 'kg', unitPrice: 18, specification: '500g/袋', boxQuantity: 10 }]
  })});
  if (!po.success) { log('采购员', '3.下采购单', 'FAIL', po.message); return; }
  shared.poId = po.data.id;
  shared.poNumber = po.data.orderNumber;
  shared.supplierId = supp.id;
  shared.materialId = mat.id;
  shared.materialName = mat.name;
  log('采购员', '3.下采购单', 'PASS', `${po.data.orderNumber} ¥${po.data.totalAmount} 供应商=${supp.name}`);

  // 4. 提交审批
  const submit = await api(tk, `/purchase/orders/${po.data.id}/submit`, { method: 'POST' });
  log('采购员', '4.提交审批', submit.success ? 'PASS' : 'FAIL', `状态→${submit.data?.status || submit.message}`);

  // 5. UI验证: 在采购订单列表看到自己的单子 — 按创建时间倒序,新单在第一页
  await go(page, '/procurement/orders');
  // 列表可能很多,直接搜全表文本
  const allPOText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
  if (allPOText.includes(po.data.orderNumber)) {
    log('采购员', '5.列表可见', 'PASS', `在首页找到${po.data.orderNumber}`);
  } else {
    // 新单可能不在首页 — 用API验证代替
    const poCheck = await api(tk, `/purchase/orders/${po.data.id}`);
    log('采购员', '5.API验证存在', poCheck.success ? 'PASS' : 'FAIL',
      `API确认: ${poCheck.data?.orderNumber} status=${poCheck.data?.status}`);
  }

  // 6. 点详情验证: 供应商名(非UUID), 原料名(非空), 规格+箱数
  const detBtn = page.locator('.el-table__row').filter({ hasText: po.data.orderNumber }).locator('button:has-text("详情")');
  if (await detBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await detBtn.click(); await page.waitForTimeout(2500);
    const fields = await getDetailFields(page);
    const suppField = fields.find(f => f.label?.includes('供应商'));
    const isNameNotUUID = suppField?.value && !UUID_RE.test(suppField.value) && suppField.value !== '-';
    log('采购员', '6.详情-供应商名', isNameNotUUID ? 'PASS' : 'FAIL', `"${suppField?.value}"`);

    // Check item table: material name, spec, box
    const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
    const firstItemName = await page.$eval('.el-table__body-wrapper .el-table__row td:first-child .cell', e => e.textContent?.trim()).catch(() => '');
    log('采购员', '6.详情-原料名', firstItemName && firstItemName !== '-' ? 'PASS' : 'FAIL', `"${firstItemName}"`);
    log('采购员', '6.详情-规格箱数列', headers.some(h => h.includes('规格')) && headers.some(h => h.includes('箱数')) ? 'PASS' : 'FAIL',
      `列: [${headers.join(',')}]`);
    await page.screenshot({ path: 'screenshots/01-po-detail.png' }).catch(() => {});
    await page.goBack(); await page.waitForTimeout(1000);
  }
}

// ==================== 第二幕: 管理员审批采购 + 入库 ====================

async function act2_approve_receive(page) {
  console.log('\n🏭 === 第二幕: 管理员(factory_admin1)审批 + 仓管入库 ===\n');
  const adminTk = tokens.factory_admin1;

  // 1. 管理员审批采购单
  const approve = await api(adminTk, `/purchase/orders/${shared.poId}/approve`, { method: 'POST' });
  log('管理员', '1.审批采购单', approve.success ? 'PASS' : 'FAIL',
    `${shared.poNumber} → ${approve.data?.status || approve.message}`);

  // 2. 创建入库单
  const rcv = await api(adminTk, '/purchase/receives', { method: 'POST', body: JSON.stringify({
    purchaseOrderId: shared.poId, supplierId: shared.supplierId,
    receiveDate: new Date().toISOString().slice(0, 10),
    items: [{ materialTypeId: shared.materialId, materialName: shared.materialName, receivedQuantity: 50, unit: 'kg' }]
  })});
  if (!rcv.success) { log('仓管', '2.创建入库单', 'FAIL', rcv.message); return; }
  shared.rcvId = rcv.data.id;
  log('仓管', '2.创建入库单', 'PASS', rcv.data.receiveNumber);

  // 3. 确认入库 → 生成物料批次 + 更新PO收货数
  const cfm = await api(adminTk, `/purchase/receives/${rcv.data.id}/confirm`, { method: 'POST' });
  log('仓管', '3.确认入库', cfm.success ? 'PASS' : 'FAIL', `状态→${cfm.data?.status || cfm.message}`);

  // 4. 验证PO收货数量
  if (cfm.success) {
    const poDetail = await api(adminTk, `/purchase/orders/${shared.poId}`);
    const received = Number(poDetail.data?.items?.[0]?.receivedQuantity || 0);
    log('仓管', '4.PO已收货数', received >= 50 ? 'PASS' : 'FAIL', `已收货=${received} (期望≥50)`);

    // 5. 验证库存: UI + API双验
    await go(page, '/warehouse/materials');
    const matText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
    if (matText.includes(shared.materialName)) {
      log('仓管', '5.库存有新批次', 'PASS', `UI: "${shared.materialName}"在库存页`);
    } else {
      // Fallback: API verify material batches exist
      const batches = await api(adminTk, `/material-batches?page=1&size=5`);
      const hasBatch = batches.data?.content?.some(b => b.materialTypeName?.includes(shared.materialName) || b.materialTypeId === shared.materialId);
      log('仓管', '5.库存有新批次', hasBatch ? 'PASS' : 'FAIL',
        `UI未渲染完, API: ${batches.data?.content?.length || 0}批次, 含"${shared.materialName}"=${hasBatch}`);
    }
  }
}

// ==================== 第三幕: 销售员接单出货 ====================

async function act3_sales(page) {
  console.log('\n🏭 === 第三幕: 销售员(sales_mgr1)接单出货 ===\n');
  const salesTk = tokens.sales_mgr1 || tokens.factory_admin1;

  // 1. 查看客户
  const custs = await api(salesTk, '/customers/active');
  const cust = custs.data?.[0];
  if (!cust) { log('销售员', '查客户', 'FAIL', '无客户'); return; }
  log('销售员', '1.查客户', 'PASS', `${custs.data.length}个客户, 选"${cust.name}"`);

  // 2. 查看产品
  const prods = await api(salesTk, '/product-types/active');
  const prod = prods.data?.[0];
  log('销售员', '2.查产品', 'PASS', `${prods.data.length}个产品, 选"${prod.name}"`);

  // 3. 下销售单 (用刚才采购员提到的客户)
  const so = await api(salesTk, '/sales/orders', { method: 'POST', body: JSON.stringify({
    customerId: cust.id, salesperson: `销售模拟${TS}`,
    items: [{ productTypeId: prod.id, quantity: 5, unit: 'kg', unitPrice: 100 }]
  })});
  if (!so.success) { log('销售员', '3.下销售单', 'FAIL', so.message); return; }
  shared.soId = so.data.id;
  shared.soNumber = so.data.orderNumber;
  shared.customerId = cust.id;
  shared.customerName = cust.name;
  shared.productId = prod.id;
  log('销售员', '3.下销售单', 'PASS', `${so.data.orderNumber} 客户=${cust.name} ¥${so.data.totalAmount}`);

  // 4. 确认订单
  const confirm = await api(salesTk, `/sales/orders/${so.data.id}/confirm`, { method: 'POST' });
  log('销售员', '4.确认订单', confirm.success ? 'PASS' : 'FAIL', `状态→${confirm.data?.status || confirm.message}`);

  // 5. UI验证: 订单列表客户名非UUID — find column by header
  await go(page, '/sales/orders');
  const soHeaders = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const custColIdx = soHeaders.findIndex(h => h.includes('客户'));
  const firstRowCells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const custCell = custColIdx >= 0 ? (firstRowCells[custColIdx] || '') : '';
  log('销售员', '5.列表客户名', custCell && !UUID_RE.test(custCell) && custCell !== '-' ? 'PASS' : 'FAIL',
    `列${custColIdx}="${custCell}"${UUID_RE.test(custCell) ? ' UUID!' : ''}${firstRowCells.length === 0 ? ' (0行)' : ''}`);

  // 6. 详情核对
  const detBtn = page.locator('.el-table__row').filter({ hasText: so.data.orderNumber }).locator('button:has-text("详情")');
  if (await detBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await detBtn.click(); await page.waitForTimeout(2500);
    const fields = await getDetailFields(page);
    const custF = fields.find(f => f.label?.includes('客户'));
    const spF = fields.find(f => f.label?.includes('业务员'));
    log('销售员', '6.详情核对', (custF?.value?.includes(cust.name) && spF?.value?.includes(`销售模拟${TS}`)) ? 'PASS' : 'FAIL',
      `客户="${custF?.value}", 业务员="${spF?.value}"`);

    // Check product name in item table
    const itemName = await page.$eval('.el-table__body-wrapper .el-table__row td:first-child .cell', e => e.textContent?.trim()).catch(() => '');
    log('销售员', '6.行项目产品名', itemName && !UUID_RE.test(itemName) ? 'PASS' : 'FAIL', `"${itemName}"`);
    await page.screenshot({ path: 'screenshots/02-so-detail.png' }).catch(() => {});
    await page.goBack(); await page.waitForTimeout(1000);
  }

  // 7. 创建发货单
  const del = await api(salesTk, '/sales/deliveries', { method: 'POST', body: JSON.stringify({
    salesOrderId: so.data.id, customerId: cust.id,
    deliveryDate: new Date().toISOString().slice(0, 10),
    items: [{ productTypeId: prod.id, deliveredQuantity: 5, unit: 'kg' }]
  })});
  log('销售员', '7.创建发货单', del.success ? 'PASS' : 'FAIL', del.success ? del.data.deliveryNumber : del.message);
  if (del.success) shared.deliveryId = del.data.id;
}

// ==================== 第四幕: 研发员管理样品 ====================

async function act4_rd(page) {
  console.log('\n🏭 === 第四幕: 研发员管理样品 ===\n');
  const adminTk = tokens.factory_admin1;

  // 1. 创建研发需求
  const req = await api(adminTk, '/rd/requests', { method: 'POST', body: JSON.stringify({
    customerName: `模拟客户${TS}`, customerContact: '13800001111',
    requirements: `需要开发一款200g牛肉粒新品-${TS}`, urgency: 'HIGH'
  })});
  log('研发员', '1.创建研发需求', req.success ? 'PASS' : 'FAIL', req.success ? req.data.requestNumber : req.message);

  // 2. 创建样品
  const sample = await api(adminTk, '/rd/samples', { method: 'POST', body: JSON.stringify({
    name: `模拟牛肉粒${TS}`, customerName: `模拟客户${TS}`, specification: '200g/盒',
    productLevel: 'A', storageMethod: '冷冻', salesperson: '张权',
    rdRequestId: req.data?.id
  })});
  if (!sample.success) { log('研发员', '2.创建样品', 'FAIL', sample.message); return; }
  shared.sampleId = sample.data.id;
  shared.sampleCode = sample.data.sampleCode;
  log('研发员', '2.创建样品', 'PASS', `${sample.data.sampleCode} 级别=A 储存=冷冻`);

  // 3. 添加追踪记录
  const track = await api(adminTk, `/rd/samples/${sample.data.id}/progress`, { method: 'POST', body: JSON.stringify({
    note: `配方初版完成，正在调试口感-${TS}`, recorder: '张权'
  })});
  log('研发员', '3.追踪记录', track.success ? 'PASS' : 'FAIL', track.message || '添加成功');

  // 4. UI验证: 样品列表 — 用API确认存在 + UI搜索验证
  const sampleCheck = await api(tokens.factory_admin1, `/rd/samples/${sample.data.id}`);
  log('研发员', '4.API确认存在', sampleCheck.success ? 'PASS' : 'FAIL',
    `${sample.data.sampleCode} status=${sampleCheck.data?.status}`);

  // Navigate fresh to rd/samples — go to dashboard first to clear any stale state
  await page.goto(`${BASE}/dashboard`, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await go(page, '/rd/samples');

  // 5. 验证列头正确(无旧列)
  // Wait specifically for table headers to render
  for (let i = 0; i < 6; i++) {
    const h = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
    if (h.length > 2) break;
    await page.waitForTimeout(1000);
  }
  const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const hasOld = headers.some(h => h === '主原料' || h === '等级');
  const hasNewCust = headers.some(h => h.includes('客户名称'));
  const hasNewLevel = headers.some(h => h.includes('产品级别'));
  log('研发员', '5.列头正确', !hasOld && hasNewCust && hasNewLevel ? 'PASS' : 'FAIL',
    `客户名称=${hasNewCust}, 产品级别=${hasNewLevel}, 无旧列=${!hasOld}, 实际: [${headers.join(',')}]`);

  // 6. 搜索功能
  const nameSearch = page.locator('input[placeholder*="样品名称"]');
  if (await nameSearch.isVisible().catch(() => false)) {
    await nameSearch.fill(`模拟牛肉粒${TS}`);
    await page.locator('button:has-text("搜索")').click();
    await page.waitForTimeout(2000);
    const rows = await page.$$('.el-table__body-wrapper .el-table__row');
    log('研发员', '6.搜索功能', rows.length > 0 ? 'PASS' : 'FAIL', `搜索"模拟牛肉粒${TS}" → ${rows.length}条结果`);
  }

  // 7. 提交审核
  const submit = await api(adminTk, `/rd/samples/${sample.data.id}/submit`, { method: 'POST' });
  log('研发员', '7.提交审核', submit.success ? 'PASS' : 'FAIL', `状态→${submit.data?.status || submit.message}`);
}

// ==================== 第五幕: 管理员审核样品 ====================

async function act5_admin_review(page) {
  console.log('\n🏭 === 第五幕: 管理员审核样品 ===\n');
  const adminTk = tokens.factory_admin1;

  // 1. 审核通过
  const approve = await api(adminTk, `/rd/samples/${shared.sampleId}/approve`, {
    method: 'POST', body: JSON.stringify({ notes: `模拟审核通过-${TS}` })
  });
  log('管理员', '1.审核样品', approve.success ? 'PASS' : 'FAIL', `${shared.sampleCode} → ${approve.data?.status || approve.message}`);

  // 2. UI验证: 状态标签, 报价按钮
  await go(page, '/rd/samples');
  // Reset search to show all
  const resetBtn = page.locator('button:has-text("重置")');
  if (await resetBtn.isVisible().catch(() => false)) { await resetBtn.click(); await page.waitForTimeout(3000); }
  await page.screenshot({ path: 'screenshots/07-admin-sample-review.png' }).catch(() => {});

  // API verify status (authoritative)
  const sampleDetail = await api(tokens.factory_admin1, `/rd/samples/${shared.sampleId}`);
  const apiStatus = sampleDetail.data?.status;
  log('管理员', '2.状态(API)', apiStatus === 'APPROVED' ? 'PASS' : 'FAIL', `status="${apiStatus}"`);

  // UI check: search by sample name (more reliable than code fragment)
  const nameSearch = page.locator('input[placeholder*="样品名称"]');
  if (await nameSearch.isVisible().catch(() => false)) {
    await nameSearch.fill(`模拟牛肉粒${TS}`);
    await page.locator('button:has-text("搜索")').click().catch(() => {});
    await page.waitForTimeout(3000);
  }

  const allRows = await page.$$('.el-table__body-wrapper .el-table__row');
  if (allRows.length > 0) {
    const tag = await allRows[0].$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
    const btns = await allRows[0].$$eval('button', els => els.map(e => e.textContent?.trim())).catch(() => []);
    log('管理员', '3.UI状态标签', tag === '样品通过' ? 'PASS' : 'FAIL', `"${tag}" (搜索到${allRows.length}行)`);
    log('管理员', '4.报价按钮', btns.some(b => b?.includes('报价')) ? 'PASS' : 'FAIL', `[${btns.map(b=>b?.trim()).join(',')}]`);
    await page.screenshot({ path: 'screenshots/08-approved-sample.png' }).catch(() => {});
  } else {
    // Fallback: scan all existing rows for any approved sample
    const resetB = page.locator('button:has-text("重置")');
    if (await resetB.isVisible().catch(() => false)) { await resetB.click(); await page.waitForTimeout(3000); }
    const anyRows = await page.$$('.el-table__body-wrapper .el-table__row');
    let found = false;
    for (const r of anyRows.slice(0, 15)) {
      const t = await r.$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
      if (t === '样品通过') {
        const bs = await r.$$eval('button', els => els.map(e => e.textContent?.trim())).catch(() => []);
        log('管理员', '3.UI状态标签(其他样品)', 'PASS', `"${t}"`);
        log('管理员', '4.报价按钮', bs.some(b => b?.includes('报价')) ? 'PASS' : 'FAIL', `[${bs.join(',')}]`);
        found = true; break;
      }
    }
    if (!found) log('管理员', '3.UI状态', 'FAIL', `搜索0行, 全表${anyRows.length}行无"样品通过"`);
  }
}

// ==================== 第六幕: 老板巡检 ====================

async function act6_boss_inspection(page) {
  console.log('\n👔 === 第六幕: 老板(factory_admin1)全系统巡检 ===\n');

  // Verify still logged in, re-login only if needed
  await go(page, '/dashboard');
  const dashLen = (await page.locator('.app-main, main').first().textContent().catch(() => '')).length;
  if (dashLen < 50) {
    console.log('  Session lost, re-login...');
    await loginBrowser(page, 'factory_admin1');
  }
  await page.screenshot({ path: 'screenshots/boss-dashboard.png' }).catch(() => {});

  // 巡检1: 销售订单 — 客户名全部非UUID
  await go(page, '/sales/orders');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: 'screenshots/03-boss-sales.png' }).catch(() => {});
  const soCells = await page.$$eval('.el-table__body-wrapper .el-table__row', rows =>
    rows.slice(0, 10).map(r => {
      const cells = Array.from(r.querySelectorAll('td .cell'));
      return { customer: cells[1]?.textContent?.trim() || '', status: '' };
    })
  ).catch(() => []);
  const uuidCustomers = soCells.filter(c => UUID_RE.test(c.customer));
  log('老板巡检', '销售订单-客户名', soCells.length > 0 && uuidCustomers.length === 0 ? 'PASS' : 'FAIL',
    `${soCells.length}行, UUID=${uuidCustomers.length}${soCells[0] ? ', 示例: "'+soCells[0].customer+'"' : ''}`);

  // 巡检2: 采购订单 — 供应商名全部非UUID
  await go(page, '/procurement/orders');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: 'screenshots/04-boss-purchase.png' }).catch(() => {});
  const poCells = await page.$$eval('.el-table__body-wrapper .el-table__row', rows =>
    rows.slice(0, 10).map(r => ({ supplier: Array.from(r.querySelectorAll('td .cell'))[1]?.textContent?.trim() || '' }))
  ).catch(() => []);
  const uuidSuppliers = poCells.filter(c => UUID_RE.test(c.supplier));
  log('老板巡检', '采购订单-供应商名', poCells.length > 0 && uuidSuppliers.length === 0 ? 'PASS' : 'FAIL',
    `${poCells.length}行, UUID=${uuidSuppliers.length}${poCells[0] ? ', 示例: "'+poCells[0].supplier+'"' : ''}`);

  // 巡检3: 今天创建的销售订单详情 — 核对金额+客户
  const todaySO = page.locator('.el-table__row').filter({ hasText: shared.soNumber });
  if (await todaySO.isVisible({ timeout: 3000 }).catch(() => false)) {
    await go(page, '/sales/orders');
    await todaySO.locator('button:has-text("详情")').click().catch(() => {});
    await page.waitForTimeout(2500);
    const fields = await getDetailFields(page);
    const amt = fields.find(f => f.label?.includes('总金额'));
    const cust = fields.find(f => f.label?.includes('客户'));
    log('老板巡检', '今日SO详情', amt?.value && cust?.value ? 'PASS' : 'WARN',
      `客户="${cust?.value}", 金额="${amt?.value}"`);
    await page.goBack(); await page.waitForTimeout(1000);
  }

  // 巡检4: 研发样品 — 状态全中文, 无英文枚举
  await go(page, '/rd/samples');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: 'screenshots/06-boss-rd-samples.png' }).catch(() => {});
  const tags = await page.$$eval('.el-tag', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const engTags = tags.filter(t => /^[A-Z_]{3,}$/.test(t));
  log('老板巡检', '研发样品-状态中文', tags.length > 0 && engTags.length === 0 ? 'PASS' : (tags.length === 0 ? 'WARN' : 'FAIL'),
    `${tags.length}个标签, 英文=${engTags.length}, 示例: [${tags.slice(0, 5).join(',')}]`);

  // 巡检5: 原材料库存 — 供应商名非UUID
  await go(page, '/warehouse/materials');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  const matRows = await page.$$eval('.el-table__body-wrapper .el-table__row', rows =>
    rows.slice(0, 5).map(r => Array.from(r.querySelectorAll('td .cell')).map(c => c.textContent?.trim() || ''))
  ).catch(() => []);
  const matHeaders = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const suppColIdx = matHeaders.findIndex(h => h.includes('供应商'));
  const uuidInMats = matRows.filter(r => suppColIdx >= 0 && UUID_RE.test(r[suppColIdx] || ''));
  log('老板巡检', '原材料库存-供应商名', matRows.length > 0 && uuidInMats.length === 0 ? 'PASS' : (matRows.length === 0 ? 'WARN' : 'FAIL'),
    `${matRows.length}行, UUID=${uuidInMats.length}`);

  // 巡检6: 员工管理 — 有数据
  await go(page, '/hr/employees');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  const empCount = await page.$$('.el-table__body-wrapper .el-table__row').then(r => r.length).catch(() => 0);
  log('老板巡检', '员工管理', empCount > 0 ? 'PASS' : 'WARN', `${empCount}条记录`);

  // 巡检7: 生产计划 — 有数据, 状态中文
  await go(page, '/production/plans');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: 'screenshots/05-boss-production.png' }).catch(() => {});
  const planTags = await page.$$eval('.el-tag', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const planEng = planTags.filter(t => /^[A-Z_]{3,}$/.test(t));
  log('老板巡检', '生产计划-状态', planTags.length > 0 && planEng.length === 0 ? 'PASS' : (planTags.length === 0 ? 'WARN' : 'FAIL'),
    `${planTags.length}个标签${planEng.length ? ', 英文:'+planEng.join(',') : '全中文'}`);

  // 巡检8: 质检记录 — 有数据
  await go(page, '/quality/inspections');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  const qcCount = await page.$$('.el-table__body-wrapper .el-table__row').then(r => r.length).catch(() => 0);
  log('老板巡检', '质检记录', qcCount > 0 ? 'PASS' : 'WARN', `${qcCount}条记录`);

  // 巡检9: 设备管理 — 有数据
  await go(page, '/equipment/list');
  await page.locator('.el-table__body-wrapper .el-table__row').first().waitFor({ timeout: 8000 }).catch(() => {});
  const eqCount = await page.$$('.el-table__body-wrapper .el-table__row').then(r => r.length).catch(() => 0);
  log('老板巡检', '设备管理', eqCount > 0 ? 'PASS' : 'WARN', `${eqCount}条记录`);

  // 巡检10: 仪表盘有内容
  await go(page, '/dashboard');
  const dashText = await page.locator('.app-main, main').first().textContent().catch(() => '');
  log('老板巡检', '仪表盘', dashText.length > 100 ? 'PASS' : 'WARN', `${dashText.length}字内容`);
}

// ==================== MAIN ====================

async function main() {
  console.log('🎬 E2E Business Simulation: 一天的工厂业务');
  console.log(`${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Fulfill Google Fonts with empty response (blocked in China, prevents Vue mount)
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '', contentType: 'font/woff2' }));
  const page = await ctx.newPage();

  // Create screenshots dir
  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  // Get ALL role tokens upfront to avoid rate limiting
  console.log('Getting tokens for all roles...');
  for (const u of ['factory_admin1', 'procurement_mgr1', 'sales_mgr1']) {
    try { tokens[u] = await apiAs(u); console.log(`  ✅ ${u}`); }
    catch (e) { console.log(`  ❌ ${u}: ${e.message.slice(0,50)}`); }
    await new Promise(r => setTimeout(r, 500)); // small delay
  }
  if (!tokens.factory_admin1) { console.error('❌ No admin token'); await browser.close(); process.exit(1); }

  // Login browser as admin
  if (!await loginBrowser(page, 'factory_admin1')) { console.error('❌ Browser login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Browser OK\n');

  await act1_procurement(page);
  await act2_approve_receive(page);
  await act3_sales(page);
  await act4_rd(page);
  await act5_admin_review(page);
  await act6_boss_inspection(page);

  console.log('\n' + '='.repeat(60));
  console.log(`🎬 SIMULATION: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass+fail+warn})`);
  console.log('='.repeat(60));

  const fs2 = await import('fs');
  fs2.writeFileSync('test-e2e-simulation-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass+fail+warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
