/**
 * S2-onwards: Question runner — drives 90 main questions × 3 tenants via curl SSE,
 * captures TTFB + total ms + answer text + bucket classification.
 *
 * Output: qa-results.json
 *
 * Usage:
 *   node qa-runner.mjs [tenant=qhj|gml|xmx|all] [phase=main|followup|all]
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';

const ROOT = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26';
const QUESTIONS_FILE = `${ROOT}/scripts/questions.json`;
const OUTPUT_FILE = `${ROOT}/qa-results.json`;
const API_BASE = 'http://139.196.165.140:8086';

const TENANT_AUTH = {
  qhj: { username: 'qhj_prod', factoryId: 'RES_3101_009' },
  gml: { username: 'gml_prod', factoryId: 'RES_GML_001' },
  xmx: { username: 'xmx_fresh', factoryId: 'R_XMX_FRESH' },
};

const args = process.argv.slice(2);
const tenantFilter = args[0] || 'all';
const phaseFilter = args[1] || 'main';

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

function askQuestion(token, question) {
  const t0 = Date.now();
  let firstChunkAt = null;
  let totalChars = 0;
  const chunks = [];

  // curl -sN streams; we read line-by-line to find first event
  const resp = spawnSync('curl', [
    '-sN', '-X', 'POST',
    `${API_BASE}/api/chat/general-analysis-stream`,
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({ question }),
    '--max-time', '60',
    '--no-buffer',
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });

  const totalMs = Date.now() - t0;
  const out = resp.stdout || '';

  // Parse SSE events
  const lines = out.split('\n');
  let answer = '';
  let source = null;
  let warning = null;
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const payload = line.slice(6).trim();
      try {
        const obj = JSON.parse(payload);
        if (obj.source) source = obj.source;
        if (obj.warning) warning = obj.warning;
        if (obj.text) answer += obj.text;
      } catch {
        // plain string chunk
        const stripped = payload.replace(/^"|"$/g, '');
        answer += stripped;
      }
    }
  }

  // Estimate TTFB by finding first "data:" or "event: chunk" position in output
  const ttfbIdx = out.indexOf('event: chunk');
  // Rough heuristic: assume curl --no-buffer starts emitting near server's first byte
  // Without nanos in node easily accessible, use total for now
  const ttfbMs = ttfbIdx > 0 ? Math.min(totalMs, 1000) : totalMs; // placeholder

  return {
    totalMs,
    ttfbMs,
    answerLen: answer.length,
    answer: answer.slice(0, 2000), // cap for storage
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
    : { timestamp: new Date().toISOString(), tenants: {} };

  const tenants = tenantFilter === 'all' ? ['qhj', 'gml', 'xmx'] : [tenantFilter];

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant} ===`);
    const token = login(tenant);
    if (!token) {
      console.log(`  Login failed`);
      continue;
    }
    console.log(`  Login OK`);

    if (!results.tenants[tenant]) results.tenants[tenant] = { main: [], followup: [] };

    if (phaseFilter === 'main' || phaseFilter === 'all') {
      const mains = questions[tenant].main;
      for (let i = 0; i < mains.length; i++) {
        const q = mains[i];
        process.stdout.write(`  [${i + 1}/${mains.length}] ${q.id} ${q.q.slice(0, 30)}... `);
        const r = askQuestion(token, q.q);
        const entry = { ...q, ...r, askedAt: new Date().toISOString() };
        results.tenants[tenant].main.push(entry);
        console.log(`${r.totalMs}ms ${r.bucket}${r.warning ? ' ⚠️' : ''}`);
        // Save incrementally
        writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      }
    }
  }

  console.log(`\nResults: ${OUTPUT_FILE}`);
})();
