const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://47.100.235.168:8088';
const OUTPUT_DIR = path.resolve(__dirname, '../../test-screenshots/audit-v4');

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

    const usernameInput = page.locator('input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await usernameInput.fill('factory_admin1');
    await passwordInput.fill('123456');
    await sleep(500);

    await page.locator('.el-button--primary').first().click();
    await sleep(3000);

    try {
      await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    } catch (e) {
      console.log('  Warning: still on login page');
    }
    await sleep(2000);
    console.log('  Logged in, URL:', page.url());

    // ===== A. General Dashboard =====
    console.log('\n=== A. General Dashboard ===');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
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
    console.log('  Waiting 15s for enrichment...');
    await sleep(15000);

    // screenshot top (KPIs)
    await screenshot(page, '03-analysis-kpi.png');

    // scroll to charts
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

    // Look for sheet selector - check visible tabs only
    console.log('\n  Looking for sheet selector...');
    await scrollToTop(page);
    await sleep(1000);

    // Get all visible el-tabs items
    const visibleTabs = page.locator('.el-tabs__item:visible');
    const visibleTabCount = await visibleTabs.count();
    console.log(`  Visible tabs: ${visibleTabCount}`);

    let foundSheet2 = false;
    if (visibleTabCount > 1) {
      const tabText = await visibleTabs.nth(1).textContent();
      console.log(`  Clicking visible tab: "${tabText}"`);
      await visibleTabs.nth(1).click();
      foundSheet2 = true;
    }

    if (foundSheet2) {
      console.log('  Waiting 10s for sheet2...');
      await sleep(10000);
      await scrollToTop(page);
      await sleep(500);
      await screenshot(page, '03-analysis-sheet2-kpi.png');

      await scrollDown(page, 600);
      await sleep(2000);
      await screenshot(page, '03-analysis-sheet2-charts.png');
    } else {
      console.log('  Only 1 sheet available. Taking additional scroll positions instead.');
      // Continue scrolling for more content
      await scrollDown(page, 300);
      await sleep(1500);
      await screenshot(page, '03-analysis-sheet2-kpi.png');

      await scrollDown(page, 300);
      await sleep(1500);
      await screenshot(page, '03-analysis-sheet2-charts.png');
    }

    // ===== D. Full-page screenshots =====
    console.log('\n=== D. Full-page Analysis screenshot ===');
    await scrollToTop(page);
    await sleep(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '03-analysis-full.png'),
      fullPage: true,
    });
    console.log('  Saved: 03-analysis-full.png');

    // ===== E. Sales Analysis =====
    console.log('\n=== E. Sales Analysis ===');
    await page.goto(`${BASE_URL}/smart-bi/sales`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(5000);
    await screenshot(page, '04-sales-analysis.png');

    // ===== F. Finance Analysis =====
    console.log('\n=== F. Finance Analysis ===');
    await page.goto(`${BASE_URL}/smart-bi/finance`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(5000);
    await screenshot(page, '05-finance-analysis.png');

    // ===== G. AI Query =====
    console.log('\n=== G. AI Query ===');
    await page.goto(`${BASE_URL}/smart-bi/query`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await screenshot(page, '06-ai-query.png');

    console.log('\n=== ALL SCREENSHOTS COMPLETE ===');
    console.log(`Total files in ${OUTPUT_DIR}:`);
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => console.log(`  ${f}`));
    console.log(`  Total: ${files.length} PNG files`);

  } catch (err) {
    console.error('ERROR:', err.message);
    try {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png') });
      console.log('  Saved error-state.png');
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

main();
