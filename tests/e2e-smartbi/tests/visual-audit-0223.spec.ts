import { test, Page, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots-audit-0223');
const BASE_URL = 'http://47.100.235.168:8088';

// Ensure output dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let idx = 0;
function ssName(label: string): string {
  const num = String(++idx).padStart(3, '0');
  return path.join(SCREENSHOT_DIR, `${num}-${label}.png`);
}

function sanitize(s: string): string {
  return s.replace(/[/\\:*?"<>|\s]/g, '_').substring(0, 25);
}

async function login(page: Page) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.locator('input[type="text"]').first().fill('factory_admin1');
  await page.locator('input[type="password"]').first().fill('123456');
  await page.locator('button').first().click();
  await page.waitForTimeout(8000);
}

async function extractPageMetrics(page: Page) {
  return page.evaluate(() => {
    const body = document.body.innerText;
    const kpiEls = document.querySelectorAll('[class*="kpi"], [class*="KPI"]');
    const aiEls = document.querySelectorAll('[class*="ai-analysis"], [class*="insight"], .markdown-body, [class*="analysis-content"]');
    const chartTitles = Array.from(document.querySelectorAll('[class*="chart-title"], .chart-header, [class*="chartTitle"]'))
      .map(e => (e as HTMLElement).innerText.trim()).filter(t => t.length > 0 && t.length < 80);
    return {
      url: location.href,
      canvases: document.querySelectorAll('canvas').length,
      kpiCount: kpiEls.length,
      aiSections: aiEls.length,
      chartTitles,
      kpiTexts: Array.from(kpiEls).slice(0, 8).map(k => (k as HTMLElement).innerText.trim().substring(0, 120)),
      aiTexts: Array.from(aiEls).slice(0, 3).map(a => (a as HTMLElement).innerText.trim().substring(0, 300)),
      flags: {
        hasUndefined: body.includes('undefined'),
        hasNaN: body.includes('NaN'),
        hasHangci: body.includes('行次'),
        hasColumnPrefix: body.includes('Column_'),
        hasError: body.includes('错误') || body.includes('失败') || body.includes('Error'),
      },
      buttons: Array.from(document.querySelectorAll('.el-button, button'))
        .map(b => (b as HTMLElement).innerText.trim())
        .filter(t => t.length > 0 && t.length < 40),
    };
  });
}

// Collect all results for summary
const auditResults: Array<{ test: string; metrics: any }> = [];

test.describe.serial('SmartBI Visual Audit 2026-02-23', () => {
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    sharedPage.setDefaultTimeout(30000);
  });

  test.afterAll(async () => {
    // Print summary
    console.log('\n\n========== AUDIT SUMMARY ==========');
    for (const r of auditResults) {
      console.log(`\n--- ${r.test} ---`);
      console.log(JSON.stringify(r.metrics, null, 2));
    }
    console.log('\n========== END SUMMARY ==========\n');
    await sharedPage.close();
  });

  // =============================================
  // A: LOGIN & NAVIGATION
  // =============================================
  test('A1 - Login & Navigate to Analysis', async () => {
    test.setTimeout(120000);
    await login(sharedPage);
    await sharedPage.screenshot({ path: ssName('login-done'), fullPage: true });

    await sharedPage.goto(BASE_URL + '/smart-bi/analysis', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sharedPage.waitForTimeout(15000);
    await sharedPage.screenshot({ path: ssName('analysis-initial'), fullPage: true });

    const metrics = await extractPageMetrics(sharedPage);
    const tabs = await sharedPage.locator('.el-tabs__item').allTextContents();
    console.log('Tabs found:', tabs.length, tabs);
    auditResults.push({ test: 'A1-Analysis-Initial', metrics: { ...metrics, tabLabels: tabs } });
  });

  // =============================================
  // B: PER-SHEET DEEP AUDIT (segmented screenshots)
  // =============================================
  test('B - Per-Sheet Deep Audit', async () => {
    test.setTimeout(600000); // 10 min for all sheets
    const tabs = sharedPage.locator('.el-tabs__item');
    const tabCount = await tabs.count();
    console.log(`\nTotal sheet tabs: ${tabCount}`);

    for (let i = 0; i < Math.min(tabCount, 11); i++) {
      const label = ((await tabs.nth(i).textContent()) || `Tab${i}`).trim();
      const safeName = sanitize(label);
      console.log(`\n=== Sheet ${i}: ${label} ===`);

      await tabs.nth(i).click();
      await sharedPage.waitForTimeout(i === 0 ? 15000 : 12000); // Extra wait for first

      // Screenshot 1: Top section (KPI cards)
      await sharedPage.evaluate(() => window.scrollTo(0, 0));
      await sharedPage.waitForTimeout(500);
      await sharedPage.screenshot({ path: ssName(`sheet${i}-${safeName}-top`), fullPage: false });

      // Screenshot 2: Chart section (scroll down ~800px)
      await sharedPage.evaluate(() => window.scrollTo(0, 800));
      await sharedPage.waitForTimeout(1000);
      await sharedPage.screenshot({ path: ssName(`sheet${i}-${safeName}-charts`), fullPage: false });

      // Screenshot 3: More charts / AI section (scroll down ~1800px)
      await sharedPage.evaluate(() => window.scrollTo(0, 1800));
      await sharedPage.waitForTimeout(1000);
      await sharedPage.screenshot({ path: ssName(`sheet${i}-${safeName}-ai`), fullPage: false });

      // Screenshot 4: Bottom (data preview / executive summary)
      await sharedPage.evaluate(() => window.scrollTo(0, 3000));
      await sharedPage.waitForTimeout(500);
      await sharedPage.screenshot({ path: ssName(`sheet${i}-${safeName}-bottom`), fullPage: false });

      // Extract detailed metrics for this sheet
      const metrics = await extractPageMetrics(sharedPage);
      console.log(`  Canvases: ${metrics.canvases}, KPIs: ${metrics.kpiCount}, AI: ${metrics.aiSections}`);
      console.log(`  Chart titles: ${JSON.stringify(metrics.chartTitles)}`);
      if (metrics.flags.hasUndefined) console.log('  ⚠️ WARN: "undefined" found on page');
      if (metrics.flags.hasNaN) console.log('  ⚠️ WARN: "NaN" found on page');
      if (metrics.flags.hasHangci) console.log('  ⚠️ WARN: "行次" found on page');
      if (metrics.flags.hasColumnPrefix) console.log('  ⚠️ WARN: "Column_" prefix found');

      auditResults.push({ test: `B-Sheet${i}-${label}`, metrics });
    }
  });

  // =============================================
  // C: INTERACTIVE FEATURES
  // =============================================
  test('C1 - Drill-Down', async () => {
    test.setTimeout(120000);
    // Make sure we're on first data sheet
    const tabs = sharedPage.locator('.el-tabs__item');
    if (await tabs.count() > 1) {
      await tabs.nth(1).click(); // Skip index sheet, go to first data sheet
      await sharedPage.waitForTimeout(12000);
    }

    const canvases = sharedPage.locator('canvas');
    const cnt = await canvases.count();
    console.log(`\nDrill-down: ${cnt} canvases found`);

    let drillOpened = false;
    for (let c = 0; c < Math.min(cnt, 5); c++) {
      const box = await canvases.nth(c).boundingBox();
      if (!box) continue;
      // Click at 35%,45% of chart area (typical data region)
      await sharedPage.mouse.click(
        Math.round(box.x + box.width * 0.35),
        Math.round(box.y + box.height * 0.45)
      );
      await sharedPage.waitForTimeout(4000);
      const open = await sharedPage.locator('.el-drawer').isVisible().catch(() => false);
      if (open) {
        console.log(`  Drawer opened from chart ${c}`);
        await sharedPage.screenshot({ path: ssName('drill-down-drawer'), fullPage: true });
        const drawerText = await sharedPage.locator('.el-drawer').textContent();
        console.log(`  Drawer text (first 400 chars): ${(drawerText || '').substring(0, 400)}`);
        auditResults.push({ test: 'C1-DrillDown', metrics: { chartIndex: c, drawerText: (drawerText || '').substring(0, 500) } });
        await sharedPage.keyboard.press('Escape');
        await sharedPage.waitForTimeout(1000);
        drillOpened = true;
        break;
      }
    }
    if (!drillOpened) {
      console.log('  ⚠️ Drill-down drawer did not open from any chart');
      auditResults.push({ test: 'C1-DrillDown', metrics: { error: 'Drawer never opened' } });
    }
  });

  test('C2 - Cross-Sheet Analysis', async () => {
    test.setTimeout(120000);
    const btn = sharedPage.locator('button').filter({ hasText: /跨表|综合分析/ }).first();
    const visible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`\nCross-sheet btn visible: ${visible}`);
    if (visible) {
      await btn.click();
      await sharedPage.waitForTimeout(15000);
      await sharedPage.screenshot({ path: ssName('cross-sheet-dialog'), fullPage: true });
      const dlgCanvases = await sharedPage.locator('.el-dialog canvas').count();
      console.log(`  Cross-sheet charts: ${dlgCanvases}`);
      auditResults.push({ test: 'C2-CrossSheet', metrics: { charts: dlgCanvases } });
      // Close dialog
      await sharedPage.keyboard.press('Escape');
      await sharedPage.waitForTimeout(1000);
    } else {
      auditResults.push({ test: 'C2-CrossSheet', metrics: { error: 'Button not found' } });
    }
  });

  test('C3 - Statistical Analysis', async () => {
    test.setTimeout(120000);
    const btn = sharedPage.locator('button').filter({ hasText: /统计|因果/ }).first();
    const visible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`\nStats btn visible: ${visible}`);
    if (visible) {
      await btn.click();
      await sharedPage.waitForTimeout(10000);
      await sharedPage.screenshot({ path: ssName('stats-dialog'), fullPage: true });
      auditResults.push({ test: 'C3-Stats', metrics: { opened: true } });
      await sharedPage.keyboard.press('Escape');
      await sharedPage.waitForTimeout(1000);
    } else {
      auditResults.push({ test: 'C3-Stats', metrics: { error: 'Button not found' } });
    }
  });

  test('C4 - YoY Comparison', async () => {
    test.setTimeout(120000);
    const btn = sharedPage.locator('button').filter({ hasText: /同比/ }).first();
    const visible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`\nYoY btn visible: ${visible}`);
    if (visible) {
      await btn.click();
      await sharedPage.waitForTimeout(10000);
      await sharedPage.screenshot({ path: ssName('yoy-comparison'), fullPage: true });
      auditResults.push({ test: 'C4-YoY', metrics: { opened: true } });
      await sharedPage.keyboard.press('Escape');
      await sharedPage.waitForTimeout(1000);
    } else {
      auditResults.push({ test: 'C4-YoY', metrics: { error: 'Button not found' } });
    }
  });

  // =============================================
  // D: OTHER SMARTBI PAGES
  // =============================================
  test('D1 - Dashboard', async () => {
    test.setTimeout(120000);
    await sharedPage.goto(BASE_URL + '/smart-bi/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sharedPage.waitForTimeout(8000);
    await sharedPage.screenshot({ path: ssName('dashboard-top'), fullPage: false });
    await sharedPage.evaluate(() => window.scrollTo(0, 800));
    await sharedPage.waitForTimeout(1000);
    await sharedPage.screenshot({ path: ssName('dashboard-mid'), fullPage: false });
    await sharedPage.evaluate(() => window.scrollTo(0, 99999));
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ path: ssName('dashboard-bottom'), fullPage: false });
    const metrics = await extractPageMetrics(sharedPage);
    auditResults.push({ test: 'D1-Dashboard', metrics });
  });

  test('D2 - Sales Analysis', async () => {
    test.setTimeout(120000);
    await sharedPage.goto(BASE_URL + '/smart-bi/sales', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sharedPage.waitForTimeout(8000);
    await sharedPage.screenshot({ path: ssName('sales-top'), fullPage: false });
    await sharedPage.evaluate(() => window.scrollTo(0, 800));
    await sharedPage.waitForTimeout(1000);
    await sharedPage.screenshot({ path: ssName('sales-bottom'), fullPage: false });
    const metrics = await extractPageMetrics(sharedPage);
    auditResults.push({ test: 'D2-Sales', metrics });
  });

  test('D3 - Finance Analysis', async () => {
    test.setTimeout(180000);
    await sharedPage.goto(BASE_URL + '/smart-bi/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sharedPage.waitForTimeout(8000);

    // Try each finance sub-tab
    const financeTabs = sharedPage.locator('.el-tabs__item');
    const ftCount = await financeTabs.count();
    console.log(`\nFinance tabs: ${ftCount}`);

    for (let t = 0; t < Math.min(ftCount, 5); t++) {
      const tabLabel = ((await financeTabs.nth(t).textContent()) || `FTab${t}`).trim();
      await financeTabs.nth(t).click();
      await sharedPage.waitForTimeout(6000);
      await sharedPage.evaluate(() => window.scrollTo(0, 0));
      await sharedPage.screenshot({ path: ssName(`finance-${sanitize(tabLabel)}`), fullPage: false });
    }
    const metrics = await extractPageMetrics(sharedPage);
    auditResults.push({ test: 'D3-Finance', metrics });
  });

  test('D4 - AI Query', async () => {
    test.setTimeout(120000);
    await sharedPage.goto(BASE_URL + '/smart-bi/query', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sharedPage.waitForTimeout(5000);
    await sharedPage.screenshot({ path: ssName('ai-query-initial'), fullPage: false });
    const metrics = await extractPageMetrics(sharedPage);
    auditResults.push({ test: 'D4-AIQuery', metrics });
  });
});
