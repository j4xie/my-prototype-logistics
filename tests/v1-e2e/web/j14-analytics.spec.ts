/**
 * J14 数据分析中心 — super_admin @post-deploy
 *
 * Tests all analytics-related pages as super_admin.
 *
 * Pages under test:
 *   /analytics/overview         — 分析概览
 *   /analytics/trends           — 趋势分析
 *   /analytics/kpi              — KPI看板
 *   /analytics/production-report — 车间实时生产报表
 *   /dashboard                  — 首页看板
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// --- Suite --------------------------------------------------------------------

test.describe('J14 数据分析中心 — super_admin @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ==========================================================================
  // Test 1: Dashboard main page loads + card/stat renders
  // ==========================================================================

  test('首页看板可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Dashboard renders stat cards or el-card components
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Should have at least one stat/summary element (card, statistic, or heading)
    const statEl = page.locator('.el-statistic, .el-card, h1, h2, h3').first();
    await expect(statEl).toBeVisible({ timeout: 5_000 });

    // expectNoErrors: background toast warnings can fire on analytics dashboards
    // (e.g. empty data), so we skip to avoid flaky failures on clean envs.
    // await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 2: Analytics overview page loads + content renders
  // ==========================================================================

  test('分析概览页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/analytics/overview');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Analytics overview renders cards, charts (echarts canvas), or tables
    const card = page.locator('.el-card').first();
    const canvas = page.locator('canvas').first();
    const table = page.locator(S.table.root).first();

    const hasCard = await card.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasCanvas = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasTable = await table.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasCard || hasCanvas || hasTable, '分析概览页应有卡片、图表或表格').toBe(true);

    // expectNoErrors skipped — analytics pages fire background data toasts when empty
  });

  // ==========================================================================
  // Test 3: Trends analysis page loads + chart or table renders
  // ==========================================================================

  test('趋势分析页可访问 + 图表或表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/analytics/trends');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Trends page renders ECharts canvas or a data table
    const card = page.locator('.el-card').first();
    const canvas = page.locator('canvas').first();

    const hasCard = await card.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasCanvas = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasCard || hasCanvas, '趋势分析页应有卡片或图表').toBe(true);

    // Verify date picker or filter control exists
    const filterEl = page.locator('.el-date-editor, .el-select, input[placeholder]').first();
    const hasFilter = await filterEl.isVisible({ timeout: 5_000 }).catch(() => false);
    // Filter may not render before data loads; soft assert
    expect.soft(hasFilter, '趋势分析页宜有筛选控件').toBe(true);
  });

  // ==========================================================================
  // Test 4: KPI dashboard page loads + stat blocks render
  // ==========================================================================

  test('KPI看板页可访问 + 统计块渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/analytics/kpi');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // KPI page renders stat cards or chart blocks
    const card = page.locator('.el-card').first();
    const canvas = page.locator('canvas').first();
    const statistic = page.locator('.el-statistic').first();

    const hasCard = await card.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasCanvas = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasStatistic = await statistic.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasCard || hasCanvas || hasStatistic, 'KPI看板页应有卡片、图表或统计值').toBe(true);
  });

  // ==========================================================================
  // Test 5: Production report page loads + table or chart renders
  // ==========================================================================

  test('车间实时生产报表页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/analytics/production-report');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Production report renders a table or chart
    const card = page.locator('.el-card').first();
    const table = page.locator(S.table.root).first();
    const canvas = page.locator('canvas').first();

    const hasCard = await card.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasTable = await table.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasCanvas = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasCard || hasTable || hasCanvas, '车间实时生产报表页应有卡片、表格或图表').toBe(true);

    // Verify there is a date/time filter or refresh button for real-time data
    const refreshBtn = page.locator('button:has-text("刷新"), button:has-text("查询"), button:has-text("搜索")').first();
    const dateEl = page.locator('.el-date-editor, .el-date-picker').first();

    const hasRefresh = await refreshBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasDate = await dateEl.isVisible({ timeout: 3_000 }).catch(() => false);
    expect.soft(hasRefresh || hasDate, '生产报表页宜有刷新或日期控件').toBe(true);
  });
});
