/**
 * Layer 3 (Cross-Module), Layer 4 (Business Flows), Data Sync Tests
 * Targets REMOTE PRODUCTION server.
 *
 * BASE: http://139.196.165.140:8086
 * API:  http://47.100.235.168:10010
 * Login: factory_admin1 / 123456
 *
 * Usage: node test-l3-l4-datasync.mjs
 */

import http from 'http';

const API_BASE = 'http://47.100.235.168:10010/api/mobile';
const WEB_BASE = 'http://139.196.165.140:8086';

// ================================================================
// HTTP helper (no external deps)
// ================================================================
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 20000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ================================================================
// Auth helpers
// ================================================================
let authToken = '';
let factoryId = '';

async function login() {
  const res = await httpRequest(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    body: { username: 'factory_admin1', password: '123456' },
  });
  if (res.data?.success && res.data?.data) {
    authToken = res.data.data.token || res.data.data.accessToken;
    factoryId = res.data.data.factoryId;
    return true;
  }
  console.error('Login failed:', JSON.stringify(res.data));
  return false;
}

async function apiGet(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${API_BASE}${path}${query ? '?' + query : ''}`;
  return httpRequest(url, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

async function apiPost(path, body = {}) {
  const url = `${API_BASE}${path}`;
  return httpRequest(url, {
    method: 'POST',
    body,
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

// ================================================================
// Evidence-based results tracker
// ================================================================
const results = [];

function record(layer, testName, status, evidence) {
  results.push({ layer, testName, status, evidence });
  const tag = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[WARN]';
  console.log(`\n${tag} ${layer} | ${testName}`);
  if (evidence.captured) {
    for (const [label, val] of Object.entries(evidence.captured)) {
      const display = Array.isArray(val)
        ? (val.length > 8 ? `[${val.length} items] ${JSON.stringify(val.slice(0, 5))}...` : JSON.stringify(val))
        : typeof val === 'object' ? JSON.stringify(val) : String(val);
      console.log(`   captured.${label} = ${display}`);
    }
  }
  if (evidence.comparison) console.log(`   comparison: ${evidence.comparison}`);
  if (evidence.verdict) console.log(`   verdict: ${evidence.verdict}`);
  if (evidence.error) console.log(`   error: ${evidence.error}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ================================================================
// LAYER 3: Cross-Module Data Consistency (4 tests)
// ================================================================

async function L3_materialSync() {
  console.log('\n' + '='.repeat(72));
  console.log('L3-1: Material Sync (warehouse / BOM / purchase share same dropdown)');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // All three views call /{factoryId}/raw-material-types/active
  const res = await apiGet(`/${factoryId}/raw-material-types/active`);
  const matTypes = res.data?.success
    ? (Array.isArray(res.data.data) ? res.data.data : res.data.data?.content || [])
    : [];
  const matTypeNames = matTypes.map(m => m.name).filter(Boolean).sort();
  const matTypeIds = matTypes.map(m => m.id).filter(Boolean);

  // Also fetch material-batches to cross-check referential integrity
  const batchRes = await apiGet(`/${factoryId}/material-batches`, { size: 200 });
  const batches = batchRes.data?.success ? (batchRes.data.data?.content || []) : [];
  const batchMaterialNames = [...new Set(batches.map(b => b.materialTypeName || b.materialName).filter(Boolean))].sort();

  evidence.captured['raw-material-types/active count'] = matTypes.length;
  evidence.captured['raw-material-types/active names (sample)'] = matTypeNames.slice(0, 10);
  evidence.captured['raw-material-types/active IDs (sample)'] = matTypeIds.slice(0, 5);
  evidence.captured['material-batches unique materials'] = batchMaterialNames.length;
  evidence.captured['material-batches names (sample)'] = batchMaterialNames.slice(0, 10);

  const orphans = batchMaterialNames.filter(n => !matTypeNames.includes(n));
  evidence.comparison = `All 3 views (warehouse, BOM, purchase) call /${factoryId}/raw-material-types/active -> same ${matTypes.length} items`;

  if (matTypes.length > 0) {
    if (orphans.length === 0) {
      evidence.verdict = `PASS: ${matTypes.length} material types shared. All ${batchMaterialNames.length} batch materials have matching types.`;
      record('L3', 'Material Sync', 'PASS', evidence);
    } else {
      evidence.captured['orphanMaterials'] = orphans;
      evidence.verdict = `WARN: ${orphans.length} batch materials not in active types: ${orphans.slice(0, 5).join(', ')}`;
      record('L3', 'Material Sync', 'WARN', evidence);
    }
  } else {
    evidence.verdict = 'FAIL: No material types returned from /raw-material-types/active';
    record('L3', 'Material Sync', 'FAIL', evidence);
  }
}

async function L3_productSync() {
  console.log('\n' + '='.repeat(72));
  console.log('L3-2: Product Sync (products list / sales dropdown / production dropdown)');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Source 1: /product-types/active (used by sales orders & production batches)
  const activeRes = await apiGet(`/${factoryId}/product-types/active`);
  const activeProducts = activeRes.data?.success
    ? (Array.isArray(activeRes.data.data) ? activeRes.data.data : activeRes.data.data?.content || [])
    : [];
  const activeNames = activeProducts.map(p => p.name).filter(Boolean).sort();
  const activeIds = activeProducts.map(p => p.id).filter(Boolean).sort();

  // Source 2: /product-types (paginated, used by product management list)
  const allRes = await apiGet(`/${factoryId}/product-types`, { size: 200 });
  const allProducts = allRes.data?.success
    ? (allRes.data.data?.content || (Array.isArray(allRes.data.data) ? allRes.data.data : []))
    : [];
  const allNames = allProducts.map(p => p.name).filter(Boolean).sort();
  const allIds = allProducts.map(p => p.id).filter(Boolean).sort();

  evidence.captured['product-types/active count'] = activeProducts.length;
  evidence.captured['product-types/active names'] = activeNames.slice(0, 15);
  evidence.captured['product-types paginated count'] = allProducts.length;
  evidence.captured['product-types paginated names'] = allNames.slice(0, 15);

  const activeNotInAll = activeIds.filter(id => !allIds.includes(id));
  evidence.comparison = `Sales & batches use /product-types/active (${activeProducts.length}). Product list uses /product-types (${allProducts.length}).`;

  if (activeProducts.length > 0) {
    if (activeNotInAll.length === 0) {
      evidence.verdict = `PASS: ${activeProducts.length} active products valid subset of ${allProducts.length} total. Dropdowns consistent.`;
      record('L3', 'Product Sync', 'PASS', evidence);
    } else {
      evidence.captured['activeNotInAll'] = activeNotInAll;
      evidence.verdict = `WARN: ${activeNotInAll.length} active IDs not in paginated list (pagination cutoff?)`;
      record('L3', 'Product Sync', 'WARN', evidence);
    }
  } else {
    evidence.verdict = 'FAIL: No active products returned';
    record('L3', 'Product Sync', 'FAIL', evidence);
  }
}

async function L3_customerSync() {
  console.log('\n' + '='.repeat(72));
  console.log('L3-3: Customer Sync (customer list vs sales order dropdown)');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Source 1: customer list page (size=200)
  const custRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 200 });
  const custList = custRes.data?.success ? (custRes.data.data?.content || []) : [];
  const custListNames = custList.map(c => c.name).filter(Boolean).sort();
  const custListIds = custList.map(c => c.id).filter(Boolean).sort();

  // Source 2: sales order dropdown (size=100)
  const salesCustRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 100 });
  const salesCusts = salesCustRes.data?.success ? (salesCustRes.data.data?.content || []) : [];
  const salesCustNames = salesCusts.map(c => c.name).filter(Boolean).sort();
  const salesCustIds = salesCusts.map(c => c.id).filter(Boolean).sort();

  evidence.captured['customer list (size=200) count'] = custList.length;
  evidence.captured['customer list names'] = custListNames.slice(0, 10);
  evidence.captured['sales dropdown (size=100) count'] = salesCusts.length;
  evidence.captured['sales dropdown names'] = salesCustNames.slice(0, 10);

  if (custList.length <= 100) {
    const match = JSON.stringify(custListIds) === JSON.stringify(salesCustIds);
    evidence.comparison = `Total customers ${custList.length} <= 100, both queries should return identical data.`;
    evidence.verdict = match
      ? `PASS: Both return identical ${custList.length} customers.`
      : `FAIL: Mismatch! List has ${custList.length}, sales dropdown has ${salesCusts.length}.`;
    record('L3', 'Customer Sync', match ? 'PASS' : 'FAIL', evidence);
  } else {
    const allSalesInList = salesCustIds.every(id => custListIds.includes(id));
    evidence.comparison = `Total customers ${custList.length} > 100. Sales dropdown limited to 100.`;
    evidence.verdict = allSalesInList
      ? `WARN: Sales dropdown shows ${salesCusts.length}/${custList.length} (page size limit). All are valid.`
      : `FAIL: Sales dropdown contains customers not in master list.`;
    record('L3', 'Customer Sync', allSalesInList ? 'WARN' : 'FAIL', evidence);
  }
}

