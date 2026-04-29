import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const PROD_URL = 'https://admin.cretaceousfuture.com';
const FACTORY = 'RES_3101_009';
const RESULTS_DIR = 'tests/e2e-comprehensive/results/page-audit';
mkdirSync(RESULTS_DIR, { recursive: true });

const observations = [];
const consoleErrors = [];
const networkFails = [];

async function login(page) {
  await page.goto(`${PROD_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input', { timeout: 30000 });

  const inputs = await page.locator('input').all();
  let userInput, passInput;
  for (const i of inputs) {
    const t = await i.getAttribute('type');
    if (t === 'password' && !passInput) passInput = i;
    else if (!userInput && (t === 'text' || !t)) userInput = i;
  }
  if (!userInput || !passInput) {
    throw new Error('Could not find username/password inputs');
  }
  await userInput.fill('qhj_prod');
  await passInput.fill('123456');
  await passInput.press('Enter');

  try {
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 25000 });
  } catch (e) {
    throw new Error(`Login did not redirect within 25s: ${e.message}`);
  }
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN' });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      networkFails.push(`${r.status()} ${r.url()}`);
    }
  });

  try {
    await login(page);

    // Navigate to dashboard
    const dashUrl = `${PROD_URL}/smart-bi/dashboard`;
    console.log(`Navigating to ${dashUrl}`);
    const start = Date.now();
    await page.goto(dashUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);  // initial render

    // Capture page state
    const initialScreenshot = join(RESULTS_DIR, 'dashboard-initial.png');
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    observations.push(`Initial render: ${(Date.now() - start) / 1000}s. Screenshot: ${initialScreenshot}`);

    // Look for "暂无数据" / empty states — only leaf elements (no children) to avoid container double-counts
    const emptyTexts = await page.$$eval(
      'body *',
      (els) => els
        .filter((e) => e.children.length === 0 && !['STYLE', 'SCRIPT', 'LINK'].includes(e.tagName))
        .map((e) => (e.textContent || '').trim())
        .filter((t) => t === '暂无数据' || t === '暂无' || /^暂无.{0,8}$/.test(t)),
    );
    observations.push(`'暂无数据' / '暂无' leaf occurrences: ${emptyTexts.length} (sample: ${emptyTexts.slice(0, 8).join(' | ')})`);

    // Look for KPI cards / strips
    const kpiTitles = await page.$$eval(
      '[class*="kpi"] [class*="title"], [class*="kpi"] [class*="label"], .el-statistic__title, [class*="card"] [class*="title"]',
      (els) => els.map((e) => e.textContent.trim()).filter(Boolean).slice(0, 30),
    );
    observations.push(`KPI/card titles found (${kpiTitles.length}): ${kpiTitles.join(' | ')}`);

    // Look for KPI values
    const kpiValues = await page.$$eval(
      '[class*="kpi"] [class*="value"], [class*="kpi"] [class*="number"], .el-statistic__content',
      (els) => els.map((e) => e.textContent.trim()).filter(Boolean).slice(0, 30),
    );
    observations.push(`KPI values found (${kpiValues.length}): ${kpiValues.join(' | ')}`);

    // Check for any chart canvases / svg
    const chartCount = await page.$$eval('canvas, svg.echarts-svg', (els) => els.length);
    observations.push(`Chart canvas/svg count: ${chartCount}`);

    // Try clicking date-range picker if present
    const dateRangeBtn = await page.$('.el-date-editor, [class*="date-picker"], [class*="DatePicker"]');
    if (dateRangeBtn) {
      observations.push('Has date-range picker.');
      // Try clicking a "本年" or "近12月" shortcut
      await dateRangeBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      const shortcuts = await page.$$eval('.el-picker-panel__shortcut, [class*="shortcut"]', (els) => els.map(e => e.textContent.trim()));
      observations.push(`Date shortcuts: ${shortcuts.join(' | ')}`);
      // Close picker
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      observations.push('No date-range picker found.');
    }

    // Take after-interactions screenshot
    await page.waitForTimeout(2000);
    const afterScreenshot = join(RESULTS_DIR, 'dashboard-after.png');
    await page.screenshot({ path: afterScreenshot, fullPage: true });
    observations.push(`After-interaction screenshot: ${afterScreenshot}`);

    // Dump main content textContent (sans sidebar/header) for later inspection
    const mainText = await page.evaluate(() => {
      const main = document.querySelector('.app-main, .main-content, main, .layout-content, .el-main');
      const txt = main ? (main.textContent || '') : (document.body.textContent || '');
      return txt.replace(/\s+/g, ' ').trim().slice(0, 4000);
    });
    observations.push(`Main content text (first 4000 chars): ${mainText}`);

    // Look for Gold-specific keywords from Apr 23 commit b1cf06fd8
    const hasGoldKpiTitles = await page.evaluate(() => {
      const txt = document.body.textContent || '';
      const checks = ['销售额', '订单数量', '客单价', '门店数'];
      return checks.map(k => ({ k, found: txt.includes(k) }));
    });
    observations.push(`Gold KPI keywords: ${JSON.stringify(hasGoldKpiTitles)}`);

    // Look for date range shortcut keywords from Apr 23
    const hasDateShortcuts = await page.evaluate(() => {
      const txt = document.body.textContent || '';
      const checks = ['本月', '本年', '近12月', '近24月', '2025', '2024'];
      return checks.map(k => ({ k, found: txt.includes(k) }));
    });
    observations.push(`Date shortcut keywords: ${JSON.stringify(hasDateShortcuts)}`);

    // Network requests summary
    observations.push(`Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) observations.push(`First console error: ${consoleErrors[0].substring(0, 200)}`);
    observations.push(`Network 4xx/5xx on /api: ${networkFails.length}`);
    if (networkFails.length > 0) observations.push(`Network fails: ${networkFails.slice(0, 5).join(' | ')}`);

  } catch (e) {
    observations.push(`FATAL ERROR: ${e.message}`);
    try { await page.screenshot({ path: join(RESULTS_DIR, 'dashboard-fatal.png'), fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }

  const md = `# Dashboard (经营驾驶舱) Real-Window Audit\n\n**Date:** ${new Date().toISOString()}\n**URL:** ${PROD_URL}/smart-bi/dashboard\n**Factory:** ${FACTORY}\n\n## Observations\n\n${observations.map(o => `- ${o}`).join('\n')}\n\n## Console errors (full)\n\n\`\`\`\n${consoleErrors.join('\n')}\n\`\`\`\n\n## Network failures (full)\n\n\`\`\`\n${networkFails.join('\n')}\n\`\`\`\n`;
  writeFileSync(join(RESULTS_DIR, 'dashboard-OBSERVATIONS.md'), md);
  console.log(`\nSaved to ${join(RESULTS_DIR, 'dashboard-OBSERVATIONS.md')}`);
})();
