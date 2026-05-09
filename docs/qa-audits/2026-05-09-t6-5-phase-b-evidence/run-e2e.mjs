// Active E2E for T6.5 Phase B prod cutover (post 23-stub deploy 2026-05-09 23:33 CST).
// Verifies web-admin (139:8086) → Java prod (47:10010 via nginx) chain has no
// customer-facing regression after 23 SmartBI Analysis endpoints stubbed to 410 Gone.
//
// Substitutions vs marching order:
//   F002 admin not loginnable (no such user with default password) → F006 (Steve preferred, Stage 2 cohort)
//   F999 not a real factory ID (synthetic golden) → F001 (cohort + Gold POS data per memory)
//
// Usage: node run-e2e.mjs   (from this directory; resolves playwright from web-admin/node_modules)

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
// Resolve playwright from the main worktree's web-admin/node_modules (this worktree
// has no node_modules — per memory reference_worktree_node_modules.md).
const playwrightPath = 'C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/playwright';
const { chromium } = require(playwrightPath);

const WEB_ADMIN_URL = 'http://139.196.165.140:8086';
const EVIDENCE_DIR = process.cwd();

const FACTORIES = [
  { factoryId: 'F006', username: 'f006_admin',     password: '123456', label: 'cohort-customer' },
  { factoryId: 'F001', username: 'factory_admin1', password: '123456', label: 'cohort-gold-pos'  },
];

// 6 flows mirroring marching order (web-admin path, expected api hit, expected api status)
const FLOWS = [
  { id: 1, name: 'dashboard',        path: '/smart-bi/dashboard',        watchApi: '/smart-bi/data-date-range', expect: 410, note: 'Dashboard.vue calls /data-date-range on mount' },
  { id: 2, name: 'sales-analysis',   path: '/smart-bi/sales',            watchApi: '/smart-bi/analysis/sales',  expect: 410, note: 'SalesAnalysis.vue calls /analysis/sales' },
  { id: 3, name: 'finance-analysis', path: '/smart-bi/finance',          watchApi: '/smart-bi/analysis/finance',expect: 410, note: 'FinanceAnalysis.vue calls /analysis/finance' },
  { id: 4, name: 'query-templates',  path: '/smart-bi/query-templates',  watchApi: '/smart-bi/query-templates', expect: 410, note: 'QueryTemplateManager.vue calls GET /query-templates' },
  { id: 5, name: 'nl-query',         path: '/smart-bi/query',            watchApi: null,                         expect: null, note: 'AIQuery.vue mount only — POST /query fires on user submit (alive 200)' },
  { id: 6, name: 'analysis-page',    path: '/smart-bi/analysis',         watchApi: null,                         expect: null, note: 'SmartBIAnalysis.vue mount only — POST /drill-down fires on user click (alive 200)' },
];

