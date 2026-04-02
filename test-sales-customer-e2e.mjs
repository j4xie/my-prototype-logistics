/**
 * Layer 2 CRUD E2E Tests — Sales & Customer Modules
 * Uses Playwright Node.js (NOT MCP browser tools)
 *
 * Tests:
 *   1. Customer CRUD (Create)
 *   2. Sales Order Create (validates Bug C1 salesperson dropdown, C2 product headers)
 *   3. Sales Order Edit (draft) — validates Bug C3 (edit button exists)
 *   4. Sales Order Cancel
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

// Unique suffix to identify test data
const TS = Date.now();
const CUSTOMER_NAME = `E2E测试客户_${TS}`;
const CONTACT_PERSON = '测试人';
const PHONE = '13800001111';

const results = [];

function report(module, action, details) {
  results.push({ module, action, ...details });
}

function printResults() {
  console.log('\n' + '='.repeat(72));
  console.log('  SALES & CUSTOMER E2E TEST RESULTS');
  console.log('='.repeat(72) + '\n');
  for (const r of results) {
    console.log(`### ${r.module} — ${r.action}`);
    console.log(`  action: ${r.actionDesc}`);
    console.log(`  evidence:`);
    if (r.filled) console.log(`    - filled: ${r.filled}`);
    if (r.toast) console.log(`    - toast: "${r.toast}"`);
    if (r.listAfter) console.log(`    - list after: ${r.listAfter}`);
    if (r.extra) {
      for (const e of r.extra) console.log(`    - ${e}`);
    }
    console.log(`  result: ${r.result}`);
    console.log('');
  }
  console.log('='.repeat(72));
  const pass = results.filter(r => r.result.includes('PASS')).length;
  const fail = results.filter(r => !r.result.includes('PASS')).length;
  console.log(`  TOTAL: ${pass} PASS, ${fail} FAIL/BUG out of ${results.length} tests`);
  console.log('='.repeat(72));
}

async function waitForToast(page, timeout = 8000) {
  try {
    const toast = await page.waitForSelector('.el-message .el-message__content', { timeout });
    const text = await toast.textContent();
    return text?.trim() || '';
  } catch {
    return '(no toast detected)';
  }
}

async function dismissToasts(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.el-message').forEach(el => el.remove());
  });
  await page.waitForTimeout(300);
}

/**
 * Click an el-select (possibly filterable), wait for dropdown, pick first visible option.
 * Element Plus renders dropdown poppers at body level (teleported).
 * Returns the text of the selected option, or null if none found.
 */
async function selectFirstOption(page, selectLocator, label) {
  // Click the select's inner input to open dropdown
  const input = selectLocator.locator('input.el-input__inner, .el-select__input');
  await input.first().click();
  await page.waitForTimeout(800); // Wait for dropdown animation + data

  // The dropdown popper is at body level. Find visible dropdown items.
  // There may be multiple dropdowns; we want the last (most recently opened) visible one.
  const allDropdowns = page.locator('.el-select-dropdown__list');
  const dropdownCount = await allDropdowns.count();

  let selectedText = null;
  for (let i = dropdownCount - 1; i >= 0; i--) {
    const dropdown = allDropdowns.nth(i);
    const visible = await dropdown.isVisible().catch(() => false);
    if (!visible) continue;

    const items = dropdown.locator('.el-select-dropdown__item:not(.is-disabled)');
    const itemCount = await items.count();
    if (itemCount > 0) {
      selectedText = (await items.first().textContent())?.trim() || '';
      await items.first().click();
      await page.waitForTimeout(500);
      break;
    }
  }

  if (!selectedText) {
    console.log(`  [selectFirstOption] No options found for "${label}"`);
  } else {
    console.log(`  [selectFirstOption] Selected "${selectedText}" for "${label}"`);
  }
  return selectedText;
}

