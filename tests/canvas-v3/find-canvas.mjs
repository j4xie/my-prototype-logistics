#!/usr/bin/env node
import { BrowserClient } from './lib/browser-client.mjs';

async function find() {
  const browser = new BrowserClient({ headless: true });
  await browser.launch();
  await browser.login('factory_admin1', '123456');
  const page = browser.getPage();
  await page.waitForTimeout(2000);
  
  const canvasItems = await page.$$('[class*="Canvas"], [class*="canvas"]');
  console.log('Elements with Canvas in class:', canvasItems.length);
  
  const allDivs = await page.$$('*');
  for (const elem of allDivs) {
    const text = await elem.textContent();
    if (text && text.includes('Canvas') && text.length < 100) {
      const tag = await elem.evaluate(el => el.tagName);
      const classes = await elem.evaluate(el => el.className);
      console.log(`Found: <${tag} class="${classes}">${text.substring(0, 50)}`);
    }
  }
  
  console.log('\nTrying different selectors...');
  const byText = await page.$$('text=Canvas 配置编辑器');
  console.log('By text selector:', byText.length);
  
  const containingDiv = await page.$$('div:has-text("Canvas 配置编辑器")');
  console.log('DIV containing Canvas:', containingDiv.length);
  
  await browser.close();
}
find();
