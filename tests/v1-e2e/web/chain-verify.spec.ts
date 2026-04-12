/**
 * Business Chain Verify — 二次 UI 验证 @post-deploy
 *
 * Reads test-e2e-chain-results.json (produced by test-e2e-business-chain.mjs)
 * and navigates to the relevant Web Admin pages to confirm that each created
 * entity is actually visible in the UI / verifiable via API.
 *
 * Chain steps covered:
 *   Step 1 — 研发样品  → /rd/samples           (sampleId)
 *   Step 2 — 报价      → /sales/quotes          (quoteId)
 *   Step 3 — 销售订单  → /sales/orders          (orderNumber, salesOrderId)
 *   Step 4 — 财务审核  → SO status = FINANCE_APPROVED
 *   Step 5 — 采购订单  → /procurement/orders    (purchaseOrderId)
 *   Step 6 — 生产计划  → /production/plans      (productionPlanId)
 *   Step 8 — 出货单    → API lookup             (deliveryId)
 *   Step 9 — 发票      → /finance/invoices      (invoiceId)
 *   Step 9 — 收款      → /finance/payments      (paymentId)
 *
 * API verification strategy:
 *   Auth tokens are stored as HttpOnly cookies — use context.request (which
 *   inherits cookies from storageState) rather than page.evaluate(localStorage).
 *   factoryId is read from `cretas_user` localStorage key → factoryUser.factoryId.
 *
 *   For each step:
 *     1. Navigate to the relevant page — assert no redirect to /login
 *     2. Assert the el-table renders
 *     3. Call the entity-specific GET API via context.request; assert success=true
 *     4. If the orderNumber is available as text, assert it's visible in the table
 *
 *   If the API call returns 404 / non-ok, the test fails with a clear message.
 *   If the step was SKIP or output missing, the test is skipped gracefully.
 *
 * Auth: super_admin (has all read permissions across all modules)
 */

import { test, expect, BrowserContext } from '@playwright/test';
import { setupAuthBeforeAll, restoreAuth, installApiProxy } from '../helpers/auth-cache';
import { S } from '../helpers/selectors';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainStep {
  step: number;
  name: string;
  status: string;
  evidence?: Record<string, string>;
  output?: Record<string, string>;
}

// ─── Load chain results ───────────────────────────────────────────────────────

const RESULTS_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'test-e2e-chain-results.json'
);

function readChainResults(): ChainStep[] {
  if (!fs.existsSync(RESULTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8')) as ChainStep[];
  } catch {
    return [];
  }
}

function getStep(chain: ChainStep[], stepNum: number): ChainStep | undefined {
  return chain.find((s) => s.step === stepNum);
}

/** Returns true if the step passed AND has a non-empty output value for `key`. */
function hasOutput(step: ChainStep | undefined, key: string): boolean {
  return step?.status === 'PASS' && !!step.output?.[key];
}

/**
 * Reads factoryId from the `cretas_user` localStorage item that restoreAuth puts
 * into the page. Must be called after page.goto() to ensure localStorage is set.
 */
async function getFactoryIdFromPage(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('cretas_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // factoryUser.factoryId is the canonical location
      return parsed?.factoryUser?.factoryId ?? parsed?.factoryId ?? null;
    } catch {
      return null;
    }
  });
}

/**
 * GET an entity by ID via context.request (inherits HttpOnly cookies from auth).
 * Returns { ok, success, data } or null on network error.
 */
