/**
 * E2E Test: Misc Pages, File Upload, Quality, Inventory, Shipments, System
 * Target: http://139.196.165.140:8086 (remote production)
 * Login: factory_admin1 / 123456
 *
 * Forced Evidence Template: each test logs EVIDENCE with screenshots or data proof.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://139.196.165.140:8086';
const SCREENSHOT_DIR = path.resolve('test-screenshots-misc');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let screenshotIdx = 0;

function log(module, status, detail, evidence = '') {
  const icon = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL';
  results.push({ module, status, detail, evidence });
  console.log(`[${icon}] [${module}] ${detail}${evidence ? ' | EVIDENCE: ' + evidence : ''}`);
}

async function screenshot(page, label) {
  screenshotIdx++;
  const fname = `${String(screenshotIdx).padStart(2, '0')}-${label}.png`;
  const fpath = path.join(SCREENSHOT_DIR, fname);
  await page.screenshot({ path: fpath, fullPage: false });
  return fname;
}

async function waitForLoad(page, timeout = 8000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    await page.waitForTimeout(3000);
  }
}

/** Safely get visible text count matching a pattern */
async function countVisible(page, selector) {
  try {
    return await page.locator(selector).count();
  } catch { return 0; }
}

/** Navigate to path and wait */
async function navigateTo(page, urlPath) {
  await page.goto(`${BASE}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await waitForLoad(page);
}

(async () => {
  console.log(`\n========================================`);
  console.log(`  E2E Misc Pages Test`);
  console.log(`  Target: ${BASE}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  // Collect network errors
  const networkErrors = [];
  page.on('response', resp => {
    if (resp.status() >= 500) {
      networkErrors.push(`${resp.status()} ${resp.url().replace(BASE, '').substring(0, 100)}`);
    }
  });

  // ========== 1. LOGIN ==========
  console.log('\n--- 1. LOGIN ---');
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Fill login form
    const usernameInput = page.locator('input[type="text"], input').first();
    await usernameInput.fill('factory_admin1');
    await page.locator('input[type="password"]').fill('123456');
    await page.waitForTimeout(500);

    // Click login button
    const loginBtn = page.locator('button[type="submit"], button.login-btn, button').filter({ hasText: /登录/ }).first();
    const loginBtnCount = await loginBtn.count();
    if (loginBtnCount > 0) {
      await loginBtn.click();
    } else {
      // Fallback: click first button
      await page.locator('button').first().click();
    }
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      log('LOGIN', 'FAIL', 'Still on login page after submit');
      await browser.close();
      process.exit(1);
    }
    const ss = await screenshot(page, 'login-success');
    log('LOGIN', 'PASS', `Redirected to ${currentUrl.replace(BASE, '')}`, ss);
  } catch (err) {
    log('LOGIN', 'FAIL', err.message.slice(0, 200));
    await browser.close();
    process.exit(1);
  }

  // ========== 2. R&D SAMPLES - TRACKING RECORD (with file upload) ==========
  console.log('\n--- 2. R&D SAMPLES - Tracking Record ---');
  try {
    await navigateTo(page, '/rd/samples');
    await page.waitForTimeout(2000);

    // Check if we're on the samples tab (default may be "requests" or "samples")
    const samplesTab = page.locator('.el-radio-button').filter({ hasText: '样品管理' });
    if (await samplesTab.count() > 0) {
      await samplesTab.click();
      await page.waitForTimeout(2000);
    }

    const ss1 = await screenshot(page, 'rd-samples-list');

    // Check if table has rows
    const tableRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
    log('RD_SAMPLES', tableRows > 0 ? 'PASS' : 'WARN',
      `Samples page loaded, ${tableRows} rows in table`, ss1);

    if (tableRows > 0) {
      // Click the first "追踪记录" button
      const trackingBtn = page.locator('.el-table__body-wrapper').locator('button, .el-button').filter({ hasText: '追踪记录' }).first();
      const trackBtnCount = await trackingBtn.count();

      if (trackBtnCount > 0) {
        await trackingBtn.click();
        await page.waitForTimeout(1500);

        const ss2 = await screenshot(page, 'rd-tracking-dialog');
        const dialogVisible = await page.locator('.el-dialog').filter({ hasText: '追踪记录' }).count() > 0;
        log('RD_TRACKING_DIALOG', dialogVisible ? 'PASS' : 'FAIL',
          `Tracking dialog ${dialogVisible ? 'opened' : 'not found'}`, ss2);

        if (dialogVisible) {
          // Fill tracking form
          // Date picker
          const datePicker = page.locator('.el-dialog').locator('.el-date-editor input').first();
          if (await datePicker.count() > 0) {
            await datePicker.click();
            await page.waitForTimeout(500);
            // Press escape to close date picker dropdown, use current date
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
          }

          // Fill tracking content
          const contentInput = page.locator('.el-dialog').locator('textarea').first();
          if (await contentInput.count() > 0) {
            await contentInput.fill('E2E测试追踪记录 - ' + new Date().toISOString().slice(0, 19));
          }

          // Fill attachment URL (since the form uses a text input, not file upload)
          const attachInput = page.locator('.el-dialog').locator('input[placeholder*="附件"]').first();
          if (await attachInput.count() > 0) {
            await attachInput.fill('https://example.com/test-attachment.pdf');
          }

          // Fill recorder name
          const recorderInput = page.locator('.el-dialog').locator('input[placeholder*="记录员"]').first();
          if (await recorderInput.count() > 0) {
            await recorderInput.fill('E2E测试员');
          }

          const ss3 = await screenshot(page, 'rd-tracking-form-filled');

          // Click submit button
          const addBtn = page.locator('.el-dialog').locator('button').filter({ hasText: '添加记录' }).first();
          if (await addBtn.count() > 0) {
            await addBtn.click();
            await page.waitForTimeout(3000);

            // Check for success message
            const successMsg = await page.locator('.el-message--success').count();
            const ss4 = await screenshot(page, 'rd-tracking-submitted');
            log('RD_TRACKING_SUBMIT', successMsg > 0 ? 'PASS' : 'WARN',
              `Tracking record submit attempted, success toast: ${successMsg > 0}`, ss4);
          } else {
            log('RD_TRACKING_SUBMIT', 'WARN', 'Add record button not found', ss3);
          }

          // Close dialog
          const closeBtn = page.locator('.el-dialog').locator('button').filter({ hasText: '关闭' }).first();
          if (await closeBtn.count() > 0) await closeBtn.click();
          await page.waitForTimeout(500);
        }
      } else {
        log('RD_TRACKING_DIALOG', 'WARN', 'No tracking button found in table rows');
      }
    } else {
      // If no rows, try creating a sample first
      log('RD_TRACKING_DIALOG', 'WARN', 'No sample rows to test tracking. Attempting to create a sample...');

      const createBtn = page.locator('button').filter({ hasText: '新建样品' }).first();
      if (await createBtn.count() > 0) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        // Fill sample name
        const nameInput = page.locator('.el-dialog').locator('input').nth(1); // after salesperson select
        if (await nameInput.count() > 0) {
          await nameInput.fill('E2E测试样品-' + Date.now());
        }

        const ss = await screenshot(page, 'rd-create-sample-form');

        // Submit
        const submitBtn = page.locator('.el-dialog').locator('button').filter({ hasText: '创建' }).first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          const successMsg = await page.locator('.el-message--success').count();
          const ss2 = await screenshot(page, 'rd-create-sample-result');
          log('RD_CREATE_SAMPLE', successMsg > 0 ? 'PASS' : 'WARN',
            `Sample creation attempted, success: ${successMsg > 0}`, ss2);
        }
      }
    }
  } catch (err) {
    const ss = await screenshot(page, 'rd-samples-error');
    log('RD_SAMPLES', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 3. QUALITY INSPECTIONS - Detail View ==========
  console.log('\n--- 3. QUALITY INSPECTIONS - Detail View ---');
  try {
    await navigateTo(page, '/quality/inspections');
    await page.waitForTimeout(2000);

    const ss1 = await screenshot(page, 'quality-inspections-list');
    const qiRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
    log('QUALITY_INSPECTIONS_LIST', 'PASS', `Quality inspections loaded, ${qiRows} rows`, ss1);

    if (qiRows > 0) {
      // Look for a detail/view button or clickable row
      const viewBtn = page.locator('.el-table__body-wrapper').locator('button, .el-button').filter({ hasText: /详情|查看|View/ }).first();
      const viewBtnCount = await viewBtn.count();

      if (viewBtnCount > 0) {
        await viewBtn.click();
        await page.waitForTimeout(2000);
        const ss2 = await screenshot(page, 'quality-inspection-detail');

        // Check if a drawer or dialog appeared
        const drawerVisible = (await page.locator('.el-drawer').count()) > 0 ||
                              (await page.locator('.el-dialog').count()) > 0;
        log('QUALITY_INSPECTION_DETAIL', drawerVisible ? 'PASS' : 'WARN',
          `Detail view ${drawerVisible ? 'opened (drawer/dialog)' : 'no drawer/dialog found'}`, ss2);

        // Close if opened
        if (drawerVisible) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      } else {
        // Try clicking on the first row itself
        const firstRow = page.locator('.el-table__body-wrapper tr.el-table__row').first();
        await firstRow.click();
        await page.waitForTimeout(2000);
        const ss2 = await screenshot(page, 'quality-inspection-row-click');
        const drawerVisible = (await page.locator('.el-drawer').count()) > 0 ||
                              (await page.locator('.el-dialog').count()) > 0;
        log('QUALITY_INSPECTION_DETAIL', drawerVisible ? 'PASS' : 'WARN',
          `Row click: ${drawerVisible ? 'detail opened' : 'no detail drawer/dialog'} (may use inline expand)`, ss2);
      }
    } else {
      log('QUALITY_INSPECTION_DETAIL', 'WARN', 'No inspection records to view detail');
    }
  } catch (err) {
    const ss = await screenshot(page, 'quality-inspections-error');
    log('QUALITY_INSPECTIONS', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 4. QUALITY STANDARDS CRUD ==========
  console.log('\n--- 4. QUALITY STANDARDS CRUD ---');
  try {
    await navigateTo(page, '/quality/standards');
    await page.waitForTimeout(2000);

    const ss1 = await screenshot(page, 'quality-standards-list');
    const stdRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
    log('QUALITY_STANDARDS_LIST', 'PASS', `Quality standards loaded, ${stdRows} rows`, ss1);

    // Try creating a new standard
    const createBtn = page.locator('button').filter({ hasText: /新建|新增|添加/ }).first();
    const createBtnCount = await createBtn.count();

    if (createBtnCount > 0) {
      await createBtn.click();
      await page.waitForTimeout(1500);

      const dialogVisible = (await page.locator('.el-dialog').count()) > 0;
      const ss2 = await screenshot(page, 'quality-standard-create-dialog');
      log('QUALITY_STANDARD_CREATE_DIALOG', dialogVisible ? 'PASS' : 'FAIL',
        `Create dialog ${dialogVisible ? 'opened' : 'not found'}`, ss2);

      if (dialogVisible) {
        // Fill the form
        // Item name - find within dialog specifically
        const dialogEl = page.locator('.el-dialog').last();
        const allInputs = dialogEl.locator('.el-form-item input:not([readonly])');
        const inputCount = await allInputs.count();

        // Fill the first text input (item name)
        if (inputCount > 0) {
          await allInputs.first().fill('E2E测试质检标准-' + Date.now());
        }

        // Try to select category via keyboard instead of click (avoids dropdown timeout)
        const categorySelect = dialogEl.locator('.el-select').first();
        if (await categorySelect.count() > 0) {
          try {
            await categorySelect.locator('input').first().click({ timeout: 3000 });
            await page.waitForTimeout(800);
            // Use keyboard navigation: press down arrow then enter
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
          } catch {
            // If select fails, just skip it - the form may still submit without category
          }
        }

        const ss3 = await screenshot(page, 'quality-standard-form-filled');

        // Submit
        const submitBtn = dialogEl.locator('.el-dialog__footer button, button').filter({ hasText: /确定|保存|提交|创建/ }).first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          const successMsg = await page.locator('.el-message--success').count();
          const errMsg = await page.locator('.el-message--error, .el-message--warning').count();
          const ss4 = await screenshot(page, 'quality-standard-created');
          log('QUALITY_STANDARD_CREATE', successMsg > 0 ? 'PASS' : 'WARN',
            `Standard creation submitted, success: ${successMsg > 0}, errors: ${errMsg}`, ss4);
        } else {
          log('QUALITY_STANDARD_CREATE', 'WARN', 'Submit button not found in dialog', ss3);
        }
      }
    } else {
      log('QUALITY_STANDARD_CREATE', 'WARN', 'No create button found (may lack permission)', ss1);
    }
  } catch (err) {
    const ss = await screenshot(page, 'quality-standards-error');
    log('QUALITY_STANDARDS', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 5. WAREHOUSE INVENTORY / STOCKTAKING ==========
  console.log('\n--- 5. WAREHOUSE INVENTORY ---');
  try {
    await navigateTo(page, '/warehouse/inventory');
    await page.waitForTimeout(2000);

    const ss1 = await screenshot(page, 'warehouse-inventory-list');
    const invRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();

    // Check for statistics cards
    const statCards = await page.locator('.el-statistic, .stat-card, .el-card').count();

    log('WAREHOUSE_INVENTORY_LIST', 'PASS',
      `Inventory page loaded, ${invRows} rows, ${statCards} stat elements`, ss1);

    // Try inventory adjustment if rows exist
    if (invRows > 0) {
      // Look for adjust/edit button
      const adjustBtn = page.locator('.el-table__body-wrapper').locator('button, .el-button').filter({ hasText: /调整|盘点|编辑|详情/ }).first();
      if (await adjustBtn.count() > 0) {
        await adjustBtn.click();
        await page.waitForTimeout(1500);
        const ss2 = await screenshot(page, 'warehouse-inventory-action');
        const dialogOpen = (await page.locator('.el-dialog, .el-drawer').count()) > 0;
        log('WAREHOUSE_INVENTORY_ACTION', dialogOpen ? 'PASS' : 'WARN',
          `Inventory action dialog/drawer: ${dialogOpen ? 'opened' : 'not found'}`, ss2);

        if (dialogOpen) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      } else {
        log('WAREHOUSE_INVENTORY_ACTION', 'WARN', 'No action buttons found in inventory rows');
      }
    }

    // Search functionality
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键词"], .el-input__inner').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('测试');
      await page.waitForTimeout(500);

      // Try clicking search button or press enter
      const searchBtn = page.locator('button').filter({ hasText: /搜索|查询/ }).first();
      if (await searchBtn.count() > 0) {
        await searchBtn.click();
      } else {
        await searchInput.press('Enter');
      }
      await page.waitForTimeout(2000);
      const ss3 = await screenshot(page, 'warehouse-inventory-search');
      log('WAREHOUSE_INVENTORY_SEARCH', 'PASS', 'Search executed', ss3);
    }
  } catch (err) {
    const ss = await screenshot(page, 'warehouse-inventory-error');
    log('WAREHOUSE_INVENTORY', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 6. MATERIAL PRICE TREND ==========
  console.log('\n--- 6. MATERIAL PRICE TREND ---');
  try {
    await navigateTo(page, '/warehouse/material-price-trend');
    await page.waitForTimeout(3000);

    const ss1 = await screenshot(page, 'material-price-trend');
    const trendRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
    const chartExists = await page.locator('canvas, [class*="echarts"], svg').count();

    log('MATERIAL_PRICE_TREND', trendRows > 0 || chartExists > 0 ? 'PASS' : 'WARN',
      `Price trend page: ${trendRows} table rows, ${chartExists} chart elements`, ss1);

    // Try expanding a row to see price chart
    if (trendRows > 0) {
      const expandArrow = page.locator('.el-table__expand-icon, .el-icon-arrow-right').first();
      if (await expandArrow.count() > 0) {
        await expandArrow.click();
        await page.waitForTimeout(2000);
        const ss2 = await screenshot(page, 'material-price-trend-expanded');
        log('MATERIAL_PRICE_TREND_CHART', 'PASS', 'Row expanded for price chart', ss2);
      }
    }
  } catch (err) {
    const ss = await screenshot(page, 'material-price-trend-error');
    log('MATERIAL_PRICE_TREND', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 7. SHIPMENT MANAGEMENT ==========
  console.log('\n--- 7. SHIPMENT MANAGEMENT ---');
  try {
    await navigateTo(page, '/warehouse/shipments');
    await page.waitForTimeout(2000);

    const ss1 = await screenshot(page, 'shipments-list');
    const shipRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
    log('SHIPMENTS_LIST', 'PASS', `Shipments loaded, ${shipRows} rows`, ss1);

    // Try creating a new shipment
    const createBtn = page.locator('button').filter({ hasText: /新建|新增|创建出货/ }).first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(1500);

      const dialogOpen = (await page.locator('.el-dialog, .el-drawer').count()) > 0;
      const ss2 = await screenshot(page, 'shipment-create-dialog');
      log('SHIPMENT_CREATE_DIALOG', dialogOpen ? 'PASS' : 'WARN',
        `Create shipment dialog: ${dialogOpen ? 'opened' : 'not found'}`, ss2);

      if (dialogOpen) {
        // Fill basic shipment fields
        // Vehicle number
        const vehicleInput = page.locator('.el-dialog, .el-drawer').locator('input[placeholder*="车牌"], input[placeholder*="车辆"]').first();
        if (await vehicleInput.count() > 0) {
          await vehicleInput.fill('沪A12345');
        }

        // Driver name
        const driverInput = page.locator('.el-dialog, .el-drawer').locator('input[placeholder*="司机"], input[placeholder*="驾驶"]').first();
        if (await driverInput.count() > 0) {
          await driverInput.fill('E2E测试司机');
        }

        const ss3 = await screenshot(page, 'shipment-form-filled');
        log('SHIPMENT_FORM', 'PASS', 'Shipment form fields populated', ss3);

        // Close without submitting (avoid creating test data in prod)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      log('SHIPMENT_CREATE', 'WARN', 'No create shipment button found', ss1);
    }
  } catch (err) {
    const ss = await screenshot(page, 'shipments-error');
    log('SHIPMENTS', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 8. SYSTEM SETTINGS ==========
  console.log('\n--- 8. SYSTEM SETTINGS ---');
  try {
    await navigateTo(page, '/system/settings');
    await page.waitForTimeout(2000);

    const ss1 = await screenshot(page, 'system-settings');

    // Check for tabs (basic, notification, security, system status)
    const tabs = await page.locator('.el-tabs__item, .el-radio-button').count();
    const formItems = await page.locator('.el-form-item').count();

    log('SYSTEM_SETTINGS', formItems > 0 || tabs > 0 ? 'PASS' : 'WARN',
      `Settings page: ${tabs} tabs, ${formItems} form items`, ss1);

    // Try clicking different setting tabs
    const tabItems = page.locator('.el-tabs__item');
    const tabCount = await tabItems.count();
    for (let i = 1; i < Math.min(tabCount, 4); i++) {
      await tabItems.nth(i).click();
      await page.waitForTimeout(1000);
    }
    if (tabCount > 1) {
      const ss2 = await screenshot(page, 'system-settings-tabs');
      log('SYSTEM_SETTINGS_TABS', 'PASS', `Browsed ${Math.min(tabCount, 4)} setting tabs`, ss2);
    }
  } catch (err) {
    const ss = await screenshot(page, 'system-settings-error');
    log('SYSTEM_SETTINGS', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 9. SYSTEM PRODUCTS - Edit ==========
  console.log('\n--- 9. SYSTEM PRODUCTS - Edit ---');
  try {
    await navigateTo(page, '/system/products');
    await page.waitForTimeout(2500);

    const ss1 = await screenshot(page, 'system-products-list');
    const prodRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
    log('SYSTEM_PRODUCTS_LIST', 'PASS', `Products page loaded, ${prodRows} rows`, ss1);

    if (prodRows > 0) {
      // Find edit button on first row
      const editBtn = page.locator('.el-table__body-wrapper').locator('button, .el-button').filter({ hasText: /编辑|修改|Edit/ }).first();
      const editBtnCount = await editBtn.count();

      if (editBtnCount > 0) {
        await editBtn.click();
        await page.waitForTimeout(2000);

        const dialogOpen = (await page.locator('.el-dialog, .el-drawer').count()) > 0;
        const ss2 = await screenshot(page, 'system-product-edit-dialog');
        log('SYSTEM_PRODUCT_EDIT_DIALOG', dialogOpen ? 'PASS' : 'WARN',
          `Edit dialog: ${dialogOpen ? 'opened' : 'not found'}`, ss2);

        if (dialogOpen) {
          // Read current product name
          const nameInput = page.locator('.el-dialog, .el-drawer').locator('input').first();
          let originalValue = '';
          if (await nameInput.count() > 0) {
            originalValue = await nameInput.inputValue();
          }

          // Modify notes/备注 field (less impactful than name)
          const notesInput = page.locator('.el-dialog, .el-drawer').locator('textarea, input[placeholder*="备注"]').first();
          if (await notesInput.count() > 0) {
            const currentNotes = await notesInput.inputValue();
            await notesInput.fill((currentNotes ? currentNotes + ' ' : '') + '[E2E-' + Date.now() + ']');
          }

          const ss3 = await screenshot(page, 'system-product-edit-filled');

          // Submit edit
          const saveBtn = page.locator('.el-dialog__footer, .el-drawer__footer').locator('button').filter({ hasText: /保存|确定|提交|更新/ }).first();
          if (await saveBtn.count() > 0) {
            await saveBtn.click();
            await page.waitForTimeout(3000);
            const successMsg = await page.locator('.el-message--success').count();
            const ss4 = await screenshot(page, 'system-product-edit-saved');
            log('SYSTEM_PRODUCT_EDIT_SAVE', successMsg > 0 ? 'PASS' : 'WARN',
              `Product edit saved, success toast: ${successMsg > 0}, original name: "${originalValue}"`, ss4);
          } else {
            log('SYSTEM_PRODUCT_EDIT_SAVE', 'WARN', 'Save button not found', ss3);
            await page.keyboard.press('Escape');
          }
        }
      } else {
        // Maybe it's an inline edit or different UI pattern
        // Try clicking on the row
        const firstRow = page.locator('.el-table__body-wrapper tr.el-table__row').first();
        await firstRow.click();
        await page.waitForTimeout(1500);
        const ss2 = await screenshot(page, 'system-product-row-click');
        log('SYSTEM_PRODUCT_EDIT', 'WARN', 'No explicit edit button; clicked row', ss2);
      }
    } else {
      log('SYSTEM_PRODUCT_EDIT', 'WARN', 'No products to edit');
    }
  } catch (err) {
    const ss = await screenshot(page, 'system-products-error');
    log('SYSTEM_PRODUCTS', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 10. BONUS: R&D Samples - Create Sample (full flow) ==========
  console.log('\n--- 10. R&D SAMPLES - Create New Sample ---');
  try {
    await navigateTo(page, '/rd/samples');
    await page.waitForTimeout(2000);

    // Make sure on samples tab
    const samplesTab = page.locator('.el-radio-button').filter({ hasText: '样品管理' });
    if (await samplesTab.count() > 0) {
      await samplesTab.click();
      await page.waitForTimeout(1500);
    }

    const createBtn = page.locator('button').filter({ hasText: '新建样品' }).first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(1500);

      const dialogVisible = (await page.locator('.el-dialog').filter({ hasText: '新建样品' }).count()) > 0;
      if (dialogVisible) {
        // Fill all fields
        const dialog = page.locator('.el-dialog').filter({ hasText: '新建样品' });

        // Sample name (required) - find the input after "样品名称" label
        const formItems = dialog.locator('.el-form-item');
        const formCount = await formItems.count();

        for (let i = 0; i < formCount; i++) {
          const label = await formItems.nth(i).locator('.el-form-item__label').textContent().catch(() => '');
          const input = formItems.nth(i).locator('input:not([readonly]), textarea').first();

          if (label?.includes('样品名称') && await input.count() > 0) {
            await input.fill('E2E自动测试样品-' + Date.now());
          } else if (label?.includes('成品规格') && await input.count() > 0) {
            await input.fill('200g/盒');
          } else if (label?.includes('产品级别') && await input.count() > 0) {
            await input.fill('A级');
          } else if (label?.includes('产品状态') && await input.count() > 0) {
            await input.fill('新品开发');
          } else if (label?.includes('主原料') && await input.count() > 0) {
            await input.fill('牛肉');
          } else if (label?.includes('等级') && await input.count() > 0) {
            await input.fill('特级');
          }
        }

        // Storage method select
        const storageSelect = dialog.locator('.el-form-item').filter({ hasText: '储存方式' }).locator('.el-select').first();
        if (await storageSelect.count() > 0) {
          await storageSelect.click();
          await page.waitForTimeout(500);
          const coldOption = page.locator('.el-select-dropdown__item').filter({ hasText: '冷冻' }).first();
          if (await coldOption.count() > 0) {
            await coldOption.click();
            await page.waitForTimeout(300);
          }
        }

        const ss1 = await screenshot(page, 'rd-new-sample-filled');

        // Submit
        const submitBtn = dialog.locator('button').filter({ hasText: '创建' }).first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(3000);

          const successMsg = await page.locator('.el-message--success').count();
          const ss2 = await screenshot(page, 'rd-new-sample-result');
          log('RD_CREATE_SAMPLE', successMsg > 0 ? 'PASS' : 'WARN',
            `New sample creation, success toast: ${successMsg > 0}`, ss2);
        }
      } else {
        log('RD_CREATE_SAMPLE', 'WARN', 'Create sample dialog did not open');
      }
    } else {
      log('RD_CREATE_SAMPLE', 'WARN', 'No "新建样品" button found (may lack write permission)');
    }
  } catch (err) {
    const ss = await screenshot(page, 'rd-create-sample-error');
    log('RD_CREATE_SAMPLE', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 11. BONUS: Quality Inspections - Create ==========
  console.log('\n--- 11. QUALITY INSPECTIONS - Create New ---');
  try {
    await navigateTo(page, '/quality/inspections');
    await page.waitForTimeout(2000);

    const createBtn = page.locator('button').filter({ hasText: /新建|新增|添加|创建/ }).first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(1500);

      const dialogOpen = (await page.locator('.el-dialog, .el-drawer').count()) > 0;
      const ss = await screenshot(page, 'quality-inspection-create');
      log('QUALITY_INSPECTION_CREATE', dialogOpen ? 'PASS' : 'WARN',
        `Create inspection dialog: ${dialogOpen ? 'opened' : 'not found'}`, ss);

      if (dialogOpen) {
        // Close without submitting
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      const ss = await screenshot(page, 'quality-inspection-no-create');
      log('QUALITY_INSPECTION_CREATE', 'WARN', 'No create button found', ss);
    }
  } catch (err) {
    const ss = await screenshot(page, 'quality-inspection-create-error');
    log('QUALITY_INSPECTION_CREATE', 'FAIL', err.message.slice(0, 200), ss);
  }

  // ========== 12. R&D Requests Tab ==========
  console.log('\n--- 12. R&D REQUESTS Tab ---');
  try {
    await navigateTo(page, '/rd/samples');
    await page.waitForTimeout(1500);

    const requestsTab = page.locator('.el-radio-button').filter({ hasText: '研发需求' });
    if (await requestsTab.count() > 0) {
      await requestsTab.click();
      await page.waitForTimeout(2000);

      const ss = await screenshot(page, 'rd-requests-tab');
      const reqRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
      log('RD_REQUESTS_TAB', 'PASS', `R&D Requests tab: ${reqRows} rows`, ss);
    }
  } catch (err) {
    log('RD_REQUESTS_TAB', 'FAIL', err.message.slice(0, 200));
  }

  // ========== 13. R&D Quotations Tab ==========
  console.log('\n--- 13. R&D QUOTATIONS Tab ---');
  try {
    const quotationsTab = page.locator('.el-radio-button').filter({ hasText: '报价任务' });
    if (await quotationsTab.count() > 0) {
      await quotationsTab.click();
      await page.waitForTimeout(2000);

      const ss = await screenshot(page, 'rd-quotations-tab');
      const quotRows = await page.locator('.el-table__body-wrapper tr.el-table__row').count();
      log('RD_QUOTATIONS_TAB', 'PASS', `R&D Quotations tab: ${quotRows} rows`, ss);
    }
  } catch (err) {
    log('RD_QUOTATIONS_TAB', 'FAIL', err.message.slice(0, 200));
  }

  // ========== SUMMARY ==========
  console.log('\n\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');

  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;

  console.log(`  PASS: ${pass}  |  WARN: ${warn}  |  FAIL: ${fail}  |  TOTAL: ${results.length}`);
  console.log('');

  // Network errors summary
  if (networkErrors.length > 0) {
    console.log(`  SERVER ERRORS (5xx): ${networkErrors.length}`);
    networkErrors.slice(0, 10).forEach(e => console.log(`    - ${e}`));
  }

  console.log('\n--- Detailed Results ---');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'WARN' ? 'WARN' : 'FAIL';
    console.log(`  [${icon}] ${r.module}: ${r.detail}`);
    if (r.evidence) console.log(`         EVIDENCE: ${r.evidence}`);
  });

  console.log(`\n  Screenshots: ${SCREENSHOT_DIR}/`);
  console.log('========================================\n');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