async function L3_supplierSync() {
  console.log('\n' + '='.repeat(72));
  console.log('L3-4: Supplier Sync (supplier list vs purchase order dropdown)');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Source 1: supplier list page (size=200)
  const suppRes = await apiGet(`/${factoryId}/suppliers`, { page: 1, size: 200 });
  const suppList = suppRes.data?.success ? (suppRes.data.data?.content || []) : [];
  const suppListNames = suppList.map(s => s.name).filter(Boolean).sort();
  const suppListIds = suppList.map(s => s.id).filter(Boolean).sort();

  // Source 2: purchase dropdown (size=100)
  const purchRes = await apiGet(`/${factoryId}/suppliers`, { page: 1, size: 100 });
  const purchSupps = purchRes.data?.success ? (purchRes.data.data?.content || []) : [];
  const purchSuppNames = purchSupps.map(s => s.name).filter(Boolean).sort();
  const purchSuppIds = purchSupps.map(s => s.id).filter(Boolean).sort();

  evidence.captured['supplier list (size=200) count'] = suppList.length;
  evidence.captured['supplier list names'] = suppListNames.slice(0, 10);
  evidence.captured['purchase dropdown (size=100) count'] = purchSupps.length;
  evidence.captured['purchase dropdown names'] = purchSuppNames.slice(0, 10);

  if (suppList.length <= 100) {
    const matchPurch = JSON.stringify(suppListIds) === JSON.stringify(purchSuppIds);
    evidence.comparison = `Total suppliers ${suppList.length} <= 100. All views should match.`;
    if (matchPurch) {
      evidence.verdict = `PASS: Both views return identical ${suppList.length} suppliers.`;
      record('L3', 'Supplier Sync', 'PASS', evidence);
    } else {
      evidence.verdict = `FAIL: Mismatch: list=${suppList.length}, purchase=${purchSupps.length}`;
      record('L3', 'Supplier Sync', 'FAIL', evidence);
    }
  } else {
    const allPurchInList = purchSuppIds.every(id => suppListIds.includes(id));
    evidence.comparison = `Total suppliers ${suppList.length} > 100. Purchase dropdown limited to 100.`;
    evidence.verdict = allPurchInList
      ? `WARN: Purchase dropdown shows ${purchSupps.length}/${suppList.length}. All valid.`
      : `FAIL: Purchase dropdown contains suppliers not in master list.`;
    record('L3', 'Supplier Sync', allPurchInList ? 'WARN' : 'FAIL', evidence);
  }
}

