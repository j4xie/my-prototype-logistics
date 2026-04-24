// Rule 9 business-sample verification: Dashboard/Finance Top/Mid/Tail
// must contain real business entities (store names, product names) — not
// pseudo-rows (序号 1.0/2.0, 表头 "门店名称", 注释 "注:...").
//
// Uses F001 test env (140K POS transactions in Silver + Gold).
// Also samples with restaurant_admin1 (F002) to cross-check behavior for
// restaurant tenant view.
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const OUT = 'tests/e2e-comprehensive/results/qa-rule9-business-sample';
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

async function get(token, path) {
  const r = await fetch(`${BASE}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// Detect pseudo-row patterns (Bug #37 class bugs)
function isPseudoName(s) {
  if (!s || typeof s !== 'string') return true;
  const t = s.trim();
  if (!t) return true;
  if (/^\d+(\.\d+)?$/.test(t)) return true;                      // 1.0 / 2.0 / 123
  if (/^(注[：:]|备注|合计|总计|小计)/.test(t)) return true;      // 注:... / 合计
  if (/^(门店名称|菜品名称|商品名|产品名称|名称|类目)$/.test(t)) return true;  // 表头残留
  if (t.length > 50 && /^.{50,}/.test(t)) return true;           // 过长 (通常是描述性字段)
  return false;
}

const results = { base: BASE, ts: new Date().toISOString(), cases: [] };

// Case 1: F001 Gold finance-summary top_stores
{
  const { token, factoryId } = await login('factory_admin1', '123456');
  const r = await get(token, `/api/mobile/${factoryId}/smart-bi/dashboard/executive/custom?startDate=2025-01-01&endDate=2025-12-31`);
  const kpi = r.body?.data?.data || r.body?.data;
  const rankings = kpi?.rankings || {};
  // top_stores or dept_rank
  const topStores = rankings.top_stores || rankings['top_stores'] || rankings.department || [];

  const stores = Array.isArray(topStores) ? topStores : [];
  const sampleCheck = stores.length >= 3 ? {
    top: stores[0]?.name,
    mid: stores[Math.floor(stores.length / 2)]?.name,
    tail: stores[stores.length - 1]?.name,
  } : { top: stores[0]?.name, mid: null, tail: stores[stores.length - 1]?.name };

  const pseudoDetected = {
    top: isPseudoName(sampleCheck.top),
    mid: isPseudoName(sampleCheck.mid),
    tail: isPseudoName(sampleCheck.tail),
  };
  const anyPseudo = Object.values(pseudoDetected).some(v => v);

  results.cases.push({
    case: 'C1 F001 Dashboard top_stores rankings Rule 9 sample',
    totalStores: stores.length,
    sampleCheck,
    pseudoDetected,
    pass: stores.length >= 1 && !anyPseudo,
  });
  console.log(`C1 F001 Dashboard rankings:`);
  console.log(`  total stores: ${stores.length}`);
  console.log(`  top: ${sampleCheck.top} ${isPseudoName(sampleCheck.top) ? '⚠️ PSEUDO' : '✅'}`);
  console.log(`  mid: ${sampleCheck.mid} ${sampleCheck.mid && isPseudoName(sampleCheck.mid) ? '⚠️ PSEUDO' : '✅'}`);
  console.log(`  tail: ${sampleCheck.tail} ${isPseudoName(sampleCheck.tail) ? '⚠️ PSEUDO' : '✅'}`);
}

// Case 2: F001 /smart-bi/sales/products top-N
{
  const { token, factoryId } = await login('factory_admin1', '123456');
  const r = await get(token, `/api/mobile/${factoryId}/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31&analysisType=product-mix`);
  const products = r.body?.data?.rankings?.top_products || [];
  const stores = Array.isArray(products) ? products : [];
  const sampleCheck = stores.length >= 3 ? {
    top: stores[0]?.name,
    mid: stores[Math.floor(stores.length / 2)]?.name,
    tail: stores[stores.length - 1]?.name,
  } : null;

  const anyPseudo = sampleCheck
    ? Object.values(sampleCheck).some(v => isPseudoName(v))
    : null;

  results.cases.push({
    case: 'C2 F001 Sales products Rule 9 sample',
    totalProducts: stores.length,
    sampleCheck,
    pass: sampleCheck != null ? !anyPseudo : null,
    note: sampleCheck ? undefined : 'No products found (may need different endpoint)',
  });
  console.log(`\nC2 F001 Sales top products:`);
  console.log(`  total: ${stores.length}`);
  if (sampleCheck) {
    console.log(`  top: ${sampleCheck.top}`);
    console.log(`  mid: ${sampleCheck.mid}`);
    console.log(`  tail: ${sampleCheck.tail}`);
  }
}

// Case 3: F001 Gold finance-summary top_stores directly via Python endpoint
{
  const { token, factoryId } = await login('factory_admin1', '123456');
  const r = await get(token, `/smartbi-api/api/smartbi/gold/finance-summary?factory_id=${factoryId}&start_date=2025-01-01&end_date=2025-12-31&top_n_stores=10`);
  const top = r.body?.top_stores || [];
  const sampleCheck = top.length >= 3 ? {
    top: top[0]?.store_name || top[0]?.name,
    mid: top[Math.floor(top.length / 2)]?.store_name || top[Math.floor(top.length / 2)]?.name,
    tail: top[top.length - 1]?.store_name || top[top.length - 1]?.name,
  } : null;

  const anyPseudo = sampleCheck
    ? Object.values(sampleCheck).some(v => isPseudoName(v))
    : null;

  results.cases.push({
    case: 'C3 F001 Gold finance-summary top_stores Rule 9',
    totalTop: top.length,
    sampleCheck,
    pass: sampleCheck != null ? !anyPseudo : null,
  });
  console.log(`\nC3 F001 Gold top_stores:`);
  console.log(`  total: ${top.length}`);
  if (sampleCheck) {
    console.log(`  top: ${sampleCheck.top}`);
    console.log(`  mid: ${sampleCheck.mid}`);
    console.log(`  tail: ${sampleCheck.tail}`);
  }
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const pass = results.cases.filter(c => c.pass === true).length;
const total = results.cases.filter(c => c.pass !== null).length;
console.log(`\n${pass}/${total} passed (null = inconclusive, e.g. endpoint not found)`);
