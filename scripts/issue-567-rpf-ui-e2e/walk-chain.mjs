#!/usr/bin/env node
/**
 * Issue #567 — T2-4 RPF chain UI cross-layer verification.
 *
 * chat3 (PR #613) ran an API-only probe and verdict-stamped PARTIAL due to:
 *   • L1→L2 entity gap (no sample_id on PurchaseOrderItem) — out of scope
 *   • L4→L5 data gap (0 MaterialConsumption rows on F006 prod) — blocked on #538
 *
 * chat3 did NOT exercise the UI layer at all. This script does that.
 *
 * Source-grep finding (web-admin/src/views/{rd,procurement,production,inventory,warehouse}):
 *   NO router.push / RouterLink hyperlinks BETWEEN the 5 RPF pages — only
 *   intra-page list→detail nav. Customer must side-menu-navigate manually.
 *
 *   Cross-layer data is shown via EMBEDDED DISPLAYS, not hyperlinks:
 *     • procurement/orders/detail.vue        — embedded receives list (L2 shows L3)
 *     • procurement/receives/list.vue        — purchaseOrderNumber column (L3 shows L2)
 *     • production/batches/detail.vue:303    — 原料消耗记录 section (production batch shows consumed material batches)
 *     • warehouse/inventory/index.vue:190    — material-batches/{id}/usage-history dialog (L4 shows L5)
 *
 * This script verifies those 4 surfaces actually render correct linked data
 * on F006 prod for the 3 known traces from PR #613:
 *
 *   Trace A: PO-20260507-0003 (0ed28974) → RCV-20260507-4505 (4b8fe6ea) → MT-20260507-7640 (45e22fda)
 *   Trace B: PO-20260507-0002 (6705c5c8) → RCV-20260507-0023 (3dd9443a) → MT-20260507-2061 (c0634171)
 *   Trace C: PO-20260502-0001 (cd8d51eb) → RCV-20260502-4276 (97311d11) → MT-20260502-1365 (eb2f15d6)
 *
 * Cross-page STATE test: navigate L2→list, click into detail, back, reload,
 * direct-URL nav. Check factory_id from auth store + URL stays stable.
 *
 * Per memory:
 *   reference_playwright_prod_139_nav.md — `commit` waitUntil + waitForSelector
 *     + setDefaultNavigationTimeout(60000); don't route.abort() pdf-lib.
 *   reference_web_admin_token_key.md     — localStorage['cretas_access_token'].
 *
 * Output: results.json + shots/*.png
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8086';
const SHOTS_DIR = path.join(__dirname, 'shots');
const RESULTS_FILE = path.join(__dirname, 'results.json');

const ACCOUNT = { username: 'f006_admin', password: '123456' };

const TRACES = [
  { name: 'A', po: { number: 'PO-20260507-0003', id: '0ed28974' }, receive: { number: 'RCV-20260507-4505', id: '4b8fe6ea' }, batch: { number: 'MT-20260507-7640', id: '45e22fda' } },
  { name: 'B', po: { number: 'PO-20260507-0002', id: '6705c5c8' }, receive: { number: 'RCV-20260507-0023', id: '3dd9443a' }, batch: { number: 'MT-20260507-2061', id: 'c0634171' } },
  { name: 'C', po: { number: 'PO-20260502-0001', id: 'cd8d51eb' }, receive: { number: 'RCV-20260502-4276', id: '97311d11' }, batch: { number: 'MT-20260502-1365', id: 'eb2f15d6' } },
];

async function shotPath(name) {
  return path.join(SHOTS_DIR, `${name}.png`);
}

async function shot(page, name) {
  const p = await shotPath(name);
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  return p;
}

async function login(page) {
  // Per reference_playwright_prod_139_nav.md: prod 139 SPA boot involves
  // 588KB pdf-lib bundle. Default waitUntil='load' times out; use 'commit'
  // + explicit waitForSelector.
  // Mirrors customer-audit-e2e-2026-05-14-qhj/run-coverage.mjs login() pattern.
  // SPA loads 588KB pdf-lib bundle; use waitUntil:'commit' not 'load'.
  page.setDefaultNavigationTimeout(60000);
  await page.goto(`${TARGET}/login`, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForSelector('input[placeholder*="用户名"], input[type="text"]', { timeout: 30000 });
  await page.fill('input[placeholder*="用户名"], input[type="text"]', ACCOUNT.username);
  await page.fill('input[placeholder*="密码"], input[type="password"]', ACCOUNT.password);
  const loginBtn =
    (await page.$('button.login-button')) ??
    (await page.$('button:has-text("登 录")')) ??
    (await page.$('button:has-text("登录")'));
  if (!loginBtn) throw new Error('Login button not found on /login page');
  await loginBtn.click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 18000 });
  // Confirm token landed at the canonical key (per reference_web_admin_token_key.md)
  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  if (!token) throw new Error('Login succeeded URL-wise but cretas_access_token not in localStorage');
  return { token: token.slice(0, 20) + '…' };
}

async function getAuthFactory(page) {
  // Pinia store is accessed via app's __PINIA__ or via localStorage key
  // Don't rely on internals — read URL/breadcrumb instead. F006 is the expected factory.
  const url = page.url();
  const factoryFromUrl = url.match(/\/api\/mobile\/(\w+)\//)?.[1] || null;
  return { url, factoryFromUrl };
}

async function safeWaitForNetworkIdle(page, ms = 8000) {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => {});
}

async function captureConsoleErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push({ type: 'pageerror', msg: e.message }));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push({ type: 'console.error', msg: m.text().slice(0, 300) });
  });
  return errors;
}

const results = [];
function record(step, data) {
  results.push({ step, ts: new Date().toISOString(), ...data });
  // Live progress so the operator can watch
  const verdict = data.verdict || data.status || '';
  console.log(`[${step}] ${verdict} ${data.note || ''}`);
}

async function main() {
  await fs.mkdir(SHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = await captureConsoleErrors(page);

  try {
    // ──────────────────────────────────────────────────────────────────
    // Step 0: login
    // ──────────────────────────────────────────────────────────────────
    const loginInfo = await login(page);
    record('S0-login', { verdict: 'PASS', token: loginInfo.token, url: page.url() });
    await shot(page, '00-post-login');

    // ──────────────────────────────────────────────────────────────────
    // Step 1: Five RPF pages render without 401/500
    // ──────────────────────────────────────────────────────────────────
    const pages = [
      { tag: 'L1-rd-samples', path: '/rd/samples', expectRows: 0, label: 'L1 R&D 样品' },
      { tag: 'L2-procurement-orders', path: '/procurement/orders', expectRows: 6, label: 'L2 采购订单' },
      { tag: 'L3-procurement-receives', path: '/procurement/receives', expectRows: 5, label: 'L3 入库记录' },
      { tag: 'L4-warehouse-inventory', path: '/warehouse/inventory', expectRows: 3, label: 'L4 物料批次 (= chat3 /material-batches)' },
      { tag: 'L5-production-plans', path: '/production/plans', expectRows: 6, label: 'L5 生产计划' },
    ];
    for (const p of pages) {
      const url = `${TARGET}${p.path}`;
      await page.goto(url, { waitUntil: 'commit' });
      await safeWaitForNetworkIdle(page, 10000);
      await page.waitForTimeout(1500);
      const rowCount = await page.$$eval('tbody tr', (els) => els.length).catch(() => 0);
      const bodyText = await page.textContent('body').catch(() => '');
      const is404 = /\/404/.test(page.url());
      const has401 = /用户未登录|401|未授权/.test(bodyText || '');
      const verdict = is404 ? 'FAIL—404' : has401 ? 'FAIL—401' : (rowCount >= p.expectRows ? 'PASS' : `INFO—rowCount ${rowCount}<${p.expectRows}`);
      record(`S1-${p.tag}`, { verdict, url: page.url(), rowCount, expectRows: p.expectRows, label: p.label });
      await shot(page, `01-${p.tag}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 2: L2 → L3 embedded receives  (procurement/orders/detail.vue:91-97)
    //   chat3 PR #613 report uses 8-char-truncated UUIDs (`0ed28974` etc.)
    //   but real entity IDs are full UUIDs. Navigate via list-click to get
    //   the real URL (= what a real user does).
    // ──────────────────────────────────────────────────────────────────
    await page.goto(`${TARGET}/procurement/orders`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    // Element Plus tables sometimes need extra time to populate
    await page.waitForSelector('.el-table tbody tr', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    // For each trace, find the row containing the PO number and click 查看
    for (const t of TRACES) {
      // Re-nav to list each time (detail page replaces list in DOM)
      if (!page.url().endsWith('/procurement/orders')) {
        await page.goto(`${TARGET}/procurement/orders`, { waitUntil: 'commit' });
        await safeWaitForNetworkIdle(page, 10000);
        await page.waitForSelector('.el-table tbody tr', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }
      // Locate the row containing the PO number and click its 查看 button
      const row = page.locator('.el-table tbody tr', { hasText: t.po.number }).first();
      const rowVisible = await row.count();
      let detailUrl = null;
      let poNumberShown = false;
      let receiveNumberShown = false;
      if (rowVisible > 0) {
        // Click 查看 inside that row
        const viewBtn = row.locator('button:has-text("详情"), a:has-text("详情"), button:has-text("查看"), a:has-text("查看")').first();
        const btnExists = await viewBtn.count();
        if (btnExists > 0) {
          await viewBtn.click();
          await safeWaitForNetworkIdle(page, 10000);
          await page.waitForTimeout(2500);
          detailUrl = page.url();
          const pageText = await page.textContent('body').catch(() => '');
          poNumberShown = pageText.includes(t.po.number);
          receiveNumberShown = pageText.includes(t.receive.number);
        }
      }
      const verdict = !rowVisible ? 'FAIL—PO row not in list' :
                      !detailUrl ? 'FAIL—查看 button not found' :
                      (poNumberShown && receiveNumberShown) ? 'PASS' :
                      poNumberShown ? 'PARTIAL—PO loaded but receive not embedded' :
                      'FAIL—PO detail did not load';
      record(`S2-L2-L3-trace-${t.name}`, {
        verdict,
        listUrl: `${TARGET}/procurement/orders`,
        detailUrl,
        poNumber: t.po.number,
        receiveNumber: t.receive.number,
        rowFoundInList: rowVisible > 0,
        poNumberShown,
        receiveNumberShown,
      });
      await shot(page, `02-L2-L3-trace-${t.name}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 3: L3 list — `purchaseOrderNumber` column visible
    //   (procurement/receives/list.vue interface ReceiveRow:27)
    // ──────────────────────────────────────────────────────────────────
    await page.goto(`${TARGET}/procurement/receives`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForSelector('.el-table tbody tr', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    {
      const rowCount = await page.$$eval('.el-table tbody tr', (els) => els.length).catch(() => 0);
      const pageText = await page.textContent('body').catch(() => '');
      // Source receives/list.vue:311 — column "采购订单" renders
      //   `{{ row.purchaseOrderNumber || row.purchaseOrderId || '— (无单入库)' }}`
      // So if backend leaves purchaseOrderNumber null, users see raw UUID. Capture all
      // cells in that column to see what F006 prod actually renders.
      const headers = await page.$$eval('.el-table thead th', (ths) => ths.map((t) => t.textContent?.trim() || ''));
      const colIdx = headers.findIndex((h) => h.includes('采购订单'));
      const cells = colIdx >= 0 ? await page.$$eval('.el-table tbody tr', (rows, idx) =>
        rows.map((r) => r.querySelectorAll('td')[idx]?.textContent?.trim() || ''),
        colIdx,
      ) : [];
      const uuidLike = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s);
      const fallbackMark = '— (无单入库)';
      const summary = {
        nameMatches: cells.filter((c) => /^PO-\d+-\d+$/.test(c)).length,
        uuidMatches: cells.filter((c) => uuidLike(c)).length,
        fallbackMatches: cells.filter((c) => c === fallbackMark).length,
        rawCells: cells,
      };
      const allPoNumbers = TRACES.every((t) => cells.includes(t.po.number));
      const allReceives = TRACES.every((t) => pageText.includes(t.receive.number));
      let verdict;
      if (colIdx < 0) verdict = 'FAIL—采购订单 column header not found';
      else if (allPoNumbers) verdict = 'PASS—human-readable PO numbers rendered for all 3 traces';
      else if (summary.uuidMatches > 0) verdict = 'PARTIAL—column renders raw UUIDs (backend doesn\'t populate purchaseOrderNumber)';
      else verdict = allReceives ? 'PARTIAL' : 'FAIL';
      record('S3-L3-shows-PO-numbers', {
        verdict,
        rowCount,
        purchaseOrderColumnIndex: colIdx,
        purchaseOrderColumnHeader: headers[colIdx] || null,
        purchaseOrderColumnSummary: summary,
        traceReceiveNumbersOnPage: {
          a: pageText.includes(TRACES[0].receive.number),
          b: pageText.includes(TRACES[1].receive.number),
          c: pageText.includes(TRACES[2].receive.number),
        },
        note: 'Source: receives/list.vue:311-313 column renders purchaseOrderNumber || purchaseOrderId || fallback. UUID-only rendering = backend gap (LIST endpoint doesn\'t join PO number); PO number rendering = full L3→L2 visibility.',
      });
      await shot(page, '03-L3-PO-numbers');
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 4: L4 warehouse inventory — material batch detail
    //   (warehouse/inventory/index.vue:190 — usage-history)
    // ──────────────────────────────────────────────────────────────────
    await page.goto(`${TARGET}/warehouse/inventory`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForTimeout(1500);
    {
      const pageText = await page.textContent('body').catch(() => '');
      const trace_a_seen = pageText.includes(TRACES[0].batch.number);
      const trace_b_seen = pageText.includes(TRACES[1].batch.number);
      const trace_c_seen = pageText.includes(TRACES[2].batch.number);
      const all_seen = trace_a_seen && trace_b_seen && trace_c_seen;
      record('S4-L4-warehouse-inventory-shows-batches', {
        verdict: all_seen ? 'PASS' : (trace_a_seen || trace_b_seen || trace_c_seen) ? 'PARTIAL' : 'FAIL',
        trace_a_batch_seen: trace_a_seen,
        trace_b_batch_seen: trace_b_seen,
        trace_c_batch_seen: trace_c_seen,
        note: '/warehouse/inventory should show 3 material batches per chat3 PR #613',
      });
      await shot(page, '04-L4-warehouse-inventory');

      // Click 查看 on the first row to open usage-history dialog
      const viewBtn = await page.$('button:has-text("查看"), .el-button:has-text("查看")');
      if (viewBtn) {
        await viewBtn.click();
        await page.waitForTimeout(2500);
        const dialogText = await page.textContent('.el-dialog, .el-drawer, [role="dialog"]').catch(() => '');
        const hasUsageSection = /使用记录|使用历史|消耗记录|usage/i.test(dialogText || '');
        const emptyMessage = /暂无|无记录|empty|no.*data/i.test(dialogText || '');
        record('S4b-L4-detail-dialog-usage-history', {
          verdict: hasUsageSection ? (emptyMessage ? 'PASS-empty-dialog' : 'PASS') : 'INFO—usage section not detected in dialog',
          hasUsageSection,
          emptyMessage,
          note: 'L4→L5 surface: usage-history dialog. chat3 PR #613: F006 prod has 0 consumption rows; dialog should render empty state, not error.',
          dialogPreview: (dialogText || '').slice(0, 400),
        });
        await shot(page, '04b-L4-detail-dialog');
      } else {
        record('S4b-L4-detail-dialog-usage-history', { verdict: 'INFO', note: 'no 查看 button on first row' });
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 5: Production batches list → detail (consumption section)
    //   (production/batches/detail.vue:301-329 — 原料消耗记录 section, v-if length>0)
    // ──────────────────────────────────────────────────────────────────
    await page.goto(`${TARGET}/production/batches`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForTimeout(2000);
    {
      const rowCount = await page.$$eval('tbody tr', (els) => els.length).catch(() => 0);
      record('S5-production-batches-list', {
        verdict: rowCount > 0 ? 'PASS' : 'INFO—no production batches on F006 prod (expected per chat3 0 consumption)',
        rowCount,
      });
      await shot(page, '05-production-batches-list');

      if (rowCount > 0) {
        // Click first 查看 button
        const viewLink = await page.$('button:has-text("详情"), a:has-text("详情"), button:has-text("查看"), a:has-text("查看")');
        if (viewLink) {
          await viewLink.click();
          await page.waitForTimeout(3000);
          const detailText = await page.textContent('body').catch(() => '');
          const hasConsumptionSection = /原料消耗记录/.test(detailText || '');
          record('S5b-production-batch-detail-consumption', {
            verdict: hasConsumptionSection ? 'PASS' : 'INFO—consumption section not rendered (v-if length>0 guard means empty data hides section gracefully)',
            hasConsumptionSection,
            url: page.url(),
            note: 'T4-D4 PR #533 surface. F006 prod has 0 consumption rows per chat3 → section hides via v-if guard. Verdict here just records whether section CAN render when data is present.',
          });
          await shot(page, '05b-production-batch-detail');
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 6: Cross-page STATE test — direct nav + reload
    //   Per dispatch: "Vuex/Pinia store vs route params vs localStorage"
    //   We test: factory context survives reload + direct URL nav.
    // ──────────────────────────────────────────────────────────────────
    // First nav to PO list, capture a real detail URL by clicking through.
    await page.goto(`${TARGET}/procurement/orders`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForSelector('.el-table tbody tr', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const beforeFactoryToken = await page.evaluate(() => ({
      token: localStorage.getItem('cretas_access_token')?.slice(0, 30) + '…',
      userKeys: Object.keys(localStorage).filter((k) => k.startsWith('cretas_') || k.includes('factory')),
    }));
    // Click into trace A's PO via the list to capture the real full-UUID URL.
    const traceARow = page.locator('.el-table tbody tr', { hasText: TRACES[0].po.number }).first();
    const traceARowExists = (await traceARow.count()) > 0;
    let capturedDetailUrl = null;
    if (traceARowExists) {
      const viewBtn = traceARow.locator('button:has-text("详情"), a:has-text("详情"), button:has-text("查看"), a:has-text("查看")').first();
      await viewBtn.click();
      await safeWaitForNetworkIdle(page, 10000);
      await page.waitForTimeout(2000);
      capturedDetailUrl = page.url();
    }

    // Now back to a different page, then DIRECT NAV via the captured full URL
    // to test re-hydration from URL param.
    await page.goto(`${TARGET}/dashboard`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 8000);
    await page.waitForTimeout(1500);
    let directNavLoaded = false;
    let tokenAfter = null;
    if (capturedDetailUrl) {
      await page.goto(capturedDetailUrl, { waitUntil: 'commit' });
      await safeWaitForNetworkIdle(page, 10000);
      await page.waitForTimeout(2500);
      const afterDirectNav = await page.textContent('body').catch(() => '');
      tokenAfter = await page.evaluate(() => localStorage.getItem('cretas_access_token')?.slice(0, 30) + '…');
      directNavLoaded = afterDirectNav.includes(TRACES[0].po.number);
    }
    record('S6a-direct-url-nav-state', {
      verdict: !capturedDetailUrl ? 'SKIP—could not capture PO detail URL via list-click' :
               directNavLoaded ? 'PASS' : 'FAIL',
      note: 'Direct URL nav to PO detail (full UUID captured from list-click) should hydrate factory context from auth store.',
      capturedDetailUrl,
      beforeFactoryToken,
      tokenAfter,
      poNumberShownAfterDirectNav: directNavLoaded,
    });
    await shot(page, '06a-direct-url-nav');

    // Now reload mid-detail
    await page.reload({ waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForTimeout(2500);
    const afterReload = await page.textContent('body').catch(() => '');
    const reloadLoaded = afterReload.includes(TRACES[0].po.number);
    const tokenAfterReload = await page.evaluate(() => localStorage.getItem('cretas_access_token')?.slice(0, 30) + '…');
    record('S6b-reload-state', {
      verdict: reloadLoaded ? 'PASS' : 'FAIL',
      note: 'F5 reload on PO detail should re-hydrate from URL param + auth store. Token preserved.',
      tokenAfterReload,
      poNumberShownAfterReload: reloadLoaded,
    });
    await shot(page, '06b-reload');

    // Fresh list → detail → back. The previous block's goBack would unwind
    // through /dashboard etc., not the cleanest test. Reset history.
    await page.goto(`${TARGET}/procurement/orders`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForSelector('.el-table tbody tr', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const freshListRowCount = await page.$$eval('.el-table tbody tr', (els) => els.length).catch(() => 0);
    const traceARowFresh = page.locator('.el-table tbody tr', { hasText: TRACES[0].po.number }).first();
    const freshRowExists = (await traceARowFresh.count()) > 0;
    let backVerdict = 'SKIP';
    let backUrl = null;
    let backRowCount = 0;
    if (freshRowExists) {
      const fviewBtn = traceARowFresh.locator('button:has-text("详情"), a:has-text("详情"), button:has-text("查看"), a:has-text("查看")').first();
      await fviewBtn.click();
      await safeWaitForNetworkIdle(page, 10000);
      await page.waitForTimeout(2000);
      await page.goBack({ waitUntil: 'commit' });
      await safeWaitForNetworkIdle(page, 10000);
      await page.waitForTimeout(1500);
      backUrl = page.url();
      const onList = /\/procurement\/orders$/.test(backUrl);
      backRowCount = await page.$$eval('.el-table tbody tr', (els) => els.length).catch(() => 0);
      backVerdict = onList && backRowCount > 0 ? 'PASS' : onList ? 'PARTIAL—list URL but no rows' : 'FAIL—not on list';
    }
    record('S6c-back-button-state', {
      verdict: backVerdict,
      url: backUrl,
      rowCount: backRowCount,
      freshListRowCount,
      note: 'Fresh list → detail → browser back. Verifies factory context + list re-population.',
    });
    await shot(page, '06c-back-button');

    // ──────────────────────────────────────────────────────────────────
    // Step 7: Cross-factory negative — direct URL to another factory's PO id should NOT load (security)
    //   F006 admin should NOT see RES_3101_009 PO. We don't have a known PO id; just verify
    //   the URL pattern doesn't leak unrelated data.
    // ──────────────────────────────────────────────────────────────────
    await page.goto(`${TARGET}/procurement/orders/00000000-0000-0000-0000-000000000000`, { waitUntil: 'commit' });
    await safeWaitForNetworkIdle(page, 10000);
    await page.waitForTimeout(2000);
    const ghostText = await page.textContent('body').catch(() => '');
    const showsNotFound = /记录不存在|not.*found|404|未找到/i.test(ghostText || '');
    record('S7-bogus-id-handling', {
      verdict: showsNotFound ? 'PASS' : 'INFO',
      note: 'Bogus PO id should render NotFoundEmpty (per procurement/orders/detail.vue:82-85), not crash.',
      showsNotFound,
    });
    await shot(page, '07-bogus-id');

  } catch (err) {
    record('FATAL', { verdict: 'FAIL', error: err.message, stack: err.stack?.slice(0, 1000) });
    await shot(page, '99-fatal-state');
  } finally {
    await context.close();
    await browser.close();
  }

  // Emit console errors + write results
  const summary = {
    ranAt: new Date().toISOString(),
    target: TARGET,
    account: ACCOUNT.username,
    traces: TRACES,
    consoleErrors: errors.slice(0, 50),
    consoleErrorCount: errors.length,
    steps: results,
  };
  await fs.writeFile(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`\nDone. ${results.length} steps. Console errors: ${errors.length}. Results → ${RESULTS_FILE}`);
}

main().catch((e) => {
  console.error('Script crashed:', e);
  process.exit(1);
});
