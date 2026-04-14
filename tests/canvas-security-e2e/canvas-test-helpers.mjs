/**
 * Shared test helpers for Canvas Security E2E tests.
 * ESM module — use `import` syntax.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// __dirname equivalent for ESM
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const API_BASE =
  process.env.E2E_API_BASE || 'http://localhost:10011/api/mobile';
// R2-⑥ fix (2026-04-14): default WEB_URL to local vite dev so tests target a build
// with the latest commits (e.g. 46d1925a3 canvas-editor meta.roles narrowing).
// Prod web-admin at 139.196.165.140:8086 lags behind the test backend on 10011
// and would produce environment-drift FAILs (see canvas-e2e-r2-results-audit.md).
// Override via E2E_WEB_URL env var when running against a prod/staging build.
export const WEB_URL =
  process.env.E2E_WEB_URL || 'http://localhost:5173';
// Test DB accounts: F001 has full role matrix (8 roles), F002 is restaurant
// F002 has 27 sales orders + 4 customers (data-rich). F006 is empty (good attacker).
export const FACTORY_A = process.env.E2E_FACTORY_A || 'F002';
export const FACTORY_B = process.env.E2E_FACTORY_B || 'F006';
export const ADMIN_A = process.env.E2E_ADMIN_A || 'restaurant_admin1';
export const ADMIN_B = process.env.E2E_ADMIN_B || 'f006_admin';
export const DEFAULT_PASSWORD = '123456';
export const RESULTS_DIR = join(__dirname, 'results');
export const SCREENSHOTS_DIR = join(__dirname, 'screenshots');

// Ensure output directories exist at module load time
mkdirSync(RESULTS_DIR, { recursive: true });
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Result collector
// ---------------------------------------------------------------------------
/**
 * @param {string} journeyName  Used as the filename prefix for results.
 * @returns {{ log(testId: string, status: 'PASS'|'FAIL'|'WARN', evidence: string): void, save(): object }}
 */
