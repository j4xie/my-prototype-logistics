// pos-4169-isolated-prod.mjs
//
// Opens a FRESH chromium browser, logs in, navigates DIRECTLY to upload 4169
// (POS xlsx). No prior visits to other uploads (e.g. 4172 review). Verifies:
//   Q1. The page loads + KPI strip renders within 60s (no 120s axios timeout)
//       — i.e. PROD-1 truly fixed?
//   Q2. KPI cards are POS measures (营业额/实收金额/客流量 etc.) and NOT
//       review-style cards (服务分/星级分 = page state leak from 4172)
//
// This resolves two open asterisks from prior verification of Option A + F
// (commits 5b02dde76 + e6203c315): the previous test navigated 4172 → 4169
// sequentially, so 4169's "pass" might have been state carryover.
//
// Output: screenshot + console log; exit code 0 = both Q1 + Q2 OK.
//
// Usage: node tests/e2e-comprehensive/pos-4169-isolated-prod.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const URL = process.env.TARGET_URL || 'https://admin.cretaceousfuture.com';
const USER = process.env.E2E_USER || 'qhj_prod';
const PASS = process.env.E2E_PASS || '123456';
const POS_UPLOAD_NAME = 'qhj_order_detail'; // upload 4169

const RESULTS_DIR = 'tests/e2e-comprehensive/results/agg-strategy-realwindow';
mkdirSync(RESULTS_DIR, { recursive: true });

let exitCode = 0;
const FAIL = (msg) => { console.error(`X ${msg}`); exitCode = 1; };
const OK = (msg) => console.log(`OK ${msg}`);

const consoleErrors = [];
const networkFails = [];

