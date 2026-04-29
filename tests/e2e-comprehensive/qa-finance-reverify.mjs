// Re-verify /smart-bi/finance 502 incident
import { chromium } from 'playwright';

const BASE = 'https://admin.cretaceousfuture.com';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const errors = [], http4xx5xx = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('response', (r) => { if (r.status() >= 400) http4xx5xx.push({ url: r.url().slice(0, 200), status: r.status() }); });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(5000);

// 3 consecutive visits
for (let i = 1; i <= 3; i++) {
  errors.length = 0; http4xx5xx.length = 0;
  console.log(`\n--- Run #${i}: /smart-bi/finance ---`);
  await page.goto(`${BASE}/smart-bi/finance`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(4000);
  console.log(`  errors=${errors.length} 4xx/5xx=${http4xx5xx.length}`);
  for (const b of http4xx5xx) console.log(`    ${b.status} ${b.url}`);
  for (const e of errors.slice(0, 3)) console.log(`    [ERR] ${e.slice(0, 180)}`);
}

await browser.close();
