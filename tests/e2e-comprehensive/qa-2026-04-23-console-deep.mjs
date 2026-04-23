// 2026-04-23 Console-error deep sweep across all 4 SmartBI pages + sales/orders.
// Goal: capture EVERY console message (error/warning/info), failed network, and
// PageError event for each page. Strict Playwright isolation.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'https://admin.cretaceousfuture.com';
const RESULTS_DIR = 'tests/e2e-comprehensive/results/qa-2026-04-23';
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const pageLogs = {};  // { url: { errors, warnings, pageErrors, failedNet, all4xx5xx } }
let currentPage = 'login';
const initSlot = (key) => { if (!pageLogs[key]) pageLogs[key] = { errors: [], warnings: [], pageErrors: [], failedNet: [], all4xx5xx: [] }; };
initSlot(currentPage);

page.on('console', (m) => {
  const entry = { type: m.type(), text: m.text().slice(0, 500), at: new Date().toISOString() };
  const slot = pageLogs[currentPage];
  if (m.type() === 'error') slot.errors.push(entry);
  else if (m.type() === 'warning') slot.warnings.push(entry);
});
page.on('pageerror', (err) => {
  pageLogs[currentPage].pageErrors.push({ message: String(err).slice(0, 500), at: new Date().toISOString() });
});
page.on('requestfailed', (req) => {
  pageLogs[currentPage].failedNet.push({ url: req.url(), failure: req.failure()?.errorText, method: req.method() });
});
page.on('response', (r) => {
  if (r.status() >= 400) {
    pageLogs[currentPage].all4xx5xx.push({ url: r.url(), status: r.status(), method: r.request().method() });
  }
});

// ===== LOGIN =====
console.log(`\n=== LOGIN qhj_prod on ${BASE} ===`);
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(6000);
console.log(`  post-login URL: ${page.url()}`);

// ===== Per-page sweep =====
const PAGES = [
  { name: '经营驾驶舱 /smart-bi/dashboard', path: '/smart-bi/dashboard', wait: 8000 },
  { name: '财务分析 /smart-bi/finance', path: '/smart-bi/finance', wait: 8000 },
  { name: '餐饮v2 /smart-bi/restaurant-v2', path: '/smart-bi/restaurant-v2', wait: 8000 },
  { name: '趋势分析 /analytics/trends', path: '/analytics/trends', wait: 8000 },
  { name: '销售订单 /sales/orders', path: '/sales/orders', wait: 8000 },
];

for (const P of PAGES) {
  currentPage = P.path;
  initSlot(currentPage);
  console.log(`\n--- ${P.name} ---`);
  try {
    await page.goto(`${BASE}${P.path}`, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.log(`  [nav timeout, continuing] ${String(e).slice(0, 100)}`);
  }
  await page.waitForTimeout(P.wait);
  // Scroll to bottom to trigger lazy-loaded components (TemplateGrid etc)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(5000);

  // For pages with template grid, try clicking refresh
  const refreshBtn = page.locator('.tpl-grid-header button:has-text("刷新")').first();
  if (await refreshBtn.count() > 0) {
    try { await refreshBtn.click(); await page.waitForTimeout(3000); console.log('  clicked 刷新'); } catch {}
  }

  const slot = pageLogs[currentPage];
  const shotName = P.path.replace(/\//g, '_').replace(/^_/, '');
  await page.screenshot({ path: `${RESULTS_DIR}/console-${shotName}.png`, fullPage: true }).catch(() => {});

  const err = slot.errors.length, warn = slot.warnings.length, pe = slot.pageErrors.length, fn = slot.failedNet.length, bad = slot.all4xx5xx.length;
  console.log(`  errors=${err}  warnings=${warn}  pageErrors=${pe}  failedNet=${fn}  4xx/5xx=${bad}`);
  if (err > 0) slot.errors.slice(0, 3).forEach(e => console.log(`    [ERR] ${e.text.slice(0, 160)}`));
  if (pe > 0) slot.pageErrors.slice(0, 3).forEach(e => console.log(`    [PAGE] ${e.message.slice(0, 160)}`));
  if (bad > 0) slot.all4xx5xx.slice(0, 3).forEach(e => console.log(`    [HTTP] ${e.status} ${e.method} ${e.url.slice(0, 140)}`));
  if (fn > 0) slot.failedNet.slice(0, 3).forEach(e => console.log(`    [NETFAIL] ${e.failure} ${e.url.slice(0, 140)}`));
}

// ===== Summary =====
console.log(`\n===== SUMMARY =====`);
let grandErr = 0, grandPE = 0, grandBad = 0;
const summary = {};
for (const [url, s] of Object.entries(pageLogs)) {
  if (url === 'login') continue;
  summary[url] = {
    errors: s.errors.length, warnings: s.warnings.length,
    pageErrors: s.pageErrors.length, failedNet: s.failedNet.length,
    http4xx5xx: s.all4xx5xx.length,
  };
  grandErr += s.errors.length;
  grandPE += s.pageErrors.length;
  grandBad += s.all4xx5xx.length;
}
console.table(summary);
console.log(`TOTAL  errors=${grandErr}  pageErrors=${grandPE}  4xx/5xx=${grandBad}`);

fs.writeFileSync(`${RESULTS_DIR}/console-evidence.json`, JSON.stringify({
  meta: { url: BASE, startedAt: new Date().toISOString() },
  summary,
  detail: pageLogs,
}, null, 2));
console.log(`\nevidence: ${RESULTS_DIR}/console-evidence.json`);

await browser.close();
