const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOT_DIR = 'C:/Users/Steve/my-prototype-logistics/test-screenshots/smartbi-audit';
const BASE_URL = 'http://47.100.235.168:8088';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  try {
    // Login as factory_admin1
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    console.log('Logging in as factory_admin1...');
    const usernameInput = page.locator('input[type="text"], input[placeholder*="用户"], input[placeholder*="账号"]').first();
    await usernameInput.fill('factory_admin1');
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('123456');
    const loginBtn = page.locator('button[type="submit"], button:has-text("登录"), .login-btn, .el-button--primary').first();
    await loginBtn.click();

    await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
    await sleep(3000);
    console.log('Current URL after login:', page.url());

    // Navigate to AI Query
    console.log('Navigating to /smart-bi/query...');
    await page.goto(`${BASE_URL}/smart-bi/query`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);

    // Find and type in the chat input
    console.log('Looking for chat input...');
    const possibleInputs = [
      'textarea',
      '.el-textarea__inner',
      'input[placeholder*="输入"]',
      'input[placeholder*="问"]',
    ];

    let inputEl = null;
    for (const selector of possibleInputs) {
      const els = page.locator(selector);
      const count = await els.count();
      for (let i = count - 1; i >= 0; i--) {
        const el = els.nth(i);
        const visible = await el.isVisible().catch(() => false);
        if (visible) {
          console.log(`  Found input: ${selector} (index ${i})`);
          inputEl = el;
          break;
        }
      }
      if (inputEl) break;
    }

    if (inputEl) {
      await inputEl.click();
      await inputEl.fill('分析各月份的收入和利润变化趋势');
      console.log('  Query typed successfully');
    } else {
      console.log('  WARNING: Could not find chat input');
    }

    await sleep(500);

    // Click send button
    console.log('Clicking send button...');
    const sendBtn = page.locator('button:has-text("发送")').first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
      console.log('  Send button clicked');
    } else {
      console.log('  Trying Enter key...');
      await page.keyboard.press('Enter');
    }

    // Wait for AI response - poll until "正在思考" disappears or 120s max
    console.log('Waiting for AI response (up to 120 seconds)...');
    const startTime = Date.now();
    let responseReady = false;

    for (let i = 0; i < 24; i++) {  // 24 * 5s = 120s max
      await sleep(5000);
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Check if "正在思考" or loading indicator is still present
      const thinking = await page.locator('text=正在思考').count();
      const loading = await page.locator('.loading, .typing-indicator, [class*="loading"]').count();

      console.log(`  ${elapsed}s elapsed - thinking indicators: ${thinking}, loading: ${loading}`);

      if (thinking === 0 && loading === 0) {
        // Also check if any response text appeared (beyond the initial greeting)
        const messageBlocks = await page.locator('.message-content, .chat-message, [class*="message"]').count();
        console.log(`  Response blocks: ${messageBlocks}`);
        responseReady = true;
        // Wait a bit more for any charts to render
        await sleep(3000);
        break;
      }
    }

    if (!responseReady) {
      console.log('  WARNING: AI response still loading after 120s, taking screenshot anyway');
    }

    // Screenshot: response
    console.log('Taking screenshot: 06-ai-query-response.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-ai-query-response.png`, fullPage: false });

    // Scroll down to check for charts
    console.log('Scrolling down to check for charts...');
    await page.evaluate(() => {
      const containers = document.querySelectorAll('.chat-messages, .message-list, .chat-container, .el-main, main, [class*="chat"], [class*="message"]');
      let scrolled = false;
      for (const c of containers) {
        if (c.scrollHeight > c.clientHeight) {
          c.scrollTop = c.scrollHeight;
          scrolled = true;
        }
      }
      if (!scrolled) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
    await sleep(3000);

    // Screenshot: chart area (after scrolling)
    console.log('Taking screenshot: 06-ai-query-chart.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-ai-query-chart.png`, fullPage: false });

    console.log('\n=== AI Query screenshots completed! ===');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/error-ai-query.png`,
      fullPage: false
    }).catch(() => {});
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
