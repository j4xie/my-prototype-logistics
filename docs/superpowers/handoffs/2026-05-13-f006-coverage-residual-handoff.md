# F006 coverage push residual — handoff for non-F006-agent scope

**Created**: 2026-05-13 (post PR #527 merge)
**By**: F006 coverage agent (Steve's autonomous session 2026-05-13)
**Status**: handoff ready — 9 unverified asks need different agent contexts

---

## Context

F006 (六扇门) coverage push session shipped 2 PRs (#517 merged + #527 merged) iterating 6× over `scripts/customer-audit-e2e-2026-05-13/run-coverage.mjs`.

**Final F006 web-agent tally** (per `scripts/customer-audit-e2e-2026-05-13/COVERAGE-SUMMARY-2026-05-13.md`):
- 33 strict PASS / 5 confirmed gaps = **38/51 = 74.5%** verified state
- Plus 4 PARTIAL = **42/51 = 82.4%**
- 9 truly unverified — all out of F006 web-agent scope

This handoff routes those 9 to the right venue.

---

## 9 unverified asks routed

### Bucket R: RN App / 小程序 (3)

Cannot be E2E-verified via Playwright on web-admin. Need RN/Maestro or 微信小程序 testing context.

| Ask | Description | Recommended agent |
|---|---|---|
| **T1-4** | 小程序点工序卡片报今天产量 — 第一次会议 "小马的模块... 点对应的卡片进去报" | `e2e-miniprogram` skill (MallCenter project) |
| **T4-B6** | App 报工转圈 (单一用户 pw drift, 后端问题) — 第四次会议 line 616-630 | `e2e-native` skill (Maestro YAML) — chat5 OTA followup per audit doc |
| **T1-5** | 报工累计 (1小时一报后端求和) — 第一次会议 line 1 "一个小时报一下" | Likely RN (`e2e-native`); fallback: backend log inspection on 47.100.235.168 |

**Web-agent verdict on these 3**: INFO — page not found in web-admin scope. Real verification requires native testing.

### Bucket T: Test env defer (3)

Web-admin-test at `http://139.196.165.140:8097` reachable, but per memory `reference_test_env_warehouse_account.md` F006 test seed accounts NOT present on test DB (only F001 seed). Need cross-team test env seed work before these can run.

| Ask | Description | Blocker |
|---|---|---|
| **T4-B3** | 生产开始无库存校验 (Rule 8 four-tuple — toast + sticky + actionHint + backend match) — 第四次会议 line 586-602 | Need F006 PENDING production plan with material > available on test env |
| **T4-D5** | 销售从 WH-LOG 总仓出货 (write op) — 第四次会议 line 706-732 | Need F006 已批准 sales order on test env + warehouse stock |
| **T3-14** | 三价对手新采购后未刷新 bug | Need ability to create new procurement order on test env without polluting prod data |

**Recommended next step**: file cross-team ticket asking DB ops to seed F006 schema (factory + users + sample BOM/orders) onto test DB. Or wait until F006 customer themselves runs UAT on test env.

### Bucket V: Visual QA tickets filed (2)

Not E2E-testable. UI/typography concerns.

| Ask | GitHub Issue | Recommended agent |
|---|---|---|
| **T3-6** 采购订单字段挤压 | [#523](https://github.com/j4xie/my-prototype-logistics/issues/523) | UI designer / Vue dev with `design` skill |
| **T3-13** 成品详情规格列盖住 | [#524](https://github.com/j4xie/my-prototype-logistics/issues/524) | Same |

### Bucket C: Conditional / data-dependent (1)

| Ask | Description | Status |
|---|---|---|
| **T3-2** 抄码品识别 | Feature code at `web-admin/src/views/procurement/orders/list.vue:131` (`isAbacaItem`). PR #173 P1-3 shipped. F006 prod has no row with `specification === '抄码'` so the 抄码品 tag never renders in prod. | INFO — code verified, prod data not triggering. Mark PASS once F006 has an abaca-style procurement item, OR seed test row. |

---

## 5 confirmed feature gaps (filed / needs PRD)

Tickets / next steps required:

| Ask | Gap | GitHub Issue |
|---|---|---|
| **T-RTA** | 退货流程 (有食物退货 + 无食物退款) — 0 router + 0 view files (PR #517 P1 evidence) | NOT YET FILED — recommend file as feature ticket |
| **T4-B4** | 调拨新建 dialog "现有库存" 列 — PR #295 ship-claim 与 prod 不符 | NOT YET FILED — recommend file as bug |
| **T4-D4** | RPF Path A/B 生产消耗 (batch detail 无 raw_material consumption records) | NOT YET FILED — recommend file as feature ticket |
| **T2-5b** | 移动平均价 / 动态定价 / 每批次追踪 (无 movingAvgPrice 页) | NOT YET FILED — recommend file as feature ticket |
| **T4-D1** | 销售订单 dialog 缺仓库列 (总仓/线边仓) — `utils/warehouse.ts` exists but not imported | [#525](https://github.com/j4xie/my-prototype-logistics/issues/525) FILED |

**Recommended follow-up**: file GitHub feature tickets for the 4 unfiled gaps (T-RTA, T4-B4, T4-D4, T2-5b). Each should reference the customer transcript line + audit doc §2 row + source-grep evidence (similar to #525 template).

---

## 4 PARTIAL asks (semi-verified)

These have implementation in some module but missing in F006-specific context:

| Ask | Half done | Missing |
|---|---|---|
| **T-INV** 一键收款 + 财务审批闭环 | `/finance/payments` exists, "录入收款" button | "一键收款" label scope unclear — may live on sales-order detail side as button; needs PM clarification |
| **T2-4** RPF 全链路 (研发→采购→入库→提取→生产) | All 5 endpoints exist as separate pages | Cross-page state flow not E2E-verified (multi-step write) |
| **T1-6** YOLO 异物 + 金属探测 | `backend/python/foreign_object_detection/{yolo,pipeline,vl_reviewer}.py` (YOLO 异物 done) | 金属探测 sensor integration absent — food-kb knowledge base only |
| **T2-3** 钉钉交互通道 | `NotificationService` (3 files) sends 钉钉 webhook | 双向 AI 对话 Tool / OAuth callback not implemented — `docs/plans/dingtalk-integration-plan.md` is plan only |

**Recommended next step for each**: PM disambiguation (T-INV scope) / cross-page Playwright (T2-4) / hardware integration scope (T1-6) / 钉钉 Tool implementation (T2-3, per existing plan).

---

## Memory rules graduated this session

Two `feedback_*` rules to add to `MEMORY.md` (durable across future sessions):

1. **Grep Vue source before declaring E2E INFO/FAIL** — iter 5 + iter 6 lesson. When E2E scenario can't verify an ask, grep `web-admin/src/views/**/*.vue` for the actual label/route/field name BEFORE downgrading. 4 false-negatives turned to PASS in iter 5 (T3-2/T3-4/T3-12/T3-15) by this discipline; 1 false-INFO turned to confirmed gap in iter 6 (T4-D1). Saves 2-3 iterations of guessing.

2. **Source-grep can confirm feature gap when E2E can't reach** — when expected element doesn't appear after Playwright's deepest interaction, the gap can still be CONFIRMED by grep'ing the view file for the expected label/import. T4-D1: `sales/orders/list.vue` lacks 仓库 column AND lacks `warehouseDisplayLabel` import → real gap, file ticket immediately rather than spinning on more Playwright depth.

---

## Continuity check

- ✅ Both PRs merged: #517 (3e4abcd1b) + #527 (6a3c2b0de) on origin/main
- ✅ run-coverage.mjs lives in `scripts/customer-audit-e2e-2026-05-13/` for re-run
- ✅ 3 GitHub issues filed (#523 / #524 / #525)
- ⏳ 4 issues NOT YET filed (T-RTA / T4-B4 / T4-D4 / T2-5b feature tickets)
- ⏳ Cross-chat handoff for 9 residual (this doc)

## NOT recommended

- DON'T re-run all 35 scenarios speculatively — current state is stable. Re-run only when a referenced feature ships or for periodic regression.
- DON'T merge `run-coverage.mjs` selector changes without source-grep verification.
- DON'T claim closing T4-B3/T4-D5/T3-14 from F006 web-admin agent context — they genuinely need test env seed work.

## Sign-off

F006 web-agent session scope reached. Steve approved 2 merges (#517 / #527) and ongoing direction. Residuals routed.
