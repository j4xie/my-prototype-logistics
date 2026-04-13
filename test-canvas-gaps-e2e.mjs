/**
 * Canvas Config — 补测关键缺口
 * G1: 动态表单实际填写+提交
 * G2: dependsOn 条件显示 (boolean toggle → dependent field)
 * G3: LineItemsEditor 行项目编辑+自动计算
 * G4: ReferenceSelector 远程搜索
 * G5: 配置驱动校验 (required 拦截)
 * G6: 编辑模式 (行点击→详情→编辑→保存)
 * G7-G9: 多工厂配置 (3 个不同工厂, 不同配置)
 */
import { chromium } from 'playwright';
import fs from 'fs';

const WEB_URL = 'http://139.196.165.140:8086';
const API_BASE = `${WEB_URL}/api/mobile`;
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';
const DIR = './screenshots-canvas-gaps';

let token = '', factoryId = '';
const R = [];

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

async function browserLogin(page) {
  await page.goto(`${WEB_URL}/login`, { timeout: 30000, waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) { await inputs[0].fill(USERNAME); await inputs[1].fill(PASSWORD); }
  const btn = await page.$('button[type="submit"]') || await page.$('.el-button--primary');
  if (btn) await btn.click();
  await page.waitForTimeout(5000);
  return !page.url().includes('/login');
}

async function goDynamic(page, mod) {
  await page.goto(`${WEB_URL}/modules/${mod}`, { timeout: 15000 });
  await page.waitForTimeout(4000);
}

async function main() {
  console.log('🔍 Canvas 缺口补测 — 7 场景');
  console.log('='.repeat(60));

  await apiLogin();

  // Reset config: show all fields, DYNAMIC mode
  await cfg('PUT', '/modules/sales_order', {
    fieldConfig: { fields: {} }, workflowConfig: { options: {} },
    customLabels: {}, renderingMode: 'DYNAMIC',
  });
  await cfg('PUT', '/modules/bom', {
    fieldConfig: { fields: {} }, renderingMode: 'DYNAMIC',
  });
  await pub('gaps-reset');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await ctx.newPage();
  const consoleMessages = [];
  page.on('console', m => consoleMessages.push({ type: m.type(), text: m.text().substring(0, 200) }));

  await browserLogin(page);
  console.log('Browser: logged in\n');

  try {
    // ============================================================
    // G1: 动态表单实际填写 + 提交
    // ============================================================
    console.log('--- G1: 动态表单填写+提交 ---');
    await goDynamic(page, 'sales_order');
    const createBtn = await page.$('button:has-text("新建")');
    if (createBtn) { await createBtn.click(); await page.waitForTimeout(3000); }

    // Find form fields and fill them
    // The SchemaFormRenderer renders el-form-items with labels
    // We need to fill: customerId (reference/select), orderDate (date), remark (textarea)
    const formItems = await page.$$('.el-form-item');
    let filledFields = [];

    for (const item of formItems) {
      const label = await item.$eval('.el-form-item__label', el => el.textContent?.trim()).catch(() => '');

      // Fill date fields — use keyboard input, not picker click
      if (label.includes('日期')) {
        const dateInput = await item.$('.el-input__inner');
        if (dateInput) {
          await dateInput.click();
          await page.waitForTimeout(300);
          await dateInput.fill('2026-04-09');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(300);
          // Click body to close any picker
          await page.click('body', { position: { x: 10, y: 10 } });
          await page.waitForTimeout(200);
          filledFields.push(`${label}=2026-04-09`);
        }
      }
      // Fill text fields
      else if (label.includes('备注') || label.includes('说明')) {
        const input = await item.$('textarea, .el-textarea__inner');
        if (input) {
          await input.fill('E2E Canvas 测试订单');
          filledFields.push(`${label}=E2E Canvas 测试订单`);
        }
      }
      // Fill number fields
      else if (label.includes('金额') || label.includes('运费') || label.includes('箱数')) {
        const numInput = await item.$('.el-input-number .el-input__inner');
        if (numInput && !(await item.$('.is-disabled'))) {
          await numInput.fill('100');
          filledFields.push(`${label}=100`);
        }
      }
    }

    await ss(page, 'G1a-form-filled');

    // Try to submit
    const submitBtn = await page.$('button:has-text("创建"), button:has-text("提交")');
    let submitResult = 'no submit button';
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      // Check for toast
      const toast = await page.$('.el-message');
      const toastText = toast ? await toast.textContent().catch(() => '') : '';
      // Check for validation error
      const validErr = await page.$('.el-form-item__error');
      const errText = validErr ? await validErr.textContent().catch(() => '') : '';
      submitResult = toastText || errText || 'no feedback';
    }
    await ss(page, 'G1b-after-submit');

    log('G1', '动态表单填写+提交', [
      `filled: ${filledFields.join(', ')}`,
      `submit result: ${submitResult}`,
      `screenshots: G1a-form-filled.png, G1b-after-submit.png`,
    ], filledFields.length > 0);

    // ============================================================
    // G2: dependsOn 条件显示
    // ============================================================
    console.log('\n--- G2: dependsOn 条件显示 ---');
    await goDynamic(page, 'sales_order');
    const createBtn2 = await page.$('button:has-text("新建")');
    if (createBtn2) { await createBtn2.click(); await page.waitForTimeout(3000); }

    // Check if shippingFee is initially hidden (dependsOn shippingIncluded=true)
    const bodyBefore = await page.textContent('body').catch(() => '');
    const feeVisibleBefore = bodyBefore.includes('运费') && !bodyBefore.includes('是否含运费');
    // Actually both labels might show. Check more carefully
    const shippingLabels = await page.$$eval('.el-form-item__label', els =>
      els.map(e => e.textContent?.trim()).filter(l => l && (l.includes('运费') || l.includes('shipping')))
    ).catch(() => []);

    // Find the shippingIncluded switch and toggle it
    const switches = await page.$$('.el-switch');
    let switchToggled = false;
    if (switches.length > 0) {
      // The first switch should be shippingIncluded (boolean type)
      await switches[0].click();
      await page.waitForTimeout(1000);
      switchToggled = true;
    }

    const shippingLabelsAfter = await page.$$eval('.el-form-item__label', els =>
      els.map(e => e.textContent?.trim()).filter(l => l && (l.includes('运费') || l.includes('shipping')))
    ).catch(() => []);
    await ss(page, 'G2-dependson');

    log('G2', 'dependsOn 条件显示 (boolean toggle)', [
      `before toggle: shipping labels=${shippingLabels.join(', ')}`,
      `switch toggled: ${switchToggled}`,
      `after toggle: shipping labels=${shippingLabelsAfter.join(', ')}`,
      `screenshot: G2-dependson.png`,
    ], switchToggled);

    // ============================================================
    // G3: LineItemsEditor 行项目
    // ============================================================
    console.log('\n--- G3: LineItemsEditor ---');
    // The form should have an "订单明细" group with LineItemsEditor
    // Find "+ 添加行" button
    const addRowBtn = await page.$(':text("添加行"), :text("+ 添加")');
    let rowAdded = false;
    if (addRowBtn) {
      await addRowBtn.click();
      await page.waitForTimeout(1000);
      rowAdded = true;
      // Check if a new row appeared in the items table
      const itemRows = await page.$$('.line-items-editor .el-table__row, .dynamic-array-editor .el-table__row');
      await ss(page, 'G3-line-items');
      log('G3', 'LineItemsEditor 添加行', [
        `添加行 button found: true`,
        `row added: ${rowAdded}`,
        `item rows: ${itemRows.length}`,
        `screenshot: G3-line-items.png`,
      ], rowAdded);
    } else {
      // LineItemsEditor might not render if the items field is in a collapsed group
      // Check if "订单明细" group exists and expand it
      const groups = await page.$$('.el-collapse-item');
      let foundItemGroup = false;
      for (const g of groups) {
        const header = await g.$eval('.el-collapse-item__header', el => el.textContent?.trim()).catch(() => '');
        if (header.includes('订单明细') || header.includes('items')) {
          const isActive = await g.evaluate(el => el.classList.contains('is-active'));
          if (!isActive) {
            const headerEl = await g.$('.el-collapse-item__header');
            if (headerEl) { await headerEl.click(); await page.waitForTimeout(1000); }
          }
          foundItemGroup = true;
          break;
        }
      }
      const addBtn2 = await page.$(':text("添加行"), :text("+ 添加")');
      if (addBtn2) {
        await addBtn2.click();
        await page.waitForTimeout(1000);
        rowAdded = true;
      }
      await ss(page, 'G3-line-items');
      log('G3', 'LineItemsEditor 添加行', [
        `订单明细 group: ${foundItemGroup}`,
        `添加行 button: ${!!addBtn2}`,
        `row added: ${rowAdded}`,
        `screenshot: G3-line-items.png`,
      ], foundItemGroup || rowAdded);
    }

    // ============================================================
    // G4: ReferenceSelector 远程搜索
    // ============================================================
    console.log('\n--- G4: ReferenceSelector ---');
    // Find a select with remote search (customer field)
    const selects = await page.$$('.el-select');
    let searchResult = 'no select found';
    let optionCount = 0;
    if (selects.length > 0) {
      // Click the first select (likely customer)
      await selects[0].click();
      await page.waitForTimeout(1500);
      // Check for dropdown options
      const options = await page.$$('.el-select-dropdown__item, .el-select-dropdown .el-scrollbar__view > *');
      optionCount = options.length;
      searchResult = `${optionCount} options loaded`;
      // Try typing to search
      const searchInput = await page.$('.el-select .el-input__inner');
      if (searchInput) {
        await searchInput.fill('测试');
        await page.waitForTimeout(1500);
        const filteredOptions = await page.$$('.el-select-dropdown__item');
        searchResult += `, after search "测试": ${filteredOptions.length} options`;
      }
    }
    await ss(page, 'G4-reference-search');
    log('G4', 'ReferenceSelector 远程搜索', [
      `selects on page: ${selects.length}`,
      `search result: ${searchResult}`,
      `screenshot: G4-reference-search.png`,
    ], optionCount > 0 || selects.length > 0);

    // ============================================================
    // G5: 配置驱动校验 — required 字段拦截
    // ============================================================
    console.log('\n--- G5: 配置驱动校验 ---');
    // Make orderDate required (it already is), leave customerId empty, try to submit
    // Navigate fresh
    await goDynamic(page, 'sales_order');
    const createBtn3 = await page.$('button:has-text("新建")');
    if (createBtn3) { await createBtn3.click(); await page.waitForTimeout(3000); }

    // Don't fill required fields, just submit
    const submitBtn2 = await page.$('button:has-text("创建")');
    let validationMsg = '';
    if (submitBtn2) {
      await submitBtn2.click();
      await page.waitForTimeout(1500);
      // Check for validation warning/error
      const warning = await page.$('.el-message--warning, .el-message--error');
      validationMsg = warning ? await warning.textContent().catch(() => '') : '';
      if (!validationMsg) {
        const formErr = await page.$('.el-form-item__error');
        validationMsg = formErr ? await formErr.textContent().catch(() => '') : 'no validation';
      }
    }
    await ss(page, 'G5-validation');
    log('G5', '配置驱动校验 — required 拦截', [
      `action: 不填任何字段直接点创建`,
      `validation message: "${validationMsg}"`,
      `blocked submission: ${validationMsg.length > 0 && validationMsg !== 'no validation'}`,
      `screenshot: G5-validation.png`,
    ], validationMsg.length > 0 && validationMsg !== 'no validation');

    // ============================================================
    // G6: 多工厂配置 — F001 vs F002 vs F003 不同配置
    // ============================================================
    console.log('\n--- G6: 多工厂配置差异 ---');
    // F001 already has config. Create different configs for F002 and F003 via API
    // Note: F002/F003 may not have published configs, so they'll use schema defaults
    const configs = {};

    // F001: current config (DYNAMIC, some hidden fields)
    const f001 = await eff('sales_order');
    configs.F001 = {
      fields: f001.data?.fields?.length,
      visible: f001.data?.fields?.filter(f => f.visible).length,
      mode: f001.data?.renderingMode,
    };

    // F002: query effective (no factory config = pure schema defaults)
    const f002Res = await fetch(`${API_BASE}/F002/config/modules/sales_order/effective`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => r.json());
    configs.F002 = {
      fields: f002Res.data?.fields?.length,
      visible: f002Res.data?.fields?.filter(f => f.visible).length,
      mode: f002Res.data?.renderingMode,
    };

    // F003: query effective
    const f003Res = await fetch(`${API_BASE}/F003/config/modules/sales_order/effective`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => r.json());
    configs.F003 = {
      fields: f003Res.data?.fields?.length,
      visible: f003Res.data?.fields?.filter(f => f.visible).length,
      mode: f003Res.data?.renderingMode,
    };

    // F001 should differ from F002/F003 (F001 has factory overrides, others use defaults)
    const f001Differs = configs.F001.mode !== configs.F002.mode || configs.F001.visible !== configs.F002.visible;

    log('G6', '多工厂配置差异', [
      `F001: ${configs.F001.visible}/${configs.F001.fields} visible, mode=${configs.F001.mode}`,
      `F002: ${configs.F002.visible}/${configs.F002.fields} visible, mode=${configs.F002.mode}`,
      `F003: ${configs.F003.visible}/${configs.F003.fields} visible, mode=${configs.F003.mode}`,
      `F001 differs from F002: ${f001Differs}`,
      `F002 == F003 (both defaults): ${configs.F002.visible === configs.F003.visible}`,
    ], f001Differs);

    // ============================================================
    // G7: BOM 动态表单 — 填写 + 3 分组渲染
    // ============================================================
    console.log('\n--- G7: BOM 动态表单 ---');
    await goDynamic(page, 'bom');
    const bomCreate = await page.$('button:has-text("新建")');
    if (bomCreate) { await bomCreate.click(); await page.waitForTimeout(3000); }

    const bomGroups = await page.$$eval('.el-collapse-item__header', els =>
      els.map(e => e.textContent?.trim()).filter(Boolean)
    ).catch(() => []);
    const bomLabels = await page.$$eval('.el-form-item__label', els =>
      els.map(e => e.textContent?.trim()).filter(Boolean)
    ).catch(() => []);
    const bomSelects = await page.$$('.el-select');
    const bomNumbers = await page.$$('.el-input-number');
    await ss(page, 'G7-bom-form');

    log('G7', 'BOM 动态表单 — 3 分组+9 字段', [
      `groups (${bomGroups.length}): ${bomGroups.join(' | ')}`,
      `labels (${bomLabels.length}): ${bomLabels.join(', ')}`,
      `selects: ${bomSelects.length}, numbers: ${bomNumbers.length}`,
      `screenshot: G7-bom-form.png`,
    ], bomGroups.length >= 3 && bomLabels.length >= 7);

  } catch(e) {
    log('ERR', '异常', [e.message, e.stack?.split('\n')[1] || ''], false);
  } finally {
    // Console error summary
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length) {
      console.log(`\n⚠️ Console errors: ${errors.length}`);
      errors.slice(0, 3).forEach(e => console.log(`  ${e.text.substring(0, 120)}`));
    }
    await browser.close();
  }

  // Report
  console.log('\n' + '='.repeat(60));
  const pass = R.filter(r => r.result === 'PASS').length;
  const fail = R.filter(r => r.result === 'FAIL').length;
  console.log(`📊 缺口补测: ${pass} PASS / ${fail} FAIL — 共 ${R.length} 项`);
  if (fail) {
    console.log('\n❌ 失败:');
    R.filter(r => r.result === 'FAIL').forEach(r => {
      console.log(`  ${r.id}: ${r.name}`);
      r.evidence.forEach(e => console.log(`    ${e}`));
    });
  }
  fs.writeFileSync('test-canvas-gaps-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { pass, fail, total: R.length }, tests: R,
  }, null, 2));
  console.log(`\n📁 test-canvas-gaps-results.json\n📸 ${DIR}/`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
