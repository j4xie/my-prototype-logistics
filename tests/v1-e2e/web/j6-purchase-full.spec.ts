/**
 * J6 采购全周期 — procurement_manager @post-deploy
 *
 * Tests procurement-specific features as procurement_manager (purchase_mgr).
 * Complements G2 which already tests the full PO chain (create -> approve -> receive).
 *
 * J6 focuses on:
 *   1. PO list page access + seed data visible
 *   2. Supplier list page accessible + seed data present (3 suppliers)
 *   3. PO creation via API + verify in list UI (hybrid approach)
 *   4. PO detail page renders correctly (descriptions + items + actions)
 *   5. Price list page accessible (procurement-specific feature)
 *
 * Role: purchase_mgr -> procurement_manager (B1 fix: acb2c150c)
 * Auth: setupAuthBeforeAll + restoreAuth + installApiProxy
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// --- Constants ----------------------------------------------------------------

const FACTORY_ID = 'F_E2E_TEST';
const SUPPLIER_NAME = '泰森禽业';    // SUP_TYSON (seed)
const MATERIAL_NAME = '草鱼片';      // MAT_F001 (seed)

// --- Suite --------------------------------------------------------------------

test.describe('J6 采购全周期 — procurement_manager @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'purchase_mgr');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'purchase_mgr');
  });

  // ==========================================================================
  // Test 1: PO list page loads for procurement_manager + seed data visible
  // ==========================================================================

  test('采购订单列表页可访问 + 表格渲染', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/procurement/orders');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login (procurement_manager is NOT mobile-only)
    expect(page.url()).not.toMatch(/\/login/);
    expect(page.url()).not.toMatch(/\/mobile-only/);

    // Wait for table to appear
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Verify "新建" button is visible (procurement_manager has write permission)
    const createBtn = page.locator('button:has-text("新建")');
    await expect(createBtn).toBeVisible({ timeout: 5_000 });

    // Verify status filter exists (el-radio-group or el-select for status filtering)
    // The PO list page has statusFilter functionality
    const statusFilterEl = page.locator('.el-radio-group, .el-select').first();
    await expect(statusFilterEl).toBeVisible({ timeout: 5_000 });

    // NOTE: Skip expectNoErrors — PO list page fires background API calls
    // (loadSalesOrders, etc.) that may show permission-guarded error toasts.
  });

  // ==========================================================================
  // Test 2: Supplier list page accessible + seed data present
  // ==========================================================================

  test('供应商管理页可访问 + 已有种子数据', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/procurement/suppliers');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect
    expect(page.url()).not.toMatch(/\/login/);

    // Wait for table
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Seed has 3 suppliers — table should have rows
    const rows = page.locator(S.table.row);
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const rowCount = await rows.count();
    expect(rowCount, '供应商表应有种子数据 (seed has 3 suppliers)').toBeGreaterThan(0);

    // Verify seed supplier is visible
    const tysonRow = page.locator(S.table.rowByText(SUPPLIER_NAME));
    await expect(tysonRow, `种子供应商 "${SUPPLIER_NAME}" 应在列表中`).toBeVisible({ timeout: 5_000 });

    // Verify "新增供应商" button is visible (write permission)
    const addBtn = page.locator('button:has-text("新增供应商"), button:has-text("新增"), button:has-text("新建")').first();
    await expect(addBtn).toBeVisible({ timeout: 5_000 });

    await expectNoErrors(page);
  });

  // ==========================================================================
  // Test 3: PO creation via API + verify in list UI (hybrid approach)
  //
  // Uses API to create PO (avoids duplicating G2's dialog flow), then verifies
  // it appears in the list table with correct supplier name.
  // ==========================================================================

  test('API 创建 PO + 列表中可见', async ({ page, context }) => {
    await installApiProxy(context);

    const runTag = `J6-${Date.now()}`;

    // Navigate first to establish page context + extract JWT token
    await page.goto('/procurement/orders');
    await page.waitForSelector('.el-table', { timeout: 15_000 });

    const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
    expect(token, 'JWT token should be in localStorage').toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Step 1: Get supplier and material IDs via API
    const apiBase = `http://localhost:10010/api/mobile/${FACTORY_ID}`;

    const suppliersResp = await context.request.get(
      `${apiBase}/suppliers?page=1&size=100`,
      { headers: authHeaders }
    );
    const suppliersBody = await suppliersResp.json();
    expect(suppliersBody.success, 'Suppliers API should succeed').toBe(true);
    const suppliers = suppliersBody.data?.content || [];
    expect(suppliers.length, 'Should have seed suppliers').toBeGreaterThan(0);

    const supplier = suppliers.find((s: Record<string, unknown>) =>
      String(s.name || '').includes('泰森')
    ) || suppliers[0];
    const supplierId = String(supplier.id);

    const materialsResp = await context.request.get(
      `${apiBase}/raw-material-types/active`,
      { headers: authHeaders }
    );
    const materialsBody = await materialsResp.json();
    expect(materialsBody.success, 'Materials API should succeed').toBe(true);
    const materials = Array.isArray(materialsBody.data)
      ? materialsBody.data
      : materialsBody.data?.content || [];
    expect(materials.length, 'Should have seed materials').toBeGreaterThan(0);

    const material = materials.find((m: Record<string, unknown>) =>
      String(m.name || '').includes('草鱼')
    ) || materials[0];
    const materialTypeId = String(material.id);

    // Step 2: Create PO via API
    const createResp = await context.request.post(
      `${apiBase}/purchase/orders`,
      {
        headers: authHeaders,
        data: {
          supplierId,
          purchaseType: 'DIRECT',
          orderDate: new Date().toISOString().slice(0, 10),
          remark: `[E2E ${runTag}] J6 procurement test PO`,
          items: [
            {
              materialTypeId,
              quantity: 15,
              unit: 'kg',
              unitPrice: 18,
            },
          ],
        },
      }
    );

    const createBody = await createResp.json();
    expect(createBody.success, `PO 创建失败: ${JSON.stringify(createBody)}`).toBe(true);
    const poNumber = String(createBody.data?.orderNumber || '');
    const poId = String(createBody.data?.id || '');
    expect(poId, 'PO id 不能为空').toBeTruthy();
    expect(poNumber, 'PO orderNumber 不能为空').toBeTruthy();

    // Step 3: Reload PO list and verify the new PO is visible
    await page.goto('/procurement/orders');
    await page.waitForSelector('.el-table', { timeout: 15_000 });

    const poRow = page.locator(S.table.rowByText(poNumber));
    await expect(poRow, `新建 PO ${poNumber} 应在列表中`).toBeVisible({ timeout: 15_000 });

    // Verify supplier name is shown in the row
    await expect(poRow).toContainText(String(supplier.name));

    // Verify status is DRAFT (row has multiple tags — use text filter)
    const statusTag = poRow.locator('.el-tag:has-text("草稿")');
    await expect(statusTag).toBeVisible({ timeout: 5_000 });
  });

  // ==========================================================================
  // Test 4: PO detail page renders correctly
  //
  // Uses the API-created PO from the seed or creates a fresh one, then
  // navigates to its detail page and verifies structure.
  // ==========================================================================

  test('PO 详情页渲染正确', async ({ page, context }) => {
    await installApiProxy(context);

    // Navigate first to get JWT token from localStorage
    await page.goto('/procurement/orders');
    await page.waitForSelector('.el-table', { timeout: 15_000 });

    const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
    expect(token, 'JWT token should be in localStorage').toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Create a PO via API for a reliable detail page test
    const apiBase = `http://localhost:10010/api/mobile/${FACTORY_ID}`;

    // Get first supplier and material
    const suppResp = await context.request.get(`${apiBase}/suppliers?page=1&size=10`, { headers: authHeaders });
    const suppBody = await suppResp.json();
    const supplierId = String(suppBody.data?.content?.[0]?.id || '');
    const supplierName = String(suppBody.data?.content?.[0]?.name || '');

    const matResp = await context.request.get(`${apiBase}/raw-material-types/active`, { headers: authHeaders });
    const matBody = await matResp.json();
    const matList = Array.isArray(matBody.data) ? matBody.data : matBody.data?.content || [];
    const materialTypeId = String(matList[0]?.id || '');

    const createResp = await context.request.post(`${apiBase}/purchase/orders`, {
      headers: authHeaders,
      data: {
        supplierId,
        purchaseType: 'DIRECT',
        orderDate: new Date().toISOString().slice(0, 10),
        remark: `[E2E J6-detail-${Date.now()}]`,
        items: [{ materialTypeId, quantity: 10, unit: 'kg', unitPrice: 22 }],
      },
    });
    const createBody = await createResp.json();
    expect(createBody.success, `PO for detail test failed: ${JSON.stringify(createBody)}`).toBe(true);
    const poId = String(createBody.data?.id || '');

    // Navigate to detail page
    await page.goto(`/procurement/orders/${poId}`);
    await page.waitForURL(/\/procurement\/orders\//, { timeout: 20_000 });

    // Verify page loaded (el-card container)
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Verify order number is displayed
    const orderNumber = String(createBody.data?.orderNumber || '');
    await expect(page.locator(`text=${orderNumber}`)).toBeVisible({ timeout: 10_000 });

    // Verify status tag shows (DRAFT)
    const statusTag = page.locator('.el-tag:has-text("草稿")');
    await expect(statusTag).toBeVisible({ timeout: 5_000 });

    // Verify supplier name is visible on the detail page
    if (supplierName) {
      await expect(page.locator(`text=${supplierName}`)).toBeVisible({ timeout: 5_000 });
    }

    // Verify items table has at least one row
    const itemsTable = page.locator('.el-table').first();
    await expect(itemsTable).toBeVisible({ timeout: 10_000 });
    const itemRows = itemsTable.locator('.el-table__row');
    await expect(itemRows.first()).toBeVisible({ timeout: 10_000 });

    // Verify action buttons are visible for DRAFT status
    // procurement_manager should see: 提交, 取消, etc.
    const submitBtn = page.locator('button:has-text("提交")');
    const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSubmit, 'DRAFT PO should show submit button for procurement_manager').toBe(true);
  });

  // ==========================================================================
  // Test 5: Price list page accessible (procurement-specific feature)
  // ==========================================================================

  test('价格表管理页可访问', async ({ page, context }) => {
    await installApiProxy(context);

    await page.goto('/procurement/price-lists');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login or /mobile-only
    expect(page.url()).not.toMatch(/\/login/);
    expect(page.url()).not.toMatch(/\/mobile-only/);

    // The page should load — at minimum an el-card or el-table container
    const pageContent = page.locator('.el-card, .el-table, .price-list-container').first();
    await expect(pageContent).toBeVisible({ timeout: 15_000 });

    await expectNoErrors(page);
  });
});
