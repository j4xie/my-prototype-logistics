/**
 * D2/A 验证 — QHJ 文件跑 test env
 *
 * Env: test (139.196.165.140:8097 → 47:10011+8084)
 * Factory: F001 | account: factory_admin1 | DB: smartbi_db
 * Phases: 1 (uploads 4 files) + 2 (36 sections) + 3 (30 Qs)
 * 跳过 Phase 4 browser (slow link, 见 PHASE_4_OPTIMIZATION.md)
 */
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'fs';

const API_BASE = 'http://139.196.165.140:8097';
const PASSWORD = '123456';
const FACTORY_ID = 'F001';
const BOSS = 'factory_admin1';

const RESULTS_FILE = 'tests/e2e-comprehensive/results/e2e-qhj-testenv-d2.json';
const DATA_DIR = 'D:/Temp/qhj_data_inspect';

const UPLOADS = [
  { id: 'F2', name: '收入管理报表.xlsx', path: `${DATA_DIR}/收入管理报表.xlsx`, dataType: 'finance_revenue', headerRow: 3 },
  { id: 'F3', name: '评价Q3.xlsx', path: `${DATA_DIR}/评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx`, dataType: 'reviews', headerRow: 0 },
  { id: 'F4', name: '评价Q4.xlsx', path: `${DATA_DIR}/评价下载2025.10.01-2025.12.31_1328223_1773720937524.xlsx`, dataType: 'reviews', headerRow: 0 },
  { id: 'F1', name: '订单销售明细_10K_clean.csv', path: `${DATA_DIR}/unzipped/订单销售明细表_10K_clean.csv`, dataType: 'pos_orders', headerRow: 0 },
];

const QUESTIONS = [
  '整体看一下门店的经营情况',
  '哪家门店营业额最高？',
  '我们和川菜同行比怎么样',
  '本季度相比上季度有什么变化',
  '给我一份月度经营摘要',
  '最畅销的菜品 Top 10',
  '哪些菜品赚钱最多',
  '哪些菜是长尾 SKU 应该砍掉',
  '虾滑这个菜值不值得做',
  '爆款菜品 Top 5 是哪些',
  '本月营业额多少',
  '营业额和实收差多少, 为什么',
  '哪个时段赚钱最多',
  '工作日和周末哪个客流更多',
  '下午档 14-17 点生意怎么样',
  '成本刚性怎么样',
  '毛利率是多少',
  '食材成本占比合理吗',
  '如果减员 10% 利润影响多少',
  '哪些费用可以砍',
  '客户评分现在是多少',
  '评分下降了吗',
  '差评主要集中在什么',
  '复购客户多吗',
  '哪家店服务最好',
  '给我 3 条经营改进建议',
  '帮我写一份月报',
  '降本增效方案',
  '做个下个月销售预测',
  '给我一些营销建议',
];

const R = {
  timestamp: new Date().toISOString(),
  env: 'test',
  factory: FACTORY_ID, boss: BOSS, apiBase: API_BASE,
  uploads: [], sections: [], questions: [],
};

async function httpPost(url, data, token, timeoutMs = 60000) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const t0 = Date.now();
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data), signal: AbortSignal.timeout(timeoutMs) });
  const text = await resp.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: resp.status, body, elapsedMs: Date.now() - t0, rawText: text };
}

async function httpGet(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  return { status: resp.status, body: JSON.parse(await resp.text()) };
}

async function apiUpload(token, file) {
  const stats = statSync(file.path);
  const buf = readFileSync(file.path);
  const mime = file.name.endsWith('.csv') ? 'text/csv'
             : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), file.name);
  form.append('dataType', file.dataType);
  form.append('auto_confirm', 'true');
  form.append('headerRow', String(file.headerRow));
  const headers = { Authorization: `Bearer ${token}` };
  const t0 = Date.now();
  const timeoutMs = stats.size > 2 * 1024 * 1024 ? 900000 : 180000;
  const resp = await fetch(`${API_BASE}/api/mobile/${FACTORY_ID}/smart-bi/upload-and-analyze`, {
    method: 'POST', headers, body: form, signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await resp.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: resp.status, body, sizeKB: (stats.size/1024).toFixed(0), elapsedMs: Date.now() - t0 };
}

