// Phase C E2E chat1 follow-up: Excel upload happy path deep test.
// Closes §6 deferred item from main report.
//
// Coverage:
//   1) Synthesize valid SmartBI sales-data .xlsx in-memory via SheetJS
//   2) Sync upload via FE wizard UI (full E2E: navigate → step 1 → upload → step 2 parse → step 3 AI → step 4 confirm)
//   3) Rule 11 roundtrip: re-GET persisted upload via /uploads list + /uploads/{id}/data
//   4) Rule 9 data sample: top 3 + middle + last 3 rows from persisted preview
//   5) Backend invalid-content path: synthesize .xlsx with garbage schema → expect 4xx + Rule 8 four-axis
//
// Test env 47:10011 only. NO prod.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const playwright = 'C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/playwright';
const xlsxLib = 'C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/xlsx';
const { chromium } = require(playwright);
const XLSX = require(xlsxLib);

const URL = 'http://139.196.165.140:8097';
const RUN = 'EX' + randomBytes(2).toString('hex').toUpperCase();
const EVIDENCE = process.cwd();

// ---------- Excel synthesis ----------
function synthSalesXlsx() {
  // Per ExcelUpload.vue dataTypes 'sales' requiredFields: ['日期', '客户名称', '产品名称', '数量', '金额']
  // Use a fixed seed of 12 rows so we can verify Rule 9 (top + middle + last sampling)
  const rows = [
    ['日期',         '客户名称',     '产品名称',         '数量',  '金额'],
    ['2026-01-05',  `客户A-${RUN}`,  '清酒200ml',         100,   2500.00],
    ['2026-01-08',  `客户A-${RUN}`,  '调味料500g',         50,   1250.00],
    ['2026-01-12',  `客户B-${RUN}`,  '酱油1L',             80,   1600.00],
    ['2026-01-19',  `客户B-${RUN}`,  '清酒200ml',         120,   3000.00],
    ['2026-01-22',  `客户C-${RUN}`,  '芥末50g',            30,    900.00],
    ['2026-02-03',  `客户A-${RUN}`,  '调味料500g',         60,   1500.00],   // middle (idx=6 of 12)
    ['2026-02-09',  `客户D-${RUN}`,  '海带200g',           40,    800.00],
    ['2026-02-14',  `客户B-${RUN}`,  '酱油1L',             90,   1800.00],
    ['2026-02-21',  `客户C-${RUN}`,  '芥末50g',            20,    600.00],
    ['2026-02-28',  `客户E-${RUN}`,  '清酒200ml',          70,   1750.00],
    ['2026-03-05',  `客户D-${RUN}`,  '海带200g',           55,   1100.00],
    ['2026-03-12',  `客户A-${RUN}`,  '调味料500g',         75,   1875.00],   // last
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '销售数据');
  // returns Buffer (Node)
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

function synthGarbageXlsx() {
  // Wrong schema: random column names, random non-numeric data — backend Python parser should reject
  const rows = [
    ['foo', 'bar', 'baz', 'qux', 'lol'],
    ['hello', 'world', 'wat', 'never', 'gonna'],
    ['give', 'you', 'up', 'never', 'gonna'],
    ['let', 'you', 'down', 'never', 'gonna'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'garbage');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

// ---------- toast observer ----------
async function installToastObserver(page) {
  await page.evaluate(() => {
    if (window.__toastLog) return;
    window.__toastLog = [];
    const obs = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && typeof n.className === 'string' &&
          (n.className.includes('el-message') || n.className.includes('el-notification'))) {
        window.__toastLog.push({
          time: Date.now(),
          cls: n.className,
          text: (n.textContent || '').trim(),
          isClosable: n.className.includes('is-closable') ||
                      !!n.querySelector('.el-notification__closeBtn,.el-message__closeBtn'),
        });
      }
    })));
    obs.observe(document.body, { childList: true, subtree: true });
  });
}
async function readToasts(page, since = 0) {
  return page.evaluate(s => (window.__toastLog || []).filter(t => t.time >= s), since);
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
  const u = (await page.$$('input[type="text"]'))[0];
  const p = await page.$('input[type="password"]');
  await u.fill('factory_admin1');
  await p.fill('123456');
  await (await page.$('.login-button, button:has-text("登 录"), button:has-text("登录")')).click();
  await page.waitForFunction(() => !!localStorage.getItem('cretas_access_token'), { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function main() {
  console.log(`[XL] starting ${new Date().toISOString()}  RUN=${RUN}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apiHits = [];
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/api/mobile/') && (u.includes('/smart-bi/') || u.includes('/uploads'))) {
      apiHits.push({ url: u.replace(URL, ''), status: r.status(), method: r.request().method() });
    }
  });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  const out = { run: RUN, startedAt: new Date().toISOString(), tests: [] };

  try {
    await login(page);
    console.log(`[XL] login OK`);

    // ---- Test 1: Sync upload via FE wizard ----
    await page.goto(`${URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await installToastObserver(page);
    await page.screenshot({ path: join(EVIDENCE, 'xl-1-upload-page.png'), fullPage: true });

    const beforeT1 = Date.now();
    apiHits.length = 0;

    // upload buffer via setInputFiles
    const xlsxBuf = synthSalesXlsx();
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('file input not found');
    await fileInput.setInputFiles({
      name: `sales-test-${RUN}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsxBuf,
    });

    // wait for parse + analysis (FE may show region picker dialog if multi-stack detected, otherwise advances to step 2)
    // give backend ~20s for sync parse + AI insight + chart recommend (per uploadAndAnalyze comment, large files use async)
    await page.waitForTimeout(20000);
    await page.screenshot({ path: join(EVIDENCE, 'xl-1-after-upload.png'), fullPage: true });

    const t1Toasts = await readToasts(page, beforeT1);
    const uploadAndAnalyzeHits = apiHits.filter(h => h.url.includes('/upload-and-analyze') || h.url.includes('/smart-bi/upload'));
    const detectRegionsHits = apiHits.filter(h => h.url.includes('/detect-table-regions'));
    const success = uploadAndAnalyzeHits.find(h => h.status === 200);
    const failed = uploadAndAnalyzeHits.find(h => h.status >= 400);

    // try to find uploadId in page state (Vue ref currentUploadId)
    let pageState = null;
    try {
      pageState = await page.evaluate(() => {
        const root = document.querySelector('.smartbi-wizard, .upload-wizard, [class*=upload]');
        return {
          stepsActive: document.querySelector('.el-step.is-process')?.textContent?.trim().slice(0, 60),
          parsedRowCount: document.body.innerText.match(/解析.*?(\d+).*?行|已解析(\d+)条/)?.[0] || null,
        };
      });
    } catch { /* ignore */ }

    out.tests.push({
      id: 'T1-sync-upload',
      name: 'sync upload happy path: synth valid xlsx → setInputFiles → backend parse + analysis',
      verdict: success ? 'PASS' : (failed ? 'FAIL' : 'BLOCKED'),
      uploadAndAnalyzeHits,
      detectRegionsHits,
      otherHits: apiHits.filter(h => !uploadAndAnalyzeHits.includes(h) && !detectRegionsHits.includes(h)),
      successToast: t1Toasts.find(t => t.cls.includes('success'))?.text,
      errorToast: t1Toasts.find(t => t.cls.includes('error'))?.text,
      allToasts: t1Toasts.map(t => ({ cls: t.cls.split(' ').slice(0, 3).join(' '), text: t.text.slice(0, 80) })),
      pageState,
      depth: 'deep',
      reason: failed ? `backend ${failed.status}` : (success ? null : 'no upload API hit observed'),
    });

    // ---- Test 2: Rule 11 roundtrip — re-GET persisted upload ----
    // Even without uploadId, can list /uploads and find by name suffix
    const listResp = await pageGet(page, '/api/mobile/F001/smart-bi/uploads?page=0&size=20');
    const uploads = listResp.body?.data?.content || listResp.body?.data || [];
    // try to find our row by file name containing RUN
    const ourUpload = (Array.isArray(uploads) ? uploads : []).find(u =>
      (u.fileName || u.filename || '').includes(RUN) ||
      (u.fileName || u.filename || '').includes('sales-test'));
    let dataResp = null;
    let fieldsResp = null;
    let rowSample = null;
    if (ourUpload?.id) {
      dataResp = await pageGet(page, `/api/mobile/F001/smart-bi/uploads/${ourUpload.id}/data?page=0&size=20`);
      fieldsResp = await pageGet(page, `/api/mobile/F001/smart-bi/uploads/${ourUpload.id}/fields`);
      const dataRows = dataResp.body?.data?.content || dataResp.body?.data?.rows || dataResp.body?.data || [];
      if (Array.isArray(dataRows) && dataRows.length >= 3) {
        rowSample = {
          totalRetrieved: dataRows.length,
          top3: dataRows.slice(0, 3),
          middle: dataRows[Math.floor(dataRows.length / 2)],
          last3: dataRows.slice(-3),
        };
      } else {
        rowSample = { totalRetrieved: Array.isArray(dataRows) ? dataRows.length : 0, raw: dataRows };
      }
    }
    out.tests.push({
      id: 'T2-rule11-roundtrip',
      name: 'Rule 11 roundtrip: re-GET /uploads list + /uploads/{id}/data + /uploads/{id}/fields',
      verdict: ourUpload ? (dataResp?.status === 200 ? 'PASS' : 'FAIL') : 'BLOCKED',
      listStatus: listResp.status,
      uploadsCount: Array.isArray(uploads) ? uploads.length : 'not-array',
      ourUpload: ourUpload ? {
        id: ourUpload.id,
        fileName: ourUpload.fileName || ourUpload.filename,
        rowCount: ourUpload.rowCount || ourUpload.totalRows,
        status: ourUpload.status,
        dataType: ourUpload.dataType || ourUpload.tableType,
        createdAt: ourUpload.createdAt,
      } : null,
      dataStatus: dataResp?.status,
      fieldsStatus: fieldsResp?.status,
      fieldsCount: Array.isArray(fieldsResp?.body?.data) ? fieldsResp.body.data.length : null,
      depth: 'deep',
    });

    // ---- Test 3: Rule 9 business semantic on persisted rows ----
    if (rowSample && rowSample.top3) {
      // verify business semantic: 客户名称 should contain "客户" + RUN, 金额 should be number-ish
      const inspect = (r) => {
        if (!r || typeof r !== 'object') return { kind: 'invalid', value: r };
        const keys = Object.keys(r);
        const customerKey = keys.find(k => k.includes('客户') || k.toLowerCase().includes('customer'));
        const amountKey = keys.find(k => k.includes('金额') || k.toLowerCase().includes('amount'));
        return {
          keys,
          customer: customerKey ? r[customerKey] : null,
          amount: amountKey ? r[amountKey] : null,
        };
      };
      const top0 = inspect(rowSample.top3[0]);
      const mid = inspect(rowSample.middle);
      const lastN = inspect(rowSample.last3[rowSample.last3.length - 1]);
      const customerLooksReal = (v) => typeof v === 'string' && (v.includes('客户') || v.includes(RUN));
      const allReal = customerLooksReal(top0.customer) && customerLooksReal(mid.customer) && customerLooksReal(lastN.customer);

      out.tests.push({
        id: 'T3-rule9-sample',
        name: 'Rule 9 business semantic on persisted rows (top + middle + last)',
        verdict: allReal ? 'PASS' : 'WARN',
        sampleRows: rowSample,
        inspectTop: top0,
        inspectMiddle: mid,
        inspectLast: lastN,
        allCustomersLookReal: allReal,
        depth: 'deep',
      });
    } else {
      out.tests.push({
        id: 'T3-rule9-sample',
        name: 'Rule 9 business semantic on persisted rows',
        verdict: 'BLOCKED',
        reason: 'no persisted row sample (T2 blocked)',
        depth: 'deep',
      });
    }

    // ---- Test 4: backend invalid-content path (Rule 8 four-axis) ----
    // need fresh page state — go back to upload page
    await page.goto(`${URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await installToastObserver(page);

    const beforeT4 = Date.now();
    apiHits.length = 0;
    const garbageBuf = synthGarbageXlsx();
    const fileInput2 = await page.$('input[type="file"]');
    await fileInput2.setInputFiles({
      name: `garbage-test-${RUN}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: garbageBuf,
    });
    await page.waitForTimeout(15000);
    await page.screenshot({ path: join(EVIDENCE, 'xl-4-after-garbage-upload.png'), fullPage: true });

    const t4Toasts = await readToasts(page, beforeT4);
    const garbageHits = apiHits.filter(h => h.url.includes('/upload') || h.url.includes('/detect-table-regions'));
    const garbageBackendResp = garbageHits.find(h => h.url.includes('/upload-and-analyze')) || garbageHits.find(h => h.url.includes('/smart-bi/upload'));

    // Rule 8 four-axis judgment
    let four = {
      backendStatus: garbageBackendResp?.status,
      hits: garbageHits,
      toasts: t4Toasts.map(t => ({ cls: t.cls.split(' ').slice(0, 3).join(' '), text: t.text.slice(0, 100), sticky: t.isClosable })),
    };
    let v4 = 'BLOCKED';
    let r4 = null;
    if (!garbageBackendResp) {
      // FE may have detected regions OR auto-parsed silently
      const errToast = t4Toasts.find(t => t.cls.includes('error') || t.cls.includes('warning'));
      if (errToast) {
        v4 = 'PASS';
        r4 = `FE-side reject (no backend hit): ${errToast.text.slice(0, 60)}`;
      } else {
        r4 = 'no backend hit AND no error toast — FE silently accepted garbage?';
        v4 = 'WARN';
      }
    } else if (garbageBackendResp.status === 200) {
      // backend accepted? maybe parser is too lenient
      v4 = 'WARN';
      r4 = `backend accepted garbage with 200 — may indicate weak schema validation`;
    } else if (garbageBackendResp.status >= 400 && garbageBackendResp.status < 500) {
      const errToast = t4Toasts.find(t => t.cls.includes('error') || t.cls.includes('warning'));
      if (!errToast) {
        v4 = 'FAIL'; r4 = 'silent failure — backend 4xx but no toast';
      } else {
        const sticky = errToast.isClosable;
        const generic = /操作失败|请求失败|系统错误/.test(errToast.text) && !/字段|表头|sheet|xlsx|解析|schema|列/i.test(errToast.text);
        if (!sticky && generic) { v4 = 'FAIL'; r4 = 'toast neither sticky nor specific'; }
        else if (!sticky) { v4 = 'WARN'; r4 = 'specific message but not sticky'; }
        else if (generic) { v4 = 'WARN'; r4 = 'sticky but message too generic'; }
        else { v4 = 'PASS'; }
        four.errToastText = errToast.text;
        four.errToastSticky = sticky;
      }
    }

    out.tests.push({
      id: 'T4-backend-invalid-content',
      name: 'backend invalid-content path: garbage xlsx → expect Rule 8 four-axis',
      verdict: v4,
      reason: r4,
      fourAxis: four,
      depth: 'error-deep',
    });

  } catch (e) {
    out.fatalError = e.message;
    out.fatalStack = e.stack;
    console.error('[XL] fatal:', e);
  }

  out.consoleErrorsTotal = consoleErrors.length;
  out.consoleErrorsSample = consoleErrors.slice(0, 10);
  out.pageErrors = pageErrors;
  out.finishedAt = new Date().toISOString();

  await ctx.close();
  await browser.close();

  // aggregate
  const counts = { PASS: 0, FAIL: 0, WARN: 0, BLOCKED: 0 };
  for (const t of out.tests) counts[t.verdict] = (counts[t.verdict] || 0) + 1;
  out.verdictCounts = counts;

  writeFileSync(join(EVIDENCE, 'excel-happy-path.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log(`[XL] === DONE: PASS=${counts.PASS} FAIL=${counts.FAIL} WARN=${counts.WARN} BLOCKED=${counts.BLOCKED} ===`);
  for (const t of out.tests) console.log(`  ${t.id}: ${t.verdict}${t.reason ? ' — '+t.reason : ''}`);
  process.exit(counts.FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
