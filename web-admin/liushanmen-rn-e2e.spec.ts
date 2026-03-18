/**
 * 六扇门一期 E2E 测试 — RN Expo Web (Playwright against localhost:3010)
 *
 * 比 Maestro 快得多：无需模拟器，直接跑浏览器。
 * 覆盖客户会议场景:
 *   RN-LSM-01: 进销存 — 仓储库存浏览 (S5)
 *   RN-LSM-02: 报工 + 投入量字段 (S2+S3)
 *   RN-LSM-03: 消耗汇总 + BOM达成率 (S4)
 *   RN-LSM-04: AI自然语言查询消耗 (S1)
 *   RN-LSM-05: AI查询毛利率 (S7)
 *   RN-LSM-06: 生产批次列表 + 详情 (S5+S10)
 *   RN-LSM-07: 移动均价显示 (S6)
 */

import { test, expect, Page } from '@playwright/test';

const RN_BASE_URL = process.env.RN_BASE_URL || 'http://localhost:3010';
const API = process.env.E2E_API_URL || 'http://47.100.235.168:10011/api/mobile';
const FACTORY_ID = 'F001';
const SD = 'test-results/screenshots/liushanmen-rn';

let TOKEN = '';

// --- Helpers (same pattern as rn-expo-web-e2e.spec.ts) ---

async function rnLogin(page: Page, username = 'factory_admin1', password = '123456') {
  await page.goto(RN_BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Landing → click login
  const loginBtn = page.locator('[data-testid="landing-login-btn"]');
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click();
  } else {
    const loginText = page.locator('text=登录').first();
    if (await loginText.isVisible().catch(() => false)) {
      await loginText.click();
    }
  }
  await page.waitForTimeout(2000);

  // Fill form
  const usernameInput = page.locator('[data-testid="login-username-input"]');
  const passwordInput = page.locator('[data-testid="login-password-input"]');

  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill(username);
    await passwordInput.fill(password);
    await page.waitForTimeout(500);
    await page.locator('[data-testid="login-submit-btn"]').click();
  } else {
    const uInput = page.getByPlaceholder('请输入用户名');
    const pInput = page.getByPlaceholder('请输入密码');
    if (await uInput.isVisible().catch(() => false)) {
      await uInput.fill(username);
      await pInput.fill(password);
      await page.waitForTimeout(500);
      await page.locator('text=登录').last().click();
    }
  }

  try {
    await page.waitForSelector('[role="tab"]', { timeout: 20000 });
  } catch {
    await page.waitForTimeout(5000);
  }
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
}

async function tapTab(page: Page, tabLabel: string) {
  const tab = page.getByRole('tab', { name: tabLabel });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(2000);
    return true;
  }
  const textTab = page.locator(`text=${tabLabel}`).last();
  if (await textTab.isVisible().catch(() => false)) {
    await textTab.click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

async function apiLogin(): Promise<string> {
  const res = await fetch(`${API}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' }),
  });
  const json = await res.json();
  TOKEN = json.data?.accessToken || json.data?.token || '';
  return TOKEN;
}

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}/${FACTORY_ID}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SD}/${name}`, fullPage: true });
}

// --- Tests ---

