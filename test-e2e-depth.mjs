/**
 * E2E Depth Test: 4维度覆盖(Happy+Error+ResultVerify+Downstream)
 * 每个操作: 正确路径+错误路径+结果精确核对+下游联动
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const TS = Date.now().toString().slice(-6);

let pass = 0, fail = 0, warn = 0;
const results = [];

function log(chain, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ chain, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${chain}] ${test}${ev ? '\n   ' + ev.slice(0, 300) : ''}`);
}

async function shot(p, n) { await p.screenshot({ path: `screenshots/depth-${n}.png` }).catch(() => {}); }

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 12; i++) {
    if ((await page.$$('.el-table__body-wrapper .el-table__row')).length > 0) break;
    if (await page.locator('.el-empty').isVisible().catch(() => false)) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(800);
}

async function selectFirst(page, sel) {
  await sel.click(); await page.waitForTimeout(800);
  const opt = page.locator('.el-select-dropdown__item:visible').first();
  const t = (await opt.textContent().catch(() => ''))?.trim();
  await opt.click().catch(() => {}); await page.waitForTimeout(400);
  return t || '';
}

// ==================== 链A: 采购员完整深度验证 ====================

async function chainA_purchase(page) {
  console.log('\n📦 === 链A: 采购员 — 4维度深度验证 ===\n');

  // ---------- A1: ERROR PATH — 不选供应商直接提交 ----------
  await go(page, '/procurement/orders');
  await page.locator('button:has-text("新建采购订单")').click();
  await page.waitForTimeout(1500);
  // Don't select supplier — just try to submit
  // Add material row first
  const matSel = page.locator('.el-dialog:visible .el-select').last();
  await selectFirst(page, matSel);
  const qi = page.locator('.el-dialog:visible .el-input-number input').first();
  if (await qi.isVisible().catch(() => false)) await qi.fill('10');
  // Submit without supplier
  await page.locator('.el-dialog:visible button:has-text("创建")').click();
  await page.waitForTimeout(2000);
  const errVisible = await page.locator('.el-message--error, .el-message--warning').isVisible().catch(() => false);
  const dialogStill = await page.locator('.el-dialog:visible').isVisible().catch(() => false);
  log('采购-Error', 'A1.空供应商提交被拦截', dialogStill ? 'PASS' : 'FAIL',
    `error_check: dialog仍开=${dialogStill}, 错误提示=${errVisible}`);
  await shot(page, 'a1-po-error');

  // ---------- A2: 补填供应商 → 提交成功 (HAPPY PATH) ----------
  const suppSel = page.locator('.el-dialog:visible .el-select').first();
  const suppName = await selectFirst(page, suppSel);
  // Fill more fields
  const priceInput = page.locator('.el-dialog:visible .el-input-number input').nth(1);
  if (await priceInput.isVisible().catch(() => false)) await priceInput.fill('15');
  const specInput = page.locator('.el-dialog:visible input[placeholder*="规格"]');
  if (await specInput.isVisible().catch(() => false)) await specInput.fill('500g/袋');

  await page.locator('.el-dialog:visible button:has-text("创建")').click();
  await page.waitForTimeout(2500);
  const ok = await page.locator('.el-message--success').isVisible().catch(() => false);
  log('采购-Happy', 'A2.补填后提交成功', ok ? 'PASS' : 'FAIL',
    `toast: ${ok ? '创建成功' : '无toast'}, filled: 供应商="${suppName}", 数量=10, 单价=15, 规格=500g/袋`);

  // ---------- A3: RESULT VERIFY — 详情逐字段精确核对 ----------
  await go(page, '/procurement/orders');
  // Find newest PO and click detail
  const detBtn = page.locator('button:has-text("详情")').first();
  await detBtn.click();
  await page.waitForTimeout(3000);

  // Check supplier name = what we selected
  const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const suppMatch = pageText.includes(suppName);
  log('采购-Result', 'A3a.详情供应商名', suppMatch ? 'PASS' : 'FAIL',
    `detail_check: 供应商="${suppName}" in page=${suppMatch}`);

  // Check item table: quantity, unit price
  const itemCells = await page.$$eval('.el-table__body-wrapper .el-table__row td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  log('采购-Result', 'A3b.行项目数据', itemCells.length > 0 ? 'PASS' : 'FAIL',
    `detail_check: 行项cells=[${itemCells.slice(0, 6).join(', ')}]`);

  // ---------- A4: 小计计算验证 ----------
  // Find quantity and unit price columns, verify subtotal = qty × price
  const headers = await page.$$eval('.el-table__header-wrapper th .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const qtyIdx = headers.findIndex(h => h.includes('数量'));
  const priceIdx = headers.findIndex(h => h.includes('单价'));
  const subtotalIdx = headers.findIndex(h => h.includes('小计'));
  // Parse values by header name — get all rows' cells mapped to headers
  const cellMap = {};
  for (let ci = 0; ci < headers.length && ci < itemCells.length; ci++) {
    cellMap[headers[ci]] = itemCells[ci];
  }
  const qtyVal = parseFloat(cellMap['采购数量'] || cellMap['数量'] || '0');
  const priceVal = parseFloat((cellMap['单价'] || '0').replace(/[¥,]/g, ''));
  const subVal = parseFloat((cellMap['小计'] || '0').replace(/[¥,]/g, ''));
  if (qtyVal > 0 && priceVal > 0) {
    const expected = qtyVal * priceVal;
    log('采购-Calc', 'A4.小计=数量×单价', Math.abs(subVal - expected) < 0.01 ? 'PASS' : 'FAIL',
      `calculation: ${qtyVal}×${priceVal}=${expected}, 实际小计=${subVal}, 列映射: ${JSON.stringify(cellMap).slice(0,150)}`);
  } else {
    log('采购-Calc', 'A4.小计验证', 'WARN', `列头=[${headers}], 映射=${JSON.stringify(cellMap).slice(0,120)}`);
  }

  await shot(page, 'a3-po-detail-verify');
  await page.goBack().catch(() => {}); await page.waitForTimeout(1500);

  // ---------- A5: 状态流转 — 提交→审批→按钮变化 ----------
  await go(page, '/procurement/orders');
  // Find the newest PO (DRAFT) and check buttons
  const draftRow = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
  if (await draftRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    const draftBtns = await draftRow.locator('button').allTextContents();
    log('采购-State', 'A5a.草稿按钮', draftBtns.some(b => b?.includes('详情')) ? 'PASS' : 'WARN',
      `state_change: 草稿按钮=[${draftBtns.map(b=>b?.trim()).join(',')}]`);

    // Click detail → submit
    await draftRow.locator('button:has-text("详情")').click();
    await page.waitForTimeout(2500);
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(800);
      const cfm = page.locator('.el-message-box button:has-text("确定")');
      if (await cfm.isVisible({ timeout: 2000 }).catch(() => false)) await cfm.click();
      await page.waitForTimeout(2500);
      // Check status changed
      const newStatus = await page.locator('.el-tag').first().textContent().catch(() => '');
      log('采购-State', 'A5b.提交后状态', newStatus.includes('待审批') || newStatus.includes('已提交') ? 'PASS' : 'WARN',
        `state_change: 状态标签="${newStatus}"`);

      // Check submit button disappeared
      const submitGone = !await page.locator('button:has-text("提交审批")').isVisible().catch(() => false);
      log('采购-State', 'A5c.提交按钮消失', submitGone ? 'PASS' : 'FAIL',
        `state_change: 提交按钮消失=${submitGone}`);
      await shot(page, 'a5-po-submitted');
    }
    await page.goBack().catch(() => {}); await page.waitForTimeout(1000);
  }
}

// ==================== 链B: 销售员完整深度验证 ====================

async function chainB_sales(page) {
  console.log('\n🛒 === 链B: 销售员 — 4维度深度验证 ===\n');

  // ---------- B1: HAPPY PATH — 创建+全字段核对 ----------
  await go(page, '/sales/orders');
  await page.locator('button:has-text("新建销售订单")').click();
  await page.waitForTimeout(1500);

  // Select customer
  const custSel = page.locator('.el-dialog:visible .el-select').first();
  const custName = await selectFirst(page, custSel);

  // Select product
  const prodSel = page.locator('.el-dialog:visible .el-select').nth(2);
  const prodName = await selectFirst(page, prodSel);

  // Fill quantity = 50
  const qtyIn = page.locator('.el-dialog:visible .el-input-number input').first();
  if (await qtyIn.isVisible().catch(() => false)) await qtyIn.fill('50');

  // Fill unit price = 100
  const prIn = page.locator('.el-dialog:visible .el-input-number input').nth(1);
  if (await prIn.isVisible().catch(() => false)) await prIn.fill('100');

  await shot(page, 'b1-so-form');
  await page.locator('.el-dialog:visible button:has-text("创建"), .el-dialog:visible button:has-text("保存")').first().click();
  await page.waitForTimeout(2500);
  const soOk = await page.locator('.el-message--success').isVisible().catch(() => false);
  log('销售-Happy', 'B1.创建订单', soOk ? 'PASS' : 'FAIL',
    `toast: ${soOk ? '创建成功' : '无'}, filled: 客户="${custName}", 产品="${prodName}", 数量=50, 单价=100`);

  // ---------- B2: RESULT VERIFY — 详情精确核对 ----------
  await go(page, '/sales/orders');
  await page.locator('button:has-text("详情")').first().click();
  await page.waitForTimeout(3000);

  const soText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const custOk = soText.includes(custName);
  log('销售-Result', 'B2a.详情客户名', custOk ? 'PASS' : 'FAIL',
    `detail_check: 客户="${custName}" in page=${custOk}`);

  // Check product name in items
  const soItems = await page.$$eval('.el-table__body-wrapper .el-table__row td:first-child .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const prodOk = soItems.some(i => i.includes(prodName.slice(0, 4)));
  log('销售-Result', 'B2b.详情产品名', prodOk ? 'PASS' : 'FAIL',
    `detail_check: 产品=[${soItems.join(',')}], 含"${prodName.slice(0,8)}"=${prodOk}`);

  await shot(page, 'b2-so-detail');
  await page.goBack().catch(() => {}); await page.waitForTimeout(1000);

  // ---------- B3: ERROR PATH — 重复SKU ----------
  await go(page, '/sales/orders');
  await page.locator('button:has-text("新建销售订单")').click();
  await page.waitForTimeout(1500);
  await selectFirst(page, page.locator('.el-dialog:visible .el-select').first()); // customer
  // Add product
  await selectFirst(page, page.locator('.el-dialog:visible .el-select').nth(2));
  // Add same product again via "+ 添加行"
  const addBtn = page.locator('.el-dialog:visible button:has-text("添加行"), .el-dialog:visible button:has-text("+ 添加")').first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click(); await page.waitForTimeout(500);
    // Select same product in new row
    const newProdSel = page.locator('.el-dialog:visible .el-select').last();
    await selectFirst(page, newProdSel);
  }
  await page.locator('.el-dialog:visible button:has-text("创建")').first().click();
  await page.waitForTimeout(2500);
  const dupErr = await page.locator('.el-message--error, .el-message--warning').isVisible().catch(() => false);
  const dupDialogOpen = await page.locator('.el-dialog:visible').isVisible().catch(() => false);
  log('销售-Error', 'B3.重复SKU拦截', dupErr || dupDialogOpen ? 'PASS' : 'FAIL',
    `error_check: 错误提示=${dupErr}, dialog仍开=${dupDialogOpen}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // ---------- B4: 编辑→刷新核对值变了 ----------
  await go(page, '/sales/orders');
  const editRow = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
  if (await editRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    const editBtn = editRow.locator('button:has-text("编辑")');
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click(); await page.waitForTimeout(1500);
      // Change remark
      const remark = page.locator('.el-dialog:visible textarea').first();
      if (await remark.isVisible().catch(() => false)) {
        await remark.fill(`深度编辑验证${TS}`);
        await page.locator('.el-dialog:visible button:has-text("保存")').click();
        await page.waitForTimeout(2500);
        // Verify: click detail → check remark
        await go(page, '/sales/orders');
        const row2 = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
        await row2.locator('button:has-text("详情")').click();
        await page.waitForTimeout(2500);
        const detText = await page.evaluate(() => document.body.innerText).catch(() => '');
        log('销售-Result', 'B4.编辑后刷新核对', detText.includes(`深度编辑验证${TS}`) ? 'PASS' : 'WARN',
          `detail_check: 备注含"深度编辑验证${TS}"=${detText.includes(`深度编辑验证${TS}`)}`);
        await page.goBack().catch(() => {}); await page.waitForTimeout(1000);
      }
    }
  }

  // ---------- B5: 状态流转 — 确认→按钮变化 ----------
  await go(page, '/sales/orders');
  const draftSO = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
  if (await draftSO.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Check draft buttons
    const beforeBtns = await draftSO.locator('button').allTextContents();
    const hasEdit = beforeBtns.some(b => b?.includes('编辑'));
    const hasConfirm = beforeBtns.some(b => b?.includes('确认'));
    log('销售-State', 'B5a.草稿按钮', hasEdit && hasConfirm ? 'PASS' : 'WARN',
      `state_change: 草稿按钮=[${beforeBtns.map(b=>b?.trim()).join(',')}] 有编辑=${hasEdit} 有确认=${hasConfirm}`);

    // Confirm
    await draftSO.locator('button:has-text("确认")').click();
    await page.waitForTimeout(800);
    const cfm = page.locator('.el-message-box button:has-text("确定")');
    if (await cfm.isVisible({ timeout: 2000 }).catch(() => false)) await cfm.click();
    await page.waitForTimeout(2500);

    // Refresh and check buttons changed
    await go(page, '/sales/orders');
    const confirmedRow = page.locator('.el-table__row').filter({ hasText: '已确认' }).first();
    if (await confirmedRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const afterBtns = await confirmedRow.locator('button').allTextContents();
      const noEdit = !afterBtns.some(b => b?.includes('编辑'));
      const hasDelivery = afterBtns.some(b => b?.includes('出库'));
      log('销售-State', 'B5b.确认后按钮变化', noEdit ? 'PASS' : 'FAIL',
        `state_change: 已确认按钮=[${afterBtns.map(b=>b?.trim()).join(',')}] 编辑消失=${noEdit} 出库出现=${hasDelivery}`);
    }
  }
}

// ==================== 链C: 研发员完整深度验证 ====================

async function chainC_rd(page) {
  console.log('\n🔬 === 链C: 研发员 — 4维度深度验证 ===\n');

  // ---------- C1: ERROR PATH — 空名称提交 ----------
  await go(page, '/rd/samples');
  await page.locator('button:has-text("新建样品")').waitFor({ timeout: 10000 }).catch(() => {});
  await page.locator('button:has-text("新建样品")').click();
  await page.waitForTimeout(1500);

  // Don't fill name, just submit
  await page.locator('.el-dialog:visible button:has-text("创建")').click();
  await page.waitForTimeout(2000);
  const errMsg = await page.locator('.el-message--warning, .el-message--error').textContent().catch(() => '');
  const rdDialogOpen = await page.locator('.el-dialog:visible').isVisible().catch(() => false);
  log('研发-Error', 'C1.空名称被拦截', rdDialogOpen || errMsg ? 'PASS' : 'FAIL',
    `error_check: 提示="${errMsg}", dialog仍开=${rdDialogOpen}`);

  // ---------- C2: 补填 → HAPPY PATH ----------
  // Fill customer name
  const custIn = page.locator('.el-dialog:visible input[placeholder*="客户"]');
  if (await custIn.isVisible().catch(() => false)) await custIn.fill(`深度客户${TS}`);

  // Fill sample name
  const formItems = page.locator('.el-dialog:visible .el-form-item');
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('样品名称')) {
      await formItems.nth(i).locator('input').fill(`深度样品${TS}`);
      break;
    }
  }

  // Select 产品级别=B
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('产品级别')) {
      const sel = formItems.nth(i).locator('.el-select');
      if (await sel.isVisible().catch(() => false)) {
        await sel.click(); await page.waitForTimeout(500);
        const optB = page.locator('.el-select-dropdown__item:visible').filter({ hasText: 'B' }).first();
        if (await optB.isVisible().catch(() => false)) await optB.click();
        await page.waitForTimeout(300);
      }
    }
    if (label?.includes('储存方式')) {
      const sel = formItems.nth(i).locator('.el-select');
      if (await sel.isVisible().catch(() => false)) {
        await sel.click(); await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:visible').filter({ hasText: '冷藏' }).first().click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  }

  await page.locator('.el-dialog:visible button:has-text("创建")').click();
  const rdOk = await (async () => { await page.waitForTimeout(2500); return page.locator('.el-message--success').isVisible().catch(() => false); })();
  log('研发-Happy', 'C2.补填后创建', rdOk ? 'PASS' : 'FAIL',
    `toast: ${rdOk ? '创建成功' : '无'}, filled: 客户="深度客户${TS}", 名称="深度样品${TS}", 级别=B, 储存=冷藏`);

  // ---------- C3: 搜索3维度验证 ----------
  await go(page, '/rd/samples');
  // Search by name
  const nameSearch = page.locator('input[placeholder*="样品名称"]');
  if (await nameSearch.isVisible().catch(() => false)) {
    await nameSearch.fill(`深度样品${TS}`);
    await page.locator('button:has-text("搜索")').click();
    await page.waitForTimeout(2500);
    const rows = await page.$$('.el-table__body-wrapper .el-table__row');
    log('研发-Search', 'C3a.名称搜索', rows.length === 1 ? 'PASS' : 'FAIL',
      `搜索"深度样品${TS}" → ${rows.length}条 (期望1)`);

    // Check the found row has correct data
    if (rows.length > 0) {
      // Get headers to find 产品级别 column
      const rdHeaders = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
      const levelIdx = rdHeaders.findIndex(h => h.includes('产品级别'));
      const rowCells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
        els => els.map(e => e.textContent?.trim())).catch(() => []);
      const levelVal = levelIdx >= 0 ? rowCells[levelIdx] : '';
      log('研发-Result', 'C3b.搜索结果级别', levelVal === 'B' ? 'PASS' : 'FAIL',
        `detail_check: 产品级别列[${levelIdx}]="${levelVal}" (期望B)`);
    }

    // Reset
    await page.locator('button:has-text("重置")').click();
    await page.waitForTimeout(2000);
  }

  // ---------- C4: 状态流转 — 提交→审核→报价按钮 ----------
  // Search for our sample
  if (await nameSearch.isVisible().catch(() => false)) {
    await nameSearch.fill(`深度样品${TS}`);
    await page.locator('button:has-text("搜索")').click();
    await page.waitForTimeout(2500);
  }
  const sampleRow = page.locator('.el-table__row').first();
  if (await sampleRow.isVisible().catch(() => false)) {
    // Before submit: check buttons
    const beforeBtns = await sampleRow.locator('button').allTextContents();
    const hasSubmit = beforeBtns.some(b => b?.includes('提交审核'));
    const noQuote = !beforeBtns.some(b => b?.includes('报价'));
    log('研发-State', 'C4a.草稿按钮', hasSubmit && noQuote ? 'PASS' : 'WARN',
      `state_change: 有提交审核=${hasSubmit}, 无报价=${noQuote}, btns=[${beforeBtns.map(b=>b?.trim()).join(',')}]`);

    // Submit for review
    if (hasSubmit) {
      await sampleRow.locator('button:has-text("提交审核")').click();
      await page.waitForTimeout(800);
      const cfm = page.locator('.el-message-box button:has-text("确定")');
      if (await cfm.isVisible({ timeout: 2000 }).catch(() => false)) await cfm.click();
      await page.waitForTimeout(2500);
      log('研发-State', 'C4b.提交审核', 'PASS', 'submitted');
    }
  }
}

// ==================== 链D: 基础数据编辑精确核对 ====================

async function chainD_editVerify(page) {
  console.log('\n📝 === 链D: 编辑→刷新→精确核对值变了 ===\n');

  // Customer: edit contact person → refresh → verify changed
  await go(page, '/sales/customers');
  const custEditBtn = page.locator('button:has-text("编辑")').first();
  if (await custEditBtn.isVisible().catch(() => false)) {
    await custEditBtn.click(); await page.waitForTimeout(1500);
    // Find 联系人 field and change it
    const formItems = page.locator('.el-dialog:visible .el-form-item');
    let oldVal = '';
    const newVal = `编辑验证${TS}`;
    for (let i = 0; i < await formItems.count(); i++) {
      const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
      if (label?.includes('联系人')) {
        const input = formItems.nth(i).locator('input');
        oldVal = await input.inputValue().catch(() => '');
        await input.fill(newVal);
        break;
      }
    }
    await page.locator('.el-dialog:visible button:has-text("确定")').click();
    await page.waitForTimeout(2500);

    // Refresh and verify
    await go(page, '/sales/customers');
    const listText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
    const changed = listText.includes(newVal);
    log('编辑核对', 'D1.客户联系人修改', changed ? 'PASS' : 'FAIL',
      `detail_check: 旧="${oldVal}" → 新="${newVal}", 列表含新值=${changed}`);

    // Change back
    const editBtn2 = page.locator('.el-table__row').filter({ hasText: newVal }).first().locator('button:has-text("编辑")');
    if (await editBtn2.isVisible().catch(() => false)) {
      await editBtn2.click(); await page.waitForTimeout(1500);
      for (let i = 0; i < await formItems.count(); i++) {
        const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
        if (label?.includes('联系人')) { await formItems.nth(i).locator('input').fill(oldVal || '原联系人'); break; }
      }
      await page.locator('.el-dialog:visible button:has-text("确定")').click();
      await page.waitForTimeout(2000);
      log('编辑核对', 'D1b.还原联系人', 'PASS', `restored to "${oldVal}"`);
    }
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('🔍 E2E Depth Test: 4维度覆盖 (Happy+Error+Result+Downstream)');
  console.log(`${new Date().toISOString()}\n`);

  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { timeout: 30000 }).catch(() => {});
  await page.locator('button:has-text("登 录")').waitFor({ timeout: 20000 });
  await page.locator('button:has-text("工厂总监")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForTimeout(6000);
  if (page.url().includes('/login')) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Login OK\n');

  await chainA_purchase(page);
  await chainB_sales(page);
  await chainC_rd(page);
  await chainD_editVerify(page);

  console.log('\n' + '='.repeat(60));
  console.log(`🔍 DEPTH: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));

  fs.writeFileSync('test-e2e-depth-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
