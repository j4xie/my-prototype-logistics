import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://47.100.235.168:8086';
const API_URL = 'http://47.100.235.168:10010';

async function getToken(): Promise<string> {
  const resp = await fetch(`${API_URL}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' }),
  });
  const data = await resp.json();
  return data?.data?.accessToken || '';
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/#/login`);
  await page.waitForTimeout(2000);
  const usernameInput = page.locator('input').first();
  const passwordInput = page.locator('input[type="password"]').first();
  await usernameInput.fill('factory_admin1');
  await passwordInput.fill('123456');
  const loginBtn = page.locator('button').filter({ hasText: /登录|Login/ }).first();
  await loginBtn.click();
  await page.waitForTimeout(3000);
}

test.describe('SmartBI Data Completeness Check', () => {
  test.setTimeout(180000);

  test('API: check all uploads for data completeness', async () => {
    const token = await getToken();
    console.log('Token obtained:', token.length > 0 ? 'YES' : 'NO');

    // All uploads with data (from DB query earlier)
    const uploads = [
      { id: 2926, name: '索引', expectedRows: 16 },
      { id: 2927, name: '2025年中心利润表', expectedRows: 100 },
      { id: 2928, name: '2025年江苏分部利润表', expectedRows: 100 },
      { id: 2929, name: '收入及净利简表', expectedRows: 0 },
      { id: 2930, name: '2025年销售1中心利润表', expectedRows: 0 },
      { id: 2931, name: '2025年浙江分部利润表', expectedRows: 100 },
      { id: 2932, name: '2025年上海分部利润表', expectedRows: 100 },
      { id: 2933, name: '2025年赣皖区域利润表', expectedRows: 100 },
      { id: 2934, name: '2025年安徽省区利润表', expectedRows: 100 },
      { id: 2935, name: '2025年江西省区利润表', expectedRows: 100 },
      { id: 2936, name: '24年返利明细', expectedRows: 58 },
    ];

    const results: any[] = [];

    for (const upload of uploads) {
      const resp = await fetch(
        `${API_URL}/api/mobile/F001/smart-bi/analysis/dynamic?uploadId=${upload.id}&analysisType=auto`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const json = await resp.json();

      if (json.success === false) {
        console.log(`❌ Upload ${upload.id} (${upload.name}): ERROR - ${json.message?.substring(0, 100)}`);
        results.push({ ...upload, status: 'ERROR', error: json.message });
        continue;
      }

      const data = json.data || {};
      const fd = data.fieldDefinitions || [];
      const measures = fd.filter((f: any) => f.isMeasure);
      const dims = fd.filter((f: any) => f.isDimension);
      const kpis = data.kpiCards || [];
      const charts = data.charts || [];
      const insights = data.insights || [];

      // Check for issues
      const issues: string[] = [];
      const noFieldInsight = insights.find((i: string) => i?.includes('未检测到'));
      if (noFieldInsight) issues.push('未检测到数值型字段');
      if (measures.length === 0 && upload.expectedRows > 0) issues.push('No measures found');
      if (kpis.length === 0 && upload.expectedRows > 0) issues.push('No KPIs');
      if (charts.length === 0 && upload.expectedRows > 0) issues.push('No charts');

      // Check data row count from insights
      const rowCountMatch = insights[0]?.match(/(\d+)\s*条/);
      const reportedRows = rowCountMatch ? parseInt(rowCountMatch[1]) : -1;
      if (upload.expectedRows > 0 && reportedRows !== upload.expectedRows) {
        issues.push(`Row count mismatch: expected ${upload.expectedRows}, got ${reportedRows}`);
      }

      // Check KPI values
      const zeroKpis = kpis.filter((k: any) => k.rawValue === 0 || k.rawValue === null);
      if (zeroKpis.length > 0) {
        issues.push(`${zeroKpis.length} KPIs with zero/null value`);
      }

      // Check for very large number of measures (Column_XX noise)
      const columnXXMeasures = measures.filter((m: any) => m.originalName?.startsWith('Column_'));
      if (columnXXMeasures.length > 0) {
        issues.push(`${columnXXMeasures.length} Column_XX noise measures not filtered`);
      }

      const status = issues.length === 0 ? '✅' : '⚠️';
      console.log(`${status} Upload ${upload.id} (${upload.name}): Fields=${fd.length} M=${measures.length} D=${dims.length} KPIs=${kpis.length} Charts=${charts.length} Insights=${insights.length}`);
      if (issues.length > 0) {
        console.log(`   Issues: ${issues.join(', ')}`);
      }

      // Print KPI summary
      for (const kpi of kpis.slice(0, 3)) {
        console.log(`   KPI: ${kpi.title} = ${kpi.value} (raw: ${kpi.rawValue})`);
      }
      if (kpis.length > 3) console.log(`   ...+${kpis.length - 3} more KPIs`);

      // Print measure names
      console.log(`   Measures: ${measures.map((m: any) => m.standardName || m.originalName).slice(0, 6).join(', ')}${measures.length > 6 ? ` ...+${measures.length - 6}` : ''}`);

      results.push({
        ...upload,
        status: issues.length === 0 ? 'OK' : 'ISSUES',
        fields: fd.length,
        measures: measures.length,
        dims: dims.length,
        kpis: kpis.length,
        charts: charts.length,
        insights: insights.length,
        issues,
      });
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const ok = results.filter(r => r.status === 'OK').length;
    const issues = results.filter(r => r.status === 'ISSUES').length;
    const errors = results.filter(r => r.status === 'ERROR').length;
    console.log(`Total: ${results.length} | OK: ${ok} | Issues: ${issues} | Errors: ${errors}`);
  });

  test('Browser: check Finance Analysis page', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/smart-bi/finance`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/check-finance-01.png', fullPage: true });

    // Look for selectors
    const selectors = await page.locator('.el-select').all();
    console.log(`Finance page: ${selectors.length} selectors found`);

    // Get page text
    const bodyText = await page.locator('.app-main, main, #app').first().innerText().catch(() => '');
    console.log(`Page text length: ${bodyText.length}`);

    // Check for error messages
    const errorPatterns = ['未检测到', '暂无数据', '数据为空', '加载失败'];
    for (const pat of errorPatterns) {
      if (bodyText.includes(pat)) {
        console.log(`⚠️ Found: "${pat}"`);
      }
    }

    // Try each selector
    for (let i = 0; i < selectors.length; i++) {
      const sel = selectors[i];
      const isVisible = await sel.isVisible().catch(() => false);
      if (!isVisible) continue;

      await sel.click().catch(() => {});
      await page.waitForTimeout(1000);

      const options = await page.locator('.el-select-dropdown__item:visible').all();
      console.log(`Selector ${i}: ${options.length} options`);

      for (let j = 0; j < Math.min(options.length, 8); j++) {
        const text = await options[j].innerText().catch(() => '?');
        console.log(`  Option ${j}: ${text.substring(0, 60)}`);
      }

      // Select first option
      if (options.length > 0) {
        await options[0].click().catch(() => {});
        await page.waitForTimeout(8000);
        await page.screenshot({ path: `screenshots/check-finance-02-sel${i}.png`, fullPage: true });

        const newText = await page.locator('.app-main, main, #app').first().innerText().catch(() => '');
        const hasKPI = newText.match(/[\d.]+[万亿]/g);
        console.log(`After selecting option 0: KPI values found: ${hasKPI?.length || 0}`);

        // Count canvas elements (charts)
        const canvases = await page.locator('canvas').count();
        console.log(`Charts (canvas): ${canvases}`);
      }

      // Close dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('Browser: check Sales Analysis page', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/smart-bi/sales`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/check-sales-01.png', fullPage: true });

    const bodyText = await page.locator('.app-main, main, #app').first().innerText().catch(() => '');
    const selectors = await page.locator('.el-select').all();
    console.log(`Sales page: ${selectors.length} selectors, text length: ${bodyText.length}`);

    const errorPatterns = ['未检测到', '暂无数据', '数据为空', '加载失败'];
    for (const pat of errorPatterns) {
      if (bodyText.includes(pat)) {
        console.log(`⚠️ Found: "${pat}"`);
      }
    }

    // Try selector
    for (let i = 0; i < selectors.length; i++) {
      const sel = selectors[i];
      if (!await sel.isVisible().catch(() => false)) continue;
      await sel.click().catch(() => {});
      await page.waitForTimeout(1000);
      const options = await page.locator('.el-select-dropdown__item:visible').all();
      console.log(`Selector ${i}: ${options.length} options`);
      for (let j = 0; j < Math.min(options.length, 8); j++) {
        const text = await options[j].innerText().catch(() => '?');
        console.log(`  Option ${j}: ${text.substring(0, 60)}`);
      }
      if (options.length > 0) {
        await options[0].click().catch(() => {});
        await page.waitForTimeout(8000);
        await page.screenshot({ path: `screenshots/check-sales-02-sel${i}.png`, fullPage: true });
        const canvases = await page.locator('canvas').count();
        console.log(`After select: ${canvases} charts`);
      }
      await page.keyboard.press('Escape');
    }
  });

  test('Browser: check SmartBI main page sheet tabs', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/#/smart-bi/analysis`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/check-smartbi-01.png', fullPage: true });

    // Select upload
    const uploadSelect = page.locator('.el-select').first();
    if (await uploadSelect.isVisible().catch(() => false)) {
      await uploadSelect.click();
      await page.waitForTimeout(1000);

      const options = await page.locator('.el-select-dropdown__item:visible').all();
      console.log(`SmartBI: ${options.length} upload options`);
      for (let i = 0; i < Math.min(options.length, 5); i++) {
        const text = await options[i].innerText().catch(() => '?');
        console.log(`  ${i}: ${text.substring(0, 60)}`);
      }

      if (options.length > 0) {
        await options[0].click();
        await page.waitForTimeout(15000); // Enrichment takes time
        await page.screenshot({ path: 'screenshots/check-smartbi-02-loaded.png', fullPage: true });

        // Check tabs
        const tabs = await page.locator('.el-tabs__item').all();
        console.log(`Sheet tabs: ${tabs.length}`);
        for (let i = 0; i < tabs.length; i++) {
          const text = await tabs[i].innerText().catch(() => '?');
          console.log(`  Tab ${i}: ${text.substring(0, 40)}`);
        }

        // Click a few tabs and check content
        for (let i = 1; i < Math.min(tabs.length, 4); i++) {
          await tabs[i].click();
          await page.waitForTimeout(5000);
          await page.screenshot({ path: `screenshots/check-smartbi-03-tab${i}.png`, fullPage: true });

          const canvases = await page.locator('canvas').count();
          const bodyText = await page.locator('.app-main, main, #app').first().innerText().catch(() => '');
          const hasKPI = bodyText.match(/[\d.]+[万亿]/g);
          const hasError = bodyText.includes('未检测到') || bodyText.includes('暂无数据');
          console.log(`Tab ${i}: ${canvases} charts, ${hasKPI?.length || 0} KPI values, error: ${hasError}`);
        }
      }
    }
  });
});
