/**
 * Shared helpers for E2E comprehensive tests
 * - Login, page check, evidence collection, permission matrix
 */

// ===== CONSTANTS =====

export const BASE = process.env.E2E_ADMIN_URL || 'http://139.196.165.140:8086';
export const PASSWORD = process.env.E2E_PASSWORD || '123456';

// Route → Module mapping (from web-admin/src/router/index.ts)
export const ROUTE_MODULE_MAP = {
  '/dashboard': 'dashboard',
  '/dashboard/production-progress': 'dashboard',
  '/production/batches': 'production',
  '/production/plans': 'production',
  '/production/bom': 'production',
  '/production/approval': 'production',
  '/production/bom-achievement': 'production',
  '/production/process-io': 'production',
  '/production/material-requisitions': 'production',
  '/warehouse/materials': 'warehouse',
  '/warehouse/shipments': 'warehouse',
  '/warehouse/inventory': 'warehouse',
  '/warehouse/reusable-containers': 'warehouse',
  '/warehouse/material-price-trend': 'warehouse',
  '/transfer/list': 'warehouse',
  '/quality/inspections': 'quality',
  '/quality/disposals': 'quality',
  '/quality/standards': 'quality',
  '/procurement/orders': 'procurement',
  '/procurement/suppliers': 'procurement',
  '/procurement/price-lists': 'procurement',
  '/sales/orders': 'sales',
  '/sales/quotes': 'sales',
  '/sales/finished-goods': 'sales',
  '/sales/customers': 'sales',
  '/sales/shipments': 'sales',
  '/hr/employees': 'hr',
  '/hr/attendance': 'hr',
  '/hr/whitelist': 'hr',
  '/hr/departments': 'hr',
  '/equipment/list': 'equipment',
  '/equipment/maintenance': 'equipment',
  '/equipment/alerts': 'equipment',
  '/finance/costs': 'finance',
  '/finance/reports': 'finance',
  '/finance/ar-ap': 'finance',
  '/finance/sku-margin': 'finance',
  '/finance/invoices': 'finance',
  '/finance/payments': 'finance',
  '/rd/samples': 'production',       // R&D under production module
  '/rd/converted': 'production',
  '/system/users': 'system',
  '/system/roles': 'system',
  '/system/logs': 'system',
  '/system/settings': 'system',
  '/system/ai-intents': 'system',
  '/system/skill-tools': 'system',
  '/system/products': 'system',
  '/system/features': 'system',
  '/system/pos': 'system',
  '/system/work-processes': 'system',
  '/system/product-processes': 'system',
  '/system/workflow-designer': 'system',
  '/system/smartbi-config': 'system',
  '/system/smartbi-config/data-sources': 'system',
  '/system/smartbi-config/chart-templates': 'system',
  '/system/badge-generator': 'system',
  '/analytics/overview': 'analytics',
  '/analytics/trends': 'analytics',
  '/analytics/ai-reports': 'analytics',
  '/analytics/kpi': 'analytics',
  '/analytics/production-report': 'analytics',
  '/analytics/alert-dashboard': 'analytics',
  '/analytics/supply-chain': 'analytics',
  '/calibration/list': 'system',       // calibration under system
  '/scheduling/overview': 'scheduling',
  '/scheduling/plans': 'scheduling',
  '/scheduling/realtime': 'scheduling',
  '/scheduling/workers': 'scheduling',
  '/scheduling/alerts': 'scheduling',
  '/restaurant/requisitions': 'restaurant',
  '/restaurant/wastage': 'restaurant',
  '/restaurant/recipes': 'restaurant',
  '/restaurant/stocktaking': 'restaurant',
  '/restaurant/analytics': 'restaurant',
  '/restaurant/analytics/menu': 'restaurant',
  '/restaurant/analytics/stores': 'restaurant',
  '/restaurant/analytics/dianping': 'restaurant',
  '/production-analytics/production': 'analytics',
  '/production-analytics/efficiency': 'analytics',
  '/smart-bi/dashboard': 'analytics',
  '/smart-bi/finance': 'analytics',
  '/smart-bi/sales': 'analytics',
  '/smart-bi/query': 'analytics',
  '/smart-bi/query-templates': 'analytics',
  '/smart-bi/analysis': 'analytics',
  '/smart-bi/upload': 'analytics',
  '/smart-bi/data-completeness': 'analytics',
  '/smart-bi/food-kb-feedback': 'analytics',
  '/smart-bi/calibration': 'analytics',
  '/smart-bi/financial-dashboard': 'analytics',
  '/smart-bi/whatif': 'analytics',
  '/smart-bi/restaurant-v2': 'analytics',
  '/canvas-editor': '__roles__',  // special: checked by meta.roles, not module
};

