// Verify Bug #371 RBAC: new :read gates on Equipment/Vehicle/ProductType.
// Tests that non-privileged roles get 403 while privileged roles succeed.
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-bug371-rbac';
fs.mkdirSync(OUT, { recursive: true });

async function login(username, password) {
  const resp = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await resp.json();
  if (!j.success || !j.data?.token) throw new Error(`login failed: ${username} — ${j.message}`);
  return { token: j.data.token, factoryId: j.data.factoryId, role: j.data.role };
}

async function hit(token, factoryId, path) {
  const url = `${BASE}/api/mobile/${factoryId}${path}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  let body = null;
  try { body = await resp.json(); } catch {}
  return { status: resp.status, body };
}

const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

const USERS = [
  { username: 'factory_admin1', role: 'factory_super_admin' },
  { username: 'equipment_admin1', role: 'equipment_admin' },
  { username: 'sales_mgr1', role: 'sales_manager' },
  { username: 'production_mgr1', role: 'production_manager' },
];

const PROBES = [
  { path: '/equipment', module: 'equipment' },
  { path: '/vehicles', module: 'warehouse' },
  { path: '/product-types', module: 'production,rd' },
];

// Expected access matrix
function expectedAccess(role, module) {
  if (role === 'factory_super_admin') return 'ok';
  if (module === 'equipment' && role === 'equipment_admin') return 'ok';
  if (module === 'warehouse' && (role === 'warehouse_manager' || role === 'warehouse_worker')) return 'ok';
  if (module === 'production,rd' && (role === 'production_manager' || role.includes('production'))) return 'ok';
  return '403';
}

for (const u of USERS) {
  console.log(`\n=== ${u.username} (${u.role}) ===`);
  try {
    const { token, factoryId } = await login(u.username, '123456');
    for (const p of PROBES) {
      const r = await hit(token, factoryId, p.path);
      const expect = expectedAccess(u.role, p.module);
      const pass = expect === 'ok' ? r.status === 200 : r.status === 403;
      results.cases.push({
        username: u.username, role: u.role, path: p.path, expect,
        status: r.status, message: r.body?.message?.slice(0, 60), pass
      });
      console.log(`  ${pass ? '✅' : '❌'} ${p.path.padEnd(18)} → ${r.status} (expect ${expect})${r.body?.message ? ' · ' + r.body.message.slice(0, 50) : ''}`);
    }
  } catch (e) {
    console.log(`  ⛔ login/fetch error: ${e.message}`);
    results.cases.push({ username: u.username, error: e.message });
  }
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));

console.log('\n========== SUMMARY ==========');
const pass = results.cases.filter(c => c.pass).length;
const total = results.cases.filter(c => c.pass !== undefined).length;
console.log(`  ${pass}/${total} passed`);
