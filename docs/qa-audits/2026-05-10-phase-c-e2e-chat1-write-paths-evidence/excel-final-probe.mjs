// Final probe: capture uploadAndAnalyze response body → get uploadId → direct fetch /uploads/{id}/data + /uploads/{id}/fields.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/playwright');
const XLSX = require('C:/Users/Steve/my-prototype-logistics/web-admin/node_modules/xlsx');

const URL = 'http://139.196.165.140:8097';
const RUN = 'EP' + randomBytes(2).toString('hex').toUpperCase();
const EVIDENCE = process.cwd();

function synthSalesXlsx() {
  const rows = [
    ['日期','客户名称','产品名称','数量','金额'],
    ['2026-01-05',`客户A-${RUN}`,'清酒200ml',100,2500.00],
    ['2026-01-12',`客户B-${RUN}`,'酱油1L',80,1600.00],
    ['2026-02-03',`客户A-${RUN}`,'调味料500g',60,1500.00],
    ['2026-02-14',`客户B-${RUN}`,'酱油1L',90,1800.00],
    ['2026-03-12',`客户A-${RUN}`,'调味料500g',75,1875.00],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '销售数据');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

async function main() {
  console.log(`[EP] starting RUN=${RUN}`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // capture uploadAndAnalyze response body
  let captured = null;
  page.on('response', async (resp) => {
    if (resp.url().includes('/upload-and-analyze') && resp.status() === 200) {
      try { captured = { url: resp.url(), body: await resp.json() }; }
      catch (e) { captured = { url: resp.url(), parseErr: e.message }; }
    }
  });

  // login
  await page.goto(`${URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  await (await page.$$('input[type="text"]'))[0].fill('factory_admin1');
  await (await page.$('input[type="password"]')).fill('123456');
  await (await page.$('.login-button, button:has-text("登 录"), button:has-text("登录")')).click();
  await page.waitForFunction(() => !!localStorage.getItem('cretas_access_token'), { timeout: 15000 });
  await page.waitForTimeout(1500);

  // upload
  await page.goto(`${URL}/smart-bi/upload`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const buf = synthSalesXlsx();
  const fi = await page.$('input[type="file"]');
  await fi.setInputFiles({
    name: `final-${RUN}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buf,
  });
  await page.waitForTimeout(15000);

  const uploadId = captured?.body?.data?.uploadId
    || captured?.body?.data?.upload_id
    || captured?.body?.uploadId
    || captured?.body?.data?.id;

  // probe /uploads list one more time
  const listResp = await page.evaluate(async () => {
    const t = localStorage.getItem('cretas_access_token');
    const r = await fetch('/api/mobile/F001/smart-bi/uploads?page=0&size=50', { headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' } });
    let body = null; try { body = await r.json(); } catch {}
    return { status: r.status, body };
  });

  // probe /uploads/{id}/data + /uploads/{id}/fields IF we got uploadId
  let dataResp = null, fieldsResp = null;
  if (uploadId) {
    dataResp = await page.evaluate(async (id) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/F001/smart-bi/uploads/${id}/data?page=0&size=20`, { headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' } });
      let body = null; try { body = await r.json(); } catch {}
      return { status: r.status, body };
    }, uploadId);
    fieldsResp = await page.evaluate(async (id) => {
      const t = localStorage.getItem('cretas_access_token');
      const r = await fetch(`/api/mobile/F001/smart-bi/uploads/${id}/fields`, { headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' } });
      let body = null; try { body = await r.json(); } catch {}
      return { status: r.status, body };
    }, uploadId);
  }

  await ctx.close();
  await browser.close();

  const out = {
    run: RUN,
    uploadAndAnalyzeCaptured: {
      url: captured?.url,
      success: captured?.body?.success,
      message: captured?.body?.message,
      dataKeys: captured?.body?.data ? Object.keys(captured.body.data) : null,
      uploadIdFound: uploadId,
      analysisHasInsights: !!(captured?.body?.data?.analysis || captured?.body?.data?.aiInsights),
      requiresConfirmation: captured?.body?.data?.requiresConfirmation,
      parseResultRowCount: captured?.body?.data?.parseResult?.row_count,
      parseResultHeaders: captured?.body?.data?.parseResult?.headers,
      parseResultPreviewSample: captured?.body?.data?.parseResult?.preview_data?.slice(0, 2),
      tableType: captured?.body?.data?.parseResult?.table_type,
      sheetName: captured?.body?.data?.parseResult?.sheet_name,
    },
    uploadsListAfter: {
      status: listResp.status,
      bodyShape: listResp.body ? Object.keys(listResp.body) : null,
      dataIsNull: listResp.body?.data === null,
      dataIsArray: Array.isArray(listResp.body?.data),
      dataIsObject: listResp.body?.data && typeof listResp.body.data === 'object' && !Array.isArray(listResp.body.data),
      dataKeys: listResp.body?.data && typeof listResp.body.data === 'object' ? Object.keys(listResp.body.data) : null,
      contentLen: Array.isArray(listResp.body?.data?.content) ? listResp.body.data.content.length : null,
    },
    uploadDataFetch: dataResp ? {
      status: dataResp.status,
      bodyKeys: dataResp.body ? Object.keys(dataResp.body) : null,
      dataShape: dataResp.body?.data ? Object.keys(dataResp.body.data) : null,
      rowCount: dataResp.body?.data?.totalRows || dataResp.body?.data?.totalElements,
      sampleRows: dataResp.body?.data?.rows?.slice(0, 3) || dataResp.body?.data?.content?.slice(0, 3),
    } : 'no uploadId — could not fetch',
    fieldsFetch: fieldsResp ? {
      status: fieldsResp.status,
      bodyKeys: fieldsResp.body ? Object.keys(fieldsResp.body) : null,
      fieldsCount: Array.isArray(fieldsResp.body?.data) ? fieldsResp.body.data.length : null,
      sampleFields: Array.isArray(fieldsResp.body?.data) ? fieldsResp.body.data.slice(0, 5) : null,
    } : 'no uploadId',
  };

  writeFileSync(join(EVIDENCE, 'excel-final-probe.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log('done — wrote excel-final-probe.json');
  console.log(`  uploadId=${uploadId}, listAfter status=${listResp.status} contentLen=${out.uploadsListAfter.contentLen}`);
  console.log(`  data fetch=${dataResp?.status} fields fetch=${fieldsResp?.status}`);
}

main().catch(e => { console.error(e); process.exit(1); });
