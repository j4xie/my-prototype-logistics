/**
 * R19 breadth round — 5 never-touched modules at smoke coverage
 *
 * Rule 11.4 trigger: 12+ rounds have left hr/quality/production/inventory/equipment
 * at `coverage=none`. Customer can hit any of them. R19 MUST cover each at smoke
 * minimum before any further depth rounds on already-covered modules.
 *
 * Modules covered (13 routes total):
 *   hr/*        — employees, departments, attendance (3)
 *   quality/*   — inspections, disposals, standards (3)
 *   production/* — batches, plans, bom (3)
 *   inventory/* — warehouse/materials, warehouse/inventory, warehouse/shipments (3)
 *     (naming note: app uses /warehouse/ not /inventory/ — path = warehouse, module = warehouse per router)
 *   equipment/* — list, maintenance, alerts (3)
 *   total: 15 routes
 *
 * Each probe: navigate → wait networkidle → observe (console errors, 4xx/5xx, page state) →
 *   classify PASS / WARN / REPRO / FAIL.
 *
 * Smoke only — no button clicks or form submits. Deeper rounds follow.
 *
 * Pattern: mirror tests/e2e-comprehensive/e2e-R18-breadth-16bugs.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { BASE } from './lib/helpers.mjs';
import { setupAuthOnce, newContextWithAuth } from './lib/auth-cache.mjs';

const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
const setup = existsSync(SETUP_FILE) ? JSON.parse(readFileSync(SETUP_FILE, 'utf8')) : null;
const FACTORY_ID = setup?.factoryId || 'FOOD_3101_048';
const ROUND = 19;
const results = [];

function record(testId, probe, module, status, evidence = {}, depth = 'smoke') {
  const r = { layer: 'L4', testId, probe, module, status, depth, evidence, ts: new Date().toISOString() };
  results.push(r);
  const icon = status === 'PASS' ? '✓' : status === 'REPRO' ? '🐛' : status === 'WARN' ? '⚠' : '✗';
  console.log(`  [${icon}] ${module}/${probe}: ${status}`);
  for (const [k, v] of Object.entries(evidence)) {
    if (v !== undefined) console.log(`      ${k}: ${typeof v === 'string' ? v.substring(0, 200) : JSON.stringify(v).substring(0, 200)}`);
  }
}

/**
 * Generic smoke probe: navigate to URL, observe page state + network 4xx/5xx + console errors.
 * Uses per-route try/catch so one slow route doesn't block the round.
 * Classification:
 *   PASS  — page rendered (menu+content present), no 4xx/5xx, no console errors
 *   WARN  — page rendered but some 4xx/5xx observed (common: 404 on optional subresource)
 *   REPRO — redirected to /403 or /404, or critical render failure
 *   FAIL  — navigation threw (timeout, nav error)
 */
async function probePage(browser, { id, url, module, probe }) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');

  const networkErrors = [];
  const consoleErrors = [];
  page.on('response', r => {
    const status = r.status();
    if (status >= 400) {
      networkErrors.push({
        url: r.url().replace(BASE, '').replace('http://139.196.165.140:8086', ''),
        status,
        method: r.request().method(),
      });
    }
  });
  page.on('pageerror', e => consoleErrors.push(e.message.substring(0, 200)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200)); });

  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(4000); // Vue render + router redirect + initial API

    const pageState = await page.evaluate((origUrl) => {
      const has404 = document.body.innerText.includes('请求资源不存在') ||
                     document.title.includes('404');
      const has403 = document.body.innerText.includes('访问被拒绝') ||
                     document.body.innerText.includes('无权限') ||
                     document.title.includes('无权限') ||
                     document.title.includes('Forbidden');
      const menuRendered = !!document.querySelector('.el-menu, .app-sidebar');
      const tableRendered = !!document.querySelector('.el-table, .el-empty');
      const mainRendered = !!document.querySelector('main, .main-content, .app-main, .el-main');
      const currentUrl = location.pathname;
      const redirectedAway = currentUrl !== origUrl && !currentUrl.startsWith(origUrl);
      const bodyTextLen = document.body.innerText.length;
      return {
        has404, has403,
        menuRendered, tableRendered, mainRendered,
        title: document.title,
        currentPath: currentUrl,
        redirectedAway,
        bodyTextLen,
        bodyPreview: document.body.innerText.substring(0, 150),
      };
    }, url);

    const has4xx = networkErrors.filter(e => e.status >= 400 && e.status < 500).length;
    const has5xx = networkErrors.filter(e => e.status >= 500).length;
    const hasConsoleErr = consoleErrors.length > 0;

    const redirectedTo403 = pageState.currentPath === '/403';
    const redirectedTo404 = pageState.currentPath === '/404';

    let status;
    if (redirectedTo403 || redirectedTo404 || pageState.has403 || pageState.has404) {
      status = 'REPRO';
    } else if (!pageState.menuRendered || (!pageState.tableRendered && !pageState.mainRendered)) {
      // partial render — menu missing or content area missing
      status = 'WARN';
    } else if (has5xx > 0 || hasConsoleErr) {
      // hard error (5xx or console error) with rendered page
      status = 'WARN';
    } else if (has4xx > 0) {
      // 4xx with rendered page — soft warning
      status = 'WARN';
    } else {
      status = 'PASS';
    }

    const evidence = {
      url,
      currentPath: pageState.currentPath,
      menuRendered: pageState.menuRendered,
      tableRendered: pageState.tableRendered,
      title: pageState.title,
      bodyTextLen: pageState.bodyTextLen,
      networkErrorCount: networkErrors.length,
      networkErrorSample: networkErrors.slice(0, 3),
      consoleErrorCount: consoleErrors.length,
      consoleErrorSample: consoleErrors.slice(0, 2),
      redirectedTo403,
      redirectedTo404,
    };

    record(id, probe, module, status, evidence);
  } catch (e) {
    record(id, probe, module, 'FAIL', { error: e.message.substring(0, 200), url });
  } finally {
    await context.close();
  }
}

