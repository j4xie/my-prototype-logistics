import { test, Page } from '@playwright/test';
import path from 'path';

const SD = path.resolve(__dirname, '../../../test-screenshots/smartbi-ui-audit');
const BU = 'http://47.100.235.168:8088';

test('Debug login and nav', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(BU + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SD, 'D0-login-page.png'), fullPage: false });
  console.log('Login page URL: ' + page.url());

  await page.locator('input[type="text"]').first().fill('factory_admin1');
  await page.locator('input[type="password"]').first().fill('123456');
  const btns = page.locator('button');
  for (let i = 0; i < await btns.count(); i++) {
    const t = await btns.nth(i).textContent();
    if (t && (t.includes('登录') || t.includes('Login'))) { await btns.nth(i).click(); break; }
  }
  await page.waitForTimeout(5000);
  console.log('After login URL: ' + page.url());
  await page.screenshot({ path: path.join(SD, 'D1-after-login.png'), fullPage: false });

  // Navigate to dashboard
  await page.goto(BU + '/smart-bi/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('Dashboard URL: ' + page.url());
  await page.screenshot({ path: path.join(SD, 'D2-dashboard.png'), fullPage: false });

  // Check page content
  const allH1 = await page.locator('h1').allTextContents();
  console.log('H1 elements: ' + JSON.stringify(allH1));
  const allH2 = await page.locator('h2').allTextContents();
  console.log('H2 elements: ' + JSON.stringify(allH2));
  const bodyText = await page.locator('body').innerText();
  console.log('Body text (first 500): ' + bodyText.substring(0, 500));

  // Check if AppLayout sidebar is visible
  const sidebar = await page.locator('.app-sidebar, .el-aside, aside').count();
  console.log('Sidebar elements: ' + sidebar);
  const mainContent = await page.locator('.smart-bi-dashboard').count();
  console.log('Dashboard component: ' + mainContent);

  // Navigate to finance
  await page.goto(BU + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('Finance URL: ' + page.url());
  await page.screenshot({ path: path.join(SD, 'D3-finance.png'), fullPage: false });
  const finContent = await page.locator('.finance-analysis-page').count();
  console.log('Finance component: ' + finContent);
  const finBody = await page.locator('body').innerText();
  console.log('Finance body (first 500): ' + finBody.substring(0, 500));
});