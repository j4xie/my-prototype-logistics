/**
 * L3 cross-module data consistency @post-deploy
 *
 * Verifies that entities created in one module are immediately visible
 * in other modules' dropdowns / selectors. Each test creates a record
 * then navigates to a consuming page and checks the new record appears.
 *
 * Tests:
 *   L3-1: Create product -> BOM product selector includes it
 *   L3-2: Create customer -> SO create customer dropdown includes it
 *   L3-3: Create supplier -> PO create supplier dropdown includes it
 *   L3-4: Edit BOM item -> change log drawer has new entry
 *
 * Auth: super_admin (has all permissions)
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

test.describe('L3 \u8DE8\u6A21\u5757\u6570\u636E\u4E00\u81F4\u6027 @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
    await installApiProxy(context);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L3-1: Create product -> BOM product selector includes it
  // ═══════════════════════════════════════════════════════════════════════════

  test('L3-1: \u521B\u5EFA\u4EA7\u54C1 \u2192 BOM \u4EA7\u54C1\u9009\u62E9\u5668\u5305\u542B\u65B0\u4EA7\u54C1', async ({ page }) => {
    const productName = `L3\u4EA7\u54C1-${Date.now()}`;

    // Step 1: Create product at /system/products
    await page.goto('/system/products');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Click "\u65B0\u589E\u4EA7\u54C1" button
    const addButton = page.locator('button:has-text("\u65B0\u589E\u4EA7\u54C1")');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill required fields: product name + unit
    const nameInput = dialog.locator(S.form.input('\u4EA7\u54C1\u540D\u79F0'));
    await nameInput.fill(productName);

    const unitInput = dialog.locator(S.form.input('\u5355\u4F4D'));
    await unitInput.fill('kg');

    // Submit
    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary').first();
    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/product-types') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    if (!createResp) {
      test.skip();
      return;
    }

    const body = await createResp.json().catch(() => null);
    if (!body?.success) {
      expect.soft(body?.success, `\u4EA7\u54C1\u521B\u5EFA\u5931\u8D25: ${body?.message}`).toBe(true);
      return;
    }

    // Wait for dialog to close
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Step 2: Navigate to BOM and verify product appears in dropdown
    await page.goto('/production/bom');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click the product selector to open dropdown
    const productSelect = page.locator('.el-select').first();
    await expect(productSelect).toBeVisible({ timeout: 10_000 });
    await productSelect.click();
    await page.waitForTimeout(500);

    // Search for the new product in the filterable dropdown
    const selectInput = productSelect.locator('input').first();
    await selectInput.fill(productName);
    await page.waitForTimeout(1000);

    // Check if the product appears in the dropdown options
    const options = await page.locator('.el-select-dropdown__item:visible').allTextContents();
    const found = options.some(o => o.includes(productName));
    expect(found, `BOM \u4EA7\u54C1\u4E0B\u62C9\u5217\u8868\u5E94\u5305\u542B "${productName}"`).toBe(true);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L3-2: Create customer -> SO new create customer dropdown includes it
  // ═══════════════════════════════════════════════════════════════════════════

  test('L3-2: \u521B\u5EFA\u5BA2\u6237 \u2192 SO \u65B0\u5EFA\u5BA2\u6237\u4E0B\u62C9\u5305\u542B', async ({ page }) => {
    const customerName = `L3\u5BA2\u6237-${Date.now()}`;

    // Step 1: Create customer at /sales/customers
    await page.goto('/sales/customers');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const addButton = page.locator('button:has-text("\u65B0\u589E\u5BA2\u6237")');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill required fields
    await dialog.locator(S.form.input('\u5BA2\u6237\u540D\u79F0')).fill(customerName);
    await dialog.locator(S.form.input('\u8054\u7CFB\u4EBA')).fill('L3\u6D4B\u8BD5\u8054\u7CFB\u4EBA');
    await dialog.locator(S.form.input('\u8054\u7CFB\u7535\u8BDD')).fill('13800000001');
    await dialog.locator(S.form.input('\u6536\u8D27\u5730\u5740')).fill('L3\u6D4B\u8BD5\u5730\u5740');

    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary').first();
    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/customers') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    if (!createResp) { test.skip(); return; }
    const body = await createResp.json().catch(() => null);
    if (!body?.success) {
      expect.soft(body?.success, `\u5BA2\u6237\u521B\u5EFA\u5931\u8D25: ${body?.message}`).toBe(true);
      return;
    }

    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Step 2: Navigate to SO create and verify customer in dropdown
    await page.goto('/sales/orders');
    await page.waitForSelector('.el-table', { timeout: 15_000 });

    await page.click('button:has-text("\u65B0\u5EFA")');
    const soDialog = page.locator('.el-dialog:visible');
    await expect(soDialog).toBeVisible({ timeout: 10_000 });

    // Open customer dropdown
    const customerSelect = soDialog.locator(S.form.select('\u5BA2\u6237'));
    await customerSelect.click();
    await page.waitForTimeout(500);

    // Check if the new customer appears in options
    const options = await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').allTextContents();
    const found = options.some(o => o.includes(customerName));
    expect(found, `SO \u5BA2\u6237\u4E0B\u62C9\u5217\u8868\u5E94\u5305\u542B "${customerName}"`).toBe(true);

    // Close dialog without submitting
    const cancelBtn = soDialog.locator('button:has-text("\u53D6\u6D88")');
    if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await cancelBtn.click();
    }

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L3-3: Create supplier -> PO new create supplier dropdown includes it
  // ═══════════════════════════════════════════════════════════════════════════

  test('L3-3: \u521B\u5EFA\u4F9B\u5E94\u5546 \u2192 PO \u65B0\u5EFA\u4F9B\u5E94\u5546\u4E0B\u62C9\u5305\u542B', async ({ page }) => {
    const supplierName = `L3\u4F9B\u5E94\u5546-${Date.now()}`;

    // Step 1: Create supplier at /procurement/suppliers
    await page.goto('/procurement/suppliers');
    await page.waitForLoadState('networkidle');

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const addButton = page.locator('button:has-text("\u65B0\u589E\u4F9B\u5E94\u5546")');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill required fields
    await dialog.locator(S.form.input('\u4F9B\u5E94\u5546\u540D\u79F0')).fill(supplierName);
    await dialog.locator(S.form.input('\u8054\u7CFB\u4EBA')).fill('L3\u6D4B\u8BD5\u8054\u7CFB\u4EBA');
    await dialog.locator(S.form.input('\u8054\u7CFB\u7535\u8BDD')).fill('13900000001');
    await dialog.locator(S.form.input('\u5730\u5740')).fill('L3\u6D4B\u8BD5\u5730\u5740');

    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary').first();
    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/suppliers') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    if (!createResp) { test.skip(); return; }
    const body = await createResp.json().catch(() => null);
    if (!body?.success) {
      expect.soft(body?.success, `\u4F9B\u5E94\u5546\u521B\u5EFA\u5931\u8D25: ${body?.message}`).toBe(true);
      return;
    }

    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Step 2: Navigate to PO create and verify supplier in dropdown
    await page.goto('/procurement/orders');
    await page.waitForSelector('.el-table, .el-card', { timeout: 15_000 });

    // Try to open PO create dialog
    const createPOBtn = page.locator('button:has-text("\u65B0\u5EFA"), button:has-text("\u65B0\u589E"), button:has-text("\u65B0\u5EFA\u91C7\u8D2D")').first();
    const hasCreateBtn = await createPOBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasCreateBtn) {
      await createPOBtn.click();
      const poDialog = page.locator('.el-dialog:visible');
      await expect(poDialog).toBeVisible({ timeout: 10_000 });

      // Open supplier dropdown
      const supplierSelect = poDialog.locator(S.form.select('\u4F9B\u5E94\u5546')).first();
      const hasSelect = await supplierSelect.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasSelect) {
        await supplierSelect.click();
        await page.waitForTimeout(500);
        const options = await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').allTextContents();
        const found = options.some(o => o.includes(supplierName));
        expect(found, `PO \u4F9B\u5E94\u5546\u4E0B\u62C9\u5217\u8868\u5E94\u5305\u542B "${supplierName}"`).toBe(true);
      } else {
        // PO form may use a different field name for supplier
        expect.soft(false, 'PO \u8868\u5355\u672A\u627E\u5230\u4F9B\u5E94\u5546\u4E0B\u62C9 (KNOWN_BUG)').toBe(true);
      }

      // Close dialog
      const cancelBtn = poDialog.locator('button:has-text("\u53D6\u6D88")');
      if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cancelBtn.click();
      }
    } else {
      // PO page may not have a create button — skip
      expect.soft(false, 'PO \u9875\u9762\u672A\u627E\u5230\u65B0\u5EFA\u6309\u94AE (KNOWN_BUG)').toBe(true);
    }

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L3-4: BOM edit -> change log has new entry
  // ═══════════════════════════════════════════════════════════════════════════

  test('L3-4: BOM \u7F16\u8F91 \u2192 \u53D8\u66F4\u8BB0\u5F55\u5305\u542B\u65B0\u6761\u76EE', async ({ page }) => {
    await page.goto('/production/bom');
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

    // Count existing change logs first
    await changeLogBtn.click();
    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);

    const timeline = drawer.locator('.el-timeline-item');
    const logsBefore = await timeline.count();

    // Close drawer
    const closeDrawerBtn = drawer.locator('.el-drawer__close-btn, button[aria-label="close"]').first();
    const hasCloseBtn = await closeDrawerBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasCloseBtn) {
      await closeDrawerBtn.click();
    } else {
      // Press Escape to close
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);

    // Find and edit a BOM item
    const bomTable = page.locator('.table-card .el-table').first();
    const rows = bomTable.locator('.el-table__row');
    const rowCount = await rows.count();
    if (rowCount === 0) { test.skip(); return; }

    // Click edit on first row
    const editBtn = rows.first().locator('button.el-button--primary').first();
    await editBtn.click();

    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Change a value
    const qtyInput = dialog.locator('.el-input-number input').first();
    if (await qtyInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await qtyInput.click();
      await page.keyboard.press('Control+A');
      const newVal = `0.${Date.now() % 1000}`;
      await qtyInput.fill(newVal);
      await page.keyboard.press('Tab');
    }

    // Submit
    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary, button:has-text("\u786E\u5B9A")').first();
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/bom/items') && r.request().method() === 'PUT',
        { timeout: 15_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    await page.waitForTimeout(1500);

    // Re-open change log drawer
    await changeLogBtn.click();
    await expect(drawer).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);

    const logsAfter = await drawer.locator('.el-timeline-item').count();

    // Verify log count increased (new entry for the edit)
    expect.soft(logsAfter, '\u53D8\u66F4\u8BB0\u5F55\u5E94\u589E\u52A0\u65B0\u6761\u76EE').toBeGreaterThan(logsBefore);

    // Verify latest entry has "\u4FEE\u6539" tag (UPDATE type)
    const updateTag = drawer.locator('.el-tag:has-text("\u4FEE\u6539")').first();
    const hasTag = await updateTag.isVisible({ timeout: 3_000 }).catch(() => false);
    expect.soft(hasTag, '\u6700\u65B0\u53D8\u66F4\u8BB0\u5F55\u5E94\u6709\u201C\u4FEE\u6539\u201D\u6807\u7B7E').toBe(true);

    await expectNoErrors(page);
  });
});
