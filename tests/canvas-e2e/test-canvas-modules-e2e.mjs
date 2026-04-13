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

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) { await inputs[0].fill(USER); await inputs[1].fill(PASS); }
  await page.click('.el-button--primary');
  await page.waitForTimeout(4000);
  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  log('Login', token ? 'PASS' : 'FAIL', `token=${token?.length || 0}`);
  if (!token) { await browser.close(); return; }

  // Test each module page for Canvas rendering
  const modules = [
    { name: '销售订单', path: '/sales/orders', code: 'sales_order' },
    { name: '采购订单', path: '/procurement/orders', code: 'purchase_order' },
    { name: '生产计划', path: '/production/plans', code: 'production_plan' },
    { name: '仓储原料', path: '/warehouse/materials', code: 'material_batch' },
  ];

  console.log('\n=== Canvas 渲染切换验证 (4 模块) ===');
  for (const mod of modules) {
    try {
      await page.goto(`${BASE}${mod.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(4000);

      // Check effective config
      const fid = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('auth-store') || '{}')?.user?.factoryUser?.factoryId || 'F001'; }
        catch { return 'F001'; }
      });

      const configRes = await page.evaluate(async (args) => {
        const tk = localStorage.getItem('cretas_access_token');
        const r = await fetch(`/api/mobile/${args.fid}/config/modules/${args.code}/effective`, {
          headers: { Authorization: `Bearer ${tk}` }
        });
        const body = await r.json().catch(() => null);
        return { status: r.status, renderingMode: body?.data?.renderingMode || 'UNKNOWN', success: body?.success };
      }, { fid, code: mod.code });

      const pageState = await page.evaluate(() => {
        const title = (document.querySelector('.page-title, .card-header span, h2, h3')?.textContent || '').trim();
        return {
          title,
          isDynamic: title.includes('DYNAMIC') || title.includes('CANVAS') || document.body.innerText.includes('DYNAMIC'),
          hasTable: !!document.querySelector('.el-table'),
          url: location.href,
        };
      });

      log(`${mod.name} — effective config`, configRes.status === 200 ? 'PASS' : 'FAIL',
          `renderingMode=${configRes.renderingMode}`);

      if (configRes.renderingMode === 'DYNAMIC' || configRes.renderingMode === 'CANVAS') {
        log(`${mod.name} — Canvas 切换`, pageState.isDynamic ? 'PASS' : 'FAIL',
            pageState.isDynamic ? `DynamicModulePage (标题="${pageState.title}")` : `仍然 LEGACY (标题="${pageState.title}")`);
      } else {
        log(`${mod.name} — LEGACY 模式`, 'PASS',
            `renderingMode=${configRes.renderingMode}, 硬编码页面 (expected)`);
      }
    } catch (e) {
      log(`${mod.name}`, 'FAIL', e.message);
    }
  }

  // Test API endpoints that matter
  console.log('\n=== 后端 Canvas API 全量验证 ===');
  const fid = 'F001';
  const apiEndpoints = [
    { name: 'disabled-modules', path: `${fid}/config/disabled-modules` },
    { name: 'defaults(sales_order)', path: `${fid}/config/modules/sales_order/defaults` },
    { name: 'defaults(purchase_order)', path: `${fid}/config/modules/purchase_order/defaults` },
    { name: 'defaults(production_plan)', path: `${fid}/config/modules/production_plan/defaults` },
    { name: 'effective(purchase_order)', path: `${fid}/config/modules/purchase_order/effective` },
    { name: 'effective(production_plan)', path: `${fid}/config/modules/production_plan/effective` },
    { name: 'effective(material_batch)', path: `${fid}/config/modules/material_batch/effective` },
  ];

  for (const ep of apiEndpoints) {
    try {
      const res = await page.evaluate(async (args) => {
        const tk = localStorage.getItem('cretas_access_token');
        const r = await fetch(`/api/mobile/${args.path}`, { headers: { Authorization: `Bearer ${tk}` } });
        return { status: r.status, success: (await r.json().catch(() => ({})))?.success };
      }, { path: ep.path });
      log(`API ${ep.name}`, res.status === 200 && res.success ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
    } catch (e) {
      log(`API ${ep.name}`, 'FAIL', e.message);
    }
  }

  await browser.close();

  console.log('\n========== 多模块验收结果 ==========');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  console.log(`✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️ WARN: ${warn} | Total: ${results.length}`);

  const fs = await import('fs');
  fs.writeFileSync('test-canvas-modules-results.json', JSON.stringify(results, null, 2));
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