async function login(page) {
  console.log('[LOGIN] Attempting login via API first (to avoid UI rate limit)...');

  // Try API login with retries (rate limit is 5/60s per IP, Caffeine cache)
  let token = null;
  let userData = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(`http://localhost:10010/api/mobile/auth/unified-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD })
      });
      const body = await resp.json();
      if (body.success && body.data) {
        token = body.data.token || body.data.accessToken;
        userData = body.data;
        console.log(`[LOGIN] API login successful (attempt ${attempt})`);
        break;
      } else if (body.code === 429) {
        console.log(`[LOGIN] Rate limited (attempt ${attempt}/3), waiting 65s...`);
        await new Promise(r => setTimeout(r, 65000));
      } else {
        console.log(`[LOGIN] API login failed: ${body.message}`);
        break;
      }
    } catch (err) {
      console.log(`[LOGIN] API call failed: ${err.message}`);
      break;
    }
  }

  if (token && userData) {
    // Inject token and user data directly into the browser
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.evaluate(({ token, userData }) => {
      localStorage.setItem('cretas_access_token', token);
      const user = {
        id: userData.userId,
        username: userData.username,
        email: '',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userType: 'factory',
        factoryUser: {
          role: userData.role,
          factoryId: userData.factoryId,
          factoryType: userData.factoryType || 'FACTORY',
          permissions: userData.permissions || [],
        }
      };
      localStorage.setItem('cretas_user', JSON.stringify(user));
    }, { token, userData });

    // Navigate to dashboard — auth store will hydrate from localStorage
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    console.log('[LOGIN] Injected token + user data, navigated to dashboard');
  } else {
    // Fallback: UI login
    console.log('[LOGIN] Falling back to UI login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    const usernameInput = page.locator('.login-form .el-input__inner').first();
    await usernameInput.fill(USERNAME);

    const passwordInput = page.locator('.login-form .el-input__inner').nth(1);
    await passwordInput.fill(PASSWORD);

    await page.locator('.login-button').click();
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  }
  console.log('[LOGIN] Login complete, current URL:', page.url());
}

// ============================================================
// TEST 1: Customer CRUD — Create
// ============================================================
async function testCustomerCreate(page) {
  console.log('\n[TEST 1] Customer CRUD — Create');
  try {
    await page.goto(`${BASE_URL}/sales/customers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const addBtn = page.locator('button:has-text("新增客户")');
    const addBtnVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!addBtnVisible) {
      report('Customer', 'Create', {
        actionDesc: 'Click 新增客户 button',
        result: '❌ FAIL — "新增客户" button not found or not visible'
      });
      return;
    }
    await addBtn.click();

    await page.waitForSelector('.el-dialog', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Fill 客户名称
    const nameInput = page.locator('.el-dialog .el-form-item').filter({ hasText: '客户名称' }).locator('.el-input__inner');
    await nameInput.fill(CUSTOMER_NAME);

    // Fill 联系人
    const contactInput = page.locator('.el-dialog .el-form-item').filter({ hasText: '联系人' }).locator('.el-input__inner');
    await contactInput.fill(CONTACT_PERSON);

    // Fill 联系电话
    const phoneInput = page.locator('.el-dialog .el-form-item').filter({ hasText: '联系电话' }).locator('.el-input__inner');
    await phoneInput.fill(PHONE);

    // Fill 收货地址 (required)
    const addressInput = page.locator('.el-dialog .el-form-item').filter({ hasText: '收货地址' }).locator('textarea');
    await addressInput.fill('E2E测试地址');

    await dismissToasts(page);
    const submitBtn = page.locator('.el-dialog__footer .el-button--primary');
    await submitBtn.click();

    const toast = await waitForToast(page);
    await page.waitForTimeout(2000);

    const listText = await page.locator('.el-table').textContent();
    const inList = listText.includes(CUSTOMER_NAME);

    report('Customer', 'Create', {
      actionDesc: 'Clicked 新增客户, filled form, clicked 确定',
      filled: `客户名称=${CUSTOMER_NAME}, 联系人=${CONTACT_PERSON}, 电话=${PHONE}, 收货地址=E2E测试地址`,
      toast: toast,
      listAfter: inList ? `"${CUSTOMER_NAME}" found in customer list table` : `"${CUSTOMER_NAME}" NOT found in list`,
      result: (toast.includes('成功') && inList) ? '✅ PASS' : `❌ FAIL — toast="${toast}", inList=${inList}`
    });
  } catch (err) {
    report('Customer', 'Create', {
      actionDesc: 'Click 新增客户, fill form, submit',
      result: `❌ FAIL — ${err.message}`
    });
  }
}

