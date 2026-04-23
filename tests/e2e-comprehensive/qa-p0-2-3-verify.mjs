// Verify P0-2 + P0-3: Dashboard no longer auto-swaps to smoke upload
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

// Clear any remembered source to simulate fresh visit
await page.evaluate(() => {
  Object.keys(localStorage).forEach(k => {
    if (k.includes('dashboard') && k.includes('source')) localStorage.removeItem(k);
  });
});

await page.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);

const kpi = await page.evaluate(() => Array.from(document.querySelectorAll('.kpi-card')).slice(0, 4).map(c => ({
  label: c.querySelector('.kpi-label')?.textContent?.trim() || '',
  value: c.querySelector('.kpi-value')?.textContent?.trim() || '',
})));
console.log('KPI cards:');
kpi.forEach(c => console.log(`  ${c.label}: ${c.value}`));

const pseudoInChart = await page.evaluate(() => {
  // Look at chart legend / pie labels for 1001.0-style pseudo names or 李四 staff names
  const texts = Array.from(document.querySelectorAll('text, .tpl-title, .el-statistic__content'));
  return texts.map(t => t.textContent?.trim() || '').filter(t => /^100[0-9]\.0$|^(李四|王五|张三)$/.test(t));
});
console.log(`\npseudo labels still visible (should be empty): ${JSON.stringify(pseudoInChart)}`);

await page.screenshot({ path: 'tests/e2e-comprehensive/results/qa-2026-04-23/p0-2-3-dashboard.png', fullPage: true });
await browser.close();
