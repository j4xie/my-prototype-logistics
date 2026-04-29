// Single-file isolated test for parser quality verification.
// Usage: node bulk-audit-single.mjs <relativeFilePath>

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const BASE_URL = 'http://139.196.165.140:8086';
const ROOT = 'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据';
const FACTORY_ID = 'RES_3101_009';
const USER = 'qhj_prod';
const PW = '123456';
const TIMEOUT_MS = 120000;

const target = process.argv[2];
if (!target) {
  console.error('Usage: node bulk-audit-single.mjs <relativeFilePath>');
  process.exit(1);
}

function fetch(url, opts = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: opts.method || 'GET', headers: opts.headers || {},
      timeout: opts.timeout || TIMEOUT_MS,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`timeout ${TIMEOUT_MS/1000}s`)));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function main() {
  const fp = path.join(ROOT, target);
  if (!fs.existsSync(fp)) { console.error('NOT FOUND:', fp); process.exit(1); }
  const stat = fs.statSync(fp);
  console.log(`Testing: ${target} (${(stat.size/1024).toFixed(1)}KB)\n`);

  const loginRes = await fetch(`${BASE_URL}/api/mobile/auth/unified-login`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: USER, password: PW}),
  });
  const token = JSON.parse(loginRes.body).data?.accessToken;
  console.log(`Logged in.\n`);

  const buf = fs.readFileSync(fp);
  const fname = path.basename(fp);
  const boundary = '----' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fname}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buf, tail]);

  const start = Date.now();
  const res = await fetch(
    `${BASE_URL}/api/mobile/${FACTORY_ID}/smart-bi/upload-and-analyze`,
    { method: 'POST', headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }, body, timeout: TIMEOUT_MS,
    });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`HTTP: ${res.status}, ${elapsed}s\n`);

  let json = null;
  try { json = JSON.parse(res.body); }
  catch { console.log('Raw body:', res.body.slice(0, 800)); return; }

  // Pretty-print parser detail
  const top = json.data || {};
  const pr = top.parseResult || {};
  console.log(`success: ${json.code === 200 && pr.success !== false}`);
  console.log(`message: ${json.message}`);
  console.log(`---PARSE RESULT---`);
  console.log(`detectedTableType: ${pr.detectedTableType ?? top.detectedTableType ?? '-'}`);
  console.log(`rowCount: ${pr.rowCount ?? top.rowCount ?? '-'}`);
  console.log(`columnCount: ${pr.columnCount ?? top.columnCount ?? '-'}`);
  console.log(`headers (count=${(pr.headers||[]).length}):`);
  (pr.headers || []).slice(0, 30).forEach((h, i) => console.log(`  [${i}] ${h}`));
  if (pr.fieldMappings) {
    console.log(`fieldMappings (count=${pr.fieldMappings.length}):`);
    pr.fieldMappings.slice(0, 30).forEach((fm, i) =>
      console.log(`  [${i}] ${fm.originalName} → ${fm.canonicalName ?? '(?)'} type=${fm.fieldType ?? '?'} dim=${fm.isDimension ?? '?'}`));
  }
  if (pr.errorMessage || pr.message) {
    console.log(`errorMessage: ${pr.errorMessage || pr.message}`);
  }
  // sample of preview
  if (pr.previewRows) {
    console.log(`previewRows (showing 3):`);
    pr.previewRows.slice(0, 3).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r).slice(0, 300)));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
