#!/usr/bin/env node
import { BrowserClient } from './lib/browser-client.mjs';

async function test() {
  const browser = new BrowserClient({ headless: true });
  await browser.launch();
  await browser.login('factory_admin1', '123456');
  const page = browser.getPage();
  await page.waitForTimeout(2000);
  
  // Try different methods
  console.log('Method 1: locator(text=Canvas)');
  const loc1 = page.locator('text=Canvas');
  console.log('  Count:', await loc1.count());
  console.log('  Visible:', await loc1.isVisible().catch(() => false));
  
  console.log('\nMethod 2: locator with contains');
  const loc2 = page.locator(':text("Canvas")');
  console.log('  Count:', await loc2.count());
  
  console.log('\nMethod 3: Using getByText');
  const loc3 = await page.getByText('Canvas 配置编辑器', { exact: false });
  console.log('  Found via getByText');
  console.log('  Visible:', await loc3.isVisible().catch(() => false));
  
  console.log('\nMethod 4: Using $$ with filter');
  const allElements = await page.$$('*');
  let found = 0;
  for (const el of allElements) {
    const text = await el.textContent();
    if (text && text.includes('Canvas 配置编辑器')) {
      const tag = await el.evaluate(e => e.tagName);
      console.log(`  Found: <${tag}>`);
      found++;
      if (found >= 3) break;
    }
  }
  
  await browser.close();
}

test().catch(console.error);
