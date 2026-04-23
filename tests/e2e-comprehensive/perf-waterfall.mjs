// Dashboard + Finance network waterfall to identify slow requests.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/perf-waterfall';
fs.mkdirSync(OUT, { recursive: true });

async function login(page, username, password) {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input');
    const inputs = await page.locator('input').all();
    let u, p;
    for (const inp of inputs) {
      const t = await inp.getAttribute('type');
      if (t === 'password' && !p) p = inp;
      else if (!u && (t === 'text' || !t)) u = inp;
    }
    await u.fill(username); await p.fill(password); await p.press('Enter');
    await page.waitForTimeout(6000);
    if (!page.url().includes('/login')) return;
    if (i < 2) await page.waitForTimeout(3000);
  }
  throw new Error(`login failed: ${username}`);
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, ts: new Date().toISOString(), pages: [] };

for (const path of ['/smart-bi/dashboard', '/smart-bi/finance']) {
  console.log(`\n=== ${path} ===`);
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'factory_admin1', '123456');

  // Clear localStorage to simulate fresh visit
  await page.evaluate(() => localStorage.clear());

  const requests = [];
  page.on('request', req => {
    requests.push({ url: req.url(), method: req.method(), startTime: Date.now(), type: req.resourceType() });
  });
  page.on('response', async resp => {
    const r = requests.find(x => x.url === resp.url() && !x.endTime);
    if (r) {
      r.endTime = Date.now();
      r.duration = r.endTime - r.startTime;
      r.status = resp.status();
    }
  });

  const navStart = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const tDom = Date.now() - navStart;
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  const tIdle = Date.now() - navStart;
  await page.waitForTimeout(2000);
  const tFull = Date.now() - navStart;

  // Filter to API calls only (not assets)
  const apiCalls = requests
    .filter(r => r.type === 'xhr' || r.type === 'fetch')
    .filter(r => r.endTime)
    .map(r => ({
      url: r.url.replace(BASE, ''),
      duration: r.duration,
      status: r.status,
      startOffset: r.startTime - navStart,
    }))
    .sort((a, b) => b.duration - a.duration);

  const top10 = apiCalls.slice(0, 10);
  console.log(`  tDom=${tDom}ms  tIdle=${tIdle}ms  tFull=${tFull}ms`);
  console.log(`  TOP 10 slowest API calls:`);
  top10.forEach(c => {
    const label = c.url.length > 90 ? c.url.slice(0, 90) + '...' : c.url;
    console.log(`    ${String(c.duration).padStart(5, ' ')}ms  ${c.status}  ${label}`);
  });

  results.pages.push({ path, tDom, tIdle, tFull, top10, totalApiCalls: apiCalls.length });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log(`\nOutput: ${OUT}/results.json`);
