/**
 * Phase IIa final verification demo — 2 角色:
 *   1. qhj_prod / RES_3101_009 (rich data: ¥20.6M, 365 days, 20 dishes, 23 channels)
 *   2. qhj_admin / R_QINGHUAJIAO_REAL (empty-state per §4.5 edge case)
 *
 * Run:
 *   E2E_BASE_URL=http://139.196.165.140:8086 \
 *   npx playwright test --project phase-iia-final-demo --headed
 */
import { test, expect } from '@playwright/test';
import { fetchLoginToken, injectAuthCookie } from './e2e-auth-helper';

const BASE_URL = process.env.E2E_BASE_URL || 'http://139.196.165.140:8086';
const API_BASE = `${BASE_URL}/api/mobile`;
const SD = 'test-results/phase-iia-final';

test.setTimeout(360_000);

test('Phase IIa final — rich data + empty state', async ({ page, context }) => {
  const fs = await import('node:fs');
  fs.mkdirSync(SD, { recursive: true });

  const banner = async (msg: string) => {
    console.log(`\n>>> ${msg}`);
    await page.evaluate((text) => {
      const id = 'demo-banner';
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:99999;background:#2563eb;color:white;' +
          'padding:14px 24px;font-size:18px;font-weight:600;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        document.body.appendChild(el);
      }
      el.textContent = text;
    }, msg).catch(() => undefined);
  };

  // ─────────────────────────────────────────────────────────────
  // Role 1: qhj_prod / RES_3101_009 — rich data happy path
  // ─────────────────────────────────────────────────────────────
  const auth1 = await fetchLoginToken('qhj_prod', '123456', API_BASE);
  expect(auth1.token).toBeTruthy();
  await injectAuthCookie(context, page, auth1.token, auth1.loginData, BASE_URL);
  await page.evaluate((tok) => localStorage.setItem('cretas_access_token', tok), auth1.token);

  // ─── /smart-bi/sales ───
  await banner('1/4: qhj_prod RES_3101_009 → /smart-bi/sales (¥20.6M rich data)');
  await page.goto(`${BASE_URL}/smart-bi/sales`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: `${SD}/01-sales-rich.png`, fullPage: true });

  // ─── /smart-bi/finance ───
  await banner('2/4: qhj_prod RES_3101_009 → /smart-bi/finance (KPI + monthly chart + IIb preview)');
  await page.goto(`${BASE_URL}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: `${SD}/02-finance-rich.png`, fullPage: true });

  // ─────────────────────────────────────────────────────────────
  // Role 2: qhj_admin / R_QINGHUAJIAO_REAL — empty-state (§4.5 edge)
  // ─────────────────────────────────────────────────────────────
  await page.evaluate(() => localStorage.clear());
  await context.clearCookies();

  const auth2 = await fetchLoginToken('qhj_admin', '123456', API_BASE);
  expect(auth2.token).toBeTruthy();
  await injectAuthCookie(context, page, auth2.token, auth2.loginData, BASE_URL);
  await page.evaluate((tok) => localStorage.setItem('cretas_access_token', tok), auth2.token);

  await banner('3/4: qhj_admin R_QINGHUAJIAO_REAL → /smart-bi/sales (empty-state graceful)');
  await page.goto(`${BASE_URL}/smart-bi/sales`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: `${SD}/03-sales-empty.png`, fullPage: true });

  await banner('4/4: qhj_admin R_QINGHUAJIAO_REAL → /smart-bi/finance (empty-state)');
  await page.goto(`${BASE_URL}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: `${SD}/04-finance-empty.png`, fullPage: true });

  await banner('✅ Phase IIa final demo — 4 screenshots captured. 自由探索 3 min.');
  await page.waitForTimeout(180_000);
});
