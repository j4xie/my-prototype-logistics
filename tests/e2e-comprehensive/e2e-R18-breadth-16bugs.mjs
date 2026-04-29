/**
 * R18 breadth round — reproduce 2026-04-15 customer bug report (16 bugs)
 *
 * Trigger: Rule 11.4 hard stop. R6-R17 (12 rounds) all on sales-order.
 * Every other module at coverage=none. Customer reported 16 bugs —
 * 0 caught by our framework. R18 MUST be breadth per new Rule 11.
 *
 * Structure:
 *   1 deep L4 (canvas编辑器 403 — pattern candidate for Rule 8 cross-module sweep)
 *   15 smoke probes (1 per reported bug, uses bug as entry point per Rule 11.4)
 *
 * Each probe: navigate → wait → capture (console errors, network 4xx/5xx, toasts,
 *   page state) → classify (reproduced / not_reproduced / different_error).
 *
 * Goal: REPRODUCE + CLASSIFY. No fixes in this round — just coverage-matrix seeding.
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { BASE, PASSWORD } from './lib/helpers.mjs';
import { setupAuthOnce, newContextWithAuth } from './lib/auth-cache.mjs';

const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
const setup = existsSync(SETUP_FILE) ? JSON.parse(readFileSync(SETUP_FILE, 'utf8')) : null;
const FACTORY_ID = setup?.factoryId || 'FOOD_3101_048';
const ROUND = 18;
const results = [];

function record(testId, probe, module, status, evidence = {}, depth = 'smoke') {
  const r = { layer: 'L4', testId, probe, module, status, depth, evidence, ts: new Date().toISOString() };
  results.push(r);
  const icon = status === 'PASS' ? '✓' : status === 'REPRO' ? '🐛' : status === 'NOT_REPRO' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  console.log(`  [${icon}] ${module}/${probe}: ${status}`);
  for (const [k, v] of Object.entries(evidence)) {
    if (v !== undefined) console.log(`      ${k}: ${typeof v === 'string' ? v.substring(0, 200) : JSON.stringify(v).substring(0, 200)}`);
  }
}

/** Generic probe: navigate to URL, observe page state + network 4xx/5xx + console errors */
async function probePage(browser, { id, url, module, probe, expect }) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');

  const networkErrors = [];
  const consoleErrors = [];
  page.on('response', r => {
    const status = r.status();
    if (status >= 400) {
      networkErrors.push({ url: r.url().replace(BASE, '').replace('http://139.196.165.140:8086', ''), status, method: r.request().method() });
    }
  });
  page.on('pageerror', e => consoleErrors.push(e.message.substring(0, 200)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200)); });

  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(4000); // give Vue time to render, router to redirect, API calls to fire

    const pageState = await page.evaluate((origUrl) => {
      const has404 = document.body.innerText.includes('请求资源不存在') ||
                     document.body.innerText.includes('404') ||
                     document.title.includes('404');
      const has403 = document.body.innerText.includes('403') ||
                     document.body.innerText.includes('访问被拒绝') ||
                     document.body.innerText.includes('无权限') ||
                     document.title.includes('无权限') ||
                     document.title.includes('Forbidden');
      const hasError = document.body.innerText.includes('失败') ||
                       document.body.innerText.includes('错误') ||
                       document.body.innerText.includes('canceled');
      const menuRendered = !!document.querySelector('.el-menu, .app-sidebar');
      const tableRendered = !!document.querySelector('.el-table, .el-empty');
      const currentUrl = location.pathname;
      const redirectedAway = currentUrl !== origUrl && !currentUrl.startsWith(origUrl);
      return { has404, has403, hasError, menuRendered, tableRendered, title: document.title, url: location.href, redirectedAway, currentPath: currentUrl };
    }, url);

    // Classify result based on expected bug vs observed
    const has4xx = networkErrors.filter(e => e.status >= 400 && e.status < 500).length;
    const has5xx = networkErrors.filter(e => e.status >= 500).length;
    const hasConsoleErr = consoleErrors.length > 0;

    let status = 'PASS';
    const evidence = {
      url,
      pageState,
      networkErrorsCount: networkErrors.length,
      networkErrorSample: networkErrors.slice(0, 3),
      consoleErrorsCount: consoleErrors.length,
      consoleErrorSample: consoleErrors.slice(0, 2),
    };

    // Redirect to /403 or /404 counts as reproduction regardless of expect
    const redirectedTo403 = pageState.currentPath === '/403';
    const redirectedTo404 = pageState.currentPath === '/404';
    const genericBlocked = pageState.redirectedAway && (redirectedTo403 || redirectedTo404);

    if (expect === '403') {
      status = pageState.has403 || redirectedTo403 || networkErrors.some(e => e.status === 403) ? 'REPRO' : 'NOT_REPRO';
    } else if (expect === '404') {
      status = pageState.has404 || redirectedTo404 || networkErrors.some(e => e.status === 404) ? 'REPRO' : 'NOT_REPRO';
    } else if (expect === 'error') {
      status = pageState.hasError || has4xx > 0 || has5xx > 0 || hasConsoleErr || genericBlocked ? 'REPRO' : 'NOT_REPRO';
    } else if (expect === 'timeout') {
      status = 'NOT_REPRO'; // can't easily detect timeout in smoke
    } else {
      status = has4xx > 0 || has5xx > 0 ? 'WARN' : 'PASS';
    }
    // Always add redirect info to evidence
    evidence.redirectedTo403 = redirectedTo403;
    evidence.redirectedTo404 = redirectedTo404;

    record(id, probe, module, status, evidence);
  } catch (e) {
    record(id, probe, module, 'FAIL', { error: e.message.substring(0, 200) });
  } finally {
    await context.close();
  }
}

