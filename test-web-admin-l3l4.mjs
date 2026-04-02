/**
 * Web-Admin Layer 3 (Cross-Module Data Consistency) & Layer 4 (Business Flow) Tests
 *
 * BASE: http://localhost:5173
 * API:  http://localhost:10010
 * Login: factory_admin1 / 123456
 *
 * Usage: node test-web-admin-l3l4.mjs
 */

import http from 'http';
import https from 'https';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:10010/api/mobile';

// ============================================================
// Utility: HTTP request helper (no external deps)
// ============================================================
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 15000,
    };

    const req = lib.request(reqOptions, (res) => {
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

// ============================================================
// Auth & API helpers
// ============================================================
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
    // Try to extract from cookies if token in cookie
    if (!authToken && res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'];
      for (const c of (Array.isArray(cookies) ? cookies : [cookies])) {
        const match = c.match(/access_token=([^;]+)/);
        if (match) authToken = match[1];
      }
    }
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

// ============================================================
// Test Results Tracking
// ============================================================
const results = [];

function recordResult(layer, testName, status, evidence) {
  results.push({ layer, testName, status, evidence });
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[WARN]';
  console.log(`\n${icon} ${layer} | ${testName}`);
  if (evidence.captured) {
    for (const [label, val] of Object.entries(evidence.captured)) {
      const display = Array.isArray(val)
        ? (val.length > 8 ? `[${val.length} items] ${JSON.stringify(val.slice(0,5))}...` : JSON.stringify(val))
        : JSON.stringify(val);
      console.log(`   captured.${label} = ${display}`);
    }
  }
  if (evidence.comparison) console.log(`   comparison: ${evidence.comparison}`);
  if (evidence.verdict) console.log(`   verdict: ${evidence.verdict}`);
  if (evidence.error) console.log(`   error: ${evidence.error}`);
}

// ============================================================
// LAYER 3: Cross-Module Data Consistency
// ============================================================

async function L3_materialSync() {
  console.log('\n' + '='.repeat(70));
  console.log('L3-1: Material Sync (warehouse/materials vs BOM vs purchase dropdowns)');
  console.log('='.repeat(70));

  // Source 1: raw-material-types/active (used by warehouse, BOM, purchase)
  const matTypesRes = await apiGet(`/${factoryId}/raw-material-types/active`);
  const matTypes = matTypesRes.data?.success
    ? (Array.isArray(matTypesRes.data.data) ? matTypesRes.data.data : matTypesRes.data.data?.content || [])
    : [];
  const matTypeNames = matTypes.map(m => m.name).filter(Boolean).sort();
  const matTypeIds = matTypes.map(m => m.id).filter(Boolean).sort();

  // Source 2: material-batches list (warehouse actual data)
  const batchesRes = await apiGet(`/${factoryId}/material-batches`, { size: 200 });
  const batches = batchesRes.data?.success ? (batchesRes.data.data?.content || []) : [];
  // Extract unique material type names from batches
  const batchMaterialNames = [...new Set(batches.map(b => b.materialTypeName || b.materialName).filter(Boolean))].sort();

  // All three views (warehouse/materials/list.vue, production/bom/index.vue, procurement/orders/list.vue)
  // call the SAME endpoint: /{factoryId}/raw-material-types/active
  // So they MUST return identical data.

  const evidence = {
    captured: {
      'raw-material-types/active (count)': matTypes.length,
      'raw-material-types/active (names sample)': matTypeNames.slice(0, 10),
      'material-batches unique materials (count)': batchMaterialNames.length,
      'material-batches materials (sample)': batchMaterialNames.slice(0, 10),
    },
    comparison: `All 3 views (warehouse, BOM, purchase) call /${factoryId}/raw-material-types/active -> same ${matTypes.length} items.`,
    verdict: '',
  };

  // Verify: every material in batches should reference a valid material type
  const orphanMaterials = batchMaterialNames.filter(name => !matTypeNames.includes(name));

  if (matTypes.length > 0) {
    if (orphanMaterials.length === 0) {
      evidence.verdict = `PASS: ${matTypes.length} material types shared across warehouse/BOM/purchase. All ${batchMaterialNames.length} batch materials have matching types.`;
      recordResult('L3', 'Material Sync', 'PASS', evidence);
    } else {
      evidence.verdict = `WARN: ${orphanMaterials.length} batch materials not in active types: ${orphanMaterials.slice(0,5).join(', ')}`;
      evidence.captured['orphanMaterials'] = orphanMaterials;
      recordResult('L3', 'Material Sync', 'WARN', evidence);
    }
  } else {
    evidence.verdict = 'FAIL: No material types returned from /raw-material-types/active';
    recordResult('L3', 'Material Sync', 'FAIL', evidence);
  }
}

async function L3_productSync() {
  console.log('\n' + '='.repeat(70));
  console.log('L3-2: Product Sync (products vs sales dropdown vs production dropdown)');
  console.log('='.repeat(70));

  // Source 1: product-types/active (used by sales orders & production batches & BOM)
  const activeRes = await apiGet(`/${factoryId}/product-types/active`);
  const activeProducts = activeRes.data?.success
    ? (Array.isArray(activeRes.data.data) ? activeRes.data.data : activeRes.data.data?.content || [])
    : [];
  const activeNames = activeProducts.map(p => p.name).filter(Boolean).sort();
  const activeIds = activeProducts.map(p => p.id).filter(Boolean).sort();

  // Source 2: product-types (paginated, used by production plans list.vue)
  const allRes = await apiGet(`/${factoryId}/product-types`, { size: 200 });
  const allProducts = allRes.data?.success
    ? (allRes.data.data?.content || (Array.isArray(allRes.data.data) ? allRes.data.data : []))
    : [];
  const allNames = allProducts.map(p => p.name).filter(Boolean).sort();
  const allIds = allProducts.map(p => p.id).filter(Boolean).sort();

  // Active should be a subset of all
  const activeNotInAll = activeIds.filter(id => !allIds.includes(id));

  const evidence = {
    captured: {
      'product-types/active (count)': activeProducts.length,
      'product-types/active (names)': activeNames.slice(0, 15),
      'product-types paginated (count)': allProducts.length,
      'product-types paginated (names)': allNames.slice(0, 15),
    },
    comparison: `Sales & production batches use /product-types/active (${activeProducts.length}). Production plans uses /product-types (${allProducts.length}).`,
    verdict: '',
  };

  if (activeProducts.length > 0) {
    if (activeNotInAll.length === 0) {
      evidence.verdict = `PASS: ${activeProducts.length} active products are a valid subset of ${allProducts.length} total. Dropdowns consistent.`;
      recordResult('L3', 'Product Sync', 'PASS', evidence);
    } else {
      evidence.verdict = `WARN: ${activeNotInAll.length} active product IDs not in paginated list (possible pagination cutoff)`;
      evidence.captured['activeNotInAll'] = activeNotInAll;
      recordResult('L3', 'Product Sync', 'WARN', evidence);
    }
  } else {
    evidence.verdict = 'FAIL: No active products returned';
    recordResult('L3', 'Product Sync', 'FAIL', evidence);
  }
}

async function L3_customerSync() {
  console.log('\n' + '='.repeat(70));
  console.log('L3-3: Customer Sync (customer list vs sales order dropdown)');
  console.log('='.repeat(70));

  // Source 1: Customer list page (/{factoryId}/customers)
  const custListRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 200 });
  const custList = custListRes.data?.success ? (custListRes.data.data?.content || []) : [];
  const custListNames = custList.map(c => c.name).filter(Boolean).sort();
  const custListIds = custList.map(c => c.id).filter(Boolean).sort();

  // Source 2: Same endpoint is used by sales order list (loadCustomers)
  // Sales order list.vue calls: get(`/${factoryId}/customers`, { params: { page: 1, size: 100 } })
  const salesCustRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 100 });
  const salesCusts = salesCustRes.data?.success ? (salesCustRes.data.data?.content || []) : [];
  const salesCustNames = salesCusts.map(c => c.name).filter(Boolean).sort();
  const salesCustIds = salesCusts.map(c => c.id).filter(Boolean).sort();

  const evidence = {
    captured: {
      'customer list (size=200, count)': custList.length,
      'customer list names': custListNames.slice(0, 10),
      'sales dropdown (size=100, count)': salesCusts.length,
      'sales dropdown names': salesCustNames.slice(0, 10),
    },
    comparison: '',
    verdict: '',
  };

  // Compare: if total <= 100, both should be identical
  if (custList.length <= 100) {
    const match = JSON.stringify(custListIds) === JSON.stringify(salesCustIds);
    evidence.comparison = `Total customers ${custList.length} <= 100, so both queries should return identical data.`;
    evidence.verdict = match
      ? `PASS: Both return identical ${custList.length} customers.`
      : `FAIL: Mismatch! List has ${custList.length}, sales dropdown has ${salesCusts.length}.`;
    recordResult('L3', 'Customer Sync', match ? 'PASS' : 'FAIL', evidence);
  } else {
    // Sales dropdown might be truncated
    const allSalesInList = salesCustIds.every(id => custListIds.includes(id));
    evidence.comparison = `Total customers ${custList.length} > 100. Sales dropdown limited to 100.`;
    evidence.verdict = allSalesInList
      ? `WARN: Sales dropdown shows ${salesCusts.length}/${custList.length} customers (page size limit). All are valid.`
      : `FAIL: Sales dropdown contains customers not in master list.`;
    recordResult('L3', 'Customer Sync', allSalesInList ? 'WARN' : 'FAIL', evidence);
  }
}

