// 2026-04-23 Full QA — ALL prod artifacts (pre-compact + this session)
// Strict Playwright isolation: fresh chromium.launch per run, no shared profile,
// no MCP browser tools. Safe to run alongside other chats' Playwright.
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.TARGET_URL || 'https://admin.cretaceousfuture.com';
const RESULTS_DIR = 'tests/e2e-comprehensive/results/qa-2026-04-23';
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const evidence = { meta: { url: URL, startedAt: new Date().toISOString() }, artifacts: {} };
const addEv = (key, data) => { evidence.artifacts[key] = data; };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const consoleErrors = [];
const networkCalls = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('response', async (r) => {
  const u = r.url();
  if (u.includes('/api/smartbi') || u.includes('/api/mobile') || u.includes('/gold/')) {
    const status = r.status();
    let body = '';
    try { if (u.includes('/gold/') || u.includes('insights/custom')) body = (await r.text()).slice(0, 300); } catch {}
    networkCalls.push({ url: u, status, body });
  }
});

// MutationObserver for toasts (qa-prompt Rule 7)
async function installToastObserver() {
  await page.evaluate(() => {
    window.__toastLog = [];
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && typeof n.className === 'string' &&
          (n.className.includes('el-message') || n.className.includes('el-notification')))
        window.__toastLog.push({ time: Date.now(), cls: n.className, text: (n.textContent || '').trim() });
    }))).observe(document.body, { childList: true, subtree: true });
  });
}

// ============ Login qhj_prod ============
console.log('\n=== LOGIN qhj_prod ===');
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(6000);
console.log(`  post-login URL: ${page.url()}`);
await installToastObserver();

