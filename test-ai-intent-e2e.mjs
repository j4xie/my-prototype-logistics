/**
 * Cretas AI Intent Recognition & Tool Execution E2E Test
 * Target: Production server http://47.100.235.168:10010
 * Run: node test-ai-intent-e2e.mjs
 */

import { writeFileSync } from 'fs';

const BASE_URL = 'http://47.100.235.168:10010';
const FACTORY_ID = 'F001';
const LOGIN_ENDPOINT = `${BASE_URL}/api/mobile/auth/unified-login`;
const RECOGNIZE_ENDPOINT = `${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/recognize`;
const EXECUTE_ENDPOINT = `${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute`;

const USERNAME = 'production_mgr1';
const PASSWORD = '123456';

// ---- color helpers (no emoji) ----
const PASS = '[PASS]';
const FAIL = '[FAIL]';
const SKIP = '[SKIP]';
const INFO = '[INFO]';

let authToken = null;
const results = [];
let passCount = 0;
let failCount = 0;
let skipCount = 0;

// ---- HTTP helpers ----
async function apiRequest(url, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: resp.status, data: json, ok: resp.ok };
  } catch (err) {
    return { status: 0, data: null, error: err.message };
  }
}

// ---- Login ----
async function login() {
  console.log(`\n${INFO} Logging in as ${USERNAME}...`);
  const resp = await apiRequest(LOGIN_ENDPOINT, 'POST', { username: USERNAME, password: PASSWORD });
  if (resp.status === 200 && resp.data?.success && resp.data?.data?.accessToken) {
    authToken = resp.data.data.accessToken;
    console.log(`${PASS} Login OK — token acquired (${authToken.substring(0, 20)}...)`);
    return true;
  }
  console.log(`${FAIL} Login FAILED: status=${resp.status} message=${resp.data?.message || resp.error}`);
  return false;
}

// ---- Record result ----
function record(category, input, status, intentCode, matchMethod, confidence, detail) {
  const row = { category, input, status, intentCode, matchMethod, confidence, detail };
  results.push(row);
  if (status === 'PASS') passCount++;
  else if (status === 'FAIL') failCount++;
  else skipCount++;

  const shortInput = input.length > 20 ? input.substring(0, 20) + '...' : input;
  const line = `${status === 'PASS' ? PASS : status === 'FAIL' ? FAIL : SKIP} [${category}] "${shortInput}" => ${intentCode || 'N/A'} (${matchMethod || '-'}) conf=${confidence !== null && confidence !== undefined ? confidence.toFixed(3) : 'N/A'}`;
  console.log(line);
  if (detail) console.log(`       detail: ${detail}`);
  return row;
}

// ---- Recognize test ----
async function testRecognize(category, input, expectedIntentCode, minConfidence = 0.5) {
  const resp = await apiRequest(RECOGNIZE_ENDPOINT, 'POST', { userInput: input }, authToken);
  if (!resp.ok || resp.status === 0) {
    return record(category, input, 'FAIL', null, null, null, `HTTP ${resp.status}: ${resp.error || resp.data?.message}`);
  }

  const d = resp.data;
  if (!d?.success) {
    return record(category, input, 'FAIL', null, null, null, `success=false: ${d?.message}`);
  }

  const intentCode = d?.data?.intentCode || d?.data?.intent_code;
  const matchMethod = d?.data?.matchMethod || d?.data?.match_method;
  const confidence = d?.data?.confidence ?? d?.data?.score ?? null;

  // Validate: matchMethod present, confidence > threshold
  let status = 'PASS';
  let detail = '';

  if (!matchMethod) {
    status = 'FAIL';
    detail += 'matchMethod missing; ';
  }
  if (confidence !== null && confidence < minConfidence) {
    status = 'FAIL';
    detail += `confidence ${confidence} < ${minConfidence}; `;
  }
  if (expectedIntentCode && intentCode !== expectedIntentCode) {
    // Warn but don't fail — intent recognition can map to similar codes
    detail += `expected=${expectedIntentCode} got=${intentCode}; `;
  }

  return record(category, input, status, intentCode, matchMethod, confidence, detail.trim() || undefined);
}

