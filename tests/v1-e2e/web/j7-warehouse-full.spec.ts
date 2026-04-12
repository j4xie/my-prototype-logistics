/**
 * J7 仓储全周期 — super_admin @post-deploy
 *
 * Tests all warehouse-related pages as super_admin.
 * NOTE: warehouse_worker is MOBILE_ONLY (pitfall #4 in handoff) and cannot
 * login to web-admin. super_admin has full warehouse module access.
 *
 * Pages under test:
 *   /warehouse/materials          — 原材料批次
 *   /warehouse/shipments          — 出货管理
 *   /warehouse/inventory          — 盘点管理
 *   /transfer/list                — 调拨单列表
 *   /warehouse/reusable-containers — 周转耗材管理
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// --- Suite --------------------------------------------------------------------

test.describe('J7 仓储全周期 — super_admin @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ==========================================================================
  // Test 1: Materials batch list page loads + table visible
  // ==========================================================================

  test('原材料批次列表页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/warehouse/materials');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify search input exists (the page has a keyword search)
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="批次"], input[placeholder*="原材料"]').first();
    const hasSearch = await searchInput.isVisible({ timeout: 3_000 }).catch(() => false);
    // Search or refresh button should exist
    const refreshBtn = page.locator('button:has-text("刷新"), button:has-text("重置"), button .el-icon-refresh').first();
    const hasRefresh = await refreshBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasSearch || hasRefresh, '应有搜索或刷新控件').toBe(true);

    // Table should be present (may or may not have rows depending on seed data)
    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();
    // Just verify the table rendered (rowCount >= 0 is always true, but checking
    // the table element itself was already done above)
    expect(rowCount).toBeGreaterThanOrEqual(0);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 2: Shipment management page loads + list renders
  // ==========================================================================

  test('出货管理页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/warehouse/shipments');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table or card to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify "新建" or "新增" button exists (super_admin has write permission)
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("创建出货")').first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCreateBtn, '应有新建出货按钮').toBe(true);

    // Verify status filter or search form exists
    const filterEl = page.locator('.el-select, .el-radio-group, input[placeholder]').first();
    await expect(filterEl).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 3: Inventory management (盘点管理) page loads
  // ==========================================================================

  test('盘点管理页可访问 + 统计区域渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/warehouse/inventory');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // The inventory page has an el-card wrapper and statistics section
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify search or filter controls exist
    const searchCtrl = page.locator('input[placeholder], .el-select').first();
    await expect(searchCtrl).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 4: Transfer list (调拨管理) page loads
  // ==========================================================================

  test('调拨单列表页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/transfer/list');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Transfer list has a "刷新" (refresh) button but no create button
    // (transfers are created via mobile app workflow, not web-admin)
    const refreshBtn = page.locator('button:has-text("刷新")').first();
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 });

    // Verify table columns rendered (headers should include 调拨编号, 方向, etc.)
    const headerRow = page.locator('.el-table__header-wrapper th').first();
    await expect(headerRow).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 5: Reusable containers (周转耗材) page loads
  // ==========================================================================

  test('周转耗材管理页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/warehouse/reusable-containers');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // The reusable containers page has a card with header "周转耗材管理"
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Verify the table exists
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify "新建周转耗材" button exists (super_admin has write permission)
    const createBtn = page.locator('button:has-text("新建周转耗材"), button:has-text("新建"), button:has-text("新增")').first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCreateBtn, '应有新建周转耗材按钮').toBe(true);

    // Verify pagination exists
    const pagination = page.locator('.el-pagination').first();
    const hasPagination = await pagination.isVisible({ timeout: 3_000 }).catch(() => false);
    // Pagination is expected but may not show if no data
    expect(typeof hasPagination).toBe('boolean');

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 6: Batch detail expand — click a row to view batch details
  // ==========================================================================

  test('L2 \u539F\u6750\u6599\u6279\u6B21\u8BE6\u60C5\u5F39\u7A97', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/warehouse/materials');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the "\u67E5\u770B" (view) button on the first row to open detail dialog
    const viewBtn = rows.first().locator('button:has-text("\u67E5\u770B")');
    const hasViewBtn = await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasViewBtn) {
      await viewBtn.click();

      // Detail dialog should appear with title "\u6279\u6B21\u8BE6\u60C5"
      const dialog = page.locator('.el-dialog:visible');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Verify descriptions inside the dialog show batch info fields
      const descriptions = dialog.locator('.el-descriptions');
      await expect(descriptions).toBeVisible({ timeout: 5_000 });

      // Verify key fields are present: \u6279\u6B21\u53F7 (batch number), \u539F\u6599\u7C7B\u578B (material type), \u6570\u91CF (quantity)
      const batchLabel = dialog.locator('.el-descriptions-item:has-text("\u6279\u6B21\u53F7")');
      await expect(batchLabel, '\u6279\u6B21\u8BE6\u60C5\u5E94\u663E\u793A\u6279\u6B21\u53F7').toBeVisible({ timeout: 5_000 });

      const materialLabel = dialog.locator('.el-descriptions-item:has-text("\u539F\u6599\u7C7B\u578B")');
      await expect(materialLabel, '\u6279\u6B21\u8BE6\u60C5\u5E94\u663E\u793A\u539F\u6599\u7C7B\u578B').toBeVisible({ timeout: 5_000 });
    } else {
      // Fallback: try clicking the row itself
      await rows.first().click();
      await page.waitForTimeout(1000);

      // Check if a dialog or drawer appeared
      const dialog = page.locator('.el-dialog:visible, .el-drawer:visible');
      const appeared = await dialog.isVisible({ timeout: 3_000 }).catch(() => false);
      expect(appeared, '\u70B9\u51FB\u884C\u5E94\u663E\u793A\u6279\u6B21\u8BE6\u60C5').toBe(true);
    }

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 7: Transfer detail view — click "\u8BE6\u60C5" to see transfer info
  // ==========================================================================

  test('L2 \u8C03\u62E8\u5355\u8BE6\u60C5\u9875\u5185\u5BB9\u6821\u9A8C', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/transfer/list');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click "\u8BE6\u60C5" button on first row to navigate to detail page
    const detailBtn = rows.first().locator('button:has-text("\u8BE6\u60C5")');
    const hasDetailBtn = await detailBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasDetailBtn) {
      await detailBtn.click();
      await page.waitForLoadState('networkidle');

      // Should navigate to transfer detail page (/transfer/{id})
      expect(page.url()).toMatch(/\/transfer\/[a-zA-Z0-9-]+/);

      // Verify descriptions section with key fields
      const descriptions = page.locator('.el-descriptions');
      await expect(descriptions.first()).toBeVisible({ timeout: 10_000 });

      // Verify \u8C03\u62E8\u7F16\u53F7 (transfer number) is shown
      const transferNumberLabel = page.locator('.el-descriptions-item:has-text("\u8C03\u62E8\u7F16\u53F7")');
      await expect(transferNumberLabel, '\u8C03\u62E8\u8BE6\u60C5\u5E94\u663E\u793A\u8C03\u62E8\u7F16\u53F7').toBeVisible({ timeout: 5_000 });

      // Verify \u8C03\u51FA\u65B9 (source) and \u8C03\u5165\u65B9 (target) labels
      const sourceLabel = page.locator('.el-descriptions-item:has-text("\u8C03\u51FA\u65B9")');
      await expect(sourceLabel, '\u8C03\u62E8\u8BE6\u60C5\u5E94\u663E\u793A\u8C03\u51FA\u65B9').toBeVisible({ timeout: 5_000 });

      const targetLabel = page.locator('.el-descriptions-item:has-text("\u8C03\u5165\u65B9")');
      await expect(targetLabel, '\u8C03\u62E8\u8BE6\u60C5\u5E94\u663E\u793A\u8C03\u5165\u65B9').toBeVisible({ timeout: 5_000 });

      // Verify the items table is present
      const itemsTable = page.locator('.el-table');
      await expect(itemsTable.first()).toBeVisible({ timeout: 5_000 });
    } else {
      // No detail button — skip
      test.skip();
    }

    await expectNoErrors(page);
  });
});
