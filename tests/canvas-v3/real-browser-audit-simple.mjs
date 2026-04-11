#!/usr/bin/env node
import { BrowserClient } from './lib/browser-client.mjs';
import fs from 'fs';

const SCREENSHOT_DIR = './tests/canvas-v3/screenshots/audit-3';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const results = {};

async function scenario1() {
  console.log('Scenario 1: Canvas sidebar entry discoverable');
  try {
    const browser = new BrowserClient({ headless: true });
    await browser.launch();
    const loggedIn = await browser.login('factory_admin1', '123456');
    if (!loggedIn) throw new Error('Login failed');
    console.log('    ✓ Logged in');
    
    const page = browser.getPage();
    const canvasItem = await page.locator('text=Canvas 配置编辑器').first();
    const isVisible = await canvasItem.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      console.log('    ✓ Canvas sidebar entry found');
      await canvasItem.click();
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.includes('/canvas-editor')) {
        console.log('    ✓ URL is /canvas-editor');
        const shot = await browser.screenshot('S1-canvas-editor');
        results.scenario1 = { status: 'PASS', shot };
      } else {
        results.scenario1 = { status: 'FAIL', issue: 'Wrong URL: ' + url };
      }
    } else {
      results.scenario1 = { status: 'FAIL', issue: 'Canvas sidebar not found' };
    }
    await browser.close();
  } catch (e) {
    results.scenario1 = { status: 'FAIL', issue: e.message };
  }
}

async function main() {
  console.log('Canvas V3 Real Browser Audit Test');
  await scenario1();
  console.log('SUMMARY');
  for (const [scenario, result] of Object.entries(results)) {
    console.log(`${scenario}: ${result.status}`);
    if (result.shot) console.log(`  Screenshot: ${result.shot}`);
    if (result.issue) console.log(`  Issue: ${result.issue}`);
  }
  process.exit(0);
}
main();