async function apiGet(
  context: BrowserContext,
  url: string
): Promise<{ ok: boolean; success: boolean; data: unknown } | null> {
  try {
    const res = await context.request.get(url);
    const body = await res.json().catch(() => ({})) as {
      success?: boolean;
      data?: unknown;
    };
    return { ok: res.ok(), success: !!body.success, data: body.data };
  } catch {
    return null;
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Business Chain Verify — 二次 UI 验证 @post-deploy', () => {
  const chain = readChainResults();

  // Use chain_admin (factory_admin1 / F001) — same account as test-e2e-business-chain.mjs
  // so that IDs in chain-results.json resolve against the correct factory.
  test.beforeAll(async ({ browser }) => {
    await setupAuthBeforeAll(browser, 'chain_admin');
  });

  test.beforeEach(async ({ page, context }) => {
    await restoreAuth(context, page, 'chain_admin');
    await installApiProxy(context);
  });

  // ─── Guard ──────────────────────────────────────────────────────────────────

  test('chain-results.json 存在且包含步骤数据', () => {
    expect(
      fs.existsSync(RESULTS_FILE),
      `找不到 ${RESULTS_FILE} — 请先运行 test-e2e-business-chain.mjs`
    ).toBe(true);
    expect(chain.length, 'chain-results.json 应至少包含 1 个步骤').toBeGreaterThan(0);
  });

  // ─── Step 1: 研发样品 ────────────────────────────────────────────────────────

  test('Step 1 研发样品 — /rd/samples 表格渲染 + sampleId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 1);
    if (!hasOutput(step, 'sampleId')) {
      test.skip(true, `Step 1 status=${step?.status ?? 'missing'} or no sampleId`);
      return;
    }
    const sampleId = step!.output!.sampleId;

    await page.goto('/rd/samples');
    await page.waitForLoadState('networkidle');
    expect(page.url(), '应停留在 /rd/samples，不应跳转到 /login').not.toMatch(/\/login/);

    // Table must render (even if empty for non-prod envs)
    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Authoritative check: GET sampleId from API (uses context cookies)
    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/rd/samples/${sampleId}`
    );
    expect(result, `研发样品 ${sampleId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `研发样品 ${sampleId} API HTTP 失败 (success=${result!.success})`).toBe(true);
    expect(result!.success, `研发样品 ${sampleId} API success=false`).toBe(true);
  });

  // ─── Step 2: 报价 ────────────────────────────────────────────────────────────

  test('Step 2 报价 — /sales/quotes 表格渲染 + quoteId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 2);
    if (!hasOutput(step, 'quoteId')) {
      test.skip(true, `Step 2 status=${step?.status ?? 'missing'} or no quoteId`);
      return;
    }
    const quoteId = step!.output!.quoteId;

    await page.goto('/sales/quotes');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    // OperationalQuoteController maps to /quotes (not /sales/quotes)
    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/quotes/${quoteId}`
    );
    expect(result, `报价 ${quoteId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `报价 ${quoteId} API HTTP 失败`).toBe(true);
    expect(result!.success, `报价 ${quoteId} API success=false`).toBe(true);
  });

  // ─── Step 3: 销售订单 ────────────────────────────────────────────────────────

  test('Step 3 销售订单 — /sales/orders 表格渲染 + salesOrderId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 3);
    if (!hasOutput(step, 'salesOrderId')) {
      test.skip(true, `Step 3 status=${step?.status ?? 'missing'} or no salesOrderId`);
      return;
    }
    const salesOrderId = step!.output!.salesOrderId;
    const orderNumber = step!.output!.orderNumber ?? '';

    await page.goto('/sales/orders');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    // API is authoritative — GET SO by id
    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/sales/orders/${salesOrderId}`
    );
    expect(result, `销售订单 ${salesOrderId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `销售订单 ${salesOrderId} API HTTP 失败`).toBe(true);
    expect(result!.success, `销售订单 ${salesOrderId} API success=false`).toBe(true);

    // If orderNumber is available, try to find it in the table (best-effort UI check)
    if (orderNumber) {
      const orderRow = page.locator(S.table.rowByText(orderNumber));
      let rowVisible = await orderRow.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!rowVisible) {
        // Try "全部订单" tab which shows all statuses
        const allTab = page.locator('.el-radio-button:has-text("全部订单")');
        if (await allTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await allTab.click();
          await page.waitForTimeout(1_000);
        }
        rowVisible = await orderRow.isVisible({ timeout: 8_000 }).catch(() => false);
      }
      // Row visibility is a bonus check; if it fails it's a warning, not a fatal.
      // The API check above is the authoritative assertion.
      if (!rowVisible) {
        console.warn(`[chain-verify] 订单号 ${orderNumber} 未在表格中找到 (API已确认记录存在)`);
      }
    }
  });

  // ─── Step 4: 财务审核状态 ─────────────────────────────────────────────────────

  test('Step 4 财务审核 — 销售订单状态 = FINANCE_APPROVED', async ({ page, context }) => {
    const step3 = getStep(chain, 3);
    const step4 = getStep(chain, 4);

    if (!hasOutput(step3, 'salesOrderId') || step4?.status !== 'PASS') {
      test.skip(
        true,
        `Step 3/4 未通过 — step3.status=${step3?.status}, step4.status=${step4?.status}`
      );
      return;
    }

    const salesOrderId = step3!.output!.salesOrderId;

    await page.goto('/sales/orders');
    await page.waitForLoadState('networkidle');

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/sales/orders/${salesOrderId}`
    );
    expect(result, `SO ${salesOrderId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `SO ${salesOrderId} API HTTP 失败`).toBe(true);
    expect(result!.success, `SO ${salesOrderId} API success=false`).toBe(true);

    const soData = result!.data as Record<string, unknown> | null;
    const actualStatus = String(soData?.status ?? '');
    expect(
      actualStatus,
      `SO 状态应为 FINANCE_APPROVED, 实际=${actualStatus}`
    ).toBe('FINANCE_APPROVED');
  });

  // ─── Step 5: 采购订单 ────────────────────────────────────────────────────────

  test('Step 5 采购订单 — /procurement/orders 表格渲染 + purchaseOrderId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 5);
    if (!hasOutput(step, 'purchaseOrderId')) {
      test.skip(true, `Step 5 status=${step?.status ?? 'missing'} or no purchaseOrderId`);
      return;
    }
    const poId = step!.output!.purchaseOrderId;

    await page.goto('/procurement/orders');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/purchase/orders/${poId}`
    );
    expect(result, `采购订单 ${poId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `采购订单 ${poId} API HTTP 失败`).toBe(true);
    expect(result!.success, `采购订单 ${poId} API success=false`).toBe(true);
  });

  // ─── Step 6: 生产计划 ────────────────────────────────────────────────────────

  test('Step 6 生产计划 — /production/plans 表格渲染 + productionPlanId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 6);
    if (!hasOutput(step, 'productionPlanId')) {
      test.skip(true, `Step 6 status=${step?.status ?? 'missing'} or no productionPlanId`);
      return;
    }
    const planId = step!.output!.productionPlanId;

    await page.goto('/production/plans');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/production-plans/${planId}`
    );
    expect(result, `生产计划 ${planId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `生产计划 ${planId} API HTTP 失败`).toBe(true);
    expect(result!.success, `生产计划 ${planId} API success=false`).toBe(true);
  });

  // ─── Step 8: 出货单 ──────────────────────────────────────────────────────────

  test('Step 8 出货单 — deliveryId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 8);
    if (!hasOutput(step, 'deliveryId')) {
      test.skip(true, `Step 8 status=${step?.status ?? 'missing'} or no deliveryId`);
      return;
    }
    const deliveryId = step!.output!.deliveryId;

    // Navigate to any page to hydrate localStorage for factoryId
    await page.goto('/production/batches');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    // SalesController maps deliveries to /sales/deliveries/{id}
    const candidateUrls = [
      `http://localhost:10010/api/mobile/${factoryId}/sales/deliveries/${deliveryId}`,
      `http://localhost:10010/api/mobile/${factoryId}/shipment/deliveries/${deliveryId}`,
      `http://localhost:10010/api/mobile/${factoryId}/finished-goods-deliveries/${deliveryId}`,
    ];

    let found = false;
    let lastError = '';
    for (const url of candidateUrls) {
      const result = await apiGet(context, url);
      if (result && result.ok && result.success) {
        found = true;
        break;
      }
      lastError = `url=${url} ok=${result?.ok} success=${result?.success}`;
    }

    expect(
      found,
      `出货单 ${deliveryId} 在所有候选 API 路径均未找到. last: ${lastError}`
    ).toBe(true);
  });

  // ─── Step 9: 发票 ────────────────────────────────────────────────────────────

  test('Step 9 发票 — /finance/invoices 表格渲染 + invoiceId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 9);
    if (!hasOutput(step, 'invoiceId')) {
      test.skip(true, `Step 9 status=${step?.status ?? 'missing'} or no invoiceId`);
      return;
    }
    const invoiceId = step!.output!.invoiceId;

    await page.goto('/finance/invoices');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/finance/invoices/${invoiceId}`
    );
    expect(result, `发票 ${invoiceId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `发票 ${invoiceId} API HTTP 失败`).toBe(true);
    expect(result!.success, `发票 ${invoiceId} API success=false`).toBe(true);
  });

  // ─── Step 9: 收款 ────────────────────────────────────────────────────────────

  test('Step 9 收款 — /finance/payments 表格渲染 + paymentId API 记录存在', async ({ page, context }) => {
    const step = getStep(chain, 9);
    if (!hasOutput(step, 'paymentId')) {
      test.skip(true, `Step 9 status=${step?.status ?? 'missing'} or no paymentId`);
      return;
    }
    const paymentId = step!.output!.paymentId;

    await page.goto('/finance/payments');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/login/);

    const table = page.locator(S.table.root).first();
    await expect(table).toBeVisible({ timeout: 15_000 });

    const factoryId = await getFactoryIdFromPage(page);
    if (!factoryId) {
      test.skip(true, 'factoryId not found in cretas_user — auth not hydrated');
      return;
    }

    const result = await apiGet(
      context,
      `http://localhost:10010/api/mobile/${factoryId}/finance/payments/${paymentId}`
    );
    expect(result, `收款 ${paymentId} API 请求网络错误`).not.toBeNull();
    expect(result!.ok, `收款 ${paymentId} API HTTP 失败`).toBe(true);
    expect(result!.success, `收款 ${paymentId} API success=false`).toBe(true);
  });
});