(async () => {
  console.log('='.repeat(70));
  console.log(`D2/A 验证 · QHJ files → test env (F001)`);
  console.log('='.repeat(70));

  const login = await httpPost(`${API_BASE}/api/mobile/auth/unified-login`, { username: BOSS, password: PASSWORD });
  const token = login.body?.data?.accessToken;
  if (!token) { console.error('Login failed:', login.body); process.exit(1); }
  console.log(`✓ login ${BOSS}`);

  // Phase 1
  console.log('\n[Phase 1/3] 上传 4 个 QHJ 文件 → F001');
  for (const f of UPLOADS) {
    if (!existsSync(f.path)) { console.log(`  ${f.id} skip (missing: ${f.path})`); continue; }
    console.log(`  ${f.id} ${f.name} ...`);
    try {
      const up = await apiUpload(token, f);
      const uploadId = up.body?.data?.uploadId || up.body?.data?.parseResult?.uploadId;
      const rowCount = up.body?.data?.parseResult?.rowCount;
      const requiresConfirmation = up.body?.data?.requiresConfirmation;
      const detectedDataType = up.body?.data?.detectedDataType;
      R.uploads.push({ id: f.id, name: f.name, sizeKB: up.sizeKB, elapsedMs: up.elapsedMs, status: up.status, rowCount, uploadId, requiresConfirmation, detectedDataType });
      console.log(`    ${up.status} in ${(up.elapsedMs/1000).toFixed(1)}s, rows=${rowCount}, reqConfirm=${requiresConfirmation}, type=${detectedDataType}, uid=${uploadId}`);
    } catch (e) {
      R.uploads.push({ id: f.id, error: e.message });
      console.log(`    ERROR: ${e.message.substring(0, 100)}`);
    }
  }

  // Phase 2
  console.log('\n[Phase 2/3] 36 restaurant sections');
  const sectionsList = await httpGet(`${API_BASE}/api/smartbi/restaurant/sections/list`, token);
  const rawSections = sectionsList.body?.sections || sectionsList.body || [];
  const names = (Array.isArray(rawSections) ? rawSections : []).map(s => typeof s === 'string' ? s : s.name).filter(Boolean);
  console.log(`  Total sections: ${names.length}`);
  for (const name of names) {
    const body = { factory_id: FACTORY_ID, sub_sector: '火锅', period: 'current',
      params: { revenue_col: '营业额', datetime_col: '开单时间', group_col: '门店名称', store_col: '门店名称' } };
    try {
      const r = await httpPost(`${API_BASE}/api/smartbi/restaurant/sections/${name}`, body, null, 45000);
      const status = r.body?.status || '?';
      R.sections.push({ name, status, httpMs: r.elapsedMs, hasChart: !!(r.body?.charts?.length || r.body?.data?.chart) });
    } catch (e) {
      R.sections.push({ name, status: 'error', error: e.message.substring(0, 80) });
    }
  }
  const okCount = R.sections.filter(s => s.status === 'ok').length;
  const skippedCount = R.sections.filter(s => s.status === 'skipped').length;
  console.log(`  ok=${okCount} / skipped=${skippedCount} / fail=${R.sections.length - okCount - skippedCount}`);

  // Phase 3
  console.log('\n[Phase 3/3] 30 老板问题');
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    try {
      const r = await httpPost(`${API_BASE}/api/mobile/${FACTORY_ID}/smart-bi/query`, { query: q }, token, 90000);
      const d = r.body?.data || {};
      const text = d.responseText || d.message || '';
      const isTemplate = text.startsWith('以下是') || text.startsWith('Query failed');
      R.questions.push({
        idx: i+1, q, status: r.status, elapsedMs: r.elapsedMs,
        intent: d.intent || d.intentCode,
        chartCount: (d.charts || []).length,
        textLen: text.length, isTemplate,
      });
      console.log(`  Q${i+1}: ${r.elapsedMs}ms intent=${d.intent||d.intentCode} charts=${(d.charts||[]).length} tmpl=${isTemplate}`);
    } catch (e) {
      R.questions.push({ idx: i+1, q, error: e.message.substring(0, 80) });
      console.log(`  Q${i+1}: ERROR ${e.message.substring(0, 60)}`);
    }
  }

  // Summary
  const uploadsOk = R.uploads.filter(u => u.status === 200).length;
  const questionsOk = R.questions.filter(q => q.status === 200).length;
  const qReal = R.questions.filter(q => !q.isTemplate && q.textLen > 50).length;
  const qCharts = R.questions.filter(q => q.chartCount > 0).length;
  R.summary = {
    uploads: `${uploadsOk}/${R.uploads.length}`,
    sections: `${okCount}/${names.length} ok, ${skippedCount} skipped`,
    questions: `${qReal}/${questionsOk} real, ${qCharts} charts, ${R.questions.filter(q=>q.isTemplate).length} template`,
  };
  writeFileSync(RESULTS_FILE, JSON.stringify(R, null, 2));
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY (test env F001):`);
  console.log(`  Uploads:   ${R.summary.uploads}`);
  console.log(`  Sections:  ${R.summary.sections}`);
  console.log(`  Questions: ${R.summary.questions}`);
  console.log(`  Results:   ${RESULTS_FILE}`);
})();
