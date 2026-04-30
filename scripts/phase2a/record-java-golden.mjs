/**
 * record-java-golden.mjs
 *
 * Phase 2A T2 — Record Java SmartBI golden samples for 50 endpoints.
 * Results saved to tests/fixtures/java-smartbi-golden/<name>-<factory>.json
 *
 * Usage:
 *   node scripts/phase2a/record-java-golden.mjs \
 *     --base http://47.100.235.168:10011 \
 *     --user factory_admin1 \
 *     --password 123456 \
 *     --factory F001
 *
 * Or via SSH tunnel (firewalled envs):
 *   ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
 *   node scripts/phase2a/record-java-golden.mjs --base http://localhost:10011 ...
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  return {
    base: get('--base') || 'http://localhost:10011',
    user: get('--user') || 'factory_admin1',
    password: get('--password') || '123456',
    factory: get('--factory') || 'F001',
    outDir: get('--out') || path.join(REPO_ROOT, 'tests/fixtures/java-smartbi-golden'),
    timeout: Number(get('--timeout') || 30000),
    dryRun: args.includes('--dry-run'),
  };
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function doFetch(url, opts = {}, timeoutMs = 30000) {
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;
  const reqOpts = {
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method: opts.method || 'GET',
    headers: opts.headers || {},
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(reqOpts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    if (opts.body) {
      if (typeof opts.body === 'string' || Buffer.isBuffer(opts.body)) {
        req.write(opts.body);
      }
    }
    req.end();
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(base, user, password, timeoutMs) {
  const url = `${base}/api/mobile/auth/unified-login`;
  const body = JSON.stringify({ username: user, password });
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  }, timeoutMs);

  let j;
  try { j = JSON.parse(res.body); }
  catch (e) { throw new Error(`Login non-JSON (status ${res.status}): ${res.body.slice(0, 200)}`); }

  if (!j.success) throw new Error(`Login failed: ${res.body.slice(0, 300)}`);

  const token = j.data?.accessToken || j.data?.tokens?.accessToken || j.data?.token;
  if (!token) throw new Error(`No token in login response: ${JSON.stringify(j.data)}`);
  return token;
}

// ─── Call one endpoint ────────────────────────────────────────────────────────
async function callEndpoint(base, token, endpoint, factory, timeoutMs) {
  const path = endpoint.path.replace('{factory_id}', factory).replace('{factoryId}', factory);
  // Substitute other path variables with dummy values
  const resolvedPath = path
    .replace('{datasourceId}', endpoint.datasourceId || '1')
    .replace('{templateId}', endpoint.templateId || '1')
    .replace('{uploadId}', endpoint.uploadId || '1')
    .replace('{targetType}', endpoint.targetType || 'salesperson')
    .replace('{targetId}', endpoint.targetId || 'test');

  const query = endpoint.query ? '?' + new URLSearchParams(endpoint.query).toString() : '';
  const url = `${base}${resolvedPath}${query}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  let body;
  if (endpoint.body) {
    body = JSON.stringify(endpoint.body);
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  const res = await doFetch(url, { method: endpoint.verb, headers, body }, timeoutMs);

  let json = null;
  try { json = JSON.parse(res.body); } catch { /* not JSON */ }

  return { status: res.status, json, raw: res.body.slice(0, 2000) };
}

// ─── 50 endpoint definitions ──────────────────────────────────────────────────
// path uses {factory_id} as placeholder; variables like {datasourceId} use per-endpoint overrides.
// skipIfMissing: true → record a skipped entry, do NOT call the API
// expectError: true → a non-2xx or success:false is still recorded (not marked failed)

