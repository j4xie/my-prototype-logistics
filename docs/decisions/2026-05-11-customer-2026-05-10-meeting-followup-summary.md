# 2026-05-10 客户对接会议 全工作总结 (V7)

**Document date**: 2026-05-11
**Customer meeting**: 2026-05-10 demo 全链 (F006 六腾门 / 卤制品工厂, `f006_admin`)
**Transcript source**: `.tmp-transcripts/2026-05-10-customer-meeting.md` (本地, 48 min audio, 1016 SRT segs — 未提交 repo)
**Scope of this doc**: chat0 (organizer) 从客户会议结束到 2026-05-11 06:55 UTC 全部 customer-related 工作 — 25 个 PR + 11 reference docs
**Out of scope**: Phase 2A SmartBI port / T6.5 cleanup / T6.6 ETL spec (并行 chat 负责)

---

## TL;DR — 一句话状态

会议命中 **13 个客户痛点** (transcript 13 + audit 9 — 部分重叠), 拉出 **5 个设计决策 D1-D5** + **5 个 bug-decision items B1-B5** + **2 个 B9 follow-up items C1-C2**, 共 **12 sign-off questions**, Steve PR #309 全 approve recommended defaults。截至 2026-05-11 06:55 UTC, **chat0 已 ship 25 PR** 涵盖 Phase 1+2+3+4+5 全部 design decisions + 所有 P0/P1 bug fixes, 共解锁 **客户面 LIVE 功能 13 项**。仅剩 **Steve OTA 手动初始化 (B3 决策)** 和 **客户 reinstall APK 一次** 两个非代码 action。

---

## 第一章 客户痛点 → 状态映射

### 1.1 9-bug audit (PR #289 完整 audit, 转写见 [`docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md`](../qa-audits/2026-05-10-customer-meeting-9bug-audit.md))

