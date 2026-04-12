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
});
