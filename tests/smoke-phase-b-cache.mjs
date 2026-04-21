// Phase B smoke: login → fire yoy query twice against upload 3970 (200K rows)
// Verify: (1) no 连接超时, (2) status heartbeats emitted, (3) 2nd call cache HIT
// Hits test env: web-admin 139:8097 → backend java 10011 + python 8084
import { performance } from 'node:perf_hooks';

const BASE = 'http://139.196.165.140:8097';
const USER = 'qhj_prod';
const PASS = '123456';
const UPLOAD_ID = '3970';
const QUERY = '进行同比和环比分析，识别增长和下降趋势';

async function login() {
  const r = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS })
  });
  if (!r.ok) throw new Error(`login ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const t = j?.data?.tokens?.accessToken || j?.data?.accessToken || j?.token;
  if (!t) throw new Error(`no token in login response: ${JSON.stringify(j).slice(0, 200)}`);
  return t;
}

async function streamQuery(token, runLabel) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/smartbi-api/api/chat/general-analysis-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({ query: QUERY, sheet_id: UPLOAD_ID })
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`${runLabel} HTTP ${r.status}: ${txt.slice(0, 300)}`);
  }

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const events = [];
  let firstChunkMs = null;
  let doneMs = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split(/\n\n/);
    buf = parts.pop() || '';
    for (const raw of parts) {
      if (!raw.trim()) continue;
      const m = raw.match(/event:\s*(\S+)\s*\ndata:\s*(.*)/s);
      if (!m) continue;
      const [, ev, data] = m;
      const tMs = Math.round(performance.now() - t0);
      events.push({ t: tMs, event: ev, data: data.slice(0, 120) });
      if (ev === 'chunk' && firstChunkMs === null) firstChunkMs = tMs;
      if (ev === 'done') doneMs = tMs;
      if (ev === 'error') throw new Error(`${runLabel} SSE error @${tMs}ms: ${data}`);
    }
  }

  return { events, firstChunkMs, doneMs, totalMs: Math.round(performance.now() - t0) };
}

function summarize(label, r) {
  const statuses = r.events.filter(e => e.event === 'status').map(e => `${e.t}ms: ${e.data}`);
  const chunkCount = r.events.filter(e => e.event === 'chunk').length;
  const chartsCount = r.events.filter(e => e.event === 'charts').length;
  console.log(`\n=== ${label} ===`);
  console.log(`Total: ${r.totalMs}ms, first chunk: ${r.firstChunkMs}ms, done: ${r.doneMs}ms`);
  console.log(`Events: ${r.events.length} (chunks=${chunkCount}, charts=${chartsCount}, status=${statuses.length})`);
  console.log(`Status timeline:`);
  for (const s of statuses) console.log(`  ${s}`);
  const doneEvent = r.events.find(e => e.event === 'done');
  if (doneEvent) {
    try {
      const d = JSON.parse(doneEvent.data + (doneEvent.data.endsWith('"') ? '' : '"'));
      console.log(`Answer preview: ${(d.answer || '').slice(0, 80)}...`);
    } catch {}
  }
}

(async () => {
  console.log('Logging in...');
  const token = await login();
  console.log(`Token: ${token.slice(0, 20)}...`);

  console.log('\n--- Run 1 (expect: agg cache MISS, ~5-10s first chunk) ---');
  const r1 = await streamQuery(token, 'Run1');
  summarize('Run 1 (MISS)', r1);

  console.log('\n--- Run 2 (expect: agg cache HIT, <3s first chunk) ---');
  const r2 = await streamQuery(token, 'Run2');
  summarize('Run 2 (HIT)', r2);

  const speedup = r1.firstChunkMs && r2.firstChunkMs ? (r1.firstChunkMs / r2.firstChunkMs).toFixed(2) : 'n/a';
  console.log(`\n=== Cache speedup: ${speedup}x (first chunk) ===`);
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
