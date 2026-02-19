import { test, Page } from '@playwright/test';
import path from 'path';

const SD = path.resolve(__dirname, '../../../test-screenshots/smartbi-ui-audit');
const BU = 'http://47.100.235.168:8088';
const R: { s: string; st: string; d: string; }[] = [];
function rec(s: string, st: string, d: string) { R.push({ s, st, d }); console.log('[' + st + '] ' + s + ': ' + d); }

async function doLogin(page: Page) {
  await page.goto(BU + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  // Click quick-login button for factory_admin1
  const quickBtns = page.locator('.quick-login button');
  if (await quickBtns.count() > 0) { await quickBtns.first().click(); await page.waitForTimeout(500); }
  // Click the submit button
  const submitBtn = page.locator('.login-form button').first();
  await submitBtn.click();
  // Wait for navigation to complete
  await page.waitForTimeout(8000);
  console.log('Logged in at: ' + page.url());
}
async function clickTab(page: Page, name: string) {
  const tabs = page.locator('.type-item');
  for (let i = 0; i < await tabs.count(); i++) {
    const t = await tabs.nth(i).textContent();
    if (t && t.includes(name)) { await tabs.nth(i).click(); return; }
  }
}

async function getKPIs(page: Page, pfx: string) {
  const ls = page.locator('.kpi-label'); const vs = page.locator('.kpi-value');
  const c = await ls.count();
  rec(pfx + '-KPI-Count', c > 0 ? 'PASS' : 'ISSUE', c + ' KPI cards');
  for (let i = 0; i < c; i++) {
    const l = await ls.nth(i).textContent().catch(() => 'N/A');
    const v = await vs.nth(i).textContent().catch(() => 'N/A');
    rec(pfx + '-KPI-' + (l||'').trim(), 'PASS', (l||'').trim() + ': ' + (v||'').trim());
  }
}

async function getAlerts(page: Page, pfx: string) {
  const als = page.locator('.el-alert');
  for (let i = 0; i < await als.count(); i++) {
    const t = await als.nth(i).textContent().catch(() => '');
    const cls = await als.nth(i).getAttribute('class') || '';
    const st = cls.includes('error') ? 'FAIL' : cls.includes('warning') ? 'ISSUE' : 'PASS';
    rec(pfx + '-Alert-' + (i+1), st, 'Alert: ' + (t||'').substring(0, 150));
  }
}

test.describe('SmartBI UI Audit', () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    page = await ctx.newPage();
    await doLogin(page);
  });
  test.afterAll(async () => {
    console.log('\n========== AUDIT SUMMARY ==========');
    for (const r of R) console.log('[' + r.st + '] ' + r.s + ': ' + r.d);
    const p = R.filter(r => r.st === 'PASS').length;
    const i2 = R.filter(r => r.st === 'ISSUE').length;
    const f = R.filter(r => r.st === 'FAIL').length;
    console.log('\nTotal: ' + R.length + ' - ' + p + ' PASS, ' + i2 + ' ISSUE, ' + f + ' FAIL');
    await page.context().close();
  });

  test('Test A: Dashboard', async () => {
    await page.goto(BU + '/smart-bi/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SD, 'A1-dashboard.png'), fullPage: false });
    rec('A-Load', 'PASS', 'Page loaded');
    const t = await page.locator('h1').first().textContent().catch(() => null);
    rec('A-Title', t ? 'PASS' : 'FAIL', 'Title: ' + (t || 'NOT FOUND'));
    const kc = await page.locator('.kpi-card').count();
    rec('A-KPI-Cards', kc === 4 ? 'PASS' : 'ISSUE', kc + ' cards');
    for (let i = 0; i < await page.locator('.kpi-value').count(); i++) {
      const v = await page.locator('.kpi-value').nth(i).textContent();
      const l = await page.locator('.kpi-label').nth(i).textContent().catch(() => '?');
      rec('A-KPI-' + (i+1), 'PASS', l + ': ' + v);
    }
    rec('A-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
    const errs = await page.locator('.el-alert--error').count();
    rec('A-Errors', errs === 0 ? 'PASS' : 'FAIL', errs + ' errors');
    rec('A-Loading', (await page.locator('.el-loading-mask:visible').count()) === 0 ? 'PASS' : 'ISSUE', 'Loading check');
    rec('A-Rankings', (await page.locator('.ranking-item').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('.ranking-item').count()) + ' items');
    rec('A-Insights', (await page.locator('.insight-item').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('.insight-item').count()) + ' items');
    rec('A-DS', (await page.locator('.datasource-card').count()) > 0 ? 'PASS' : 'FAIL', 'DS selector');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SD, 'A2-scrolled.png'), fullPage: false });
    rec('A-QuickQA', (await page.locator('.quick-qa-section').count()) > 0 ? 'PASS' : 'ISSUE', 'QA section');
    await page.screenshot({ path: path.join(SD, 'A3-fullpage.png'), fullPage: true });
  });

  test('Test B: Finance - All 5 Tabs', async () => {
    await page.goto(BU + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    const title = await page.locator('h1').first().textContent().catch(() => null);
    rec('B-Title', title ? 'PASS' : 'ISSUE', 'Title: ' + (title || 'NONE'));
    rec('B-Filter', (await page.locator('.filter-card').count()) > 0 ? 'PASS' : 'FAIL', 'Filter card');
    await page.screenshot({ path: path.join(SD, 'B1-profit.png'), fullPage: false });
    const al = await page.locator('.type-item.active').textContent().catch(() => '');
    rec('B1-Tab', 'PASS', 'Active: ' + (al||'').trim());
    await getKPIs(page, 'B1');
    rec('B1-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
    await getAlerts(page, 'B1');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SD, 'B1b-profit-charts.png'), fullPage: false });
    await clickTab(page, '成本分析');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SD, 'B2-cost.png'), fullPage: false });
    await getKPIs(page, 'B2');
    rec('B2-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
    await getAlerts(page, 'B2');
    await clickTab(page, '应收分析');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SD, 'B3-recv.png'), fullPage: false });
    await getKPIs(page, 'B3');
    rec('B3-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
    await getAlerts(page, 'B3');
    await clickTab(page, '应付分析');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SD, 'B4-pay.png'), fullPage: false });
    await getKPIs(page, 'B4');
    rec('B4-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
    await getAlerts(page, 'B4');
    await clickTab(page, '预算分析');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SD, 'B5-budget.png'), fullPage: false });
    await getKPIs(page, 'B5');
    rec('B5-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
    await getAlerts(page, 'B5');
    await page.screenshot({ path: path.join(SD, 'B6-full.png'), fullPage: true });
  });

  test('Test C: Upload Data', async () => {
    await page.goto(BU + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await clickTab(page, '利润分析');
    await page.waitForTimeout(1000);
    const ds = page.locator('.filter-card .el-select').first();
    if (await ds.count() === 0) { rec('C-DS', 'FAIL', 'No selector'); return; }
    await ds.click();
    await page.waitForTimeout(1000);
    const opts = page.locator('.el-select-dropdown__item:visible');
    const oc = await opts.count();
    rec('C-Opts', 'PASS', oc + ' options');
    for (let i = 0; i < oc && i < 10; i++) { const t = await opts.nth(i).textContent(); rec('C-Opt-' + (i+1), 'PASS', (t||'').trim()); }
    if (oc > 1) {
      await opts.nth(1).click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(SD, 'C1-upload.png'), fullPage: false });
      rec('C-Upload', 'PASS', 'Switched');
      await getKPIs(page, 'C-Up');
      rec('C-Charts', (await page.locator('canvas').count()) > 0 ? 'PASS' : 'ISSUE', (await page.locator('canvas').count()) + ' charts');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SD, 'C2-scrolled.png'), fullPage: true });
    } else {
      rec('C-NoUpload', 'ISSUE', 'No upload data');
      await page.keyboard.press('Escape');
    }
  });
});
