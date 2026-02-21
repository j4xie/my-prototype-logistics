import { test, Page } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';
const SD = 'test-screenshots/smartbi-audit-prod';

async function login(page: Page, username: string, password: string) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u7528\u6237\u540d').fill(username);
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u5bc6\u7801').fill(password);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '\u767b \u5f55' }).click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
}

test.describe('SmartBI Audit', () => {
  test.setTimeout(300000);

  test('P1 Dashboard', async ({ page }) => {
    await login(page, 'factory_admin1', '123456');
    await page.screenshot({ path: SD + '/01-dashboard.png', fullPage: true });
    console.log('P1 URL:', page.url());
    console.log('P1 TEXT:', (await page.locator('body').innerText()).substring(0, 3000));
  });

  test('P2 SmartBI Dashboard', async ({ page }) => {
    await login(page, 'factory_admin1', '123456');
    await page.goto(BASE_URL + '/smart-bi/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/02-smartbi-dashboard.png', fullPage: true });
    console.log('P2 URL:', page.url());
    console.log('P2 TEXT:', (await page.locator('body').innerText()).substring(0, 3000));
  });

  test('P3 Analysis', async ({ page }) => {
    await login(page, 'factory_admin1', '123456');
    await page.goto(BASE_URL + '/smart-bi/analysis', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(10000);
    await page.screenshot({ path: SD + '/03-analysis.png', fullPage: true });
    console.log('P3 URL:', page.url());
    console.log('P3 TEXT:', (await page.locator('body').innerText()).substring(0, 3000));
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SD + '/03b-analysis-scroll.png', fullPage: true });
  });

  test('P4 Finance tabs', async ({ page }) => {
    await login(page, 'factory_admin1', '123456');
    await page.goto(BASE_URL + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/04a-finance-profit.png', fullPage: true });
    console.log('P4a URL:', page.url());
    console.log('P4a TEXT:', (await page.locator('body').innerText()).substring(0, 2000));

    const tabs = ['\u6210\u672c\u5206\u6790','\u5e94\u6536\u5206\u6790','\u5e94\u4ed8\u5206\u6790','\u9884\u7b97\u5206\u6790'];
    const sfx = ['04b-cost','04c-recv','04d-pay','04e-budget'];
    for (let i = 0; i < tabs.length; i++) {
      const t = page.locator('.el-tabs__item').filter({ hasText: tabs[i] }).first();
      if (await t.isVisible().catch(() => false)) {
        await t.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: SD + '/' + sfx[i] + '.png', fullPage: true });
        console.log('P4-' + sfx[i] + ' TEXT:', (await page.locator('body').innerText()).substring(0, 1500));
      } else {
        console.log('P4 tab ' + tabs[i] + ' NOT FOUND');
      }
    }
  });

  test('P5 Sales', async ({ page }) => {
    await login(page, 'factory_admin1', '123456');
    await page.goto(BASE_URL + '/smart-bi/sales', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/05-sales.png', fullPage: true });
    console.log('P5 URL:', page.url());
    console.log('P5 TEXT:', (await page.locator('body').innerText()).substring(0, 3000));
  });

  test('P6 AI Query', async ({ page }) => {
    await login(page, 'factory_admin1', '123456');
    await page.goto(BASE_URL + '/smart-bi/query', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SD + '/06a-query-init.png', fullPage: true });
    console.log('P6a URL:', page.url());
    console.log('P6a TEXT:', (await page.locator('body').innerText()).substring(0, 2000));
    const ta = page.locator('textarea').first();
    const ti = page.locator('input[type="text"]').last();
    let inp = ta;
    if (!(await ta.isVisible().catch(() => false))) inp = ti;
    if (await inp.isVisible().catch(() => false)) {
      await inp.fill('\u5206\u6790\u5229\u6da6\u8d8b\u52bf');
      await page.waitForTimeout(500);
      const sb = page.locator('button').filter({ hasText: /\u53d1\u9001/ }).first();
      if (await sb.isVisible().catch(() => false)) await sb.click();
      else await inp.press('Enter');
      await page.waitForTimeout(20000);
      await page.screenshot({ path: SD + '/06b-query-resp.png', fullPage: true });
      console.log('P6b TEXT:', (await page.locator('body').innerText()).substring(0, 3000));
    } else { console.log('P6 INPUT NOT FOUND'); }
  });

  test('P7 finance_mgr', async ({ page }) => {
    await login(page, 'finance_mgr1', '123456');
    await page.screenshot({ path: SD + '/07a-fmgr-dash.png', fullPage: true });
    console.log('P7a URL:', page.url());
    console.log('P7a TEXT:', (await page.locator('body').innerText()).substring(0, 2000));
    const sb = page.locator('.el-menu, aside').first();
    console.log('P7a SIDEBAR:', (await sb.innerText().catch(() => 'NOT FOUND')).substring(0, 1000));
    await page.goto(BASE_URL + '/production/batches', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SD + '/07b-fmgr-forbidden.png', fullPage: true });
    console.log('P7b URL:', page.url());
    console.log('P7b TEXT:', (await page.locator('body').innerText()).substring(0, 1000));
  });
});
