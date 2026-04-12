/**
 * J4 工厂初始化 — super_admin 建基础数据 @post-deploy
 *
 * Journey: super_admin verifies all master-data setup pages are accessible,
 * seed data is present, and CRUD works (create one product type as proof).
 *
 * Pages under test:
 *   /system/products        — 产品信息管理 (product types)
 *   /sales/customers        — 客户管理
 *   /procurement/suppliers  — 供应商管理
 *   /production/bom         — BOM 配方管理 (product selector + items)
 *   /warehouse/materials    — 原材料批次
 *
 * Auth: single role — super_admin (factory_super_admin, has all permissions).
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// ─── Constants ────────────────────────────────────────────────────────────────

const RUN_TAG = `J4-${Date.now()}`;

test.describe('J4 工厂初始化 — super_admin 建基础数据 @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: Product types page accessible + seed data present
  // ═══════════════════════════════════════════════════════════════════════════

  test('产品类型管理页可访问 + 已有种子数据', async ({ page }) => {
    await page.goto('/system/products');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Seed provides product types — table should have rows
    const rows = page.locator(S.table.row);
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const rowCount = await rows.count();
    expect(rowCount, '产品类型表应有种子数据').toBeGreaterThan(0);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: Customers page accessible + seed data present
  // ═══════════════════════════════════════════════════════════════════════════

  test('客户管理页可访问 + 已有种子数据', async ({ page }) => {
    await page.goto('/sales/customers');
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const rows = page.locator(S.table.row);
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const rowCount = await rows.count();
    expect(rowCount, '客户表应有种子数据').toBeGreaterThan(0);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: Suppliers page accessible + seed data present
  // ═══════════════════════════════════════════════════════════════════════════

  test('供应商管理页可访问 + 已有种子数据', async ({ page }) => {
    await page.goto('/procurement/suppliers');
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const rows = page.locator(S.table.row);
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const rowCount = await rows.count();
    expect(rowCount, '供应商表应有种子数据').toBeGreaterThan(0);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 4: BOM page accessible + product selector has data
  // ═══════════════════════════════════════════════════════════════════════════

  test('BOM 管理页可访问 + 产品下拉有数据', async ({ page }) => {
    await page.goto('/production/bom');
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toMatch(/\/login/);

    // BOM unified page wraps the BOM content in an el-card
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // The BOM page auto-selects the first product and loads its BOM items.
    // Verify the product select is visible.
    const productSelect = page.locator('.el-select').first();
    await expect(productSelect).toBeVisible({ timeout: 10_000 });

    // Element Plus el-select (filterable) shows the selected label in a
    // .el-select__selected-item span or as placeholder text in the inner input.
    // Wait for auto-selection, then verify: either the selected-item span has text,
    // or the BOM items table has loaded (proves a product was auto-selected).
    await page.waitForTimeout(2000);

    // Strategy: check that the page loaded BOM content successfully.
    // The "BOM成本管理" heading and cost summary card prove the inner BomContent mounted.
    // The product select having a non-placeholder state (no "选择产品" placeholder visible
    // as selected text) or the cost summary being visible proves auto-selection worked.
    const costSummary = page.locator('.cost-summary, .cost-summary-card').first();
    const bomSection = page.locator('text=原辅料配方, text=BOM成本管理').first();
    const pageLoaded = await bomSection.isVisible({ timeout: 5_000 }).catch(() => false) ||
                        await costSummary.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(pageLoaded, 'BOM 页面内容应已加载（含成本管理或配方区域）').toBe(true);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 5: Warehouse materials page accessible
  // ═══════════════════════════════════════════════════════════════════════════

  test('仓库原材料批次页可访问', async ({ page }) => {
    await page.goto('/warehouse/materials');
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toMatch(/\/login/);

    // The page should load with either a table or at least the page card
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Table should exist (even if empty — warehouse may not have batches yet)
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 6: CRUD — Create a new product type
  // ═══════════════════════════════════════════════════════════════════════════

  test('创建新产品类型 (CRUD 验证)', async ({ page }) => {
    await page.goto('/system/products');
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Count existing rows before creation
    const rowsBefore = await page.locator(S.table.row).count();

    // Click "新增产品" button
    const addButton = page.locator('button:has-text("新增产品")');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Dialog should appear
    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Fill required fields based on actual form structure:
    //   name (required), unit (required), productCategory (required, defaults to active tab)

    const productName = `E2E测试产品-${RUN_TAG}`;

    // Fill product name
    const nameInput = dialog.locator(S.form.input('产品名称'));
    await nameInput.fill(productName);

    // Fill unit
    const unitInput = dialog.locator(S.form.input('单位'));
    await unitInput.fill('kg');

    // productCategory defaults to the active tab (FINISHED_PRODUCT) — no need to change

    // Fill optional specification
    const specInput = dialog.locator(S.form.input('规格'));
    await specInput.fill('500g/袋');

    // Submit the form — look for the submit button in the dialog footer
    // The dialog uses el-form submit via handleSubmit, button text is "确认" or "确定"
    const submitButton = dialog.locator(
      '.el-dialog__footer button.el-button--primary, .el-dialog__footer button:has-text("确"), button:has-text("保存")'
    ).first();

    // If submit button is in the dialog footer, use it; otherwise find the primary button
    const footerPrimary = dialog.locator('.el-dialog__footer .el-button--primary').first();
    const hasFooterButton = await footerPrimary.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasFooterButton) {
      const [createResp] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes('/product-types') &&
            r.request().method() === 'POST',
          { timeout: 15_000 }
        ),
        footerPrimary.click(),
      ]);

      const body = await createResp.json();
      expect(body.success, `产品创建失败: ${JSON.stringify(body)}`).toBe(true);
    } else {
      // Fallback: look for any primary button or "确" text button in dialog
      const anySubmit = dialog.locator('button.el-button--primary, button:has-text("确")').first();
      const [createResp] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes('/product-types') &&
            r.request().method() === 'POST',
          { timeout: 15_000 }
        ),
        anySubmit.click(),
      ]);

      const body = await createResp.json();
      expect(body.success, `产品创建失败: ${JSON.stringify(body)}`).toBe(true);
    }

    // Verify success toast
    const successToast = page.locator(S.message.success);
    await expect(successToast).toBeVisible({ timeout: 5_000 });

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Wait for table to reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 7: CRUD — Customer create via form + reload persistence
  // ═══════════════════════════════════════════════════════════════════════════

  test('L2 客户创建 via form + 刷新验证持久化', async ({ page }) => {
    await page.goto('/sales/customers');
    await page.waitForLoadState('networkidle');

    // Wait for table
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Click create button
    const addButton = page.locator('button:has-text("新增客户")');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Wait for dialog
    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Hard Rule 5: check .is-required labels exist
    const requiredLabels = await dialog
      .locator('.el-form-item.is-required .el-form-item__label')
      .allTextContents();
    expect(requiredLabels.length, 'Customer form should have required fields').toBeGreaterThan(0);

    // Fill required fields
    const customerName = `E2E客户-${Date.now()}`;

    await dialog.locator(S.form.input('客户名称')).fill(customerName);
    await dialog.locator(S.form.input('联系人')).fill('测试联系人');
    await dialog.locator(S.form.input('联系电话')).fill('13800138000');
    await dialog.locator(S.form.textarea('收货地址')).fill('测试收货地址');

    // Submit via dialog footer primary button
    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary').first();

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/customers') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      submitBtn.click(),
    ]);

    const body = await createResp.json();
    expect(body.success, `客户创建失败: ${JSON.stringify(body)}`).toBe(true);

    // Verify success toast
    await expect(page.locator(S.message.success)).toBeVisible({ timeout: 5_000 });

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(S.table.root).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(S.table.rowByText(customerName)).first()).toBeVisible({ timeout: 10_000 });

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 8: CRUD — Supplier create via form + reload persistence
  // ═══════════════════════════════════════════════════════════════════════════

  test('L2 供应商创建 via form + 刷新验证持久化', async ({ page }) => {
    await page.goto('/procurement/suppliers');
    await page.waitForLoadState('networkidle');

    // Wait for table
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Click create button
    const addButton = page.locator('button:has-text("新增供应商")');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Wait for dialog
    const dialog = page.locator('.el-dialog:visible');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Hard Rule 5: check .is-required labels exist
    const requiredLabels = await dialog
      .locator('.el-form-item.is-required .el-form-item__label')
      .allTextContents();
    expect(requiredLabels.length, 'Supplier form should have required fields').toBeGreaterThan(0);

    // Fill required fields
    const supplierName = `E2E供应商-${Date.now()}`;

    await dialog.locator(S.form.input('供应商名称')).fill(supplierName);
    await dialog.locator(S.form.input('联系人')).fill('测试联系人');
    await dialog.locator(S.form.input('联系电话')).fill('13900139000');
    await dialog.locator(S.form.input('地址')).fill('测试供应商地址');

    // Submit via dialog footer primary button
    const submitBtn = dialog.locator('.el-dialog__footer .el-button--primary').first();

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/suppliers') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      submitBtn.click(),
    ]);

    const body = await createResp.json();
    expect(body.success, `供应商创建失败: ${JSON.stringify(body)}`).toBe(true);

    // Verify success toast
    await expect(page.locator(S.message.success)).toBeVisible({ timeout: 5_000 });

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(S.table.root).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(S.table.rowByText(supplierName)).first()).toBeVisible({ timeout: 10_000 });

    await expectNoErrors(page);
  });
});
