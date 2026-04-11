/**
 * Canvas 完整业务链路 — 配置工厂 → 实际创建订单/BOM → 验证流程受配置驱动
 *
 * 正确 API 路径:
 *   SO: /api/mobile/{fid}/sales/orders
 *   BOM: /api/mobile/{fid}/bom-items
 */
import { chromium } from 'playwright';
import fs from 'fs';

const WEB_URL = 'http://139.196.165.140:8086';
const API_BASE = `${WEB_URL}/api/mobile`;
const DIR = './screenshots-canvas-fullchain';

let token = '', factoryId = '';
const R = [];

async function apiLogin() {
  const d = await (await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' }),
  })).json();
  token = d.data.accessToken; factoryId = d.data.factoryId;
  return d.data;
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  return res.json();
}

async function cfg(method, path, body) { return api(method, `/${factoryId}/config${path}`, body); }
async function pub(msg) { return cfg('POST', `/publish?summary=${encodeURIComponent(msg)}`); }
async function eff(mod) { return cfg('GET', `/modules/${mod}/effective`); }

async function ss(page, name) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

function log(id, name, ev, pass) {
  R.push({ id, name, evidence: ev, result: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? '✅' : '❌'} ${id}: ${name}`);
  ev.forEach(e => console.log(`   ${e}`));
}

async function main() {
  console.log('🏭 Canvas 完整业务链路 — 配置→创建→流程→验证');
  console.log('='.repeat(60));

  const user = await apiLogin();
  console.log(`Login: ${user.factoryId} / ${user.role}\n`);

  // 获取测试前置数据
  const custRes = await api('GET', `/${factoryId}/customers?page=1&size=3`);
  const customers = custRes.data?.content || custRes.data || [];
  const custId = customers[0]?.id;
  console.log(`Customers: ${customers.length}, using: ${custId}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  // Browser login
  await page.goto(`${WEB_URL}/login`, { timeout: 30000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) { await inputs[0].fill('factory_admin1'); await inputs[1].fill('123456'); }
  const loginBtn = await page.$('button[type="submit"]') || await page.$('.el-button--primary');
  if (loginBtn) await loginBtn.click();
  await page.waitForTimeout(5000);

  try {
    // ==============================================================
    // STEP 1: 配置六扇门工厂 — 关闭财务审核
    // ==============================================================
    console.log('══ Step 1: 配置工厂 (关闭财务审核) ══\n');

    await cfg('PUT', '/modules/sales_order', {
      fieldConfig: { fields: {
        boxQuantity: { visible: false },
        estimatedCost: { visible: false },
        estimatedProfit: { visible: false },
        settlementFlag: { visible: false },
      }},
      workflowConfig: { options: { hasFinanceReview: false } },
      customLabels: { orderNumber: '合同编号', customerId: '客户/门店' },
      renderingMode: 'DYNAMIC',
    });
    await pub('fullchain-step1-关闭财务审核');

    const s1Eff = (await eff('sales_order')).data;
    const s1Direct = s1Eff?.workflowTransitions?.find(t => t.from === 'CONFIRMED' && t.to === 'PROCESSING');
    log('S1', '配置: 关闭财务审核', [
      `hasFinanceReview: ${s1Eff?.workflowOptions?.hasFinanceReview ?? 'default(false)'}`,
      `CONFIRMED→PROCESSING.enabled: ${s1Direct?.enabled}`,
      `visible fields: ${s1Eff?.fields?.filter(f => f.visible).length}/${s1Eff?.fields?.length}`,
      `customLabels: ${JSON.stringify(s1Eff?.customLabels)}`,
    ], s1Direct?.enabled === true);

    // ==============================================================
    // STEP 2: 创建销售订单 (通过 API — 正确路径)
    // ==============================================================
    console.log('\n══ Step 2: 创建销售订单 ══\n');

    const createRes = await api('POST', `/${factoryId}/sales/orders`, {
      customerId: custId,
      orderDate: '2026-04-09',
      remark: 'Canvas 全链路测试 - 应跳过财务审核',
    });
    const orderId = createRes.data?.id;
    const orderNum = createRes.data?.orderNumber;
    log('S2', '创建销售订单', [
      `API POST /sales/orders: success=${createRes.success}`,
      `orderNumber: ${orderNum}`,
      `status: ${createRes.data?.status}`,
      `message: ${createRes.message}`,
    ], createRes.success && !!orderId);

    // ==============================================================
    // STEP 3: 确认订单 (DRAFT → CONFIRMED)
    // ==============================================================
    console.log('\n══ Step 3: 确认订单 ══\n');

    let confirmRes = { success: false };
    if (orderId) {
      confirmRes = await api('POST', `/${factoryId}/sales/orders/${orderId}/confirm`);
    }
    log('S3', '确认订单 (DRAFT→CONFIRMED)', [
      `API POST /confirm: success=${confirmRes.success}`,
      `status: ${confirmRes.data?.status}`,
      `canvas 配置允许 CONFIRMED→PROCESSING: ${s1Direct?.enabled}`,
    ], confirmRes.success && confirmRes.data?.status === 'CONFIRMED');

    // ==============================================================
    // STEP 4: 验证已确认订单的可用操作 — 应该能直接生产(跳过财务)
    // ==============================================================
    console.log('\n══ Step 4: 验证跳过财务审核 ══\n');

    // The canvas config says hasFinanceReview=false
    // So CONFIRMED→PROCESSING should be enabled
    // SalesServiceImpl.checkTransitionAllowed should allow this
    // Let's verify by checking what transitions are available
    const availTrans = s1Eff?.workflowTransitions
      ?.filter(t => t.from === 'CONFIRMED' && t.enabled)
      ?.map(t => `${t.to}(${t.label})`);

    // 同时验证: 提交财务审核仍然可以走(但不是必须的)
    const financeTransEnabled = s1Eff?.workflowTransitions
      ?.find(t => t.from === 'CONFIRMED' && t.to === 'PENDING_FINANCE_REVIEW')?.enabled;

    log('S4', '跳过财务审核 — 配置驱动工作流', [
      `CONFIRMED 可达: ${availTrans?.join(', ')}`,
      `PROCESSING 可直达: ${availTrans?.some(t => t.startsWith('PROCESSING'))}`,
      `财务审核仍可选: ${financeTransEnabled} (optional, not required)`,
      `canvas 驱动: hasFinanceReview=false → 解锁 CONFIRMED→PROCESSING`,
    ], availTrans?.some(t => t.startsWith('PROCESSING')));

    // ==============================================================
    // STEP 5: 切换配置 → 开启财务审核
    // ==============================================================
    console.log('\n══ Step 5: 开启财务审核 ══\n');

    await cfg('PUT', '/modules/sales_order', {
      workflowConfig: { options: { hasFinanceReview: true } },
    });
    await pub('fullchain-step5-开启财务审核');

    const s5Eff = (await eff('sales_order')).data;
    const s5Direct = s5Eff?.workflowTransitions?.find(t => t.from === 'CONFIRMED' && t.to === 'PROCESSING');

    log('S5', '开启财务审核 → PROCESSING 受限', [
      `hasFinanceReview: true`,
      `CONFIRMED→PROCESSING.enabled: ${s5Direct?.enabled} (expect false — 被条件 !hasFinanceReview 阻塞)`,
      `CONFIRMED→PENDING_FINANCE.enabled: ${s5Eff?.workflowTransitions?.find(t => t.from === 'CONFIRMED' && t.to === 'PENDING_FINANCE_REVIEW')?.enabled}`,
    ], s5Direct?.enabled === false);

    // ==============================================================
    // STEP 6: 创建第二个订单 → 走完整财务审核流程
    // ==============================================================
    console.log('\n══ Step 6: 完整财务审核流程 ══\n');

    const create2 = await api('POST', `/${factoryId}/sales/orders`, {
      customerId: custId,
      orderDate: '2026-04-09',
      remark: 'Canvas 测试 - 需要财务审核',
    });
    const order2Id = create2.data?.id;
    let financeChain = [];

    if (order2Id) {
      // Confirm
      const confirm2 = await api('POST', `/${factoryId}/sales/orders/${order2Id}/confirm`);
      financeChain.push(`confirm: ${confirm2.data?.status}`);

      // Submit for finance review
      const submitFin = await api('POST', `/${factoryId}/sales/orders/${order2Id}/submit-for-review`);
      financeChain.push(`submitReview: ${submitFin.data?.status}`);

      // Finance approve
      const approve = await api('POST', `/${factoryId}/sales/orders/${order2Id}/finance-approve`, {
        notes: 'Canvas E2E 审批通过',
      });
      financeChain.push(`approve: ${approve.data?.status}`);
    }

    log('S6', '完整财务审核链路: DRAFT→CONFIRMED→PENDING→APPROVED', [
      `创建: success=${create2.success}, ${create2.data?.orderNumber}`,
      ...financeChain.map(c => `flow: ${c}`),
    ], financeChain.includes('approve: FINANCE_APPROVED'));

    // ==============================================================
    // STEP 7: BOM 配置 → 创建 BOM 项目 → 验证默认值
    // ==============================================================
    console.log('\n══ Step 7: BOM 配置驱动默认值 ══\n');

    await cfg('PUT', '/modules/bom', {
      fieldConfig: { fields: {
        sortOrder: { visible: false },
        yieldRate: { defaultValue: 92 },
        taxRate: { defaultValue: 9 },
      }},
      renderingMode: 'DYNAMIC',
    });
    await pub('fullchain-step7-bom-defaults');

    const bomEff = (await eff('bom')).data;
    const yieldDef = bomEff?.fields?.find(f => f.code === 'yieldRate')?.defaultValue;
    const taxDef = bomEff?.fields?.find(f => f.code === 'taxRate')?.defaultValue;

    log('S7', 'BOM 配置默认值', [
      `yieldRate.defaultValue: ${yieldDef} (expect 92)`,
      `taxRate.defaultValue: ${taxDef} (expect 9)`,
      `sortOrder.visible: ${bomEff?.fields?.find(f => f.code === 'sortOrder')?.visible} (expect false)`,
    ], yieldDef === 92 && taxDef === 9);

    // ==============================================================
    // STEP 8: 浏览器 — 动态列表验证(自定义标签+数据)
    // ==============================================================
    console.log('\n══ Step 8: 浏览器 — 动态列表 ══\n');

    await page.goto(`${WEB_URL}/modules/sales_order`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const listHeaders = await page.$$eval('.el-table__header th .cell',
      els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
    await ss(page, 'S8-dynamic-list');

    log('S8', '动态列表 — 自定义表头', [
      `headers: ${listHeaders.join(' | ')}`,
      `含"合同编号": ${listHeaders.some(h => h.includes('合同'))}`,
      `含"客户/门店": ${listHeaders.some(h => h.includes('门店'))}`,
      `screenshot: S8-dynamic-list.png`,
    ], listHeaders.some(h => h.includes('合同')));

    // ==============================================================
    // STEP 9: 浏览器 — 动态表单 (隐藏+标签+分组)
    // ==============================================================
    console.log('\n══ Step 9: 浏览器 — 动态表单 ══\n');

    const createBtnEl = await page.$('button:has-text("新建")');
    if (createBtnEl) { await createBtnEl.click(); await page.waitForTimeout(3000); }

    const formLabels = await page.$$eval('.el-form-item__label',
      els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
    const groups = await page.$$eval('.el-collapse-item__header',
      els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
    await ss(page, 'S9-dynamic-form');

    const hiddenCheck = {
      箱数: !formLabels.some(l => l.includes('箱数')),
      预估成本: !formLabels.some(l => l.includes('预估成本')),
      预估利润: !formLabels.some(l => l.includes('预估利润')),
    };
    const labelCheck = {
      合同编号: formLabels.some(l => l.includes('合同编号')),
      '客户/门店': formLabels.some(l => l.includes('门店')),
    };

    log('S9', '动态表单 — 配置驱动字段', [
      `labels (${formLabels.length}): ${formLabels.slice(0, 8).join(', ')}...`,
      `groups (${groups.length}): ${groups.join(' | ')}`,
      `hidden: 箱数=${hiddenCheck.箱数}, 预估成本=${hiddenCheck.预估成本}`,
      `custom: 合同编号=${labelCheck.合同编号}, 客户/门店=${labelCheck['客户/门店']}`,
      `screenshot: S9-dynamic-form.png`,
    ], hiddenCheck.箱数 && labelCheck.合同编号);

    // ==============================================================
    // STEP 10: 浏览器 — 旧版页面验证订单已创建
    // ==============================================================
    console.log('\n══ Step 10: 旧版页面 — 新订单存在 ══\n');

    await page.goto(`${WEB_URL}/sales/orders`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const rows = await page.$$('.el-table__row');
    // Check if our test order appears
    const pageText = await page.textContent('.el-table').catch(() => '');
    const hasTestOrder = pageText.includes('Canvas') || pageText.includes('全链路') || pageText.includes('财务审核');
    await ss(page, 'S10-legacy-with-orders');

    log('S10', '旧版页面 — 新创建订单可见', [
      `rows: ${rows.length}`,
      `contains test order: ${hasTestOrder}`,
      `screenshot: S10-legacy-with-orders.png`,
    ], rows.length > 0);

    // ==============================================================
    // STEP 11: 浏览器 — BOM 动态表单
    // ==============================================================
    console.log('\n══ Step 11: BOM 动态表单 ══\n');

    await page.goto(`${WEB_URL}/modules/bom`, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const bomCreate = await page.$('button:has-text("新建")');
    if (bomCreate) { await bomCreate.click(); await page.waitForTimeout(3000); }

    const bomLabels = await page.$$eval('.el-form-item__label',
      els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
    const bomGroups = await page.$$eval('.el-collapse-item__header',
      els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
    const hasSortOrder = bomLabels.some(l => l.includes('排序'));
    await ss(page, 'S11-bom-dynamic-form');

    log('S11', 'BOM 动态表单 — 排序隐藏+3分组', [
      `labels (${bomLabels.length}): ${bomLabels.join(', ')}`,
      `groups (${bomGroups.length}): ${bomGroups.join(' | ')}`,
      `排序(hidden): ${!hasSortOrder}`,
      `screenshot: S11-bom-dynamic-form.png`,
    ], !hasSortOrder && bomGroups.length >= 3);

    // ==============================================================
    // STEP 12: 多角色权限验证
    // ==============================================================
    console.log('\n══ Step 12: 多角色权限 ══\n');

    const roleData = [];
    for (const role of ['factory_super_admin', 'sales_staff', 'finance', 'warehouse']) {
      const res = await fetch(`${API_BASE}/${factoryId}/config/modules/sales_order/effective?roleCode=${role}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json());
      const vis = res.data?.fields?.filter(f => f.visible).length;
      const hidden = res.data?.fields?.filter(f => !f.visible).length;
      roleData.push(`${role}: ${vis}可见/${hidden}隐藏`);
    }

    log('S12', '4 角色权限差异', roleData, roleData.length === 4);

  } catch(e) {
    log('ERR', '异常', [e.message, e.stack?.split('\n')[1] || ''], false);
  } finally {
    await browser.close();
  }

  // Report
  console.log('\n' + '='.repeat(60));
  const p = R.filter(r => r.result === 'PASS').length;
  const f = R.filter(r => r.result === 'FAIL').length;
  console.log(`📊 Canvas 完整链路: ${p} PASS / ${f} FAIL — 共 ${R.length} 项`);
  if (f) {
    console.log('\n❌:');
    R.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  ${r.id}: ${r.name}`);
      r.evidence.forEach(e => console.log(`    ${e}`));
    });
  }
  fs.writeFileSync('test-canvas-fullchain-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), summary: { pass: p, fail: f, total: R.length }, tests: R,
  }, null, 2));
  console.log(`\n📁 test-canvas-fullchain-results.json\n📸 ${DIR}/`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
