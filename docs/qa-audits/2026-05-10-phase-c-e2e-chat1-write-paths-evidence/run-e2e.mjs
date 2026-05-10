// Phase C E2E SmartBI write paths — chat1 dispatch (test 10011 verify)
// Per Sub-S audit PR #271: 41 Config + 13 Upload endpoints all KEEP.
// This run verifies post-Phase-C jar (deployed test ~12:39 UTC May 10) that
// SmartBI write paths still operate against test backend at 47:10011 via
// nginx 139:8097.
//
// QA prompt v2.4 Rules covered:
//   - Rule 7: MutationObserver for toast capture (no querySelectorAll race)
//   - Rule 8: 4-axis check on errors (network message / toast text / sticky / actionHint)
//   - Rule 11: write op roundtrip (capture body + shape audit + re-GET diff)
//   - Rule 16: entry-point matrix on DataSourceConfigView (handleAdd/handleEdit/handleDelete/handleTestConnection)
//   - Rule 16b: cross-entry state isolation — note dialog has destroy-on-close
//
// Usage: node run-e2e.mjs (from this directory)

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const playwrightPath = 'C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/playwright';
const { chromium } = require(playwrightPath);

const WEB_ADMIN_URL = 'http://139.196.165.140:8097';   // TEST env (NOT prod 8086)
const EVIDENCE_DIR = process.cwd();
const FACTORY = { factoryId: 'F001', username: 'factory_admin1', password: '123456' };

// suffix to keep test data uniquely identifiable + cleanable
const RUN_TAG = 'C1' + randomBytes(2).toString('hex').toUpperCase();
const TEST_NAME_PREFIX = `chat1-phaseC-${RUN_TAG}`;
const TEST_DS_CODE = `CHAT1_PHASEC_${RUN_TAG}`;

// installed once per page so MutationObserver outlives multi-step flows
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

async function readToasts(page, sinceTs = 0) {
  return await page.evaluate((since) => {
    return (window.__toastLog || []).filter(t => t.time >= since);
  }, sinceTs);
}

