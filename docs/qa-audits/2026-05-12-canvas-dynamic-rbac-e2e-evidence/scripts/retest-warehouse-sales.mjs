// Re-test warehouse_mgr1 → /sales/orders with longer wait + DOM-based readiness
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://139.196.165.140:8097';
const OUT_DIR = resolve(import.meta.dirname, '../docs/qa-audits/2026-05-12-canvas-dynamic-rbac-e2e-evidence');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const dataResponses = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/mobile/F001/sales/orders') && resp.status() === 200) {
      try { dataResponses.push({ url: url.replace(BASE_URL, ''), sample: (await resp.text()).slice(0, 3000) }); } catch {}
    }
  });

  // Login via API
  const loginResp = await context.request.post(`${BASE_URL}/api/mobile/auth/unified-login`, {
    data: { username: 'warehouse_mgr1', password: '123456' },
    headers: { 'Content-Type': 'application/json' },
  });
  const auth = (await loginResp.json()).data;

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('cretas_access_token', token);
    localStorage.setItem('cretas_user', JSON.stringify(user));
  }, {
    token: auth.token,
    user: {
      id: auth.userId, username: auth.username, email: '', isActive: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      userType: 'factory',
      factoryUser: { role: auth.role, factoryId: auth.factoryId, factoryType: 'FACTORY', permissions: auth.permissions || [] },
    },
  });

  await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for table to render OR timeout
  try {
    await page.waitForSelector('.el-table__row', { timeout: 30000 });
  } catch (e) { console.log('No table rows appeared within 30s'); }
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  const rows = await page.locator('.el-table__row').count();
  const maskedCount = await page.locator('.price-masked').count();
  const maskedTexts = await page.locator('.price-masked').allTextContents();

  // Inspect first row's cells for what's actually rendered in price columns
  // Get all text content of the first 3 rows' cells
  const firstRowCells = await page.locator('.el-table__row').first().locator('td').allTextContents();
  const secondRowCells = await page.locator('.el-table__row').nth(1).locator('td').allTextContents();

  // Capture HTML of the table for forensics
  const tableHtml = await page.locator('.el-table').first().evaluate(el => el.outerHTML.slice(0, 30000)).catch(() => '');

  await page.screenshot({ path: resolve(OUT_DIR, 'warehouse-mgr-sales-orders-v2.png'), fullPage: true });

  const result = {
    role: 'warehouse-mgr', user: 'warehouse_mgr1', page: 'sales-orders-v2', finalUrl,
    rows, maskedCount, maskedTexts,
    firstRowCells, secondRowCells,
    consoleErrors,
    dataResponses,
    tableHtmlSnippet: tableHtml.slice(0, 8000),
  };

  writeFileSync(resolve(OUT_DIR, 'retest-warehouse-sales.json'), JSON.stringify(result, null, 2));

  console.log(`finalUrl=${finalUrl}`);
  console.log(`rows=${rows} masked=${maskedCount}`);
  console.log(`maskedTexts=${JSON.stringify(maskedTexts)}`);
  console.log(`firstRowCells=${JSON.stringify(firstRowCells)}`);
  console.log(`secondRowCells=${JSON.stringify(secondRowCells)}`);
  console.log(`consoleErrors=${consoleErrors.length}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
