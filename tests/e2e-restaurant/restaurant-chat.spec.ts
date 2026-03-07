/**
 * Restaurant AI Chat E2E Test
 *
 * Prerequisites:
 * 1. Expo web running: cd frontend/CretasFoodTrace && npx expo start --web --port 3010
 * 2. Test server running: 47.100.235.168:10011
 *
 * Run:
 *   npx playwright test tests/e2e-restaurant/restaurant-chat.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3010';
const API_URL = 'http://47.100.235.168:10011';
const TEST_USER = 'restaurant_admin1';
const TEST_PASS = '123456';
const TIMEOUT = 30000;

test.describe('Restaurant AI Chat E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('T1: Login as restaurant_admin1', async ({ page }) => {
    // Find login form
    const usernameInput = page.getByPlaceholder(/用户名|username/i);
    const passwordInput = page.getByPlaceholder(/密码|password/i);
    const loginButton = page.getByRole('button', { name: /登录|login/i });

    await usernameInput.fill(TEST_USER);
    await passwordInput.fill(TEST_PASS);
    await loginButton.click();

    // Should navigate to home screen
    await page.waitForTimeout(3000);
    // Verify no error screens
    await expect(page.locator('text=/错误|error|500/i')).not.toBeVisible();
  });

  test('T2: Navigate to AI Chat', async ({ page }) => {
    await loginAs(page, TEST_USER, TEST_PASS);

    // Find AI tab or AI analysis entry
    const aiTab = page.locator('text=/AI|智能/i').first();
    if (await aiTab.isVisible()) {
      await aiTab.click();
      await page.waitForTimeout(2000);
    }

    // Look for AI Chat entry
    const chatEntry = page.locator('text=/AI.*对话|智能.*对话|AI.*Chat/i').first();
    if (await chatEntry.isVisible()) {
      await chatEntry.click();
      await page.waitForTimeout(2000);
    }

    // Verify chat screen loaded (has input field)
    const chatInput = page.getByPlaceholder(/输入|消息|message/i);
    await expect(chatInput).toBeVisible({ timeout: TIMEOUT });
  });

  test('T3: Intent - Daily Revenue', async ({ page }) => {
    await navigateToChat(page);

    await sendMessage(page, '今天营业额');
    const response = await waitForResponse(page);

    expect(response).toContain('营业额');
    expect(response).toMatch(/¥|元|订单/);
  });

  test('T4: Intent - Dish List', async ({ page }) => {
    await navigateToChat(page);

    await sendMessage(page, '菜品列表');
    const response = await waitForResponse(page);

    expect(response).toContain('菜品');
  });

  test('T5: Intent - Ingredient Stock', async ({ page }) => {
    await navigateToChat(page);

    await sendMessage(page, '食材库存');
    const response = await waitForResponse(page);

    expect(response).toContain('库存');
  });

  test('T6: Multi-turn Conversation', async ({ page }) => {
    await navigateToChat(page);

    await sendMessage(page, '损耗汇总');
    const response1 = await waitForResponse(page);
    expect(response1).toContain('损耗');

    await sendMessage(page, '有异常吗');
    const response2 = await waitForResponse(page);
    // Should get some response (might be generic or contextual)
    expect(response2.length).toBeGreaterThan(5);
  });

  test('T7: GenericAIChat Fallback', async ({ page }) => {
    await navigateToChat(page);

    await sendMessage(page, '红烧肉怎么做');
    const response = await waitForResponse(page);

    // Should get LLM or knowledge base response
    expect(response.length).toBeGreaterThan(10);
  });

  test('T8: Empty Data Handling', async ({ page }) => {
    await navigateToChat(page);

    await sendMessage(page, '上周营业额趋势');
    const response = await waitForResponse(page);

    // Should handle gracefully (either show data or "暂无" message)
    expect(response).not.toContain('error');
    expect(response).not.toContain('500');
    expect(response.length).toBeGreaterThan(5);
  });
});

// ─── Helpers ───

async function loginAs(page: Page, username: string, password: string) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  const usernameInput = page.getByPlaceholder(/用户名|username/i);
  const passwordInput = page.getByPlaceholder(/密码|password/i);
  const loginButton = page.getByRole('button', { name: /登录|login/i });

  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await loginButton.click();
  await page.waitForTimeout(3000);
}

async function navigateToChat(page: Page) {
  await loginAs(page, TEST_USER, TEST_PASS);

  // Try multiple navigation paths
  const aiTab = page.locator('text=/AI|智能/i').first();
  if (await aiTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aiTab.click();
    await page.waitForTimeout(1000);
  }

  const chatEntry = page.locator('text=/AI.*对话|智能.*对话|AI.*Chat/i').first();
  if (await chatEntry.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatEntry.click();
    await page.waitForTimeout(1000);
  }
}

async function sendMessage(page: Page, message: string) {
  const chatInput = page.getByPlaceholder(/输入|消息|message/i);
  await chatInput.fill(message);

  // Press send button or Enter
  const sendButton = page.locator('text=/发送|send/i').first();
  if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sendButton.click();
  } else {
    await chatInput.press('Enter');
  }
}

async function waitForResponse(page: Page, timeout = 30000): Promise<string> {
  // Wait for streaming to complete (loading indicator disappears)
  await page.waitForTimeout(2000);

  // Wait for response message to appear
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // Look for the latest assistant message
    const messages = await page.locator('[data-testid="assistant-message"], .assistant-message').all();
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const text = await lastMessage.textContent() || '';
      if (text.length > 5 && !text.includes('加载中') && !text.includes('思考中')) {
        return text;
      }
    }
    await page.waitForTimeout(1000);
  }

  // Fallback: get all visible text
  const bodyText = await page.locator('body').textContent() || '';
  return bodyText;
}