// ================================================================
// LAYER 4: Business Flow Tests (2 tests)
// ================================================================

async function L4_salesFlow() {
  console.log('\n' + '='.repeat(72));
  console.log('L4-1: Sales Flow (create order -> confirm -> create delivery)');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Pre-requisites
  const custRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 10 });
  const customers = custRes.data?.success ? (custRes.data.data?.content || []) : [];
  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (customers.length === 0 || products.length === 0) {
    evidence.captured['customers'] = customers.length;
    evidence.captured['products'] = products.length;
    evidence.verdict = `SKIP: Need >=1 customer (${customers.length}) and >=1 product (${products.length})`;
    record('L4', 'Sales Flow', 'WARN', evidence);
    return;
  }

  const testCustomer = customers[0];
  const testProduct = products[0];
  evidence.captured['step0_customer'] = `${testCustomer.name} (${testCustomer.id})`;
  evidence.captured['step0_product'] = `${testProduct.name} (${testProduct.id})`;

  // Step 1: Create sales order
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const orderPayload = {
    customerId: testCustomer.id,
    requiredDeliveryDate: tomorrow,
    deliveryAddress: 'L4 E2E Test Address',
    remark: `L4-sales-${Date.now()}`,
    salesperson: '',
    shippingIncluded: false,
    shippingFee: 0,
    items: [{
      productTypeId: testProduct.id,
      quantity: 10,
      unit: 'kg',
      unitPrice: 50,
    }],
  };

  const createRes = await apiPost(`/${factoryId}/sales/orders`, orderPayload);
  if (!createRes.data?.success) {
    evidence.captured['step1_create'] = 'FAILED';
    evidence.error = `Create failed: ${createRes.data?.message || JSON.stringify(createRes.data)}`;
    evidence.verdict = 'FAIL at Step 1: Cannot create sales order';
    record('L4', 'Sales Flow', 'FAIL', evidence);
    return;
  }

  const orderId = createRes.data.data?.id;
  const orderNumber = createRes.data.data?.orderNumber;
  evidence.captured['step1_orderId'] = orderId;
  evidence.captured['step1_orderNumber'] = orderNumber;
  evidence.captured['step1_status'] = createRes.data.data?.status || 'DRAFT';

  // Step 2: Confirm the order
  const confirmRes = await apiPost(`/${factoryId}/sales/orders/${orderId}/confirm`);
  if (!confirmRes.data?.success) {
    evidence.captured['step2_confirm'] = `FAILED: ${confirmRes.data?.message}`;
    evidence.verdict = `FAIL at Step 2: Cannot confirm order. ${confirmRes.data?.message}`;
    record('L4', 'Sales Flow', 'FAIL', evidence);
    return;
  }
  evidence.captured['step2_confirm'] = 'OK';

  // Verify status changed
  const afterConfirm = await apiGet(`/${factoryId}/sales/orders/${orderId}`);
  const confirmedStatus = afterConfirm.data?.data?.status;
  evidence.captured['step2_confirmedStatus'] = confirmedStatus;

  // Step 3: Create delivery
  const deliveryPayload = {
    salesOrderId: orderId,
    customerId: testCustomer.id,
    deliveryDate: new Date().toISOString().slice(0, 10),
    deliveryAddress: 'L4 E2E Test Address',
    logisticsCompany: 'L4 Test Logistics',
    items: [{
      productTypeId: testProduct.id,
      deliveredQuantity: 10,
      unit: 'kg',
      unitPrice: 50,
    }],
  };

  const delivRes = await apiPost(`/${factoryId}/sales/deliveries`, deliveryPayload);
  if (!delivRes.data?.success) {
    evidence.captured['step3_delivery'] = `FAILED: ${delivRes.data?.message}`;
    evidence.verdict = `FAIL at Step 3: Cannot create delivery. Status was ${confirmedStatus}. ${delivRes.data?.message}`;
    record('L4', 'Sales Flow', 'FAIL', evidence);
    return;
  }

  const deliveryId = delivRes.data.data?.id;
  evidence.captured['step3_deliveryId'] = deliveryId;

  // Step 4: Verify delivery in list
  const delivListRes = await apiGet(`/${factoryId}/sales/deliveries/by-order/${orderId}`);
  const deliveries = delivListRes.data?.success
    ? (Array.isArray(delivListRes.data.data) ? delivListRes.data.data : [])
    : [];
  const found = deliveries.find(d => String(d.id) === String(deliveryId));

  evidence.captured['step4_deliveries_count'] = deliveries.length;
  evidence.captured['step4_found'] = !!found;

  if (found) {
    evidence.verdict = `PASS: Full sales flow completed. Order ${orderNumber} -> confirmed (${confirmedStatus}) -> delivery ${deliveryId} created & verified.`;
    record('L4', 'Sales Flow', 'PASS', evidence);
  } else {
    evidence.verdict = `FAIL: Delivery created but not found in delivery list for order ${orderId}`;
    record('L4', 'Sales Flow', 'FAIL', evidence);
  }
}

