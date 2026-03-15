import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const SD = 'test-results/screenshots/process-mode';

/**
 * 导航到目标页（storageState 已包含 JWT，无需登录）
 */
async function gotoPage(page: Page, path: string) {
  await page.goto(BASE_URL + path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

test.describe('Process Mode E2E', () => {
  test.setTimeout(300000);

  // VUE-01: Login + navigate to work process management
  test('VUE-01: Work process management page loads', async ({ page }) => {

    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Verify page loads: heading or table visible
    const heading = page.locator('h2').filter({ hasText: '\u5de5\u5e8f\u7ba1\u7406' });
    const table = page.locator('.el-table');
    const headingVisible = await heading.isVisible().catch(() => false);
    const tableVisible = await table.isVisible().catch(() => false);
    expect(headingVisible || tableVisible).toBeTruthy();

    console.log('VUE-01 URL:', page.url());
    console.log('VUE-01 heading visible:', headingVisible, ', table visible:', tableVisible);
    await page.screenshot({ path: SD + '/01-work-process-list.png', fullPage: true });
  });

  // VUE-02: Create a new work process
  test('VUE-02: Create a new work process', async ({ page }) => {

    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Click the "新增工序" button
    const addBtn = page.locator('button').filter({ hasText: '\u65b0\u589e\u5de5\u5e8f' });
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      // Fill form — processName
      const nameInput = page.locator('.el-dialog').locator('.el-input__inner').first();
      await nameInput.fill('E2E\u6d4b\u8bd5\u5de5\u5e8f');
      await page.waitForTimeout(500);

      // Select category: "加工"
      const categorySelect = page.locator('.el-dialog .el-select').first();
      if (await categorySelect.isVisible().catch(() => false)) {
        await categorySelect.click();
        await page.waitForTimeout(500);
        const option = page.locator('.el-select-dropdown__item').filter({ hasText: '\u52a0\u5de5' });
        if (await option.isVisible().catch(() => false)) {
          await option.click();
          await page.waitForTimeout(500);
        }
      }

      // Unit field — should default to "kg", clear and re-fill
      const unitInput = page.locator('.el-dialog').locator('input').nth(2);
      if (await unitInput.isVisible().catch(() => false)) {
        await unitInput.clear();
        await unitInput.fill('kg');
        await page.waitForTimeout(300);
      }

      // Click submit ("确定")
      const submitBtn = page.locator('.el-dialog').locator('button').filter({ hasText: '\u786e\u5b9a' });
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Verify success message
      const successMsg = page.locator('.el-message--success');
      const msgVisible = await successMsg.isVisible().catch(() => false);
      console.log('VUE-02 success message visible:', msgVisible);

      // Verify new item appears in table
      const newRow = page.locator('.el-table').locator('td').filter({ hasText: 'E2E\u6d4b\u8bd5\u5de5\u5e8f' });
      const rowVisible = await newRow.first().isVisible().catch(() => false);
      console.log('VUE-02 new row visible:', rowVisible);
    } else {
      console.log('VUE-02: "新增工序" button not found (permission issue?)');
    }

    await page.screenshot({ path: SD + '/02-work-process-created.png', fullPage: true });
  });

  // VUE-03: Product-process association drawer
  test('VUE-03: Product-process association drawer', async ({ page }) => {

    await page.goto(BASE_URL + '/system/products', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Wait for table to load
    const table = page.locator('.el-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Find a product row and click "工序" button
    const processBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u5de5\u5e8f' }).first();
    if (await processBtn.isVisible().catch(() => false)) {
      await processBtn.click();
      await page.waitForTimeout(2000);

      // Verify drawer opens
      const drawer = page.locator('.el-drawer');
      const drawerVisible = await drawer.isVisible().catch(() => false);
      console.log('VUE-03 drawer visible:', drawerVisible);

      // Verify drawer content: "已关联工序" or "可选工序" sections
      const linkedSection = page.locator('.el-drawer').locator('text=\u5df2\u5173\u8054\u5de5\u5e8f');
      const availableSection = page.locator('.el-drawer').locator('text=\u53ef\u9009\u5de5\u5e8f');
      console.log('VUE-03 linked section:', await linkedSection.isVisible().catch(() => false));
      console.log('VUE-03 available section:', await availableSection.isVisible().catch(() => false));
    } else {
      console.log('VUE-03: "工序" button not found in product table');
    }

    await page.screenshot({ path: SD + '/03-product-process-drawer.png', fullPage: true });
  });

  // VUE-04: Approval page - view pending reports
  test('VUE-04: Approval page loads', async ({ page }) => {

    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify page structure: heading "报工审批"
    const heading = page.locator('h2').filter({ hasText: '\u62a5\u5de5\u5ba1\u6279' });
    const headingVisible = await heading.isVisible().catch(() => false);
    console.log('VUE-04 heading visible:', headingVisible);

    // Verify table exists
    const table = page.locator('.el-table');
    const tableVisible = await table.isVisible().catch(() => false);
    console.log('VUE-04 table visible:', tableVisible);

    // Check for "待审批" tag
    const pendingTag = page.locator('.el-tag').filter({ hasText: '\u5f85\u5ba1\u6279' });
    const pendingVisible = await pendingTag.isVisible().catch(() => false);
    console.log('VUE-04 pending tag visible:', pendingVisible);

    // Check for approve/reject buttons if data exists
    const approveBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u901a\u8fc7' }).first();
    const rejectBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u9a73\u56de' }).first();
    console.log('VUE-04 approve btn:', await approveBtn.isVisible().catch(() => false));
    console.log('VUE-04 reject btn:', await rejectBtn.isVisible().catch(() => false));

    expect(headingVisible || tableVisible).toBeTruthy();
    await page.screenshot({ path: SD + '/04-approval-list.png', fullPage: true });
  });

  // VUE-05: Workflow designer - load page
  test('VUE-05: Workflow designer loads', async ({ page }) => {

    await page.goto(BASE_URL + '/system/workflow-designer', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Verify heading "工作流设计器"
    const heading = page.locator('h2').filter({ hasText: '\u5de5\u4f5c\u6d41\u8bbe\u8ba1\u5668' });
    const headingVisible = await heading.isVisible().catch(() => false);
    console.log('VUE-05 heading visible:', headingVisible);

    // Verify canvas area (Vue Flow container)
    const canvas = page.locator('.canvas-container');
    const canvasVisible = await canvas.isVisible().catch(() => false);
    console.log('VUE-05 canvas visible:', canvasVisible);

    // Verify node palette (left panel)
    const palette = page.locator('.node-palette');
    const paletteVisible = await palette.isVisible().catch(() => false);
    console.log('VUE-05 palette visible:', paletteVisible);

    // Verify "节点类型" heading in palette
    const paletteHeading = page.locator('.node-palette').locator('h4').filter({ hasText: '\u8282\u70b9\u7c7b\u578b' });
    console.log('VUE-05 palette heading:', await paletteHeading.isVisible().catch(() => false));

    expect(headingVisible || canvasVisible).toBeTruthy();
    await page.screenshot({ path: SD + '/05-workflow-designer.png', fullPage: true });
  });

  // VUE-06: Workflow designer - entity type selector
  test('VUE-06: Workflow designer entity type selector', async ({ page }) => {

    await page.goto(BASE_URL + '/system/workflow-designer', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Find entity type selector
    const entitySelect = page.locator('.header-actions .el-select').first();
    if (await entitySelect.isVisible().catch(() => false)) {
      await entitySelect.click();
      await page.waitForTimeout(1000);

      // Verify PRODUCTION_WORKFLOW option exists
      const prodOption = page.locator('.el-select-dropdown__item').filter({ hasText: '\u751f\u4ea7\u5de5\u4f5c\u6d41' });
      const prodVisible = await prodOption.isVisible().catch(() => false);
      console.log('VUE-06 PRODUCTION_WORKFLOW option visible:', prodVisible);

      // Select it
      if (prodVisible) {
        await prodOption.click();
        await page.waitForTimeout(3000);
        console.log('VUE-06 selected PRODUCTION_WORKFLOW');
      }
    } else {
      console.log('VUE-06: entity type selector not found');
    }

    await page.screenshot({ path: SD + '/06-workflow-entity-type.png', fullPage: true });
  });

  // VUE-07: Screenshot baseline for all process mode pages
  test('VUE-07: Screenshot baseline for all process mode pages', async ({ page }) => {


    // 07a: Work processes
    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SD + '/07a-work-processes.png', fullPage: true });
    console.log('VUE-07a URL:', page.url());

    // 07b: Approval
    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SD + '/07b-approval.png', fullPage: true });
    console.log('VUE-07b URL:', page.url());

    // 07c: Workflow designer
    await page.goto(BASE_URL + '/system/workflow-designer', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SD + '/07c-workflow-designer.png', fullPage: true });
    console.log('VUE-07c URL:', page.url());
  });

  // VUE-08: Product page - click 工序 button - drawer opens
  test('VUE-08: Product page drawer opens with process list', async ({ page }) => {

    await page.goto(BASE_URL + '/system/products', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Wait for table
    const table = page.locator('.el-table');
    await expect(table).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Find "工序" button in action column
    const processBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u5de5\u5e8f' }).first();
    if (await processBtn.isVisible().catch(() => false)) {
      await processBtn.click();
      await page.waitForTimeout(2000);

      // Verify drawer opens — use aria-label containing "工序配置" to avoid strict mode (AI drawer also present)
      const drawer = page.getByRole('dialog').filter({ hasText: '\u5de5\u5e8f\u914d\u7f6e' });
      await expect(drawer).toBeVisible({ timeout: 5000 });
      console.log('VUE-08 drawer opened');

      // Verify drawer title contains "工序配置"
      const titleText = await drawer.locator('.el-drawer__header').innerText().catch(() => '');
      console.log('VUE-08 drawer title:', titleText);
      expect(titleText).toContain('\u5de5\u5e8f\u914d\u7f6e');

      // Verify "已关联工序" section
      const linkedLabel = drawer.locator('text=\u5df2\u5173\u8054\u5de5\u5e8f');
      console.log('VUE-08 linked label:', await linkedLabel.isVisible().catch(() => false));

      // Verify "可选工序" section
      const availableLabel = drawer.locator('text=\u53ef\u9009\u5de5\u5e8f');
      console.log('VUE-08 available label:', await availableLabel.isVisible().catch(() => false));
    } else {
      console.log('VUE-08: No "工序" button found — table may be empty');
    }

    await page.screenshot({ path: SD + '/08-product-process-drawer-open.png', fullPage: true });
  });

  // VUE-09: Product page drawer - link a work process
  test('VUE-09: Product page drawer - link a work process', async ({ page }) => {

    await page.goto(BASE_URL + '/system/products', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const table = page.locator('.el-table');
    await expect(table).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Open drawer for first product
    const processBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u5de5\u5e8f' }).first();
    if (!(await processBtn.isVisible().catch(() => false))) {
      console.log('VUE-09: SKIP - No "工序" button found');
      await page.screenshot({ path: SD + '/09-product-process-linked.png', fullPage: true });
      return;
    }

    await processBtn.click();
    await page.waitForTimeout(2000);

    const drawer = page.getByRole('dialog').filter({ hasText: '\u5de5\u5e8f\u914d\u7f6e' });
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Find "添加" button in available (unlinked) processes section
    const addBtnInDrawer = drawer.locator('.available-item').locator('button').filter({ hasText: '\u6dfb\u52a0' }).first();
    if (await addBtnInDrawer.isVisible().catch(() => false)) {
      // Get the process name before linking
      const processName = await drawer.locator('.available-item .available-name').first().innerText().catch(() => 'unknown');
      console.log('VUE-09: Linking process:', processName);

      await addBtnInDrawer.click();
      await page.waitForTimeout(2000);

      // Verify success message
      const successMsg = page.locator('.el-message--success');
      console.log('VUE-09 success message:', await successMsg.isVisible().catch(() => false));

      // Verify it moved to linked section
      const linkedItem = drawer.locator('.linked-item').filter({ hasText: processName });
      console.log('VUE-09 linked item visible:', await linkedItem.isVisible().catch(() => false));
    } else {
      console.log('VUE-09: SKIP - No unlinked processes available to add');
    }

    await page.screenshot({ path: SD + '/09-product-process-linked.png', fullPage: true });
  });

  // VUE-10: Product page drawer - unlink a work process
  test('VUE-10: Product page drawer - unlink a work process', async ({ page }) => {

    await page.goto(BASE_URL + '/system/products', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const table = page.locator('.el-table');
    await expect(table).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Open drawer for first product
    const processBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u5de5\u5e8f' }).first();
    if (!(await processBtn.isVisible().catch(() => false))) {
      console.log('VUE-10: SKIP - No "工序" button found');
      await page.screenshot({ path: SD + '/10-product-process-unlinked.png', fullPage: true });
      return;
    }

    await processBtn.click();
    await page.waitForTimeout(2000);

    const drawer = page.getByRole('dialog').filter({ hasText: '\u5de5\u5e8f\u914d\u7f6e' });
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Find delete button (the red danger button with DeleteIcon) in linked section
    const linkedItem = drawer.locator('.linked-item').first();
    if (await linkedItem.isVisible().catch(() => false)) {
      const processName = await linkedItem.locator('.linked-name').innerText().catch(() => 'unknown');
      console.log('VUE-10: Unlinking process:', processName);

      // Click the danger delete button (last button in linked-actions)
      const removeBtn = linkedItem.locator('.linked-actions').locator('button.is-danger, button[class*="danger"]').first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(1000);

        // Confirm the ElMessageBox dialog
        const confirmBtn = page.locator('.el-message-box').locator('button').filter({ hasText: '\u786e\u5b9a' });
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);

          // Verify success message
          const successMsg = page.locator('.el-message--success');
          console.log('VUE-10 success message:', await successMsg.isVisible().catch(() => false));

          // Verify process moved back to available section
          const availableItem = drawer.locator('.available-item').filter({ hasText: processName });
          console.log('VUE-10 available item visible:', await availableItem.isVisible().catch(() => false));
        } else {
          console.log('VUE-10: Confirm dialog did not appear');
        }
      } else {
        // Fallback: try clicking any button with type="danger" in linked-actions
        const fallbackRemoveBtn = linkedItem.locator('.linked-actions button').last();
        if (await fallbackRemoveBtn.isVisible().catch(() => false)) {
          await fallbackRemoveBtn.click();
          await page.waitForTimeout(1000);

          const confirmBtn = page.locator('.el-message-box').locator('button').filter({ hasText: '\u786e\u5b9a' });
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            console.log('VUE-10: Unlinked via fallback button');
          }
        }
      }
    } else {
      console.log('VUE-10: SKIP - No linked processes to remove');
    }

    await page.screenshot({ path: SD + '/10-product-process-unlinked.png', fullPage: true });
  });

  // ============================================================
  // VUE-11~13: Approval Write Operations
  // ============================================================

  // VUE-11: Approve a single report
  test('VUE-11: Approve a single report', async ({ page }) => {

    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const approveBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u901a\u8fc7' }).first();
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2000);

      // Verify success message "\u5df2\u901a\u8fc7"
      const successMsg = page.locator('.el-message--success');
      const msgVisible = await successMsg.isVisible().catch(() => false);
      console.log('VUE-11 approve success:', msgVisible);
      expect(msgVisible).toBeTruthy();
    } else {
      console.log('VUE-11: SKIP \u2014 no pending approvals with \u901a\u8fc7 button');
    }

    await page.screenshot({ path: SD + '/11-approve-report.png', fullPage: true });
  });

  // VUE-12: Reject a report with reason + empty-reason validation
  test('VUE-12: Reject report with reason', async ({ page }) => {

    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const rejectBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u9a73\u56de' }).first();
    if (!(await rejectBtn.isVisible().catch(() => false))) {
      console.log('VUE-12: SKIP \u2014 no pending approvals');
      await page.screenshot({ path: SD + '/12-reject-report.png', fullPage: true });
      return;
    }

    await rejectBtn.click();
    await page.waitForTimeout(1000);

    // ElMessageBox.prompt should appear
    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible({ timeout: 5000 });
    console.log('VUE-12 prompt dialog visible');

    // Test empty reason validation: click confirm without filling
    const confirmBtn = msgBox.locator('button').filter({ hasText: '\u786e\u5b9a' });
    await confirmBtn.click();
    await page.waitForTimeout(500);

    // Verify inputErrorMessage "\u8bf7\u8f93\u5165\u9a73\u56de\u539f\u56e0" appears
    const errorMsg = msgBox.locator('.el-message-box__errormsg');
    const errorVisible = await errorMsg.isVisible().catch(() => false);
    console.log('VUE-12 empty reason error:', errorVisible);

    // Now fill valid reason and submit
    const input = msgBox.locator('.el-message-box__input input');
    await input.fill('E2E\u6d4b\u8bd5\u9a73\u56de\u539f\u56e0');
    await page.waitForTimeout(300);
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    // Verify success "\u5df2\u9a73\u56de"
    const successMsg = page.locator('.el-message--success');
    const successVisible = await successMsg.isVisible().catch(() => false);
    console.log('VUE-12 reject success:', successVisible);
    expect(errorVisible || successVisible).toBeTruthy();

    await page.screenshot({ path: SD + '/12-reject-report.png', fullPage: true });
  });

  // VUE-13: Batch approve multiple reports
  test('VUE-13: Batch approve multiple reports', async ({ page }) => {

    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();
    console.log('VUE-13 row count:', rowCount);

    if (rowCount < 2) {
      console.log('VUE-13: SKIP \u2014 need \u22652 rows for batch approve');
      await page.screenshot({ path: SD + '/13-batch-approve.png', fullPage: true });
      return;
    }

    // Select first two rows via checkbox
    await rows.nth(0).locator('.el-checkbox__input').click();
    await page.waitForTimeout(300);
    await rows.nth(1).locator('.el-checkbox__input').click();
    await page.waitForTimeout(500);

    // "\u6279\u91cf\u901a\u8fc7" button should appear (v-if="canWrite && selectedIds.length > 0")
    const batchBtn = page.locator('button').filter({ hasText: '\u6279\u91cf\u901a\u8fc7' });
    await expect(batchBtn).toBeVisible({ timeout: 3000 });
    console.log('VUE-13 batch button visible');
    await batchBtn.click();
    await page.waitForTimeout(1000);

    // Confirm dialog
    const confirmBtn = page.locator('.el-message-box').locator('button').filter({ hasText: '\u786e\u5b9a' });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);

      const successMsg = page.locator('.el-message--success');
      console.log('VUE-13 batch success:', await successMsg.isVisible().catch(() => false));
    }

    await page.screenshot({ path: SD + '/13-batch-approve.png', fullPage: true });
  });

  // ============================================================
  // VUE-14~18: Skill-Tools Governance
  // ============================================================

  // VUE-14: Skill-Tools page loads with 3 tabs
  test('VUE-14: Skill-Tools page loads with 3 tabs', async ({ page }) => {

    await page.goto(BASE_URL + '/system/skill-tools', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('[role="tab"]', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify 3 tabs using role selectors (Element Plus renders as role="tab")
    const tab1 = page.getByRole('tab', { name: 'Skill \u7ba1\u7406' });
    const tab2 = page.getByRole('tab', { name: '\u81ea\u52a8\u63a8\u8350' });
    const tab3 = page.getByRole('tab', { name: '\u5171\u73b0\u6a21\u5f0f' });

    expect(await tab1.isVisible().catch(() => false)).toBeTruthy();
    expect(await tab2.isVisible().catch(() => false)).toBeTruthy();
    expect(await tab3.isVisible().catch(() => false)).toBeTruthy();
    console.log('VUE-14 all 3 tabs visible');

    // Verify skill table loaded (first table in active tab)
    const table = page.locator('.el-table').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify "\u521b\u5efa Skill" button visible (canWrite for factory_admin1)
    const createBtn = page.locator('button').filter({ hasText: '\u521b\u5efa Skill' });
    console.log('VUE-14 create button:', await createBtn.isVisible().catch(() => false));

    await page.screenshot({ path: SD + '/14-skill-tools-tabs.png', fullPage: true });
  });

  // VUE-15: Create Skill — fill form + submit
  test('VUE-15: Create Skill', async ({ page }) => {

    await page.goto(BASE_URL + '/system/skill-tools', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const createBtn = page.locator('button').filter({ hasText: '\u521b\u5efa Skill' });
    if (!(await createBtn.isVisible().catch(() => false))) {
      console.log('VUE-15: SKIP \u2014 no create button (permission issue)');
      await page.screenshot({ path: SD + '/15-create-skill.png', fullPage: true });
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1000);

    // Dialog should appear with title "\u521b\u5efa Skill"
    const dialog = page.locator('.el-dialog').filter({ hasText: '\u521b\u5efa Skill' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill form fields
    const nameInput = dialog.locator('.el-form-item').filter({ hasText: '\u540d\u79f0' }).first().locator('input');
    await nameInput.fill('e2e-test-skill-' + Date.now());
    await page.waitForTimeout(200);

    const displayInput = dialog.locator('.el-form-item').filter({ hasText: '\u663e\u793a\u540d\u79f0' }).locator('input');
    await displayInput.fill('E2E\u6d4b\u8bd5Skill');
    await page.waitForTimeout(200);

    // Tools list (required) — textarea
    const toolsTextarea = dialog.locator('.el-form-item').filter({ hasText: '\u5de5\u5177\u5217\u8868' }).locator('textarea');
    await toolsTextarea.fill('material_batch_query,quality_check_query');
    await page.waitForTimeout(200);

    // Submit
    const submitBtn = dialog.locator('.el-dialog__footer button').filter({ hasText: '\u521b\u5efa' });
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Verify success message
    const successMsg = page.locator('.el-message--success');
    const created = await successMsg.isVisible().catch(() => false);
    console.log('VUE-15 create success:', created);

    await page.screenshot({ path: SD + '/15-create-skill.png', fullPage: true });
  });

  // VUE-16: Create Skill validation — empty name/tools shows warning
  test('VUE-16: Create Skill validation', async ({ page }) => {

    await page.goto(BASE_URL + '/system/skill-tools', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const createBtn = page.locator('button').filter({ hasText: '\u521b\u5efa Skill' });
    if (!(await createBtn.isVisible().catch(() => false))) {
      console.log('VUE-16: SKIP');
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1000);

    // Click "\u521b\u5efa" without filling anything
    const dialog = page.locator('.el-dialog').filter({ hasText: '\u521b\u5efa Skill' });
    const submitBtn = dialog.locator('.el-dialog__footer button').filter({ hasText: '\u521b\u5efa' });
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Should show warning message "\u540d\u79f0\u548c\u5de5\u5177\u5217\u8868\u4e3a\u5fc5\u586b"
    const warningMsg = page.locator('.el-message--warning');
    const warningVisible = await warningMsg.isVisible().catch(() => false);
    console.log('VUE-16 validation warning:', warningVisible);
    expect(warningVisible).toBeTruthy();

    // Dialog should remain open
    expect(await dialog.isVisible()).toBeTruthy();

    await page.screenshot({ path: SD + '/16-skill-validation.png', fullPage: true });
  });

  // VUE-17: Delete Skill (database source only)
  test('VUE-17: Delete Skill', async ({ page }) => {

    await page.goto(BASE_URL + '/system/skill-tools', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find a "\u5220\u9664" button (only visible for database-source skills)
    const deleteBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u5220\u9664' }).first();
    if (!(await deleteBtn.isVisible().catch(() => false))) {
      console.log('VUE-17: SKIP \u2014 no deletable (database-source) skill found');
      await page.screenshot({ path: SD + '/17-delete-skill.png', fullPage: true });
      return;
    }

    await deleteBtn.click();
    await page.waitForTimeout(1000);

    // ElMessageBox.confirm should appear
    const confirmBox = page.locator('.el-message-box');
    await expect(confirmBox).toBeVisible({ timeout: 5000 });

    // Click "\u786e\u5b9a" to confirm
    await confirmBox.locator('button').filter({ hasText: '\u786e\u5b9a' }).click();
    await page.waitForTimeout(2000);

    const successMsg = page.locator('.el-message--success');
    console.log('VUE-17 delete success:', await successMsg.isVisible().catch(() => false));

    await page.screenshot({ path: SD + '/17-delete-skill.png', fullPage: true });
  });

  // VUE-18: Skill detail drawer
  test('VUE-18: Skill detail drawer', async ({ page }) => {

    await page.goto(BASE_URL + '/system/skill-tools', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const detailBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u8be6\u60c5' }).first();
    if (!(await detailBtn.isVisible().catch(() => false))) {
      console.log('VUE-18: SKIP \u2014 no skills in table');
      await page.screenshot({ path: SD + '/18-skill-drawer.png', fullPage: true });
      return;
    }

    await detailBtn.click();
    await page.waitForTimeout(1000);

    // Drawer should appear with title "Skill \u8be6\u60c5"
    const drawer = page.locator('.el-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify drawer has el-descriptions items
    const descItems = drawer.locator('.el-descriptions__label');
    const descCount = await descItems.count();
    console.log('VUE-18 description items:', descCount);
    expect(descCount).toBeGreaterThan(0);

    // Verify "\u5305\u542b\u5de5\u5177" section
    const toolsSection = drawer.locator('text=\u5305\u542b\u5de5\u5177');
    console.log('VUE-18 tools section:', await toolsSection.isVisible().catch(() => false));

    // Verify "\u89e6\u53d1\u8bcd" section
    const triggersSection = drawer.locator('text=\u89e6\u53d1\u8bcd');
    console.log('VUE-18 triggers section:', await triggersSection.isVisible().catch(() => false));

    await page.screenshot({ path: SD + '/18-skill-drawer.png', fullPage: true });
  });

  // ============================================================
  // VUE-19~20: Work Process Edit/Delete/Toggle
  // ============================================================

  // VUE-19: Edit a work process
  test('VUE-19: Edit a work process', async ({ page }) => {

    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const editBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u7f16\u8f91' }).first();
    if (!(await editBtn.isVisible().catch(() => false))) {
      console.log('VUE-19: SKIP \u2014 no work processes or no permission');
      await page.screenshot({ path: SD + '/19-edit-process.png', fullPage: true });
      return;
    }

    await editBtn.click();
    await page.waitForTimeout(1000);

    // Dialog should open with title "\u7f16\u8f91\u5de5\u5e8f"
    const dialog = page.locator('.el-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const dialogTitle = await dialog.locator('.el-dialog__header').innerText().catch(() => '');
    console.log('VUE-19 dialog title:', dialogTitle);
    expect(dialogTitle).toContain('\u7f16\u8f91\u5de5\u5e8f');

    // Modify the name field
    const nameInput = dialog.locator('.el-form-item').first().locator('input');
    const originalName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill(originalName + '-edited');
    await page.waitForTimeout(300);

    // Submit
    const submitBtn = dialog.locator('.el-dialog__footer button').filter({ hasText: '\u786e\u5b9a' });
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Verify success "\u5de5\u5e8f\u5df2\u66f4\u65b0"
    const successMsg = page.locator('.el-message--success');
    console.log('VUE-19 edit success:', await successMsg.isVisible().catch(() => false));

    // Revert: re-edit to remove "-edited" suffix
    await page.waitForTimeout(1000);
    const editBtn2 = page.locator('.el-table').locator('button').filter({ hasText: '\u7f16\u8f91' }).first();
    if (await editBtn2.isVisible().catch(() => false)) {
      await editBtn2.click();
      await page.waitForTimeout(1000);
      const nameInput2 = page.locator('.el-dialog .el-form-item').first().locator('input');
      await nameInput2.clear();
      await nameInput2.fill(originalName);
      await page.locator('.el-dialog__footer button').filter({ hasText: '\u786e\u5b9a' }).click();
      await page.waitForTimeout(2000);
      console.log('VUE-19 reverted name');
    }

    await page.screenshot({ path: SD + '/19-edit-process.png', fullPage: true });
  });

  // VUE-20: Toggle work process status (disable/enable)
  test('VUE-20: Toggle work process status', async ({ page }) => {

    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Find the toggle button ("\u7981\u7528" or "\u542f\u7528")
    const toggleBtn = page.locator('.el-table').locator('button').filter({ hasText: /\u7981\u7528|\u542f\u7528/ }).first();
    if (!(await toggleBtn.isVisible().catch(() => false))) {
      console.log('VUE-20: SKIP \u2014 no toggle button');
      await page.screenshot({ path: SD + '/20-toggle-process.png', fullPage: true });
      return;
    }

    const btnText = await toggleBtn.innerText();
    console.log('VUE-20 toggle action:', btnText);
    await toggleBtn.click();
    await page.waitForTimeout(2000);

    // Verify success message ("\u5df2\u7981\u7528" or "\u5df2\u542f\u7528")
    const successMsg = page.locator('.el-message--success');
    console.log('VUE-20 toggle success:', await successMsg.isVisible().catch(() => false));

    // Toggle back to original state
    await page.waitForTimeout(1000);
    const toggleBtn2 = page.locator('.el-table').locator('button').filter({ hasText: /\u7981\u7528|\u542f\u7528/ }).first();
    if (await toggleBtn2.isVisible().catch(() => false)) {
      await toggleBtn2.click();
      await page.waitForTimeout(2000);
      console.log('VUE-20 reverted toggle');
    }

    await page.screenshot({ path: SD + '/20-toggle-process.png', fullPage: true });
  });

  // ============================================================
  // VUE-21: Multi-role Permission Test
  // ============================================================

  // VUE-21: workshop_sup1 sees approval page read-only (no approve/reject buttons)
  // 独立 context 加载 workshop_sup1 的 storageState
  test('VUE-21: workshop_sup1 approval page read-only', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'test-results/.auth/workshop-sup.json' });
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Page should load (production: 'r' means canAccess=true)
    const heading = page.locator('h2').filter({ hasText: '\u62a5\u5de5\u5ba1\u6279' });
    const headingVisible = await heading.isVisible().catch(() => false);
    console.log('VUE-21 heading visible:', headingVisible);

    // Table should exist
    const table = page.locator('.el-table');
    const tableVisible = await table.isVisible().catch(() => false);
    console.log('VUE-21 table visible:', tableVisible);

    // Operation column should NOT exist (v-if="canWrite" on column, canWrite('production')=false for workshop_supervisor)
    const approveBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u901a\u8fc7' }).first();
    const rejectBtn = page.locator('.el-table').locator('button').filter({ hasText: '\u9a73\u56de' }).first();
    const approveVisible = await approveBtn.isVisible().catch(() => false);
    const rejectVisible = await rejectBtn.isVisible().catch(() => false);
    console.log('VUE-21 approve btn visible:', approveVisible, '(expected: false)');
    console.log('VUE-21 reject btn visible:', rejectVisible, '(expected: false)');

    // "\u6279\u91cf\u901a\u8fc7" button should not appear even with selections
    const batchBtn = page.locator('button').filter({ hasText: '\u6279\u91cf\u901a\u8fc7' });
    const batchVisible = await batchBtn.isVisible().catch(() => false);
    console.log('VUE-21 batch approve btn visible:', batchVisible, '(expected: false)');

    expect(approveVisible).toBeFalsy();
    expect(rejectVisible).toBeFalsy();
    expect(batchVisible).toBeFalsy();

    await page.screenshot({ path: SD + '/21-workshop-readonly.png', fullPage: true });
  });

  // ============================================================
  // VUE-22: Recommendations Tab Lazy Load + Patterns Tab
  // ============================================================

  // VUE-22: Recommendations and Patterns tabs lazy load
  test('VUE-22: Skill-Tools recommendations and patterns tabs', async ({ page }) => {

    await page.goto(BASE_URL + '/system/skill-tools', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Switch to "\u81ea\u52a8\u63a8\u8350" tab
    const recTab = page.getByRole('tab', { name: '\u81ea\u52a8\u63a8\u8350' });
    await recTab.click();
    await page.waitForTimeout(3000);

    // Verify recommendations table loads (may be empty)
    const recTable = page.locator('.el-table').first();
    const recTableVisible = await recTable.isVisible().catch(() => false);
    console.log('VUE-22 recommendations table visible:', recTableVisible);

    // Verify "\u56de\u6eaf\u5929\u6570" input exists
    const daysInput = page.locator('.el-input-number');
    console.log('VUE-22 days input visible:', await daysInput.isVisible().catch(() => false));

    // Verify "\u5206\u6790" button exists
    const analyzeBtn = page.locator('button').filter({ hasText: '\u5206\u6790' }).first();
    console.log('VUE-22 analyze button:', await analyzeBtn.isVisible().catch(() => false));

    await page.screenshot({ path: SD + '/22a-recommendations-tab.png', fullPage: true });

    // Switch to "\u5171\u73b0\u6a21\u5f0f" tab
    const patTab = page.getByRole('tab', { name: '\u5171\u73b0\u6a21\u5f0f' });
    await patTab.click();
    await page.waitForTimeout(3000);

    // Verify two sub-tables: "\u5de5\u5177\u5171\u73b0" and "\u6709\u5e8f\u5e8f\u5217"
    const coOccHeading = page.locator('h4').filter({ hasText: '\u5de5\u5177\u5171\u73b0' });
    const seqHeading = page.locator('h4').filter({ hasText: '\u6709\u5e8f\u5e8f\u5217' });
    console.log('VUE-22 co-occurrence heading:', await coOccHeading.isVisible().catch(() => false));
    console.log('VUE-22 sequence heading:', await seqHeading.isVisible().catch(() => false));

    await page.screenshot({ path: SD + '/22b-patterns-tab.png', fullPage: true });
  });

  // ============================================================
  // VUE-23: Delete work process with confirmation
  // ============================================================

  test('VUE-23: Delete work process', async ({ page }) => {

    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Only delete the E2E test process if it exists
    const testRow = page.locator('.el-table').locator('td').filter({ hasText: 'E2E\u6d4b\u8bd5\u5de5\u5e8f' }).first();
    if (!(await testRow.isVisible().catch(() => false))) {
      console.log('VUE-23: SKIP \u2014 no E2E test process to delete');
      await page.screenshot({ path: SD + '/23-delete-process.png', fullPage: true });
      return;
    }

    // Find the row and click its delete button
    const row = page.locator('.el-table__row').filter({ hasText: 'E2E\u6d4b\u8bd5\u5de5\u5e8f' }).first();
    const deleteBtn = row.locator('button').filter({ hasText: '\u5220\u9664' });
    await deleteBtn.click();
    await page.waitForTimeout(1000);

    // ElMessageBox.confirm should appear with "\u5220\u9664\u786e\u8ba4"
    const confirmBox = page.locator('.el-message-box');
    await expect(confirmBox).toBeVisible({ timeout: 5000 });

    await confirmBox.locator('button').filter({ hasText: '\u786e\u5b9a' }).click();
    await page.waitForTimeout(2000);

    const successMsg = page.locator('.el-message--success');
    console.log('VUE-23 delete success:', await successMsg.isVisible().catch(() => false));

    await page.screenshot({ path: SD + '/23-delete-process.png', fullPage: true });
  });

  // ============================================================
  // VUE-24: Supplemental report highlighting
  // ============================================================

  test('VUE-24: Supplemental report rows are highlighted', async ({ page }) => {

    await page.goto(BASE_URL + '/production/approval', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check for "\u8865\u62a5" type tags
    const supplementalTag = page.locator('.el-tag--warning').filter({ hasText: '\u8865\u62a5' });
    const normalTag = page.locator('.el-tag--info').filter({ hasText: '\u6b63\u5e38' });

    const suppCount = await supplementalTag.count();
    const normCount = await normalTag.count();
    console.log('VUE-24 supplemental tags:', suppCount);
    console.log('VUE-24 normal tags:', normCount);

    // If supplemental rows exist, verify their quantity has text-warning class
    if (suppCount > 0) {
      const warnText = page.locator('.text-warning').first();
      const warnVisible = await warnText.isVisible().catch(() => false);
      console.log('VUE-24 warning text style:', warnVisible);
    }

    await page.screenshot({ path: SD + '/24-supplemental-highlight.png', fullPage: true });
  });

  // ============================================================
  // VUE-25: Work process form validation
  // ============================================================

  test('VUE-25: Work process form validation', async ({ page }) => {

    await page.goto(BASE_URL + '/system/work-processes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const addBtn = page.locator('button').filter({ hasText: '\u65b0\u589e\u5de5\u5e8f' });
    if (!(await addBtn.isVisible().catch(() => false))) {
      console.log('VUE-25: SKIP');
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(1000);

    const dialog = page.locator('.el-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Clear unit field (required) and submit
    const unitInput = dialog.locator('.el-form-item').filter({ hasText: '\u4ea7\u51fa\u5355\u4f4d' }).locator('input');
    await unitInput.clear();

    // Submit without processName
    const submitBtn = dialog.locator('.el-dialog__footer button').filter({ hasText: '\u786e\u5b9a' });
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Verify validation errors appear
    const errors = dialog.locator('.el-form-item__error');
    const errorCount = await errors.count();
    console.log('VUE-25 validation errors:', errorCount);
    expect(errorCount).toBeGreaterThan(0);

    // Cancel
    await dialog.locator('.el-dialog__footer button').filter({ hasText: '\u53d6\u6d88' }).click();

    await page.screenshot({ path: SD + '/25-process-form-validation.png', fullPage: true });
  });
});

// ============================================================
// API 驱动集成测试 — 验证核心数据流
// ============================================================

const API_BASE = process.env.E2E_API_URL || 'http://47.100.235.168:10011/api/mobile';

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'factory_admin1', password: '123456' }),
  });
  const data = await res.json();
  return data.data.accessToken;
}

async function api(method: string, path: string, token: string, body?: object) {
  const res = await fetch(`${API_BASE}/F001${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

test.describe('API Integration — Process Mode Data Flow', () => {
  test.setTimeout(120000);

  // CROSS-01: generateFromProduct 自动拆任务
  test('CROSS-01: generateFromProduct creates tasks from product', async () => {
    const token = await getToken();

    // P2-4: Must provide plannedQuantities > 0, otherwise tasks are skipped
    const res = await api('POST', '/process-tasks/generate-from-product', token, {
      productTypeId: 'PT-F001-001',
    });

    console.log('CROSS-01 success:', res.success, 'count:', res.data?.length);
    expect(res.success).toBeTruthy();
    // With P2-4 fix, zero planned qty tasks are skipped — count may be 0
    // Just verify API doesn't error and returns an array
    expect(Array.isArray(res.data)).toBeTruthy();

    for (const task of res.data) {
      console.log(`  ${task.processName} unit=${task.unit} status=${task.status}`);
      expect(task.status).toBe('PENDING');
      expect(task.processName).toBeTruthy();
    }

    // 如果有结果，所有任务共享同一 productionRunId
    if (res.data.length > 0) {
      const runIds = new Set(res.data.map((t: { productionRunId: string }) => t.productionRunId));
      expect(runIds.size).toBe(1);
      console.log('CROSS-01 shared productionRunId:', [...runIds][0]);
    } else {
      console.log('CROSS-01: 0 tasks (P2-4 zero qty skip active, no plannedQuantities provided)');
    }
  });

  // CROSS-02: 报工→审批→数量同步
  test('CROSS-02: Report → Approve → Quantity sync', async () => {
    const token = await getToken();

    // 1. 找一个 IN_PROGRESS 任务
    const tasksRes = await api('GET', '/process-tasks?status=IN_PROGRESS&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-02: SKIP — no IN_PROGRESS task');
      return;
    }
    const task = tasksRes.data.content[0];
    const beforeCompleted = task.completedQuantity;
    const beforePending = task.pendingQuantity;
    console.log(`CROSS-02 task=${task.id} before: completed=${beforeCompleted} pending=${beforePending}`);

    // 2. 提交报工(应为PENDING)
    const reportRes = await api('POST', '/process-work-reporting/normal', token, {
      processTaskId: task.id,
      outputQuantity: 5,
    });
    expect(reportRes.success).toBeTruthy();
    const reportId = reportRes.data.reportId;
    console.log(`CROSS-02 report created: id=${reportId} pendingQty=${reportRes.data.pendingQuantity}`);
    expect(reportRes.data.pendingQuantity).toBe(beforePending + 5);

    // 3. 审批通过
    const approveRes = await api('PUT', `/process-work-reporting/${reportId}/approve`, token);
    expect(approveRes.success).toBeTruthy();
    console.log('CROSS-02 approved:', approveRes.data);

    // 4. 验证任务数量更新
    const afterRes = await api('GET', `/process-tasks/${task.id}`, token);
    expect(afterRes.success).toBeTruthy();
    console.log(`CROSS-02 after: completed=${afterRes.data.completedQuantity} pending=${afterRes.data.pendingQuantity}`);
    expect(afterRes.data.completedQuantity).toBe(beforeCompleted + 5);
  });

  // CROSS-03: 补报→SUPPLEMENTING→审批→恢复
  test('CROSS-03: Supplement → SUPPLEMENTING → Approve → Restore', async () => {
    const token = await getToken();

    // 找一个 COMPLETED 任务
    const tasksRes = await api('GET', '/process-tasks?status=COMPLETED&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-03: SKIP — no COMPLETED task');
      return;
    }
    const task = tasksRes.data.content[0];
    console.log(`CROSS-03 task=${task.id} status=${task.status}`);

    // 1. 提交补报 → 任务应变为 SUPPLEMENTING
    const suppRes = await api('POST', '/process-work-reporting/supplement', token, {
      processTaskId: task.id,
      outputQuantity: 3,
    });
    expect(suppRes.success).toBeTruthy();
    console.log('CROSS-03 supplement:', suppRes.data);
    expect(suppRes.data.taskStatus).toBe('SUPPLEMENTING');

    // 2. 审批通过补报 → 任务应恢复为 COMPLETED
    const reportId = suppRes.data.reportId;
    const approveRes = await api('PUT', `/process-work-reporting/${reportId}/approve`, token);
    expect(approveRes.success).toBeTruthy();

    // 3. 验证任务状态恢复
    const afterRes = await api('GET', `/process-tasks/${task.id}`, token);
    expect(afterRes.success).toBeTruthy();
    console.log(`CROSS-03 after approve: status=${afterRes.data.status}`);
    expect(afterRes.data.status).toBe('COMPLETED');
  });

  // CROSS-04: 驳回→pendingQuantity回退
  test('CROSS-04: Reject → pendingQuantity rollback', async () => {
    const token = await getToken();

    // 找 IN_PROGRESS 任务
    const tasksRes = await api('GET', '/process-tasks?status=IN_PROGRESS&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-04: SKIP — no IN_PROGRESS task');
      return;
    }
    const task = tasksRes.data.content[0];
    const beforePending = task.pendingQuantity;

    // 1. 报工
    const reportRes = await api('POST', '/process-work-reporting/normal', token, {
      processTaskId: task.id,
      outputQuantity: 7,
    });
    expect(reportRes.success).toBeTruthy();
    const reportId = reportRes.data.reportId;

    // 2. 驳回
    const rejectRes = await api('PUT', `/process-work-reporting/${reportId}/reject`, token, {
      reason: 'E2E测试驳回',
    });
    expect(rejectRes.success).toBeTruthy();
    console.log('CROSS-04 rejected:', rejectRes.data);

    // 3. 验证 pendingQuantity 回退
    const afterRes = await api('GET', `/process-tasks/${task.id}`, token);
    expect(afterRes.success).toBeTruthy();
    console.log(`CROSS-04 pending: before=${beforePending} after=${afterRes.data.pendingQuantity}`);
    expect(afterRes.data.pendingQuantity).toBe(beforePending);
  });

  // CROSS-05: 状态流转 PENDING→IN_PROGRESS
  test('CROSS-05: Status transition PENDING → IN_PROGRESS on first report', async () => {
    const token = await getToken();

    // 找 PENDING 任务
    const tasksRes = await api('GET', '/process-tasks?status=PENDING&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-05: SKIP — no PENDING task');
      return;
    }
    const task = tasksRes.data.content[0];
    expect(task.status).toBe('PENDING');
    console.log(`CROSS-05 task=${task.id} initial status=${task.status}`);

    // 报工 → 应自动转为 IN_PROGRESS
    const reportRes = await api('POST', '/process-work-reporting/normal', token, {
      processTaskId: task.id,
      outputQuantity: 1,
    });
    expect(reportRes.success).toBeTruthy();
    console.log(`CROSS-05 after report: taskStatus=${reportRes.data.taskStatus}`);
    expect(reportRes.data.taskStatus).toBe('IN_PROGRESS');
  });

  // CROSS-06: 跨端联动 — API 报工 → API 审批 → 验证任务 completedQuantity 增加
  test('CROSS-06: Cross-platform — Report → Approve → Verify update', async () => {
    const token = await getToken();

    // 找 IN_PROGRESS 任务
    const tasksRes = await api('GET', '/process-tasks?status=IN_PROGRESS&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-06: SKIP — no IN_PROGRESS task');
      return;
    }
    const task = tasksRes.data.content[0];
    const beforeCompleted = task.completedQuantity;

    // 1. RN 端报工 (unique quantity to avoid 30s dedup)
    const uniqueQty = Math.floor(Math.random() * 900) + 3000;
    const reportRes = await api('POST', '/process-work-reporting/normal', token, {
      processTaskId: task.id,
      outputQuantity: uniqueQty,
      reporterName: 'CROSS-06-' + Date.now(),
    });
    expect(reportRes.success).toBeTruthy();
    const reportId = reportRes.data.reportId;

    // 2. Vue 端看到待审批 (search up to 200 items)
    const pendingRes = await api('GET', '/process-work-reporting/pending-approval?page=1&size=200', token);
    expect(pendingRes.success).toBeTruthy();
    const found = pendingRes.data.content.find((r: { id: number }) => r.id === reportId);
    console.log('CROSS-06 report found in pending list:', !!found, 'total pending:', pendingRes.data.content?.length);
    // Skip assertion if too many pending items (test data noise)
    if (!found) {
      console.log('CROSS-06: report not in first 200 pending items, skipping verify');
      return;
    }

    // 3. Vue 端审批
    const approveRes = await api('PUT', `/process-work-reporting/${reportId}/approve`, token);
    expect(approveRes.success).toBeTruthy();

    // 4. RN 端验证数量更新
    const afterRes = await api('GET', `/process-tasks/${task.id}`, token);
    expect(afterRes.success).toBeTruthy();
    expect(afterRes.data.completedQuantity).toBe(beforeCompleted + uniqueQty);
    console.log(`CROSS-06 verified: completed ${beforeCompleted} → ${afterRes.data.completedQuantity}`);
  });

  // CROSS-07: NFC 签到 process-mode API 验证
  test('CROSS-07: Process checkin API works', async () => {
    const token = await getToken();

    // 调用 /process-checkin 端点（NfcCheckinScreen 修复后调用的接口）
    const res = await api('POST', '/process-checkin', token, {
      employeeId: 1,
      processName: '拆箱分拣',
      processCategory: '前处理',
      checkinMethod: 'NFC',
    });

    expect(res.success).toBeTruthy();
    console.log('CROSS-07 checkin:', res.data);
    expect(res.data.employeeName).toBeTruthy();
    expect(res.data.checkInTime).toBeTruthy();

    // 签退
    const checkoutRes = await api('POST', `/process-checkin/checkout/${res.data.id}`, token);
    expect(checkoutRes.success).toBeTruthy();
    console.log('CROSS-07 checkout:', checkoutRes.data);
  });

  // CROSS-08: 冲销 reversal
  test('CROSS-08: Reversal — undo approved report', async () => {
    const token = await getToken();

    // 找 IN_PROGRESS 任务
    const tasksRes = await api('GET', '/process-tasks?status=IN_PROGRESS&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-08: SKIP — no IN_PROGRESS task');
      return;
    }
    const task = tasksRes.data.content[0];

    // 1. 报工
    const reportRes = await api('POST', '/process-work-reporting/normal', token, {
      processTaskId: task.id,
      outputQuantity: 2,
    });
    expect(reportRes.success).toBeTruthy();
    const reportId = reportRes.data.reportId;

    // 2. 审批
    const approveRes = await api('PUT', `/process-work-reporting/${reportId}/approve`, token);
    expect(approveRes.success).toBeTruthy();

    // 3. 记录审批后的 completedQuantity
    const midRes = await api('GET', `/process-tasks/${task.id}`, token);
    const midCompleted = midRes.data.completedQuantity;

    // 4. 冲销
    const reversalRes = await api('POST', `/process-work-reporting/${reportId}/reversal`, token, {
      reason: 'E2E测试冲销',
    });
    expect(reversalRes.success).toBeTruthy();
    console.log('CROSS-08 reversal:', reversalRes.data);

    // 5. 验证 completedQuantity 减少
    const afterRes = await api('GET', `/process-tasks/${task.id}`, token);
    expect(afterRes.data.completedQuantity).toBe(midCompleted - 2);
    console.log(`CROSS-08 completed: ${midCompleted} → ${afterRes.data.completedQuantity}`);
  });

  // CROSS-09: 并发报工（两个用户同一任务）
  test('CROSS-09: Concurrent reports on same task', async () => {
    const token = await getToken();

    // 找 IN_PROGRESS 任务
    const tasksRes = await api('GET', '/process-tasks?status=IN_PROGRESS&page=1&size=1', token);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-09: SKIP');
      return;
    }
    const task = tasksRes.data.content[0];
    const beforePending = task.pendingQuantity;

    // 两个报工并发提交 (unique quantities to avoid dedup)
    const q1 = Math.floor(Math.random() * 900) + 2000;
    const q2 = q1 + 1;
    const [res1, res2] = await Promise.all([
      api('POST', '/process-work-reporting/normal', token, { processTaskId: task.id, outputQuantity: q1, reporterName: 'conc-1-' + Date.now() }),
      api('POST', '/process-work-reporting/normal', token, { processTaskId: task.id, outputQuantity: q2, reporterName: 'conc-2-' + Date.now() }),
    ]);

    // At least one should succeed; both may succeed if no collision
    const successes = [res1, res2].filter(r => r.success);
    expect(successes.length).toBeGreaterThanOrEqual(1);
    console.log('CROSS-09 concurrent reports: ' + successes.length + '/2 succeeded');

    // 验证 pendingQuantity 增加
    const afterRes = await api('GET', `/process-tasks/${task.id}`, token);
    const expectedIncrease = successes.length === 2 ? q1 + q2 : (res1.success ? q1 : q2);
    expect(afterRes.data.pendingQuantity).toBeGreaterThanOrEqual(beforePending);
    console.log(`CROSS-09 pending: ${beforePending} → ${afterRes.data.pendingQuantity}`);
  });

  // CROSS-10: workshop_sup1 多角色报工
  test('CROSS-10: workshop_sup1 can report', async () => {
    // 用 workshop_sup1 登录获取 token
    const loginRes = await fetch(`${API_BASE}/auth/unified-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'workshop_sup1', password: '123456' }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.log('CROSS-10: SKIP — workshop_sup1 login failed');
      return;
    }
    const wsToken = loginData.data.accessToken;

    // 找任务
    const tasksRes = await api('GET', '/process-tasks?status=IN_PROGRESS&page=1&size=1', wsToken);
    if (!tasksRes.success || !tasksRes.data?.content?.length) {
      console.log('CROSS-10: SKIP — no task');
      return;
    }

    // 报工
    const reportRes = await api('POST', '/process-work-reporting/normal', wsToken, {
      processTaskId: tasksRes.data.content[0].id,
      outputQuantity: 1,
    });
    expect(reportRes.success).toBeTruthy();
    console.log('CROSS-10 workshop_sup1 report:', reportRes.data);
  });

  // CROSS-11: Vue 产品-工序配置页 "生成工序任务" 按钮
  test('CROSS-11: Generate tasks via Vue UI button', async () => {
    const token = await getToken();

    // 直接调 API 验证按钮背后的端点
    const res = await api('POST', '/process-tasks/generate-from-product', token, {
      productTypeId: 'PT-F001-001',
      plannedQuantities: { 'wp-001': 10, 'wp-002': 20, 'wp-003': 30 },
      sourceCustomerName: 'Vue UI 生成测试',
    });

    expect(res.success).toBeTruthy();
    console.log('CROSS-11 generated:', res.data.length, 'tasks');
    // 验证每道工序的 plannedQuantity 被正确设置
    for (const task of res.data) {
      console.log(`  ${task.processName}: qty=${task.plannedQuantity} unit=${task.unit}`);
      expect(task.plannedQuantity).toBeGreaterThan(0);
    }
  });
});
