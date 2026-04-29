// Serial re-test of FAIL list from bulk-audit v4 (parallel pool).
// Goal: separate real parser bugs from parallel-load false-positives.
// Each file gets 150s timeout, serial execution.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const BASE_URL = 'http://139.196.165.140:8086';
const ROOT = 'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据';
const FACTORY_ID = 'RES_3101_009';
const USER = 'qhj_prod';
const PW = '123456';

// 46 files that FAIL'd in v4 parallel run. Subpath relative to ROOT.
const FAIL_LIST = [
  '20260421100716739_c29cee7a081唏嘛香会员数据.xlsx',
  '川阿明万泰店6个月数据/川阿明万泰店6个月商品分类.xlsx',
  '川阿明万泰店6个月数据/川阿明万泰店6个月整体打折.xlsx',
  '川阿明万泰店6个月数据/川阿明万泰店6个月营业数据.xlsx',
  '川阿明舟山店6个月数据/川阿明舟山店6个月商品分类.xlsx',
  '川阿明金义店6个月数据/川阿明金义店6个月商品分类统计.xlsx',
  '川阿明金义店6个月数据/川阿明金义店6个月整体打折.xlsx',
  '川阿明金义店6个月数据/川阿明金义店6个月营业数据.xlsx',
  '川阿明舟山店6个月数据/川阿明舟山店6个月营业数据.xlsx',
  '川阿明舟山店6个月数据/川阿明舟山店6个月整体打折.xlsx',
  '桂满陇2月_桂满陇传菜统计报表/20260422100628275_50366d522e1_桂满陇传菜统计报表.csv',
  '桂满陇2月_营业概况报表（兼容月报表）/20260422100050052_ec62cc005a1_营业概况报表（兼容月报表）.xlsx',
  '桂满陇2月_商品销量报表/20260422100942814_caa2b475591_商品销量报表.csv',
  '桂满陇3月_营业概况报表（兼容月报表）/20260422100251341_324e5e89071_营业概况报表（兼容月报表）.xlsx',
  '森二娘数据6个月/森二娘整体打折6个月.xlsx',
  '江南良灶盘古路店数据6个月/江南良灶盘古路店分类统计6个月.xlsx',
  '森二娘数据6个月/森二娘营业数据6个月.xlsx',
  '永和豆浆（快餐）2月_商品销量报表.xls',
  '江南良灶盘古路店数据6个月/江南良灶盘古路店营业数据6个月.xlsx',
  '潮辣6个月数据/潮辣6个月商品分类统计.xlsx',
  '潮辣滑县数据6个月/潮辣滑县分类统计6个月.xlsx',
  '潮辣滑县数据6个月/潮辣滑县整体打折6个月.xlsx',
  '潮辣滑县数据6个月/潮辣滑县营业数据6个月.xlsx',
  '火锅2月利润表.xls',
  '潮辣6个月数据/潮辣6个月整体打折.xlsx',
  '桂满陇1月_商品销量报表/20260422101011427_d10510a4a31_商品销量报表.csv',
  '阿明小菜6个月数据/阿明小菜6个月营业报表.xlsx',
  '钱塘数据/钱塘4店3月_详细日报表.xls',
  '阿明小菜6个月数据/阿明小菜整体打折报表6个月数据.xlsx',
  '青花椒/收入管理报表.xlsx',
  '钱塘数据/钱塘4店3月_营业概况报表（兼容月报表）.xls',
  '钱塘数据/钱塘_卡消费排行.xls',
  '潮辣6个月数据/潮辣6个月营业数据.xlsx',
  '阿明小菜6个月数据/阿明小菜商品分类统计6个月.xlsx',
  '韩老幺6个月数据/韩老幺6个月商品分类.xlsx',
  '韩老幺6个月数据/韩老幺6个月整体打折.xlsx',
  '韩老幺6个月数据/韩老幺6个月营业数据.xlsx',
  '馨厨香6个月数据/馨厨香6个月商品分类统计.xlsx',
  '馨厨香6个月数据/馨厨香6个月整体打折.xlsx',
  '馨厨香6个月数据/馨厨香6个月营业报表.xlsx',
  '青花椒/青花椒2约销量报表.csv',
];

