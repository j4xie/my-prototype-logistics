import { test, expect, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('C:/Users/Steve/my-prototype-logistics/screenshots');

const BASE_URL = 'http://localhost:5173';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);

  // Fill login form
  const usernameInput = page.locator('input[type="text"], input[placeholder*="用户名"], input[placeholder*="username"], input[placeholder*="账号"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await usernameInput.fill(USERNAME);
  await passwordInput.fill(PASSWORD);
  await page.waitForTimeout(500);

  // Click login button
  const loginBtn = page.locator('button').filter({ hasText: /登录|Login|登 录/ }).first();
  await loginBtn.click();

  // Wait for navigation
  await page.waitForTimeout(3000);
  await page.waitForURL(/.*(?!.*login).*/, { timeout: 15000 }).catch(() => {});
}

test.describe('Sales Analysis Page - Phase 6 QA', () => {

  test('Full Sales Analysis Page Verification', async ({ page }) => {
    // Increase viewport for better screenshots
    await page.setViewportSize({ width: 1920, height: 1080 });

    // STEP 1: Login
    await login(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-01-after-login.png'), fullPage: false });
    console.log('STEP 1: Login completed');

    // STEP 2: Navigate to Sales Analysis
    // First try direct URL navigation
    await page.goto(`${BASE_URL}/smart-bi/sales`);
    await page.waitForTimeout(3000);

    // Check if we got redirected to login
    if (page.url().includes('login')) {
      console.log('Redirected to login, re-authenticating...');
      await login(page);
      await page.goto(`${BASE_URL}/smart-bi/sales`);
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-02-sales-page.png'), fullPage: false });
    console.log('STEP 2: Navigated to Sales Analysis page');

    // STEP 3: Wait for data to load
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-03-loaded.png'), fullPage: false });
    console.log('STEP 3: Page loaded with data');

    // STEP 4: Check page elements
    const pageTitle = await page.locator('h1').first().textContent().catch(() => '');
    console.log(`Page title: "${pageTitle}"`);

    // Check for KPI cards
    const kpiCards = page.locator('.kpi-card');
    const kpiCount = await kpiCards.count();
    console.log(`KPI cards found: ${kpiCount}`);

    // Check for "暂无 KPI 数据" empty state
    const emptyKpi = page.locator('text=暂无 KPI 数据');
    const hasEmptyKpi = await emptyKpi.isVisible().catch(() => false);
    console.log(`KPI empty state visible: ${hasEmptyKpi}`);

    // Check for trend chart
    const trendSection = page.locator('text=销售趋势').first();
    const hasTrendLabel = await trendSection.isVisible().catch(() => false);
    console.log(`Trend chart section visible: ${hasTrendLabel}`);

    // Check for the legacy or dynamic trend chart
    const trendChart = page.locator('#sales-trend-chart, .dynamic-chart-renderer').first();
    const hasTrendChart = await trendChart.isVisible().catch(() => false);
    console.log(`Trend chart element visible: ${hasTrendChart}`);

    // Check for "暂无趋势数据" empty state in trend chart
    const emptyTrend = page.locator('text=暂无趋势数据');
    const hasEmptyTrend = await emptyTrend.isVisible().catch(() => false);
    console.log(`Trend empty state visible: ${hasEmptyTrend}`);

    // Check for pie chart
    const pieSection = page.locator('text=产品类别销售占比').first();
    const hasPieLabel = await pieSection.isVisible().catch(() => false);
    console.log(`Pie chart section visible: ${hasPieLabel}`);

    const pieChart = page.locator('#sales-pie-chart, .pie-chart-container, .dynamic-chart-renderer').first();
    const hasPieChart = await pieChart.isVisible().catch(() => false);
    console.log(`Pie chart element visible: ${hasPieChart}`);

    // Check for "暂无产品分布数据" empty state
    const emptyPie = page.locator('text=暂无产品分布数据');
    const hasEmptyPie = await emptyPie.isVisible().catch(() => false);
    console.log(`Pie empty state visible: ${hasEmptyPie}`);

    // Check ranking section
    const rankingSection = page.locator('text=销售员排行榜').first();
    const hasRanking = await rankingSection.isVisible().catch(() => false);
    console.log(`Ranking section visible: ${hasRanking}`);

    // Check for filter bar with data source selector
    const dataSourceLabel = page.locator('text=数据源').first();
    const hasDataSourceLabel = await dataSourceLabel.isVisible().catch(() => false);
    console.log(`Data source label visible: ${hasDataSourceLabel}`);

    const filterCard = page.locator('.filter-card');
    const hasFilterCard = await filterCard.isVisible().catch(() => false);
    console.log(`Filter card visible: ${hasFilterCard}`);

    // Check date range picker
    const datePicker = page.locator('.el-date-editor, .el-range-editor').first();
    const hasDatePicker = await datePicker.isVisible().catch(() => false);
    console.log(`Date range picker visible: ${hasDatePicker}`);

    // Check dimension radio buttons
    const dimensionRadio = page.locator('text=按日').first();
    const hasDimensionRadio = await dimensionRadio.isVisible().catch(() => false);
    console.log(`Dimension radio visible: ${hasDimensionRadio}`);

    // Check category filter
    const categoryFilter = page.locator('text=产品类别').first();
    const hasCategoryFilter = await categoryFilter.isVisible().catch(() => false);
    console.log(`Category filter visible: ${hasCategoryFilter}`);

    // STEP 5: Scroll down to check for more content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-04-scrolled.png'), fullPage: false });
    console.log('STEP 4: Scrolled to bottom');

    // STEP 6: Full page screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-05-fullpage.png'), fullPage: true });
    console.log('STEP 5: Full page screenshot taken');

    // STEP 7: Open data source dropdown
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Find and click the data source select
    const dataSourceSelect = page.locator('.filter-card .el-select').first();
    const hasDataSourceSelect = await dataSourceSelect.isVisible().catch(() => false);
    console.log(`Data source select visible: ${hasDataSourceSelect}`);

    let uploadedSourcesCount = 0;
    let selectedUploadSource = false;

    if (hasDataSourceSelect) {
      await dataSourceSelect.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-06-datasource-dropdown.png'), fullPage: false });
      console.log('STEP 6: Data source dropdown opened');

      // Count options (excluding "系统数据")
      const allOptions = page.locator('.el-select-dropdown__item, .el-option');
      const optionCount = await allOptions.count();
      console.log(`Total dropdown options: ${optionCount}`);

      // Check for uploaded data source options
      const uploadOptions = page.locator('.el-select-dropdown__item, .el-option').filter({ hasNotText: '系统数据' });
      uploadedSourcesCount = await uploadOptions.count();
      console.log(`Uploaded data source options: ${uploadedSourcesCount}`);

      if (uploadedSourcesCount > 0) {
        // Click the first uploaded data source
        await uploadOptions.first().click();
        selectedUploadSource = true;
        console.log('Clicked first uploaded data source');

        // Wait for data to load
        await page.waitForTimeout(10000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-07-after-source-change.png'), fullPage: false });
        console.log('STEP 7: After data source change');

        // Check for AI insights panel
        const aiInsightsPanel = page.locator('text=AI 智能洞察').first();
        const hasAiInsights = await aiInsightsPanel.isVisible().catch(() => false);
        console.log(`AI Insights panel visible: ${hasAiInsights}`);

        // Check for exploration charts
        const explorationPanel = page.locator('text=数据图表探索').first();
        const hasExploration = await explorationPanel.isVisible().catch(() => false);
        console.log(`Exploration charts panel visible: ${hasExploration}`);

        // Scroll down to see exploration and AI sections
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-08-exploration.png'), fullPage: false });
        console.log('STEP 8: Exploration section screenshot');

        // Full page after dynamic data
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-09-dynamic-fullpage.png'), fullPage: true });

        // Check for 查看原始数据 button
        const viewRawDataBtn = page.locator('text=查看原始数据').first();
        const hasViewRawDataBtn = await viewRawDataBtn.isVisible().catch(() => false);
        console.log(`View raw data button visible: ${hasViewRawDataBtn}`);

        if (hasViewRawDataBtn) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(500);
          await viewRawDataBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-10-data-preview.png'), fullPage: false });
          console.log('STEP 9: Data preview dialog opened');

          // Check dialog content
          const previewDialog = page.locator('.el-dialog').filter({ hasText: '数据预览' });
          const hasPreviewDialog = await previewDialog.isVisible().catch(() => false);
          console.log(`Data preview dialog visible: ${hasPreviewDialog}`);

          // Close dialog
          const closeBtn = page.locator('.el-dialog').filter({ hasText: '数据预览' }).locator('button').filter({ hasText: '关闭' });
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
          }
        }

        // Check for ChartTypeSelector in exploration charts
        const chartTypeSelectors = page.locator('.exploration-chart-header');
        const selectorCount = await chartTypeSelectors.count();
        console.log(`ChartTypeSelector instances: ${selectorCount}`);

        // Count exploration charts
        const explorationChartItems = page.locator('.exploration-chart-item');
        const explorationChartCount = await explorationChartItems.count();
        console.log(`Exploration chart items: ${explorationChartCount}`);
      } else {
        // Close the dropdown if no upload sources
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        console.log('No uploaded data sources available');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-07-no-uploads.png'), fullPage: false });
      }
    }

    // STEP FINAL: Take final screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-11-final.png'), fullPage: true });
    console.log('STEP FINAL: Final screenshot taken');

    // SUMMARY
    console.log('\n===== TEST SUMMARY =====');
    console.log(`Page title: ${pageTitle}`);
    console.log(`KPI cards: ${kpiCount} (empty state: ${hasEmptyKpi})`);
    console.log(`Trend chart: label=${hasTrendLabel}, chart=${hasTrendChart}, empty=${hasEmptyTrend}`);
    console.log(`Pie chart: label=${hasPieLabel}, chart=${hasPieChart}, empty=${hasEmptyPie}`);
    console.log(`Ranking section: ${hasRanking}`);
    console.log(`Filter card: ${hasFilterCard}`);
    console.log(`Data source selector: label=${hasDataSourceLabel}, select=${hasDataSourceSelect}`);
    console.log(`Date range picker: ${hasDatePicker}`);
    console.log(`Dimension radio: ${hasDimensionRadio}`);
    console.log(`Category filter: ${hasCategoryFilter}`);
    console.log(`Uploaded data sources: ${uploadedSourcesCount}`);
    console.log(`Selected upload source: ${selectedUploadSource}`);
    console.log('========================\n');
  });
});
