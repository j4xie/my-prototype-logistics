// v1.1 KPI flip smoke: verify Gold KPI strip renders on RestaurantV2Dashboard
import { chromium } from 'playwright';

const URL = 'http://139.196.165.140:8097';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('[pageerror] ' + String(e).slice(0, 200)));

await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(5000);

await page.goto(`${URL}/smart-bi/restaurant-v2`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Click "2025全年" shortcut
const dp = page.locator('.gold-kpi-card .el-date-editor');
await dp.click();
await page.waitForTimeout(500);
const shortcut2025 = page.locator('.el-picker-panel__shortcut:has-text("2025全年")').first();
if (await shortcut2025.count() > 0) {
  await shortcut2025.click();
  await page.waitForTimeout(4000);
}

await page.evaluate(() => {
  const el = document.querySelector('.gold-kpi-card');
  if (el) el.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(1000);

// Check the Gold KPI card exists
const goldCard = page.locator('.gold-kpi-card');
const goldCount = await goldCard.count();
console.log(`gold-kpi-card count: ${goldCount}`);

if (goldCount > 0) {
  const title = await goldCard.locator('.gold-kpi-title').textContent();
  console.log(`title: ${title?.trim()}`);
  const stats = await goldCard.locator('.el-statistic__number').allTextContents();
  console.log(`stats values: ${stats.join(' | ')}`);
  const storesRows = await goldCard.locator('.gold-kpi-stores .el-table__row').count();
  console.log(`top stores rows: ${storesRows}`);
  await goldCard.screenshot({ path: 'tests/e2e-comprehensive/results/v1.1-gold-kpi-strip.png' });
  console.log('saved screenshot');
}

if (errs.length) console.log(`⚠ errs (${errs.length}): ${errs.slice(0, 5).join('\n  ')}`);
await browser.close();
