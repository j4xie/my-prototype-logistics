import { test, Page } from '@playwright/test';
import path from 'path';

const SD = path.resolve(__dirname, '../../../test-screenshots/smartbi-ui-audit');
const BU = 'http://47.100.235.168:8088';

test('Debug login v2', async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE: ' + msg.type() + ' ' + msg.text()));
  page.on('response', resp => {
    if (resp.url().includes('login') || resp.url().includes('auth')) {
      console.log('RESPONSE: ' + resp.status() + ' ' + resp.url());
    }
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(BU + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Try quick login button approach
  const quickBtns = page.locator('.quick-login button');
  const qbc = await quickBtns.count();
  console.log('Quick login buttons: ' + qbc);

  // Click the factory_admin1 quick login button
  for (let i = 0; i < qbc; i++) {
    const t = await quickBtns.nth(i).textContent();
    console.log('Quick btn ' + i + ': ' + t);
  }

  // Click first quick button (factory_admin1)
  if (qbc > 0) {
    await quickBtns.first().click();
    await page.waitForTimeout(500);
  }

  // Now check that form is filled
  const uVal = await page.locator('input').first().inputValue();
  const pVal = await page.locator('input[type="password"]').first().inputValue();
  console.log('Username: ' + uVal + ', Password: ' + pVal);

  // Click submit button
  const submitBtn = page.locator('button.login-btn, button[type="submit"], .login-form button').first();
  console.log('Submit btn exists: ' + (await submitBtn.count()));
  const btnText = await submitBtn.textContent();
  console.log('Submit btn text: ' + btnText);
  await submitBtn.click();

  // Wait for navigation
  await page.waitForTimeout(8000);
  console.log('After submit URL: ' + page.url());
  await page.screenshot({ path: path.join(SD, 'D4-after-submit.png'), fullPage: false });

  // Check for error messages
  const msgs = page.locator('.el-message');
  const mc = await msgs.count();
  if (mc > 0) {
    for (let i = 0; i < mc; i++) {
      const mt = await msgs.nth(i).textContent();
      console.log('Message: ' + mt);
    }
  }
});