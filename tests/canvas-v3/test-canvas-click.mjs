#!/usr/bin/env node
import { BrowserClient } from './lib/browser-client.mjs';

async function test() {
  const browser = new BrowserClient({ headless: true });
  await browser.launch();
  await browser.login('factory_admin1', '123456');
  const page = browser.getPage();
  await page.waitForTimeout(2000);
  
  console.log('Attempting to click Canvas item via getByText...');
  const item = page.getByText('Canvas 配置编辑器', { exact: false });
  
  try {
    // Try to scroll into view first
    await item.scrollIntoViewIfNeeded();
    console.log('Scrolled into view');
  } catch (e) {
    console.log('Scroll failed:', e.message);
  }
  
  try {
    await item.click();
    console.log('Clicked successfully!');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    const url = page.url();
    console.log('New URL:', url);
    
    if (url.includes('/canvas-editor')) {
      console.log('SUCCESS: Navigated to /canvas-editor');
      const shot = await browser.screenshot('S1-success');
      console.log('Screenshot:', shot);
    }
  } catch (e) {
    console.log('Click failed:', e.message);
    await browser.screenshot('S1-click-failed');
  }
  
  await browser.close();
}

test().catch(console.error);
