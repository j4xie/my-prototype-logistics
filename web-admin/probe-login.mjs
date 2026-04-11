import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
const inputs = await p.$$eval('input', els => els.map(e => ({ type: e.type, name: e.name, ph: e.placeholder, id: e.id, vis: e.offsetParent !== null })));
console.log('INPUTS:', JSON.stringify(inputs));
const btns = await p.$$eval('button', els => els.map(e => ({ txt: e.textContent?.trim(), vis: e.offsetParent !== null })));
console.log('BTNS:', JSON.stringify(btns));
console.log('URL:', p.url());
await p.screenshot({ path: '../temp/e2e-prod-apr8-v2/probe.png' });

// try login
await p.fill('input[placeholder*="用户"]', 'factory_admin1').catch(e => console.log('fill1 fail', e.message));
await p.fill('input[type="password"]', '123456').catch(e => console.log('fill2 fail', e.message));
await p.screenshot({ path: '../temp/e2e-prod-apr8-v2/probe-filled.png' });
// click
const loginBtn = await p.$('button:has-text("登 录")') || await p.$('button:has-text("登录")');
console.log('loginBtn?', !!loginBtn);
p.on('request', r => { if (r.url().includes('/api/')) console.log('REQ', r.method(), r.url()); });
p.on('response', async r => { if (r.url().includes('/api/')) console.log('RES', r.status(), r.url(), (await r.text().catch(()=>'')).slice(0,200)); });
if (loginBtn) {
  await loginBtn.click();
  await p.waitForTimeout(5000);
  console.log('AFTER URL:', p.url());
  await p.screenshot({ path: '../temp/e2e-prod-apr8-v2/probe-after.png' });
  // check localStorage
  const ls = await p.evaluate(() => Object.keys(localStorage));
  console.log('LS keys:', JSON.stringify(ls));
}
await b.close();
