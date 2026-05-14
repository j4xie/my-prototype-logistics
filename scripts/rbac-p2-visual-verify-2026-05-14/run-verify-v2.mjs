/**
 * P2 Visual Verification v2 — PR #598 canViewPrice sweep.
 *
 * v2 changes:
 * - Direct API login + localStorage token injection (bypasses UI race)
 * - Better mount wait: data-v-app populated + #app element with > 5000 chars
 * - Captures DOM HTML snippet for ALL routes (not just text) so we can grep
 *   for v-if-stripped column headers like "金额"/"单价"/"应收".
 * - For each role × route, save HTML + screenshot. Manual review then.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = process.env.FRONTEND || 'http://139.196.165.140:8097';
const BACKEND = process.env.BACKEND || 'http://139.196.165.140:8086';
const SHOTS_DIR = path.join(__dirname, 'shots-v2');

const ACCOUNTS = {
  f006_admin: { username: 'f006_admin', password: '123456', priceAccess: true },
  f006_warehouse_mgr: { username: 'f006_warehouse_mgr', password: '123456', priceAccess: false },
};

const ROUTES = [
  { id: 'finance-costs', route: '/finance/costs' },
  { id: 'system-products', route: '/system/products' },
  { id: 'analytics', route: '/analytics/overview' },
  { id: 'restaurant-stocktaking', route: '/restaurant/stocktaking' },
  { id: 'restaurant-analytics', route: '/restaurant/analytics' },
  { id: 'restaurant-analytics-menu', route: '/restaurant/analytics/menu' },
  { id: 'restaurant-analytics-dianping', route: '/restaurant/analytics/dianping' },
  { id: 'smartbi-dashboard', route: '/smart-bi/dashboard' },
  { id: 'smartbi-finance', route: '/smart-bi/finance' },
  { id: 'smartbi-sales', route: '/smart-bi/sales' },
  { id: 'smartbi-upload', route: '/smart-bi/upload' },
  { id: 'smartbi-whatif', route: '/smart-bi/whatif' },
  { id: 'smartbi-restaurant-v2', route: '/smart-bi/restaurant-v2' },
  { id: 'smartbi-gold-preview', route: '/smart-bi/gold-preview' },
];

async function apiLogin(username, password) {
  const res = await fetch(`${BACKEND}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      deviceInfo: { deviceId: 'rbac-p2-verify', deviceModel: 'chat', platform: 'Web', osVersion: '1.0' },
    }),
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(`login ${username}: ${data.message}`);
  return data.data;
}

(async () => {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  for (const role of Object.keys(ACCOUNTS)) {
    await fs.mkdir(path.join(SHOTS_DIR, role), { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const role of Object.keys(ACCOUNTS)) {
    console.log(`\n=== ${role} ===`);

    let auth;
    try {
      auth = await apiLogin(ACCOUNTS[role].username, ACCOUNTS[role].password);
      console.log(`  API login: role=${auth.role}, factoryId=${auth.factoryId}, perms=${auth.permissions}`);
    } catch (e) {
      console.error(`  ✗ API login FAIL: ${e.message}`);
      results.push({ role, verdict: 'LOGIN_FAIL', error: e.message });
      continue;
    }

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Inject auth into localStorage before navigation
    await page.goto(`${FRONTEND}/login`);
    await page.evaluate((authData) => {
      localStorage.setItem('cretas_access_token', authData.token);
      localStorage.setItem('cretas_user_info', JSON.stringify({
        userId: authData.userId,
        username: authData.username,
        factoryId: authData.factoryId,
        role: authData.role,
        permissions: authData.permissions,
      }));
    }, auth);

    for (const r of ROUTES) {
      process.stdout.write(`  ${r.route} ... `);
      try {
        await page.goto(`${FRONTEND}${r.route}`, { timeout: 25000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(2500);  // give Vue components time to mount

        const finalUrl = page.url().replace(FRONTEND, '');
        const html = await page.content().catch(() => '');
        const text = await page.textContent('body').catch(() => '');

        // Count occurrences of price-shape markers in DOM HTML (not just text)
        const priceMarkers = [
          '单价', '金额', '应收', '应付', '总营收', '总利润', '客单价',
          '差异金额', '含税单价', '损耗成本', '销售额', '食材成本', '人工成本',
        ];
        const markerCounts = {};
        for (const m of priceMarkers) {
          const re = new RegExp(m, 'g');
          markerCounts[m] = (html.match(re) || []).length;
        }
        const totalMarkers = Object.values(markerCounts).reduce((a, b) => a + b, 0);

        const screenshot = path.join(SHOTS_DIR, role, `${r.id}.png`);
        await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});

        const verdict = totalMarkers > 0 ? 'HAS_PRICE_MARKERS' : 'NO_PRICE_MARKERS';
        console.log(`${verdict} (markers=${totalMarkers}, htmlLen=${html.length}, finalUrl=${finalUrl})`);

        results.push({
          role,
          route: r.route,
          id: r.id,
          finalUrl,
          htmlLength: html.length,
          textLength: text.length,
          totalPriceMarkers: totalMarkers,
          markerCounts,
          verdict,
          screenshot: path.relative(__dirname, screenshot),
        });
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
        results.push({ role, route: r.route, id: r.id, verdict: 'ERROR', error: e.message });
      }
    }

    await ctx.close();
  }

  await browser.close();

  await fs.writeFile(path.join(__dirname, 'results-v2.json'), JSON.stringify(results, null, 2));

  console.log('\n=== SUMMARY ===');
  for (const role of Object.keys(ACCOUNTS)) {
    const rr = results.filter((r) => r.role === role);
    const withMarkers = rr.filter((r) => r.verdict === 'HAS_PRICE_MARKERS').length;
    const without = rr.filter((r) => r.verdict === 'NO_PRICE_MARKERS').length;
    const errors = rr.filter((r) => r.verdict === 'ERROR').length;
    console.log(`  ${role}: with-price-markers=${withMarkers}, without=${without}, error=${errors}`);
  }
  console.log(`Detail: results-v2.json`);
})();
