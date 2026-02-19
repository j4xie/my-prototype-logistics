const { chromium } = require('playwright');

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
    // Step 1: Login
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    console.log('Logging in...');
    const usernameInput = page.locator('input[type="text"], input[placeholder*="用户"], input[placeholder*="账号"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await usernameInput.fill('factory_admin1');
    await passwordInput.fill('123456');

    const loginBtn = page.locator('button[type="submit"], button:has-text("登录"), .login-btn, .el-button--primary').first();
    await loginBtn.click();

    console.log('Waiting for redirect...');
    await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {
      console.log('No dashboard redirect detected, continuing...');
    });
    await sleep(3000);
    console.log('Current URL after login:', page.url());

    // ============================================================
    // 4. Finance Analysis - All 5 tabs
    // ============================================================
    console.log('\n=== Finance Analysis ===');
    console.log('Navigating to /smart-bi/finance...');
    await page.goto(`${BASE_URL}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(5000);

    // Screenshot 1: 利润分析 tab (default)
    console.log('Taking screenshot: 04-finance-profit.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-finance-profit.png`, fullPage: false });

    // Helper: click a finance tab by label text
    async function clickFinanceTab(label) {
      console.log(`Clicking ${label} tab...`);
      // The tabs are: div.type-item > span with text
      const tab = page.locator('.type-item').filter({ hasText: label });
      const count = await tab.count();
      console.log(`  Found ${count} matching .type-item for "${label}"`);
      if (count > 0) {
        await tab.first().click();
        await sleep(3000);
        return true;
      }
      // Fallback: try generic text match and click
      const spanEl = page.locator(`span:text-is("${label}")`);
      const spanCount = await spanEl.count();
      console.log(`  Fallback: found ${spanCount} spans with text "${label}"`);
      if (spanCount > 0) {
        await spanEl.first().click();
        await sleep(3000);
        return true;
      }
      console.log(`  WARNING: Could not find tab "${label}"`);
      return false;
    }

    // Click 成本分析 tab
    await clickFinanceTab('成本分析');
    console.log('Taking screenshot: 04-finance-cost.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-finance-cost.png`, fullPage: false });

    // Click 应收分析 tab
    await clickFinanceTab('应收分析');
    console.log('Taking screenshot: 04-finance-receivable.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-finance-receivable.png`, fullPage: false });

    // Click 应付分析 tab
    await clickFinanceTab('应付分析');
    console.log('Taking screenshot: 04-finance-payable.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-finance-payable.png`, fullPage: false });

    // Click 预算分析 tab
    await clickFinanceTab('预算分析');
    console.log('Taking screenshot: 04-finance-budget.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-finance-budget.png`, fullPage: false });

    // ============================================================
    // 5. Sales Analysis
    // ============================================================
    console.log('\n=== Sales Analysis ===');
    console.log('Navigating to /smart-bi/sales...');
    await page.goto(`${BASE_URL}/smart-bi/sales`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(5000);

    // Screenshot: top of sales page
    console.log('Taking screenshot: 05-sales-top.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-sales-top.png`, fullPage: false });

    // Scroll down - try multiple scroll containers
    console.log('Scrolling down...');
    await page.evaluate(() => {
      // Try the main content area first
      const selectors = ['.el-main', '.main-content', '.app-main', '[class*="main-container"]', 'main'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) {
          el.scrollTop = el.scrollHeight;
          return;
        }
      }
      // Fallback: scroll window
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(2000);

    console.log('Taking screenshot: 05-sales-bottom.png');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-sales-bottom.png`, fullPage: false });

    console.log('\n=== All screenshots taken successfully! ===');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/error-state.png`,
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
