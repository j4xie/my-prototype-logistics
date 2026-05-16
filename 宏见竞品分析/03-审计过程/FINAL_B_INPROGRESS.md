# Cretas 项目进行中工作核查 — 客户 P0 需求避免重复决策清单

**生成日期**: 2026-05-14
**核查范围**: 最近 90 天 git log (207 commits) + 历史 51 PR + specs (April-May 2026) + 当前 open issues
**用途**: 与"必抄清单"对照,避免重复已经在做或已完成的工作

---

## §1 客户 10 P0 需求当前状态表

| # | 客户 P0 需求 | 状态 | 证据 (PR # / SHA / file) | 客户已确认接收 |
|---|---|---|---|---|
| 1 | **PDF 打印 + 扫码入库闭环** | 🟡 进行中 — Phase 1 (PDF 后端) 已 ship, RN 扫码 v2 PENDING | PR **#413** (`98deec40f`) `feat(purchase): P0 供货单 PDF 打印 + 条码工作流`. iText 5 + Code128 + QR + 中文字体. 测试 4/4 PASS. **RN 扫码 (v2)** 在 PR body 标注为 "后续 follow-up issue, 不在本 PR". | ⚠️ 客户验收 PENDING (PR body §Test plan 第 4-5 项未打勾) |
| 2 | **RBAC 采购员/仓管员角色隔离** | ✅ 已 ship — 大面积部署 | PR **#423** `feat(rbac): price field isolation` (Option B 长期正解) — Jackson `@ControllerAdvice` ResponseBodyAdvice + 13 字段 8 entity. 接续 PRs: #443 hotfix / #455 verify / #458 BUG-1/3/5/6 / #461 valuation gate / #462 PR443-F8 / #466 BomItem / #472 canViewPrice store / #476 cross-module sweep / #479 recursive Map / #483 region / #486 dashboard / #487 orders detail / #488-#499 R6 sweep / #520 35 Vue UI v-if / #598 15 views / #626 SmartBIAnalysis+TemplateCard. R7-F2 5×5 multi-role 测试 **13/13 PASS 0 bypass** (PR #599). | ✅ 已确认 (R7-F2 通过) |
| 3 | **收货数量分次显示列** | ✅ 已 ship | PR **#414** `feat(receipt): 收货记录列表加'收货数量'列`. `web-admin/src/views/procurement/receives/list.vue` 新增 `totalReceivedQuantity` 列, 多单位混合分组显示. | ⚠️ 客户验收 PENDING (PR body §Test plan 第 3 项未打勾) |
| 4 | **生产工序"通用 P 过来"未关联 bug** | ⚠️ 仅 spec (T2-4 RPF 链 PARTIAL) | PR **#567** issue: "[E2E followup] T2-4 RPF chain — cross-page state verification". PR #613 `qa(#567): T2-4 RPF chain API verification — PARTIAL (entity gap + data gap)`. PR #621 `fix(#567): L3 receives list shows raw UUIDs in 采购订单/供应商 columns`. PR #629 walk-chain re-verify L3 PARTIAL → PASS. **仍有 follow-up #622 (L1→L2 sample_id schema decision) 和 #623 (L4→L5 MaterialConsumption data seed)** open. | ❌ 未确认 |
| 5 | **预估成本字段权限隐藏** | ✅ 已 ship (并入 #2 RBAC sweep) | `@PriceSensitive` annotation 已覆盖 `costUnitPrice` (`SalesOrderItem`), `unitPrice`, `totalAmount`, `taxAmount`, `discountAmount` 等 13 字段. PR #444 + #457 + #462 + #466 后续 sister sweep 已覆盖 disposable/production/wastage. | ✅ (R7-F2 通过) |
| 6 | **BOM 物料名称改为选择 (不是手写)** | ⚠️ 仅 spec — D2 决策已写, impl 状态未确认 | Spec `docs/superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md` §D2 (BOM 配方算法 — 后端 `BomItem.getActualQuantity()` 已实现, 前端"需检查"). 关联 BUG-3 (PR **#374** BomServiceImpl: standardQuantity > 0 校验) 和 BUG-4 (POST phantom id strip). **未发现"物料选择器替换手写"专项 PR**. | ❌ 未确认 |
| 7 | **单位转换强校验 (g↔kg)** | ⚠️ 仅 spec — D3 决策已写, impl PENDING | Spec `2026-05-10-customer-meeting-design-decisions-impl-plan.md` §D3 (BOM 单位 1:1000 后台换算, 2-3d effort, dependencies D2). 后端 `UnitOfMeasurement.toBaseUnit()` / `fromBaseUnit()` 已存在 (entity `config/UnitOfMeasurement.java:36`). **未发现 g↔kg 强校验专项 PR**. | ❌ 未确认 |
| 8 | **三价对比新建后不刷新 bug (T3-14)** | ❌ 未开始 — Test env blocker | Handoff doc `docs/superpowers/handoffs/2026-05-13-f006-coverage-residual-handoff.md` Bucket T: "Need ability to create new procurement order on test env without polluting prod data". 状态: 必须先 seed F006 test schema. | ❌ 未确认 |
| 9 | **列宽 audit (销售单详情规格列)** | ✅ 已 ship | PR **#535** `fix(ui): widen 规格 + 产品/原料名称 columns in detail tables (closes #523 #524)` — 84ea3964e. Issues **#523** (采购订单详情字段挤压) + **#524** (成品详情规格列被盖住) closed 2026-05-13. | ⚠️ 客户验收 PENDING |
| 10 | **钉钉机器人 PoC** | ⚠️ 仅 spec — Plan only, T2-3 PARTIAL | `docs/plans/dingtalk-integration-plan.md` (2026-03-18 v1.0, 完整 9 章技术设计, 包括 robot/data API/AI intent 集成/cost/security/roadmap). Handoff doc: T2-3 "NotificationService (3 files) 发 钉钉 webhook ✅, 双向 AI 对话 Tool / OAuth callback 未实现". **未发现 PoC impl PR**. | ❌ 未确认 |

**汇总**: 10 项中 **3 项 ✅ 已 ship**(#2 #3 #5 #9 算 4 项),**1 项 🟡 进行中**(#1),**4 项 ⚠️ 仅 spec**(#4 #6 #7 #10),**1 项 ❌ 未开始**(#8). 客户验收确认基本都 PENDING (除 RBAC R7-F2 已测).

---

## §2 与客户需求相关的近期已合并 PR (按时间倒序 20 个)

| # | PR | Date | 关联客户需求 |
|---|---|---|---|
| 1 | **#631** qa(issue-604): V20260514_04 deploy + 12-account smoke + R7 F3 re-sweep — 175/175 PASS | 2026-05-14 | 关联 #2 RBAC (餐饮链多账号 smoke 测试) |
| 2 | **#626** feat(rbac): SmartBIAnalysis + TemplateCard component-level canViewPrice | 2026-05-14 | #2 RBAC follow-up |
| 3 | **#618 / #611 / #615** feat(sales-shipment): #572 — recommendFifo + allocateBatches honor sourceWarehouseCode | 2026-05-14 | T4-D5 (销售从总仓出货 spec D5) |
| 4 | **#599** qa(r7-f2): 5×5 multi-role RBAC negative regression — 13/13 PASS, 0 bypass | 2026-05-14 | #2 RBAC 验证 |
| 5 | **#598** feat(rbac): canViewPrice sweep — 15 views (P1, customer audit follow-up) | 2026-05-14 | #2 RBAC UI |
| 6 | **#583 / #571** feat(returns): T-RTA Phase A+B+C — withGoods toggle + sales-return DEFECTIVE inbound | 2026-05-13 | T-RTA 退货流程 (新发现 feature gap) |
| 7 | **#549** feat(sales-returns): T-RTA frontend — list + detail + 申请退货 dialog | 2026-05-13 | T-RTA |
| 8 | **#547** feat(sales-orders): 来源仓库 column on order dialog + detail (closes #525) | 2026-05-13 | T4-D1 (销售订单缺仓库列) |
| 9 | **#545** feat(transfer): show 现有库存 in manual-create dialog (closes #532 #540) | 2026-05-13 | T4-B4 (调拨现有库存列) |
| 10 | **#542** feat(batch-detail): show 原料消耗记录 from MaterialConsumption (closes #533) | 2026-05-13 | T4-D4 (RPF Path A/B 生产消耗) |
| 11 | **#541** feat(material-types): expose 移动均价 column (closes #534) | 2026-05-13 | T2-5b (移动平均价 / 动态定价) |
| 12 | **#535** fix(ui): widen 规格 + 产品/原料名称 columns (closes #523 #524) | 2026-05-13 | #9 列宽 audit |
| 13 | **#520** feat(rbac): UI defense — canViewPrice v-if on 35 Vue views | 2026-05-13 | #2 RBAC UI 大面积 v-if |
| 14 | **#516** feat(web-admin): QHJ 收入管理报表 — Phase I (Vue + uploader + E2E) | 2026-05-13 | QHJ 餐饮新功能 (非 F006 但关联 customer-feature) |
| 15 | **#492-#508** feat(smartbi): QHJ 收入管理报表 — Phase A-H (8 phases) | 2026-05-13 | QHJ 餐饮报表新功能 (Phase A-H ship 完整, 含 Bronze/Silver/Gold/Templates/API/Tools) |
| 16 | **#481** qa(audit): 六扇门 (F006) coverage gap audit + follow-up E2E script (21 scenarios) | 2026-05-13 | 客户 ask 全面盘点 (51-ask 矩阵 baseline) |
| 17 | **#467** fix(ui): hide price columns at `<el-table-column>` level | 2026-05-12 | #2 RBAC UI |
| 18 | **#443** [P0 HOTFIX] @PriceSensitive METHOD target + Jackson filter | 2026-05-12 | #2 RBAC critical hotfix |
| 19 | **#414** feat(receipt): 收货记录列表加'收货数量'列 | 2026-05-12 | #3 收货数量列 |
| 20 | **#413** feat(purchase): P0 供货单 PDF 打印 + 条码 | 2026-05-12 | #1 PDF + 扫码 Phase 1 |
| 21 | **#423** feat(rbac): price field isolation (PR #415 Option B 长期正解) | 2026-05-12 | #2 RBAC backbone |
| 22 | **#374** fix(ux): depth-e2e v2.4 BUG-1 + 2 + 3 + 4 batch | 2026-05-11 | #6 BOM standardQuantity 校验 + BUG-4 phantom id |

**关键观察**: F006 客户需求驱动了 ~30+ PR 在最近 2 周内 ship。"必抄清单"如果列了上述任何一项,需要先核对 PR 状态再决策。

---

## §3 与客户需求无关但活跃的项目 (注意避免冲突)

| 项目 | 状态 | 证据 | 与客户需求潜在冲突 |
|---|---|---|---|
| **Phase 2A/2B/2C Java→Python 迁移** | 🟡 大部分完成,T6.5 Phase A close,T6.6 进行中 | PR #565 audit(phase-2c-tier-2): dashboard 8 remaining endpoints port/keep/sunset decision. PR #543 ops(t6-6-3c): full restaurant cascade. PR #526 / #536 stage canary cutover. 50 SmartBI analysis endpoints byte-shape Python port. | ⚠️ 改 SmartBI 相关字段/响应格式时需查询 Python migration 状态,不要破坏 dict-eq parity |
| **R7-Path-E 51-ask coverage** | 🟡 进行中 — E1/E2/E3 已 dispatch | PR #600 R7-E1 RES_3101_009 QHJ chain 7/35 PASS / PR #601 R7-E3 R_GML_DEMO 18/48 PASS / PR #597 R7-E2 R_XMX_CHAIN 0/51 (execution PENDING). 已发现 F006 51-ask matrix is **manuf-only**, restaurant 链需独立矩阵 (#602). | ⚠️ "餐饮链 51-ask 必抄清单" 若来自 F006 模板, 已知 ~14/35 cells NOT_APPLICABLE; 应该用 #602 split 后的 restaurant matrix |
| **Restaurant Phase II Analytics spec** | ✅ Spec 已 ship,impl PENDING | PR #620 docs(smartbi): Restaurant Phase II Analytics spec — 4-cycle audited. PR #608 feat(smart-bi): restaurant Phase II placeholder. Spec file `docs/superpowers/specs/2026-05-14-restaurant-phase-ii-analytics-spec.md` (65KB). | ⚠️ 餐饮新功能加之前需查 Phase II spec 是否已规划 |
| **AI Chat 1-shot + 意图统一** | ✅ 大部分完成 | PR #593 feat(ai-chat): unify Python AIQuery → Java intent system + inline charts. PR #596 feat(ai-intent): SlotFilling LLM extraction fallback. PR #569 fix(phase-i): AI Chat 1-shot + real /upload + bug 10/11 fixes. | 🟢 客户的 AI 报表/AI 对话 ask 应该走这个 stack,不要新建 IntentHandler (rule 已禁止) |
| **OTA 自托管 Phase 0-6 全 ship** | ✅ 已 LIVE | 6 PRs (#363/#373/#375/#380/#381/#382). ota.cretaceousfuture.com via 139 nginx + Let's Encrypt ECC. 116 tests GREEN. (per Memory project_2026_05_12) | 🟢 客户的 App 更新 ask 应走 OTA,不需要新建 |
| **#566 RN 报工** | 🟡 RN/Maestro scope | PR #610 qa(#566): RN 报工 investigation. PR #617 fix(work-report): T4-B6 SQL-side dedup. | ⚠️ 客户 ask"App 报工转圈"已有 RCA, 不重做 |
| **LLM Router 4-provider 容错** | ✅ 已完成 | PR #594 / #587 / #578 / #577 / #576 多次轮换 SKU + quota 容错. PR #584 DeepSeek 决策. PR #585 bailian memory refresh. | 🟢 LLM 后端基础设施,不冲突 |
| **Customer Transcript 持久化** | ✅ 已 ship | PR #406 docs(customer): 六扇门第四次 May 10 mp4 transcript. PR #400 第三次 May 7 audio transcripts. PR #505 PR #481 explicit access procedure. | 🟢 客户 transcript 已在 git store, 可 `git fetch origin pull/400/head` 读取 |
| **canViewPrice 中心化** | ✅ 已完成 | PR #472 refactor(rbac): centralize canViewPrice + PRICE_VIEW_ROLES to permissionStore. | ⚠️ 新增价格字段保护时,直接用 store 不要硬编码角色 |
| **#572 sourceWarehouseCode 流通 (T4-D5)** | 🟡 Phase A+B-1 ship,后续 PENDING | PR #611 Phase A. PR #618 Phase B-1. PR #615 manual+FIFO. PR #564 propagate sourceWarehouseCode. | ⚠️ 销售/调拨工作流 spec D1/D5 实现中,改这块前先查 #572 状态 |

---

## 关键提示

1. **不要重做 RBAC 价格隔离** — #423 Option B 已完整 ship, 13 字段 8 entity + 35 Vue v-if + 5×5 negative regression PASS. 新增字段只需加 `@PriceSensitive` annotation,UI v-if 用 `canViewPrice` from `permissionStore`.

2. **PDF + 扫码闭环** — 后端 PDF #413 已 ship 但 RN 扫码 v2 未做,如需推进可直接接续 #413 PR body §v2 列举的 scope (expo-barcode-scanner + MaterialReceiptScreen).

3. **D1/D2/D3 (双仓 + BOM 算法 + 单位换算)** — spec `2026-05-10-customer-meeting-design-decisions-impl-plan.md` 完整描述, 但 D2/D3/D6/D7 的 **impl PR 暂未在 git history 找到**, 应该是 Phase IIa parallel dispatch (PR #630 docs(dispatch): 3 marching orders for Phase IIa) 待执行.

4. **钉钉机器人** — 仅 plan (`docs/plans/dingtalk-integration-plan.md` 2026-03-18), 客户 ask "T2-3 钉钉交互通道" 仍 PENDING impl, NotificationService 仅发 webhook 不接收.

5. **餐饮链 (RES_3101_009 / R_QINGHUAJIAO_REAL / R_XMX_CHAIN / R_GML_DEMO 等)** 51-ask 矩阵已分拆 (#602),不要套 F006 manuf matrix 到餐饮.

6. **Open issues 涉及 F006 follow-up**: #538 (F006 test seed) / #574 (YOLO 异物 UI surface) / #575 (T2-11/T2-12 data depth) / #592 (T2-12 毛利率 bonus findings) / #622 #623 (#567 RPF L1-L5 follow-up). 这些是已知 gap, 客户 ask 触及时优先关联现有 issue.

7. **F006 coverage 当前是 72.5% PASS / 80.4% w/PARTIAL** (PR #560 iter 7 sign-off), 9 残留 ask 已 routed to handoff (RN 3 / test-env 3 / visual QA 2 / conditional 1).