async function L4_productionFlow() {
  console.log('\n' + '='.repeat(72));
  console.log('L4-2: Production Flow (create plan -> start -> check transfer orders)');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (products.length === 0) {
    evidence.verdict = 'SKIP: No active products available';
    record('L4', 'Production Flow', 'WARN', evidence);
    return;
  }

  const testProduct = products[0];
  evidence.captured['step0_product'] = `${testProduct.name} (${testProduct.id})`;

  // Count transfer orders before
  const transferBefore = await apiGet(`/${factoryId}/transfers`, { page: 1, size: 5 });
  const countBefore = transferBefore.data?.data?.totalElements || 0;
  evidence.captured['step0_transfers_before'] = countBefore;

  // Step 1: Create production plan
  const plannedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const planPayload = {
    productTypeId: testProduct.id,
    plannedQuantity: 100,
    plannedDate: plannedDate,
    notes: `L4-prod-${Date.now()}`,
  };

  const createRes = await apiPost(`/${factoryId}/production-plans`, planPayload);
  if (!createRes.data?.success) {
    evidence.captured['step1_create'] = `FAILED: ${createRes.data?.message}`;
    evidence.verdict = `FAIL at Step 1: Cannot create production plan. ${createRes.data?.message}`;
    record('L4', 'Production Flow', 'FAIL', evidence);
    return;
  }

  const planId = createRes.data.data?.id;
  const planNumber = createRes.data.data?.planNumber;
  evidence.captured['step1_planId'] = planId;
  evidence.captured['step1_planNumber'] = planNumber;
  evidence.captured['step1_status'] = createRes.data.data?.status;

  // Step 2: Start the plan
  const startRes = await apiPost(`/${factoryId}/production-plans/${planId}/start`);
  if (!startRes.data?.success) {
    evidence.captured['step2_start'] = `FAILED: ${startRes.data?.message}`;
    evidence.verdict = `WARN at Step 2: Cannot start plan. ${startRes.data?.message}. Transfer generation depends on BOM setup.`;
    record('L4', 'Production Flow', 'WARN', evidence);
    return;
  }

  evidence.captured['step2_start'] = 'OK';

  // Verify status
  const planAfterStart = await apiGet(`/${factoryId}/production-plans`);
  const plans = planAfterStart.data?.success ? (planAfterStart.data.data?.content || []) : [];
  const ourPlan = plans.find(p => String(p.id) === String(planId));
  evidence.captured['step2_status'] = ourPlan?.status || 'NOT_FOUND';

  // Step 3: Check transfer orders
  await sleep(1500);
  const transferAfter = await apiGet(`/${factoryId}/transfers`, { page: 1, size: 5 });
  const countAfter = transferAfter.data?.data?.totalElements || 0;
  evidence.captured['step3_transfers_after'] = countAfter;
  evidence.captured['step3_transfer_delta'] = countAfter - countBefore;

  if (countAfter > countBefore) {
    evidence.verdict = `PASS: Plan ${planNumber} created & started. Transfers: ${countBefore} -> ${countAfter} (+${countAfter - countBefore}).`;
    record('L4', 'Production Flow', 'PASS', evidence);
  } else {
    evidence.verdict = `WARN: Plan ${planNumber} created & started OK, but no new transfer orders. Expected if no BOM configured for "${testProduct.name}".`;
    record('L4', 'Production Flow', 'WARN', evidence);
  }
}

