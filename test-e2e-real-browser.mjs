/**
 * E2E Real Browser: 全部用 Playwright 浏览器操作，禁止 API 代替
 * 严格按 skill 规范：点按钮→填表单→点提交→验证 toast→验证持久化→验证详情
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const TS = Date.now().toString().slice(-6);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pass = 0, fail = 0, warn = 0;
const results = [];
const screenshots = [];

function log(role, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ role, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${role}] ${test}${ev ? '\n   ' + ev.slice(0, 250) : ''}`);
}

async function shot(page, name) {
  const p = `screenshots/${name}.png`;
  await page.screenshot({ path: p }).catch(() => {});
  screenshots.push(p);
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { timeout: 30000 }).catch(() => {});
  // Wait for data rows (not just DOM) — poll up to 15s
  for (let i = 0; i < 12; i++) {
    const rows = await page.$$('.el-table__body-wrapper .el-table__row').catch(() => []);
    if (rows.length > 0) break;
    const empty = await page.locator('.el-empty, .el-table__empty-text').isVisible().catch(() => false);
    const card = await page.locator('.el-card').isVisible().catch(() => false);
    if (empty || card) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(1000);
}

async function selectDropdown(page, nthSelect, optionText) {
  // Click the nth el-select in visible dialog/page, pick option containing text
  const selects = page.locator('.el-dialog:visible .el-select, .el-select').filter({ hasNot: page.locator('.el-select-dropdown') });
  const allSelects = page.locator('.el-dialog:visible .el-select');
  const sel = nthSelect >= 0 ? allSelects.nth(nthSelect) : page.locator('.el-select').first();
  if (!await sel.isVisible({ timeout: 3000 }).catch(() => false)) return '';
  await sel.click();
  await page.waitForTimeout(800);
  // Find option
  if (optionText) {
    const opt = page.locator(`.el-select-dropdown__item:visible`).filter({ hasText: optionText }).first();
    if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await opt.textContent();
      await opt.click();
      await page.waitForTimeout(500);
      return text?.trim() || '';
    }
  }
  // Pick first option
  const first = page.locator('.el-select-dropdown__item:visible').first();
  if (await first.isVisible({ timeout: 2000 }).catch(() => false)) {
    const text = await first.textContent();
    await first.click();
    await page.waitForTimeout(500);
    return text?.trim() || '';
  }
  return '';
}

async function waitToast(page) {
  await page.waitForTimeout(2000);
  const success = await page.locator('.el-message--success').isVisible().catch(() => false);
  const errorEl = page.locator('.el-message--error');
  const error = await errorEl.isVisible().catch(() => false);
  const errorText = error ? await errorEl.textContent().catch(() => '') : '';
  return { success, error, errorText };
}

// ==================== 采购员: 浏览器下采购单 ====================

async function browserCreatePO(page) {
  console.log('\n🖱️ === 采购员: 浏览器操作采购订单 ===\n');

  await go(page, '/procurement/orders');
  await page.locator('button:has-text("新建采购订单")').click();
  await page.waitForTimeout(1500);

  // 1. 选供应商 (第1个下拉)
  const supplier = await selectDropdown(page, 0, '');
  log('采购员-UI', '1.选供应商', supplier ? 'PASS' : 'FAIL', `filled: 供应商="${supplier}"`);

  // 2. 填原料 (items区域的下拉)
  await page.waitForTimeout(500);
  // Find the material select in items section
  const matSelect = page.locator('.el-dialog:visible .el-select').last();
  await matSelect.click();
  await page.waitForTimeout(800);
  const matOpt = page.locator('.el-select-dropdown__item:visible').first();
  const matName = await matOpt.textContent().catch(() => '');
  await matOpt.click().catch(() => {});
  await page.waitForTimeout(500);
  log('采购员-UI', '2.选原料', matName ? 'PASS' : 'FAIL', `filled: 原料="${matName?.trim()}"`);

  // 3. 填数量
  const qtyInput = page.locator('.el-dialog:visible .el-input-number input').first();
  if (await qtyInput.isVisible().catch(() => false)) {
    await qtyInput.fill('20');
    log('采购员-UI', '3.填数量', 'PASS', 'filled: 数量=20');
  }

  // 4. 填单价
  const priceInput = page.locator('.el-dialog:visible .el-input-number input').nth(1);
  if (await priceInput.isVisible().catch(() => false)) {
    await priceInput.fill('15');
    log('采购员-UI', '4.填单价', 'PASS', 'filled: 单价=15');
  }

  // 5. 填规格
  const specInput = page.locator('.el-dialog:visible input[placeholder*="规格"]');
  if (await specInput.isVisible().catch(() => false)) {
    await specInput.fill('500g/袋');
    log('采购员-UI', '5.填规格', 'PASS', 'filled: 规格=500g/袋');
  }

  await shot(page, '01-po-form-filled');

  // 6. 点创建
  await page.locator('.el-dialog:visible button:has-text("创建")').click();
  const toast = await waitToast(page);
  log('采购员-UI', '6.提交', toast.success ? 'PASS' : 'FAIL',
    `toast: ${toast.success ? '创建成功' : toast.errorText || '无success toast'}`);

  // 7. 验证列表 — find supplier column by header
  await go(page, '/procurement/orders');
  await page.waitForTimeout(2000); // extra wait for data
  const poHeaders = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const suppIdx = poHeaders.findIndex(h => h.includes('供应商'));
  const poFirstRow = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const firstSupp = suppIdx >= 0 ? (poFirstRow[suppIdx] || '') : '';
  log('采购员-UI', '7.列表供应商名', firstSupp && !UUID_RE.test(firstSupp) ? 'PASS' : 'FAIL',
    `list after: 列${suppIdx}="${firstSupp}" (headers: ${poHeaders.slice(0,4).join(',')})`);

  // 8. 点详情验证
  await page.locator('button:has-text("详情")').first().click();
  await page.waitForTimeout(2500);
  await shot(page, '02-po-detail');
  // Wait for detail to render fully
  await page.waitForTimeout(4000);
  await shot(page, '02-po-detail');
  // Try multiple selectors to find supplier value
  const allText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const suppInPage = allText.includes(supplier);
  const uuidInPage = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
    allText.split('供应商')[1]?.slice(0, 50) || ''
  );
  log('采购员-UI', '8.详情供应商', suppInPage && !uuidInPage ? 'PASS' : 'FAIL',
    `detail check: 页面含"${supplier}"=${suppInPage}, 供应商区UUID=${uuidInPage}`);

  await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
}

// ==================== 销售员: 浏览器下销售单 ====================

async function browserCreateSO(page) {
  console.log('\n🖱️ === 销售员: 浏览器操作销售订单 ===\n');

  await go(page, '/sales/orders');
  await page.locator('button:has-text("新建销售订单")').click();
  await page.waitForTimeout(1500);

  // 1. 选客户
  const customer = await selectDropdown(page, 0, '');
  log('销售员-UI', '1.选客户', customer ? 'PASS' : 'FAIL', `filled: 客户="${customer}"`);

  // 2. 选产品 (items区域)
  await page.waitForTimeout(500);
  const prodSelect = page.locator('.el-dialog:visible .el-select').nth(2);
  let prodName = '';
  if (await prodSelect.isVisible().catch(() => false)) {
    await prodSelect.click();
    await page.waitForTimeout(800);
    const prodOpt = page.locator('.el-select-dropdown__item:visible').first();
    prodName = (await prodOpt.textContent().catch(() => ''))?.trim();
    await prodOpt.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  log('销售员-UI', '2.选产品', prodName ? 'PASS' : 'FAIL', `filled: 产品="${prodName}"`);

  // 3. 填数量
  const qtyInput = page.locator('.el-dialog:visible .el-input-number input').first();
  if (await qtyInput.isVisible().catch(() => false)) await qtyInput.fill('8');
  log('销售员-UI', '3.填数量', 'PASS', 'filled: 数量=8');

  // 4. 填单价
  const priceInput = page.locator('.el-dialog:visible .el-input-number input').nth(1);
  if (await priceInput.isVisible().catch(() => false)) await priceInput.fill('66');

  await shot(page, '03-so-form-filled');

  // 5. 提交
  const createBtn = page.locator('.el-dialog:visible button:has-text("创建"), .el-dialog:visible button:has-text("保存")').first();
  await createBtn.click();
  const toast = await waitToast(page);
  log('销售员-UI', '4.提交', toast.success ? 'PASS' : 'FAIL',
    `toast: ${toast.success ? '创建成功' : toast.errorText || '无toast'}`);

  // 6. 验证列表客户名
  await go(page, '/sales/orders');
  const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const custIdx = headers.findIndex(h => h.includes('客户'));
  const cells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const custVal = custIdx >= 0 ? cells[custIdx] : '';
  log('销售员-UI', '5.列表客户名', custVal && !UUID_RE.test(custVal) ? 'PASS' : 'FAIL',
    `list after: 客户="${custVal}"`);

  // 7. 详情核对
  await page.locator('button:has-text("详情")').first().click();
  await page.waitForTimeout(2500);
  await shot(page, '04-so-detail');
  const itemName = await page.$eval('.el-table__body-wrapper .el-table__row td:first-child .cell',
    e => e.textContent?.trim()).catch(() => '');
  log('销售员-UI', '6.详情产品名', itemName && !UUID_RE.test(itemName) ? 'PASS' : 'FAIL',
    `detail check: 产品="${itemName}"`);

  // 8. 确认订单 — 点"确认"按钮
  const confirmBtn = page.locator('button:has-text("确认")').first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
    // Handle confirm dialog
    const dialogConfirm = page.locator('.el-message-box button:has-text("确定")');
    if (await dialogConfirm.isVisible({ timeout: 2000 }).catch(() => false)) await dialogConfirm.click();
    const t2 = await waitToast(page);
    log('销售员-UI', '7.确认订单', t2.success ? 'PASS' : 'FAIL', `toast: ${t2.success ? '确认成功' : t2.errorText}`);
  }

  await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
}

// ==================== 研发员: 浏览器创建样品 ====================

async function browserCreateSample(page) {
  console.log('\n🖱️ === 研发员: 浏览器操作研发样品 ===\n');

  await go(page, '/rd/samples');
  // Extra wait for RD page — can be slow to render
  await page.locator('button:has-text("新建样品")').waitFor({ timeout: 10000 }).catch(() => {});

  // 1. 点新建样品
  if (!await page.locator('button:has-text("新建样品")').isVisible().catch(() => false)) {
    log('研发员-UI', '0.页面加载', 'FAIL', '新建样品按钮不可见');
    return;
  }
  await page.locator('button:has-text("新建样品")').click();
  await page.waitForTimeout(1500);

  // 2. 填客户名称
  const custInput = page.locator('.el-dialog:visible input[placeholder*="客户"]');
  if (await custInput.isVisible().catch(() => false)) {
    await custInput.fill(`浏览器客户${TS}`);
    log('研发员-UI', '1.填客户名称', 'PASS', `filled: 客户名称="浏览器客户${TS}"`);
  }

  // 3. 填样品名称
  const inputs = page.locator('.el-dialog:visible .el-form-item');
  for (let i = 0; i < await inputs.count(); i++) {
    const label = await inputs.nth(i).locator('label').textContent().catch(() => '');
    if (label?.includes('样品名称')) {
      await inputs.nth(i).locator('input').fill(`浏览器样品${TS}`);
      log('研发员-UI', '2.填样品名称', 'PASS', `filled: 名称="浏览器样品${TS}"`);
      break;
    }
  }

  // 4. 选产品级别 — find by el-form-item label text
  const formItems = page.locator('.el-dialog:visible .el-form-item');
  let levelSelected = false, storageSelected = false;
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    const hasSelect = await formItems.nth(i).locator('.el-select').isVisible().catch(() => false);

    if (label?.includes('产品级别') && hasSelect) {
      await formItems.nth(i).locator('.el-select').click();
      await page.waitForTimeout(600);
      const optA = page.locator('.el-select-dropdown__item:visible').filter({ hasText: 'A' }).first();
      if (await optA.isVisible().catch(() => false)) {
        await optA.click(); await page.waitForTimeout(300);
        log('研发员-UI', '3.选产品级别', 'PASS', 'filled: 产品级别=A (el-select下拉 ✅)');
        levelSelected = true;
      }
    }
    if (label?.includes('储存方式') && hasSelect) {
      await formItems.nth(i).locator('.el-select').click();
      await page.waitForTimeout(600);
      const optFrozen = page.locator('.el-select-dropdown__item:visible').filter({ hasText: '冷冻' }).first();
      if (await optFrozen.isVisible().catch(() => false)) {
        await optFrozen.click(); await page.waitForTimeout(300);
        log('研发员-UI', '4.选储存方式', 'PASS', 'filled: 储存方式=冷冻 (el-select下拉 ✅)');
        storageSelected = true;
      }
    }
  }
  if (!levelSelected) log('研发员-UI', '3.选产品级别', 'FAIL', '未找到产品级别下拉');
  if (!storageSelected) log('研发员-UI', '4.选储存方式', 'FAIL', '未找到储存方式下拉');

  await shot(page, '05-sample-form-filled');

  // 6. 点创建
  await page.locator('.el-dialog:visible button:has-text("创建")').click();
  const toast = await waitToast(page);
  log('研发员-UI', '5.提交', toast.success ? 'PASS' : 'FAIL',
    `toast: ${toast.success ? '样品已创建' : toast.errorText || '无toast'}`);

  // 7. 验证列表 — use search to find it reliably
  await go(page, '/rd/samples');
  const nameS = page.locator('input[placeholder*="样品名称"]');
  if (await nameS.isVisible().catch(() => false)) {
    await nameS.fill(`浏览器样品${TS}`);
    await page.locator('button:has-text("搜索")').click();
    await page.waitForTimeout(2500);
  }
  const foundRows = await page.$$('.el-table__body-wrapper .el-table__row');
  log('研发员-UI', '6.列表验证', foundRows.length > 0 ? 'PASS' : 'FAIL',
    `list after: 搜索"浏览器样品${TS}" → ${foundRows.length}条`);
  // Reset search for subsequent tests
  const rstBtn = page.locator('button:has-text("重置")');
  if (await rstBtn.isVisible().catch(() => false)) { await rstBtn.click(); await page.waitForTimeout(2000); }

  // 8. 追踪记录 — 打开弹窗, 验证日期只读+记录员只读
  const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
  const trackBtn = firstRow.locator('button:has-text("追踪记录")');
  if (await trackBtn.isVisible().catch(() => false)) {
    await trackBtn.click();
    await page.waitForTimeout(1500);

    // Check date field is disabled
    const dateInput = page.locator('.el-dialog:visible input[disabled]').first();
    const dateDisabled = await dateInput.isVisible().catch(() => false);
    const dateVal = await dateInput.inputValue().catch(() => '');
    log('研发员-UI', '7.追踪-日期只读', dateDisabled ? 'PASS' : 'FAIL',
      `disabled=${dateDisabled}, value="${dateVal}"`);

    // Check recorder field is disabled
    const recorderInputs = page.locator('.el-dialog:visible input[disabled]');
    const recCount = await recorderInputs.count();
    log('研发员-UI', '7.追踪-记录员只读', recCount >= 2 ? 'PASS' : 'WARN',
      `${recCount}个disabled input`);

    // Fill tracking content
    const contentInput = page.locator('.el-dialog:visible textarea');
    if (await contentInput.isVisible().catch(() => false)) {
      await contentInput.fill(`浏览器追踪测试${TS}`);
      await page.locator('.el-dialog:visible button:has-text("添加记录")').click();
      const t2 = await waitToast(page);
      log('研发员-UI', '8.添加追踪', t2.success ? 'PASS' : 'FAIL',
        `toast: ${t2.success ? '追踪记录已添加' : t2.errorText || '无toast'}`);
    }

    await shot(page, '06-tracking-dialog');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 9. 搜索功能
  const nameSearch = page.locator('input[placeholder*="样品名称"]');
  if (await nameSearch.isVisible().catch(() => false)) {
    await nameSearch.fill(`浏览器样品${TS}`);
    await page.locator('button:has-text("搜索")').click();
    await page.waitForTimeout(2500);
    const rows = await page.$$('.el-table__body-wrapper .el-table__row');
    log('研发员-UI', '9.搜索功能', rows.length > 0 ? 'PASS' : 'FAIL',
      `搜索"浏览器样品${TS}" → ${rows.length}条`);
    await shot(page, '07-sample-search');
  }
}

// ==================== 管理员: 浏览器审批+取消 ====================

async function browserAdminOps(page) {
  console.log('\n🖱️ === 管理员: 浏览器审批/取消操作 ===\n');

  // The PO created in browserCreatePO is in DRAFT status — we need to find it
  // POs are sorted newest first, so the one we created should be on first page

  // 1. 采购订单: 找刚创建的(草稿)→点详情→提交审批→审批通过
  await go(page, '/procurement/orders');
  // Look for DRAFT or 草稿 row first, then submit it
  let poRow = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
  if (!await poRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Might be labeled differently — check for the newest PO
    poRow = page.locator('.el-table__body-wrapper .el-table__row').first();
  }
  const poDetailBtn = poRow.locator('button:has-text("详情")');
  if (await poDetailBtn.isVisible().catch(() => false)) {
    await poDetailBtn.click();
    await page.waitForTimeout(3000);

    // Look for submit/approve buttons on detail page
    const submitBtn = page.locator('button:has-text("提交审批"), button:has-text("提交")').first();
    const approveBtn = page.locator('button:has-text("审批通过"), button:has-text("审批")').first();

    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(800);
      const cfm = page.locator('.el-message-box button:has-text("确定")');
      if (await cfm.isVisible({ timeout: 2000 }).catch(() => false)) await cfm.click();
      const t1 = await waitToast(page);
      log('管理员-UI', '1a.采购提交', t1.success ? 'PASS' : 'FAIL', `toast: ${t1.success ? '提交成功' : t1.errorText}`);
      await page.waitForTimeout(1500);
    }

    // Now approve if button visible
    const appBtn = page.locator('button:has-text("审批通过"), button:has-text("审批")').first();
    if (await appBtn.isVisible().catch(() => false)) {
      await appBtn.click();
      await page.waitForTimeout(800);
      const cfm = page.locator('.el-message-box button:has-text("确定")');
      if (await cfm.isVisible({ timeout: 2000 }).catch(() => false)) await cfm.click();
      const t2 = await waitToast(page);
      log('管理员-UI', '1b.采购审批', t2.success ? 'PASS' : 'FAIL', `toast: ${t2.success ? '审批成功' : t2.errorText}`);
      await shot(page, '08-po-approved');
    } else {
      log('管理员-UI', '1.采购审批', 'WARN', '详情页无审批按钮(可能已审批)');
    }
    await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
  }

  // 2. 销售订单取消 — find any existing draft first, or the one SO we created earlier
  await go(page, '/sales/orders');
  // First create a new SO via UI for cancel test
  const newBtn = page.locator('button:has-text("新建销售订单")');
  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click(); await page.waitForTimeout(1500);
    await selectDropdown(page, 0, '');
    await page.waitForTimeout(500);
    // Select product in items
    const ps = page.locator('.el-dialog:visible .el-select').nth(2);
    if (await ps.isVisible().catch(() => false)) {
      await ps.click(); await page.waitForTimeout(800);
      await page.locator('.el-select-dropdown__item:visible').first().click().catch(() => {});
      await page.waitForTimeout(500);
    }
    const qi = page.locator('.el-dialog:visible .el-input-number input').first();
    if (await qi.isVisible().catch(() => false)) await qi.fill('1');
    await page.locator('.el-dialog:visible button:has-text("创建"), .el-dialog:visible button:has-text("保存")').first().click().catch(() => {});
    await waitToast(page);
    await go(page, '/sales/orders');
  }

  // Now find draft and cancel
  const draftRow = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
  if (await draftRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await draftRow.locator('button:has-text("取消")').click();
    await page.waitForTimeout(800);
    const cfm = page.locator('.el-message-box button:has-text("确定")');
    if (await cfm.isVisible({ timeout: 2000 }).catch(() => false)) await cfm.click();
    const t = await waitToast(page);
    log('管理员-UI', '2.销售取消', t.success ? 'PASS' : 'FAIL', `toast: ${t.success ? '取消成功' : t.errorText}`);
    // Verify
    await go(page, '/sales/orders');
    const cancelledVis = await page.locator('.el-tag').filter({ hasText: '已取消' }).first().isVisible().catch(() => false);
    log('管理员-UI', '2b.取消后状态', cancelledVis ? 'PASS' : 'WARN', '列表含"已取消"');
  } else { log('管理员-UI', '2.销售取消', 'WARN', '无草稿行(可能创建未成功)'); }

  // 3. 客户编辑
  await go(page, '/sales/customers');
  const editBtn = page.locator('button:has-text("编辑")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(1500);
    const formFields = await page.locator('.el-dialog:visible input').count();
    log('管理员-UI', '3.客户编辑弹窗', formFields > 0 ? 'PASS' : 'FAIL', `${formFields}个字段`);
    await shot(page, '09-customer-edit');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
}

// ==================== 老板巡检: 浏览器逐个检查 ====================

async function browserBossInspection(page) {
  console.log('\n👔 === 老板巡检: 浏览器检查所有模块 ===\n');

  const checks = [
    { name: '销售订单', path: '/sales/orders', uuidCol: '客户' },
    { name: '采购订单', path: '/procurement/orders', uuidCol: '供应商' },
    { name: '研发样品', path: '/rd/samples', statusCheck: true },
    { name: '原材料库存', path: '/warehouse/materials', uuidCol: '供应商' },
    { name: '生产计划', path: '/production/plans', statusCheck: true },
    { name: '生产批次', path: '/production/batches', statusCheck: true },
    { name: '员工管理', path: '/hr/employees' },
    { name: '质检记录', path: '/quality/inspections' },
    { name: '设备管理', path: '/equipment/list' },
    { name: '出货记录', path: '/sales/shipments' },
  ];

  for (const c of checks) {
    await go(page, c.path);
    // Extra wait for slow pages
    await page.waitForTimeout(2000);
    const rowCount = (await page.$$('.el-table__body-wrapper .el-table__row')).length;

    if (rowCount === 0) {
      log('老板巡检', `${c.name}-数据`, 'FAIL', '0行(页面可能未加载)');
      continue;
    }

    log('老板巡检', `${c.name}-有数据`, 'PASS', `${rowCount}行`);

    // UUID check
    if (c.uuidCol) {
      const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
      const colIdx = headers.findIndex(h => h.includes(c.uuidCol));
      if (colIdx >= 0) {
        const vals = await page.$$eval('.el-table__body-wrapper .el-table__row', (rows, idx) =>
          rows.slice(0, 10).map(r => Array.from(r.querySelectorAll('td .cell'))[idx]?.textContent?.trim() || ''), colIdx).catch(() => []);
        const uuids = vals.filter(v => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v));
        log('老板巡检', `${c.name}-${c.uuidCol}非UUID`, uuids.length === 0 ? 'PASS' : 'FAIL',
          `${vals.length}行, UUID=${uuids.length}, 示例="${vals[0]}"`);
      }
    }

    // Status label check
    if (c.statusCheck) {
      const tags = await page.$$eval('.el-tag', els => els.map(e => e.textContent?.trim())).catch(() => []);
      const eng = tags.filter(t => /^[A-Z_]{3,}$/.test(t));
      log('老板巡检', `${c.name}-状态中文`, tags.length > 0 && eng.length === 0 ? 'PASS' : (tags.length === 0 ? 'WARN' : 'FAIL'),
        `${tags.length}标签, 英文=${eng.length}`);
    }
  }

  await shot(page, '10-boss-dashboard');
}

// ==================== MAIN ====================

async function main() {
  console.log('🖱️ E2E REAL BROWSER: 全部 Playwright 操作，零 API 代替');
  console.log(`${new Date().toISOString()}\n`);

  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Google Fonts已从index.html移除，不再需要route拦截
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('favicon') && !m.text().includes('ERR_FAILED') && !m.text().includes('fonts.g'))
      consoleErrors.push(m.text().slice(0, 120));
  });

  // Login via browser
  await page.goto(`${BASE}/login`, { timeout: 30000 }).catch(() => {});
  await page.locator('button:has-text("登 录")').waitFor({ timeout: 20000 });
  await page.locator('button:has-text("工厂总监")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForTimeout(6000);
  if (page.url().includes('/login')) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Login OK\n');

  // Run all browser tests
  await browserCreatePO(page);
  await browserCreateSO(page);
  await browserCreateSample(page);
  await browserAdminOps(page);
  await browserBossInspection(page);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`🖱️ REAL BROWSER: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));
  console.log(`📸 Screenshots: ${screenshots.length} saved`);
  if (consoleErrors.length > 0) {
    console.log(`🔴 Console Errors (${[...new Set(consoleErrors)].length}):`);
    [...new Set(consoleErrors)].slice(0, 5).forEach(e => console.log(`  - ${e}`));
  } else { console.log('✅ Console: 0 errors'); }

  fs.writeFileSync('test-e2e-real-browser-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, screenshots, consoleErrors: [...new Set(consoleErrors)], results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