// All 94 testable routes
export const ALL_ROUTES = Object.keys(ROUTE_MODULE_MAP);

// Permission matrix from store/modules/permission.ts (authoritative)
export const PERMISSION_MATRIX = {
  factory_super_admin: { dashboard:'rw',production:'rw',warehouse:'rw',quality:'rw',procurement:'rw',sales:'rw',hr:'rw',equipment:'rw',finance:'rw',system:'rw',analytics:'rw',scheduling:'rw',restaurant:'rw' },
  platform_admin:      { dashboard:'rw',production:'rw',warehouse:'rw',quality:'rw',procurement:'rw',sales:'rw',hr:'rw',equipment:'rw',finance:'rw',system:'rw',analytics:'rw',scheduling:'rw',restaurant:'rw' },
  hr_admin:            { dashboard:'r',production:'-',warehouse:'-',quality:'-',procurement:'-',sales:'-',hr:'rw',equipment:'-',finance:'-',system:'r',analytics:'-',scheduling:'-',restaurant:'-' },
  procurement_manager: { dashboard:'r',production:'r',warehouse:'r',quality:'-',procurement:'rw',sales:'-',hr:'-',equipment:'-',finance:'r',system:'-',analytics:'-',scheduling:'-',restaurant:'-' },
  sales_manager:       { dashboard:'r',production:'r',warehouse:'r',quality:'-',procurement:'-',sales:'rw',hr:'-',equipment:'-',finance:'r',system:'-',analytics:'r',scheduling:'-',restaurant:'-' },
  dispatcher:          { dashboard:'rw',production:'rw',warehouse:'r',quality:'r',procurement:'r',sales:'r',hr:'r',equipment:'r',finance:'r',system:'r',analytics:'rw',scheduling:'rw',restaurant:'r' },
  production_manager:  { dashboard:'rw',production:'rw',warehouse:'r',quality:'r',procurement:'r',sales:'r',hr:'r',equipment:'r',finance:'r',system:'r',analytics:'rw',scheduling:'rw',restaurant:'r' },
  warehouse_manager:   { dashboard:'r',production:'r',warehouse:'rw',quality:'-',procurement:'r',sales:'r',hr:'-',equipment:'-',finance:'-',system:'-',analytics:'-',scheduling:'r',restaurant:'-' },
  equipment_admin:     { dashboard:'r',production:'r',warehouse:'-',quality:'-',procurement:'-',sales:'-',hr:'-',equipment:'rw',finance:'-',system:'-',analytics:'-',scheduling:'-',restaurant:'-' },
  quality_manager:     { dashboard:'r',production:'r',warehouse:'-',quality:'rw',procurement:'-',sales:'-',hr:'-',equipment:'-',finance:'-',system:'-',analytics:'-',scheduling:'-',restaurant:'-' },
  finance_manager:     { dashboard:'r',production:'-',warehouse:'-',quality:'-',procurement:'-',sales:'r',hr:'-',equipment:'-',finance:'rw',system:'-',analytics:'r',scheduling:'-',restaurant:'-' },
  restaurant_manager:  { dashboard:'r',production:'-',warehouse:'-',quality:'-',procurement:'r',sales:'-',hr:'-',equipment:'-',finance:'r',system:'-',analytics:'r',scheduling:'-',restaurant:'rw' },
  workshop_supervisor: { dashboard:'r',production:'r',warehouse:'r',quality:'w',procurement:'-',sales:'-',hr:'r',equipment:'r',finance:'-',system:'-',analytics:'-',scheduling:'r',restaurant:'-' },
  viewer:              { dashboard:'r',production:'r',warehouse:'r',quality:'r',procurement:'r',sales:'r',hr:'-',equipment:'r',finance:'-',system:'-',analytics:'r',scheduling:'r',restaurant:'r' },
};

// FACTORY type blocks restaurant module
export const FACTORY_TYPE_FILTER = { restaurant: '-' };

// finance_manager route whitelist (guards.ts:22-33)
export const FINANCE_MANAGER_WHITELIST = [
  '/dashboard',
  '/smart-bi/dashboard',
  '/smart-bi/finance',
  '/smart-bi/financial-dashboard',
  '/smart-bi/sales',
  '/smart-bi/query',
  '/smart-bi/query-templates',
  '/smart-bi/analysis',
  '/403',
  '/404',
];

