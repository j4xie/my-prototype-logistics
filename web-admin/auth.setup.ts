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

  // 验证 token 已存入 localStorage
  const token = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
  const user = await page.evaluate(() => localStorage.getItem('cretas_user'));
  console.log(`[auth-setup] ${username}: token=${token ? token.substring(0, 20) + '...' : 'NULL'}, user=${user ? 'OK' : 'NULL'}`);
  console.log(`[auth-setup] ${username}: URL=${page.url()}`);

  if (!token || !user) {
    // 重试一次
    console.log(`[auth-setup] ${username}: token 缺失，重试`);
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('\u8bf7\u8f93\u5165\u7528\u6237\u540d').fill(username);
    await page.getByPlaceholder('\u8bf7\u8f93\u5165\u5bc6\u7801').fill(password);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '\u767b \u5f55' }).click();
    await page.waitForTimeout(10000);
    await page.waitForLoadState('networkidle');

    const token2 = await page.evaluate(() => localStorage.getItem('cretas_access_token'));
    console.log(`[auth-setup] ${username} retry: token=${token2 ? token2.substring(0, 20) + '...' : 'STILL NULL'}`);
  }

  // 确保在目标 origin 上再保存 (navigate away from login to trigger router)
  await page.goto(BASE_URL + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log(`[auth-setup] ${username}: final URL=${page.url()}`);

  await page.context().storageState({ path: outPath });

  // 验证保存结果
  const fs = await import('fs');
  const saved = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  const originCount = saved.origins?.length || 0;
  const itemCount = saved.origins?.reduce((n: number, o: { localStorage?: unknown[] }) => n + (o.localStorage?.length || 0), 0) || 0;
  console.log(`[auth-setup] ${username}: saved origins=${originCount}, items=${itemCount}`);
}

setup('factory_admin1 登录并保存状态', async ({ page }) => {
  await doLogin(page, 'factory_admin1', '123456', 'test-results/.auth/factory-admin.json');
});

setup('workshop_sup1 登录并保存状态', async ({ page }) => {
  await doLogin(page, 'workshop_sup1', '123456', 'test-results/.auth/workshop-sup.json');
});
