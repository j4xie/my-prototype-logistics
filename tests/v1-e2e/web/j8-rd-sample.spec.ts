/**
 * J8 研发样品 + 报价旅程 — super_admin @post-deploy
 *
 * Journey: super_admin verifies all R&D and quote pages are accessible,
 * with basic functionality checks on each.
 *
 * Pages under test:
 *   /rd/samples           — 研发样品管理 (samples tab + requests tab)
 *   /rd/converted         — 已转样品库 (P1-3 "转报模" 2-page layout)
 *   /rd/samples tracking  — 追踪记录 dialog (P1-8)
 *   /sales/quotes         — 运营报价 (P0-4 state machine)
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

test.describe('J8 研发样品 + 报价旅程 — super_admin @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: R&D samples page accessible + tabs work
  // ═══════════════════════════════════════════════════════════════════════════

  test('研发样品管理页可访问 + 标签切换', async ({ page }) => {
    await page.goto('/rd/samples');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Page should load with el-card
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Default tab is "样品管理" — table should be present
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Switch to "研发需求" tab via el-radio-button
    const requestTab = page.locator('.el-radio-button:has-text("研发需求")');
    const hasRequestTab = await requestTab.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasRequestTab) {
      await requestTab.click();
      await page.waitForLoadState('networkidle');

      // After switching, a table should still be visible (requests table)
      const reqTable = page.locator(S.table.root).first();
      await expect(reqTable).toBeVisible({ timeout: 10_000 });
    }

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: Converted samples page accessible (P1-3 "已转样品库")
  // ═══════════════════════════════════════════════════════════════════════════

  test('已转样品库页可访问 (P1-3)', async ({ page }) => {
    await page.goto('/rd/converted');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Page should load with el-card
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Table should exist (may be empty if no converted samples yet)
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: Tracking records dialog exists (P1-8)
  // ═══════════════════════════════════════════════════════════════════════════

  test('追踪记录功能存在 (P1-8)', async ({ page }) => {
    await page.goto('/rd/samples');
    await page.waitForLoadState('networkidle');

    // Make sure we are on "样品管理" tab
    const samplesTab = page.locator('.el-radio-button:has-text("样品管理")');
    const hasSamplesTab = await samplesTab.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasSamplesTab) {
      await samplesTab.click();
      await page.waitForLoadState('networkidle');
    }

    // Wait for samples table to load
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Check if there are rows to click on
    const rows = page.locator(S.table.row);
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Click the "追踪记录" button on the first row
      const trackingBtn = rows.first().locator('button:has-text("追踪记录")');
      const hasBtn = await trackingBtn.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasBtn) {
        await trackingBtn.click();

        // Tracking dialog should appear with title "追踪记录"
        const dialog = page.locator('.el-dialog:visible');
        await expect(dialog).toBeVisible({ timeout: 10_000 });

        const dialogTitle = dialog.locator('.el-dialog__title');
        await expect(dialogTitle).toHaveText(/追踪记录/);

        // Dialog should contain either records table or empty state
        const hasRecords = await dialog.locator(S.table.root).isVisible({ timeout: 3_000 }).catch(() => false);
        const hasEmpty = await dialog.locator('.el-empty').isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasRecords || hasEmpty, '追踪记录弹窗应包含记录表或空状态').toBe(true);
      }
    }

    // Even without data, the page itself loaded successfully
    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 4: Operational quotes page accessible (P0-4)
  // ═══════════════════════════════════════════════════════════════════════════

  test('运营报价页可访问 (P0-4)', async ({ page }) => {
    await page.goto('/sales/quotes');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Page should load with el-card containing "销售运营报价" title
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Verify page-title text
    const pageTitle = page.locator('.page-title, .card-header').first();
    await expect(pageTitle).toBeVisible({ timeout: 5_000 });

    // Table with quote columns should be visible
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Status filter select should be present
    const statusSelect = page.locator('.el-select').first();
    await expect(statusSelect).toBeVisible({ timeout: 5_000 });

    // "新建报价" button should be visible for super_admin
    const createBtn = page.locator('button:has-text("新建报价")');
    await expect(createBtn).toBeVisible({ timeout: 5_000 });

    // Verify the info alert about the 3-stage workflow
    const infoAlert = page.locator('.el-alert--info').first();
    const hasAlert = await infoAlert.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasAlert) {
      await expect(infoAlert).toContainText('3 段式');
    }

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 5: Operational quotes — create dialog opens (P0-4 CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  test('运营报价 — 新建报价弹窗可打开 (P0-4 CRUD)', async ({ page }) => {
    await page.goto('/sales/quotes');
    await page.waitForLoadState('networkidle');

    // Wait for page to fully load
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Click "新建报价" button
    const createBtn = page.locator('button:has-text("新建报价")');
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
    await createBtn.click();

    // Dialog should appear with title "新建销售运营报价"
    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const dialogTitle = dialog.locator('.el-dialog__title');
    await expect(dialogTitle).toHaveText(/新建销售运营报价/);

    // Dialog should have form fields
    const formItems = dialog.locator('.el-form-item');
    const formCount = await formItems.count();
    expect(formCount, '报价表单应有输入字段').toBeGreaterThan(0);

    // Close the dialog without submitting (cancel or close)
    const cancelBtn = dialog.locator('button:has-text("取消")');
    const hasCancelBtn = await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasCancelBtn) {
      await cancelBtn.click();
    } else {
      // Use dialog close button
      const closeBtn = dialog.locator('.el-dialog__headerbtn');
      await closeBtn.click();
    }

    await expect(dialog).toBeHidden({ timeout: 5_000 });
    await expectNoErrors(page);
  });
});
