import { test, Page } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';
const SCREENSHOT_DIR = 'test-results/p2-detailed';

test('P2 detailed probe', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Login
  await page.goto(BASE_URL + '/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().fill('factory_admin1');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');

  // Navigate to Finance
  const smartbiMenu = page.getByRole('menuitem', { name: '智能BI' });
  const expanded = await smartbiMenu.getAttribute('aria-expanded').catch(() => null);
  if (expanded !== 'true') {
    await smartbiMenu.locator('> div').first().click();
    await page.waitForTimeout(1000);
  }
  await page.getByRole('menuitem', { name: '财务数据分析' }).click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');

  // Full page snapshot
  const snapshot = await page.accessibility.snapshot();
  console.log('=== PAGE ACCESSIBILITY TREE ===');
  console.log(JSON.stringify(snapshot, null, 2).substring(0, 5000));

  // Get all interactive elements
  const buttons = await page.locator('button').allTextContents();
  console.log('=== BUTTONS ===');
  console.log(buttons.join(' | '));

  // Get all tabs
  const tabItems = await page.locator('.el-tabs__item').allTextContents();
  console.log('=== TAB ITEMS (.el-tabs__item) ===');
  console.log(tabItems.length > 0 ? tabItems.join(' | ') : '(none)');

  // Try other tab selectors
  const tabPanes = await page.locator('[role="tab"]').allTextContents();
  console.log('=== TAB ITEMS ([role=tab]) ===');
  console.log(tabPanes.length > 0 ? tabPanes.join(' | ') : '(none)');

  // Radio buttons / segments
  const radios = await page.locator('.el-radio-button, .el-radio-group label, .el-segmented').allTextContents();
  console.log('=== RADIO/SEGMENTS ===');
  console.log(radios.length > 0 ? radios.join(' | ') : '(none)');

  // Check for any text mentioning cost/receivable/budget/profit
  const allText = await page.locator('body').textContent() || '';
  const keywords = ['利润', '成本', '应收', '现金', '预算', '暂无', '图表', 'empty'];
  for (const kw of keywords) {
    console.log('Contains "' + kw + '": ' + allText.includes(kw));
  }

  // Check for canvas elements
  const canvasCount = await page.locator('canvas').count();
  console.log('Canvas count: ' + canvasCount);

  // Check for el-empty elements
  const emptyCount = await page.locator('.el-empty').count();
  console.log('el-empty count: ' + emptyCount);

  // Check for alerts
  const alertCount = await page.locator('.el-alert').count();
  console.log('el-alert count: ' + alertCount);

  // Check for charts
  const echartsDivs = await page.locator('[_echarts_instance_]').count();
  console.log('echarts divs: ' + echartsDivs);

  // Screenshot the main content area
  await page.screenshot({ path: SCREENSHOT_DIR + '/finance-detail.png', fullPage: true });

  // Try scrolling to see if there is more
  await page.evaluate('window.scrollBy(0, 500)');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SCREENSHOT_DIR + '/finance-scrolled.png', fullPage: true });

  // Get inner HTML of the main content to see component structure
  const mainHtml = await page.locator('.app-main, .el-main, main').first().innerHTML().catch(() => '(not found)');
  console.log('=== MAIN CONTENT HTML (first 3000 chars) ===');
  console.log(mainHtml.substring(0, 3000));

  await page.close();
});
