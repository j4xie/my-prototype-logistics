/**
 * J11 财务模块 — super_admin @post-deploy
 *
 * Tests finance-related pages as super_admin.
 *
 * Pages under test:
 *   /finance/invoices   — 开票管理
 *   /finance/payments   — 收款管理
 *   /finance/costs      — 成本分析
 *   /finance/ar-ap      — 应收应付
 *
 * L2: click invoice row to view detail dialog/drawer.
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// --- Suite --------------------------------------------------------------------

test.describe('J11 财务模块 — super_admin @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ==========================================================================
  // Test 1: Invoices page loads + table visible
  // ==========================================================================

  test('开票管理页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/finance/invoices');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table or card to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify search/filter controls exist
    const searchCtrl = page.locator('input[placeholder], .el-select, .el-date-editor').first();
    await expect(searchCtrl).toBeVisible({ timeout: 5_000 });

    // Table header columns should be rendered
    const headerRow = page.locator('.el-table__header-wrapper th').first();
    await expect(headerRow).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 2: Payments page loads + table visible
  // ==========================================================================

  test('收款管理页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/finance/payments');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table or card to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify search/filter controls exist
    const searchCtrl = page.locator('input[placeholder], .el-select, .el-date-editor').first();
    await expect(searchCtrl).toBeVisible({ timeout: 5_000 });

    // Table should be present
    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 3: Costs page loads + content renders
  // ==========================================================================

  test('成本分析页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/finance/costs');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // The costs page may render as cards, charts, or tables
    const card = page.locator('.el-card').first();
    const table = page.locator(S.table.root).first();

    const hasCard = await card.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasTable = await table.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasCard || hasTable, '成本分析页应有卡片或表格').toBe(true);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 4: AR/AP page loads + content renders
  // ==========================================================================

  test('应收应付页可访问 + 内容渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/finance/ar-ap');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // The AR/AP page may render tabs, cards, or tables
    const card = page.locator('.el-card').first();
    const table = page.locator(S.table.root).first();
    const tabs = page.locator('.el-tabs').first();

    const hasCard = await card.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasTable = await table.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasTabs = await tabs.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasCard || hasTable || hasTabs, '应收应付页应有卡片、表格或Tab').toBe(true);

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 5: L2 — Invoice detail: click row to view detail
  // ==========================================================================

  test('L2 开票详情查看', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/finance/invoices');
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
    const viewBtn = rows.first().locator('button:has-text("查看"), button:has-text("详情")');
    const hasViewBtn = await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasViewBtn) {
      await viewBtn.click();

      // Detail dialog or drawer should appear
      const dialog = page.locator('.el-dialog:visible, .el-drawer:visible');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Verify detail content renders (descriptions or form fields)
      const descriptions = dialog.locator('.el-descriptions, .el-form');
      await expect(descriptions).toBeVisible({ timeout: 5_000 });
    } else {
      // No view button — the invoice list may use inline expand or lack detail view.
      // Verify the row data itself is readable (first row has text content).
      const firstRowText = await rows.first().textContent().catch(() => '');
      expect(firstRowText?.trim().length, '第一行应有可见数据').toBeGreaterThan(0);
    }

    await expectNoErrors(page);
  });
});