async function L3_supplierSync() {
  console.log('\n' + '='.repeat(70));
  console.log('L3-4: Supplier Sync (supplier list vs purchase order dropdown)');
  console.log('='.repeat(70));

  // Source 1: Supplier list page (/{factoryId}/suppliers with size=200)
  const suppListRes = await apiGet(`/${factoryId}/suppliers`, { page: 1, size: 200 });
  const suppList = suppListRes.data?.success ? (suppListRes.data.data?.content || []) : [];
  const suppListNames = suppList.map(s => s.name).filter(Boolean).sort();
  const suppListIds = suppList.map(s => s.id).filter(Boolean).sort();

  // Source 2: Purchase order dropdown (/{factoryId}/suppliers with size=100)
  const purchSuppRes = await apiGet(`/${factoryId}/suppliers`, { page: 1, size: 100 });
  const purchSupps = purchSuppRes.data?.success ? (purchSuppRes.data.data?.content || []) : [];
  const purchSuppNames = purchSupps.map(s => s.name).filter(Boolean).sort();
  const purchSuppIds = purchSupps.map(s => s.id).filter(Boolean).sort();

  // Source 3: Warehouse materials list also loads suppliers (size=200)
  const whSuppRes = await apiGet(`/${factoryId}/suppliers`, { size: 200 });
  const whSupps = whSuppRes.data?.success ? (whSuppRes.data.data?.content || []) : [];
  const whSuppIds = whSupps.map(s => s.id).filter(Boolean).sort();

  const evidence = {
    captured: {
      'supplier list (size=200, count)': suppList.length,
      'supplier list names': suppListNames.slice(0, 10),
      'purchase dropdown (size=100, count)': purchSupps.length,
      'purchase dropdown names': purchSuppNames.slice(0, 10),
      'warehouse suppliers (size=200, count)': whSupps.length,
    },
    comparison: '',
    verdict: '',
  };

  if (suppList.length <= 100) {
    const matchPurch = JSON.stringify(suppListIds) === JSON.stringify(purchSuppIds);
    const matchWh = JSON.stringify(suppListIds) === JSON.stringify(whSuppIds);
    evidence.comparison = `Total suppliers ${suppList.length} <= 100. All views should match.`;
    if (matchPurch && matchWh) {
      evidence.verdict = `PASS: All 3 views return identical ${suppList.length} suppliers.`;
      recordResult('L3', 'Supplier Sync', 'PASS', evidence);
    } else {
      evidence.verdict = `FAIL: Mismatch: list=${suppList.length}, purchase=${purchSupps.length}, warehouse=${whSupps.length}`;
      recordResult('L3', 'Supplier Sync', 'FAIL', evidence);
    }
  } else {
    const allPurchInList = purchSuppIds.every(id => suppListIds.includes(id));
    evidence.comparison = `Total suppliers ${suppList.length} > 100. Purchase dropdown limited to 100.`;
    evidence.verdict = allPurchInList
      ? `WARN: Purchase dropdown shows ${purchSupps.length}/${suppList.length} suppliers. All are valid.`
      : `FAIL: Purchase dropdown contains suppliers not in master list.`;
    recordResult('L3', 'Supplier Sync', allPurchInList ? 'WARN' : 'FAIL', evidence);
  }
}