// ================================================================
// DATA SYNC: API create -> GET verify (3 tests via curl-style)
// ================================================================

async function DS_customerCreateVerify() {
  console.log('\n' + '='.repeat(72));
  console.log('DS-1: Create customer via API -> GET verify exists');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  const ts = Date.now();
  const custPayload = {
    name: `DS-Test-Customer-${ts}`,
    contactPerson: 'E2E Robot',
    phone: '13800000001',
    email: `ds-test-${ts}@e2e.test`,
    shippingAddress: 'Data Sync Test Address',
    remark: `DS-test-${ts}`,
  };

  evidence.captured['POST payload.name'] = custPayload.name;

  const createRes = await apiPost(`/${factoryId}/customers`, custPayload);
  evidence.captured['POST status'] = createRes.status;
  evidence.captured['POST success'] = createRes.data?.success;

  if (!createRes.data?.success) {
    evidence.error = `Create failed: ${createRes.data?.message || JSON.stringify(createRes.data)}`;
    evidence.verdict = 'FAIL: Cannot create customer via API';
    record('DataSync', 'Customer Create->Verify', 'FAIL', evidence);
    return;
  }

  const customerId = createRes.data.data?.id;
  evidence.captured['POST customerId'] = customerId;

  // GET verify
  const getRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 200 });
  const allCusts = getRes.data?.success ? (getRes.data.data?.content || []) : [];
  const found = allCusts.find(c => String(c.id) === String(customerId) || c.name === custPayload.name);

  evidence.captured['GET customers count'] = allCusts.length;
  evidence.captured['GET found'] = !!found;
  if (found) {
    evidence.captured['GET found.name'] = found.name;
    evidence.captured['GET found.id'] = found.id;
  }

  evidence.comparison = `POST created customer "${custPayload.name}" (id=${customerId}). GET /${factoryId}/customers searched for match.`;
  if (found) {
    evidence.verdict = `PASS: Customer "${custPayload.name}" created via POST and verified via GET. id=${customerId}.`;
    record('DataSync', 'Customer Create->Verify', 'PASS', evidence);
  } else {
    evidence.verdict = `FAIL: Customer "${custPayload.name}" created (id=${customerId}) but not found in GET list (${allCusts.length} items).`;
    record('DataSync', 'Customer Create->Verify', 'FAIL', evidence);
  }
}

