import { test } from '@playwright/test';
import {
  rnLogin,
  clickTabByPosition,
  setupApiInterceptor,
  buildAuditReport,
  printApiAuditSummary,
  saveAuditReport,
  PageAuditResult,
  ApiCall,
  ConsoleEntry,
} from '../helpers';

/**
 * API Audit — React Native App
 *
 * Logs in as each role, clicks through every tab, intercepts all /api/
 * network responses and console errors, then outputs a comprehensive audit report.
 */

interface RNRoleConfig {
  username: string;
  password: string;
  sessionName: string;
  tabs: string[];
}

const RN_ROLES: RNRoleConfig[] = [
  {
    username: 'factory_admin1',
    password: '123456',
    sessionName: 'FactoryAdmin',
    tabs: ['首页', '报表', 'SmartBI', '管理', 'AI分析', '我的'],
  },
  {
    username: 'dispatcher1',
    password: '123456',
    sessionName: 'Dispatcher',
    tabs: ['首页', '计划', 'AI调度', '智能分析', '人员', '我的'],
  },
  {
    username: 'warehouse_mgr1',
    password: '123456',
    sessionName: 'Warehouse',
    tabs: ['首页', '入库', '出货', '库存', '我的'],
  },
  {
    username: 'hr_admin1',
    password: '123456',
    sessionName: 'HRAdmin',
    tabs: ['首页', '人员', '考勤', '白名单', '我的'],
  },
  {
    username: 'workshop_sup1',
    password: '123456',
    sessionName: 'Workshop',
    tabs: ['首页', '批次', '人员', '设备', '我的'],
  },
  {
    username: 'quality_insp1',
    password: '123456',
    sessionName: 'QualityInsp',
    tabs: ['首页', '质检', '记录', '分析', '我的'],
  },
];

test.describe('API Audit: React Native App', () => {
  for (const role of RN_ROLES) {
    test(`Audit RN APIs: ${role.sessionName} (${role.username})`, async ({ page }) => {
      const startedAt = new Date().toISOString();
      const auditResults: PageAuditResult[] = [];
      const { apiCalls, consoleErrors } = setupApiInterceptor(page);

      // --- Login ---
      apiCalls.length = 0;
      consoleErrors.length = 0;

      await rnLogin(page, role.username, role.password);
      // Wait for initial API calls after login
      await page.waitForTimeout(3000);

      auditResults.push({
        page: `${role.sessionName}/Login+Home`,
        apiCalls: [...apiCalls],
        consoleErrors: [...consoleErrors],
        timestamp: new Date().toISOString(),
      });

      console.log(`${role.sessionName}: Login complete, ${apiCalls.length} API calls captured`);

      // --- Click each tab and capture API calls ---
      for (const tabName of role.tabs) {
        apiCalls.length = 0;
        consoleErrors.length = 0;

        const clicked = await clickTabByPosition(page, tabName);
        if (!clicked) {
          console.log(`  ${tabName}: Tab not found, skipping`);
          auditResults.push({
            page: `${role.sessionName}/Tab:${tabName}`,
            apiCalls: [],
            consoleErrors: [{ type: 'error', text: 'Tab not found' }],
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Wait for APIs to settle
        await page.waitForTimeout(3000);

        const result: PageAuditResult = {
          page: `${role.sessionName}/Tab:${tabName}`,
          apiCalls: [...apiCalls],
          consoleErrors: [...consoleErrors],
          timestamp: new Date().toISOString(),
        };
        auditResults.push(result);

        const fails = result.apiCalls.filter(c => c.verdict === 'FAIL').length;
        const warns = result.apiCalls.filter(c => c.verdict === 'WARN').length;
        console.log(`  ${tabName}: ${result.apiCalls.length} API calls (${fails} FAIL, ${warns} WARN), ${result.consoleErrors.length} console errors`);
      }

      // --- Build and output report ---
      const report = buildAuditReport(`RN ${role.sessionName} (${role.username})`, auditResults, startedAt);
      printApiAuditSummary(report);
      saveAuditReport(report, `api-audit-rn-${role.sessionName.toLowerCase()}.json`);
    });
  }
});
