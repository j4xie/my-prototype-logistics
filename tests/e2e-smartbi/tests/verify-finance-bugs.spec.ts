import { test } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';
const SD = 'tests/finance-bug-screenshots';

test.describe('Finance Bugs', () => {
  test.setTimeout(180000);

  test('All tests', async ({ page }) => {
    // LOGIN - use quick login button
    console.log('=== LOGIN ===');
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: SD + '/01-login.png', fullPage: true });

    // Use the quick login button for finance manager
    const quickBtn = page.getByRole('button', { name: '财务经理' });
    await quickBtn.click();
    await page.waitForTimeout(2000);

    // Now click the login button (text is '登 录' with a space)
    const loginBtn = page.getByRole('button', { name: '登 录' });
    await loginBtn.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: SD + '/02-after-login.png', fullPage: true });
    console.log('After login URL: ' + page.url());

    // TEST 1: Dashboard buttons
    console.log('=== TEST 1: Dashboard buttons (Bug#1) ===');
    const bodyText = await page.textContent('body');
    console.log('Dashboard text (500): ' + (bodyText || '').substring(0, 500));

    // Try finance-related buttons using getByText
    const kws = ['AI 成本分析', 'AI成本分析', '成本分析', '财务报表', '利润分析', '财务分析', '智能分析', 'AI分析'];
    let clicked = false;
    for (const kw of kws) {
      const el = page.getByText(kw).first();
      const vis = await el.isVisible({ timeout: 1000 }).catch(() => false);
      if (vis) {
        console.log('Clicking: ' + kw);
        await el.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      // List all clickable items
      const els = await page.locator('a, button, .el-menu-item, span').allTextContents();
      const filtered = els.filter(t => t.trim().length > 0 && t.trim().length < 60);
      console.log('Clickable: ' + filtered.slice(0, 40).join(' | '));
    }
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/03-after-click.png', fullPage: true });
    console.log('After click URL: ' + page.url());

    // Navigate directly to finance page if needed
    if (!page.url().includes('/smart-bi/finance')) {
      console.log('Direct nav to /smart-bi/finance');
      await page.goto(BASE_URL + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: SD + '/03b-direct.png', fullPage: true });
    }

    const ft = await page.textContent('body') || '';
    const h403 = ft.includes('403') || ft.includes('无权');
    const hFC = ft.includes('利润') || ft.includes('成本') || ft.includes('收入') || ft.includes('分析');
    console.log('URL: ' + page.url());
    console.log('403: ' + h403 + ', finance content: ' + hFC);
    const t1 = hFC && !h403 ? 'PASS' : 'FAIL';
    console.log('>>> TEST 1 RESULT: ' + t1);

    // TEST 2: Finance tabs
    console.log('=== TEST 2: Finance tabs (Bug#6) ===');
    if (!page.url().includes('/smart-bi/finance')) {
      await page.goto(BASE_URL + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: SD + '/04-tabs.png', fullPage: true });

    const tabs = page.locator('.el-tabs__item');
    const tc = await tabs.count();
    console.log('Tab count: ' + tc);
    for (let i = 0; i < tc; i++) {
      const txt = await tabs.nth(i).textContent();
      console.log('  Tab ' + i + ': [' + (txt || '').trim() + ']');
    }

    // Get tab content
    const getCT = async () => {
      const el = page.locator('.el-tabs__content, .el-tab-pane, main').first();
      return await el.textContent().catch(() => '') || '';
    };

    const c1 = await getCT();
    console.log('Active tab content (200): ' + c1.substring(0, 200));

    // Click receivables tab
    let c3 = '';
    for (let i = 0; i < tc; i++) {
      const txt = await tabs.nth(i).textContent() || '';
      if (txt.includes('应收')) {
        console.log('Clicking tab: ' + txt.trim());
        await tabs.nth(i).click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: SD + '/05-receivables.png', fullPage: true });
        c3 = await getCT();
        console.log('Receivables content (200): ' + c3.substring(0, 200));
        break;
      }
    }

    // Click budget tab
    let c5 = '';
    for (let i = 0; i < tc; i++) {
      const txt = await tabs.nth(i).textContent() || '';
      if (txt.includes('预算')) {
        console.log('Clicking tab: ' + txt.trim());
        await tabs.nth(i).click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: SD + '/06-budget.png', fullPage: true });
        c5 = await getCT();
        console.log('Budget content (200): ' + c5.substring(0, 200));
        break;
      }
    }

    const diff = c1 !== c3 || c1 !== c5;
    console.log('Tabs differ: ' + diff + ' (c1=' + c1.length + ', c3=' + c3.length + ', c5=' + c5.length + ')');
    const t2 = diff ? 'PASS' : 'FAIL';
    console.log('>>> TEST 2 RESULT: ' + t2);

    // TEST 3: Route protection
    console.log('=== TEST 3: Route protection ===');
    await page.goto(BASE_URL + '/production/batches', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/07-route-protect.png', fullPage: true });

    const pUrl = page.url();
    const pTxt = await page.textContent('body') || '';
    console.log('URL: ' + pUrl);
    console.log('Text (300): ' + pTxt.substring(0, 300));

    const blocked = !pUrl.includes('/production/batches') || pTxt.includes('403') || pTxt.includes('权限');
    const t3 = blocked ? 'PASS' : 'FAIL';
    console.log('>>> TEST 3 RESULT: ' + t3);

    console.log('========================================');
    console.log('FINAL:');
    console.log('  Test1 (Bug#1 Dashboard): ' + t1);
    console.log('  Test2 (Bug#6 Tabs):      ' + t2);
    console.log('  Test3 (Route protect):    ' + t3);
    console.log('========================================');
  });
});
