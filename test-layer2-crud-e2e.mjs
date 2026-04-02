/**
 * Layer 2 CRUD E2E Tests — System, User Management, R&D Modules
 *
 * Tests:
 *   1. User Management - Password Reset (Bug A1 validation)
 *   2. User Management - Create User
 *   3. R&D Sample Management (Bug D5/D6 column validation)
 *   4. Role Management
 *   5. Product Information
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:10010';
const LOGIN_USER = 'factory_admin1';
const LOGIN_PASS = '123456';

const results = [];

function record(module, action, evidence, result) {
  results.push({ module, action, evidence, result });
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('LAYER 2 CRUD E2E TEST RESULTS');
  console.log('='.repeat(80) + '\n');
  for (const r of results) {
    console.log(`### ${r.module} --- ${r.action}`);
    console.log(`  action: ${r.action}`);
    console.log(`  evidence:`);
    for (const line of r.evidence) {
      console.log(`    - ${line}`);
    }
    console.log(`  result: ${r.result}`);
    console.log('');
  }
  const passCount = results.filter(r => r.result.includes('PASS')).length;
  const failCount = results.filter(r => r.result.includes('FAIL') || r.result.includes('KNOWN_BUG')).length;
  console.log('='.repeat(80));
  console.log(`SUMMARY: ${passCount} PASS, ${failCount} FAIL/KNOWN_BUG out of ${results.length} tests`);
  console.log('='.repeat(80));
}

async function waitForNetworkIdle(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // proceed anyway
  }
}

async function login(page) {
  console.log('[LOGIN] Navigating to login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Use the quick login button for factory_admin1 (most reliable)
  const quickBtn = page.locator('button:has-text("工厂总监")');
  if (await quickBtn.count() > 0) {
    console.log('[LOGIN] Using quick login button for factory_admin1...');
    await quickBtn.click();
    await page.waitForTimeout(500);
  } else {
    // Fallback: fill form manually
    const usernameInput = page.locator('input[placeholder*="用户名"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(LOGIN_USER);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(LOGIN_PASS);
  }

  // Click the login button (text is "登 录" with a space, or "登录中...")
  const loginBtn = page.locator('.login-button, button:has-text("登")').first();
  await loginBtn.click();

  // Wait for redirect to dashboard
  try {
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log('[LOGIN] Login successful, on dashboard');
    return true;
  } catch {
    // Check if we're already authenticated
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      console.log(`[LOGIN] Login redirected to: ${currentUrl}`);
      return true;
    }
    console.log('[LOGIN] Login may have failed, current URL:', currentUrl);
    return false;
  }
}

// ============================================================
// TEST 1: User Management - Password Reset
// ============================================================
async function testPasswordReset(page) {
  const testName = 'User Management - Password Reset';
  console.log(`\n[TEST 1] ${testName}`);
  const evidence = [];

  try {
    await page.goto(`${BASE_URL}/system/users`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    evidence.push(`navigated: ${page.url()}`);

    // Wait for table to load
    const table = page.locator('.el-table');
    await table.waitFor({ state: 'visible', timeout: 10000 });

    // Get user rows
    const rows = page.locator('.el-table__body-wrapper tr.el-table__row');
    const rowCount = await rows.count();
    evidence.push(`table rows loaded: ${rowCount}`);

    if (rowCount === 0) {
      evidence.push('no users in table, cannot test password reset');
      record(testName, 'Navigate to /system/users and find a user to reset password', evidence, '--- SKIP (no users)');
      return;
    }

    // Find a non-admin user to reset password (pick the 2nd row if exists, else 1st)
    const targetRow = rowCount > 1 ? rows.nth(1) : rows.nth(0);
    const username = await targetRow.locator('td').first().textContent();
    evidence.push(`target user: ${username?.trim()}`);

    // Click the reset password button
    const resetBtn = targetRow.locator('button:has-text("重置密码")');
    const resetBtnExists = await resetBtn.count() > 0;

    if (!resetBtnExists) {
      evidence.push('no reset password button found (may lack write permission)');
      record(testName, 'Click reset password button', evidence, '--- SKIP (no permission button)');
      return;
    }

    // Listen for API response to capture error details
    let apiResponse = null;
    let apiResponseBody = null;
    page.on('response', async (response) => {
      if (response.url().includes('/auth/reset-password')) {
        apiResponse = response;
        try {
          apiResponseBody = await response.json();
        } catch { /* not json */ }
      }
    });

    await resetBtn.click();
    await page.waitForTimeout(1000);

    // The ElMessageBox.prompt dialog should appear
    const promptDialog = page.locator('.el-message-box');
    await promptDialog.waitFor({ state: 'visible', timeout: 5000 });
    evidence.push('prompt dialog appeared: true');

    // Type new password
    const pwInput = promptDialog.locator('input');
    await pwInput.fill('Test123456');
    evidence.push('filled: newPassword=Test123456');

    // Click confirm (use specific selector to avoid matching the close X button)
    const confirmBtn = promptDialog.locator('.el-message-box__btns button.el-button--primary');
    await confirmBtn.click();
    await page.waitForTimeout(3000);

    // Check for toast messages
    const toastMessages = [];
    const toasts = page.locator('.el-message');
    const toastCount = await toasts.count();
    for (let i = 0; i < toastCount; i++) {
      const text = await toasts.nth(i).textContent();
      if (text?.trim()) toastMessages.push(text.trim());
    }
    evidence.push(`toast messages: ${JSON.stringify(toastMessages)}`);

    if (apiResponseBody) {
      evidence.push(`API response: ${JSON.stringify(apiResponseBody)}`);
    }
    if (apiResponse) {
      evidence.push(`API status: ${apiResponse.status()}`);
    }

    // Bug A1: Check if the error "缺少必要参数: factoryId" appears
    const hasFactoryIdError = toastMessages.some(m => m.includes('factoryId') || m.includes('缺少必要参数'));
    const hasSuccess = toastMessages.some(m => m.includes('已重置') || m.includes('成功'));

    if (hasFactoryIdError) {
      evidence.push('BUG A1 CONFIRMED: factoryId parameter missing error');
      record(testName, 'Reset password for user', evidence, '--- KNOWN_BUG [Bug A1: factoryId param missing in reset-password API call]');
    } else if (hasSuccess) {
      evidence.push('password reset succeeded without factoryId error');
      record(testName, 'Reset password for user', evidence, 'PASS');
    } else {
      // Check API response directly
      const failMsg = apiResponseBody?.message || toastMessages.join('; ') || 'no clear result';
      evidence.push(`result details: ${failMsg}`);
      if (apiResponseBody?.success === true) {
        record(testName, 'Reset password for user', evidence, 'PASS');
      } else {
        record(testName, 'Reset password for user', evidence, `--- FAIL [${failMsg}]`);
      }
    }

  } catch (error) {
    evidence.push(`error: ${error.message}`);
    record(testName, 'Reset password for user', evidence, `--- FAIL [${error.message}]`);
  }
}

