import { test } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8088';
const SD = 'tests/finance-bug-screenshots';

test.describe('Finance Tab Deep', () => {
  test.setTimeout(180000);

  test('Tab content check', async ({ page }) => {
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByRole('button', { name: '财务经理' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: '登 录' }).click();
    await page.waitForTimeout(8000);
    console.log('Login URL: ' + page.url());

    await page.goto(BASE_URL + '/smart-bi/finance', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/10-finance.png', fullPage: true });

    // Dump tab structure
    const tabInfo = await page.evaluate(() => {
      const results: string[] = [];
      const sels = ['.el-tabs__item', '[role=tab]', '[class*=tab]'];
      for (const sel of sels) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          results.push(sel + ': ' + els.length);
          els.forEach((el, i) => {
            if (i < 10) results.push('  ' + i + ': tag=' + el.tagName + ' class=' + el.className.substring(0, 60) + ' text=' + (el.textContent || '').trim().substring(0, 30));
          });
        }
      }
      // Find specific tab text elements
      const tabTexts = ['利润分析', '成本分析', '应收分析', '应付分析', '预算分析'];
      for (const t of tabTexts) {
        const all = document.querySelectorAll('*');
        let found = false;
        for (const el of all) {
          if (el.textContent?.trim() === t && el.children.length === 0) {
            results.push('LEAF ' + t + ': tag=' + el.tagName + ' class=' + el.className.substring(0, 60));
            found = true;
            break;
          }
        }
        if (!found) results.push('NOT FOUND: ' + t);
      }
      return results.join('
');
    });
    console.log('Tab info:
' + tabInfo);

    // Click each tab by exact text and compare content
    const tabNames = ['利润分析', '成本分析', '应收分析', '应付分析', '预算分析'];
    const contents: Record<string, string> = {};

    for (const tabName of tabNames) {
      const el = page.getByText(tabName, { exact: true }).first();
      const vis = await el.isVisible({ timeout: 2000 }).catch(() => false);
      if (vis) {
        await el.click();
        await page.waitForTimeout(3000);
        const url = page.url();
        await page.screenshot({ path: SD + '/tab-' + tabName + '.png', fullPage: true });
        const ct = await page.evaluate(() => {
          const main = document.querySelector('.finance-content, .analysis-content, .el-main, main');
          return (main || document.body).textContent?.substring(0, 400) || '';
        });
        contents[tabName] = ct;
        console.log(tabName + ' URL=' + url + ' len=' + ct.length);
        console.log('  preview: ' + ct.substring(0, 150));
      } else {
        console.log(tabName + ': NOT VISIBLE');
      }
    }

    console.log('
=== TAB COMPARISON ===');
    const vals = Object.values(contents);
    const allSame = vals.length > 1 && vals.every(v => v === vals[0]);
    console.log('Tabs clicked: ' + Object.keys(contents).length);
    console.log('All same: ' + allSame);
    for (const [k, v] of Object.entries(contents)) {
      console.log(k + ': len=' + v.length + ' hash=' + v.substring(50, 100));
    }
    const result = vals.length >= 3 && !allSame ? 'PASS' : (allSame ? 'FAIL' : 'INCONCLUSIVE');
    console.log('>>> BUG#6 TABS RESULT: ' + result);
  });
});