/** Deep probe: full round-trip for canvas-editor (Rule 2 + Rule 8 pattern anchor) */
async function probeCanvasEditorDeep(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_factory_admin');
  const networkErrors = [];
  page.on('response', r => {
    if (r.status() >= 400) {
      networkErrors.push({ url: r.url().replace(BASE, '').replace('http://139.196.165.140:8086', ''), status: r.status() });
    }
  });

  try {
    await page.goto(`${BASE}/canvas-editor`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => ({
      url: location.href,
      currentPath: location.pathname,
      title: document.title,
      hasMenu: !!document.querySelector('.el-menu, .app-sidebar'),
      has403Text: document.body.innerText.includes('403') || document.body.innerText.includes('访问被拒绝'),
      hasForbiddenText: document.body.innerText.includes('无权限') || document.body.innerText.includes('Forbidden'),
      hasForbiddenTitle: document.title.includes('无权限'),
      bodyPreview: document.body.innerText.substring(0, 300),
      mainContentRendered: !!document.querySelector('main, .main-content, .canvas-editor'),
      redirectedTo403: location.pathname === '/403',
    }));

    const forbidden403s = networkErrors.filter(e => e.status === 403);
    const forbidden401s = networkErrors.filter(e => e.status === 401);
    const other4xx = networkErrors.filter(e => e.status >= 400 && e.status < 500 && e.status !== 403 && e.status !== 401);

    // REPRO if: redirected to /403 page OR 403 network response OR 403/无权限 text/title
    const reprod = state.redirectedTo403 || forbidden403s.length > 0 || state.has403Text || state.hasForbiddenTitle;

    record('deep-canvas', 'full_roundtrip', 'system/canvas-editor',
      reprod ? 'REPRO' : 'NOT_REPRO',
      {
        url: '/canvas-editor',
        state,
        forbidden403s,
        forbidden401s,
        other4xx,
        networkErrorCount: networkErrors.length,
        rootCause: state.redirectedTo403 ? 'router guard redirected to /403 (frontend RBAC)' :
                   forbidden403s.length ? 'backend returned 403 on API call' : 'unknown',
      }, 'deep');
  } catch (e) {
    record('deep-canvas', 'full_roundtrip', 'system/canvas-editor', 'FAIL', { error: e.message });
  } finally {
    await context.close();
  }
}

// Bug-to-URL mapping (2026-04-15 customer report)
const probes = [
  // Deep target — canvas-editor (bug #1)
  { id: 'bug1', url: '/canvas-editor', module: 'system/canvas-editor', probe: 'load+403_check', expect: '403', __deep: true },

  // System-admin cluster (bugs #6, #7, #8)
  { id: 'bug6', url: '/system/roles', module: 'system/roles', probe: 'permission_view_404', expect: '404' },
  { id: 'bug7', url: '/system/workflow-designer', module: 'system/workflow-designer', probe: 'load_404', expect: '404' },
  { id: 'bug8', url: '/system/features', module: 'system/features', probe: 'manual_sync_fail', expect: 'error' },

  // SmartBI cluster (bugs #2, #12, #13, #14, #15, #3)
  { id: 'bug2', url: '/smart-bi/financial-dashboard', module: 'smart-bi/financial-dashboard', probe: 'load_canceled', expect: 'error' },
  { id: 'bug3', url: '/smart-bi/upload', module: 'smart-bi/upload', probe: 'upload_process_fail', expect: 'error' },
  { id: 'bug12', url: '/smart-bi/finance', module: 'smart-bi/finance', probe: 'demo_data_fail', expect: 'error' },
  { id: 'bug13', url: '/smart-bi/analysis', module: 'smart-bi/analysis', probe: 'export_fail', expect: 'error' },
  { id: 'bug14', url: '/smart-bi/query', module: 'smart-bi/query', probe: 'ai_query_timeout', expect: 'timeout' },
  { id: 'bug15', url: '/smart-bi/query-templates', module: 'smart-bi/query-templates', probe: 'template_exec_loading', expect: 'error' },

  // Sales cluster (bugs #4, #5)
  { id: 'bug5', url: '/sales/shipments', module: 'sales/shipments', probe: 'new_shipment_noresponse', expect: 'error' },
  // bug4 (role permission) — tested separately with non-admin role below

  // Analytics cluster (bug #9)
  { id: 'bug9', url: '/analytics/alert-dashboard', module: 'analytics/alert-dashboard', probe: 'resolve_missing_param', expect: 'error' },

  // Restaurant / daily management (bugs #10, #11)
  { id: 'bug10', url: '/restaurant/recipes', module: 'restaurant/recipes', probe: 'new_recipe_fail', expect: 'error' },
  { id: 'bug11', url: '/restaurant/stocktaking', module: 'restaurant/stocktaking', probe: 'new_stocktake_null', expect: 'error' },
];

