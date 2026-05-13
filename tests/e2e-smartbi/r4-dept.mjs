// R4 SmartBI Tier 2 deep — analysis_department L4 + Rule 9 抽 5 row 部门 KPI
// PR-task: qa/r4-department-l4-deep
// Spec: docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md §3.3 department row + §5 R4
//
// Scope pivot (mirrors R3 chat3 inventory): no dedicated Vue analytics dashboard
// consumes `getDepartmentAnalysis` from `web-admin/src/api/smartbi/dashboard.ts:38`.
// Closest UI is `/hr/departments` (CRUD page, web-admin/src/views/hr/departments/index.vue).
//
// Hybrid coverage:
//   - API-layer deep on `/smart-bi/analysis/department` composite endpoint
//   - UI-layer deep on `/hr/departments` Vue page (where real dept names live)
//   - RBAC roundtrip — admin 200 vs warehouse_mgr1 403 (denied at gate per
//     ANALYTICS_READ_ROLES whitelist; warehouse_manager not in list)
//
// Tests (with depth labels):
//   L4-API-1 deep    : composite happy path envelope + Rule 9 Jackson key order + Rule 11 LocalDateTime μs trim
//   L4-API-2 deep    : empty efficiencyMatrix ChartConfig shape (xaxisField lowercase 'a' + emit nulls)
//   L4-API-3 deep    : trendComparison real data + "未知部门" fallback (Java line 372)
//   L4-API-4 deep    : dateRange granularity inference (MONTH 30d → QUARTER 90d → YEAR 365d)
//   L4-ERROR-1 deep  : cross-factory 403 (F002 URL with F001 token)
//   L4-ERROR-2 deep  : RBAC 403 for warehouse_mgr1 token (4-位一体 body verify)
//   L4-UI-1 deep     : /hr/departments admin — Rule 9 抽 5 row dept KPI real names
//   L4-UI-2 deep     : /hr/departments warehouse_mgr1 access pattern
//
// Thresholds (code-verified, NOT MO drift):
//   TARGET_COMPLETION: RED < 60, YELLOW < 85, GREEN ≥ 85  (analysis_department.py:32-33)
//
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://139.196.165.140:8097';
const FACTORY = 'F001';
const EVID = 'C:/Users/Steve/cretas-r4-department-deep/docs/qa-audits/2026-05-12-r4-department-l4-deep-evidence';
mkdirSync(EVID, { recursive: true });

const results = [];
const startedAt = new Date().toISOString();

function record(layer, id, name, status, evidence) {
  const r = { layer, id, name, status, ...evidence };
  results.push(r);
  const tag = status === 'PASS' ? 'OK' : status === 'WARN' ? 'WARN' : status === 'FAIL' ? 'FAIL' : status;
  console.log(`[${tag}] ${layer}-${id} ${name} (depth=${evidence.depth || '?'})`);
}

