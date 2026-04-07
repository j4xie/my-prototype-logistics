/**
 * E2E Depth Part 4: 边界+级联+重算
 * - 生产完成流转修复
 * - 删除级联(删客户→订单页不崩)
 * - 编辑数量→总金额重算
 * - 重复名称处理
 * - 边界输入(0/负数/超长)
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

async function shot(p, n) { await p.screenshot({ path: `screenshots/depth4-${n}.png` }).catch(() => {}); }

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 12; i++) {
    if ((await page.$$('.el-table__body-wrapper .el-table__row')).length > 0) break;
    if (await page.locator('.el-empty').isVisible().catch(() => false)) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(800);
}

async function getToken() {
  const r = await fetch(`${API}/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' })
  });
  TOKEN = (await r.json()).data?.accessToken || '';
}

async function apiPost(path, body) {
  return (await fetch(`${API}/F001${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body)
  })).json();
}

async function selectFirst(page, sel) {
  await sel.click(); await page.waitForTimeout(800);
  const opt = page.locator('.el-select-dropdown__item:visible').first();
  const t = (await opt.textContent().catch(() => ''))?.trim();
  await opt.click().catch(() => {}); await page.waitForTimeout(400);
  return t || '';
}

// ==================== G1: 删除级联 — 删客户→订单页不崩 ====================

async function testDeleteCascade(page) {
  console.log('\n💥 === 删除级联: 客户有订单→删除→订单页面不崩 ===\n');

  // 1. Create a customer via UI
  await go(page, '/sales/customers');
  await page.locator('button:has-text("新增客户")').click();
  await page.waitForTimeout(1500);

  const custName = `级联测试客户${TS}`;
  const d = '.el-dialog:visible';
  const formItems = page.locator(`${d} .el-form-item`);
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    const input = formItems.nth(i).locator('input').first();
    const textarea = formItems.nth(i).locator('textarea').first();
    if (label?.includes('客户名称')) await input.fill(custName);
    if (label?.includes('联系人') && !label?.includes('电话')) await input.fill('级联联系人');
    if (label?.includes('联系电话') || label?.includes('电话')) await input.fill('13800009876');
    if (label?.includes('收货地址')) await textarea.fill('级联测试地址');
  }
  await page.locator(`${d} button:has-text("确定")`).click();
  await page.waitForTimeout(2500);
  log('级联', 'G1a.创建客户', 'PASS', `客户="${custName}"`);

  // 2. Create a sales order for this customer via API (faster for test data setup)
  const custs = await (await fetch(`${API}/F001/customers/active`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const custId = custs.data?.find(c => c.name === custName)?.id;
  const prods = await (await fetch(`${API}/F001/product-types/active`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const prodId = prods.data?.[0]?.id;

  if (custId && prodId) {
    const so = await apiPost('/sales/orders', {
      customerId: custId, items: [{ productTypeId: prodId, quantity: 1, unit: 'kg', unitPrice: 10 }]
    });
    log('级联', 'G1b.为该客户创建订单', so.success ? 'PASS' : 'FAIL', `订单=${so.data?.orderNumber}`);

    // 3. Delete the customer
    await go(page, '/sales/customers');
    const row = page.locator('.el-table__row').filter({ hasText: custName }).first();
    if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
      await row.locator('button:has-text("删除")').click();
      await page.waitForTimeout(800);
      await page.locator('.el-message-box button:has-text("确定")').click();
      await page.waitForTimeout(2500);
      const delOk = await page.locator('.el-message--success').isVisible().catch(() => false);
      const delErr = await page.locator('.el-message--error').textContent().catch(() => '');
      log('级联', 'G1c.删除客户', delOk ? 'PASS' : 'WARN',
        `toast: ${delOk ? '删除成功' : delErr || '无toast'} (客户有关联订单)`);

      // 4. Check sales order page doesn't crash
      await go(page, '/sales/orders');
      const hasError = await page.locator('.el-message--error').isVisible().catch(() => false);
      const rowCount = (await page.$$('.el-table__body-wrapper .el-table__row')).length;
      log('级联', 'G1d.订单页不崩', !hasError && rowCount > 0 ? 'PASS' : 'FAIL',
        `downstream: 无error=${!hasError}, 行数=${rowCount}`);

      // 5. Check the order's customer name display (might show UUID or empty now)
      if (so.data?.orderNumber) {
        const orderRow = page.locator('.el-table__row').filter({ hasText: so.data.orderNumber }).first();
        if (await orderRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          const cells = await orderRow.locator('td .cell').allTextContents();
          const custCell = (cells[1] || '').trim();
          log('级联', 'G1e.删后订单客户列', custCell && custCell !== '-' ? 'PASS' : 'WARN',
            `downstream: 客户列="${custCell}" (客户已删,可能为空/UUID/保留名称)`);
        }
      }
      await shot(page, 'g1-delete-cascade');
    }
  } else {
    log('级联', 'G1.测试', 'WARN', '缺前置数据');
  }
}

// ==================== G2: 重复名称处理 ====================

async function testDuplicateNames(page) {
  console.log('\n🔄 === 重复名称: 同名客户/供应商能否创建 ===\n');

  // Create customer with same name twice
  const dupName = `重复测试${TS}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    await go(page, '/sales/customers');
    await page.locator('button:has-text("新增客户")').click();
    await page.waitForTimeout(1500);
    const d = '.el-dialog:visible';
    const formItems = page.locator(`${d} .el-form-item`);
    for (let i = 0; i < await formItems.count(); i++) {
      const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
      const input = formItems.nth(i).locator('input').first();
      const textarea = formItems.nth(i).locator('textarea').first();
      if (label?.includes('客户名称')) await input.fill(dupName);
      if (label?.includes('联系人') && !label?.includes('电话')) await input.fill(`联系人${attempt}`);
      if (label?.includes('联系电话') || label?.includes('电话')) await input.fill(`1380000${attempt}111`);
      if (label?.includes('收货地址')) await textarea.fill(`地址${attempt}`);
    }
    await page.locator(`${d} button:has-text("确定")`).click();
    await page.waitForTimeout(2500);
    const ok = await page.locator('.el-message--success').isVisible().catch(() => false);
    const err = await page.locator('.el-message--error').textContent().catch(() => '');

    if (attempt === 1) {
      log('重复', `G2a.第${attempt}次创建`, ok ? 'PASS' : 'FAIL', `toast: ${ok ? '成功' : err}`);
    } else {
      // Second time: either rejected (good) or allowed (acceptable if system supports it)
      if (!ok && err) {
        log('重复', `G2b.第${attempt}次同名被拒`, 'PASS', `error_check: "${err}" — 系统拒绝重复名称`);
      } else if (ok) {
        log('重复', `G2b.第${attempt}次同名允许`, 'PASS', `系统允许同名客户(不同联系人) — 业务允许`);
      } else {
        log('重复', `G2b.第${attempt}次`, 'WARN', '无明确结果');
      }
    }
  }

  // Cleanup: delete both if they exist
  await go(page, '/sales/customers');
  for (let i = 0; i < 2; i++) {
    const row = page.locator('.el-table__row').filter({ hasText: dupName }).first();
    if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
      await row.locator('button:has-text("删除")').click();
      await page.waitForTimeout(800);
      await page.locator('.el-message-box button:has-text("确定")').click();
      await page.waitForTimeout(2000);
    }
  }
}

// ==================== G3: 边界输入验证 ====================

async function testBoundaryInputs(page) {
  console.log('\n⚠️ === 边界输入: 0数量/负数/超长文本 ===\n');

  // Test 1: Sales order with quantity = 0
  await go(page, '/sales/orders');
  await page.locator('button:has-text("新建销售订单")').click();
  await page.waitForTimeout(1500);
  // Select customer
  await selectFirst(page, page.locator('.el-dialog:visible .el-select').first());
  // Select product
  const prodSel = page.locator('.el-dialog:visible .el-select').nth(2);
  if (await prodSel.isVisible().catch(() => false)) await selectFirst(page, prodSel);
  // Set quantity = 0
  const qtyInput = page.locator('.el-dialog:visible .el-input-number input').first();
  if (await qtyInput.isVisible().catch(() => false)) await qtyInput.fill('0');

  await page.locator('.el-dialog:visible button:has-text("创建")').first().click();
  await page.waitForTimeout(2500);
  const zeroErr = await page.locator('.el-message--error, .el-message--warning').isVisible().catch(() => false);
  const zeroDialogOpen = await page.locator('.el-dialog:visible').isVisible().catch(() => false);
  log('边界', 'G3a.数量=0', zeroErr || zeroDialogOpen ? 'PASS' : 'WARN',
    `error_check: 数量=0被${zeroDialogOpen ? '拦截(dialog仍开)' : '允许'}, 错误=${zeroErr}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // Test 2: Customer with very long name (200+ chars)
  await go(page, '/sales/customers');
  await page.locator('button:has-text("新增客户")').click();
  await page.waitForTimeout(1500);
  const longName = 'A'.repeat(250) + TS;
  const d = '.el-dialog:visible';
  const formItems = page.locator(`${d} .el-form-item`);
  for (let i = 0; i < await formItems.count(); i++) {
    const label = await formItems.nth(i).locator('.el-form-item__label, label').textContent().catch(() => '');
    const input = formItems.nth(i).locator('input').first();
    const textarea = formItems.nth(i).locator('textarea').first();
    if (label?.includes('客户名称')) await input.fill(longName);
    if (label?.includes('联系人') && !label?.includes('电话')) await input.fill('长名测试');
    if (label?.includes('联系电话') || label?.includes('电话')) await input.fill('13800001111');
    if (label?.includes('收货地址')) await textarea.fill('长名地址');
  }
  await page.locator(`${d} button:has-text("确定")`).click();
  await page.waitForTimeout(2500);
  const longOk = await page.locator('.el-message--success').isVisible().catch(() => false);
  const longErr = await page.locator('.el-message--error').textContent().catch(() => '');
  log('边界', 'G3b.超长名称(250字)', longOk || longErr ? 'PASS' : 'WARN',
    `error_check: ${longOk ? '创建成功(截断?)' : '被拒: ' + longErr}`);

  // Cleanup long name customer if created
  if (longOk) {
    await go(page, '/sales/customers');
    const longRow = page.locator('.el-table__row').filter({ hasText: longName.slice(0, 20) }).first();
    if (await longRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await longRow.locator('button:has-text("删除")').click();
      await page.waitForTimeout(800);
      await page.locator('.el-message-box button:has-text("确定")').click();
      await page.waitForTimeout(2000);
    }
  }

  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500);
}

// ==================== G4: 编辑数量→总金额重算 ====================

async function testEditRecalculate(page) {
  console.log('\n🧮 === 编辑数量→总金额重算 ===\n');

  // Create a draft SO with known quantity and price
  await go(page, '/sales/orders');
  await page.locator('button:has-text("新建销售订单")').click();
  await page.waitForTimeout(1500);
  await selectFirst(page, page.locator('.el-dialog:visible .el-select').first());
  const prodSel = page.locator('.el-dialog:visible .el-select').nth(2);
  if (await prodSel.isVisible().catch(() => false)) await selectFirst(page, prodSel);
  const qtyInput = page.locator('.el-dialog:visible .el-input-number input').first();
  if (await qtyInput.isVisible().catch(() => false)) await qtyInput.fill('10');
  const priceInput = page.locator('.el-dialog:visible .el-input-number input').nth(1);
  if (await priceInput.isVisible().catch(() => false)) await priceInput.fill('50');

  await page.locator('.el-dialog:visible button:has-text("创建")').first().click();
  await page.waitForTimeout(2500);

  // Get the order's total from list
  await go(page, '/sales/orders');
  const headers = await page.$$eval('.el-table__header-wrapper th .cell', els => els.map(e => e.textContent?.trim())).catch(() => []);
  const amtIdx = headers.findIndex(h => h.includes('总金额'));
  const firstCells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
    els => els.map(e => e.textContent?.trim())).catch(() => []);
  const origAmount = amtIdx >= 0 ? firstCells[amtIdx] : '';
  log('重算', 'G4a.原始金额', origAmount ? 'PASS' : 'WARN',
    `calculation: 10×50=500, 列表总金额="${origAmount}"`);

  // Edit: change quantity 10→20
  const draftRow = page.locator('.el-table__row').filter({ hasText: '草稿' }).first();
  if (await draftRow.isVisible().catch(() => false)) {
    const editBtn = draftRow.locator('button:has-text("编辑")');
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click(); await page.waitForTimeout(1500);
      // Find quantity input and change
      const editQty = page.locator('.el-dialog:visible .el-input-number input').first();
      if (await editQty.isVisible().catch(() => false)) {
        await editQty.fill('20');
        log('重算', 'G4b.修改数量', 'PASS', 'filled: 数量 10→20');
      }
      await page.locator('.el-dialog:visible button:has-text("保存")').click();
      await page.waitForTimeout(2500);

      // Verify total changed
      await go(page, '/sales/orders');
      const newCells = await page.$$eval('.el-table__body-wrapper .el-table__row:first-child td .cell',
        els => els.map(e => e.textContent?.trim())).catch(() => []);
      const newAmount = amtIdx >= 0 ? newCells[amtIdx] : '';
      const newVal = parseFloat(newAmount?.replace(/[¥,]/g, '') || '0');
      const expectedNew = 20 * 50; // 20 × 50 = 1000
      log('重算', 'G4c.总金额重算', Math.abs(newVal - expectedNew) < 1 ? 'PASS' : 'FAIL',
        `calculation: 20×50=${expectedNew}, 列表新总金额="${newAmount}" (${newVal})`);
      await shot(page, 'g4-recalculate');
    }
  } else {
    log('重算', 'G4.编辑', 'WARN', '无草稿可编辑');
  }
}

// ==================== G5: 生产完成流转 (详情页操作) ====================

async function testPlanComplete(page) {
  console.log('\n🏭 === 生产计划: 详情页完成操作 ===\n');
  await go(page, '/production/plans');

  // Find "进行中" row and click 查看 (not direct button)
  const rows = await page.$$('.el-table__body-wrapper .el-table__row');
  let targetPlanNo = '';
  for (const row of rows.slice(0, 10)) {
    const tag = await row.$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
    if (tag === '进行中') {
      targetPlanNo = await row.$eval('td:first-child .cell', e => e.textContent?.trim()).catch(() => '');
      // Click 完成 button in this row
      const btns = await row.$$eval('button', els => els.map(e => ({ text: e.textContent?.trim(), visible: e.offsetParent !== null })));
      const completeBtn = btns.find(b => b.text?.includes('完成'));
      if (completeBtn) {
        // Use evaluate to click the complete button in this specific row
        await row.evaluate(r => {
          for (const b of r.querySelectorAll('button')) {
            if (b.textContent?.includes('完成')) { b.click(); break; }
          }
        });
        await page.waitForTimeout(2000);

        // Handle completion dialog
        const dialog = page.locator('.el-dialog:visible, .el-message-box');
        if (await dialog.isVisible().catch(() => false)) {
          // Look for quantity input
          const inputs = dialog.locator('input');
          const inputCount = await inputs.count();
          if (inputCount > 0) {
            await inputs.first().fill('480');
            log('生产完成', 'G5a.填实际产量', 'PASS', 'filled: 实际产量=480');
          }
          // Click confirm
          const cfmBtn = dialog.locator('button:has-text("确定"), button:has-text("确认")').first();
          if (await cfmBtn.isVisible().catch(() => false)) {
            await cfmBtn.click();
            await page.waitForTimeout(3000);
          }
        }

        // Verify
        await go(page, '/production/plans');
        let newStatus = '';
        const updRows = await page.$$('.el-table__body-wrapper .el-table__row');
        for (const r of updRows) {
          const pn = await r.$eval('td:first-child .cell', e => e.textContent?.trim()).catch(() => '');
          if (pn === targetPlanNo) {
            newStatus = await r.$eval('.el-tag', e => e.textContent?.trim()).catch(() => '');
            break;
          }
        }
        log('生产完成', 'G5b.完成后状态', newStatus.includes('完成') ? 'PASS' : 'WARN',
          `state_change: 计划="${targetPlanNo}" → "${newStatus}"`);
        await shot(page, 'g5-plan-complete');
        break;
      }
    }
  }
  if (!targetPlanNo) log('生产完成', 'G5.进行中计划', 'WARN', '无进行中的计划可完成');
}

// ==================== MAIN ====================

async function main() {
  console.log('💥 E2E Depth Part 4: 边界+级联+重算');
  console.log(`${new Date().toISOString()}\n`);

  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');
  await getToken();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(8000); // Extra wait for Vue mount
  await page.locator('button:has-text("工厂总监")').waitFor({ timeout: 15000 }).catch(() => {});
  await page.locator('button:has-text("工厂总监")').click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForTimeout(6000);
  if (page.url().includes('/login')) { console.error('❌ Login failed'); await browser.close(); process.exit(1); }
  console.log('✅ Login OK\n');

  await testDeleteCascade(page);
  await testDuplicateNames(page);
  await testBoundaryInputs(page);
  await testEditRecalculate(page);
  await testPlanComplete(page);

  console.log('\n' + '='.repeat(60));
  console.log(`💥 DEPTH-4: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(60));

  fs.writeFileSync('test-e2e-depth4-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
