import { test, expect } from '@playwright/test';

test('Verify Sales KPI formatting fix', async ({ page }) => {
  // 1. Login
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  const usernameInput = page.locator('input[type="text"], input[placeholder*="用户"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  await usernameInput.fill('factory_admin1');
  await passwordInput.fill('123456');
  
  // Click login button
  const loginBtn = page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first();
  await loginBtn.click();
  
  // Wait for redirect
  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {
    console.log('URL did not change to dashboard, continuing...');
  });
  await page.waitForTimeout(2000);
  
  // Take screenshot of current page after login
  await page.screenshot({ path: 'test-results/01-after-login.png', fullPage: true });
  console.log('Current URL after login:', page.url());
  
  // 2. Navigate to 销售分析
  // Try clicking sidebar items
  const sidebarItems = page.locator('.el-menu-item, .el-sub-menu__title');
  const count = await sidebarItems.count();
  console.log(`Found ${count} sidebar items`);
  
  // First, try to find and expand SmartBI/智能BI parent menu if needed
  const smartbiParent = page.locator('text=智能BI').first();
  if (await smartbiParent.isVisible({ timeout: 3000 }).catch(() => false)) {
    await smartbiParent.click();
    await page.waitForTimeout(500);
  }
  
  // Now click 销售分析
  const salesLink = page.locator('text=销售分析').first();
  await salesLink.waitFor({ state: 'visible', timeout: 10000 });
  await salesLink.click();
  
  // 3. Wait for data to load
  console.log('Waiting 8 seconds for sales data to load...');
  await page.waitForTimeout(8000);
  
  // Take screenshot of the full page
  await page.screenshot({ path: 'test-results/02-sales-page-full.png', fullPage: true });
  
  // 4. Take screenshot of KPI cards area specifically
  // KPI cards are typically at the top in .kpi-row, .kpi-cards, or similar containers
  const kpiArea = page.locator('.kpi-row, .kpi-cards, .kpi-container, .stats-row, [class*="kpi"], [class*="stat-card"]').first();
  if (await kpiArea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await kpiArea.screenshot({ path: 'test-results/03-kpi-cards-area.png' });
  }
  
  // 5. Extract KPI card values
  // Look for all card-like elements
  const allText = await page.locator('.el-card, [class*="card"], [class*="kpi"], [class*="stat"]').allTextContents();
  console.log('\n=== All card text contents ===');
  for (const t of allText) {
    if (t.trim()) console.log(`  Card: "${t.trim().substring(0, 200)}"`);
  }
  
  // Also try to get specific KPI values
  const pageText = await page.locator('body').textContent();
  
  // Look for 总销售额
  const salesMatch = pageText?.match(/总销售额[^0-9]*([0-9.,万亿]+)/);
  if (salesMatch) {
    console.log(`\n总销售额 value: "${salesMatch[1]}"`);
  }
  
  // Look for 客单价
  const avgMatch = pageText?.match(/客单价[^0-9]*([0-9.,万亿]+)/);
  if (avgMatch) {
    console.log(`客单价 value: "${avgMatch[1]}"`);
  }
  
  // Look for 订单数
  const orderMatch = pageText?.match(/订单数[^0-9]*([0-9.,万亿]+)/);
  if (orderMatch) {
    console.log(`订单数 value: "${orderMatch[1]}"`);
  }
  
  // Get a more comprehensive view - grab all visible text that looks like KPI
  const allPageText = await page.textContent('body') || '';
  
  // Find numeric values near KPI-like labels
  const kpiPatterns = [
    /总销售额[\s\S]{0,30}?([0-9][0-9,.万亿%]+)/,
    /客单价[\s\S]{0,30}?([0-9][0-9,.万亿%]+)/,
    /订单数[\s\S]{0,30}?([0-9][0-9,.万亿%]+)/,
    /同比[\s\S]{0,10}?([+-]?[0-9][0-9,.%]+)/,
    /环比[\s\S]{0,10}?([+-]?[0-9][0-9,.%]+)/,
    /增长[\s\S]{0,10}?([+-]?[0-9][0-9,.%]+)/,
  ];
  
  console.log('\n=== KPI Pattern Matches ===');
  for (const pat of kpiPatterns) {
    const m = allPageText.match(pat);
    if (m) console.log(`  ${pat.source.substring(0,15)}... => "${m[1]}"`);
  }
  
  // 6. Final detailed screenshot zoomed into top section
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: 'test-results/04-sales-top-section.png',
    clip: { x: 0, y: 0, width: 1920, height: 500 }
  });
  
  // Also try getting all el-statistic or number displays
  const statNumbers = await page.locator('.el-statistic__number, [class*="value"], [class*="amount"], [class*="number"]').allTextContents();
  console.log('\n=== Statistic/Value elements ===');
  for (const n of statNumbers) {
    if (n.trim()) console.log(`  Value: "${n.trim()}"`);
  }
  
  console.log('\n=== VERIFICATION COMPLETE ===');
  console.log('Check test-results/ folder for screenshots');
});
