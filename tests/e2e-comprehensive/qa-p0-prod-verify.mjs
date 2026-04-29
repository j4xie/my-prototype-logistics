// Prod verify: P0-4 dev-jargon scrub + P0-5 fallback chain on restaurant-v2
import { chromium } from 'playwright';
const BASE = 'https://admin.cretaceousfuture.com';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input', { timeout: 60000 });
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(8000);

// RestaurantV2
await page.goto(`${BASE}/smart-bi/restaurant-v2`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const header = await page.locator('.header-title').first().textContent().catch(() => '');
const hasDeng = /邓总|救命组合/.test(await page.content());
const kpiVisible = await page.locator('.gold-kpi-card').isVisible().catch(() => false);
const kpiStats = await page.locator('.gold-kpi-card .el-statistic__number').allTextContents();
const fallbackTag = await page.locator('.gold-kpi-card .el-tag.el-tag--warning').textContent().catch(() => '');
const placeholder = await page.locator('input[placeholder*="青花椒"]').count();
const oldPlaceholder = await page.locator('input[placeholder*="鼎鲜"]').count();

console.log(`RestaurantV2:`);
console.log(`  header: "${header.trim()}"`);
console.log(`  has '邓总/救命组合' anywhere: ${hasDeng}`);
console.log(`  KPI card visible: ${kpiVisible}`);
console.log(`  KPI stats: ${kpiStats.join(' | ')}`);
console.log(`  fallback tag: ${fallbackTag?.trim()}`);
console.log(`  青花椒 placeholder count: ${placeholder} / 鼎鲜 placeholder count: ${oldPlaceholder}`);

// Trends
await page.goto(`${BASE}/analytics/trends`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const trendVisible = await page.locator('.gold-trend-card').isVisible().catch(() => false);
const trendFallback = await page.locator('.gold-trend-card .el-tag.el-tag--warning').textContent().catch(() => '');
console.log(`\nTrends:`);
console.log(`  Gold POS trend visible on default period: ${trendVisible}`);
console.log(`  fallback tag: ${trendFallback?.trim()}`);

await page.screenshot({ path: 'tests/e2e-comprehensive/results/qa-2026-04-23/p0-prod-verify-trends.png' });
await page.goto(`${BASE}/smart-bi/restaurant-v2`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'tests/e2e-comprehensive/results/qa-2026-04-23/p0-prod-verify-rest-v2.png' });

await browser.close();
