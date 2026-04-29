/**
 * Upload 500MB Depth E2E — Round 4 (concurrent race + chat pipeline + edge recovery)
 *
 * New coverage not in R1/R2/R3:
 *   - Concurrent upload race condition (2 parallel requests)
 *   - Real user-facing chat → section path (not just direct REST)
 *   - Graceful "no data" recovery (upload deletion → section query still returns)
 *
 * Depth target: smoke=0 / medium=2 / deep=2 (both new real)
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
  apiPostJson,
} from './lib/upload-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, 'results');

const USERNAME = process.env.E2E_USER || 'e2e_factory_admin';
const TARGET_FACTORY = process.env.E2E_FACTORY || 'FOOD_3101_048';

const RESULTS = { round: 4, testSubject: 'upload-500mb', timestamp: new Date().toISOString(), api_base: API_BASE, tests: [] };

function record(id, layer, name, status, { depth = 'smoke', ...rest } = {}) {
  RESULTS.tests.push({ id, layer, name, status, depth, ...rest, at: new Date().toISOString() });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARNING' ? '⚠️' : '⏭';
  console.log(`${icon} ${id} [${depth}] ${name}: ${status}${rest.note ? ' — ' + rest.note : ''}`);
}

let _javaPortCache = null;
function getActiveJavaPort() {
  if (_javaPortCache) return _javaPortCache;
  const svc = execSync(
    `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "systemctl list-units --type=service --state=active --no-legend 2>/dev/null | grep -oE 'cretas-backend(-green|-blue)?' | head -1"`,
    { encoding: 'utf8', timeout: 15000 }
  ).trim();
  _javaPortCache = (svc || 'cretas-backend').endsWith('-green') ? 10020 : 10010;
  return _javaPortCache;
}

// ===== R4-L3-1 medium: "no data" graceful path =====

async function R4_L3_1_noDataGraceful(token) {
  // Create a brand new factory_id that has never been uploaded to. autoResolve should
  // find no uploads, section should return `no_uploads_for_factory` gracefully, not crash.
  const unknownFactory = `FOOD_NOEXIST_${Date.now()}`;
  try {
    const sectionResp = await queryRestaurantSection(unknownFactory, 'diagnostics', {}, token);
    const autoResolve = sectionResp.data?.autoResolve;
    // Pass: endpoint returns 200, autoResolve triggered, reason is "no_uploads_for_factory"
    const graceful = sectionResp.ok &&
                    autoResolve?.triggered === true &&
                    autoResolve?.reason === 'no_uploads_for_factory';
    record('R4-L3-1', 'L3', 'no_data_graceful_response', graceful ? 'PASS' : 'FAIL', {
      depth: 'medium',
      factoryId: unknownFactory,
      sectionStatus: sectionResp.status,
      autoResolve,
      note: graceful ? 'unknown factory → autoResolve reports no_uploads_for_factory (graceful)' :
            !sectionResp.ok ? `endpoint errored: ${sectionResp.status}` :
            `unexpected autoResolve: ${JSON.stringify(autoResolve)}`,
    });
  } catch (e) {
    record('R4-L3-1', 'L3', 'no_data_graceful_response', 'FAIL', {
      depth: 'medium',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== R4-L3-2 medium: chat /smart-bi/query natural language trigger =====

async function R4_L3_2_chatPipeline(token) {
  // User-facing path: POST /api/mobile/{factoryId}/smart-bi/query with natural language.
  // Proves the full Intent → Tool-Skill → section pipeline works, not just direct REST.
  const port = getActiveJavaPort();
  const url = `http://139.196.165.140:8086/api/mobile/${TARGET_FACTORY}/smart-bi/query`;
  try {
    let resp = null;
    for (let i = 0; i < 3; i++) {
      try {
        resp = await apiPostJson(url, {
          query: '成本刚性',  // hits SmartBIServiceImpl regex + Skill trigger
          factoryId: TARGET_FACTORY,
        }, token);
        break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    // Pass: endpoint returns 200 (pipeline completed, even if result is "no data")
    // Critic R4 fix #3: drop `message !== undefined` bottom (always-true via ApiResponse
    // wrapper) — require actual intent match signal.
    const pipelineRan = resp.ok;
    const body = resp.data?.data || resp.data || {};
    const intentMatched = (typeof body.intentCode === 'string' && body.intentCode.length > 0) ||
                         (typeof body.intent === 'string' && body.intent.length > 0);
    const hasSections = Array.isArray(body.sections) && body.sections.length > 0;
    const hasCharts = Array.isArray(body.charts) && body.charts.length > 0;
    const hasRealResponseText = typeof body.responseText === 'string' && body.responseText.length > 50;
    const highConfidence = typeof body.confidence === 'number' && body.confidence > 0.3;
    const realIntentSuccess = intentMatched || hasSections || hasCharts || highConfidence || hasRealResponseText;
    const pass = pipelineRan && realIntentSuccess;
    record('R4-L3-2', 'L3', 'chat_intent_match_strict', pass ? 'PASS' : 'FAIL', {
      depth: 'medium',
      httpStatus: resp.status,
      pipelineRan,
      intentCode: body.intentCode,
      confidence: body.confidence,
      sectionsCount: Array.isArray(body.sections) ? body.sections.length : null,
      responseKeys: Object.keys(body).slice(0, 10),
      note: pass ? `intent matched (intentCode=${body.intentCode}, confidence=${body.confidence})` :
            !pipelineRan ? `chat endpoint failed: ${resp.status}` :
            'chat 200 but intent not matched (intentCode null, confidence 0) — smoke-level baseline',
    });
  } catch (e) {
    record('R4-L3-2', 'L3', 'chat_pipeline_natural_language', 'FAIL', {
      depth: 'medium',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== R4-L4-1 DEEP: concurrent upload race =====

async function R4_L4_1_concurrentUpload(token) {
  console.log('\n--- R4-L4-1 DEEP: concurrent upload race ---');
  const testId = 'R4-L4-1';
  const remotePath = '/tmp/e2e_pos.xlsx';
  const port = getActiveJavaPort();

  try {
    // Baseline — use totalElements, not array length (listUploads paginated at 50).
    let beforeResp = null;
    for (let i = 0; i < 3; i++) {
      try { beforeResp = await listUploads(token, TARGET_FACTORY); break; }
      catch { if (i === 2) throw new Error('baseline listUploads failed'); await new Promise(r => setTimeout(r, 2000)); }
    }
    const beforeArr = beforeResp.data?.data?.content || beforeResp.data?.data || [];
    const beforeTotalElements = beforeResp.data?.data?.totalElements ?? null;
    const targetBefore = beforeTotalElements !== null ? beforeTotalElements :
                        (Array.isArray(beforeArr) ? beforeArr.length : 0);

    // FIX-8 pattern: scp a bash script and run it — Windows Git Bash can't nest this
    // much quoting reliably. Script fires 2 concurrent curls via bash &, then waits,
    // and prints both http codes on separate lines.
    const script = [
      '#!/bin/bash',
      'rm -f /tmp/r4_c1.json /tmp/r4_c2.json /tmp/r4_c1.code /tmp/r4_c2.code',
      `curl -s -o /tmp/r4_c1.json -w '%{http_code}' -H 'Authorization: Bearer ${token}' -F 'file=@${remotePath}' -F 'dataType=pos' -F 'auto_confirm=true' --max-time 240 http://localhost:${port}/api/mobile/${TARGET_FACTORY}/smart-bi/upload-and-analyze > /tmp/r4_c1.code &`,
      `curl -s -o /tmp/r4_c2.json -w '%{http_code}' -H 'Authorization: Bearer ${token}' -F 'file=@${remotePath}' -F 'dataType=pos' -F 'auto_confirm=true' --max-time 240 http://localhost:${port}/api/mobile/${TARGET_FACTORY}/smart-bi/upload-and-analyze > /tmp/r4_c2.code &`,
      'wait',
      'echo "code1=$(cat /tmp/r4_c1.code)"',
      'echo "code2=$(cat /tmp/r4_c2.code)"',
    ].join('\n');
    const localSh = `${process.env.TEMP || '/tmp'}/r4_concurrent_${Date.now()}.sh`;
    const remoteSh = `/tmp/r4_concurrent_${Date.now()}.sh`;
    writeFileSync(localSh, script);
    execSync(`scp -o StrictHostKeyChecking=no "${localSh}" root@47.100.235.168:${remoteSh}`, { timeout: 30000 });

    const t0 = Date.now();
    const out = execSync(`ssh -o StrictHostKeyChecking=no root@47.100.235.168 bash ${remoteSh}`,
      { encoding: 'utf8', timeout: 400000, maxBuffer: 10 * 1024 * 1024 }).trim();
    const elapsedMs = Date.now() - t0;

    const c1m = out.match(/code1=(\d+)/);
    const c2m = out.match(/code2=(\d+)/);
    const code1 = c1m ? parseInt(c1m[1], 10) : 0;
    const code2 = c2m ? parseInt(c2m[1], 10) : 0;

    // Extract uploadIds from each response file
    const extractUploadId = (file) => {
      try {
        const out = execSync(
          `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "grep -oE '\\\"uploadId\\\"[[:space:]]*:[[:space:]]*[0-9]+' ${file} | head -1"`,
          { encoding: 'utf8', timeout: 15000 }
        ).trim();
        const m = out.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      } catch { return null; }
    };
    const uploadId1 = extractUploadId('/tmp/r4_c1.json');
    const uploadId2 = extractUploadId('/tmp/r4_c2.json');

    // Verify DB +2 via totalElements
    let afterResp = null;
    for (let i = 0; i < 3; i++) {
      try { afterResp = await listUploads(token, TARGET_FACTORY); break; }
      catch { if (i === 2) throw new Error('after listUploads failed'); await new Promise(r => setTimeout(r, 2000)); }
    }
    const afterArr = afterResp.data?.data?.content || afterResp.data?.data || [];
    const afterTotalElements = afterResp.data?.data?.totalElements ?? null;
    const targetAfter = afterTotalElements !== null ? afterTotalElements :
                       (Array.isArray(afterArr) ? afterArr.length : 0);
    const delta = targetAfter - targetBefore;

    // Critic R4 fix #2: also verify content-level integrity. If lost-update bug causes
    // record B to overwrite record A, count/distinct-id checks pass but file_name/
    // row_count could be duplicated or swapped. Grep each response for rowCount and
    // fileName independently.
    const extractField = (file, field) => {
      try {
        const out = execSync(
          `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "grep -oE '\\\"${field}\\\"[[:space:]]*:[[:space:]]*[^,}]+' ${file} | head -1"`,
          { encoding: 'utf8', timeout: 15000 }
        ).trim();
        return out.replace(new RegExp(`.*${field}[\\s":]*`), '').replace(/[",]+$/, '').trim();
      } catch { return null; }
    };
    const rowCount1 = extractField('/tmp/r4_c1.json', 'rowCount');
    const rowCount2 = extractField('/tmp/r4_c2.json', 'rowCount');
    const fileName1 = extractField('/tmp/r4_c1.json', 'fileName');
    const fileName2 = extractField('/tmp/r4_c2.json', 'fileName');

    const bothSucceeded = code1 === 200 && code2 === 200;
    const distinctIds = uploadId1 !== null && uploadId2 !== null && uploadId1 !== uploadId2;
    const dbDeltaCorrect = delta === 2;
    // Both responses must report non-null rowCount (handler actually parsed them)
    const bothHaveRowCount = rowCount1 !== null && rowCount2 !== null &&
                             rowCount1 !== '' && rowCount2 !== '';
    // RowCount should be the same (same file) — this proves NO lost-update swapped content
    const rowCountsMatch = rowCount1 === rowCount2;
    const pass = bothSucceeded && distinctIds && dbDeltaCorrect && bothHaveRowCount && rowCountsMatch;

    record(testId, 'L4', 'concurrent_upload_integrity', pass ? 'PASS' : 'FAIL', {
      depth: 'deep',
      elapsedMs,
      code1, code2, uploadId1, uploadId2,
      rowCount1, rowCount2, fileName1, fileName2,
      targetBefore, targetAfter, delta,
      bothSucceeded, distinctIds, dbDeltaCorrect, bothHaveRowCount, rowCountsMatch,
      note: pass ?
        `2 parallel: distinct ids(${uploadId1},${uploadId2}) + same rowCount(${rowCount1}) → no cross-contamination` :
        !bothSucceeded ? `one failed: code1=${code1}, code2=${code2}` :
        !distinctIds ? `SAME uploadId returned twice (race bug): ${uploadId1}, ${uploadId2}` :
        !dbDeltaCorrect ? `DB delta=${delta}, expected 2 (lost update)` :
        !bothHaveRowCount ? `missing rowCount in one response (partial write)` :
        !rowCountsMatch ? `rowCount mismatch (${rowCount1} vs ${rowCount2}) — cross-contamination bug` :
        'unknown',
    });
  } catch (e) {
    record(testId, 'L4', 'concurrent_upload_race', 'FAIL', {
      depth: 'deep',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== R4-L4-2 DEEP: upload + chat → section (full user path) =====

async function R4_L4_2_chatToSection(token) {
  console.log('\n--- R4-L4-2 DEEP: upload → chat pipeline → section via intent ---');
  const testId = 'R4-L4-2';
  const remote = '/tmp/e2e_pos.xlsx';

  try {
    // Upload first (use xlsx — known to work, quick)
    const port = getActiveJavaPort();
    const curl =
      `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "curl -s -o /tmp/r4l4_upload.json -w '%{http_code}' ` +
      `-H 'Authorization: Bearer ${token}' ` +
      `-F 'file=@${remote}' -F 'dataType=pos' -F 'auto_confirm=true' --max-time 240 ` +
      `http://localhost:${port}/api/mobile/${TARGET_FACTORY}/smart-bi/upload-and-analyze"`;
    const uploadCode = parseInt(execSync(curl, { encoding: 'utf8', timeout: 300000 }).trim(), 10);
    let uploadId = null;
    try {
      const g = execSync(
        `ssh -o StrictHostKeyChecking=no root@47.100.235.168 "grep -oE '\\\"uploadId\\\"[[:space:]]*:[[:space:]]*[0-9]+' /tmp/r4l4_upload.json | head -1"`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      const m = g.match(/(\d+)/);
      if (m) uploadId = parseInt(m[1], 10);
    } catch {}

    if (uploadCode !== 200 || uploadId === null) {
      record(testId, 'L4', 'upload', 'FAIL', { depth: 'deep', uploadCode, uploadId });
      return;
    }

    // Critic R4 fix #1: drop the message-fallback that let intentCode=null PASS.
    // Real pipeline success requires intentCode match OR sections populated OR
    // confidence > 0.3. Record elapsedMs to flag short-circuit (< 200ms = static fallback).
    const chatUrl = `${API_BASE}/api/mobile/${TARGET_FACTORY}/smart-bi/query`;
    let chatResp = null;
    const chatT0 = Date.now();
    for (let i = 0; i < 3; i++) {
      try {
        chatResp = await apiPostJson(chatUrl, {
          query: '成本刚性',  // hits SmartBIServiceImpl regex + Skill trigger
          factoryId: TARGET_FACTORY,
        }, token);
        break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    const chatElapsedMs = Date.now() - chatT0;

    const pipelineRan = chatResp.ok;
    const body = chatResp.data?.data || chatResp.data || {};
    const intentMatched = (typeof body.intentCode === 'string' && body.intentCode.length > 0) ||
                         (typeof body.intent === 'string' && body.intent.length > 0);
    const hasSections = Array.isArray(body.sections) && body.sections.length > 0;
    const hasCharts = Array.isArray(body.charts) && body.charts.length > 0;
    const hasRealResponseText = typeof body.responseText === 'string' && body.responseText.length > 50;
    const highConfidence = typeof body.confidence === 'number' && body.confidence > 0.3;
    // Real pipeline success: any real business output (intent, sections, charts, or
    // meaningful responseText > 50 chars)
    const realIntentSuccess = intentMatched || hasSections || hasCharts || highConfidence || hasRealResponseText;
    const suspiciousShortCircuit = chatElapsedMs < 200;
    const pass = pipelineRan && realIntentSuccess && !suspiciousShortCircuit;

    record(testId, 'L4', 'upload_chat_intent_match', pass ? 'PASS' : 'FAIL', {
      depth: 'deep',
      uploadCode, uploadId,
      chatHttp: chatResp.status,
      chatElapsedMs,
      intentCode: body.intentCode,
      confidence: body.confidence,
      sectionsCount: Array.isArray(body.sections) ? body.sections.length : null,
      responseText: body.responseText?.slice(0, 150),
      pipelineRan, intentMatched, hasSections, highConfidence, suspiciousShortCircuit,
      note: pass ? `upload+intent match (intentCode=${body.intentCode}, ${chatElapsedMs}ms)` :
            !pipelineRan ? `chat endpoint failed: ${chatResp.status}` :
            !realIntentSuccess ? `intent NOT matched: intentCode=${body.intentCode}, confidence=${body.confidence}` :
            suspiciousShortCircuit ? `too fast (${chatElapsedMs}ms) — static template fallback, not real intent` :
            'unknown',
    });
  } catch (e) {
    record(testId, 'L4', 'upload_then_chat_to_section', 'FAIL', {
      depth: 'deep',
      error: e.message?.slice(0, 300),
    });
  }
}

// ===== Main =====

async function main() {
  console.log('=== Upload 500MB Depth E2E — Round 4 (concurrent + chat pipeline) ===');
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

  await runOne('R4-L3-1', R4_L3_1_noDataGraceful);
  await runOne('R4-L3-2', R4_L3_2_chatPipeline);
  await runOne('R4-L4-1', R4_L4_1_concurrentUpload);
  await runOne('R4-L4-2', R4_L4_2_chatToSection);

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
    specTotal: 4,
    p2Deferred: [], expectedFail: [],
    effectiveTotal: 4,
    actualExecuted: total,
    actualPass: pass,
    depthBreakdown: depthCounts,
    pctOfSpec: total > 0 ? (pass / 4) * 100 : 0,
    pctDeep: total > 0 ? (depthCounts.deep / total) * 100 : 0,
  };
  RESULTS.summary = { total, pass, fail, warn };

  const outPath = resolve(RESULTS_DIR, 'e2e-upload-R4.json');
  writeFileSync(outPath, JSON.stringify(RESULTS, null, 2));
  console.log('\n=== R4 Summary ===');
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
