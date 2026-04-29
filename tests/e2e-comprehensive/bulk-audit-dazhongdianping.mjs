// Bulk upload audit for 大众点评 真实餐饮连锁数据 directory.
// Goal: surface field-recognition / parse-failure issues across diverse real customer files.
// Uses Java backend's /api/mobile/{factoryId}/smartbi/uploads endpoint via JWT.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';

const BASE_URL = 'http://139.196.165.140:8086';
const ROOT = 'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据';
const FACTORY_ID = 'RES_3101_009';
const USER = 'qhj_prod';
const PW = '123456';

// Skip xlsx_converted (dup of original .xls). Apr 28 2026: include 桂满陇 dirs
// added by user in 2nd batch.
const SKIP_DIRS = ['xlsx_converted'];

function listFiles(dir, depth = 0) {
  if (depth > 2) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.some(s => name.includes(s))) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full, depth + 1));
    else if (/\.(xlsx|xls|csv)$/i.test(name)) out.push(full);
  }
  return out;
}

const TIMEOUT_MS = 180_000; // 3 min per file

async function fetch(url, opts = {}) {
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;
  const reqOpts = {
    hostname: u.hostname,
    port: u.port,
    path: u.pathname + u.search,
    method: opts.method || 'GET',
    headers: opts.headers || {},
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(reqOpts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`timeout after ${TIMEOUT_MS / 1000}s`));
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PW }),
  });
  let j;
  try { j = JSON.parse(res.body); }
  catch { throw new Error(`login non-JSON (status ${res.status}): ${res.body.slice(0, 200)}`); }
  if (!j.success) throw new Error(`login failed: ${res.body.slice(0, 200)}`);
  return j.data?.accessToken || j.data?.tokens?.accessToken || j.data?.token;
}

async function uploadOne(filePath, token) {
  const buf = fs.readFileSync(filePath);
  const fname = path.basename(filePath);
  // Build multipart manually
  const boundary = '----' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fname}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, buf, tail]);
  const res = await fetch(
    `${BASE_URL}/api/mobile/${FACTORY_ID}/smart-bi/upload-and-analyze`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    }
  );
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* not json */ }
  return { httpStatus: res.status, json, raw: res.body.slice(0, 500) };
}

async function main() {
  const files = listFiles(ROOT);
  console.log(`Found ${files.length} files in ${ROOT}\n`);
  const token = await login();
  console.log(`Logged in (token: ${token.slice(0, 20)}...)\n`);

  // Apr 28 2026: parallel upload pool (CONCURRENCY=6) to amortize LLM
  // structure-detector latency. Single-file ~30s × 154 files = 80 min serial.
  // 6 parallel × 30s avg = ~13 min. DeepSeek rate limit handles this fine.
  const CONCURRENCY = 6;
  const results = [];
  let processed = 0;
  async function worker(idx) {
    const f = files[idx];
    const rel = path.relative(ROOT, f);
    let entry;
    try {
      const r = await uploadOne(f, token);
      const top = r.json?.data || {};
      const pr = top.parseResult || {};
      const detectedRows = pr.rowCount ?? top.rowCount ?? null;
      const detectedCols = pr.columnCount ?? top.columnCount ?? (pr.headers?.length ?? null);
      const tableType = pr.detectedTableType ?? top.detectedTableType ?? null;
      const fieldCount = (pr.fieldMappings || top.fieldMappings || pr.headers || []).length;
      const status = r.httpStatus === 200 && r.json?.code === 200 && pr.success !== false ? 'OK' : 'FAIL';
      entry = { rel, status, httpStatus: r.httpStatus,
        rows: detectedRows, cols: detectedCols, tableType,
        fieldCount, message: r.json?.message || r.raw.slice(0, 150),
      };
      processed++;
      console.log(`[${processed}/${files.length}] ${rel}: ${status} (${detectedRows ?? '?'}行 × ${detectedCols ?? '?'}列, ${tableType ?? '-'})`);
    } catch (e) {
      entry = { rel, status: 'EXCEPTION', error: e.message };
      processed++;
      console.log(`[${processed}/${files.length}] ${rel}: EXCEPTION: ${e.message}`);
    }
    results[idx] = entry;
  }
  let nextIdx = 0;
  async function pool() {
    while (nextIdx < files.length) {
      const myIdx = nextIdx++;
      await worker(myIdx);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => pool()));

  // Summary
  console.log('\n=== SUMMARY ===');
  const ok = results.filter(r => r.status === 'OK');
  const fail = results.filter(r => r.status === 'FAIL');
  const exc = results.filter(r => r.status === 'EXCEPTION');
  console.log(`OK: ${ok.length}/${results.length}`);
  console.log(`FAIL: ${fail.length}`);
  console.log(`EXCEPTION: ${exc.length}`);

  if (fail.length || exc.length) {
    console.log('\n=== FAILURES ===');
    [...fail, ...exc].forEach(r => {
      console.log(`  ${r.rel}: ${r.status} (${r.httpStatus ?? '-'}) - ${r.message ?? r.error}`);
    });
  }

  // Suspicious cases
  const suspicious = ok.filter(r =>
    r.rows === 0 || r.cols === 0 || r.fieldCount === 0
  );
  if (suspicious.length) {
    console.log('\n=== SUSPICIOUS (parsed but 0 rows/cols/fields) ===');
    suspicious.forEach(r => {
      console.log(`  ${r.rel}: ${r.rows}行 × ${r.cols}列 × ${r.fieldCount}fields`);
    });
  }

  // Save full results JSON
  const outPath = path.join(ROOT, '..', '..', '..', 'tests/e2e-comprehensive/results/bulk-audit-dazhongdianping.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