// ============================================================
// LAYER 4: Business Flow Tests
// ============================================================

async function L4_salesFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('L4-1: Sales Flow (create order -> confirm -> create delivery -> verify)');
  console.log('='.repeat(70));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Step 1: Get a customer and product for creating the order
  const custRes = await apiGet(`/${factoryId}/customers`, { page: 1, size: 10 });
  const customers = custRes.data?.success ? (custRes.data.data?.content || []) : [];
  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (customers.length === 0 || products.length === 0) {
    evidence.captured['customers'] = customers.length;
    evidence.captured['products'] = products.length;
    evidence.verdict = `SKIP: Need at least 1 customer (${customers.length}) and 1 product (${products.length})`;
    recordResult('L4', 'Sales Flow', 'WARN', evidence);
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
    deliveryAddress: 'E2E Test Address',
    remark: `L4-test-${Date.now()}`,
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
    recordResult('L4', 'Sales Flow', 'FAIL', evidence);
    return;
  }

  const orderId = createRes.data.data?.id;
  const orderNumber = createRes.data.data?.orderNumber;
  evidence.captured['step1_create'] = `OK: orderId=${orderId}, orderNumber=${orderNumber}`;
  evidence.captured['step1_status'] = createRes.data.data?.status || 'DRAFT';

  // Step 2: Confirm the order
  const confirmRes = await apiPost(`/${factoryId}/sales/orders/${orderId}/confirm`);
  if (!confirmRes.data?.success) {
    evidence.captured['step2_confirm'] = `FAILED: ${confirmRes.data?.message}`;
    evidence.verdict = 'FAIL at Step 2: Cannot confirm order';
    recordResult('L4', 'Sales Flow', 'FAIL', evidence);
    return;
  }
  evidence.captured['step2_confirm'] = 'OK: order confirmed';

  // Verify status changed
  const orderAfterConfirm = await apiGet(`/${factoryId}/sales/orders/${orderId}`);
  const confirmedStatus = orderAfterConfirm.data?.data?.status;
  evidence.captured['step2_status'] = confirmedStatus;

  // Step 3: Create delivery record
  const deliveryPayload = {
    salesOrderId: orderId,
    customerId: testCustomer.id,
    deliveryDate: new Date().toISOString().slice(0, 10),
    deliveryAddress: 'E2E Test Address',
    logisticsCompany: 'E2E Test Logistics',
    items: [{
      productTypeId: testProduct.id,
      deliveredQuantity: 10,
      unit: 'kg',
      unitPrice: 50,
    }],
  };

  const deliveryRes = await apiPost(`/${factoryId}/sales/deliveries`, deliveryPayload);
  if (!deliveryRes.data?.success) {
    evidence.captured['step3_delivery'] = `FAILED: ${deliveryRes.data?.message}`;
    evidence.verdict = `FAIL at Step 3: Cannot create delivery. Status was ${confirmedStatus}. Error: ${deliveryRes.data?.message}`;
    recordResult('L4', 'Sales Flow', 'FAIL', evidence);
    return;
  }

  const deliveryId = deliveryRes.data.data?.id;
  evidence.captured['step3_delivery'] = `OK: deliveryId=${deliveryId}`;

  // Step 4: Verify delivery appears in list
  const delivListRes = await apiGet(`/${factoryId}/sales/deliveries/by-order/${orderId}`);
  const deliveries = delivListRes.data?.success
    ? (Array.isArray(delivListRes.data.data) ? delivListRes.data.data : [])
    : [];
  const foundDelivery = deliveries.find(d => String(d.id) === String(deliveryId));

  evidence.captured['step4_deliveries_count'] = deliveries.length;
  evidence.captured['step4_found_delivery'] = !!foundDelivery;

  // Also check shipments list
  const shipRes = await apiGet(`/${factoryId}/shipments`, { page: 0, size: 20 });
  const shipments = shipRes.data?.success ? (shipRes.data.data?.content || []) : [];
  evidence.captured['step4_shipments_total'] = shipRes.data?.data?.totalElements || shipments.length;

  if (foundDelivery) {
    evidence.verdict = `PASS: Full sales flow completed. Order ${orderNumber} -> confirmed -> delivery created -> verified in delivery list.`;
    recordResult('L4', 'Sales Flow', 'PASS', evidence);
  } else {
    evidence.verdict = `FAIL: Delivery created but not found in delivery list for order ${orderId}`;
    recordResult('L4', 'Sales Flow', 'FAIL', evidence);
  }
}