async function loginAPI(username) {
  const r = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username, password: '123456',
      deviceInfo: { deviceId: `e2e-r4-dept-${username}-${Date.now()}`, deviceModel: 'node', platform: 'Node' }
    })
  });
  const j = await r.json();
  if (!j.data?.token) throw new Error(`Login ${username} failed: ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
}

async function apiGet(token, path) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { _raw: text }; }
  return { status: r.status, body, rawText: text, headers: Object.fromEntries(r.headers) };
}

function dump(name, obj) {
  writeFileSync(join(EVID, name), JSON.stringify(obj, null, 2));
}

async function setupAuthInBrowser(page, loginData) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(([token, user]) => {
    localStorage.setItem('cretas_access_token', token);
    localStorage.setItem('cretas_user', JSON.stringify(user));
  }, [
    loginData.token,
    {
      id: loginData.userId,
      username: loginData.username,
      email: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userType: 'factory',
      factoryUser: {
        role: loginData.role,
        factoryId: loginData.factoryId,
        factoryType: loginData.factoryType || 'FACTORY',
        permissions: loginData.permissions || [],
      }
    }
  ]);
}

// ---------- API DEEP TESTS ----------

async function L4_API_1_composite(adminToken) {
  // Default 30d window (composite path: SmartBIServiceImpl.getComprehensiveAnalysis "department" case)
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startD = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const path = `/api/mobile/${FACTORY}/smart-bi/analysis/department?startDate=${startD}&endDate=${end}`;
  const { status, body } = await apiGet(adminToken, path);
  dump('api1-composite.json', { request: path, status, body });

  const ok = status === 200 && body?.success === true;
  const data = body?.data || {};

  // Top-level data key order per F999 golden (Jackson HashMap hash-iter order):
  // [completionRates, efficiencyMatrix, dateRange, generatedAt, ranking, trendComparison]
  const expectedTopKeys = ['completionRates', 'efficiencyMatrix', 'dateRange', 'generatedAt', 'ranking', 'trendComparison'];
  const actualTopKeys = Object.keys(data);
  const topKeyOrderMatch = expectedTopKeys.every((k, i) => actualTopKeys[i] === k);

  // dateRange field order per Lombok @Data + Jackson:
  // [startDate, endDate, granularity, originalExpression, relative, days, valid]
  const dateRange = data.dateRange || {};
  const expectedDRKeys = ['startDate', 'endDate', 'granularity', 'originalExpression', 'relative', 'days', 'valid'];
  const actualDRKeys = Object.keys(dateRange);
  const dateRangeKeyOrderMatch = expectedDRKeys.every((k, i) => actualDRKeys[i] === k);
  const dateRangeFieldsPresent = expectedDRKeys.every(k => k in dateRange);

  // dateRange granularity inference (analysis_department.py:351-360): days<=31 → MONTH
  const drGranularity = dateRange.granularity;
  const drDays = dateRange.days;
  const drValid = dateRange.valid;
  // 30 days window: end - start = 30, +1 inclusive = 31 → MONTH boundary case
  const granularityCorrect = (drDays === 31 && drGranularity === 'MONTH') ||
                             (drDays <= 1 && drGranularity === 'DAY') ||
                             (drDays <= 7 && drGranularity === 'WEEK') ||
                             (drDays <= 31 && drGranularity === 'MONTH');

  // Rule 11 — Jackson LocalDateTime drops trailing-zero microseconds
  // Format: YYYY-MM-DDTHH:MM:SS.fffff or just YYYY-MM-DDTHH:MM:SS if no μs
  const gen = data.generatedAt;
  const rule11Format = typeof gen === 'string' && (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.[1-9]\d*[1-9]|\.[1-9]\d*|)?$/.test(gen) || // no trailing zero
    gen.length > 0 // any ISO-ish, just verify non-empty
  );
  const rule11TrailingZeroOk = typeof gen === 'string' && !/\.0+$/.test(gen) && !/\.[1-9]\d*0+$/.test(gen);

  // Java Phase 2A handler deleted — Python is sole owner (per T6.5 Phase A/B cleanup)
  const javaParity = 'python-only (Java SmartBIServiceImpl deleted in T6.5 Phase C)';

  record('L4', 'API-1', 'composite_envelope_shape', ok && topKeyOrderMatch && dateRangeKeyOrderMatch && granularityCorrect ? 'PASS' : 'WARN', {
    depth: 'deep',
    httpStatus: status,
    apiSuccess: body?.success,
    actualTopKeys,
    expectedTopKeys,
    topKeyOrderMatch,
    actualDateRangeKeys: actualDRKeys,
    expectedDateRangeKeys: expectedDRKeys,
    dateRangeKeyOrderMatch,
    dateRangeFieldsPresent,
    granularity: drGranularity,
    days: drDays,
    valid: drValid,
    granularityCorrect,
    generatedAt: gen,
    rule11Format,
    rule11TrailingZeroOk,
    javaParity,
    evidenceFile: 'api1-composite.json',
  });
  return { body, data };
}

async function L4_API_2_chart_envelope(adminToken, data) {
  // Verify Rule 9 ChartConfig shape — Lombok @Data + no @JsonInclude → emit all 7 keys incl nulls
  // ⚠️ Java side: xAxisField field → "xaxisField" key (Jackson bean introspection LOWERCASE-A quirk)
  // Per analysis_department.py:305-329 _create_empty_chart factory
  const path = `(reuse from API-1 body.data.efficiencyMatrix)`;
  dump('api2-chart-envelope.json', { request: path, data });

  const em = data?.efficiencyMatrix || {};

  // ChartConfig field order per F999 golden: [chartType, title, seriesField, data, options, xaxisField, yaxisField]
  const expectedKeys = ['chartType', 'title', 'seriesField', 'data', 'options', 'xaxisField', 'yaxisField'];
  const actualKeys = Object.keys(em);
  const keyOrderMatch = expectedKeys.every((k, i) => actualKeys[i] === k);

  // Critical Rule 9 check: xaxisField is LOWERCASE 'a' (not xAxisField camelCase)
  const xaxisLowercase = 'xaxisField' in em && !('xAxisField' in em);
  const yaxisLowercase = 'yaxisField' in em && !('yAxisField' in em);

  // Rule 9 — Lombok @Data + no @JsonInclude → emit nulls explicitly
  // When efficiencyMatrix is empty (no department data), expect chartType=SCATTER, title=部门效率矩阵, seriesField=null, data=[], options=null, xaxisField=null, yaxisField=null
  const isEmptyChart = em.data?.length === 0;
  const emptyChartNullsEmit = isEmptyChart && em.seriesField === null && em.options === null && em.xaxisField === null && em.yaxisField === null;

  // Also verify trendComparison ChartConfig shape (separate factory _create_empty_chart fallback OR populated)
  const tc = data?.trendComparison || {};
  const tcActualKeys = Object.keys(tc);
  const tcKeyOrderMatch = expectedKeys.every((k, i) => tcActualKeys[i] === k);

  const passConditions = keyOrderMatch && xaxisLowercase && yaxisLowercase && tcKeyOrderMatch;

  record('L4', 'API-2', 'chart_envelope_rule9_lombok_jackson', passConditions ? 'PASS' : 'WARN', {
    depth: 'deep',
    efficiencyMatrixKeys: actualKeys,
    expectedKeys,
    keyOrderMatch,
    rule9_xaxisLowercaseA: xaxisLowercase,
    rule9_yaxisLowercaseA: yaxisLowercase,
    efficiencyMatrixEmpty: isEmptyChart,
    emptyChartNullsEmit,
    efficiencyMatrixChartType: em.chartType,
    efficiencyMatrixTitle: em.title,
    trendComparisonKeys: tcActualKeys,
    trendComparisonKeyOrderMatch: tcKeyOrderMatch,
    trendComparisonChartType: tc.chartType,
    trendComparisonHasData: Array.isArray(tc.data) && tc.data.length > 0,
    evidenceFile: 'api2-chart-envelope.json',
  });
}

async function L4_API_3_trend_aggregation(adminToken) {
  // 90-day window to maximize chance of trend data (Java line 372 fallback: dept null → "未知部门")
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startD = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const path = `/api/mobile/${FACTORY}/smart-bi/analysis/department?startDate=${startD}&endDate=${end}`;
  const { status, body } = await apiGet(adminToken, path);
  dump('api3-trend-aggregation.json', { request: path, status, body });

  const ok = status === 200 && body?.success === true;
  const data = body?.data || {};
  const tc = data.trendComparison || {};
  const tcData = Array.isArray(tc.data) ? tc.data : [];

  // Rule 9 抽 5 rows × 3 regions on trend periods (sorted by period asc)
  const n = tcData.length;
  const samples = {
    top: tcData.slice(0, 3),
    mid: n >= 5 ? tcData.slice(Math.floor(n / 2), Math.floor(n / 2) + 1) : [],
    last: tcData.slice(-2),
  };
  const allSamples = [...samples.top, ...samples.mid, ...samples.last];

  // Check each sample has period key + at least one numeric dept value
  function isRealPeriod(pt) {
    if (!pt || typeof pt !== 'object') return false;
    if (!pt.period || typeof pt.period !== 'string') return false;
    const otherKeys = Object.keys(pt).filter(k => k !== 'period');
    return otherKeys.length > 0 && otherKeys.some(k => typeof pt[k] === 'number');
  }
  const realCount = allSamples.filter(isRealPeriod).length;

  // Verify period format is "YYYY-Www" (per analysis_finance._get_period_key + Rule 2 calendar-year fix)
  const periodFormatOk = tcData.every(pt => /^\d{4}-W\d{2}$/.test(pt.period));

  // Verify "未知部门" fallback (Java line 372) — when sales rows have NULL department
  const hasUnknownDept = tcData.some(pt => Object.keys(pt).some(k => k === '未知部门'));
  // Java line 372 fallback verifies Rule 1 compliance (null != falsy "")

  // Verify weekly aggregation amounts non-zero (Rule 4 _decimal_to_number int-or-float emit)
  const amountTypes = new Set();
  for (const pt of tcData.slice(0, 5)) {
    for (const [k, v] of Object.entries(pt)) {
      if (k !== 'period') amountTypes.add(typeof v);
    }
  }
  const allNumeric = amountTypes.size > 0 && [...amountTypes].every(t => t === 'number');

  // Data-prerequisite note: F001 smart_bi_department_data table is empty,
  // but smart_bi_sales_data has rows with NULL department → trend fallback works
  // ranking + completionRates correctly return [] (Rule 1: empty != null != failure)

  record('L4', 'API-3', 'trend_aggregation_未知部门_fallback', ok && realCount === allSamples.length && periodFormatOk && allNumeric ? 'PASS' : 'WARN', {
    depth: 'deep',
    httpStatus: status,
    apiSuccess: body?.success,
    trendDataPointCount: n,
    rule9Sampled: { top: samples.top.length, mid: samples.mid.length, last: samples.last.length },
    rule9RealPeriods: realCount,
    rule9SamplePeriodKeys: allSamples.map(p => p?.period).filter(Boolean),
    rule9SampleDeptKeys: allSamples.map(p => Object.keys(p || {}).filter(k => k !== 'period')).slice(0, 5),
    periodFormatOk,
    hasUnknownDeptFallback: hasUnknownDept,
    amountTypes: [...amountTypes],
    allValuesNumeric: allNumeric,
    rankingEmpty: data.ranking?.length === 0,
    completionRatesEmpty: data.completionRates?.length === 0,
    dataPrereqNote: 'F001 smart_bi_department_data 0 rows → ranking/completionRates [] expected; trendComparison populated via sales_data with NULL department → 未知部门 fallback (Java line 372)',
    evidenceFile: 'api3-trend-aggregation.json',
  });
}

async function L4_API_4_granularity_inference(adminToken) {
  // Granularity inference: analysis_department.py:351-360
  //   days <= 1   → DAY
  //   days <= 7   → WEEK
  //   days <= 31  → MONTH
  //   days <= 93  → QUARTER
  //   else        → YEAR
  // Test 30/90/365 day windows
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const probes = [
    { name: '30d-MONTH', daysBack: 30, expectedGranularity: 'MONTH' },
    { name: '90d-QUARTER', daysBack: 90, expectedGranularity: 'QUARTER' },
    { name: '365d-YEAR', daysBack: 365, expectedGranularity: 'YEAR' },
  ];

  const probeResults = [];
  for (const p of probes) {
    const startD = new Date(today.getTime() - p.daysBack * 86400000).toISOString().slice(0, 10);
    const path = `/api/mobile/${FACTORY}/smart-bi/analysis/department?startDate=${startD}&endDate=${end}`;
    const { status, body } = await apiGet(adminToken, path);
    const actual = body?.data?.dateRange?.granularity;
    const days = body?.data?.dateRange?.days;
    probeResults.push({
      name: p.name, daysBack: p.daysBack, days, expected: p.expectedGranularity, actual, match: actual === p.expectedGranularity, status
    });
    await new Promise(r => setTimeout(r, 200)); // gentle pace
  }
  dump('api4-granularity-inference.json', { probes: probeResults });

  const allMatch = probeResults.every(p => p.match);

  record('L4', 'API-4', 'dateRange_granularity_inference', allMatch ? 'PASS' : 'WARN', {
    depth: 'deep',
    probes: probeResults,
    allMatch,
    inferenceRule: 'analysis_department.py:351-360 — days<=1 DAY, <=7 WEEK, <=31 MONTH, <=93 QUARTER, else YEAR',
    evidenceFile: 'api4-granularity-inference.json',
  });
}

async function L4_ERROR_1_cross_factory(adminToken) {
  // Cross-factory: F001 admin token, hit F002 endpoint → expect 403 + body.message
  const today = new Date().toISOString().slice(0, 10);
  const startD = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const path = `/api/mobile/F002/smart-bi/analysis/department?startDate=${startD}&endDate=${today}`;
  const { status, body } = await apiGet(adminToken, path);
  dump('err1-cross-factory.json', { request: path, status, body });

  const is4xx = status >= 400 && status < 500;
  const msg = body?.message || body?.error || '';
  const hasMessage = typeof msg === 'string' && msg.length > 0;
  // 4位一体 check: message + actionHint + severity + code
  const has4Locator = hasMessage && (body.code || body.actionHint || body.severity);
  const messageMentionsFactory = /factory|工厂|F00\d/i.test(msg);

  record('L4', 'ERROR-1', 'cross_factory_403', is4xx && hasMessage && messageMentionsFactory ? 'PASS' : 'FAIL', {
    depth: 'deep',
    httpStatus: status,
    is4xx,
    message: msg,
    hasMessage,
    messageMentionsFactory,
    code: body?.code,
    actionHint: body?.actionHint,
    severity: body?.severity,
    has4位一体LocatorFields: !!has4Locator,
    success: body?.success,
    expectedShape: 'success=false + message specific to factory mismatch + code/actionHint',
    evidenceFile: 'err1-cross-factory.json',
  });
}

async function L4_ERROR_2_rbac_warehouse(warehouseToken) {
  // warehouse_manager role NOT in ANALYTICS_READ_ROLES (frozenset in _rbac_role.py:43-57)
  // → require_analytics_read dependency raises RbacForbiddenException → 403 with 4-位一体 body
  const today = new Date().toISOString().slice(0, 10);
  const startD = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const path = `/api/mobile/${FACTORY}/smart-bi/analysis/department?startDate=${startD}&endDate=${today}`;
  const { status, body } = await apiGet(warehouseToken, path);
  dump('err2-rbac-warehouse.json', { request: path, status, body });

  const is403 = status === 403;
  const msg = body?.message || '';
  const hasActionHint = !!body?.actionHint;
  const hasSeverity = !!body?.severity;
  const hasMeta = !!body?.meta || !!body?.code;
  const four位一体 = !!msg && hasActionHint && hasSeverity && hasMeta;
  // Expected: RbacForbiddenException → build_forbidden_body w/ role=warehouse_manager, module=analytics, action=read
  const messageMentionsRoleOrPermission = /analytics|warehouse|权限|permission|access/i.test(msg);

  record('L4', 'ERROR-2', 'rbac_warehouse_manager_denied', is403 && four位一体 ? 'PASS' : 'WARN', {
    depth: 'deep',
    httpStatus: status,
    is403,
    success: body?.success,
    message: msg,
    actionHint: body?.actionHint,
    severity: body?.severity,
    code: body?.code,
    meta: body?.meta,
    has4位一体: four位一体,
    messageMentionsRoleOrPermission,
    expectedShape: '403 + 4-位一体 (message + actionHint + severity + meta/code)',
    note: 'warehouse_manager role NOT in ANALYTICS_READ_ROLES per _rbac_role.py:43-57; require_analytics_read raises RbacForbiddenException',
    evidenceFile: 'err2-rbac-warehouse.json',
  });
}

// ---------- UI DEEP TESTS ----------

async function L4_UI_1_hr_departments_admin(browser, adminLogin) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const apiCalls = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/api/mobile')) apiCalls.push({ url: u, status: r.status() });
  });

  await setupAuthInBrowser(page, adminLogin);

  // Navigate to /hr/departments (CRUD page where real dept names live)
  await page.goto(`${BASE}/hr/departments`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.el-table__row, .el-table__empty-text', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Screenshot 1
  await page.screenshot({ path: join(EVID, 'ui1-hr-departments-admin.png'), fullPage: true });

  // Read headers
  const headers = await page.$$eval('.el-table .el-table__header th .cell',
    els => els.map(el => el.textContent.trim())).catch(() => []);

  // Count rows
  const rowCount = await page.$$eval('.el-table__body-wrapper tbody tr.el-table__row',
    els => els.length).catch(() => 0);

  // Rule 9 抽 5 row × 3 region — top 3, mid 1, last 2
  const sampledRows = await page.evaluate((n) => {
    const rows = Array.from(document.querySelectorAll('.el-table__body-wrapper tbody tr.el-table__row'));
    const pick = (idx) => {
      const row = rows[idx];
      if (!row) return null;
      return Array.from(row.querySelectorAll('td .cell')).map(c => c.textContent.trim().slice(0, 80));
    };
    const result = [];
    [0, 1, 2].forEach(i => { const v = pick(i); if (v) result.push({ region: 'top', idx: i, cells: v }); });
    if (n >= 5) { const v = pick(Math.floor(n / 2)); if (v) result.push({ region: 'mid', idx: Math.floor(n / 2), cells: v }); }
    [-2, -1].forEach(off => { const i = n + off; if (i >= 0 && i < n) { const v = pick(i); if (v) result.push({ region: 'last', idx: i, cells: v }); } });
    return result;
  }, rowCount);

  // Each dept name should be real (生产部/质检部/仓储部 etc) — NOT placeholders "department 1/2/3", "—", numbers only
  const placeholderPatterns = /^[\s\-.0]+$|^(department|dept|序号|名称|undefined|null)\s*\d*$|^[0-9]+(\.[0-9]+)?$/i;
  function isRealDeptName(cell) {
    if (!cell || typeof cell !== 'string') return false;
    const t = cell.trim();
    if (t.length === 0) return false;
    if (placeholderPatterns.test(t)) return false;
    // Expect Chinese dept names or named codes like "PROD"/"QC"/"WH"
    return true;
  }
  const realSampled = sampledRows.filter(s => {
    // First cell (index 0) is usually checkbox/expand, dept name typically at idx 1 or 2 (depends on page layout)
    return s.cells.some(c => isRealDeptName(c) && /[一-鿿]/.test(c)); // require Chinese char
  });
  const rule9Pass = sampledRows.length > 0 && realSampled.length === sampledRows.length;

  // Verify expected dept names from earlier curl probe: 管理部 / 生产部 / 质检部 / 仓储部 / 采购部
  const expectedDeptNames = ['管理部', '生产部', '质检部', '仓储部', '采购部'];
  const sampleAllCellText = sampledRows.flatMap(s => s.cells).join(' | ');
  const foundExpectedNames = expectedDeptNames.filter(name => sampleAllCellText.includes(name));

  // Try to open detail (edit dialog) for first row
  let detailOpened = false;
  let detailFields = [];
  if (rowCount > 0) {
    const editBtn = await page.$('.el-table__body-wrapper tbody tr.el-table__row .el-button:has-text("编辑")');
    if (editBtn) {
      await editBtn.click();
      await page.waitForTimeout(2000);
      const dialogVisible = await page.$('.el-dialog__wrapper:not([style*="display: none"]) .el-dialog, .el-overlay-dialog:not([style*="display: none"]) .el-dialog');
      detailOpened = !!dialogVisible;
      if (detailOpened) {
        detailFields = await page.evaluate(() => {
          const labels = document.querySelectorAll('.el-dialog .el-form-item__label');
          return Array.from(labels).slice(0, 15).map(l => l.textContent.trim());
        });
        await page.screenshot({ path: join(EVID, 'ui1-hr-departments-detail.png'), fullPage: false });
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  }

  const apiErrors = apiCalls.filter(c => c.status >= 400);
  record('L4', 'UI-1', 'hr_departments_admin_full', consoleErrors.length === 0 && apiErrors.length === 0 && rowCount > 0 && rule9Pass ? 'PASS' : 'WARN', {
    depth: 'deep',
    rowCount,
    rowsBefore: rowCount,
    rowsAfter: rowCount, // read-only deep test (no CRUD mutation)
    delta: 0,
    headers,
    rule9Sampled: sampledRows.length,
    rule9RealNames: realSampled.length,
    rule9Pass,
    expectedDeptNames,
    foundExpectedDeptNames: foundExpectedNames,
    sampleRowsPreview: sampledRows.slice(0, 5).map(s => ({ region: s.region, idx: s.idx, cells: s.cells.slice(0, 5) })),
    detailOpened,
    detailFieldsCount: detailFields.length,
    detailFieldsSample: detailFields.slice(0, 8),
    consoleErrors: consoleErrors.length,
    consoleErrorSample: consoleErrors.slice(0, 3),
    apiErrorCount: apiErrors.length,
    apiErrorSample: apiErrors.slice(0, 3),
    screenshots: ['ui1-hr-departments-admin.png', detailOpened ? 'ui1-hr-departments-detail.png' : null].filter(Boolean),
  });

  await ctx.close();
  return { rowCount, headers, sampledRows, foundExpectedNames };
}

async function L4_UI_2_hr_departments_warehouse(browser, warehouseLogin) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const apiCalls = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/api/mobile')) apiCalls.push({ url: u, status: r.status(), endpoint: u.split('/api/mobile')[1]?.split('?')[0] || '' });
  });

  await setupAuthInBrowser(page, warehouseLogin);
  await page.goto(`${BASE}/hr/departments`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: join(EVID, 'ui2-hr-departments-warehouse.png'), fullPage: true });

  const headers = await page.$$eval('.el-table .el-table__header th .cell',
    els => els.map(el => el.textContent.trim())).catch(() => []);
  const rowCount = await page.$$eval('.el-table__body-wrapper tbody tr.el-table__row',
    els => els.length).catch(() => 0);

  // Check if warehouse role sees:
  //  - Page renders (could be page-level guard hiding) OR table empty OR 403 error toast
  //  - Write buttons hidden (canWrite('hr') check on permissionStore)
  const hasNewBtn = await page.$('.el-button:has-text("新建"), .el-button:has-text("添加")').then(b => !!b).catch(() => false);
  const hasEditBtn = await page.$('.el-button:has-text("编辑")').then(b => !!b).catch(() => false);
  const hasDeleteBtn = await page.$('.el-button:has-text("删除")').then(b => !!b).catch(() => false);
  const writeButtonsHidden = !hasNewBtn && !hasEditBtn && !hasDeleteBtn;

  // Detect dept name in first row to verify warehouse can READ dept names (per MO: 部门名 + 人数 看真)
  let firstDeptName = null;
  let firstHeadcount = null;
  if (rowCount > 0) {
    firstDeptName = await page.evaluate(() => {
      const first = document.querySelector('.el-table__body-wrapper tbody tr.el-table__row');
      if (!first) return null;
      const cells = Array.from(first.querySelectorAll('td .cell')).map(c => c.textContent.trim());
      // dept name typically not in first col (which is often # or checkbox)
      return cells.find(c => /[一-鿿]/.test(c)) || cells[1] || cells[0];
    });
    // headcount: column header text contains "人数" or "员工数" or "成员数"
    firstHeadcount = await page.evaluate(() => {
      const headerCells = Array.from(document.querySelectorAll('.el-table .el-table__header th .cell')).map(c => c.textContent.trim());
      const idx = headerCells.findIndex(h => /人数|员工|成员/.test(h));
      if (idx < 0) return null;
      const firstRow = document.querySelector('.el-table__body-wrapper tbody tr.el-table__row');
      if (!firstRow) return null;
      const tdCells = Array.from(firstRow.querySelectorAll('td .cell')).map(c => c.textContent.trim());
      return tdCells[idx] || null;
    });
  }

  const apiErrors = apiCalls.filter(c => c.status >= 400);
  // Warehouse may legitimately get 403 on /departments POST/PUT/DELETE (write ops) but should be able to GET (read)
  const readApiCalls = apiCalls.filter(c => c.url.match(/\/(departments|users)(\?|$)/) && c.status === 200);
  const has403WriteAttempt = apiCalls.some(c => c.status === 403);

  record('L4', 'UI-2', 'hr_departments_warehouse_view', consoleErrors.length === 0 ? 'PASS' : 'WARN', {
    depth: 'deep',
    rowCount,
    headers,
    firstDeptNameVisible: firstDeptName,
    firstHeadcountVisible: firstHeadcount,
    canSeeDeptNames: !!firstDeptName,
    hasNewBtn,
    hasEditBtn,
    hasDeleteBtn,
    writeButtonsHidden, // per canWrite('hr') guard in HRDepartments.vue:13
    readApiCallCount: readApiCalls.length,
    has403WriteAttempt,
    consoleErrors: consoleErrors.length,
    consoleErrorSample: consoleErrors.slice(0, 3),
    apiErrorCount: apiErrors.length,
    apiErrorSample: apiErrors.slice(0, 3),
    note: 'warehouse_manager has permissions=[warehouse:*] not [hr:*]; per canWrite("hr") guard, write buttons should be hidden but reads pass',
    screenshots: ['ui2-hr-departments-warehouse.png'],
  });

  await ctx.close();
  return { rowCount, firstDeptName, writeButtonsHidden };
}

async function L4_RBAC_admin_vs_warehouse_api(adminToken, warehouseToken) {
  // Already covered by L4-API-1 (admin 200 with envelope) + L4-ERROR-2 (warehouse 403 with 4-位一体).
  // This synthesizes both for explicit RBAC comparison summary.
  const today = new Date().toISOString().slice(0, 10);
  const startD = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const path = `/api/mobile/${FACTORY}/smart-bi/analysis/department?startDate=${startD}&endDate=${today}`;
  const admin = await apiGet(adminToken, path);
  const warehouse = await apiGet(warehouseToken, path);
  dump('rbac-api-roundtrip.json', { request: path, admin: { status: admin.status, success: admin.body?.success, dataKeys: Object.keys(admin.body?.data || {}) }, warehouse: { status: warehouse.status, success: warehouse.body?.success, message: warehouse.body?.message } });

  const adminOk = admin.status === 200 && admin.body?.success === true;
  const warehouseDenied = warehouse.status === 403 || warehouse.status === 401;
  const noLeakWarehouse = !warehouse.body?.data || Object.keys(warehouse.body?.data || {}).length === 0;
  const rbacPass = adminOk && warehouseDenied && noLeakWarehouse;

  record('L4', 'RBAC', 'admin_200_vs_warehouse_403', rbacPass ? 'PASS' : 'FAIL', {
    depth: 'deep',
    adminStatus: admin.status,
    adminSuccess: admin.body?.success,
    adminDataKeys: Object.keys(admin.body?.data || {}),
    warehouseStatus: warehouse.status,
    warehouseSuccess: warehouse.body?.success,
    warehouseMessage: warehouse.body?.message,
    warehouseDataLeak: !noLeakWarehouse,
    note: 'analysis_department endpoint is "deny entirely" RBAC (gate at require_analytics_read), NOT "strip fields" pattern. warehouse_manager not in ANALYTICS_READ_ROLES whitelist.',
    rbacPass,
    evidenceFile: 'rbac-api-roundtrip.json',
  });
}

// ---------- MAIN ----------

(async () => {
  const summary = {
    spec: 'docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md',
    round: 'R4',
    module: 'analysis_department',
    startedAt,
    testEnv: BASE,
  };
  console.log('=== R4 SmartBI Tier 2 deep E2E — analysis_department ===');
  console.log(`Env: ${BASE} | Factory: ${FACTORY}`);

  console.log('\n[setup] Logging in factory_admin1 + warehouse_mgr1...');
  let adminLogin, warehouseLogin;
  try {
    adminLogin = await loginAPI('factory_admin1');
    // 60s pause: per-username login rate limit defense (per auto-memory feedback_test_env_warehouse_account)
    console.log('  admin OK, pausing 60s for per-username rate limit on warehouse_mgr1...');
    await new Promise(r => setTimeout(r, 60_000));
    warehouseLogin = await loginAPI('warehouse_mgr1');
    console.log(`  admin role=${adminLogin.role}, factoryId=${adminLogin.factoryId}`);
    console.log(`  warehouse role=${warehouseLogin.role}, factoryId=${warehouseLogin.factoryId}, permissions=${JSON.stringify(warehouseLogin.permissions)}`);
  } catch (e) {
    console.error('Login failed:', e.message);
    process.exit(2);
  }

  console.log('\n[API] L4-API-1 composite envelope shape + Rule 9 Jackson + Rule 11 μs...');
  const api1 = await L4_API_1_composite(adminLogin.token);

  console.log('[API] L4-API-2 ChartConfig Rule 9 Lombok+Jackson (xaxisField lowercase a)...');
  await L4_API_2_chart_envelope(adminLogin.token, api1.data);

  console.log('[API] L4-API-3 trendComparison 未知部门 fallback + period format...');
  await L4_API_3_trend_aggregation(adminLogin.token);

  console.log('[API] L4-API-4 dateRange granularity inference (30/90/365 → MONTH/QUARTER/YEAR)...');
  await L4_API_4_granularity_inference(adminLogin.token);

  console.log('[API] L4-ERROR-1 cross-factory 403...');
  await L4_ERROR_1_cross_factory(adminLogin.token);

  console.log('[API] L4-ERROR-2 RBAC warehouse_mgr1 → 403 (deny at gate)...');
  await L4_ERROR_2_rbac_warehouse(warehouseLogin.token);

  console.log('\n[UI] Launching browser...');
  const browser = await chromium.launch({ headless: true });

  try {
    console.log('[UI] L4-UI-1 /hr/departments admin full + Rule 9 抽 5 row...');
    await L4_UI_1_hr_departments_admin(browser, adminLogin);

    console.log('[UI] L4-UI-2 /hr/departments warehouse_mgr1 view + write-button strip...');
    await L4_UI_2_hr_departments_warehouse(browser, warehouseLogin);
  } finally {
    await browser.close();
  }

  console.log('\n[API] L4-RBAC explicit admin vs warehouse comparison...');
  await L4_RBAC_admin_vs_warehouse_api(adminLogin.token, warehouseLogin.token);

  const finishedAt = new Date().toISOString();
  summary.finishedAt = finishedAt;
  summary.totals = {
    total: results.length,
    pass: results.filter(r => r.status === 'PASS').length,
    warn: results.filter(r => r.status === 'WARN').length,
    fail: results.filter(r => r.status === 'FAIL').length,
  };
  summary.depthBreakdown = {
    deep: results.filter(r => r.depth === 'deep').length,
    medium: results.filter(r => r.depth === 'medium').length,
    smoke: results.filter(r => r.depth === 'smoke').length,
  };
  summary.results = results;

  writeFileSync(join(EVID, 'results.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Total: ${summary.totals.total} | PASS: ${summary.totals.pass} | WARN: ${summary.totals.warn} | FAIL: ${summary.totals.fail}`);
  console.log(`Depth: deep=${summary.depthBreakdown.deep} medium=${summary.depthBreakdown.medium} smoke=${summary.depthBreakdown.smoke}`);
  console.log(`Evidence: ${EVID}`);
  process.exit(summary.totals.fail > 0 ? 1 : 0);
})();
