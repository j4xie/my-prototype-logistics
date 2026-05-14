/**
 * P2 Visual Verification — PR #598 canViewPrice sweep.
 *
 * 14 routes × 2 F006 roles. Negative role (warehouse_mgr) should NOT see
 * price cells; positive role (factory_admin) should still see them.
 *
 * Backend already strips numbers (PRICE_VIEW_ROLES on Java + Python). My v-if
 * removes the ghost columns/cards entirely so the no-price role sees a clean
 * page rather than empty/asterisk slots.
 *
 * Output: shots/<role>/<route-slug>.png + results.json with per-cell verdict.
 *
 * Usage: TARGET=http://139.196.165.140:8097 node run-verify.mjs
 *   default TARGET=http://139.196.165.140:8097 (test env, has PR #598)
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8097';
const SHOTS_DIR = path.join(__dirname, 'shots');

const ACCOUNTS = {
  f006_admin: { username: 'f006_admin', password: '123456', priceAccess: true },
  f006_warehouse_mgr: { username: 'f006_warehouse_mgr', password: '123456', priceAccess: false },
};

// 14 routes corresponding to the 15 files patched in PR #598 (one is an inline
// component not on its own route — skipped).
const ROUTES = [
  { id: 'finance-costs', route: '/finance/costs', priceMarkers: ['应收总额', '应付总额', '金额'] },
  { id: 'system-products', route: '/system/products', priceMarkers: ['含税单价'] },
  { id: 'analytics', route: '/analytics/overview', priceMarkers: ['损耗成本', '申领成本', '毛利收入'] },
  { id: 'restaurant-stocktaking', route: '/restaurant/stocktaking', priceMarkers: ['差异金额'] },
  { id: 'restaurant-analytics', route: '/restaurant/analytics', priceMarkers: ['营收', '客单价'] },
  { id: 'restaurant-analytics-menu', route: '/restaurant/analytics/menu', priceMarkers: ['营收', '单品利润'] },
  { id: 'restaurant-analytics-dianping', route: '/restaurant/analytics/dianping', priceMarkers: ['¥'] },
  { id: 'smartbi-dashboard', route: '/smart-bi/dashboard', priceMarkers: ['总营收', '总利润', '客单价'] },
  { id: 'smartbi-finance', route: '/smart-bi/finance', priceMarkers: ['毛利', '应收', '应付', '预算'] },
  { id: 'smartbi-sales', route: '/smart-bi/sales', priceMarkers: ['销售额'] },
  { id: 'smartbi-upload', route: '/smart-bi/upload', priceMarkers: ['¥'] },
  { id: 'smartbi-whatif', route: '/smart-bi/whatif', priceMarkers: ['预计收入', '预计毛利', '成本结构'] },
  { id: 'smartbi-restaurant-v2', route: '/smart-bi/restaurant-v2', priceMarkers: ['食材成本', '人工成本', '营收'] },
  { id: 'smartbi-gold-preview', route: '/smart-bi/gold-preview', priceMarkers: ['客单价', '金额'] },
];

async function login(page, account) {
  const a = ACCOUNTS[account];
  await page.goto(`${TARGET}/login`, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.fill('input[placeholder*="用户名"], input[type="text"]', a.username);
  await page.fill('input[placeholder*="密码"], input[type="password"]', a.password);
  const btn = (await page.$('button.login-button'))
    ?? (await page.$('button:has-text("登 录")'))
    ?? (await page.$('button:has-text("登录")'));
  if (!btn) throw new Error(`login button not found for ${account}`);
  await btn.click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 20000 });
}

async function probeRoute(page, route) {
  const startUrl = page.url();
  await page.goto(`${TARGET}${route.route}`, { timeout: 30000 }).catch((e) => {
    return { error: `goto: ${e.message}` };
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const redirected = !finalUrl.includes(route.route);

  const bodyText = await page.textContent('body').catch(() => '');
  const found = {};
  for (const marker of route.priceMarkers) {
    found[marker] = bodyText.includes(marker);
  }
  const visibleMarkerCount = Object.values(found).filter(Boolean).length;

  return {
    finalUrl,
    redirected,
    redirectedTo: redirected ? finalUrl.replace(TARGET, '') : null,
    bodyLength: bodyText.length,
    markersFound: found,
    visibleMarkerCount,
  };
}

(async () => {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  for (const role of Object.keys(ACCOUNTS)) {
    await fs.mkdir(path.join(SHOTS_DIR, role), { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const role of Object.keys(ACCOUNTS)) {
    console.log(`\n=== role: ${role} (priceAccess=${ACCOUNTS[role].priceAccess}) ===`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await login(page, role);
      console.log(`  ✓ logged in as ${role}`);
    } catch (e) {
      console.error(`  ✗ login failed for ${role}: ${e.message}`);
      results.push({ role, route: null, status: 'LOGIN_FAIL', error: e.message });
      await ctx.close();
      continue;
    }

    for (const route of ROUTES) {
      process.stdout.write(`  [${role}] ${route.route} ... `);
      try {
        const probe = await probeRoute(page, route);
        const screenshot = path.join(SHOTS_DIR, role, `${route.id}.png`);
        await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});

        // Verdict logic:
        // - factory_admin (priceAccess=true): expect ≥1 marker visible (price content present)
        // - warehouse_mgr (priceAccess=false): expect 0 markers visible (gates hide them) OR redirected to 403/login
        const expectedHasMarkers = ACCOUNTS[role].priceAccess;
        const actualHasMarkers = probe.visibleMarkerCount > 0;

        let verdict;
        if (probe.redirected && probe.finalUrl.includes('/403')) {
          // role-gated at route level — also acceptable for no-price role
          verdict = expectedHasMarkers ? 'FAIL_403_FOR_ADMIN' : 'PASS_ROUTE_GATED';
        } else if (expectedHasMarkers === actualHasMarkers) {
          verdict = 'PASS';
        } else if (expectedHasMarkers && !actualHasMarkers) {
          verdict = 'FAIL_ADMIN_MISSING_PRICE';
        } else {
          verdict = 'FAIL_NONPRICE_SEES_PRICE';
        }

        console.log(`${verdict} (markers=${probe.visibleMarkerCount}/${route.priceMarkers.length}, redirect=${probe.redirected})`);
        results.push({
          role,
          route: route.route,
          id: route.id,
          verdict,
          probe,
          screenshot: path.relative(__dirname, screenshot),
        });
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
        results.push({ role, route: route.route, id: route.id, verdict: 'ERROR', error: e.message });
      }
    }

    await ctx.close();
  }

  await browser.close();

  await fs.writeFile(
    path.join(__dirname, 'results.json'),
    JSON.stringify(results, null, 2),
  );

  // Summary
  const byVerdict = {};
  for (const r of results) {
    byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
  }
  console.log('\n=== SUMMARY ===');
  for (const [v, c] of Object.entries(byVerdict)) {
    console.log(`  ${v}: ${c}`);
  }
  console.log(`Total: ${results.length} (${ROUTES.length} routes × ${Object.keys(ACCOUNTS).length} roles)`);
  console.log(`Results: ${path.join(__dirname, 'results.json')}`);
  console.log(`Screenshots: ${SHOTS_DIR}`);
})();