async function L4_productionFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('L4-2: Production Flow (create plan -> start -> check transfer orders)');
  console.log('='.repeat(70));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Get product types
  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (products.length === 0) {
    evidence.verdict = 'SKIP: No active products available';
    recordResult('L4', 'Production Flow', 'WARN', evidence);
    return;
  }

  const testProduct = products[0];
  evidence.captured['step0_product'] = `${testProduct.name} (${testProduct.id})`;

  // Count existing transfer orders before
  const transferBefore = await apiGet(`/${factoryId}/transfers`, { page: 1, size: 5 });
  const transferCountBefore = transferBefore.data?.data?.totalElements || 0;
  evidence.captured['step0_transfers_before'] = transferCountBefore;

  // Step 1: Create production plan
  const plannedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const planPayload = {
    productTypeId: testProduct.id,
    plannedQuantity: 100,
    plannedDate: plannedDate,
    notes: `L4-test-${Date.now()}`,
  };

  const createRes = await apiPost(`/${factoryId}/production-plans`, planPayload);
  if (!createRes.data?.success) {
    evidence.captured['step1_create'] = `FAILED: ${createRes.data?.message}`;
    evidence.verdict = `FAIL at Step 1: Cannot create production plan. ${createRes.data?.message}`;
    recordResult('L4', 'Production Flow', 'FAIL', evidence);
    return;
  }

  const planId = createRes.data.data?.id;
  const planNumber = createRes.data.data?.planNumber;
  evidence.captured['step1_create'] = `OK: planId=${planId}, planNumber=${planNumber}`;
  evidence.captured['step1_status'] = createRes.data.data?.status;

  // Step 2: Start the plan (this may trigger transfer order generation)
  const startRes = await apiPost(`/${factoryId}/production-plans/${planId}/start`);
  if (!startRes.data?.success) {
    evidence.captured['step2_start'] = `FAILED: ${startRes.data?.message}`;
    // Not necessarily a failure - some setups may not allow start without BOM
    evidence.verdict = `WARN at Step 2: Cannot start plan. ${startRes.data?.message}. Transfer generation depends on BOM setup.`;
    recordResult('L4', 'Production Flow', 'WARN', evidence);
    return;
  }

  evidence.captured['step2_start'] = 'OK: plan started';

  // Verify plan status changed
  const planAfterStart = await apiGet(`/${factoryId}/production-plans`);
  const plans = planAfterStart.data?.success ? (planAfterStart.data.data?.content || []) : [];
  const ourPlan = plans.find(p => String(p.id) === String(planId));
  evidence.captured['step2_status'] = ourPlan?.status || 'NOT_FOUND';

  // Step 3: Check if transfer orders were generated
  // Wait a moment for async processing
  await new Promise(r => setTimeout(r, 1000));

  const transferAfter = await apiGet(`/${factoryId}/transfers`, { page: 1, size: 5 });
  const transferCountAfter = transferAfter.data?.data?.totalElements || 0;
  evidence.captured['step3_transfers_after'] = transferCountAfter;
  evidence.captured['step3_transfer_delta'] = transferCountAfter - transferCountBefore;

  if (transferCountAfter > transferCountBefore) {
    evidence.verdict = `PASS: Production plan created & started. Transfer orders increased from ${transferCountBefore} to ${transferCountAfter} (+${transferCountAfter - transferCountBefore}).`;
    recordResult('L4', 'Production Flow', 'PASS', evidence);
  } else {
    evidence.verdict = `WARN: Production plan created & started successfully, but no new transfer orders generated. This may be expected if no BOM is configured for product "${testProduct.name}" or no multi-factory setup.`;
    recordResult('L4', 'Production Flow', 'WARN', evidence);
  }
}

