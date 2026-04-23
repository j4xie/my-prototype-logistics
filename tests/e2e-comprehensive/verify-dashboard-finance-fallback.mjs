// Verification script for Apr 24 UX continuation fixes:
//   1. Dashboard empty-state fallback chain (default 本月 → 近90天 → 上年 → 前年)
//   2. Finance analysis: restaurant tenants see only profit tab + info alert
//
// Playwright isolation: fresh chromium.launch, no MCP tools, no shared profile.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-dashboard-finance-fallback';
fs.mkdirSync(OUT, { recursive: true });

const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

async function login(page, username, password, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input');
    const inputs = await page.locator('input').all();
    let u, p;
    for (const inp of inputs) {
      const t = await inp.getAttribute('type');
      if (t === 'password' && !p) p = inp;
      else if (!u && (t === 'text' || !t)) u = inp;
    }
    await u.fill(username);
    await p.fill(password);
    await p.press('Enter');
    await page.waitForTimeout(6000);
    // Check if we got past login (URL changed) — if still on /login, retry
    if (!page.url().includes('/login')) return;
    if (i < maxRetries - 1) await page.waitForTimeout(3000);
  }
  console.log(`  [login] All retries exhausted for ${username}`);
}

async function captureConsoleAndNet(page) {
  const consoleErrors = [];
  const networkFails = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
  page.on('response', resp => {
    const s = resp.status();
    if (s >= 400) networkFails.push(`${s} ${resp.url().slice(0, 120)}`);
  });
  return { consoleErrors, networkFails };
}

const browser = await chromium.launch({ headless: true });

// ============================================================================
// Case 1: F001 (manufacturing, has 2025 POS data, no 本月 data) — fallback should fire
// ============================================================================
{
  console.log('\n=== Case 1: F001 Dashboard fallback ===');
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const { consoleErrors, networkFails } = await captureConsoleAndNet(page);

  await login(page, 'factory_admin1', '123456');
  await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(8000);  // Allow fallback chain to execute + KPIs to render

  const signals = await page.evaluate(() => {
    // Fallback alert text search
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const fallbackAlert = alerts.find(a => (a.textContent || '').includes('本月暂无销售数据'));
    const fallbackText = fallbackAlert ? (fallbackAlert.textContent || '').trim().slice(0, 200) : null;

    // Date picker meta text — FIRST datasource-meta only (the picker hint)
    // Subsequent matches are upload-list option subtitle meta.
    const metaEls = Array.from(document.querySelectorAll('.datasource-meta'));
    const metaText = metaEls[0] ? (metaEls[0].textContent || '').trim() : '';

    // KPI values — Gold mode should expose 营收/订单/客单价/门店 labels
    const kpiLabels = Array.from(document.querySelectorAll('.kpi-label')).map(e => (e.textContent || '').trim());
    const kpiValues = Array.from(document.querySelectorAll('.kpi-value')).map(e => (e.textContent || '').trim());

    // "暂无数据" count within KPI trend area
    const noDataCount = document.body.textContent?.split('暂无数据').length - 1 || 0;

    // BigEmptyState (main page no-data state showing "请先上传Excel")
    // Different from chart empty states (no-charts/no-analysis) which are fine to render
    const emptyStates = Array.from(document.querySelectorAll('.smartbi-empty-state'));
    const bigEmpty = emptyStates.find(el => (el.textContent || '').includes('请先上传Excel'));
    const bigEmptyVisible = bigEmpty ? !!(bigEmpty.getBoundingClientRect().height) : false;

    // KPI row exists? (fade-in row replaces loading skeleton once data loads)
    const kpiFadeRow = document.querySelector('.kpi-fade-in');
    const kpiRowVisible = kpiFadeRow ? !!(kpiFadeRow.getBoundingClientRect().height) : false;

    return { fallbackText, metaText, kpiLabels, kpiValues, noDataCount, bigEmptyVisible, kpiRowVisible };
  });

  await page.screenshot({ path: `${OUT}/case1-f001-dashboard-full.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/case1-f001-dashboard-top.png`, fullPage: false });

  results.cases.push({
    case: 'C1: F001 Dashboard fallback',
    signals,
    consoleErrors: consoleErrors.slice(0, 5),
    networkFails: networkFails.slice(0, 5),
    pass: !!signals.fallbackText &&
          signals.kpiValues.some(v => v && v !== '--' && !v.includes('--')) &&
          !signals.bigEmptyVisible &&
          signals.kpiRowVisible
  });
  console.log('  fallbackText:', signals.fallbackText);
  console.log('  kpiLabels:', signals.kpiLabels);
  console.log('  kpiValues (first 4):', signals.kpiValues.slice(0, 4));
  console.log('  metaText:', signals.metaText);
  console.log('  noDataCount:', signals.noDataCount, ' bigEmptyVisible:', signals.bigEmptyVisible);
  console.log('  consoleErrors:', consoleErrors.length, ' networkFails:', networkFails.length);
  await ctx.close();
}