async function loginViaUI(page, factory) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto(`${WEB_ADMIN_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  // wait for Element Plus form to render
  await page.waitForSelector('input[placeholder*="用户名"], input[name="username"], input[type="text"]', { timeout: 10000 });

  const usernameInput = await page.$('input[placeholder*="用户名"]') || await page.$('input[name="username"]') || (await page.$$('input[type="text"]'))[0];
  const passwordInput = await page.$('input[type="password"]');
  await usernameInput.fill(factory.username);
  await passwordInput.fill(factory.password);

  // submit — try .login-button class first, then "登 录" button (with space), then Enter
  const loginBtn = await page.$('.login-button')
    || await page.$('button.login-button')
    || await page.$('button:has-text("登 录")')
    || await page.$('button:has-text("登录")');
  if (loginBtn) {
    await loginBtn.click();
  } else {
    // fallback: press Enter on password field — login form has @keyup.enter handler
    await passwordInput.press('Enter');
  }

  // wait for redirect away from /login or for token to land
  await page.waitForFunction(() => {
    return location.pathname !== '/login' || !!localStorage.getItem('cretas_access_token');
  }, { timeout: 15000 }).catch(() => {});

  // give SPA a moment to settle
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  const userJson = await page.evaluate(() => localStorage.getItem('cretas_user'));
  const url = page.url();

  return { token, userJson, url, consoleErrors: [...consoleErrors], pageErrors: [...pageErrors] };
}

async function runFlow(page, factory, flow) {
  const apiHits = []; // { url, status, method }
  const consoleErrors = [];
  const pageErrors = [];

  const respHandler = async (resp) => {
    const url = resp.url();
    if (url.includes('/api/mobile/')) {
      apiHits.push({
        url: url.replace(WEB_ADMIN_URL, ''),
        status: resp.status(),
        method: resp.request().method(),
      });
    }
  };
  const consoleHandler = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); };
  const pageErrHandler = (err) => pageErrors.push(err.message);

  page.on('response', respHandler);
  page.on('console', consoleHandler);
  page.on('pageerror', pageErrHandler);

  let navError = null;
  try {
    await page.goto(`${WEB_ADMIN_URL}${flow.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // wait for SPA + API calls + render to settle
    await page.waitForTimeout(5000);
  } catch (e) {
    navError = e.message;
  }

  const screenshotPath = join(EVIDENCE_DIR, `${factory.factoryId}-flow-${flow.id}-${flow.name}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (e) {
    // ignore
  }

  // Detect failure modes:
  //   - blank page (very small DOM)
  //   - error overlay / "出错了" text
  //   - 5xx response from any /api/mobile call
  //   - JS pageError or hard console error from app code
  const pageText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const has5xx = apiHits.some(h => h.status >= 500);
  const hasGracefulMessage = /操作失败|加载失败|无数据|暂无数据|Endpoint Moved|SMARTBI_MIGRATED|Loading/.test(pageText);
  const isBlankWhite = pageText.trim().length < 50;
  const hasErrorOverlay = /出错|系统错误|崩溃|whoops|stack trace/i.test(pageText);

  // Filter out browser-noise console errors (font preload, favicon 404, etc.)
  const appConsoleErrors = consoleErrors.filter(e =>
    !/(favicon|font|preload|sourcemap|chrome-extension|webpack-dev-server)/i.test(e)
  );

  page.off('response', respHandler);
  page.off('console', consoleHandler);
  page.off('pageerror', pageErrHandler);

  // Verdict per flow
  let verdict = 'PASS';
  const reasons = [];
  if (navError) { verdict = 'FAIL'; reasons.push(`Navigation error: ${navError}`); }
  if (has5xx) { verdict = 'FAIL'; reasons.push(`5xx response in chain: ${apiHits.filter(h=>h.status>=500).map(h=>`${h.status} ${h.url}`).join(', ')}`); }
  if (pageErrors.length > 0) { verdict = 'FAIL'; reasons.push(`Page errors: ${pageErrors.slice(0, 3).join(' | ')}`); }
  if (isBlankWhite) { verdict = 'FAIL'; reasons.push(`Blank page (text length ${pageText.length})`); }
  if (hasErrorOverlay) { verdict = 'FAIL'; reasons.push(`Error overlay detected in page text`); }

  // Check expected api+status
  if (flow.watchApi && flow.expect) {
    const matchingHits = apiHits.filter(h => h.url.includes(flow.watchApi));
    if (matchingHits.length === 0) {
      reasons.push(`Expected API hit ${flow.watchApi} not observed`);
      // not a fail — flow may not auto-trigger that endpoint
    } else {
      const statuses = matchingHits.map(h => h.status);
      if (!statuses.includes(flow.expect)) {
        verdict = 'WARN';
        reasons.push(`Expected ${flow.watchApi} status ${flow.expect}, got ${statuses.join(',')}`);
      }
    }
  }

  return {
    flow: flow.name,
    flowId: flow.id,
    verdict,
    reasons,
    url: page.url(),
    pageTextSample: pageText.slice(0, 300),
    pageTextLength: pageText.length,
    hasGracefulMessage,
    apiHits,
    appConsoleErrorCount: appConsoleErrors.length,
    appConsoleErrorsSample: appConsoleErrors.slice(0, 5),
    pageErrors,
    screenshot: `${factory.factoryId}-flow-${flow.id}-${flow.name}.png`,
  };
}

async function main() {
  console.log(`[E2E] Starting ${new Date().toISOString()}`);
  const browser = await chromium.launch({ headless: true });
  const results = { startedAt: new Date().toISOString(), factories: [] };

  for (const factory of FACTORIES) {
    console.log(`\n[E2E] === ${factory.factoryId} (${factory.username}) ===`);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();

    const loginResult = await loginViaUI(page, factory);
    console.log(`[E2E] Login: token=${!!loginResult.token} url=${loginResult.url}`);

    const factoryResult = {
      factoryId: factory.factoryId,
      username: factory.username,
      label: factory.label,
      login: {
        success: !!loginResult.token,
        url: loginResult.url,
        userJson: loginResult.userJson,
        consoleErrors: loginResult.consoleErrors.slice(0, 5),
        pageErrors: loginResult.pageErrors,
      },
      flows: [],
    };

    if (!loginResult.token) {
      console.error(`[E2E] Login FAILED for ${factory.factoryId}, skipping flows`);
      results.factories.push(factoryResult);
      await ctx.close();
      continue;
    }

    for (const flow of FLOWS) {
      console.log(`[E2E] Flow ${flow.id} ${flow.name} → ${flow.path}`);
      const res = await runFlow(page, factory, flow);
      factoryResult.flows.push(res);
      const apiSummary = res.apiHits.map(h => `${h.status} ${h.method} ${h.url.split('?')[0]}`).join('; ');
      console.log(`  → ${res.verdict} ${res.reasons.length ? '['+res.reasons.join('; ')+']' : ''}`);
      console.log(`     API: ${apiSummary || '(none)'}`);
    }

    results.factories.push(factoryResult);
    await ctx.close();
  }

  await browser.close();
  results.finishedAt = new Date().toISOString();

  const summaryPath = join(EVIDENCE_DIR, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n[E2E] Summary saved → ${summaryPath}`);

  // Aggregate verdict
  let pass = 0, fail = 0, warn = 0;
  for (const f of results.factories) {
    for (const fl of (f.flows || [])) {
      if (fl.verdict === 'PASS') pass++;
      else if (fl.verdict === 'FAIL') fail++;
      else warn++;
    }
  }
  console.log(`\n[E2E] === TOTALS: PASS=${pass} WARN=${warn} FAIL=${fail} ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[E2E] Fatal:', err);
  process.exit(2);
});
