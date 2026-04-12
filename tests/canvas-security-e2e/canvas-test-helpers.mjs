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
export const WEB_URL =
  process.env.E2E_WEB_URL || 'http://139.196.165.140:8086';
export const FACTORY_A = 'FOOD_3101_038';
export const FACTORY_B = 'F002';
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

    const outPath = join(RESULTS_DIR, `${journeyName}-results.json`);
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
export async function login(username, password = DEFAULT_PASSWORD) {
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
  return {
    token: data.accessToken ?? data.token,
    factoryId: data.factoryId,
    role: data.role,
    userId: data.userId,
  };
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

  return {
    status: res.status,
    success: json.success ?? (res.status >= 200 && res.status < 300),
    message: json.message ?? '',
    data: json.data ?? null,
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

  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.locator('.el-button--primary').first().click();

  // Wait for navigation / token storage
  await page.waitForTimeout(5_000);

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
