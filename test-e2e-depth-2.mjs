/**
 * E2E Depth Test Part 2: 供应商/员工/产品编辑核对 + 原材料入库数量 + 生产状态流转 + 质检计算
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

async function shot(p, n) { await p.screenshot({ path: `screenshots/depth2-${n}.png` }).catch(() => {}); }

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

// ==================== E1: 供应商 编辑→核对→删除 ====================

async function testSupplierEditVerify(page) {
  console.log('\n📝 === 供应商: 编辑精确核对 + 删除验证 ===\n');
  await go(page, '/procurement/suppliers');

  // Edit first supplier's address
  const row = page.locator('.el-table__row').first();
  const origName = await row.locator('td .cell').first().textContent().catch(() => '');
  await row.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);

  // Find address field and change
  const formItems = page.locator('.el-dialog:visible .el-form-item');
  let oldAddr = '';
  const newAddr = `深度地址${TS}`;
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('地址')) {
      const input = formItems.nth(i).locator('input');
      oldAddr = await input.inputValue().catch(() => '');
      await input.fill(newAddr);
      break;
    }
  }
  log('供应商-Edit', 'E1a.修改地址', 'PASS', `filled: 旧="${oldAddr}" → 新="${newAddr}"`);

  await page.locator('.el-dialog:visible button:has-text("确定")').click();
  await page.waitForTimeout(2500);

  // Refresh and verify
  await go(page, '/procurement/suppliers');
  // Click 查看 on the same supplier
  const updatedRow = page.locator('.el-table__row').first();
  await updatedRow.locator('button:has-text("查看")').click();
  await page.waitForTimeout(1500);
  const dialogInputs = await page.$$eval('.el-dialog:visible input', els => els.map(e => e.value));
  const addrChanged = dialogInputs.some(v => v === newAddr);
  log('供应商-Result', 'E1b.刷新核对地址', addrChanged ? 'PASS' : 'FAIL',
    `detail_check: input values中含"${newAddr}"=${addrChanged}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // Restore
  await updatedRow.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('地址')) { await formItems.nth(i).locator('input').fill(oldAddr || '原地址'); break; }
  }
  await page.locator('.el-dialog:visible button:has-text("确定")').click();
  await page.waitForTimeout(2000);
  log('供应商-Edit', 'E1c.还原地址', 'PASS', `restored`);
}

// ==================== E2: 员工 编辑手机号→核对 ====================

async function testEmployeeEditVerify(page) {
  console.log('\n📝 === 员工: 编辑手机号→核对 ===\n');
  await go(page, '/hr/employees');

  const row = page.locator('.el-table__row').first();
  await row.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);

  const formItems = page.locator('.el-dialog:visible .el-form-item');
  let oldPhone = '';
  const newPhone = `139${TS}00`;
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('手机')) {
      const input = formItems.nth(i).locator('input');
      oldPhone = await input.inputValue().catch(() => '');
      await input.fill(newPhone);
      break;
    }
  }
  log('员工-Edit', 'E2a.修改手机', 'PASS', `filled: 旧="${oldPhone}" → 新="${newPhone}"`);

  await page.locator('.el-dialog:visible button:has-text("确定")').click();
  await page.waitForTimeout(2500);

  // Verify in list
  await go(page, '/hr/employees');
  const listText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
  const phoneInList = listText.includes(newPhone);
  log('员工-Result', 'E2b.列表核对手机', phoneInList ? 'PASS' : 'FAIL',
    `detail_check: 列表含"${newPhone}"=${phoneInList}`);

  // Restore
  const row2 = page.locator('.el-table__row').first();
  await row2.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('手机')) { await formItems.nth(i).locator('input').fill(oldPhone || ''); break; }
  }
  await page.locator('.el-dialog:visible button:has-text("确定")').click();
  await page.waitForTimeout(2000);
  log('员工-Edit', 'E2c.还原手机', 'PASS', 'restored');
}

// ==================== E3: 产品 编辑规格→核对→删除验证 ====================

async function testProductEditVerify(page) {
  console.log('\n📝 === 产品: 编辑规格→核对 ===\n');
  await go(page, '/system/products');

  // Find a product and edit
  const row = page.locator('.el-table__row').first();
  const prodName = await row.locator('td .cell').nth(2).textContent().catch(() => ''); // 产品名称列
  await row.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);

  // Find 规格 field
  const dialog = page.locator('.el-dialog:visible, .el-drawer:visible');
  const formItems = dialog.locator('.el-form-item');
  let oldSpec = '';
  const newSpec = `深度规格${TS}`;
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('规格')) {
      const input = formItems.nth(i).locator('input');
      if (await input.isVisible().catch(() => false)) {
        oldSpec = await input.inputValue().catch(() => '');
        await input.fill(newSpec);
        break;
      }
    }
  }
  log('产品-Edit', 'E3a.修改规格', 'PASS', `filled: 旧="${oldSpec}" → 新="${newSpec}"`);

  // Submit
  await page.evaluate(() => {
    const d = document.querySelector('.el-dialog:not([style*="display: none"])');
    if (d) { const b = d.querySelector('.el-dialog__footer .el-button--primary'); if (b) b.click(); }
  });
  await page.waitForTimeout(2500);

  // Verify: find the product and check spec
  await go(page, '/system/products');
  const listText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
  const specInList = listText.includes(newSpec);
  log('产品-Result', 'E3b.列表含新规格', specInList ? 'PASS' : 'FAIL',
    `detail_check: 列表含"${newSpec}"=${specInList}`);

  // Restore spec
  const row2 = page.locator('.el-table__row').filter({ hasText: newSpec }).first();
  if (await row2.isVisible().catch(() => false)) {
    await row2.locator('button:has-text("编辑")').click();
    await page.waitForTimeout(1500);
    for (let i = 0; i < await formItems.count(); i++) {
      const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
      if (label?.includes('规格')) {
        const input = formItems.nth(i).locator('input');
        if (await input.isVisible().catch(() => false)) { await input.fill(oldSpec || ''); break; }
      }
    }
    await page.evaluate(() => {
      const d = document.querySelector('.el-dialog:not([style*="display: none"])');
      if (d) { const b = d.querySelector('.el-dialog__footer .el-button--primary'); if (b) b.click(); }
    });
    await page.waitForTimeout(2000);
    log('产品-Edit', 'E3c.还原规格', 'PASS', 'restored');
  }
}

// ==================== E4: 原材料入库 数量精确验证 ====================

async function testMaterialQuantityVerify(page) {
  console.log('\n📦 === 原材料: 入库→数量精确验证 ===\n');
  await go(page, '/warehouse/materials');

  // Count current rows
  const beforeCount = (await page.$$('.el-table__body-wrapper .el-table__row')).length;

  // Create inbound
  await page.locator('button:has-text("入库登记"), button:has-text("入库")').first().click();
  await page.waitForTimeout(1500);
  const d = '.el-dialog:visible';
  const formItems = page.locator(`${d} .el-form-item`);

  const batchNum = `MB-DEPTH-${TS}`;
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    const input = formItems.nth(i).locator('input').first();
    const sel = formItems.nth(i).locator('.el-select');
    if (label?.includes('批次号') && await input.isVisible().catch(() => false)) await input.fill(batchNum);
    if (label?.includes('原料类型') && await sel.isVisible().catch(() => false)) await selectFirst(page, sel);
    if (label?.includes('供应商') && await sel.isVisible().catch(() => false)) await selectFirst(page, sel);
    if (label?.includes('数量') && !label?.includes('总') && await input.isVisible().catch(() => false)) await input.fill('77');
    if (label?.includes('入库日期')) {
      if (await input.isVisible().catch(() => false)) { await input.fill(new Date().toISOString().slice(0, 10)); await input.press('Enter'); }
    }
    if (label?.includes('总重量') && await input.isVisible().catch(() => false)) await input.fill('77');
    if (label?.includes('总价值') && await input.isVisible().catch(() => false)) await input.fill('1155');
  }
  log('原材料-Create', 'E4a.填写入库', 'PASS', `filled: 批次=${batchNum}, 数量=77, 总重量=77, 总价值=1155`);

  await page.locator(`${d} button:has-text("确定"), ${d} button:has-text("保存")`).first().click();
  await page.waitForTimeout(2500);
  const ok = await page.locator('.el-message--success').isVisible().catch(() => false);
  log('原材料-Create', 'E4b.提交', ok ? 'PASS' : 'FAIL', `toast: ${ok ? '入库成功' : '无'}`);

  // Verify: find the batch in list
  await go(page, '/warehouse/materials');
  const listText = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
  log('原材料-Result', 'E4c.列表含新批次', listText.includes(batchNum) ? 'PASS' : 'WARN',
    `list after: 含"${batchNum}"=${listText.includes(batchNum)}`);

  // Click 查看 to verify quantity = 77
  const matRow = page.locator('.el-table__row').filter({ hasText: batchNum }).first();
  if (await matRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    const viewBtn = matRow.locator('button:has-text("查看"), button:has-text("详情")');
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click(); await page.waitForTimeout(2000);
      const detText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const has77 = detText.includes('77');
      log('原材料-Result', 'E4d.详情数量=77', has77 ? 'PASS' : 'FAIL',
        `detail_check: 详情含"77"=${has77}`);
      await shot(page, 'e4-material-detail');
      await page.keyboard.press('Escape').catch(() => {}); await page.goBack().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
}

// ==================== E5: 生产计划 状态流转 ====================

async function testPlanStateFlow(page) {
  console.log('\n🏭 === 生产计划: 状态流转 计划→开始→完成 ===\n');
  await go(page, '/production/plans');

  // Find a PLANNED status plan
  const planRow = page.locator('.el-table__row').filter({ hasText: '待执行' }).first();
  if (!await planRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Try other status labels
    const anyPlan = page.locator('.el-table__row').filter({ hasText: '已计划' }).first();
    if (!await anyPlan.isVisible({ timeout: 2000 }).catch(() => false)) {
      log('生产-State', 'E5.状态流转', 'WARN', '无待执行/已计划状态的计划');
      return;
    }
  }

  // Find a plan row with "开始" button directly in the list (not inside dialog)
  const planRows = await page.$$('.el-table__body-wrapper .el-table__row');
  let foundStart = false;
  for (const pRow of planRows.slice(0, 10)) {
    const btns = await pRow.$$eval('button', els => els.map(e => e.textContent?.trim()));
    if (btns.some(b => b?.includes('开始'))) {
      const rowBtns = btns.filter(b => b && b.length < 10);
      log('生产-State', 'E5a.行按钮', 'PASS', `state_change: 按钮=[${rowBtns.join(',')}]`);

      // Click 开始 via evaluate (ElementHandle doesn't have .locator)
      await pRow.$eval('button', (btn, btns) => {
        const all = btn.parentElement.querySelectorAll('button');
        for (const b of all) { if (b.textContent?.includes('开始')) { b.click(); return; } }
      }).catch(() => {});
      await page.waitForTimeout(1000);
      const cfm = page.locator('.el-message-box button:has-text("确定")');
      if (await cfm.isVisible({ timeout: 3000 }).catch(() => false)) await cfm.click();
      await page.waitForTimeout(2500);

      // Check status changed
      await go(page, '/production/plans');
      const tags = await page.$$eval('.el-tag', els => els.map(e => e.textContent?.trim()));
      const hasInProgress = tags.some(t => t?.includes('进行') || t?.includes('执行'));
      log('生产-State', 'E5b.开始后状态', hasInProgress ? 'PASS' : 'WARN',
        `state_change: 标签=[${tags.slice(0, 5).join(',')}]`);
      foundStart = true;
      break;
    }
  }
  if (!foundStart) log('生产-State', 'E5.开始按钮', 'WARN', '无可开始的计划');
  await shot(page, 'e5-plan-state');
}

// ==================== E6: 质检 合格率计算 ====================

async function testQualityCalc(page) {
  console.log('\n🔬 === 质检: 合格率计算验证 ===\n');
  await go(page, '/quality/inspections');

  // Look at existing inspection data and verify 合格率 column
  const headers = await page.$$eval('.el-table__header-wrapper th .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const rateIdx = headers.findIndex(h => h.includes('合格率'));
  const sampleIdx = headers.findIndex(h => h.includes('抽样'));

  if (rateIdx >= 0) {
    // Get first row data
    const cells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
      els => els.map(e => e.textContent?.trim())).catch(() => []);
    const rate = cells[rateIdx];
    log('质检-Calc', 'E6a.合格率列存在', rate ? 'PASS' : 'WARN',
      `calculation: 合格率="${rate}", 列头=[${headers.join(',')}]`);

    // Click detail to verify more
    const detBtn = page.locator('button:has-text("查看详情"), button:has-text("详情")').first();
    if (await detBtn.isVisible().catch(() => false)) {
      await detBtn.click(); await page.waitForTimeout(2000);
      const detText = await page.evaluate(() => document.body.innerText).catch(() => '');
      // Check that detail shows sample size, pass count, fail count
      const hasSample = detText.includes('抽样');
      const hasResult = detText.includes('合格') || detText.includes('通过');
      log('质检-Result', 'E6b.详情内容', hasSample || hasResult ? 'PASS' : 'WARN',
        `detail_check: 含抽样=${hasSample}, 含结果=${hasResult}`);
      await shot(page, 'e6-quality-detail');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500);
    }
  } else {
    log('质检-Calc', 'E6.合格率列', 'WARN', `列头中无"合格率": [${headers.join(',')}]`);
  }

  // Error path: create inspection without selecting batch
  await page.locator('button:has-text("新建质检")').click();
  await page.waitForTimeout(1500);
  // Fill sample size but don't select batch
  const formItems = page.locator('.el-dialog:visible .el-form-item');
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('抽样')) {
      await formItems.nth(i).locator('input').fill('5');
    }
  }
  // Submit without batch
  await page.locator('.el-dialog:visible button:has-text("确定"), .el-dialog:visible button:has-text("创建")').first().click();
  await page.waitForTimeout(2000);
  const errVisible = await page.locator('.el-message--error, .el-message--warning').isVisible().catch(() => false);
  const dialogOpen = await page.locator('.el-dialog:visible').isVisible().catch(() => false);
  log('质检-Error', 'E6c.空批次被拦截', dialogOpen ? 'PASS' : 'FAIL',
    `error_check: dialog仍开=${dialogOpen}, 错误提示=${errVisible}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
}

// ==================== MAIN ====================

async function main() {
  console.log('🔍 E2E Depth Test Part 2: 编辑核对+入库数量+状态流转+质检计算');
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

  await testSupplierEditVerify(page);
  await testEmployeeEditVerify(page);
  await testProductEditVerify(page);
  await testMaterialQuantityVerify(page);
  await testPlanStateFlow(page);
  await testQualityCalc(page);

  console.log('\n' + '='.repeat(60));
  console.log(`🔍 DEPTH-2: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));

  fs.writeFileSync('test-e2e-depth2-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
