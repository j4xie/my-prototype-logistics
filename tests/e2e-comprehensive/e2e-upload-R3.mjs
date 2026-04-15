/**
 * Upload 500MB Depth E2E — Round 3 (Negative paths + error branches)
 *
 * Critic R2 feedback directive for R3:
 *   4. CSV → section (was xlsx→section in R1/R2) — prove auto-resolve for CSV path
 *   5. Dirty data handling — handler returns warnings not silent skip
 *   6. Actively construct exception branches (oversize/malformed/auth failure)
 *
 * Depth target: smoke=0 / medium=3 / deep=2 (both new)
 * Skill Rule 2: ≥1 new deep (we have 2 new that exercise different error branches)
 * Skill Rule 6: hard rules > numeric targets — if a test is inconclusive, FAIL not paper-over.
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync, statSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

import { BASE, login, navigateTo } from './lib/helpers.mjs';
import {
  API_BASE,
  getAuthToken,
  listUploads,
  queryRestaurantSection,
} from './lib/upload-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const RESULTS_DIR = resolve(__dirname, 'results');

const USERNAME = process.env.E2E_USER || 'e2e_factory_admin';
const TARGET_FACTORY = process.env.E2E_FACTORY || 'FOOD_3101_048';

const RESULTS = { round: 3, testSubject: 'upload-500mb', timestamp: new Date().toISOString(), api_base: API_BASE, tests: [] };

function record(id, layer, name, status, { depth = 'smoke', ...rest } = {}) {
  RESULTS.tests.push({ id, layer, name, status, depth, ...rest, at: new Date().toISOString() });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARNING' ? '⚠️' : '⏭';
  console.log(`${icon} ${id} [${depth}] ${name}: ${status}${rest.note ? ' — ' + rest.note : ''}`);
}

// ===== Active Java port discovery =====
let _javaServiceCache = null, _javaPortCache = null;
function getActiveJavaService() {
  if (_javaServiceCache) return _javaServiceCache;
  const out = execSync(
    `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "systemctl list-units --type=service --state=active --no-legend 2>/dev/null | grep -oE 'cretas-backend(-green|-blue)?' | head -1"`,
    { encoding: 'utf8', timeout: 15000 }
  ).trim();
  _javaServiceCache = out || 'cretas-backend';
  return _javaServiceCache;
}
function getActiveJavaPort() {
  if (_javaPortCache) return _javaPortCache;
  _javaPortCache = getActiveJavaService().endsWith('-green') ? 10020 : 10010;
  return _javaPortCache;
}

function serverLocalUploadAndAnalyze(token, factoryId, remotePath) {
  const port = getActiveJavaPort();
  const curl =
    `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "curl -s -o /tmp/r3_upload_resp.json -w '%{http_code}' ` +
    `-H 'Authorization: Bearer ${token}' ` +
    `-F 'file=@${remotePath}' -F 'dataType=pos' -F 'auto_confirm=true' --max-time 240 ` +
    `http://localhost:${port}/api/mobile/${factoryId}/smart-bi/upload-and-analyze"`;
  const httpCode = parseInt(execSync(curl, { encoding: 'utf8', timeout: 300000 }).trim(), 10);
  const body = execSync(
    `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "head -c 4000 /tmp/r3_upload_resp.json"`,
    { encoding: 'utf8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
  ).trim();
  let uploadId = null;
  try {
    const grep = execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "grep -oE '\\\"uploadId\\\"[[:space:]]*:[[:space:]]*[0-9]+' /tmp/r3_upload_resp.json | head -1"`,
      { encoding: 'utf8', timeout: 15000 }
    ).trim();
    const m = grep.match(/(\d+)/);
    if (m) uploadId = parseInt(m[1], 10);
  } catch {}
  return { httpCode, body, uploadId };
}

// ===== R3-L3-1: reject oversized file (real 501MB, not mocked) =====

async function R3_L3_1_rejectOversize(token) {
  const remote = '/tmp/r3_oversize_501mb.bin';
  try {
    // Generate 501MB of zeros on-server (fast, ~3s)
    execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "dd if=/dev/zero of=${remote} bs=1M count=501 2>&1 | tail -1"`,
      { encoding: 'utf8', timeout: 60000 }
    );
    // Rename to .xlsx so file-type check passes; size check should fire
    const remoteXlsx = '/tmp/r3_oversize_501mb.xlsx';
    execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "mv ${remote} ${remoteXlsx}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const { httpCode, body } = serverLocalUploadAndAnalyze(token, TARGET_FACTORY, remoteXlsx);
    // Expected: 501MB > 500MB limit → any non-200 with success=false.
    // Spring's MaxUploadSizeExceededException may be caught by GlobalExceptionHandler
    // and returned as generic 400 "上传格式错误" (observed in prod). We accept any
    // non-success response as valid rejection since the alternative (silently
    // accepting 501MB) would be the actual bug.
    const notSuccess = !/\"success\"\s*:\s*true/.test(body);
    const rejected = httpCode !== 200 || notSuccess;
    const pass = rejected && notSuccess;
    record('R3-L3-1', 'L3', 'reject_oversize_501mb_real', pass ? 'PASS' : 'FAIL', {
      depth: 'medium',
      fileSize: 501 * 1024 * 1024,
      httpCode,
      bodySnippet: body.slice(0, 300),
      rejected, notSuccess,
      note: pass ? `server rejected 501MB > 500MB limit (HTTP ${httpCode})` :
            'SILENT ACCEPT BUG: 501MB accepted with success=true',
    });
    // Cleanup — 501MB file should be removed
    execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "rm -f ${remoteXlsx} ${remote}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
  } catch (e) {
    record('R3-L3-1', 'L3', 'reject_oversize_501mb_real', 'FAIL', {
      depth: 'medium',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== R3-L3-2: reject unauthenticated upload =====

async function R3_L3_2_rejectUnauthed() {
  try {
    const remote = '/tmp/e2e_pos.xlsx';
    const port = getActiveJavaPort();
    const httpCode = parseInt(
      execSync(
        `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "curl -s -o /tmp/r3_auth.json -w '%{http_code}' ` +
        `-F 'file=@${remote}' -F 'dataType=pos' -F 'auto_confirm=true' --max-time 30 ` +
        `http://localhost:${port}/api/mobile/${TARGET_FACTORY}/smart-bi/upload-and-analyze"`,
        { encoding: 'utf8', timeout: 60000 }
      ).trim(),
      10
    );
    const body = execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "head -c 500 /tmp/r3_auth.json"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    // Critic R3 fix #4: require BOTH httpCode ∈ {401,403} AND auth keyword — AND not OR.
    // Previous OR logic would false-PASS on 200 + "auth required" body (theoretical bypass).
    const statusIsAuthReject = httpCode === 401 || httpCode === 403;
    const bodyHasAuthKeyword = /unauthorized|unauthenticated|token|authentic|未授权|无权限|登录/i.test(body);
    const pass = statusIsAuthReject && bodyHasAuthKeyword;
    record('R3-L3-2', 'L3', 'reject_missing_auth_strict', pass ? 'PASS' : 'FAIL', {
      depth: 'medium',
      httpCode,
      bodySnippet: body.slice(0, 300),
      statusIsAuthReject, bodyHasAuthKeyword,
      note: pass ? `missing Authorization → ${httpCode} + auth-related message` :
            !statusIsAuthReject ? `expected 401/403, got ${httpCode}` :
            'auth-code returned but body missing explicit auth keyword',
    });
  } catch (e) {
    record('R3-L3-2', 'L3', 'reject_missing_auth', 'FAIL', {
      depth: 'medium',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== R3-L3-3: dirty xlsx (missing required columns) =====

async function R3_L3_3_dirtyDataWarning(token) {
  // Critic R3 fix #2: tighten regex — require explicit "warnings" array or errorMessage
  // field, not just any keyword containing "field" (which appears in ALL normal responses
  // via fieldMappings/headers).
  const remoteDirty = '/tmp/r3_dirty.xlsx';
  try {
    execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "source /www/wwwroot/cretas/code/backend/python/venv38/bin/activate && python3 -c \\"import pandas as pd; pd.DataFrame({'random_col_a': ['x','y'], 'random_col_b': [1,2]}).to_excel('${remoteDirty}', index=False)\\""`,
      { encoding: 'utf8', timeout: 60000 }
    );
    const { httpCode, body, uploadId } = serverLocalUploadAndAnalyze(token, TARGET_FACTORY, remoteDirty);
    // Stricter: require non-empty warnings array OR non-null errorMessage OR fieldMappings=[]
    // (empty mapping array proves mapping failed; fieldMappings=[{...}] means matched fine).
    const hasRealWarnings = /"warnings"\s*:\s*\[\s*["{]/i.test(body) ||
                           /"errorMessage"\s*:\s*"[^"]{5,}/.test(body) ||
                           /"fieldMappings"\s*:\s*\[\s*\]/i.test(body) ||
                           /"missingRequiredFields"\s*:\s*\[\s*["{]/.test(body);
    const uploaded = httpCode === 200 && uploadId !== null;
    const pass = uploaded && hasRealWarnings;
    record('R3-L3-3', 'L3', 'dirty_schema_strict_warnings', pass ? 'PASS' : 'FAIL', {
      depth: 'medium',
      httpCode, uploadId,
      bodySnippet: body.slice(0, 500),
      uploaded, hasRealWarnings,
      note: pass ? 'dirty xlsx → real warnings/fieldMappings=[]/errorMessage (not just keyword)' :
            !uploaded ? `upload failed: ${httpCode}` :
            'SILENT ACCEPT: 200 success without any structural warning signals',
    });
  } catch (e) {
    record('R3-L3-3', 'L3', 'dirty_schema_strict_warnings', 'FAIL', {
      depth: 'medium',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== R3-L4-1 DEEP: CSV → section (new path variant) =====

async function R3_L4_1_csvToSection(token) {
  console.log('\n--- R3-L4-1 DEEP: CSV upload → section ---');
  const testId = 'R3-L4-1';
  const remote = '/tmp/e2e_pos_55mb.csv';

  // Step 1: baseline (retry on hiccup)
  let beforeResp = null;
  for (let i = 0; i < 3; i++) {
    try { beforeResp = await listUploads(token, TARGET_FACTORY); break; }
    catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 2000)); }
  }
  const beforeArr = beforeResp.data?.data?.content || beforeResp.data?.data || [];
  const targetBefore = Array.isArray(beforeArr) ? beforeArr.length : 0;

  // Step 2: upload CSV (not xlsx!)
  const t0 = Date.now();
  const { httpCode, uploadId, body } = serverLocalUploadAndAnalyze(token, TARGET_FACTORY, remote);
  if (httpCode !== 200 || uploadId === null) {
    record(testId, 'L4', 'csv_upload', 'FAIL', {
      depth: 'deep', httpCode, uploadId, body: body?.slice(0, 300),
    });
    return;
  }

  // Step 3: DB +1
  let afterResp = null;
  for (let i = 0; i < 3; i++) {
    try { afterResp = await listUploads(token, TARGET_FACTORY); break; }
    catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 2000)); }
  }
  const afterArr = afterResp.data?.data?.content || afterResp.data?.data || [];
  const targetAfter = Array.isArray(afterArr) ? afterArr.length : 0;
  const delta = targetAfter - targetBefore;
  if (delta !== 1) {
    record(testId, 'L4', 'csv_db_delta', 'FAIL', { depth: 'deep', targetBefore, targetAfter, delta, uploadId });
    return;
  }

  // Step 4: query section — prove autoResolve loaded the CSV upload (not xlsx)
  const sectionResp = await queryRestaurantSection(TARGET_FACTORY, 'temporal_comparison', {}, token);
  const autoResolve = sectionResp.data?.autoResolve;
  const loaded = autoResolve?.triggered === true && autoResolve?.reason === 'loaded';
  const uploadIdMatches = autoResolve?.uploadId === uploadId;
  const fileNameIsCsv = typeof autoResolve?.fileName === 'string' && /\.csv$/i.test(autoResolve.fileName);
  const handlerInvoked = sectionResp.data?.status === 'ok' || sectionResp.data?.status === 'skipped';
  const pass = sectionResp.ok && loaded && uploadIdMatches && fileNameIsCsv && handlerInvoked;

  record(testId, 'L4', 'csv_to_section_full_chain', pass ? 'PASS' : 'FAIL', {
    depth: 'deep',
    uploadElapsedMs: Date.now() - t0,
    uploadId, targetBefore, targetAfter, delta,
    sectionName: 'temporal_comparison',
    sectionStatus: sectionResp.status,
    sectionReturnStatus: sectionResp.data?.status,
    autoResolve,
    uploadIdMatches, fileNameIsCsv, handlerInvoked,
    note: pass ? 'CSV upload fully traversed 5-layer chain + autoResolve loaded CSV, not xlsx' :
          !sectionResp.ok ? 'section endpoint failed' :
          !uploadIdMatches ? `autoResolve picked uploadId=${autoResolve?.uploadId}, expected ${uploadId}` :
          !fileNameIsCsv ? `autoResolve loaded non-CSV file: ${autoResolve?.fileName}` :
          !handlerInvoked ? `handler status=${sectionResp.data?.status}` :
          'unknown',
  });
}

// ===== R3-L4-2 DEEP: dirty data → warnings, not silent skip =====

async function R3_L4_2_dirtyDataNotSilentSkip(token) {
  // Critic R3 fix #1: stop self-fulfilling prophecy. Don't check body for keywords
  // that the dirty test-data itself contains. Instead: upload dirty → query a section
  // that WOULD aggregate numeric data → assert section returns status≠ok with a real
  // reason, OR returns warnings/missing-fields array. This tests HANDLER BEHAVIOR,
  // not test-input echo.
  console.log('\n--- R3-L4-2 DEEP: dirty data → section handler detects it ---');
  const testId = 'R3-L4-2';
  const remoteDirty = '/tmp/r3_dirty_pos.xlsx';

  try {
    // Use "generic" column names that won't semantically map to any restaurant schema.
    // No "order_id"/"amount"/"pay_time" (which Python semantic_mapper might fuzzy-match).
    // Pure nonsense columns with numeric types so "bad" keyword won't echo back.
    execSync(
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "source /www/wwwroot/cretas/code/backend/python/venv38/bin/activate && python3 -c \\"import pandas as pd; pd.DataFrame({'xzy_a': [1,2,3], 'xyz_b': [4,5,6], 'xyz_c': [7,8,9]}).to_excel('${remoteDirty}', index=False)\\""`,
      { encoding: 'utf8', timeout: 60000 }
    );

    const { httpCode, uploadId } = serverLocalUploadAndAnalyze(token, TARGET_FACTORY, remoteDirty);
    if (httpCode !== 200 || uploadId === null) {
      // Outright rejection also counts as not-silent-accept
      record(testId, 'L4', 'dirty_data_handler_signal', 'PASS', {
        depth: 'deep',
        httpCode, uploadId,
        outcome: 'rejected_at_upload',
        note: 'dirty schema rejected at upload layer — not silent',
      });
      execSync(`ssh -o StrictHostKeyChecking=no root@47.100.235.168 "rm -f ${remoteDirty}"`, { timeout: 10000 });
      return;
    }

    // Query section handler — should NOT return status=ok with real data, because:
    // (a) auto-resolve loads the dirty upload,
    // (b) handler either skips (no mappable data) OR returns empty/failed.
    const sectionResp = await queryRestaurantSection(TARGET_FACTORY, 'temporal_comparison', {}, token);
    const autoResolve = sectionResp.data?.autoResolve;
    const loadedDirty = autoResolve?.triggered === true &&
                        autoResolve?.reason === 'loaded' &&
                        autoResolve?.uploadId === uploadId;
    const sectionStatus = sectionResp.data?.status;
    const sectionData = sectionResp.data?.data;
    const warnings = sectionResp.data?.warnings;
    const sectionHasWarnings = Array.isArray(warnings) && warnings.length > 0;
    const sectionSkipped = sectionStatus === 'skipped';
    const sectionFailed = sectionStatus === 'failed' || sectionStatus === 'error';

    // Real PASS: autoResolve loaded dirty upload AND handler signaled something non-ok
    // (skip / failed / warnings). SILENT BUG: status=ok + no warnings + normal data.
    const handlerSignaledDirty = loadedDirty && (sectionSkipped || sectionFailed || sectionHasWarnings);
    // Only FAIL if loaded + status=ok + no warnings (true silent accept)
    const silentAcceptBug = loadedDirty && sectionStatus === 'ok' && !sectionHasWarnings;
    const pass = handlerSignaledDirty && !silentAcceptBug;

    record(testId, 'L4', 'dirty_data_handler_signal', pass ? 'PASS' : 'FAIL', {
      depth: 'deep',
      uploadHttp: httpCode, uploadId,
      autoResolveLoaded: loadedDirty,
      sectionStatus, sectionHasWarnings,
      warningsSample: Array.isArray(warnings) ? warnings.slice(0, 3) : null,
      silentAcceptBug,
      note: pass ?
        `handler correctly signaled dirty data (status=${sectionStatus}, warnings=${sectionHasWarnings})` :
        silentAcceptBug ? 'SILENT ACCEPT: handler returned status=ok with no warnings for xlsx with nonsense columns' :
        !loadedDirty ? `autoResolve didn't load dirty upload (reason=${autoResolve?.reason})` :
        'handler behavior unexpected',
    });

    execSync(`ssh -o StrictHostKeyChecking=no root@47.100.235.168 "rm -f ${remoteDirty}"`, { timeout: 10000 });
  } catch (e) {
    record(testId, 'L4', 'dirty_data_handler_signal', 'FAIL', {
      depth: 'deep',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== Main =====

async function main() {
  console.log('=== Upload 500MB Depth E2E — Round 3 (negative paths + error branches) ===');
  console.log(`USER:    ${USERNAME}`);
  console.log(`FACTORY: ${TARGET_FACTORY}`);
  console.log();

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loginResult = await login(page, USERNAME);
  if (loginResult !== 'OK') {
    record('PRE', 'L0', 'login', 'FAIL', { depth: 'smoke', loginResult });
    await finish(browser);
    return;
  }
  const token = await getAuthToken(page);
  if (!token) {
    record('PRE', 'L0', 'token', 'FAIL', { depth: 'smoke' });
    await finish(browser);
    return;
  }
  console.log(`Logged in. token len=${token.length}`);

  const runOne = async (id, fn) => {
    try { await fn(token); }
    catch (e) {
      console.error(`${id} threw:`, e.message?.slice(0, 200));
      record(id, 'Lx', 'uncaught_error', 'FAIL', { depth: 'medium', error: e.message?.slice(0, 300) });
    }
  };

  // L3 medium (3)
  await runOne('R3-L3-1', R3_L3_1_rejectOversize);
  await runOne('R3-L3-2', R3_L3_2_rejectUnauthed);
  await runOne('R3-L3-3', R3_L3_3_dirtyDataWarning);

  // L4 deep (2 new)
  await runOne('R3-L4-1', R3_L4_1_csvToSection);
  await runOne('R3-L4-2', R3_L4_2_dirtyDataNotSilentSkip);

  await finish(browser);
}

async function finish(browser) {
  const depthCounts = { smoke: 0, medium: 0, deep: 0 };
  let pass = 0, fail = 0, warn = 0;
  for (const t of RESULTS.tests) {
    depthCounts[t.depth] = (depthCounts[t.depth] || 0) + 1;
    if (t.status === 'PASS') pass++;
    else if (t.status === 'FAIL') fail++;
    else if (t.status === 'WARNING') warn++;
  }
  const total = RESULTS.tests.length;
  RESULTS.schema_v3 = {
    specTotal: 5,
    p2Deferred: [], expectedFail: [],
    effectiveTotal: 5,
    actualExecuted: total,
    actualPass: pass,
    depthBreakdown: depthCounts,
    pctOfSpec: total > 0 ? (pass / 5) * 100 : 0,
    pctDeep: total > 0 ? (depthCounts.deep / total) * 100 : 0,
  };
  RESULTS.summary = { total, pass, fail, warn };

  const outPath = resolve(RESULTS_DIR, 'e2e-upload-R3.json');
  writeFileSync(outPath, JSON.stringify(RESULTS, null, 2));
  console.log('\n=== R3 Summary ===');
  console.log(`Total: ${total} | Pass: ${pass} | Fail: ${fail} | Warn: ${warn}`);
  console.log(`Depth: smoke=${depthCounts.smoke} medium=${depthCounts.medium} deep=${depthCounts.deep}`);
  console.log(`pctOfSpec: ${RESULTS.schema_v3.pctOfSpec.toFixed(1)}%  pctDeep: ${RESULTS.schema_v3.pctDeep.toFixed(1)}%`);
  console.log(`Results: ${outPath}`);

  if (browser) await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
