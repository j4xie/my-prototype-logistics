import { chromium } from 'playwright';
const BASE = 'https://admin.cretaceousfuture.com';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const responses = [];
page.on('response', async (r) => {
  if (r.url().includes('analysis-results') && r.status() === 200) {
    try { responses.push({ url: r.url(), body: (await r.text()).slice(0, 10000) }); } catch {}
  }
});
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input', { timeout: 60000 });
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(6000);
await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(10000);
for (const r of responses) {
  if (r.url.includes('groupon') || r.body.includes('groupon_channel_breakdown')) {
    console.log(`URL: ${r.url}`);
    // Extract kpi_values from first item matching groupon
    const match = r.body.match(/"template_code":"groupon_channel_breakdown"[\s\S]*?"kpi_values":(\{[^}]+\})/);
    if (match) console.log(`kpi_values: ${match[1]}`);
  }
}
const groupCard = await page.evaluate(() => {
  const titles = Array.from(document.querySelectorAll('.tpl-title'));
  for (const t of titles) {
    if (t.textContent?.includes('团购渠道')) {
      const card = t.closest('.tpl-card');
      if (card) {
        const kpis = Array.from(card.querySelectorAll('.tpl-kpi-value, .tpl-kpi-label')).map(e => e.textContent?.trim() || '');
        return kpis;
      }
    }
  }
  return null;
});
console.log('\nTeamKard 团购渠道 kpis rendered:');
console.log(groupCard);
await browser.close();
