import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';
const SCREENSHOT_DIR = 'test-results/p2-fixes';

async function login(page: Page) {
  await page.goto(BASE_URL + '/login');
  await page.waitForLoadState('networkidle');
  const usernameInput = page.locator('input').first();
  const passwordInput = page.locator('input[type="password"]').first();
  await usernameInput.fill('factory_admin1');
  await passwordInput.fill('123456');
  const loginBtn = page.getByRole('button', { name: '登 录' });
  await loginBtn.click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  console.log('[Login] Current URL: ' + page.url());
}

async function navigateToFinance(page: Page) {
  // Expand SmartBI menu if not already expanded
  const smartbiMenu = page.getByRole('menuitem', { name: '智能BI' });
  const isExpanded = await smartbiMenu.getAttribute('aria-expanded').catch(() => null);
  if (isExpanded !== 'true') {
    await smartbiMenu.locator('> div').first().click();
    await page.waitForTimeout(1000);
  }
  const financeMenu = page.getByRole('menuitem', { name: '财务数据分析' });
  await financeMenu.click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
  console.log('[Nav] Navigated to Finance. URL: ' + page.url());
}

async function navigateToSales(page: Page) {
  // Expand SmartBI menu if not already expanded
  const smartbiMenu2 = page.getByRole('menuitem', { name: '智能BI' });
  const isExpanded2 = await smartbiMenu2.getAttribute('aria-expanded').catch(() => null);
  if (isExpanded2 !== 'true') {
    await smartbiMenu2.locator('> div').first().click();
    await page.waitForTimeout(1000);
  }
  const salesMenu = page.getByRole('menuitem', { name: '销售数据分析' });
  await salesMenu.click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
  console.log('[Nav] Navigated to Sales. URL: ' + page.url());
}

test.describe('P2 Fixes Verification', () => {
  test('All P2 checks', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await login(page);
    await page.screenshot({ path: SCREENSHOT_DIR + '/00-after-login.png', fullPage: true });

    // NAVIGATE TO FINANCE
    await navigateToFinance(page);
    await page.screenshot({ path: SCREENSHOT_DIR + '/01-finance-initial.png', fullPage: true });

    // TEST 1: Empty chart placeholder
    console.log('=== TEST 1: Finance - empty chart placeholder (P2-3) ===');
    const allTabs = page.locator('.el-tabs__item');
    const tabTexts = await allTabs.allTextContents();
    console.log('[Finance] Available tabs: ' + tabTexts.join(' | '));

    // Cost tab
    const costTab = page.locator('.el-tabs__item').filter({ hasText: '成本' }).first();
    if (await costTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await costTab.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: SCREENSHOT_DIR + '/02-cost-tab.png', fullPage: true });
      const bodyText = await page.locator('body').textContent() || '';
      const hasEmptyMsg = bodyText.includes('\u6682\u65E0');
      const canvasCount = await page.locator('canvas').count();
      const elEmptyCount = await page.locator('.el-empty').count();
      console.log('[Cost] empty msg=' + hasEmptyMsg + ' canvas=' + canvasCount + ' el-empty=' + elEmptyCount);
    } else {
      console.log('[Cost] Tab NOT FOUND');
    }

    // Receivable tab
    const receivableTab = page.locator('.el-tabs__item').filter({ hasText: '应收' }).first();
    if (await receivableTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await receivableTab.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: SCREENSHOT_DIR + '/03-receivable-tab.png', fullPage: true });
      const bodyText = await page.locator('body').textContent() || '';
      const hasEmptyMsg = bodyText.includes('\u6682\u65E0');
      const canvasCount = await page.locator('canvas').count();
      console.log('[Receivable] empty msg=' + hasEmptyMsg + ' canvas=' + canvasCount);
    } else {
      console.log('[Receivable] Tab NOT FOUND');
    }

    // Budget tab
    const budgetTab = page.locator('.el-tabs__item').filter({ hasText: '预算' }).first();
    if (await budgetTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await budgetTab.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: SCREENSHOT_DIR + '/04-budget-tab.png', fullPage: true });
      const bodyText = await page.locator('body').textContent() || '';
      const hasEmptyMsg = bodyText.includes('\u6682\u65E0');
      const canvasCount = await page.locator('canvas').count();
      console.log('[Budget] empty msg=' + hasEmptyMsg + ' canvas=' + canvasCount);
    } else {
      console.log('[Budget] Tab NOT FOUND');
    }

    // TEST 2: Warning alert
    console.log('=== TEST 2: Finance - data quality warning (P2-5) ===');
    const alertElements = page.locator('.el-alert');
    const alertCount = await alertElements.count();
    console.log('[Warning] el-alert count: ' + alertCount);
    for (let i = 0; i < alertCount; i++) {
      const alertText = await alertElements.nth(i).textContent();
      console.log('[Warning] Alert ' + i + ': ' + (alertText || '').substring(0, 200));
    }
    await page.screenshot({ path: SCREENSHOT_DIR + '/05-warning-alerts.png', fullPage: true });

    // TEST 3: Sales page
    console.log('=== TEST 3: Sales page - empty state (P2-4) ===');
    await navigateToSales(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SCREENSHOT_DIR + '/06-sales-page.png', fullPage: true });
    const salesBody = await page.locator('body').textContent() || '';
    const hasSalesBanner = salesBody.includes('\u6682\u65E0') || salesBody.includes('\u9500\u552E\u6570\u636E');
    console.log('[Sales] Has empty/data banner: ' + hasSalesBanner);
    const kpiCount = await page.locator('.kpi-card, .stat-card, .el-statistic').count();
    console.log('[Sales] KPI cards: ' + kpiCount);

    // TEST 4: Profit tab regression
    console.log('=== TEST 4: Profit tab regression ===');
    await navigateToFinance(page);
    await page.waitForTimeout(2000);
    const profitTab = page.locator('.el-tabs__item').filter({ hasText: '利润' }).first();
    if (await profitTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profitTab.click();
    }
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SCREENSHOT_DIR + '/07-profit-tab.png', fullPage: true });
    const canvasOnProfit = await page.locator('canvas').count();
    const emptyOnProfit = await page.locator('.el-empty').count();
    console.log('[Profit] canvas=' + canvasOnProfit + ' el-empty=' + emptyOnProfit);
    await page.screenshot({ path: SCREENSHOT_DIR + '/08-final.png', fullPage: true });

    console.log('=== ALL TESTS COMPLETE ===');
    await page.close();
  });
});
