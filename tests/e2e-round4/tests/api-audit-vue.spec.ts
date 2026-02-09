import { test } from '@playwright/test';
import {
  vueLogin,
  setupApiInterceptor,
  auditPage,
  buildAuditReport,
  printApiAuditSummary,
  saveAuditReport,
  PageAuditResult,
} from '../helpers';

/**
 * API Audit — Vue Web-Admin
 *
 * Visits every Vue page as factory_admin1, intercepts all /api/ network responses
 * and console errors, then outputs a comprehensive audit report.
 */

const VUE_PAGES = [
  // Dashboard
  '/dashboard',
  // Production
  '/production/batches', '/production/plans', '/production/conversions', '/production/bom',
  // Warehouse
  '/warehouse/materials', '/warehouse/shipments', '/warehouse/inventory',
  // Quality
  '/quality/inspections', '/quality/disposals',
  // Procurement + Sales
  '/procurement/suppliers', '/sales/customers',
  // HR
  '/hr/employees', '/hr/attendance', '/hr/whitelist', '/hr/departments',
  // Equipment
  '/equipment/list', '/equipment/maintenance', '/equipment/alerts',
  // Finance
  '/finance/costs', '/finance/reports',
  // System
  '/system/users', '/system/roles', '/system/logs', '/system/settings', '/system/ai-intents', '/system/products',
  // Analytics
  '/analytics/overview', '/analytics/trends', '/analytics/ai-reports', '/analytics/kpi', '/analytics/production-report',
  // Scheduling
  '/scheduling/overview', '/scheduling/plans', '/scheduling/realtime', '/scheduling/workers', '/scheduling/alerts',
  // SmartBI
  '/smart-bi/dashboard', '/smart-bi/finance', '/smart-bi/sales', '/smart-bi/query', '/smart-bi/analysis',
  // Calibration
  '/calibration/list',
];

test.describe('API Audit: Vue Web-Admin', () => {
  test('Audit all Vue page API calls', async ({ browser }) => {
    const startedAt = new Date().toISOString();
    const auditResults: PageAuditResult[] = [];

    // --- Login and save auth state ---
    const loginPage = await browser.newPage();
    await vueLogin(loginPage, 'factory_admin1', '123456');
    await loginPage.context().storageState({ path: 'tests/e2e-round4/reports/vue-auth.json' });
    await loginPage.close();

    // --- Audit each page ---
    const context = await browser.newContext({
      storageState: 'tests/e2e-round4/reports/vue-auth.json',
    });
    const page = await context.newPage();
    const { apiCalls, consoleErrors } = setupApiInterceptor(page);

    for (const pagePath of VUE_PAGES) {
      console.log(`Auditing: ${pagePath}`);
      try {
        const result = await auditPage(page, pagePath, apiCalls, consoleErrors, { waitMs: 3000 });
        auditResults.push(result);

        // Log inline progress
        const fails = result.apiCalls.filter(c => c.verdict === 'FAIL').length;
        const warns = result.apiCalls.filter(c => c.verdict === 'WARN').length;
        const total = result.apiCalls.length;
        console.log(`  → ${total} API calls (${fails} FAIL, ${warns} WARN), ${result.consoleErrors.length} console errors`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`  → Navigation error: ${errMsg.substring(0, 200)}`);
        auditResults.push({
          page: pagePath,
          apiCalls: [...apiCalls],
          consoleErrors: [...consoleErrors, { type: 'error', text: `Navigation error: ${errMsg.substring(0, 300)}` }],
          timestamp: new Date().toISOString(),
        });
      }
    }

    await context.close();

    // --- Build and output report ---
    const report = buildAuditReport('Vue Web-Admin (factory_admin1)', auditResults, startedAt);
    printApiAuditSummary(report);
    saveAuditReport(report, 'api-audit-vue.json');
  });
});