// ============================================================
// TEST 2: Sales Order Create (validates Bug C1 + C2)
// ============================================================
async function testSalesOrderCreate(page) {
  console.log('\n[TEST 2] Sales Order Create');
  try {
    await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Extra wait for async data (customers, products, employees)

    const addBtn = page.locator('button:has-text("新建")').first();
    const addBtnVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!addBtnVisible) {
      report('Sales Order', 'Create', {
        actionDesc: 'Click 新建销售订单 button',
        result: '❌ FAIL — "新建" button not found'
      });
      return;
    }
    await addBtn.click();

    await page.waitForSelector('.el-dialog', { timeout: 5000 });
    await page.waitForTimeout(1500); // Plenty of time for async data

    const bugC1Extra = [];

    // === Bug C1 Check: Salesperson is a DROPDOWN (el-select), not text input ===
    const salespersonFormItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '业务员' });
    const salespersonHasSelect = (await salespersonFormItem.locator('.el-select').count()) > 0;
    if (salespersonHasSelect) {
      bugC1Extra.push('Bug C1 VALIDATED: salesperson is el-select (dropdown), not plain text input');
    } else {
      bugC1Extra.push('Bug C1 STILL PRESENT: salesperson is plain text input, not dropdown');
    }

    // === Bug C2 Check: Product table headers ===
    const headerRow = page.locator('.el-dialog .item-header');
    const headerText = (await headerRow.textContent().catch(() => '')).trim().replace(/\s+/g, ' ');
    const hasProductHeaders = headerText.includes('品名') && headerText.includes('数量') && headerText.includes('单价');
    bugC1Extra.push(
      hasProductHeaders
        ? `Bug C2 VALIDATED: product header row = "${headerText}"`
        : `Bug C2 CHECK: product header text = "${headerText}"`
    );

    // --- Select customer ---
    // The dialog has multiple el-select. The first one is the customer select.
    const dialogSelects = page.locator('.el-dialog .el-form-item .el-select');
    const customerSelect = dialogSelects.first();

    // Debug: check how many customers are loaded
    const customerCount = await page.evaluate(() => {
      // Access Vue app data to see if customers loaded
      const selects = document.querySelectorAll('.el-dialog .el-select');
      if (selects.length > 0) {
        const options = selects[0].querySelectorAll('.el-select-dropdown__item');
        return options.length;
      }
      return -1;
    });
    console.log(`  [DEBUG] Customer options in DOM: ${customerCount}`);

    const selectedCustomer = await selectFirstOption(page, customerSelect, '客户');
    if (!selectedCustomer) {
      bugC1Extra.push('WARNING: No customer options available in dropdown — API may not have returned customers');

      // Try via evaluate: set the first customer via Vue reactivity
      const customerSet = await page.evaluate(() => {
        // Try to find the Vue component and check its data
        const dialogEl = document.querySelector('.el-dialog');
        if (!dialogEl) return false;
        // Look at the first el-select's el-select-dropdown__item
        const items = document.querySelectorAll('.el-select-dropdown__item');
        return items.length;
      });
      bugC1Extra.push(`  (total dropdown items in DOM: ${customerSet})`);
    }

    // Close any open dropdown before moving to next field
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // --- Select salesperson ---
    if (salespersonHasSelect) {
      const spSelect = salespersonFormItem.locator('.el-select');
      const spName = await selectFirstOption(page, spSelect, '业务员');
      if (spName) {
        bugC1Extra.push(`selected salesperson: "${spName}"`);
      } else {
        // allow-create: type a name
        const spInput = salespersonFormItem.locator('input');
        await spInput.first().click();
        await spInput.first().fill('测试业务员');
        await page.keyboard.press('Enter');
        bugC1Extra.push('typed salesperson: "测试业务员" (used allow-create)');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // --- Select product ---
    const productSelect = page.locator('.el-dialog .item-row:not(.item-header) .el-select').first();
    if (await productSelect.count() > 0) {
      const prodName = await selectFirstOption(page, productSelect, '产品');
      if (prodName) bugC1Extra.push(`selected product: "${prodName}"`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // --- Fill quantity ---
    const quantityInputNumber = page.locator('.el-dialog .item-row:not(.item-header) .el-input-number').first();
    if (await quantityInputNumber.count() > 0) {
      const qtyInner = quantityInputNumber.locator('input');
      await qtyInner.click();
      await qtyInner.fill('');
      await qtyInner.type('100');
    }

    // --- Fill unit price ---
    const priceInputNumber = page.locator('.el-dialog .item-row:not(.item-header) .el-input-number').nth(1);
    if (await priceInputNumber.count() > 0) {
      const priceInner = priceInputNumber.locator('input');
      await priceInner.click();
      await priceInner.fill('');
      await priceInner.type('25.5');
    }

    // --- Submit ---
    await dismissToasts(page);
    const submitBtn = page.locator('.el-dialog__footer .el-button--primary');
    await submitBtn.click();

    const toast = await waitForToast(page);
    await page.waitForTimeout(2000);

    const tableText = await page.locator('.el-table').textContent();
    const hasDraft = tableText.includes('草稿') || tableText.includes('DRAFT');

    report('Sales Order', 'Create (+ Bug C1/C2 validation)', {
      actionDesc: 'Clicked 新建, selected customer/salesperson/product, filled qty+price, clicked 创建',
      filled: `customer=${selectedCustomer || '(none)'}, quantity=100, unitPrice=25.5`,
      toast: toast,
      listAfter: `draft orders in list: ${hasDraft ? 'YES' : 'no draft found'}`,
      extra: bugC1Extra,
      result: toast.includes('成功') ? '✅ PASS' : `❌ FAIL — toast="${toast}"`
    });
  } catch (err) {
    report('Sales Order', 'Create', {
      actionDesc: 'Click 新建, fill form, submit',
      result: `❌ FAIL — ${err.message}`
    });
  }
}

// ============================================================
// TEST 3: Sales Order Edit (draft) — validates Bug C3
// ============================================================
async function testSalesOrderEdit(page) {
  console.log('\n[TEST 3] Sales Order Edit (draft)');
  try {
    await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Filter to DRAFT
    const statusSelect = page.locator('.search-bar .el-select');
    if (await statusSelect.count() > 0) {
      await selectFirstOptionByText(page, statusSelect, '草稿');
      await page.waitForTimeout(2000);
    }

    // Look for 编辑 button
    const editBtn = page.locator('.el-table .el-button').filter({ hasText: '编辑' }).first();
    const editBtnVisible = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!editBtnVisible) {
      const tableText = await page.locator('.el-table').textContent();
      const hasDraft = tableText.includes('草稿');
      if (!hasDraft) {
        report('Sales Order', 'Edit (draft) — Bug C3 validation', {
          actionDesc: 'Looked for DRAFT order with 编辑 button',
          extra: ['No DRAFT orders exist in list — cannot test edit.'],
          result: '❌ FAIL — no DRAFT orders available'
        });
      } else {
        report('Sales Order', 'Edit (draft) — Bug C3 validation', {
          actionDesc: 'Found DRAFT orders but no 编辑 button visible',
          extra: ['Bug C3 STILL PRESENT: DRAFT orders exist but 编辑 button is missing'],
          result: '❌ KNOWN_BUG — edit button missing on DRAFT orders (Bug C3)'
        });
      }
      return;
    }

    console.log('  编辑 button found! Clicking...');

    // Capture the order number from the same row
    const editBtnCell = editBtn.locator('xpath=ancestor::tr');
    const orderNum = (await editBtnCell.locator('td').first().textContent())?.trim() || '(unknown)';

    await editBtn.click();

    await page.waitForSelector('.el-dialog', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const dialogTitle = (await page.locator('.el-dialog__title').textContent())?.trim();
    const isEditMode = dialogTitle?.includes('编辑');

    // Modify remark field
    const remarkFormItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '备注' });
    const remarkTextarea = remarkFormItem.locator('textarea');
    const remarkExists = (await remarkTextarea.count()) > 0;
    const editedRemark = `E2E编辑测试_${TS}`;
    if (remarkExists) {
      await remarkTextarea.fill(editedRemark);
    }

    // Also ensure customer is still selected (it should be pre-filled from the order)
    // Check if customerId is set by checking the select display value
    const customerDisplay = page.locator('.el-dialog .el-form-item .el-select .el-input__inner').first();
    const customerValue = await customerDisplay.inputValue().catch(() => '');
    const bugExtras = [
      `Bug C3 VALIDATED: 编辑 button exists and is clickable on DRAFT orders`,
      `dialog title: "${dialogTitle}"`,
      `edit mode detected: ${isEditMode}`,
      `order being edited: ${orderNum}`,
      `customer pre-filled: "${customerValue || '(empty)'}"`,
    ];

    // Listen for HTTP errors on the PUT request
    let putStatus = null;
    const putListener = (response) => {
      if (response.url().includes('/sales/orders/') && response.request().method() === 'PUT') {
        putStatus = response.status();
      }
    };
    page.on('response', putListener);

    await dismissToasts(page);
    const saveBtn = page.locator('.el-dialog__footer .el-button--primary');
    await saveBtn.click();

    const toast = await waitForToast(page);
    await page.waitForTimeout(1500);
    page.off('response', putListener);

    if (putStatus === 405) {
      bugExtras.push(`BACKEND BUG: PUT /sales/orders/{id} returns 405 Method Not Allowed`);
      bugExtras.push(`SalesController.java has no @PutMapping for order update — only POST/GET endpoints exist`);
    }

    const isBackendBug = putStatus === 405;

    report('Sales Order', 'Edit (draft) — Bug C3 validation', {
      actionDesc: `Found DRAFT order (${orderNum}), clicked 编辑, modified remark, clicked 保存`,
      filled: `remark="${editedRemark}"`,
      toast: toast,
      extra: bugExtras,
      result: toast.includes('成功')
        ? '✅ PASS'
        : isBackendBug
          ? `❌ KNOWN_BUG — Backend missing PUT /sales/orders/{id} endpoint (HTTP 405). Frontend edit UI works correctly (Bug C3 fixed), but save fails because backend SalesController has no @PutMapping.`
          : `❌ FAIL — toast="${toast}"`
    });
  } catch (err) {
    report('Sales Order', 'Edit (draft)', {
      actionDesc: 'Find draft order, click edit, modify, save',
      result: `❌ FAIL — ${err.message}`
    });
  }
}

