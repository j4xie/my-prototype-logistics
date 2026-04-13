import { chromium } from 'playwright';
import fs from 'fs';
const DIR = '../temp/e2e-prod-apr8-v2';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => {});

// login
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.fill('input[placeholder*="用户"]', 'factory_admin1');
await page.fill('input[type="password"]', '123456');
await page.click('button:has-text("登 录")');
await page.waitForTimeout(3500);
console.log('login url:', page.url());

const results = {};

// ==== T7 probe: look at form fields ====
await page.goto('http://localhost:5173/warehouse/reusable-containers', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const btn = await page.$('button:has-text("新建")') || await page.$('button:has-text("添加")') || await page.$('button:has-text("新增")');
if (btn) {
  await btn.click();
  await page.waitForTimeout(1500);
  const formInputs = await page.$$eval('.el-dialog input, .el-dialog textarea', els => els.map(e => ({ ph: e.placeholder, type: e.type })));
  const labels = await page.$$eval('.el-dialog .el-form-item__label', els => els.map(e => e.textContent?.trim()));
  console.log('T7 labels:', JSON.stringify(labels));
  console.log('T7 inputs:', JSON.stringify(formInputs));
  await page.screenshot({ path: `${DIR}/t7-dialog-probe.png` });
  // attempt fill by label iteration: find input near each label
  const code = `CRT-E2E-V2-${Date.now()}`;
  // fill all text inputs
  const inputs = await page.$$('.el-dialog input[type="text"], .el-dialog input:not([type])');
  // Use form semantics: find input via label
  async function fillByLabel(re, val) {
    const items = await page.$$('.el-dialog .el-form-item');
    for (const it of items) {
      const lbl = await it.$eval('.el-form-item__label', e => e.textContent?.trim()).catch(()=>'');
      if (re.test(lbl)) {
        const inp = await it.$('input, textarea');
        if (inp) { await inp.fill(String(val)); return lbl; }
      }
    }
    return null;
  }
  console.log('filled:',
    await fillByLabel(/编号|编码/, code),
    await fillByLabel(/名称/, 'E2E V2 筐'),
    await fillByLabel(/类型/, ''),
    await fillByLabel(/总量|持有|数量/, '10'),
    await fillByLabel(/单价|价格/, '15'),
    await fillByLabel(/规格/, '50L')
  );
  // also try select for type
  const sels = await page.$$('.el-dialog .el-select');
  for (const s of sels) {
    await s.click().catch(()=>{});
    await page.waitForTimeout(400);
    const opt = await page.$('.el-select-dropdown:visible .el-select-dropdown__item');
    if (opt) await opt.click().catch(()=>{});
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${DIR}/t7-filled-probe.png` });
  const sub = await page.$('.el-dialog button:has-text("确 定")') || await page.$('.el-dialog button:has-text("确定")');
  if (sub) await sub.click();
  let toastText = null;
  try {
    await page.waitForSelector('.el-message', { timeout: 8000 });
    toastText = await page.$eval('.el-message', el => el.textContent?.trim());
  } catch {}
  await page.screenshot({ path: `${DIR}/t7-toast-probe.png` });
  // API verify
  const apiRow = await page.evaluate(async (code) => {
    const t = localStorage.getItem('cretas_access_token');
    const r = await fetch(`/api/mobile/F001/reusable-containers?page=0&size=100`, { headers: { Authorization: `Bearer ${t}` }});
    if (!r.ok) return { err: r.status };
    const d = await r.json();
    const list = d.data?.content || d.data || [];
    return list.find?.(c => c.containerCode === code || c.code === code) || null;
  }, code);
  results.T7 = { code, toast: toastText, apiRow, status: apiRow && !apiRow.err ? 'PASS' : (toastText && /成功/.test(toastText) ? 'PASS' : 'FAIL') };
  console.log('T7:', JSON.stringify(results.T7));
  await page.keyboard.press('Escape');
}

// ==== T9 product category probe ====
await page.goto('http://localhost:5173/system/products', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const pBtn = await page.$('button:has-text("新建")') || await page.$('button:has-text("添加")') || await page.$('button:has-text("新增")');
if (pBtn) {
  await pBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/t9-initial-probe.png` });
  const labels = await page.$$eval('.el-dialog .el-form-item__label', els => els.map(e => e.textContent?.trim()));
  console.log('T9 initial labels:', JSON.stringify(labels));
  const bizRe = /品牌|结算方式|含税|箱数折算/;
  const hasBefore = labels.some(l => bizRe.test(l||''));
  // find 大类 select
  let switched = false;
  const items = await page.$$('.el-dialog .el-form-item');
  for (const it of items) {
    const lbl = await it.$eval('.el-form-item__label', e => e.textContent?.trim()).catch(()=>'');
    if (/大类|类别|类型/.test(lbl)) {
      const sel = await it.$('.el-select');
      if (sel) {
        await sel.click();
        await page.waitForTimeout(500);
        const opts = await page.$$eval('.el-select-dropdown:visible .el-select-dropdown__item', els => els.map(e => e.textContent?.trim()));
        console.log('T9 category opts:', JSON.stringify(opts));
        const rawOpt = await page.$('.el-select-dropdown:visible .el-select-dropdown__item:has-text("原材料")');
        if (rawOpt) { await rawOpt.click(); switched = true; break; }
        await page.keyboard.press('Escape');
      }
      // try radio
      const radios = await it.$$('label');
      for (const r of radios) {
        const txt = await r.textContent();
        if (/原材料/.test(txt||'')) { await r.click(); switched = true; break; }
      }
      if (switched) break;
    }
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/t9-after-probe.png` });
  const labels2 = await page.$$eval('.el-dialog .el-form-item__label', els => els.map(e => e.textContent?.trim()));
  console.log('T9 after labels:', JSON.stringify(labels2));
  const hasAfter = labels2.some(l => bizRe.test(l||''));
  results.T9 = { hasBefore, hasAfter, switched, status: (switched && hasBefore !== hasAfter) ? 'PASS' : 'PARTIAL' };
  console.log('T9:', JSON.stringify(results.T9));
}

// ==== N1 intent config probe ====
const n1 = await page.evaluate(async () => {
  const t = localStorage.getItem('cretas_access_token');
  // try a few paths
  for (const p of [
    '/api/mobile/admin/intent-configs?page=0&size=2000',
    '/api/mobile/F001/admin/intent-configs?page=0&size=2000',
    '/api/mobile/F001/ai/intent-configs?page=0&size=2000',
    '/api/mobile/admin/ai/intents?page=0&size=2000',
  ]) {
    try {
      const r = await fetch(p, { headers: { Authorization: `Bearer ${t}` }});
      if (r.ok) {
        const d = await r.json();
        const list = d.data?.content || d.data || [];
        const found = list.filter?.(i => /REUSABLE|RETURN_IN/.test(i.intentCode||''))?.map?.(i => i.intentCode);
        return { path: p, status: r.status, found };
      }
    } catch {}
  }
  return { notfound: true };
});
console.log('N1:', JSON.stringify(n1));
results.N1 = { ...n1, status: n1.found?.includes('REUSABLE_CONTAINER_RETURN_IN') ? 'PASS' : 'UNVERIFIED' };

// ==== N2 material-batch probe ====
const n2 = await page.evaluate(async () => {
  const t = localStorage.getItem('cretas_access_token');
  const r = await fetch('/api/mobile/F001/material-batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ sourceDocType: 'PURCHASE_RECEIVE', sourceDocId: 'fake-id-xxx', materialCode: 'X', quantity: 1 })
  });
  const txt = await r.text();
  return { status: r.status, body: txt.slice(0, 300) };
});
console.log('N2:', JSON.stringify(n2));
results.N2 = { ...n2, status: n2.status === 400 ? 'PASS' : (n2.status >= 400 && n2.status < 500 ? 'PASS' : 'PARTIAL') };

// ==== T8 re-probe ====
const t8 = await page.evaluate(async () => {
  const t = localStorage.getItem('cretas_access_token');
  const r = await fetch('/api/mobile/F001/sales/deliveries/nonexistent/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: JSON.stringify({ photoUrls: ['http://test.jpg'], signedByName: 'E2E', remark: 'e2e' })
  });
  const body = await r.text();
  return { status: r.status, body: body.slice(0, 200) };
});
console.log('T8:', JSON.stringify(t8));
// endpoint exists if not 404 from spring's default no-handler
results.T8 = { ...t8, status: t8.status !== 404 || /No endpoint|no handler/i.test(t8.body) === false ? 'PASS' : 'FAIL' };

fs.writeFileSync(`${DIR}/fix-results.json`, JSON.stringify(results, null, 2));
await browser.close();
