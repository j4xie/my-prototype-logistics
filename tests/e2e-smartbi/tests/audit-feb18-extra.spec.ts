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

test.describe('Extra Audit', () => {

  test('G1 - Comprehensive Analysis', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const btn = page.locator('button:has-text("综合分析")').first();
    const has = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Comprehensive btn:', has);
    if (has) {
      await btn.click();
      await page.waitForTimeout(15000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'G1-comprehensive.png'), fullPage: true });
      const dlg = await page.locator('.el-dialog').isVisible({ timeout: 3000 }).catch(() => false);
      const drawer = await page.locator('.el-drawer').isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Dialog:', dlg, 'Drawer:', drawer);
      const canvases = await page.locator('canvas').count();
      console.log('Canvases after:', canvases);
    }
  });

  test('G2 - YoY Analysis', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const btn = page.locator('button:has-text("同比分析")').first();
    const has = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('YoY btn:', has);
    if (has) {
      await btn.click();
      await page.waitForTimeout(10000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'G2-yoy-clicked.png'), fullPage: true });
      const dlg = await page.locator('.el-dialog').isVisible({ timeout: 3000 }).catch(() => false);
      console.log('YoY Dialog:', dlg);
    }
  });

  test('G3 - Causal Analysis', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    if (await tabs.count() > 0) { await tabs.first().click(); await page.waitForTimeout(12000); }
    const btn = page.locator('button:has-text("因果分析")').first();
    const has = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Causal btn:', has);
    if (has) {
      await btn.click();
      await page.waitForTimeout(10000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'G3-causal.png'), fullPage: true });
    }
  });

  test('G4 - Chart Click Sheet4', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await nav(page);
    const tabs = page.locator('.el-tabs__item');
    const tc = await tabs.count();
    if (tc >= 5) { await tabs.nth(4).click(); } else if (tc > 0) { await tabs.first().click(); }
    await page.waitForTimeout(15000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'G4-sheet4.png'), fullPage: true });
    const canvases = page.locator('canvas');
    const cnt = await canvases.count();
    console.log('Canvases on sheet 4:', cnt);
    for (let i = 0; i < Math.min(cnt, 5); i++) {
      const box = await canvases.nth(i).boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        for (const xPct of [0.25, 0.5, 0.75]) {
          await page.mouse.click(box.x + box.width * xPct, box.y + box.height * 0.5);
          await page.waitForTimeout(2000);
          const drawerOpen = await page.locator('.el-drawer').isVisible({ timeout: 1000 }).catch(() => false);
          if (drawerOpen) {
            console.log('Drawer opened on chart ' + i + ' at xPct=' + xPct);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'G4-drill-chart' + i + '.png'), fullPage: true });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            break;
          }
        }
      }
    }
  });

});
