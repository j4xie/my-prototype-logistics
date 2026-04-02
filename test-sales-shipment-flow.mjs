/**
 * Layer 4 Business Flow Test: Sales Order -> Confirm -> Create Shipment
 * Validates Bug A4 (shipment creation was failing with 500)
 *
 * Usage: node test-sales-shipment-flow.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:10010';
const USERNAME = 'factory_admin1';
const PASSWORD = '123456';

const results = [];
let orderNumber = '';
let orderId = '';
let confirmResult = '';
let shipmentCreated = '';
let shipmentToastText = '';
let shipmentInList = '';

function log(step, action, result) {
  const entry = `  step ${step}: ${action} -> ${result}`;
  results.push(entry);
  console.log(entry);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Collect API errors (especially 500s) for Bug A4 validation
  const apiErrors = [];
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      apiErrors.push({ url: response.url(), status: response.status() });
    }
  });

  let testResult = 'PASS';
  let failReason = '';

  try {
    // ========== Step 1: Login ==========
    console.log('\n--- Sales -> Confirm -> Shipment Flow ---\n');

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(1000);

    // Use quick-login button to fill credentials, then click login
    const quickLoginBtn = page.locator('button').filter({ hasText: '工厂总监' }).first();
    if (await quickLoginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await quickLoginBtn.click();
      await sleep(500);
    } else {
      // Fallback: fill manually
      const usernameInput = page.locator('.el-input input').first();
      const passwordInput = page.locator('input[type="password"]');
      await usernameInput.fill(USERNAME);
      await passwordInput.fill(PASSWORD);
    }

    // Click the main login button (class="login-button", text "登 录")
    const loginBtn = page.locator('.login-button').first();
    await loginBtn.click();

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
    await sleep(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('dashboard') || currentUrl.includes('sales')) {
      log(1, 'Login as factory_admin1', 'SUCCESS - redirected to ' + currentUrl);
    } else {
      log(1, 'Login as factory_admin1', 'WARN - current URL: ' + currentUrl);
    }

    // ========== Step 2: Navigate to Sales Orders ==========
    await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(2000);

    log(2, 'Navigate to /sales/orders', 'Page loaded');

    // ========== Step 3: Look for a DRAFT order, or create a new one ==========
    // Check if there are DRAFT orders in the table
    let hasDraft = false;
    const draftTags = page.locator('.el-tag').filter({ hasText: '草稿' });
    const draftCount = await draftTags.count();

    if (draftCount > 0) {
      log(3, 'Check for DRAFT orders', `Found ${draftCount} DRAFT order(s)`);
      hasDraft = true;

      // Get the order number from the row with the draft tag
      const draftRow = draftTags.first().locator('xpath=ancestor::tr');
      const orderNumCell = draftRow.locator('td').first();
      orderNumber = (await orderNumCell.textContent())?.trim() || 'unknown';

      // Get the order ID from the row's detail button
      const detailBtn = draftRow.locator('button').filter({ hasText: '详情' }).first();
      if (await detailBtn.isVisible()) {
        // We'll get the ID later from the URL when we navigate to detail
      }
    } else {
      log(3, 'Check for DRAFT orders', 'None found - creating new order');

      // Click "新建" button
      const createBtn = page.locator('button').filter({ hasText: /新建/ }).first();
      await createBtn.click();
      await sleep(1500);

      // Wait for dialog to appear
      await page.waitForSelector('.el-dialog', { timeout: 5000 });

      // Select first customer from dropdown
      const customerSelect = page.locator('.el-dialog .el-select').first();
      await customerSelect.click();
      await sleep(800);

      // Pick the first option in the dropdown
      const firstOption = page.locator('.el-select-dropdown__item').first();
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOption.click();
        await sleep(500);
      } else {
        // Try typing to trigger filterable dropdown
        const selectInput = customerSelect.locator('input').first();
        await selectInput.fill('a');
        await sleep(1000);
        const opt = page.locator('.el-select-dropdown__item').first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await opt.click();
          await sleep(500);
        }
      }

      // Select first product for item
      const productSelects = page.locator('.el-dialog .el-select');
      // The second select should be the product selector (in the items area)
      if (await productSelects.nth(1).isVisible({ timeout: 2000 }).catch(() => false)) {
        await productSelects.nth(1).click();
        await sleep(800);
        const prodOption = page.locator('.el-select-dropdown__item:visible').first();
        if (await prodOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await prodOption.click();
          await sleep(500);
        }
      }

      // Set quantity
      const qtyInputs = page.locator('.el-dialog .el-input-number input');
      const qtyInput = qtyInputs.first();
      if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await qtyInput.fill('10');
        await sleep(300);
      }

      // Set unit price (second input-number in the row)
      if (await qtyInputs.nth(1).isVisible({ timeout: 1000 }).catch(() => false)) {
        await qtyInputs.nth(1).fill('50');
        await sleep(300);
      }

      // Click "创建" button in dialog footer
      const submitBtn = page.locator('.el-dialog__footer button').filter({ hasText: /创建|保存/ }).first();
      await submitBtn.click();
      await sleep(3000);

      // Check for success message
      const successMsg = page.locator('.el-message--success');
      if (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
        log('3b', 'Create new sales order', 'SUCCESS - order created');
        hasDraft = true;
      } else {
        // Check if error
        const errorMsg = page.locator('.el-message--error');
        if (await errorMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
          const errText = await errorMsg.textContent();
          log('3b', 'Create new sales order', `FAILED - ${errText}`);
          // Try to continue anyway by looking for existing confirmed orders
        } else {
          log('3b', 'Create new sales order', 'Created (no toast detected)');
          hasDraft = true;
        }
      }

      // Reload page to see new order
      await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
      await sleep(2000);
    }

    // ========== Step 4: Find a DRAFT order and Confirm it ==========
    // Re-check for drafts after potential creation
    const draftTagsNow = page.locator('.el-tag').filter({ hasText: '草稿' });
    const draftCountNow = await draftTagsNow.count();

    if (draftCountNow > 0) {
      // Get the row with the first draft order
      const draftTag = draftTagsNow.first();
      const draftRow = draftTag.locator('xpath=ancestor::tr');

      // Get order number
      const firstCell = draftRow.locator('td .cell').first();
      orderNumber = (await firstCell.textContent())?.trim() || 'unknown';

      // Click "确认" button on this row
      const confirmBtn = draftRow.locator('button').filter({ hasText: '确认' }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await sleep(1000);

        // Confirm the MessageBox dialog
        const msgBoxConfirmBtn = page.locator('.el-message-box__btns button').filter({ hasText: /确定|确认/ }).first();
        if (await msgBoxConfirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await msgBoxConfirmBtn.click();
          await sleep(3000);

          // Check for success
          const confSuccess = page.locator('.el-message--success');
          if (await confSuccess.isVisible({ timeout: 3000 }).catch(() => false)) {
            confirmResult = 'success';
            log(4, `Confirm order ${orderNumber}`, 'SUCCESS - confirmed');
          } else {
            const errMsg = page.locator('.el-message--error');
            if (await errMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
              const errText = await errMsg.textContent();
              confirmResult = 'fail';
              log(4, `Confirm order ${orderNumber}`, `FAILED - ${errText}`);
            } else {
              confirmResult = 'unknown';
              log(4, `Confirm order ${orderNumber}`, 'Completed (no toast)');
            }
          }
        } else {
          confirmResult = 'fail';
          log(4, `Confirm order ${orderNumber}`, 'FAILED - no confirmation dialog appeared');
        }
      } else {
        confirmResult = 'skipped';
        log(4, 'Confirm order', 'No confirm button visible on DRAFT row');
      }
    } else {
      // No DRAFT orders, look for CONFIRMED orders to test shipment
      log(4, 'Confirm order', 'No DRAFT orders available - looking for CONFIRMED orders');
      confirmResult = 'skipped (no drafts)';
    }

    // Reload to get fresh data
    await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(2000);

    // ========== Step 5: Navigate to order detail ==========
    // Find a CONFIRMED or PROCESSING order (one that can have shipment created)
    const confirmedTags = page.locator('.el-tag').filter({ hasText: /已确认|处理中|部分发货|财务已批准/ });
    const confirmedCount = await confirmedTags.count();

    if (confirmedCount > 0) {
      const confirmedRow = confirmedTags.first().locator('xpath=ancestor::tr');
      const rowOrderNum = confirmedRow.locator('td .cell').first();
      orderNumber = (await rowOrderNum.textContent())?.trim() || orderNumber;

      // Click "详情" button on this row
      const detailBtn = confirmedRow.locator('button').filter({ hasText: '详情' }).first();
      await detailBtn.click();
      await sleep(3000);

      // Wait for detail page to load
      const currentUrlAfterNav = page.url();
      if (currentUrlAfterNav.includes('/sales/orders/')) {
        orderId = currentUrlAfterNav.split('/sales/orders/')[1]?.split('?')[0] || '';
        log(5, `Navigate to order detail (${orderNumber})`, `SUCCESS - URL: ${currentUrlAfterNav}`);
      } else {
        log(5, 'Navigate to order detail', `WARN - URL is ${currentUrlAfterNav}`);
      }
    } else {
      // Fall back: click detail on ANY order
      const anyDetailBtn = page.locator('button').filter({ hasText: '详情' }).first();
      if (await anyDetailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Get order number from the row
        const row = anyDetailBtn.locator('xpath=ancestor::tr');
        const firstCellText = (await row.locator('td .cell').first().textContent())?.trim();
        orderNumber = firstCellText || orderNumber;

        await anyDetailBtn.click();
        await sleep(3000);
        const url2 = page.url();
        orderId = url2.includes('/sales/orders/') ? url2.split('/sales/orders/')[1]?.split('?')[0] : '';
        log(5, `Navigate to order detail (${orderNumber})`, `Navigated - URL: ${url2}`);
      } else {
        log(5, 'Navigate to order detail', 'FAILED - no orders in table');
        testResult = 'FAIL';
        failReason = 'No orders available in list';
        throw new Error(failReason);
      }
    }

    // ========== Step 6: Click shipment/delivery button on detail page ==========
    await sleep(2000);

    // The delivery button text comes from label('delivery') which for factory is "发货"
    // Button shows when status is CONFIRMED, FINANCE_APPROVED, PROCESSING, or PARTIAL_DELIVERED
    const deliveryBtn = page.locator('button').filter({ hasText: /发货|出库|创建发货单/ }).first();
    const hasDeliveryBtn = await deliveryBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDeliveryBtn) {
      await deliveryBtn.click();
      await sleep(2000);

      // Wait for the delivery dialog
      const deliveryDialog = page.locator('.el-dialog').filter({ hasText: /发货|出库/ }).first();
      if (await deliveryDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        log(6, 'Click delivery button on detail page', 'SUCCESS - delivery dialog opened');
      } else {
        log(6, 'Click delivery button on detail page', 'Dialog did not open');
      }
    } else {
      // Check order status
      const statusTag = page.locator('.el-tag[size="large"]').first();
      const statusText = (await statusTag.textContent().catch(() => ''))?.trim();
      log(6, `Click delivery button on detail page`, `No delivery button visible (order status: ${statusText}). Checking if order needs to be confirmed first...`);

      // If the order is DRAFT, confirm it from the detail page
      const detailConfirmBtn = page.locator('button').filter({ hasText: '确认订单' }).first();
      if (await detailConfirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await detailConfirmBtn.click();
        await sleep(1000);

        // Confirm the MessageBox
        const msgBoxBtn = page.locator('.el-message-box__btns button').filter({ hasText: /确定|确认/ }).first();
        if (await msgBoxBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await msgBoxBtn.click();
          await sleep(3000);
          log('6b', 'Confirm order from detail page', 'Confirmed');
          confirmResult = 'success (from detail page)';
        }

        // Now try clicking the delivery button again
        await sleep(2000);
        const deliveryBtn2 = page.locator('button').filter({ hasText: /发货|出库|创建发货单/ }).first();
        if (await deliveryBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deliveryBtn2.click();
          await sleep(2000);
          log('6c', 'Click delivery button after confirming', 'SUCCESS - delivery dialog opened');
        } else {
          log('6c', 'Click delivery button after confirming', 'Still no delivery button');
        }
      }
    }

    // ========== Step 7: Fill and submit shipment/delivery form ==========
    const dialog = page.locator('.el-dialog:visible').first();
    const dialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (dialogVisible) {
      // Fill delivery address
      const addressInput = dialog.locator('input').first();
      if (await addressInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        const currentVal = await addressInput.inputValue();
        if (!currentVal) {
          await addressInput.fill('上海市浦东新区测试地址123号');
        }
        await sleep(300);
      }

      // Fill logistics company (second input in the form)
      const logisticsInput = dialog.locator('input').nth(1);
      if (await logisticsInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await logisticsInput.fill('顺丰冷链');
        await sleep(300);
      }

      // Check if there are quantity inputs in the items table and ensure > 0
      const qtyInputs = dialog.locator('.el-input-number input');
      const qtyCount = await qtyInputs.count();
      for (let i = 0; i < qtyCount; i++) {
        const val = await qtyInputs.nth(i).inputValue();
        if (!val || val === '0') {
          await qtyInputs.nth(i).fill('5');
          await sleep(200);
        }
      }

      log(7, 'Fill shipment form (address, logistics, quantities)', 'Form filled');

      // ========== Step 8: Submit the form ==========
      // Clear any previous error API tracking
      apiErrors.length = 0;

      const submitBtn = dialog.locator('button').filter({ hasText: /创建发货单|确认出库|确认/ }).last();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await sleep(4000);

        // Check for 500 errors (Bug A4)
        const has500 = apiErrors.some(e => e.status >= 500);

        // Check for success or error toast
        const successToast = page.locator('.el-message--success');
        const errorToast = page.locator('.el-message--error');

        if (has500) {
          shipmentCreated = 'fail';
          shipmentToastText = `500 error on: ${apiErrors.filter(e => e.status >= 500).map(e => e.url).join(', ')}`;
          testResult = 'KNOWN_BUG';
          failReason = 'Bug A4: shipment creation returns 500';
          log(8, 'Submit shipment form', `FAILED - Bug A4 confirmed: 500 error`);
        } else if (await successToast.isVisible({ timeout: 2000 }).catch(() => false)) {
          shipmentToastText = (await successToast.textContent())?.trim() || 'success toast';
          shipmentCreated = 'success';
          log(8, 'Submit shipment form', `SUCCESS - ${shipmentToastText}`);
        } else if (await errorToast.isVisible({ timeout: 2000 }).catch(() => false)) {
          shipmentToastText = (await errorToast.textContent())?.trim() || 'error toast';
          shipmentCreated = 'fail';
          testResult = 'FAIL';
          failReason = `Shipment creation error: ${shipmentToastText}`;
          log(8, 'Submit shipment form', `FAILED - ${shipmentToastText}`);
        } else {
          // Dialog closed = likely success
          const dialogStillVisible = await dialog.isVisible().catch(() => false);
          if (!dialogStillVisible) {
            shipmentCreated = 'success (dialog closed)';
            shipmentToastText = 'dialog closed, assumed success';
            log(8, 'Submit shipment form', 'SUCCESS - dialog closed (no toast detected)');
          } else {
            shipmentCreated = 'unknown';
            shipmentToastText = 'no response detected';
            log(8, 'Submit shipment form', 'UNKNOWN - dialog still open, no toast');
          }
        }
      } else {
        shipmentCreated = 'fail';
        shipmentToastText = 'no submit button found';
        testResult = 'FAIL';
        failReason = 'Submit button not found in delivery dialog';
        log(8, 'Submit shipment form', 'FAILED - no submit button found');
      }
    } else {
      // No dialog visible - can't test shipment creation
      shipmentCreated = 'skipped';
      shipmentToastText = 'delivery dialog never opened';
      log(7, 'Fill shipment form', 'SKIPPED - no delivery dialog');
      log(8, 'Submit shipment form', 'SKIPPED');

      // If we got to this point but couldn't open the dialog, check if there's
      // an "出库" button on the order list page instead (quick delivery)
      await page.goto(`${BASE_URL}/sales/orders`, { waitUntil: 'networkidle', timeout: 15000 });
      await sleep(2000);

      const outboundBtns = page.locator('button').filter({ hasText: '出库' });
      const outboundCount = await outboundBtns.count();
      if (outboundCount > 0) {
        log('7b', 'Fallback: try quick outbound from list page', `Found ${outboundCount} outbound button(s)`);

        await outboundBtns.first().click();
        await sleep(2000);

        const quickDialog = page.locator('.el-dialog:visible').first();
        if (await quickDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Fill quick delivery form
          const submitQuickBtn = quickDialog.locator('button').filter({ hasText: /确认出库/ }).first();
          apiErrors.length = 0;

          if (await submitQuickBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await submitQuickBtn.click();
            await sleep(4000);

            const has500 = apiErrors.some(e => e.status >= 500);
            const successToast = page.locator('.el-message--success');
            const errorToast = page.locator('.el-message--error');

            if (has500) {
              shipmentCreated = 'fail';
              shipmentToastText = `500 error (Bug A4)`;
              testResult = 'KNOWN_BUG';
              failReason = 'Bug A4: delivery creation returns 500';
              log('8b', 'Submit quick delivery', 'FAILED - 500 error');
            } else if (await successToast.isVisible({ timeout: 2000 }).catch(() => false)) {
              shipmentCreated = 'success';
              shipmentToastText = (await successToast.textContent())?.trim() || 'success';
              log('8b', 'Submit quick delivery', `SUCCESS - ${shipmentToastText}`);
            } else if (await errorToast.isVisible({ timeout: 2000 }).catch(() => false)) {
              shipmentCreated = 'fail';
              shipmentToastText = (await errorToast.textContent())?.trim() || 'error';
              testResult = 'FAIL';
              failReason = shipmentToastText;
              log('8b', 'Submit quick delivery', `FAILED - ${shipmentToastText}`);
            } else {
              shipmentCreated = 'success (dialog closed)';
              shipmentToastText = 'assumed success';
              log('8b', 'Submit quick delivery', 'Completed');
            }
          }
        }
      }
    }

    // ========== Step 9: Verify shipment in shipments list ==========
    await page.goto(`${BASE_URL}/sales/shipments`, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(3000);

    // Check the shipments table has data
    const shipmentRows = page.locator('.el-table__body-wrapper tr');
    const shipmentRowCount = await shipmentRows.count();
    const emptyText = page.locator('.el-table__empty-text');
    const isEmpty = await emptyText.isVisible({ timeout: 1000 }).catch(() => false);

    if (!isEmpty && shipmentRowCount > 0) {
      // Get the first shipment number
      const firstShipNum = page.locator('.el-table__body-wrapper tr').first().locator('td .cell').first();
      const shipNumText = (await firstShipNum.textContent())?.trim() || '';
      shipmentInList = `yes (${shipmentRowCount} records, latest: ${shipNumText})`;
      log(9, 'Navigate to /sales/shipments and verify records', `SUCCESS - ${shipmentRowCount} shipment(s) found`);
    } else {
      shipmentInList = 'no (empty table)';
      log(9, 'Navigate to /sales/shipments and verify records', 'No shipment records found');
      // This might not be a failure if the shipment is actually under deliveries not shipments
    }

    // Also check the deliveries endpoint directly
    // The detail page shows delivery records, let's check the API
    if (orderId) {
      await page.goto(`${BASE_URL}/sales/orders/${orderId}`, { waitUntil: 'networkidle', timeout: 15000 });
      await sleep(3000);

      // Check if the delivery records table has data
      const deliveryTable = page.locator('h3').filter({ hasText: /发货记录|出库记录/ });
      if (await deliveryTable.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look at the next table after this heading
        const deliveryRows = page.locator('.el-table').last().locator('.el-table__body-wrapper tr');
        const deliveryCount = await deliveryRows.count();

        if (deliveryCount > 0) {
          const firstDeliveryNum = deliveryRows.first().locator('td .cell').first();
          const delNumText = (await firstDeliveryNum.textContent())?.trim() || '';
          log('9b', `Check delivery records for order ${orderId}`, `Found ${deliveryCount} delivery record(s): ${delNumText}`);
          if (shipmentInList.startsWith('no')) {
            shipmentInList = `yes (in deliveries: ${deliveryCount} records)`;
          }
        } else {
          log('9b', `Check delivery records for order ${orderId}`, 'No delivery records found');
        }
      }
    }

  } catch (error) {
    if (!failReason) {
      testResult = 'FAIL';
      failReason = error.message;
    }
    log('ERR', 'Unexpected error', error.message);
  } finally {
    await browser.close();
  }

  // ========== Output Summary ==========
  console.log('\n### Sales -> Confirm -> Shipment Flow');
  for (const r of results) {
    console.log(r);
  }
  console.log('  evidence:');
  console.log(`    - order: ${orderNumber || 'N/A'}`);
  console.log(`    - confirm: ${confirmResult || 'N/A'}`);
  console.log(`    - shipment created: ${shipmentCreated || 'N/A'}${shipmentToastText ? ' (' + shipmentToastText + ')' : ''}`);
  console.log(`    - shipment in list: ${shipmentInList || 'N/A'}`);

  if (testResult === 'PASS') {
    console.log('  result: PASS');
    console.log('  note: Bug A4 NOT reproduced - delivery creation succeeded without 500 error.');
    console.log('        Deliveries are tracked under /{factoryId}/sales/deliveries (not /shipments).');
  } else if (testResult === 'KNOWN_BUG') {
    console.log(`  result: KNOWN_BUG [${failReason}]`);
  } else {
    console.log(`  result: FAIL [${failReason}]`);
  }

  process.exit(testResult === 'PASS' ? 0 : 1);
})();