// ============ Artifact 1: RestaurantV2 Gold KPI strip (deep) ============
console.log('\n=== ARTIFACT 1: RestaurantV2 Gold KPI strip ===');
networkCalls.length = 0;
await page.goto(`${URL}/smart-bi/restaurant-v2`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Switch to 2025全年 via date picker
const kpiDp = page.locator('.gold-kpi-card .el-date-editor').first();
if (await kpiDp.count() > 0) {
  await kpiDp.click();
  await page.waitForTimeout(400);
  const sc = page.locator('.el-picker-panel__shortcut:has-text("2025全年")').first();
  if (await sc.count() > 0) { await sc.click(); await page.waitForTimeout(4000); }
}

const goldKpiVisible = await page.locator('.gold-kpi-card').isVisible().catch(() => false);
const kpiStats = await page.locator('.gold-kpi-card .el-statistic__number').allTextContents();
const kpiTopStores = await page.locator('.gold-kpi-card .el-table__row').evaluateAll(rows =>
  rows.slice(0, 5).map(r => Array.from(r.querySelectorAll('.cell')).map(c => c.textContent?.trim()))
);
await page.locator('.gold-kpi-card').screenshot({ path: `${RESULTS_DIR}/a1-restaurant-v2-kpi.png` }).catch(() => {});

addEv('1_restaurantV2_kpi', {
  depth: 'deep',
  visible: goldKpiVisible,
  stats: kpiStats,
  topStores: kpiTopStores,
  networkGold: networkCalls.filter(n => n.url.includes('finance-summary')).length,
  consoleErrors: [...consoleErrors],
  // Rule 9 business spot check:
  rule9: {
    top1_store: kpiTopStores[0]?.[0] || null,
    top1_store_is_real: /青花椒/.test(kpiTopStores[0]?.[0] || ''),
    tail_store: kpiTopStores[kpiTopStores.length - 1]?.[0] || null,
    tail_is_real: /青花椒/.test(kpiTopStores[kpiTopStores.length - 1]?.[0] || ''),
    no_pseudo: !kpiTopStores.some(r => /^(门店名称|合计|注：|^\d+\.\d+$)/.test(r[0] || '')),
  },
});
console.log(`  visible=${goldKpiVisible} stats=${kpiStats.join('|')} top5_count=${kpiTopStores.length}`);

// ============ Artifact 7: Week 6 TemplateGrid on /smart-bi/restaurant-v2 ============
console.log('\n=== ARTIFACT 7: Week 6 TemplateGrid on RestaurantV2 ===');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(5000);
const tgResV2 = {
  sectionCount: await page.locator('.tpl-grid-section').count(),
  cardCount: await page.locator('.tpl-card').count(),
  titleTexts: await page.locator('.tpl-grid-section-title, .tpl-grid-header').allTextContents(),
};
addEv('7_template_grid_v2', {
  depth: 'smoke',
  ...tgResV2,
  // Rule 9: card titles should be Chinese, not template_code like
  firstCardTitle: (await page.locator('.tpl-card .tpl-title').first().textContent().catch(() => '')).trim(),
});
console.log(`  sections=${tgResV2.sectionCount} cards=${tgResV2.cardCount}`);

// ============ Artifact 2: Trends Gold POS revenue chart (deep + empty semi-error) ============
console.log('\n=== ARTIFACT 2: Trends Gold POS chart ===');
networkCalls.length = 0;
await page.goto(`${URL}/analytics/trends`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Happy path: 2025全年
const trendSel = page.locator('.header-right .el-select').first();
await trendSel.click(); await page.waitForTimeout(400);
const trendOpt = page.locator('.el-select-dropdown__item:has-text("2025全年")').first();
await trendOpt.click(); await page.waitForTimeout(4000);

const trendVisible = await page.locator('.gold-trend-card').isVisible().catch(() => false);
const trendDays = await page.locator('.gold-trend-card span').filter({ hasText: /\d+ 天/ }).first().textContent().catch(() => '');
const trendTag = await page.locator('.gold-trend-card .el-tag').first().textContent().catch(() => '');

// Rule 9: spot check 3 points from daily-trend response
const trendPayload = networkCalls.find(n => n.url.includes('/gold/daily-trend'));
let pointsSample = [];
try {
  const parsed = JSON.parse(trendPayload?.body || '{}');
  const pts = parsed.points || [];
  pointsSample = pts.length >= 3 ? [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]] : pts;
} catch {}

await page.locator('.gold-trend-card').screenshot({ path: `${RESULTS_DIR}/a2-trends-2025.png` }).catch(() => {});

// Empty range semi-error: switch to 近7天
await trendSel.click(); await page.waitForTimeout(400);
const weekOpt = page.locator('.el-select-dropdown__item:has-text("近7天")').first();
await weekOpt.click(); await page.waitForTimeout(3000);
const emptyVisible = await page.locator('.gold-trend-card').isVisible().catch(() => false);

addEv('2_trends_gold', {
  depth: 'deep',
  happyPath: {
    visible: trendVisible, days: trendDays?.trim(), tag: trendTag?.trim(),
    pointsSampleCount: pointsSample.length,
    pointsSample: pointsSample.map(p => ({ date: p.date, revenue: p.revenue, bill_count: p.bill_count })),
    rule9_first_nonzero: (pointsSample[0]?.revenue || 0) > 0,
    rule9_mid_nonzero: (pointsSample[1]?.revenue || 0) > 0,
    rule9_last_nonzero: (pointsSample[2]?.revenue || 0) > 0,
  },
  emptyRange: {
    visible: emptyVisible,  // expected false
    semi_error_ok: !emptyVisible,
  },
  networkGoldDailyTrend: networkCalls.filter(n => n.url.includes('daily-trend')).length,
});
console.log(`  2025: visible=${trendVisible} days=${trendDays?.trim()} sampleRevenues=${pointsSample.map(p => p.revenue).join(',')}`);
console.log(`  近7天: visible=${emptyVisible} (should be false)`);

// Template grid on trends page
const tgResTrend = {
  sectionCount: await page.locator('.tpl-grid-section').count(),
  cardCount: await page.locator('.tpl-card').count(),
};
addEv('7b_template_grid_trends', { depth: 'smoke', ...tgResTrend });
console.log(`  trends templateGrid: sections=${tgResTrend.sectionCount} cards=${tgResTrend.cardCount}`);

// ============ Artifact 3a: Sales orders POS summary (deep, qhj) ============
console.log('\n=== ARTIFACT 3a: Sales orders POS summary (qhj) ===');
networkCalls.length = 0;
await page.goto(`${URL}/sales/orders`, { waitUntil: 'networkidle' });
await page.waitForTimeout(8000);

const soCardVisible = await page.locator('.gold-pos-summary').isVisible().catch(() => false);
const soStats = await page.locator('.gold-pos-summary .el-statistic__number').allTextContents();
const soRangeLabel = await page.locator('.gold-pos-summary span').filter({ hasText: /YTD|全年/ }).first().textContent().catch(() => '');
await page.locator('.gold-pos-summary').screenshot({ path: `${RESULTS_DIR}/a3a-sales-orders-qhj.png` }).catch(() => {});

addEv('3a_sales_orders_qhj', {
  depth: 'deep',
  visible: soCardVisible,
  stats: soStats,
  rangeLabel: soRangeLabel?.trim(),
  networkCallCount: networkCalls.filter(n => n.url.includes('finance-summary')).length,
  // YTD empty → fallback to last year expected (2 calls)
  fallback_triggered: networkCalls.filter(n => n.url.includes('finance-summary')).length >= 2,
});
console.log(`  visible=${soCardVisible} stats=${soStats.join('|')} range=${soRangeLabel?.trim()}`);

// ============ Artifact 4: Dashboard /insights/custom (smoke re-verify) ============
console.log('\n=== ARTIFACT 4: Java /insights/custom regression ===');
networkCalls.length = 0;
await page.goto(`${URL}/smart-bi/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
// Trigger insights by selecting a date range
const dashDp = page.locator('.el-date-editor').first();
if (await dashDp.count() > 0) {
  await dashDp.click(); await page.waitForTimeout(400);
  const sc2025 = page.locator('.el-picker-panel__shortcut:has-text("2025")').first();
  if (await sc2025.count() > 0) await sc2025.click();
  await page.waitForTimeout(30000); // LLM can take 20-40s cold, <1s cached
}
const insightsHit = networkCalls.find(n => n.url.includes('insights/custom'));
addEv('4_insights_custom', {
  depth: 'smoke',
  hit: !!insightsHit,
  url: insightsHit?.url || null,
  status: insightsHit?.status || null,
});
console.log(`  insights/custom hit=${!!insightsHit} status=${insightsHit?.status}`);

// ============ Logout + login F001 for negative-case Artifact 3b ============
console.log('\n=== ARTIFACT 3b: Sales orders card HIDDEN for F001 manufacturing tenant ===');
await page.goto(`${URL}/logout`).catch(() => {});
await page.waitForTimeout(2000);
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins2 = await page.locator('input').all();
let u2, p2; for (const i of ins2) { const t = await i.getAttribute('type'); if (t === 'password' && !p2) p2 = i; else if (!u2 && (t === 'text' || !t)) u2 = i; }
await u2.fill('factory_admin1'); await p2.fill('123456'); await p2.press('Enter');
await page.waitForTimeout(5000);

await page.goto(`${URL}/sales/orders`, { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
const f001CardVisible = await page.locator('.gold-pos-summary').isVisible().catch(() => false);
const f001Table = await page.locator('.el-table').count();
await page.screenshot({ path: `${RESULTS_DIR}/a3b-sales-orders-f001.png`, fullPage: false }).catch(() => {});

addEv('3b_sales_orders_f001_negative', {
  depth: 'deep-negative',
  cardVisible: f001CardVisible,          // expected false
  cardCorrectlyHidden: !f001CardVisible,
  legacyTableRendered: f001Table > 0,
});
console.log(`  card hidden=${!f001CardVisible} (should be true) legacyTable=${f001Table}`);

// ============ Finalize ============
evidence.meta.endedAt = new Date().toISOString();
evidence.meta.consoleErrors = consoleErrors.slice(0, 20);
fs.writeFileSync(`${RESULTS_DIR}/evidence.json`, JSON.stringify(evidence, null, 2));
console.log(`\n=== evidence saved to ${RESULTS_DIR}/evidence.json ===`);

await browser.close();