/**
 * Open an el-select and click the option matching the given text.
 * Uses force:true click to bypass placeholder span overlay (Element Plus 2.x).
 */
async function selectFirstOptionByText(page, selectLocator, text) {
  // Click the select wrapper itself (force to bypass overlay)
  await selectLocator.click({ force: true });
  await page.waitForTimeout(800);

  const option = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: text });
  if (await option.count() > 0) {
    await option.first().click();
    await page.waitForTimeout(500);
    return true;
  }
  await page.keyboard.press('Escape');
  return false;
}

// ============================================================
// TEST 4: Sales Order Cancel
// ============================================================
async function testSalesOrderCancel(page) {
  console.log('\n[TEST 4] Sales Order Cancel');
  try {
    await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Filter to DRAFT
    const statusSelect = page.locator('.search-bar .el-select');
    if (await statusSelect.count() > 0) {
      await selectFirstOptionByText(page, statusSelect, '草稿');
      await page.waitForTimeout(2000);
    }

    // Look for 取消 button
    const cancelBtn = page.locator('.el-table .el-button').filter({ hasText: '取消' }).first();
    const cancelBtnVisible = await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!cancelBtnVisible) {
      const tableText = await page.locator('.el-table').textContent();
      const hasDraft = tableText.includes('草稿');
      report('Sales Order', 'Cancel', {
        actionDesc: 'Looked for DRAFT order with 取消 button',
        extra: [hasDraft ? 'DRAFT orders exist but 取消 button not visible' : 'No DRAFT orders in list'],
        result: '❌ FAIL — no cancelable orders found'
      });
      return;
    }

    // Get order number
    const cancelBtnRow = cancelBtn.locator('xpath=ancestor::tr');
    const orderNumber = (await cancelBtnRow.locator('td').first().textContent())?.trim() || '(unknown)';

    await dismissToasts(page);
    await cancelBtn.click();

    // Handle confirmation dialog
    const confirmDialog = page.locator('.el-message-box');
    await confirmDialog.waitFor({ timeout: 5000 });
    const confirmBtn = confirmDialog.locator('.el-message-box__btns .el-button--primary');
    await confirmBtn.click();

    const toast = await waitForToast(page);
    await page.waitForTimeout(2000);

    // Filter to Cancelled and check
    const resetBtn = page.locator('button:has-text("重置")');
    if (await resetBtn.count() > 0) {
      await resetBtn.click();
      await page.waitForTimeout(1500);
    }

    // Try to filter by 已取消
    if (await statusSelect.count() > 0) {
      await selectFirstOptionByText(page, statusSelect, '已取消');
      await page.waitForTimeout(2000);
    }

    const tableText = await page.locator('.el-table').textContent();
    const hasCancelled = tableText.includes('已取消');

    report('Sales Order', 'Cancel', {
      actionDesc: `Found DRAFT order (${orderNumber}), clicked 取消, confirmed`,
      toast: toast,
      listAfter: hasCancelled ? '"已取消" status found in order list' : 'could not verify cancelled status in list',
      result: toast.includes('成功') ? '✅ PASS' : `❌ FAIL — toast="${toast}"`
    });
  } catch (err) {
    report('Sales Order', 'Cancel', {
      actionDesc: 'Find draft order, click cancel, confirm',
      result: `❌ FAIL — ${err.message}`
    });
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('Starting Sales & Customer E2E Tests...');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Test timestamp: ${TS}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN'
  });
  const page = await context.newPage();

  page.setDefaultTimeout(10000);

  // Log console errors from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`  [CONSOLE ERROR] ${msg.text()}`);
    }
  });

  // Log failed network requests
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/')) {
      console.log(`  [HTTP ${response.status()}] ${response.url()}`);
    }
  });

  try {
    await login(page);

    await testCustomerCreate(page);
    await testSalesOrderCreate(page);
    await testSalesOrderEdit(page);
    await testSalesOrderCancel(page);
  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    printResults();
    await browser.close();
  }
}

main().catch(console.error);
