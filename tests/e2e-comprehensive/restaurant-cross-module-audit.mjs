// Cross-module audit for restaurant tenant (F002 restaurant_admin1).
// Question: does any module show manufacturing-only content or empty tables
// that take >60% viewport for a restaurant tenant?
//
// Playwright isolation: fresh chromium.launch, no MCP tools.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/restaurant-cross-module-audit';
fs.mkdirSync(OUT, { recursive: true });

// URL paths to probe. We probe direct URLs; if user nav doesn't expose them
// (sidebar hides for restaurant), direct access tells us what happens.
const PROBES = [
  // 销售 — restaurant CAN access (per sidebar observed earlier)
  { key: 'sales-customers',        path: '/sales/customers',       label: '客户管理',     expected: 'unclear' },
  { key: 'sales-orders',           path: '/sales/orders',          label: '销售订单',     expected: 'fixed' },  // Apr 24 已修 Gold flip
  { key: 'sales-quotes',           path: '/sales/quotes',          label: '报价管理',     expected: 'unclear' },
  { key: 'sales-shipments',        path: '/sales/shipments',       label: '出货记录',     expected: 'unclear' },
  { key: 'sales-finished-goods',   path: '/sales/finished-goods',  label: '成品库存',     expected: 'unclear' },
  // Manufacturing-only — should be hidden/blocked
  { key: 'equipment-list',         path: '/equipment/list',        label: '设备列表',     expected: 'hidden-or-empty' },
  { key: 'equipment-maintenance',  path: '/equipment/maintenance', label: '设备维护',     expected: 'hidden-or-empty' },
  { key: 'quality-inspections',    path: '/quality/inspections',   label: '质检管理',     expected: 'hidden-or-empty' },
  { key: 'rd-samples',             path: '/rd/samples',            label: '研发样品',     expected: 'hidden-or-empty' },
  { key: 'production-batches',     path: '/production/batches',    label: '生产批次',     expected: 'hidden-or-empty' },
  { key: 'warehouse-materials',    path: '/warehouse/materials',   label: '原材料管理',   expected: 'hidden-or-empty' },
  { key: 'scheduling-plans',       path: '/scheduling/plans',      label: '生产排程',     expected: 'hidden-or-empty' },
  // Analytics — some may need flip
  { key: 'analytics-kpi',          path: '/analytics/kpi',         label: 'KPI 看板',     expected: 'unclear' },
  { key: 'analytics-production',   path: '/analytics/production-report', label: '生产报表', expected: 'hidden-or-empty' },
  { key: 'analytics-ai-reports',   path: '/analytics/ai-reports',  label: 'AI 报表',      expected: 'unclear' },
  // Finance — review remaining tabs
  { key: 'finance-invoices',       path: '/finance/invoices',      label: '开票管理',     expected: 'unclear' },
  { key: 'finance-payments',       path: '/finance/payments',      label: '收款管理',     expected: 'unclear' },
  { key: 'finance-costs',          path: '/finance/costs',         label: '成本分析',     expected: 'unclear' },
  // HR / system — should work for both
  { key: 'hr-employees',           path: '/hr/employees',          label: '员工管理',     expected: 'ok' },
];

