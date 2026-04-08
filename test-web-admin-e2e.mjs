/**
 * Cretas Web-Admin E2E Browser Tests
 *
 * Server:   http://139.196.165.140:8086  (Web-Admin Vue app)
 * API:      http://47.100.235.168:10010  (Java backend)
 *
 * Auth strategy:
 *   - Call /api/mobile/auth/unified-login to get a JWT token
 *   - Inject it into localStorage as "cretas_access_token" (what request.ts reads)
 *   - Also set "cretas_user" for user info display
 *
 * Layers:
 *   Layer 1: Page Accessibility (19 pages)
 *   Layer 2: Core CRUD Read Operations (7 pages — verify table rows load)
 *   Layer 3: New Module Verification (R&D Samples, Finance Invoices/Payments)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL = 'http://139.196.165.140:8086';
const API_URL  = 'http://47.100.235.168:10010/api/mobile';

const CREDENTIALS = [
  { username: 'factory_admin1', password: '123456' },
  { username: 'production_mgr1', password: '123456' },
];

const SCREENSHOTS_DIR = './e2e-screenshots';
const NAV_TIMEOUT = 45000;  // 45s — 139.196 can be slow

// ─── Pages to test ─────────────────────────────────────────────────────────

const LAYER1_PAGES = [
  { name: 'Dashboard',             path: '/dashboard' },
  { name: 'Sales Orders',          path: '/sales/orders' },
  { name: 'Sales Customers',       path: '/sales/customers' },
  { name: 'Procurement Orders',    path: '/procurement/orders' },
  { name: 'Procurement Suppliers', path: '/procurement/suppliers' },
  { name: 'Production Plans',      path: '/production/plans' },
  { name: 'Production Batches',    path: '/production/batches' },
  { name: 'Warehouse Materials',   path: '/warehouse/materials' },
  { name: 'Quality Inspections',   path: '/quality/inspections' },
  { name: 'R&D Samples (NEW)',      path: '/rd/samples' },
  { name: 'Finance Invoices (NEW)', path: '/finance/invoices' },
  { name: 'Finance Payments (NEW)', path: '/finance/payments' },
  { name: 'Finance AR/AP',          path: '/finance/ar-ap' },
  { name: 'Finance Costs',          path: '/finance/costs' },
  { name: 'System Users',           path: '/system/users' },
  { name: 'System Roles',           path: '/system/roles' },
  { name: 'HR Employees',           path: '/hr/employees' },
  { name: 'Equipment List',         path: '/equipment/list' },
  { name: 'Transfer List',          path: '/transfer/list' },
];

const LAYER2_CRUD_PAGES = [
  { name: 'Sales Orders',          path: '/sales/orders',       tryDetail: true },
  { name: 'Sales Customers',       path: '/sales/customers',    tryDetail: false },
  { name: 'Production Plans',      path: '/production/plans',   tryDetail: true },
  { name: 'Production Batches',    path: '/production/batches', tryDetail: true },
  { name: 'Warehouse Materials',   path: '/warehouse/materials',tryDetail: false },
  { name: 'Procurement Orders',    path: '/procurement/orders', tryDetail: true },
  { name: 'Quality Inspections',   path: '/quality/inspections',tryDetail: false },
];

const LAYER3_NEW_MODULES = [
  { name: 'R&D Samples',      path: '/rd/samples' },
  { name: 'Finance Invoices', path: '/finance/invoices' },
  { name: 'Finance Payments', path: '/finance/payments' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

async function screenshotOnFailure(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `FAIL_${sanitizeFilename(name)}_${Date.now()}.png`);
  try {
    await page.screenshot({ path: filename, fullPage: false });
    return filename;
  } catch {
    return null;
  }
}

/**
 * Call the backend login API and return the JWT token + user data.
 */
