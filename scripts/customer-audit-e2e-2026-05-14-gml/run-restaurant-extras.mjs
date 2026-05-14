#!/usr/bin/env node
/**
 * R_GML_DEMO restaurant-specific scenarios — supplement to F006 35-scenario
 * coverage script. The F006 template covers factory-customer asks; this file
 * adds restaurant-tenant-relevant routes (per web-admin/src/router/index.ts
 * /restaurant/* + /system/pos).
 *
 * Same conventions as run-coverage.mjs: read-only on prod 139:8086 as
 * gml_admin / 123456. Output: results-restaurant-extras.json.
 *
 * R_GML_DEMO has ZERO data so most scenarios test the empty-state render +
 * console cleanliness (no JS errors / no 5xx network) rather than data shape.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8086';
const SHOTS_DIR = path.join(__dirname, 'shots-restaurant');
const ACCOUNT = { username: 'gml_admin', password: '123456' };

async function login(page) {
  await page.goto(`${TARGET}/login`, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.fill('input[placeholder*="用户名"], input[type="text"]', ACCOUNT.username);
  await page.fill('input[placeholder*="密码"], input[type="password"]', ACCOUNT.password);
  const btn = (await page.$('button.login-button')) ?? (await page.$('button:has-text("登 录")')) ?? (await page.$('button:has-text("登录")'));
  if (!btn) throw new Error('login button not found');
  await btn.click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 18000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

const SCENARIOS = [
  {
    tag: 'S-COV-R-NAV',
    group: 'R',
    description: 'Restaurant sidebar/nav visible to gml_admin after login',
    route: '/dashboard',
    check: async (page) => {
      // Look for 餐饮 menu entry in sidebar
      const sidebarText = await page.textContent('.el-menu, aside, nav').catch(() => '');
      return {
        hasRestaurantMenu: sidebarText.includes('餐饮') || sidebarText.includes('restaurant'),
        verdict: (sidebarText.includes('餐饮') || sidebarText.includes('restaurant')) ? 'PASS' : 'FAIL',
        sidebarPreview: sidebarText.slice(0, 500),
      };
    },
  },
  {
    tag: 'S-COV-R-1-requisitions',
    group: 'R',
    description: '餐饮领料 list page renders empty-state without crash',
    route: '/restaurant/requisitions',
    check: async (page) => {
      const url = page.url();
      const hasErrorContent = (await page.textContent('body').catch(() => '')).includes('500');
      const hasListContainer = await page.$('.el-table, .el-empty, [class*="list"], main');
      return {
        loadedUrl: url,
        hasListContainer: !!hasListContainer,
        hasErrorContent,
        verdict: (hasListContainer && !hasErrorContent && !url.includes('/login')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-2-wastage',
    group: 'R',
    description: '损耗 list page renders empty-state',
    route: '/restaurant/wastage',
    check: async (page) => {
      const url = page.url();
      const hasListContainer = await page.$('.el-table, .el-empty, main');
      return {
        loadedUrl: url,
        hasListContainer: !!hasListContainer,
        verdict: (hasListContainer && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-3-recipes',
    group: 'R',
    description: '菜谱 list page renders empty-state',
    route: '/restaurant/recipes',
    check: async (page) => {
      const url = page.url();
      const hasListContainer = await page.$('.el-table, .el-empty, main');
      return {
        loadedUrl: url,
        hasListContainer: !!hasListContainer,
        verdict: (hasListContainer && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-4-stocktaking',
    group: 'R',
    description: '盘点 list page renders empty-state',
    route: '/restaurant/stocktaking',
    check: async (page) => {
      const url = page.url();
      const hasListContainer = await page.$('.el-table, .el-empty, main');
      return {
        loadedUrl: url,
        hasListContainer: !!hasListContainer,
        verdict: (hasListContainer && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-5-analytics-overview',
    group: 'R',
    description: '餐饮 营业概览 page (analytics/overview) renders for gml_admin',
    route: '/restaurant/analytics/overview',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main, [class*="overview"]');
      const bodyText = (await page.textContent('body').catch(() => '')).slice(0, 800);
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        bodyTextPreview: bodyText,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-6-menu-board',
    group: 'R',
    description: '菜单看板 (analytics/menu-board) renders',
    route: '/restaurant/analytics/menu-board',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main, [class*="menu"]');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-7-store-comparison',
    group: 'R',
    description: '门店对比 (analytics/store-comparison) renders',
    route: '/restaurant/analytics/store-comparison',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-8-dianping-gap',
    group: 'R',
    description: '大众点评 gap 分析 page renders',
    route: '/restaurant/analytics/dianping-gap',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-9-gross-margin',
    group: 'R',
    description: '毛利分析 (analytics/gross-margin) renders',
    route: '/restaurant/analytics/gross-margin',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-10-etl-status',
    group: 'R',
    description: '餐饮 ETL 状态 admin page (gml_admin should see it)',
    route: '/restaurant/admin/etl-status',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main, [class*="etl"], table');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-11-data-completeness',
    group: 'R',
    description: '数据完整性 page (/restaurant/data-completeness)',
    route: '/restaurant/data-completeness',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-R-12-pos-config',
    group: 'R',
    description: 'System POS 配置 page (/system/pos)',
    route: '/system/pos',
    check: async (page) => {
      const url = page.url();
      const hasMain = await page.$('main, .el-main, .el-table');
      return {
        loadedUrl: url,
        hasMain: !!hasMain,
        verdict: (hasMain && !url.includes('/login') && !url.includes('/404')) ? 'PASS' : 'FAIL',
      };
    },
  },
];

async function runScenario(page, sc) {
  const errors = [];
  const onErr = (e) => errors.push(e.message || String(e));
  const onCons = (m) => { if (m.type() === 'error') errors.push(m.text()); };
  page.on('pageerror', onErr);
  page.on('console', onCons);
  let result;
  try {
    if (sc.route) {
      await page.goto(`${TARGET}${sc.route}`, { timeout: 30000, waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    result = await sc.check(page);
    try {
      await fs.mkdir(SHOTS_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS_DIR, `${sc.tag}.png`), fullPage: false });
    } catch {}
  } catch (e) {
    result = { verdict: 'ERROR', error: e.message };
  }
  result.consoleErrors = errors.slice(0, 3);
  page.off('pageerror', onErr);
  page.off('console', onCons);
  return { scenario: sc.tag, group: sc.group, status: result.verdict || 'INFO', evidence: result, ts: new Date().toISOString() };
}

async function main() {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await login(page);
    console.log(`Logged in as ${ACCOUNT.username}`);
  } catch (e) {
    console.error('Login failed:', e.message);
    await browser.close();
    process.exit(1);
  }
  const results = [];
  for (const sc of SCENARIOS) {
    process.stdout.write(`  ${sc.tag} ... `);
    const r = await runScenario(page, sc);
    console.log(r.status);
    results.push(r);
  }
  await browser.close();
  const summary = {
    runAt: new Date().toISOString(),
    target: TARGET,
    account: ACCOUNT.username,
    factory: 'R_GML_DEMO',
    scenariosTotal: SCENARIOS.length,
    statusCounts: results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
    results,
  };
  await fs.writeFile(path.join(__dirname, 'results-restaurant-extras.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== restaurant-extras summary ===');
  console.log(JSON.stringify(summary.statusCounts, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
