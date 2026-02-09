import { test, expect } from '@playwright/test';
import { vueLogin, checkVuePage, PageResult, printSummary } from '../helpers';

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

test.describe('W1-S1: Vue Web-Admin Full Module Scan', () => {
  const results: PageResult[] = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await vueLogin(page, 'factory_admin1', '123456');
    // Store auth state
    await page.context().storageState({ path: 'tests/e2e-round4/reports/vue-auth.json' });
    await page.close();
  });

  for (const path of VUE_PAGES) {
    test(`Vue page: ${path}`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: 'tests/e2e-round4/reports/vue-auth.json'
      });
      const page = await context.newPage();
      const result = await checkVuePage(page, path);
      results.push(result);

      if (result.status === 'FAIL') {
        console.log(`FAIL: ${path} - ${result.error}`);
      }
      expect(result.status, `Page ${path}: ${result.error}`).not.toBe('FAIL');
      await context.close();
    });
  }

  test.afterAll(() => {
    printSummary('W1-S1: Vue Web-Admin', results);
  });
});
