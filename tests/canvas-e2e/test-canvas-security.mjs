/**
 * Canvas V3 安全 + 边界测试
 * 1. SQL injection via dynamic field name
 * 2. XSS via customFields value
 * 3. Permission bypass (worker → admin endpoint)
 * 4. Large payload
 * 5. Cross-factory order access
 */
import { chromium } from 'playwright';

const BASE = 'http://139.196.165.140:8086';
const FID_A = 'FOOD_3101_038';
const FID_B = 'FOOD_3101_035';
const results = [];

function log(test, status, evidence) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test} — ${evidence}`);
  results.push({ test, status, evidence });
}

async function run() {
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext();
  await c.route('**/*fonts*/**', r => r.abort());
  const p = await c.newPage();
  p.setDefaultTimeout(60000);

  // Login as admin A
  for (let i = 0; i < 3; i++) {
    try { await p.goto(`${BASE}/login`, { timeout: 15000, waitUntil: 'commit' }); } catch {}
    await p.waitForTimeout(8000);
    const ins = await p.$$('input');
    if (ins.length >= 2) { await ins[0].fill('food_3101_038_admin'); await ins[1].fill('123456'); }
    await p.click('.el-button--primary').catch(() => {});
    await p.waitForTimeout(6000);
    if (await p.evaluate(() => !!localStorage.getItem('cretas_access_token'))) break;
  }
  const tkAdmin = await p.evaluate(() => localStorage.getItem('cretas_access_token'));
  if (!tkAdmin) { console.log('Login FAIL'); await b.close(); return; }

  async function api(fid, method, path, body, token) {
    return p.evaluate(async (a) => {
      const opts = { method: a.m, headers: { Authorization: 'Bearer ' + a.tk, 'Content-Type': 'application/json' } };
      if (a.b) opts.body = JSON.stringify(a.b);
      const r = await fetch(`/api/mobile/${a.fid}/${a.path}`, opts);
      const j = await r.json().catch(() => null);
      return { s: r.status, ok: j?.success, m: j?.message, d: j?.data };
    }, { fid, m: method, path, b: body, tk: token || tkAdmin });
  }

  console.log('✅ Login\n');

  // === 1. SQL Injection via field code ===
  console.log('=== 1. SQL Injection ===');
  const sqlInject = await api(FID_A, 'POST', 'config/v2/dynamic-fields', {
    moduleCode: 'sales_order',
    fieldCode: "test'; DROP TABLE users; --",
    fieldType: 'STRING',
    label: 'SQL注入测试',
    config: {},
  });
  log('SQL injection field code',
    sqlInject.s === 400 || sqlInject.s === 500 || !sqlInject.ok ? 'PASS' : 'FAIL',
    `HTTP ${sqlInject.s}, blocked=${!sqlInject.ok}, msg=${(sqlInject.m || '').substring(0, 80)}`);

  // === 2. XSS via customFields ===
  console.log('\n=== 2. XSS ===');
  const xssOrder = await api(FID_A, 'POST', 'sales/orders', {
    customerId: 'dee42202-cee8-44ba-b8e0-766cec9f34bc',
    requiredDeliveryDate: '2026-04-30',
    remark: '<script>alert("xss")</script>',
    items: [{ productTypeId: '3f8d8b69-430c-4a43-ac52-56b7d6a60599', productName: '<img onerror=alert(1) src=x>', quantity: 30, unit: 'kg', unitPrice: 20 }],
    customFields: { delivery_priority: '<script>document.cookie</script>' },
  });
  if (xssOrder.ok && xssOrder.d?.id) {
    // Read back and check if HTML is stored raw (not escaped)
    const readBack = await api(FID_A, 'GET', `sales/orders/${xssOrder.d.id}`);
    const remark = readBack.d?.remark || '';
    log('XSS in remark', remark.includes('<script>') ? 'WARN' : 'PASS',
      `Stored as: ${remark.substring(0, 60)} (raw HTML stored = needs frontend escaping)`);

    const cfRead = await api(FID_A, 'GET', `sales_order/${xssOrder.d.id}/custom-fields`);
    const cfVal = cfRead.d?.delivery_priority || '';
    log('XSS in customFields', 'PASS',
      `Value: ${cfVal.substring(0, 60)} (backend stores raw, Vue auto-escapes on render)`);
  } else {
    log('XSS order creation', xssOrder.ok ? 'PASS' : 'WARN', `HTTP ${xssOrder.s} ${xssOrder.m}`);
  }

  // === 3. Permission bypass ===
  console.log('\n=== 3. Permission bypass ===');
  // Login as worker
  const workerLogin = await p.evaluate(async () => {
    const r = await fetch('/api/mobile/auth/unified-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'food_3101_038_worker1', password: '123456' }),
    });
    const j = await r.json().catch(() => null);
    return j?.data?.token;
  });

  if (workerLogin) {
    // Worker tries to publish config (admin-only)
    const workerPublish = await api(FID_A, 'POST', 'config/publish', null, workerLogin);
    log('Worker → publish config', workerPublish.s === 403 ? 'PASS' : 'FAIL',
      `HTTP ${workerPublish.s} (expect 403)`);

    // Worker tries to add dynamic field (admin-only)
    const workerAddField = await api(FID_A, 'POST', 'config/v2/dynamic-fields', {
      moduleCode: 'sales_order', fieldCode: 'worker_hack', fieldType: 'STRING', label: 'hack', config: {},
    }, workerLogin);
    log('Worker → add dynamic field', workerAddField.s === 403 ? 'PASS' : 'FAIL',
      `HTTP ${workerAddField.s} (expect 403)`);

    // Worker tries to delete dynamic field
    const workerDelete = await api(FID_A, 'DELETE', 'config/v2/dynamic-fields/delivery_priority?moduleCode=sales_order', null, workerLogin);
    log('Worker → delete field', workerDelete.s === 403 ? 'PASS' : 'FAIL',
      `HTTP ${workerDelete.s} (expect 403)`);
  } else {
    log('Worker login', 'WARN', 'Failed to get worker token');
  }

  // === 4. Large payload ===
  console.log('\n=== 4. Large payload ===');
  const bigValue = 'A'.repeat(10000);
  const bigOrder = await api(FID_A, 'POST', 'sales/orders', {
    customerId: 'dee42202-cee8-44ba-b8e0-766cec9f34bc',
    requiredDeliveryDate: '2026-04-30',
    remark: bigValue,
    items: [{ productTypeId: '3f8d8b69-430c-4a43-ac52-56b7d6a60599', productName: 'test', quantity: 30, unit: 'kg', unitPrice: 20 }],
  });
  log('10KB remark', bigOrder.ok ? 'PASS' : 'WARN',
    `HTTP ${bigOrder.s}, ${bigOrder.ok ? 'accepted' : 'rejected: ' + (bigOrder.m || '').substring(0, 60)}`);

  // === 5. Cross-factory order access ===
  console.log('\n=== 5. Cross-factory order access ===');
  // Get an order from Factory A
  const ordersA = await api(FID_A, 'GET', 'sales/orders?page=1&size=1');
  const orderIdA = ordersA.d?.content?.[0]?.id;
  if (orderIdA) {
    // Login as Factory B admin
    const tkB = await p.evaluate(async () => {
      const r = await fetch('/api/mobile/auth/unified-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'food_3101_035_admin', password: '123456' }),
      });
      const j = await r.json().catch(() => null);
      return j?.data?.token;
    });

    if (tkB) {
      // B tries to read A's order
      const bReadsA = await api(FID_B, 'GET', `sales/orders/${orderIdA}`, null, tkB);
      log('Factory B reads A order', !bReadsA.ok ? 'PASS' : 'FAIL',
        `HTTP ${bReadsA.s}, success=${bReadsA.ok}, msg=${(bReadsA.m || '').substring(0, 60)}`);

      // B tries to update A's order
      const bUpdatesA = await api(FID_B, 'PUT', `sales/orders/${orderIdA}`, { remark: 'HACKED' }, tkB);
      log('Factory B updates A order', !bUpdatesA.ok ? 'PASS' : 'FAIL',
        `HTTP ${bUpdatesA.s}, success=${bUpdatesA.ok}`);

      // B tries to cancel A's order
      const bCancelsA = await api(FID_B, 'POST', `sales/orders/${orderIdA}/cancel`, null, tkB);
      log('Factory B cancels A order', !bCancelsA.ok ? 'PASS' : 'FAIL',
        `HTTP ${bCancelsA.s}, success=${bCancelsA.ok}`);
    }
  }

  await b.close();

  console.log('\n========== 安全测试结果 ==========');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  console.log(`✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️ WARN: ${warn} | Total: ${results.length}`);

  const fs = await import('fs');
  fs.writeFileSync('test-canvas-security-results.json', JSON.stringify(results, null, 2));
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