// ============================================================================
// Case 2: F002 restaurant tenant — Finance should show only profit tab + info alert
// ============================================================================
{
  console.log('\n=== Case 2: F002 Finance restaurant tenant tabs ===');
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const { consoleErrors, networkFails } = await captureConsoleAndNet(page);

  await login(page, 'restaurant_admin1', '123456');
  await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(5000);

  const signals = await page.evaluate(() => {
    // Tab switcher presence
    const switchCard = document.querySelector('.type-switch-card');
    const switchCardVisible = switchCard ? !!(switchCard.getBoundingClientRect().height) : false;

    // Tab count (if switcher visible)
    const tabItems = Array.from(document.querySelectorAll('.type-switch .type-item'));
    const tabLabels = tabItems.map(e => (e.textContent || '').trim()).filter(Boolean);

    // Info alert text
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const restaurantInfoAlert = alerts.find(a =>
      (a.textContent || '').includes('餐饮门店财务分析聚焦')
    );
    const alertText = restaurantInfoAlert ? (restaurantInfoAlert.textContent || '').trim().slice(0, 300) : null;

    // Gold KPI strip (should be present for restaurant profit tab)
    const goldKpiPresent = Array.from(document.querySelectorAll('.el-tag'))
      .some(t => (t.textContent || '').includes('Gold · finance_summary'));

    // Overall page empty check — all tabs hidden + no info alert = dead page
    const hasKpiValues = Array.from(document.querySelectorAll('.kpi-value')).length > 0;

    return { switchCardVisible, tabLabels, alertText, goldKpiPresent, hasKpiValues };
  });

  await page.screenshot({ path: `${OUT}/case2-f002-finance-full.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/case2-f002-finance-top.png`, fullPage: false });

  results.cases.push({
    case: 'C2: F002 Finance restaurant tenant',
    signals,
    consoleErrors: consoleErrors.slice(0, 5),
    networkFails: networkFails.slice(0, 5),
    pass: !signals.switchCardVisible && !!signals.alertText && signals.tabLabels.length === 0
  });
  console.log('  switchCardVisible:', signals.switchCardVisible, '(expect false)');
  console.log('  tabLabels:', signals.tabLabels, '(expect [])');
  console.log('  alertText:', signals.alertText?.slice(0, 120));
  console.log('  goldKpiPresent:', signals.goldKpiPresent);
  console.log('  hasKpiValues:', signals.hasKpiValues);
  console.log('  consoleErrors:', consoleErrors.length, ' networkFails:', networkFails.length);
  await ctx.close();
}

// ============================================================================
// Case 3: F001 manufacturing Finance — regression check (all 5 tabs should remain)
// ============================================================================
{
  console.log('\n=== Case 3: F001 Finance manufacturing tenant (regression) ===');
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const { consoleErrors, networkFails } = await captureConsoleAndNet(page);

  await login(page, 'factory_admin1', '123456');
  await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(5000);

  const signals = await page.evaluate(() => {
    const switchCard = document.querySelector('.type-switch-card');
    const switchCardVisible = switchCard ? !!(switchCard.getBoundingClientRect().height) : false;
    const tabItems = Array.from(document.querySelectorAll('.type-switch .type-item'));
    const tabLabels = tabItems.map(e => (e.textContent || '').trim()).filter(Boolean);
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const restaurantInfoAlert = alerts.find(a =>
      (a.textContent || '').includes('餐饮门店财务分析聚焦')
    );
    return { switchCardVisible, tabLabels, restaurantAlertShown: !!restaurantInfoAlert };
  });

  await page.screenshot({ path: `${OUT}/case3-f001-finance-manufacturing.png`, fullPage: false });

  results.cases.push({
    case: 'C3: F001 Finance manufacturing (regression)',
    signals,
    consoleErrors: consoleErrors.slice(0, 5),
    networkFails: networkFails.slice(0, 5),
    pass: signals.switchCardVisible && signals.tabLabels.length === 5 && !signals.restaurantAlertShown
  });
  console.log('  switchCardVisible:', signals.switchCardVisible, '(expect true)');
  console.log('  tabLabels:', signals.tabLabels, '(expect 5 items)');
  console.log('  restaurantAlertShown:', signals.restaurantAlertShown, '(expect false)');
  console.log('  consoleErrors:', consoleErrors.length, ' networkFails:', networkFails.length);
  await ctx.close();
}

await browser.close();

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
let pass = 0;
for (const c of results.cases) {
  console.log(`  ${c.pass ? '✅ PASS' : '❌ FAIL'}  ${c.case}`);
  if (c.pass) pass++;
}
console.log(`\n  ${pass}/${results.cases.length} passed`);
console.log(`  Output: ${OUT}/results.json + case{1,2,3}-*.png`);
