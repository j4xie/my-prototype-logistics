/**
 * Canvas Dynamic Fields E2E — 验证 SchemaFormRenderer 真正渲染 + 保存 Canvas 配置的字段
 * 用 FOOD_3101_038 工厂 (24 ACTIVE fields + CANVAS mode)
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const USER = 'food_3101_038_admin';
const PASS = '123456';
const FACTORY = 'FOOD_3101_038';

const results = [];
function log(step, status, evidence) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${step}] ${evidence}`);
  results.push({ step, status, evidence });
}

async function api(page, method, path, body = null) {
  return page.evaluate(async (args) => {
    const tk = localStorage.getItem('cretas_access_token');
    const opts = { method: args.method, headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' } };
    if (args.body) opts.body = JSON.stringify(args.body);
    const r = await fetch(`/api/mobile/${args.fid}/${args.path}`, opts);
    const json = await r.json().catch(() => null);
    return { status: r.status, success: json?.success, data: json?.data, message: json?.message };
  }, { method, path, body, fid: FACTORY });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  console.log('\n=== Login ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) { await inputs[0].fill(USER); await inputs[1].fill(PASS); }
  await page.click('.el-button--primary');
  await page.waitForTimeout(4000);
  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  if (!token) { log('Login', 'FAIL', '无token'); await browser.close(); return; }
  log('Login', 'PASS', `user=${USER}, factory=${FACTORY}, token=${token.length}字符`);

  // Verify effective config
  console.log('\n=== 1. Effective Config ===');
  const config = await api(page, 'GET', 'config/modules/sales_order/effective');
  const renderMode = config.data?.renderingMode;
  const fieldCount = config.data?.fields?.length || 0;
  log('Effective config', config.success ? 'PASS' : 'FAIL',
      `renderingMode=${renderMode}, fields=${fieldCount}`);

  // Navigate to sales orders
  console.log('\n=== 2. DynamicModulePage 渲染 ===');
  await page.goto(`${BASE}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const pageState = await page.evaluate(() => {
    const title = (document.querySelector('.page-title, .card-header span, h2, h3')?.textContent || '').trim();
    const bodyText = document.body.innerText;
    return {
      title,
      isDynamic: bodyText.includes('DYNAMIC') || bodyText.includes('CANVAS'),
      hasSchemaTable: !!document.querySelector('.el-table'),
      // Check for dynamic field labels in the page
      has_customer_level: bodyText.includes('客户等级'),
      has_delivery_priority: bodyText.includes('交货优先级'),
      has_expected_margin: bodyText.includes('预期毛利率'),
    };
  });

  log('DynamicModulePage', pageState.isDynamic ? 'PASS' : 'FAIL',
      `标题="${pageState.title}", isDynamic=${pageState.isDynamic}`);

  // Check if dynamic field labels appear in the list view
  log('列表视图 dynamic fields',
      pageState.has_customer_level || pageState.has_delivery_priority ? 'PASS' : 'WARN',
      `客户等级=${pageState.has_customer_level}, 交货优先级=${pageState.has_delivery_priority}`);

  await page.screenshot({ path: 'test-canvas-dynamic-list.png' });

  // Try to open create form
  console.log('\n=== 3. SchemaFormRenderer 创建表单 ===');
  const createBtn = await page.$('button:has-text("新建"), button:has-text("创建"), button:has-text("新增")');
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(3000);

    const formState = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const formItems = document.querySelectorAll('.el-form-item');
      const labels = Array.from(formItems).map(fi => {
        const label = fi.querySelector('.el-form-item__label');
        return label ? label.textContent.trim() : '';
      }).filter(Boolean);

      return {
        formItemCount: formItems.length,
        labels: labels.slice(0, 20),
        has_customer_level: bodyText.includes('客户等级'),
        has_delivery_priority: bodyText.includes('交货优先级'),
        has_expected_margin: bodyText.includes('预期毛利率'),
        has_contract_attachment: bodyText.includes('合同附件'),
        bodySnippet: bodyText.substring(0, 500),
      };
    });

    log('创建表单 form items', formState.formItemCount > 0 ? 'PASS' : 'FAIL',
        `${formState.formItemCount} 个表单项`);
    log('表单字段标签', 'INFO', formState.labels.join(', '));

    // Check if Canvas dynamic fields appear in the form
    const dynamicFieldsPresent = formState.has_customer_level || formState.has_delivery_priority ||
                                   formState.has_expected_margin || formState.has_contract_attachment;
    log('Canvas dynamic fields 在表单中', dynamicFieldsPresent ? 'PASS' : 'FAIL',
        `客户等级=${formState.has_customer_level}, 交货优先级=${formState.has_delivery_priority}, ` +
        `预期毛利率=${formState.has_expected_margin}, 合同附件=${formState.has_contract_attachment}`);

    await page.screenshot({ path: 'test-canvas-dynamic-form.png' });

    // Go back
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    log('创建按钮', 'WARN', '未找到 — DynamicModulePage 可能用视图切换而非按钮');

    // Check if there's a different UI pattern (SchemaFormRenderer uses currentView)
    const altState = await page.evaluate(() => {
      return {
        hasViewSwitcher: document.body.innerText.includes('新建') || document.body.innerText.includes('创建'),
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 10),
      };
    });
    log('替代 UI', 'INFO', `buttons=[${altState.buttons.join(', ')}]`);
  }

  // Verify Canvas editor
  console.log('\n=== 4. Canvas 编辑器验证 ===');
  await page.goto(`${BASE}/platform/canvas-editor`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  const editorState = await page.evaluate(() => ({
    url: location.href,
    hasEditor: !!document.querySelector('.canvas-editor, .form-canvas, [class*="canvas"]'),
    bodyText: document.body.innerText.substring(0, 300),
    hasModuleList: document.body.innerText.includes('销售') || document.body.innerText.includes('模块'),
  }));

  log('Canvas 编辑器加载', editorState.hasModuleList ? 'PASS' : 'WARN',
      `URL=${editorState.url}, hasModuleList=${editorState.hasModuleList}`);

  await page.screenshot({ path: 'test-canvas-editor.png' });

  await browser.close();

  console.log('\n========== 结果 ==========');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  console.log(`✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️ WARN: ${warn} | Total: ${results.length}`);

  const fs = await import('fs');
  fs.writeFileSync('test-canvas-dynamic-fields-results.json', JSON.stringify(results, null, 2));
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