| # | 客户原话简述 | Audit P级 | 状态 | 落地 PR | LIVE? |
|---|---|---|---|---|---|
| **B1** | 生产计划"工序"下拉只显示"通用", 关联产品工序未联动 | **P0** | 已修 | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | ✅ |
| **B2** | 调拨/出库不能选批次, 默认 FEFO 不能改新货 | **P0** | 已修 (两阶段) | [#322](https://github.com/j4xie/my-prototype-logistics/pull/322) | ✅ |
| **B3** | 生产"开始"按钮无库存校验 | **P1** | 已修 | [#305](https://github.com/j4xie/my-prototype-logistics/pull/305) | ✅ |
| **B4** | 调拨单页面缺"现有库存"列 | **P1** | 已修 | [#295](https://github.com/j4xie/my-prototype-logistics/pull/295) | ✅ |
| **B5** | 缺"分仓库存查询"页 (线边仓 + 成品库存) | **P1** | 已修 (分仓查询页) | [#323](https://github.com/j4xie/my-prototype-logistics/pull/323) | ✅ |
| **B6** | App 报工审批一直转圈 | **P0** | RCA 完成 + OTA infra 建好, Steve 待手动 init | [#287](https://github.com/j4xie/my-prototype-logistics/pull/287) (RCA) + [#296](https://github.com/j4xie/my-prototype-logistics/pull/296) (OTA infra) + [#300](https://github.com/j4xie/my-prototype-logistics/pull/300) (SDK align) + [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) (B5 min-version) | ⚠ pending Steve |
| **B7** | 新建销售订单弹窗太小看不到 (旧 bug 复现) | **P2** | 已修 | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | ✅ |
| **B8** | BOM "关联原料"未真正联动仓库原料表 | **P1** | 已修 | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | ✅ |
| **B9** | 缺"手动新建调拨单"入口 (领用/研发场景) | **P2** | 已修 | [#299](https://github.com/j4xie/my-prototype-logistics/pull/299) | ✅ |

**统计**: 9/9 全部 closed; 8 LIVE + 1 pending Steve OTA init (B6).

### 1.2 5 个设计决策 (PR #288, 转写见 [`docs/superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md`](../superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md))

| # | 决策主题 | Steve choice | 落地状态 | 主要 PR |
|---|---|---|---|---|
| **D1** | 双仓 (线边仓 + 总仓) 业务模型实施 | A — 推翻 V3 P0-5 ADR + `warehouse_id` schema | ✅ LIVE | spec [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) + impl [#315](https://github.com/j4xie/my-prototype-logistics/pull/315) |
| **D2** | BOM yield-rate UI preview | (Phase 2 直接 ship) | ✅ LIVE | [#297](https://github.com/j4xie/my-prototype-logistics/pull/297) |
| **D3** | g↔kg 单位换算 (统一克, 后端 1:1000) | (Phase 2 ship 框架 + D4-B 激活) | ✅ LIVE | [#297](https://github.com/j4xie/my-prototype-logistics/pull/297) (框架) + [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) (D4-B 激活) |
| **D4** | RPF 保留 vs 改 BomExpansionService | B — 改 BomExpansionService 读 BomItem + RPF fallback (激活 D3) | ✅ LIVE | docs [#294](https://github.com/j4xie/my-prototype-logistics/pull/294) (路径 A) + impl [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) (路径 B) |
| **D5** | 销售订单从总仓 WH-LOG 出货 | A (默认单工厂) + C5 flag-gated cross-factory | ✅ LIVE | [#329](https://github.com/j4xie/my-prototype-logistics/pull/329) (主路径) + [#313](https://github.com/j4xie/my-prototype-logistics/pull/313) (A5 flag) |

### 1.3 PR #309 Sign-off Package — 12 items 决策

Steve 在 PR #309 (`docs/decisions/2026-05-10-steve-sign-off-package.md`, 336 LOC, [branch `ops-steve-decision-package-2026-05-10`](https://github.com/j4xie/my-prototype-logistics/pull/309)) approved 12 items per recommended defaults。

#### Group A — 设计决策残留 (5 items)

| # | Item | Steve choice | 落地 PR | LIVE? |
|---|---|---|---|---|
| **A1** | D1 推翻 V3 P0-5 ADR + `warehouse_id` | **A** 推翻 | spec [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) → impl [#315](https://github.com/j4xie/my-prototype-logistics/pull/315) | ✅ |
| **A2** | D4 路径 (RPF 保留 vs BomExpansionService 改) | **B** 改 BomExpansionService 读 BomItem (RPF fallback) — 激活 D3 单位换算 end-to-end | [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) | ✅ |
| **A3** | D1 反向调拨触发时机 (报工后) | **A** 自动生成 DRAFT BRANCH_TO_HQ 调拨单, 用户确认提交 | [#319](https://github.com/j4xie/my-prototype-logistics/pull/319) | ✅ |
| **A4** | D3 历史 BOM unit 数据迁移 | **B** (eager normalize standardization, 已实际跑 deploy migration) | [#311](https://github.com/j4xie/my-prototype-logistics/pull/311) | ✅ |
| **A5** | D5 跨工厂销售场景 | **C** feature flag `CROSS_FACTORY_SALES_ENABLED` (default false) | [#313](https://github.com/j4xie/my-prototype-logistics/pull/313) | ✅ |

#### Group B — Bug 决策残留 (5 items)

| # | Item | Steve choice | 落地 PR | LIVE? |
|---|---|---|---|---|
| **B1 (PR #309)** | 调拨/出库批次选择时机 (CREATE vs SHIP) | **C** 两阶段 (CREATE 默认 FEFO + SHIP 可 override) | [#322](https://github.com/j4xie/my-prototype-logistics/pull/322) | ✅ |
| **B2 (PR #309)** | 分仓库存查询页 UX (Tab vs Dropdown) | **B** Dropdown 跨 factoryId | [#323](https://github.com/j4xie/my-prototype-logistics/pull/323) | ✅ |
| **B3 (PR #309)** | App OTA 推送策略 (Steve 亲自) | **A** Steve 跑 runbook | OTA infra 落 [#296](https://github.com/j4xie/my-prototype-logistics/pull/296), 待 Steve 跑 [runbook](../runbooks/2026-05-10-eas-ota-setup-runbook.md) | ⚠ pending Steve |
| **B4 (PR #309)** | F006 `f006_warehouse_mgr` 密码 drift | **A** (实测无需 SQL — DB 用户名是 `f006_warehouse_mgr` 非 `f006_warehouse_manager` 且已接受 `123456`. 仅修 memory file) | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | ✅ |
| **B5 (PR #309)** | 防御 `/health` `appMinVersion` endpoint | **A** 加 | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | ✅ |

#### Group C — B9 follow-up (2 items)

| # | Item | Steve choice | 落地 PR | LIVE? |
|---|---|---|---|---|
| **C1** | 手动调拨审批流程 (5-step vs fast-track) | **A** 保留完整 5 步 — 与自动调拨 consistency | (PR #299 直接落地 5-step, 0 额外 effort) | ✅ |
| **C2** | 跨工厂调入方 ID 输入 (text vs dropdown) | **B** 加 `/factories/network` endpoint + dropdown | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | ✅ |

---

## 第二章 Phase 分布与 dispatch cascade

### Phase 1: Quick wins batch (immediate, 30 min)
- [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) `fix(customer): B1 工序 + B7 弹窗宽度 + B8 BOM 联动`

### Phase 2: Immediate 9-bug + decision docs (1-2 day)
- [#287](https://github.com/j4xie/my-prototype-logistics/pull/287) `audit(f006): login investigation post T6.4 cascade — NOT a prod bug` (RCA)
- [#288](https://github.com/j4xie/my-prototype-logistics/pull/288) `spec(customer): impl plan for 5 design decisions from 2026-05-10 meeting`
- [#289](https://github.com/j4xie/my-prototype-logistics/pull/289) `audit(customer): 9 bug audit + fix plan from 2026-05-10 meeting`
- [#294](https://github.com/j4xie/my-prototype-logistics/pull/294) `docs(customer): D4 Path A — RPF vs BomItem divergence doc + warning`
- [#295](https://github.com/j4xie/my-prototype-logistics/pull/295) `feat(customer): B4 调拨现有库存列`
- [#296](https://github.com/j4xie/my-prototype-logistics/pull/296) `feat(ota): setup expo-updates + EAS Update infra (B6 follow-up Option B)`
- [#297](https://github.com/j4xie/my-prototype-logistics/pull/297) `feat(customer): D2 BOM yield-rate UI preview + D3 g↔kg unit conversion`
- [#299](https://github.com/j4xie/my-prototype-logistics/pull/299) `feat(customer): B9 手动调拨入口`
- [#300](https://github.com/j4xie/my-prototype-logistics/pull/300) `chore(rn): align 3 Expo SDK 53 version mismatches (PR #296 follow-up)`
- [#305](https://github.com/j4xie/my-prototype-logistics/pull/305) `feat(customer): B3 生产开始库存校验`

### Phase 3: Steve Sign-off Package + immediate-ready decisions (5-min review + dispatch)
- [#309](https://github.com/j4xie/my-prototype-logistics/pull/309) `docs(decision): Steve sign-off package — 12 items` (Steve approved all 12 defaults)
- [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) `spec(d1): dual-warehouse amendment supersedes V3 P0-5 ADR (A1=A)`
- [#311](https://github.com/j4xie/my-prototype-logistics/pull/311) `feat(a4): eager normalize bom_items.unit standardization (A4=B)`
- [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) `feat(d4-b): BomExpansionService reads BomItem (RPF fallback) — activates D3 conversion (A2=B)`
- [#313](https://github.com/j4xie/my-prototype-logistics/pull/313) `feat(a5): feature flag CROSS_FACTORY_SALES_ENABLED (A5=C, default false)`
- [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) `feat(infra): B4 + B5 + C2 batch (PR #309 sign-off)` — 3 items 一次 commit

### Phase 4: D1 cascade (depends on D1 schema)
- [#315](https://github.com/j4xie/my-prototype-logistics/pull/315) `feat(d1): dual-warehouse implementation Phase B-F (PR #310 spec)` — 22 files, +836 LOC, 2532/2532 tests PASS
- [#319](https://github.com/j4xie/my-prototype-logistics/pull/319) `feat(a3): reverse transfer auto-trigger (PR #309 A3=A, stacked on #315)`
- [#322](https://github.com/j4xie/my-prototype-logistics/pull/322) `feat(b1): two-stage batch selection — CREATE FEFO + SHIP override (PR #309 B1=C, stacked #315)`
- [#323](https://github.com/j4xie/my-prototype-logistics/pull/323) `feat(b2): 分仓库存查询页 + Dropdown 跨工厂 (PR #309 B2=B, stacked #315)`

### Phase 5: D5 销售路径 (depends on D1)
- [#329](https://github.com/j4xie/my-prototype-logistics/pull/329) `feat(d5): sales fulfillment from WH-LOG (D1 cascade, stacked #315)`

---

## 第三章 客户面 LIVE 功能清单 (13 项)

部署到生产 PostgreSQL `cretas_prod_db` + Java prod `10010` + Python prod `8083` 后可直接被客户访问 (F006 + 其他 75 factories)。

| # | 功能 | UI 入口 | 后端依赖 | 验证方法 |
|---|---|---|---|---|
| 1 | 销售订单弹窗自适应宽度 (B7) | `/sales/orders` → 新建/编辑 | `el-dialog width="80%"` | 1024×768 不截断"操作"列 |
| 2 | BOM 关联原料联动 (B8) | `/production/bom` → 编辑 → 关联原料下拉 | `@change=onMaterialLink` 自动填名/单位 | 选关联原料 → name/unit 自动填 |
| 3 | 生产计划工序下拉 (B1) | `/production/plans/list` → 新建计划 | `GET /{factoryId}/product-work-processes?productTypeId=X` | 显示已配置工序 (非"通用") |
| 4 | 调拨单"现有库存"列 (B4) | `/transfer/list` → 详情 | `TransferController.populateCurrentStock` (warehouse-aware) | 显示该 batch 当前可用量 |
| 5 | 生产"开始"库存校验 (B3) | `/production/plans` → 开始按钮 | `ProductionPlanServiceImpl.startProduction` 加 BOM 推导 + batch SUM | 缺料 → BusinessException("请先采购或调拨原料") |
| 6 | 手动新建调拨单 (B9) | `/transfer/list` → 新建按钮 | `POST /{factoryId}/transfers` CreateTransferRequest | 走完整 5-step DRAFT→申请→审批→发货→签收 |
| 7 | 跨工厂调入方 dropdown (C2) | `/transfer/list` → 新建 dialog 调入方 | `GET /{factoryId}/factories/network` 受 multi-tenancy 鉴权 | 显示可见工厂 + `allow-create` fallback |
| 8 | D2 BOM yield-rate UI preview | `/production/bom` → 配方编辑 | `BomServiceImpl` save 时 dual-write to RPF | UI 显示出成率 preview 数字 |
| 9 | D3 g↔kg 单位换算 | `/production/bom` + `/transfer/list` 显示 | `MaterialRequirement.sourceUnit` + `BomExpansionService` (PR #312 激活) | BOM 录 g, 调拨单按 kg 显示 |
| 10 | D1 双仓库存模型 | `/inventory` (透明) | `material_batches.warehouse_id` + `finished_goods_batches.warehouse_id` (V20260510_03/04) | 业务流: 采购 → WH-LOG, 报工 → WH-WKS |
| 11 | A3 反向调拨自动触发 | 报工 → 计划完成时透明触发 | `SupplyChainOrchestrator` → `ProductionCompletedEvent` → `ReverseTransferService.onProductionCompleted` | 完成多 batch 计划 → 调拨单列表出现 DRAFT BRANCH_TO_HQ |
| 12 | B1 两阶段批次选择 (CREATE FEFO + SHIP override) | `/transfer/detail` (status=APPROVED) | `GET .../items/{itemId}/available-batches` + `PUT .../source-batch` | APPROVED 状态 dropdown 出现"发货批次"列 |
| 13 | B2 分仓库存查询页 | `/inventory/by-warehouse` | `WarehouseInventoryController.getByWarehouse` + multi-tenancy 三层鉴权 | factory dropdown + WH-LOG/WH-WKS tab 切换 |
| 14 | D5 销售从 WH-LOG 出货 | `/sales/orders` (透明) | `InventoryMatchingService` + `findAvailableBatchesByWarehouse(WH-LOG)` + A5 flag | 销售订单从 WH-LOG (非 WH-WKS 鲜棉仓) 出货 |
| 15 | B5 `/health` `appMinVersion` | App 启动时透明 | `MobileController` + `appVersionCheck.ts` + `compareSemver.ts` | App 启动 fetch /health, 老版本看到"请更新"toast |
| 16 | B4 F006 `f006_warehouse_mgr` 账号确认 | 后台数据 | DB user existence | 该账号能用 `123456` 登录 (实测已通) |

注: 上表 16 行覆盖会议 13 痛点 (部分 1 PR 涵盖多个), 已扩展并归类。

---

## 第四章 待 Steve 手动 action (3 项, 非代码)

| # | Action | Owner | 估时 | Doc |
|---|---|---|---|---|
| 1 | **OTA infra 初始化** — 跑 EAS runbook 5 步 (`eas-cli login` → `eas init` → `eas build production` → 客户 reinstall ONE-TIME APK → 后续 `eas update` 推送) | Steve 亲自 | 1-2h (含 cloud build) | [`docs/runbooks/2026-05-10-eas-ota-setup-runbook.md`](../runbooks/2026-05-10-eas-ota-setup-runbook.md) |
| 2 | **客户 APK 分发 (ONE-TIME)** — OTA 安装后, 后续 fix OTA 推送 | Steve via WeChat | 5 min | runbook step 4 |
| 3 | **prod smoke** — 全链流程: 采购入库 → 调拨 → 报工 → 反向调拨 → 销售发货, verify warehouse_id 正确填充 | Steve | 30 min | PR #315 §"Test plan" 末段 |

---

## 第五章 全 PR 列表 (25 PR + 1 sign-off doc PR)

按 merge 时间倒序:

| # | PR | merge UTC | 主题 |
|---|---|---|---|
| 1 | [#329](https://github.com/j4xie/my-prototype-logistics/pull/329) | 06:55 | feat(d5): sales from WH-LOG (D1 cascade) |
| 2 | [#315](https://github.com/j4xie/my-prototype-logistics/pull/315) | 06:53 | feat(d1): dual-warehouse implementation Phase B-F |
| 3 | [#323](https://github.com/j4xie/my-prototype-logistics/pull/323) | 06:53 | feat(b2): 分仓库存查询页 |
| 4 | [#322](https://github.com/j4xie/my-prototype-logistics/pull/322) | 06:53 | feat(b1): 两阶段批次选择 |
| 5 | [#319](https://github.com/j4xie/my-prototype-logistics/pull/319) | 06:53 | feat(a3): reverse transfer auto-trigger |
| 6 | [#314](https://github.com/j4xie/my-prototype-logistics/pull/314) | 03:30 | feat(infra): B4 + B5 + C2 batch |
| 7 | [#313](https://github.com/j4xie/my-prototype-logistics/pull/313) | 03:29 | feat(a5): feature flag CROSS_FACTORY_SALES_ENABLED |
| 8 | [#312](https://github.com/j4xie/my-prototype-logistics/pull/312) | 03:29 | feat(d4-b): BomExpansionService reads BomItem (activates D3) |
| 9 | [#311](https://github.com/j4xie/my-prototype-logistics/pull/311) | 03:29 | feat(a4): eager normalize bom_items.unit |
| 10 | [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) | 03:29 | spec(d1): dual-warehouse amendment supersedes V3 P0-5 ADR |
| 11 | [#305](https://github.com/j4xie/my-prototype-logistics/pull/305) | 02:42 | feat(customer): B3 生产开始库存校验 |
| 12 | [#300](https://github.com/j4xie/my-prototype-logistics/pull/300) | 02:42 | chore(rn): align 3 Expo SDK 53 mismatches |
| 13 | [#299](https://github.com/j4xie/my-prototype-logistics/pull/299) | 02:42 | feat(customer): B9 手动调拨入口 |
| 14 | [#297](https://github.com/j4xie/my-prototype-logistics/pull/297) | 02:17 | feat(customer): D2 + D3 BOM algo + units |
| 15 | [#296](https://github.com/j4xie/my-prototype-logistics/pull/296) | 02:18 | feat(ota): expo-updates + EAS Update infra |
| 16 | [#295](https://github.com/j4xie/my-prototype-logistics/pull/295) | 02:17 | feat(customer): B4 调拨现有库存列 |
| 17 | [#294](https://github.com/j4xie/my-prototype-logistics/pull/294) | 02:17 | docs(customer): D4 Path A — RPF vs BomItem divergence |
| 18 | [#293](https://github.com/j4xie/my-prototype-logistics/pull/293) | 02:17 | fix(customer): B1 + B7 + B8 quick wins batch |
| 19 | [#289](https://github.com/j4xie/my-prototype-logistics/pull/289) | 02:20 | audit(customer): 9 bug audit |
| 20 | [#288](https://github.com/j4xie/my-prototype-logistics/pull/288) | 02:20 | spec(customer): 5 design decisions impl plan |
| 21 | [#287](https://github.com/j4xie/my-prototype-logistics/pull/287) | 02:19 | audit(f006): login investigation — NOT a prod bug |
| — | [#309](https://github.com/j4xie/my-prototype-logistics/pull/309) | OPEN | docs(decision): Steve sign-off package — 12 items (Steve approved all 12 defaults) |

**注**: PR #309 sign-off package 本身没合并到 main (Steve approved by comment), 但其 `docs/decisions/2026-05-10-steve-sign-off-package.md` 的所有 12 decisions 都已通过 #310-329 cascade 落地。

---

## 第六章 Reference docs (11 项, 全部在 main)

| Doc | Path | 落地 PR |
|---|---|---|
| 9 bug 完整 audit | [`docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md`](../qa-audits/2026-05-10-customer-meeting-9bug-audit.md) | [#289](https://github.com/j4xie/my-prototype-logistics/pull/289) |
| 5 design decisions impl plan | [`docs/superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md`](../superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md) | [#288](https://github.com/j4xie/my-prototype-logistics/pull/288) |
| D1 dual-warehouse spec amendment | [`docs/superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md`](../superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md) | [#310](https://github.com/j4xie/my-prototype-logistics/pull/310) |
| F006 login RCA | [`docs/qa-audits/2026-05-10-f006-login-investigation.md`](../qa-audits/2026-05-10-f006-login-investigation.md) | [#287](https://github.com/j4xie/my-prototype-logistics/pull/287) |
| A4 BOM unit pre-migration audit | [`docs/qa-audits/2026-05-10-a4-bom-unit-pre-migration-audit.md`](../qa-audits/2026-05-10-a4-bom-unit-pre-migration-audit.md) | [#311](https://github.com/j4xie/my-prototype-logistics/pull/311) |
| RPF vs BomItem divergence | [`docs/architecture/2026-05-10-rpf-vs-bomitem-divergence.md`](../architecture/2026-05-10-rpf-vs-bomitem-divergence.md) | [#294](https://github.com/j4xie/my-prototype-logistics/pull/294) |
| EAS OTA setup runbook | [`docs/runbooks/2026-05-10-eas-ota-setup-runbook.md`](../runbooks/2026-05-10-eas-ota-setup-runbook.md) | [#296](https://github.com/j4xie/my-prototype-logistics/pull/296) |
| Cross-factory sales feature flag | [`docs/architecture/2026-05-10-feature-flag-cross-factory-sales.md`](../architecture/2026-05-10-feature-flag-cross-factory-sales.md) | [#313](https://github.com/j4xie/my-prototype-logistics/pull/313) |
| Steve sign-off package (PR #309, unmerged) | `docs/decisions/2026-05-10-steve-sign-off-package.md` | [#309](https://github.com/j4xie/my-prototype-logistics/pull/309) (branch `ops-steve-decision-package-2026-05-10`) |
| 客户 meeting transcript | `.tmp-transcripts/2026-05-10-customer-meeting.md` (本地, 不在 repo) | — |
| 本汇总 doc | `docs/decisions/2026-05-11-customer-2026-05-10-meeting-followup-summary.md` | (本 PR) |

---

## 第七章 关键里程碑 + 业务影响

### 7.1 业务模型重大变更 — D1 双仓正式落地

**Before** (V3 P0-5 ADR, `2026-04-11-v1-e2e-framework-redesign.md` line 217): MaterialBatch 不加 `warehouse_id`, 双仓仅作 reference data。

**After** (PR #310 spec 推翻 + PR #315 impl): 
- `material_batches.warehouse_id` NOT NULL, FK → `factory_warehouses.id`, default WH-LOG (原料持久仓)
- `finished_goods_batches.warehouse_id` NOT NULL, FK → `factory_warehouses.id`, default WH-WKS (成品生产仓)
- 全量 backfill (existing batches → 默认 WH-LOG/WH-WKS, 0 数据丢失)
- 13 个 Service site 更新 warehouse-aware filtering (PR #315 spec §5.3)
- 7 个 SmartBI/Report site 暂保留 all-warehouse aggregate (intentional, §5.4 P2 deferred)
- 业务流: 采购 → WH-LOG, 工人领料 → WH-WKS, 报工 → WH-WKS (成品), **反向调拨 (A3)** WH-WKS → WH-LOG, 销售从 WH-LOG 出货 (D5)
- A5 flag `CROSS_FACTORY_SALES_ENABLED=false` 默认单工厂; 开启时支持集团池销售 (D5 + PR #329)

### 7.2 反向调拨自动化 (A3)

报工完成 (`ProductionPlan.status → COMPLETED`) → `ProductionCompletedEvent` → `ReverseTransferService.onProductionCompleted` → 自动生成 DRAFT BRANCH_TO_HQ 调拨单 (WH-WKS → WH-LOG, items 聚合余料 + 成品)。用户在 transfer 列表手动提交。

**Resilience**: 任何异常 → log.error + swallow, 主流程不阻塞。
**Idempotent**: 计划 PENDING→COMPLETED 转换 once (orchestrator `incompleteBatches==0` gate)。

### 7.3 OTA 推送 infra 完整就绪

PR #287 RCA 确认 App 转圈是 version drift (NOT backend bug)。  
PR #296 加 `expo-updates@~0.28.18` + `runtimeVersion` 策略 + EAS Update channel。  
PR #300 align 3 SDK 53 version mismatch (`expo-image-manipulator`, `expo-print`, `eslint-config-expo`)。  
PR #314 防御性 `appMinVersion` `/health` endpoint。

Steve 跑 [runbook](../runbooks/2026-05-10-eas-ota-setup-runbook.md) 5 步后,后续 fix 不再需要客户 reinstall。

### 7.4 SmartBI parser bug 一并捎带 (附带价值)

会议非 customer 本身但同一 chat session 跑出 4 个 SmartBI parser issues 修复, 客户上传 Excel 体验受益:
- [#303](https://github.com/j4xie/my-prototype-logistics/pull/303) `fix(smartbi-datasource): FE pass factoryId to data-sources API (Issue #280)`
- [#304](https://github.com/j4xie/my-prototype-logistics/pull/304) `fix(smartbi-upload): wrap /uploads Page in Map for FE history list (Issue #290)`
- [#306](https://github.com/j4xie/my-prototype-logistics/pull/306) `fix(smartbi-parser): preserve original col name for amount fields (Issue #291)`
- [#307](https://github.com/j4xie/my-prototype-logistics/pull/307) `feat(smartbi-parser): add is_likely_garbage_upload envelope signal (Issue #292)`
- [#301](https://github.com/j4xie/my-prototype-logistics/pull/301) `fix(smartbi-threshold): rename FE fields to match BE entity (Issue #279)`

---

## 第八章 测试 + verification 累计

| Layer | Coverage |
|---|---|
| Java unit tests | PR #315 + #319 + #322 + #329 累计 **2540/2540 PASS** (D1 + A3 + B1 + D5 联合套件), 0 failures, 40 pre-existing skips |
| RN/web-admin tests | PR #314 后 frontend `yarn test --ci` **891/891 PASS** (含 +11 compareSemver tests) |
| Java compile | PR #315 `mvn compile` SUCCESS (2302 source files, 57s) |
| web-admin build | PR #314 `vue-tsc --noEmit` EXIT=0 + `vite build` 38.93s |
| RN expo install check | PR #300 后 `npx expo install --check` 0 mismatches |
| Migration safety | V20260510_03 + V20260510_04 pre-flight + post-verify DO blocks, abort if WH-LOG/WH-WKS seed missing per factory; rollback path documented in PR #315 |

---

## 第九章 后续延展 (P3 follow-up, 非本周 scope)

- **D1 SmartBI 7 sites warehouse-aware aggregation** (PR #315 spec §5.4 P2 deferred): Dashboard / Report 等查询继续 all-warehouse 聚合; 未来若客户要求按仓维度切分需另立 epic
- **A5 cross-factory sales 实战测试**: flag 默认 false, Steve 决定何时灰度
- **D3 单位换算 UI 边界检查**: 1g 配方 + 50kg 包盐场景, 确认 UI 不会出 `0.0000001` 这种 (审计 doc 引用 transcript line 31:00, 建议 P3 follow)
- **B2 调拨数量 166.67 真实值确认**: PR #289 §6 Whisper 警告, transcript 数字可疑, 客户回放复核
- **F006 single-user `f006_warehouse_mgr` 重置策略**: PR #314 实测已可用 `123456`, 但建议未来加入新工厂时统一脚本化

---

## 第十章 References

- **本 doc 源 PR**: (this PR, V7 task #40)
- **客户 meeting**: 2026-05-10 demo (F006 六腾门, `f006_admin`), 48 min audio
- **Phase 1+2+3+4+5 cascade 来源 PR**: [#309 sign-off package](https://github.com/j4xie/my-prototype-logistics/pull/309) + [#288 design decisions impl plan](https://github.com/j4xie/my-prototype-logistics/pull/288) + [#289 9-bug audit](https://github.com/j4xie/my-prototype-logistics/pull/289)
- **D1 业务模型 spec**: [`docs/superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md`](../superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md)
- **V3 P0-5 ADR 推翻记录**: 见 PR #310 §"超越 V3 P0-5 ADR" + 待 ADR revision note (建议下次 housekeeping 加)

---

**Doc author**: chat0 organizer (V7 task #40)  
**Maintenance**: 后续若 D1 deploy 失败或 OTA 阻塞需重新评估时, 在末尾加 `## 更新历史` section。