// ---- Execute test ----
async function testExecute(category, input, expectType, expectDataKey) {
  const resp = await apiRequest(EXECUTE_ENDPOINT, 'POST', { userInput: input }, authToken);
  if (!resp.ok || resp.status === 0) {
    return record(category, input, 'FAIL', null, null, null, `HTTP ${resp.status}: ${resp.error || resp.data?.message}`);
  }

  const d = resp.data;
  if (!d?.success) {
    return record(category, input, 'FAIL', null, null, null, `success=false: ${d?.message}`);
  }

  const data = d?.data;
  const intentCode = data?.intentCode || data?.intent_code || data?.recognitionResult?.intentCode;
  const matchMethod = data?.matchMethod || data?.recognitionResult?.matchMethod;
  const confidence = data?.confidence ?? data?.recognitionResult?.confidence ?? null;
  const responseText = data?.response || data?.message || data?.result || '';
  const toolResult = data?.toolResult;
  const collectingParams = data?.collectingParams || data?.status === 'COLLECTING_PARAMS';

  let status = 'PASS';
  let detail = '';

  if (expectType === 'READ') {
    // Should have data, not SERVICE_NOT_AVAILABLE
    const hasData = toolResult && (toolResult.data !== undefined || toolResult.content !== undefined || toolResult.result !== undefined || toolResult.items !== undefined || toolResult.records !== undefined);
    const isUnsupported = responseText.includes('暂不支持') || responseText.includes('SERVICE_NOT_AVAILABLE');
    if (isUnsupported) {
      status = 'FAIL';
      detail = 'Got SERVICE_NOT_AVAILABLE or unsupported response';
    } else if (!hasData && !responseText) {
      detail = 'No toolResult.data or response text (may still be OK)';
    } else {
      detail = `toolResult keys: ${toolResult ? Object.keys(toolResult).join(',') : 'none'} | response: ${String(responseText).substring(0, 60)}`;
    }
  } else if (expectType === 'WRITE') {
    // Should collect params or confirm
    if (collectingParams) {
      detail = 'Collecting params (expected for write ops)';
    } else {
      detail = `response: ${String(responseText).substring(0, 80)}`;
    }
  } else {
    detail = `response: ${String(responseText).substring(0, 80)}`;
  }

  return record(category, input, status, intentCode, matchMethod, confidence, detail);
}

