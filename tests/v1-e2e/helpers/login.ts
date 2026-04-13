/**
 * loginAs() — reusable login helper for all E2E roles.
 *
 * Auth strategy notes (from web-admin):
 *   - Tokens are stored in HttpOnly cookies (not readable by JS).
 *   - User info (non-sensitive) is saved to localStorage under `cretas_user`.
 *   - After login the app redirects to /dashboard.
 *   - Login endpoint: POST /api/mobile/auth/unified-login
 */

import { Page, expect } from '@playwright/test';
import { S } from './selectors';

export type E2ERole =
  | 'super_admin'
  | 'sales_mgr'
  | 'purchase_mgr'
  | 'warehouse_ops'
  | 'workshop_sup'
  | 'chain_admin';  // factory_admin1 / F001 — used by business chain tests

/**
 * Usernames seeded by Task 2 (all have password "123456").
 * chain_admin = factory_admin1 (F001 factory, same user as test-e2e-business-chain.mjs)
 */
const USERNAMES: Record<E2ERole, string> = {
  super_admin: 'e2e_super_admin',
  sales_mgr: 'e2e_sales_mgr',
  purchase_mgr: 'e2e_purchase_mgr',
  warehouse_ops: 'e2e_warehouse_ops',
  workshop_sup: 'e2e_workshop_sup',
  chain_admin: 'factory_admin1',
};

const PASSWORD = '123456';

/**
 * Navigate to /login, fill credentials, submit and wait for the backend
 * to respond 200 on /auth/unified-login, then wait for redirect to /dashboard.
 */
export async function loginAs(page: Page, role: E2ERole): Promise<void> {
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector(S.login.passwordInput, { state: 'visible' });

  await page.fill(S.login.usernameInput, USERNAMES[role]);
  await page.fill(S.login.passwordInput, PASSWORD);

  // Register waitForResponse BEFORE click to avoid Playwright race condition.
  // Do NOT filter by status here — the 4xx body still has {success, message}
  // and we assert success=true below with a clear error message.
  const [loginResp] = await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/api/mobile/auth/unified-login'),
      { timeout: 15_000 },
    ),
    page.click(S.login.submitButton),
  ]);

  const body = await loginResp.json();
  expect(body.success, `登录失败 (role=${role}): ${JSON.stringify(body)}`).toBe(true);

  // App redirects to /dashboard after successful login
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Click the user avatar in the AppHeader to open the dropdown, then click
 * "退出登录". Confirms ElMessageBox by pressing Enter (it pre-focuses OK).
 */
export async function logout(page: Page): Promise<void> {
  // Open user dropdown in AppHeader
  await page.click(S.header.userDropdown);
  // Wait for the dropdown item to appear, then click
  await page.click(S.header.logoutItem);
  // ElMessageBox confirm — press Enter to accept
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}
