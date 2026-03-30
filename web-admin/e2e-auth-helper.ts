/**
 * Shared E2E authentication helper for Playwright tests.
 *
 * The web-admin app uses HttpOnly cookies for auth tokens (set by the server
 * via Set-Cookie header). localStorage only stores non-sensitive user info.
 *
 * This helper:
 *   1. Calls the login API to get a token + user data
 *   2. Injects the token as an HttpOnly cookie via context.addCookies()
 *   3. Sets cretas_user in localStorage (the app needs this for user info display)
 */

import { Page, BrowserContext } from '@playwright/test';

export interface LoginResult {
  token: string;
  loginData: Record<string, unknown>;
}

const DEFAULT_API = 'http://47.100.235.168:10010/api/mobile';

/**
 * Call the login API and return the token + full login data.
 */
export async function fetchLoginToken(
  username = 'factory_admin1',
  password = '123456',
  apiBase = DEFAULT_API,
): Promise<LoginResult> {
  const res = await fetch(`${apiBase}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json();
  const data = json.data || {};
  const token = data.accessToken || data.token || '';
  if (!token) {
    throw new Error(`Login API failed for ${username}: ${json.message || 'no token returned'}`);
  }
  return { token, loginData: data };
}

/**
 * Build the cretas_user JSON string from login API data.
 */
function buildUserJson(d: Record<string, unknown>): string {
  return JSON.stringify({
    id: d.userId,
    username: d.username,
    email: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userType: 'factory',
    factoryUser: {
      role: d.role,
      factoryId: d.factoryId,
      factoryType: d.factoryType || 'FACTORY',
      permissions: d.permissions || [],
    },
  });
}

/**
 * Inject authentication into a Playwright browser context.
 *
 * - Sets the access token as an HttpOnly cookie (matching how the server sets it).
 * - Sets cretas_user in localStorage (the app reads this for user info).
 *
 * @param context  - The BrowserContext (from test or page.context())
 * @param page     - A Page in the context (used to set localStorage)
 * @param token    - JWT access token
 * @param loginData - Full login response data
 * @param baseUrl  - The web-admin base URL (used to determine the cookie domain)
 */
export async function injectAuthCookie(
  context: BrowserContext,
  page: Page,
  token: string,
  loginData: Record<string, unknown>,
  baseUrl: string,
): Promise<void> {
  // Parse the domain from the base URL for the cookie
  const url = new URL(baseUrl);
  const domain = url.hostname;

  // 1. Set the access token as an HttpOnly cookie
  await context.addCookies([
    {
      name: 'cretas_access_token',
      value: token,
      domain,
      path: '/',
      httpOnly: true,
      secure: false, // test environments use HTTP
      sameSite: 'Lax',
    },
  ]);

  // 2. Navigate to the base URL so localStorage is on the right origin
  await page.goto(baseUrl + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // 3. Set cretas_user in localStorage (non-sensitive user info the app needs)
  const userJson = buildUserJson(loginData);
  await page.evaluate((user) => {
    localStorage.setItem('cretas_user', user);
  }, userJson);
}

/**
 * Convenience: fetch token + inject cookie + navigate to a target page.
 *
 * Use this in beforeAll or beforeEach to set up authenticated state.
 */
export async function setupAuth(
  context: BrowserContext,
  page: Page,
  baseUrl: string,
  apiBase = DEFAULT_API,
  username = 'factory_admin1',
  password = '123456',
): Promise<LoginResult> {
  const result = await fetchLoginToken(username, password, apiBase);
  await injectAuthCookie(context, page, result.token, result.loginData, baseUrl);
  return result;
}