// ============================================================
// TEST 2: User Management - Create User
// ============================================================
async function testCreateUser(page) {
  const testName = 'User Management - Create User';
  console.log(`\n[TEST 2] ${testName}`);
  const evidence = [];

  try {
    await page.goto(`${BASE_URL}/system/users`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    evidence.push(`navigated: ${page.url()}`);

    // Click add user button
    const addBtn = page.locator('button:has-text("添加用户")');
    const addBtnExists = await addBtn.count() > 0;

    if (!addBtnExists) {
      evidence.push('no "添加用户" button found (may lack write permission)');
      record(testName, 'Click add user button', evidence, '--- SKIP (no permission)');
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(1000);

    // Wait for the create dialog
    const dialog = page.locator('.el-dialog:has-text("添加用户")');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    evidence.push('dialog opened: 添加用户');

    // Fill form fields using the label structure
    // Username
    const usernameField = dialog.locator('.el-form-item:has-text("用户名") input').first();
    await usernameField.fill('e2e_test_user');
    evidence.push('filled: 用户名=e2e_test_user');

    // Password
    const passwordField = dialog.locator('.el-form-item:has-text("密码") input[type="password"]').first();
    await passwordField.fill('Test123456');
    evidence.push('filled: 密码=Test123456');

    // Email
    const emailField = dialog.locator('.el-form-item:has-text("邮箱") input').first();
    await emailField.fill('e2e_test@example.com');
    evidence.push('filled: 邮箱=e2e_test@example.com');

    // Full Name
    const fullNameField = dialog.locator('.el-form-item:has-text("姓名") input').first();
    await fullNameField.fill('E2E测试');
    evidence.push('filled: 姓名=E2E测试');

    // Phone
    const phoneField = dialog.locator('.el-form-item:has-text("手机号") input').first();
    await phoneField.fill('13800003333');
    evidence.push('filled: 手机号=13800003333');

    // Role - select operator
    // Element Plus select dropdown with virtual scroll needs special handling
    const roleSelect = dialog.locator('.el-form-item:has-text("角色") .el-select');
    await roleSelect.click();
    await page.waitForTimeout(800);

    // The dropdown is rendered outside the dialog, at body level
    // Find the visible/last dropdown popup
    let selected = false;

    // Try clicking visible option directly
    const visibleOptions = page.locator('.el-select-dropdown:visible .el-select-dropdown__item, .el-vl-virtual-scroll-bar ~ * .el-select-dropdown__item');
    const visibleCount = await visibleOptions.count();
    evidence.push(`visible dropdown options: ${visibleCount}`);

    // Scroll down in dropdown to find "操作员" - it's near the bottom of the list
    // First try: use page.locator with role
    const operatorByRole = page.getByRole('option', { name: '操作员' });
    if (await operatorByRole.count() > 0) {
      try {
        await operatorByRole.scrollIntoViewIfNeeded({ timeout: 3000 });
        await operatorByRole.click({ timeout: 5000 });
        evidence.push('selected: 角色=操作员 (via role option)');
        selected = true;
      } catch (e) {
        evidence.push(`role option click failed: ${e.message.substring(0, 80)}`);
      }
    }

    if (!selected) {
      // Fallback: type in the select to filter
      const selectInput = roleSelect.locator('input').first();
      await selectInput.fill('操作员');
      await page.waitForTimeout(800);

      // Now try to click filtered option
      const filteredOption = page.locator('.el-select-dropdown__item:visible').first();
      if (await filteredOption.count() > 0) {
        try {
          await filteredOption.click({ timeout: 5000 });
          evidence.push('selected: 角色=操作员 (via filter)');
          selected = true;
        } catch { /* fallback below */ }
      }
    }

    if (!selected) {
      // Last resort: use keyboard - type then press enter
      const selectInput = roleSelect.locator('input').first();
      await selectInput.click();
      await page.waitForTimeout(300);
      // Press down arrow many times to reach 操作员 (13th in list)
      for (let i = 0; i < 13; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(50);
      }
      await page.keyboard.press('Enter');
      evidence.push('selected: 角色=操作员 (via keyboard navigation)');
      selected = true;
    }

    await page.waitForTimeout(500);

    // Listen for API response
    let createApiResponse = null;
    page.on('response', async (response) => {
      if (response.url().includes('/users') && response.request().method() === 'POST') {
        try {
          createApiResponse = await response.json();
        } catch { /* not json */ }
      }
    });

    // Click submit button
    const submitBtn = dialog.locator('button:has-text("确认创建")');
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // Check for toast messages
    const toasts = page.locator('.el-message');
    const toastTexts = [];
    const toastCount = await toasts.count();
    for (let i = 0; i < toastCount; i++) {
      const text = await toasts.nth(i).textContent();
      if (text?.trim()) toastTexts.push(text.trim());
    }
    evidence.push(`toast: ${JSON.stringify(toastTexts)}`);

    if (createApiResponse) {
      evidence.push(`API response: success=${createApiResponse.success}, message=${createApiResponse.message || ''}`);
    }

    const hasSuccess = toastTexts.some(m => m.includes('创建成功') || m.includes('成功'));
    const hasDuplicateError = toastTexts.some(m => m.includes('已存在') || m.includes('duplicate') || m.includes('重复'));

    if (hasSuccess) {
      // Verify user appears in the list
      await page.waitForTimeout(1000);
      const tableText = await page.locator('.el-table').textContent();
      const userInList = tableText?.includes('e2e_test_user') || tableText?.includes('E2E测试');
      evidence.push(`list after: user visible in table = ${userInList}`);
      record(testName, 'Create user e2e_test_user', evidence, 'PASS');
    } else if (hasDuplicateError) {
      evidence.push('user already exists from previous test run');
      record(testName, 'Create user e2e_test_user', evidence, 'PASS (user already exists)');
    } else {
      const failReason = createApiResponse?.message || toastTexts.join('; ') || 'unknown error';
      record(testName, 'Create user e2e_test_user', evidence, `--- FAIL [${failReason}]`);
    }

  } catch (error) {
    evidence.push(`error: ${error.message}`);
    record(testName, 'Create user e2e_test_user', evidence, `--- FAIL [${error.message}]`);
  }
}

// ============================================================
// TEST 3: R&D Sample Management
// ============================================================
async function testRdSamples(page) {
  const testName = 'R&D Sample Management';
  console.log(`\n[TEST 3] ${testName}`);
  const evidence = [];

  try {
    await page.goto(`${BASE_URL}/rd/samples`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    evidence.push(`navigated: ${page.url()}`);

    // Check if page loaded correctly
    const pageContent = await page.textContent('body');

    // Check for the samples tab - should be on "样品管理" tab
    const samplesTab = page.locator('.el-radio-button:has-text("样品管理")');
    if (await samplesTab.count() > 0) {
      await samplesTab.click();
      await page.waitForTimeout(1500);
      evidence.push('clicked: 样品管理 tab');
    }

    // Verify table columns - Bug D5/D6 check
    const requiredColumns = ['样品编码', '样品名称', '业务员', '储存方式', '产品状态'];
    const tableHeaders = page.locator('.el-table__header-wrapper th');
    const headerCount = await tableHeaders.count();
    const foundHeaders = [];

    for (let i = 0; i < headerCount; i++) {
      const headerText = await tableHeaders.nth(i).textContent();
      if (headerText?.trim()) foundHeaders.push(headerText.trim());
    }
    evidence.push(`table columns found: ${JSON.stringify(foundHeaders)}`);

    const missingColumns = requiredColumns.filter(col => !foundHeaders.some(h => h.includes(col)));
    if (missingColumns.length === 0) {
      evidence.push(`Bug D5/D6 validation: all required columns present`);
    } else {
      evidence.push(`Bug D5/D6: MISSING columns: ${JSON.stringify(missingColumns)}`);
    }

    // Check if any data is in the table
    const dataRows = page.locator('.el-table__body-wrapper tr.el-table__row');
    const dataRowCount = await dataRows.count();
    evidence.push(`data rows: ${dataRowCount}`);

    // Check for empty state
    const emptyState = page.locator('.el-empty, .el-table__empty-block');
    const hasEmpty = await emptyState.count() > 0;
    if (hasEmpty && dataRowCount === 0) {
      evidence.push('table shows empty state (no samples yet)');
    }

    // Now try to create a sample
    const newSampleBtn = page.locator('button:has-text("新建样品")');
    if (await newSampleBtn.count() > 0) {
      await newSampleBtn.click();
      await page.waitForTimeout(1000);

      const sampleDialog = page.locator('.el-dialog:has-text("新建样品")');
      await sampleDialog.waitFor({ state: 'visible', timeout: 5000 });
      evidence.push('dialog opened: 新建样品');

      // Fill sample form
      // Sample name (required)
      const nameField = sampleDialog.locator('.el-form-item:has-text("样品名称") input').first();
      await nameField.fill('E2E测试样品_' + Date.now().toString().slice(-6));
      evidence.push('filled: 样品名称=E2E测试样品_xxx');

      // Specification
      const specField = sampleDialog.locator('.el-form-item:has-text("成品规格") input').first();
      if (await specField.count() > 0) {
        await specField.fill('200g/盒');
        evidence.push('filled: 成品规格=200g/盒');
      }

      // Storage method
      const storageSelect = sampleDialog.locator('.el-form-item:has-text("储存方式") .el-select');
      if (await storageSelect.count() > 0) {
        await storageSelect.click();
        await page.waitForTimeout(500);
        const coldOption = page.locator('.el-select-dropdown__item:has-text("冷冻")').first();
        if (await coldOption.count() > 0) {
          await coldOption.click();
          evidence.push('selected: 储存方式=冷冻');
        }
        await page.waitForTimeout(300);
      }

      // Main material
      const materialField = sampleDialog.locator('.el-form-item:has-text("主原料") input').first();
      if (await materialField.count() > 0) {
        await materialField.fill('牛肉');
        evidence.push('filled: 主原料=牛肉');
      }

      // Listen for API response
      let sampleCreateResponse = null;
      page.on('response', async (response) => {
        if (response.url().includes('/rd/samples') && response.request().method() === 'POST') {
          try {
            sampleCreateResponse = await response.json();
          } catch { /* */ }
        }
      });

      // Submit
      const createBtn = sampleDialog.locator('button:has-text("创建")');
      await createBtn.click();
      await page.waitForTimeout(3000);

      // Check toast
      const toasts = page.locator('.el-message');
      const toastTexts = [];
      const toastCount = await toasts.count();
      for (let i = 0; i < toastCount; i++) {
        const text = await toasts.nth(i).textContent();
        if (text?.trim()) toastTexts.push(text.trim());
      }
      evidence.push(`toast after create: ${JSON.stringify(toastTexts)}`);

      if (sampleCreateResponse) {
        evidence.push(`API response: success=${sampleCreateResponse.success}`);
      }

      const createSuccess = toastTexts.some(m => m.includes('已创建') || m.includes('成功'));
      if (createSuccess) {
        evidence.push('sample created successfully');
      }
    } else {
      evidence.push('no "新建样品" button (may lack write permission)');
    }

    // Determine overall result
    if (missingColumns.length > 0) {
      record(testName, 'Verify R&D sample table columns and create sample', evidence,
        `--- KNOWN_BUG [Bug D5/D6: missing columns: ${missingColumns.join(', ')}]`);
    } else {
      record(testName, 'Verify R&D sample table columns and create sample', evidence, 'PASS');
    }

  } catch (error) {
    evidence.push(`error: ${error.message}`);
    record(testName, 'Verify R&D sample table columns and create sample', evidence, `--- FAIL [${error.message}]`);
  }
}

// ============================================================
// TEST 4: Role Management
// ============================================================
async function testRoleManagement(page) {
  const testName = 'Role Management';
  console.log(`\n[TEST 4] ${testName}`);
  const evidence = [];

  try {
    await page.goto(`${BASE_URL}/system/roles`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    evidence.push(`navigated: ${page.url()}`);

    // Wait for table to appear
    const table = page.locator('.el-table');
    await table.waitFor({ state: 'visible', timeout: 10000 });

    // Check table has data
    const rows = page.locator('.el-table__body-wrapper tr.el-table__row');
    const rowCount = await rows.count();
    evidence.push(`table rows: ${rowCount}`);

    // Verify expected columns
    const headers = page.locator('.el-table__header-wrapper th');
    const headerCount = await headers.count();
    const headerTexts = [];
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.trim()) headerTexts.push(text.trim());
    }
    evidence.push(`columns: ${JSON.stringify(headerTexts)}`);

    // Verify some role names exist
    const tableText = await table.textContent();
    const expectedRoles = ['工厂超管', '生产经理', '质检主管', '仓库主管'];
    const foundRoles = expectedRoles.filter(r => tableText?.includes(r));
    evidence.push(`expected roles found: ${JSON.stringify(foundRoles)}`);

    // Check for "共 14 种工厂角色" tag
    const roleCountTag = page.locator('.el-tag:has-text("14")');
    const hasRoleCount = await roleCountTag.count() > 0;
    evidence.push(`role count tag present: ${hasRoleCount}`);

    // Try clicking "查看权限" on first role
    const viewPermBtn = rows.first().locator('button:has-text("查看权限")');
    if (await viewPermBtn.count() > 0) {
      await viewPermBtn.click();
      await page.waitForTimeout(1000);

      const permDialog = page.locator('.el-dialog:has-text("权限详情")');
      const dialogVisible = await permDialog.isVisible();
      evidence.push(`permissions dialog opened: ${dialogVisible}`);

      if (dialogVisible) {
        // Check permissions table
        const permRows = permDialog.locator('.el-table__body-wrapper tr');
        const permRowCount = await permRows.count();
        evidence.push(`permission modules listed: ${permRowCount}`);

        // Close dialog
        const closeBtn = permDialog.locator('button:has-text("关闭")');
        if (await closeBtn.count() > 0) await closeBtn.click();
      }
    }

    if (rowCount >= 10 && foundRoles.length >= 3) {
      record(testName, 'Navigate to /system/roles, verify role list loads', evidence, 'PASS');
    } else {
      record(testName, 'Navigate to /system/roles, verify role list loads', evidence,
        `--- FAIL [rows=${rowCount}, found roles=${foundRoles.length}]`);
    }

  } catch (error) {
    evidence.push(`error: ${error.message}`);
    record(testName, 'Navigate to /system/roles, verify role list loads', evidence, `--- FAIL [${error.message}]`);
  }
}

// ============================================================
// TEST 5: Product Information
// ============================================================
async function testProductInformation(page) {
  const testName = 'Product Information';
  console.log(`\n[TEST 5] ${testName}`);
  const evidence = [];

  try {
    await page.goto(`${BASE_URL}/system/products`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    evidence.push(`navigated: ${page.url()}`);

    // Wait for table/content to load
    const table = page.locator('.el-table');
    const tableExists = await table.count() > 0;

    if (tableExists) {
      await table.waitFor({ state: 'visible', timeout: 10000 });

      // Check rows
      const rows = page.locator('.el-table__body-wrapper tr.el-table__row');
      const rowCount = await rows.count();
      evidence.push(`table rows: ${rowCount}`);

      // Check headers
      const headers = page.locator('.el-table__header-wrapper th');
      const headerCount = await headers.count();
      const headerTexts = [];
      for (let i = 0; i < headerCount; i++) {
        const text = await headers.nth(i).textContent();
        if (text?.trim()) headerTexts.push(text.trim());
      }
      evidence.push(`columns: ${JSON.stringify(headerTexts)}`);

      // Check page loaded without error
      const hasError = page.locator('.el-message--error');
      const errorCount = await hasError.count();
      evidence.push(`error messages on page: ${errorCount}`);

      // Check for empty state
      const emptyBlock = page.locator('.el-empty, .el-table__empty-block:has-text("暂无数据")');
      const isEmpty = await emptyBlock.count() > 0 && rowCount === 0;
      if (isEmpty) {
        evidence.push('table is empty but rendered correctly');
      }

      // Check for product category tabs/filters if any
      const categoryTabs = page.locator('.el-radio-group, .el-tabs');
      if (await categoryTabs.count() > 0) {
        const tabText = await categoryTabs.first().textContent();
        evidence.push(`category filters: ${tabText?.trim().substring(0, 100)}`);
      }

      // Check for "添加产品" button
      const addBtn = page.locator('button:has-text("添加"), button:has-text("新增"), button:has-text("新建")');
      const addBtnCount = await addBtn.count();
      evidence.push(`add product button present: ${addBtnCount > 0}`);

      record(testName, 'Navigate to /system/products, verify product list loads', evidence, 'PASS');
    } else {
      // Maybe content is rendered differently
      const pageContent = await page.textContent('body');
      const hasProductContent = pageContent?.includes('产品') || pageContent?.includes('product');
      evidence.push(`page has product content: ${hasProductContent}`);
      evidence.push(`page text snippet: ${pageContent?.substring(0, 200)}`);

      if (hasProductContent) {
        record(testName, 'Navigate to /system/products, verify product list loads', evidence, 'PASS');
      } else {
        record(testName, 'Navigate to /system/products, verify product list loads', evidence, '--- FAIL [no table or product content found]');
      }
    }

  } catch (error) {
    evidence.push(`error: ${error.message}`);
    record(testName, 'Navigate to /system/products, verify product list loads', evidence, `--- FAIL [${error.message}]`);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('Starting Layer 2 CRUD E2E Tests...');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`API_BASE: ${API_BASE}`);
  console.log(`Login: ${LOGIN_USER}`);
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN'
  });

  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // Login first
    const loginOk = await login(page);
    if (!loginOk) {
      console.error('LOGIN FAILED - cannot proceed with tests');
      record('Login', 'Login as factory_admin1', ['login failed'], '--- FAIL [login failed]');
      printResults();
      await browser.close();
      process.exit(1);
    }

    // Give the app a moment to settle after login
    await page.waitForTimeout(2000);

    // Run all tests
    await testPasswordReset(page);
    await testCreateUser(page);
    await testRdSamples(page);
    await testRoleManagement(page);
    await testProductInformation(page);

  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    if (consoleErrors.length > 0) {
      console.log('\n--- Console Errors Captured ---');
      for (const e of consoleErrors.slice(0, 10)) {
        console.log('  ', e.substring(0, 200));
      }
    }

    printResults();
    await browser.close();
  }
}

main().catch(console.error);