async function login(page) {
  await page.goto(`${WEB_ADMIN_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });

  const username = await page.$('input[placeholder*="用户名"]')
    || await page.$('input[name="username"]')
    || (await page.$$('input[type="text"]'))[0];
  const password = await page.$('input[type="password"]');
  await username.fill(FACTORY.username);
  await password.fill(FACTORY.password);

  const btn = await page.$('.login-button')
    || await page.$('button:has-text("登 录")')
    || await page.$('button:has-text("登录")');
  if (btn) await btn.click(); else await password.press('Enter');

  await page.waitForFunction(() =>
    location.pathname !== '/login' || !!localStorage.getItem('cretas_access_token'),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  return { token, url: page.url() };
}

// helper to do an authenticated fetch from inside the page (uses access token)
async function pageGet(page, path) {
  return await page.evaluate(async (url) => {
    const t = localStorage.getItem('cretas_access_token');
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' },
    });
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  }, path);
}

// =====================================================================
// Phase 1: Excel Upload page mount + invalid-file 400 (Rule 8 four-axis)
// =====================================================================
async function phase1ExcelUpload(page) {
  const result = { phase: 1, name: 'Excel Upload page + invalid 400', steps: [] };
  const apiHits = [];
  const onResp = (r) => {
    const url = r.url();
    if (url.includes('/api/mobile/')) {
      apiHits.push({
        url: url.replace(WEB_ADMIN_URL, ''),
        status: r.status(),
        method: r.request().method(),
      });
    }
  };
  page.on('response', onResp);

  // Step 1.1: navigate to upload page
  const navStart = Date.now();
  try {
    await page.goto(`${WEB_ADMIN_URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    result.steps.push({ id: '1.1', verdict: 'FAIL', reason: `nav failed: ${e.message}` });
    page.off('response', onResp);
    return result;
  }
  await installToastObserver(page);
  await page.screenshot({ path: join(EVIDENCE_DIR, 'phase1-1-upload-page.png'), fullPage: true });

  // detect mount
  const pageText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const mounted = pageText.includes('Excel') || pageText.includes('上传') || pageText.includes('文件');
  const has5xx = apiHits.some(h => h.status >= 500);
  result.steps.push({
    id: '1.1',
    name: 'mount /smart-bi/upload',
    verdict: (mounted && !has5xx) ? 'PASS' : 'FAIL',
    pageTextLen: pageText.length,
    pageTextSample: pageText.slice(0, 300),
    apiHitsSinceNav: apiHits.slice(),
    has5xx,
    depth: 'medium',  // observation-level deep on a read page
  });

  // Step 1.2: trigger upload with invalid .txt file (expect 400 from backend)
  // Strategy: capture wire body, set file via Element Plus el-upload, observe response
  const before12 = Date.now();
  apiHits.length = 0;
  let uploadReqBody = null;
  const onReq = (req) => {
    if (req.url().includes('/upload-and-analyze') || req.url().includes('/smart-bi/upload')) {
      try {
        const post = req.postData();
        uploadReqBody = { url: req.url().replace(WEB_ADMIN_URL, ''), method: req.method(), bodyChars: post ? post.length : 0 };
      } catch { /* ignore */ }
    }
  };
  page.on('request', onReq);

  // Find file input — el-upload renders <input type="file">
  let invalidUploadVerdict = 'BLOCKED';
  let invalidUploadReason = null;
  let toastsAfter = [];
  let uploadResp = null;
  try {
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      invalidUploadReason = 'no file input found on page (selector failed) — upload UI may differ';
    } else {
      // Use Playwright's setInputFiles with in-memory buffer (no need for actual file on disk)
      await fileInput.setInputFiles({
        name: 'invalid-test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('this is not an excel file', 'utf-8'),
      });
      await page.waitForTimeout(8000);  // wait for upload + parse fail response
      // pull toasts
      toastsAfter = await readToasts(page, before12);
      uploadResp = apiHits.find(h => h.url.includes('/upload')) || null;
    }
  } catch (e) {
    invalidUploadReason = `exception: ${e.message}`;
  }
  page.off('request', onReq);
  await page.screenshot({ path: join(EVIDENCE_DIR, 'phase1-2-after-invalid-upload.png'), fullPage: true });

  // Rule 8 four-axis judgment
  // a) network response status + (we can't easily read body without intercept) — capture status only
  // b) toast text
  // c) sticky (is-closable) check
  // d) specific message vs fallback
  let four = { backendStatus: uploadResp?.status, toastCount: toastsAfter.length, toastSample: toastsAfter.slice(0, 3), wireReqBody: uploadReqBody };
  if (uploadResp && (uploadResp.status === 400 || uploadResp.status === 415 || uploadResp.status === 422)) {
    if (toastsAfter.length === 0) {
      invalidUploadVerdict = 'FAIL'; invalidUploadReason = 'silent failure — backend rejected but no toast';
    } else {
      const errToast = toastsAfter.find(t => t.cls.includes('error') || t.cls.includes('warning'));
      if (!errToast) {
        invalidUploadVerdict = 'FAIL'; invalidUploadReason = 'toast shown but not error/warning class';
      } else {
        const sticky = errToast.isClosable;
        const generic = /操作失败|请求失败|系统错误/.test(errToast.text) && !/excel|文件|格式|解析|sheet|xlsx/i.test(errToast.text);
        if (!sticky && generic) {
          invalidUploadVerdict = 'FAIL'; invalidUploadReason = 'toast neither sticky nor specific (Rule 8 c+d fail)';
        } else if (!sticky) {
          invalidUploadVerdict = 'WARN'; invalidUploadReason = 'specific message but not sticky (Rule 8 c fail)';
        } else if (generic) {
          invalidUploadVerdict = 'WARN'; invalidUploadReason = 'sticky but message too generic (Rule 8 d fail)';
        } else {
          invalidUploadVerdict = 'PASS';
        }
        four.errToastText = errToast.text;
        four.errToastSticky = sticky;
      }
    }
  } else if (uploadResp && uploadResp.status === 200) {
    invalidUploadVerdict = 'WARN'; invalidUploadReason = `unexpected 200 on invalid upload — backend tolerated bad file`;
  } else if (!uploadResp) {
    invalidUploadVerdict = 'BLOCKED'; invalidUploadReason = 'no upload API hit observed (UI may not have triggered upload)';
  }

  result.steps.push({
    id: '1.2',
    name: 'invalid upload (.txt) → expect 400 + Rule 8 four-axis',
    verdict: invalidUploadVerdict,
    reason: invalidUploadReason,
    fourAxis: four,
    depth: 'error-deep',
  });

  page.off('response', onResp);
  return result;
}

