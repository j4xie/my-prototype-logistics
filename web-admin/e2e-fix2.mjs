import { chromium } from 'playwright';
import fs from 'fs';
const DIR = '../temp/e2e-prod-apr8-v2';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', () => {});
p.on('response', async r => {
  const u = r.url();
  if (/reusable-containers/.test(u) && r.request().method() === 'POST') {
    console.log('RES POST', r.status(), (await r.text().catch(()=>'')).slice(0,300));
  }
});
await p.goto('http://localhost:5173');
await p.waitForTimeout(1500);
await p.fill('input[placeholder*="用户"]', 'factory_admin1');
await p.fill('input[type="password"]', '123456');
await p.click('button:has-text("登 录")');
await p.waitForTimeout(3500);

// T7 — try again with all fields
await p.goto('http://localhost:5173/warehouse/reusable-containers', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await (await p.$('button:has-text("新建")') || await p.$('button:has-text("添加")') || await p.$('button:has-text("新增")')).click();
await p.waitForTimeout(1200);
const code = `CRT-E2E-V2-${Date.now()}`;
async function fillByLabel(re, val) {
  const items = await p.$$('.el-dialog .el-form-item');
  for (const it of items) {
    const lbl = await it.$eval('.el-form-item__label', e => e.textContent?.trim()).catch(()=>'');
    if (re.test(lbl)) {
      const inp = await it.$('input, textarea');
      if (inp) { await inp.fill(String(val)); return true; }
    }
  }
  return false;
}
console.log('fill 编号:', await fillByLabel(/编号/, code));
console.log('fill 名称:', await fillByLabel(/名称/, 'E2E V2 筐'));
console.log('fill 规格:', await fillByLabel(/规格/, '60x40x30 / 25kg'));
console.log('fill 单价:', await fillByLabel(/单价|赔偿/, '15'));
console.log('fill 初始数量:', await fillByLabel(/初始数量|数量/, '10'));
await p.waitForTimeout(500);
await p.screenshot({ path: `${DIR}/t7-final-filled.png` });
// click submit
const sub = await p.$('.el-dialog .el-dialog__footer button.el-button--primary') || await p.$('.el-dialog button:has-text("确 定")');
console.log('submit btn?', !!sub);
if (sub) await sub.click();
await p.waitForTimeout(3000);
await p.screenshot({ path: `${DIR}/t7-final-after.png` });
// get any visible message
const msgs = await p.$$eval('.el-message, .el-form-item__error', els => els.map(e => e.textContent?.trim()));
console.log('T7 msgs:', JSON.stringify(msgs));
// API verify
const row = await p.evaluate(async (code) => {
  const t = localStorage.getItem('cretas_access_token');
  const r = await fetch('/api/mobile/F001/reusable-containers?page=0&size=200', { headers: { Authorization: `Bearer ${t}` }});
  const d = await r.json();
  const list = d.data?.content || [];
  return { count: list.length, found: list.find(c => c.containerCode === code || c.code === code) };
}, code);
console.log('T7 api:', JSON.stringify(row));

await b.close();
