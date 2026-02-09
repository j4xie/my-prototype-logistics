import { test, expect } from '@playwright/test';
import { vueLogin } from '../helpers';

test.describe('P5 Statistical Analysis', () => {
  test('full workflow test', async ({ page }) => {
    test.setTimeout(180_000);

    // Step 1: Login
    console.log('Step 1: Login...');
    await vueLogin(page, 'factory_admin1', '123456');
    console.log('Step 1: Login successful');

    // Step 2: Navigate to SmartBI page
    console.log('Step 2: Navigate to SmartBI...');
    await page.goto('/smart-bi/analysis', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pageText = await page.locator('body').innerText();
    console.log('Page text (200):', pageText.substring(0, 200));

    // Step 3: Wait for data to load
    console.log('Step 3: Waiting for data...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-01-initial.png' });

    const bodyText = await page.locator('body').innerText();
    console.log('Body (500):', bodyText.substring(0, 500));

    // Check sheet tabs
    let sheetTabCount = await page.locator('.el-tabs__item, [role=tab]').count();
    console.log('Sheet tabs:', sheetTabCount);

    if (sheetTabCount === 0) {
      console.log('No sheet tabs, looking for upload records...');
      const tableRows = page.locator('.el-table__row');
      const rowCount = await tableRows.count();
      console.log('Table rows:', rowCount);
      if (rowCount > 0) {
        const viewBtn = tableRows.first().locator('button, .el-button').first();
        if (await viewBtn.count() > 0) {
          await viewBtn.click();
        } else {
          await tableRows.first().click();
        }
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-02-after-nav.png' });

    // Step 4: Find button
    console.log('Step 4: Looking for button...');
    const statBtn = page.locator('button, .el-button').filter({ hasText: '因果分析' });
    await expect(statBtn.first()).toBeVisible({ timeout: 15_000 });
    console.log('Step 4: Button found');

    // Step 5: Click button
    console.log('Step 5: Clicking...');
    await statBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-03-dialog.png' });

    // Step 6: Verify dialog
    console.log('Step 6: Verify dialog...');
    const dialog = page.locator('.el-dialog').filter({ hasText: '因果分析' });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    console.log('Step 6: Dialog visible');

    const dialogContent = await dialog.innerText();
    console.log('Dialog (300):', dialogContent.substring(0, 300));

    const sheetButtons = dialog.locator('.el-button, button').filter({ hasNotText: /Close/ });
    const btnCount = await sheetButtons.count();
    console.log('Sheet buttons:', btnCount);
    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-04-sheets.png' });

    // Step 7: Click sheet
    console.log('Step 7: Click sheet...');
    const targetIdx = btnCount > 1 ? 1 : 0;
    const targetBtn = sheetButtons.nth(targetIdx);
    const btnText = await targetBtn.innerText();
    console.log('Clicking:', btnText);
    await targetBtn.click();

    // Step 8: Wait for analysis
    console.log('Step 8: Waiting for analysis (up to 60s)...');
    await page.waitForTimeout(2000);

    const loadingEls = await dialog.locator('.el-loading-mask, [class*=loading]').count();
    console.log('Loading visible:', loadingEls > 0);
    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-05-loading.png' });

    let analysisLoaded = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      const canvasCount = await dialog.locator('canvas').count();
      const tagCount = await dialog.locator('.el-tag').count();
      const rowCount = await dialog.locator('.el-table__row, table tr').count();
      console.log('Attempt ' + (i+1) + ': canvas=' + canvasCount + ' tags=' + tagCount + ' rows=' + rowCount);
      if (canvasCount > 0 || tagCount > 0 || rowCount > 0) {
        analysisLoaded = true;
        console.log('Analysis loaded!');
        break;
      }
    }

    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-06-result.png' });
    expect(analysisLoaded).toBe(true);

    const canvasElements = await dialog.locator('canvas').count();
    console.log('Heatmap canvases:', canvasElements);
    expect(canvasElements).toBeGreaterThan(0);

    const tagsFinal = await dialog.locator('.el-tag').count();
    console.log('Tags:', tagsFinal);

    const tables = await dialog.locator('.el-table, table').count();
    console.log('Tables:', tables);

    const finalContent = await dialog.innerText();
    console.log('Final (500):', finalContent.substring(0, 500));

    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-07-final.png', fullPage: true });

    // Step 9: Close and reopen
    console.log('Step 9: State reset test...');
    const closeBtn1 = dialog.locator('.el-dialog__headerbtn').first();
    await closeBtn1.click();
    await page.waitForTimeout(1000);
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    console.log('Dialog closed');

    await statBtn.first().click();
    await page.waitForTimeout(1000);

    const reopened = page.locator('.el-dialog').filter({ hasText: '因果分析' });
    await expect(reopened).toBeVisible({ timeout: 5_000 });

    const reopenedContent = await reopened.innerText();
    console.log('Reopened (300):', reopenedContent.substring(0, 300));
    await page.screenshot({ path: 'C:/Users/Steve/my-prototype-logistics/tests/e2e-round4/reports/p5-08-reopened.png' });

    const reopenedBtns = await reopened.locator('.el-button, button').filter({ hasNotText: /Close/ }).count();
    const reopenedCanvas = await reopened.locator('canvas').count();
    console.log('Reopened btns:', reopenedBtns, 'canvas:', reopenedCanvas);

    const stateReset = reopenedBtns > 0 || reopenedCanvas === 0;
    console.log('State reset OK:', stateReset);

    await reopened.locator('.el-dialog__headerbtn').first().click();
    await page.waitForTimeout(500);

    // Step 10: Summary
    console.log('=== P5 TEST RESULTS ===');
    console.log('Analysis loaded: ' + (analysisLoaded ? 'PASS' : 'FAIL'));
    console.log('Heatmap rendered: ' + (canvasElements > 0 ? 'PASS' : 'FAIL'));
    console.log('Correlation tags: ' + (tagsFinal > 0 ? 'PASS' : 'WARN'));
    console.log('Distribution table: ' + (tables > 0 ? 'PASS' : 'WARN'));
    console.log('State reset: ' + (stateReset ? 'PASS' : 'FAIL'));
    const overall = analysisLoaded && canvasElements > 0 && stateReset;
    console.log('Overall: ' + (overall ? 'PASS' : 'FAIL'));
  });
});
