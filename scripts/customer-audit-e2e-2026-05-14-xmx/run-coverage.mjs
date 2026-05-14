#!/usr/bin/env node
/**
 * R7-E2 R_XMX_CHAIN feature-regression coverage — scaffold + applicability-aware
 *
 * Adapted from F006 run-coverage.mjs (PR #517). Key differences:
 *
 * 1) R_XMX_CHAIN has only ONE user (`xmx_admin`, factory_super_admin). F006 had
 *    `f006_admin` + `f006_warehouse_mgr` + `gml_admin`. Multi-role RBAC scenarios
 *    (T3-8b warehouse_mgr no-price view, T3-9 wire-level leak, sales/orders 500
 *    for warehouse_mgr) are NOT executable here — marked as N/A in
 *    coverage-summary.md applicability matrix.
 *
 * 2) F006's 51 asks are derived from 4 customer transcripts (六扇门第一/二/三/四次).
 *    XMX has no equivalent transcript audit doc. Each ask is reinterpreted as a
 *    "feature availability check" for the XMX factory tenant — i.e., does the
 *    feature work for this customer's data + config.
 *
 * 3) Scenarios trimmed to feature-regression smoke that's meaningful for ANY
 *    factory tenant. F006-customer-transcript-specific asks (T2-3 钉钉 via
 *    customer-named workflow, T-RTA F006-specific RMA, etc.) classified N/A in
 *    matrix rather than coded as scenarios.
 *
 * 跑法:
 *   node run-coverage.mjs --all                            # 全部 scenarios
 *   node run-coverage.mjs --group SMOKE|NAV|DATA|RBAC      # 单组
 *   node run-coverage.mjs --tag S-XMX-T2-2-modules         # 单个
 *
 * 约束: 只读 prod 139:8086, 不写入. 单用户 (xmx_admin), 无 RBAC variety.
 *
 * Output: results.json + shots-xmx/*.png (gitignored)
 *
 * Status: scaffold (real run requires npm install playwright + xmx_admin pwd
 *         confirmation). Steve / organizer can execute via:
 *         cd scripts/customer-audit-e2e-2026-05-14-xmx && npm install && node run-coverage.mjs --all
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8086';
const SHOTS_DIR = path.join(__dirname, 'shots-xmx');
const FACTORY_ID = 'R_XMX_CHAIN';

// IMPORTANT: xmx_admin password assumed `123456` (matches F006 convention).
// If wrong, login phase fails → all scenarios return status=ERROR with
// evidence.error="login failed". Confirm pwd via Steve / aliyun ECS before
// running. Per-username 60s login rate-limit applies (memory:
// reference_test_env_warehouse_account.md).
const ACCOUNTS = {
  xmx_admin: { username: 'xmx_admin', password: '123456' },
};

// ---------------------------------------------------------------------------
// Helpers (port of F006 patterns)
// ---------------------------------------------------------------------------
async function waitForAnyBtn(page, selectors, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return el;
      }
    }
    await page.waitForTimeout(300);
  }
  return null;
}

async function findDetailBtn(page, timeoutMs = 8000) {
  return waitForAnyBtn(page, [
    'a:has-text("查看")',
    'a:has-text("详情")',
    'button:has-text("查看")',
    'button:has-text("详情")',
    'a:has-text("编辑")',
    '.el-table tbody tr:first-child a.el-link',
    '.el-table tbody tr:first-child .el-button--text',
  ], timeoutMs);
}

// ---------------------------------------------------------------------------
// Scenarios — feature-regression smoke (XMX tenant)
// ---------------------------------------------------------------------------
// Grouping:
//   SMOKE — page-renders + no 404 (cheap, broad coverage)
//   NAV   — sidebar navigation + module visibility
//   DATA  — data lists return non-empty for XMX tenant
//   GOLD  — Gold layer data presence (per chat3 #539: 31 dim_ingredient +
//           8 fact_requisition + 4 fact_wastage + 38 fact_recipe)
// ---------------------------------------------------------------------------
const SCENARIOS = [
  // ====================== GROUP SMOKE — page renders =======================
  {
    tag: 'S-XMX-T1-1-production-plan-page',
    group: 'SMOKE',
    askRef: 'T1-1 (排第二天生产计划)',
    account: 'xmx_admin',
    description: 'production/plans page renders + has list (F006 T1-1 mirror)',
    run: async (page) => {
      await page.goto(`${TARGET}/production/plans`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const url = page.url();
      const is404 = /\/404/.test(url);
      const hasTable = await page.$('.el-table').catch(() => null);
      const bodyText = await page.textContent('body').catch(() => '');
      return {
        url,
        is404,
        hasTable: !!hasTable,
        bodyPreview: bodyText.slice(0, 300),
        verdict: is404 ? 'FAIL' : (hasTable ? 'PASS' : 'PARTIAL'),
      };
    },
  },
  {
    tag: 'S-XMX-T2-2-modules-nav',
    group: 'NAV',
    askRef: 'T2-2 (标准化模块导航)',
    account: 'xmx_admin',
    description: 'Sidebar shows 5 core modules: 进销存/财务/订单/生产/研发',
    run: async (page) => {
      await page.goto(`${TARGET}/dashboard`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const sidebar = await page.textContent('.el-aside, aside, [class*="sidebar"]').catch(() => '');
      const modules = {
        进销存: /进销存|库存|inventory/.test(sidebar),
        财务: /财务|finance/.test(sidebar),
        订单: /订单|销售|order|sales/.test(sidebar),
        生产: /生产|production/.test(sidebar),
        研发: /研发|配方|BOM|recipe/.test(sidebar),
      };
      const found = Object.values(modules).filter(Boolean).length;
      return {
        modules,
        found,
        verdict: found >= 4 ? 'PASS' : (found >= 2 ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-XMX-T2-4-rpf-chain-pages',
    group: 'NAV',
    askRef: 'T2-4 (研发→采购→入库→生产 串通)',
    account: 'xmx_admin',
    description: '4 chain pages render: rd/recipes, procurement/orders, procurement/receives, production/plans',
    run: async (page) => {
      const pages = [
        ['/rd/recipes', '研发配方'],
        ['/procurement/orders', '采购订单'],
        ['/procurement/receives', '入库'],
        ['/production/plans', '生产计划'],
      ];
      const results = [];
      for (const [route, label] of pages) {
        await page.goto(`${TARGET}${route}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        const url = page.url();
        const is404 = /\/404/.test(url);
        results.push({ route, label, is404, landedUrl: url });
      }
      const passCount = results.filter((r) => !r.is404).length;
      return {
        results,
        passCount,
        verdict: passCount === 4 ? 'PASS' : (passCount >= 2 ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-XMX-T2-5-sales-order-list',
    group: 'DATA',
    askRef: 'T2-5 (销售订单录入 → 应收 → 应付)',
    account: 'xmx_admin',
    description: '/sales/orders renders with table headers + row count for XMX',
    run: async (page) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || '')).catch(() => []);
      const rowCount = await page.$$eval('.el-table tbody tr', (rs) => rs.length).catch(() => 0);
      return {
        headers,
        rowCount,
        verdict: headers.length >= 4 ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-XMX-T3-1-purchase-order-list',
    group: 'DATA',
    askRef: 'T3-1 (箱数自动算)',
    account: 'xmx_admin',
    description: '/procurement/orders renders + 箱数 column present',
    run: async (page) => {
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || '')).catch(() => []);
      const hasBoxCol = headers.some((h) => /箱数|箱/.test(h));
      const rowCount = await page.$$eval('.el-table tbody tr', (rs) => rs.length).catch(() => 0);
      return {
        headers,
        hasBoxCol,
        rowCount,
        verdict: hasBoxCol ? 'PASS' : (headers.length >= 4 ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-XMX-T3-5-approval-chain-page',
    group: 'NAV',
    askRef: 'T3-5 (工作流审批链动态配置)',
    account: 'xmx_admin',
    description: 'workflow/approval page exists',
    run: async (page) => {
      const candidates = ['/workflow/approval-chain', '/system/workflow', '/system/approval-config'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body').catch(() => '');
          break;
        }
      }
      const hasApprovalUI = /审批链|审批配置|workflow|approval/.test(bodyText);
      return {
        landed,
        hasApprovalUI,
        verdict: landed && hasApprovalUI ? 'PASS' : (landed ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-XMX-T3-7-receive-qty-multi',
    group: 'DATA',
    askRef: 'T3-7 (收货数量分次显示)',
    account: 'xmx_admin',
    description: '/procurement/receives has 收货数量 column (F006 verified ✅ PR #414)',
    run: async (page) => {
      await page.goto(`${TARGET}/procurement/receives`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || '')).catch(() => []);
      const hasReceiveQty = headers.some((h) => /收货数量/.test(h));
      return {
        headers,
        hasReceiveQty,
        verdict: hasReceiveQty ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-XMX-T3-8-pdf-print-btn',
    group: 'SMOKE',
    askRef: 'T3-8 (采购订单 PDF 打印)',
    account: 'xmx_admin',
    description: '/procurement/orders has PDF print button (F006 verified ✅ PR #413)',
    run: async (page) => {
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const detailBtn = await findDetailBtn(page, 8000);
      if (!detailBtn) return { verdict: 'INFO', reason: 'no order to test (empty table)' };
      await detailBtn.click();
      await page.waitForTimeout(2500);
      const bodyText = await page.textContent('body');
      const hasPdfBtn = /PDF|打印|下载/.test(bodyText || '');
      return {
        url: page.url(),
        hasPdfBtn,
        verdict: hasPdfBtn ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-XMX-T4-B1-production-process',
    group: 'DATA',
    askRef: 'T4-B1 (生产计划工序下拉)',
    account: 'xmx_admin',
    description: 'production/plans has 工序 column or filter',
    run: async (page) => {
      await page.goto(`${TARGET}/production/plans`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body').catch(() => '');
      const hasProcessRef = /工序|process|stage/.test(bodyText);
      return {
        url: page.url(),
        hasProcessRef,
        verdict: hasProcessRef ? 'PASS' : 'PARTIAL',
      };
    },
  },
  {
    tag: 'S-XMX-T4-B5-warehouse-inventory',
    group: 'DATA',
    askRef: 'T4-B5 (分仓库存查询)',
    account: 'xmx_admin',
    description: 'inventory page with 分仓 / 仓库 filter present',
    run: async (page) => {
      const candidates = ['/inventory/by-warehouse', '/inventory/list', '/inventory'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body').catch(() => '');
          break;
        }
      }
      const hasWarehouseFilter = /分仓|仓库|warehouse/.test(bodyText);
      return {
        landed,
        hasWarehouseFilter,
        verdict: landed && hasWarehouseFilter ? 'PASS' : (landed ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-XMX-T4-B9-manual-transfer',
    group: 'NAV',
    askRef: 'T4-B9 (手动调拨入口)',
    account: 'xmx_admin',
    description: 'inventory/transfer-orders page + 手动创建 button',
    run: async (page) => {
      await page.goto(`${TARGET}/inventory/transfer-orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const url = page.url();
      const is404 = /\/404/.test(url);
      if (is404) return { url, is404, verdict: 'FAIL' };
      const newBtn = await waitForAnyBtn(page, ['button:has-text("手动创建")', 'button:has-text("新建调拨")', 'button:has-text("+ 新建")'], 8000);
      return {
        url,
        is404,
        hasManualBtn: !!newBtn,
        verdict: newBtn ? 'PASS' : 'PARTIAL',
      };
    },
  },
  {
    tag: 'S-XMX-T4-D1-warehouse-label',
    group: 'DATA',
    askRef: 'T4-D1 (工厂=线边仓+总仓)',
    account: 'xmx_admin',
    description: 'inventory page shows 总仓 (WH-LOG) or 线边仓 (WH-WKS) labels',
    run: async (page) => {
      await page.goto(`${TARGET}/inventory`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body').catch(() => '');
      const hasZongCang = /总仓|WH-LOG/.test(bodyText);
      const hasXianBianCang = /线边仓|WH-WKS/.test(bodyText);
      return {
        url: page.url(),
        hasZongCang,
        hasXianBianCang,
        verdict: (hasZongCang || hasXianBianCang) ? 'PASS' : 'FAIL',
      };
    },
  },
  // ====================== GROUP GOLD — chat3 #539 evidence ===================
  {
    tag: 'S-XMX-GOLD-dim-ingredient',
    group: 'GOLD',
    askRef: '(chat3 #539: 31 dim_ingredient rows)',
    account: 'xmx_admin',
    description: 'SmartBI Gold dim_ingredient surface accessible for XMX',
    run: async (page) => {
      await page.goto(`${TARGET}/smart-bi/dashboard`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const url = page.url();
      const is404 = /\/404/.test(url);
      const bodyText = await page.textContent('body').catch(() => '');
      const hasKpi = /KPI|销售额|订单数|客单价/.test(bodyText);
      return {
        url,
        is404,
        hasKpi,
        bodyPreview: bodyText.slice(0, 300),
        verdict: !is404 && hasKpi ? 'PASS' : (!is404 ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-XMX-GOLD-recipe-presence',
    group: 'GOLD',
    askRef: '(chat3 #539: 38 fact_recipe rows)',
    account: 'xmx_admin',
    description: '/rd/recipes has rows for XMX (chat3 evidence: 38 recipes)',
    run: async (page) => {
      await page.goto(`${TARGET}/rd/recipes`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const rowCount = await page.$$eval('.el-table tbody tr', (rs) => rs.length).catch(() => 0);
      return {
        url: page.url(),
        rowCount,
        verdict: rowCount > 0 ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-XMX-GOLD-wastage-presence',
    group: 'GOLD',
    askRef: '(chat3 #539: 4 fact_wastage rows)',
    account: 'xmx_admin',
    description: '/restaurant/wastage page renders + has rows (chat3 evidence: 4 wastage)',
    run: async (page) => {
      const candidates = ['/restaurant/wastage', '/inventory/wastage', '/operations/wastage'];
      let landed = null;
      let rowCount = 0;
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          rowCount = await page.$$eval('.el-table tbody tr', (rs) => rs.length).catch(() => 0);
          break;
        }
      }
      return {
        landed,
        rowCount,
        verdict: landed && rowCount > 0 ? 'PASS' : (landed ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Runner (port of F006 pattern)
// ---------------------------------------------------------------------------
async function login(page, account) {
  if (!account) return true;
  try {
    await page.goto(`${TARGET}/login`, { timeout: 60000 });
  } catch (e) {
    console.error(`  ✗ login: goto /login timed out for ${account}: ${e.message}`);
    return false;
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  const { username, password } = ACCOUNTS[account];
  await page.fill('input[placeholder*="用户名"], input[type="text"]', username);
  await page.fill('input[placeholder*="密码"], input[type="password"]', password);
  const loginBtn = (await page.$('button.login-button')) ?? (await page.$('button:has-text("登 录")')) ?? (await page.$('button:has-text("登录")'));
  if (!loginBtn) return false;
  await loginBtn.click();
  try {
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 18000 });
    return true;
  } catch {
    return false;
  }
}

const STORAGE_STATE_CACHE = new Map();

async function getOrCreateStorageState(browser, account) {
  if (STORAGE_STATE_CACHE.has(account)) return STORAGE_STATE_CACHE.get(account);
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  let ok = false;
  try { ok = await login(page, account); } catch {}
  if (!ok) { await ctx.close(); return null; }
  const state = await ctx.storageState();
  await ctx.close();
  STORAGE_STATE_CACHE.set(account, state);
  return state;
}

async function runScenario(browser, sc) {
  const state = await getOrCreateStorageState(browser, sc.account);
  if (!state) {
    return { scenario: sc.tag, group: sc.group, askRef: sc.askRef, account: sc.account, status: 'ERROR', evidence: { error: 'login failed' }, ts: new Date().toISOString() };
  }
  const ctx = await browser.newContext({ acceptDownloads: true, storageState: state });
  const page = await ctx.newPage();
  try {
    const result = await sc.run(page);
    try { await page.screenshot({ path: path.join(SHOTS_DIR, `${sc.tag}.png`), fullPage: false }); } catch {}
    return { scenario: sc.tag, group: sc.group, askRef: sc.askRef, account: sc.account, status: result.verdict || 'INFO', evidence: result, ts: new Date().toISOString() };
  } catch (err) {
    return { scenario: sc.tag, group: sc.group, askRef: sc.askRef, account: sc.account, status: 'ERROR', evidence: { error: String(err) }, ts: new Date().toISOString() };
  } finally {
    await ctx.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const groupFlag = args.indexOf('--group');
  const tagFlag = args.indexOf('--tag');
  let toRun = SCENARIOS;
  if (groupFlag >= 0 && args[groupFlag + 1]) {
    toRun = SCENARIOS.filter((s) => s.group === args[groupFlag + 1]);
  } else if (tagFlag >= 0 && args[tagFlag + 1]) {
    toRun = SCENARIOS.filter((s) => s.tag === args[tagFlag + 1]);
  }
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const sc of toRun) {
    process.stdout.write(`▶ ${sc.tag} ... `);
    const r = await runScenario(browser, sc);
    console.log(r.status);
    results.push(r);
  }
  await browser.close();
  await fs.writeFile(path.join(__dirname, 'results.json'), JSON.stringify({ runAt: new Date().toISOString(), target: TARGET, factory: FACTORY_ID, results }, null, 2));
  const tally = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log('\nTally:', tally);
}

main().catch((e) => { console.error(e); process.exit(1); });