export function createResultCollector(journeyName) {
  const startTime = Date.now();
  const tests = [];

  const STATUS_EMOJI = { PASS: '✅', FAIL: '❌', WARN: '⚠️' };

  function log(testId, status, evidence) {
    const emoji = STATUS_EMOJI[status] ?? '❓';
    console.log(`${emoji} [${testId}] ${status} — ${evidence}`);
    tests.push({ testId, status, evidence, timestamp: new Date().toISOString() });
  }

  function save() {
    const durationMs = Date.now() - startTime;
    const pass = tests.filter(t => t.status === 'PASS').length;
    const fail = tests.filter(t => t.status === 'FAIL').length;
    const warn = tests.filter(t => t.status === 'WARN').length;
    const total = tests.length;

    const summary = {
      journey: journeyName,
      timestamp: new Date().toISOString(),
      durationMs,
      pass,
      fail,
      warn,
      total,
      tests,
    };

    // R3 P1a: support CANVAS_E2E_RUN_ID env var for run isolation. When set (e.g.
    // "R3-run1"), write to `${journey}-results-${RUN_ID}.json` so two independent
    // runs coexist in `results/` without manual cp/mv. When unset, keep legacy
    // `${journey}-results.json` filename for backwards compatibility.
    const runId = process.env.CANVAS_E2E_RUN_ID;
    const fileName = runId
      ? `${journeyName}-results-${runId}.json`
      : `${journeyName}-results.json`;
    const outPath = join(RESULTS_DIR, fileName);
    writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

    console.log('\n--- Summary ---');
    console.log(`Journey : ${journeyName}`);
    console.log(`Total   : ${total}  PASS: ${pass}  FAIL: ${fail}  WARN: ${warn}`);
    console.log(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`Results : ${outPath}`);

    return summary;
  }

  return { log, save };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Login and return token + metadata.
 * @param {string} username
 * @param {string} [password]
 * @returns {Promise<{token: string, factoryId: string, role: string, userId: string|number}>}
 */
import { readFileSync as _readFileSync } from 'fs';

const _tokenCachePath = join(__dirname, 'results', '.token-cache.json');
const _tokenCache = new Map();

// Load file-based token cache (persists across Node processes in run-all.sh)
try {
  const cached = JSON.parse(_readFileSync(_tokenCachePath, 'utf8'));
  for (const [k, v] of Object.entries(cached)) _tokenCache.set(k, v);
} catch { /* no cache yet */ }

function _saveTokenCache() {
  const obj = Object.fromEntries(_tokenCache);
  writeFileSync(_tokenCachePath, JSON.stringify(obj), 'utf8');
}

export async function login(username, password = DEFAULT_PASSWORD) {
  // Return cached token if available (avoids rate limit across journey scripts)
  if (_tokenCache.has(username)) return _tokenCache.get(username);

  const res = await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const json = await res.json().catch(() => ({}));

  if (!json.success) {
    throw new Error(
      `Login failed for "${username}": ${json.message || res.status}`
    );
  }

  const data = json.data ?? {};
  const session = {
    token: data.accessToken ?? data.token,
    factoryId: data.factoryId,
    role: data.role,
    userId: data.userId,
  };
  _tokenCache.set(username, session);
  _saveTokenCache();
  return session;
}

/**
 * Generic HTTP call against the API base.
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} method
 * @param {string} path   Relative to API_BASE (no leading slash needed)
 * @param {object|null} [body]
 * @param {string|null} [token]
 * @returns {Promise<{status: number, success: boolean, message: string, data: any, json: any}>}
 */
export async function apiCall(method, path, body = null, token = null) {
  const url = path.startsWith('http') ? path : `${API_BASE}/${path.replace(/^\//, '')}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const init = { method, headers };
  if (body !== null && method !== 'GET' && method !== 'DELETE') {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  let json = {};
  try {
    json = await res.json();
  } catch {
    // non-JSON response — leave json as empty object
  }

  // Some endpoints return {success, data, message} wrapper; others return raw arrays/objects.
  // Normalize: if json is an array or has no .data key, treat the whole json as data.
  const isWrapped = json && typeof json === 'object' && !Array.isArray(json) && 'success' in json;
  return {
    status: res.status,
    success: isWrapped ? json.success : (res.status >= 200 && res.status < 300),
    message: isWrapped ? (json.message ?? '') : '',
    data: isWrapped ? (json.data ?? null) : json,
    json,
  };
}

/** GET shortcut */
export const apiGet = (path, token) => apiCall('GET', path, null, token);

/** POST shortcut */
export const apiPost = (path, body, token) => apiCall('POST', path, body, token);

/** PUT shortcut */
export const apiPut = (path, body, token) => apiCall('PUT', path, body, token);

/** DELETE shortcut */
export const apiDelete = (path, token) => apiCall('DELETE', path, null, token);

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

/**
 * Launch a headless Chromium browser, create a 1440×900 context, and return
 * browser + context + a first page.  Google Fonts requests are blocked to
 * avoid hangs on Chinese networks.
 *
 * @returns {Promise<{browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page}>}
 */
export async function createBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Block Google Fonts — avoids 30-second hangs on mainland Chinese networks
  await context.route('**fonts.googleapis.com**', route => route.abort());
  await context.route('**fonts.gstatic.com**', route => route.abort());

  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  return { browser, context, page };
}

/**
 * Log in via the web UI.
 * @param {import('playwright').Page} page
 * @param {string} username
 * @param {string} [password]
 * @returns {Promise<{url: string, loggedIn: boolean}>}
 */
export async function webLogin(page, username, password = DEFAULT_PASSWORD) {
  await page.goto(`${WEB_URL}/login`);

  // R3 P1b: WEB_URL drift self-check — if page.url()'s origin does not match the
  // resolved WEB_URL origin (e.g. WEB_URL points to 5173 but the environment
  // silently redirected to a different host), FAIL fast. This prevents
  // the whole test suite from silently running against the wrong frontend
  // build (R2 incident: suite ran against prod web-admin 139:8086 instead of
  // local vite 5173, producing 3 "false FAIL"s from a route guard difference).
  //
  // Let URL parse errors surface naturally — malformed WEB_URL should crash the
  // run immediately, not be swallowed. Only the drift assertion is domain logic.
  const expectedOrigin = new URL(WEB_URL).origin;
  const actualOrigin = new URL(page.url()).origin;
  if (expectedOrigin !== actualOrigin) {
    throw new Error(
      `WEB_URL drift: expected ${expectedOrigin}, got ${actualOrigin}. ` +
      `Check E2E_WEB_URL env var and network config before re-running.`
    );
  }

  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.locator('.el-button--primary').first().click();

  // Wait for navigation — either dashboard, mobile-only, 403, or stay at login
  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10_000 });
  } catch {
    // Still on login page — login failed or slow redirect
  }
  await page.waitForTimeout(2_000); // Extra settle time for route guards

  const url = page.url();
  const loggedIn = !url.includes('/login');
  return { url, loggedIn };
}

/**
 * Take a screenshot and save it to the screenshots directory.
 * @param {import('playwright').Page} page
 * @param {string} name  Filename without extension
 * @returns {Promise<string>} Full path to the saved screenshot
 */
export async function screenshot(page, name) {
  const filePath = join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}
