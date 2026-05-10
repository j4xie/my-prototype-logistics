// Follow-up diagnostic for Phase C chat1 findings.
// 1) Re-test DataSource create with ?factoryId=F001 query param (does it work then?)
// 2) Re-test Threshold update with FULL body (does PUT then preserve all fields?)
// 3) Re-test Threshold update via UI (vs direct fetch)
// 4) Sanity-fetch single threshold + list to inspect actual returned shape

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/playwright');

const URL = 'http://139.196.165.140:8097';
const RUN = 'D' + randomBytes(2).toString('hex').toUpperCase();

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // login
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="password"]');
  const u = (await page.$$('input[type="text"]'))[0];
  const p = await page.$('input[type="password"]');
  await u.fill('factory_admin1');
  await p.fill('123456');
  await (await page.$('button:has-text("登 录"), button:has-text("登录"), .login-button')).click();
  await page.waitForFunction(() => !!localStorage.getItem('cretas_access_token'), { timeout: 15000 });
  await page.waitForTimeout(1500);

  const out = { run: RUN, startedAt: new Date().toISOString(), tests: [] };

  // ---- Test 1: DataSource create WITH factoryId in query string ----
  const code = `DIAG_${RUN}`;
  const ds1 = await page.evaluate(async ({ code }) => {
    const t = localStorage.getItem('cretas_access_token');
    const body = { name: 'diag-1', code, type: 'DATABASE', description: 'diag', refreshInterval: 60, isActive: true };
    const r = await fetch('/api/mobile/smartbi-config/data-sources?factoryId=F001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    let bodyResp = null; try { bodyResp = await r.json(); } catch {}
    return { status: r.status, body: bodyResp };
  }, { code });
  out.tests.push({ id: 'T1', name: 'POST data-sources?factoryId=F001 (query param fix)', result: ds1 });
  let createdId = ds1?.body?.data?.id || ds1?.body?.data?.dataSource?.id || null;

  // ---- Test 1b: DataSource create WITH factoryId in body ----
  const code2 = `DIAG_${RUN}_B`;
  const ds1b = await page.evaluate(async ({ code }) => {
    const t = localStorage.getItem('cretas_access_token');
    const body = { name: 'diag-1b', code, type: 'DATABASE', description: 'diag-body', refreshInterval: 60, isActive: true, factoryId: 'F001' };
    const r = await fetch('/api/mobile/smartbi-config/data-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    let bodyResp = null; try { bodyResp = await r.json(); } catch {}
    return { status: r.status, body: bodyResp };
  }, { code: code2 });
  out.tests.push({ id: 'T1b', name: 'POST data-sources with factoryId IN BODY', result: ds1b });

  // ---- Test 2: Threshold full body PUT (vs partial body) ----
  const list = await page.evaluate(async () => {
    const t = localStorage.getItem('cretas_access_token');
    const r = await fetch('/api/mobile/smartbi-config/thresholds', { headers: { Authorization: `Bearer ${t}` } });
    return r.json();
  });
  const thresholds = list?.data || [];
  out.tests.push({ id: 'T2-list-shape', name: 'thresholds list raw shape sample', sample: thresholds.slice(0, 2), totalRows: thresholds.length });

  if (thresholds.length > 0) {
    const target = thresholds[0];
    // FULL body PUT (echo back what we got + bump warningThreshold)
    const fullBody = { ...target, warningThreshold: 99 };
    delete fullBody.id;
    delete fullBody.createdAt;
    delete fullBody.updatedAt;
    const put = await page.evaluate(async ({ id, body }) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      let bodyResp = null; try { bodyResp = await r.json(); } catch {}
      return { status: r.status, body: bodyResp };
    }, { id: target.id, body: fullBody });

    // re-GET — try BOTH list and single
    const listAfter = await page.evaluate(async () => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch('/api/mobile/smartbi-config/thresholds', { headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' } });
      return r.json();
    });
    const arrAfter = listAfter?.data || [];
    const persistedRow = arrAfter.find(x => x.id === target.id);

    // restore
    let restoreStatus = null;
    if (persistedRow) {
      const restoreBody = { ...target };
      delete restoreBody.id; delete restoreBody.createdAt; delete restoreBody.updatedAt;
      const restore = await page.evaluate(async ({ id, body }) => {
        const t = localStorage.getItem('cretas_access_token');
        const r = await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify(body),
        });
        return { status: r.status };
      }, { id: target.id, body: restoreBody });
      restoreStatus = restore.status;
    }

    out.tests.push({
      id: 'T2-full-body-put',
      name: 'PUT threshold FULL body (sent warningThreshold=99) + roundtrip',
      target: { id: target.id, code: target.metricCode, originalWarn: target.warningThreshold },
      putStatus: put.status,
      putRespMessage: put.body?.message,
      persistedAfter: persistedRow,
      persistedWarnThreshold: persistedRow?.warningThreshold,
      sendVsPersisted: persistedRow?.warningThreshold === 99 ? 'MATCH' : 'DIFF',
      restoreStatus,
    });

    // Also try PARTIAL body (only warningThreshold) — same as failing test
    const partialPut = await page.evaluate(async ({ id }) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ warningThreshold: 88, isActive: true }),
      });
      let bodyResp = null; try { bodyResp = await r.json(); } catch {}
      return { status: r.status, body: bodyResp };
    }, { id: target.id });
    const listAfterPartial = await page.evaluate(async () => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch('/api/mobile/smartbi-config/thresholds', { headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' } });
      return r.json();
    });
    const persistedAfterPartial = (listAfterPartial?.data || []).find(x => x.id === target.id);

    // restore again
    if (persistedAfterPartial) {
      const restoreBody2 = { ...target };
      delete restoreBody2.id; delete restoreBody2.createdAt; delete restoreBody2.updatedAt;
      await page.evaluate(async ({ id, body }) => {
        const t = localStorage.getItem('cretas_access_token');
        await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify(body),
        });
      }, { id: target.id, body: restoreBody2 });
    }

    out.tests.push({
      id: 'T2-partial-body-put',
      name: 'PUT threshold PARTIAL body (warningThreshold=88, isActive=true) + roundtrip',
      target: { id: target.id, code: target.metricCode },
      putStatus: partialPut.status,
      putRespMessage: partialPut.body?.message,
      persistedAfter: persistedAfterPartial,
      persistedWarnThreshold: persistedAfterPartial?.warningThreshold,
      sendVsPersisted: persistedAfterPartial?.warningThreshold === 88 ? 'MATCH' : 'DIFF',
    });

    // Single-row GET (does it differ from list?)
    const single = await page.evaluate(async ({ id }) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/smartbi-config/thresholds/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      let body = null; try { body = await r.json(); } catch {}
      return { status: r.status, body };
    }, { id: target.id });
    out.tests.push({
      id: 'T2-single-vs-list',
      name: 'single-row GET shape vs list',
      singleStatus: single.status,
      singleData: single.body?.data,
    });
  }

  // ---- Test 3: cleanup any leftover diag rows ----
  if (createdId) {
    const del = await page.evaluate(async ({ id }) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/smartbi-config/data-sources/${id}?factoryId=F001`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
      let body = null; try { body = await r.json(); } catch {}
      return { status: r.status, body };
    }, { id: createdId });
    out.tests.push({ id: 'cleanup', name: 'cleanup created diag-1 row', result: del });
  }

  await ctx.close();
  await browser.close();

  out.finishedAt = new Date().toISOString();
  writeFileSync(join(process.cwd(), 'diag-followup.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log('done — wrote diag-followup.json');
  for (const t of out.tests) {
    console.log(`  ${t.id}: ${t.name} → ${JSON.stringify(t.result?.status || t.putStatus || t.totalRows || t.sendVsPersisted || '').slice(0, 80)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
