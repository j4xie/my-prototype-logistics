// PR #447 Canvas Dynamic priceSensitive RBAC E2E verification
// Test matrix:
//   Roles: warehouse_mgr1 (lacks procurement:price:view) + factory_admin1 (full)
//   Pages: /sales/orders, /procurement/orders, /production/bom
// Expected:
//   warehouse → price columns render <span class="price-masked">—</span>
//   admin → real currency values
//   0 console errors, 0 5xx network responses

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://139.196.165.140:8097';
const PASSWORD = '123456';
const OUT_DIR = resolve(import.meta.dirname, '../docs/qa-audits/2026-05-12-canvas-dynamic-rbac-e2e-evidence');
mkdirSync(OUT_DIR, { recursive: true });

const ROLES = [
  { user: 'warehouse_mgr1',  label: 'warehouse-mgr', expectMasked: true,  role: 'warehouse_manager' },
  { user: 'factory_admin1',  label: 'admin',         expectMasked: false, role: 'factory_super_admin' },
];

const PAGES = [
  { name: 'sales-orders',     path: '/sales/orders',      moduleCode: 'sales_order',    priceField: 'totalAmount' },
  { name: 'procurement-orders', path: '/procurement/orders', moduleCode: 'purchase_order', priceField: 'totalAmount' },
  { name: 'bom',              path: '/production/bom',    moduleCode: 'bom',            priceField: 'unitPrice' },
];

async function loginViaApi(request, username) {
  const resp = await request.post(`${BASE_URL}/api/mobile/auth/unified-login`, {
    data: { username, password: PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok()) throw new Error(`Login HTTP ${resp.status()}: ${await resp.text()}`);
  const body = await resp.json();
  if (body.code !== 200) throw new Error(`Login code=${body.code} msg=${body.message}`);
  return body.data;
}

async function runRolePage(role, pg, allResults) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkSummary = [];
  const dataResponses = []; // responses that include totalAmount/unitPrice keys

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('/api/mobile/')) return;
    const status = resp.status();
    networkSummary.push({ url: url.replace(BASE_URL, ''), status });
    if (status >= 200 && status < 300) {
      try {
        const txt = await resp.text();
        if (txt.includes(pg.priceField)) {
          // capture small sample of price-bearing response
          dataResponses.push({
            url: url.replace(BASE_URL, ''),
            sample: txt.slice(0, 4000),
          });
        }
      } catch (e) {}
    }
  });

  // 1) Login via API
  const auth = await loginViaApi(context.request, role.user);

  // 2) Seed localStorage then navigate
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('cretas_access_token', token);
    localStorage.setItem('cretas_user', JSON.stringify(user));
  }, {
    token: auth.token,
    user: {
      id: auth.userId,
      username: auth.username,
      email: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userType: 'factory',
      factoryUser: {
        role: auth.role,
        factoryId: auth.factoryId,
        factoryType: auth.factoryType || 'FACTORY',
        permissions: auth.permissions || [],
      },
    },
  });

  // 3) Navigate to target page
  const targetUrl = `${BASE_URL}${pg.path}`;
  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    // networkidle may not fire if there's long-polling — fall through
  }
  await page.waitForTimeout(3500); // settle time for Canvas Dynamic + data fetch

  // 4) Capture DOM evidence
  const maskedCount = await page.locator('.price-masked').count();
  const maskedTexts = await page.locator('.price-masked').allTextContents();
  // Look for table rows + count
  const tableRowCount = await page.locator('.el-table__row, .el-table .row, tr').count();
  // Check final URL (might have been redirected by router guard)
  const finalUrl = page.url().replace(BASE_URL, '');
  // Look for any error UI
  const pageHasError = await page.locator('.el-message--error, .error-state').count();

  // 5) Screenshot full page
  const screenshotPath = resolve(OUT_DIR, `${role.label}-${pg.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // 6) Save HTML snapshot for forensics
  const html = await page.content();
  const htmlSample = html.slice(0, 50000); // first 50KB

  const result = {
    role: role.label, user: role.user, page: pg.name, path: pg.path,
    moduleCode: pg.moduleCode, priceField: pg.priceField,
    expectMasked: role.expectMasked,
    finalUrl,
    maskedCount, maskedTexts,
    tableRowCount,
    pageHasError,
    consoleErrors,
    networkRequests: networkSummary.length,
    networkErrors: networkSummary.filter(n => n.status >= 400),
    dataResponses,
    screenshot: screenshotPath.replace(/\\/g, '/'),
  };

  allResults.push(result);

  await browser.close();

  console.log(`[${role.label} / ${pg.name}] masked=${maskedCount} rows=${tableRowCount} consoleErr=${consoleErrors.length} netErr=${result.networkErrors.length}`);
  return result;
}

async function main() {
  const allResults = [];

  // Run warehouse first (not rate-limited), then admin (rate-limited from earlier probes — wait if needed)
  for (const role of ROLES) {
    if (role.user === 'factory_admin1') {
      console.log('[WAIT] Sleeping 65s for factory_admin1 rate-limit cooldown...');
      await new Promise(r => setTimeout(r, 65000));
    }
    for (const pg of PAGES) {
      try {
        await runRolePage(role, pg, allResults);
      } catch (e) {
        console.error(`FAIL ${role.label}/${pg.name}: ${e.message}`);
        allResults.push({ role: role.label, page: pg.name, error: e.message });
      }
    }
  }

  // Save JSON dump
  writeFileSync(
    resolve(OUT_DIR, 'results.json'),
    JSON.stringify(allResults, null, 2),
  );
  console.log(`\nResults saved to ${OUT_DIR}/results.json`);
  console.log(`Total cases: ${allResults.length}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
