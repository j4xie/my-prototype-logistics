/**
 * L1 Fast Accessibility Test
 * - factory_super_admin: ALL 94 routes (full coverage)
 * - All other web accounts: 1 representative route per module (permission matrix validation)
 * - Mobile-only accounts: login redirect check
 *
 * ~25 min instead of ~90 min for the full matrix
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import {
  BASE, PASSWORD, ALL_ROUTES, ROUTE_MODULE_MAP,
  PERMISSION_MATRIX, MOBILE_ONLY_ROLES, FACTORY_TYPE_FILTER,
  FINANCE_MANAGER_WHITELIST, CANVAS_EDITOR_ROLES,
  expectedResult, login, checkPage, isPass
} from './lib/helpers.mjs';

const ROUND = process.argv.includes('--round')
  ? parseInt(process.argv[process.argv.indexOf('--round') + 1]) || 1
  : 1;

const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
if (!existsSync(SETUP_FILE)) { console.error('Run R0 setup first'); process.exit(1); }
const setup = JSON.parse(readFileSync(SETUP_FILE, 'utf8'));
const FACTORY_ID = setup.factoryId;
const FACTORY_TYPE = 'FACTORY';

// One representative route per module for quick permission matrix check
const MODULE_SAMPLES = {
  dashboard: '/dashboard',
  production: '/production/batches',
  warehouse: '/warehouse/materials',
  quality: '/quality/inspections',
  procurement: '/procurement/orders',
  sales: '/sales/orders',
  hr: '/hr/employees',
  equipment: '/equipment/list',
  finance: '/finance/costs',
  system: '/system/users',
  analytics: '/analytics/overview',
  scheduling: '/scheduling/overview',
  restaurant: '/restaurant/requisitions',
};
// Add smart-bi and canvas for targeted checks
const EXTRA_CHECKS = [
  '/smart-bi/dashboard',
  '/smart-bi/finance',
  '/canvas-editor',
];

const QUICK_ROUTES = [...Object.values(MODULE_SAMPLES), ...EXTRA_CHECKS];

const WEB_ACCOUNTS = setup.accounts.filter(a => a.web && a.created && a.loginVerified);
const MOBILE_ACCOUNTS = setup.accounts.filter(a => !a.web && a.created);

// Split: factory_admin gets ALL routes, others get QUICK_ROUTES
const ADMIN_ACCT = WEB_ACCOUNTS.find(a => a.roleCode === 'factory_super_admin');
const OTHER_ACCTS = WEB_ACCOUNTS.filter(a => a.roleCode !== 'factory_super_admin');

const totalPoints = ALL_ROUTES.length + OTHER_ACCTS.length * QUICK_ROUTES.length + MOBILE_ACCOUNTS.length;

console.log('='.repeat(80));
console.log(`L1 FAST ACCESSIBILITY TEST — Round ${ROUND}`);
console.log(`Factory: ${FACTORY_ID} (${FACTORY_TYPE})`);
console.log(`Admin (${ADMIN_ACCT?.username}): ${ALL_ROUTES.length} routes`);
console.log(`Others (${OTHER_ACCTS.length} accounts): ${QUICK_ROUTES.length} routes each = ${OTHER_ACCTS.length * QUICK_ROUTES.length}`);
console.log(`Mobile-only: ${MOBILE_ACCOUNTS.length} | Total: ${totalPoints}`);
console.log('='.repeat(80));

async function testAccountRoutes(account, routes) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.route('**fonts.googleapis.com**', route => route.fulfill({ status: 200, body: '' }));
  await context.route('**fonts.gstatic.com**', route => route.fulfill({ status: 200, body: '' }));
  const page = await context.newPage();

  const consoleErrors = new Set();
  const networkErrors = new Set();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.add(msg.text().substring(0, 150)); });
  page.on('response', r => {
    if (r.status() >= 400 && !r.url().includes('.map') && !r.url().includes('favicon') && !r.url().includes('sockjs'))
      networkErrors.add(`${r.status()} ${r.url().replace(BASE, '').split('?')[0]}`);
  });

  const loginResult = await login(page, account.username);
  if (loginResult !== 'OK') {
    console.log(`  [FAIL] ${account.username} LOGIN ${loginResult}`);
    await browser.close();
    return { account: { username: account.username, role: account.roleCode }, loginResult, routes: [], consoleErrors: [], networkErrors: [] };
  }

  const routeResults = [];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const expected = expectedResult(route, account.roleCode, FACTORY_TYPE);
    const actual = await checkPage(page, route, expected);
    const pass = isPass(actual, expected);

    routeResults.push({ route, expected, actual, pass });

    const icon = pass ? 'PASS' : 'FAIL';
    const marker = pass ? '' : ' ← MISMATCH';
    // Print all FAILs, and periodic PASS progress
    if (!pass || i === routes.length - 1 || (i + 1) % 20 === 0) {
      console.log(`  [${icon}] ${account.roleCode} (${i+1}/${routes.length}) ${route} → ${actual} (exp: ${expected})${marker}`);
    }

    if (actual === 'REDIRECT_LOGIN') {
      await login(page, account.username);
    }
  }

  await browser.close();
  return {
    account: { username: account.username, role: account.roleCode },
    loginResult,
    routes: routeResults,
    consoleErrors: [...consoleErrors],
    networkErrors: [...networkErrors],
  };
}

async function testMobileAccount(account) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.route('**fonts.googleapis.com**', route => route.fulfill({ status: 200, body: '' }));
  await context.route('**fonts.gstatic.com**', route => route.fulfill({ status: 200, body: '' }));
  const page = await context.newPage();
  const loginResult = await login(page, account.username);
  const pass = loginResult === 'MOBILE_ONLY';
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${account.username} (${account.roleCode}) → ${loginResult}`);
  await browser.close();
  return { account: { username: account.username, role: account.roleCode }, loginResult, expected: 'MOBILE_ONLY', pass };
}

async function run() {
  const allResults = { round: ROUND, timestamp: new Date().toISOString(), factoryId: FACTORY_ID, web: [], mobile: [], summary: {} };
  const startTime = Date.now();

  // Phase 1: Mobile-only
  console.log('\n--- MOBILE-ONLY LOGIN TEST ---');
  for (const acct of MOBILE_ACCOUNTS) {
    allResults.mobile.push(await testMobileAccount(acct));
  }

  // Phase 2: Factory admin — ALL 94 routes
  console.log(`\n--- ${ADMIN_ACCT.username} (${ADMIN_ACCT.roleCode}) — ALL ${ALL_ROUTES.length} ROUTES ---`);
  allResults.web.push(await testAccountRoutes(ADMIN_ACCT, ALL_ROUTES));

  // Phase 3: Other accounts — QUICK_ROUTES only
  for (const acct of OTHER_ACCTS) {
    console.log(`\n--- ${acct.username} (${acct.roleCode}) — ${QUICK_ROUTES.length} SAMPLE ROUTES ---`);
    allResults.web.push(await testAccountRoutes(acct, QUICK_ROUTES));
  }

  // ===== AGGREGATE SUMMARY =====
  let totalPoints = 0, totalPass = 0, totalFail = 0;
  const failDetails = [];
  const allConsoleErrors = new Set();
  const allNetworkErrors = new Set();

  for (const w of allResults.web) {
    for (const r of w.routes) {
      totalPoints++;
      if (r.pass) totalPass++;
      else {
        totalFail++;
        failDetails.push({ account: w.account.username, role: w.account.role, route: r.route, expected: r.expected, actual: r.actual });
      }
    }
    w.consoleErrors.forEach(e => allConsoleErrors.add(e));
    w.networkErrors.forEach(e => allNetworkErrors.add(e));
  }

  const mobilePass = allResults.mobile.filter(m => m.pass).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  allResults.summary = {
    totalPoints, totalPass, totalFail,
    passRate: totalPoints > 0 ? ((totalPass / totalPoints) * 100).toFixed(1) + '%' : '0%',
    mobilePass: `${mobilePass}/${allResults.mobile.length}`,
    consoleErrors: allConsoleErrors.size,
    networkErrors: allNetworkErrors.size,
    elapsedSeconds: elapsed,
    failDetails,
  };

  // Print report
  console.log('\n' + '='.repeat(80));
  console.log(`L1 FAST — ROUND ${ROUND} SUMMARY (${elapsed}s elapsed)`);
  console.log('='.repeat(80));
  console.log(`Factory: ${FACTORY_ID} (${FACTORY_TYPE})`);
  console.log(`Total: ${totalPass}/${totalPoints} PASS (${allResults.summary.passRate}) | ${totalFail} FAIL`);
  console.log(`Mobile-only: ${mobilePass}/${allResults.mobile.length} correctly redirected`);
  console.log(`Console errors: ${allConsoleErrors.size} | Network errors: ${allNetworkErrors.size}`);

  if (failDetails.length > 0) {
    console.log(`\n--- FAILURES (${failDetails.length}) ---`);
    for (const f of failDetails) {
      console.log(`  ${f.role.padEnd(22)} ${f.route.padEnd(35)} exp=${f.expected.padEnd(15)} actual=${f.actual}`);
    }
  }

  // Permission matrix
  console.log('\n--- PERMISSION MATRIX (per module: ✓=all pass, NF=N fails) ---');
  const modules = Object.keys(MODULE_SAMPLES);
  const hdr = 'Role'.padEnd(22) + modules.map(m => m.substring(0,6).padEnd(8)).join('') + 'canvas';
  console.log(hdr);
  console.log('-'.repeat(hdr.length + 8));
  for (const w of allResults.web) {
    const modResults = {};
    for (const r of w.routes) {
      const mod = ROUTE_MODULE_MAP[r.route] || (r.route === '/canvas-editor' ? 'canvas' : null);
      if (mod) {
        if (!modResults[mod]) modResults[mod] = { pass: 0, fail: 0 };
        if (r.pass) modResults[mod].pass++; else modResults[mod].fail++;
      }
    }
    const cells = [...modules, 'canvas'].map(m => {
      const mr = modResults[m === 'canvas' ? 'canvas' : m] || modResults['__roles__'];
      if (!mr && m === 'canvas') {
        const canvasR = w.routes.find(r => r.route === '/canvas-editor');
        return canvasR ? (canvasR.pass ? '  ✓  ' : ' FAIL ') : '  -  ';
      }
      if (!mr) return '  -  '.padEnd(8);
      if (mr.fail === 0) return '  ✓  '.padEnd(8);
      return ` ${mr.fail}F `.padEnd(8);
    });
    console.log(`${w.account.role.padEnd(22)}${cells.join('')}`);
  }

  if (allNetworkErrors.size > 0) {
    console.log('\n--- NETWORK ERRORS ---');
    [...allNetworkErrors].slice(0, 20).forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }

  const outFile = `tests/e2e-comprehensive/results/e2e-L1-R${ROUND}.json`;
  writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\nResults → ${outFile}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
