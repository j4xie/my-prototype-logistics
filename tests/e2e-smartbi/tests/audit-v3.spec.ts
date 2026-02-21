import { test, Page } from '@playwright/test';
import * as path from 'path';

const BASE = 'http://47.100.235.168:8088';
const SS = 'C:/Users/Steve/my-prototype-logistics/test-screenshots/audit-v3';

test.describe.serial('SmartBI Audit v3', () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  });
  test.afterAll(async () => { await page.close(); });

  test('00 - Login', async () => {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SS, '00-login.png') });
    const u = page.locator('input').first();
    const p = page.locator('input[type="password"]').first();
    await u.fill('factory_admin1');
    await p.fill('123456');
    await page.screenshot({ path: path.join(SS, '00-login-filled.png') });
    await page.locator('button').first().click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, '01-dashboard.png') });
    console.log('LOGIN_URL:', page.url());
  });

  test('01 - Sales', async () => {
    await page.goto(BASE + '/smart-bi/sales', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SS, '11-sales-top.png') });
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SS, '11-sales-bottom.png') });
    const t = await page.textContent('body');
    console.log('SALES_TEXT:', t?.substring(0, 4000));
    console.log('SALES_ERRORS:', await page.locator('.el-message--error').count());
    console.log('SALES_CANVAS:', await page.locator('canvas').count());
    console.log('SALES_ROWS:', await page.locator('.el-table__row').count());
  });

  test('02 - Sales Dropdown', async () => {
    const n = await page.locator('.el-select').count();
    console.log('SALES_SELECTS:', n);
    if (n > 0) {
      await page.locator('.el-select').first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SS, '12-sales-dropdown.png') });
      const o = await page.locator('.el-select-dropdown__item').allTextContents();
      console.log('SALES_OPTIONS:', JSON.stringify(o));
      await page.keyboard.press('Escape');
    } else {
      await page.screenshot({ path: path.join(SS, '12-sales-no-dropdown.png'), fullPage: true });
    }
  });

  test('03 - AI Query Init', async () => {
    await page.goto(BASE + '/smart-bi/query', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, '13-aiquery-initial.png') });
    const t = await page.textContent('body');
    console.log('AIQUERY_TEXT:', t?.substring(0, 4000));
  });

  test('04 - AI Query Q1', async () => {
    const ta = await page.locator('textarea').count();
    console.log('AIQUERY_TEXTAREA:', ta);
    let inp: any = ta > 0 ? page.locator('textarea').first() : page.locator('input[type="text"]').last();
    if (await inp.isVisible().catch(() => false)) {
      await inp.click();
      await inp.fill('');
      await inp.type('分析利润趋势');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SS, '14-aiquery-typing.png') });
      const btns = await page.locator('button').allTextContents();
      console.log('AIQUERY_BTNS:', JSON.stringify(btns));
      const t0 = Date.now();
      const sb = page.locator('button').filter({ hasText: /发送|Send/ }).first();
      if (await sb.isVisible().catch(() => false)) await sb.click();
      else await inp.press('Enter');
      console.log('AIQUERY: waiting 45s...');
      await page.waitForTimeout(45000);
      console.log('AIQUERY_ELAPSED:', Date.now() - t0);
      await page.screenshot({ path: path.join(SS, '14-aiquery-response-top.png') });
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SS, '14-aiquery-response-bottom.png') });
      const resp = await page.textContent('body');
      console.log('AIQUERY_RESP:', resp?.slice(-3000));
      console.log('AIQUERY_CHARTS:', await page.locator('canvas').count());
    }
  });

  test('05 - AI Query Q2', async () => {
    const ta = await page.locator('textarea').count();
    let inp: any = ta > 0 ? page.locator('textarea').first() : page.locator('input[type="text"]').last();
    if (await inp.isVisible().catch(() => false)) {
      await inp.click();
      await inp.fill('');
      await inp.type('哪个月份销售最好');
      await page.waitForTimeout(500);
      const sb = page.locator('button').filter({ hasText: /发送|Send/ }).first();
      if (await sb.isVisible().catch(() => false)) await sb.click();
      else await inp.press('Enter');
      await page.waitForTimeout(45000);
      await page.screenshot({ path: path.join(SS, '15-aiquery-response2.png') });
      const resp = await page.textContent('body');
      console.log('AIQUERY_Q2:', resp?.slice(-2000));
    }
  });

  test('06 - Analysis', async () => {
    await page.goto(BASE + '/smart-bi/analysis', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, '16-analysis-top.png') });
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SS, '16-analysis-mid.png') });
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SS, '16-analysis-bottom.png') });
    const t = await page.textContent('body');
    console.log('ANALYSIS_TEXT:', t?.substring(0, 3000));
  });

  test('07 - Finance', async () => {
    await page.goto(BASE + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SS, '19-finance-top.png') });
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SS, '19-finance-bottom.png') });
    const t = await page.textContent('body');
    console.log('FINANCE_TEXT:', t?.substring(0, 2000));
  });

  test('08 - Dashboard', async () => {
    await page.goto(BASE + '/smart-bi/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, '20-smartbi-dashboard.png') });
    const t = await page.textContent('body');
    console.log('DASHBOARD_TEXT:', t?.substring(0, 2000));
  });

  test('09 - Sidebar', async () => {
    const sb = page.locator('.el-aside, aside').first();
    if (await sb.isVisible().catch(() => false)) {
      await sb.screenshot({ path: path.join(SS, '21-sidebar.png') });
    }
    const items = await page.locator('.el-menu-item, .el-sub-menu__title').allTextContents();
    console.log('MENU:', JSON.stringify(items));
  });
});
