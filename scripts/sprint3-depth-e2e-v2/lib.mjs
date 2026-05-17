/**
 * Sprint 3 Depth E2E v2 — shared library
 *
 * Helpers used by run-depth.mjs to implement the 13-step deep test pattern
 * mandated by .claude/skills/depth-first-e2e/SKILL.md Rule 2.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BASE = 'https://admin.cretaceousfuture.com';
// admin.cretaceousfuture.com has /api/mobile/* via nginx (per
// reference_nginx_3_vhost_sync — same upstream as api.* but with cookie/CORS for browser).
export const API_BASE = `${BASE}/api/mobile`;

export const FACTORY_ID = 'F006';
export const SHOTS_DIR = path.join(__dirname, 'shots');

export const ACCOUNTS = {
  // 16 F006 prod accounts, password 123456, per-username 60s rate-limit
  f006_admin: { username: 'f006_admin', password: '123456' },
  f006_sales_mgr: { username: 'f006_sales_mgr', password: '123456' },
  f006_warehouse_mgr: { username: 'f006_warehouse_mgr', password: '123456' },
  f006_procurement_mgr: { username: 'f006_procurement_mgr', password: '123456' },
  f006_production_mgr: { username: 'f006_production_mgr', password: '123456' },
  f006_finance_mgr: { username: 'f006_finance_mgr', password: '123456' },
  f006_quality_insp: { username: 'f006_quality_insp', password: '123456' },
  f006_dispatcher: { username: 'f006_dispatcher', password: '123456' },
  f006_viewer: { username: 'f006_viewer', password: '123456' },
};

// ---------------------------------------------------------------------------
// API helpers (browserless — fetch directly, for byte-precise verification)
// ---------------------------------------------------------------------------

const tokens = new Map(); // username -> token

export async function apiLogin(username, password) {
  if (tokens.has(username)) return tokens.get(username);
  // Retry up to 3 times in case of 60s rate limit
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await resp.json();
    if (resp.status === 200 && body.code === 200 && body.data?.token) {
      tokens.set(username, body.data.token);
      return body.data.token;
    }
    lastErr = `Login ${username}: ${resp.status} ${JSON.stringify(body).slice(0, 200)}`;
    if (body.code === 429 || body.message?.includes('频繁') || body.message?.includes('请稍后')) {
      console.log(`[apiLogin] rate-limited on ${username}, waiting 65s...`);
      await new Promise(r => setTimeout(r, 65000));
    } else {
      break;
    }
  }
  throw new Error(`Login failed: ${lastErr}`);
}

export async function apiCall(method, urlPath, opts = {}) {
  const token = opts.token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`;
  const init = { method, headers };
  if (opts.body !== undefined) init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  const resp = await fetch(url, init);
  const text = await resp.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: resp.status, ok: resp.ok, body, url, method };
}

// ---------------------------------------------------------------------------
// Playwright helpers — wraps the 13-step deep-test pattern
// ---------------------------------------------------------------------------

export async function uiLogin(page, username, password) {
  // Full UI login — Pinia store hydrates `user` from localStorage['cretas_user']
  // and the router checks user.value (not localStorage['cretas_access_token']).
  // So we must use the actual login flow OR seed BOTH keys.
  const loginResp = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await loginResp.json();
  if (!body.data?.token) throw new Error(`uiLogin failed: ${JSON.stringify(body).slice(0, 200)}`);

  const token = body.data.token;
  const userData = {
    id: body.data.userId,
    username: body.data.username,
    email: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userType: 'factory',
    factoryUser: {
      role: body.data.role,
      factoryId: body.data.factoryId,
      factoryName: body.data.factoryName,
      factoryType: body.data.factoryType,
    },
  };

  // Navigate to login page first to set up localStorage origin
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('cretas_access_token', t);
    localStorage.setItem('cretas_user', JSON.stringify(u));
  }, { t: token, u: userData });
  return token;
}

export async function navigateTo(page, urlPath, opts = {}) {
  const url = urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`;
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 30000 });
    } else {
      // default: wait briefly for SPA boot
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(opts.settle || 2500);
    }
    return 'OK';
  } catch (e) {
    return `FAIL: ${e.message.slice(0, 150)}`;
  }
}

export async function countTableRows(page) {
  try {
    const count = await page.evaluate(() => {
      const rows = document.querySelectorAll('.el-table__body tr.el-table__row');
      return rows.length;
    });
    return { count, error: null };
  } catch (e) {
    return { count: 0, error: e.message };
  }
}

export async function clickButton(page, text) {
  // Try multiple button selectors that contain the text
  const selectors = [
    `button:has-text("${text}")`,
    `.el-button:has-text("${text}")`,
    `a:has-text("${text}")`,
  ];
  for (const sel of selectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          await btn.click();
          return true;
        }
      }
    } catch {}
  }
  return false;
}

export async function waitForDialog(page, timeout = 8000) {
  try {
    await page.waitForSelector('.el-dialog__body, .el-drawer__body', { timeout });
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

// Setup MutationObserver to capture toast text per skill recommendation
export async function setupToastObserver(page) {
  await page.evaluate(() => {
    window.__capturedToasts = [];
    const obs = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node;
          if (el.classList && (el.classList.contains('el-message') || el.classList.contains('el-notification'))) {
            window.__capturedToasts.push({
              text: el.textContent?.trim() || '',
              isSuccess: el.classList.contains('el-message--success') || el.classList.contains('el-notification--success'),
              isError: el.classList.contains('el-message--error') || el.classList.contains('el-notification--error'),
              ts: Date.now(),
            });
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.__toastObserver = obs;
  });
}

export async function readCapturedToasts(page) {
  return await page.evaluate(() => window.__capturedToasts || []);
}

// Submit and capture API response — Rule 11 reference (W-04/W-05 pattern)
export async function submitAndCheckResponse(page, btnLabels, opts) {
  // Set up request listener for the matching POST
  const matches = [];
  const onResp = (resp) => {
    const u = resp.url();
    if (opts.factoryId && opts.module && (u.includes(`/${opts.factoryId}/${opts.module}`) || u.includes(opts.module))) {
      matches.push({
        url: u,
        method: resp.request().method(),
        status: resp.status(),
      });
    }
  };
  page.on('response', onResp);

  let clicked = false;
  for (const label of btnLabels) {
    if (await clickButton(page, label)) { clicked = true; break; }
  }
  if (!clicked) {
    page.off('response', onResp);
    return { ok: false, reason: `no submit button found among: ${btnLabels.join(', ')}`, status: 0 };
  }

  // Wait for response or short timeout
  await page.waitForTimeout(4000);
  page.off('response', onResp);

  // Find the relevant write match
  const writeMatches = matches.filter(m => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m.method));
  if (writeMatches.length === 0) {
    return { ok: false, reason: 'no write response captured', status: 0, allMatches: matches };
  }
  const m = writeMatches[writeMatches.length - 1]; // most recent write
  return { ok: m.status >= 200 && m.status < 300, ...m, allMatches: matches };
}

// ---------------------------------------------------------------------------
// Result recorder
// ---------------------------------------------------------------------------

const RESULTS = [];

export function record(module, testId, name, status, evidence) {
  if (!evidence || !evidence.depth) {
    throw new Error(`Rule 1 violation: test ${testId} missing depth field`);
  }
  const validDepths = ['smoke', 'medium', 'deep'];
  if (!validDepths.includes(evidence.depth)) {
    throw new Error(`Rule 1 violation: test ${testId} invalid depth=${evidence.depth}`);
  }
  RESULTS.push({
    module,
    testId,
    name,
    status,
    depth: evidence.depth,
    evidence,
    ts: new Date().toISOString(),
  });
  const symbol = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'BLOCKED' ? '⊘' : '?';
  console.log(`[${symbol}] ${module}/${testId} ${name} → ${status} (${evidence.depth})`);
}

export function getResults() {
  return RESULTS.slice();
}

export async function saveResults(filepath) {
  await fs.writeFile(filepath, JSON.stringify({
    timestamp: new Date().toISOString(),
    skill: '.claude/skills/depth-first-e2e/SKILL.md',
    factory: FACTORY_ID,
    env: 'prod admin.cretaceousfuture.com',
    results: RESULTS,
  }, null, 2));
}