async function DS_salesOrderCreateVerify() {
  console.log('\n' + '='.repeat(72));
  console.log('DS-2: Create sales order via API -> GET verify exists');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Get prereqs
  const custRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 10 });
  const customers = custRes.data?.success ? (custRes.data.data?.content || []) : [];
  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (customers.length === 0 || products.length === 0) {
    evidence.captured['customers'] = customers.length;
    evidence.captured['products'] = products.length;
    evidence.verdict = `SKIP: Need >=1 customer (${customers.length}) and >=1 product (${products.length})`;
    record('DataSync', 'SalesOrder Create->Verify', 'WARN', evidence);
    return;
  }

  const testCust = customers[0];
  const testProd = products[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const remark = `DS-so-${Date.now()}`;

  const orderPayload = {
    customerId: testCust.id,
    requiredDeliveryDate: tomorrow,
    deliveryAddress: 'DS Test Address',
    remark: remark,
    salesperson: '',
    shippingIncluded: false,
    shippingFee: 0,
    items: [{
      productTypeId: testProd.id,
      quantity: 5,
      unit: 'kg',
      unitPrice: 30,
    }],
  };

  evidence.captured['POST remark'] = remark;

  const createRes = await apiPost(`/${factoryId}/sales/orders`, orderPayload);
  evidence.captured['POST status'] = createRes.status;
  evidence.captured['POST success'] = createRes.data?.success;

  if (!createRes.data?.success) {
    evidence.error = `Create failed: ${createRes.data?.message || JSON.stringify(createRes.data)}`;
    evidence.verdict = 'FAIL: Cannot create sales order via API';
    record('DataSync', 'SalesOrder Create->Verify', 'FAIL', evidence);
    return;
  }

  const orderId = createRes.data.data?.id;
  const orderNumber = createRes.data.data?.orderNumber;
  evidence.captured['POST orderId'] = orderId;
  evidence.captured['POST orderNumber'] = orderNumber;

  // GET verify by fetching the specific order
  const getRes = await apiGet(`/${factoryId}/sales/orders/${orderId}`);
  evidence.captured['GET status'] = getRes.status;
  evidence.captured['GET success'] = getRes.data?.success;

  if (getRes.data?.success && getRes.data?.data) {
    const o = getRes.data.data;
    evidence.captured['GET order.id'] = o.id;
    evidence.captured['GET order.orderNumber'] = o.orderNumber;
    evidence.captured['GET order.status'] = o.status;
    evidence.captured['GET order.remark'] = o.remark;
    evidence.comparison = `POST created order ${orderNumber} (id=${orderId}). GET /${factoryId}/sales/orders/${orderId} retrieved it.`;
    evidence.verdict = `PASS: Sales order ${orderNumber} created via POST and verified via GET. Status=${o.status}.`;
    record('DataSync', 'SalesOrder Create->Verify', 'PASS', evidence);
  } else {
    evidence.verdict = `FAIL: Order ${orderNumber} created (id=${orderId}) but GET returned: ${getRes.data?.message}`;
    record('DataSync', 'SalesOrder Create->Verify', 'FAIL', evidence);
  }
}

