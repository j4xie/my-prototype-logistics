// v1.2 Week 9: verify POS 交易概览 card on /sales/orders for qhj tenant
import { chromium } from 'playwright';

const URL = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

page.on('response', async (r) => {
  if (r.url().includes('/gold/finance-summary')) {
    const body = await r.text().catch(() => '');
    console.log(`[NET] ${r.status()} :: ${body.slice(0, 160)}`);
  }
});

await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(5000);

await page.goto(`${URL}/sales/orders`, { waitUntil: 'networkidle' });
await page.waitForTimeout(10000);

const card = page.locator('.gold-pos-summary');
const count = await card.count();
console.log(`gold-pos-summary count: ${count}`);
const visible = await card.isVisible().catch(() => false);
console.log(`visible: ${visible}`);
console.log(`current URL: ${page.url()}`);
await page.screenshot({ path: 'tests/e2e-comprehensive/results/v1.2-sales-orders-debug.png', fullPage: true });
const html = await page.evaluate(() => {
  const el = document.querySelector('.gold-pos-summary');
  if (!el) return 'NOT IN DOM';
  return `style.display=${el.style.display} hidden=${el.hasAttribute('hidden')} classList=${el.className}`;
});
console.log(`DOM: ${html}`);
const pageWrapper = await page.locator('.page-wrapper').first().count();
console.log(`.page-wrapper count: ${pageWrapper}`);

if (visible) {
  const vals = await card.locator('.el-statistic__number').allTextContents();
  console.log(`stats: ${vals.join(' | ')}`);
  await card.screenshot({ path: 'tests/e2e-comprehensive/results/v1.2-sales-orders-gold.png' });
}
await browser.close();
