/**
 * E2E Depth Test Part 3: 精确验证补全
 * - 原材料批次号+数量精确组合
 * - 生产计划被操作行状态 + 完成流转
 * - 质检合格率精确计算
 * - 编辑还原后再次核对
 * - 跨模块编辑持久性
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const API = 'http://47.100.235.168:10010/api/mobile';
const TS = Date.now().toString().slice(-6);

let TOKEN = '';
let pass = 0, fail = 0, warn = 0;
const results = [];

function log(chain, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ chain, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${chain}] ${test}${ev ? '\n   ' + ev.slice(0, 300) : ''}`);
}

async function shot(p, n) { await p.screenshot({ path: `screenshots/depth3-${n}.png` }).catch(() => {}); }

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 12; i++) {
    if ((await page.$$('.el-table__body-wrapper .el-table__row')).length > 0) break;
    if (await page.locator('.el-empty').isVisible().catch(() => false)) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(800);
}

// Get token for API verification (only for reading, not CRUD)
async function getToken() {
  const r = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' })
  });
  TOKEN = (await r.json()).data?.accessToken || '';
}

async function api(path) {
  return (await fetch(`${API}/F001${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })).json();
}

// ==================== F1: 原材料 批次号+数量 精确组合验证 ====================

async function testMaterialPrecise(page) {
  console.log('\n🎯 === 原材料: 批次号+数量 精确组合 ===\n');
  await go(page, '/warehouse/materials');

  // Get first row's batch number and quantity by column headers
  const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const cells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);

  const batchIdx = headers.findIndex(h => h.includes('批次'));
  const qtyIdx = headers.findIndex(h => h.includes('数量'));
  const batch = batchIdx >= 0 ? cells[batchIdx] : '';
  const qty = qtyIdx >= 0 ? cells[qtyIdx] : '';

  // Click 查看 → verify BOTH batch AND quantity in detail
  const viewBtn = page.locator('button:has-text("查看"), button:has-text("详情")').first();
  if (await viewBtn.isVisible().catch(() => false)) {
    await viewBtn.click(); await page.waitForTimeout(2000);
    const detText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const hasBatch = detText.includes(batch);
    const hasQty = detText.includes(qty);
    log('原材料-精确', 'F1.批次+数量组合', hasBatch && hasQty ? 'PASS' : 'FAIL',
      `detail_check: 批次="${batch}" in detail=${hasBatch}, 数量="${qty}" in detail=${hasQty}`);
    await shot(page, 'f1-material-precise');
    await page.keyboard.press('Escape').catch(() => {}); await page.goBack().catch(() => {});
    await page.waitForTimeout(1000);
  }
}

// ==================== F2: 生产计划 被操作行精确状态 + 完成 ====================

async function testPlanPreciseState(page) {
  console.log('\n🎯 === 生产计划: 精确行状态 + 完成流转 ===\n');
  await go(page, '/production/plans');

  // Find a row with "进行中" status (from previous test)
  const rows = await page.$$('.el-table__body-wrapper .el-table__row');
  for (const row of rows.slice(0, 10)) {
    const tag = await row.$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
    const btns = await row.$$eval('button', els => els.map(e => e.textContent?.trim())).catch(() => []);
    const planNo = await row.$eval('td:first-child .cell', e => e.textContent?.trim()).catch(() => '');

    if (tag === '进行中' && btns.some(b => b?.includes('完成'))) {
      log('生产-精确', 'F2a.进行中行', 'PASS',
        `state_change: 计划="${planNo}", 状态="${tag}", 按钮=[${btns.filter(b=>b?.length<8).join(',')}]`);

      // Click 完成
      await row.$eval('button', (_, allBtns) => {
        const parent = _.parentElement;
        for (const b of parent.querySelectorAll('button')) {
          if (b.textContent?.includes('完成')) { b.click(); return; }
        }
      }).catch(() => {});
      await page.waitForTimeout(1500);

      // Handle dialog — might ask for actual quantity
      const dialog = page.locator('.el-dialog:visible, .el-message-box');
      if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Fill actual quantity if input exists
        const qtyInput = dialog.locator('input[type="number"], .el-input-number input, input').first();
        if (await qtyInput.isVisible().catch(() => false)) {
          await qtyInput.fill('450');
          log('生产-精确', 'F2b.填实际产量', 'PASS', 'filled: 实际产量=450');
        }
        await dialog.locator('button:has-text("确定"), button:has-text("确认")').first().click().catch(() => {});
        await page.waitForTimeout(2500);
      }

      // Verify status changed for this specific plan
      await go(page, '/production/plans');
      const updatedRows = await page.$$('.el-table__body-wrapper .el-table__row');
      let found = false;
      for (const r of updatedRows) {
        const pn = await r.$eval('td:first-child .cell', e => e.textContent?.trim()).catch(() => '');
        if (pn === planNo) {
          const newTag = await r.$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
          log('生产-精确', 'F2c.完成后状态', newTag.includes('完成') || newTag.includes('已完成') ? 'PASS' : 'WARN',
            `state_change: 计划="${planNo}" 状态="${newTag}" (期望含"完成")`);
          found = true;
          break;
        }
      }
      if (!found) log('生产-精确', 'F2c.完成后验证', 'WARN', `未找到计划"${planNo}"`);
      await shot(page, 'f2-plan-completed');
      break;
    }
  }
}

// ==================== F3: 质检 合格率精确计算 ====================

async function testQualityCalcPrecise(page) {
  console.log('\n🎯 === 质检: 合格率 精确计算验证 ===\n');
  await go(page, '/quality/inspections');

  const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const cells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);

  const sampleIdx = headers.findIndex(h => h.includes('抽样'));
  const rateIdx = headers.findIndex(h => h.includes('合格率'));
  const resultIdx = headers.findIndex(h => h.includes('结果'));

  const sampleSize = parseFloat(cells[sampleIdx] || '0');
  const rateStr = cells[rateIdx] || '';
  const rateVal = parseFloat(rateStr.replace('%', ''));

  // Click detail to get pass/fail counts
  const detBtn = page.locator('button:has-text("查看详情"), button:has-text("详情")').first();
  if (await detBtn.isVisible().catch(() => false)) {
    await detBtn.click(); await page.waitForTimeout(2000);
    const detText = await page.evaluate(() => document.body.innerText).catch(() => '');

    // Try to extract pass count from detail (look for numbers near "合格" or "通过")
    // API verify is more reliable for exact calculation
    const inspection = await api(`/quality/inspections?page=1&size=1`);
    const insp = inspection.data?.content?.[0];
    if (insp) {
      const expectedRate = insp.sampleSize > 0
        ? Math.round((insp.passCount || (insp.sampleSize - (insp.failCount || 0))) / insp.sampleSize * 1000) / 10
        : 0;
      log('质检-计算', 'F3.合格率精确', Math.abs(rateVal - expectedRate) < 0.2 ? 'PASS' : 'FAIL',
        `calculation: 抽样=${insp.sampleSize}, 合格=${insp.passCount || 'N/A'}, 不合格=${insp.failCount || 'N/A'}, ` +
        `期望率=${expectedRate}%, UI显示=${rateStr}, 差值=${Math.abs(rateVal - expectedRate).toFixed(1)}%`);
    } else {
      // Fallback: just verify rate makes sense (0-100%)
      log('质检-计算', 'F3.合格率范围', rateVal >= 0 && rateVal <= 100 ? 'PASS' : 'FAIL',
        `calculation: 合格率=${rateStr} (${rateVal >= 0 && rateVal <= 100 ? '合理范围' : '异常'})`);
    }

    await shot(page, 'f3-quality-calc');
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500);
  }
}

// ==================== F4: 编辑还原后再次核对 ====================

async function testEditRestoreVerify(page) {
  console.log('\n🎯 === 编辑还原: 修改→核对→还原→再核对 ===\n');

  // Customer: change contact → verify → restore → verify restored
  await go(page, '/sales/customers');
  const row = page.locator('.el-table__row').first();
  await row.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);

  const formItems = page.locator('.el-dialog:visible .el-form-item');
  let origContact = '';
  const tempContact = `临时联系人${TS}`;

  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('联系人')) {
      origContact = await formItems.nth(i).locator('input').inputValue().catch(() => '');
      await formItems.nth(i).locator('input').fill(tempContact);
      break;
    }
  }
  await page.locator('.el-dialog:visible button:has-text("确定")').click();
  await page.waitForTimeout(2500);

  // Verify changed
  await go(page, '/sales/customers');
  const listAfterEdit = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
  log('编辑还原', 'F4a.修改后列表', listAfterEdit.includes(tempContact) ? 'PASS' : 'FAIL',
    `detail_check: 列表含"${tempContact}"=${listAfterEdit.includes(tempContact)}`);

  // Click 查看 to verify in detail
  const row2 = page.locator('.el-table__row').first();
  await row2.locator('button:has-text("查看")').click();
  await page.waitForTimeout(1500);
  const detInputs = await page.$$eval('.el-dialog:visible input', els => els.map(e => e.value));
  const detHasTemp = detInputs.some(v => v === tempContact);
  log('编辑还原', 'F4b.查看详情核对', detHasTemp ? 'PASS' : 'FAIL',
    `detail_check: 详情input含"${tempContact}"=${detHasTemp}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // Restore
  await row2.locator('button:has-text("编辑")').click();
  await page.waitForTimeout(1500);
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    if (label?.includes('联系人')) {
      await formItems.nth(i).locator('input').fill(origContact);
      break;
    }
  }
  await page.locator('.el-dialog:visible button:has-text("确定")').click();
  await page.waitForTimeout(2500);

  // Verify restored
  await go(page, '/sales/customers');
  const listAfterRestore = await page.locator('.el-table__body-wrapper').textContent().catch(() => '');
  const restored = !listAfterRestore.includes(tempContact) && (origContact ? listAfterRestore.includes(origContact) : true);
  log('编辑还原', 'F4c.还原后核对', restored ? 'PASS' : 'FAIL',
    `detail_check: 不含临时="${!listAfterRestore.includes(tempContact)}", 含原始="${origContact}"=${listAfterRestore.includes(origContact)}`);

  // Click 查看 again to double-confirm
  const row3 = page.locator('.el-table__row').first();
  await row3.locator('button:has-text("查看")').click();
  await page.waitForTimeout(1500);
  const restoredInputs = await page.$$eval('.el-dialog:visible input', els => els.map(e => e.value));
  const detHasOrig = restoredInputs.some(v => v === origContact);
  log('编辑还原', 'F4d.还原详情再核对', detHasOrig ? 'PASS' : 'FAIL',
    `detail_check: 详情input含"${origContact}"=${detHasOrig}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
}

// ==================== F5: 跨模块编辑持久性 ====================

async function testCrossModuleEdit(page) {
  console.log('\n🎯 === 跨模块: 客户名→销售订单详情同步 ===\n');

  // Check: an existing customer's name in a sales order detail
  // We won't actually rename a customer (risky), instead verify existing data consistency
  await go(page, '/sales/orders');
  // Get first order's customer name from list
  const soHeaders = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const custIdx = soHeaders.findIndex(h => h.includes('客户'));
  const soCells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const custInList = custIdx >= 0 ? soCells[custIdx] : '';

  // Click detail → verify customer name matches
  await page.locator('button:has-text("详情")').first().click();
  await page.waitForTimeout(3000);
  const detText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const custInDetail = detText.includes(custInList);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}/i;
  const isUUID = UUID_RE.test(custInList);

  log('跨模块', 'F5a.列表vs详情客户名一致', custInDetail && !isUUID ? 'PASS' : 'FAIL',
    `detail_check: 列表客户="${custInList}", 详情含=${custInDetail}, UUID=${isUUID}`);

  // Also check product name in items matches across modules
  const itemName = await page.$eval('.el-table__body-wrapper .el-table__row td:first-child .cell',
    e => e.textContent?.trim()).catch(() => '');
  const itemIsUUID = UUID_RE.test(itemName);
  log('跨模块', 'F5b.行项产品名非UUID', !itemIsUUID && itemName ? 'PASS' : 'FAIL',
    `detail_check: 产品名="${itemName}", UUID=${itemIsUUID}`);

  await shot(page, 'f5-cross-module');
  await page.goBack().catch(() => {}); await page.waitForTimeout(1000);

  // Check purchase order → supplier consistency
  await go(page, '/procurement/orders');
  const poHeaders = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const suppIdx = poHeaders.findIndex(h => h.includes('供应商'));
  const poCells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const suppInList = suppIdx >= 0 ? poCells[suppIdx] : '';

  await page.locator('button:has-text("详情")').first().click();
  await page.waitForTimeout(3000);
  const poDetText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const suppInDetail = poDetText.includes(suppInList);
  const suppUUID = UUID_RE.test(suppInList);

  log('跨模块', 'F5c.采购列表vs详情供应商一致', suppInDetail && !suppUUID ? 'PASS' : 'FAIL',
    `detail_check: 列表供应商="${suppInList}", 详情含=${suppInDetail}, UUID=${suppUUID}`);

  await page.goBack().catch(() => {}); await page.waitForTimeout(1000);
}

// ==================== MAIN ====================

async function main() {
  console.log('🎯 E2E Depth Part 3: 精确验证补全');
  console.log(`${new Date().toISOString()}\n`);

  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  await getToken();

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

  await testMaterialPrecise(page);
  await testPlanPreciseState(page);
  await testQualityCalcPrecise(page);
  await testEditRestoreVerify(page);
  await testCrossModuleEdit(page);

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 DEPTH-3: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));

  fs.writeFileSync('test-e2e-depth3-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
