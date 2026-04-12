/**
 * J9 员工工序片段 Web 主管视图 — super_admin @post-deploy
 *
 * P1-1 Web side: Workshop supervisor views active employee process segments.
 * The RN scan (clockin/clockout) is deferred (hardware-gated). This spec covers:
 *
 *   Test 1: Production management page (/production/batches) — accessible + shows table
 *   Test 2: Employee process segments API — GET /workreport/segments/active returns valid response
 *   Test 3: Production approval page (/production/approval) — supervisor can view work reports
 *
 * Auth: super_admin (factory_super_admin — has full permissions; workshop_supervisor is MOBILE_ONLY
 *       per guards.ts, cannot log in to web-admin).
 *
 * API route: /api/mobile/{factoryId}/workreport/segments/active
 * Factory: F_E2E_TEST
 */

import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth } from '../helpers/auth-cache';
import { expectNoErrors } from '../helpers/assertions';
import { S } from '../helpers/selectors';

// ─── Constants ────────────────────────────────────────────────────────────────

const FACTORY_ID = 'F_E2E_TEST';

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('J9 员工工序片段 Web 主管视图 @post-deploy', () => {

  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: Production management page accessible
  // ═══════════════════════════════════════════════════════════════════════════

  test('生产管理页 /production/batches 可访问 + 显示批次表格', async ({ page }) => {
    await page.goto('/production/batches');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login
    expect(page.url()).not.toMatch(/\/login/);
    // Should NOT redirect to /mobile-only (super_admin is not mobile-only)
    expect(page.url()).not.toMatch(/\/mobile-only/);

    // Table container should appear (may be empty if no batches seeded)
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: Employee process segments API returns valid response
  // ═══════════════════════════════════════════════════════════════════════════

  test('员工工序片段 API GET /workreport/segments/active 返回成功', async ({ page }) => {
    // Navigate to any authenticated page to ensure auth cookies are active
    await page.goto('/production/plans');
    await page.waitForLoadState('networkidle');

    // Directly call the employee process segments API via fetch in page context.
    // The installApiProxy in restoreAuth will forward /api/mobile/** to :10010.
    const result = await page.evaluate(async (factoryId) => {
      const resp = await fetch(`/api/mobile/${factoryId}/workreport/segments/active`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await resp.json();
      return { status: resp.status, success: json.success, hasData: Array.isArray(json.data) };
    }, FACTORY_ID);

    expect(result.status, `API 返回 HTTP ${result.status}, 期望 200`).toBe(200);
    expect(result.success, `API success 应为 true, 返回: ${JSON.stringify(result)}`).toBe(true);
    expect(result.hasData, 'API data 应为数组 (active segments list)').toBe(true);

    await expectNoErrors(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: Production approval page (supervisor work report view)
  // ═══════════════════════════════════════════════════════════════════════════

  test('报工审批页 /production/approval 可访问 + 主管视图渲染', async ({ page }) => {
    await page.goto('/production/approval');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to /login or /mobile-only
    expect(page.url()).not.toMatch(/\/login/);
    expect(page.url()).not.toMatch(/\/mobile-only/);

    // The page wraps content in an el-card
    const card = page.locator('.el-card').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Page header "报工审批" should be visible
    const heading = page.locator('text=报工审批').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Table should exist (may be empty — no pending approvals in fresh seed)
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 10_000 });

    await expectNoErrors(page);
  });
});