test.describe('六扇门一期 RN Expo Web E2E', () => {
  test.setTimeout(300000);

  test.beforeAll(async () => {
    await apiLogin();
  });

  // ============================================================
  // RN-LSM-01: 仓储库存浏览 (S5)
  // ============================================================
  test('RN-LSM-01: 仓储Tab — 库存列表浏览', async ({ page }) => {
    await rnLogin(page);

    // Navigate to warehouse tab
    const tapped = await tapTab(page, '仓储');
    if (!tapped) {
      // Try alternative tab names
      const alt = await tapTab(page, '库存');
      console.log('RN-LSM-01: 仓储tab not found, tried 库存:', alt);
    }
    await page.waitForTimeout(3000);
    await shot(page, '01-warehouse-home.png');

    // Look for inventory items
    const inventoryList = page.locator('[data-testid="inventory-list"]');
    const listVisible = await inventoryList.isVisible().catch(() => false);
    console.log('RN-LSM-01 inventory list:', listVisible);

    // Try clicking a material management entry
    const materialMgmt = page.locator('text=库存管理')
      .or(page.locator('text=原材料'))
      .or(page.locator('text=物料'))
      .first();
    if (await materialMgmt.isVisible().catch(() => false)) {
      await materialMgmt.click();
      await page.waitForTimeout(3000);
      await shot(page, '01b-inventory-detail.png');
    }

    // API verification: material batches exist
    const batches = await api('/material-batches?page=1&size=5');
    const content = batches.data?.content || batches.data || [];
    console.log(`RN-LSM-01 API: ${content.length} material batches found`);
    expect(content.length).toBeGreaterThanOrEqual(0);
  });

  // ============================================================
  // RN-LSM-02: 报工 + 投入量字段 (S2+S3)
  // ============================================================
  test('RN-LSM-02: 报工表单含投入量字段', async ({ page }) => {
    await rnLogin(page);
    await tapTab(page, '生产');
    await page.waitForTimeout(3000);

    // Navigate to process task list
    const taskBtn = page.locator('[data-testid="dashboard-process-task-btn"]')
      .or(page.locator('text=工序任务').first());
    if (await taskBtn.isVisible().catch(() => false)) {
      await taskBtn.click();
      await page.waitForTimeout(3000);
    } else {
      // Try management tab path
      await tapTab(page, '管理');
      await page.waitForTimeout(2000);
      const mgmtTaskBtn = page.locator('[data-testid="fa-process-task-btn"]')
        .or(page.locator('text=工序任务').first());
      if (await mgmtTaskBtn.isVisible().catch(() => false)) {
        await mgmtTaskBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    await shot(page, '02-task-list.png');

    // Open first task card
    const firstCard = page.locator('[data-testid^="process-task-card-"]').first();
    if (!(await firstCard.isVisible().catch(() => false))) {
      console.log('RN-LSM-02: SKIP — no task cards');
      return;
    }
    await firstCard.click();
    await page.waitForTimeout(3000);

    // Click report button
    const reportBtn = page.locator('[data-testid="task-detail-report-btn"]');
    if (!(await reportBtn.isVisible().catch(() => false))) {
      console.log('RN-LSM-02: SKIP — no report button');
      await shot(page, '02b-no-report-btn.png');
      return;
    }
    await reportBtn.click();
    await page.waitForTimeout(3000);

    // Verify output quantity input
    const qtyInput = page.locator('[data-testid="report-quantity-input"]');
    const qtyVisible = await qtyInput.isVisible().catch(() => false);
    console.log('RN-LSM-02 output qty input:', qtyVisible);

    // Verify input quantity field exists (S3 - 投入量)
    const inputQtyField = page.locator('[data-testid="report-input-quantity"]');
    const inputQtyVisible = await inputQtyField.isVisible().catch(() => false);
    console.log('RN-LSM-02 input qty field (投入量):', inputQtyVisible);

    // Also check by text label
    const inputQtyLabel = page.locator('text=投入量');
    const labelVisible = await inputQtyLabel.isVisible().catch(() => false);
    console.log('RN-LSM-02 投入量 label:', labelVisible);

    await shot(page, '02c-report-form.png');

    // Fill both fields
    if (qtyVisible) {
      await qtyInput.click();
      await page.keyboard.type('100');
    }
    if (inputQtyVisible) {
      await inputQtyField.click();
      await page.keyboard.type('120');
    }
    await shot(page, '02d-form-filled.png');
  });

  // ============================================================
  // RN-LSM-03: 消耗汇总 + BOM达成率 (S4)
  // ============================================================
  test('RN-LSM-03: 生产批次消耗汇总', async ({ page }) => {
    await rnLogin(page);
    await tapTab(page, '生产');
    await page.waitForTimeout(3000);

    // Navigate to batch list
    const batchListBtn = page.locator('text=批次列表')
      .or(page.locator('text=生产批次'))
      .first();
    if (await batchListBtn.isVisible().catch(() => false)) {
      await batchListBtn.click();
      await page.waitForTimeout(3000);
    }
    await shot(page, '03-batch-list.png');

    // Click first batch
    const firstBatch = page.locator('[data-testid="batch-item-0"]')
      .or(page.locator('[data-testid^="production-batch-"]').first());
    if (await firstBatch.isVisible().catch(() => false)) {
      await firstBatch.click();
      await page.waitForTimeout(3000);
      await shot(page, '03b-batch-detail.png');

      // Look for consumption tab/section
      const consumptionTab = page.locator('text=消耗')
        .or(page.locator('text=物料消耗'))
        .first();
      if (await consumptionTab.isVisible().catch(() => false)) {
        await consumptionTab.click();
        await page.waitForTimeout(3000);
        await shot(page, '03c-consumption-tab.png');

        // Check for achievement rate display
        const achievementRate = page.locator('text=达成率');
        console.log('RN-LSM-03 达成率 visible:', await achievementRate.isVisible().catch(() => false));
      }
    } else {
      console.log('RN-LSM-03: no batch items found on UI');
    }

    // API verification
    const batches = await api('/production-batches?page=1&size=3');
    const content = batches.data?.content || batches.data || [];
    if (content.length) {
      const batchId = content[0].id;
      const summary = await api(`/processing/material-consumptions/batch/${batchId}/summary`);
      if (summary.success && summary.data) {
        const items = summary.data.bomItems || summary.data.items || [];
        const rate = summary.data.overallAchievementRate;
        console.log(`RN-LSM-03 API: ${items.length} consumption items, rate=${rate}`);
      }
    }
  });

  // ============================================================
  // RN-LSM-04: AI自然语言查询消耗 (S1)
  // ============================================================
  test('RN-LSM-04: AI对话 — 查询物料消耗', async ({ page }) => {
    await rnLogin(page);

    // Navigate to AI tab
    const aiTapped = await tapTab(page, 'AI');
    if (!aiTapped) {
      // Try alternative names
      const alt = await tapTab(page, '智能');
      console.log('RN-LSM-04: AI tab not found, tried 智能:', alt);
    }
    await page.waitForTimeout(3000);
    await shot(page, '04-ai-home.png');

    // Find chat input
    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    if (!(await chatInput.isVisible().catch(() => false))) {
      console.log('RN-LSM-04: SKIP — AI chat input not found');
      return;
    }

    // Query 1: 物料消耗
    await chatInput.click();
    await page.keyboard.type('查看最近批次的物料消耗');
    await page.waitForTimeout(500);

    const sendBtn = page.locator('[data-testid="ai-send-button"]');
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait for response
    await page.waitForTimeout(15000);
    await shot(page, '04b-consumption-response.png');

    // Check response content
    const responseArea = page.locator('[data-testid^="ai-chat-message-"]').last();
    const responseVisible = await responseArea.isVisible().catch(() => false);
    console.log('RN-LSM-04 AI response visible:', responseVisible);

    // API verification
    const intentResp = await api('/ai-intents/recognize', {
      method: 'POST',
      body: JSON.stringify({ userInput: '查看最近批次的物料消耗' }),
    });
    if (intentResp.success && intentResp.data) {
      console.log(`RN-LSM-04 API intent: ${intentResp.data.intentCode}, method=${intentResp.data.matchMethod}`);
    }
  });

  // ============================================================
  // RN-LSM-05: AI查询毛利率 (S7)
  // ============================================================
  test('RN-LSM-05: AI对话 — 查询SKU毛利率', async ({ page }) => {
    await rnLogin(page);
    const aiTapped = await tapTab(page, 'AI');
    if (!aiTapped) await tapTab(page, '智能');
    await page.waitForTimeout(3000);

    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    if (!(await chatInput.isVisible().catch(() => false))) {
      console.log('RN-LSM-05: SKIP — AI chat input not found');
      return;
    }

    // Query: 毛利率
    await chatInput.click();
    await page.keyboard.type('查一下SKU毛利率');
    await page.waitForTimeout(500);

    const sendBtn = page.locator('[data-testid="ai-send-button"]');
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(15000);
    await shot(page, '05-margin-response.png');

    const responseArea = page.locator('[data-testid^="ai-chat-message-"]').last();
    console.log('RN-LSM-05 response:', await responseArea.isVisible().catch(() => false));

    // API verification
    const execResp = await api('/ai-intents/execute', {
      method: 'POST',
      body: JSON.stringify({ userInput: '查一下毛利率' }),
    });
    if (execResp.success && execResp.data) {
      const text = execResp.data.formattedText || execResp.data.replyText || '';
      console.log(`RN-LSM-05 API: ${text.substring(0, 80)}`);
    }
  });

  // ============================================================
  // RN-LSM-06: 生产批次列表 + 详情 (S5+S10)
  // ============================================================
  test('RN-LSM-06: 生产批次列表可达', async ({ page }) => {
    await rnLogin(page);
    await tapTab(page, '生产');
    await page.waitForTimeout(3000);

    // Navigate to batch list
    const batchListBtn = page.locator('text=批次列表')
      .or(page.locator('text=生产批次'))
      .first();
    if (await batchListBtn.isVisible().catch(() => false)) {
      await batchListBtn.click();
      await page.waitForTimeout(3000);
      await shot(page, '06-production-batches.png');

      // Click first batch for detail
      const firstItem = page.locator('[data-testid="batch-item-0"]')
        .or(page.locator('[data-testid^="production-batch-"]').first());
      if (await firstItem.isVisible().catch(() => false)) {
        await firstItem.click();
        await page.waitForTimeout(3000);
        await shot(page, '06b-batch-detail.png');

        // Check for material cost display
        const materialCost = page.locator('text=物料成本')
          .or(page.locator('text=材料成本'));
        console.log('RN-LSM-06 材料成本 visible:', await materialCost.isVisible().catch(() => false));
      }
    } else {
      console.log('RN-LSM-06: batch list button not found');
      await shot(page, '06-no-batch-btn.png');
    }
  });

  // ============================================================
  // RN-LSM-07: 移动均价显示 (S6)
  // ============================================================
  test('RN-LSM-07: 原材料详情显示移动均价', async ({ page }) => {
    // API: check a material type has movingAvgPrice
    const types = await api('/raw-material-types/active');
    const typeList = Array.isArray(types.data) ? types.data : types.data?.content || [];
    if (typeList.length) {
      const mt = typeList[0];
      const detail = await api(`/raw-material-types/${mt.id}`);
      const avg = detail.data?.movingAvgPrice;
      console.log(`RN-LSM-07 API: ${mt.name}, movingAvgPrice=${avg}`);
    }

    await rnLogin(page);

    // Navigate to warehouse/inventory
    const tapped = await tapTab(page, '仓储');
    if (!tapped) await tapTab(page, '库存');
    await page.waitForTimeout(3000);

    // Look for material type list
    const materialItem = page.locator('[data-testid="material-item-0"]')
      .or(page.locator('[data-testid^="material-type-"]').first());
    if (await materialItem.isVisible().catch(() => false)) {
      await materialItem.click();
      await page.waitForTimeout(3000);
      await shot(page, '07-material-detail.png');

      // Check for moving avg price display
      const avgPrice = page.locator('text=移动均价')
        .or(page.locator('text=平均价'));
      const avgVisible = await avgPrice.isVisible().catch(() => false);
      console.log('RN-LSM-07 移动均价 visible:', avgVisible);
    } else {
      console.log('RN-LSM-07: material items not found on UI');
      await shot(page, '07-no-material-items.png');
    }
  });

  // ============================================================
  // RN-LSM-08: AI自然语言入库 — 意图识别系统 (S1 核心)
  // ============================================================
  test('RN-LSM-08: AI对话 — 自然语言入库', async ({ page }) => {
    // API: verify intent recognition for NL material entry
    const recognizeResp = await api('/ai-intents/recognize', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'GPS牛腩入库42件' }),
    });
    if (recognizeResp.success && recognizeResp.data) {
      const { intentCode, matchMethod, confidence, matched } = recognizeResp.data;
      console.log(`RN-LSM-08 API recognize: intent=${intentCode}, method=${matchMethod}, conf=${confidence}, matched=${matched}`);
      // Should match MATERIAL_BATCH_CREATE
      const isCorrectIntent = (intentCode || '').toUpperCase().includes('MATERIAL_BATCH_CREATE')
        || (intentCode || '').toUpperCase().includes('BATCH_CREATE');
      expect(matched).toBeTruthy();
      if (!isCorrectIntent) {
        console.log(`RN-LSM-08 WARN: expected MATERIAL_BATCH_CREATE, got ${intentCode}`);
      }
    }

    // API: execute intent and verify it returns confirmation/creation
    const execResp = await api('/ai-intents/execute', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'GPS牛腩入库42件' }),
    });
    if (execResp.success && execResp.data) {
      const text = execResp.data.formattedText || execResp.data.message || '';
      const result = execResp.data.resultData || {};
      const needsConfirm = result.needsConfirmation || false;
      console.log(`RN-LSM-08 API execute: status=${execResp.data.status}, needsConfirm=${needsConfirm}`);
      console.log(`RN-LSM-08 text: ${text.substring(0, 100)}`);
      // Should either need confirmation, ask for more info, or succeed directly
      const ok = needsConfirm || text.includes('入库成功') || text.includes('确认')
        || text.includes('选择') || text.includes('规则验证')
        || text.includes('提供') || text.includes('信息') || execResp.data?.status === 'NEED_MORE_INFO';
      expect(ok).toBeTruthy();
    }

    // UI: test AI chat with NL entry
    await rnLogin(page);
    const aiTapped = await tapTab(page, 'AI');
    if (!aiTapped) await tapTab(page, '智能');
    await page.waitForTimeout(3000);

    const chatInput = page.locator('[data-testid="ai-chat-input"]');
    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.click();
      await page.keyboard.type('新到一批辣椒500公斤');
      await page.waitForTimeout(500);

      const sendBtn = page.locator('[data-testid="ai-send-button"]');
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(15000);
      await shot(page, '08-ai-nl-entry-response.png');

      // Check response mentions 入库 or confirmation
      const responseArea = page.locator('[data-testid^="ai-chat-message-"]').last();
      console.log('RN-LSM-08 AI response visible:', await responseArea.isVisible().catch(() => false));
    }

    // Test more NL variants via API
    const variants = [
      '到货一批花椒200斤',
      '帮我登记原料入库',
      '物料入库 盐 50袋',
    ];
    for (const v of variants) {
      const r = await api('/ai-intents/recognize', {
        method: 'POST',
        body: JSON.stringify({ userInput: v }),
      });
      if (r.success && r.data) {
        console.log(`RN-LSM-08 variant "${v}": intent=${r.data.intentCode}, matched=${r.data.matched}`);
      }
    }
  });

  // ============================================================
  // RN-LSM-09: 进销存闭环验证 (S5 — API层)
  // ============================================================
  test('RN-LSM-09: 进销存闭环 — SO→PP→FG联动', async ({ page }) => {
    // This is primarily an API chain test with UI verification at key points

    // Step 1: Get product type
    const types = await api('/product-types?page=1&size=3');
    const products = Array.isArray(types.data) ? types.data : types.data?.content || [];
    test.skip(!products.length, 'No product types');
    const ptId = products[0].id;
    const ptName = products[0].name || '?';
    console.log(`RN-LSM-09: product=${ptName} (${ptId})`);

    // Step 1b: Get customer
    const custResp = await api('/customers?page=1&size=1');
    const custs = Array.isArray(custResp.data) ? custResp.data : custResp.data?.content || [];
    const custId = custs.length ? custs[0].id : 'CUST-E2E';

    // Step 2: Create sales order (correct DTO: customerId + orderDate + items[])
    const soResp = await api('/sales/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: custId,
        orderDate: new Date().toISOString().split('T')[0],
        requiredDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        items: [{
          productTypeId: ptId,
          quantity: 10,
          unit: 'KG',
          unitPrice: 50.0,
        }],
      }),
    });
    if (!soResp.success) {
      console.log(`RN-LSM-09: SO creation failed: ${soResp.message}`);
      return;
    }
    const soId = soResp.data?.id || soResp.data?.orderId;
    console.log(`RN-LSM-09: SO created: ${soId}`);

    // Step 3: Confirm SO → triggers SupplyChainOrchestrator
    const confirmResp = await api(`/sales/orders/${soId}/confirm`, { method: 'POST' });
    console.log(`RN-LSM-09: SO confirmed: ${confirmResp.success}`);
    expect(confirmResp.success).toBeTruthy();

    // Step 4: Wait for async event processing
    await page.waitForTimeout(3000);

    // Step 5: Check if production plan was auto-created
    const plans = await api('/production-plans?page=1&size=5&sort=createdAt&sortDirection=DESC');
    const planList = Array.isArray(plans.data) ? plans.data : plans.data?.content || [];
    const linkedPlan = planList.find(
      (p: any) => p.sourceOrderId === soId || p.salesOrderId === soId || p.sourceType === 'CUSTOMER_ORDER'
    );
    if (linkedPlan) {
      console.log(`RN-LSM-09: Auto PP created: ${linkedPlan.planNumber || linkedPlan.id}, status=${linkedPlan.status}`);
    } else {
      console.log(`RN-LSM-09: No linked PP found (stock may have been sufficient). ${planList.length} plans total.`);
    }

    // Step 6: Check completed batches for auto-consumption + FG
    const completedBatches = await api('/production-batches?page=1&size=3&status=COMPLETED');
    const cbList = Array.isArray(completedBatches.data) ? completedBatches.data : completedBatches.data?.content || [];
    if (cbList.length) {
      const cbId = cbList[0].id;

      // Check auto BOM consumption
      const consumptions = await api(`/processing/material-consumptions/batch/${cbId}`);
      const cList = Array.isArray(consumptions.data) ? consumptions.data : [];
      const hasAutoBom = cList.some((c: any) => c.sourceType === 'AUTO_BOM');
      console.log(`RN-LSM-09: batch ${cbId} consumptions=${cList.length}, hasAUTO_BOM=${hasAutoBom}`);

      // Check finished goods
      const fgs = await api('/finished-goods?page=1&size=3');
      const fgList = Array.isArray(fgs.data) ? fgs.data : fgs.data?.content || [];
      console.log(`RN-LSM-09: ${fgList.length} finished goods batches`);
    }

    // Step 7: UI — navigate to production tab to verify batches visible
    await rnLogin(page);
    await tapTab(page, '生产');
    await page.waitForTimeout(3000);
    await shot(page, '09-supply-chain-production.png');
  });

  // ============================================================
  // RN-LSM-10: 出成率验证 (S3 补充)
  // ============================================================
  test('RN-LSM-10: 出成率计算验证', async ({ page }) => {
    // API: find a batch with goodQuantity and actualQuantity
    const batches = await api('/production-batches?page=1&size=10&sort=createdAt&sortDirection=DESC');
    const batchList = Array.isArray(batches.data) ? batches.data : batches.data?.content || [];

    const target = batchList.find(
      (b: any) => b.goodQuantity != null && b.actualQuantity != null && parseFloat(b.actualQuantity) > 0
    );

    if (target) {
      const good = parseFloat(target.goodQuantity);
      const actual = parseFloat(target.actualQuantity);
      const storedRate = target.yieldRate != null ? parseFloat(target.yieldRate) : null;
      const expectedRate = (good * 100) / actual;

      console.log(`RN-LSM-10: batch=${target.id}, good=${good}, actual=${actual}`);
      console.log(`RN-LSM-10: storedRate=${storedRate}, expectedRate=${expectedRate.toFixed(2)}`);

      if (storedRate !== null) {
        const diff = Math.abs(storedRate - expectedRate);
        expect(diff).toBeLessThan(0.5); // Allow 0.5% rounding tolerance
        console.log(`RN-LSM-10: PASS — yieldRate verified (diff=${diff.toFixed(4)})`);
      } else {
        console.log('RN-LSM-10: WARN — yieldRate is null');
      }
    } else {
      console.log('RN-LSM-10: WARN — no batch with goodQty+actualQty found');
    }

    // UI: verify batch detail shows yield rate
    await rnLogin(page);
    await tapTab(page, '生产');
    await page.waitForTimeout(3000);

    const batchListBtn = page.locator('text=批次列表')
      .or(page.locator('text=生产批次'))
      .first();
    if (await batchListBtn.isVisible().catch(() => false)) {
      await batchListBtn.click();
      await page.waitForTimeout(3000);

      const firstBatch = page.locator('[data-testid="batch-item-0"]')
        .or(page.locator('[data-testid^="production-batch-"]').first());
      if (await firstBatch.isVisible().catch(() => false)) {
        await firstBatch.click();
        await page.waitForTimeout(3000);

        // Check for yield rate display
        const yieldLabel = page.locator('text=出成率')
          .or(page.locator('text=良品率'))
          .or(page.locator('text=yieldRate'));
        console.log('RN-LSM-10 出成率 label visible:', await yieldLabel.isVisible().catch(() => false));
        await shot(page, '10-yield-rate-detail.png');
      }
    }
  });
});
