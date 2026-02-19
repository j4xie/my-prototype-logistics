import { test, Page } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';
const SD = 'test-results/p2-final';

test('P2 Fixes - Complete Test', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Login
  await page.goto(BASE_URL + '/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().fill('factory_admin1');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  console.log('[Login] URL: ' + page.url());

  // Navigate to Finance
  const smartbiMenu = page.getByRole('menuitem', { name: '智能BI' });
  const exp = await smartbiMenu.getAttribute('aria-expanded').catch(() => null);
  if (exp !== 'true') {
    await smartbiMenu.locator('> div').first().click();
    await page.waitForTimeout(1000);
  }
  await page.getByRole('menuitem', { name: '财务数据分析' }).click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  console.log('[Nav] Finance URL: ' + page.url());
  await page.screenshot({ path: SD + '/01-finance-initial.png', fullPage: true });

  // ===== TEST 1: P2-3 Empty chart placeholder =====
  console.log('===== TEST 1: P2-3 Empty chart placeholder =====');

  // Cost Analysis tab (custom card, not el-tabs)
  const costTab = page.locator('div').filter({ hasText: /^成本分析$/ }).first();
  await costTab.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SD + '/02-cost-tab.png', fullPage: true });
  let mc = await page.locator('main').first().textContent().catch(() => '');
  let hasEmpty = mc.includes('暂无');
  let hasCanvas = (await page.locator('canvas').count()) > 0;
  let elEmpty = (await page.locator('.el-empty').count()) > 0;
  console.log('[Cost] emptyText=' + hasEmpty + ' canvas=' + hasCanvas + ' elEmpty=' + elEmpty);
  console.log('[Cost] Content: ' + mc.substring(0, 300));

  // Receivable tab
  const recvTab = page.locator('div').filter({ hasText: /^应收分析$/ }).first();
  await recvTab.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SD + '/03-receivable-tab.png', fullPage: true });
  mc = await page.locator('main').first().textContent().catch(() => '');
  hasEmpty = mc.includes('暂无');
  hasCanvas = (await page.locator('canvas').count()) > 0;
  elEmpty = (await page.locator('.el-empty').count()) > 0;
  console.log('[Receivable] emptyText=' + hasEmpty + ' canvas=' + hasCanvas + ' elEmpty=' + elEmpty);
  console.log('[Receivable] Content: ' + mc.substring(0, 300));

  // Budget tab
  const budgetTab = page.locator('div').filter({ hasText: /^预算分析$/ }).first();
  await budgetTab.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SD + '/04-budget-tab.png', fullPage: true });
  mc = await page.locator('main').first().textContent().catch(() => '');
  hasEmpty = mc.includes('暂无');
  hasCanvas = (await page.locator('canvas').count()) > 0;
  elEmpty = (await page.locator('.el-empty').count()) > 0;
  console.log('[Budget] emptyText=' + hasEmpty + ' canvas=' + hasCanvas + ' elEmpty=' + elEmpty);
  console.log('[Budget] Content: ' + mc.substring(0, 300));

  // ===== TEST 2: P2-5 Warning alerts =====
  console.log('===== TEST 2: P2-5 Warning alerts =====');
  const alerts = page.locator('.el-alert');
  const alertCount = await alerts.count();
  console.log('[Alerts] count: ' + alertCount);
  for (let i = 0; i < alertCount; i++) {
    const txt = await alerts.nth(i).textContent();
    const cls = await alerts.nth(i).getAttribute('class');
    console.log('[Alert ' + i + '] class=' + cls + ' text=' + (txt || '').substring(0, 200));
  }
  await page.screenshot({ path: SD + '/05-alerts.png', fullPage: true });

  // ===== TEST 3: P2-4 Sales page =====
  console.log('===== TEST 3: P2-4 Sales page empty state =====');
  await page.getByRole('menuitem', { name: '销售数据分析' }).click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: SD + '/06-sales.png', fullPage: true });
  const salesContent = await page.locator('main').first().textContent().catch(() => '');
  const hasSalesEmpty = salesContent.includes('暂无系统销售数据');
  const hasSalesAny = salesContent.includes('暂无');
  console.log('[Sales] hasEmptyBanner=' + hasSalesEmpty + ' anyEmpty=' + hasSalesAny);
  console.log('[Sales] Content: ' + salesContent.substring(0, 600));
  const salesAlerts = await page.locator('.el-alert').count();
  const salesElEmpty = await page.locator('.el-empty').count();
  console.log('[Sales] alerts=' + salesAlerts + ' elEmpty=' + salesElEmpty);

  // ===== TEST 4: Profit tab regression =====
  console.log('===== TEST 4: Profit tab regression =====');
  await page.getByRole('menuitem', { name: '财务数据分析' }).click();
  await page.waitForTimeout(3000);
  const profitTab = page.locator('div').filter({ hasText: /^利润分析$/ }).first();
  await profitTab.click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: SD + '/07-profit.png', fullPage: true });
  const profitCanvas = await page.locator('canvas').count();
  const profitElEmpty = await page.locator('.el-empty').count();
  const profitContent = await page.locator('main').first().textContent().catch(() => '');
  const profitHasEmptyMsg = profitContent.includes('暂无图表');
  console.log('[Profit] canvas=' + profitCanvas + ' elEmpty=' + profitElEmpty + ' hasEmptyMsg=' + profitHasEmptyMsg);
  console.log('[Profit] PASS=' + (profitCanvas > 0 && !profitHasEmptyMsg));

  console.log('===== ALL TESTS COMPLETE =====');
  await page.close();
});