const ENDPOINTS = [
  // ── SmartBIAnalysisController (26) ──────────────────────────────────────────
  {
    name: 'analysis-sales',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/sales',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-sales-dimension-salesperson',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/sales',
    query: { startDate: '2025-01-01', endDate: '2025-12-31', dimension: 'salesperson' },
  },
  {
    name: 'analysis-department',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/department',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-region',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/region',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-finance',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-finance-type-profit',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance',
    query: { startDate: '2025-01-01', endDate: '2025-12-31', analysisType: 'profit' },
  },
  {
    name: 'analysis-finance-type-cost',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance',
    query: { startDate: '2025-01-01', endDate: '2025-12-31', analysisType: 'cost' },
  },
  {
    name: 'analysis-finance-type-receivable',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance',
    query: { startDate: '2025-01-01', endDate: '2025-12-31', analysisType: 'receivable' },
  },
  {
    name: 'analysis-finance-budget-achievement',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance/budget-achievement',
    query: { year: '2025', metric: 'revenue' },
  },
  {
    name: 'analysis-finance-yoy-mom',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance/yoy-mom',
    query: { periodType: 'MONTH', startPeriod: '2025-01', endPeriod: '2025-12', metric: 'revenue' },
  },
  {
    name: 'analysis-finance-category-comparison',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/finance/category-comparison',
    query: { year: '2025', compareYear: '2024' },
  },
  {
    name: 'analysis-production',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/production',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-production-type-oee',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/production',
    query: { startDate: '2025-01-01', endDate: '2025-12-31', analysisType: 'oee' },
  },
  {
    name: 'analysis-quality',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/quality',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-inventory',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/inventory',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'analysis-procurement',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/procurement',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    // POST /query — NL query
    name: 'query-nl',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/query',
    body: {
      query: '本月销售总额是多少',
      context: {},
      conversationHistory: [],
    },
  },
  {
    // POST /drill-down
    name: 'drill-down',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/drill-down',
    body: {
      dimension: 'region',
      value: '华东',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      filters: {},
    },
  },
  {
    name: 'alerts',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/alerts',
  },
  {
    name: 'alerts-category-sales',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/alerts',
    query: { category: 'sales' },
  },
  {
    name: 'alerts-category-finance',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/alerts',
    query: { category: 'finance' },
  },
  {
    name: 'alerts-category-department',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/alerts',
    query: { category: 'department' },
  },
  {
    name: 'recommendations',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/recommendations',
  },
  {
    // GET /incentive-plan/{targetType}/{targetId}
    name: 'incentive-plan-salesperson',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/incentive-plan/{targetType}/{targetId}',
    targetType: 'salesperson',
    targetId: 'SP001',
  },
  {
    // POST /datasource/upload — schema detection upload (multipart); skip, needs file
    name: 'datasource-upload-schema',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/datasource/upload',
    skipIfMissing: true,
    skipReason: 'Multipart schema-detection upload requires live file; skip to avoid creating test datasources',
  },
  {
    // GET /datasource/{datasourceId}/preview — needs real datasourceId
    name: 'datasource-preview',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/datasource/{datasourceId}/preview',
    datasourceId: '1',
    expectError: true,  // likely 404 or error if no datasource 1
  },
  {
    // POST /datasource/apply — write op, skip
    name: 'datasource-apply',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/datasource/apply',
    skipIfMissing: true,
    skipReason: 'DDL write op — skip to avoid schema mutations in test env',
  },
  {
    name: 'datasource-list',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/datasource/list',
  },
  {
    // GET /datasource/{datasourceId}/fields
    name: 'datasource-fields',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/datasource/{datasourceId}/fields',
    datasourceId: '1',
    expectError: true,
  },
  {
    // GET /datasource/{datasourceId}/history
    name: 'datasource-history',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/datasource/{datasourceId}/history',
    datasourceId: '1',
    expectError: true,
  },
  {
    name: 'query-templates',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/query-templates',
  },
  {
    // POST /query-templates — write op, skip
    name: 'query-templates-create',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/query-templates',
    skipIfMissing: true,
    skipReason: 'Creates persistent data in test DB — skip in golden recording pass',
  },
  {
    // PUT /query-templates/{templateId} — write op, skip
    name: 'query-templates-update',
    verb: 'PUT',
    path: '/api/mobile/{factory_id}/smart-bi/query-templates/{templateId}',
    templateId: '1',
    skipIfMissing: true,
    skipReason: 'Mutates template data — skip in golden recording pass',
  },
  {
    // DELETE /query-templates/{templateId} — destructive, skip
    name: 'query-templates-delete',
    verb: 'DELETE',
    path: '/api/mobile/{factory_id}/smart-bi/query-templates/{templateId}',
    templateId: '1',
    skipIfMissing: true,
    skipReason: 'Destructive op — skip in golden recording pass',
  },

  // ── SmartBIUploadController (13) ─────────────────────────────────────────────
  {
    // POST /upload — multipart, skip (requires file)
    name: 'upload-excel',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/upload',
    skipIfMissing: true,
    skipReason: 'Multipart file upload to Python parser — skip to avoid creating upload records',
  },
  {
    // POST /upload-and-analyze — multipart, skip
    name: 'upload-and-analyze',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/upload-and-analyze',
    skipIfMissing: true,
    skipReason: 'Multipart upload+analyze — skip to avoid creating upload records',
  },
  {
    // POST /upload/confirm — needs uploadId from previous upload
    name: 'upload-confirm',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/upload/confirm',
    body: {
      uploadId: null,
      dataType: 'sales',
      confirmedMappings: {},
      parseResponse: null,
    },
    expectError: true,  // will 400/error without real uploadId — still captures the schema
  },
  {
    // POST /sheets — multipart, skip
    name: 'upload-sheets',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/sheets',
    skipIfMissing: true,
    skipReason: 'Multipart sheet listing — skip; Apache POI only, no Python',
  },
  {
    // POST /upload-batch — multipart, skip
    name: 'upload-batch',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/upload-batch',
    skipIfMissing: true,
    skipReason: 'Multipart batch upload — skip to avoid polluting test data',
  },
  {
    // POST /upload-batch-stream — SSE, skip
    name: 'upload-batch-stream',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/upload-batch-stream',
    skipIfMissing: true,
    skipReason: 'SSE streaming batch upload — skip; SSE not compatible with JSON golden recording',
  },
  {
    // POST /retry-sheet/{uploadId} — needs real uploadId, skip
    name: 'retry-sheet',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/retry-sheet/{uploadId}',
    uploadId: '1',
    expectError: true,  // will error without real uploadId
  },
  {
    name: 'uploads',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/uploads',
    query: { page: '0', size: '20' },
  },
  {
    // GET /uploads/{uploadId}/fields — needs real uploadId
    name: 'uploads-fields',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/uploads/{uploadId}/fields',
    uploadId: '1',
    expectError: true,
  },
  {
    // GET /uploads/{uploadId}/data — needs real uploadId
    name: 'uploads-data',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/uploads/{uploadId}/data',
    uploadId: '1',
    expectError: true,
  },
  {
    name: 'uploads-missing-fields',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/uploads-missing-fields',
  },
  {
    // POST /backfill/fields/{uploadId} — write op, skip
    name: 'backfill-fields',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/backfill/fields/{uploadId}',
    uploadId: '1',
    skipIfMissing: true,
    skipReason: 'Write backfill op — skip to avoid mutating field definitions in test env',
  },
  {
    // POST /backfill/batch — write op, skip
    name: 'backfill-batch',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/backfill/batch',
    skipIfMissing: true,
    skipReason: 'Batch write op — skip to avoid mutating field definitions in test env',
  },

  // ── SmartBIDashboardController (11) ─────────────────────────────────────────
  {
    // POST /generate-adaptive-charts — needs uploadId
    name: 'generate-adaptive-charts',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/generate-adaptive-charts',
    body: {
      uploadId: 1,
      evaluateFirst: true,
      maxCharts: 3,
      fusionEnabled: false,
    },
    expectError: true,  // may fail if no upload 1 exists
  },
  {
    // POST /generate-chart — needs uploadId as query param
    name: 'generate-chart',
    verb: 'POST',
    path: '/api/mobile/{factory_id}/smart-bi/generate-chart',
    query: { uploadId: '1', chartType: 'bar' },
    expectError: true,
  },
  {
    name: 'dashboard-executive',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive',
    query: { period: 'month' },
  },
  {
    name: 'dashboard-executive-insights',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive/insights',
    query: { period: 'month' },
  },
  {
    name: 'dashboard-executive-insights-custom',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive/insights/custom',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    // GET /dashboard/executive/insights/custom/stream — SSE, skip
    name: 'dashboard-executive-insights-custom-stream',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive/insights/custom/stream',
    skipIfMissing: true,
    skipReason: 'SSE streaming endpoint — not suitable for JSON golden snapshot; use dedicated SSE test',
  },
  {
    name: 'dashboard-executive-custom',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/dashboard/executive/custom',
    query: { startDate: '2025-01-01', endDate: '2025-12-31' },
  },
  {
    name: 'data-date-range',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/data-date-range',
  },
  {
    name: 'dashboard',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/dashboard',
    query: { period: 'month' },
  },
  {
    // GET /analysis/dynamic/kpis — needs uploadId
    name: 'analysis-dynamic-kpis',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/dynamic/kpis',
    query: { uploadId: '1' },
    expectError: true,  // may fail if no upload 1
  },
  {
    // GET /analysis/dynamic — needs uploadId
    name: 'analysis-dynamic',
    verb: 'GET',
    path: '/api/mobile/{factory_id}/smart-bi/analysis/dynamic',
    query: { uploadId: '1', analysisType: 'auto' },
    expectError: true,  // may fail if no upload 1
  },
];

