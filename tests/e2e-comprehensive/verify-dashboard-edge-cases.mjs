// Dashboard fallback edge cases — truly empty tenant, refresh, manual clear.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-dashboard-edge-cases';
fs.mkdirSync(OUT, { recursive: true });

async function login(page, username, password) {
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
      if (!page.url().includes('/login')) return;
    } catch (e) {
      console.log(`  [login] attempt ${i + 1} error: ${e.message.slice(0, 80)}`);
    }
    if (i < 4) await page.waitForTimeout(5000);
  }
  throw new Error(`login failed: ${username}`);
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

// ============================================================
// C1: Truly empty tenant (F002 — no Gold data at all)
// Expected: 3 fallback probes all empty → big empty state + 4×-- KPIs,
//           fallbackRangeLabel stays empty, NO misleading "已自动显示 X" alert
// ============================================================
{
  console.log('\n=== C1: Truly empty tenant (F002) ===');
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  await login(page, 'restaurant_admin1', '123456');
  await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(8000);

  const signals = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const fallbackAlert = alerts.find(a => (a.textContent || '').includes('本月暂无销售数据,已自动显示'));
    const fallbackText = fallbackAlert ? (fallbackAlert.textContent || '').trim() : null;

    const emptyStates = Array.from(document.querySelectorAll('.smartbi-empty-state'));
    const bigEmpty = emptyStates.find(el => (el.textContent || '').includes('请先上传Excel'));
    const bigEmptyVisible = bigEmpty ? !!(bigEmpty.getBoundingClientRect().height) : false;

    const kpiValues = Array.from(document.querySelectorAll('.kpi-value')).map(e => (e.textContent || '').trim());

    return { fallbackText, bigEmptyVisible, kpiValues };
  });

  await page.screenshot({ path: `${OUT}/c1-empty-tenant-f002.png`, fullPage: false });
  const pass = !signals.fallbackText &&                    // No misleading fallback claim
               signals.bigEmptyVisible &&                  // Big empty state visible
               signals.kpiValues.every(v => !v || v === '--' || v.includes('--'));
  results.cases.push({ case: 'C1 Truly empty tenant', signals, consoleErrors: consoleErrors.slice(0, 3), pass });
  console.log('  fallbackText:', signals.fallbackText, '(expect null)');
  console.log('  bigEmptyVisible:', signals.bigEmptyVisible, '(expect true)');
  console.log('  kpiValues:', signals.kpiValues.slice(0, 4), '(expect all -- or empty)');
  console.log('  consoleErrors:', consoleErrors.length);
  await ctx.close();
}

// ============================================================
// C2: Refresh with cached fallback range (F001 — 2025 data)
// Expected: cache hit → fast load (no serial probe), same fallback label
// ============================================================
{
  console.log('\n=== C2: Refresh with cached range (F001) ===');
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'factory_admin1', '123456');

  // First visit — populate cache
  await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(8000);

  const cacheEntry = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('smartbi-dashboard-fallback:'));
    return key ? { key, value: localStorage.getItem(key) } : null;
  });

  // Now "refresh" by navigating away + back
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const t0 = Date.now();
  await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(5000);
  const tRefresh = Date.now() - t0;

  const signals = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const fallbackAlert = alerts.find(a => (a.textContent || '').includes('本月暂无销售数据,已自动显示'));
    const kpiValues = Array.from(document.querySelectorAll('.kpi-value')).map(e => (e.textContent || '').trim());
    return { fallbackLabel: fallbackAlert ? (fallbackAlert.textContent || '').match(/已自动显示\s*(\S+)/)?.[1] : null, kpiValues };
  });

  await page.screenshot({ path: `${OUT}/c2-refresh-cached.png`, fullPage: false });
  const pass = !!cacheEntry && !!signals.fallbackLabel && signals.kpiValues.some(v => v && v !== '--');
  results.cases.push({
    case: 'C2 Refresh with cached range',
    cacheEntry, tRefresh, signals, pass
  });
  console.log('  cacheEntry:', cacheEntry);
  console.log('  tRefresh:', tRefresh, 'ms');
  console.log('  fallbackLabel on refresh:', signals.fallbackLabel, '(expect 2025全年 or 本年 sim)');
  console.log('  kpiValues:', signals.kpiValues.slice(0, 4));
  await ctx.close();
}

// ============================================================
// C3: Pick range, then clear — fallback should re-trigger
// ============================================================
{
  console.log('\n=== C3: Pick then clear range (F001) ===');
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'factory_admin1', '123456');

  await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'domcontentloaded' });
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  await page.waitForTimeout(6000);

  // Pick a specific range: 2024 全年 (F001 has no 2024 data, so this should show empty for that range)
  const picker = await page.locator('.el-date-editor').first();
  await picker.click();
  await page.waitForTimeout(1000);
  // Click the "2024 全年" shortcut
  const shortcut2024 = page.locator('.el-picker-panel__shortcut:has-text("2024")').first();
  if (await shortcut2024.count() > 0) {
    await shortcut2024.click();
    await page.waitForTimeout(5000);
  }

  const afterPick = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const fb = alerts.find(a => (a.textContent || '').includes('本月暂无销售数据'));
    return {
      hasFallbackAlert: !!fb,
      kpiValues: Array.from(document.querySelectorAll('.kpi-value')).map(e => (e.textContent || '').trim()),
    };
  });
  console.log('  After pick 2024 range — fallback alert:', afterPick.hasFallbackAlert, '(expect false — user explicitly chose)');
  console.log('  After pick KPI vals:', afterPick.kpiValues.slice(0, 4));

  // Now clear via picker's clear button (×)
  const clearBtn = page.locator('.el-input__suffix .el-icon.el-input__icon.el-range__close-icon, .el-date-editor .el-input__icon.is-icon-close').first();
  if (await clearBtn.count() > 0) {
    await clearBtn.click({ force: true });
  } else {
    // Fallback: directly interact via JS
    await page.evaluate(() => {
      const clearX = document.querySelector('.el-range__close-icon');
      if (clearX) clearX.click();
    });
  }
  await page.waitForTimeout(6000);

  const afterClear = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.el-alert'));
    const fb = alerts.find(a => (a.textContent || '').includes('本月暂无销售数据'));
    return {
      hasFallbackAlert: !!fb,
      fallbackText: fb ? (fb.textContent || '').trim().slice(0, 100) : null,
      kpiValues: Array.from(document.querySelectorAll('.kpi-value')).map(e => (e.textContent || '').trim()),
    };
  });

  await page.screenshot({ path: `${OUT}/c3-after-clear.png`, fullPage: false });
  // After clearing, fallback should RE-trigger (default 本月 → empty → fallback chain)
  const pass = afterClear.hasFallbackAlert && afterClear.kpiValues.some(v => v && v !== '--');
  results.cases.push({
    case: 'C3 Pick then clear re-triggers fallback',
    afterPick, afterClear, pass
  });
  console.log('  After clear — fallback alert:', afterClear.hasFallbackAlert, '(expect true — cleared → default → empty → fallback)');
  console.log('  After clear KPI vals:', afterClear.kpiValues.slice(0, 4));
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
console.log(`  ${pass}/${results.cases.length} passed`);
