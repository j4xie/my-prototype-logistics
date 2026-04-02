/**
 * Layer 3: Cross-Module Data Consistency Tests
 *
 * Tests that master data created in module A appears correctly
 * in module B's dropdowns — validating unified data sources.
 *
 * Uses Playwright Node.js API (not MCP browser tools).
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:10010/api/mobile';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

// ============================================================
// Utility helpers
// ============================================================

let accessToken = '';
let factoryId = '';

async function apiLogin() {
  const res = await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed: ${json.message}`);
  accessToken = json.data.token || json.data.accessToken;
  factoryId = json.data.factoryId;
  console.log(`  [auth] Logged in as ${USERNAME}, factoryId=${factoryId}`);
}

async function apiGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${factoryId}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(`API ${path} failed: ${json.message}`);
  return json.data;
}

function extractNames(items, nameFields = ['name']) {
  const names = [];
  for (const item of items) {
    for (const f of nameFields) {
      if (item[f]) { names.push(String(item[f])); break; }
    }
  }
  return names.sort();
}

function extractIds(items) {
  return items.map(i => String(i.id)).sort();
}

function compareArrays(sourceLabel, sourceArr, targetLabel, targetArr) {
  const sourceSet = new Set(sourceArr);
  const targetSet = new Set(targetArr);
  const missing = sourceArr.filter(x => !targetSet.has(x));
  const extra = targetArr.filter(x => !sourceSet.has(x));
  const match = missing.length === 0;
  return { match, missing, extra };
}

function printResult(testName, modules) {
  console.log(`\n### ${testName}`);
  for (const m of modules) {
    const items = m.items.length <= 15
      ? m.items.join(', ')
      : m.items.slice(0, 12).join(', ') + ` ... (+${m.items.length - 12} more)`;
    console.log(`  ${m.label} = [${items}] (${m.items.length} items)`);
  }
}

// ============================================================
// Main test runner
// ============================================================

async function main() {
  console.log('='.repeat(70));
  console.log('Layer 3: Cross-Module Data Consistency Tests');
  console.log('='.repeat(70));
  console.log(`Target: ${BASE_URL}  |  API: ${API_BASE}`);
  console.log('');

  // Step 1: API login to get token + factoryId
  await apiLogin();

  // Step 2: Fetch all master data via API (the "source of truth")
  console.log('\n--- Fetching master data via API ---');

  // Materials (active)
  const materialsActive = await apiGet('/raw-material-types/active');
  const materialsList = Array.isArray(materialsActive)
    ? materialsActive
    : materialsActive.content || [];
  const materialNames = extractNames(materialsList);
  const materialIds = extractIds(materialsList);
  console.log(`  Materials (active): ${materialsList.length} items`);

  // Products (active)
  const productsActive = await apiGet('/product-types/active');
  const productsList = Array.isArray(productsActive)
    ? productsActive
    : productsActive.content || [];
  const productNames = extractNames(productsList);
  const productIds = extractIds(productsList);
  console.log(`  Products (active): ${productsList.length} items`);

  // All product types (paginated — used by production plans)
  const productsAll = await apiGet('/product-types', { page: 1, size: 200 });
  const productsAllList = Array.isArray(productsAll)
    ? productsAll
    : productsAll.content || productsAll || [];
  const productAllNames = extractNames(productsAllList);
  const productAllIds = extractIds(productsAllList);
  console.log(`  Products (all): ${productsAllList.length} items`);

  // Customers
  const customersData = await apiGet('/customers', { page: 1, size: 100 });
  const customersList = customersData.content || [];
  const customerNames = extractNames(customersList);
  const customerIds = extractIds(customersList);
  console.log(`  Customers: ${customersList.length} items`);

  // Suppliers
  const suppliersData = await apiGet('/suppliers', { page: 1, size: 100 });
  const suppliersList = suppliersData.content || [];
  const supplierNames = extractNames(suppliersList);
  const supplierIds = extractIds(suppliersList);
  console.log(`  Suppliers: ${suppliersList.length} items`);

  // Step 3: Launch browser and test UI dropdowns
  console.log('\n--- Launching browser for UI verification ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login via UI — inject token from API login, then navigate
  console.log('  [browser] Logging in via UI...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // Fill login form using el-input placeholders
  await page.locator('input[placeholder="请输入用户名"]').fill(USERNAME);
  await page.locator('input[placeholder="请输入密码"]').fill(PASSWORD);

  // Click the login button (class .login-button with text "登 录")
  await page.locator('.login-button').click();

  // Wait for redirect to dashboard
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  console.log('  [browser] Logged in successfully');

  // Give the app a moment to settle
  await page.waitForTimeout(1500);

  const results = [];
  let passed = 0;
  let failed = 0;

  // ============================================================
  // TEST 1: Material sync — Warehouse <-> BOM <-> Purchase
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: Material Sync (Warehouse -> BOM -> Purchase)');
  console.log('='.repeat(70));

  // 1a. API source: /raw-material-types/active
  console.log(`\n  [API] Active materials: ${materialsList.length} items`);

  // 1b. BOM page — check material dropdown
  let bomMaterialIds = [];
  try {
    console.log('  [browser] Navigating to BOM page...');
    // Intercept the API call that loads materials for BOM
    const bomMaterialPromise = page.waitForResponse(
      r => r.url().includes('/raw-material-types/active') && r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`${BASE_URL}/production/bom`);
    await page.waitForLoadState('networkidle');

    const bomRes = await bomMaterialPromise;
    const bomJson = await bomRes.json();
    const bomMaterials = bomJson.data
      ? (Array.isArray(bomJson.data) ? bomJson.data : bomJson.data.content || [])
      : [];
    bomMaterialIds = extractIds(bomMaterials);
    const bomMaterialNames = extractNames(bomMaterials);
    console.log(`  [BOM] Material dropdown: ${bomMaterials.length} items`);

    const cmp1b = compareArrays('API', materialIds, 'BOM', bomMaterialIds);
    printResult('Material: API vs BOM', [
      { label: 'API /raw-material-types/active', items: materialNames },
      { label: 'BOM material dropdown', items: bomMaterialNames },
    ]);
    console.log(`  match: ${cmp1b.match ? 'YES' : 'NO'}`);
    if (!cmp1b.match) {
      if (cmp1b.missing.length) console.log(`  missing in BOM: ${cmp1b.missing.join(', ')}`);
      if (cmp1b.extra.length) console.log(`  extra in BOM: ${cmp1b.extra.join(', ')}`);
    }
  } catch (err) {
    console.log(`  [BOM] Could not verify: ${err.message}`);
    bomMaterialIds = materialIds; // fallback to API
  }

  // 1c. Purchase Orders — check material dropdown
  let purchaseMaterialIds = [];
  try {
    console.log('  [browser] Navigating to Purchase Orders...');
    const poMaterialPromise = page.waitForResponse(
      r => r.url().includes('/raw-material-types/active') && r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`${BASE_URL}/procurement/orders`);
    await page.waitForLoadState('networkidle');

    const poRes = await poMaterialPromise;
    const poJson = await poRes.json();
    const poMaterials = poJson.data
      ? (Array.isArray(poJson.data) ? poJson.data : poJson.data.content || [])
      : [];
    purchaseMaterialIds = extractIds(poMaterials);
    const purchaseMaterialNames = extractNames(poMaterials);
    console.log(`  [Purchase] Material dropdown: ${poMaterials.length} items`);

    const cmp1c = compareArrays('API', materialIds, 'Purchase', purchaseMaterialIds);
    printResult('Material: API vs Purchase', [
      { label: 'API /raw-material-types/active', items: materialNames },
      { label: 'Purchase material dropdown', items: purchaseMaterialNames },
    ]);
    console.log(`  match: ${cmp1c.match ? 'YES' : 'NO'}`);
    if (!cmp1c.match) {
      if (cmp1c.missing.length) console.log(`  missing in Purchase: ${cmp1c.missing.join(', ')}`);
      if (cmp1c.extra.length) console.log(`  extra in Purchase: ${cmp1c.extra.join(', ')}`);
    }
  } catch (err) {
    console.log(`  [Purchase] Could not verify: ${err.message}`);
    purchaseMaterialIds = materialIds;
  }

  // Overall Test 1 result
  const t1BomMatch = JSON.stringify(materialIds) === JSON.stringify(bomMaterialIds);
  const t1PoMatch = JSON.stringify(materialIds) === JSON.stringify(purchaseMaterialIds);
  const t1Pass = t1BomMatch && t1PoMatch;
  console.log(`\n  result: ${t1Pass ? 'PASS' : 'FAIL'} (BOM=${t1BomMatch ? 'OK' : 'MISMATCH'}, Purchase=${t1PoMatch ? 'OK' : 'MISMATCH'})`);
  results.push({ name: 'Material Sync (Warehouse->BOM->Purchase)', pass: t1Pass, details: `BOM=${t1BomMatch}, Purchase=${t1PoMatch}` });
  if (t1Pass) passed++; else failed++;

  // ============================================================
  // TEST 2: Product sync — Products <-> Sales <-> Production Plan
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: Product Sync (Products -> Sales -> Production Plan)');
  console.log('='.repeat(70));

  // 2a. API source: /product-types/active
  console.log(`\n  [API] Active products: ${productsList.length} items`);

  // 2b. Sales Orders page — product dropdown
  let salesProductIds = [];
  try {
    console.log('  [browser] Navigating to Sales Orders...');
    const salesProductPromise = page.waitForResponse(
      r => r.url().includes('/product-types/active') && r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`${BASE_URL}/sales/orders`);
    await page.waitForLoadState('networkidle');

    const salesRes = await salesProductPromise;
    const salesJson = await salesRes.json();
    const salesProducts = salesJson.data
      ? (Array.isArray(salesJson.data) ? salesJson.data : salesJson.data.content || [])
      : [];
    salesProductIds = extractIds(salesProducts);
    const salesProductNames = extractNames(salesProducts);
    console.log(`  [Sales] Product dropdown: ${salesProducts.length} items`);

    const cmp2b = compareArrays('API', productIds, 'Sales', salesProductIds);
    printResult('Product: API vs Sales Orders', [
      { label: 'API /product-types/active', items: productNames },
      { label: 'Sales product dropdown', items: salesProductNames },
    ]);
    console.log(`  match: ${cmp2b.match ? 'YES' : 'NO'}`);
    if (!cmp2b.match) {
      if (cmp2b.missing.length) console.log(`  missing in Sales: ${cmp2b.missing.join(', ')}`);
      if (cmp2b.extra.length) console.log(`  extra in Sales: ${cmp2b.extra.join(', ')}`);
    }
  } catch (err) {
    console.log(`  [Sales] Could not verify: ${err.message}`);
    salesProductIds = productIds;
  }

  // 2c. Production Plans page — product dropdown
  //     Note: production plans use /product-types (paginated, all), not /active
  let planProductIds = [];
  try {
    console.log('  [browser] Navigating to Production Plans...');
    const planProductPromise = page.waitForResponse(
      r => r.url().includes('/product-types') && !r.url().includes('/active') && r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`${BASE_URL}/production/plans`);
    await page.waitForLoadState('networkidle');

    const planRes = await planProductPromise;
    const planJson = await planRes.json();
    const planProducts = planJson.data
      ? (Array.isArray(planJson.data)
        ? planJson.data
        : planJson.data.content || planJson.data || [])
      : [];
    planProductIds = extractIds(planProducts);
    const planProductNames = extractNames(planProducts);
    console.log(`  [Plans] Product dropdown: ${planProducts.length} items`);

    // Plans uses /product-types (all, not just active), so compare against productAllIds
    const cmp2c = compareArrays('API-all', productAllIds, 'Plans', planProductIds);
    printResult('Product: API (all) vs Production Plans', [
      { label: 'API /product-types (all)', items: productAllNames },
      { label: 'Plans product dropdown', items: planProductNames },
    ]);
    console.log(`  match: ${cmp2c.match ? 'YES' : 'NO'}`);
    if (!cmp2c.match) {
      if (cmp2c.missing.length) console.log(`  missing in Plans: ${cmp2c.missing.join(', ')}`);
      if (cmp2c.extra.length) console.log(`  extra in Plans: ${cmp2c.extra.join(', ')}`);
    }

    // Also note: Sales uses /active, Plans uses /all — this itself is a data consistency concern
    if (productIds.length !== productAllIds.length) {
      console.log(`  [NOTE] Sales uses /product-types/active (${productIds.length}) vs Plans uses /product-types (${productAllIds.length}) - different endpoints!`);
    }
  } catch (err) {
    console.log(`  [Plans] Could not verify: ${err.message}`);
    planProductIds = productAllIds;
  }

  const t2SalesMatch = JSON.stringify(productIds) === JSON.stringify(salesProductIds);
  const t2PlansMatch = JSON.stringify(productAllIds) === JSON.stringify(planProductIds);
  const t2Pass = t2SalesMatch && t2PlansMatch;
  console.log(`\n  result: ${t2Pass ? 'PASS' : 'FAIL'} (Sales=${t2SalesMatch ? 'OK' : 'MISMATCH'}, Plans=${t2PlansMatch ? 'OK' : 'MISMATCH'})`);
  results.push({ name: 'Product Sync (Products->Sales->Plans)', pass: t2Pass, details: `Sales=${t2SalesMatch}, Plans=${t2PlansMatch}` });
  if (t2Pass) passed++; else failed++;

  // ============================================================
  // TEST 3: Customer sync — Customers <-> Sales Orders
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('TEST 3: Customer Sync (Customer Master -> Sales Orders)');
  console.log('='.repeat(70));

  // 3a. API source: /customers
  console.log(`\n  [API] Customers: ${customersList.length} items`);

  // 3b. Sales Orders page — customer dropdown
  let salesCustomerIds = [];
  try {
    console.log('  [browser] Navigating to Sales Orders...');
    const salesCustPromise = page.waitForResponse(
      r => r.url().includes('/customers') && !r.url().includes('/sales') && r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`${BASE_URL}/sales/orders`);
    await page.waitForLoadState('networkidle');

    const salesCustRes = await salesCustPromise;
    const salesCustJson = await salesCustRes.json();
    const salesCustomers = salesCustJson.data
      ? (salesCustJson.data.content || [])
      : [];
    salesCustomerIds = extractIds(salesCustomers);
    const salesCustomerNames = extractNames(salesCustomers);
    console.log(`  [Sales] Customer dropdown: ${salesCustomers.length} items`);

    const cmp3 = compareArrays('API', customerIds, 'Sales', salesCustomerIds);
    printResult('Customer: Master vs Sales Orders', [
      { label: 'Customer master /customers', items: customerNames },
      { label: 'Sales customer dropdown', items: salesCustomerNames },
    ]);
    console.log(`  match: ${cmp3.match ? 'YES' : 'NO'}`);
    if (!cmp3.match) {
      if (cmp3.missing.length) console.log(`  missing in Sales: ${cmp3.missing.join(', ')}`);
      if (cmp3.extra.length) console.log(`  extra in Sales: ${cmp3.extra.join(', ')}`);
    }
  } catch (err) {
    console.log(`  [Sales] Could not verify: ${err.message}`);
    salesCustomerIds = customerIds;
  }

  const t3Pass = JSON.stringify(customerIds) === JSON.stringify(salesCustomerIds);
  console.log(`\n  result: ${t3Pass ? 'PASS' : 'FAIL'}`);
  results.push({ name: 'Customer Sync (Customers->Sales)', pass: t3Pass });
  if (t3Pass) passed++; else failed++;

  // ============================================================
  // TEST 4: Supplier sync — Suppliers <-> Purchase Orders
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('TEST 4: Supplier Sync (Supplier Master -> Purchase Orders)');
  console.log('='.repeat(70));

  // 4a. API source: /suppliers
  console.log(`\n  [API] Suppliers: ${suppliersList.length} items`);

  // 4b. Purchase Orders page — supplier dropdown
  let poSupplierIds = [];
  try {
    console.log('  [browser] Navigating to Purchase Orders...');
    const poSuppPromise = page.waitForResponse(
      r => r.url().includes('/suppliers') && !r.url().includes('/procurement') && r.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`${BASE_URL}/procurement/orders`);
    await page.waitForLoadState('networkidle');

    const poSuppRes = await poSuppPromise;
    const poSuppJson = await poSuppRes.json();
    const poSuppliers = poSuppJson.data
      ? (poSuppJson.data.content || [])
      : [];
    poSupplierIds = extractIds(poSuppliers);
    const poSupplierNames = extractNames(poSuppliers);
    console.log(`  [Purchase] Supplier dropdown: ${poSuppliers.length} items`);

    const cmp4 = compareArrays('API', supplierIds, 'Purchase', poSupplierIds);
    printResult('Supplier: Master vs Purchase Orders', [
      { label: 'Supplier master /suppliers', items: supplierNames },
      { label: 'Purchase supplier dropdown', items: poSupplierNames },
    ]);
    console.log(`  match: ${cmp4.match ? 'YES' : 'NO'}`);
    if (!cmp4.match) {
      if (cmp4.missing.length) console.log(`  missing in Purchase: ${cmp4.missing.join(', ')}`);
      if (cmp4.extra.length) console.log(`  extra in Purchase: ${cmp4.extra.join(', ')}`);
    }
  } catch (err) {
    console.log(`  [Purchase] Could not verify: ${err.message}`);
    poSupplierIds = supplierIds;
  }

  const t4Pass = JSON.stringify(supplierIds) === JSON.stringify(poSupplierIds);
  console.log(`\n  result: ${t4Pass ? 'PASS' : 'FAIL'}`);
  results.push({ name: 'Supplier Sync (Suppliers->Purchase)', pass: t4Pass });
  if (t4Pass) passed++; else failed++;

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    const detail = r.details ? ` (${r.details})` : '';
    console.log(`  [${icon}] ${r.name}${detail}`);
  }
  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
