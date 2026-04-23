// Cross-tenant / cross-role regression audit.
// Ensures Apr 24 UX fixes don't break manufacturing tenant OR non-super-admin roles.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/cross-tenant-role-audit';
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
      if (!page.url().includes('/login')) return true;
    } catch {}
    if (i < 4) await page.waitForTimeout(5000);
  }
  return false;
}

async function auditUser(browser, username, password, role, probes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const loggedIn = await login(page, username, password);
  if (!loggedIn) {
    await ctx.close();
    return { username, role, loginFailed: true };
  }

  // Capture sidebar
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const sidebar = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.el-menu-item'))
      .map(e => (e.textContent || '').trim())
      .filter(Boolean);
  });
  await page.screenshot({ path: `${OUT}/${username}-home.png`, fullPage: false });

  const probeResults = [];
  for (const probe of probes) {
    const consoleErrors = [];
    page.removeAllListeners('console');
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });

    await page.goto(`${BASE}${probe.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const url = page.url();
    const is403 = url.includes('/403');
    const hasContent = await page.evaluate(() => {
      const main = document.querySelector('.app-main')?.textContent?.trim() || '';
      return main.length > 100;
    });
    const matched = probe.expect === '403' ? is403 : (probe.expect === 'ok' ? !is403 && hasContent : true);
    probeResults.push({
      path: probe.path,
      expect: probe.expect,
      url: url.replace(BASE, ''),
      is403,
      hasContent,
      pass: matched,
      consoleErrors: consoleErrors.slice(0, 2),
    });
  }

  await ctx.close();
  return { username, role, sidebar, probeResults };
}

const browser = await chromium.launch({ headless: true });
const results = { base: BASE, ts: new Date().toISOString(), users: [] };

// User matrix
const USERS = [
  {
    username: 'factory_admin1', password: '123456', role: 'factory_super_admin',
    probes: [
      { path: '/smart-bi/dashboard', expect: 'ok' },
      { path: '/smart-bi/finance', expect: 'ok' },
      { path: '/sales/orders', expect: 'ok' },
      { path: '/sales/finished-goods', expect: 'ok' },  // should still work for F001
      { path: '/sales/shipments', expect: 'ok' },
      { path: '/equipment/list', expect: 'ok' },
      { path: '/production/batches', expect: 'ok' },
    ]
  },
  {
    username: 'finance_mgr1', password: '123456', role: 'finance_manager',
    probes: [
      { path: '/smart-bi/dashboard', expect: 'ok' },  // allowed per whitelist
      { path: '/smart-bi/finance', expect: 'ok' },
      { path: '/finance/invoices', expect: 'ok' },
      { path: '/sales/orders', expect: '403' },       // blocked per whitelist
      { path: '/production/batches', expect: '403' },
      { path: '/equipment/list', expect: '403' },
    ]
  },
  {
    username: 'sales_mgr1', password: '123456', role: 'sales_manager',
    probes: [
      { path: '/smart-bi/dashboard', expect: 'ok' },
      { path: '/sales/orders', expect: 'ok' },
      { path: '/production/batches', expect: '403' },
      { path: '/equipment/list', expect: '403' },
    ]
  },
  {
    username: 'equipment_admin1', password: '123456', role: 'equipment_admin',
    probes: [
      { path: '/equipment/list', expect: 'ok' },
      { path: '/equipment/maintenance', expect: 'ok' },
      { path: '/sales/orders', expect: '403' },
      { path: '/smart-bi/finance', expect: '403' },
    ]
  },
];

for (const user of USERS) {
  console.log(`\n=== ${user.username} (${user.role}) ===`);
  const r = await auditUser(browser, user.username, user.password, user.role, user.probes);
  results.users.push(r);
  if (r.loginFailed) {
    console.log('  ⛔ login failed');
    continue;
  }
  console.log(`  sidebar items: ${r.sidebar.length}`);
  for (const p of r.probeResults) {
    const icon = p.pass ? '✅' : '❌';
    console.log(`  ${icon} ${p.path.padEnd(32, ' ')} → ${p.is403 ? '403' : 'ok'} (expect ${p.expect})`);
  }
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
let totalPass = 0, total = 0;
for (const u of results.users) {
  if (u.loginFailed) {
    console.log(`  ⛔ ${u.username} login failed`);
    continue;
  }
  const pass = u.probeResults.filter(p => p.pass).length;
  console.log(`  ${u.username}: ${pass}/${u.probeResults.length} probes passed`);
  totalPass += pass; total += u.probeResults.length;
}
console.log(`  TOTAL: ${totalPass}/${total}`);
