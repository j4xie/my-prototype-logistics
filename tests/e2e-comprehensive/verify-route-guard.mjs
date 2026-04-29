// Verify route-level guard: F002 restaurant direct URL to manufacturing sales → 403
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-route-guard';
fs.mkdirSync(OUT, { recursive: true });

async function login(page, username, password) {
  for (let i = 0; i < 5; i++) {
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
      await page.waitForTimeout(7000);
      if (!page.url().includes('/login')) return;
    } catch {}
    if (i < 4) await page.waitForTimeout(5000);
  }
  throw new Error(`login failed: ${username}`);
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

// F002 restaurant — direct URL should redirect to /403
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'restaurant_admin1', '123456');

  for (const path of ['/sales/finished-goods', '/sales/shipments']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    const pageText = await page.evaluate(() => document.body.textContent?.trim().slice(0, 100) || '');
    const is403 = finalUrl.includes('/403') || pageText.includes('403') || pageText.includes('无权限') || pageText.includes('访问被拒绝');
    await page.screenshot({ path: `${OUT}/f002-${path.replace(/\//g, '_')}.png`, fullPage: false });
    results.cases.push({
      case: `F002 direct URL ${path}`,
      finalUrl,
      pageSnippet: pageText.slice(0, 80),
      is403,
      pass: is403,
    });
    console.log(`  ${is403 ? '✅' : '❌'} ${path} → ${finalUrl.replace(BASE, '')} (${is403 ? '403' : 'NOT blocked'})`);
  }
  await ctx.close();
}

// F001 manufacturing — should succeed (no regression)
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'factory_admin1', '123456');

  for (const path of ['/sales/finished-goods', '/sales/shipments']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    const is403 = finalUrl.includes('/403');
    const hasTable = await page.evaluate(() => !!document.querySelector('.el-table'));
    results.cases.push({
      case: `F001 direct URL ${path} (regression)`,
      finalUrl,
      is403,
      hasTable,
      pass: !is403 && hasTable,
    });
    console.log(`  ${!is403 && hasTable ? '✅' : '❌'} ${path} → ${finalUrl.replace(BASE, '')} (has table: ${hasTable})`);
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
let pass = 0;
for (const c of results.cases) {
  console.log(`  ${c.pass ? '✅' : '❌'}  ${c.case}`);
  if (c.pass) pass++;
}
console.log(`  ${pass}/${results.cases.length} passed`);