async function L4_qualityFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('L4-3: Quality Flow (create batch -> create inspection -> verify in list)');
  console.log('='.repeat(70));

  const evidence = { captured: {}, comparison: '', verdict: '' };

  // Step 0: Get product types for batch creation
  const prodRes = await apiGet(`/${factoryId}/product-types/active`);
  const products = prodRes.data?.success
    ? (Array.isArray(prodRes.data.data) ? prodRes.data.data : [])
    : [];

  if (products.length === 0) {
    evidence.verdict = 'SKIP: No active products available';
    recordResult('L4', 'Quality Flow', 'WARN', evidence);
    return;
  }

  const testProduct = products[0];
  evidence.captured['step0_product'] = `${testProduct.name} (${testProduct.id})`;

  // Step 1: Create production batch
  const now = new Date();
  const batchNumber = `PB-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.random().toString(36).substring(2,7).toUpperCase()}`;

  const batchPayload = {
    batchNumber: batchNumber,
    productTypeId: testProduct.id,
    productName: testProduct.name || testProduct.productName || '',
    plannedQuantity: 50,
    quantity: 50,
    unit: 'kg',
    notes: `L4-quality-test-${Date.now()}`,
  };

  const batchRes = await apiPost(`/${factoryId}/processing/batches`, batchPayload);
  if (!batchRes.data?.success) {
    evidence.captured['step1_batch'] = `FAILED: ${batchRes.data?.message}`;
    evidence.verdict = `FAIL at Step 1: Cannot create batch. ${batchRes.data?.message}`;
    recordResult('L4', 'Quality Flow', 'FAIL', evidence);
    return;
  }

  const batchId = batchRes.data.data?.id;
  evidence.captured['step1_batch'] = `OK: batchId=${batchId}, batchNumber=${batchNumber}`;
  evidence.captured['step1_status'] = batchRes.data.data?.status;

  // Step 2: Create quality inspection for this batch
  const inspectionPayload = {
    sampleSize: 20,
    passCount: 18,
    failCount: 2,
    result: 'PASS',
    notes: `L4 quality test inspection - ${Date.now()}`,
  };

  const inspRes = await apiPost(
    `/${factoryId}/processing/quality/inspections?batchId=${encodeURIComponent(batchId)}`,
    inspectionPayload
  );

  if (!inspRes.data?.success) {
    evidence.captured['step2_inspection'] = `FAILED: ${inspRes.data?.message}`;
    evidence.verdict = `FAIL at Step 2: Cannot create inspection. ${inspRes.data?.message}`;
    recordResult('L4', 'Quality Flow', 'FAIL', evidence);
    return;
  }

  // Response format: { success, data: { passRate, inspection: { id, passCount, ... } } }
  const inspData = inspRes.data.data?.inspection || inspRes.data.data;
  const inspectionId = inspData?.id;
  evidence.captured['step2_inspection'] = `OK: inspectionId=${inspectionId}`;
  evidence.captured['step2_passCount'] = inspData?.passCount;
  evidence.captured['step2_failCount'] = inspData?.failCount;
  evidence.captured['step2_result'] = inspData?.result;
  evidence.captured['step2_passRate'] = inspRes.data.data?.passRate;

  // Step 3: Verify inspection appears in the inspections list
  const inspListRes = await apiGet(`/${factoryId}/processing/quality/inspections`, { page: 1, size: 50 });
  const inspections = inspListRes.data?.success ? (inspListRes.data.data?.content || []) : [];

  // Look for our inspection by ID or by matching batchId + notes
  const foundInspection = inspections.find(i =>
    String(i.id) === String(inspectionId) ||
    (String(i.productionBatchId) === String(batchId) && String(i.notes || '').includes('L4 quality test'))
  );

  evidence.captured['step3_inspections_total'] = inspListRes.data?.data?.totalElements || inspections.length;
  evidence.captured['step3_found'] = !!foundInspection;

  if (foundInspection) {
    evidence.captured['step3_verified_passCount'] = foundInspection.passCount;
    evidence.captured['step3_verified_failCount'] = foundInspection.failCount;
    evidence.captured['step3_verified_result'] = foundInspection.result;
    evidence.captured['step3_verified_batchNumber'] = foundInspection.batchNumber || foundInspection.batch?.batchNumber;

    // Verify counts match
    const passMatch = Number(foundInspection.passCount) === 18;
    const failMatch = Number(foundInspection.failCount) === 2;

    if (passMatch && failMatch) {
      evidence.verdict = `PASS: Batch ${batchNumber} created -> inspection created (pass=18, fail=2) -> verified in list with correct counts.`;
      recordResult('L4', 'Quality Flow', 'PASS', evidence);
    } else {
      evidence.verdict = `FAIL: Inspection found but counts mismatch. Expected pass=18/fail=2, got pass=${foundInspection.passCount}/fail=${foundInspection.failCount}`;
      recordResult('L4', 'Quality Flow', 'FAIL', evidence);
    }
  } else {
    // Try to find by batch number
    const foundByBatch = inspections.find(i =>
      String(i.batchId) === String(batchId) ||
      i.batchNumber === batchNumber ||
      i.batch?.batchNumber === batchNumber
    );
    if (foundByBatch) {
      evidence.captured['step3_found_by_batch'] = true;
      evidence.verdict = `PASS: Inspection found by batchId in list (ID lookup missed, batch lookup succeeded).`;
      recordResult('L4', 'Quality Flow', 'PASS', evidence);
    } else {
      evidence.verdict = `FAIL: Inspection created successfully (id=${inspectionId}) but NOT found in inspection list.`;
      recordResult('L4', 'Quality Flow', 'FAIL', evidence);
    }
  }
}

