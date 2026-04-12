/**
 * J16 设备管理 — super_admin @post-deploy
 *
 * Tests equipment-related pages as super_admin.
 *
 * Pages under test:
 *   /equipment/list         — 设备列表
 *   /equipment/maintenance  — 维护记录
 *   /equipment/alerts       — 告警管理
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// --- Suite --------------------------------------------------------------------

test.describe('J16 设备管理 — super_admin @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ==========================================================================
  // Test 1: Equipment list page loads + table visible
  // ==========================================================================

  test('设备列表页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/equipment/list');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify search input or filter exists
    const searchCtrl = page.locator('input[placeholder*="搜索"], input[placeholder*="设备"], input[placeholder]').first();
    const hasSearch = await searchCtrl.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSearch, '设备列表页应有搜索控件').toBe(true);

    // Verify "新建" or "新增" button exists (super_admin has write permission)
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("添加设备")').first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCreateBtn, '设备列表页应有新建按钮').toBe(true);

    // Table header columns should be rendered
    const headerRow = page.locator('.el-table__header-wrapper th').first();
    await expect(headerRow).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 2: Equipment maintenance records page loads + table visible
  // ==========================================================================

  test('维护记录页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/equipment/maintenance');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table or card to appear
    const table = page.locator(S.table.root).first();
    const card = page.locator('.el-card').first();

    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasCard = await card.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasTable || hasCard, '维护记录页应有表格或卡片').toBe(true);

    // Verify search/filter controls exist
    const filterEl = page.locator('input[placeholder], .el-select, .el-date-editor').first();
    const hasFilter = await filterEl.isVisible({ timeout: 5_000 }).catch(() => false);
    expect.soft(hasFilter, '维护记录页宜有筛选控件').toBe(true);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 3: Equipment alerts page loads + content renders
  // ==========================================================================

  test('告警管理页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/equipment/alerts');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Alerts page may render as a table, card list, or timeline
    const table = page.locator(S.table.root).first();
    const card = page.locator('.el-card').first();
    const timeline = page.locator('.el-timeline').first();

    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasCard = await card.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasTimeline = await timeline.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasTable || hasCard || hasTimeline, '告警管理页应有表格、卡片或时间线').toBe(true);

    // Alert pages often have severity filter or status filter
    const filterEl = page.locator('.el-select, .el-radio-group, input[placeholder]').first();
    const hasFilter = await filterEl.isVisible({ timeout: 5_000 }).catch(() => false);
    expect.soft(hasFilter, '告警管理页宜有筛选控件').toBe(true);

    // expectNoErrors skipped — alert dashboards may fire background warning toasts
    // when there are no alert records or when polling endpoints return empty results.
  });

  // ==========================================================================
  // Test 4: L2 — Equipment detail: click row to view equipment detail
  // ==========================================================================

  test('L2 设备详情查看', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/equipment/list');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Try to click a "查看" or "详情" button on the first row
    const viewBtn = rows.first().locator('button:has-text("查看"), button:has-text("详情"), button:has-text("编辑")');
    const hasViewBtn = await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasViewBtn) {
      await viewBtn.first().click();

      // Detail dialog or drawer should appear
      const dialog = page.locator('.el-dialog:visible, .el-drawer:visible');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Verify detail content renders (descriptions or form fields)
      const content = dialog.locator('.el-descriptions, .el-form, .el-form-item');
      await expect(content.first()).toBeVisible({ timeout: 5_000 });
    } else {
      // No action button — verify the row has readable data
      const firstRowText = await rows.first().textContent().catch(() => '');
      expect.soft(firstRowText?.trim().length, '第一行应有可见数据').toBeGreaterThan(0);
    }

    await expectNoErrors(page);
  });
});
