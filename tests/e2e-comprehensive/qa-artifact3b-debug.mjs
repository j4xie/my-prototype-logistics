// Debug Artifact 3b: why does F001 tenant see Gold POS card?
// Hypotheses: (a) factory_admin1's factoryId != F001, (b) F001 has Silver data, (c) card logic bug.
import { chromium } from 'playwright';

const BASE = 'https://admin.cretaceousfuture.com';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const nets = [];
page.on('response', async (r) => {
  if (r.url().includes('finance-summary')) {
    let body = ''; try { body = (await r.text()).slice(0, 400); } catch {}
    nets.push({ url: r.url(), status: r.status(), body });
  }
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(5000);

// Check factoryId from localStorage (where Pinia persists)
const tenantInfo = await page.evaluate(() => {
  const result = { localStorage: {}, sessionStorage: {}, cookies: document.cookie };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k);
    if (k.toLowerCase().includes('auth') || k.toLowerCase().includes('user') || k.toLowerCase().includes('factor')) {
      result.localStorage[k] = v?.slice(0, 300);
    }
  }
  return result;
});
console.log('tenantInfo:', JSON.stringify(tenantInfo, null, 2).slice(0, 1500));

// Navigate to sales orders, observe finance-summary calls
await page.goto(`${BASE}/sales/orders`, { waitUntil: 'networkidle' });
await page.waitForTimeout(8000);

console.log('\n=== finance-summary calls ===');
for (const n of nets) {
  const param = n.url.split('?')[1] || '';
  console.log(`  ${n.status} ?${param}`);
  console.log(`    body: ${n.body}`);
}

const cardVisible = await page.locator('.gold-pos-summary').isVisible().catch(() => false);
console.log(`\ngold-pos-summary visible: ${cardVisible}`);

if (cardVisible) {
  const stats = await page.locator('.gold-pos-summary .el-statistic__number').allTextContents();
  const rangeLabel = await page.locator('.gold-pos-summary').textContent();
  console.log(`stats: ${stats.join(' | ')}`);
  console.log(`range label: ${rangeLabel?.match(/YTD|全年|\d{4}/g)?.join(',') || 'N/A'}`);
}

await browser.close();
