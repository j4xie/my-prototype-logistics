// Inspect Dashboard kpiCards payload — diagnose P0-2 "本月 4500" vs ¥3.62亿
import { chromium } from 'playwright';
const BASE = 'https://admin.cretaceousfuture.com';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const dashboardResponses = [];
page.on('response', async (r) => {
  const u = r.url();
  if ((u.includes('/smart-bi/') || u.includes('/reports/') || u.includes('/dashboard')) && r.status() === 200 && !u.includes('.png') && !u.includes('.svg') && !u.includes('.js')) {
    try {
      const b = await r.text();
      if (b.includes('4500') || b.includes('16000') || b.includes('kpiCard') || b.includes('salesAmount')) {
        dashboardResponses.push({ url: u, body: b.slice(0, 2000) });
      }
    } catch {}
  }
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input', { timeout: 60000 });
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(8000);

await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);

// Read KPI values visible
const stats = await page.locator('.kpi-card .kpi-value, .el-statistic__number, .dashboard-kpi-value, .kpi-label + .kpi-value').allTextContents();
console.log(`KPI values visible: ${JSON.stringify(stats)}`);

// Read the cards structure
const cards = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.kpi-card, [class*="kpi-card"]')).slice(0, 6).map(c => {
    const title = c.querySelector('[class*="label"], [class*="title"]')?.textContent?.trim() || '';
    const value = c.querySelector('[class*="value"]')?.textContent?.trim() || '';
    return { title, value };
  });
});
console.log(`Parsed KPI cards:`);
cards.forEach(c => console.log(`  ${c.title}: ${c.value}`));

console.log(`\n=== Dashboard API responses ===`);
for (const r of dashboardResponses) {
  console.log(`\nURL: ${r.url}`);
  console.log(`Body: ${r.body.slice(0, 1500)}`);
}

await browser.close();
