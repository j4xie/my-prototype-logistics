import { test, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots-audit');
const BASE_URL = 'http://47.100.235.168:8088';

async function login(page: Page) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const u = page.locator('input[type="text"]').first();
  const p = page.locator('input[type="password"]').first();
  await u.fill('factory_admin1');
  await p.fill('123456');
  await page.locator('button').first().click();
  await page.waitForTimeout(5000);
}

async function nav(page: Page) {
  await page.goto(BASE_URL + '/smart-bi/analysis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(10000);
}

function sanitize(s: string): string {
  return s.replace(/[/\:*?"<>|]/g, '_').substring(0, 30);
}

test.describe('SmartBI UI Audit', () => {

  test('A - Page Load', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'A0-login.png'), fullPage: true });
    console.log('Logged in. URL:', page.url());

    await nav(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'A1-analysis.png'), fullPage: true });

    const info = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        url: location.href,
        textLen: body.length,
        hasUndefined: body.includes('undefined'),
        hasNaN: body.includes('NaN'),
        hasHangci: body.includes('行次'),
        hasColPrefix: body.includes('Column_'),
        canvases: document.querySelectorAll('canvas').length,
        tabs: Array.from(document.querySelectorAll('.el-tabs__item')).map(t => (t as HTMLElement).innerText.trim()),
        buttons: Array.from(document.querySelectorAll('.el-button, button')).map(b => (b as HTMLElement).innerText.trim()).filter(t => t.length > 0 && t.length < 50),
        cards: document.querySelectorAll('.el-card').length,
        kpiEls: document.querySelectorAll('[class*="kpi"], [class*="KPI"]').length,
        chartEls: document.querySelectorAll('[class*="chart"]').length,
        hasUpload: !!document.querySelector('[class*="upload"], .el-upload'),
        hasEmpty: !!document.querySelector('[class*="empty"], .el-empty'),
        sidebar: Array.from(document.querySelectorAll('.el-menu-item, .el-sub-menu__title')).map(s => (s as HTMLElement).innerText.trim()).filter(t => t.length > 0),
        aiSections: document.querySelectorAll('[class*="ai-analysis"], [class*="insight"], .markdown-body').length,
      };
    });
    console.log(JSON.stringify(info, null, 2));
  });

  test('A2 - First Sheet', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    const tc = await tabs.count();
    console.log('Tabs:', tc);
    if (tc > 0) {
      await tabs.first().click();
      await page.waitForTimeout(12000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'A2-first-sheet.png'), fullPage: true });
    }
    const detail = await page.evaluate(() => {
      const body = document.body.innerText;
      const kpiEls = document.querySelectorAll('[class*="kpi"], [class*="KPI"]');
      const aiEls = document.querySelectorAll('[class*="ai-analysis"], [class*="insight"], .markdown-body, [class*="analysis-content"]');
      return {
        canvases: document.querySelectorAll('canvas').length,
        kpis: kpiEls.length,
        aiSections: aiEls.length,
        hasUndefined: body.includes('undefined'),
        hasNaN: body.includes('NaN'),
        hasHangci: body.includes('行次'),
        hasColPrefix: body.includes('Column_'),
        kpiTexts: Array.from(kpiEls).slice(0, 10).map(k => (k as HTMLElement).innerText.trim().substring(0, 100)),
        aiTexts: Array.from(aiEls).slice(0, 4).map(a => (a as HTMLElement).innerText.trim().substring(0, 200)),
      };
    });
    console.log(JSON.stringify(detail, null, 2));
  });

  test('B - Switch Sheets', async ({ page }) => {
    test.setTimeout(360000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    const tc = await tabs.count();
    console.log('Total tabs:', tc);
    for (let i = 0; i < Math.min(tc, 10); i++) {
      const label = (await tabs.nth(i).textContent()) || ('Tab' + i);
      console.log('--- Sheet ' + i + ': ' + label.trim() + ' ---');
      await tabs.nth(i).click();
      await page.waitForTimeout(12000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'B-' + i + '-' + sanitize(label.trim()) + '.png'), fullPage: true });
      const info = await page.evaluate(() => {
        const body = document.body.innerText;
        return {
          canvases: document.querySelectorAll('canvas').length,
          kpis: document.querySelectorAll('[class*="kpi"], [class*="KPI"]').length,
          ai: document.querySelectorAll('[class*="ai-analysis"], [class*="insight"], .markdown-body').length,
          hasUndefined: body.includes('undefined'),
          hasNaN: body.includes('NaN'),
          hasHangci: body.includes('行次'),
          hasColPrefix: body.includes('Column_'),
        };
      });
      console.log('Charts:' + info.canvases + ' KPIs:' + info.kpis + ' AI:' + info.ai);
      if (info.hasUndefined) console.log('WARN: undefined found');
      if (info.hasNaN) console.log('WARN: NaN found');
      if (info.hasHangci) console.log('WARN: hangci found');
      if (info.hasColPrefix) console.log('WARN: Column_ prefix found');
    }
  });

  test('C - Cross-Sheet', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const btnTexts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.el-button, button')).map(b => (b as HTMLElement).innerText.trim()).filter(t => t.length > 0 && t.length < 50);
    });
    console.log('Buttons:', JSON.stringify(btnTexts));
    const crossBtn = page.locator('button:has-text("跨表")').first();
    const has = await crossBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Cross-sheet btn:', has);
    if (has) {
      await crossBtn.click();
      await page.waitForTimeout(12000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'C-cross.png'), fullPage: true });
      console.log('Charts:', await page.locator('canvas').count());
    }
  });

  test('D - Drill-Down', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const canvases = page.locator('canvas');
    const cnt = await canvases.count();
    console.log('Canvases:', cnt);
    for (let c2 = 0; c2 < Math.min(cnt, 3); c2++) {
      const box = await canvases.nth(c2).boundingBox();
      if (box) {
        const cx = Math.round(box.x + box.width * 0.35);
        const cy = Math.round(box.y + box.height * 0.45);
        console.log('Click chart ' + c2 + ' at (' + cx + ',' + cy + ')');
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(5000);
        const open = await page.locator('.el-drawer').isVisible({ timeout: 3000 }).catch(() => false);
        console.log('Drawer open:', open);
        if (open) {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'D-drill-' + c2 + '.png'), fullPage: true });
          const txt = (await page.locator('.el-drawer').textContent()) || '';
          console.log('Drawer: ' + txt.substring(0, 300));
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
          break;
        }
      }
    }
  });

  test('E - Stats', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const btn = page.locator('button:has-text("统计")').first();
    const has = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Stats btn:', has);
    if (has) {
      await btn.click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'E-stats.png'), fullPage: true });
      const dlg = await page.locator('.el-dialog').isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Dialog:', dlg);
    }
  });

  test('F - YoY', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const btn = page.locator('button:has-text("同比")').first();
    const has = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('YoY btn:', has);
    if (has) {
      await btn.click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'F-yoy.png'), fullPage: true });
    }
  });

});
