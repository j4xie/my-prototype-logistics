// Verify restaurant sidebar no longer shows 成品库存 / 出货记录.
// Playwright isolation: fresh chromium.launch, no MCP tools.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-restaurant-sidebar';
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
  throw new Error(`Login failed: ${username}`);
}

async function getSidebarLeaves(page) {
  // Expand all collapsed sidebar groups first
  await page.evaluate(() => {
    document.querySelectorAll('.el-sub-menu__title').forEach(el => {
      const parent = el.closest('.el-sub-menu');
      if (parent && !parent.classList.contains('is-opened')) {
        el.click();
      }
    });
  });
  await page.waitForTimeout(1500);
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.el-menu-item'))
      .map(el => (el.textContent || '').trim())
      .filter(Boolean);
  });
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

// F002 restaurant — should NOT see 成品库存/出货记录
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'restaurant_admin1', '123456');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const items = await getSidebarLeaves(page);
  await page.screenshot({ path: `${OUT}/f002-sidebar.png`, fullPage: false });
  const leak成品库存 = items.some(t => t.includes('成品库存'));
  const leak出货记录 = items.some(t => t.includes('出货记录'));
  results.cases.push({
    case: 'F002 restaurant sidebar',
    tenant: 'restaurant_admin1',
    salesItems: items.filter(t => ['销售订单', '成品库存', '客户管理', '出货记录'].some(kw => t.includes(kw))),
    leak成品库存, leak出货记录,
    allItems: items,
    pass: !leak成品库存 && !leak出货记录,
  });
  console.log('F002 restaurant sales visible:', items.filter(t => ['销售订单', '成品库存', '客户管理', '出货记录'].some(kw => t.includes(kw))));
  console.log('  leak成品库存:', leak成品库存, '(expect false)');
  console.log('  leak出货记录:', leak出货记录, '(expect false)');
  await ctx.close();
}

// F001 manufacturing — should still see ALL 4 sales items (regression)
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page, 'factory_admin1', '123456');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const items = await getSidebarLeaves(page);
  await page.screenshot({ path: `${OUT}/f001-sidebar.png`, fullPage: false });
  const has成品库存 = items.some(t => t.includes('成品库存'));
  const has出货记录 = items.some(t => t.includes('出货记录'));
  results.cases.push({
    case: 'F001 manufacturing sidebar (regression)',
    tenant: 'factory_admin1',
    salesItems: items.filter(t => ['销售订单', '成品库存', '客户管理', '出货记录'].some(kw => t.includes(kw))),
    has成品库存, has出货记录,
    pass: has成品库存 && has出货记录,
  });
  console.log('\nF001 manufacturing sales visible:', items.filter(t => ['销售订单', '成品库存', '客户管理', '出货记录'].some(kw => t.includes(kw))));
  console.log('  has成品库存:', has成品库存, '(expect true)');
  console.log('  has出货记录:', has出货记录, '(expect true)');
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
let pass = 0;
for (const c of results.cases) {
  console.log(`  ${c.pass ? '✅ PASS' : '❌ FAIL'}  ${c.case}`);
  if (c.pass) pass++;
}
console.log(`\n  ${pass}/${results.cases.length} passed`);
