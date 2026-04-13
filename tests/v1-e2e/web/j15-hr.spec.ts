/**
 * J15 人事管理 — super_admin @post-deploy
 *
 * Tests HR-related pages as super_admin.
 *
 * Pages under test:
 *   /hr/employees    — 员工管理
 *   /hr/attendance   — 考勤管理
 *   /hr/departments  — 部门管理
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// --- Suite --------------------------------------------------------------------

test.describe('J15 人事管理 — super_admin @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ==========================================================================
  // Test 1: Employees list page loads + table visible
  // ==========================================================================

  test('员工管理页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/hr/employees');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // The employees list page has no keyword search bar — it loads all employees
    // with pagination. Verify the card header "员工管理" is visible.
    const cardHeader = page.locator('.card-header, .el-card__header').first();
    await expect(cardHeader).toBeVisible({ timeout: 5_000 });

    // Verify "添加员工" button exists (super_admin has write permission)
    const createBtn = page.locator('button:has-text("添加员工"), button:has-text("新建"), button:has-text("新增")').first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCreateBtn, '员工管理页应有添加员工按钮').toBe(true);

    // Table header columns should be rendered
    const headerRow = page.locator('.el-table__header-wrapper th').first();
    await expect(headerRow).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 2: Attendance management page loads + table visible
  // ==========================================================================

  test('考勤管理页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/hr/attendance');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Attendance may render as a table, card layout, or calendar
    const table = page.locator(S.table.root).first();
    const card = page.locator('.el-card').first();

    const hasTable = await table.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasCard = await card.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasTable || hasCard, '考勤管理页应有表格或卡片').toBe(true);

    // Verify date filter or search control exists (attendance data is date-indexed)
    const dateEl = page.locator('.el-date-editor, .el-date-picker, input[placeholder*="日期"], input[placeholder]').first();
    const hasDate = await dateEl.isVisible({ timeout: 5_000 }).catch(() => false);
    expect.soft(hasDate, '考勤管理页宜有日期筛选控件').toBe(true);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 3: Departments management page loads + tree or table renders
  // ==========================================================================

  test('部门管理页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/hr/departments');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Departments may render as a tree (el-tree), table, or card list
    const tree = page.locator('.el-tree').first();
    const table = page.locator(S.table.root).first();
    const card = page.locator('.el-card').first();

    const hasTree = await tree.isVisible({ timeout: 12_000 }).catch(() => false);
    const hasTable = await table.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasCard = await card.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasTree || hasTable || hasCard, '部门管理页应有树形、表格或卡片').toBe(true);

    // Verify "新建" or "新增部门" button exists
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("添加部门")').first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCreateBtn, '部门管理页应有新建按钮').toBe(true);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 4: L2 — Employees detail: click row to view employee detail
  // ==========================================================================

  test('L2 员工详情查看', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/hr/employees');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Try to click a "查看" or "编辑" button on the first row
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