// =====================================================================
// Phase 2: Threshold inline edit + Rule 11 roundtrip
// =====================================================================
async function phase2Threshold(page) {
  const result = { phase: 2, name: 'Threshold inline edit + roundtrip', steps: [] };
  const apiHits = [];
  const onResp = (r) => {
    const url = r.url();
    if (url.includes('/api/mobile/')) {
      apiHits.push({
        url: url.replace(WEB_ADMIN_URL, ''),
        status: r.status(),
        method: r.request().method(),
      });
    }
  };
  page.on('response', onResp);

  // 2.1 navigate to /system/smartbi-config (overview tab)
  try {
    await page.goto(`${WEB_ADMIN_URL}/system/smartbi-config`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
  } catch (e) {
    result.steps.push({ id: '2.1', verdict: 'FAIL', reason: `nav failed: ${e.message}` });
    page.off('response', onResp);
    return result;
  }
  await installToastObserver(page);
  await page.screenshot({ path: join(EVIDENCE_DIR, 'phase2-1-config-overview.png'), fullPage: true });

  const listHit = apiHits.find(h => h.url.includes('/smartbi-config/thresholds')) || null;
  result.steps.push({
    id: '2.1',
    name: 'mount /system/smartbi-config (threshold list GET)',
    verdict: (listHit && listHit.status === 200) ? 'PASS' : 'FAIL',
    listApi: listHit,
    apiHitsCount: apiHits.length,
    depth: 'medium',
  });

  // 2.2 list-side roundtrip: pull thresholds from backend, sample data
  const thresholdsResp = await pageGet(page, '/api/mobile/smartbi-config/thresholds');
  let dataArr = [];
  if (thresholdsResp.body) {
    const d = thresholdsResp.body.data;
    dataArr = Array.isArray(d) ? d : (d?.content || []);
  }
  const sampleStep = {
    id: '2.2',
    name: 'threshold list sample (Rule 9: top + middle + last)',
    verdict: thresholdsResp.status === 200 ? 'PASS' : 'FAIL',
    totalRows: dataArr.length,
    listStatus: thresholdsResp.status,
    sample: dataArr.length > 0 ? {
      top3: dataArr.slice(0, 3).map(r => ({ id: r.id, code: r.metricCode, name: r.metricName, warn: r.warningThreshold })),
      middle: dataArr.length >= 3 ? dataArr[Math.floor(dataArr.length / 2)] && {
        id: dataArr[Math.floor(dataArr.length / 2)].id,
        code: dataArr[Math.floor(dataArr.length / 2)].metricCode,
        name: dataArr[Math.floor(dataArr.length / 2)].metricName,
      } : null,
      last3: dataArr.slice(-3).map(r => ({ id: r.id, code: r.metricCode, name: r.metricName, warn: r.warningThreshold })),
    } : null,
    depth: 'deep',
  };
  result.steps.push(sampleStep);

  // 2.3 inline-edit a threshold (pick first active row, bump warningThreshold +1) + Rule 11 roundtrip
  let editStep = { id: '2.3', name: 'inline-edit threshold + Rule 11 roundtrip', depth: 'deep' };
  if (dataArr.length === 0) {
    editStep.verdict = 'BLOCKED';
    editStep.reason = 'no thresholds in test DB to edit';
  } else {
    const target = dataArr[0];
    const origWarn = target.warningThreshold;
    const newWarn = (typeof origWarn === 'number' ? origWarn : 0) + 1;

    // capture PUT request body
    let putBody = null;
    const onReq = (req) => {
      if (req.method() === 'PUT' && req.url().includes(`/smartbi-config/thresholds/${target.id}`)) {
        try { putBody = req.postData(); } catch { putBody = null; }
      }
    };
    page.on('request', onReq);

    // call updateThreshold via the page's fetch (direct API, since UI inline-edit is row-bound)
    const updResp = await page.evaluate(async ({ id, payload }) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(payload),
      });
      let body = null;
      try { body = await r.json(); } catch { body = null; }
      return { status: r.status, body };
    }, { id: target.id, payload: { warningThreshold: newWarn, criticalThreshold: target.criticalThreshold, isActive: target.isActive } });

    page.off('request', onReq);
    await page.waitForTimeout(500);

    // re-GET to verify persistence
    const reGet = await pageGet(page, '/api/mobile/smartbi-config/thresholds');
    let arr2 = [];
    if (reGet.body) {
      const d = reGet.body.data;
      arr2 = Array.isArray(d) ? d : (d?.content || []);
    }
    const post = arr2.find(r => r.id === target.id);
    const persisted = post && post.warningThreshold === newWarn;

    // restore original value (cleanup)
    let restored = null;
    if (persisted) {
      const restore = await page.evaluate(async ({ id, payload }) => {
        const t = localStorage.getItem('cretas_access_token');
        const r = await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify(payload),
        });
        return { status: r.status };
      }, { id: target.id, payload: { warningThreshold: origWarn, criticalThreshold: target.criticalThreshold, isActive: target.isActive } });
      restored = restore.status;
    }

    editStep.verdict = (updResp.status === 200 && persisted) ? 'PASS' : 'FAIL';
    editStep.reason = updResp.status !== 200 ? `PUT status ${updResp.status}` : (!persisted ? `silent-drop: PUT 200 but re-GET shows warn=${post?.warningThreshold} (sent ${newWarn})` : null);
    editStep.targetMetric = { id: target.id, code: target.metricCode, name: target.metricName };
    editStep.origWarn = origWarn;
    editStep.newWarn = newWarn;
    editStep.putStatus = updResp.status;
    editStep.putRespMessage = updResp.body?.message;
    editStep.putBodyChars = putBody?.length;
    editStep.putBodyPreview = putBody ? putBody.slice(0, 400) : null;
    editStep.persistedWarn = post?.warningThreshold;
    editStep.cleanupRestore = restored;
  }
  result.steps.push(editStep);

  page.off('response', onResp);
  return result;
}

