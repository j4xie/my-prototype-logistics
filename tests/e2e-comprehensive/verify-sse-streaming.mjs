// Verify Phase 9 SSE streaming for Dashboard LLM insights.
// Measures time-to-first-delta vs traditional full-response time.
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-sse-streaming';
fs.mkdirSync(OUT, { recursive: true });

async function login(username, password) {
  const resp = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await resp.json();
  if (!j.success) throw new Error(`login failed: ${username}`);
  return { token: j.data.token, factoryId: j.data.factoryId };
}

const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

async function streamCase(label, token, factoryId, startDate, endDate) {
  console.log(`\n=== ${label} ===`);
  const url = `${BASE}/api/mobile/${factoryId}/smart-bi/dashboard/executive/insights/custom/stream?startDate=${startDate}&endDate=${endDate}`;
  const t0 = Date.now();
  let tFirstDelta = -1;
  let tDone = -1;
  let deltaCount = 0;
  let totalText = '';
  let meta = null;
  let gotError = null;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    });
    const contentType = resp.headers.get('content-type') || '';
    console.log(`  HTTP ${resp.status} content-type: ${contentType}`);

    if (!resp.ok || !resp.body) {
      const body = await resp.text();
      gotError = `${resp.status}: ${body.slice(0, 100)}`;
      throw new Error(gotError);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!block.startsWith('data:')) continue;
        const dataStr = block.replace(/^data:\s*/, '').trim();
        try {
          const event = JSON.parse(dataStr);
          if (event.type === 'meta') {
            meta = { source: event.source, tokens_used_today: event.tokens_used_today };
            console.log(`  [+${Date.now() - t0}ms] meta: source=${event.source}`);
          } else if (event.type === 'delta') {
            if (tFirstDelta < 0) {
              tFirstDelta = Date.now() - t0;
              console.log(`  [+${tFirstDelta}ms] first delta (len=${event.text.length})`);
            }
            deltaCount++;
            totalText += event.text;
          } else if (event.type === 'done') {
            tDone = Date.now() - t0;
            console.log(`  [+${tDone}ms] done: tokens=${event.tokens}, elapsed_ms=${event.elapsed_ms}`);
          } else if (event.type === 'error') {
            gotError = event.message;
            console.log(`  [+${Date.now() - t0}ms] error: ${event.message}`);
          }
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    gotError = e.message;
  }

  const result = {
    label, factoryId, startDate, endDate,
    meta, deltaCount,
    totalTextLen: totalText.length,
    textPreview: totalText.slice(0, 120),
    tFirstDelta, tDone,
    gotError,
    pass: !gotError && deltaCount > 0 && tFirstDelta > 0,
  };
  results.cases.push(result);

  if (result.pass) {
    console.log(`  ✅ PASS: ${deltaCount} deltas, ${totalText.length} chars, first-delta in ${tFirstDelta}ms, done in ${tDone}ms`);
  } else {
    console.log(`  ❌ FAIL: ${gotError || 'no deltas received'}`);
  }
  return result;
}

// Case 1: F001 with 2025 range (warm after deploy)
{
  const { token, factoryId } = await login('factory_admin1', '123456');
  await streamCase('C1 F001 2025 full year', token, factoryId, '2025-01-01', '2025-12-31');
}

// Case 2: Re-fire same range (expect cache hit → instant)
{
  const { token, factoryId } = await login('factory_admin1', '123456');
  await streamCase('C2 F001 cache hit (same range)', token, factoryId, '2025-01-01', '2025-12-31');
}

// Case 3: Fresh range (random month range, unlikely cached)
{
  const { token, factoryId } = await login('factory_admin1', '123456');
  const y = 2024 + Math.floor(Math.random() * 2);
  const m1 = 1 + Math.floor(Math.random() * 9);
  const m2 = m1 + 2;
  const mm1 = String(m1).padStart(2, '0');
  const mm2 = String(m2).padStart(2, '0');
  await streamCase(`C3 F001 fresh LLM (${y}-${mm1} to ${y}-${mm2})`, token, factoryId, `${y}-${mm1}-01`, `${y}-${mm2}-28`);
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
for (const c of results.cases) {
  console.log(`  ${c.pass ? '✅' : '❌'}  ${c.label}: tFirst=${c.tFirstDelta}ms tDone=${c.tDone}ms source=${c.meta?.source}`);
}