// Mojibake .xls files in 庭宴数据1-3月 — fs can read them with literal mojibake names
const MOJIBAKE = [
  '庭宴数据1-3月/1-3╘┬_╔╠╞╖╧·┴┐▒¿▒φ.xls',
  '庭宴数据1-3月/1-3╘┬_╙¬╥╡╕┼┐÷▒¿▒φú¿╝µ╚▌╘┬▒¿▒φú⌐.xls',
  '庭宴数据1-3月/1-3╘┬_╖┤╜ß╒╦╝░╞▒╛▌▓╣┤≥▒¿▒φ.xls',
  '庭宴数据1-3月/1-3╘┬_╕╢┐ε╖╜╩╜▒¿▒φ.xls',
  '庭宴数据1-3月/1-3╘┬_╘∙╞╖▒¿▒φ.xls',
];
const ALL_FAIL = [...FAIL_LIST, ...MOJIBAKE];

function fetch(url, opts = {}) {
  const u = new URL(url);
  const reqOpts = {
    hostname: u.hostname,
    port: u.port,
    path: u.pathname + u.search,
    method: opts.method || 'GET',
    headers: opts.headers || {},
    timeout: opts.timeout || 150000,
  };
  return new Promise((resolve, reject) => {
    const req = http.request(reqOpts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('upload timeout 150s')); });
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
  const j = JSON.parse(res.body);
  return j.data?.accessToken || j.data?.tokens?.accessToken || j.data?.token;
}

async function uploadOne(filePath, token) {
  const stat = fs.statSync(filePath);
  const buf = fs.readFileSync(filePath);
  const fname = path.basename(filePath);
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
      timeout: 150000,
    }
  );
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* not json */ }
  return { httpStatus: res.status, json, raw: res.body.slice(0, 500), fileSize: stat.size };
}

async function main() {
  console.log(`Re-testing ${ALL_FAIL.length} FAIL files SERIALLY (150s timeout)\n`);
  const token = await login();
  console.log(`Logged in (token: ${token.slice(0, 20)}...)\n`);

  const results = [];
  for (let i = 0; i < ALL_FAIL.length; i++) {
    const rel = ALL_FAIL[i];
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) {
      console.log(`[${i+1}/${ALL_FAIL.length}] ${rel}: FILE_NOT_FOUND`);
      results.push({ rel, status: 'FILE_NOT_FOUND' });
      continue;
    }
    const start = Date.now();
    let entry;
    try {
      const r = await uploadOne(fp, token);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const top = r.json?.data || {};
      const pr = top.parseResult || {};
      const detectedRows = pr.rowCount ?? top.rowCount ?? null;
      const detectedCols = pr.columnCount ?? top.columnCount ?? (pr.headers?.length ?? null);
      const tableType = pr.detectedTableType ?? top.detectedTableType ?? null;
      const status = r.httpStatus === 200 && r.json?.code === 200 && pr.success !== false ? 'OK' : 'FAIL';
      const errMsg = status === 'FAIL'
        ? (r.json?.message || pr.errorMessage || pr.message || r.raw.slice(0, 200))
        : null;
      entry = { rel, status, httpStatus: r.httpStatus, fileSize: r.fileSize,
        rows: detectedRows, cols: detectedCols, tableType, elapsed,
        errMsg };
      console.log(`[${i+1}/${ALL_FAIL.length}] ${rel}: ${status} (${(r.fileSize/1024).toFixed(0)}KB, ${elapsed}s${detectedRows ? `, ${detectedRows}行×${detectedCols}列` : ''}${errMsg ? `, err=${errMsg.slice(0,80)}` : ''})`);
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      entry = { rel, status: 'EXCEPTION', error: e.message, elapsed };
      console.log(`[${i+1}/${ALL_FAIL.length}] ${rel}: EXCEPTION (${elapsed}s): ${e.message}`);
    }
    results.push(entry);
  }

  // Summary
  console.log('\n=== RETEST SUMMARY ===');
  const ok = results.filter(r => r.status === 'OK');
  const fail = results.filter(r => r.status === 'FAIL');
  const exc = results.filter(r => r.status === 'EXCEPTION' || r.status === 'FILE_NOT_FOUND');
  console.log(`OK on retest: ${ok.length}/${results.length} (parallel false-positives — server-side overload)`);
  console.log(`Still FAIL: ${fail.length}/${results.length} (likely real parser issues)`);
  console.log(`EXCEPTION/NOT_FOUND: ${exc.length}/${results.length}`);

  if (fail.length) {
    console.log('\n=== STILL FAIL (Real bugs) ===');
    fail.forEach(r => {
      console.log(`  ${r.rel}: ${r.errMsg ?? '-'}`);
    });
  }
  if (exc.length) {
    console.log('\n=== EXCEPTION ===');
    exc.forEach(r => console.log(`  ${r.rel}: ${r.error ?? r.status}`));
  }

  const outPath = path.join(ROOT, '..', '..', '..', 'tests/e2e-comprehensive/results/bulk-audit-retest.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