function setupNetworkLogging(page) {
  page.on('response', (resp) => {
    const u = resp.url();
    if (!/\/api\//.test(u)) return;
    const status = resp.status();
    if (status >= 400) {
      networkFails.push({ url: u.split('?')[0], status });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      consoleErrors.push(t);
    }
  });
}

async function login(page) {
  console.log(`Navigating to ${URL}/login ...`);
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input', { timeout: 15000 });

  const inputs = await page.locator('input').all();
  let userInput, passInput;
  for (const i of inputs) {
    const t = await i.getAttribute('type');
    if (t === 'password' && !passInput) passInput = i;
    else if (!userInput && (t === 'text' || !t)) userInput = i;
  }
  if (!userInput || !passInput) {
    await page.screenshot({ path: join(RESULTS_DIR, 'pos-isolated-login-no-inputs.png') });
    throw new Error('Could not find username/password inputs');
  }
  await userInput.fill(USER);
  await passInput.fill(PASS);
  await passInput.press('Enter');

  try {
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
    OK(`L0 logged in as ${USER} (URL: ${page.url()})`);
  } catch (e) {
    await page.screenshot({ path: join(RESULTS_DIR, 'pos-isolated-login-timeout.png') });
    throw new Error(`Login did not redirect within 25s: ${e.message}`);
  }
  await page.waitForTimeout(2000);
}

async function navigateToAnalysis(page) {
  console.log(`Navigating to ${URL}/smart-bi/analysis ...`);
  await page.goto(`${URL}/smart-bi/analysis`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForSelector('.smart-bi-analysis', { timeout: 30000 });
  } catch (e) {
    await page.screenshot({ path: join(RESULTS_DIR, 'pos-isolated-no-container.png') });
    throw new Error(`smart-bi-analysis container not visible within 30s: ${e.message}`);
  }
  // Upload list is loaded async — give it time to populate the dropdown
  await page.waitForTimeout(4000);
}

// Switch the upload dropdown to POS_UPLOAD_NAME — but DO NOT visit any other
// upload first. The dropdown's currently-selected default depends on history;
// if it already shows the POS upload, this still re-selects it (idempotent).
async function switchToPOSUpload(page) {
  console.log(`Switching to upload "${POS_UPLOAD_NAME}" (fresh, no prior 4172 visit)`);
  const t0 = Date.now();

  const selectWrapper = page.locator('.upload-card .header-actions .el-select').first();
  await selectWrapper.waitFor({ timeout: 15000 });
  await selectWrapper.click({ force: true });
  await page.waitForTimeout(800);

  const targetOption = page.locator('.el-select-dropdown__item').filter({ hasText: POS_UPLOAD_NAME }).first();
  const optionCount = await page.locator('.el-select-dropdown__item').count();
  await targetOption.waitFor({ timeout: 8000 });
  await targetOption.click();
  await page.waitForTimeout(2000);

  const wrapperText = (await selectWrapper.textContent()) || '';
  const switched = wrapperText.includes(POS_UPLOAD_NAME);
  console.log(`Selected (${switched ? 'OK' : 'FAIL'}): wrapper="${wrapperText.slice(0, 80)}", optionCount=${optionCount}`);
  console.log(`Switch took ${Date.now() - t0}ms`);
  return switched;
}

// Wait for KPI cards bounded by maxMs.
// Returns { count, elapsed } where count=0 means timed out.
async function waitForKPIs(page, maxMs = 60000) {
  const t0 = Date.now();
  let lastCount = 0;
  let stableTicks = 0;
  while (Date.now() - t0 < maxMs) {
    const count = await page.locator('.kpi-grid .kpi-title').count();
    const skeletonCount = await page.locator('.kpi-section .chart-skeleton, .kpi-section [class*="skeleton"]').count();
    if (count > 0 && count === lastCount && skeletonCount === 0) {
      stableTicks++;
      if (stableTicks >= 2) {
        await page.waitForTimeout(2500); // CountUp animation finishes
        return { count, elapsed: Date.now() - t0 };
      }
    } else {
      stableTicks = 0;
    }
    lastCount = count;
    if ((Date.now() - t0) % 15000 < 1500) {
      console.log(`  waiting for KPIs... ${Math.round((Date.now() - t0) / 1000)}s elapsed, count=${count}, skel=${skeletonCount}`);
    }
    await page.waitForTimeout(1500);
  }
  return { count: lastCount, elapsed: Date.now() - t0 };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();
  setupNetworkLogging(page);

  try {
    await login(page);
    await navigateToAnalysis(page);

    // CRITICAL: only ever touch the POS upload — never visit 4172 first
    const switched = await switchToPOSUpload(page);
    if (!switched) {
      FAIL(`Q0 — dropdown switch to "${POS_UPLOAD_NAME}" did not register`);
      await page.screenshot({ path: join(RESULTS_DIR, 'pos-4169-isolated-no-switch.png') });
      throw new Error('Could not select POS upload');
    }

    const renderStart = Date.now();
    const { count, elapsed } = await waitForKPIs(page, 60000);

    const screenshot = join(RESULTS_DIR, 'pos-4169-isolated.png');
    await page.screenshot({ path: screenshot, fullPage: false });
    console.log(`Screenshot: ${screenshot}`);

    // Q1: did PROD-1 truly resolve?
    if (count > 0 && elapsed < 60000) {
      OK(`Q1 — PROD-1 resolved: KPI strip rendered in ${(elapsed / 1000).toFixed(1)}s (${count} cards, no 120s timeout)`);
    } else if (count === 0) {
      // Probe for the 120s timeout toast / empty state
      const timeoutToast = await page.locator('text=/timeout of 120000ms/').count();
      const emptyState = await page.locator('text=/暂无可分析的数据/').count();
      FAIL(`Q1 — PROD-1 NOT fixed: no KPI strip after ${(elapsed / 1000).toFixed(1)}s. timeoutToast=${timeoutToast}, emptyState=${emptyState}`);
    } else {
      FAIL(`Q1 — PROD-1 partially: KPI rendered but took ${(elapsed / 1000).toFixed(1)}s (close to 60s)`);
    }

    // Q2: are these POS measures or review-style cards?
    let titles = [];
    if (count > 0) {
      const titleEls = await page.locator('.kpi-grid .kpi-title').all();
      titles = (await Promise.all(titleEls.map((e) => e.textContent()))).map((t) => (t || '').trim()).filter(Boolean);
      console.log(`KPI titles (${titles.length}): ${titles.join(' | ')}`);
    }

    const reviewIndicators = ['平均', '星级', '服务分', '环境分', '口味分'];
    const posIndicators = ['营业', '实收', '客流', '客单', '订单', '应收', '收款', '消费金额', '人均', '账单', '行数', '总数'];

    const reviewMatches = titles.filter((t) => reviewIndicators.some((r) => t.includes(r)));
    const posMatches = titles.filter((t) => posIndicators.some((p) => t.includes(p)));

    if (titles.length === 0) {
      FAIL(`Q2 — No titles to classify (Q1 already failed)`);
    } else if (posMatches.length > 0 && reviewMatches.length === 0) {
      OK(`Q2 — POS shows OWN measures (no review leak). Matches: ${posMatches.join(', ')}`);
    } else if (reviewMatches.length > 0 && posMatches.length === 0) {
      FAIL(`Q2 — POS shows REVIEW data leak: ${reviewMatches.join(', ')}. Page state carryover bug confirmed.`);
    } else if (posMatches.length > 0 && reviewMatches.length > 0) {
      FAIL(`Q2 — MIXED: POS measures (${posMatches.join(', ')}) + review-style (${reviewMatches.join(', ')}). Investigate.`);
    } else {
      OK(`Q2 — Cards present but neither classic POS nor review patterns: ${titles.join(', ')}. May still be valid (e.g. 数据行数 fallback).`);
    }

    // Console + network checks
    if (consoleErrors.length === 0) {
      OK(`Z1 — Zero console errors`);
    } else {
      FAIL(`Z1 — ${consoleErrors.length} console error(s) — first: ${consoleErrors[0].substring(0, 200)}`);
    }
    if (networkFails.length === 0) {
      OK(`Z2 — No 4xx/5xx on /api endpoints`);
    } else {
      FAIL(`Z2 — ${networkFails.length} network failure(s) — first: ${networkFails[0].status} ${networkFails[0].url}`);
    }

    if (exitCode === 0) {
      console.log('\nBoth Q1 + Q2 verified clean');
    }
  } catch (e) {
    console.error('\nFATAL:', e.message);
    if (e.stack) console.error(e.stack);
    exitCode = 1;
    try { await page.screenshot({ path: join(RESULTS_DIR, 'pos-4169-isolated-fatal.png') }); } catch {}
  } finally {
    await browser.close();
    process.exit(exitCode);
  }
})();
