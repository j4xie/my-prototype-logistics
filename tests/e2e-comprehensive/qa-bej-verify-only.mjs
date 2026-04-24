// Focused test: re-verify 不二君 after cache invalidation + P0-3 v2 deploy.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-bej-verify';
fs.mkdirSync(OUT, { recursive: true });

async function login(page, username, password = '123456') {
  for (let i = 0; i < 6; i++) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('input', { timeout: 10000 });
      const inputs = await page.locator('input').all();
      let u, p;
      for (const inp of inputs) {
        const t = await inp.getAttribute('type');
        if (t === 'password' && !p) p = inp;
        else if (!u && (t === 'text' || !t)) u = inp;
      }
      await u.fill(username); await p.fill(password); await p.press('Enter');
      await page.waitForTimeout(8000);
      if (!page.url().includes('/login')) return true;
    } catch {}
    if (i < 5) await page.waitForTimeout(10000);
  }
  return false;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const ok = await login(page, 'buerjun_admin');
if (!ok) { console.log('login failed'); await browser.close(); process.exit(1); }

await page.goto(`${BASE}/restaurant/analytics`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

// Click 刷新分析 if visible to force recompute
const refreshBtn = page.locator('button:has-text("刷新分析")').first();
if (await refreshBtn.count() > 0) {
  await refreshBtn.click().catch(() => {});
  await page.waitForTimeout(15000);  // wait for recompute
}

const signals = await page.evaluate(() => {
  const kpis = Array.from(document.querySelectorAll('.el-statistic__number, .kpi-value'))
    .map(e => (e.textContent || '').trim())
    .filter(Boolean);
  // store count typically appears after "门店数" text
  const allText = document.body.textContent || '';
  const storeMatch = allText.match(/门店数[^0-9]{0,10}(\d+)/);
  const revenueMatch = allText.match(/总营收[^0-9]{0,10}([\d.,万亿元]+)/);
  return {
    storeCount: storeMatch ? parseInt(storeMatch[1]) : null,
    revenueText: revenueMatch ? revenueMatch[1] : null,
    kpiValues: kpis.slice(0, 8),
  };
});

await page.screenshot({ path: `${OUT}/bej-after-p0-3-v2.png`, fullPage: false });
console.log('BEJ after P0-3 v2:');
console.log('  门店数:', signals.storeCount);
console.log('  总营收:', signals.revenueText);
console.log('  kpis:', signals.kpiValues);

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(signals, null, 2));
await browser.close();
