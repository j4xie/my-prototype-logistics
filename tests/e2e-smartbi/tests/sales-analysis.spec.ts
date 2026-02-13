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
    console.log(`PAGE_TITLE: ${pageTitle}`);

    // Check for KPI cards
    const kpiCards = page.locator('.kpi-card');
    const kpiCount = await kpiCards.count();
    console.log(`KPI_CARDS_COUNT: ${kpiCount}`);

    // Check for "暂无 KPI 数据" empty state
    const emptyKpi = page.locator('text=暂无 KPI 数据');
    const hasEmptyKpi = await emptyKpi.isVisible().catch(() => false);
    console.log(`KPI_EMPTY_STATE: ${hasEmptyKpi}`);

    // Check for trend chart section
    const trendSection = page.locator('text=销售趋势').first();
    const hasTrendLabel = await trendSection.isVisible().catch(() => false);
    console.log(`TREND_LABEL_VISIBLE: ${hasTrendLabel}`);

    // Check for the trend chart (either legacy canvas or DynamicChartRenderer)
    const trendChartLegacy = page.locator('#sales-trend-chart');
    const hasTrendLegacy = await trendChartLegacy.isVisible().catch(() => false);

    // Check for DynamicChartRenderer (could have various selectors)
    const dynamicCharts = page.locator('[class*="dynamic-chart"], [class*="chart-wrapper"], canvas');
    const dynamicChartCount = await dynamicCharts.count();
    console.log(`TREND_LEGACY_VISIBLE: ${hasTrendLegacy}`);
    console.log(`CANVAS_OR_DYNAMIC_CHARTS: ${dynamicChartCount}`);

    // Check for "暂无趋势数据" empty state in trend chart
    const emptyTrend = page.locator('text=暂无趋势数据');
    const hasEmptyTrend = await emptyTrend.isVisible().catch(() => false);
    console.log(`TREND_EMPTY_STATE: ${hasEmptyTrend}`);

    // Check for pie chart section
    const pieSection = page.locator('text=产品类别销售占比').first();
    const hasPieLabel = await pieSection.isVisible().catch(() => false);
    console.log(`PIE_LABEL_VISIBLE: ${hasPieLabel}`);

    const pieChartLegacy = page.locator('#sales-pie-chart');
    const hasPieLegacy = await pieChartLegacy.isVisible().catch(() => false);
    console.log(`PIE_LEGACY_VISIBLE: ${hasPieLegacy}`);

    // Check for "暂无产品分布数据" empty state
    const emptyPie = page.locator('text=暂无产品分布数据');
    const hasEmptyPie = await emptyPie.isVisible().catch(() => false);
    console.log(`PIE_EMPTY_STATE: ${hasEmptyPie}`);

    // Check ranking section
    const rankingSection = page.locator('text=销售员排行榜').first();
    const hasRanking = await rankingSection.isVisible().catch(() => false);
    console.log(`RANKING_VISIBLE: ${hasRanking}`);

    // Check for filter bar with data source selector
    const dataSourceLabel = page.locator('text=数据源').first();
    const hasDataSourceLabel = await dataSourceLabel.isVisible().catch(() => false);
    console.log(`DATASOURCE_LABEL_VISIBLE: ${hasDataSourceLabel}`);

    const filterCard = page.locator('.filter-card');
    const hasFilterCard = await filterCard.isVisible().catch(() => false);
    console.log(`FILTER_CARD_VISIBLE: ${hasFilterCard}`);

    // Check date range picker
    const datePicker = page.locator('.el-date-editor, .el-range-editor').first();
    const hasDatePicker = await datePicker.isVisible().catch(() => false);
    console.log(`DATE_PICKER_VISIBLE: ${hasDatePicker}`);

    // Check dimension radio buttons
    const dimensionRadio = page.locator('text=按日').first();
    const hasDimensionRadio = await dimensionRadio.isVisible().catch(() => false);
    console.log(`DIMENSION_RADIO_VISIBLE: ${hasDimensionRadio}`);

    // Check category filter
    const categoryFilter = page.locator('text=产品类别').first();
    const hasCategoryFilter = await categoryFilter.isVisible().catch(() => false);
    console.log(`CATEGORY_FILTER_VISIBLE: ${hasCategoryFilter}`);

    // Check breadcrumb
    const breadcrumb = page.locator('.el-breadcrumb');
    const hasBreadcrumb = await breadcrumb.isVisible().catch(() => false);
    console.log(`BREADCRUMB_VISIBLE: ${hasBreadcrumb}`);

    // Check for export and refresh buttons
    const exportBtn = page.locator('button').filter({ hasText: '导出报表' });
    const hasExportBtn = await exportBtn.isVisible().catch(() => false);
    console.log(`EXPORT_BTN_VISIBLE: ${hasExportBtn}`);

    const refreshBtn = page.locator('button').filter({ hasText: '刷新' });
    const hasRefreshBtn = await refreshBtn.isVisible().catch(() => false);
    console.log(`REFRESH_BTN_VISIBLE: ${hasRefreshBtn}`);

    // STEP 5: Scroll down to check for more content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-04-scrolled.png'), fullPage: false });
    console.log('STEP 5: Scrolled to bottom');

    // STEP 6: Full page screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-05-fullpage.png'), fullPage: true });
    console.log('STEP 6: Full page screenshot taken');

    // STEP 7: Open data source dropdown
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Find and click the data source select - click the input inside the first el-select within the filter-card
    const dataSourceTrigger = page.locator('.filter-card .el-select .el-select__wrapper, .filter-card .el-select .el-input__inner').first();
    const hasDataSourceTrigger = await dataSourceTrigger.isVisible().catch(() => false);
    console.log(`DATASOURCE_TRIGGER_VISIBLE: ${hasDataSourceTrigger}`);

    let uploadedSourcesCount = 0;
    let selectedUploadSource = false;
    let hasAiInsights = false;
    let hasExploration = false;
    let hasViewRawDataBtn = false;
    let hasPreviewDialog = false;
    let explorationChartCount = 0;

    if (hasDataSourceTrigger) {
      await dataSourceTrigger.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-06-datasource-dropdown.png'), fullPage: false });
      console.log('STEP 7: Data source dropdown opened');

      // Count visible dropdown items
      const dropdownItems = page.locator('.el-select-dropdown__item:visible, .el-select-dropdown .el-option:visible');
      const totalOptions = await dropdownItems.count();
      console.log(`DROPDOWN_TOTAL_OPTIONS: ${totalOptions}`);

      // List all options text
      for (let i = 0; i < Math.min(totalOptions, 10); i++) {
        const text = await dropdownItems.nth(i).textContent().catch(() => '');
        console.log(`  OPTION_${i}: ${text?.trim()}`);
      }

      // Look for options that are NOT "系统数据"
      const allVisibleOptions = page.locator('.el-select-dropdown__item:visible');
      const optTexts: string[] = [];
      const allOptCount = await allVisibleOptions.count();
      for (let i = 0; i < allOptCount; i++) {
        const txt = await allVisibleOptions.nth(i).textContent();
        optTexts.push(txt?.trim() || '');
      }
      const uploadOptions = optTexts.filter(t => t !== '系统数据' && t.length > 0);
      uploadedSourcesCount = uploadOptions.length;
      console.log(`UPLOADED_SOURCES_COUNT: ${uploadedSourcesCount}`);

      if (uploadedSourcesCount > 0) {
        // Click the first non-system option
        for (let i = 0; i < allOptCount; i++) {
          const txt = await allVisibleOptions.nth(i).textContent();
          if (txt?.trim() !== '系统数据' && txt?.trim()) {
            console.log(`Selecting upload source: ${txt?.trim()}`);
            await allVisibleOptions.nth(i).click();
            selectedUploadSource = true;
            break;
          }
        }

        // Wait for data to load (dynamic analysis can take time)
        console.log('Waiting for dynamic data to load...');
        await page.waitForTimeout(12000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-07-after-source-change.png'), fullPage: false });
        console.log('STEP 8: After data source change');

        // Check for AI insights panel
        const aiInsightsPanel = page.locator('text=AI 智能洞察').first();
        hasAiInsights = await aiInsightsPanel.isVisible().catch(() => false);
        console.log(`AI_INSIGHTS_VISIBLE: ${hasAiInsights}`);

        // Check for exploration charts
        const explorationPanel = page.locator('text=数据图表探索').first();
        hasExploration = await explorationPanel.isVisible().catch(() => false);
        console.log(`EXPLORATION_VISIBLE: ${hasExploration}`);

        // Count exploration charts
        const explorationItems = page.locator('.exploration-chart-item');
        explorationChartCount = await explorationItems.count();
        console.log(`EXPLORATION_CHART_COUNT: ${explorationChartCount}`);

        // Scroll down to see exploration and AI sections
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-08-exploration.png'), fullPage: false });
        console.log('STEP 9: Exploration section screenshot');

        // Full page after dynamic data
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-09-dynamic-fullpage.png'), fullPage: true });

        // Check for 查看原始数据 button
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        const viewRawDataBtn = page.locator('button').filter({ hasText: '查看原始数据' }).first();
        hasViewRawDataBtn = await viewRawDataBtn.isVisible().catch(() => false);
        console.log(`VIEW_RAW_DATA_BTN_VISIBLE: ${hasViewRawDataBtn}`);

        if (hasViewRawDataBtn) {
          await viewRawDataBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-10-data-preview.png'), fullPage: false });
          console.log('STEP 10: Data preview dialog opened');

          // Check dialog content
          const previewDialog = page.locator('.el-dialog').filter({ hasText: '数据预览' });
          hasPreviewDialog = await previewDialog.isVisible().catch(() => false);
          console.log(`PREVIEW_DIALOG_VISIBLE: ${hasPreviewDialog}`);

          if (hasPreviewDialog) {
            // Check for table and pagination
            const previewTable = previewDialog.locator('.el-table');
            const hasPreviewTable = await previewTable.isVisible().catch(() => false);
            console.log(`PREVIEW_TABLE_VISIBLE: ${hasPreviewTable}`);

            const previewPagination = previewDialog.locator('.el-pagination');
            const hasPreviewPagination = await previewPagination.isVisible().catch(() => false);
            console.log(`PREVIEW_PAGINATION_VISIBLE: ${hasPreviewPagination}`);

            // Get total count display
            const totalInfo = await previewDialog.locator('.preview-info').textContent().catch(() => '');
            console.log(`PREVIEW_INFO: ${totalInfo?.trim()}`);
          }

          // Close dialog
          const closeBtn = page.locator('.el-dialog').filter({ hasText: '数据预览' }).locator('button').filter({ hasText: '关闭' });
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
          } else {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
          }
        }
      } else {
        // Close the dropdown if no upload sources
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        console.log('No uploaded data sources available');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-07-no-uploads.png'), fullPage: false });
      }
    } else {
      console.log('Could not find data source selector trigger');
    }

    // STEP FINAL: Take final screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v-sales-11-final.png'), fullPage: true });
    console.log('STEP FINAL: Final screenshot taken');

    // ==================== RESULTS ====================
    console.log('\n========== QA TEST RESULTS ==========');
    console.log(`RESULT_PAGE_LOADS: ${pageTitle?.includes('销售分析') ? 'PASS' : 'CHECK'} (title: "${pageTitle}")`);
    console.log(`RESULT_KPI_CARDS: ${kpiCount > 0 ? 'PASS' : (hasEmptyKpi ? 'PASS_EMPTY' : 'FAIL')} (count: ${kpiCount}, empty: ${hasEmptyKpi})`);
    console.log(`RESULT_TREND_CHART: ${hasTrendLabel ? 'PASS' : 'FAIL'} (label: ${hasTrendLabel}, legacy: ${hasTrendLegacy}, empty: ${hasEmptyTrend})`);
    console.log(`RESULT_PIE_CHART: ${hasPieLabel ? 'PASS' : 'FAIL'} (label: ${hasPieLabel}, legacy: ${hasPieLegacy}, empty: ${hasEmptyPie})`);
    console.log(`RESULT_RANKING: ${hasRanking ? 'PASS' : 'FAIL'}`);
    console.log(`RESULT_FILTER_BAR: ${hasFilterCard ? 'PASS' : 'FAIL'} (date: ${hasDatePicker}, dim: ${hasDimensionRadio}, cat: ${hasCategoryFilter})`);
    console.log(`RESULT_DATASOURCE_SELECTOR: ${hasDataSourceLabel ? 'PASS' : 'FAIL'} (label: ${hasDataSourceLabel}, trigger: ${hasDataSourceTrigger})`);
    console.log(`RESULT_BREADCRUMB: ${hasBreadcrumb ? 'PASS' : 'FAIL'}`);
    console.log(`RESULT_EXPORT_REFRESH: export=${hasExportBtn}, refresh=${hasRefreshBtn}`);
    console.log(`RESULT_UPLOADED_SOURCES: ${uploadedSourcesCount}`);
    console.log(`RESULT_SOURCE_SWITCH: ${selectedUploadSource ? 'PASS' : 'SKIP_NO_DATA'}`);
    console.log(`RESULT_AI_INSIGHTS: ${hasAiInsights ? 'PASS' : (selectedUploadSource ? 'FAIL' : 'SKIP_NO_DATA')}`);
    console.log(`RESULT_EXPLORATION: ${hasExploration ? 'PASS' : (selectedUploadSource ? 'FAIL' : 'SKIP_NO_DATA')} (charts: ${explorationChartCount})`);
    console.log(`RESULT_VIEW_RAW_DATA: ${hasViewRawDataBtn ? 'PASS' : (selectedUploadSource ? 'FAIL' : 'SKIP_NO_DATA')}`);
    console.log(`RESULT_DATA_PREVIEW: ${hasPreviewDialog ? 'PASS' : (hasViewRawDataBtn ? 'FAIL' : 'SKIP')}`);
    console.log('=====================================\n');
  });
});