async function login(page, username, password, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input');
    const inputs = await page.locator('input').all();
    let u, p;
    for (const inp of inputs) {
      const t = await inp.getAttribute('type');
      if (t === 'password' && !p) p = inp;
      else if (!u && (t === 'text' || !t)) u = inp;
    }
    await u.fill(username);
    await p.fill(password);
    await p.press('Enter');
    await page.waitForTimeout(6000);
    if (!page.url().includes('/login')) return;
    if (i < maxRetries - 1) await page.waitForTimeout(3000);
  }
  throw new Error(`Login failed for ${username}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const consoleErrors = [];
const networkFails = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
page.on('response', resp => {
  const s = resp.status();
  if (s >= 400) networkFails.push(`${s} ${resp.url().slice(0, 160)}`);
});

await login(page, 'restaurant_admin1', '123456');
console.log(`Logged in as restaurant_admin1 (F002). Probing ${PROBES.length} URLs...\n`);

const results = { base: BASE, ts: new Date().toISOString(), tenant: 'restaurant_admin1/F002', probes: [] };

// Capture sidebar menu items (for reference — what IS accessible via nav)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const sidebarItems = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.el-menu-item .el-menu-item-title, .el-menu-item span, .el-sub-menu__title span'))
    .map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 30);
});
results.sidebarItems = sidebarItems;
console.log('Sidebar items observed:', sidebarItems.join(' | '));
console.log();

for (const p of PROBES) {
  consoleErrors.length = 0;
  networkFails.length = 0;
  const t0 = Date.now();
  try {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch { /* continue */ }
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
  await page.waitForTimeout(2500);
  const tLoad = Date.now() - t0;

  const currentUrl = page.url();
  const redirectedToLogin = currentUrl.includes('/login');
  const redirected404 = currentUrl.includes('/404') || currentUrl.includes('/error');

  const signals = await page.evaluate(() => {
    // Is there a table? Empty?
    const tables = Array.from(document.querySelectorAll('.el-table'));
    const totalTableHeight = tables.reduce((s, t) => s + t.getBoundingClientRect().height, 0);
    const emptyTableText = Array.from(document.querySelectorAll('.el-table__empty-text, .el-empty__description'))
      .map(e => (e.textContent || '').trim()).filter(Boolean);

    // Visible text length (rough proxy for page substance)
    const mainText = (document.querySelector('.app-main')?.textContent || '').trim();
    const mainTextLen = mainText.length;

    // Any error/403 block?
    const has403 = mainText.includes('403') || mainText.includes('无权限') || mainText.includes('权限不足');
    const has404 = mainText.includes('404') || mainText.includes('页面不存在');

    // Manufacturing-specific terms visible to restaurant user
    const mfgTerms = ['批次号', 'BOM', '工艺路线', '生产计划', '设备编号', '点检', '维保', '排程', '产线', '工序'].filter(t => mainText.includes(t));

    // Viewport height
    const vh = window.innerHeight;

    return { totalTableHeight, emptyTableText, mainTextLen, has403, has404, mfgTerms, vh };
  });

  const screenshotPath = `${OUT}/${p.key}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const bigEmpty = signals.totalTableHeight > (signals.vh * 0.5) && signals.emptyTableText.some(t => t.includes('暂无'));

  const result = {
    probe: p.label,
    path: p.path,
    expected: p.expected,
    url: currentUrl,
    tLoad,
    redirected: { toLogin: redirectedToLogin, to404: redirected404 },
    mainTextLen: signals.mainTextLen,
    has403: signals.has403,
    has404: signals.has404,
    emptyTableText: signals.emptyTableText.slice(0, 3),
    bigEmptyTable: bigEmpty,
    mfgTerms: signals.mfgTerms,
    consoleErrors: consoleErrors.slice(0, 2),
    networkFails: networkFails.slice(0, 3),
    screenshot: screenshotPath,
  };

  // Assessment
  const issues = [];
  if (p.expected === 'hidden-or-empty') {
    if (!redirectedToLogin && !redirected404 && !signals.has403 && !signals.has404 && signals.mainTextLen > 200) {
      issues.push(`页面未被 gate — 餐饮租户不应看到`);
    }
  }
  if (signals.mfgTerms.length > 0 && !['hidden-or-empty', 'blocked'].includes(p.expected)) {
    issues.push(`manufacturing 术语泄漏: ${signals.mfgTerms.join(',')}`);
  }
  if (bigEmpty) {
    issues.push(`空表格占 >50% 视口 (${Math.round(signals.totalTableHeight)}px / ${signals.vh}px)`);
  }
  if (networkFails.length > 0) {
    const nonHealth = networkFails.filter(f => !f.includes('/health'));
    if (nonHealth.length > 0) issues.push(`network 错误: ${nonHealth[0]}`);
  }
  result.issues = issues;
  result.status = issues.length === 0 ? 'OK' : 'ISSUES';

  results.probes.push(result);

  console.log(`  ${result.status === 'OK' ? '✅' : '⚠️ '} ${p.label.padEnd(12, ' ')} ${p.path.padEnd(34, ' ')} ${result.status}${issues.length ? ' — ' + issues.join('; ') : ''}`);
}

await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
const ok = results.probes.filter(r => r.status === 'OK').length;
const issues = results.probes.filter(r => r.status === 'ISSUES').length;
console.log(`  OK: ${ok} / Issues: ${issues}`);
console.log(`  Output: ${OUT}/results.json + ${PROBES.length} screenshots`);

const problemProbes = results.probes.filter(r => r.status === 'ISSUES');
if (problemProbes.length > 0) {
  console.log('\n  Issues detail:');
  for (const r of problemProbes) {
    console.log(`    ${r.probe} (${r.path})`);
    for (const i of r.issues) console.log(`      - ${i}`);
  }
}