// ─── Validate endpoint count ──────────────────────────────────────────────────
// The T0 report lists 50 endpoints. We have more entries because some endpoints
// are recorded with multiple dimension variants. The ENDPOINTS array above targets
// all 50 distinct controller methods (some appear as multiple entries for coverage).
console.log(`Total endpoint definitions: ${ENDPOINTS.length}`);

// ─── Save fixture ─────────────────────────────────────────────────────────────
function saveFixture(outDir, name, factory, verb, resolvedPath, query, response) {
  const filename = `${name}-${factory}.json`;
  const filepath = path.join(outDir, filename);
  const meta = {
    name,
    verb,
    path: resolvedPath,
    query: query || null,
    factory,
    recordedAt: new Date().toISOString(),
    javaPort: 10011,
  };
  const fixture = {
    // Spec-required top-level fields (T5 contract test reads these)
    verb,
    path: resolvedPath,
    factory,
    response,
    // Detail metadata (recordedAt, javaPort, query, etc.)
    _meta: meta,
  };
  fs.writeFileSync(filepath, JSON.stringify(fixture, null, 2), 'utf-8');
  return filepath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const cfg = parseArgs();
  console.log(`\n=== Phase 2A T2: Java SmartBI Golden Recorder ===`);
  console.log(`Base URL : ${cfg.base}`);
  console.log(`Factory  : ${cfg.factory}`);
  console.log(`Out dir  : ${cfg.outDir}`);
  console.log(`Dry run  : ${cfg.dryRun}`);
  console.log(`Timeout  : ${cfg.timeout}ms`);
  console.log(`Endpoints: ${ENDPOINTS.length}\n`);

  // Ensure output directory exists
  fs.mkdirSync(cfg.outDir, { recursive: true });

  if (cfg.dryRun) {
    console.log('[DRY RUN] Would process:');
    for (const ep of ENDPOINTS) {
      const action = ep.skipIfMissing ? 'SKIP' : 'CALL';
      console.log(`  ${action} ${ep.verb} ${ep.path} [${ep.name}]`);
    }
    return;
  }

  // Login
  console.log(`Logging in as ${cfg.user}...`);
  let token;
  try {
    token = await login(cfg.base, cfg.user, cfg.password, cfg.timeout);
    console.log(`Login OK. Token: ${token.substring(0, 20)}...\n`);
  } catch (e) {
    console.error(`FATAL: Login failed: ${e.message}`);
    process.exit(1);
  }

  const summary = { recorded: [], skipped: [], failed: [] };

  for (let i = 0; i < ENDPOINTS.length; i++) {
    const ep = ENDPOINTS[i];
    const idx = String(i + 1).padStart(2, '0');

    if (ep.skipIfMissing) {
      console.log(`[${idx}/${ENDPOINTS.length}] SKIP  ${ep.verb} ${ep.name} — ${ep.skipReason}`);
      summary.skipped.push({ name: ep.name, verb: ep.verb, reason: ep.skipReason });
      // Save a skip marker fixture so the set is self-documenting
      saveFixture(
        cfg.outDir,
        ep.name,
        cfg.factory,
        ep.verb,
        ep.path,
        ep.query,
        { _skipped: true, reason: ep.skipReason }
      );
      continue;
    }

    process.stdout.write(`[${idx}/${ENDPOINTS.length}] CALL  ${ep.verb} ${ep.name}... `);

    try {
      const result = await callEndpoint(cfg.base, token, ep, cfg.factory, cfg.timeout);

      const isOk = result.status >= 200 && result.status < 300;
      const isExpectedError = ep.expectError && !isOk;

      // Detect HTTP 200 but success:false — possible Java bug, warn loudly
      const serverSuccessFalse = isOk && result.json && result.json.success === false && !ep.expectError;
      if (serverSuccessFalse) {
        console.warn(`\nWARN: ${ep.name} returned HTTP ${result.status} but success:false — possible Java bug`);
        console.warn(`  message: ${(result.json.message || '').slice(0, 100)}`);
      }

      const label = isOk ? (serverSuccessFalse ? 'OK(success:false!)' : 'OK') : (isExpectedError ? 'ERR(expected)' : 'ERR');
      console.log(`${result.status} ${label}`);

      if (!isOk && !ep.expectError) {
        // Unexpected failure — still save fixture, mark as failed
        summary.failed.push({
          name: ep.name,
          verb: ep.verb,
          status: result.status,
          error: result.json?.message || result.raw?.slice(0, 200),
        });
      } else {
        summary.recorded.push({ name: ep.name, verb: ep.verb, status: result.status });
      }

      // Resolve path for fixture metadata
      const resolvedPath = ep.path
        .replace('{factory_id}', cfg.factory)
        .replace('{factoryId}', cfg.factory)
        .replace('{datasourceId}', ep.datasourceId || '1')
        .replace('{templateId}', ep.templateId || '1')
        .replace('{uploadId}', ep.uploadId || '1')
        .replace('{targetType}', ep.targetType || 'salesperson')
        .replace('{targetId}', ep.targetId || 'test');

      // Capture all 5 keys of Java's ApiResponse envelope (code, message,
      // data, timestamp, success) so contract tests can byte-shape compare
      // against the recorded golden. Goldens predating I-6 (Apr 29 2026)
      // omitted code+timestamp; the contract test currently hardcodes
      // code=200 for those legacy fixtures and will switch to golden-driven
      // assertions once all 56 fixtures are re-recorded.
      const responsePayload = {
        httpStatus: result.status,
        code: result.json?.code ?? null,
        success: result.json?.success ?? null,
        message: result.json?.message ?? null,
        timestamp: result.json?.timestamp ?? null,
        data: result.json?.data ?? (result.json ?? { _rawText: result.raw }),
      };
      // Flag in fixture so T5 contract test can handle success:false goldens correctly
      if (serverSuccessFalse) {
        responsePayload._serverSuccessFalse = true;
      }

      saveFixture(cfg.outDir, ep.name, cfg.factory, ep.verb, resolvedPath, ep.query, responsePayload);
    } catch (e) {
      console.log(`NETWORK_ERROR: ${e.message}`);
      summary.failed.push({
        name: ep.name,
        verb: ep.verb,
        status: 'NETWORK_ERROR',
        error: e.message,
      });
      // Save error fixture
      saveFixture(cfg.outDir, ep.name, cfg.factory, ep.verb, ep.path, ep.query, {
        _error: true,
        errorMessage: e.message,
      });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  console.log(`Recorded : ${summary.recorded.length}`);
  console.log(`Skipped  : ${summary.skipped.length}`);
  console.log(`Failed   : ${summary.failed.length}`);
  console.log(`Fixtures : ${cfg.outDir}`);

  if (summary.failed.length > 0) {
    console.log('\nFailed endpoints:');
    for (const f of summary.failed) {
      console.log(`  [${f.verb}] ${f.name} — HTTP ${f.status}: ${f.error}`);
    }
  }

  if (summary.skipped.length > 0) {
    console.log('\nSkipped endpoints:');
    for (const s of summary.skipped) {
      console.log(`  [${s.verb}] ${s.name} — ${s.reason}`);
    }
  }

  const fixtureCount = fs.readdirSync(cfg.outDir).filter(f => f.endsWith('.json')).length;
  console.log(`\nTotal JSON fixtures on disk: ${fixtureCount}`);

  // Exit 1 if too many failures
  if (summary.failed.length > 10) {
    console.error(`\nERROR: ${summary.failed.length} failures exceed threshold (10). Check connectivity and auth.`);
    process.exit(1);
  }

  return summary;
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
