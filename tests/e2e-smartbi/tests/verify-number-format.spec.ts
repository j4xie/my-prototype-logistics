import { test, expect } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';

test.describe('SmartBI Number Formatting Verification', () => {
  test.setTimeout(180000);

  test('Verify number formatting on Dashboard, Finance, Sales pages', async ({ page }) => {
    console.log('=== STEP: Login ===');
    await page.goto(BASE_URL + '/login');
    await page.waitForSelector('form, .login-container', { timeout: 15000 });
    
    await page.fill('input[placeholder="\u8bf7\u8f93\u5165\u7528\u6237\u540d"]', 'factory_admin1');
    await page.fill('input[placeholder="\u8bf7\u8f93\u5165\u5bc6\u7801"]', '123456');
    await page.click('button:has-text("\u767b \u5f55")');
    
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('Login OK, URL:', page.url());

    console.log('--- TEST 1: Dashboard KPI ---');
    await page.goto(BASE_URL + '/smart-bi/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'test-results/dashboard-kpi.png', fullPage: false });

    const dashBody = await page.locator('body').textContent();
    const dashClean = (dashBody || '').replace(/\s+/g, ' ').trim();
    console.log('Dashboard body text (4000 chars):');
    console.log(dashClean.substring(0, 4000));

    const dashCards = await page.locator('.el-card').allTextContents();
    console.log('Dashboard .el-card elements:');
    for (let i = 0; i < dashCards.length; i++) {
      const t = dashCards[i].replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 1000) console.log('  [CARD ' + i + ']: ' + t);
    }

    await page.screenshot({ path: 'test-results/dashboard-full.png', fullPage: true });

    console.log('--- TEST 2: Finance KPI ---');
    await page.goto(BASE_URL + '/smart-bi/finance');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'test-results/finance-profit-kpi.png', fullPage: false });

    const finBody = await page.locator('body').textContent();
    const finClean = (finBody || '').replace(/\s+/g, ' ').trim();
    console.log('Finance body text (4000 chars):');
    console.log(finClean.substring(0, 4000));

    const finCards = await page.locator('.el-card').allTextContents();
    console.log('Finance .el-card elements:');
    for (let i = 0; i < finCards.length; i++) {
      const t = finCards[i].replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 1000) console.log('  [CARD ' + i + ']: ' + t);
    }

    const costTab = page.getByText('\u6210\u672c\u5206\u6790').first();
    if (await costTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking cost analysis tab...');
      await costTab.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/finance-cost-kpi.png', fullPage: false });
      const costCards = await page.locator('.el-card').allTextContents();
      console.log('Cost Tab .el-card elements:');
      for (let i = 0; i < costCards.length; i++) {
        const t = costCards[i].replace(/\s+/g, ' ').trim();
        if (t.length > 2 && t.length < 1000) console.log('  [CARD ' + i + ']: ' + t);
      }
    }

    await page.screenshot({ path: 'test-results/finance-full.png', fullPage: true });

    console.log('--- TEST 3: Sales KPI ---');
    await page.goto(BASE_URL + '/smart-bi/sales');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'test-results/sales-kpi.png', fullPage: false });

    const salesBody = await page.locator('body').textContent();
    const salesClean = (salesBody || '').replace(/\s+/g, ' ').trim();
    console.log('Sales body text (4000 chars):');
    console.log(salesClean.substring(0, 4000));

    const salesCards = await page.locator('.el-card').allTextContents();
    console.log('Sales .el-card elements:');
    for (let i = 0; i < salesCards.length; i++) {
      const t = salesCards[i].replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 1000) console.log('  [CARD ' + i + ']: ' + t);
    }

    await page.screenshot({ path: 'test-results/sales-full.png', fullPage: true });

    console.log('=== ALL TESTS COMPLETE ===');
  });
});