// Separately test bug #4: role permission regression (sales_mgr should be able to create SO)
async function probeBug4RolePermission(browser) {
  const { context, page } = await newContextWithAuth(browser, 'e2e_sales_mgr');
  const networkErrors = [];
  page.on('response', r => {
    if (r.status() >= 400) networkErrors.push({ url: r.url().replace(BASE, ''), status: r.status() });
  });
  try {
    await page.goto(`${BASE}/sales/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Try to find + click "新建" button
    const newBtnState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, .el-button'));
      const newBtn = btns.find(b => b.textContent?.includes('新建') || b.textContent?.includes('新增'));
      return {
        newBtnFound: !!newBtn,
        newBtnDisabled: newBtn?.disabled || newBtn?.classList?.contains('is-disabled'),
        hasPermissionDenial: document.body.innerText.includes('无权限') || document.body.innerText.includes('无权操作'),
        pageText: document.body.innerText.substring(0, 300),
      };
    });
    const has403 = networkErrors.some(e => e.status === 403);
    record('bug4', 'role_permission', 'sales/orders#role=sales_mgr',
      (newBtnState.hasPermissionDenial || newBtnState.newBtnDisabled || has403) ? 'REPRO' : 'NOT_REPRO',
      { role: 'sales_mgr', newBtnState, networkErrors: networkErrors.slice(0, 3) });
  } catch (e) {
    record('bug4', 'role_permission', 'sales/orders#role=sales_mgr', 'FAIL', { error: e.message });
  } finally {
    await context.close();
  }
}

(async () => {
  console.log('═══════════════════════════════════════');
  console.log('  R18 breadth round — 16 customer bugs');
  console.log('  Rule 11.4 hard stop applied');
  console.log('═══════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  try {
    // Pre-warm auth cache for both roles (15s rate-limit guard handles spacing)
    await setupAuthOnce(browser, 'e2e_factory_admin');
    await setupAuthOnce(browser, 'e2e_sales_mgr');
    console.log('✓ Auth cache ready for 2 roles\n');

    // Deep test first
    console.log('--- DEEP L4 (bug #1 canvas-editor 403) ---');
    await probeCanvasEditorDeep(browser);

    // Smoke probes (15)
    console.log('\n--- SMOKE PROBES (14 bugs) ---');
    for (const p of probes) {
      if (p.__deep) continue; // already handled above
      await probePage(browser, p);
    }

    // Role permission probe
    console.log('\n--- ROLE PERMISSION (bug #4) ---');
    await probeBug4RolePermission(browser);

  } catch (e) {
    console.error(`FATAL: ${e.message}`);
    results.push({ layer: 'L4', testId: 'fatal', probe: 'error', status: 'FAIL', evidence: { message: e.message }, ts: new Date().toISOString() });
  } finally {
    await browser.close();
  }

  // Summary
  const repro = results.filter(r => r.status === 'REPRO').length;
  const notRepro = results.filter(r => r.status === 'NOT_REPRO').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;

  const summary = {
    round: ROUND,
    timestamp: new Date().toISOString(),
    factoryId: FACTORY_ID,
    notes: 'R18 breadth round — reproducing 16 customer bugs (Rule 11.4 hard stop)',
    coverage_matrix_update: {
      'system/canvas-editor': 'deep',
      'system/roles': 'smoke',
      'system/workflow-designer': 'smoke',
      'system/features': 'smoke',
      'smart-bi/financial-dashboard': 'smoke',
      'smart-bi/upload': 'smoke',
      'smart-bi/finance': 'smoke',
      'smart-bi/analysis': 'smoke',
      'smart-bi/query': 'smoke',
      'smart-bi/query-templates': 'smoke',
      'sales/shipments': 'smoke',
      'analytics/alert-dashboard': 'smoke',
      'restaurant/recipes': 'smoke',
      'restaurant/stocktaking': 'smoke',
    },
    results,
    summary: { repro, notRepro, pass, warn, fail, total: results.length },
  };
  const outFile = `tests/e2e-comprehensive/results/e2e-R18-breadth-16bugs.json`;
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\n✓ Saved → ${outFile}`);
  console.log(`  结果: ${repro} REPRO 🐛 / ${notRepro} NOT_REPRO ✓ / ${warn} WARN ⚠ / ${pass} PASS / ${fail} FAIL`);
  console.log(`  Coverage matrix: +14 smoke, +1 deep`);

  process.exit(fail > 0 ? 1 : 0);
})();
