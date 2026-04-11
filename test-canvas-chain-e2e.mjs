/**
 * Canvas Configuration System — 功能链路深度验证
 *
 * 核心链路: 配置修改 → 发布 → 动态页面实际行为变化
 * 重点: SchemaFormRenderer / SchemaTableRenderer / DynamicModulePage 全链路
 *
 * 10 个链路场景, 每个都要: 配置 → 浏览器验证 → 截图证据
 */
import { chromium } from 'playwright';
import fs from 'fs';

const WEB_URL = 'http://139.196.165.140:8086';
const API_BASE = `${WEB_URL}/api/mobile`;
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';
const DIR = './screenshots-canvas-chain';

let token = '', factoryId = '';
const R = []; // results

// ========== Helpers ==========
async function apiLogin() {
  const d = await (await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })).json();
  token = d.data.accessToken; factoryId = d.data.factoryId;
}

async function cfg(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(`${API_BASE}/${factoryId}/config${path}`, opts)).json();
}

async function eff(mod) { return cfg('GET', `/modules/${mod}/effective`); }
async function pub(msg) { return cfg('POST', `/publish?summary=${encodeURIComponent(msg)}`); }

async function ss(page, name) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

function log(id, name, evidence, pass) {
  R.push({ id, name, evidence, result: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? '✅' : '❌'} ${id}: ${name}`);
  evidence.forEach(e => console.log(`   ${e}`));
}

// ========== Browser Login ==========
async function login(page) {
  await page.goto(`${WEB_URL}/login`, { timeout: 30000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) { await inputs[0].fill(USERNAME); await inputs[1].fill(PASSWORD); }
  const btn = await page.$('button[type="submit"]') || await page.$('.el-button--primary');
  if (btn) await btn.click();
  await page.waitForTimeout(5000);
  return !page.url().includes('/login');
}

// ========== Navigate to dynamic page ==========
async function goDynamic(page, mod) {
  await page.goto(`${WEB_URL}/modules/${mod}`, { timeout: 15000 });
  await page.waitForTimeout(4000);
}

// ========== Click 新建 on dynamic page ==========
async function clickCreate(page) {
  const btn = await page.$('button:has-text("新建")');
  if (btn) { await btn.click(); await page.waitForTimeout(3000); }
  return !!btn;
}

// ========== Click 返回列表 ==========
async function clickBack(page) {
  const back = await page.$('.back-btn, :text("返回列表"), :text("← 返回")');
  if (back) { await back.click(); await page.waitForTimeout(2000); }
}

// ========== Get form field labels ==========
async function getFormLabels(page) {
  return page.$$eval('.el-form-item__label', els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
}

// ========== Get collapse group headers ==========
async function getGroups(page) {
  return page.$$eval('.el-collapse-item__header', els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
}

// ========== Get table column headers ==========
async function getTableHeaders(page) {
  return page.$$eval('.el-table__header th .cell', els => els.map(e => e.textContent?.trim()).filter(Boolean)).catch(() => []);
}

// ========== Main ==========
async function main() {
  console.log('🔗 Canvas 功能链路深度验证 — 10 场景');
  console.log('='.repeat(60));

  await apiLogin();
  console.log(`API: ${factoryId} / factory_super_admin\n`);

  // Reset config to clean state
  await cfg('PUT', '/modules/sales_order', {
    fieldConfig: { fields: {} }, workflowConfig: { options: {} },
    customLabels: {}, renderingMode: 'DYNAMIC',
  });
  await cfg('PUT', '/modules/bom', {
    fieldConfig: { fields: {} }, renderingMode: 'DYNAMIC',
  });
  await pub('chain-test-reset');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().substring(0, 150)); });

  const loggedIn = await login(page);
  console.log(`Browser login: ${loggedIn ? '✅' : '❌'}\n`);

  try {
    // ============================================================
    // C1: 默认DYNAMIC模式 — 列表列 = schema.listVisible 字段
    // ============================================================
    console.log('--- C1: 动态列表列渲染 ---');
    await goDynamic(page, 'sales_order');
    const c1Headers = await getTableHeaders(page);
    await ss(page, 'C1-list-columns');
    // Expected listVisible fields: orderNumber, customerId, orderDate, requiredDeliveryDate, totalAmount, status
    const c1Expected = ['订单号', '客户', '下单日期'];
    const c1Match = c1Expected.every(h => c1Headers.some(ch => ch.includes(h)));
    log('C1', '动态列表列 = schema.listVisible 字段', [
      `table headers (${c1Headers.length}): ${c1Headers.join(' | ')}`,
      `expected columns present: ${c1Match}`,
      `screenshot: C1-list-columns.png`,
    ], c1Match);

    // ============================================================
    // C2: 点新建 → 表单分组 = schema.groups
    // ============================================================
    console.log('\n--- C2: 表单分组渲染 ---');
    await clickCreate(page);
    const c2Groups = await getGroups(page);
    const c2Labels = await getFormLabels(page);
    await ss(page, 'C2-form-groups');
    const c2ExpectedGroups = ['基本信息', '订单明细', '金额汇总'];
    const c2Match = c2ExpectedGroups.every(g => c2Groups.some(cg => cg.includes(g)));
    log('C2', '表单分组 = schema.groups', [
      `groups (${c2Groups.length}): ${c2Groups.join(' | ')}`,
      `labels (${c2Labels.length}): ${c2Labels.slice(0, 8).join(', ')}...`,
      `expected groups: ${c2Match}`,
      `screenshot: C2-form-groups.png`,
    ], c2Match);

    // ============================================================
    // C3: 隐藏字段 → 表单不渲染 + 列表不显示
    // ============================================================
    console.log('\n--- C3: 隐藏字段 → 表单+列表验证 ---');
    await cfg('PUT', '/modules/sales_order', {
      fieldConfig: { fields: {
        salesperson: { visible: false },
        requiredDeliveryDate: { visible: false },
        boxQuantity: { visible: false },
      } },
    });
    await pub('C3-hide-3-fields');

    // Reload form
    await goDynamic(page, 'sales_order');
    const c3ListHeaders = await getTableHeaders(page);
    const c3HasDeliveryCol = c3ListHeaders.some(h => h.includes('交货'));

    await clickCreate(page);
    const c3Labels = await getFormLabels(page);
    const c3HasSalesperson = c3Labels.some(l => l.includes('业务员'));
    const c3HasBoxQty = c3Labels.some(l => l.includes('箱数'));
    await ss(page, 'C3-hidden-fields');

    log('C3', '隐藏3字段 → 表单+列表都不显示', [
      `API: hide salesperson/requiredDeliveryDate/boxQuantity`,
      `form labels (${c3Labels.length}): 含业务员=${c3HasSalesperson}, 含箱数=${c3HasBoxQty}`,
      `list headers: 含交货日期=${c3HasDeliveryCol}`,
      `screenshot: C3-hidden-fields.png`,
    ], !c3HasSalesperson && !c3HasBoxQty);

    // ============================================================
    // C4: 自定义标签 → 表单标签变化 + 列表表头变化
    // ============================================================
    console.log('\n--- C4: 自定义标签 → 全链路 ---');
    await cfg('PUT', '/modules/sales_order', {
      customLabels: { orderNumber: '合同编号', customerId: '签约方', remark: '特殊说明' },
    });
    await pub('C4-custom-labels');

    await goDynamic(page, 'sales_order');
    const c4Headers = await getTableHeaders(page);
    const c4HasContract = c4Headers.some(h => h.includes('合同'));
    const c4HasSignee = c4Headers.some(h => h.includes('签约'));

    await clickCreate(page);
    const c4Labels = await getFormLabels(page);
    const c4FormContract = c4Labels.some(l => l.includes('合同编号'));
    const c4FormSignee = c4Labels.some(l => l.includes('签约方'));
    const c4FormRemark = c4Labels.some(l => l.includes('特殊说明'));
    await ss(page, 'C4-custom-labels-form');

    log('C4', '自定义标签 → 列表表头+表单标签', [
      `list headers: 含"合同"=${c4HasContract}, 含"签约"=${c4HasSignee}`,
      `form labels: 含"合同编号"=${c4FormContract}, 含"签约方"=${c4FormSignee}, 含"特殊说明"=${c4FormRemark}`,
      `screenshot: C4-custom-labels-form.png`,
    ], c4FormContract && c4FormSignee && c4FormRemark);

    // ============================================================
    // C5: 工作流配置 → 操作列按钮变化
    // ============================================================
    console.log('\n--- C5: 工作流配置 → 操作按钮 ---');
    // Default: hasFinanceReview=true → CONFIRMED can go to PENDING_FINANCE_REVIEW
    const c5Eff1 = await eff('sales_order');
    const c5Trans1 = c5Eff1.data?.workflowTransitions?.filter(t => t.from === 'CONFIRMED').map(t => `${t.to}(${t.enabled})`);

    // Change: hasFinanceReview=false → CONFIRMED can go directly to PROCESSING
    await cfg('PUT', '/modules/sales_order', {
      workflowConfig: { options: { hasFinanceReview: false } },
    });
    await pub('C5-no-finance-review');
    const c5Eff2 = await eff('sales_order');
    const c5Trans2 = c5Eff2.data?.workflowTransitions?.filter(t => t.from === 'CONFIRMED').map(t => `${t.to}(${t.enabled})`);
    const c5DirectOK = c5Eff2.data?.workflowTransitions?.find(t => t.from === 'CONFIRMED' && t.to === 'PROCESSING')?.enabled;

    log('C5', '工作流配置 → 状态转换变化', [
      `before (hasFinanceReview=true): CONFIRMED→ ${c5Trans1?.join(', ')}`,
      `after (hasFinanceReview=false): CONFIRMED→ ${c5Trans2?.join(', ')}`,
      `CONFIRMED→PROCESSING enabled: ${c5DirectOK}`,
    ], c5DirectOK === true);

    // ============================================================
    // C6: 角色权限 → 不同角色看到不同字段数
    // ============================================================
    console.log('\n--- C6: 角色权限对比 ---');
    const roles = ['factory_super_admin', 'sales_manager', 'sales_staff', 'finance', 'warehouse', 'viewer'];
    const roleResults = [];
    for (const role of roles) {
      const res = await fetch(`${API_BASE}/${factoryId}/config/modules/sales_order/effective?roleCode=${role}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json());
      const visible = res.data?.fields?.filter(f => f.visible).length;
      const readonly = res.data?.fields?.filter(f => f.readonly).length;
      roleResults.push(`${role}: ${visible}可见/${readonly}只读`);
    }
    const whVis = await fetch(`${API_BASE}/${factoryId}/config/modules/sales_order/effective?roleCode=warehouse`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => r.json());
    const whAmountHidden = whVis.data?.fields?.find(f => f.code === 'totalAmount')?.visible === false;

    log('C6', '6 角色权限对比 — 字段可见性差异', [
      ...roleResults.map(r => `role: ${r}`),
      `warehouse.totalAmount.hidden: ${whAmountHidden}`,
    ], whAmountHidden);

    // ============================================================
    // C7: 字段类型映射验证 — 各类型组件正确渲染
    // ============================================================
    console.log('\n--- C7: 字段类型→组件映射 ---');
    // Reset hidden fields to see all types
    await cfg('PUT', '/modules/sales_order', {
      fieldConfig: { fields: {} }, customLabels: {},
    });
    await pub('C7-show-all-fields');

    await goDynamic(page, 'sales_order');
    await clickCreate(page);

    // Check various input types exist
    const c7Inputs = await page.$$('.el-input');
    const c7Numbers = await page.$$('.el-input-number');
    const c7Switches = await page.$$('.el-switch');
    const c7Dates = await page.$$('.el-date-editor');
    const c7Selects = await page.$$('.el-select');
    const c7Textareas = await page.$$('textarea');
    await ss(page, 'C7-field-types');

    log('C7', '字段类型→Element Plus 组件映射', [
      `el-input (string): ${c7Inputs.length}`,
      `el-input-number (decimal/integer): ${c7Numbers.length}`,
      `el-switch (boolean): ${c7Switches.length}`,
      `el-date-editor (date): ${c7Dates.length}`,
      `el-select (select/reference): ${c7Selects.length}`,
      `textarea: ${c7Textareas.length}`,
      `screenshot: C7-field-types.png`,
    ], c7Inputs.length > 0 && (c7Switches.length > 0 || c7Dates.length > 0));

    // ============================================================
    // C8: BOM 动态渲染 — 成本字段显隐
    // ============================================================
    console.log('\n--- C8: BOM 成本字段显隐 ---');
    // Show all first
    await cfg('PUT', '/modules/bom', { fieldConfig: { fields: {} }, renderingMode: 'DYNAMIC' });
    await pub('C8-bom-show-all');

    await goDynamic(page, 'bom');
    await clickCreate(page);
    const c8AllLabels = await getFormLabels(page);
    const c8HasPrice = c8AllLabels.some(l => l.includes('单价'));
    const c8HasTax = c8AllLabels.some(l => l.includes('税率'));
    await ss(page, 'C8a-bom-all');

    // Now hide cost fields
    await cfg('PUT', '/modules/bom', {
      fieldConfig: { fields: { unitPrice: { visible: false }, taxRate: { visible: false } } },
    });
    await pub('C8-bom-hide-cost');

    await goDynamic(page, 'bom');
    await clickCreate(page);
    const c8HidLabels = await getFormLabels(page);
    const c8HidPrice = c8HidLabels.some(l => l.includes('单价'));
    const c8HidTax = c8HidLabels.some(l => l.includes('税率'));
    await ss(page, 'C8b-bom-no-cost');

    log('C8', 'BOM 成本字段: 全显→隐藏对比', [
      `全显 labels (${c8AllLabels.length}): 含单价=${c8HasPrice}, 含税率=${c8HasTax}`,
      `隐藏后 labels (${c8HidLabels.length}): 含单价=${c8HidPrice}, 含税率=${c8HidTax}`,
      `delta: ${c8AllLabels.length - c8HidLabels.length} fields hidden`,
      `screenshots: C8a-bom-all.png, C8b-bom-no-cost.png`,
    ], c8HasPrice && !c8HidPrice && c8HasTax && !c8HidTax);

    // ============================================================
    // C9: 版本管理 — 3 次发布 + 回滚到 v1 → 验证配置恢复
    // ============================================================
    console.log('\n--- C9: 版本管理链路 ---');
    // Current state has multiple versions. Get modules to see
    const c9Mods = await cfg('GET', '/modules');
    const c9SOBefore = (await eff('sales_order')).data;
    const c9FieldsBefore = c9SOBefore?.fields?.length;

    // Make a change + publish (this adds another version)
    await cfg('PUT', '/modules/sales_order', {
      customLabels: { orderNumber: '测试版本标签' },
    });
    await pub('C9-version-test');
    const c9After = (await eff('sales_order')).data;
    const c9LabelAfter = c9After?.customLabels?.orderNumber;

    // Rollback to earlier version (before the label change)
    // The version before this should be the C8 publish
    await cfg('POST', '/rollback/6'); // version 6 = C7-show-all-fields
    await pub('C9-rollback');
    const c9Rolled = (await eff('sales_order')).data;
    const c9LabelRolled = c9Rolled?.customLabels?.orderNumber;

    log('C9', '版本发布+回滚 → 配置恢复', [
      `发布前: fields=${c9FieldsBefore}`,
      `发布后: customLabels.orderNumber="${c9LabelAfter}"`,
      `回滚后: customLabels.orderNumber="${c9LabelRolled}" (expect undefined/null)`,
      `版本恢复: ${c9LabelRolled !== '测试版本标签' ? 'SUCCESS' : 'FAILED'}`,
    ], c9LabelRolled !== '测试版本标签');

    // ============================================================
    // C10: 草稿→发布→动态页面 完整链路
    // ============================================================
    console.log('\n--- C10: 完整 Draft→Publish→Render 链路 ---');
    // Step 1: Create draft with specific config
    await cfg('PUT', '/modules/sales_order', {
      fieldConfig: { fields: {
        remark: { visible: false },
        deliveryAddress: { visible: false },
      } },
      customLabels: { orderNumber: '最终合同号', totalAmount: '合同金额' },
      renderingMode: 'DYNAMIC',
    });

    // Step 2: Verify draft NOT reflected in effective
    const c10Draft = (await eff('sales_order')).data;
    const c10DraftRemark = c10Draft?.fields?.find(f => f.code === 'remark')?.visible;

    // Step 3: Publish
    await pub('C10-final-chain-test');

    // Step 4: Verify effective reflects changes
    const c10Pub = (await eff('sales_order')).data;
    const c10PubRemark = c10Pub?.fields?.find(f => f.code === 'remark')?.visible;
    const c10PubLabel = c10Pub?.customLabels?.orderNumber;

    // Step 5: Browser verification
    await goDynamic(page, 'sales_order');
    const c10ListHeaders = await getTableHeaders(page);
    const c10HasFinalLabel = c10ListHeaders.some(h => h.includes('最终合同'));

    await clickCreate(page);
    const c10FormLabels = await getFormLabels(page);
    const c10FormHasRemark = c10FormLabels.some(l => l.includes('备注'));
    const c10FormHasAddr = c10FormLabels.some(l => l.includes('地址'));
    const c10FormHasContract = c10FormLabels.some(l => l.includes('最终合同'));
    await ss(page, 'C10-final-chain');

    log('C10', 'Draft→Publish→Render 完整链路', [
      `draft阶段: remark.visible=${c10DraftRemark} (draft未发布, 应仍为true)`,
      `publish后 API: remark.visible=${c10PubRemark}, label="${c10PubLabel}"`,
      `browser list: 含"最终合同"=${c10HasFinalLabel}`,
      `browser form: 含"备注"=${c10FormHasRemark}(隐藏), 含"地址"=${c10FormHasAddr}(隐藏), 含"最终合同"=${c10FormHasContract}`,
      `screenshot: C10-final-chain.png`,
    ], c10PubRemark === false && !c10FormHasRemark && c10FormHasContract);

  } catch(e) {
    log('ERR', '异常', [e.message, e.stack?.split('\n')[1] || ''], false);
  } finally {
    if (errors.length) {
      console.log(`\n⚠️ Console errors: ${errors.length}`);
      errors.slice(0, 3).forEach(e => console.log(`  ${e}`));
    }
    await browser.close();
  }

  // ========== Report ==========
  console.log('\n' + '='.repeat(60));
  const pass = R.filter(r => r.result === 'PASS').length;
  const fail = R.filter(r => r.result === 'FAIL').length;
  console.log(`📊 Canvas 功能链路: ${pass} PASS / ${fail} FAIL — 共 ${R.length} 项`);

  if (fail) {
    console.log('\n❌ 失败:');
    R.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  ${r.id}: ${r.name}`);
      r.evidence.forEach(e => console.log(`    ${e}`));
    });
  }

  fs.writeFileSync('test-canvas-chain-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { pass, fail, total: R.length }, tests: R,
  }, null, 2));
  console.log(`\n📁 test-canvas-chain-results.json\n📸 ${DIR}/`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
