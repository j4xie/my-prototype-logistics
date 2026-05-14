/**
 * SmartBI predefined-report bug reproduction (Bug #2 + Bug #3).
 *
 * Captures console errors + network errors for:
 *   - 智能分析 → 预定义报表 → 销售数据分析  (#3 report errors out)
 *   - 智能分析 → 预定义报表 → 财务数据分析 → 模块分析  (#2 data mismatch)
 *
 * Run:
 *   E2E_BASE_URL=http://139.196.165.140:8086 \
 *   E2E_USER=admin E2E_PASS=123456 \
 *   npx playwright test --project smartbi-bug-repro --headed
 */
import { test, expect, type ConsoleMessage, type Request, type Response } from '@playwright/test';
import { fetchLoginToken, injectAuthCookie } from './e2e-auth-helper';

const BASE_URL = process.env.E2E_BASE_URL || 'http://139.196.165.140:8086';
const API_BASE = process.env.E2E_API_BASE || `${BASE_URL}/api/mobile`;
const USER = process.env.E2E_USER || 'admin';
const PASS = process.env.E2E_PASS || '123456';
const SD = 'test-results/smartbi-bug-repro';

interface CapturedError {
  source: 'console' | 'pageError' | 'networkFailure' | 'http4xx' | 'http5xx';
  url?: string;
  status?: number;
  method?: string;
  body?: string;
  message: string;
}

test.setTimeout(180_000);

test('Capture console/network errors on Sales + Finance Module pages', async ({ page, context }) => {
  const fs = await import('node:fs');
  fs.mkdirSync(SD, { recursive: true });

  const errors: CapturedError[] = [];
  const apiCalls: Array<{ url: string; status: number; method: string }> = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push({ source: 'console', message: msg.text() });
    }
  });
  page.on('pageerror', (err: Error) => {
    errors.push({ source: 'pageError', message: `${err.name}: ${err.message}\n${(err.stack || '').slice(0, 500)}` });
  });
  page.on('requestfailed', (req: Request) => {
    errors.push({ source: 'networkFailure', url: req.url(), method: req.method(), message: req.failure()?.errorText || 'request failed' });
  });
  page.on('response', async (resp: Response) => {
    const url = resp.url();
    const status = resp.status();
    const method = resp.request().method();
    if (url.includes('/api/')) {
      apiCalls.push({ url, status, method });
      if (status >= 400) {
        let body = '';
        try { body = (await resp.text()).slice(0, 400); } catch { /* ignore */ }
        errors.push({
          source: status >= 500 ? 'http5xx' : 'http4xx',
          url, status, method, body, message: `${status} ${method} ${url}`,
        });
      }
    }
  });

  // 1. Login
  const auth = await fetchLoginToken(USER, PASS, API_BASE);
  expect(auth.token).toBeTruthy();
  await injectAuthCookie(context, page, auth.token, auth.loginData, BASE_URL);
  await page.evaluate((tok) => localStorage.setItem('cretas_access_token', tok), auth.token);

  // 2. Navigate to 销售数据分析 (Bug #3)
  console.log('\n>>> [1/2] 销售数据分析 - capturing errors...');
  errors.length = 0; // reset
  apiCalls.length = 0;
  await page.goto(`${BASE_URL}/smart-bi/sales`, { waitUntil: 'networkidle', timeout: 30_000 }).catch((e) => {
    errors.push({ source: 'pageError', message: `nav to /smart-bi/sales failed: ${e.message}` });
  });
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: `${SD}/01-sales-analysis.png`, fullPage: true });
  fs.writeFileSync(`${SD}/01-sales-analysis-errors.json`, JSON.stringify({ errors, apiCalls }, null, 2));
  console.log(`  errors: ${errors.length}, apiCalls: ${apiCalls.length}`);
  console.log(`  >>> errors saved to ${SD}/01-sales-analysis-errors.json`);
  errors.slice(0, 10).forEach((e) => console.log(`    [${e.source}] ${(e.message || '').slice(0, 200)}`));

  // 3. Navigate to 财务数据分析 → 模块分析 (Bug #2)
  console.log('\n>>> [2/2] 财务数据分析 - capturing errors + clicking 模块分析...');
  errors.length = 0;
  apiCalls.length = 0;
  await page.goto(`${BASE_URL}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 30_000 }).catch((e) => {
    errors.push({ source: 'pageError', message: `nav to /smart-bi/finance failed: ${e.message}` });
  });
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: `${SD}/02-finance-default.png`, fullPage: true });
  // Try to click 模块分析 tab
  const moduleTab = page.locator('text=模块分析').first();
  if (await moduleTab.isVisible().catch(() => false)) {
    console.log('  found 模块分析 tab, clicking...');
    await moduleTab.click({ timeout: 5_000 }).catch((e) => {
      errors.push({ source: 'pageError', message: `click 模块分析 failed: ${e.message}` });
    });
    await page.waitForTimeout(5_000);
    await page.screenshot({ path: `${SD}/03-finance-module-tab.png`, fullPage: true });
  } else {
    console.log('  WARNING: 模块分析 tab not visible — may need scroll or factory has no data');
    await page.screenshot({ path: `${SD}/03-finance-no-module-tab.png`, fullPage: true });
  }
  fs.writeFileSync(`${SD}/02-finance-errors.json`, JSON.stringify({ errors, apiCalls }, null, 2));
  console.log(`  errors: ${errors.length}, apiCalls: ${apiCalls.length}`);
  errors.slice(0, 10).forEach((e) => console.log(`    [${e.source}] ${(e.message || '').slice(0, 200)}`));

  console.log('\n>>> Done. Screenshots + JSON in', SD);
});
