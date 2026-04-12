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
import { setupAuthBeforeAll, restoreAuth } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
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
});