// 5 modules × 3 routes each = 15 probes
const probes = [
  // hr/* — never touched (R18 only covered /system/roles which is admin, not hr)
  { id: 'hr-1', url: '/hr/employees', module: 'hr/employees', probe: 'list_load' },
  { id: 'hr-2', url: '/hr/departments', module: 'hr/departments', probe: 'list_load' },
  { id: 'hr-3', url: '/hr/attendance', module: 'hr/attendance', probe: 'list_load' },

  // quality/* — never touched
  { id: 'quality-1', url: '/quality/inspections', module: 'quality/inspections', probe: 'list_load' },
  { id: 'quality-2', url: '/quality/disposals', module: 'quality/disposals', probe: 'list_load' },
  { id: 'quality-3', url: '/quality/standards', module: 'quality/standards', probe: 'list_load' },

  // production/* — never touched (sales_orders is tested extensively but production is separate)
  { id: 'prod-1', url: '/production/batches', module: 'production/batches', probe: 'list_load' },
  { id: 'prod-2', url: '/production/plans', module: 'production/plans', probe: 'list_load' },
  { id: 'prod-3', url: '/production/bom', module: 'production/bom', probe: 'list_load' },

  // inventory/* — never touched (warehouse is the path prefix; module=warehouse in router)
  // distinct from sales/deliveries (which is FG shipment, not raw-material inventory)
  { id: 'inv-1', url: '/warehouse/materials', module: 'warehouse/materials', probe: 'list_load' },
  { id: 'inv-2', url: '/warehouse/inventory', module: 'warehouse/inventory', probe: 'list_load' },
  { id: 'inv-3', url: '/warehouse/shipments', module: 'warehouse/shipments', probe: 'list_load' },

  // equipment/* — never touched
  { id: 'equip-1', url: '/equipment/list', module: 'equipment/list', probe: 'list_load' },
  { id: 'equip-2', url: '/equipment/maintenance', module: 'equipment/maintenance', probe: 'list_load' },
  { id: 'equip-3', url: '/equipment/alerts', module: 'equipment/alerts', probe: 'list_load' },
];

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  R19 breadth round — 5 never-touched modules');
  console.log('  Rule 11.4 hard stop: 12+ rounds at coverage=none');
  console.log('  Modules: hr / quality / production / inventory / equipment');
  console.log('  Probes: 15 smoke (3 per module)');
  console.log('═══════════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  try {
    await setupAuthOnce(browser, 'e2e_factory_admin');
    console.log('✓ Auth cache ready for e2e_factory_admin\n');

    let lastModule = null;
    for (const p of probes) {
      const modTop = p.module.split('/')[0];
      if (modTop !== lastModule) {
        console.log(`\n--- Module: ${modTop} ---`);
        lastModule = modTop;
      }
      await probePage(browser, p);
    }
  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    results.push({
      layer: 'L4', testId: 'fatal', probe: 'error', module: 'runtime',
      status: 'FAIL', evidence: { message: e.message }, ts: new Date().toISOString(),
    });
  } finally {
    await browser.close();
  }

  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const repro = results.filter(r => r.status === 'REPRO').length;
  const fail = results.filter(r => r.status === 'FAIL').length;

  // Coverage matrix update: every probed route transitions from none → smoke
  const coverage_matrix_update = {};
  for (const p of probes) {
    coverage_matrix_update[p.module] = 'smoke';
  }

  const summary = {
    round: ROUND,
    timestamp: new Date().toISOString(),
    factoryId: FACTORY_ID,
    notes: 'R19 breadth — 5 never-touched modules (hr/quality/production/inventory/equipment) at smoke',
    coverage_matrix_update,
    results,
    summary: { pass, warn, repro, fail, total: results.length },
  };
  const outFile = `tests/e2e-comprehensive/results/e2e-R19-breadth-5modules.json`;
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Saved → ${outFile}`);
  console.log(`  Results: ${pass} PASS ✓ / ${warn} WARN ⚠ / ${repro} REPRO 🐛 / ${fail} FAIL`);
  console.log(`  Coverage matrix: +${Object.keys(coverage_matrix_update).length} smoke entries`);
  console.log(`═══════════════════════════════════════════════════`);

  process.exit(fail > 0 ? 1 : 0);
})();