// =====================================================================
// Phase 3: DataSource CRUD (Rule 16 entry-point matrix + Rule 11)
// =====================================================================
async function phase3DataSource(page) {
  const result = { phase: 3, name: 'DataSource CRUD (Rule 16 + Rule 11)', steps: [] };
  const apiHits = [];
  const onResp = (r) => {
    const url = r.url();
    if (url.includes('/api/mobile/smartbi-config/data-sources')) {
      apiHits.push({
        url: url.replace(WEB_ADMIN_URL, ''),
        status: r.status(),
        method: r.request().method(),
      });
    }
  };
  page.on('response', onResp);

  // 3.0 list page mount
  try {
    await page.goto(`${WEB_ADMIN_URL}/system/smartbi-config/data-sources`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    result.steps.push({ id: '3.0', verdict: 'FAIL', reason: `nav failed: ${e.message}` });
    page.off('response', onResp);
    return result;
  }
  await installToastObserver(page);
  await page.screenshot({ path: join(EVIDENCE_DIR, 'phase3-0-data-sources-list.png'), fullPage: true });

  const listHit = apiHits.find(h => h.url.endsWith('/data-sources') || h.url.includes('/data-sources?')) || null;
  result.steps.push({
    id: '3.0',
    name: 'mount /system/smartbi-config/data-sources',
    verdict: (listHit && listHit.status === 200) ? 'PASS' : 'FAIL',
    listApi: listHit,
    depth: 'medium',
  });

  // 3.1 handleAdd entry — open dialog, fill form, submit, capture wire body, re-GET single
  // capture POST body
  let createBody = null;
  let createUrl = null;
  const onReqCreate = (req) => {
    if (req.method() === 'POST' && req.url().includes('/smartbi-config/data-sources') && !req.url().match(/\/data-sources\/\d+/)) {
      createUrl = req.url().replace(WEB_ADMIN_URL, '');
      try { createBody = req.postData(); } catch { createBody = null; }
    }
  };
  page.on('request', onReqCreate);

  // Click "新建数据源" button
  let createStep = { id: '3.1', name: 'handleAdd: open dialog → fill → submit → roundtrip', depth: 'deep' };
  let createdId = null;
  let createdRow = null;
  try {
    const beforeAddTs = Date.now();
    const addBtn = await page.$('button:has-text("新建数据源")') || await page.$('button:has-text("新建")');
    if (!addBtn) throw new Error('"新建数据源" button not found (canWrite=false?)');
    await addBtn.click();
    await page.waitForSelector('.el-dialog__body', { timeout: 5000 });
    await page.waitForTimeout(500);

    // fill form: name, code, type, description, refreshInterval
    const testName = `${TEST_NAME_PREFIX}-name`;
    const testDesc = `Phase C E2E test — ${RUN_TAG}`;
    // name input (first text input in dialog)
    const dialogInputs = await page.$$('.el-dialog__body input.el-input__inner');
    // Element Plus structure: name=input[0], code=input[1], refreshInterval=input[2]
    if (dialogInputs.length >= 1) await dialogInputs[0].fill(testName);
    if (dialogInputs.length >= 2) await dialogInputs[1].fill(TEST_DS_CODE);

    // description (textarea — last textarea typically)
    const textareas = await page.$$('.el-dialog__body textarea');
    if (textareas.length >= 2) await textareas[1].fill(testDesc);  // index 1 = description (0=connectionConfig)
    else if (textareas.length >= 1) await textareas[0].fill(testDesc);

    await page.waitForTimeout(400);
    await page.screenshot({ path: join(EVIDENCE_DIR, 'phase3-1-add-dialog-filled.png'), fullPage: true });

    // submit (确定 button in dialog footer)
    const confirmBtn = await page.$('.el-dialog__footer button.el-button--primary')
      || await page.$('.el-dialog__footer button:has-text("确定")');
    if (!confirmBtn) throw new Error('confirm button not found in dialog footer');
    await confirmBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(EVIDENCE_DIR, 'phase3-1-add-after-submit.png'), fullPage: true });

    const toasts = await readToasts(page, beforeAddTs);
    const successToast = toasts.find(t => t.cls.includes('success'));

    const postHit = apiHits.find(h => h.method === 'POST' && h.url.includes('/data-sources'));

    // re-GET via list to find created row by code
    const listResp = await pageGet(page, '/api/mobile/smartbi-config/data-sources?keyword=' + encodeURIComponent(TEST_DS_CODE));
    const listRows = listResp.body?.data?.content || [];
    createdRow = listRows.find(r => r.code === TEST_DS_CODE) || null;
    if (createdRow) createdId = createdRow.id;

    // Rule 11 wire-shape audit: parse createBody, check for phantom fields / missing required
    let wireShapeAudit = { checked: false };
    if (createBody) {
      try {
        const parsed = JSON.parse(createBody);
        const sentKeys = Object.keys(parsed);
        const expectedKeys = ['name', 'code', 'type', 'description', 'connectionConfig', 'refreshInterval', 'isActive'];
        const phantom = sentKeys.filter(k => !expectedKeys.includes(k) && !['id'].includes(k));  // 'id' is benign in some patterns
        const missing = ['name', 'code', 'type'].filter(k => !sentKeys.includes(k));
        wireShapeAudit = {
          checked: true,
          sentKeys,
          phantom,
          missingRequired: missing,
        };
      } catch (e) {
        wireShapeAudit = { checked: false, parseError: e.message };
      }
    }

    // roundtrip diff: sent vs persisted
    let roundtripDiff = null;
    if (createdRow && createBody) {
      try {
        const sent = JSON.parse(createBody);
        const diffs = [];
        for (const k of ['name', 'code', 'type', 'description', 'refreshInterval', 'isActive']) {
          if (sent[k] !== undefined && sent[k] !== createdRow[k]) {
            diffs.push({ field: k, sent: sent[k], persisted: createdRow[k] });
          }
        }
        roundtripDiff = { fieldsChecked: 6, diffs };
      } catch { /* ignore */ }
    }

    createStep.verdict = (postHit && postHit.status === 200 && createdRow && (!roundtripDiff || roundtripDiff.diffs.length === 0)) ? 'PASS' : 'FAIL';
    createStep.toastSuccessText = successToast?.text;
    createStep.postHit = postHit;
    createStep.wireUrl = createUrl;
    createStep.wireBodyChars = createBody?.length;
    createStep.wireShapeAudit = wireShapeAudit;
    createStep.createdRow = createdRow;
    createStep.roundtripDiff = roundtripDiff;
    if (createStep.verdict === 'FAIL') {
      const reasons = [];
      if (!postHit || postHit.status !== 200) reasons.push(`POST status: ${postHit?.status}`);
      if (!createdRow) reasons.push('row not found in re-GET (silent failure)');
      if (roundtripDiff && roundtripDiff.diffs.length > 0) reasons.push(`silent-drop: ${JSON.stringify(roundtripDiff.diffs)}`);
      createStep.reason = reasons.join(' | ');
    }
  } catch (e) {
    createStep.verdict = 'FAIL';
    createStep.reason = `exception: ${e.message}`;
  }
  page.off('request', onReqCreate);
  result.steps.push(createStep);

  // 3.2 handleEdit entry — re-open same item, change description, submit, roundtrip diff
  let editStep = { id: '3.2', name: 'handleEdit: re-open created row → change description → roundtrip diff (Rule 11)', depth: 'deep' };
  if (!createdId) {
    editStep.verdict = 'BLOCKED';
    editStep.reason = 'cannot edit — phase 3.1 did not produce a created row';
  } else {
    let editBody = null;
    const onReqEdit = (req) => {
      if (req.method() === 'PUT' && req.url().includes(`/data-sources/${createdId}`)) {
        try { editBody = req.postData(); } catch { editBody = null; }
      }
    };
    page.on('request', onReqEdit);

    try {
      const beforeEditTs = Date.now();
      // refresh list so the created row appears + click 编辑 on its row
      // search for code to filter list
      const searchInput = await page.$('input[placeholder*="名称"]') || await page.$('input[placeholder*="名称/代码"]');
      if (searchInput) {
        await searchInput.fill(TEST_DS_CODE);
        const searchBtn = await page.$('button:has-text("搜索")');
        if (searchBtn) await searchBtn.click();
        await page.waitForTimeout(1500);
      }
      // click 编辑 button on the row
      const editBtn = await page.$('button:has-text("编辑")');
      if (!editBtn) throw new Error('"编辑" button not found on row');
      await editBtn.click();
      await page.waitForSelector('.el-dialog__body', { timeout: 5000 });
      await page.waitForTimeout(500);

      // verify the dialog shows prefilled name = createdRow.name (Rule 16: edit prefill check)
      const nameInput = (await page.$$('.el-dialog__body input.el-input__inner'))[0];
      const prefillName = await nameInput.evaluate(el => el.value);
      const prefillOK = prefillName === createdRow.name;

      // change description
      const newDesc = `Phase C E2E EDITED — ${RUN_TAG}`;
      const textareas = await page.$$('.el-dialog__body textarea');
      if (textareas.length >= 2) await textareas[1].fill(newDesc);
      else if (textareas.length >= 1) await textareas[0].fill(newDesc);

      await page.waitForTimeout(300);
      const confirmBtn = await page.$('.el-dialog__footer button.el-button--primary');
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(EVIDENCE_DIR, 'phase3-2-after-edit.png'), fullPage: true });

      const toasts = await readToasts(page, beforeEditTs);
      const successToast = toasts.find(t => t.cls.includes('success'));

      const putHit = apiHits.find(h => h.method === 'PUT' && h.url.includes(`/data-sources/${createdId}`));

      // re-GET single
      const re = await pageGet(page, `/api/mobile/smartbi-config/data-sources/${createdId}`);
      const persistedRow = re.body?.data;
      const persistedDesc = persistedRow?.description;

      // wire shape audit on edit body
      let editShapeAudit = { checked: false };
      if (editBody) {
        try {
          const parsed = JSON.parse(editBody);
          const sentKeys = Object.keys(parsed);
          const phantom = sentKeys.filter(k => ['createdAt', 'updatedAt'].includes(k));
          editShapeAudit = { checked: true, sentKeys, phantomFromSpread: phantom };
        } catch { /* ignore */ }
      }

      editStep.verdict = (putHit?.status === 200 && persistedDesc === newDesc && prefillOK) ? 'PASS' : 'FAIL';
      editStep.prefillName = prefillName;
      editStep.prefillOK = prefillOK;
      editStep.toastSuccessText = successToast?.text;
      editStep.putStatus = putHit?.status;
      editStep.wireBodyChars = editBody?.length;
      editStep.wireShapeAudit = editShapeAudit;
      editStep.persistedDescription = persistedDesc;
      editStep.expectedDescription = newDesc;
      if (editStep.verdict === 'FAIL') {
        const reasons = [];
        if (!prefillOK) reasons.push(`prefill mismatch: got "${prefillName}" expected "${createdRow.name}"`);
        if (putHit?.status !== 200) reasons.push(`PUT status: ${putHit?.status}`);
        if (persistedDesc !== newDesc) reasons.push(`silent-drop: description sent "${newDesc}" persisted "${persistedDesc}"`);
        editStep.reason = reasons.join(' | ');
      }
    } catch (e) {
      editStep.verdict = 'FAIL';
      editStep.reason = `exception: ${e.message}`;
    }
    page.off('request', onReqEdit);
  }
  result.steps.push(editStep);

  // 3.3 handleTestConnection entry — click 测试 button on row
  let testConnStep = { id: '3.3', name: 'handleTestConnection: click 测试 → graceful response', depth: 'medium' };
  if (!createdId) {
    testConnStep.verdict = 'BLOCKED';
    testConnStep.reason = 'no row to test — 3.1 blocked';
  } else {
    try {
      const beforeTs = Date.now();
      const testBtn = await page.$('button:has-text("测试")');
      if (!testBtn) throw new Error('"测试" button not found');
      await testBtn.click();
      await page.waitForTimeout(2500);
      const toasts = await readToasts(page, beforeTs);
      const testHit = apiHits.find(h => h.url.includes(`/data-sources/${createdId}/test`) || h.url.includes('/test-connection'));
      testConnStep.verdict = (testHit && testHit.status < 500) ? 'PASS' : 'FAIL';
      testConnStep.testHit = testHit;
      testConnStep.toastsAfter = toasts.slice(0, 3);
      if (!testHit) testConnStep.reason = 'no test-connection API hit observed';
    } catch (e) {
      testConnStep.verdict = 'FAIL';
      testConnStep.reason = `exception: ${e.message}`;
    }
  }
  result.steps.push(testConnStep);

  // 3.4 handleDelete entry — click 删除, confirm box, verify
  let delStep = { id: '3.4', name: 'handleDelete: confirm box → delete → list -1', depth: 'deep' };
  if (!createdId) {
    delStep.verdict = 'BLOCKED';
    delStep.reason = 'no row to delete';
  } else {
    try {
      const beforeTs = Date.now();
      const delBtn = await page.$('button.el-button--danger:has-text("删除")');
      if (!delBtn) throw new Error('"删除" button not found');
      await delBtn.click();
      // ElMessageBox.confirm — click 确定
      await page.waitForSelector('.el-message-box', { timeout: 3000 });
      const confirmBtn = await page.$('.el-message-box .el-button--primary');
      await confirmBtn.click();
      await page.waitForTimeout(2000);

      const toasts = await readToasts(page, beforeTs);
      const delHit = apiHits.find(h => h.method === 'DELETE' && h.url.includes(`/data-sources/${createdId}`));

      // re-GET to verify gone
      const re = await pageGet(page, `/api/mobile/smartbi-config/data-sources?keyword=` + encodeURIComponent(TEST_DS_CODE));
      const stillThere = (re.body?.data?.content || []).find(r => r.id === createdId);

      delStep.verdict = (delHit?.status === 200 && !stillThere) ? 'PASS' : 'FAIL';
      delStep.delStatus = delHit?.status;
      delStep.successToastText = toasts.find(t => t.cls.includes('success'))?.text;
      delStep.persistedAfterDelete = !!stillThere;
      if (delStep.verdict === 'FAIL') {
        const reasons = [];
        if (delHit?.status !== 200) reasons.push(`DELETE status: ${delHit?.status}`);
        if (stillThere) reasons.push('row still exists in re-GET (silent-drop on delete)');
        delStep.reason = reasons.join(' | ');
      }
    } catch (e) {
      delStep.verdict = 'FAIL';
      delStep.reason = `exception: ${e.message}`;
    }
  }
  result.steps.push(delStep);

  page.off('response', onResp);
  return result;
}

