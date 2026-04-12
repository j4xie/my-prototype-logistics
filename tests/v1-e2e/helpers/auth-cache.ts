/**
 * auth-cache.ts — Reusable storageState caching to avoid 429 rate-limit.
 *
 * Backend enforces ~5 logins / 60s. Without caching, parallel tests hit the
 * limit instantly. This helper writes/reads auth state from test-results/ so
 * the role only logs in once per test run.
 *
 * Usage:
 *   import { getAuthFile, setupAuthBeforeAll, restoreAuth } from '../helpers/auth-cache';
 *
 *   test.beforeAll(async ({ browser }) => {
 *     await setupAuthBeforeAll(browser, 'sales_mgr');
 *   });
 *   test.beforeEach(async ({ page, context }) => {
 *     await restoreAuth(context, page, 'sales_mgr');
 *   });
 */

import { Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs, E2ERole } from './login';

const TEST_RESULTS_DIR = path.join(__dirname, '..', 'test-results');

/**
 * Returns the auth state file path for a given role.
 */
export function getAuthFile(role: E2ERole): string {
  return path.join(TEST_RESULTS_DIR, `${role}-auth.json`);
}

/**
 * Installs the Vite-proxy workaround on a context.
 * Vite's proxy is broken locally for /api/mobile/** — we intercept and forward to :10010.
 */
export async function installApiProxy(context: BrowserContext): Promise<void> {
  await context.route('**/api/mobile/**', async (route) => {
    const url = route.request().url().replace(
      /http:\/\/localhost:\d+\//,
      'http://localhost:10010/'
    );
    try {
      const response = await route.fetch({ url });
      await route.fulfill({ response });
    } catch {
      await route.continue();
    }
  });
}

/**
 * Login once for the given role, save auth state to disk.
 * Skips login if the file already exists (idempotent).
 *
 * Must be called in test.beforeAll where `browser` is available.
 */
export async function setupAuthBeforeAll(
  browser: Browser,
  role: E2ERole
): Promise<void> {
  const authFile = getAuthFile(role);

  // Ensure output dir exists
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  }

  // Reuse if already cached
  if (fs.existsSync(authFile)) return;

  const context = await browser.newContext();
  await installApiProxy(context);

  const page = await context.newPage();
  await loginAs(page, role);

  await context.storageState({ path: authFile });
  await context.close();
}

/**
 * Restore auth state (cookies + localStorage) into the current test's context.
 * Also installs the API proxy.
 *
 * Must be called in test.beforeEach.
 */
export async function restoreAuth(
  context: BrowserContext,
  page: Page,
  role: E2ERole
): Promise<void> {
  await installApiProxy(context);

  const authFile = getAuthFile(role);
  const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));

  // Restore cookies
  if (state.cookies && state.cookies.length > 0) {
    await context.addCookies(state.cookies);
  }

  // Restore localStorage — must navigate to origin first
  if (state.origins && state.origins.length > 0) {
    await page.goto('/');
    for (const origin of state.origins) {
      for (const item of (origin.localStorage || [])) {
        await page.evaluate(
          ([k, v]: [string, string]) => window.localStorage.setItem(k, v),
          [item.name, item.value] as [string, string]
        );
      }
    }
  }
}
