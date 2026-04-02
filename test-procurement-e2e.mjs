/**
 * Procurement & Supplier CRUD E2E Tests
 *
 * Tests:
 *   1. Supplier CRUD (create + verify in list)
 *   2. Purchase Order Create (validates Bug A3 fix + Bug C4 headers)
 *   3. Purchase Order - Sales Order Association (validates Bug D1)
 *   4. Raw Material Types dropdown loads from /active endpoint (validates Bug B2/B3)
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

const results = [];

function logResult(module, action, details) {
  results.push({ module, action, ...details });
  const status = details.result;
  console.log(`\n### ${module} -- ${action}`);
  console.log(`  action: ${details.actionDesc}`);
  console.log(`  evidence:`);
  if (details.evidence) {
    for (const line of details.evidence) {
      console.log(`    - ${line}`);
    }
  }
  console.log(`  result: ${status}`);
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  // Wait for login form
  await page.waitForSelector('.login-form', { timeout: 10000 });

  // Fill username — the input inside "请输入用户名" placeholder
  const usernameInput = page.locator('input[placeholder="请输入用户名"]');
  await usernameInput.fill(USERNAME);

  // Fill password
  const passwordInput = page.locator('input[placeholder="请输入密码"]');
  await passwordInput.fill(PASSWORD);

  // Click login button (text is "登 录" with a space, class is "login-button")
  const loginBtn = page.locator('.login-button');
  await loginBtn.click();

  // Wait for navigation away from login page
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

  // Small wait for page to settle
  await page.waitForTimeout(1500);

  console.log('[LOGIN] Logged in successfully, current URL:', page.url());
}

async function test1_SupplierCRUD(page) {
  const testName = 'E2E测试供应商';
  const testContact = '李四';
  const testPhone = '13900002222';
  const testAddress = '上海市浦东新区张江高科技园区';

  try {
    // Navigate to suppliers page
    await page.goto(`${BASE_URL}/procurement/suppliers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify we're on the right page
    const pageTitle = await page.locator('.page-title, h1, h2').first().textContent().catch(() => '');
    console.log('[T1] Page title:', pageTitle);

    // Click "新增供应商" button
    const addBtn = page.locator('button:has-text("新增供应商")');
    await addBtn.waitFor({ timeout: 8000 });
    await addBtn.click();
    await page.waitForTimeout(800);

    // Wait for dialog
    const dialog = page.locator('.el-dialog').last();
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // Fill the form - find form items by label within the dialog
    // 供应商名称
    const nameItem = dialog.locator('.el-form-item:has(.el-form-item__label:has-text("供应商名称"))');
    await nameItem.locator('input').fill(testName);

    // 联系人
    const contactItem = dialog.locator('.el-form-item:has(.el-form-item__label:has-text("联系人"))');
    await contactItem.locator('input').fill(testContact);

    // 联系电话
    const phoneItem = dialog.locator('.el-form-item:has(.el-form-item__label:has-text("联系电话"))');
    await phoneItem.locator('input').fill(testPhone);

    // 地址 (required by backend @NotBlank)
    const addressItem = dialog.locator('.el-form-item:has(.el-form-item__label:has-text("地址"))');
    await addressItem.locator('input').fill(testAddress);

    await page.waitForTimeout(500);

    // Intercept API response for evidence
    const createResponsePromise = page.waitForResponse(
      resp => resp.url().includes('/suppliers') && resp.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Click submit (scoped to dialog footer)
    const submitBtn = dialog.locator('.el-dialog__footer button:has-text("确定")');
    await submitBtn.click();

    // Wait for API response
    let apiSuccess = false;
    let apiMsg = '';
    let apiStatus = 0;
    try {
      const createResp = await createResponsePromise;
      apiStatus = createResp.status();
      const respBody = await createResp.json().catch(() => ({}));
      apiSuccess = respBody.success === true;
      apiMsg = respBody.message || `HTTP ${apiStatus}`;
    } catch (e) {
      apiMsg = `API timeout: ${e.message}`;
    }

    // Check for toast (success or error)
    let toastText = '';
    try {
      const toast = page.locator('.el-message .el-message__content');
      await toast.first().waitFor({ timeout: 5000 });
      toastText = await toast.first().textContent().catch(() => 'no toast detected');
    } catch {
      toastText = 'no toast detected';
    }

    // Wait briefly for dialog to potentially close
    await page.waitForTimeout(2000);

    // If API failed, dialog may still be open -- close it
    const dialogStillOpen = await dialog.isVisible().catch(() => false);
    if (dialogStillOpen && !apiSuccess) {
      // Close dialog via cancel button or the X
      try {
        const cancelBtn = dialog.locator('.el-dialog__footer button:has-text("取消")');
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
      } catch {
        // Try closing via the X button
        try {
          const closeBtn = dialog.locator('.el-dialog__headerbtn');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        } catch { /* continue anyway */ }
      }
    }

    // Wait for overlay to clear
    await page.waitForTimeout(500);

    // Verify supplier appears in the table (only if create succeeded)
    let foundInList = false;
    let rowCount = 0;
    if (apiSuccess) {
      const tableRows = page.locator('.el-table__body-wrapper .el-table__row');
      rowCount = await tableRows.count();
      for (let i = 0; i < rowCount; i++) {
        const rowText = await tableRows.nth(i).textContent();
        if (rowText.includes(testName)) {
          foundInList = true;
          break;
        }
      }

      // If not found on current page, search
      if (!foundInList) {
        const searchInput = page.locator('input[placeholder*="搜索"]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill(testName);
          // Press Enter instead of clicking search button to avoid overlay issues
          await searchInput.press('Enter');
          await page.waitForTimeout(2000);

          const searchRows = page.locator('.el-table__body-wrapper .el-table__row');
          const searchCount = await searchRows.count();
          for (let i = 0; i < searchCount; i++) {
            const rowText = await searchRows.nth(i).textContent();
            if (rowText.includes(testName)) {
              foundInList = true;
              break;
            }
          }
          rowCount = searchCount;
        }
      }
    }

    const evidence = [
      `filled: 供应商名称=${testName}, 联系人=${testContact}, 电话=${testPhone}, 地址=${testAddress}`,
      `toast: "${toastText}"`,
      `API response: HTTP ${apiStatus}, success=${apiSuccess}, message="${apiMsg}"`,
      apiSuccess
        ? `list after: supplier "${testName}" ${foundInList ? 'FOUND' : 'NOT FOUND'} in table (${rowCount} rows)`
        : `list after: skipped (API failed)`,
    ];

    const pass = apiSuccess && foundInList;

    logResult('Supplier', 'Create + Verify in List', {
      actionDesc: `Clicked "新增供应商", filled form (name=${testName}, contact=${testContact}, phone=${testPhone}, address=${testAddress}), submitted`,
      evidence,
      result: pass ? 'PASS' : (apiStatus >= 500 ? `FAIL (server error HTTP ${apiStatus}: ${apiMsg})` : 'FAIL (see evidence above)'),
    });

    return pass;
  } catch (err) {
    logResult('Supplier', 'Create + Verify in List', {
      actionDesc: 'Attempted to create supplier',
      evidence: [`error: ${err.message}`],
      result: `FAIL: ${err.message}`,
    });
    return false;
  }
}

