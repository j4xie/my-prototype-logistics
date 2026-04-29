// Per-merchant module evaluation: login as each merchant, visit key analytics
// pages, capture screenshots + DOM signals. Produces raw data for professional
// analyst + user perspective report.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-merchant-module-eval';
fs.mkdirSync(OUT, { recursive: true });

const MERCHANTS = [
  { username: 'guimanlong_admin', short: 'gml',  name: '桂满陇',    records: 29089 },
  { username: 'ximaxiang_admin',  short: 'xmx',  name: '唏嘛香',    records: 524 },
  { username: 'ilteatro_admin',   short: 'ite',  name: 'IL TEATRO', records: 524 },
  { username: 'shangma_admin',    short: 'smh',  name: '上马火锅',  records: 252 },
  { username: 'yujiujing_admin',  short: 'yjj',  name: '御九井',    records: 436 },
  { username: 'buerjun_admin',    short: 'bej',  name: '不二君',    records: 1081 },
];

// Key modules per sidebar (restaurant tenant view)
const MODULES = [
  { key: 'dashboard',     path: '/smart-bi/dashboard',       label: '经营驾驶舱' },
  { key: 'finance',       path: '/smart-bi/finance',         label: '财务数据分析' },
  { key: 'restaurant_v2', path: '/smart-bi/restaurant-v2',   label: '餐饮综合分析 V2' },
  { key: 'sales',         path: '/smart-bi/sales',           label: '销售数据分析' },
  { key: 'analysis',      path: '/smart-bi/analysis',        label: '智能数据分析' },
  { key: 'trends',        path: '/analytics/trends',         label: '趋势分析' },
  { key: 'restaurant',    path: '/restaurant/analytics',     label: '餐饮运营总览' },
  { key: 'menu_quad',     path: '/restaurant/analytics/menu', label: '菜品四象限' },
  { key: 'store_compare', path: '/restaurant/analytics/stores', label: '门店对比' },
  { key: 'sales_orders',  path: '/sales/orders',             label: '销售订单' },
];

async function login(page, username, password = '123456') {
  for (let i = 0; i < 5; i++) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('input', { timeout: 10000 });
      const inputs = await page.locator('input').all();
      let u, p;
      for (const inp of inputs) {
        const t = await inp.getAttribute('type');
        if (t === 'password' && !p) p = inp;
        else if (!u && (t === 'text' || !t)) u = inp;
      }
      await u.fill(username); await p.fill(password); await p.press('Enter');
      await page.waitForTimeout(7000);
      if (!page.url().includes('/login')) return true;
    } catch {}
    if (i < 4) await page.waitForTimeout(6000);
  }
  return false;
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, ts: new Date().toISOString(), merchants: [] };

for (const m of MERCHANTS) {
  console.log(`\n=== ${m.name} (${m.username}) ${m.records} records ===`);
  const mDir = path.join(OUT, m.short);
  fs.mkdirSync(mDir, { recursive: true });

  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  const loggedIn = await login(page, m.username);
  if (!loggedIn) {
    console.log(`  ❌ Login failed`);
    results.merchants.push({ ...m, error: 'login_failed' });
    await ctx.close();
    continue;
  }

  // Capture sidebar items once
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const sidebar = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.el-menu-item, .el-sub-menu__title'))
      .map(el => (el.textContent || '').trim())
      .filter(Boolean);
  });

  const moduleResults = [];

  for (const mod of MODULES) {
    try {
      const t0 = Date.now();
      await page.goto(`${BASE}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
      await page.waitForTimeout(3500);
      const tLoad = Date.now() - t0;

      const signals = await page.evaluate(() => {
        const url = window.location.pathname;
        const is403 = url.includes('/403');
        const is404 = url.includes('/404');
        const mainText = (document.querySelector('.app-main, .el-main, main')?.textContent || '').trim();
        const kpiValues = Array.from(document.querySelectorAll('.kpi-value, .el-statistic__number'))
          .map(e => (e.textContent || '').trim())
          .filter(t => t && t !== '--')
          .slice(0, 8);
        const charts = document.querySelectorAll('canvas').length;
        const emptyStates = document.querySelectorAll('.el-empty').length;
        const spinners = document.querySelectorAll('.el-loading-mask:not([style*="display: none"])').length;
        const dangerAlerts = document.querySelectorAll('.el-alert--error, .el-alert--warning').length;
        const errorToasts = Array.from(document.querySelectorAll('.el-message--error'))
          .map(e => (e.textContent || '').trim().slice(0, 100));
        const templateCards = document.querySelectorAll('.tpl-card').length;
        const noDataCount = (mainText.match(/暂无数据/g) || []).length;

        return { url, is403, is404, mainTextLen: mainText.length,
          kpiValues, charts, emptyStates, spinners, dangerAlerts,
          errorToasts, templateCards, noDataCount };
      });

      const screenshotPath = path.join(mDir, `${mod.key}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      moduleResults.push({
        module: mod.key, label: mod.label, path: mod.path, tLoad,
        ...signals,
        screenshot: `${m.short}/${mod.key}.png`,
      });

      const status = signals.is403 ? '403'
                   : signals.is404 ? '404'
                   : signals.kpiValues.length > 0 ? `${signals.kpiValues.length}kpi`
                   : signals.charts > 0 ? `${signals.charts}chart`
                   : signals.templateCards > 0 ? `${signals.templateCards}tpl`
                   : signals.noDataCount > 0 ? `empty(${signals.noDataCount})`
                   : 'minimal';
      console.log(`  ${mod.key.padEnd(14)} ${tLoad}ms ${status} nodes=${signals.mainTextLen}`);
    } catch (e) {
      console.log(`  ${mod.key.padEnd(14)} ERROR: ${e.message.slice(0, 60)}`);
      moduleResults.push({ module: mod.key, label: mod.label, error: e.message });
    }
  }

  results.merchants.push({ ...m, sidebar, moduleResults });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
for (const m of results.merchants) {
  if (m.error) { console.log(`  ❌ ${m.name}: ${m.error}`); continue; }
  console.log(`\n${m.name} (${m.records} records):`);
  console.log(`  sidebar: ${m.sidebar.slice(0, 8).join(' | ')}`);
  for (const mr of m.moduleResults) {
    if (mr.error) continue;
    const kpis = mr.kpiValues?.length ? ` [${mr.kpiValues.slice(0, 3).join(',')}]` : '';
    console.log(`  ${mr.label.padEnd(20)} ${mr.tLoad}ms charts=${mr.charts} tpls=${mr.templateCards} empty=${mr.emptyStates} errorToasts=${mr.errorToasts?.length || 0}${kpis}`);
  }
}
