# Steve Sign-off Package — 2026-05-10 客户对接 follow-up

**Source meeting**: 2026-05-10 customer 对接 (F006 六腾门 / 卤制品工厂, `f006_admin`)
**Source transcript**: `.tmp-transcripts/2026-05-10-customer-meeting.md` (48 min, 1016 SRT 段)
**Open items**: 12 items across 3 source PRs (#288 spec, #289 audit, #299 B9 follow-up)
**Already shipped Phase 1+2**: PR #293 (B1/B7/B8) / #294 (D4-A docs) / #295 (B4) / #296 (B6 OTA infra) / #297 (D2+D3) / #299 (B9 入口) / #305 (B3) — 8 PRs

---

## How to use this doc (5 min total)

For each item below, check ONE of the option boxes (A / B / C / 自定义).
Add inline comments if you want a custom answer.
When done, comment on the PR: **"Approved as marked"** or **"Approved with edits"** — organizer will dispatch implementation subagents per choices the next morning.

---

## TL;DR — 12 items + cascade

| Group | Items | Source PR | Total effort once signed off |
|-------|-------|-----------|------------------------------|
| **A — 设计决策** | A1-A5 (D1-D5 residual) | #288 §10 | 7-11 day (dominated by D1 + D5) |
| **B — Bug 决策** | B1-B5 (B2/B5/B6 残留) | #289 §6 | 1.5-2 day |
| **C — B9 follow-up** | C1-C2 (审批 + dropdown) | #299 body | 0.5 day |
| **总计** | **12** | — | **9-13 day** |

---

## Group A: 设计决策 (PR #288 §10)

PR #288 列了 7 个 sign-off questions. q6 (B1 优先级) 和 q7 (F006 登录) 在 Phase 1+2 已落地 (PR #287 audit + PR #293 fix). 留 5 个 (A1-A5).

---

### A1 — D1 推翻 V3 P0-5 ADR (MaterialBatch.warehouse_id)

- **Source**: PR #288 §10 q1, §9.1 conflict note, §2.10 dependency
- **Background**: 客户业务模型明确"工厂 = 线边仓 (当天清空) + 总仓 (持久库存)". 但 V3 P0-5 ADR (`2026-04-11-v1-e2e-framework-redesign.md` line 217 + `V20260411_03__factory_warehouses.sql:1-7`) 明说 "MaterialBatch 不加 warehouse_id, 双仓仅作 reference data". 要做 D1 双仓流转必须推翻该 ADR.
- **The question**: 推翻 V3 P0-5 ADR + 给 MaterialBatch / FinishedGoodsBatch 加 warehouse_id 字段?
- **Options**:
  - [ ] **A (recommended)**: 推翻 ADR. 加 `warehouse_id` 字段到两个 batch 实体, 全部 inventory query 加 warehouse 维度. Migration 默认回填 WH-LOG (兼容历史数据). ~3-4 day, unblocks A2 (D5) + B2 (B5) + B5 (灰度).
  - [ ] **B**: 不动 ADR. 用 factory-level inventory + 标签区分 "实际库存" vs "总仓库存". ~1 day, 但语义模糊, 与客户业务模型偏离.
  - [ ] **C**: 自定义 (例: 只给 FinishedGoodsBatch 加 warehouse_id, MaterialBatch 留待 Phase 4).
- **Implications if A**:
  - 同时解锁 A2 (D5 销售走总仓) + B2 (B5 分仓库存查询页) + 后续反向调拨自动触发
  - V3 ADR 文档需要补 revision note
  - 历史数据 backfill 默认 WH-LOG, 0 数据丢失
- **Recommended default**: **A** — 客户业务需求明确, 不推翻 ADR 会让 D1/D5 设计扭曲

---

### A2 — D4 路径 A (仅文档) vs B (改 BomExpansionService)

- **Source**: PR #288 §10 q2, §5.5, §9.2 hidden divergence
- **Background**: D4 客户决策"RPF 保留不删". PR #294 已 ship 路径 A (仅文档 + UI Banner 提示). 但 §5.5 暴露隐藏分歧: `BomExpansionService.expandBOM()` 当前读 `material_product_conversions` (RPF), 不读 `bom_items`. 客户在 BOM 页面录配方 → **生产计划展开时该数据可能不被使用**. PR #297 (D2+D3) 已加 `MaterialRequirement.sourceUnit` 字段, D3 单位换算 dormant 等待 D4-B 激活.
- **The question**: 是否 ship D4-B (改 BomExpansionService 读 BomItem)?
- **Options**:
  - [ ] **A (default — 已 ship)**: 保留路径 A only. 客户原话"原本的 RPF 足够了"理解为 RPF 仍可用. 0 额外工作.
  - [ ] **B (recommended)**: 加 ship D4-B. BomServiceImpl save 时 dual-write to MaterialProductConversion (RPF). BomExpansionService 改读 BomItem 优先, RPF fallback. ~2-3 day. **激活 D3 单位换算 end-to-end** (per PR #297 handoff note).
  - [ ] **C**: 自定义 (例: feature flag `BOM_EXPANSION_USE_BOM_ITEMS`, F006 灰度).
- **Implications if B**:
  - 客户在 BOM 页面录的配方真正被生产计划用 → 业务符合期望
  - D3 g↔kg 换算激活 → 客户调拨单按 kg 显示 (per PR #297 §1.4 backward compat note)
  - 老工厂 RPF 数据保留 (向后兼容)
  - Schema 不变 (两表共存)
- **Recommended default**: **B** — 否则 D3 单位换算实际效果 0, 客户体验不全

---

### A3 — D1 反向调拨触发时机

- **Source**: PR #288 §10 q3, §2.4 spec impact §4
- **Background**: 客户原话(transcript line 43): "我们爆工 [报工] 包完以后, 库存已经调播调回去总仓". 设计意图明确: 报工 COMPLETED → 自动触发 BRANCH_TO_HQ 反向调拨. 但具体触发模式 (全自动 / 半自动 / 手动) 待定.
- **The question**: 报工完成后反向调拨怎么触发?
- **Options**:
  - [ ] **A (recommended)**: **自动生成草稿态 BRANCH_TO_HQ 调拨单, 用户确认后提交**. 兼顾自动化 + 用户控制. ~1 day on top of D1.
  - [ ] **B**: 全自动直发, 无草稿. 用户事后只能 cancel. 风险: 数量错时已经 commit, 难撤销.
  - [ ] **C**: 完全手动, 报工只发 ProductionCompletedEvent 通知, 用户走 B9 入口手动新建. 0 额外 (B9 已 ship). 风险: 客户原话期望自动.
  - [ ] **D**: 自定义.
- **Implications if A**:
  - 需新建 `ReverseTransferService` (per PR #288 §2.5)
  - 需发布 `ProductionCompletedEvent` (WorkReportingServiceImpl)
  - DRAFT 状态调拨单需有"批量确认"入口避免 UX 烦躁
- **Recommended default**: **A** — 客户既要自动化又要控制权

---

### A4 — D3 历史数据迁移策略

- **Source**: PR #288 §10 q4, §4.8 migration plan
- **Background**: D3 单位换算 (g ↔ kg) 在 PR #297 已 ship 框架, 但旧 BOM 数据 unit 可能是 'kg' / '克' / 'g' / 自由文本不统一. 是否主动批量回填到 'g'?
- **The question**: 历史 BOM 数据 unit 字段如何处理?
- **Options**:
  - [ ] **A (recommended)**: **Lazy migration**. 客户在 BOM 编辑时遇到旧值时手动调整. 1 周后审计统计 `SELECT unit, COUNT(*) FROM bom_items GROUP BY unit;` 残留高再人工跟进. 0 额外 effort.
  - [ ] **B**: Eager batch migration. 跑一次 cron `UPDATE bom_items SET unit='g' WHERE unit IN ('克','克(g)','grams')`. 风险: 把客户原本意图是 'kg' 的也改错. ~0.5 day + Steve review.
  - [ ] **C**: 自定义 (例: 只回填 F006 数据, 其他工厂留 lazy).
- **Implications if A**:
  - 0 立刻成本
  - 老数据 BomExpansion 走 1:1 (D4-B 激活后会按 sourceUnit 判断)
  - 客户测试中遇到时 UI 提示 "建议改为 g"
- **Recommended default**: **A** — 高风险换不回任何明显收益

---

### A5 — D5 跨工厂销售场景支持

- **Source**: PR #288 §10 q5, §6.4 spec edge §4
- **Background**: D5 销售订单从总仓出货 (per A1/D1 双仓模型). transcript 未明说"跨工厂销售" — 即 F001 工厂的 SO 是否能用 F002 库存. 默认假设是单工厂内总仓销售 (factoryId 一致).
- **The question**: 销售订单是否支持跨 factoryId 调用其他工厂总仓库存?
- **Options**:
  - [ ] **A (recommended)**: 默认单工厂内总仓销售. SO.factoryId = 库存 batch.factoryId. 不支持跨工厂. ~0 额外 effort, 跟随 D5 baseline.
  - [ ] **B**: 支持跨工厂. 加 `SalesOrder.allowCrossFactory` 字段 + 库存查询去掉 factoryId 过滤. ~2 day. 业务模型复杂化, 影响审批权限设计.
  - [ ] **C**: 默认单工厂, 但加 feature flag `CROSS_FACTORY_SALES_ENABLED` 留接口. ~0.5 day.
- **Implications if A**:
  - D5 实施简单, 与现有 multi-tenancy 对齐
  - 未来若客户提"集团联销" 需新 spec
- **Recommended default**: **A** — transcript 未涉及, 不要预先复杂化

---

## Group B: Bug 决策 (PR #289 §6)

PR #289 列了 6 个 sign-off questions. B1 (工序通用 fallback) / B7 (弹窗宽度) / B8 (unitPrice 带出) 在 Phase 1+2 已落地 (PR #293). 留 3 个 (B1 in A1 已含, B2/B5/B6 残留 → 这里 5 个变体).

### B1 — B2 调拨/出库批次选择时机

- **Source**: PR #289 §6 item B2, §1 B2 fix sketch
- **Background**: 客户原话: "调拨说调拨单的时候那么仓库发货的时候就让他们做一个仓库我可以选择P次啊". 默认 FEFO 自动选最早批次, 客户要手动覆盖 (新货 vs 旧货业务场景). 后端已实现自动 FEFO; 缺手动指定路径 + FE 批次下拉.
- **The question**: 用户在调拨单 CREATE 阶段选批次, 还是 SHIP (status=APPROVED) 阶段选?
- **Options**:
  - [ ] **A (recommended)**: **SHIP 阶段选**. 调拨单 APPROVED 后, 仓库出货时选具体批次. 符合客户原话"仓库发货的时候". ~6-8h.
  - [ ] **B**: CREATE 阶段选. 申请单提交时就锁定批次. 风险: 批次在 APPROVED 前可能被别处消耗.
  - [ ] **C**: 两阶段都可选 (CREATE 默认 FEFO, SHIP 可改). ~10-12h. UX 复杂.
- **Implications if A**:
  - 后端 `TransferServiceImpl.deductSourceInventory` 加 `sourceBatchId != null` 分支 (~2h)
  - FE `transfer/detail.vue` 在 APPROVED 状态后给每个 item 加 batch dropdown (~4h)
  - 默认 FEFO 保留 (用户不选时)
- **Recommended default**: **A** — 客户原话明确, 业务时序自然

---

### B2 — B5 分仓库存查询页 multi-tenancy UX

- **Source**: PR #289 §6 item B5, §1 B5 fix sketch
- **Background**: 客户要求"分仓库存查询页 (工厂线边仓 + 成品库存)". 当前 `web-admin/src/views/warehouse/inventory/index.vue` 是单仓 view. multi-tenancy 模型下用户 factoryId 已是单一 branch, 但客户希望 view 跨仓 (总仓 + 线边仓).
- **The question**: 分仓库存怎么切换显示?
- **Options**:
  - [ ] **A (recommended)**: **Tab 切换 + 单工厂内双仓**. 一个工厂登录后, view 顶部 tab 切 "原辅料库存 (WH-LOG)" / "成品库存 (WH-WKS)" / "总览". 不需要跨工厂. ~1 day, 依赖 A1.
  - [ ] **B**: Dropdown 切 factoryId. 用户可看其他 branch. 需 multi-tenancy 权限调整. ~2 day.
  - [ ] **C**: 自动聚合 view (双仓数据合并显示 + warehouse 列区分). ~1.5 day. UX 信息密度高.
- **Implications if A**:
  - 与 A1 (D1) 同期 ship
  - 不动现有 multi-tenancy 权限
  - 客户原话隐含单工厂内查双仓即可
- **Recommended default**: **A** — 跟 D1 同步, 最少 UX 改动

---

### B3 — B6 App OTA 推送策略

- **Source**: PR #289 §6 item B6, PR #287 RCA, PR #296 OTA infra
- **Background**: PR #287 RCA 确认 B6 转圈是 App version 过旧, NOT backend bug. PR #296 已 ship `expo-updates` infra + EAS Update channel. Steve 已选 Option B (长期 OTA), 但仍需手动初始化步骤 (eas login / eas init / 首次 APK build).
- **The question**: PR #296 之后的下一步谁来做?
- **Options**:
  - [ ] **A (recommended — Steve 亲自)**: Steve 跑 `docs/runbooks/2026-05-10-eas-ota-setup-runbook.md` 5 个步骤 (需要 Steve Expo 账号凭证). ~1-2h. 后续每次 OTA 一行命令.
  - [ ] **B**: Dispatch subagent + Steve 提供 EAS 凭证 (无法存 repo). 风险: 凭证泄露.
  - [ ] **C**: 维持现状 — 客户每次手动重装 APK. 0 工作但客户痛点持续.
- **Implications if A**:
  - 解决 B6 转圈根本原因
  - 未来 410 SMARTBI_MIGRATED 等 graceful fallback 都可 OTA 推送
  - 下次 customer demo 前 ship 一次 OTA
- **Recommended default**: **A** — Steve 已选 Option B, 现在只差执行

---

### B4 — F006 single-user 密码 drift 处理

- **Source**: PR #287 §"Single-account caveat"
- **Background**: PR #287 audit 发现 `f006_warehouse_manager` 密码 NOT `123456` (其他 4/5 F006 账号默认 123456). 单用户密码 drift, 非 cascade 引起. PR #287 recommend 注解到 `reference_f006_liutengmen_prod_accounts.md` 但未 ship.
- **The question**: 这单用户密码怎么处理?
- **Options**:
  - [ ] **A (recommended)**: Reset to 123456 + 注解 memory file. 客户测试时统一密码方便. ~10 min.
  - [ ] **B**: 保留当前密码 + 注解 memory file 当前值. 客户实际使用时去找密码. ~10 min.
  - [ ] **C**: 客户自主重置 (后台密码重置流程, 客户自管). 0 工作.
- **Implications if A**:
  - 客户测试一致体验
  - 安全风险低 (F006 测试工厂)
- **Recommended default**: **A** — 测试一致性优先

---

### B5 — B6 防御性 "App 版本检测" 后端 endpoint

- **Source**: PR #287 §"Fix proposal" defensive P2 hint
- **Background**: PR #287 建议加 `app-min-version` 到 `/health` endpoint, App 老版本启动时立即提示"请更新", 避免 spinner stuck 误导. 防御性 feature, 非紧急.
- **The question**: 是否加这个防御性 endpoint?
- **Options**:
  - [ ] **A (recommended)**: 加. ~3h backend + ~2h app. 防御未来类似 B6.
  - [ ] **B**: 不加. 依赖 B3 OTA 解决根本问题.
  - [ ] **C**: 暂缓, Q3 再评估.
- **Implications if A**:
  - 老 APK 用户启动看到清晰 modal "请升级到 vX.Y.Z"
  - 不依赖 OTA 推送 (即使 OTA 失败也能提示)
- **Recommended default**: **A** — 客户测试期 +5h 投入换长期防御价值

---

## Group C: B9 follow-up (PR #299 body)

PR #299 ship 了手动新建调拨单入口, PR body 里留了 2 个 sign-off items.

### C1 — Manual transfer 是否走完整审批流程?

- **Source**: PR #299 body §"Edge case for Steve"
- **Background**: PR #299 ship 的手动调拨单走 DRAFT → 申请 → 审批 → 发货 → 签收 (跟自动生成路径完全一致). 客户场景 (互相走调拨/领用/研发样品) 多数是内部信任行为, 走完整 5 步审批可能繁琐.
- **The question**: 手动调拨单是否需要完整审批环节?
- **Options**:
  - [ ] **A (recommended)**: **保留完整 5 步审批 (DRAFT → 申请 → 审批 → 发货 → 签收)**. 与自动调拨一致, consistency 优先. 客户嫌麻烦再说. 0 额外 effort.
  - [ ] **B**: Fast-track manual = trusted. 手动新建跳过 REQUESTED/APPROVED, 直接 DRAFT → SHIPPED. ~3-4h FE + BE 加 `is_manual_fast_track` 字段. 风险: 跨工厂调拨没审批 → 财务对账风险.
  - [ ] **C**: 半 fast-track. 同工厂内 (BRANCH_TO_HQ) fast-track, 跨工厂 (HQ_TO_BRANCH / BRANCH_TO_BRANCH) 走完整审批. ~5h.
- **Implications if A**:
  - 0 代码改动
  - 客户走 5 步审批熟悉流程
  - 后续若客户抱怨再升级到 B/C
- **Recommended default**: **A** — wait-and-see, 不要预先优化

---

### C2 — 跨工厂调拨 "调入方 ID" 输入方式

- **Source**: PR #299 body §"Trade-off 说明"
- **Background**: 当前 PR #299 实现里, 调入方 ID 是 text input (用户手动输 `F001` / `RES_3101_001`). 因为平台级 `/factories` list endpoint 需要 `super_admin`/`platform_admin` 权限, 工厂用户用不了. 客户体验下来可能想要 dropdown 选择, 但需要先建 factory-network endpoint.
- **The question**: 是否补 factory-network endpoint 提供 dropdown?
- **Options**:
  - [ ] **A (recommended)**: 暂保留 text input. 客户测试期间收集反馈, 真的频繁错输再优化. 0 额外 effort.
  - [ ] **B**: 加 `/factories/network` endpoint (工厂角色可看自己 visible 的工厂列表) + FE dropdown. ~4-6h. 与 B2 (B5 multi-tenancy) 决策联动.
  - [ ] **C**: Hybrid — text input + autocomplete (输入 prefix 触发模糊匹配 endpoint). ~6h.
- **Implications if A**:
  - 客户场景多数是内部用户, 知道工厂 ID
  - 错输返 400 错误提示也清晰
  - 真的成 pain point 再补 B
- **Recommended default**: **A** — 客户尚未实际使用, 不要预先优化

---

## Summary table — 12 items 决策 + 推荐 effort 累加

| # | Item | Recommended | Effort | Blocks? |
|---|------|-------------|--------|---------|
| A1 | D1 推翻 V3 P0-5 ADR + warehouse_id | **A** 推翻 | 3-4d | **A2 D5** + **B2 B5** + A3 反向调拨 |
| A2 | D4 路径 A vs B | **B** 改 BomExpansionService | 2-3d | D3 单位换算激活 |
| A3 | D1 反向调拨触发 | **A** 草稿态 + 用户确认 | 1d | (含在 A1 effort 内) |
| A4 | D3 历史数据迁移 | **A** Lazy | 0d | 无 |
| A5 | D5 跨工厂销售 | **A** 单工厂 | 0d | 无 |
| B1 | B2 批次选择时机 | **A** SHIP 阶段 | 6-8h | 无 |
| B2 | B5 分仓 multi-tenancy UX | **A** Tab 切换 | 1d | 依赖 A1 |
| B3 | B6 OTA 推送策略 | **A** Steve 亲自 | 1-2h | 无 |
| B4 | F006 single-user pw drift | **A** Reset + 注解 | 10min | 无 |
| B5 | B6 防御 app-min-version | **A** 加 | 5h | 无 |
| C1 | 手动调拨审批流程 | **A** 完整 5 步 | 0d | 无 |
| C2 | 调入方 ID 输入 | **A** Text input | 0d | 无 |

**Cumulative effort if all defaults accepted**: ~9-13 工作日 (单人, 4 sister chat 并行 ~3-4 自然日)

---

## Implementation cascade (推荐 dispatch 顺序 if all defaults accepted)

### Phase 3 (本 sign-off 之后 1-2 day, 可立即 dispatch)

| # | 任务 | Effort | Owner | 依赖 |
|---|---|---|---|---|
| P3.1 | A4 + A5 + C1 + C2 — 0 effort doc-only sign-off | 0d | organizer commit | 无 |
| P3.2 | B3 (Steve 自跑 OTA runbook) | 1-2h | **Steve 亲自** | 无 |
| P3.3 | B4 F006 single-user pw reset | 10min | Sister chat A | 无 |
| P3.4 | A2 D4 路径 B (`BomExpansionService` 改 BomItem) | 2-3d | Sister chat B | 无 |
| P3.5 | B5 防御 app-min-version | 5h | Sister chat C | 无 |

### Phase 4 (依赖 A1 D1 spec 落地)

| # | 任务 | Effort | Owner | 依赖 |
|---|---|---|---|---|
| P4.1 | A1 D1 spec writing + ADR revision | 0.5d | organizer + Steve | 无 |
| P4.2 | A1 D1 schema migration (V20260510_01-03) | 0.5d | Sister chat D | P4.1 |
| P4.3 | A3 反向调拨自动触发 (草稿态) | 1d | Sister chat D | P4.2 |
| P4.4 | B1 B2 调拨批次选择 SHIP 阶段 | 6-8h | Sister chat E | P4.2 |
| P4.5 | B2 B5 分仓查询页 Tab 切换 UI | 1d | Sister chat F | P4.2 |

### Phase 5 (D5 销售)

| # | 任务 | Effort | Owner | 依赖 |
|---|---|---|---|---|
| P5.1 | A5 D5 销售从总仓 (默认单工厂) | 2-3d | Sister chat G | P4.2 |

---

## ADR revisions needed if A1 = A

- ⚠️ `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md` §2.9 — 把"双仓体系仅作 reference data"的注释改成"WH-WKS 参与库存维度". 补 G3 链 step 6 (退回物流仓自动调拨).
- ⚠️ `backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__factory_warehouses.sql:1-7` 头注释更新.

---

## Sign-off

**Date**: ________
**Steve initials**: ____

**When ready**, comment on this PR:
- **"Approved as marked"** — all defaults accepted, dispatch immediately
- **"Approved with edits: ..."** — list any item where you picked B/C/自定义 instead of recommended A

Organizer will dispatch implementation subagents per choices the next morning.

---

## References

- **Audit doc**: `docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md` (PR #289)
- **Spec doc**: `docs/superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md` (PR #288)
- **F006 login RCA**: `docs/qa-audits/2026-05-10-f006-login-investigation.md` (PR #287)
- **OTA runbook**: `docs/runbooks/2026-05-10-eas-ota-setup-runbook.md` (PR #296)
- **RPF vs BomItem divergence**: `docs/architecture/2026-05-10-rpf-vs-bomitem-divergence.md` (PR #294)
- **Transcript**: `.tmp-transcripts/2026-05-10-customer-meeting.md` (本地, 不在 repo)
- **Phase 1+2 shipped**: PR #293 / #294 / #295 / #296 / #297 / #299 / #305

---

## Whisper 转录质量警告 (从 PR #289 §6 转抄)

转录在以下点可能不准, 任何 follow-up 修复前请人工二次复核 SRT 时间戳 `D:\Temp\transcript.srt`:

- "P 次" / "P 四" 实际是"批次" (line 31-33 多次出现)
- "BOM" 转录为 "爆木 / 爆墨 / 爆幕"
- "调拨数量 166.67" (line 23) — 数字应该是 (200 / 0.58 / 1000) × 100 ≈ 0.345kg × 100 = **34.5kg** 还是别的算法? 客户原话用 166.67 但前置上下文是 100 份产品 + 200g/份 + 58% 出成率 → 需要回放确认 BOM 计算公式
- 中段约 31:00 客户提到二级单位 50kg/包盐 vs 1-2g 配方 → 决策 D3 已解决 (统一克 + 后端 1:1000 换算), 但需确认 UI 显示不会出 0.0000001 这种 (建议 P3 follow-up)