// canvas-editor allowed roles
export const CANVAS_EDITOR_ROLES = ['platform_admin', 'permission_admin'];

// Mobile-only roles
export const MOBILE_ONLY_ROLES = ['operator', 'quality_inspector', 'warehouse_worker'];

// ===== EXPECTED RESULT CALCULATOR =====

/**
 * Calculate expected result for a route given role and factory type
 * @returns 'OK' | '403' | '403_whitelist' | 'MOBILE_ONLY'
 */
export function expectedResult(route, role, factoryType = 'FACTORY') {
  // Mobile-only roles → redirected at login
  if (MOBILE_ONLY_ROLES.includes(role)) return 'MOBILE_ONLY';

  // finance_manager whitelist check (happens before module check in guards)
  if (role === 'finance_manager') {
    const allowed = FINANCE_MANAGER_WHITELIST.some(
      prefix => route === prefix || route.startsWith(prefix + '/')
    );
    if (!allowed) return '403_whitelist';
  }

  // canvas-editor: checked by meta.roles
  if (route === '/canvas-editor') {
    return CANVAS_EDITOR_ROLES.includes(role) ? 'OK' : '403';
  }

  // Module permission check
  const module = ROUTE_MODULE_MAP[route];
  if (!module || module === '__roles__') return 'OK'; // no module restriction

  // Apply factory type filter
  if (factoryType === 'FACTORY' && FACTORY_TYPE_FILTER[module] === '-') return '403';
  if (factoryType === 'RESTAURANT') {
    const restFilter = { production:'-', warehouse:'-', quality:'-', equipment:'-', scheduling:'-' };
    if (restFilter[module] === '-') return '403';
  }

  // Role permission
  const perms = PERMISSION_MATRIX[role];
  if (!perms) return '403';
  const level = perms[module];
  if (!level || level === '-') return '403';

  return 'OK';
}

// ===== BROWSER HELPERS =====

export async function login(page, username, password = PASSWORD) {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait up to 30s for Vue to render login form
    await page.waitForSelector('input.el-input__inner', { timeout: 30000 });
    await page.fill('input.el-input__inner[placeholder="请输入用户名"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button.login-button');

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const url = page.url();
      if (!url.includes('/login')) {
        if (url.includes('/mobile-only')) return 'MOBILE_ONLY';
        return 'OK';
      }
    }
    return 'LOGIN_FAILED';
  } catch (e) {
    return 'LOGIN_ERROR';
  }
}

export async function checkPage(page, route, expectedHint) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Poll for up to 15s: check URL redirects + Vue render state
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      const url = page.url();
      if (url.includes('/403')) return '403';
      if (url.includes('/login')) return 'REDIRECT_LOGIN';
      if (url.includes('/404')) return '404';
      if (url.includes('/mobile-only')) return 'MOBILE_ONLY';
      // Check if Vue app has rendered (innerHTML > 100 means components mounted)
      const rendered = await page.evaluate(() => {
        const app = document.querySelector('#app');
        const len = app?.innerHTML?.length || 0;
        return { len, hasMenu: !!document.querySelector('.el-menu,.app-sidebar'), text: document.body?.innerText?.trim()?.length || 0 };
      });
      if (rendered.text >= 10 || rendered.hasMenu || rendered.len > 500) {
        // Page rendered — check for errors
        const hasToast = !!(await page.$('.el-message--error'));
        if (hasToast) return 'ERROR_TOAST';
        return 'OK';
      }
    }
    // Final check after 15s
    const hasToast = !!(await page.$('.el-message--error'));
    if (hasToast) return 'ERROR_TOAST';
    const finalLen = await page.evaluate(() => document.querySelector('#app')?.innerHTML?.length || 0);
    if (finalLen > 100) return 'OK';
    return 'BLANK';
  } catch (e) {
    return 'TIMEOUT';
  }
}

export function resultIcon(actual, expected) {
  if (actual === expected) return '✓';
  if (actual === 'OK' && (expected === 'OK')) return '✓';
  if (actual === '403' && (expected === '403' || expected === '403_whitelist')) return '✓';
  if (actual === '403_whitelist') return '✓'; // not a real status, just for expected
  return '✗';
}

export function isPass(actual, expected) {
  if (actual === expected) return true;
  if (actual === '403' && expected === '403_whitelist') return true;
  if (actual === 'OK' && expected === 'OK') return true;
  return false;
}
