// Upload primary xlsx per merchant via /smart-bi/upload-and-analyze (auto_confirm=true).
// Produces uploadId per merchant for subsequent Dashboard/Finance evaluation.
import fs from 'fs';
import path from 'path';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-merchant-upload-batch';
fs.mkdirSync(OUT, { recursive: true });

const DATA_ROOT = 'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据';

// Per-merchant upload plan: pick 1 primary file that represents sales/营业 data
const MERCHANTS = [
  { username: 'guimanlong_admin',  factoryId: 'R_GML', name: '桂满陇',    file: '桂满陇1月_商品销量报表/20260422101011427_d10510a4a31_商品销量报表.csv', type: 'csv' },
  { username: 'ximaxiang_admin',   factoryId: 'R_XMX', name: '唏嘛香',    file: 'xlsx_converted/唏嘛香（牛肉面）2月销量报表.xlsx', type: 'xlsx' },
  { username: 'ilteatro_admin',    factoryId: 'R_ITE', name: 'IL TEATRO', file: 'xlsx_converted/IL TEATRO（西餐厅）2月_商品销量报表.xlsx', type: 'xlsx' },
  { username: 'shangma_admin',     factoryId: 'R_SMH', name: '上马火锅',  file: 'xlsx_converted/上马火锅（火锅）2月商品销量报表.xlsx', type: 'xlsx' },
  { username: 'yujiujing_admin',   factoryId: 'R_YJJ', name: '御九井',    file: 'xlsx_converted/御九井（日料）2月_商品销量报表.xlsx', type: 'xlsx' },
  { username: 'buerjun_admin',     factoryId: 'R_BEJ', name: '不二君',    file: '不二君6个月数据/不二君6个月营业数据.xlsx', type: 'xlsx' },
];

async function login(username, password = '123456', maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    const resp = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const j = await resp.json();
    if (j.success) return j.data.token;
    if (j.code === 429) {
      console.log(`  [${username}] rate-limited, waiting 60s...`);
      await new Promise(r => setTimeout(r, 62000));
      continue;
    }
    throw new Error(`Login ${username} failed: ${j.message}`);
  }
  throw new Error(`Login ${username} failed after ${maxRetries} retries`);
}

async function uploadFile(token, factoryId, filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);
  formData.append('auto_confirm', 'true');

  const resp = await fetch(`${BASE}/api/mobile/${factoryId}/smart-bi/upload-and-analyze`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  const body = await resp.json();
  return { status: resp.status, body };
}

const results = { base: BASE, ts: new Date().toISOString(), merchants: [] };

for (const m of MERCHANTS) {
  console.log(`\n=== ${m.name} (${m.factoryId}) ===`);
  const filePath = path.join(DATA_ROOT, m.file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ File not found: ${m.file}`);
    results.merchants.push({ ...m, error: 'file_not_found' });
    continue;
  }
  const fileSize = fs.statSync(filePath).size;
  console.log(`  File: ${m.file} (${Math.round(fileSize / 1024)} KB)`);

  try {
    const token = await login(m.username);
    console.log(`  ✅ Login: token acquired`);
    const fileName = path.basename(m.file);
    const up = await uploadFile(token, m.factoryId, filePath, fileName);
    const upload = up.body?.data?.uploadId || up.body?.data?.upload?.id || up.body?.data?.upload_id;
    const success = up.body?.success || up.status === 200;
    console.log(`  ${success ? '✅' : '❌'} Upload: status=${up.status} uploadId=${upload} msg="${(up.body?.message || '').slice(0, 80)}"`);
    results.merchants.push({
      ...m, fileSize, uploadStatus: up.status, uploadId: upload,
      message: up.body?.message?.slice(0, 120),
      dataKeys: up.body?.data ? Object.keys(up.body.data) : [],
      success,
    });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    results.merchants.push({ ...m, error: e.message });
  }

  // Small spacing between uploads to avoid rate limit
  await new Promise(r => setTimeout(r, 3000));
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const ok = results.merchants.filter(r => r.success).length;
console.log(`\n========== SUMMARY ==========`);
console.log(`  ${ok}/${MERCHANTS.length} merchants uploaded successfully`);
for (const m of results.merchants) {
  console.log(`  ${m.success ? '✅' : '❌'} ${m.name.padEnd(10)} uploadId=${m.uploadId || '-'} status=${m.uploadStatus || m.error}`);
}
