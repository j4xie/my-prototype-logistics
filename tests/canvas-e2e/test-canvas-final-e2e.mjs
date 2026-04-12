import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const USER = 'factory_admin1';
const PASS = '123456';
const results = [];

function log(test, status, evidence = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test} — ${evidence}`);
  results.push({ test, status, evidence });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // ===== 1. Login =====
  console.log('\n=== 1. Login ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) { await inputs[0].fill(USER); await inputs[1].fill(PASS); }
  await page.click('.el-button--primary');
  await page.waitForTimeout(4000);
  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  log('Login', token ? 'PASS' : 'FAIL', `token=${token?.length || 0}字符, URL=${page.url()}`);

  const factoryId = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-store') || localStorage.getItem('auth') || '{}';
      const store = JSON.parse(raw);
      return store?.user?.factoryUser?.factoryId || 'F001';
    } catch { return 'F001'; }
  });

  // ===== 2. 新 API 端点验证 (R14-R22) =====
  console.log('\n=== 2. Canvas API 端点验证 ===');
  const apiTests = [
    { name: 'disabled-modules', path: `${factoryId}/config/disabled-modules` },
    { name: 'defaults(sales_order)', path: `${factoryId}/config/modules/sales_order/defaults` },
    { name: 'effective(sales_order)', path: `${factoryId}/config/modules/sales_order/effective` },
  ];
  for (const t of apiTests) {
    const res = await page.evaluate(async (args) => {
      const tk = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/${args.path}`, { headers: { Authorization: `Bearer ${tk}` } });
      const body = await r.json().catch(() => null);
      return { status: r.status, success: body?.success, renderingMode: body?.data?.renderingMode, dataKeys: Object.keys(body?.data || {}).length };
    }, { path: t.path });
    log(`API ${t.name}`, res.status === 200 && res.success ? 'PASS' : 'FAIL',
        `HTTP ${res.status}, success=${res.success}${res.renderingMode ? ', renderingMode=' + res.renderingMode : ''}`);
  }

  // ===== 3. Canvas 渲染模式切换验证 =====
  console.log('\n=== 3. CanvasAwareWrapper 渲染切换 ===');
  await page.goto(`${BASE}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const renderCheck = await page.evaluate(() => {
    const title = document.querySelector('.page-title, .card-header span, h2, h3')?.textContent || '';
    return {
      title,
      isDynamic: title.includes('DYNAMIC') || title.includes('CANVAS') || document.body.innerText.includes('DYNAMIC'),
      hasElTable: !!document.querySelector('.el-table'),
      bodySnippet: document.body.innerText.substring(0, 200),
    };
  });
  log('CanvasAwareWrapper 渲染切换',
      renderCheck.isDynamic ? 'PASS' : 'FAIL',
      renderCheck.isDynamic
        ? `DynamicModulePage 激活 (标题="${renderCheck.title}")`
        : `仍然走 LEGACY (标题="${renderCheck.title}")`);

  // ===== 4. 创建对话框 + 动态字段 =====
  console.log('\n=== 4. 创建 + 动态字段 ===');
  const createBtn = await page.$('button:has-text("新建"), button:has-text("创建"), button:has-text("新增")');
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(2000);

    const dialogState = await page.evaluate(() => {
      const dialog = document.querySelector('.el-dialog, .el-drawer, [role="dialog"]');
      if (!dialog) return { found: false };
      const text = dialog.innerText;
      return {
        found: true,
        hasCustomFields: text.includes('工厂自定义字段'),
        formItemCount: dialog.querySelectorAll('.el-form-item').length,
        dividerCount: dialog.querySelectorAll('.el-divider').length,
      };
    });

    if (dialogState.found) {
      log('创建对话框打开', 'PASS', `表单项=${dialogState.formItemCount}`);
      log('CanvasDynamicFields 显示', dialogState.hasCustomFields ? 'PASS' : 'WARN',
          dialogState.hasCustomFields ? '有"工厂自定义字段"区域' : '无自定义字段 (工厂可能未配置 dynamic fields)');
      await page.screenshot({ path: 'test-canvas-final-dialog.png' });
    } else {
      // DynamicModulePage的创建可能用不同的UI (视图切换而非dialog)
      log('创建视图', 'WARN', 'DynamicModulePage 可能用 SchemaFormRenderer 替代对话框');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    log('创建按钮', 'WARN', '未找到');
  }

  // ===== 5. 税率分组公式 (R14) =====
  console.log('\n=== 5. 税率分组公式验证 ===');
  await page.goto(`${BASE}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  // Try to get the first order ID from the table/API
  const firstOrderId = await page.evaluate(async (fid) => {
    const tk = localStorage.getItem('cretas_access_token');
    const r = await fetch(`/api/mobile/${fid}/sales/orders?page=1&size=1`, { headers: { Authorization: `Bearer ${tk}` } });
    const body = await r.json().catch(() => null);
    const orders = body?.data?.content || body?.data || [];
    return orders[0]?.id || null;
  }, factoryId);

  if (firstOrderId) {
    const formulaRes = await page.evaluate(async (args) => {
      const tk = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/${args.fid}/sales/orders/${args.oid}/formulas`, {
        headers: { Authorization: `Bearer ${tk}` }
      });
      const body = await r.json().catch(() => null);
      return { status: r.status, success: body?.success, keys: Object.keys(body?.data || {}), data: JSON.stringify(body?.data || {}).substring(0, 300) };
    }, { fid: factoryId, oid: firstOrderId });

    log('税率分组公式 API', formulaRes.status === 200 && formulaRes.success ? 'PASS' : 'FAIL',
        `HTTP ${formulaRes.status}, formulas=${formulaRes.keys.join(',') || 'none'}, data=${formulaRes.data}`);
  } else {
    log('税率分组公式', 'WARN', '无订单数据可测试');
  }

  // ===== 6. 侧边栏模块显隐 =====
  console.log('\n=== 6. 侧边栏 Canvas 模块显隐 ===');
  const sidebarText = await page.evaluate(() => {
    const el = document.querySelector('.el-aside, .app-sidebar, nav');
    return el ? el.innerText : '';
  });
  for (const m of ['销售', '采购', '生产', '仓储']) {
    log(`侧边栏 ${m}`, sidebarText.includes(m) ? 'PASS' : 'WARN', sidebarText.includes(m) ? '可见' : '不可见');
  }

  await page.screenshot({ path: 'test-canvas-final-result.png' });
  await browser.close();

  // ===== Summary =====
  console.log('\n========== 最终验收结果 ==========');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  console.log(`✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️ WARN: ${warn} | Total: ${results.length}`);

  const fs = await import('fs');
  fs.writeFileSync('test-canvas-final-results.json', JSON.stringify(results, null, 2));
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
