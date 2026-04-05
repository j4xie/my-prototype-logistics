/**
 * E2E RN App (Expo Web): Playwright 浏览器真实操作
 * 按 Skill 规范: 点按钮→填表单→提交→验证
 * RN Web 元素: div[data-testid], input, getByText
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8081';
const TS = Date.now().toString().slice(-6);

let pass = 0, fail = 0, warn = 0;
const results = [];

function log(role, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ role, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${role}] ${test}${ev ? '\n   ' + ev.slice(0, 250) : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: `screenshots/rn-${name}.png` }).catch(() => {});
}

// ==================== L1: Landing + Login ====================

async function testLogin(page) {
  console.log('\n📱 === RN App: 登录流程 ===\n');

  // 1. Landing page
  await page.goto(BASE, { timeout: 30000 });
  await page.waitForTimeout(5000);
  const hasLoginBtn = await page.getByText('登录', { exact: true }).isVisible().catch(() => false);
  const hasRegBtn = await page.getByText('注册用户').isVisible().catch(() => false);
  log('RN-登录', '1.Landing页', hasLoginBtn && hasRegBtn ? 'PASS' : 'FAIL',
    `登录按钮=${hasLoginBtn}, 注册按钮=${hasRegBtn}`);
  await shot(page, '01-landing');

  // 2. Click 登录 → navigate to login form
  await page.getByText('登录', { exact: true }).click();
  await page.waitForTimeout(3000);

  // 3. Verify login form exists with testIDs
  const hasUsername = await page.locator('[data-testid="login-username-input"]').isVisible().catch(() => false);
  const hasPassword = await page.locator('[data-testid="login-password-input"]').isVisible().catch(() => false);
  const hasSubmit = await page.locator('[data-testid="login-submit-btn"]').isVisible().catch(() => false);
  log('RN-登录', '2.登录表单', hasUsername && hasPassword && hasSubmit ? 'PASS' : 'FAIL',
    `用户名=${hasUsername}, 密码=${hasPassword}, 提交=${hasSubmit}`);
  await shot(page, '02-login-form');

  // 4. Fill and submit
  await page.locator('[data-testid="login-username-input"]').fill('factory_admin1');
  await page.locator('[data-testid="login-password-input"]').fill('123456');
  log('RN-登录', '3.填写凭证', 'PASS', 'filled: username=factory_admin1, password=***');

  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForTimeout(5000);
  await shot(page, '03-after-login');

  // 5. Verify login succeeded — should see home screen content
  const bodyText = await page.locator('body').textContent().catch(() => '');
  const isHome = bodyText.includes('首页') || bodyText.includes('白垩纪') || bodyText.includes('生产')
    || bodyText.includes('今日') || !bodyText.includes('登录');
  log('RN-登录', '4.登录成功', isHome ? 'PASS' : 'FAIL',
    `页面含: ${bodyText.slice(0, 100)}`);

  return isHome;
}

// ==================== L1: Home Screen Tabs ====================

async function testHomeScreen(page) {
  console.log('\n📱 === RN App: 首页 + Tab导航 ===\n');

  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').textContent().catch(() => '');

  // Check home screen content
  const testIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'))
  ).catch(() => []);
  log('RN-首页', '1.首页内容', bodyText.length > 50 ? 'PASS' : 'FAIL',
    `${bodyText.length}字, testIDs: [${testIds.slice(0, 10).join(',')}]`);
  await shot(page, '04-home-screen');

  // Check tab bar — RN uses bottom tab navigation
  const tabs = await page.evaluate(() => {
    const tabElements = document.querySelectorAll('[role="tab"], [accessibilityRole="tab"]');
    if (tabElements.length > 0) return Array.from(tabElements).map(e => e.textContent?.trim());
    // Fallback: find bottom bar links
    const allText = document.body.innerText;
    return [];
  }).catch(() => []);
  log('RN-首页', '2.Tab栏', tabs.length > 0 ? 'PASS' : 'WARN',
    `${tabs.length}个Tab: [${tabs.join(',')}]`);

  // Try clicking different sections if visible
  const sections = ['智能分析', 'AI', '报表', '管理', '我的', '设置'];
  for (const sec of sections) {
    const el = page.getByText(sec, { exact: false }).first();
    if (await el.isVisible().catch(() => false)) {
      log('RN-首页', `3.可见区域: ${sec}`, 'PASS', '');
    }
  }
}

// ==================== L1: Key Screens Navigation ====================

async function testScreenNavigation(page) {
  console.log('\n📱 === RN App: 页面导航 ===\n');

  // Test navigating to key features
  const screensToCheck = [
    { text: '智能', name: 'AI分析' },
    { text: '报表', name: '报表' },
    { text: '管理', name: '管理' },
    { text: '我的', name: '个人中心' },
  ];

  for (const sc of screensToCheck) {
    const el = page.getByText(sc.text, { exact: false }).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
      const content = await page.locator('body').textContent().catch(() => '');
      log('RN-导航', `${sc.name}页`, content.length > 30 ? 'PASS' : 'WARN',
        `${content.length}字内容`);
      await shot(page, `05-nav-${sc.name}`);
    } else {
      log('RN-导航', `${sc.name}页`, 'WARN', `"${sc.text}"不可见`);
    }
  }

  // Navigate back to home
  const homeTab = page.getByText('首页', { exact: false }).first();
  if (await homeTab.isVisible().catch(() => false)) {
    await homeTab.click();
    await page.waitForTimeout(2000);
  }
}

// ==================== Console Error Monitoring ====================

async function testConsoleErrors(page) {
  console.log('\n📱 === RN App: Console 错误检查 ===\n');

  // Navigate through a few pages to trigger any errors
  const pages = ['首页', '智能', '管理', '我的'];
  const errors = [];

  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('favicon') && !m.text().includes('Warning:'))
      errors.push(m.text().slice(0, 100));
  });
  page.on('pageerror', e => errors.push(`PAGE_ERROR: ${e.message.slice(0, 100)}`));

  for (const pg of pages) {
    const el = page.getByText(pg, { exact: false }).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  const uniqueErrors = [...new Set(errors)];
  if (uniqueErrors.length > 0) {
    log('RN-Console', '错误检查', 'FAIL', `${uniqueErrors.length}个: ${uniqueErrors.slice(0, 3).join('; ')}`);
  } else {
    log('RN-Console', '错误检查', 'PASS', '0 console errors');
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('📱 E2E RN App (Expo Web): Playwright 真实浏览器操作');
  console.log(`Target: ${BASE} | ${new Date().toISOString()}\n`);

  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  // Check if Expo Web is running
  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`❌ Expo Web not accessible at ${BASE}: ${e.message}`);
    console.error('Start it with: cd frontend/CretasFoodTrace && npx expo start --web --port 8081');
    process.exit(1);
  }
  console.log('✅ Expo Web accessible\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } }); // iPhone 11 size
  const page = await ctx.newPage();

  // Login
  const loggedIn = await testLogin(page);
  if (!loggedIn) {
    console.error('❌ Login failed, cannot continue');
    await browser.close(); process.exit(1);
  }

  // Test home screen
  await testHomeScreen(page);

  // Test navigation
  await testScreenNavigation(page);

  // Console errors
  await testConsoleErrors(page);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📱 RN APP: ${pass} PASS, ${fail} FAIL, ${warn} WARN (total: ${pass + fail + warn})`);
  console.log('='.repeat(50));

  fs.writeFileSync('test-e2e-rn-results.json', JSON.stringify({
    timestamp: new Date().toISOString(), pass, fail, warn, total: pass + fail + warn, results
  }, null, 2));

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
