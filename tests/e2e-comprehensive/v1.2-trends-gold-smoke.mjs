// v1.2 Week 9 pilot: verify Gold POS trend section on /analytics/trends
import { chromium } from 'playwright';

const URL = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

page.on('console', (m) => { if (m.type() === 'error') console.log('[ERR]', m.text().slice(0, 200)); });
page.on('response', async (r) => {
  if (r.url().includes('/gold/daily-trend')) {
    const body = await r.text().catch(() => '');
    console.log(`[NET] ${r.status()} ${r.url().split('?')[1]} :: ${body.slice(0, 200)}`);
  }
});

await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(5000);

await page.goto(`${URL}/analytics/trends`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Switch to 2025全年 period
const sel = page.locator('.header-right .el-select').first();
await sel.click();
await page.waitForTimeout(400);
const opt = page.locator('.el-select-dropdown__item:has-text("2025全年")').first();
if (await opt.count() > 0) {
  await opt.click();
  await page.waitForTimeout(3000);
  console.log('switched to 2025全年');
}

const goldCard = page.locator('.gold-trend-card');
const visible = await goldCard.isVisible().catch(() => false);
console.log(`gold-trend-card visible: ${visible}`);

if (visible) {
  const tag = await goldCard.locator('.el-tag').textContent();
  const daysLabel = await goldCard.locator('span:has-text("天")').first().textContent().catch(() => '');
  console.log(`  tag: ${tag?.trim()} · days: ${daysLabel?.trim()}`);
  await goldCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await goldCard.screenshot({ path: 'tests/e2e-comprehensive/results/v1.2-trends-gold.png' });
  console.log('saved screenshot');
}

await browser.close();
