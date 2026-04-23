// Verify P0-1 full: Finance 顶部 KPI 对 restaurant tenant 改显 Gold 营收/订单/客单价/门店
import { chromium } from 'playwright';
const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input', { timeout: 60000 });
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(6000);

await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);

// Check tenant type from localStorage
const type = await page.evaluate(() => {
  const raw = localStorage.getItem('cretas_user');
  if (!raw) return null;
  try { return JSON.parse(raw).factoryUser?.factoryType; } catch { return null; }
});
console.log(`tenant factoryType: ${type}`);

const kpis = await page.evaluate(() => Array.from(document.querySelectorAll('.kpi-card')).slice(0, 4).map(c => ({
  label: c.querySelector('.kpi-label')?.textContent?.trim() || '',
  value: c.querySelector('.kpi-value')?.textContent?.trim() || '',
  sub: c.querySelector('.kpi-sub')?.textContent?.trim() || '',
})));
console.log('Top KPI cards:');
kpis.forEach(c => console.log(`  ${c.label}: ${c.value}  (${c.sub})`));

const goldTagCount = await page.locator('.el-tag:has-text("Gold · finance_summary")').count();
const fallbackTag = await page.locator('.el-tag--warning:has-text("已显示")').textContent().catch(() => '');
console.log(`Gold tag count: ${goldTagCount}`);
console.log(`Fallback tag: ${fallbackTag?.trim()}`);

await page.screenshot({ path: 'tests/e2e-comprehensive/results/qa-2026-04-23/p0-1-finance-gold.png', fullPage: true });
await browser.close();
