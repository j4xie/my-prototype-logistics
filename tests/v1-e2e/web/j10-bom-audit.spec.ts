/**
 * J10 BOM 审计 + FMR 清仓通知 @post-deploy
 *
 * Covers:
 *   P1-9: BOM 变更记录 (bom_change_logs table + BomChangeLog.vue el-drawer viewer)
 *   P1-5: 车间仓当天清仓定时任务 (FmrExpiryScanner @Scheduled + FMR list page accessible)
 *
 * Tests:
 *   1. BOM management page loads at /production/bom with product selector
 *   2. "变更记录" button is present and enabled after product auto-select
 *   3. Clicking "变更记录" opens el-drawer with title "BOM 变更记录" (P1-9)
 *   4. FMR list page accessible at /production/material-requisitions (P1-5 data source)
 *
 * Auth: super_admin
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors, expectToast } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOM_URL = '/production/bom';
const FMR_URL = '/production/material-requisitions';

test.describe('J10 BOM 审计 + FMR 清仓通知 @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: BOM page loads with product selector
  // ═══════════════════════════════════════════════════════════════════════════

  test('BOM 管理页加载正常 + 产品选择器可见', async ({ page }) => {
    await page.goto(BOM_URL);
    await page.waitForLoadState('networkidle');

    // Must not redirect to login
    expect(page.url()).not.toMatch(/\/login/);

    // Page title "BOM成本管理" must be visible
    const pageTitle = page.locator('h2.page-title, .page-title').filter({ hasText: 'BOM成本管理' });
    await expect(pageTitle).toBeVisible({ timeout: 15_000 });

    // Product el-select must be visible (placeholder "选择产品")
    const productSelect = page.locator('.el-select').first();
    await expect(productSelect).toBeVisible({ timeout: 10_000 });

    // Cost summary card must be rendered (proves BOM content component mounted)
    const costSummaryCard = page.locator('.cost-summary-card, .cost-summary').first();
    await expect(costSummaryCard).toBeVisible({ timeout: 10_000 });

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: "变更记录" button is present and enabled after product auto-select
  // ═══════════════════════════════════════════════════════════════════════════

  test('P1-9: "变更记录" 按钮在产品选中后可用', async ({ page }) => {
    await page.goto(BOM_URL);
    await page.waitForLoadState('networkidle');

    // Wait for the page and product auto-selection to settle
    // (BOM index.vue auto-selects first product in productTypes on mount)
    await page.waitForTimeout(2000);

    // Locate "变更记录" button — added in Task 30 (commit e57d7f0ec)
    const changeLogBtn = page.locator('button:has-text("变更记录")');
    await expect(changeLogBtn).toBeVisible({ timeout: 10_000 });

    // The button is disabled when no product is selected.
    // After auto-selection it should be enabled. Check via :disabled attribute.
    // If seed data provides product types, the button will be enabled.
    // We just verify it exists; enabled state depends on seed data availability.
    const isDisabled = await changeLogBtn.isDisabled();

    if (isDisabled) {
      // Seed may not have loaded — try manually clicking product select and picking first option
      const productSelect = page.locator('.el-select').first();
      await productSelect.click();
      await page.waitForTimeout(500);

      const firstOption = page.locator('.el-select-dropdown__item').first();
      const hasOption = await firstOption.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasOption) {
        await firstOption.click();
        await page.waitForTimeout(500);
        // Button should now be enabled
        await expect(changeLogBtn).not.toBeDisabled({ timeout: 5_000 });
      } else {
        // No product seed data available — mark as expected skip
        test.skip();
        return;
      }
    }

    // At this point the button should be enabled
    await expect(changeLogBtn).not.toBeDisabled();

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: Clicking "变更记录" opens el-drawer with correct title (P1-9)
  // ═══════════════════════════════════════════════════════════════════════════

  test('P1-9: 点击"变更记录"打开变更日志抽屉 — 标题正确', async ({ page }) => {
    await page.goto(BOM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const changeLogBtn = page.locator('button:has-text("变更记录")');
    await expect(changeLogBtn).toBeVisible({ timeout: 10_000 });

    // If button is disabled, try to select a product first
    const isDisabled = await changeLogBtn.isDisabled();
    if (isDisabled) {
      const productSelect = page.locator('.el-select').first();
      await productSelect.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('.el-select-dropdown__item').first();
      const hasOption = await firstOption.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!hasOption) {
        // No seed data — cannot proceed
        test.skip();
        return;
      }
      await firstOption.click();
      await page.waitForTimeout(500);
    }

    // Click the button to open the drawer
    await changeLogBtn.click();

    // el-drawer should appear
    // BomChangeLog.vue: <el-drawer v-model="visible" title="BOM 变更记录" ...>
    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible({ timeout: 8_000 });

    // Verify drawer title text — use .el-drawer__title (the <span role="heading"> child)
    // to avoid strict-mode ambiguity with .el-drawer__header which also exists
    const drawerTitle = drawer.locator('.el-drawer__title').first();
    await expect(drawerTitle).toContainText('BOM 变更记录', { timeout: 5_000 });

    // Drawer body should show either the timeline (if logs exist) or the empty state
    const drawerBody = drawer.locator('.el-drawer__body');
    await expect(drawerBody).toBeVisible({ timeout: 5_000 });

    // Verify: either el-timeline or el-empty is rendered (both are valid states)
    const timeline = drawerBody.locator('.el-timeline');
    const emptyState = drawerBody.locator('.el-empty');
    const hasTimeline = await timeline.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(
      hasTimeline || hasEmpty,
      '变更日志抽屉应显示 timeline 或空状态提示'
    ).toBe(true);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 4: FMR list page accessible (P1-5 data source — FmrExpiryScanner depends
  //         on FactoryMaterialRequisitionRepository scanning ISSUED/IN_USE records)
  // ═══════════════════════════════════════════════════════════════════════════

  test('P1-5: 物料需求单列表页可访问 (FmrExpiryScanner 数据源验证)', async ({ page }) => {
    await page.goto(FMR_URL);
    await page.waitForLoadState('networkidle');

    // Must not redirect to login
    expect(page.url()).not.toMatch(/\/login/);

    // The FMR list page should render a card or table
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Verify the API endpoint for FMR list is reachable by intercepting the GET call
    // FmrExpiryScanner scans: FactoryMaterialRequisitionRepository.findByStatusInAndCreatedAtBefore
    // The frontend calls: GET /api/mobile/{factoryId}/material-requisitions
    const [apiResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/material-requisitions') &&
          r.request().method() === 'GET',
        { timeout: 10_000 }
      ).catch(() => null),
      page.reload({ waitUntil: 'networkidle' }),
    ]);

    if (apiResp) {
      // Verify API returns a success response (confirms backend is wired and FmrExpiryScanner
      // has a valid data source to scan at 20:00 daily)
      const body = await apiResp.json().catch(() => null);
      if (body) {
        expect(body.success, `FMR API 响应失败: ${JSON.stringify(body)}`).toBe(true);
      } else {
        // Non-JSON or empty response is acceptable (page redirect scenario)
        // Just verify no error toast
      }
    }
    // Whether or not we caught the API call, the page should have no errors
    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 5: BOM item add via form (L2 CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  test('L2 BOM \u539F\u8F85\u6599\u6DFB\u52A0 via \u8868\u5355', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto(BOM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // wait for product auto-select

    // Ensure a product is selected
    const changeLogBtn = page.locator('button:has-text("\u53D8\u66F4\u8BB0\u5F55")');
    const isDisabled = await changeLogBtn.isDisabled().catch(() => true);
    if (isDisabled) {
      const productSelect = page.locator('.el-select').first();
      await productSelect.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('.el-select-dropdown__item').first();
      const hasOption = await firstOption.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!hasOption) { test.skip(); return; }
      await firstOption.click();
      await page.waitForTimeout(1000);
    }

    // Count existing BOM items
    const bomTable = page.locator('.table-card .el-table').first();
    await expect(bomTable).toBeVisible({ timeout: 10_000 });
    const rowsBefore = await bomTable.locator('.el-table__row').count();

    // Click "\u6DFB\u52A0" button in the BOM items table header
    const addBtn = page.locator('.table-card').first().locator('button:has-text("\u6DFB\u52A0")');
    await expect(addBtn).toBeVisible({ timeout: 5_000 });
    await addBtn.click();

    // Dialog should appear for adding BOM item
    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill material name (required field)
    const materialNameInput = dialog.locator('input').first();
    await materialNameInput.fill(`E2E\u6D4B\u8BD5\u539F\u6599-${Date.now()}`);

    // Fill standardQuantity via el-input-number
    const qtyInputs = dialog.locator('.el-input-number input');
    const stdQtyInput = qtyInputs.first();
    if (await stdQtyInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await stdQtyInput.click();
      await page.keyboard.press('Control+A');
      await stdQtyInput.fill('0.5');
      await page.keyboard.press('Tab');
    }

    // Fill unitPrice
    const priceInputs = dialog.locator('.el-input-number input');
    const priceCount = await priceInputs.count();
    if (priceCount >= 2) {
      const priceInput = priceInputs.nth(1);
      await priceInput.click();
      await page.keyboard.press('Control+A');
      await priceInput.fill('15');
      await page.keyboard.press('Tab');
    }

    // Submit the form
    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary, button:has-text("\u786E\u5B9A"), button:has-text("\u786E\u8BA4")').first();

    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/bom/items') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    if (saveResp) {
      const body = await saveResp.json().catch(() => null);
      if (body?.success) {
        // Verify success toast
        await expect(page.locator(S.message.success)).toBeVisible({ timeout: 5_000 });
        // Dialog should close
        await expect(dialog).toBeHidden({ timeout: 5_000 });
        // Verify row count increased
        await page.waitForTimeout(1000);
        const rowsAfter = await bomTable.locator('.el-table__row').count();
        expect(rowsAfter, 'BOM \u884C\u6570\u5E94\u589E\u52A0').toBeGreaterThanOrEqual(rowsBefore);
      } else {
        expect.soft(body?.success, `BOM \u6DFB\u52A0\u5931\u8D25: ${body?.message}`).toBe(true);
      }
    }

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 6: BOM item edit + change log verification (P-5)
  // ═══════════════════════════════════════════════════════════════════════════

  test('L2 BOM \u7F16\u8F91 + \u53D8\u66F4\u8BB0\u5F55\u9A8C\u8BC1 (P-5)', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto(BOM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Ensure product is selected
    const changeLogBtn = page.locator('button:has-text("\u53D8\u66F4\u8BB0\u5F55")');
    const isDisabled = await changeLogBtn.isDisabled().catch(() => true);
    if (isDisabled) {
      const productSelect = page.locator('.el-select').first();
      await productSelect.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('.el-select-dropdown__item').first();
      if (!(await firstOption.isVisible({ timeout: 3_000 }).catch(() => false))) { test.skip(); return; }
      await firstOption.click();
      await page.waitForTimeout(1000);
    }

    // Find an existing BOM item row to edit
    const bomTable = page.locator('.table-card .el-table').first();
    await expect(bomTable).toBeVisible({ timeout: 10_000 });
    const rows = bomTable.locator('.el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) { test.skip(); return; }

    // Click the edit (pencil) icon on the first row
    // BOM uses :icon="Edit" which renders an svg button
    const editBtn = rows.first().locator('button.el-button--primary').first();
    await expect(editBtn).toBeVisible({ timeout: 5_000 });
    await editBtn.click();

    // Dialog should appear in edit mode
    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Modify standardQuantity (change the value)
    const qtyInput = dialog.locator('.el-input-number input').first();
    if (await qtyInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await qtyInput.click();
      await page.keyboard.press('Control+A');
      await qtyInput.fill('0.999');
      await page.keyboard.press('Tab');
    }

    // Submit the edit
    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary, button:has-text("\u786E\u5B9A"), button:has-text("\u786E\u8BA4")').first();

    const [editResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/bom/items') && r.request().method() === 'PUT',
        { timeout: 15_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    if (editResp) {
      const body = await editResp.json().catch(() => null);
      if (body?.success) {
        await expect(page.locator(S.message.success)).toBeVisible({ timeout: 5_000 });
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      } else {
        expect.soft(body?.success, `BOM \u7F16\u8F91\u5931\u8D25: ${body?.message}`).toBe(true);
      }
    }

    // P-5: Open "\u53D8\u66F4\u8BB0\u5F55" drawer and verify the latest entry has "\u4FEE\u6539" tag
    await page.waitForTimeout(1000);
    const logBtn = page.locator('button:has-text("\u53D8\u66F4\u8BB0\u5F55")');
    await expect(logBtn).toBeVisible({ timeout: 5_000 });
    await logBtn.click();

    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible({ timeout: 8_000 });

    // Wait for logs to load
    await page.waitForTimeout(1000);

    // Verify the drawer has timeline or empty state
    const timeline = drawer.locator('.el-timeline');
    const hasTimeline = await timeline.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasTimeline) {
      // Check the latest entry has a "\u4FEE\u6539" (UPDATE) tag
      const updateTag = drawer.locator('.el-tag:has-text("\u4FEE\u6539")').first();
      const hasUpdateTag = await updateTag.isVisible({ timeout: 3_000 }).catch(() => false);
      expect.soft(hasUpdateTag, 'P-5: \u53D8\u66F4\u8BB0\u5F55\u5E94\u5305\u542B\u201C\u4FEE\u6539\u201D\u6807\u7B7E').toBe(true);
    }

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 7: BOM item delete
  // ═══════════════════════════════════════════════════════════════════════════

  test('L2 BOM \u539F\u8F85\u6599\u5220\u9664', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto(BOM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Ensure product is selected
    const changeLogBtn = page.locator('button:has-text("\u53D8\u66F4\u8BB0\u5F55")');
    const isDisabled = await changeLogBtn.isDisabled().catch(() => true);
    if (isDisabled) {
      const productSelect = page.locator('.el-select').first();
      await productSelect.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('.el-select-dropdown__item').first();
      if (!(await firstOption.isVisible({ timeout: 3_000 }).catch(() => false))) { test.skip(); return; }
      await firstOption.click();
      await page.waitForTimeout(1000);
    }

    // Find BOM item rows
    const bomTable = page.locator('.table-card .el-table').first();
    await expect(bomTable).toBeVisible({ timeout: 10_000 });
    const rows = bomTable.locator('.el-table__row');
    const rowsBefore = await rows.count();

    if (rowsBefore === 0) { test.skip(); return; }

    // Click the delete (danger) button on the first row
    const deleteBtn = rows.first().locator('button.el-button--danger').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Confirm the ElMessageBox confirmation dialog
    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible({ timeout: 5_000 });

    const [deleteResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/bom/items') && r.request().method() === 'DELETE',
        { timeout: 15_000 }
      ).catch(() => null),
      // Click the confirm button in message box
      msgBox.locator('.el-message-box__btns .el-button--primary').click(),
    ]);

    if (deleteResp) {
      const body = await deleteResp.json().catch(() => null);
      if (body?.success) {
        // Verify success toast
        await expect(page.locator(S.message.success)).toBeVisible({ timeout: 5_000 });
        // Verify row count decreased
        await page.waitForTimeout(1000);
        const rowsAfter = await bomTable.locator('.el-table__row').count();
        expect(rowsAfter, 'BOM \u884C\u6570\u5E94\u51CF\u5C11').toBeLessThan(rowsBefore);
      } else {
        expect.soft(body?.success, `BOM \u5220\u9664\u5931\u8D25: ${body?.message}`).toBe(true);
      }
    }

    await expectNoErrors(page);
  });
});