async function fetchLoginToken(username, password) {
  console.log(`[auth] Calling login API for ${username}...`);
  const res = await fetch(`${API_URL}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`Login API returned HTTP ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || {};

  // API may return token in different fields
  const token = data.accessToken || data.token || '';
  if (!token) {
    throw new Error(`Login failed for ${username}: ${json.message || 'no token returned'}`);
  }

  console.log(`[auth] Token obtained (${token.length} chars). Role: ${data.role}, Factory: ${data.factoryId}`);
  return { token, data };
}

/**
 * Inject auth into a Playwright page via localStorage.
 * request.ts reads: localStorage.getItem('cretas_access_token')
 * auth.ts reads:    localStorage.getItem('cretas_user')
 */
async function injectAuth(page, token, loginData) {
  const userJson = JSON.stringify({
    id: loginData.userId,
    username: loginData.username,
    email: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userType: 'factory',
    factoryUser: {
      role: loginData.role,
      factoryId: loginData.factoryId,
      factoryType: loginData.factoryType || 'FACTORY',
      permissions: loginData.permissions || [],
    },
  });

  await page.evaluate(([t, u]) => {
    localStorage.setItem('cretas_access_token', t);
    localStorage.setItem('cretas_user', u);
  }, [token, userJson]);
}

async function checkPageErrors(page) {
  const currentUrl = page.url();

  if (currentUrl.includes('/login')) {
    return { hasError: true, reason: 'Redirected to /login (auth failure)' };
  }
  if (currentUrl.includes('/403')) {
    return { hasError: true, reason: 'Redirected to /403 (no permission)' };
  }
  if (currentUrl.includes('/404')) {
    return { hasError: true, reason: 'Redirected to /404 (not found)' };
  }

  // Check for error toasts
  try {
    const errorToasts = page.locator('.el-message--error');
    const toastCount = await errorToasts.count();
    if (toastCount > 0) {
      const toastText = await errorToasts.first().textContent().catch(() => '');
      return { hasError: true, reason: `Error toast: ${toastText?.trim()}` };
    }
  } catch { /* ignore */ }

  return { hasError: false };
}

async function hasContent(page) {
  try {
    const tableRows = await page.locator('.el-table__row').count();
    if (tableRows > 0) return { found: true, detail: `${tableRows} table rows` };

    const emptyTable = await page.locator('.el-table__empty-text, .el-empty').count();
    if (emptyTable > 0) return { found: true, detail: 'empty table (page loaded)' };

    const cards = await page.locator('.el-card').count();
    if (cards > 0) return { found: true, detail: `${cards} el-cards` };

    const statCards = await page.locator('.stat-card, .kpi-card, .dashboard').count();
    if (statCards > 0) return { found: true, detail: `${statCards} stat/kpi cards` };

    // Dashboard-specific containers
    const dashboardContainer = await page.locator('.dashboard-container, .dashboard-admin, .dashboard-default').count();
    if (dashboardContainer > 0) return { found: true, detail: 'dashboard container present' };

    const mainContent = await page.locator('.page-container, .main-content, [class*="container"]').count();
    if (mainContent > 0) return { found: true, detail: 'page container present' };

    const skeleton = await page.locator('.el-skeleton').count();
    if (skeleton > 0) return { found: false, detail: 'skeleton still loading' };

    return { found: false, detail: 'no recognizable content' };
  } catch {
    return { found: false, detail: 'error checking content' };
  }
}

async function checkTableData(page) {
  await page.waitForTimeout(2500);
  try {
    const rows = await page.locator('.el-table__row').count();
    if (rows > 0) return { hasRows: true, count: rows };

    const emptyText = page.locator('.el-table__empty-text, .el-empty__description');
    const emptyCount = await emptyText.count();
    if (emptyCount > 0) {
      const text = await emptyText.first().textContent().catch(() => '暂无数据');
      return { hasRows: false, count: 0, emptyState: text?.trim() };
    }

    return { hasRows: false, count: 0, emptyState: 'no table detected' };
  } catch {
    return { hasRows: false, count: 0, emptyState: 'error' };
  }
}

// ─── Result tracking ────────────────────────────────────────────────────────

const results = { layer1: [], layer2: [], layer3: [] };

function recordResult(layer, name, status, detail, screenshot) {
  results[layer].push({ name, status, detail, screenshot });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '~' : '✗';
  const ss = screenshot ? ` → ${path.basename(screenshot)}` : '';
  console.log(`  ${icon} ${name}: ${detail}${ss}`);
}

// ─── Navigate with auth injection ───────────────────────────────────────────

async function navigateWithAuth(page, token, loginData, targetPath) {
  // Re-inject auth before each navigation in case a redirect cleared it
  // (page must already be on the correct origin for localStorage to work)
  const currentUrl = page.url();
  if (!currentUrl.startsWith(BASE_URL)) {
    // We're on a different origin — re-seed from login page
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(500);
  }
  await injectAuth(page, token, loginData);

  // Navigate to target
  await page.goto(BASE_URL + targetPath, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

  // Wait for Vue to mount and initial API calls to resolve
  // Dashboard uses async component loading — needs more time
  const isDashboard = targetPath === '/dashboard';
  await page.waitForTimeout(isDashboard ? 4000 : 2500);
}

// ─── Main test runner ────────────────────────────────────────────────────────

async function runTests() {
  ensureScreenshotsDir();

  // Step 1: Get auth token via API
  let authToken, authData;
  for (const creds of CREDENTIALS) {
    try {
      const result = await fetchLoginToken(creds.username, creds.password);
      authToken = result.token;
      authData = result.data;
      break;
    } catch (e) {
      console.warn(`[auth] ${e.message}`);
    }
  }

  if (!authToken) {
    console.error('[FATAL] Could not obtain auth token from any credential.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Seed the auth on the first visit — navigate to /login, inject, then verify by navigating to dashboard
  console.log(`\n[setup] Navigating to ${BASE_URL}/login to seed localStorage...`);
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(1000);
  await injectAuth(page, authToken, authData);

  // Warm-up: navigate to dashboard once to let Vue initialize auth state
  console.log('[setup] Warm-up navigation to /dashboard...');
  await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(3000);

  // Re-inject auth in case the warm-up navigation cleared localStorage
  await injectAuth(page, authToken, authData);
  console.log('[setup] Auth warmed up and re-injected.');

  // ─── Layer 1: Page Accessibility ─────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' LAYER 1: Page Accessibility (19 pages)');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const pg of LAYER1_PAGES) {
    try {
      await navigateWithAuth(page, authToken, authData, pg.path);

      const errCheck = await checkPageErrors(page);
      if (errCheck.hasError) {
        const ss = await screenshotOnFailure(page, `l1_${pg.name}`);
        recordResult('layer1', pg.name, 'FAIL', errCheck.reason, ss);
        continue;
      }

      const contentCheck = await hasContent(page);
      if (contentCheck.found) {
        recordResult('layer1', pg.name, 'PASS', contentCheck.detail, null);
      } else {
        const ss = await screenshotOnFailure(page, `l1_${pg.name}`);
        recordResult('layer1', pg.name, 'WARN', `No content: ${contentCheck.detail}`, ss);
      }
    } catch (e) {
      const ss = await screenshotOnFailure(page, `l1_${pg.name}`);
      recordResult('layer1', pg.name, 'FAIL', e.message.split('\n')[0].slice(0, 80), ss);
    }
  }

  // ─── Layer 2: Core CRUD Read Operations ──────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' LAYER 2: Core CRUD Read Operations (7 pages)');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const pg of LAYER2_CRUD_PAGES) {
    try {
      await navigateWithAuth(page, authToken, authData, pg.path);

      const errCheck = await checkPageErrors(page);
      if (errCheck.hasError) {
        const ss = await screenshotOnFailure(page, `l2_${pg.name}`);
        recordResult('layer2', pg.name, 'FAIL', errCheck.reason, ss);
        continue;
      }

      const rowCheck = await checkTableData(page);
      if (rowCheck.hasRows) {
        let detailNote = `${rowCheck.count} rows`;

        if (pg.tryDetail) {
          try {
            const firstRow = page.locator('.el-table__row').first();
            await firstRow.click({ timeout: 4000 });
            await page.waitForTimeout(1500);
            const urlAfterClick = page.url();
            if (urlAfterClick !== BASE_URL + pg.path) {
              detailNote += ` + detail nav OK (→ ${urlAfterClick.replace(BASE_URL, '')})`;
              // Go back for next test
              await page.goto(BASE_URL + pg.path, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
            } else {
              detailNote += ' (row click → dialog or no-nav)';
            }
          } catch {
            detailNote += ' (could not click row)';
          }
        }

        recordResult('layer2', pg.name, 'PASS', detailNote, null);
      } else if (rowCheck.emptyState) {
        recordResult('layer2', pg.name, 'WARN', `Empty: "${rowCheck.emptyState}"`, null);
      } else {
        const ss = await screenshotOnFailure(page, `l2_${pg.name}`);
        recordResult('layer2', pg.name, 'FAIL', 'No table/data found', ss);
      }
    } catch (e) {
      const ss = await screenshotOnFailure(page, `l2_${pg.name}`);
      recordResult('layer2', pg.name, 'FAIL', e.message.split('\n')[0].slice(0, 80), ss);
    }
  }

  // ─── Layer 3: New Module Verification ────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' LAYER 3: New Module Verification');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const pg of LAYER3_NEW_MODULES) {
    try {
      await navigateWithAuth(page, authToken, authData, pg.path);

      const currentUrl = page.url();
      const errCheck = await checkPageErrors(page);

      if (currentUrl.includes('/404')) {
        const ss = await screenshotOnFailure(page, `l3_${pg.name}`);
        recordResult('layer3', pg.name, 'FAIL', 'Route → 404 (not registered)', ss);
        continue;
      }
      if (currentUrl.includes('/403')) {
        recordResult('layer3', pg.name, 'WARN', 'Route exists, no permission (403)', null);
        continue;
      }
      if (errCheck.hasError && !errCheck.reason.includes('Error toast')) {
        const ss = await screenshotOnFailure(page, `l3_${pg.name}`);
        recordResult('layer3', pg.name, 'FAIL', errCheck.reason, ss);
        continue;
      }

      const rowCheck = await checkTableData(page);
      const contentCheck = await hasContent(page);

      let detail, status;
      if (rowCheck.hasRows) {
        detail = `Table renders with ${rowCheck.count} rows`;
        status = 'PASS';
      } else if (rowCheck.emptyState && rowCheck.emptyState !== 'no table detected' && rowCheck.emptyState !== 'error') {
        detail = `Table renders empty ("${rowCheck.emptyState}") — module accessible`;
        status = 'PASS';
      } else if (contentCheck.found) {
        detail = `Page renders (${contentCheck.detail}) — accessible`;
        status = 'PASS';
      } else {
        detail = `No content detected`;
        status = 'WARN';
      }

      if (errCheck.hasError) {
        detail += ` [but: ${errCheck.reason}]`;
        status = 'WARN';
      }

      const ss = status !== 'PASS' ? await screenshotOnFailure(page, `l3_${pg.name}`) : null;
      recordResult('layer3', pg.name, status, detail, ss);

    } catch (e) {
      const ss = await screenshotOnFailure(page, `l3_${pg.name}`);
      recordResult('layer3', pg.name, 'FAIL', e.message.split('\n')[0].slice(0, 80), ss);
    }
  }

  await context.close();
  await browser.close();

  printSummary();
}

function printSummary() {
  const layerNames = {
    layer1: 'Layer 1 — Page Accessibility',
    layer2: 'Layer 2 — Core CRUD Read',
    layer3: 'Layer 3 — New Modules',
  };

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           CRETAS WEB-ADMIN E2E TEST RESULTS                      ║');
  console.log(`║           Server: ${BASE_URL.padEnd(45)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  let totalPass = 0, totalWarn = 0, totalFail = 0;

  for (const layer of ['layer1', 'layer2', 'layer3']) {
    const items = results[layer];
    const pass = items.filter(r => r.status === 'PASS').length;
    const warn = items.filter(r => r.status === 'WARN').length;
    const fail = items.filter(r => r.status === 'FAIL').length;
    totalPass += pass; totalWarn += warn; totalFail += fail;

    console.log(`\n  ── ${layerNames[layer]} ──`);
    console.log(`     PASS: ${pass}  WARN: ${warn}  FAIL: ${fail}  (${items.length} total)\n`);

    const colW = 28;
    console.log(`  ${'Page'.padEnd(colW)} ${'Status'.padEnd(6)}  Detail`);
    console.log(`  ${'─'.repeat(colW)} ${'─'.repeat(6)}  ${'─'.repeat(44)}`);
    for (const r of items) {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '~' : '✗';
      const name = r.name.length > colW - 1 ? r.name.slice(0, colW - 2) + '…' : r.name;
      const detail = r.detail.length > 60 ? r.detail.slice(0, 57) + '...' : r.detail;
      console.log(`  ${name.padEnd(colW)} ${icon} ${r.status.padEnd(5)}  ${detail}`);
      if (r.screenshot) {
        console.log(`  ${''.padEnd(colW)}          [screenshot: ${path.basename(r.screenshot)}]`);
      }
    }
  }

  const total = totalPass + totalWarn + totalFail;
  const pct = total > 0 ? Math.round((totalPass / total) * 100) : 0;
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log(`║  TOTAL: ${totalPass} PASS  ${totalWarn} WARN  ${totalFail} FAIL  (${pct}% pass rate, ${total} tests)${' '.repeat(Math.max(0, 22 - String(total).length))}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (totalFail > 0) {
    console.log('  Failures:');
    for (const layer of ['layer1', 'layer2', 'layer3']) {
      for (const r of results[layer]) {
        if (r.status === 'FAIL') {
          const ln = layerNames[layer].split('—')[0].trim();
          console.log(`    ✗ [${ln}] ${r.name}: ${r.detail}`);
        }
      }
    }
    console.log('');
  }

  if (totalWarn > 0) {
    console.log('  Warnings:');
    for (const layer of ['layer1', 'layer2', 'layer3']) {
      for (const r of results[layer]) {
        if (r.status === 'WARN') {
          const ln = layerNames[layer].split('—')[0].trim();
          console.log(`    ~ [${ln}] ${r.name}: ${r.detail}`);
        }
      }
    }
    console.log('');
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

// ─── Run ────────────────────────────────────────────────────────────────────
runTests().catch(e => {
  console.error('\n[FATAL] Unhandled error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
