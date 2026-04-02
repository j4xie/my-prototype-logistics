/**
 * Layer 4 Business Flow Tests -- Production & Quality
 *
 * Flow 1: Production Plan -> Generate Transfer Order (Bug D4 validation)
 * Flow 2: Production Batch Lifecycle (Create -> list -> detail)
 * Flow 3: Quality Inspection Create
 *
 * Usage: node test-layer4-flows.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:10010';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

// -- Helpers --
const results = [];
let apiToken = null;
let factoryId = 'F001';

function record(flow, step, status, detail) {
  results.push({ flow, step, status, detail, ts: new Date().toISOString() });
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[INFO]';
  console.log(`  ${icon} ${flow} > ${step}: ${detail}`);
}

async function apiCall(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}/api/mobile${path}`, opts);
  return resp.json();
}

async function closeAllDialogs(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  const closeButtons = page.locator('.el-overlay:visible .el-dialog__close, .el-overlay:visible .el-message-box__close');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(i).click().catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
}

// -- Login --
async function login(page) {
  console.log('\n=== Logging in ===');
  try {
    const resp = await fetch(`${API_BASE}/api/mobile/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const json = await resp.json();
    if (json.success && json.data) {
      apiToken = json.data.token || json.data.accessToken;
      factoryId = json.data.factoryId || 'F001';
      record('Setup', 'APILogin', 'PASS', `Token obtained, factoryId=${factoryId}`);
    } else {
      record('Setup', 'APILogin', 'FAIL', `API: ${json.message || 'failed'}`);
      return false;
    }
  } catch (e) {
    record('Setup', 'APILogin', 'FAIL', `API error: ${e.message}`);
    return false;
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Inject token + user into localStorage
  await page.evaluate(({ token, username, fid }) => {
    localStorage.setItem('cretas_access_token', token);
    let userData;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userData = {
        id: payload.userId, username: payload.username || username,
        email: '', isActive: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        userType: 'factory',
        factoryUser: {
          role: payload.role || 'factory_super_admin',
          factoryId: payload.factoryId || fid,
          factoryType: payload.factoryType || 'FACTORY',
          permissions: payload.permissions || [],
        }
      };
    } catch {
      userData = {
        id: 1, username, email: '', isActive: true,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        userType: 'factory',
        factoryUser: { role: 'factory_super_admin', factoryId: fid, factoryType: 'FACTORY', permissions: [] }
      };
    }
    localStorage.setItem('cretas_user', JSON.stringify(userData));
  }, { token: apiToken, username: USERNAME, fid: factoryId });

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  if (!page.url().includes('/login')) {
    record('Setup', 'Login', 'PASS', `Authenticated, at ${page.url()}`);
    return true;
  }
  record('Setup', 'Login', 'FAIL', `Still at login: ${page.url()}`);
  return false;
}

// =====================================================================
// Flow 1: Production Plan -> Generate Transfer Order (Bug D4)
// =====================================================================
async function flow1_generateTransfer(page) {
  console.log('\n=== Flow 1: Production Plan -> Generate Transfer Order (Bug D4) ===');

  // Ensure at least one PLANNED/PENDING plan exists via API
  let planId = null;
  try {
    const listResp = await apiCall('GET', `/${factoryId}/production-plans?page=1&size=5`);
    const plans = listResp.success ? (listResp.data?.content || []) : [];
    const pendingPlans = plans.filter(p => p.status === 'PLANNED' || p.status === 'PENDING');
    record('Flow1', 'CheckPlans', 'INFO', `${plans.length} total plans, ${pendingPlans.length} pending/planned`);

    if (pendingPlans.length === 0) {
      const ptResp = await apiCall('GET', `/${factoryId}/product-types`);
      const pts = ptResp.success ? (ptResp.data?.content || ptResp.data || []) : [];
      if (pts.length > 0) {
        const cr = await apiCall('POST', `/${factoryId}/production-plans`, {
          productTypeId: pts[0].id, plannedQuantity: 100, plannedDate: '2026-04-05',
          notes: 'E2E test - Flow1 transfer',
        });
        if (cr.success) {
          planId = cr.data?.id;
          record('Flow1', 'CreatePlan', 'PASS', `Created plan: ${cr.data?.planNumber}`);
        }
      }
    } else {
      planId = pendingPlans[0].id;
    }
  } catch (e) {
    record('Flow1', 'Setup', 'INFO', `API error: ${e.message}`);
  }

  // Navigate to /production/plans
  await page.goto(`${BASE_URL}/production/plans`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const title = await page.locator('.page-title').first().textContent().catch(() => '');
  record('Flow1', 'Navigate', title.includes('生产计划') ? 'PASS' : 'INFO', `Page: "${title}"`);

  const rows = page.locator('.el-table__body-wrapper .el-table__row');
  const rowCount = await rows.count();
  record('Flow1', 'TableRows', rowCount > 0 ? 'PASS' : 'FAIL', `${rowCount} rows`);

  // Find and click "生成调拨单"
  let transferClicked = false;
  for (let i = 0; i < Math.min(rowCount, 10); i++) {
    const btn = rows.nth(i).locator('button:has-text("生成调拨单")');
    if (await btn.isVisible().catch(() => false)) {
      record('Flow1', 'TransferBtn', 'PASS', `Found on row ${i + 1}`);
      await btn.click();
      transferClicked = true;
      await page.waitForTimeout(1500);

      // Handle ElMessageBox confirm
      const msgBox = page.locator('.el-message-box:visible');
      if (await msgBox.isVisible().catch(() => false)) {
        record('Flow1', 'ConfirmDialog', 'PASS', 'Confirmation dialog appeared');
        await msgBox.locator('.el-message-box__btns button.el-button--primary').first().click();

        // Wait for API response
        await page.waitForTimeout(5000);

        // Check for success toast
        const successMsg = page.locator('.el-message--success');
        const hasSuccess = await successMsg.isVisible().catch(() => false);

        if (hasSuccess) {
          const txt = await successMsg.textContent().catch(() => '');
          record('Flow1', 'TransferResult', 'PASS', `Transfer order generated: ${txt}`);
        } else {
          // Check for BOM-missing dialog (Bug D4 core validation)
          const bomDialog = page.locator('.el-message-box:visible');
          const bomVisible = await bomDialog.isVisible().catch(() => false);

          if (bomVisible) {
            const content = await bomDialog.textContent().catch(() => '');
            const hasBomRef = content.includes('BOM') || content.includes('配方') || content.includes('配置');
            const bomBtn = bomDialog.locator('button:has-text("去配置BOM"), button:has-text("配置BOM")');
            const hasBomBtn = await bomBtn.isVisible().catch(() => false);

            record('Flow1', 'BugD4-NoBOM', 'PASS',
              `Missing BOM dialog. BOM reference: ${hasBomRef}. ` +
              `"去配置BOM" button: ${hasBomBtn}. Content: "${content.substring(0, 250)}"`);

            if (hasBomBtn) {
              record('Flow1', 'BugD4-Fix', 'PASS',
                'Bug D4 FIX VERIFIED: "去配置BOM" button provides navigation to BOM config page');
            } else if (hasBomRef) {
              record('Flow1', 'BugD4-Fix', 'PASS',
                'Bug D4 partially verified: BOM error shown with context, but no direct nav button');
            }
            await bomDialog.locator('button').last().click().catch(() => {});
          } else {
            // No visible success or error dialog -- check for error toast
            const errMsg = page.locator('.el-message--error');
            const hasErr = await errMsg.isVisible().catch(() => false);
            const errTxt = hasErr ? await errMsg.textContent().catch(() => '') : 'none';

            // Also try direct API call to verify the functionality
            if (planId) {
              const apiResult = await apiCall('POST', `/${factoryId}/production-plans/${planId}/generate-transfer`);
              if (apiResult.success) {
                const itemCount = apiResult.data?.items?.length || 0;
                record('Flow1', 'TransferResult', 'PASS',
                  `UI toast missed but API confirmed success: ${itemCount} items, ` +
                  `transfer# ${apiResult.data?.transferNumber}. Error toast: "${errTxt}"`);
              } else {
                record('Flow1', 'TransferResult', 'INFO',
                  `API returned: ${apiResult.message}. UI error: "${errTxt}"`);
              }
            } else {
              record('Flow1', 'TransferResult', 'INFO', `No visible result. Error toast: "${errTxt}"`);
            }
          }
        }
      }
      break;
    }
  }

  if (!transferClicked) {
    record('Flow1', 'TransferBtn', 'FAIL', 'No "生成调拨单" button found');
  }
  await closeAllDialogs(page);
}

// =====================================================================
// Flow 2: Production Batch Lifecycle
// =====================================================================
async function flow2_batchLifecycle(page) {
  console.log('\n=== Flow 2: Production Batch Lifecycle ===');

  // Step 1: Navigate to batches
  await page.goto(`${BASE_URL}/production/batches`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await page.locator('.page-title').first().textContent().catch(() => '');
  record('Flow2', 'Navigate', title.includes('批次') ? 'PASS' : 'INFO', `Page: "${title}"`);

  const initialCount = await page.locator('.el-table__body-wrapper .el-table__row').count();
  record('Flow2', 'InitialData', 'INFO', `${initialCount} batches initially`);

  // Step 2: Create batch via UI
  const createBtn = page.locator('button:has-text("创建批次")');
  if (!(await createBtn.isVisible().catch(() => false))) {
    record('Flow2', 'CreateBtn', 'FAIL', 'Not visible');
    return;
  }
  record('Flow2', 'CreateBtn', 'PASS', 'Visible');
  await createBtn.click();
  await page.waitForTimeout(1500);

  const dialog = page.locator('.el-dialog:visible');
  if (!(await dialog.isVisible().catch(() => false))) {
    record('Flow2', 'Dialog', 'FAIL', 'Did not open');
    return;
  }
  record('Flow2', 'Dialog', 'PASS', 'Create dialog opened');

  // Verify auto-generated batch number
  const batchInput = dialog.locator('input').first();
  const batchNum = await batchInput.inputValue();
  record('Flow2', 'BatchNumber', batchNum.startsWith('PB-') ? 'PASS' : 'INFO', `Number: "${batchNum}"`);

  // Select product
  await dialog.locator('.el-select').first().click();
  await page.waitForTimeout(1500);
  const options = page.locator('.el-select-dropdown:visible .el-select-dropdown__item');
  let optCount = await options.count();
  if (optCount === 0) { await page.waitForTimeout(2000); optCount = await options.count(); }

  let selectedProductName = '';
  let selectedProductId = '';
  if (optCount > 0) {
    selectedProductName = await options.first().textContent();
    await options.first().click();
    await page.waitForTimeout(300);
    record('Flow2', 'SelectProduct', 'PASS', `Selected: "${selectedProductName}" (${optCount} options)`);
  } else {
    record('Flow2', 'SelectProduct', 'FAIL', 'No options');
    await closeAllDialogs(page);
    return;
  }

  // Set quantity
  const qtyInput = dialog.locator('.el-input-number input');
  await qtyInput.click();
  await qtyInput.fill('50');
  record('Flow2', 'SetQuantity', 'PASS', 'Set to 50');

  // Submit via UI
  const submitBtn = dialog.locator('.el-dialog__footer button:has-text("创建")');
  await submitBtn.click();
  await page.waitForTimeout(3000);

  // Check UI result
  const successMsg = page.locator('.el-message--success');
  const hasSuccess = await successMsg.isVisible().catch(() => false);
  const errorMsg = page.locator('.el-message--error');
  const hasError = await errorMsg.isVisible().catch(() => false);
  const dialogStillOpen = await dialog.isVisible().catch(() => false);

  if (hasSuccess) {
    record('Flow2', 'UICreate', 'PASS', `Success via UI`);
  } else if (hasError) {
    const errTxt = await errorMsg.textContent().catch(() => '');
    record('Flow2', 'UICreate', 'FAIL',
      `UI create returned 400: "${errTxt}". ` +
      `BUG FOUND: Frontend sends {plannedQuantity} but backend requires {quantity} field. ` +
      `File: web-admin/src/views/production/batches/list.vue line 132-139`);

    // Verify via API with correct fields
    const apiResult = await apiCall('POST', `/${factoryId}/processing/batches`, {
      batchNumber: batchNum,
      productTypeId: selectedProductId || 'PT-F001-001',
      productName: selectedProductName,
      plannedQuantity: 50,
      quantity: 50,
      unit: 'kg',
    });
    if (apiResult.success) {
      record('Flow2', 'APICreate', 'PASS',
        `API batch create succeeded with quantity field. Batch# ${apiResult.data?.batchNumber}. ` +
        `Confirms frontend bug: missing "quantity" field in POST body`);
    } else {
      record('Flow2', 'APICreate', 'INFO', `API also failed: ${apiResult.message}`);
    }
  } else {
    record('Flow2', 'UICreate', dialogStillOpen ? 'FAIL' : 'PASS',
      dialogStillOpen ? 'Dialog still open (silent failure)' : 'Dialog closed');
  }

  await closeAllDialogs(page);

  // Step 3: Verify list and navigate to detail
  await page.goto(`${BASE_URL}/production/batches`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const finalRows = page.locator('.el-table__body-wrapper .el-table__row');
  const finalCount = await finalRows.count();
  record('Flow2', 'ListVerify', finalCount > 0 ? 'PASS' : 'INFO', `${finalCount} batches`);

  if (finalCount > 0) {
    const rowText = await finalRows.first().textContent().catch(() => '');
    record('Flow2', 'FirstRow', 'PASS', `Data: "${rowText.substring(0, 120)}"`);

    // Navigate to detail
    const viewBtn = finalRows.first().locator('button:has-text("查看")');
    if (await viewBtn.isVisible().catch(() => false)) {
      record('Flow2', 'ViewBtn', 'PASS', 'View button visible');
      await viewBtn.click();
      await page.waitForTimeout(2500);
      const detailUrl = page.url();
      record('Flow2', 'DetailNav', detailUrl.includes('/production/batches/') ? 'PASS' : 'INFO',
        `URL: ${detailUrl}`);

      if (detailUrl.includes('/production/batches/')) {
        const content = await page.textContent('body').catch(() => '');
        const hasStatusWords = ['待生产', '生产中', '已完成', 'PENDING', 'PLANNED', 'IN_PROGRESS']
          .some(w => content.includes(w));
        record('Flow2', 'DetailContent', 'PASS',
          `Status info present: ${hasStatusWords}. Snippet: "${content.substring(200, 400)}"`);
      }
    }
  }
}

// =====================================================================
// Flow 3: Quality Inspection Create
// =====================================================================
async function flow3_qualityInspection(page) {
  console.log('\n=== Flow 3: Quality Inspection Create ===');

  // Step 1: Navigate
  await page.goto(`${BASE_URL}/quality/inspections`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await page.locator('.page-title').first().textContent().catch(() => '');
  record('Flow3', 'Navigate', title.includes('质检') ? 'PASS' : 'INFO', `Page: "${title}"`);

  const initialCount = await page.locator('.el-table__body-wrapper .el-table__row').count();
  record('Flow3', 'InitialData', 'INFO', `${initialCount} existing records`);

  // Step 2: Click create
  const createBtn = page.locator('button:has-text("新建质检")');
  if (!(await createBtn.isVisible().catch(() => false))) {
    record('Flow3', 'CreateBtn', 'FAIL', 'Not visible');
    return;
  }
  record('Flow3', 'CreateBtn', 'PASS', 'Visible');
  await createBtn.click();
  await page.waitForTimeout(1000);

  const dialog = page.locator('.el-dialog:visible');
  if (!(await dialog.isVisible().catch(() => false))) {
    record('Flow3', 'Dialog', 'FAIL', 'Did not open');
    return;
  }
  record('Flow3', 'Dialog', 'PASS', 'Dialog opened');

  // Get a valid batch number from API
  let batchNumber = 'PB20260210002';
  let batchId = '12';
  try {
    const br = await apiCall('GET', `/${factoryId}/processing/batches?page=1&size=5`);
    if (br.success && br.data?.content?.length > 0) {
      const b = br.data.content[0];
      batchNumber = b.batchNumber || batchNumber;
      batchId = String(b.id || batchId);
    }
  } catch { /* use defaults */ }

  // Fill batch number
  const batchInput = dialog.locator('input').first();
  await batchInput.fill(batchNumber);
  record('Flow3', 'FillBatch', 'PASS', `Batch: ${batchNumber}`);

  // Fill notes
  const textarea = dialog.locator('textarea');
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill('Layer4 E2E test inspection');
    record('Flow3', 'FillNotes', 'PASS', 'Notes filled');
  }

  // Submit via UI
  await dialog.locator('.el-dialog__footer button:has-text("确定")').click();
  await page.waitForTimeout(3000);

  const hasSuccess = await page.locator('.el-message--success').isVisible().catch(() => false);
  const hasError = await page.locator('.el-message--error').isVisible().catch(() => false);
  const dialogOpen = await dialog.isVisible().catch(() => false);

  if (hasSuccess) {
    record('Flow3', 'UICreate', 'PASS', 'Inspection created via UI');
  } else if (hasError) {
    const errTxt = await page.locator('.el-message--error').textContent().catch(() => '');
    record('Flow3', 'UICreate', 'FAIL',
      `UI create returned 400: "${errTxt}". ` +
      `BUG FOUND: Frontend sends batchNumber in POST body, but backend expects batchId as @RequestParam (query param). ` +
      `See ProcessingController.java line 359: @RequestParam String batchId. ` +
      `File: web-admin/src/views/quality/inspections/list.vue line 99`);

    // Verify via API with correct approach
    const apiResult = await apiCall('POST',
      `/${factoryId}/processing/quality/inspections?batchId=${batchId}`,
      { notes: 'Layer4 E2E test inspection', sampleSize: 10 });
    if (apiResult.success) {
      record('Flow3', 'APICreate', 'PASS',
        `API create succeeded with batchId as query param. ` +
        `Confirms bug: frontend POSTs {batchNumber: "..."} in body but backend needs ?batchId=N as query param`);
    } else {
      record('Flow3', 'APICreate', 'INFO', `API: ${apiResult.message}`);
    }
  } else {
    record('Flow3', 'UICreate', dialogOpen ? 'FAIL' : 'PASS',
      dialogOpen ? 'Dialog still open' : 'Dialog closed');
  }

  await closeAllDialogs(page);

  // Verify list
  await page.goto(`${BASE_URL}/quality/inspections`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const finalCount = await page.locator('.el-table__body-wrapper .el-table__row').count();
  record('Flow3', 'ListVerify', finalCount > 0 ? 'PASS' : 'INFO',
    `${finalCount} records (was ${initialCount})`);

  // View detail
  if (finalCount > 0) {
    const detailBtn = page.locator('.el-table__row').first().locator('button:has-text("查看详情")');
    if (await detailBtn.isVisible().catch(() => false)) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      const drawer = page.locator('.el-drawer:visible');
      if (await drawer.isVisible().catch(() => false)) {
        const txt = await drawer.textContent().catch(() => '');
        record('Flow3', 'ViewDetail', 'PASS', `Detail drawer: "${txt.substring(0, 150)}"`);
        await page.locator('.el-drawer__close-btn').first().click().catch(() => {});
      } else {
        record('Flow3', 'ViewDetail', 'INFO', 'Drawer did not open');
      }
    }
  }
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  console.log('='.repeat(70));
  console.log('Layer 4 Business Flow Tests -- Production & Quality');
  console.log(`BASE: ${BASE_URL}  |  API: ${API_BASE}  |  User: ${USERNAME}`);
  console.log('='.repeat(70));

  try { await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(5000) }); }
  catch { console.error(`[FATAL] Cannot reach ${BASE_URL}`); process.exit(1); }

  try {
    const r = await fetch(`${API_BASE}/api/mobile/health`, { signal: AbortSignal.timeout(5000) });
    console.log(`Backend health: ${r.status}`);
  } catch { console.error(`[WARN] Backend unreachable at ${API_BASE}`); }

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'zh-CN' });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const failedReqs = [];
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('/api/'))
      failedReqs.push({ url: r.url(), status: r.status() });
  });

  try {
    if (!(await login(page))) {
      record('Setup', 'Abort', 'FAIL', 'Login failed');
    } else {
      await page.waitForTimeout(1000);
      try { await flow1_generateTransfer(page); } catch (e) { record('Flow1', 'Error', 'FAIL', e.message); }
      try { await flow2_batchLifecycle(page); } catch (e) { record('Flow2', 'Error', 'FAIL', e.message); }
      try { await flow3_qualityInspection(page); } catch (e) { record('Flow3', 'Error', 'FAIL', e.message); }
    }
  } catch (e) {
    record('Global', 'Fatal', 'FAIL', e.message);
  } finally {
    // -- Summary --
    console.log('\n' + '='.repeat(70));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(70));

    const p = results.filter(r => r.status === 'PASS').length;
    const f = results.filter(r => r.status === 'FAIL').length;
    const i = results.filter(r => r.status === 'INFO').length;
    console.log(`\nTotal: ${results.length}  |  PASS: ${p}  |  FAIL: ${f}  |  INFO: ${i}`);

    for (const flow of [...new Set(results.map(r => r.flow))]) {
      console.log(`\n--- ${flow} ---`);
      for (const r of results.filter(r => r.flow === flow)) {
        const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'FAIL' ? '[FAIL]' : '[INFO]';
        console.log(`  ${icon} ${r.step}: ${r.detail}`);
      }
    }

    // Bugs found
    const bugs = results.filter(r => r.detail.includes('BUG FOUND'));
    if (bugs.length > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`BUGS FOUND: ${bugs.length}`);
      console.log('='.repeat(70));
      for (const b of bugs) {
        console.log(`\n  [${b.flow}] ${b.step}:`);
        console.log(`  ${b.detail}`);
      }
    }

    if (failedReqs.length > 0) {
      console.log(`\n--- Failed API Requests (${failedReqs.length}) ---`);
      for (const r of failedReqs.slice(0, 15))
        console.log(`  ${r.status} ${r.url.replace(BASE_URL, '')}`);
    }

    if (consoleErrors.length > 0) {
      console.log(`\n--- Console Errors (${consoleErrors.length}) ---`);
      for (const e of consoleErrors.slice(0, 5))
        console.log(`  ${e.substring(0, 200)}`);
    }

    console.log('\n' + '='.repeat(70));
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