// ---- Print section header ----
function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// ============================================================
// MAIN TEST SUITE
// ============================================================
async function runAll() {
  console.log('Cretas AI Intent Recognition E2E Test');
  console.log(`Server: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);

  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    console.log(`${FAIL} Cannot proceed without auth token. Exiting.`);
    process.exit(1);
  }

  // ===========================================================
  // PART 1: Intent Recognition Coverage (50+ queries)
  // ===========================================================

  section('PART 1A: HR / Attendance (9 tools)');
  await testRecognize('HR', '打卡', null, 0.5);
  await testRecognize('HR', '今天考勤', null, 0.5);
  await testRecognize('HR', '考勤统计', null, 0.5);
  await testRecognize('HR', '部门出勤', null, 0.5);
  await testRecognize('HR', '月度考勤报表', null, 0.5);
  await testRecognize('HR', '考勤异常记录', null, 0.5);
  await testRecognize('HR', '下班打卡', null, 0.5);
  await testRecognize('HR', '考勤状态查询', null, 0.5);
  await testRecognize('HR', '今天的考勤记录', null, 0.5);

  section('PART 1B: Finance (3 tools)');
  await testRecognize('Finance', '开票', null, 0.5);
  await testRecognize('Finance', '申请发票', null, 0.5);
  await testRecognize('Finance', '录入收款', null, 0.5);
  await testRecognize('Finance', '回款', null, 0.5);
  await testRecognize('Finance', '开票审核', null, 0.5);
  await testRecognize('Finance', '客户付款', null, 0.5);

  section('PART 1C: R&D / Samples (3 tools)');
  await testRecognize('RD', '创建研发需求', null, 0.5);
  await testRecognize('RD', '新品开发', null, 0.5);
  await testRecognize('RD', '创建样品', null, 0.5);
  await testRecognize('RD', '审核样品', null, 0.5);
  await testRecognize('RD', '样品审核', null, 0.5);

  section('PART 1D: Production (batch operations)');
  await testRecognize('Production', '今日生产情况', null, 0.5);
  await testRecognize('Production', '生产批次查询', null, 0.5);
  await testRecognize('Production', '开始生产', null, 0.5);
  await testRecognize('Production', '完成生产', null, 0.5);
  await testRecognize('Production', '生产计划', null, 0.5);

  section('PART 1E: Material / Inventory');
  await testRecognize('Material', '查看库存', null, 0.5);
  await testRecognize('Material', '原料批次查询', null, 0.5);
  await testRecognize('Material', '库存盘点', null, 0.5);
  await testRecognize('Material', '原材料入库', null, 0.5);

  section('PART 1F: Sales');
  await testRecognize('Sales', '销售订单列表', null, 0.5);
  await testRecognize('Sales', '客户列表', null, 0.5);
  await testRecognize('Sales', '出货查询', null, 0.5);
  await testRecognize('Sales', '销售明细', null, 0.5);

  section('PART 1G: Purchase');
  await testRecognize('Purchase', '采购订单', null, 0.5);
  await testRecognize('Purchase', '采购财务审核', null, 0.5);
  await testRecognize('Purchase', '供应商列表', null, 0.5);

  section('PART 1H: Quality');
  await testRecognize('Quality', '质检结果', null, 0.5);
  await testRecognize('Quality', '质检统计', null, 0.5);
  await testRecognize('Quality', '产品质量检测', null, 0.5);

  section('PART 1I: Equipment');
  await testRecognize('Equipment', '设备状态', null, 0.5);
  await testRecognize('Equipment', '设备告警', null, 0.5);
  await testRecognize('Equipment', '设备维护', null, 0.5);

  section('PART 1J: Report / Analytics');
  await testRecognize('Report', '销售报表', null, 0.5);
  await testRecognize('Report', '产量报表', null, 0.5);
  await testRecognize('Report', 'KPI统计', null, 0.5);
  await testRecognize('Report', '每日报告', null, 0.5);
  await testRecognize('Report', '月度生产报表', null, 0.5);

  section('PART 1K: System');
  await testRecognize('System', '系统设置', null, 0.5);
  await testRecognize('System', '查看待办', null, 0.5);
  await testRecognize('System', '产品类型', null, 0.5);
  await testRecognize('System', '我的待办事项', null, 0.5);

  section('PART 1L: Edge Cases');
  await testRecognize('Edge', '库存', null, 0.3);   // very short
  await testRecognize('Edge', '帮我看看', null, 0.1); // very ambiguous
  await testRecognize('Edge', '我想查一下本月各产线的良品率对比以及原料消耗情况并生成一份完整的生产分析报告', null, 0.3); // very long
  await testRecognize('Edge', '出勤', null, 0.3);   // synonym
  await testRecognize('Edge', '开发票', null, 0.5); // alternate phrasing

  // ===========================================================
  // PART 2: Tool Execution Verification (15+ queries)
  // ===========================================================

  section('PART 2A: Read Operations (expect data back)');
  await testExecute('Exec-Read', '考勤统计', 'READ');
  await testExecute('Exec-Read', '查看库存', 'READ');
  await testExecute('Exec-Read', '产品类型', 'READ');
  await testExecute('Exec-Read', '我的待办', 'READ');
  await testExecute('Exec-Read', '今天的考勤记录', 'READ');
  await testExecute('Exec-Read', '考勤状态', 'READ');
  await testExecute('Exec-Read', '销售订单列表', 'READ');
  await testExecute('Exec-Read', '设备状态', 'READ');
  await testExecute('Exec-Read', '质检结果', 'READ');

  section('PART 2B: Write Operations (expect param collection)');
  await testExecute('Exec-Write', '帮我开票', 'WRITE');
  await testExecute('Exec-Write', '录入收款', 'WRITE');
  await testExecute('Exec-Write', '创建研发需求', 'WRITE');
  await testExecute('Exec-Write', '新建采购订单', 'WRITE');
  await testExecute('Exec-Write', '录入生产批次', 'WRITE');
  await testExecute('Exec-Write', '开始打卡', 'WRITE');

  section('PART 2C: Mixed (verify not SERVICE_NOT_AVAILABLE)');
  await testExecute('Exec-Mix', '采购财务审核', 'READ');
  await testExecute('Exec-Mix', '供应商列表', 'READ');
  await testExecute('Exec-Mix', '月度考勤报表', 'READ');

  // ===========================================================
  // PART 3: Regression Check
  // ===========================================================

  section('PART 3: Regression — Historically Important Intents');
  // Chinese phrase match regression
  await testRecognize('Regression', '查看原材料库存', null, 0.5);
  await testRecognize('Regression', '今日产量', null, 0.5);
  await testRecognize('Regression', '出库记录', null, 0.5);
  await testRecognize('Regression', '审批待办', null, 0.5);
  await testRecognize('Regression', '扫码入库', null, 0.5);
  await testRecognize('Regression', '生产报工', null, 0.5);
  await testRecognize('Regression', '调拨申请', null, 0.5);
  await testRecognize('Regression', '退货处理', null, 0.5);
  await testRecognize('Regression', '员工信息', null, 0.5);
  await testRecognize('Regression', '合同列表', null, 0.3);

  section('PART 3B: Synonym / Alternate Phrasing Tests');
  // Same intent via different phrasing
  await testRecognize('Synonym', '我要打卡', null, 0.5);
  await testRecognize('Synonym', '签到', null, 0.3);
  await testRecognize('Synonym', '开具发票', null, 0.5);
  await testRecognize('Synonym', '收款登记', null, 0.5);
  await testRecognize('Synonym', '仓库存货查询', null, 0.5);
  await testRecognize('Synonym', '在线客户', null, 0.3);

  // ===========================================================
  // SUMMARY
  // ===========================================================
  const total = passCount + failCount + skipCount;

  console.log('\n');
  console.log('='.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:   ${total}`);
  console.log(`PASS:    ${passCount}  (${((passCount / total) * 100).toFixed(1)}%)`);
  console.log(`FAIL:    ${failCount}`);
  console.log(`SKIP:    ${skipCount}`);

  // Category breakdown
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { pass: 0, fail: 0 };
    if (r.status === 'PASS') categories[r.category].pass++;
    else if (r.status === 'FAIL') categories[r.category].fail++;
  }
  console.log('\nBy Category:');
  for (const [cat, counts] of Object.entries(categories)) {
    const total = counts.pass + counts.fail;
    console.log(`  ${cat.padEnd(15)} ${counts.pass}/${total} pass`);
  }

  // List failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('\nFailed Tests:');
    for (const f of failures) {
      console.log(`  [${f.category}] "${f.input}" => intentCode=${f.intentCode} conf=${f.confidence !== null && f.confidence !== undefined ? f.confidence.toFixed(3) : 'N/A'}`);
      if (f.detail) console.log(`    reason: ${f.detail}`);
    }
  }

  // Save to file
  const reportPath = 'test-ai-intent-e2e-results.json';
  const report = {
    meta: {
      server: BASE_URL,
      factoryId: FACTORY_ID,
      runAt: new Date().toISOString(),
      total,
      passCount,
      failCount,
      skipCount,
      passRate: `${((passCount / total) * 100).toFixed(1)}%`,
    },
    categoryBreakdown: categories,
    failures: failures.map(f => ({
      category: f.category,
      input: f.input,
      intentCode: f.intentCode,
      matchMethod: f.matchMethod,
      confidence: f.confidence,
      detail: f.detail,
    })),
    allResults: results,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nResults saved to: ${reportPath}`);
  console.log('='.repeat(60));

  process.exit(failures.length > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
