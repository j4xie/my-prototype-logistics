// P1-14: profile 趋势页加载时序 + network waterfall
import { chromium } from 'playwright';
const BASE = process.env.TARGET_URL || 'https://admin.cretaceousfuture.com';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const timings = [];
page.on('console', (m) => {
  console.log(`[BR ${m.type()}] ${m.text().slice(0, 180)}`);
});
page.on('request', (r) => {
  timings.push({ type: 'req', t: Date.now(), url: r.url() });
});
page.on('response', async (r) => {
  timings.push({ type: 'resp', t: Date.now(), url: r.url(), status: r.status() });
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input', { timeout: 60000 });
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(6000);

// Pre-seed cache to simulate 2nd visit
const seedResult = await page.evaluate(() => {
  const uid = JSON.parse(localStorage.getItem('cretas_user') || '{}');
  const fid = uid?.factoryUser?.factoryId;
  if (!fid) return 'no factoryId';
  const key = `goldTrend.lastRange.${fid}`;
  localStorage.setItem(key, JSON.stringify({ s: '2025-01-01', e: '2025-12-31', label: '2025全年' }));
  return `seeded key=${key} val=${localStorage.getItem(key)}`;
});
console.log(`seed result: ${seedResult}`);

console.log('\n=== NAVIGATE TO /analytics/trends (2nd visit, cache seeded) ===');
timings.length = 0;
const t0 = Date.now();

await page.goto(`${BASE}/analytics/trends`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
const tNetIdle = Date.now() - t0;
console.log(`after 3s: ${tNetIdle}ms`);
const postNavCache = await page.evaluate(() => {
  const all = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('goldTrend')) all[k] = localStorage.getItem(k);
  }
  return all;
});
console.log(`post-nav cache:`, postNavCache);

// Log API calls in time order
const apiCalls = timings.filter(t => t.url.includes('/api/') && !t.url.includes('.js') && !t.url.includes('.css'));
console.log(`\nAPI call sequence:`);
const calls = {};
for (const c of apiCalls) {
  if (c.type === 'req') {
    calls[c.url] = { start: c.t };
  } else if (c.type === 'resp' && calls[c.url]) {
    calls[c.url].end = c.t;
    calls[c.url].dur = c.t - calls[c.url].start;
    calls[c.url].status = c.status;
  }
}
// Sort by start time
const sorted = Object.entries(calls).map(([url, v]) => ({ url, ...v })).sort((a, b) => a.start - b.start);
for (const c of sorted) {
  const urlShort = c.url.split('?')[0].replace(/^https:\/\/[^/]+/, '').slice(0, 80);
  const qs = c.url.split('?')[1] ? '?' + c.url.split('?')[1].slice(0, 80) : '';
  console.log(`  +${(c.start - t0).toString().padStart(5, ' ')}ms  ${c.dur || '??'}ms  ${c.status || '??'}  ${urlShort}${qs}`);
}

await browser.close();
