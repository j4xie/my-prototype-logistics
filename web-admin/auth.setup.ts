/**
 * Auth setup — logs in via the UI, waits for the server to set the HttpOnly
 * cookie, then saves the storageState (cookies + localStorage) for downstream
 * test projects that declare `dependencies: ['vue-auth']`.
 */
import { test as setup, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

async function doLogin(page: import('@playwright/test').Page, username: string, password: string, outPath: string) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u7528\u6237\u540d').fill(username);
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u5bc6\u7801').fill(password);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '\u767b \u5f55' }).click();
  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle');

  // Verify: user info should be in localStorage (non-sensitive data).
  // The access token is now in an HttpOnly cookie (not readable by JS).
  const user = await page.evaluate(() => localStorage.getItem('cretas_user'));
  console.log(`[auth-setup] ${username}: user=${user ? 'OK' : 'NULL'}, URL=${page.url()}`);

  // Check cookies for the HttpOnly auth token
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'cretas_access_token');
  console.log(`[auth-setup] ${username}: auth cookie=${authCookie ? 'SET' : 'MISSING'}`);

  if (!user || !authCookie) {
    // Retry once
    console.log(`[auth-setup] ${username}: auth incomplete, retrying`);
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('\u8bf7\u8f93\u5165\u7528\u6237\u540d').fill(username);
    await page.getByPlaceholder('\u8bf7\u8f93\u5165\u5bc6\u7801').fill(password);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '\u767b \u5f55' }).click();
    await page.waitForTimeout(10000);
    await page.waitForLoadState('networkidle');

    const user2 = await page.evaluate(() => localStorage.getItem('cretas_user'));
    const cookies2 = await page.context().cookies();
    const authCookie2 = cookies2.find(c => c.name === 'cretas_access_token');
    console.log(`[auth-setup] ${username} retry: user=${user2 ? 'OK' : 'STILL NULL'}, cookie=${authCookie2 ? 'SET' : 'STILL MISSING'}`);
  }

  // Navigate to dashboard to trigger router (ensures correct origin for storageState)
  await page.goto(BASE_URL + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log(`[auth-setup] ${username}: final URL=${page.url()}`);

  // Save storageState (includes both cookies and localStorage)
  await page.context().storageState({ path: outPath });

  // Verify saved result
  const fs = await import('fs');
  const saved = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  const cookieCount = saved.cookies?.length || 0;
  const originCount = saved.origins?.length || 0;
  const itemCount = saved.origins?.reduce((n: number, o: { localStorage?: unknown[] }) => n + (o.localStorage?.length || 0), 0) || 0;
  console.log(`[auth-setup] ${username}: saved cookies=${cookieCount}, origins=${originCount}, localStorage items=${itemCount}`);
}

setup('factory_admin1 登录并保存状态', async ({ page }) => {
  await doLogin(page, 'factory_admin1', '123456', 'test-results/.auth/factory-admin.json');
});

setup('workshop_sup1 登录并保存状态', async ({ page }) => {
  await doLogin(page, 'workshop_sup1', '123456', 'test-results/.auth/workshop-sup.json');
});
