#!/usr/bin/env node
/**
 * 六扇门 (F006) follow-up E2E scenarios
 *
 * Generated from audit doc:
 *   docs/qa-audits/2026-05-13-liushanmen-coverage-gap-audit.md
 *
 * 覆盖:
 *   - P0 (5): demo-blocking 补丁链复测 (PR #443/#456/#457/#458/#466/#467)
 *   - P1 (11): audit doc 漏列 + weak evidence
 *   - P2 (5): 22 LIVE-only-未 verify 抽样
 *
 * 跑法:
 *   npm install playwright
 *   node run-e2e.mjs --p0       # 5 个 P0
 *   node run-e2e.mjs --p1       # 11 个 P1
 *   node run-e2e.mjs --p2       # 5 个 P2
 *   node run-e2e.mjs --all      # 全跑
 *   node run-e2e.mjs --tag S-RBAC-4-retest  # 单独一个
 *
 * 约束:
 *   - 只读 prod, 不写入
 *   - prod web-admin: http://139.196.165.140:8086
 *   - 账号: f006_admin / f006_warehouse_mgr / gml_admin (123456)
 *
 * 输出:
 *   results.json + shots/*.png
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8086';
const SHOTS_DIR = path.join(__dirname, 'shots');
const ACCOUNTS = {
  f006_admin: { username: 'f006_admin', password: '123456' },
  f006_warehouse_mgr: { username: 'f006_warehouse_mgr', password: '123456' },
  gml_admin: { username: 'gml_admin', password: '123456' },
};

// ---------------------------------------------------------------------------
// Scenario registry
// ---------------------------------------------------------------------------
const SCENARIOS = [
  // ========== P0 — demo-blocking 补丁链复测 ==========
  {
    tag: 'S-RBAC-1-retest',
    priority: 'P0',
    account: 'f006_warehouse_mgr',
    description: 'PR #467 v-if 验证: warehouse_mgr 进 /procurement/orders 看不到"总金额"列头',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || ''));
      const hasPriceCol = headers.some((h) => /总金额|单价|税额/.test(h));
      return {
        url: page.url(),
        headers,
        hasPriceCol,
        verdict: hasPriceCol ? 'FAIL — PR #467 not effective' : 'PASS',
      };
    },
  },
  {
    tag: 'S-RBAC-4-retest',
    priority: 'P0',
    account: 'f006_warehouse_mgr',
    description: 'PR #467 v-if + PR #458 NPE fix: warehouse_mgr 进 /sales/orders 看不到价格列且 API 不再 500',
    run: async (page, ctx) => {
      const requests = [];
      page.on('response', async (resp) => {
        const url = resp.url();
        if (/\/api\/mobile\/F006\/sales\/orders/.test(url)) {
          let body = '';
          try { body = await resp.text(); } catch {}
          requests.push({ url, status: resp.status(), body: body.slice(0, 500) });
        }
      });
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || ''));
      const hasPriceCol = headers.some((h) => /总金额|运费|折扣/.test(h));
      const apiStatuses = requests.map((r) => r.status);
      const has500 = apiStatuses.some((s) => s >= 500);
      const priceLeaks = requests.filter((r) =>
        /\"totalAmount\":\s*[0-9]/.test(r.body) ||
        /\"unitPrice\":\s*[0-9]/.test(r.body) ||
        /\"freightAmount\":\s*[0-9]/.test(r.body)
      );
      return {
        url: page.url(),
        headers,
        hasPriceCol,
        apiStatuses,
        has500,
        priceLeaks: priceLeaks.length,
        verdict: hasPriceCol || has500 || priceLeaks.length > 0 ? 'FAIL' : 'PASS',
      };
    },
  },
  {
    tag: 'S-RBAC-sales500-rootcause',
    priority: 'P0',
    account: null,  // server-side check, no browser needed
    description: 'Server log: grep 追踪码 39AFF3AD / 00D57286 from /www/wwwroot/cretas/cretas-prod.log',
    run: async () => {
      return {
        verdict: 'MANUAL',
        instructions: `ssh root@47.100.235.168 "grep -E '39AFF3AD|00D57286' /www/wwwroot/cretas/cretas-prod.log | head -50"`,
        expected: 'Stack trace identifying NPE source (PR #443 @PriceSensitive METHOD trigger). Should be resolved by PR #458 hardening.',
      };
    },
  },
  {
    tag: 'S-RBAC-pdf-warehouse',
    priority: 'P0',
    account: 'f006_warehouse_mgr',
    description: 'PR #456 binary export sweep: warehouse_mgr 下载采购单 PDF 不含价格',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const pdfBtns = await page.$$('button:has-text("PDF"), a:has-text("PDF")');
      const rowCount = await page.$$eval('tbody tr', (els) => els.length).catch(() => 0);
      if (pdfBtns.length === 0) {
        return rowCount > 0
          ? { verdict: 'PASS', note: 'PDF button hidden by role (warehouse_mgr cannot download price-bearing PDF)', rowCount }
          : { verdict: 'INFO', note: 'No rows to test PDF gating', rowCount };
      }
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        pdfBtns[0].click(),
      ]);
      if (!download) {
        return { verdict: 'FAIL', note: 'PDF button clicked but no download triggered' };
      }
      const pdfPath = await download.path();
      // pdf-parse not bundled; just check filename + size
      const stat = await fs.stat(pdfPath);
      return {
        verdict: 'INFO',
        filename: download.suggestedFilename(),
        sizeBytes: stat.size,
        manualCheck: `Open ${pdfPath} and verify no '总金额/单价/税额' present`,
      };
    },
  },
  {
    tag: 'S-RBAC-excel-warehouse',
    priority: 'P0',
    account: 'f006_warehouse_mgr',
    description: 'PR #456: Excel export 不含价格列 (any page with 导出 Excel button)',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/procurement/receives`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const excelBtns = await page.$$('button:has-text("导出"), button:has-text("Excel")');
      return {
        verdict: 'INFO',
        excelBtnsFound: excelBtns.length,
        note: excelBtns.length === 0
          ? 'No Excel export button — may be hidden by role'
          : 'Click and verify exported xlsx has no price columns',
      };
    },
  },

  // ========== P1 — audit doc 漏列 + weak evidence ==========
  {
    tag: 'S-T-B2-batch-select',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T4-B2 调拨批次选择: actual route /transfer/list (router/index.ts:187, NOT /inventory/transfer-orders)',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/transfer/list`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || ''));
      const hasCurrentStockCol = headers.some((h) => h.includes('现有库存'));  // T4-B4
      const rowCount = await page.$$eval('tbody tr', (els) => els.length);
      return {
        url: page.url(),
        is404: /\/404$/.test(page.url()),
        headers,
        hasCurrentStockCol,
        rowCount,
        verdict: /\/404$/.test(page.url()) ? 'FAIL — route still 404' : 'INFO',
      };
    },
  },
  {
    tag: 'S-T-B5-inv-load',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T4-B5 分仓库存查询: API 真返数据 (not 401)',
    run: async (page, ctx) => {
      const apis = [];
      page.on('response', (resp) => {
        if (/inventory\/by-warehouse/.test(resp.url())) {
          apis.push({ status: resp.status(), url: resp.url() });
        }
      });
      await page.goto(`${TARGET}/inventory/by-warehouse`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const has401 = apis.some((a) => a.status === 401);
      const has200 = apis.some((a) => a.status === 200);
      return {
        url: page.url(),
        apiCalls: apis.length,
        has401,
        has200,
        verdict: has401 ? 'FAIL — still 401 用户未登录' : has200 ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-T-D1-dialog',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T4-D1 双仓 label 在销售订单 dialog batch source 选择时显示',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const newBtn = await page.$('button:has-text("新建销售订单")');
      if (newBtn) await newBtn.click();
      await page.waitForTimeout(2000);
      const bodyText = await page.textContent('body');
      const hasZongCang = bodyText?.includes('总仓') || false;
      const hasXianBianCang = bodyText?.includes('线边仓') || false;
      const hasWhLog = bodyText?.includes('WH-LOG') || false;
      return {
        url: page.url(),
        hasZongCang,
        hasXianBianCang,
        hasWhLog,
        verdict: (hasZongCang || hasXianBianCang || hasWhLog) ? 'PASS' : 'FAIL — D1 label missing',
      };
    },
  },
  {
    tag: 'S-T-D2-form',
    priority: 'P1',
    account: 'gml_admin',
    description: 'T4-D2 餐饮配方 form 真打开 + yield-rate 字段可见 (W6)',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/restaurant/recipes`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const newBtn = await page.$('button:has-text("新增配方")');
      if (!newBtn) return { verdict: 'FAIL', note: 'No 新增配方 button' };
      await newBtn.click();
      await page.waitForTimeout(2000);
      const dialogText = (await page.$('.el-dialog'))
        ? await page.textContent('.el-dialog')
        : '';
      const yieldRateLabel = dialogText.includes('净料率') || dialogText.includes('出成率');
      return {
        url: page.url(),
        formOpened: dialogText.length > 0,
        yieldRateLabel,
        verdict: yieldRateLabel ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-T-B3-fourtuple',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T4-B3 Rule 8 four-tuple: 强制 start with insufficient stock (TEST ENV ONLY)',
    run: async () => {
      return {
        verdict: 'MANUAL',
        env: 'TEST',
        instructions: `
⚠ RUN ON TEST ENV ONLY — NOT prod (session is read-only on prod).
   Backend test API: http://47.100.235.168:10011 (Java) + :8084 (Python)
   Web-admin test UI: TBD — see B4.0 grep result (web-admin-test on 139)
1. Login as warehouse_mgr1 / factory_admin1 (F001 test seed) — NOT f006_admin (prod-only account)
2. API: POST http://47.100.235.168:10011/api/mobile/F001/production/plans (create PENDING with material > available)
3. API: POST http://47.100.235.168:10011/api/mobile/F001/production/plans/{id}/start
4. Verify response:
   - HTTP 400 with code = INSUFFICIENT_STOCK
   - body.message has actionable text
   - body.actionHint set
   - body.severity = WARN or ERROR
5. UI: check toast + sticky panel both shown
`,
      };
    },
  },
  {
    tag: 'S-T-D4-rpf',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T4-D4 RPF Path A/B: 生产消耗触发 RPF link',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/production/batches`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const rowCount = await page.$$eval('tbody tr', (els) => els.length).catch(() => 0);
      return {
        url: page.url(),
        rowCount,
        verdict: 'INFO',
        manualCheck: 'Click a completed batch → 详情 → verify raw_material consumption records visible',
      };
    },
  },
  {
    tag: 'S-T-D5-wh-log-fulfill',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T4-D5 销售从 WH-LOG 总仓出货 (TEST ENV ONLY — has 发货 write)',
    run: async () => {
      return {
        verdict: 'MANUAL',
        env: 'TEST',
        instructions: `
⚠ RUN ON TEST ENV ONLY — step 4 confirms outbound (write op).
   Backend test API: http://47.100.235.168:10011 (Java)
1. Login as factory_admin1 (F001 test seed)
2. Navigate to /sales/orders (test UI URL TBD per B4.0) → select first 已批准 F001 order → 详情 → 发货
3. In 发货 dialog, batch source dropdown should include WH-LOG (总仓)
4. Confirm send (writes to TEST DB only), then verify outbound record source === WH-LOG
`,
      };
    },
  },
  {
    tag: 'S-T-RTA-return',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T-RTA 退货流程 (audit doc 完全漏列): 有食物退货 + 无食物退款两条线',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body');
      const hasReturnEntry = /退货|售后/.test(bodyText || '');
      return {
        url: page.url(),
        hasReturnEntry,
        verdict: hasReturnEntry ? 'INFO' : 'FAIL — no 退货/售后 entry visible',
        manualCheck: 'If entry exists, test 申请退货 → 有食物 (库存调整) and 无食物 (财务退款) both work',
      };
    },
  },
  {
    tag: 'S-T-INV-collect',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T-INV 一键收款 + 财务审批闭环 (actual route /finance/payments, router:434)',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/finance/payments`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body');
      const hasOneClickConfirm = /一键确认|一键收款/.test(bodyText || '');
      return {
        url: page.url(),
        hasOneClickConfirm,
        verdict: 'INFO',
      };
    },
  },
  {
    tag: 'S-T-3-11-est-cost',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T3-11 预估成本暂时隐藏决策落地',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const firstDetailBtn = await page.$('a:has-text("详情"), button:has-text("详情")');
      if (firstDetailBtn) await firstDetailBtn.click();
      await page.waitForTimeout(2000);
      const bodyText = await page.textContent('body');
      const hasEstCost = /预估成本/.test(bodyText || '');
      return {
        url: page.url(),
        hasEstCost,
        verdict: hasEstCost ? 'FAIL — T3-11 decision not implemented' : 'PASS',
      };
    },
  },
  {
    tag: 'S-T-3-14-3price',
    priority: 'P1',
    account: 'f006_admin',
    description: 'T3-14 三价对比新采购后刷新 bug 是否修复 (TEST ENV ONLY — has 新建采购 write)',
    run: async () => {
      return {
        verdict: 'MANUAL',
        env: 'TEST',
        instructions: `
⚠ RUN ON TEST ENV ONLY — step 2 writes a new purchase order.
   Backend test API: http://47.100.235.168:10011 (Java)
1. Login as factory_admin1 (F001 test seed)
2. /procurement/orders (test UI URL TBD per B4.0) → 新建采购订单 (any new SKU on F001)
3. 立即看三价对比: should include the new entry without page refresh
4. If still stale → P2 ticket valid
`,
      };
    },
  },
  {
    tag: 'S-T-wire-rerun',
    priority: 'P1',
    account: 'f006_warehouse_mgr',
    description: 'S10-5 wire-level rerun with PR #464 regex fix: confirm 0 leak',
    run: async (page, ctx) => {
      const requests = [];
      page.on('response', async (resp) => {
        const url = resp.url();
        if (/\/api\/mobile\/F006\//.test(url) && resp.headers()['content-type']?.includes('json')) {
          let body = '';
          try { body = await resp.text(); } catch {}
          requests.push({ url, body });
        }
      });
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.goto(`${TARGET}/procurement/receives`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const priceTokens = ['totalAmount', 'unitPrice', 'taxAmount', 'taxRate', 'discountAmount', 'freightAmount', 'discountRate', 'totalValue'];
      const leaks = [];
      for (const r of requests) {
        for (const t of priceTokens) {
          // PR #464 fix: tolerate both ': null' and ':null'
          const leakRe = new RegExp(`"${t}":\\s*-?[0-9]+`);
          const m = r.body.match(leakRe);
          if (m) leaks.push({ url: r.url, token: t, snippet: m[0] });
        }
      }
      return {
        apiResponses: requests.length,
        leakCount: leaks.length,
        sampleLeaks: leaks.slice(0, 5),
        verdict: leaks.length === 0 ? 'PASS — 0 wire leak' : `FAIL — ${leaks.length} leaks`,
      };
    },
  },

  // ========== P2 — 22 LIVE-only-未 verify 抽样 ==========
  {
    tag: 'S-T-T2-4-rpf-chain',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-4 研发→采购→入库→提取→生产 全链路 (后端 5 endpoints API check)',
    run: async () => ({
      verdict: 'MANUAL',
      env: 'TEST',
      instructions: `⚠ RUN ON TEST ENV ONLY — multiple POST writes. Target http://47.100.235.168:10011/api/mobile/F001/. API chain: GET /rpf-items → POST /purchase-orders → POST /receives → POST /production/plans → verify consumption`,
    }),
  },
  {
    tag: 'S-T-T2-11-process-yield',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-11 工序投入产出比 + 出成率 报表',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/production/yield-rate-analysis`).catch(() => page.goto(`${TARGET}/生产分析`));
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body');
      return {
        url: page.url(),
        hasYieldAnalysis: /出成率|投入产出|工序分析/.test(bodyText || ''),
        verdict: 'INFO',
      };
    },
  },
  {
    tag: 'S-T-T2-12-sku-profit',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-12 SKU 毛利率分析页',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/finance/sku-margin-analysis`).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body');
      return {
        url: page.url(),
        hasMarginAnalysis: /SKU毛利率|毛利率分析/.test(bodyText || ''),
        verdict: 'INFO',
      };
    },
  },
  {
    tag: 'S-T-T3-5-approval',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-5 审批链动态配置 UI',
    run: async (page, ctx) => {
      await page.goto(`${TARGET}/system/approval-chains`).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = await page.textContent('body');
      return {
        url: page.url(),
        hasApprovalConfig: /审批链配置|approval chain/i.test(bodyText || ''),
        verdict: 'INFO',
      };
    },
  },
  {
    tag: 'S-T-T2-3-dingtalk',
    priority: 'P2',
    account: null,
    description: 'T2-3 钉钉机器人 API + Tool 注册',
    run: async () => ({
      verdict: 'MANUAL',
      instructions: `
1. ssh root@47.100.235.168 'grep -rn "dingtalk\\|钉钉" /www/wwwroot/cretas/.env.prod' (check OAuth config)
2. Tool registry: grep for DingTalk* Tool class in cretas-api backend
3. Verify callback URL configured
`,
    }),
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function login(page, account) {
  if (!account) return true;
  await page.goto(`${TARGET}/login`);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  const { username, password } = ACCOUNTS[account];
  await page.fill('input[placeholder*="用户名"], input[type="text"]', username);
  await page.fill('input[placeholder*="密码"], input[type="password"]', password);
  // Prefer the specific class from baseline script over generic :has-text matching
  const loginBtn = (await page.$('button.login-button')) ?? (await page.$('button:has-text("登 录")')) ?? (await page.$('button:has-text("登录")'));
  if (!loginBtn) {
    console.error(`  ✗ login: button not found for ${account}`);
    return false;
  }
  await loginBtn.click();
  // Wait for redirect away from /login (signals successful auth)
  try {
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 18000 });
    return true;
  } catch {
    console.error(`  ✗ login: timeout still on /login for ${account}`);
    return false;
  }
}

// Cache login sessions per account to avoid 60s per-username rate limit
const STORAGE_STATE_CACHE = new Map();

async function getOrCreateStorageState(browser, account) {
  if (STORAGE_STATE_CACHE.has(account)) return STORAGE_STATE_CACHE.get(account);
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const ok = await login(page, account);
  if (!ok) {
    await ctx.close();
    return null;
  }
  const state = await ctx.storageState();
  await ctx.close();
  STORAGE_STATE_CACHE.set(account, state);
  return state;
}

async function runScenario(browser, sc) {
  if (!sc.account) {
    const result = await sc.run();
    return { scenario: sc.tag, priority: sc.priority, account: null, status: result.verdict, evidence: result, ts: new Date().toISOString() };
  }
  const state = await getOrCreateStorageState(browser, sc.account);
  if (!state) {
    return {
      scenario: sc.tag,
      priority: sc.priority,
      account: sc.account,
      status: 'ERROR',
      evidence: { error: 'login failed — cannot create storageState' },
      ts: new Date().toISOString(),
    };
  }
  const ctx = await browser.newContext({ acceptDownloads: true, storageState: state });
  const page = await ctx.newPage();
  try {
    const result = await sc.run(page, ctx);
    try { await page.screenshot({ path: path.join(SHOTS_DIR, `${sc.tag}.png`), fullPage: false }); } catch {}
    return {
      scenario: sc.tag,
      priority: sc.priority,
      account: sc.account,
      status: result.verdict || 'INFO',
      evidence: result,
      ts: new Date().toISOString(),
    };
  } catch (err) {
    return { scenario: sc.tag, priority: sc.priority, account: sc.account, status: 'ERROR', evidence: { error: String(err) }, ts: new Date().toISOString() };
  } finally {
    await ctx.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let filter = (s) => true;
  if (args.includes('--p0')) filter = (s) => s.priority === 'P0';
  else if (args.includes('--p1')) filter = (s) => s.priority === 'P1';
  else if (args.includes('--p2')) filter = (s) => s.priority === 'P2';
  else if (args.includes('--all')) filter = (s) => true;
  else {
    const tagArgIdx = args.indexOf('--tag');
    if (tagArgIdx >= 0 && args[tagArgIdx + 1]) {
      const tag = args[tagArgIdx + 1];
      filter = (s) => s.tag === tag;
    }
  }
  const scenarios = SCENARIOS.filter(filter);
  if (scenarios.length === 0) {
    console.error('No scenarios match. Use --p0 / --p1 / --p2 / --all or --tag <name>');
    process.exit(1);
  }
  console.log(`Running ${scenarios.length} scenarios against ${TARGET}`);
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const sc of scenarios) {
    console.log(`  [${sc.priority}] ${sc.tag} — ${sc.description}`);
    const r = await runScenario(browser, sc);
    results.push(r);
    console.log(`    → ${r.status}`);
  }
  await browser.close();
  const out = {
    runAt: new Date().toISOString(),
    target: TARGET,
    scenariosTotal: scenarios.length,
    results,
  };
  const outFile = path.join(__dirname, 'results.json');
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nResults written to ${outFile}`);
  console.log(`Summary: ${results.filter((r) => r.status === 'PASS').length} PASS, ${results.filter((r) => r.status?.startsWith('FAIL')).length} FAIL, ${results.filter((r) => r.status === 'MANUAL').length} MANUAL, ${results.filter((r) => r.status === 'INFO').length} INFO`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