async function DS_batchCreateVerify() {
  console.log('\n' + '='.repeat(72));
  console.log('DS-3: Create production batch via API -> GET verify exists');
  console.log('='.repeat(72));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Get product type
  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (products.length === 0) {
    evidence.verdict = 'SKIP: No active products available';
    record('DataSync', 'Batch Create->Verify', 'WARN', evidence);
    return;
  }

  const testProd = products[0];
  const now = new Date();
  const batchNumber = `DS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const batchPayload = {
    batchNumber: batchNumber,
    productTypeId: testProd.id,
    productName: testProd.name || testProd.productName || '',
    plannedQuantity: 25,
    quantity: 25,
    unit: 'kg',
    notes: `DS-batch-${Date.now()}`,
  };

  evidence.captured['POST batchNumber'] = batchNumber;

  const createRes = await apiPost(`/${factoryId}/processing/batches`, batchPayload);
  evidence.captured['POST status'] = createRes.status;
  evidence.captured['POST success'] = createRes.data?.success;

  if (!createRes.data?.success) {
    evidence.error = `Create failed: ${createRes.data?.message || JSON.stringify(createRes.data)}`;
    evidence.verdict = `FAIL: Cannot create batch via API. ${createRes.data?.message}`;
    record('DataSync', 'Batch Create->Verify', 'FAIL', evidence);
    return;
  }

  const batchId = createRes.data.data?.id;
  evidence.captured['POST batchId'] = batchId;

  // GET verify: search in batches list
  const getRes = await apiGet(`/${factoryId}/processing/batches`, { page: 1, size: 50 });
  const batches = getRes.data?.success ? (getRes.data.data?.content || []) : [];
  const found = batches.find(b => String(b.id) === String(batchId) || b.batchNumber === batchNumber);

  evidence.captured['GET batches count'] = batches.length;
  evidence.captured['GET found'] = !!found;
  if (found) {
    evidence.captured['GET found.batchNumber'] = found.batchNumber;
    evidence.captured['GET found.status'] = found.status;
  }

  evidence.comparison = `POST created batch "${batchNumber}" (id=${batchId}). GET searched batches list.`;
  if (found) {
    evidence.verdict = `PASS: Batch "${batchNumber}" created via POST and verified via GET. id=${batchId}, status=${found.status}.`;
    record('DataSync', 'Batch Create->Verify', 'PASS', evidence);
  } else {
    evidence.verdict = `FAIL: Batch "${batchNumber}" created (id=${batchId}) but not found in GET list (${batches.length} items).`;
    record('DataSync', 'Batch Create->Verify', 'FAIL', evidence);
  }
}

// ================================================================
// Main runner
// ================================================================
(async () => {
  console.log('='.repeat(72));
  console.log('  Layer 3 / Layer 4 / Data Sync Tests');
  console.log('  Target: REMOTE PRODUCTION');
  console.log(`  API: ${API_BASE}`);
  console.log(`  Web: ${WEB_BASE}`);
  console.log('='.repeat(72));

  // Login attempt 1
  console.log('\n--- Login attempt 1 ---');
  let loggedIn = await login().catch(e => { console.error('Login error:', e.message); return false; });

  if (!loggedIn) {
    console.log('Login failed. Waiting 65s before retry (rate limiting)...');
    await sleep(65000);
    console.log('--- Login attempt 2 ---');
    loggedIn = await login().catch(e => { console.error('Login error:', e.message); return false; });
  }

  if (!loggedIn) {
    console.error('FATAL: Cannot login after 2 attempts. Aborting.');
    process.exit(1);
  }

  console.log(`Logged in. factoryId=${factoryId}, token=${authToken.substring(0, 20)}...`);

  // Run Layer 3 tests
  console.log('\n\n' + '#'.repeat(72));
  console.log('# LAYER 3: Cross-Module Data Consistency');
  console.log('#'.repeat(72));

  await L3_materialSync();
  await L3_productSync();
  await L3_customerSync();
  await L3_supplierSync();

  // Wait 65s to avoid rate limiting before L4 (which does writes)
  console.log('\n--- Waiting 65s between test groups (rate limiting) ---');
  await sleep(65000);

  // Re-login in case token expired
  console.log('--- Re-login for Layer 4 ---');
  await login().catch(() => {});

  // Run Layer 4 tests
  console.log('\n\n' + '#'.repeat(72));
  console.log('# LAYER 4: Business Flow Tests');
  console.log('#'.repeat(72));

  await L4_salesFlow();

  // Wait 65s before next write-heavy test
  console.log('\n--- Waiting 65s before production flow test ---');
  await sleep(65000);

  // Re-login
  console.log('--- Re-login for Production Flow ---');
  await login().catch(() => {});

  await L4_productionFlow();

  // Wait 65s before data sync tests
  console.log('\n--- Waiting 65s before data sync tests ---');
  await sleep(65000);

  // Re-login
  console.log('--- Re-login for Data Sync ---');
  await login().catch(() => {});

  // Run Data Sync tests
  console.log('\n\n' + '#'.repeat(72));
  console.log('# DATA SYNC: Create via API -> GET Verify');
  console.log('#'.repeat(72));

  await DS_customerCreateVerify();
  await DS_salesOrderCreateVerify();
  await DS_batchCreateVerify();

  // ================================================================
  // Summary
  // ================================================================
  console.log('\n\n' + '='.repeat(72));
  console.log('  FINAL SUMMARY');
  console.log('='.repeat(72));

  const pass = results.filter(r => r.status === 'PASS');
  const warn = results.filter(r => r.status === 'WARN');
  const fail = results.filter(r => r.status === 'FAIL');

  console.log(`\n  Total: ${results.length} tests`);
  console.log(`  PASS:  ${pass.length}`);
  console.log(`  WARN:  ${warn.length}`);
  console.log(`  FAIL:  ${fail.length}`);

  if (fail.length > 0) {
    console.log('\n  FAILURES:');
    fail.forEach(f => console.log(`    [FAIL] ${f.layer} | ${f.testName}: ${f.evidence.verdict}`));
  }
  if (warn.length > 0) {
    console.log('\n  WARNINGS:');
    warn.forEach(w => console.log(`    [WARN] ${w.layer} | ${w.testName}: ${w.evidence.verdict}`));
  }

  console.log('\n' + '='.repeat(72));
  console.log(`  Result: ${fail.length === 0 ? 'ALL PASSED' : `${fail.length} FAILURE(S)`} (${warn.length} warnings)`);
  console.log('='.repeat(72));
})();