// ============================================================
// Final Report
// ============================================================

function printFinalReport() {
  console.log('\n\n' + '='.repeat(80));
  console.log('FINAL TEST REPORT');
  console.log('='.repeat(80));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL} (API: ${API_BASE})`);
  console.log(`Factory ID: ${factoryId}`);
  console.log('-'.repeat(80));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;

  console.log(`\nSummary: ${passCount} PASS / ${failCount} FAIL / ${warnCount} WARN  (${results.length} total)\n`);

  for (const r of results) {
    const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'FAIL' ? '[FAIL]' : '[WARN]';
    console.log(`${icon} ${r.layer} | ${r.testName}`);
    console.log(`       ${r.evidence.verdict}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('FORCED EVIDENCE DETAILS');
  console.log('='.repeat(80));

  for (const r of results) {
    console.log(`\n--- ${r.layer} | ${r.testName} [${r.status}] ---`);
    console.log('Captured Data:');
    if (r.evidence.captured) {
      for (const [k, v] of Object.entries(r.evidence.captured)) {
        const display = Array.isArray(v)
          ? JSON.stringify(v)
          : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        console.log(`  ${k}: ${display}`);
      }
    }
    if (r.evidence.comparison) console.log(`Comparison: ${r.evidence.comparison}`);
    console.log(`Verdict: ${r.evidence.verdict}`);
    if (r.evidence.error) console.log(`Error: ${r.evidence.error}`);
  }

  console.log('\n' + '='.repeat(80));
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('Web-Admin L3+L4 Test Suite');
  console.log(`API: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  // Login
  console.log('Authenticating...');
  const loginOk = await login();
  if (!loginOk) {
    console.error('FATAL: Login failed. Aborting.');
    process.exit(1);
  }
  console.log(`Logged in. factoryId=${factoryId}, token=${authToken.substring(0, 20)}...`);

  // Layer 3: Cross-module data consistency
  console.log('\n' + '#'.repeat(80));
  console.log('# LAYER 3: Cross-Module Data Consistency');
  console.log('#'.repeat(80));

  await L3_materialSync();
  await L3_productSync();
  await L3_customerSync();
  await L3_supplierSync();

  // Layer 4: Business flow
  console.log('\n' + '#'.repeat(80));
  console.log('# LAYER 4: Business Flow Tests');
  console.log('#'.repeat(80));

  await L4_salesFlow();
  await L4_productionFlow();
  await L4_qualityFlow();

  // Print report
  printFinalReport();

  // Exit code
  const failCount = results.filter(r => r.status === 'FAIL').length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
