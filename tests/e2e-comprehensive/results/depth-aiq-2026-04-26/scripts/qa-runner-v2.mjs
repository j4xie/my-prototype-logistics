/**
 * v2 conversation memory variant of qa-runner.mjs.
 *
 * Difference from S3 baseline:
 * - Each main (e.g. qhj-01) gets a fresh UUID session_id.
 * - The 3 followups (qhj-fu-01-1, qhj-fu-01-2, qhj-fu-01-3) are sent with the
 *   SAME session_id as the parent main, in order — so backend Phase 0 lookup
 *   loads parent context and the LLM prompt prepends "上一轮对话".
 * - Sequential per pair (main → fu1 → fu2 → fu3) so each followup sees the
 *   most recent parent state.
 *
 * Output:
 *   qa-results.v2-conv-memory.json (separate from baseline qa-results.json)
 *
 * Usage:
 *   node qa-runner-v2.mjs [tenant=qhj|gml|xmx|all] [limit=N]
 *
 * Cost estimate (full run): ~120 queries × 8s avg = 16 min runtime + ~¥0.5 LLM.
 * Smaller than baseline 270-followup-only because we re-run main+followup pairs.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ROOT = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26';
const QUESTIONS_FILE = `${ROOT}/scripts/questions.json`;
const OUTPUT_FILE = `${ROOT}/qa-results.v2-conv-memory.json`;
const API_BASE = 'http://139.196.165.140:8086';

const TENANT_AUTH = {
  qhj: { username: 'qhj_prod', factoryId: 'RES_3101_009' },
  gml: { username: 'gml_prod', factoryId: 'RES_GML_001' },
  xmx: { username: 'xmx_fresh', factoryId: 'R_XMX_FRESH' },
};

const args = process.argv.slice(2);
const tenantFilter = args[0] || 'all';
const limit = args[1] ? parseInt(args[1], 10) : null;

function login(tenant) {
  const auth = TENANT_AUTH[tenant];
  const resp = spawnSync('curl', [
    '-sS', '-X', 'POST',
    `${API_BASE}/api/mobile/auth/unified-login`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({ username: auth.username, password: '123456', factoryId: auth.factoryId }),
  ], { encoding: 'utf8' });
  try {
    const data = JSON.parse(resp.stdout);
    return data?.data?.token || data?.data?.accessToken || null;
  } catch {
    return null;
  }
}

function askQuestion(token, question, sessionId) {
  const t0 = Date.now();
  const bodyFile = join(tmpdir(), `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  // v2 change: include session_id when provided
  const payload = sessionId ? { query: question, session_id: sessionId } : { query: question };
  writeFileSync(bodyFile, JSON.stringify(payload), 'utf8');

  const resp = spawnSync('curl', [
    '-sN', '-X', 'POST',
    `${API_BASE}/smartbi-api/api/chat/general-analysis-stream`,
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'Content-Type: application/json',
    '--data-binary', `@${bodyFile}`,
    '--max-time', '60',
    '--no-buffer',
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });

  try { unlinkSync(bodyFile); } catch {}

  const totalMs = Date.now() - t0;
  const out = resp.stdout || '';
  const lines = out.split('\n');
  let answer = '';
  let source = null;
  let warning = null;
  let currentEvent = null;
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
      continue;
    }
    if (line.startsWith('data: ')) {
      const payload = line.slice(6).trim();
      let parsed;
      try { parsed = JSON.parse(payload); } catch { parsed = payload; }
      if (typeof parsed === 'string') {
        if (currentEvent === 'chunk') answer += parsed;
        else if (currentEvent === 'error') warning = (warning || '') + parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.source) source = parsed.source;
        if (parsed.warning) warning = parsed.warning;
        if (parsed.answer) answer = parsed.answer;
        if (parsed.text) answer += parsed.text;
      }
    }
  }
  return {
    totalMs,
    answerLen: answer.length,
    answer: answer.slice(0, 2000),
    source,
    warning,
    bucket: bucketize(totalMs, source),
  };
}

function bucketize(totalMs, source) {
  if (source === 'materialized_cache' && totalMs < 1000) return 'template_fast_path';
  if (totalMs < 3000) return 'cache_aggregate';
  if (totalMs < 10000) return 'llm_warm';
  if (totalMs < 30000) return 'llm_cold';
  return 'timeout_or_slow';
}

(async () => {
  const questions = JSON.parse(readFileSync(QUESTIONS_FILE, 'utf8'));
  const results = existsSync(OUTPUT_FILE)
    ? JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))
    : { timestamp: new Date().toISOString(), variant: 'v2-conv-memory', tenants: {} };

  const tenants = tenantFilter === 'all' ? ['qhj', 'gml', 'xmx'] : [tenantFilter];

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant} (v2 conv memory) ===`);
    const token = login(tenant);
    if (!token) {
      console.log(`  Login failed`);
      continue;
    }
    console.log(`  Login OK`);

    if (!results.tenants[tenant]) {
      results.tenants[tenant] = { main: [], followup: [], pairs: [] };
    }

    // Build map mainId → [followups...]
    const mainsAll = questions[tenant].main || [];
    const fusAll = questions[tenant].followup || [];
    const mains = limit ? mainsAll.slice(0, limit) : mainsAll;
    const fuByParent = {};
    for (const fu of fusAll) {
      // id like qhj-fu-01-1 → parentId qhj-01
      const m = fu.id.match(/^(\w+)-fu-(\d+)-\d+$/);
      if (!m) continue;
      const parentId = `${m[1]}-${m[2]}`;
      if (!fuByParent[parentId]) fuByParent[parentId] = [];
      fuByParent[parentId].push(fu);
    }

    for (let i = 0; i < mains.length; i++) {
      const m = mains[i];
      const sessionId = randomUUID();
      const askedAt = new Date().toISOString();

      // Main turn
      process.stdout.write(`  [${i + 1}/${mains.length}] ${m.id} (sid=${sessionId.slice(0, 8)}) main: ${m.q.slice(0, 25)}... `);
      const mr = askQuestion(token, m.q, sessionId);
      const mainEntry = { ...m, ...mr, sessionId, askedAt };
      results.tenants[tenant].main.push(mainEntry);
      console.log(`${mr.totalMs}ms ${mr.bucket}${mr.warning ? ' ⚠️' : ''}`);
      writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

      // Followup turns (same session_id)
      const fus = fuByParent[m.id] || [];
      for (let j = 0; j < fus.length; j++) {
        const fu = fus[j];
        process.stdout.write(`    [fu ${j + 1}/${fus.length}] ${fu.id} (${fu.type}): ${fu.q.slice(0, 25)}... `);
        const fr = askQuestion(token, fu.q, sessionId);
        const fuEntry = { ...fu, ...fr, sessionId, parentId: m.id, askedAt: new Date().toISOString() };
        results.tenants[tenant].followup.push(fuEntry);
        console.log(`${fr.totalMs}ms ${fr.bucket}${fr.warning ? ' ⚠️' : ''}`);
        writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      }
    }
  }

  console.log(`\nResults: ${OUTPUT_FILE}`);
})();
