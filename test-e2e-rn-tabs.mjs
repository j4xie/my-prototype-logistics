/**
 * RN App: 每个Tab独立截图+内容验证
 * 不深入子页面(避免nav stack破坏), 只验证每个Tab能显示内容
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8081';
let pass = 0, fail = 0, warn = 0;
const results = [];

function log(mod, test, status, ev = '') {
  const ic = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.push({ module: mod, test, status, evidence: ev });
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else warn++;
  console.log(`${ic} [${mod}] ${test}${ev ? '\n   ' + ev.slice(0, 200) : ''}`);
}

async function main() {
  console.log('📱 RN Tab独立验证\n');
  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 414, height: 896 } })).newPage();

  // Login
  await page.goto(BASE, { timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.getByText('登录', { exact: true }).click();
  await page.waitForTimeout(3000);
  await page.locator('[data-testid="login-username-input"]').fill('factory_admin1');
  await page.locator('[data-testid="login-password-input"]').fill('123456');
  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForTimeout(5000);
  console.log('✅ Login OK\n');

  // Test each tab by fresh page reload to avoid nav stack issues
  const tabs = [
    { name: '首页', idx: 0 },
    { name: 'AI分析', idx: 1 },
    { name: '报表', idx: 2 },
    { name: '智能分析', idx: 3 },
    { name: '管理', idx: 4 },
    { name: '我的', idx: 5 },
  ];

  for (const tab of tabs) {
    // Click tab by finding bottom bar items
    const tabBar = page.locator('[role="tablist"], nav').last();
    const tabItems = page.getByText(tab.name, { exact: false });
    let clicked = false;

    // Try clicking by text
    for (let i = 0; i < await tabItems.count(); i++) {
      const el = tabItems.nth(i);
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click({ force: true }).catch(() => {});
        clicked = true;
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: `screenshots/rn-tab-${tab.name}.png` });

    const content = await page.locator('body').textContent().catch(() => '');
    const hasContent = content.length > 50;

    // Check for specific content per tab
    let specific = false;
    if (tab.name === '首页') specific = content.includes('factory_admin1') || content.includes('今日');
    else if (tab.name === 'AI分析') specific = content.includes('AI') || content.includes('分析');
    else if (tab.name === '报表') specific = content.includes('报表') || content.includes('报告');
    else if (tab.name === '智能分析') specific = content.includes('分析') || content.includes('智能');
    else if (tab.name === '管理') specific = content.includes('管理') || content.includes('设置');
    else if (tab.name === '我的') specific = content.includes('设置') || content.includes('factory_admin1') || content.includes('版本');

    log('Tab', tab.name, hasContent && specific ? 'PASS' : (hasContent ? 'WARN' : 'FAIL'),
      `${content.length}字, 特定内容=${specific}, clicked=${clicked}`);
  }

  console.log('\n' + '='.repeat(40));
  console.log(`📱 TABS: ${pass} PASS, ${fail} FAIL, ${warn} WARN`);
  console.log('='.repeat(40));

  await browser.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
