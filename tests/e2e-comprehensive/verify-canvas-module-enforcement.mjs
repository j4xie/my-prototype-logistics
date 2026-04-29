// Verify @RequireModule aspect enforcement — previously sidebar hid modules
// but backend didn't block. F002 has hr_employee + finance_ar + finance_ap
// disabled; after fix, write APIs should 400 "模块 xxx 未启用".
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/verify-canvas-module-enforcement';
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

async function post(token, factoryId, path, body) {
  const url = `${BASE}/api/mobile/${factoryId}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let j = null;
  try { j = await resp.json(); } catch {}
  return { status: resp.status, body: j };
}

async function put(token, factoryId, path, body) {
  const url = `${BASE}/api/mobile/${factoryId}${path}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let j = null;
  try { j = await resp.json(); } catch {}
  return { status: resp.status, body: j };
}

const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

// F002 has disabled: hr_employee, finance_ar, finance_ap
// These writes should ALL return 400 "模块 xxx 未启用"
{
  console.log('=== F002 (has hr_employee, finance_ar, finance_ap disabled) ===');
  const { token, factoryId } = await login('restaurant_admin1', '123456');

  const writes = [
    { name: 'hr_employee', path: '/users', body: { username: 'test_canvas_enf', password: 'x', realName: 'test', phone: '13800001234', roleCode: 'viewer' }, module: 'hr_employee' },
    { name: 'hr_employee', path: '/departments', body: { code: 'TEST_CE', name: 'test-canvas', description: '', displayOrder: 999 }, module: 'hr_employee' },
    { name: 'finance_ar',  path: '/finance/invoices/request', body: { customerId: 'X', amount: 100 }, module: 'finance_ar' },
    { name: 'finance_ap',  path: '/finance/payments/record', body: { supplierId: 'X', amount: 100 }, module: 'finance_ap' },
  ];

  for (const w of writes) {
    const r = await post(token, factoryId, w.path, w.body);
    // Expect: 400 (BusinessException "模块 xxx 未启用") OR maybe other errors but NOT 200
    const blocked = r.status >= 400;
    const msg = r.body?.message || '';
    const isModuleBlock = msg.includes('模块') && msg.includes('未启用');
    results.cases.push({
      expected: 'module blocked',
      role: 'restaurant_admin1@F002',
      module: w.module, path: w.path, status: r.status,
      message: msg.slice(0, 80),
      isModuleBlock,
      pass: blocked && isModuleBlock,
    });
    console.log(`  ${blocked && isModuleBlock ? '✅' : '⚠️ '} POST ${w.path.padEnd(22)} → ${r.status} ${msg ? '· ' + msg.slice(0, 60) : ''}`);
  }
}

// F001 has NO module disabled — writes should proceed (get different errors like 400 validation, not module block)
{
  console.log('\n=== F001 (no modules disabled — regression check) ===');
  const { token, factoryId } = await login('factory_admin1', '123456');

  const writes = [
    { name: 'hr_employee', path: '/users', body: { username: 'regr_test_x', password: 'x', realName: 'test', phone: '13800001234', roleCode: 'viewer' } },
    { name: 'finance_ar',  path: '/finance/invoices', body: { invoiceNumber: 'REGR-X', customerId: 'X', amount: 100 } },
  ];

  for (const w of writes) {
    const r = await post(token, factoryId, w.path, w.body);
    const msg = r.body?.message || '';
    const isModuleBlock = msg.includes('模块') && msg.includes('未启用');
    // For F001 (no disable), should NOT be a module block (can be validation error or success)
    const notBlocked = !isModuleBlock;
    results.cases.push({
      expected: 'not module blocked',
      role: 'factory_admin1@F001',
      path: w.path, status: r.status,
      message: msg.slice(0, 80),
      isModuleBlock,
      pass: notBlocked,
    });
    console.log(`  ${notBlocked ? '✅' : '⚠️ '} POST ${w.path.padEnd(22)} → ${r.status} ${msg ? '· ' + msg.slice(0, 60) : ''}`);
  }
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const pass = results.cases.filter(c => c.pass).length;
console.log(`\n========== SUMMARY ==========`);
console.log(`  ${pass}/${results.cases.length} passed`);
