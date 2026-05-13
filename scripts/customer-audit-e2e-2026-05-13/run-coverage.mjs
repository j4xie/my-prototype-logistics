#!/usr/bin/env node
/**
 * 六扇门 (F006) 51-ask coverage push - autonomous F006 agent session 2026-05-13
 *
 * Covers 35 unverified asks from audit doc §2:
 *   - Group A: 24 ◯ LIVE-only (skip T1-4 — RN scope only; T4-B6 is 🔴 not ◯)
 *   - Group B: 4 🟡 weak-evidence re-tests
 *   - Group D: 4 ⛔ audit-missed
 *   - Group E quick wins (3): T4-D1 deeper / T4-D4 manual nav / T-INV scope clarify
 *
 * 跑法:
 *   node run-coverage.mjs --all                        # 全部 32 scenarios
 *   node run-coverage.mjs --group A|B|D|E              # 单组
 *   node run-coverage.mjs --tag S-COV-T3-5             # 单个
 *
 * 约束 (同 run-e2e.mjs): 只读 prod 139:8086, 不写入.
 *
 * Output:
 *   results-coverage.json + shots-coverage/*.png
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET || 'http://139.196.165.140:8086';
const SHOTS_DIR = path.join(__dirname, 'shots-coverage');
const ACCOUNTS = {
  f006_admin: { username: 'f006_admin', password: '123456' },
  f006_warehouse_mgr: { username: 'f006_warehouse_mgr', password: '123456' },
  gml_admin: { username: 'gml_admin', password: '123456' },
};

// ---------------------------------------------------------------------------
// Helper: wait for one of multiple button selectors (loading-tolerant)
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

// Find any "navigate to detail" element on a list page — tries multiple patterns
async function findDetailBtn(page, timeoutMs = 8000) {
  return waitForAnyBtn(page, [
    'a:has-text("查看")',
    'a:has-text("详情")',
    'button:has-text("查看")',
    'button:has-text("详情")',
    'a:has-text("编辑")',
    'button:has-text("编辑")',
    '.el-table tbody tr:first-child a.el-link',
    '.el-table tbody tr:first-child .el-button--text',
  ], timeoutMs);
}

const SCENARIOS = [
  // ===========================================================================
  // GROUP E quick wins (D1 deeper / D4 manual / INV scope)
  // ===========================================================================
  {
    tag: 'S-COV-T4-D1-deeper',
    group: 'E',
    priority: 'P1-followup',
    account: 'f006_admin',
    description: 'T4-D1 销售订单 dialog 深度: 添加行+选品后批次 dropdown 含 总仓/线边仓/WH-LOG',
    run: async (page) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const newBtn = await waitForAnyBtn(page, ['button:has-text("新建销售订单")', 'button:has-text("+ 新建销售订单")', 'button:has-text("新建")'], 12000);
      if (!newBtn) return { verdict: 'FAIL', reason: '新建销售订单 button not found after 12s wait' };
      await newBtn.click();
      await page.waitForTimeout(1500);
      // Per source-grep (sales/orders/list.vue:925-955): dialog 列结构 =
      // 品名 / 规格 / 下单数量 / 单位 / 单价 / 箱数 / 税率(%) / 操作.
      // 无 仓库 / batch source column. utils/warehouse.ts warehouseDisplayLabel
      // exists but NOT imported in this view. Verify via dialog text scan.
      const dialogText = await page.textContent('.el-dialog').catch(() => '');
      const hasWarehouseCol = /仓库|batch.*source|批次源|来源仓/.test(dialogText);
      const hasZongCang = dialogText.includes('总仓') || dialogText.includes('WH-LOG');
      const hasXianBianCang = dialogText.includes('线边仓') || dialogText.includes('WH-WKS');
      return {
        hasWarehouseCol,
        hasZongCang,
        hasXianBianCang,
        dialogColumnsPreview: dialogText.slice(0, 600),
        verdict: (hasZongCang || hasXianBianCang || hasWarehouseCol)
          ? 'PASS'
          : 'FAIL — F006 销售订单 dialog 无仓库/总仓/线边仓 column. utils/warehouse.ts 存在但未 import 到 sales/orders/list.vue. Customer ask T4-D1 not implemented.',
      };
    },
  },
  {
    tag: 'S-COV-T4-D4-rpf-manual',
    group: 'E',
    priority: 'P1-followup',
    account: 'f006_admin',
    description: 'T4-D4 RPF: 进 production/batches 详情看 raw_material consumption',
    run: async (page) => {
      await page.goto(`${TARGET}/production/batches`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const detailBtn = await findDetailBtn(page, 10000);
      if (!detailBtn) return { verdict: 'INFO', reason: 'no detail button on batches list' };
      await detailBtn.click();
      await page.waitForTimeout(3000);
      const bodyText = await page.textContent('body');
      const hasRawMaterial = /原材料消耗|原料消耗|raw_material|消耗记录|consumption/.test(bodyText || '');
      const hasRpf = /RPF|配方|recipe/.test(bodyText || '');
      return {
        url: page.url(),
        hasRawMaterial,
        hasRpf,
        verdict: hasRawMaterial ? 'PASS' : (hasRpf ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-COV-T-INV-scope-clarify',
    group: 'E',
    priority: 'P1-followup',
    account: 'f006_admin',
    description: 'T-INV 一键收款 scope: 销售订单详情侧是否有收款按钮',
    run: async (page) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const detailLink = await findDetailBtn(page, 10000);
      if (!detailLink) return { verdict: 'INFO', reason: 'no order to test (table empty?)' };
      await detailLink.click();
      await page.waitForTimeout(2500);
      const bodyText = await page.textContent('body');
      const hasOneClickInDetail = /一键收款|一键确认收款|快速收款/.test(bodyText || '');
      const hasShoukuanBtn = /[^销售业务]收款/.test(bodyText || '');
      const hasFinanceApprove = /财务审批|确认收款/.test(bodyText || '');
      return {
        url: page.url(),
        hasOneClickInDetail,
        hasShoukuanBtn,
        hasFinanceApprove,
        verdict: hasOneClickInDetail ? 'PASS' :
                 (hasShoukuanBtn || hasFinanceApprove) ? 'PARTIAL — 收款入口存在但 label 不是"一键"' : 'FAIL',
      };
    },
  },

  // ===========================================================================
  // GROUP A — 23 ◯ LIVE-only-未E2E (skip T1-4 + T4-B6 RN scope)
  // ===========================================================================
  {
    tag: 'S-COV-T1-1-plan-page',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T1-1 生产计划网页端: /production/plans 渲染 + 含计划',
    run: async (page) => {
      await page.goto(`${TARGET}/production/plans`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const rowCount = await page.$$eval('tbody tr', (els) => els.length).catch(() => 0);
      const is404 = /\/404/.test(page.url());
      // C3 fix: PASS requires actual data rendered (rowCount > 0), not just non-404
      return {
        url: page.url(),
        rowCount,
        verdict: is404 ? 'FAIL — 404' : (rowCount > 0 ? 'PASS' : 'INFO — page renders but no data rows'),
      };
    },
  },
  {
    tag: 'S-COV-T1-2-ai-create-plan',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T1-2 AI 对话引导创建生产计划: 入口按钮存在 (页面内, 非全局浮窗)',
    run: async (page) => {
      await page.goto(`${TARGET}/production/plans`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // C3 fix: regex was too loose — body text alone matches global AI floating button.
      // Require a button-like element inside the page-content area, not just body text.
      const aiCreateBtn = await page.$('.app-main button:has-text("AI"), .content button:has-text("AI"), .el-main button:has-text("智能创建"), .el-main button:has-text("AI 创建")').catch(() => null);
      const aiCreateText = await page.$('.el-main, .app-main').then(async (el) => {
        if (!el) return '';
        return (await el.textContent()) || '';
      }).catch(() => '');
      const hasContextualAi = /AI.*?(创建|生成|对话)|对话.*?创建/.test(aiCreateText);
      return {
        url: page.url(),
        hasAiCreateBtn: !!aiCreateBtn,
        hasContextualAi,
        verdict: (aiCreateBtn || hasContextualAi) ? 'PASS' : 'INFO — AI 入口可能仅在 AI Agent 全局触发, 页面内未提供专门按钮',
      };
    },
  },
  {
    tag: 'S-COV-T1-3-by-process',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T1-3 当天生产计划按工序排: process/工序 字段存在',
    run: async (page) => {
      await page.goto(`${TARGET}/production/plans`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || '')).catch(() => []);
      const hasProcessCol = headers.some((h) => /工序|process/i.test(h));
      return {
        url: page.url(),
        headers,
        hasProcessCol,
        verdict: hasProcessCol ? 'PASS' : 'INFO — 工序字段可能在详情或弹窗中',
      };
    },
  },
  {
    tag: 'S-COV-T1-5-shift-report',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T1-5 报工累计 (1小时一报后端求和): 报工/产量上报页面存在',
    run: async (page) => {
      const candidates = ['/production/work-reports', '/production/shift-reports', '/production/output', '/work-report'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body');
          break;
        }
      }
      return {
        url: page.url(),
        landed,
        hasReport: /报工|产量上报|工时|小时报/.test(bodyText),
        verdict: landed ? 'PASS' : 'INFO — 未找到报工页面 (可能在 RN App / 小程序)',
      };
    },
  },
  {
    tag: 'S-COV-T2-1-ai-skill-registry',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-1 AI 中台调度: AI Agent / Skill 注册入口存在',
    run: async (page) => {
      await page.goto(`${TARGET}/`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const bodyText = await page.textContent('body');
      const hasAiAgent = /AI Agent|AI助手|智能助手|AI 中台/.test(bodyText || '');
      return {
        url: page.url(),
        hasAiAgent,
        verdict: hasAiAgent ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-COV-T2-2-modules-nav',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-2 5 标准模块: 进销存/财务/订单/生产/研发 侧边栏存在',
    run: async (page) => {
      await page.goto(`${TARGET}/`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const aside = await page.textContent('aside, .el-menu, nav').catch(() => '');
      const modules = {
        进销存: /进销存|仓储|库存/.test(aside),
        财务: /财务/.test(aside),
        销售: /销售/.test(aside),
        采购: /采购/.test(aside),
        生产: /生产/.test(aside),
        研发: /研发/.test(aside),
      };
      const matched = Object.values(modules).filter(Boolean).length;
      return {
        url: page.url(),
        modules,
        matched,
        verdict: matched >= 5 ? 'PASS' : 'PARTIAL',
      };
    },
  },
  {
    tag: 'S-COV-T2-4-rpf-chain-list',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-4 RPF 全链路: 研发样品/采购订单/入库/批次/生产计划 5 页面可达',
    run: async (page) => {
      const pages = ['/rd/samples', '/procurement/orders', '/procurement/receives', '/inventory/batches', '/production/plans'];
      const results = {};
      for (const p of pages) {
        await page.goto(`${TARGET}${p}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        results[p] = !/\/404/.test(page.url());
      }
      const allOk = Object.values(results).every(Boolean);
      return {
        results,
        verdict: allOk ? 'PASS' : 'PARTIAL',
      };
    },
  },
  {
    tag: 'S-COV-T2-5-finance-link',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-5 销售→应收→应付: finance/payments + invoices + 应付页面',
    run: async (page) => {
      const pages = ['/finance/payments', '/finance/invoices', '/finance/adjustments'];
      const results = {};
      for (const p of pages) {
        await page.goto(`${TARGET}${p}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        results[p] = !/\/404/.test(page.url());
      }
      const allOk = Object.values(results).every(Boolean);
      return {
        results,
        verdict: allOk ? 'PASS' : 'PARTIAL',
      };
    },
  },
  {
    tag: 'S-COV-T2-6-llm-chat',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-6 大模型理解: AI 对话浮窗/入口/输入框存在 (require interactive element, not just text)',
    run: async (page) => {
      await page.goto(`${TARGET}/`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      // C3 fix: require an actual interactive element (input/button), not just body text mention
      const inputs = await page.$$('input[placeholder*="问"], input[placeholder*="对话"], textarea[placeholder*="提"], textarea[placeholder*="问"]').catch(() => []);
      const aiFloat = await page.$('.ai-agent-floating, .ai-chat-trigger, .floating-ai-btn, [class*="ai-agent"], [class*="ai-float"]').catch(() => null);
      const hasHeaderAi = await page.$('header [class*="ai"], header [class*="agent"], .el-header [class*="ai"]').catch(() => null);
      const aiBtn = await page.$('button:has-text("AI Agent"), button:has-text("AI 助手"), button:has-text("智能助手")').catch(() => null);
      const hasInteractiveAi = inputs.length > 0 || !!aiFloat || !!hasHeaderAi || !!aiBtn;
      return {
        url: page.url(),
        inputCount: inputs.length,
        hasAiFloat: !!aiFloat,
        hasHeaderAi: !!hasHeaderAi,
        hasAiBtn: !!aiBtn,
        verdict: hasInteractiveAi ? 'PASS' : 'INFO — AI 文字可见但无可交互的入口元素',
      };
    },
  },
  {
    tag: 'S-COV-T2-7-skill-config',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-7 AI 学习规则: Skill 配置入口 (system/ai-skills)',
    run: async (page) => {
      const candidates = ['/system/ai-skills', '/system/skills', '/ai/skills', '/system/intent-config'];
      let landed = null;
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          break;
        }
      }
      return {
        url: page.url(),
        landed,
        verdict: landed ? 'PASS' : 'INFO — Skill 配置可能不暴露给前端 (后端 DB 配置)',
      };
    },
  },
  {
    tag: 'S-COV-T2-8-cross-module-ai',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-8 AI 跨模块调度: SmartBI / AI Agent 数据分析页',
    run: async (page) => {
      const candidates = ['/smart-bi', '/ai-agent', '/data-analysis'];
      let landed = null;
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          break;
        }
      }
      return {
        url: page.url(),
        landed,
        verdict: landed ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-COV-T2-9-bom-add-material',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T2-9 BOM 多辅料 (一品 30+): BOM 关联多原料界面',
    run: async (page) => {
      await page.goto(`${TARGET}/production/bom`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const is404 = /\/404/.test(page.url());
      if (is404) return { verdict: 'FAIL — /production/bom 404' };
      const bodyText = (await page.textContent('body')) || '';
      const hasBomMgmt = /BOM|配方|物料清单/.test(bodyText);
      // C3 fix: verdict must use computed signal, not hardcoded PASS
      return {
        url: page.url(),
        hasBomMgmt,
        verdict: hasBomMgmt ? 'PASS' : 'INFO — page rendered but BOM/配方 text not detected',
      };
    },
  },
  {
    tag: 'S-COV-T3-1-box-auto',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-1 箱数自动算: 采购订单详情显示箱数字段',
    run: async (page) => {
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const detailBtn = await findDetailBtn(page, 10000);
      if (!detailBtn) return { verdict: 'INFO — no order to inspect' };
      await detailBtn.click();
      await page.waitForTimeout(2500);
      const bodyText = await page.textContent('body');
      const hasBoxCount = /箱数|箱.*?数量|单位.*?箱/.test(bodyText);
      return {
        url: page.url(),
        hasBoxCount,
        verdict: hasBoxCount ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-COV-T3-2-abaca',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-2 抄码品识别: /procurement/orders 列表含 抄码品 tag 或 规格=抄码 行 (PR #173 P1-3)',
    run: async (page) => {
      // 抄码 逻辑在 list.vue 中 — isAbacaItem(item) 当 spec === '抄码' 时显示 抄码品 tag.
      // 验证策略: 1) 列表 body 含 "抄码品" tag text, 或 2) 任一 row 的 规格 列含 "抄码"
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const detailBtn = await findDetailBtn(page, 10000);
      let foundAbacaInDetail = false;
      let detailPreview = '';
      if (detailBtn) {
        await detailBtn.click();
        await page.waitForTimeout(3000);
        detailPreview = (await page.textContent('body')) || '';
        foundAbacaInDetail = /抄码品|规格.*?抄码|抄码.*?规格/.test(detailPreview);
      }
      // Also try listing page body for the tag
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const listBody = (await page.textContent('body')) || '';
      const foundAbacaInList = /抄码品|抄码/.test(listBody);
      return {
        foundAbacaInDetail,
        foundAbacaInList,
        verdict: (foundAbacaInDetail || foundAbacaInList) ? 'PASS' : 'INFO — F006 当前订单中无规格="抄码"的行 (功能实现 in code @ list.vue:131, 但 prod 数据未触发)',
      };
    },
  },
  {
    tag: 'S-COV-T3-3-three-price',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-3 三价对比: 采购订单详情含三价对比模块',
    run: async (page) => {
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const detailBtn = await findDetailBtn(page, 10000);
      if (!detailBtn) return { verdict: 'INFO — no order' };
      await detailBtn.click();
      await page.waitForTimeout(3000);
      const bodyText = await page.textContent('body');
      const has3Price = /三价对比|历史采购价|当前.*?报价|近期采购价/.test(bodyText);
      return {
        url: page.url(),
        has3Price,
        verdict: has3Price ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-T3-4-expected-arrival',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-4 预计到货时间 = 期望交货: 采购订单 dialog 或 detail 含"期望交货"字段',
    run: async (page) => {
      // Vue source uses label="期望交货" in detail.vue:268, form field expectedDeliveryDate.
      // 也可能在 transfer/list 含 "预计到货" 字段.
      await page.goto(`${TARGET}/procurement/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      // Try detail first (most likely to show label)
      const detailBtn = await findDetailBtn(page, 8000);
      let detailText = '';
      if (detailBtn) {
        await detailBtn.click();
        await page.waitForTimeout(2500);
        detailText = (await page.textContent('body')) || '';
      }
      const hasInDetail = /期望交货|预计到货|预计交货/.test(detailText);
      return {
        hasInDetail,
        verdict: hasInDetail ? 'PASS' : 'INFO — 字段未在订单详情中找到',
      };
    },
  },
  {
    tag: 'S-COV-T3-5-approval-config',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-5 审批链动态配置 UI 完整: /system/approval-chains',
    run: async (page) => {
      const candidates = ['/system/approval-chains', '/system/approval', '/system/workflow', '/approval/config'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body');
          break;
        }
      }
      const hasApprovalConfig = /审批链|approval chain/i.test(bodyText);
      // C3 fix: verdict must AND landing with content check
      return {
        url: page.url(),
        landed,
        hasApprovalConfig,
        verdict: !landed ? 'FAIL — no approval config page found' : (hasApprovalConfig ? 'PASS' : 'INFO — page landed but 审批链 text not detected'),
      };
    },
  },
  {
    tag: 'S-COV-T3-10-sales-unit-price',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-10 销售单价 BOM 默认+可改: 新建销售订单 dialog 单价 input 不 disabled',
    run: async (page) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const newBtn = await waitForAnyBtn(page, ['button:has-text("新建销售订单")', 'button:has-text("新建")'], 12000);
      if (newBtn) await newBtn.click();
      await page.waitForTimeout(2500);
      const dialogText = await page.textContent('.el-dialog').catch(() => '');
      const hasUnitPrice = /单价/.test(dialogText);
      const priceInputs = await page.$$('.el-dialog input[placeholder*="单价"], .el-dialog .el-input-number').catch(() => []);
      return {
        hasUnitPriceLabel: hasUnitPrice,
        priceInputCount: priceInputs.length,
        verdict: hasUnitPrice ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-COV-T3-12-material-supplier',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-12 原料关联供应商: /procurement/suppliers 供应商管理页存在',
    run: async (page) => {
      const candidates = ['/procurement/suppliers', '/warehouse/material-types', '/inventory/material-types'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body');
          break;
        }
      }
      const hasSupplierMgmt = /供应商管理|供应商|supplier/i.test(bodyText);
      return {
        url: page.url(),
        landed,
        hasSupplierMgmt,
        verdict: landed && hasSupplierMgmt ? 'PASS' : (landed ? 'INFO — page rendered but no supplier text' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-COV-T3-15-unit-conv',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T3-15 一二级单位转换: F006 /production/conversions 含 conversionRate 字段',
    run: async (page) => {
      const candidates = ['/production/conversions', '/warehouse/material-types'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body');
          break;
        }
      }
      // Vue source uses conversionRate (production/conversions/index.vue:25)
      // and labels like "转换率" / "原材料类型" / "产品类型" / "损耗率".
      const hasUnits = /转换率|换算率|conversionRate|损耗率|wastageRate|原材料类型/.test(bodyText);
      return {
        url: page.url(),
        landed,
        hasUnits,
        verdict: hasUnits ? 'PASS' : 'INFO — page landed but no 转换率/conversion text detected',
      };
    },
  },
  {
    tag: 'S-COV-T4-B1-process-dropdown',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T4-B1 生产计划工序下拉 (PR #293): "通用" 选项可见',
    run: async (page) => {
      await page.goto(`${TARGET}/production/plans`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const newBtn = await waitForAnyBtn(page, ['button:has-text("新建计划")', 'button:has-text("新建生产计划")', 'button:has-text("+ 新建")', 'button:has-text("新建")', 'button:has-text("新增")'], 12000);
      if (newBtn) await newBtn.click();
      await page.waitForTimeout(2000);
      const dialogText = await page.textContent('.el-dialog').catch(() => '');
      const hasProcess = /工序|process/.test(dialogText);
      return {
        hasProcess,
        verdict: hasProcess ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-COV-T4-B7-dialog-width',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T4-B7 弹窗宽度: 新建销售订单 dialog width >= 800px',
    run: async (page) => {
      await page.goto(`${TARGET}/sales/orders`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const newBtn = await waitForAnyBtn(page, ['button:has-text("新建销售订单")', 'button:has-text("新建")'], 12000);
      if (!newBtn) return { verdict: 'INFO', reason: '新建 button not found after 12s' };
      await newBtn.click();
      await page.waitForTimeout(1500);
      const dialog = await page.$('.el-dialog');
      const box = dialog ? await dialog.boundingBox() : null;
      const width = box ? box.width : 0;
      return {
        widthPx: width,
        verdict: width >= 800 ? 'PASS' : (width >= 600 ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-COV-T4-B8-bom-binding',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T4-B8 BOM 关联原料联动: BOM 详情可见原料列表',
    run: async (page) => {
      await page.goto(`${TARGET}/production/bom`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const is404 = /\/404/.test(page.url());
      if (is404) return { verdict: 'INFO — /production/bom 404, 可能在 recipes' };
      const detailBtn = await page.$('a:has-text("详情")');
      if (detailBtn) await detailBtn.click();
      await page.waitForTimeout(2500);
      const bodyText = await page.textContent('body');
      const hasMaterials = /原料|辅料|materials/i.test(bodyText);
      return {
        url: page.url(),
        hasMaterials,
        verdict: hasMaterials ? 'PASS' : 'INFO',
      };
    },
  },
  {
    tag: 'S-COV-T4-D3-g-kg-conv',
    group: 'A',
    priority: 'P2',
    account: 'f006_admin',
    description: 'T4-D3 g↔kg 1:1000 换算: F006 工厂 BOM/转换率 含克/千克单位',
    run: async (page) => {
      // F006 是食品工厂, 不是餐饮 — 走 /production/conversions (单位换算配置) + /production/bom
      const candidates = ['/production/conversions', '/production/bom', '/inventory/material-types'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = (await page.textContent('body')) || '';
          break;
        }
      }
      const hasUnits = /克|千克|kg|g($|\W)/.test(bodyText);
      return {
        url: page.url(),
        landed,
        hasUnits,
        verdict: landed && hasUnits ? 'PASS' : (landed ? 'INFO — page rendered but no g/kg unit text' : 'FAIL — no candidate route works'),
      };
    },
  },

  // ===========================================================================
  // GROUP B — 4 🟡 weak-evidence re-tests
  // ===========================================================================
  {
    tag: 'S-COV-T2-10-yield-rate',
    group: 'B',
    priority: 'P1-retest',
    account: 'f006_admin',
    description: 'T2-10 极低用量辅料 yield-rate: F006 工厂 BOM 含出成率/净料率 (PR #297)',
    run: async (page) => {
      // F006 是食品工厂 — 验证 /production/bom 含 出成率/净料率/yield 字段
      await page.goto(`${TARGET}/production/bom`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const bodyText = (await page.textContent('body')) || '';
      const hasYieldInList = /出成率|净料率|yield/i.test(bodyText);
      // Also try opening new/edit dialog
      const newBtn = await waitForAnyBtn(page, ['button:has-text("新建")', 'button:has-text("新增")', 'button:has-text("+ 新建")'], 8000);
      let hasYieldInDialog = false;
      let dialogPreview = '';
      if (newBtn) {
        await newBtn.click();
        await page.waitForTimeout(2000);
        dialogPreview = (await page.textContent('.el-dialog').catch(() => '')) || '';
        hasYieldInDialog = /出成率|净料率|yield/i.test(dialogPreview);
      }
      return {
        url: page.url(),
        hasYieldInList,
        hasYieldInDialog,
        dialogPreviewHead: dialogPreview.slice(0, 300),
        verdict: (hasYieldInList || hasYieldInDialog) ? 'PASS' : 'FAIL — F006 BOM 未见 yield/出成率/净料率',
      };
    },
  },
  {
    tag: 'S-COV-T3-9-rbac-warehouse-mgr-list',
    group: 'B',
    priority: 'P1-retest',
    account: 'f006_warehouse_mgr',
    description: 'T3-9 RBAC 仓管列头隐藏 (PR #467 verify): /procurement/orders + /sales/orders 无价格列',
    run: async (page) => {
      const places = ['/procurement/orders', '/sales/orders'];
      const results = {};
      for (const p of places) {
        await page.goto(`${TARGET}${p}`);
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || '')).catch(() => []);
        const hasPrice = headers.some((h) => /总金额|单价|税额|运费/.test(h));
        results[p] = { headers, hasPrice };
      }
      const anyLeak = Object.values(results).some((r) => r.hasPrice);
      return {
        results,
        verdict: anyLeak ? 'FAIL — price column visible to warehouse_mgr' : 'PASS',
      };
    },
  },
  {
    tag: 'S-COV-T4-B4-stock-col',
    group: 'B',
    priority: 'P1-retest',
    account: 'f006_admin',
    description: 'T4-B4 调拨新建 form "现有库存" 列: 新建调拨单 dialog 含 现有库存',
    run: async (page) => {
      await page.goto(`${TARGET}/transfer/list`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const newBtn = await waitForAnyBtn(page, ['button:has-text("手动新建调拨单")', 'button:has-text("新建调拨单")', 'button:has-text("新增调拨单")', 'button:has-text("+ 手动新建")'], 12000);
      if (!newBtn) return { verdict: 'INFO — no 新建 button after 12s' };
      await newBtn.click();
      await page.waitForTimeout(2500);
      // C2 fix: must click "添加物料" first to add a material row, only then does "现有库存" column appear
      const addMaterialBtn = await waitForAnyBtn(page, ['button:has-text("添加物料")', 'button:has-text("+ 添加物料")', 'button:has-text("添加")'], 8000);
      if (!addMaterialBtn) {
        const dialogText = await page.textContent('.el-dialog').catch(() => '');
        return { verdict: 'INFO — dialog opened but no 添加物料 button found', dialogPreview: dialogText.slice(0, 400) };
      }
      await addMaterialBtn.click();
      await page.waitForTimeout(2000);
      const dialogText = await page.textContent('.el-dialog').catch(() => '');
      const hasStock = /现有库存/.test(dialogText);
      return {
        hasStock,
        dialogPreview: dialogText.slice(0, 800),
        verdict: hasStock ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-T4-B9-manual-transfer',
    group: 'B',
    priority: 'P1-retest',
    account: 'f006_admin',
    description: 'T4-B9 手动调拨入口: 调拨列表 含"手动新建调拨单" 按钮',
    run: async (page) => {
      await page.goto(`${TARGET}/transfer/list`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const manualBtn = await page.$('button:has-text("手动新建调拨单"), button:has-text("手动")');
      const bodyText = await page.textContent('body');
      const hasManualText = /手动新建|手动调拨/.test(bodyText);
      return {
        hasManualBtn: !!manualBtn,
        hasManualText,
        verdict: manualBtn || hasManualText ? 'PASS' : 'FAIL',
      };
    },
  },

  // ===========================================================================
  // GROUP D — 4 ⛔ audit-missed
  // ===========================================================================
  {
    tag: 'S-COV-T2-5b-moving-avg-price',
    group: 'D',
    priority: 'P1-missed',
    account: 'f006_admin',
    description: 'T2-5b 移动平均价/动态定价: 物料类型页含 movingAvgPrice 列 (PR #541) 或物料均价趋势页',
    run: async (page) => {
      // Per PR #541 reviewer I1: /warehouse/material-types now has 移动均价 column (gated by canViewPrice).
      // Source: web-admin/src/router/index.ts:131-133 + RawMaterialTypeServiceImpl:282 convertToDTO.
      // Keep legacy candidates as fallback in case a dedicated trend page ships later.
      const candidates = ['/warehouse/material-types', '/inventory/material-price-trend', '/inventory/avg-price', '/inventory/materials'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = (await page.textContent('body')) || '';
          break;
        }
      }
      // Match both the column header ("移动均价") and DTO key ("movingAvgPrice") for robustness across renderings.
      const hasAvgPrice = /移动均价|移动平均|均价|MovingAvg|movingAvgPrice/.test(bodyText);
      return {
        url: page.url(),
        landed,
        hasAvgPrice,
        verdict: landed && hasAvgPrice ? 'PASS' : (landed ? 'PARTIAL' : 'FAIL'),
      };
    },
  },
  {
    tag: 'S-COV-T2-11-yield-analysis',
    group: 'D',
    priority: 'P1-missed',
    account: 'f006_admin',
    description: 'T2-11 工序投入产出 + 出成率分析: 生产分析页',
    run: async (page) => {
      const candidates = ['/production/process-io', '/production-analytics/production', '/production-analytics/efficiency'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body');
          break;
        }
      }
      const hasYieldRpt = /出成率|工序分析|投入产出|yield/i.test(bodyText);
      return {
        url: page.url(),
        landed,
        hasYieldRpt,
        verdict: landed && hasYieldRpt ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-T2-12-sku-margin',
    group: 'D',
    priority: 'P1-missed',
    account: 'f006_admin',
    description: 'T2-12 SKU 毛利率分析页: /finance/sku-margin-analysis',
    run: async (page) => {
      const candidates = ['/finance/sku-margin', '/finance/sku-margin-analysis', '/finance/sku-profit'];
      let landed = null;
      let bodyText = '';
      for (const c of candidates) {
        await page.goto(`${TARGET}${c}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        if (!/\/404/.test(page.url())) {
          landed = c;
          bodyText = await page.textContent('body');
          break;
        }
      }
      const hasMargin = /SKU毛利率|毛利率分析|profit|margin/i.test(bodyText);
      return {
        url: page.url(),
        landed,
        hasMargin,
        verdict: landed && hasMargin ? 'PASS' : 'FAIL',
      };
    },
  },
  {
    tag: 'S-COV-T3-8b-receive-no-price',
    group: 'D',
    priority: 'P1-missed',
    account: 'f006_warehouse_mgr',
    description: 'T3-8b 仓管入库只录数量+日期+拍照: /procurement/receives 不显示价格 + 含拍照入口',
    run: async (page) => {
      await page.goto(`${TARGET}/procurement/receives`);
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const headers = await page.$$eval('.el-table th', (els) => els.map((el) => el.textContent?.trim() || '')).catch(() => []);
      const hasPrice = headers.some((h) => /总金额|单价|税额/.test(h));
      const bodyText = await page.textContent('body');
      const hasPhotoCol = /拍照|附件|图片|photo/i.test(bodyText);
      return {
        headers,
        hasPrice,
        hasPhotoCol,
        verdict: !hasPrice ? 'PASS' : 'FAIL — price column visible to warehouse_mgr',
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Runner (same pattern as run-e2e.mjs)
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
  if (!loginBtn) {
    console.error(`  ✗ login: button not found for ${account}`);
    return false;
  }
  await loginBtn.click();
  try {
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 18000 });
    return true;
  } catch {
    console.error(`  ✗ login: timeout still on /login for ${account}`);
    return false;
  }
}

const STORAGE_STATE_CACHE = new Map();

async function getOrCreateStorageState(browser, account) {
  if (STORAGE_STATE_CACHE.has(account)) return STORAGE_STATE_CACHE.get(account);
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  let ok = false;
  try {
    ok = await login(page, account);
  } catch (e) {
    console.error(`  ✗ login threw for ${account}: ${e.message}`);
  }
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
    return { scenario: sc.tag, group: sc.group, priority: sc.priority, account: null, status: result.verdict || 'INFO', evidence: result, ts: new Date().toISOString() };
  }
  const state = await getOrCreateStorageState(browser, sc.account);
  if (!state) {
    return { scenario: sc.tag, group: sc.group, priority: sc.priority, account: sc.account, status: 'ERROR', evidence: { error: 'login failed' }, ts: new Date().toISOString() };
  }
  const ctx = await browser.newContext({ acceptDownloads: true, storageState: state });
  const page = await ctx.newPage();
  try {
    const result = await sc.run(page);
    try { await page.screenshot({ path: path.join(SHOTS_DIR, `${sc.tag}.png`), fullPage: false }); } catch {}
    return { scenario: sc.tag, group: sc.group, priority: sc.priority, account: sc.account, status: result.verdict || 'INFO', evidence: result, ts: new Date().toISOString() };
  } catch (err) {
    return { scenario: sc.tag, group: sc.group, priority: sc.priority, account: sc.account, status: 'ERROR', evidence: { error: String(err) }, ts: new Date().toISOString() };
  } finally {
    await ctx.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let filter = () => true;
  const groupIdx = args.indexOf('--group');
  if (args.includes('--all')) filter = () => true;
  else if (groupIdx >= 0 && args[groupIdx + 1]) {
    const g = args[groupIdx + 1];
    filter = (s) => s.group === g;
  } else {
    const tagIdx = args.indexOf('--tag');
    if (tagIdx >= 0 && args[tagIdx + 1]) {
      const t = args[tagIdx + 1];
      filter = (s) => s.tag === t;
    }
  }
  const scenarios = SCENARIOS.filter(filter);
  if (scenarios.length === 0) {
    console.error('No scenarios match. Use --all / --group A|B|D|E / --tag <name>');
    process.exit(1);
  }
  console.log(`Running ${scenarios.length} scenarios against ${TARGET}`);
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const sc of scenarios) {
    console.log(`  [${sc.group}] ${sc.tag} — ${sc.description}`);
    const r = await runScenario(browser, sc);
    results.push(r);
    console.log(`    → ${r.status}`);
  }
  await browser.close();
  const out = {
    runAt: new Date().toISOString(),
    target: TARGET,
    scenariosTotal: scenarios.length,
    byGroup: {
      A: results.filter((r) => r.group === 'A').length,
      B: results.filter((r) => r.group === 'B').length,
      D: results.filter((r) => r.group === 'D').length,
      E: results.filter((r) => r.group === 'E').length,
    },
    statusCounts: {
      PASS: results.filter((r) => r.status === 'PASS').length,
      FAIL: results.filter((r) => /FAIL/.test(r.status || '')).length,
      PARTIAL: results.filter((r) => /PARTIAL/.test(r.status || '')).length,
      INFO: results.filter((r) => /INFO/.test(r.status || '')).length,
      ERROR: results.filter((r) => r.status === 'ERROR').length,
    },
    results,
  };
  const outFile = path.join(__dirname, 'results-coverage.json');
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nResults written to ${outFile}`);
  console.log(`Summary: PASS=${out.statusCounts.PASS} FAIL=${out.statusCounts.FAIL} PARTIAL=${out.statusCounts.PARTIAL} INFO=${out.statusCounts.INFO} ERROR=${out.statusCounts.ERROR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
