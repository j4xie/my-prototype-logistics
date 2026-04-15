/**
 * L1 Accessibility Test: 13 Web accounts × 94 routes = 1222 test points
 * + 3 Mobile-only accounts login verification
 *
 * Tests every route for every role against the expected permission matrix.
 * Factory type FACTORY → restaurant module blocked.
 *
 * Usage: node tests/e2e-comprehensive/e2e-L1-accessibility.mjs [--round N]
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import {
  BASE, PASSWORD, ALL_ROUTES, ROUTE_MODULE_MAP,
  PERMISSION_MATRIX, MOBILE_ONLY_ROLES,
  expectedResult, login, checkPage, isPass
} from './lib/helpers.mjs';

const ROUND = process.argv.includes('--round')
  ? parseInt(process.argv[process.argv.indexOf('--round') + 1]) || 1
  : 1;

// Load setup data
const SETUP_FILE = 'tests/e2e-comprehensive/results/R0-setup.json';
if (!existsSync(SETUP_FILE)) {
  console.error('ERROR: Run e2e-R0-setup.mjs first to create test factory + accounts');
  process.exit(1);
}
const setup = JSON.parse(readFileSync(SETUP_FILE, 'utf8'));
const FACTORY_ID = setup.factoryId;
const FACTORY_TYPE = 'FACTORY';

// Build account list from setup
const WEB_ACCOUNTS = setup.accounts
  .filter(a => a.web && a.created && a.loginVerified)
  .map(a => ({ username: a.username, role: a.roleCode }));

const MOBILE_ACCOUNTS = setup.accounts
  .filter(a => !a.web && a.created)
  .map(a => ({ username: a.username, role: a.roleCode }));

console.log('='.repeat(80));
console.log(`L1 ACCESSIBILITY TEST — Round ${ROUND}`);
console.log(`Factory: ${FACTORY_ID} (${FACTORY_TYPE})`);
console.log(`Web accounts: ${WEB_ACCOUNTS.length} | Mobile-only: ${MOBILE_ACCOUNTS.length} | Routes: ${ALL_ROUTES.length}`);
console.log(`Total test points: ${WEB_ACCOUNTS.length * ALL_ROUTES.length + MOBILE_ACCOUNTS.length}`);
console.log('='.repeat(80));

async function testAccount(account, routes) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  // Block Google Fonts (China network)
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

  // Login
  const loginResult = await login(page, account.username);
  if (loginResult === 'LOGIN_FAILED') {
    await browser.close();
    return { account, loginResult, routes: [], consoleErrors: [], networkErrors: [] };
  }

  // Test each route
  const routeResults = [];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const expected = expectedResult(route, account.role, FACTORY_TYPE);
    const actual = await checkPage(page, route, expected);
    const pass = isPass(actual, expected);

    routeResults.push({ route, expected, actual, pass });

    const icon = pass ? 'PASS' : 'FAIL';
    const marker = pass ? '' : ' ← MISMATCH';
    if (!pass || (i + 1) % 20 === 0 || i === routes.length - 1) {
      process.stdout.write(`  [${icon}] ${account.username}:${account.role} (${i+1}/${routes.length}) ${route} → ${actual} (exp: ${expected})${marker}\n`);
    }

    // Re-login if session expired
    if (actual === 'REDIRECT_LOGIN') {
      await login(page, account.username);
    }
  }

  await browser.close();
  return {
    account,
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
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${account.username} (${account.role}) → ${loginResult} (expected: MOBILE_ONLY)`);

  await browser.close();
  return { account, loginResult, expected: 'MOBILE_ONLY', pass };
}

async function run() {
  const allResults = { round: ROUND, timestamp: new Date().toISOString(), factoryId: FACTORY_ID, web: [], mobile: [], summary: {} };

  // Phase 1: Test mobile-only accounts (quick)
  console.log('\n--- MOBILE-ONLY LOGIN TEST ---');
  for (const acct of MOBILE_ACCOUNTS) {
    allResults.mobile.push(await testMobileAccount(acct));
  }

  // Phase 2: Test each web account against all routes
  for (const acct of WEB_ACCOUNTS) {
    console.log(`\n--- ${acct.username} (${acct.role}) ---`);
    const result = await testAccount(acct, ALL_ROUTES);
    allResults.web.push(result);

    // Quick summary per account
    const passed = result.routes.filter(r => r.pass).length;
    const failed = result.routes.filter(r => !r.pass).length;
    console.log(`  Summary: ${passed}/${result.routes.length} PASS | ${failed} FAIL | Console: ${result.consoleErrors.length} | Network: ${result.networkErrors.length}`);
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

  allResults.summary = {
    totalPoints,
    totalPass,
    totalFail,
    passRate: totalPoints > 0 ? ((totalPass / totalPoints) * 100).toFixed(1) + '%' : '0%',
    mobilePass: `${mobilePass}/${allResults.mobile.length}`,
    consoleErrors: allConsoleErrors.size,
    networkErrors: allNetworkErrors.size,
    failDetails,
  };

  // Print report
  console.log('\n' + '='.repeat(80));
  console.log(`L1 ACCESSIBILITY — ROUND ${ROUND} SUMMARY`);
  console.log('='.repeat(80));
  console.log(`Factory: ${FACTORY_ID} (${FACTORY_TYPE})`);
  console.log(`Total: ${totalPass}/${totalPoints} PASS (${allResults.summary.passRate})`);
  console.log(`Mobile-only: ${mobilePass}/${allResults.mobile.length} correctly redirected`);
  console.log(`Console errors: ${allConsoleErrors.size} unique`);
  console.log(`Network errors: ${allNetworkErrors.size} unique`);

  if (failDetails.length > 0) {
    console.log(`\n--- FAILURES (${failDetails.length}) ---`);
    for (const f of failDetails) {
      console.log(`  ${f.account}(${f.role}) ${f.route}: expected=${f.expected} actual=${f.actual}`);
    }
  }

  if (allConsoleErrors.size > 0) {
    console.log('\n--- CONSOLE ERRORS ---');
    [...allConsoleErrors].forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }
  if (allNetworkErrors.size > 0) {
    console.log('\n--- NETWORK ERRORS ---');
    [...allNetworkErrors].forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }

  // Permission matrix printout
  console.log('\n--- PERMISSION MATRIX (actual vs expected) ---');
  const modules = ['dashboard','production','warehouse','quality','procurement','sales','hr','equipment','finance','system','analytics','scheduling','restaurant'];
  const hdr = 'Role'.padEnd(25) + modules.map(m => m.substring(0,5).padEnd(7)).join('');
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const w of allResults.web) {
    const moduleResults = {};
    for (const r of w.routes) {
      const mod = ROUTE_MODULE_MAP[r.route];
      if (mod && mod !== '__roles__') {
        if (!moduleResults[mod]) moduleResults[mod] = { pass: 0, fail: 0 };
        if (r.pass) moduleResults[mod].pass++; else moduleResults[mod].fail++;
      }
    }
    const cells = modules.map(m => {
      const mr = moduleResults[m];
      if (!mr) return '  -  '.padEnd(7);
      if (mr.fail === 0) return '  ✓  '.padEnd(7);
      return ` ${mr.fail}F `.padEnd(7);
    });
    console.log(`${w.account.role.padEnd(25)}${cells.join('')}`);
  }

  // Save results
  const outFile = `tests/e2e-comprehensive/results/e2e-L1-R${ROUND}.json`;
  writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\nResults → ${outFile}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
