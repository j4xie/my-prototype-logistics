// Verify size-guard against TEST env via localhost:10011 tunnel.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const BACKEND = 'http://localhost:10011';
const FACTORY_ID = 'F001';  // test env factory
const USER = 'factory_admin1';
const PW = '123456';
const ROOT = 'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据';

const TARGETS = [
  { rel: '20260421100716739_c29cee7a081唏嘛香会员数据.xlsx', expectOK: false, label: '9MB 唏嘛香 → expect 413 friendly Chinese' },
  { rel: '川阿明万泰店6个月数据/川阿明万泰店6个月商品分类.xlsx', expectOK: true, label: '5KB 川阿明 → expect OK' },
];

function fetch(url, opts = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: opts.method || 'GET', headers: opts.headers || {},
      timeout: opts.timeout || 60000,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function main() {
  const loginRes = await fetch(`${BACKEND}/api/mobile/auth/unified-login`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: USER, password: PW}),
  });
  let tokenJson;
  try { tokenJson = JSON.parse(loginRes.body); }
  catch { console.error('login parse err:', loginRes.body.slice(0, 300)); process.exit(1); }
  const token = tokenJson.data?.accessToken || tokenJson.data?.tokens?.accessToken;
  if (!token) { console.error('no token. body:', loginRes.body.slice(0, 300)); process.exit(1); }
  console.log(`Logged in as ${USER}.\n`);

  for (const t of TARGETS) {
    const fp = path.join(ROOT, t.rel);
    if (!fs.existsSync(fp)) { console.log(`SKIP not found: ${t.rel}\n`); continue; }
    const stat = fs.statSync(fp);
    console.log(`=== ${t.label} ===`);
    console.log(`File: ${t.rel} (${(stat.size/1024/1024).toFixed(2)}MB)`);

    const buf = fs.readFileSync(fp);
    const fname = path.basename(fp);
    const boundary = '----' + Math.random().toString(36).slice(2);
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fname}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`);
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buf, tail]);

    const start = Date.now();
    let res;
    try {
      res = await fetch(`${BACKEND}/api/mobile/${FACTORY_ID}/smart-bi/upload-and-analyze`, {
        method: 'POST', headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        }, body, timeout: 30000,
      });
    } catch (e) { console.log(`  EXCEPTION: ${e.message}\n`); continue; }
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    let json = null;
    try { json = JSON.parse(res.body); } catch {}
    console.log(`  HTTP: ${res.status}, ${elapsed}s`);
    console.log(`  code=${json?.code}, success=${json?.success}`);
    console.log(`  message: ${(json?.message || '').slice(0, 200)}`);
    const isReject = (json?.message || '').includes('文件过大') || (json?.message || '').includes('AI 分析');
    if (!t.expectOK) console.log(`  ${isReject ? '✅' : '❌'} expect reject: ${isReject}`);
    else console.log(`  ${json?.code === 200 && !isReject ? '✅' : '❌'} expect OK: ${json?.code === 200}`);
    console.log('');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
