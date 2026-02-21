const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://47.100.235.168:8088';
const OUTPUT_DIR = path.resolve(__dirname, '../../test-screenshots/audit-v4');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
  const filePath = path.join(OUTPUT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  Saved: ${name}`);
}

async function scrollDown(page, pixels) {
  await page.evaluate((px) => {
    // Try scrolling multiple containers
    const containers = [
      document.querySelector('.app-main'),
      document.querySelector('.el-main'),
      document.querySelector('main'),
      document.documentElement,
    ];
    for (const el of containers) {
      if (el) el.scrollTop += px;
    }
    window.scrollBy(0, px);
  }, pixels);
}

async function scrollToTop(page) {
  await page.evaluate(() => {
    const containers = [
      document.querySelector('.app-main'),
      document.querySelector('.el-main'),
      document.querySelector('main'),
      document.documentElement,
    ];
    for (const el of containers) {
      if (el) el.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  });
}

async function main() {
  console.log(`Output directory: ${OUTPUT_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // ===== Step 1: Login =====
    console.log('=== Step 1: Login ===');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    console.log('  Page loaded, URL:', page.url());

    // Debug: list all input elements
    const inputs = await page.locator('input').all();
    console.log(`  Found ${inputs.length} input elements`);

    // Fill login form - try multiple selectors
    let usernameInput, passwordInput;

    // Try specific selectors first
    const inputSelectors = [
      'input[type="text"]',
      'input[placeholder*="用户"]',
      'input[placeholder*="user"]',
      'input[name="username"]',
      'input:not([type="password"]):not([type="hidden"])',
    ];

    for (const sel of inputSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        usernameInput = el;
        console.log(`  Username input found with: ${sel}`);
        break;
      }
    }

    passwordInput = page.locator('input[type="password"]').first();

    if (!usernameInput || await usernameInput.count() === 0) {
      // Last resort: take all inputs and use first two
      usernameInput = page.locator('input').first();
      console.log('  Using first input as username');
    }

    await usernameInput.fill('factory_admin1');
    await passwordInput.fill('123456');
    await sleep(500);
    console.log('  Credentials filled');

    // Click login button
    const loginBtnSelectors = [
      'button:has-text("登录")',
      'button:has-text("Login")',
      'button[type="submit"]',
      '.el-button--primary',
    ];

    for (const sel of loginBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0) {
        console.log(`  Clicking login button: ${sel}`);
        await btn.click();
        break;
      }
    }

    await sleep(3000);

    // Wait for navigation
    try {
      await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    } catch (e) {
      console.log('  Warning: still on login page after clicking login');
    }
    await sleep(2000);
    console.log('  Current URL after login:', page.url());

    // ===== A. General Dashboard =====
    console.log('\n=== A. General Dashboard ===');
    // Navigate to root/dashboard
    if (!page.url().includes('/dashboard')) {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    }
    await sleep(3000);
    await screenshot(page, '01-dashboard-top.png');

    await scrollDown(page, 500);
    await sleep(1500);
    await screenshot(page, '01-dashboard-bottom.png');

    // ===== B. SmartBI Dashboard =====
    console.log('\n=== B. SmartBI Dashboard ===');
    await page.goto(`${BASE_URL}/smart-bi/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(5000);
    await screenshot(page, '02-smartbi-dash-top.png');

    await scrollDown(page, 400);
    await sleep(2000);
    await screenshot(page, '02-smartbi-dash-mid.png');

    await scrollDown(page, 400);
    await sleep(2000);
    await screenshot(page, '02-smartbi-dash-bottom.png');

    // ===== C. SmartBI Analysis =====
    console.log('\n=== C. SmartBI Analysis ===');
    await page.goto(`${BASE_URL}/smart-bi/analysis`, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('  Waiting 15s for enrichment to complete...');
    await sleep(15000);

    await screenshot(page, '03-analysis-kpi.png');

    await scrollDown(page, 300);
    await sleep(2000);
    await screenshot(page, '03-analysis-chart1.png');

    await scrollDown(page, 300);
    await sleep(2000);
    await screenshot(page, '03-analysis-chart2.png');

    await scrollDown(page, 300);
    await sleep(2000);
    await screenshot(page, '03-analysis-chart3.png');

    await scrollDown(page, 300);
    await sleep(2000);
    await screenshot(page, '03-analysis-ai.png');

    // Scroll back to top and look for sheet selector
    console.log('\n  Looking for sheet selector...');
    await scrollToTop(page);
    await sleep(1000);

    // Check for tabs or selectors
    let foundSheet2 = false;

    // Strategy 1: el-tabs
    const elTabItems = page.locator('.el-tabs__item');
    const tabCount = await elTabItems.count();
    console.log(`  el-tabs__item count: ${tabCount}`);

    if (tabCount > 1) {
      const tabText = await elTabItems.nth(1).textContent();
      console.log(`  Clicking tab: "${tabText}"`);
      await elTabItems.nth(1).click();
      foundSheet2 = true;
    }

    // Strategy 2: radio buttons
    if (!foundSheet2) {
      const radioLabels = page.locator('.el-radio-button__inner, .el-radio__label');
      const radioCount = await radioLabels.count();
      console.log(`  radio labels count: ${radioCount}`);
      if (radioCount > 1) {
        await radioLabels.nth(1).click();
        foundSheet2 = true;
      }
    }

    // Strategy 3: buttons with sheet-like names
    if (!foundSheet2) {
      const sheetBtns = page.locator('button, .el-button').filter({ hasText: /利润|收入|费用|返利|明细|月度|年度/ });
      const sheetBtnCount = await sheetBtns.count();
      console.log(`  sheet-like buttons: ${sheetBtnCount}`);
      if (sheetBtnCount > 0) {
        const btnText = await sheetBtns.first().textContent();
        console.log(`  Clicking sheet button: "${btnText}"`);
        await sheetBtns.first().click();
        foundSheet2 = true;
      }
    }

    if (foundSheet2) {
      console.log('  Waiting 10s for sheet2 to load...');
      await sleep(10000);
      await scrollToTop(page);
      await sleep(500);
      await screenshot(page, '03-analysis-sheet2-kpi.png');

      await scrollDown(page, 600);
      await sleep(2000);
      await screenshot(page, '03-analysis-sheet2-charts.png');
    } else {
      console.log('  No sheet selector found. Taking additional scroll positions.');
      await scrollDown(page, 300);
      await sleep(1000);
      await screenshot(page, '03-analysis-sheet2-kpi.png');

      await scrollDown(page, 600);
      await sleep(1000);
      await screenshot(page, '03-analysis-sheet2-charts.png');
    }

    console.log('\n=== All screenshots complete! ===');

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    try {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png') });
      console.log('  Saved error-state.png');
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

main();
