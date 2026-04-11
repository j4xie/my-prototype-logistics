#!/usr/bin/env node
import { BrowserClient } from './lib/browser-client.mjs';

async function debug() {
  const browser = new BrowserClient({ headless: true });
  await browser.launch();
  await browser.login('factory_admin1', '123456');
  const page = browser.getPage();
  
  await page.waitForTimeout(2000);
  
  console.log('=== Current URL:', page.url());
  console.log('=== Looking for sidebar items...');
  
  const allText = await page.locator('*').allTextContents();
  const canvasRelated = allText.filter(t => t.includes('Canvas') || t.includes('config') || t.includes('编辑'));
  console.log('Canvas-related text found:', canvasRelated.slice(0, 10));
  
  const buttons = await page.$$('button');
  console.log('Total buttons:', buttons.length);
  
  const menuItems = await page.$$('[class*="menu"], [class*="side"], [class*="nav"]');
  console.log('Menu-like elements:', menuItems.length);
  
  const allLinks = await page.$$('a');
  console.log('Total links:', allLinks.length);
  
  const withHref = allLinks.filter(async l => await l.getAttribute('href'));
  for (let i = 0; i < Math.min(10, allLinks.length); i++) {
    const href = await allLinks[i].getAttribute('href');
    const text = await allLinks[i].textContent();
    if (href || text) console.log(`  Link ${i}: "${text}" -> ${href}`);
  }
  
  await browser.screenshot('debug-sidebar');
  console.log('Screenshot saved');
  
  await browser.close();
}

debug();
