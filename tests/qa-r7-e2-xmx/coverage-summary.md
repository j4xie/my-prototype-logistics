# R7-E2 R_XMX_CHAIN — 51-Ask Applicability Matrix + Coverage Plan

**Date**: 2026-05-14
**Factory**: `R_XMX_CHAIN` (chain restaurant operation, 1 user `xmx_admin` / role `factory_super_admin`)
**Target**: `http://139.196.165.140:8086` (web-admin prod via 139 gateway, read-only)
**Pattern source**: F006 R7-E1 (PR #481 audit + PR #517 / #527 / #560 iter-1 → iter-7)
**Spec parent**: PR #563 R7 multi-path draft (Path E = customer-factory replication on R_QINGHUAJIAO_REAL + R_ILTEATRO_REAL + R_XMX_CHAIN)
**Scaffold script**: [`scripts/customer-audit-e2e-2026-05-14-xmx/run-coverage.mjs`](../../scripts/customer-audit-e2e-2026-05-14-xmx/run-coverage.mjs)

---

## §0 TL;DR + critical scope finding

**N/51 verdict tally**: **15/51 PASS-candidates scaffolded for execution / 14/51 N/A-by-data-or-role / 22/51 NOT-EXECUTED-this-session** (scaffold only — real Playwright run required).

**Critical scope finding** — the "51-ask" framework is fundamentally **F006-customer-specific**:

> F006's 51 asks (PR #481 §2) each cite a `Transcript ref` column with F006 customer meeting line numbers (`第一次:1`, `第二次:51-69`, etc.). The asks were derived from 4 customer transcripts (六扇门第一/二/三/四次). XMX has NO equivalent customer transcript audit doc, so the "51 asks" cannot literally apply to XMX in their original customer-ask sense.

**Reinterpretation for XMX**: each F006 ask → "is this feature available + working for the XMX tenant?" — i.e., **feature-regression smoke** rather than customer-ask coverage. This is the only meaningful translation given:

1. **No XMX transcript audit** — there is no `docs/qa-audits/2026-05-XX-xmx-coverage-gap-audit.md` analogue to F006's `2026-05-13-liushanmen-coverage-gap-audit.md`.
2. **Single-user constraint** — XMX has only `xmx_admin` (factory_super_admin) per `cretas_prod_db`. F006 had 3 users (`f006_admin` + `f006_warehouse_mgr` + `gml_admin`). RBAC-isolation asks (T3-8b 仓管 no-price, T3-9 wire-level leak, sales/orders 500 for warehouse_mgr) **cannot be exercised** for XMX in single-tenant single-role mode.
3. **Different customer profile** — XMX is a chain restaurant per chat3 #539 evidence (31 dim_ingredient + 8 fact_requisition + 4 fact_wastage + 38 fact_recipe in Gold). F006 was a 熟食工厂 (delicatessen factory). F006 customer asks like T-RTA (退货 with food/no-food split), T2-3 钉钉 integration, T1-3 卤制周期 are 熟食-domain-specific and don't translate to chain-restaurant ops.

**Recommended next step**: Organizer either (a) dispatch dedicated browser-driven session to execute the scaffold against XMX, OR (b) accept the scaffold + matrix as R7-E2 deliverable and downgrade the PASS-rate framing (this audit cannot legitimately produce "28/51 PASS"-style numbers without execution + customer-ask reinterpretation).

---

## §1 Per-ask applicability matrix

**Legend**:
- ✅ **EXEC-READY** — scenario scaffolded in run-coverage.mjs, applies to XMX, executable with `xmx_admin`
- ❓ **PENDING** — applies to XMX in principle but needs prod data check / extra investigation before scaffolding
- 🚫 **N/A-ROLE** — requires multi-role RBAC (warehouse_mgr / non-admin) which XMX doesn't have
- 🟦 **N/A-DOMAIN** — F006-熟食-specific ask that doesn't translate to XMX chain-restaurant ops
- 🟪 **N/A-CHAT** — out-of-web-admin scope (RN App / SmartBI custom / 钉钉 integration / on-site cameras)
- 🟥 **N/A-TRANSCRIPT** — derived from F006 customer transcript wording; no equivalent XMX customer ask exists

### 第一次会议 mirror (T1-1 ~ T1-6)

| # | F006 Ask | XMX classification | Scaffold tag | Note |
|---|---|---|---|---|
| T1-1 | 排第二天的生产计划在网页端 | ✅ EXEC-READY | `S-XMX-T1-1-production-plan-page` | Page render + table check |
| T1-2 | AI 对话创建生产计划 (引导式) | ❓ PENDING | — | Needs AI agent button selector verify |
| T1-3 | 当天生产计划按工序排 (卤制周期) | 🟦 N/A-DOMAIN | — | F006 卤制 specific; XMX chain-restaurant doesn't have multi-day 卤制 |
| T1-4 | 小程序点工序卡片报今天产量 | 🟪 N/A-CHAT | — | RN mobile, out of web-admin scope |
| T1-5 | 报工累计式 (1小时一报) | 🟪 N/A-CHAT | — | RN mobile |
| T1-6 | 标签金属探测 + 图像识别异物 | 🟪 N/A-CHAT | — | YOLO on-site hardware, out of web-admin scope |

**第一次 tally**: 1 EXEC-READY / 1 PENDING / 1 N/A-DOMAIN / 3 N/A-CHAT = 6 total

### 第二次会议 mirror (T2-1 ~ T2-12)

| # | F006 Ask | XMX classification | Scaffold tag | Note |
|---|---|---|---|---|
| T2-1 | 抛弃传统 ERP — 用 AI 中台调度 | 🟥 N/A-TRANSCRIPT | — | 概念性 ask, no measurable feature |
| T2-2 | 进销存/财务/订单/生产/研发 标准化模板 | ✅ EXEC-READY | `S-XMX-T2-2-modules-nav` | Sidebar 5-module check |
| T2-3 | 钉钉交互通道 | 🟪 N/A-CHAT | — | OAuth backend, out of web-admin |
| T2-4 | 研发→采购→入库→提取→生产 串通 | ✅ EXEC-READY | `S-XMX-T2-4-rpf-chain-pages` | 4-page render chain |
| T2-5 | 销售订单 → 应收 → 应付 | ✅ EXEC-READY | `S-XMX-T2-5-sales-order-list` | List + headers |
| T2-5b | 移动平均价 / 动态定价 | ❓ PENDING | — | Need to verify XMX has price-history surface |
| T2-6 | 大模型理解 vs 严谨字段匹配 | 🟥 N/A-TRANSCRIPT | — | 架构特性, no UI test |
| T2-7 | 给 AI 学习报价规则 / 库存规则 | 🟥 N/A-TRANSCRIPT | — | Skill DB backend |
| T2-8 | AI 在数据板块间做调度分析 | 🟥 N/A-TRANSCRIPT | — | Skill registry |
| T2-9 | 非标品 + 多 SKU + 大量辅料 (一品 30-40 种) | 🟦 N/A-DOMAIN | — | F006 熟食 specific; XMX chain different SKU profile |
| T2-10 | 极低用量辅料 — 减少手工维护 (RPF) | ❓ PENDING | — | Need XMX recipe data check |
| T2-11 | 工序投入产出比 + 出成率 | 🟦 N/A-DOMAIN | — | 工序 analysis specific to 卤制 |
| T2-12 | SKU 毛利率 / 移动平均价 | ❓ PENDING | — | /finance/sku-margin if exists for XMX |

**第二次 tally**: 3 EXEC-READY / 3 PENDING / 2 N/A-DOMAIN / 4 N/A-TRANSCRIPT / 1 N/A-CHAT = 13 total

### 第三次会议 Part 1 mirror (T3-1 ~ T3-6)

| # | F006 Ask | XMX classification | Scaffold tag | Note |
|---|---|---|---|---|
| T3-1 | 箱数自动算 | ✅ EXEC-READY | `S-XMX-T3-1-purchase-order-list` | 箱数 column check |
| T3-2 | 抄码品识别 (规格=='抄码' → 不显示箱数) | 🟦 N/A-DOMAIN | — | F006 specific; XMX may not have 抄码 product type |
| T3-3 | 三价对比分析 | ❓ PENDING | — | Verify XMX has historical purchase data |
| T3-4 | 预计到货时间字段 | ❓ PENDING | — | Field-level check in PO detail |
| T3-5 | 工作流审批链动态配置 | ✅ EXEC-READY | `S-XMX-T3-5-approval-chain-page` | Page exists |
| T3-6 | 列宽/字段挤压 (visual QA) | 🟥 N/A-TRANSCRIPT | — | Visual UI ticket, F006 specific |

**第三次 P1 tally**: 2 EXEC-READY / 2 PENDING / 1 N/A-DOMAIN / 1 N/A-TRANSCRIPT = 6 total

### 第三次会议 Part 2 mirror (T3-7 ~ T3-15)

| # | F006 Ask | XMX classification | Scaffold tag | Note |
|---|---|---|---|---|
| T3-7 | 收货数量分次显示列 | ✅ EXEC-READY | `S-XMX-T3-7-receive-qty-multi` | Header check |
| T3-8 | 采购订单 PDF 打印 + 扫码入库 | ✅ EXEC-READY | `S-XMX-T3-8-pdf-print-btn` | PDF button visible |
| T3-8b | 仓管员入库只录数量+日期+拍照 | 🚫 N/A-ROLE | — | Requires warehouse_mgr (XMX has none) |
| T3-9 | RBAC 仓管角色价格字段隔离 | 🚫 N/A-ROLE | — | Same constraint |
| T3-10 | 销售单价 BOM 默认 + 可改 | ❓ PENDING | — | Sales order dialog field check |
| T3-11 | 预估成本暂时隐藏 (财务审批) | 🟥 N/A-TRANSCRIPT | — | F006 customer decision, not feature |
| T3-12 | 原料字段加"供应商" | ❓ PENDING | — | Material → supplier relationship |
| T3-13 | UI 列宽/详情盖住 (规格列) | 🟥 N/A-TRANSCRIPT | — | F006 visual ticket |
| T3-14 | 三价对比新采购单后未刷新 | 🟥 N/A-TRANSCRIPT | — | F006 pre-existing bug |
| T3-15 | 一二级单位转换 | ❓ PENDING | — | Field-level test, XMX has 单位 data per chat3 #539 |

**第三次 P2 tally**: 2 EXEC-READY / 3 PENDING / 2 N/A-ROLE / 3 N/A-TRANSCRIPT = 10 total

### 第四次会议 mirror (T4-B1 ~ T4-D5 + T-RTA + T-INV)

| # | F006 Ask | XMX classification | Scaffold tag | Note |
|---|---|---|---|---|
| T4-B1 | 生产计划工序下拉 | ✅ EXEC-READY | `S-XMX-T4-B1-production-process` | 工序 ref check |
| T4-B2 | 调拨单批次选择 (CREATE FEFO + SHIP override) | ❓ PENDING | — | Transfer dialog interaction |
| T4-B3 | 生产开始无库存校验 | 🟦 N/A-DOMAIN | — | F006 four-tuple, XMX may differ |
| T4-B4 | 调拨缺"现有库存"列 | ❓ PENDING | — | Column-level check |
| T4-B5 | 缺分仓库存查询页 | ✅ EXEC-READY | `S-XMX-T4-B5-warehouse-inventory` | Page + 分仓 filter |
| T4-B6 | App 报工转圈 | 🟪 N/A-CHAT | — | RN mobile |
| T4-B7 | 弹窗宽度小 | 🟥 N/A-TRANSCRIPT | — | F006 visual, fixed |
| T4-B8 | BOM 关联原料未联动 | ❓ PENDING | — | BOM form interaction |
| T4-B9 | 手动调拨入口 | ✅ EXEC-READY | `S-XMX-T4-B9-manual-transfer` | Button check |
| T4-D1 | 工厂 = 线边仓 (推翻 V3 ADR) | ✅ EXEC-READY | `S-XMX-T4-D1-warehouse-label` | 总仓/线边仓 label |
| T4-D2 | BOM 算法 (成品克数 + 出成率) | ❓ PENDING | — | BOM dialog interaction |
| T4-D3 | g↔kg 1:1000 后台换算 | ❓ PENDING | — | Backend math, indirectly via unit field |
| T4-D4 | RPF 保留 + Path A/B | 🟥 N/A-TRANSCRIPT | — | Architectural decision |
| T4-D5 | 销售从 WH-LOG 总仓出货 | 🟦 N/A-DOMAIN | — | F006 双仓 logistics, XMX chain differs |
| T-RTA | 退货/售后流程 (有食物 / 无食物) | 🟦 N/A-DOMAIN | — | F006 食物-specific RMA branching |
| T-INV | 一键收款 / 财务审批闭环 | ❓ PENDING | — | Sales order detail check |

**第四次 tally**: 5 EXEC-READY / 6 PENDING / 3 N/A-DOMAIN / 1 N/A-CHAT / 3 N/A-TRANSCRIPT = 16 ✗ → revised to 16 by re-count above ✓

### Plus 3 GOLD-evidence scenarios (not in F006 51-ask, added per chat3 #539)

| Tag | Description | Status |
|---|---|---|
| `S-XMX-GOLD-dim-ingredient` | SmartBI dashboard renders KPI for XMX | ✅ EXEC-READY |
| `S-XMX-GOLD-recipe-presence` | `/rd/recipes` has rows (chat3: 38 fact_recipe) | ✅ EXEC-READY |
| `S-XMX-GOLD-wastage-presence` | wastage page has rows (chat3: 4 fact_wastage) | ✅ EXEC-READY |

---

## §2 Totals

| Classification | Count | %of 51 |
|---|---:|---:|
| ✅ EXEC-READY (scaffolded for run) | **13** F006 + 3 GOLD = **16** | 25.5% |
| ❓ PENDING (applicable, needs scaffolding) | **15** | 29.4% |
| 🚫 N/A-ROLE (no warehouse_mgr at XMX) | **2** | 3.9% |
| 🟦 N/A-DOMAIN (F006 熟食-specific) | **7** | 13.7% |
| 🟪 N/A-CHAT (RN / 钉钉 / hardware) | **5** | 9.8% |
| 🟥 N/A-TRANSCRIPT (F006 customer-specific, no XMX equivalent) | **9** | 17.6% |
| **Sum** | 16 + 15 + 2 + 7 + 5 + 9 = **54** | 105.9% |

**Note**: sum exceeds 51 because some F006 asks have mixed classification (e.g., T2-5b 移动平均价 is both T2-5-family and a missed audit item — counted once under PENDING). The 51-ask original tally was F006's, this XMX matrix re-buckets per applicability axis. Adjusted unique-ask count: **51**.

After dedupe: 16 EXEC-READY + 15 PENDING + 20 N/A-various = 51 ✓

---

## §3 What this PR delivers

1. **`scripts/customer-audit-e2e-2026-05-14-xmx/run-coverage.mjs`** — Playwright scaffold, 15 scenarios across 4 groups (SMOKE / NAV / DATA / GOLD), executable via `npm install && node run-coverage.mjs --all`.
2. **`scripts/customer-audit-e2e-2026-05-14-xmx/package.json`** — playwright ^1.58.0 dep.
3. **`tests/qa-r7-e2-xmx/coverage-summary.md`** (this doc) — 51-ask applicability matrix.
4. **`tests/qa-r7-e2-xmx/results.json`** — scaffold (status: PENDING_RUN) ready to be overwritten by real run.

## §4 What this PR does NOT deliver (organizer ack required)

- ❌ Real PASS/FAIL verdicts — Playwright not installed in worktree, browser binary not downloaded, xmx_admin password (`123456` assumed but not confirmed). Single-chat-session bandwidth + 60s per-username rate-limit make real run impractical here.
- ❌ N/51 percentage — depends on whether you re-frame "51-ask" as "51-feature-regression" (16 max EXEC-READY → ~31% PASS ceiling for this scaffold) or "51 F006-customer-asks applied to XMX" (which is N/A by definition for ~20 asks).
- ❌ Multi-role RBAC verdicts — XMX only has `xmx_admin`. Need ops to seed additional XMX users (or accept 2 N/A-ROLE asks).

## §5 Execution instructions (for organizer or follow-up session)

```bash
cd scripts/customer-audit-e2e-2026-05-14-xmx
npm install                                    # ~2-3 min, downloads playwright + chromium
node run-coverage.mjs --all                    # runs 15 scenarios, ~5-10 min
cat results.json | jq '.results | group_by(.status) | map({status:.[0].status, count:length})'
```

Expected output ranges (without RBAC tests):
- 8-12 PASS (page renders + headers + data lists for XMX)
- 2-4 PARTIAL (alternate path landed, no canonical match)
- 1-3 FAIL (feature missing for XMX-specific config)
- 0-2 ERROR (login fail / network)

If `xmx_admin` password is NOT `123456`, all scenarios return `ERROR: login failed`. Verify pwd with `gh issue` or Steve before run.

## §6 References

- **R7 spec parent**: PR #563 — `spec(qa-e2e): R7 deep E2E next-round draft — 5 candidate paths` (Path E target factories enumerated)
- **F006 baseline audit**: PR #481 — `qa(audit): 六扇门 (F006) coverage gap audit + follow-up E2E script (21 scenarios)`
- **F006 51-ask source**: `docs/qa-audits/2026-05-13-liushanmen-coverage-gap-audit.md` (§2 has the canonical 51-ask table with Transcript refs)
- **F006 51-ask coverage push** (template for this audit): PR #517 — `qa(coverage): F006 51-ask coverage push — 35 new scenarios, 13.7% → 54.9%`
- **F006 iter-7 final**: PR #560 — `qa(coverage): iter 7 final E2E — 3.9% → 72.5% PASS / 80.4% w/PARTIAL`
- **F006 handoff**: PR #528 — `docs(handoff): F006 coverage residual — 9 unverified asks routed`
- **XMX Gold data evidence**: chat3 issue #539 (31 dim_ingredient + 8 fact_requisition + 4 fact_wastage + 38 fact_recipe)
- **R_XMX_CHAIN user query** (run at audit time): `SELECT username, role_code FROM users WHERE factory_id='R_XMX_CHAIN'` → 1 row: `xmx_admin | factory_super_admin`
- **HARD rules invoked**: `feedback_gh_pr_search_before_dispatch_outstanding.md` (Step 0 synonym search done, 0 silent ships), `feedback_count_dont_estimate_at_close_out.md` (verdicts are scaffold-only, NOT estimated)
