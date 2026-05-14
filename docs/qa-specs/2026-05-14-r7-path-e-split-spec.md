# R7 Path E split — manufacturing + restaurant matrices (separate dispatch tracks)

**Status**: 📝 SPEC — pending Steve sign-off
**Date**: 2026-05-14
**Author**: chat5 (R7-E followup, issue #602)
**Closes**: #602
**Predecessors**: PR #600 (R7-E1 QHJ), PR #597 (R7-E2 XMX scaffold), PR #601 (R7-E3 GML), `docs/qa-specs/2026-05-14-r7-deep-e2e-spec-draft.md`
**Source matrix**: `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs` + `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md`

---

## §0 TL;DR

R7-E1/E2/E3 (3 parallel chats) converged on the same finding: **the F006 51-ask matrix is manufacturing-flavored**. Force-replaying it against a RESTAURANT-type tenant produces ~14 INFO/FAIL signals that don't represent real coverage gaps — they trace to `router/index.ts:320,332,338` `meta.hideForFactoryTypes:['RESTAURANT']` defense correctly blocking sales/inventory/production manufacturing routes for restaurant tenants.

**Proposal**: split R7 Path E into two tracks with independent matrices and independent dispatch.

| Track | Tenant type | Matrix size | Source |
|---|---|---|---|
| **R7-E-manuf** | FACTORY (六扇门, 山东厂, etc) | 51 asks (existing) | `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs` |
| **R7-E-restaurant** | RESTAURANT (QHJ-chain, 桂满陇, IL TEATRO, etc) | 25 asks (new, this spec §3) | this spec + chat3 #601 restaurant-extras scaffold |

Add `applies_to: 'FACTORY' | 'RESTAURANT' | 'BOTH'` column to source matrix so future R8/R9 dispatchers route per tenant type without re-discovering the asymmetry.

---

## §1 Rationale

### 1.1 Three independent confirmations

| Chat | PR | Tenant | Outcome |
|---|---|---|---|
| chat1 | #600 | RES_3101_009 (QHJ chain, RESTAURANT) | 4 reported FAILs flipped to NOT_APPLICABLE_RESTAURANT after source-grep |
| chat2 | #597 | R_XMX_CHAIN (chain RESTAURANT) | Applicability matrix classified 23 of 51 asks as N/A for restaurant (7 domain + 2 role + 9 transcript + 5 chat-scope) |
| chat3 | #601 | R_GML_DEMO (RESTAURANT) | 8 FAILs, 4 traced to factory-only features (T2-10/T2-11/T2-12/T4-B9); explicitly recommended `applies_to` column |

Three chats hitting the same structural finding from three different angles satisfies the graduation threshold ("≥2 sister chats" — see `feedback_cross_chat_independent_finding.md` precedent).

### 1.2 Cost of not splitting

Without explicit FACTORY/RESTAURANT split:

- **Noise**: each future restaurant-tenant audit re-discovers the asymmetry (~30 min wasted per chat × N future audits)
- **Inflated FAILs**: matrix metrics get contaminated with NOT_APPLICABLE noise → coverage-percent signal degrades
- **Lost real signal**: restaurant-specific routes (`/restaurant/recipes`, `/restaurant/wastage`, `/restaurant/analytics/*`) are NOT in the 51-ask matrix at all → restaurant tenants are effectively un-audited on their own features
- **Dispatch confusion**: organizer cannot pick the right matrix without grep'ing tenant type first

### 1.3 Why now (not later)

- 3 of the 5+ candidate customer tenants for R8/R9 are restaurants (`R_QHJ`, `R_GML_DEMO`, `R_XMX_CHAIN`)
- Phase II restaurant finance/sales features (per chat session 2026-05-14 spec-write queue) will add MORE restaurant-specific surface area
- Cost to ship this spec ≈ 1h; cost of repeating the asymmetry-discovery 3× more times in R8/R9 ≈ 90+ min wasted + worse data

---

## §2 51-ask classification — `applies_to` per ask

Source: 51 customer asks aggregated from F006 transcripts 第一/二/三/四次 + audit doc §2. Each ask now carries an `applies_to` axis.

### §2.1 FACTORY-only (16 asks)

Features specific to manufacturing operations. Restaurant tenants correctly cannot reach these (router defense or feature inapplicability). Re-running on RESTAURANT → NOT_APPLICABLE_FACTORY_ONLY.

| Ask | Description | Why FACTORY-only |
|---|---|---|
| T1-1 | 生产计划网页端 (/production/plans) | Restaurant has no production plans; uses /restaurant/recipes |
| T1-2 | AI 对话引导创建生产计划 | Same — restaurant analog is recipe-driven |
| T1-3 | 当天生产计划按工序排 | Restaurant has no 工序 (process) concept |
| T1-4 | 小程序点工序卡片报今天产量 (RN scope) | Restaurant workers report via POS, not process card |
| T1-5 | 报工累计 (1小时一报后端求和) (RN scope) | Restaurant POS aggregation is sales-side, not production-side |
| T1-6 | YOLO 异物 + 金属探测 | Food-processing line QC; not restaurant FOH |
| T2-4 | RPF 全链路 (研发/采购/入库/批次/生产) | Restaurant has no 研发样品/生产批次 chain |
| T2-9 | BOM 多辅料 (一品 30+) | Restaurant uses recipes, not BOM |
| T2-10 | yield-rate 极低用量辅料 | BOM-tied feature; restaurant uses `/restaurant/recipes` 净料率/出成率 instead — see §3 R-2 |
| T2-11 | 工序投入产出 + 出成率分析 | Same domain mismatch |
| T4-B1 | 生产计划工序下拉 ("通用" 选项) | Same |
| T4-B3 | 生产开始无库存校验 (Rule 8 four-tuple) | Production-start gate; restaurant uses requisition/wastage |
| T4-B6 | App 报工转圈 (RN scope) | Production reporting |
| T4-B8 | BOM 关联原料联动 | BOM-tied |
| T4-D4 | RPF Path A/B 生产消耗 batch detail | Manufacturing batch detail |
| T4-D5 | 销售从 WH-LOG 总仓出货 (write op) | WH-LOG is manufacturing warehouse model; restaurant uses 门店仓 |

### §2.2 RESTAURANT-only (0 asks in current 51-list)

The F006 51-ask matrix has **0 restaurant-specific asks** — confirming the structural finding. Restaurant-specific surface is captured in §3 below as a new 25-ask matrix.

### §2.3 BOTH (cross-domain, 23 asks)

Features applicable to both tenant types. Same matrix entry, but expected route/label may differ — dispatcher should provide tenant-type hint.

| Ask | Description | Notes |
|---|---|---|
| T2-1 | AI 中台调度 (AI Agent/Skill 入口) | Same UI both types |
| T2-2 | 5 标准模块侧边栏 | Sidebar nav present in both (modules may differ; check via tenant-type-aware regex) |
| T2-3 | 钉钉交互通道 | NotificationService is tenant-agnostic |
| T2-5 | 销售→应收→应付 finance link | Both tenant types have finance module |
| T2-5b | 移动平均价 / 动态定价 | `/warehouse/material-types` exists for both |
| T2-6 | 大模型理解 (AI chat) | Same global AI chat |
| T2-7 | Skill 配置 (system/ai-skills) | Same |
| T2-8 | AI 跨模块调度 (SmartBI) | Both have SmartBI |
| T3-1 | 箱数自动算 (purchase order detail) | Both types order in boxes |
| T3-2 | 抄码品识别 | Procurement-side (`/procurement/orders`); applies to both |
| T3-3 | 三价对比 (采购订单详情) | Procurement applies to both |
| T3-4 | 期望交货 (采购订单 dialog) | Procurement applies to both |
| T3-5 | 审批链动态配置 (`/system/approval-chains`) | Approval flows for both |
| T3-6 | 采购订单字段挤压 (visual) | UI applies to both |
| T3-8b | 仓管入库只录数量+日期+拍照 (RBAC pattern) | Receive applies to both |
| T3-9 | RBAC 仓管列头隐藏 | RBAC applies to both — but restaurant may not seed `warehouse_mgr` role (see §5.3) |
| T3-12 | 原料关联供应商 (`/procurement/suppliers`) | Suppliers shared concept |
| T3-13 | 成品详情规格列盖住 (visual) | UI |
| T3-14 | 三价对手新采购后未刷新 | Procurement |
| T3-15 | 一二级单位转换 (`conversionRate`/损耗率) | Both — restaurant uses 损耗率, factory uses 转换率 |
| T4-B7 | 弹窗宽度 (sales dialog ≥ 800px) | UI applies to both |
| T4-B9 | 手动调拨入口 | Transfer applies to both — restaurant has /transfer/list too per chat1 finding |
| T-RTA | 退货流程 (food return / refund) | Both (factory: customer return; restaurant: kitchen return) |

### §2.4 FACTORY-leaning (BOTH but predominantly FACTORY-shaped, 12 asks)

These nominally apply to both tenant types but use FACTORY-flavored UX (e.g. WH-LOG/WH-WKS warehouse codes, BOM-default prices). Restaurant tenants may have feature but accessed via different route/label.

| Ask | Description | Restaurant analog |
|---|---|---|
| T3-10 | 销售单价 BOM 默认+可改 | Restaurant uses recipe-default + POS price override |
| T4-B4 | 调拨新建 "现有库存" 列 | Same column, but restaurant store→store transfer not BOM-store |
| T4-D1 | 销售订单 dialog 仓库列 (总仓/线边仓) | Restaurant 仓库 = 门店仓 instead |
| T4-D3 | g↔kg 1:1000 换算 | Same conversion, restaurant uses on recipes |
| T-INV | 一键收款 + 财务审批闭环 | Both, restaurant uses POS-confirmation flow |
| (8 audit-missed / weak-evidence not enumerated above — see source-doc §2.3 of R7 draft) | | |

**Dispatch rule for FACTORY-leaning**: include in restaurant matrix only if cross-mapped route/label is grep-confirmed; else flag as NOT_APPLICABLE_RESTAURANT (route variant not implemented).

---

## §3 RESTAURANT-only matrix (25 asks, NEW)

Coverage of `/restaurant/**` routes. Sources: PR #601 restaurant-extras scaffold (13 scenarios) + issue #602 enumeration + PR #600 §2 reclassification table (4 factory→restaurant reroutes).

### §3.1 配方管理 `/restaurant/recipes` (5 asks)

| ID | Ask | Source | Verify method |
|---|---|---|---|
| R-1 | 配方列表渲染 + ≥1 row | PR #601 restaurant-extras | navigate, count tbody rows |
| R-2 | 净料率 / 出成率 column (was T2-10 factory analog) | PR #600 §3.3 reclassification | regex `净料率\|出成率\|yieldRate` in headers |
| R-3 | 配方新建/编辑 dialog 含 原料列表 | F006 T4-B8 restaurant analog | open dialog, scan for 原料/辅料 |
| R-4 | 配方关联菜品/SKU | new (per issue #602 enumeration) | inspect detail page for SKU binding |
| R-5 | 配方多版本管理 (历史版本) | new | check for version field/列 |

### §3.2 领料管理 `/restaurant/requisitions` (5 asks)

| ID | Ask | Source | Verify method |
|---|---|---|---|
| R-6 | 领料列表渲染 + ≥1 row | PR #601 | navigate, row count |
| R-7 | 新建领料单 dialog 含 物料+数量+单位+门店 | PR #601 | open dialog, scan labels |
| R-8 | 领料单按门店筛选 | new | filter by store, verify result subset |
| R-9 | 领料单审批流转 | F006 T3-5 restaurant analog | check 审批 button + status field |
| R-10 | 领料单关联损耗记录 | new | cross-link to wastage |

### §3.3 损耗管理 `/restaurant/wastage` (3 asks)

| ID | Ask | Source | Verify method |
|---|---|---|---|
| R-11 | 损耗列表渲染 + ≥1 row | PR #601 | navigate, row count |
| R-12 | 损耗记录 dialog 含 原因/数量/操作人 | PR #601 | open dialog, scan labels |
| R-13 | 损耗按 SKU/门店 聚合 | new | filter, verify aggregation |

### §3.4 盘点管理 `/restaurant/stocktaking` (3 asks)

| ID | Ask | Source | Verify method |
|---|---|---|---|
| R-14 | 盘点列表渲染 | PR #601 | navigate, row count |
| R-15 | 盘点单 dialog 含 账面/实际/差异 | new | open dialog, scan 3 labels |
| R-16 | 盘点差异自动生成损耗 | new (cross-module) | submit, verify wastage row created |

### §3.5 数据分析 `/restaurant/analytics/*` (6 asks)

Note: chat3 #601 Finding 1 reports 4 of 5 routes returning /404 — needs separate RBAC investigation (filed as P2). Tests below assume routes restored.

| ID | Ask | Source | Verify method |
|---|---|---|---|
| R-17 | `/restaurant/analytics/overview` 渲染 + KPI cards | PR #601 §Finding 1 | navigate, count KPI cards |
| R-18 | `/restaurant/analytics/menu-board` 菜单热度 | PR #601 | check chart presence |
| R-19 | `/restaurant/analytics/store-comparison` 门店对比 | PR #601 | check 门店 selector + chart |
| R-20 | `/restaurant/analytics/dianping-gap` 大众点评对比 | PR #601 | check 评分/评论 data |
| R-21 | `/restaurant/analytics/gross-margin` 毛利率分析 (restaurant T2-12 analog) | chat3 confirmed PASS | check 毛利率 column/chart |
| R-22 | SKU 销量 trend 按菜品 | new | check time-series chart |

### §3.6 管理 `/restaurant/admin/*` + `/restaurant/data-completeness` (3 asks)

| ID | Ask | Source | Verify method |
|---|---|---|---|
| R-23 | `/restaurant/admin/etl-status` ETL 健康 | new (mentioned in issue #602) | check ETL job rows + last-run timestamp |
| R-24 | `/restaurant/data-completeness` 数据完整度仪表 | new | check completeness % gauge |
| R-25 | POS upload status (per `/system/pos`) | PR #601 | check sync timestamp + row counts |

---

## §4 Dispatch templates

### §4.1 R7-E-manuf dispatch (FACTORY tenant)

```
chat<N> — R7-E-manuf factory <factory_id> 51-ask coverage audit

**Source matrix**: scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs (51 asks)
**Excluded asks**: none — all 51 applicable to FACTORY tenant
**Tenant**: factory_super_admin account on <factory_id>
**Target**: http://139.196.165.140:8086 (prod, READ-ONLY)

Worktree:
git worktree add C:/Users/Steve/cretas-r7-e-manuf-<factory_id> -b qa/r7-e-manuf-<factory_id> origin/main

Scope (~3-4h):
1. Adapt run-coverage.mjs ACCOUNTS → seeded factory admin
2. Run all 51 scenarios; record verdicts to results-coverage.json
3. Source-grep INFO/FAIL per HARD rule feedback_grep_source_before_e2e_verdict
4. File P0/P1 as GitHub issues
5. Write COVERAGE-SUMMARY-<factory_id>.md
6. PR title: qa(r7-e-manuf): <factory_id> 51-ask coverage — <PASS>/51

Deliverable:
- scripts/customer-audit-e2e-2026-05-14-<factory_id>/
- tests/qa-r7-e-manuf-<factory_id>/COVERAGE-SUMMARY.md
- PR opened against main
```

### §4.2 R7-E-restaurant dispatch (RESTAURANT tenant)

```
chat<N> — R7-E-restaurant tenant <factory_id> 25-ask coverage audit

**Source matrix**: docs/qa-specs/2026-05-14-r7-path-e-split-spec.md §3 (25 asks)
**Plus**: §2.3 BOTH asks (23 asks) — verify if applicable on this tenant's routes
**Tenant**: factory_super_admin account on <factory_id> (RESTAURANT-type)
**Target**: http://139.196.165.140:8086 (prod, READ-ONLY)

Worktree:
git worktree add C:/Users/Steve/cretas-r7-e-rest-<factory_id> -b qa/r7-e-restaurant-<factory_id> origin/main

Scope (~2-3h, smaller matrix):
1. Scaffold run-restaurant-coverage.mjs from PR #601 chat3 restaurant-extras template
2. Implement 25 R-* scenarios per §3 (5 sub-route groups)
3. Run; record verdicts to results-restaurant.json
4. Optionally also run BOTH-applicable subset of 51-ask matrix (filter by §2.3 list)
5. Source-grep INFO/FAIL per HARD rule
6. File P0/P1 as GitHub issues
7. PR title: qa(r7-e-restaurant): <factory_id> 25-ask coverage — <PASS>/25

Deliverable:
- scripts/customer-audit-e2e-2026-05-14-<factory_id>/run-restaurant-coverage.mjs
- tests/qa-r7-e-restaurant-<factory_id>/COVERAGE-SUMMARY.md
- PR opened against main

Known prereqs:
- Restaurant tenant likely only seeds `factory_super_admin` (no warehouse_mgr/finance/operator) → cross-role RBAC SKIPPED per chat1/chat3 finding. Document as gap.
- /restaurant/analytics/* 4 routes may return /404 per chat3 #601 Finding 1 — verify before depending on R-17 through R-20
```

---

## §5 Acceptance bar additions to R7 §5

### §5.1 Manifest column

Each scenario in both matrices MUST declare:

```js
{
  tag: 'S-COV-R-1',
  applies_to: 'RESTAURANT',  // 'FACTORY' | 'RESTAURANT' | 'BOTH'
  ...
}
```

Runner asserts `applies_to` matches tenant `factory_type` (from `factories` table) before executing. Mismatch → `SKIP_TENANT_TYPE` (distinct from `SKIP_RBAC`).

### §5.2 Acceptance criteria (per tenant type)

| Tenant type | Min PASS | Min strong PASS (PASS + verified gap) | Note |
|---|---|---|---|
| FACTORY (51-ask) | 25/51 (49%) | 35/51 (69%) | F006 final achieved 72.5% strict PASS — establish benchmark |
| RESTAURANT (25-ask) | 15/25 (60%) | 20/25 (80%) | Smaller matrix, narrower scope, higher concentration expected |

Below these thresholds → BLOCK R7 close per `depth-first-e2e` Rule 10 (commit ≠ delivery).

### §5.3 Test-seed gap acknowledgement

Per chat1 (#600) and chat3 (#601) findings, RESTAURANT tenants currently seed only `factory_super_admin`. Multi-role RBAC negative regression (R7 §5.2 E4 + Path F §5.3 F3) is NOT RUNNABLE for restaurant tenants until test-seed expanded.

**Action**: cross-team ticket to DB ops requesting role seeds (`<tenant>_warehouse_mgr` / `<tenant>_finance` / `<tenant>_operator`) on R_QHJ_REAL, R_XMX_CHAIN, R_GML_DEMO. Tracked separately from this spec.

---

## §6 Pre-flight checks (before R8/R9 dispatch)

Before any future dispatcher uses Path E:

- [ ] Identify tenant `factory_type` via DB query: `SELECT factory_type FROM factories WHERE factory_id = '<tenant>'`
- [ ] If `FACTORY` → R7-E-manuf dispatch (§4.1)
- [ ] If `RESTAURANT` → R7-E-restaurant dispatch (§4.2)
- [ ] If `BOTH` / `MIXED` (e.g. ghost kitchens, central kitchens) → discuss with Steve; default to running both matrices and triangulating
- [ ] Confirm tenant has data: `SELECT COUNT(*) FROM users WHERE factory_id = '<tenant>'` (≥1 admin) plus at least one business table (sales_orders or restaurant_sales_plans) `> 0`. If zero data, audit pivots to feature-presence smoke only (per chat3 R_GML_DEMO experience: 18/48 PASS expected on zero-data tenant)

---

## §7 Rule 1-11 compliance (this spec)

| Rule | Compliance |
|---|---|
| Rule 1 (depth label) | §5.1 manifest enforces |
| Rule 2 (≥1 deep per round) | inherits R7 spec §5.2 E3 (deep ≥5 per factory) |
| Rule 3 (audit bug-discovery capability) | §5.2 thresholds enforce; spec itself shipped because §1.1 cross-chat finding triggered Rule 3 |
| Rule 4 (no "next round" forward-promise in audit) | §6 pre-flight is structural, not promissory |
| Rule 5 (Critic depth scrutiny) | inherits R7 spec |
| Rule 7 (spec-denominator summary) | §2 enumerates 51 source asks; §3 enumerates 25 new asks; totals explicit |
| Rule 8 (same-cause sweep) | §1.2 cost-of-not-splitting is the same-cause sweep result |
| Rule 9 (independent Critic) | this spec invites Critic at dispatch time |
| Rule 10 (commit ≠ delivery) | §5.2 BLOCK if thresholds unmet |
| Rule 11 (breadth coverage) | §3 adds the restaurant-specific surface that was none-covered |

---

## §8 References

- **Issue**: #602 (this spec closes it)
- **Predecessor PRs**: #600 (R7-E1 QHJ), #597 (R7-E2 XMX), #601 (R7-E3 GML)
- **R7 parent spec**: `docs/qa-specs/2026-05-14-r7-deep-e2e-spec-draft.md`
- **F006 source matrix**: `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs`
- **F006 audit doc**: `scripts/customer-audit-e2e-2026-05-13/COVERAGE-SUMMARY-2026-05-13.md`
- **F006 residual handoff**: `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md`
- **Restaurant extras scaffold**: chat3 PR #601 `scripts/customer-audit-e2e-2026-05-14-gml/run-restaurant-extras.mjs`
- **Router defense source**: `web-admin/src/router/index.ts:320,332,338` (`meta.hideForFactoryTypes:['RESTAURANT']`)
- **HARD rules**: `feedback_grep_source_before_e2e_verdict.md`, `feedback_f006_matrix_is_manuf_only.md`
- **Skill**: `.claude/skills/depth-first-e2e/SKILL.md`

---

## §9 Open questions for Steve

1. **Sign-off**: confirm split is the right move (vs single matrix with `applies_to` column only)?
2. **Restaurant matrix size**: §3 lists 25 asks. Add more from Phase II restaurant finance/sales spec when written? Or freeze at 25 and treat Phase II separately?
3. **Test-seed cross-team ticket**: file now (parallel with this spec) or wait until next R7-E-restaurant dispatch fails?
4. **Threshold calibration**: §5.2 60%/80% restaurant threshold is by inference (F006 hit 72.5%/80.4% on its native matrix). Calibrate after first 2 restaurant runs?
5. **R8 trigger**: dispatch R7-E-restaurant on R_QHJ_REAL using this spec immediately, or queue until Phase II restaurant features land?
