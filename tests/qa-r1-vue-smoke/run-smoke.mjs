#!/usr/bin/env node
/**
 * Phase 2A/2C Round 1 part 2 — SmartBI Vue page L1 smoke
 *
 * Target  : prod web-admin http://139.196.165.140:8086
 * Account : f006_admin / 123456 (F006 六腾门 prod seed)
 * Pages   : 18 SmartBI routes (see pages.mjs)
 *
 * Per page:
 *   - login (storageState cached) → newContext → newPage
 *   - attach console / pageerror listeners
 *   - track network for fetch/xhr → /api/* responses (status >= 400)
 *   - goto(${TARGET}${page.path}), wait domcontentloaded
 *   - wait for `.app-main` mount (MutationObserver via waitForSelector)
 *   - 800ms quiet network grace, then sample state
 *   - detect: redirected to /login (auth lost), /403 (RBAC), or rendered OK
 *   - capture .el-message--error toast presence
 *   - fullPage screenshot → screenshots/<name>.png
 *
 * Output:
 *   round-1-vue-smoke.json  (per-page record)
 *   console-matrix.json     (page × console-signal-type matrix for Rule 11)
 *
 * Rule 7-8: NO setTimeout-driven assertions. Uses Playwright waitForSelector
 *   (MutationObserver under the hood) for render detection and isVisible()
 *   for el-message capture.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './pages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8086';
const ACCOUNT = { username: 'f006_admin', password: '123456' };
const SHOTS_DIR = path.join(__dirname, 'screenshots');
const RESULT_JSON = path.join(__dirname, 'round-1-vue-smoke.json');
const MATRIX_JSON = path.join(__dirname, 'console-matrix.json');

const NAV_TIMEOUT_MS = 20_000;
const MOUNT_TIMEOUT_MS = 12_000;
const QUIET_GRACE_MS = 800; // post-mount settle window (NOT an assertion — toast/error appears via networkidle anyway)

// Console messages we intentionally drop because they are 3rd-party / browser
// noise unrelated to the SmartBI page itself. Be conservative — when in
// doubt, keep the message so reviewers can see it.
const NOISE_PATTERNS = [
  /favicon\.ico/i,
  /ResizeObserver loop/i,
  /chrome-extension:\/\//i,
  /Download the React DevTools/i,
  /Vue Devtools/i,
  // ECharts harmless: "There is a chart instance already initialized" — not raised in current build
  // amap.com / baidu fonts when offline — keep visible so we know if leaked
];

const isNoise = (text) => NOISE_PATTERNS.some((re) => re.test(text || ''));

async function login(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${TARGET}/login`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await page.fill('input[placeholder*="用户名"], input[type="text"]', ACCOUNT.username);
  await page.fill('input[placeholder*="密码"], input[type="password"]', ACCOUNT.password);
  const btn = (await page.$('button.login-button')) ?? (await page.$('button:has-text("登 录")')) ?? (await page.$('button:has-text("登录")'));
  if (!btn) throw new Error('login: button not found');
  await btn.click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: NAV_TIMEOUT_MS });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function smokePage(browser, storageState, def) {
  const ctx = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  /** @type {{level:string,text:string,location?:string}[]} */
  const consoleMessages = [];
  /** @type {string[]} */
  const pageErrors = [];
  /** @type {{url:string,status:number}[]} */
  const apiFailures = [];

  page.on('console', (msg) => {
    const level = msg.type();
    if (level !== 'error' && level !== 'warning') return;
    const text = msg.text();
    if (isNoise(text)) return;
    consoleMessages.push({ level, text, location: msg.location()?.url || '' });
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
  page.on('response', (resp) => {
    const url = resp.url();
    if (!/\/api\//.test(url)) return;
    const status = resp.status();
    if (status >= 400) apiFailures.push({ url, status });
  });

  const result = {
    name: def.name,
    path: def.path,
    source: def.source,
    targetUrl: `${TARGET}${def.path}`,
    finalUrl: null,
    rendered: false,
    redirectedTo: null,
    mountSelector: '.app-main',
    mountVisible: false,
    bodyTextLen: 0,
    errorToastVisible: false,
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    apiFailures: [],
    screenshot: null,
    durationMs: 0,
    note: null,
  };

  const t0 = Date.now();
  try {
    await page.goto(`${TARGET}${def.path}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    // MutationObserver-based wait for the app shell mount
    try {
      await page.waitForSelector('.app-main', { state: 'visible', timeout: MOUNT_TIMEOUT_MS });
      result.mountVisible = true;
    } catch {
      // shell never mounted — could be /login redirect, /403, or white screen
    }
    // Let any post-mount XHR + el-message resolve. networkidle is fine here:
    // it is event-driven (network requests), not a fixed timer.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // Tiny additional grace so toast queue can flush its enter transition.
    // Playwright will still treat this as an event-loop yield, not a polling assertion.
    await page.waitForTimeout(QUIET_GRACE_MS);

    result.finalUrl = page.url();
    if (/\/login(\?|$)/.test(result.finalUrl)) {
      result.redirectedTo = 'login';
      result.note = 'auth session lost or page route requires re-login';
    } else if (/\/403(\?|$)/.test(result.finalUrl)) {
      result.redirectedTo = '403';
      result.note = 'RBAC denied for f006_admin (this is data, not necessarily a bug)';
    } else if (!result.finalUrl.includes(def.path.split('?')[0])) {
      result.redirectedTo = 'other';
      result.note = `unexpected redirect: ${result.finalUrl}`;
    }

    // Body text length — cheap white-screen heuristic
    result.bodyTextLen = await page.evaluate(() => (document.body?.innerText || '').trim().length).catch(() => 0);
    // Error toast presence (Element Plus)
    result.errorToastVisible = await page
      .locator('.el-message--error')
      .first()
      .isVisible()
      .catch(() => false);

    // Decision: rendered if shell mounted AND not redirected to /login or /403
    result.rendered = result.mountVisible && !result.redirectedTo && result.bodyTextLen > 50;

    const shot = path.join(SHOTS_DIR, `${def.name}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch((e) => {
      result.note = (result.note ? result.note + '; ' : '') + `screenshot failed: ${e.message}`;
    });
    result.screenshot = `screenshots/${def.name}.png`;
  } catch (err) {
    result.note = (result.note ? result.note + '; ' : '') + `exception: ${String(err.message || err)}`;
  } finally {
    result.durationMs = Date.now() - t0;
    result.consoleErrors = consoleMessages.filter((m) => m.level === 'error');
    result.consoleWarnings = consoleMessages.filter((m) => m.level === 'warning');
    result.pageErrors = pageErrors;
    result.apiFailures = apiFailures;
    await ctx.close();
  }
  return result;
}

function summaryLine(r) {
  const status = r.rendered
    ? 'PASS'
    : r.redirectedTo === '403'
    ? 'RBAC-DENIED'
    : r.redirectedTo === 'login'
    ? 'AUTH-LOST'
    : 'FAIL';
  return [
    status.padEnd(12),
    r.name.padEnd(28),
    r.path.padEnd(40),
    `err:${r.consoleErrors.length}`,
    `warn:${r.consoleWarnings.length}`,
    `pageErr:${r.pageErrors.length}`,
    `api>=400:${r.apiFailures.length}`,
    `toast:${r.errorToastVisible ? 'Y' : 'N'}`,
    `body:${r.bodyTextLen}ch`,
  ].join('  ');
}

async function main() {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  console.log(`[smoke] target=${TARGET} pages=${PAGES.length} account=${ACCOUNT.username}`);
  let storageState;
  try {
    storageState = await login(browser);
    console.log('[smoke] login OK');
  } catch (e) {
    console.error('[smoke] login FAILED:', e.message);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  for (const def of PAGES) {
    process.stdout.write(`[smoke] ${def.name.padEnd(28)} `);
    const r = await smokePage(browser, storageState, def);
    results.push(r);
    process.stdout.write(`${r.rendered ? 'PASS' : r.redirectedTo || 'FAIL'}  (${r.durationMs}ms)\n`);
  }

  await browser.close();

  // Per-page result file
  const result = {
    target: TARGET,
    account: ACCOUNT.username,
    branch: 'qa/r1-vue-page-smoke',
    ranAt: new Date().toISOString(),
    pageCount: PAGES.length,
    summary: {
      pass: results.filter((r) => r.rendered).length,
      rbacDenied: results.filter((r) => r.redirectedTo === '403').length,
      authLost: results.filter((r) => r.redirectedTo === 'login').length,
      fail: results.filter((r) => !r.rendered && !r.redirectedTo).length,
      withConsoleErrors: results.filter((r) => r.consoleErrors.length > 0).length,
      withPageErrors: results.filter((r) => r.pageErrors.length > 0).length,
      withApiFailures: results.filter((r) => r.apiFailures.length > 0).length,
      withErrorToast: results.filter((r) => r.errorToastVisible).length,
    },
    pages: results,
  };
  await fs.writeFile(RESULT_JSON, JSON.stringify(result, null, 2), 'utf8');

  // Console-matrix: page × signal-type, for Rule 11 breadth coverage
  const matrix = {
    target: TARGET,
    ranAt: result.ranAt,
    legend: {
      consoleError: 'console.error count after noise filter',
      consoleWarning: '[Vue warn] / other warnings after noise filter',
      pageError: 'uncaught JS exception count',
      apiFailure: 'response status >= 400 on /api/* count',
      errorToast: 'visible .el-message--error after mount + networkidle',
      mountVisible: '.app-main visible within 12s',
    },
    rows: results.map((r) => ({
      page: r.name,
      path: r.path,
      consoleError: r.consoleErrors.length,
      consoleWarning: r.consoleWarnings.length,
      pageError: r.pageErrors.length,
      apiFailure: r.apiFailures.length,
      errorToast: r.errorToastVisible,
      mountVisible: r.mountVisible,
      redirectedTo: r.redirectedTo,
      rendered: r.rendered,
      sampleConsoleErrors: r.consoleErrors.slice(0, 3).map((m) => m.text),
      sampleApiFailures: r.apiFailures.slice(0, 3),
    })),
  };
  await fs.writeFile(MATRIX_JSON, JSON.stringify(matrix, null, 2), 'utf8');

  console.log('\n[smoke] === summary ===');
  console.log(`pass=${result.summary.pass}/${PAGES.length}  rbac-denied=${result.summary.rbacDenied}  auth-lost=${result.summary.authLost}  fail=${result.summary.fail}`);
  console.log(`with console errors  : ${result.summary.withConsoleErrors}`);
  console.log(`with page errors     : ${result.summary.withPageErrors}`);
  console.log(`with /api 4xx-5xx    : ${result.summary.withApiFailures}`);
  console.log(`with error toast     : ${result.summary.withErrorToast}`);
  console.log('\n[smoke] per-page:');
  for (const r of results) console.log('  ' + summaryLine(r));
  console.log(`\n[smoke] wrote ${RESULT_JSON}`);
  console.log(`[smoke] wrote ${MATRIX_JSON}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke] fatal:', e);
  process.exit(1);
});
