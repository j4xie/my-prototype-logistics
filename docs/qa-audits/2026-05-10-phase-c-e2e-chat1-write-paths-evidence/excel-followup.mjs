// Follow-up after T2 BLOCKED — investigate /uploads list shape and try wizard confirm step.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/playwright');
const XLSX = require('C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/xlsx');

const URL = 'http://139.196.165.140:8097';
const RUN = 'EF' + randomBytes(2).toString('hex').toUpperCase();
const EVIDENCE = process.cwd();

function synthSalesXlsx() {
  const rows = [
    ['日期','客户名称','产品名称','数量','金额'],
    ['2026-01-05',`客户A-${RUN}`,'清酒200ml',100,2500.00],
    ['2026-01-12',`客户B-${RUN}`,'酱油1L',80,1600.00],
    ['2026-01-19',`客户B-${RUN}`,'清酒200ml',120,3000.00],
    ['2026-02-03',`客户A-${RUN}`,'调味料500g',60,1500.00],
    ['2026-02-14',`客户B-${RUN}`,'酱油1L',90,1800.00],
    ['2026-03-12',`客户A-${RUN}`,'调味料500g',75,1875.00],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '销售数据');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

async function pageGet(page, path) {
  return page.evaluate(async (url) => {
    const t = localStorage.getItem('cretas_access_token');
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' } });
    let body = null; try { body = await r.json(); } catch {}
    return { status: r.status, body };
  }, path);
}

async function login(page) {
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="password"]');
  await (await page.$$('input[type="text"]'))[0].fill('factory_admin1');
  await (await page.$('input[type="password"]')).fill('123456');
  await (await page.$('.login-button, button:has-text("登 录"), button:has-text("登录")')).click();
  await page.waitForFunction(() => !!localStorage.getItem('cretas_access_token'), { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function main() {
  console.log(`[XF] starting RUN=${RUN}`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apiHits = [];
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/api/mobile/F001/smart-bi/')) {
      apiHits.push({ url: u.replace(URL, ''), status: r.status(), method: r.request().method() });
    }
  });

  const out = { run: RUN, tests: [] };

  await login(page);

  // ---- F1: probe /uploads list shape (no keyword filter) ----
  const r1 = await pageGet(page, '/api/mobile/F001/smart-bi/uploads?page=0&size=20');
  const d1 = r1.body?.data;
  out.tests.push({
    id: 'F1-uploads-list-shape',
    listStatus: r1.status,
    bodyDataType: Array.isArray(d1) ? 'array' : typeof d1,
    contentLen: Array.isArray(d1?.content) ? d1.content.length : (Array.isArray(d1) ? d1.length : 'n/a'),
    rawBodyKeys: r1.body ? Object.keys(r1.body) : null,
    rawDataKeys: d1 && !Array.isArray(d1) ? Object.keys(d1) : null,
    sampleFirst: Array.isArray(d1) ? d1[0] : d1?.content?.[0],
  });

  // ---- F2: try alternate endpoints ----
  const r2 = await pageGet(page, '/api/mobile/F001/smart-bi/datasource/list?page=0&size=20');
  out.tests.push({
    id: 'F2-datasource-list',
    status: r2.status,
    bodyType: typeof r2.body?.data,
    sampleKeys: r2.body?.data ? (Array.isArray(r2.body.data) ? Object.keys(r2.body.data[0] || {}) : Object.keys(r2.body.data)) : null,
    rowCount: r2.body?.data?.content?.length || (Array.isArray(r2.body?.data) ? r2.body.data.length : 'n/a'),
  });

  // ---- F3: do upload + walk through wizard to confirm step ----
  await page.goto(`${URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  apiHits.length = 0;

  const buf = synthSalesXlsx();
  const fi = await page.$('input[type="file"]');
  await fi.setInputFiles({
    name: `wizard-test-${RUN}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buf,
  });
  await page.waitForTimeout(15000);  // wait for parse + analysis
  await page.screenshot({ path: join(EVIDENCE, 'xf-3-after-parse.png'), fullPage: true });

  // try to find next/确认/保存 button to advance through wizard
  const btnTexts = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(b => ({ text: (b.textContent || '').trim().slice(0, 30), disabled: b.disabled, classes: b.className.split(' ').slice(0, 3).join(' ') }));
  });

  // try clicking "查看分析结果" or similar
  let advance1 = null;
  try {
    const viewBtn = await page.$('button:has-text("查看分析结果"), button:has-text("分析结果"), button:has-text("下一步")');
    if (viewBtn) { await viewBtn.click(); await page.waitForTimeout(8000); advance1 = 'clicked-view-analysis'; }
  } catch (e) { advance1 = `err: ${e.message}`; }
  await page.screenshot({ path: join(EVIDENCE, 'xf-3-after-advance1.png'), fullPage: true });

  // try clicking 保存/确认/完成
  let advance2 = null;
  try {
    const saveBtn = await page.$('button:has-text("保存"), button:has-text("确认保存"), button:has-text("完成"), button:has-text("确认")');
    if (saveBtn) { await saveBtn.click(); await page.waitForTimeout(6000); advance2 = 'clicked-save'; }
  } catch (e) { advance2 = `err: ${e.message}`; }
  await page.screenshot({ path: join(EVIDENCE, 'xf-3-after-advance2.png'), fullPage: true });

  // re-list uploads
  const r3 = await pageGet(page, '/api/mobile/F001/smart-bi/uploads?page=0&size=20');
  const list3 = r3.body?.data?.content || r3.body?.data || [];
  const ours = (Array.isArray(list3) ? list3 : []).find(u => (u.fileName || u.filename || '').includes(RUN));

  // also re-check datasource/list
  const r3b = await pageGet(page, '/api/mobile/F001/smart-bi/datasource/list?page=0&size=20');
  const list3b = r3b.body?.data?.content || r3b.body?.data || [];
  const oursDs = (Array.isArray(list3b) ? list3b : []).find(u => JSON.stringify(u || {}).includes(RUN));

  out.tests.push({
    id: 'F3-wizard-confirm',
    btnTextsObserved: btnTexts.filter(b => b.text && !/^(\d|展开|收起|×)/.test(b.text)),
    advance1, advance2,
    apiHitsAfterUpload: apiHits.slice(),
    uploadsListAfter: { status: r3.status, count: Array.isArray(list3) ? list3.length : 'n/a', ourFound: !!ours, ourRow: ours },
    datasourceListAfter: { status: r3b.status, count: Array.isArray(list3b) ? list3b.length : 'n/a', ourFound: !!oursDs, ourRow: oursDs },
  });

  await ctx.close();
  await browser.close();

  out.finishedAt = new Date().toISOString();
  writeFileSync(join(EVIDENCE, 'excel-followup.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log('done — wrote excel-followup.json');
  for (const t of out.tests) console.log(`  ${t.id}`);
}

main().catch(e => { console.error(e); process.exit(1); });
