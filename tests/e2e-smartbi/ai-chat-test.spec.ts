import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://cretaceousfuture.com';
const SCREENSHOT_DIR = 'screenshots/ai-chat';

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false });
}

async function screenshotFull(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe('AI Chat Page - UI/UX & Functionality', () => {

  test('01 - Page loads and initial state', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Check page title
    await expect(page).toHaveTitle(/AI智能对话/);

    // Check header elements
    await expect(page.locator('.page-header h1')).toContainText('食品安全 AI 智能助手');
    await expect(page.locator('.page-header .eyebrow')).toContainText('AI Demo');

    // Check welcome message
    await expect(page.locator('.msg.ai .msg-bubble').first()).toContainText('你好！我是白垩纪AI智能助手');

    // Check suggested question tabs
    await expect(page.locator('.tab-btn[data-tab="food"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="factory"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="ai"]')).toBeVisible();

    // Check input area
    await expect(page.locator('#chatInput')).toBeVisible();
    await expect(page.locator('.send-btn')).toBeVisible();

    await screenshot(page, '01-initial-state');
  });

  test('02 - Navigation links', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Check nav brand
    await expect(page.locator('.nav-brand span')).toContainText('CRETACEOUS');

    // Check nav links
    await expect(page.locator('.nav-link.active')).toContainText('AI对话');
    await expect(page.locator('a.nav-link[href="/"]')).toContainText('官网首页');
    await expect(page.locator('a.nav-link[href="/ai-bi.html"]')).toContainText('智能分析');

    await screenshot(page, '02-navigation');
  });

  test('03 - Tab switching for suggested questions', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Default: food tab active
    await expect(page.locator('#tab-food')).toHaveClass(/active/);
    await expect(page.locator('#tab-factory')).not.toHaveClass(/active/);

    // Switch to factory tab
    await page.click('.tab-btn[data-tab="factory"]');
    await expect(page.locator('#tab-factory')).toHaveClass(/active/);
    await expect(page.locator('#tab-food')).not.toHaveClass(/active/);
    await screenshot(page, '03-factory-tab');

    // Switch to AI tab
    await page.click('.tab-btn[data-tab="ai"]');
    await expect(page.locator('#tab-ai')).toHaveClass(/active/);
    await screenshot(page, '03-ai-tab');
  });

  test('04 - Food knowledge query (HACCP)', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Click HACCP suggestion
    await page.click('.suggest-btn:has-text("HACCP体系关键控制点有哪些")');

    // Wait for user message
    await expect(page.locator('.msg.user .msg-bubble')).toContainText('HACCP');

    // Wait for AI response (up to 30s)
    await page.waitForSelector('.msg.ai .msg-bubble:nth-of-type(1)', { timeout: 30000 });

    // Wait for typing indicator to disappear
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    // Should have at least 2 AI messages (welcome + response)
    const aiMessages = page.locator('.msg.ai');
    await expect(aiMessages).toHaveCount(2, { timeout: 35000 });

    // Check intent tag appears
    await expect(page.locator('.intent-tag').first()).toBeVisible({ timeout: 5000 });

    // Check confidence bar
    await expect(page.locator('.confidence-bar').first()).toBeVisible();

    // Check match method
    await expect(page.locator('.match-tag').first()).toBeVisible();

    // Check feedback buttons
    await expect(page.locator('.feedback-btn.up').first()).toBeVisible();
    await expect(page.locator('.feedback-btn.down').first()).toBeVisible();

    await screenshot(page, '04-haccp-response-top');

    // Scroll to see full response
    const msgs = page.locator('.messages');
    await msgs.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);
    await screenshot(page, '04-haccp-response-bottom');
  });

  test('05 - Factory data query', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Switch to factory tab and click
    await page.click('.tab-btn[data-tab="factory"]');
    await page.click('.suggest-btn:has-text("今天的生产批次有多少")');

    // Wait for response
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });
    const aiMessages = page.locator('.msg.ai');
    await expect(aiMessages).toHaveCount(2, { timeout: 35000 });

    await screenshot(page, '05-factory-query');

    // Check the response has intent tag for production
    const intentTags = page.locator('.intent-tag');
    await expect(intentTags.last()).toBeVisible();
  });

  test('06 - Manual text input and send', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Type in input
    await page.fill('#chatInput', '巴氏杀菌的温度和时间要求');
    await screenshot(page, '06-input-filled');

    // Send
    await page.click('.send-btn');

    // Wait for response
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    await screenshot(page, '06-pasteurization-response');
  });

  test('07 - Markdown rendering check', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Send a query that will return rich markdown
    await page.fill('#chatInput', '食品添加剂使用的通则规定');
    await page.click('.send-btn');

    // Wait for response
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    // Check that markdown was rendered (look for HTML elements like strong, ul, li)
    const lastAiBubble = page.locator('.msg.ai .msg-bubble').last();
    const html = await lastAiBubble.innerHTML();

    console.log('=== AI Response HTML (first 1000 chars) ===');
    console.log(html.substring(0, 1000));
    console.log('=== Has <strong>:', html.includes('<strong>'));
    console.log('=== Has <li>:', html.includes('<li>'));
    console.log('=== Has <br>:', html.includes('<br>'));
    console.log('=== Has raw **:', html.includes('**'));
    console.log('=== Has raw \\n:', html.includes('\\n'));

    await screenshot(page, '07-markdown-rendering');

    // Scroll message area
    const msgs = page.locator('.messages');
    await msgs.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);
    await screenshot(page, '07-markdown-scrolled');
  });

  test('08 - Multi-turn conversation', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // First question
    await page.fill('#chatInput', '查询质检合格率');
    await page.click('.send-btn');
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    await screenshot(page, '08-multiturn-q1');

    // Follow-up question
    await page.fill('#chatInput', '不合格的批次有哪些');
    await page.click('.send-btn');
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    // Should now have 3 AI messages and 2 user messages
    const aiMsgs = page.locator('.msg.ai');
    const userMsgs = page.locator('.msg.user');
    const aiCount = await aiMsgs.count();
    const userCount = await userMsgs.count();
    console.log(`Messages: ${aiCount} AI, ${userCount} user`);

    await screenshot(page, '08-multiturn-q2');
  });

  test('09 - Feedback buttons work', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Send a query
    await page.fill('#chatInput', '查看库存预警');
    await page.click('.send-btn');
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    // Click thumbs up on the response
    const upBtn = page.locator('.feedback-btn.up').last();
    await upBtn.click();

    // Check it's now active
    await expect(upBtn).toHaveClass(/active/);

    await screenshot(page, '09-feedback-thumbsup');

    // Click thumbs down (should replace thumbs up)
    const downBtn = page.locator('.feedback-btn.down').last();
    await downBtn.click();
    await expect(downBtn).toHaveClass(/active/);
    await expect(upBtn).not.toHaveClass(/active/);

    await screenshot(page, '09-feedback-thumbsdown');
  });

  test('10 - Enter key sends message', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Type and press Enter
    await page.fill('#chatInput', '冷链温度标准');
    await page.press('#chatInput', 'Enter');

    // Should show user message
    await expect(page.locator('.msg.user .msg-bubble')).toContainText('冷链温度标准');

    // Wait for response
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    await screenshot(page, '10-enter-key-send');
  });

  test('11 - Full page screenshot for UI review', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    // Do multiple queries to fill the chat
    const queries = [
      'HACCP体系关键控制点有哪些？',
      '黄曲霉毒素B1限量标准',
    ];

    for (const q of queries) {
      await page.fill('#chatInput', q);
      await page.click('.send-btn');
      await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });
      await page.waitForTimeout(500);
    }

    // Full page screenshot
    await screenshotFull(page, '11-full-page');

    // Scroll messages to top
    const msgs = page.locator('.messages');
    await msgs.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(300);
    await screenshot(page, '11-messages-top');

    // Scroll to bottom
    await msgs.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);
    await screenshot(page, '11-messages-bottom');
  });

  test('12 - Mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle' });

    await screenshot(page, '12-mobile-initial');

    // Send a query
    await page.fill('#chatInput', 'HACCP关键控制点');
    await page.click('.send-btn');
    await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 35000 });

    await screenshot(page, '12-mobile-response');

    // Scroll
    const msgs = page.locator('.messages');
    await msgs.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);
    await screenshot(page, '12-mobile-scrolled');
  });
});