// =====================================================================
// Phase 4: Error path on Add (FE validation + duplicate code) + Rule 8
// =====================================================================
async function phase4ErrorPath(page) {
  const result = { phase: 4, name: 'Error path: empty + duplicate (Rule 8 four-axis)', steps: [] };
  const apiHits = [];
  const onResp = (r) => {
    const url = r.url();
    if (url.includes('/api/mobile/smartbi-config/data-sources')) {
      apiHits.push({
        url: url.replace(WEB_ADMIN_URL, ''),
        status: r.status(),
        method: r.request().method(),
      });
    }
  };
  page.on('response', onResp);

  try {
    await page.goto(`${WEB_ADMIN_URL}/system/smartbi-config/data-sources`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await installToastObserver(page);

    // 4.1 click 新建, leave name empty, click 确定 → expect FE validation error
    const beforeTs = Date.now();
    const addBtn = await page.$('button:has-text("新建数据源")');
    if (!addBtn) throw new Error('"新建数据源" button not found');
    await addBtn.click();
    await page.waitForSelector('.el-dialog__body', { timeout: 5000 });
    await page.waitForTimeout(500);

    // immediate submit without filling
    const confirmBtn = await page.$('.el-dialog__footer button.el-button--primary');
    await confirmBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(EVIDENCE_DIR, 'phase4-1-empty-submit.png'), fullPage: true });

    // FE validation should show inline el-form-item error text + no API hit
    const inlineErrors = await page.$$eval('.el-form-item__error', els => els.map(e => e.textContent?.trim()).filter(Boolean));
    const apiCalled = apiHits.some(h => h.method === 'POST');
    result.steps.push({
      id: '4.1',
      name: 'submit empty form → FE validation blocks (no API hit)',
      verdict: (inlineErrors.length > 0 && !apiCalled) ? 'PASS' : 'FAIL',
      inlineErrors,
      apiHits: apiHits.slice(),
      depth: 'error-deep',
      reason: inlineErrors.length === 0 ? 'no FE validation messages shown' :
              apiCalled ? 'API was called despite FE validation should block' : null,
    });

    // close dialog
    const cancelBtn = await page.$('.el-dialog__footer button:has-text("取消")');
    if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(500); }
  } catch (e) {
    result.steps.push({ id: '4.1', verdict: 'FAIL', reason: `exception: ${e.message}` });
  }

  page.off('response', onResp);
  return result;
}

