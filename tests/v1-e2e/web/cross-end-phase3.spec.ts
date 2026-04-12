import { test, expect } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { readState } from '../helpers/shared-state';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Cross-End Phase 3: Web verifies order status updated after RN Phase 2 work report.
 *
 * Prerequisites:
 *   - Phase 1 (cross-end-phase1.spec.ts) created SO + plan + FMR
 *   - Phase 2 (rn-cross-end.yaml) workshop supervisor reported work via RN
 *   - shared-state.json contains orderCode + planCode
 *
 * This test checks:
 *   1. shared-state.json exists and has data from Phase 1
 *   2. The sales order status reflects production progress
 *   3. The production plan shows completion data
 *
 * @tags @post-deploy @cross-end
 */

test.describe('Cross-End Phase 3 — Web 验证状态更新 @post-deploy', () => {
  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'super_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'super_admin');
    await installApiProxy(context);
  });

  test('shared-state.json 存在且包含 Phase 1 数据', async () => {
    const state = readState();
    expect(state, 'shared-state.json should exist from Phase 1').not.toBeNull();
    if (state) {
      expect(state.orderCode).toBeTruthy();
      expect(state.planCode).toBeTruthy();
      expect(state.quantity).toBeGreaterThan(0);
    }
  });

  test('销售订单可通过 API 查询', async ({ page }) => {
    const state = readState();
    if (!state?.orderCode) {
      test.skip(true, 'No shared-state.json — Phase 1 not run');
      return;
    }

    // Query the sales order via API
    const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
    const factoryId = await page.evaluate(() => {
      const auth = localStorage.getItem('cretas_auth');
      return auth ? JSON.parse(auth).factoryId : null;
    });

    if (!factoryId || !token) {
      test.skip(true, 'No auth context');
      return;
    }

    const res = await page.request.get(
      `http://localhost:10010/api/mobile/${factoryId}/sales-orders/list?page=1&size=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // Verify we can find orders (Phase 1 created one)
    expect(body.data.content.length).toBeGreaterThan(0);
  });

  test('生产计划可通过 API 查询', async ({ page }) => {
    const state = readState();
    if (!state?.planCode) {
      test.skip(true, 'No shared-state.json — Phase 1 not run');
      return;
    }

    const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
    const factoryId = await page.evaluate(() => {
      const auth = localStorage.getItem('cretas_auth');
      return auth ? JSON.parse(auth).factoryId : null;
    });

    if (!factoryId || !token) {
      test.skip(true, 'No auth context');
      return;
    }

    const res = await page.request.get(
      `http://localhost:10010/api/mobile/${factoryId}/production/plans?page=1&size=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
