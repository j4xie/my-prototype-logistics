/**
 * Resume runner: re-run xmx 28-30 mains + their 9 followups that didn't
 * persist in the original v2 batch (likely race with concurrent reads).
 */
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const ROOT = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26';
const QUESTIONS_FILE = `${ROOT}/scripts/questions.json`;
const OUTPUT_FILE = `${ROOT}/qa-results.v2-conv-memory.json`;
const API_BASE = 'http://139.196.165.140:8086';
const TENANT_AUTH = { xmx: { username: 'xmx_fresh', factoryId: 'R_XMX_FRESH' } };

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
  } catch { return null; }
}

function ask(token, question, sessionId) {
  const t0 = Date.now();
  const bodyFile = join(tmpdir(), `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  const payload = { query: question, session_id: sessionId };
  writeFileSync(bodyFile, JSON.stringify(payload), 'utf8');
  const resp = spawnSync('curl', [
    '-sN', '-X', 'POST',
    `${API_BASE}/smartbi-api/api/chat/general-analysis-stream`,
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'Content-Type: application/json',
    '--data-binary', `@${bodyFile}`,
    '--max-time', '60', '--no-buffer',
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  try { unlinkSync(bodyFile); } catch {}
  const totalMs = Date.now() - t0;
  const out = resp.stdout || '';
  const lines = out.split('\n');
  let answer = '', source = null, warning = null, currentEvent = null;
  for (const line of lines) {
    if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue; }
    if (line.startsWith('data: ')) {
      const p = line.slice(6).trim();
      let parsed; try { parsed = JSON.parse(p); } catch { parsed = p; }
      if (typeof parsed === 'string') {
        if (currentEvent === 'chunk') answer += parsed;
        else if (currentEvent === 'error') warning = (warning || '') + parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.source) source = parsed.source;
        if (parsed.warning) warning = parsed.warning;
        if (parsed.answer) answer = parsed.answer;
      }
    }
  }
  const bucket = (source === 'materialized_cache' && totalMs < 1000) ? 'template_fast_path'
    : totalMs < 3000 ? 'cache_aggregate'
    : totalMs < 10000 ? 'llm_warm'
    : totalMs < 30000 ? 'llm_cold' : 'timeout_or_slow';
  return { totalMs, answerLen: answer.length, answer: answer.slice(0, 2000), source, warning, bucket };
}

(async () => {
  const questions = JSON.parse(readFileSync(QUESTIONS_FILE, 'utf8'));
  const results = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));

  const token = login('xmx');
  console.log('Login:', token ? 'OK' : 'FAIL');
  if (!token) return;

  const fuByParent = {};
  for (const fu of (questions.xmx.followup || [])) {
    const m = fu.id.match(/^(\w+)-fu-(\d+)-\d+$/);
    if (m) {
      const pid = `${m[1]}-${m[2]}`;
      if (!fuByParent[pid]) fuByParent[pid] = [];
      fuByParent[pid].push(fu);
    }
  }

  const TARGETS = ['xmx-28', 'xmx-29', 'xmx-30'];
  for (const mainId of TARGETS) {
    const m = questions.xmx.main.find(x => x.id === mainId);
    if (!m) { console.log(`SKIP ${mainId} (not found)`); continue; }
    // Skip if already in results
    const already = results.tenants.xmx.main.find(x => x.id === mainId);
    if (already) { console.log(`SKIP ${mainId} already present`); continue; }

    const sessionId = randomUUID();
    process.stdout.write(`${mainId} (sid=${sessionId.slice(0, 8)}) main: ${m.q.slice(0, 25)}... `);
    const mr = ask(token, m.q, sessionId);
    results.tenants.xmx.main.push({ ...m, ...mr, sessionId, askedAt: new Date().toISOString() });
    console.log(`${mr.totalMs}ms ${mr.bucket}`);

    const fus = fuByParent[mainId] || [];
    for (let i = 0; i < fus.length; i++) {
      const fu = fus[i];
      if (results.tenants.xmx.followup.find(x => x.id === fu.id)) continue;
      process.stdout.write(`  fu ${i + 1}/${fus.length} ${fu.id}: ${fu.q.slice(0, 25)}... `);
      const fr = ask(token, fu.q, sessionId);
      results.tenants.xmx.followup.push({ ...fu, ...fr, sessionId, parentId: mainId, askedAt: new Date().toISOString() });
      console.log(`${fr.totalMs}ms ${fr.bucket}`);
    }
    writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  }
  console.log('\nDONE');
})();