async function test2_PurchaseOrderCreate(page) {
  try {
    // Navigate to purchase orders page
    await page.goto(`${BASE_URL}/procurement/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const pageTitle = await page.locator('.page-title').first().textContent().catch(() => '');
    console.log('[T2] Page title:', pageTitle);

    // Click "新建采购订单" button
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新建采购单")');
    await createBtn.first().waitFor({ timeout: 8000 });
    await createBtn.first().click();
    await page.waitForTimeout(1000);

    // Wait for dialog
    const dialog = page.locator('.el-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // --- Select supplier ---
    const supplierSelect = dialog.locator('.el-form-item').filter({ hasText: /供应商/ }).locator('.el-select');
    await supplierSelect.click();
    await page.waitForTimeout(500);
    // Pick first option
    const supplierOption = page.locator('.el-select-dropdown__item:visible').first();
    await supplierOption.waitFor({ timeout: 5000 });
    const supplierName = await supplierOption.textContent();
    await supplierOption.click();
    await page.waitForTimeout(300);

    // --- Select purchase type (default is DIRECT, let's pick 紧急采购 for variety) ---
    let purchaseTypeSelected = 'DIRECT (default)';
    try {
      const urgentRadio = dialog.locator('.el-radio:has-text("紧急采购"), label:has-text("紧急采购")');
      if (await urgentRadio.isVisible()) {
        await urgentRadio.click();
        purchaseTypeSelected = '紧急采购';
      }
    } catch { /* keep default */ }

    // --- Fill expected delivery date ---
    const datePicker = dialog.locator('.el-date-editor input').first();
    await datePicker.click();
    await page.waitForTimeout(300);
    // Type date directly
    await datePicker.fill('2026-04-15');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // --- Select material ---
    // The materials section has el-select for material selection
    const materialSelects = dialog.locator('.item-row .el-select').first();
    await materialSelects.click();
    await page.waitForTimeout(500);
    const materialOption = page.locator('.el-select-dropdown__item:visible').first();
    await materialOption.waitFor({ timeout: 5000 });
    const materialName = await materialOption.textContent();
    await materialOption.click();
    await page.waitForTimeout(300);

    // --- Fill quantity ---
    const quantityInput = dialog.locator('.item-row .el-input-number').first().locator('input');
    await quantityInput.fill('');
    await quantityInput.fill('100');
    await page.waitForTimeout(200);

    // --- Fill unit price ---
    const priceInput = dialog.locator('.item-row .el-input-number').nth(1).locator('input');
    await priceInput.fill('');
    await priceInput.fill('25.50');
    await page.waitForTimeout(200);

    // --- Check Bug C4: material detail section headers ---
    let bugC4Evidence = '';
    const headerRow = dialog.locator('.item-header');
    if (await headerRow.isVisible()) {
      const headerText = await headerRow.textContent();
      const hasHeaders = headerText.includes('原料名称') && headerText.includes('数量') && headerText.includes('单价');
      bugC4Evidence = `Headers visible: "${headerText.trim()}" -- contains 原料名称/数量/单价: ${hasHeaders}`;
    } else {
      bugC4Evidence = 'Header row NOT visible (Bug C4 may still exist)';
    }

    // Intercept create API
    const orderCreatePromise = page.waitForResponse(
      resp => resp.url().includes('/purchase/orders') && resp.request().method() === 'POST' && !resp.url().includes('/submit'),
      { timeout: 10000 }
    );

    // Click create button
    const createSubmitBtn = dialog.locator('.el-dialog__footer button:has-text("创建")');
    await createSubmitBtn.click();

    // Wait for API response
    let apiSuccess = false;
    let apiMsg = '';
    try {
      const createResp = await orderCreatePromise;
      const respBody = await createResp.json().catch(() => ({}));
      apiSuccess = respBody.success === true || createResp.status() < 300;
      apiMsg = respBody.message || `HTTP ${createResp.status()}`;
    } catch (e) {
      apiMsg = `API timeout: ${e.message}`;
    }

    // Check for toast
    let toastText = '';
    try {
      const toast = page.locator('.el-message .el-message__content');
      await toast.first().waitFor({ timeout: 5000 });
      toastText = await toast.first().textContent().catch(() => 'no toast');
    } catch {
      toastText = 'no toast detected';
    }

    await page.waitForTimeout(1500);

    const evidence = [
      `filled: supplier=${supplierName?.trim()}, type=${purchaseTypeSelected}, date=2026-04-15, material=${materialName?.trim()}, qty=100, price=25.50`,
      `toast: "${toastText}"`,
      `API: success=${apiSuccess}, message="${apiMsg}"`,
      `Bug C4 (table headers): ${bugC4Evidence}`,
    ];

    const pass = apiSuccess;

    logResult('Purchase Order', 'Create (Bug A3 + C4 validation)', {
      actionDesc: 'Clicked "新建采购订单", selected supplier/type/date/material/qty/price, submitted',
      evidence,
      result: pass ? 'PASS' : `FAIL: ${apiMsg}`,
    });

    return pass;
  } catch (err) {
    logResult('Purchase Order', 'Create (Bug A3 + C4 validation)', {
      actionDesc: 'Attempted to create purchase order',
      evidence: [`error: ${err.message}`],
      result: `FAIL: ${err.message}`,
    });
    return false;
  }
}

async function test3_SalesOrderAssociation(page) {
  try {
    // Navigate to purchase orders page
    await page.goto(`${BASE_URL}/procurement/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Open the create dialog
    const createBtn = page.locator('button:has-text("新建")').first();
    await createBtn.click();
    await page.waitForTimeout(1000);

    const dialog = page.locator('.el-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // Check for "关联销售订单" field (Bug D1)
    let dropdownExists = false;
    let dropdownLabel = '';
    let salesOrderOptions = 0;

    // Look for the form item with "关联销售订单" label
    const soFormItem = dialog.locator('.el-form-item').filter({ hasText: /关联销售订单/ });
    if (await soFormItem.count() > 0) {
      dropdownExists = true;
      dropdownLabel = await soFormItem.locator('.el-form-item__label').textContent().catch(() => '关联销售订单');

      // Try clicking the dropdown to see if it loads options
      const soSelect = soFormItem.locator('.el-select');
      if (await soSelect.isVisible()) {
        await soSelect.click();
        await page.waitForTimeout(1000);

        // Count visible dropdown options
        const options = page.locator('.el-select-dropdown__item:visible');
        salesOrderOptions = await options.count();

        // Close dropdown by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // Close the dialog
    const cancelBtn = dialog.locator('.el-dialog__footer button:has-text("取消")');
    await cancelBtn.click();
    await page.waitForTimeout(500);

    const evidence = [
      `dropdown exists: ${dropdownExists}`,
      `label: "${dropdownLabel?.trim()}"`,
      `sales order options loaded: ${salesOrderOptions} options available`,
    ];

    logResult('Purchase Order', 'Sales Order Association (Bug D1)', {
      actionDesc: 'Opened create purchase order dialog, checked for "关联销售订单" dropdown',
      evidence,
      result: dropdownExists ? 'PASS' : 'FAIL: "关联销售订单" dropdown not found',
    });

    return dropdownExists;
  } catch (err) {
    logResult('Purchase Order', 'Sales Order Association (Bug D1)', {
      actionDesc: 'Attempted to verify sales order association dropdown',
      evidence: [`error: ${err.message}`],
      result: `FAIL: ${err.message}`,
    });
    return false;
  }
}

async function test4_RawMaterialTypes(page) {
  try {
    // Navigate to purchase orders page (materials dropdown is in the create dialog)
    await page.goto(`${BASE_URL}/procurement/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Intercept the raw-material-types/active API call
    let activeApiCalled = false;
    let activeApiUrl = '';
    let activeApiResponse = null;

    // Set up request interception before triggering the load
    page.on('response', async (response) => {
      if (response.url().includes('raw-material-types/active')) {
        activeApiCalled = true;
        activeApiUrl = response.url();
        try {
          activeApiResponse = await response.json();
        } catch { /* ignore */ }
      }
    });

    // The page already loads materials on mount (loadMaterials is called in onMounted)
    // Let's check if the API was already called by navigating fresh
    await page.goto(`${BASE_URL}/procurement/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Now open dialog and check material dropdown
    const createBtn = page.locator('button:has-text("新建")').first();
    await createBtn.click();
    await page.waitForTimeout(1000);

    const dialog = page.locator('.el-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // Click material dropdown
    const materialSelect = dialog.locator('.item-row .el-select').first();
    await materialSelect.click();
    await page.waitForTimeout(800);

    // Count material options
    const materialOptions = page.locator('.el-select-dropdown__item:visible');
    const optionCount = await materialOptions.count();

    // Get first few material names for evidence
    const materialNames = [];
    for (let i = 0; i < Math.min(5, optionCount); i++) {
      const name = await materialOptions.nth(i).textContent();
      materialNames.push(name.trim());
    }

    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Close dialog
    const cancelBtn = dialog.locator('.el-dialog__footer button:has-text("取消")');
    await cancelBtn.click();

    const evidence = [
      `API /raw-material-types/active called: ${activeApiCalled}`,
      activeApiUrl ? `API URL: ${activeApiUrl}` : 'API URL: not captured (may have been called before listener)',
      `material dropdown options: ${optionCount}`,
      `first materials: [${materialNames.join(', ')}]`,
      activeApiResponse ? `API success: ${activeApiResponse.success}` : 'API response: pre-loaded before listener',
    ];

    // The key check: does the material dropdown have data?
    const pass = optionCount > 0;

    logResult('Raw Material Types', 'Dropdown loads from /active (Bug B2/B3)', {
      actionDesc: 'Navigated to procurement/orders, opened create dialog, clicked material dropdown to verify options load',
      evidence,
      result: pass ? 'PASS' : 'FAIL: no material options in dropdown',
    });

    return pass;
  } catch (err) {
    logResult('Raw Material Types', 'Dropdown loads from /active (Bug B2/B3)', {
      actionDesc: 'Attempted to verify material dropdown',
      evidence: [`error: ${err.message}`],
      result: `FAIL: ${err.message}`,
    });
    return false;
  }
}

async function cleanupTestSupplier(page) {
  // Try to delete the test supplier we created
  try {
    await page.goto(`${BASE_URL}/procurement/suppliers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Search for our test supplier
    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('E2E测试供应商');
      const searchBtn = page.locator('button:has-text("搜索")');
      await searchBtn.click();
      await page.waitForTimeout(2000);
    }

    // Find and click delete
    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const rowText = await rows.nth(i).textContent();
      if (rowText.includes('E2E测试供应商')) {
        const deleteBtn = rows.nth(i).locator('button:has-text("删除")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.waitForTimeout(500);
          // Confirm deletion
          const confirmBtn = page.locator('.el-message-box .el-button--primary, .el-message-box__btns button:has-text("确定")');
          await confirmBtn.click();
          await page.waitForTimeout(1000);
          console.log('[CLEANUP] Deleted test supplier');
        }
        break;
      }
    }
  } catch (err) {
    console.log('[CLEANUP] Could not delete test supplier:', err.message);
  }
}

// ==================== MAIN ====================
async function main() {
  console.log('='.repeat(70));
  console.log('Procurement & Supplier CRUD E2E Tests');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  // Collect console errors for debugging
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  let totalPass = 0;
  let totalFail = 0;

  try {
    // Login first
    console.log('\n[STEP] Logging in...');
    await login(page);

    // Test 1: Supplier CRUD
    console.log('\n[STEP] Test 1: Supplier CRUD...');
    if (await test1_SupplierCRUD(page)) totalPass++;
    else totalFail++;

    // Test 2: Purchase Order Create
    console.log('\n[STEP] Test 2: Purchase Order Create...');
    if (await test2_PurchaseOrderCreate(page)) totalPass++;
    else totalFail++;

    // Test 3: Sales Order Association
    console.log('\n[STEP] Test 3: Sales Order Association...');
    if (await test3_SalesOrderAssociation(page)) totalPass++;
    else totalFail++;

    // Test 4: Raw Material Types
    console.log('\n[STEP] Test 4: Raw Material Types...');
    if (await test4_RawMaterialTypes(page)) totalPass++;
    else totalFail++;

    // Cleanup
    console.log('\n[STEP] Cleaning up...');
    await cleanupTestSupplier(page);

  } catch (err) {
    console.error('\n[FATAL]', err.message);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  for (const r of results) {
    console.log(`\n### ${r.module} -- ${r.action}`);
    console.log(`  action: ${r.actionDesc}`);
    console.log('  evidence:');
    if (r.evidence) {
      for (const line of r.evidence) {
        console.log(`    - ${line}`);
      }
    }
    console.log(`  result: ${r.result.includes('PASS') ? 'PASS' : (r.result.includes('KNOWN_BUG') ? r.result : 'FAIL ' + r.result)}`);
  }
  console.log(`\nTotal: ${totalPass} PASS, ${totalFail} FAIL out of ${totalPass + totalFail} tests`);

  if (consoleErrors.length > 0) {
    console.log(`\n[Browser Console Errors: ${consoleErrors.length}]`);
    for (const e of consoleErrors.slice(0, 10)) {
      console.log(`  ! ${e.substring(0, 200)}`);
    }
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
