/**
 * D0 v2 (Apr 17 2026): 真实餐饮连锁数据字段分类矩阵 — test env via vhost 8097
 *
 * 变化:
 *  - TEST_API localhost:10011 → 139:8097 (无需 SSH tunnel)
 *  - psql target smartbi_db → smartbi_prod_db (test Python .env 写这里)
 *  - 13 files upload + field defs query + misclass detection
 */
import { readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const TEST_API = 'http://139.196.165.140:8097';
const FACTORY_ID = 'F001';
const USER = 'factory_admin1';
const PASS = '123456';
const BACKEND_SSH = 'root@47.100.235.168';
const DATA_ROOT = 'C:/Users/Steve/my-prototype-logistics/smartbi维度分析/大众点评/真实餐饮连锁数据';
const OUT_DIR = 'tests/e2e-comprehensive/results/d0-classification-v2';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const FILES = [
  { path: 'xlsx_converted/IL TEATRO（西餐厅）2月_商品销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-西餐' },
  { path: 'xlsx_converted/上马火锅（火锅）2月商品销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-火锅' },
  { path: 'xlsx_converted/唏嘛香（牛肉面）2月销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-牛肉面' },
  { path: 'xlsx_converted/御九井（日料）2月_商品销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-日料' },
  { path: 'xlsx_converted/永和豆浆（快餐）2月_商品销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-快餐' },
  { path: 'xlsx_converted/馨厨香_商品销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-馨厨香' },
  { path: 'xlsx/东门口2月商品销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-东门口' },
  { path: 'xlsx/东门口2月采购入库明细报表.xlsx', dataType: null, category: '采购入库' },
  { path: 'xlsx/青花椒2月销量报表.xlsx', dataType: 'pos_sales_summary', category: '销量报表-青花椒' },
  { path: '青花椒/收入管理报表.xlsx', dataType: 'finance_revenue', category: '财务-收入' },
  { path: '青花椒/评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx', dataType: 'reviews', category: '评价-Q3' },
  { path: '青花椒/评价下载2025.10.01-2025.12.31_1328223_1773720937524.xlsx', dataType: 'reviews', category: '评价-Q4' },
  { path: '青花椒/青花椒2约销量报表.csv', dataType: 'pos_sales_summary', category: '销量报表-CSV' },
];

function psql(sql) {
  // smartbi_prod_db because test Python .env POSTGRES_DB=smartbi_prod_db
  // Write SQL to temp file on server to avoid Git Bash quoting hell with `||` / COALESCE
  const b64 = Buffer.from(sql).toString('base64');
  const cmd = `ssh -o StrictHostKeyChecking=no ${BACKEND_SSH} "echo '${b64}' | base64 -d > /tmp/d0_query.sql && sudo -u postgres psql -d smartbi_prod_db -t -A -f /tmp/d0_query.sql"`;
  try { return execSync(cmd, { encoding: 'utf8', timeout: 20000 }).trim(); }
  catch (e) { return ''; }
}
const DELIM = '::';

async function login() {
  const r = await fetch(`${TEST_API}/api/mobile/auth/unified-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const j = await r.json();
  if (!j.success) throw new Error('login failed: ' + JSON.stringify(j));
  return j.data.accessToken;
}

async function upload(token, fileInfo) {
  const fullPath = `${DATA_ROOT}/${fileInfo.path}`;
  if (!existsSync(fullPath)) return { skipped: 'file not found: ' + fullPath };
  const stats = statSync(fullPath);
  const buf = readFileSync(fullPath);
  const fname = fileInfo.path.split('/').pop();
  const mime = fname.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), fname);
  if (fileInfo.dataType) form.append('dataType', fileInfo.dataType);
  form.append('auto_confirm', 'true');
  form.append('headerRow', '0');
  const t0 = Date.now();
  const timeoutMs = stats.size > 2 * 1024 * 1024 ? 600000 : 180000;
  const r = await fetch(`${TEST_API}/api/mobile/${FACTORY_ID}/smart-bi/upload-and-analyze`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: form, signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text.substring(0, 500); }
  return {
    sizeKB: (stats.size/1024).toFixed(0),
    httpStatus: r.status,
    elapsedMs: Date.now() - t0,
    uploadId: body?.data?.uploadId || body?.data?.parseResult?.uploadId,
    rowCount: body?.data?.parseResult?.rowCount,
    detectedType: body?.data?.detectedDataType,
    reqConfirm: body?.data?.requiresConfirmation,
    mappingCount: body?.data?.parseResult?.fieldMappings?.length,
  };
}

function getFieldDefs(uploadId) {
  if (!uploadId) return [];
  const out = psql(
    `SELECT original_name || '${DELIM}' || COALESCE(standard_name,'') || '${DELIM}' || is_measure || '${DELIM}' || is_dimension || '${DELIM}' || is_time || '${DELIM}' || COALESCE(field_type,'') FROM smart_bi_pg_field_definitions WHERE upload_id=${uploadId} ORDER BY display_order`
  );
  return out.split('\n').filter(Boolean).map(line => {
    const [original, standard, m, d, t, ft] = line.split(DELIM);
    return { original, standard, is_measure: m === 'true' || m === 't', is_dimension: d === 'true' || d === 't', is_time: t === 'true' || t === 't', field_type: ft };
  });
}

function detectIssues(fields) {
  const issues = [];
  for (const f of fields) {
    if (f.is_dimension && /数量|金额|销量|营业额|营业|销售额|实收|应收|人次|客流|票数|件数|总量/.test(f.original)) {
      issues.push({ field: f.original, issue: '含数量/金额词但分为 dimension', should_be: 'measure' });
    }
    if (f.is_measure && /名称|分类|类型|编码|编号|组别|分组|渠道/.test(f.original)) {
      issues.push({ field: f.original, issue: '分类/名称但分为 measure', should_be: 'dimension' });
    }
    if (!f.is_time && /日期|时间|月份|年份|季度|开单|下单|业务日期|交易时间/.test(f.original)) {
      issues.push({ field: f.original, issue: '含时间词但未标 is_time', should_be: 'time' });
    }
    if (/^Unnamed/i.test(f.original)) {
      issues.push({ field: f.original, issue: '匿名列', should_be: 'skip' });
    }
  }
  return issues;
}

(async () => {
  console.log('='.repeat(70));
  console.log('D0 v2 字段分类矩阵 · TEST env 139:8097 · ' + FILES.length + ' files');
  console.log('='.repeat(70));
  const token = await login();
  console.log('✓ login', USER);

  const report = { timestamp: new Date().toISOString(), test_env: TEST_API, factory: FACTORY_ID, files: [] };

  for (const f of FILES) {
    console.log(`\n[${f.category}] ${f.path.split('/').pop()}`);
    try {
      const up = await upload(token, f);
      if (up.skipped) { console.log('  SKIP:', up.skipped); report.files.push({ ...f, result: 'skipped', reason: up.skipped }); continue; }
      console.log(`  ${up.httpStatus} ${(up.elapsedMs/1000).toFixed(1)}s rows=${up.rowCount} type=${up.detectedType} id=${up.uploadId}`);
      if (up.httpStatus !== 200 || !up.uploadId) {
        report.files.push({ ...f, result: 'fail', upload: up });
        continue;
      }
      const defs = getFieldDefs(up.uploadId);
      const stats = {
        total: defs.length,
        measures: defs.filter(x => x.is_measure).length,
        dimensions: defs.filter(x => x.is_dimension).length,
        times: defs.filter(x => x.is_time).length,
        unnamed: defs.filter(x => /^Unnamed/i.test(x.original)).length,
      };
      const issues = detectIssues(defs);
      console.log(`  fields total=${stats.total} m=${stats.measures} d=${stats.dimensions} t=${stats.times} unnamed=${stats.unnamed} issues=${issues.length}`);
      if (issues.length > 0) issues.slice(0, 3).forEach(i => console.log(`    - ${i.field}: ${i.issue} → ${i.should_be}`));
      report.files.push({ ...f, result: 'ok', upload: { id: up.uploadId, rows: up.rowCount, ms: up.elapsedMs, sizeKB: up.sizeKB }, stats, issues, fields: defs });
    } catch (e) {
      console.log('  ERR:', e.message.substring(0, 100));
      report.files.push({ ...f, result: 'error', error: e.message.substring(0, 200) });
    }
  }

  const ok = report.files.filter(x => x.result === 'ok');
  const totalIssues = ok.reduce((s, x) => s + (x.issues?.length || 0), 0);
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${ok.length}/${FILES.length} ok, ${totalIssues} misclass issues`);
  ok.forEach(x => console.log(`  ${x.category.padEnd(22)} total=${x.stats.total} m=${x.stats.measures} d=${x.stats.dimensions} t=${x.stats.times} issues=${x.issues.length}`));

  writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${OUT_DIR}/report.json`);
})();