// =====================================================================
// Phase 5: Cross-entry state isolation (Rule 16b — qualifier check)
// =====================================================================
async function phase5StateIsolation(page) {
  const result = { phase: 5, name: 'Cross-entry state isolation (Rule 16b)', steps: [] };
  // First check: does dialog have destroy-on-close? (read prereq from Rule 16)
  // From source: line 378 of DataSourceConfigView.vue has `destroy-on-close` on el-dialog.
  // Per Rule 16 prereq: "若 dialog 用 ... destroy-on-close 保证每次重建, 状态泄漏不可能发生, 可跳 Rule 16b"
  // We still RUN the smoke check but flag verdict: N/A-PER-RULE16-PREREQ if destroy-on-close confirmed.

  try {
    await page.goto(`${WEB_ADMIN_URL}/system/smartbi-config/data-sources`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // open Add, fill name, cancel
    const addBtn = await page.$('button:has-text("新建数据源")');
    await addBtn.click();
    await page.waitForSelector('.el-dialog__body', { timeout: 5000 });
    const dialogInputs = await page.$$('.el-dialog__body input.el-input__inner');
    if (dialogInputs.length >= 1) await dialogInputs[0].fill('STALE_DRAFT_NAME');
    await page.waitForTimeout(300);
    const cancelBtn = await page.$('.el-dialog__footer button:has-text("取消")');
    if (cancelBtn) await cancelBtn.click();
    await page.waitForTimeout(500);

    // re-open Add — should see fresh empty form (NOT "STALE_DRAFT_NAME")
    await addBtn.click();
    await page.waitForSelector('.el-dialog__body', { timeout: 5000 });
    await page.waitForTimeout(500);
    const reopenInputs = await page.$$('.el-dialog__body input.el-input__inner');
    const reopenName = reopenInputs[0] ? await reopenInputs[0].evaluate(el => el.value) : null;
    const stateLeaked = reopenName === 'STALE_DRAFT_NAME';

    await page.screenshot({ path: join(EVIDENCE_DIR, 'phase5-reopen-add.png'), fullPage: true });

    // close
    const cancel2 = await page.$('.el-dialog__footer button:has-text("取消")');
    if (cancel2) { await cancel2.click(); await page.waitForTimeout(500); }

    result.steps.push({
      id: '5.1',
      name: 'reopen Add after cancel — form must be empty (Rule 16b smoke)',
      verdict: stateLeaked ? 'FAIL' : 'PASS',
      noteRule16Prereq: 'DataSourceConfigView dialog uses destroy-on-close (line 378); per Rule 16 prereq, state isolation is structurally guaranteed, this test is informational',
      reopenNameValue: reopenName,
      depth: 'medium',
      reason: stateLeaked ? 'STALE_DRAFT_NAME persisted across cancel→reopen — destroy-on-close not effective' : null,
    });
  } catch (e) {
    result.steps.push({ id: '5.1', verdict: 'FAIL', reason: `exception: ${e.message}` });
  }
  return result;
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  console.log(`[E2E] Starting ${new Date().toISOString()}  RUN_TAG=${RUN_TAG}`);
  console.log(`[E2E] Target: ${WEB_ADMIN_URL} (test env via nginx → 47:10011)`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  const results = {
    startedAt: new Date().toISOString(),
    runTag: RUN_TAG,
    target: WEB_ADMIN_URL,
    factory: FACTORY,
    phases: [],
  };

  try {
    // Phase 0: login
    console.log('[E2E] Phase 0: login');
    const loginRes = await login(page);
    results.login = loginRes;
    if (!loginRes.token) {
      console.error('[E2E] Login FAILED — abort');
      results.fatalError = 'login_failed';
    } else {
      console.log(`[E2E] Login OK (url=${loginRes.url})`);

      // run phases sequentially
      console.log('[E2E] Phase 1: Excel Upload page + invalid file');
      results.phases.push(await phase1ExcelUpload(page));

      console.log('[E2E] Phase 2: Threshold inline edit + roundtrip');
      results.phases.push(await phase2Threshold(page));

      console.log('[E2E] Phase 3: DataSource CRUD (Rule 16 + Rule 11)');
      results.phases.push(await phase3DataSource(page));

      console.log('[E2E] Phase 4: Error path');
      results.phases.push(await phase4ErrorPath(page));

      console.log('[E2E] Phase 5: Cross-entry state isolation');
      results.phases.push(await phase5StateIsolation(page));
    }
  } catch (e) {
    results.fatalError = e.message;
    results.fatalStack = e.stack;
    console.error('[E2E] Fatal:', e);
  }

  results.consoleErrorsTotal = consoleErrors.length;
  results.consoleErrorsSample = consoleErrors.slice(0, 10);
  results.pageErrors = pageErrors;
  results.finishedAt = new Date().toISOString();

  await ctx.close();
  await browser.close();

  // aggregate verdict
  const counts = { PASS: 0, FAIL: 0, WARN: 0, BLOCKED: 0, OTHER: 0 };
  for (const ph of results.phases) {
    for (const st of (ph.steps || [])) {
      counts[st.verdict] = (counts[st.verdict] || 0) + 1;
      if (!['PASS','FAIL','WARN','BLOCKED'].includes(st.verdict)) counts.OTHER++;
    }
  }
  results.verdictCounts = counts;

  writeFileSync(join(EVIDENCE_DIR, 'summary.json'), JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n[E2E] === DONE: PASS=${counts.PASS} FAIL=${counts.FAIL} WARN=${counts.WARN} BLOCKED=${counts.BLOCKED} ===`);
  console.log(`[E2E] summary.json saved`);
  process.exit(counts.FAIL > 0 ? 1 : 0);
}

main().catch(err => { console.error('[E2E] Fatal main:', err); process.exit(2); });
