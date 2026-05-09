/**
 * scripts/active-e2e/playwright/flows/login-smartbi.spec.ts
 *
 * Active E2E framework v1 — customer-perspective Playwright flow template.
 * Replicates the user journey that passive 24h soak windows would have
 * "tested" by accident: login → navigate dashboard → observe data render.
 *
 * Per HARD rule `feedback_active_e2e_replaces_passive_soak.md`:
 *   active synthetic E2E from customer perspective replaces passive soak.
 *
 * Configurable via env vars (defaults target Web-Admin prod 139:8086):
 *   E2E_BASE_URL    https://www.cretaceousfuture.com   (or http://139.196.165.140:8086)
 *   E2E_USERNAME    factory_super_admin                (Web-Admin login)
 *   E2E_PASSWORD    <from .env.test.example, never commit real value>
 *   E2E_FACTORY     F002                               (one factory to scope)
 *
 * Run:
 *   E2E_USERNAME=... E2E_PASSWORD=... E2E_FACTORY=F002 \
 *     npx playwright test scripts/active-e2e/playwright/flows/login-smartbi.spec.ts
 *
 * Tier-2 future extension: SSE stream verification for /dashboard/executive/insights/custom/stream.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://139.196.165.140:8086';
const USERNAME = process.env.E2E_USERNAME || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const FACTORY = process.env.E2E_FACTORY || 'F002';

test.describe('Active E2E — SmartBI Web-Admin customer perspective', () => {
  test.beforeAll(() => {
    if (!USERNAME || !PASSWORD) {
      throw new Error(
        'E2E_USERNAME and E2E_PASSWORD env required. See .env.test.example for format.',
      );
    }
  });

  test('login + dashboard + KPI cards + charts render without errors', async ({ page }) => {
    // 1. Login
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/.*Cretas.*|.*SmartBI.*|.*登录.*/i);
    await page.fill('input[name="username"], input[placeholder*="账号"], input[placeholder*="用户名"]', USERNAME);
    await page.fill('input[name="password"], input[type="password"]', PASSWORD);
    await page.click('button[type="submit"], button:has-text("登录"), button:has-text("Login")');
    await page.waitForURL(/.*dashboard|home|index|main.*/i, { timeout: 15000 });

    // 2. Navigate to executive dashboard
    // Web-Admin main routes (verified at 139:8086 in cutover smoke):
    //   /smartbi/dashboard or /home (factory_super_admin landing)
    await page.goto(`${BASE_URL}/smartbi/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // 3. Assert KPI cards rendered (any non-zero count signals dashboard reached server)
    const kpiCards = page.locator('[data-test="kpi-card"], .kpi-card, .metric-card');
    await expect(kpiCards).not.toHaveCount(0, { timeout: 15000 });

    // 4. Assert chart containers rendered (ECharts canvas / SVG present)
    const charts = page.locator('canvas, svg.echarts, .echarts-container');
    await expect(charts).not.toHaveCount(0, { timeout: 15000 });

    // 5. Assert no client-side JS errors during navigation
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Trigger a refresh to surface any deferred errors
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('chunk-')).slice(0, 5)).toEqual([]);

    // 6. Snapshot for manual review
    await page.screenshot({
      path: `out/active-e2e-dashboard-${FACTORY}-${Date.now()}.png`,
      fullPage: true,
    });
  });

  test('analysis subpage navigates without infinite spinner', async ({ page }) => {
    // Login (cached cookie if test sequence ran prior; else re-login)
    await page.goto(`${BASE_URL}/login`);
    if (await page.locator('input[name="username"]').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.fill('input[name="username"]', USERNAME);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/.*dashboard|home.*/i, { timeout: 15000 });
    }

    // Hit a finance analysis subpage — proves Python /analysis/finance is wired up
    await page.goto(`${BASE_URL}/smartbi/analysis/finance`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // No infinite spinner (anything spinning > 10s is a likely white-screen failure)
    const spinner = page.locator('.el-loading-mask, .loading-spinner, [data-loading="true"]');
    if (await spinner.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(spinner.first()).toBeHidden({ timeout: 15000 });
    }

    // Page has rendered SOMETHING from the response — not a blank white screen
    const content = page.locator('main, .main-content, .page-container, [data-test="page-root"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
    await expect(content).not.toBeEmpty();
  });
});
