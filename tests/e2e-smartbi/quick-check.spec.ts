import { test } from '@playwright/test';

const BASE = 'http://47.100.235.168:8086';

async function login(page: any) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Use quick login "工厂总监" button
  const quickBtn = page.locator('button, .el-button, span').filter({ hasText: '工厂总监' }).first();
  if (await quickBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await quickBtn.click();
    console.log('Clicked 工厂总监 quick login');
  } else {
    const inputs = await page.locator('input').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('factory_admin1');
      await inputs[1].fill('123456');
    }
    await page.locator('button').filter({ hasText: /登.*录/ }).first().click();
  }

  // Wait for redirect away from login page
  await page.waitForURL(/(?!.*login).*/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('After login URL:', page.url());
}

test('Finance Analysis - full check', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  // Navigate via hash
  await page.evaluate(() => { window.location.hash = '#/smart-bi/finance'; });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'screenshots/check-fin-01-initial.png', fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log('=== Finance Analysis ===');
  console.log('URL:', page.url());
  console.log('Body text preview:', bodyText.substring(0, 300));

  for (const pat of ['未检测到', '暂无数据', '数据为空', '加载失败']) {
    if (bodyText.includes(pat)) console.log(`⚠️ Found: "${pat}"`);
  }

  // Count various elements
  const selectors = await page.locator('.el-select').all();
  const canvases = await page.locator('canvas').count();
  const kpiValues = bodyText.match(/[\d.]+[万亿]/g) || [];
  console.log(`Selectors: ${selectors.length}, Charts: ${canvases}, KPI values: ${kpiValues.length}`);

  // If selectors exist, try selecting an option
  for (let i = 0; i < selectors.length; i++) {
    const sel = selectors[i];
    if (!await sel.isVisible().catch(() => false)) continue;
    await sel.click();
    await page.waitForTimeout(1500);
    const options = await page.locator('.el-select-dropdown__item:visible').all();
    console.log(`Selector ${i}: ${options.length} options`);
    for (let j = 0; j < Math.min(options.length, 8); j++) {
      const text = await options[j].innerText().catch(() => '?');
      console.log(`  ${j}: ${text.trim().substring(0, 60)}`);
    }
    if (options.length > 0) {
      await options[0].click();
      await page.waitForTimeout(10000);
      await page.screenshot({ path: `screenshots/check-fin-02-loaded.png`, fullPage: true });
      const afterText = await page.locator('body').innerText();
      const afterKpis = afterText.match(/[\d.]+[万亿]/g) || [];
      const afterCharts = await page.locator('canvas').count();
      console.log(`After select: ${afterKpis.length} KPIs, ${afterCharts} charts`);
      for (const pat of ['未检测到', '暂无数据']) {
        if (afterText.includes(pat)) console.log(`⚠️ "${pat}"`);
      }
    }
    await page.keyboard.press('Escape');
  }
});

test('Sales Analysis - full check', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  await page.evaluate(() => { window.location.hash = '#/smart-bi/sales'; });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'screenshots/check-sal-01-initial.png', fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log('=== Sales Analysis ===');
  console.log('URL:', page.url());
  console.log('Body text preview:', bodyText.substring(0, 300));

  for (const pat of ['未检测到', '暂无数据', '数据为空', '加载失败']) {
    if (bodyText.includes(pat)) console.log(`⚠️ Found: "${pat}"`);
  }

  const selectors = await page.locator('.el-select').all();
  const canvases = await page.locator('canvas').count();
  console.log(`Selectors: ${selectors.length}, Charts: ${canvases}`);

  for (let i = 0; i < selectors.length; i++) {
    const sel = selectors[i];
    if (!await sel.isVisible().catch(() => false)) continue;
    await sel.click();
    await page.waitForTimeout(1500);
    const options = await page.locator('.el-select-dropdown__item:visible').all();
    console.log(`Selector ${i}: ${options.length} options`);
    for (let j = 0; j < Math.min(options.length, 8); j++) {
      const text = await options[j].innerText().catch(() => '?');
      console.log(`  ${j}: ${text.trim().substring(0, 60)}`);
    }
    if (options.length > 0) {
      await options[0].click();
      await page.waitForTimeout(10000);
      await page.screenshot({ path: `screenshots/check-sal-02-loaded.png`, fullPage: true });
      const afterText = await page.locator('body').innerText();
      const afterCharts = await page.locator('canvas').count();
      console.log(`After select: ${afterCharts} charts`);
      for (const pat of ['未检测到', '暂无数据']) {
        if (afterText.includes(pat)) console.log(`⚠️ "${pat}"`);
      }
    }
    await page.keyboard.press('Escape');
  }
});

test('SmartBI Main - sheet tabs', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  await page.evaluate(() => { window.location.hash = '#/smart-bi/analysis'; });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'screenshots/check-sbi-01-initial.png', fullPage: true });

  console.log('=== SmartBI Main ===');
  console.log('URL:', page.url());

  const uploadSelect = page.locator('.el-select').first();
  if (await uploadSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    await uploadSelect.click();
    await page.waitForTimeout(1500);

    const options = await page.locator('.el-select-dropdown__item:visible').all();
    console.log(`Upload options: ${options.length}`);
    for (let i = 0; i < Math.min(options.length, 5); i++) {
      const text = await options[i].innerText().catch(() => '?');
      console.log(`  ${i}: ${text.trim().substring(0, 60)}`);
    }

    if (options.length > 0) {
      await options[0].click();
      await page.waitForTimeout(20000);
      await page.screenshot({ path: 'screenshots/check-sbi-02-loaded.png', fullPage: true });

      const tabs = await page.locator('.el-tabs__item').all();
      console.log(`Sheet tabs: ${tabs.length}`);

      for (let i = 0; i < Math.min(tabs.length, 5); i++) {
        await tabs[i].click();
        await page.waitForTimeout(8000);
        await page.screenshot({ path: `screenshots/check-sbi-03-tab${i}.png`, fullPage: true });

        const bodyText = await page.locator('body').innerText();
        const kpiValues = bodyText.match(/[\d.]+[万亿]/g) || [];
        const canvases = await page.locator('canvas').count();
        const hasError = bodyText.includes('未检测到') || bodyText.includes('暂无数据');
        const tabName = await tabs[i].innerText().catch(() => `Tab${i}`);
        console.log(`"${tabName.trim()}": ${kpiValues.length} KPIs, ${canvases} charts, error=${hasError}`);
      }
    }
  } else {
    console.log('No upload selector found');
    const bodyText = await page.locator('body').innerText();
    console.log('Body:', bodyText.substring(0, 500));
  }
});
