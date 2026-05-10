# 2026-05-10 客户对接 9 Bug 审计 + 修复方案

**Source**: `.tmp-transcripts/2026-05-10-customer-meeting.md` (48min audio + transcript)
**Factory**: F006 (六腾门 / 卤制品工厂)
**Audit date**: 2026-05-10
**Audit base**: origin/main HEAD `65eb1ac7da`

---

## 0. 背景

客户在 2026-05-10 demo 全链流程: **销售订单 → BOM → 工序配置 → 生产计划 → 调拨单 → 报工 → 入库 → 销售**。命中 9 个 bug,客户原话已 transcribed。本审计逐一对照源码,区分:
- NEW (无历史 issue / memory 记录) vs KNOWN (过去复现过)
- 真实 broken (代码错误) vs feature gap (没实现) vs UX (体验问题)
- Severity 复核 (客户语气有时偏夸大)

**汇总**: 9 bug 全 NEW (无 GitHub issue / memory 命中), P0×4 / P1×3 / P2×2。

---

## 1. 逐 bug 审计

### B1 — 生产计划"工序"下拉只显示"通用",已配置产品工序未关联

- **客户原话** (transcript line 23): "我刚新建了主题啊但为什么还只有通用…现在只有通用没有关联过来 嗯哦好我记一下…这是一个小bug就通批过来好了"
- **NEW vs KNOWN**: ✅ NEW (无 issue / memory 命中)
- **当前代码**:
  - 前端 `web-admin/src/views/production/plans/list.vue:184-208` 函数 `loadBomProcesses` 调用 `GET /{factoryId}/bom/labor?productTypeId=<id>` (LaborCostConfig 表 — 人工成本配置)
  - 后端 `BomController.java:119-128` 返回 `LaborCostConfig` 列表
  - **错误源**: 表读错了。客户在"系统管理 → 产品工序配置"配置的工序保存在 `ProductWorkProcess` (controller `/api/mobile/{factoryId}/product-work-processes` line 21, 业务 view `system/product-processes/index.vue:10` 调用 `getProductWorkProcesses`)
  - 生产计划页应读 `ProductWorkProcessController` 但当前读了 `BomController.labor` (完全是另一张表)
- **真实状况**: **wired to wrong endpoint** — UI 看到"通用"是因为 LaborCostConfig 兜底返回 `getGlobalLaborCosts` (BomServiceImpl.java:237) 列表里只有占位的"通用"项
- **Severity**: **P0** (阻塞流程 — 客户原话说"先选通用好了就往下往下走")
- **Fix sketch**:
  - `web-admin/src/views/production/plans/list.vue:190` — API path 改为 `/${factoryId}/product-work-processes?productTypeId=${productTypeId}`
  - 字段映射: 后端返 `ProductWorkProcessDTO.processName / workProcessId / processOrder` (按 processOrder asc) → 前端 `bomProcesses` 用 `processName`
  - fallback `/bom/labor/all` 删除 (那是 LaborCostConfig 全局, 不应混用)
  - 注意: 仍然需要"通用"兜底? Spec 决策 — 建议改成"按 processOrder 取第 1 个 / 全部展示让用户选"
- **Effort**: **~2 小时** (FE 改 1 行 + 重测试)
- **Dependencies**: Steve 确认: 是否保留"通用"作为 fallback 选项 (建议: 不保留, 让 UI 提示"请先配置产品工序")

---

### B2 — 调拨单 / 出库不能选择批次,默认选最早 (FEFO)

- **客户原话** (line 31): "调拨说调拨单的时候那么仓库发货的时候就让他们做一个仓库我可以选择P次啊就这样啊因为现在其实是默认是直接选最早的一批词…他有时候可能会用新P次需要"
- **NEW vs KNOWN**: ✅ NEW (无历史)
- **当前代码**:
  - 后端 `TransferServiceImpl.java:359-386` `deductSourceInventory` 调用 `findAvailableBatchesFEFO(factoryId, materialTypeId)` 自动按"先到期先出"扣减
  - `InternalTransferItem` 实体有 `sourceBatchId` 字段 (line 377) 但仅在 deduct 时被服务器**自动写入**, FE 无法主动传
  - 前端 `web-admin/src/views/transfer/detail.vue` 无批次选择 UI (整个 detail 没有 batch 字段)
  - **对比**: 手动出货 `web-admin/src/views/warehouse/shipments/list.vue:440-448` 有 `<el-select v-model="shipmentForm.productBatchId">` 批次下拉 (客户原话: "如果说手动创建出货的话是可以选择P次的")
- **真实状况**: **feature gap** (调拨单完全没实现批次选择) + 业务上 FEFO 优先合理但**客户要求支持手动覆盖**
- **Severity**: **P0** (新货特殊业务场景必须 — 客户原话: "做原切的可能会要求你就要一年以内的包裹或者其他可能用的是新货不是老货")
- **Fix sketch**:
  - 后端 `TransferServiceImpl.deductSourceInventory` (line 360) 加分支: 若 `item.getSourceBatchId() != null` 走指定批次扣减,失败抛 BusinessException; 否则保留 FEFO 默认
  - 前端 `transfer/detail.vue` 加批次选择 UI: 调拨单 status=APPROVED 后,在每个 item 行加 batch dropdown (调 `/material-batches/available?materialTypeId=<id>` 端点)
  - DTO `CreateTransferRequest.java` 已经有 `sourceBatchId` 字段? Need to check (若没就加)
- **Effort**: **~6-8 小时** (BE 加 batch-指定路径 ~2h + FE 批次下拉 + 测试 ~4h)
- **Dependencies**: Spec 决定: 是否调拨单 CREATE 时就要求选批次 (推荐 SHIP 时选,因为 APPROVED 之后才确认仓库出货)

---

### B3 — 生产"开始"按钮无库存校验

- **客户原话** (line 35): "那这个开始的话点的时候会有一个判断吗就是我的库存够不够…加一个我觉得还是加一个不然万一是不就得合对一下是吧"
- **NEW vs KNOWN**: ✅ NEW
- **当前代码**:
  - `ProductionPlanServiceImpl.java:419-450` `startProduction` 只调 `runConfiguredValidation(factoryId, "START", ...)` (line 435), 该方法委托给 `validationRuleEvaluator` 配置规则引擎
  - 没有 BOM 推导 + 仓库批次合计的硬校验
  - 客户场景: 调拨单已建但未发运,点"开始"应阻断
- **真实状况**: **feature gap** (业务规则未配置 — `validationRuleEvaluator` 是 configurable, 但客户没有人工配)
- **Severity**: **P1** (有 workaround — 调拨单发运失败时已经能拒绝)
- **Fix sketch**:
  - 后端 `ProductionPlanServiceImpl.startProduction` 加: 拉 BOM items → 计算需求量 (考虑出成率) → 查询 `material_batches.SUM(receiptQuantity - usedQuantity)` → 不足时 throw BusinessException withHint("请先采购或调拨原料")
  - 或者: 走 ValidationRuleEvaluator + 默认配置一条 STOCK_CHECK rule (rules.yaml)
  - 推荐: 硬编码到 service 层,可靠性最高
- **Effort**: **~3-4 小时** (BE 加方法 + 单测)
- **Dependencies**: 无 (BOM + MaterialBatch 都已存在)

---

### B4 — 调拨单页面缺"现有库存"列

- **客户原话** (line 31): "在调拨数量旁边加个字案加一个那个现有库存…就提前显示"
- **NEW vs KNOWN**: ✅ NEW
- **当前代码**: `web-admin/src/views/transfer/detail.vue:160-184` 表格只有 类型/品名/调拨数量/已收数量/单位/单价/小计 — 无"现有库存"列
- **真实状况**: **UX gap** — 数据可查 (`materialTypeId` → MaterialBatch 求 SUM),只是 UI 没显示
- **Severity**: **P1** (workaround: 客户去仓库管理页查,但每次切页麻烦)
- **Fix sketch**:
  - 后端 `TransferController` GET /transfers/{id} response 加 `availableStock` 字段 (per item, 根据 materialTypeId / productTypeId 算 batch SUM)
  - 或前端补一次额外的 batch query (避免改 controller)
  - 推荐 BE 一次返回 (减少 round trip)
- **Effort**: **~2-3 小时** (BE response 加字段 + FE 表格加 column)
- **Dependencies**: 无

---

### B5 — 缺"分仓库存查询"页 (工厂线边仓 + 成品库存)

- **客户原话** (line 41-42): "在生产管理里面加一个库存插群就是分仓的库存插群就是…一个就是从那个总仓那边调过来的那个原辅料第二个就是那个他生产完的成品啊需要一个成品的需要"
- **NEW vs KNOWN**: ✅ NEW
- **当前代码**:
  - `web-admin/src/views/warehouse/inventory/index.vue` 是**单仓** view, 无 factory/warehouse 切换 filter
  - 数据模型已支持: `MaterialBatch.factoryId` (entity line 45) + `FinishedGoodsBatch.factoryId`
  - "分仓"在客户语境 = "线边仓"(branch warehouse) = "另一个 factoryId" — D3 决策 (transcript line 75)
- **真实状况**: **feature gap** — 数据已分仓 (factory-scoped batches), 只缺 UI
- **Severity**: **P1** (新 page, 客户口头 priority 不阻塞当前流程, 但下个 demo 必需)
- **Fix sketch**:
  - 新增 `web-admin/src/views/production/branch-inventory/index.vue` (or `warehouse/branch-inventory/`)
  - 两个 tab: "原辅料库存" 调 `/material-batches?factoryId=<branch>` + "成品库存" 调 `/finished-goods-batches?factoryId=<branch>`
  - 顶部 select: 当前用户的 factoryId 已经是 branch (multi-tenancy), 但还需查"总仓"作为参照
- **Effort**: **~1 天** (新 page 含 2 个 tab + 列表 + 跨 factoryId 查询)
- **Dependencies**: 需 Steve 确认: 多分仓如何登录区分 (per-user factoryId? 还是切 dropdown?)

---

### B6 — App 报工审批一直转圈加载

- **客户原话** (line 37): "他一直在转加载中嗯那可能我得发个新版本给你就是导致了因为这两天有都跟新版后端对不上的话就可能会跟不进去…F006 admin 那账号吗这个应该是后端的问题…换成现在账号也登不进去嗯"
- **NEW vs KNOWN**: ✅ NEW (transcript 上一次提)
- **当前代码**:
  - 前端 `frontend/CretasFoodTrace/src/screens/factory-admin/management/WorkReportApprovalScreen.tsx:54-70` `loadReports` 有 finally 重置 `loading=false`
  - 后端 `WorkReportingController.java:69-81` GET `/api/mobile/{factoryId}/work-reporting/reports` 存在
  - timeout 配置 120s (apiClient.ts:16)
- **真实状况**: 不确定 — 几种可能:
  1. **客户 App 版本 stale**: app 调用 deprecated 接口 (e.g. 旧 `/work-reports` vs 新 `/work-reporting/reports`); 客户原话 "前后端对不上"
  2. **5月9日 T6.4 cascade 副作用**: T6.4 切 SmartBI 路由到 Python (139 nginx),只影响 `/api/smartbi/*`, NOT work-reporting (`/api/mobile/{factoryId}/work-reporting/*` 走 Java only); 排除
  3. **认证 stuck**: F006 admin 账号在 T6.4 切换期间 401 死循环; apiClient interceptor (line 60) refresh token 失败 silently → 请求 hang
  4. **CORS / network 局部问题** (客户端网络)
- **Severity**: **P0** (阻塞客户测试整条流程 — 客户原话: "我得发个新版本给你")
- **Fix sketch**:
  - Step 1: 服务器 `curl -H "Authorization: Bearer <test_token>" http://47.100.235.168:10010/api/mobile/F006/work-reporting/reports?page=1&size=50` 确认 backend OK
  - Step 2: 若 backend OK → app 端 RN APK 发新版 (build-android-apk skill); 检查 `apiClient.ts:60` 401 refresh 流程,可能 refresh 失败时没 throw 导致 spinner stuck
  - Step 3: 若 backend 报错 → 调查 service impl
- **Effort**: **~2-4 小时** (诊断 + 重打包 APK)
- **Dependencies**: 需要 F006 真实 token + 客户端 logs

---

### B7 — 新建销售订单弹窗太小看不到 (旧 bug 复现)

- **客户原话** (line 23): "我我已经新建一个大谷了哎我刚新建式主题啊但为什么…呃新建那个销售订单的时候不是那个弹窗太小吗然后那个窗口小的就看不到对对对那个应该还没弄好"
- **NEW vs KNOWN**: 客户原话明确 — **KNOWN (之前已反馈,这次未修)**
- **当前代码**:
  - `web-admin/src/views/sales/orders/list.vue:823` `<el-dialog width="720px">` 但内部 item 行 (line 882-901) 列宽合计 = 200+120+100+80+100+80+90+40 + el-form label-width 100px = **910px+** > 720px
  - 内容被截断,右侧"操作"按钮看不到
- **真实状况**: **真实 broken** (CSS overflow / dialog width 不够)
- **Severity**: **P2** (UX, 客户已 workaround 多次, 但仍标记是 旧 bug 复现 — 客户体验恶劣)
- **Fix sketch**: `width="720px"` → `width="80%"` 或 `width="1080px"` (line 823); 同样 detail.vue:1140/1164/1212/1238/1267/1315 各 dialog 看是否合理
- **Effort**: **~15 分钟** (1 行改 + 自测)
- **Dependencies**: 无

---

### B8 — "原辅料配方"中的"关联原料"未真正联动仓库原料表

- **客户原话** (line 25): "关联原料也要了现在面当然是有问题就是理论上说关联原料应该是就是关联到我们仓库里面的内容就是现在就要关联错的地方对你要关联关联那个咱们仓库的原料嘛关联仓库原料嘛"
- **NEW vs KNOWN**: ✅ NEW
- **当前代码**:
  - 前端 `web-admin/src/views/production/bom/index.vue:165-177` `loadMaterialTypes` 调 `/${factoryId}/raw-material-types/active` (返仓库原料 master 列表)
  - 下拉绑定 line 871-879 — `bomForm.materialTypeId` 选项来自 `materialTypes`,**字面正确联动**了
  - 但: 下拉**无 @change handler**, 选了之后 `bomForm.materialName / unit / unitPrice` 不会自动填充 — 客户得手动再输物料名称 (line 862) + 单位 (line 888) + 单价
  - 客户期望: pick 关联原料 → 自动填名称 / 单位 / (单价?)
- **真实状况**: **wired wrong** — dropdown 有但未传值
- **Severity**: **P1** (workaround: 客户手动输, 但数据不一致风险高)
- **Fix sketch**:
  - `web-admin/src/views/production/bom/index.vue:872` 加 `@change="onMaterialLink"` 事件
  - 函数: `function onMaterialLink(materialTypeId) { const m = materialTypes.value.find(x => x.id === materialTypeId); if (m) { bomForm.value.materialName = m.name; bomForm.value.unit = m.unit; /* optional: bomForm.value.unitPrice = m.latestPurchasePrice; */ } }`
- **Effort**: **~30 分钟** (1 函数 + 1 行 @change)
- **Dependencies**: 无 — `/raw-material-types/active` 已返回 name/unit (RawMaterialTypeController.java:51)

---

### B9 — 缺"手动新建调拨单"入口 (领用 / 研发场景)

- **客户原话** (line 33): "在没有计划的情况下可以做再新建一个那个窗口吧就是可以就是在没有生产任务的时候也加一个那个新建调拨单啊就手动创建调拨单是吧对手动创建调拨单嗯…有时候会有这种情况的比如说互相走调拨的有一个比如说理用的"
- **NEW vs KNOWN**: ✅ NEW
- **当前代码**:
  - `web-admin/src/views/transfer/list.vue:84` 顶部 toolbar 只有"刷新"按钮, 无"新建"
  - 后端已支持: `CreateTransferRequest` DTO + `TransferController.create` 端点已存在 (从 `TransferCreateTool.java` reverse-engineer)
  - 现状: 调拨单只能 by 生产计划自动生成
- **真实状况**: **feature gap (FE 入口)** — BE 都已有, 缺 FE 创建 dialog
- **Severity**: **P2** (有 workaround: 客户走"新建出货" — 但客户原话明确"不一样,不一样他属于商业调拨")
- **Fix sketch**:
  - `transfer/list.vue:84` 加 `<el-button type="primary" :icon="Plus" @click="showCreateDialog=true">新建调拨单</el-button>`
  - 加创建 dialog: 源仓 / 目标仓 / 类型 / items (品名 + 数量 + 批次?)
  - 调 `POST /{factoryId}/transfers` (CreateTransferRequest)
- **Effort**: **~4-6 小时** (新对话框 + items 多行编辑 + 测试)
- **Dependencies**: 联动 B2 (是否同时支持手动批次选择)

---

## 2. 修复优先级 + 序列

### P0 (阻塞客户测试当前流程, 必须本周解决)

| # | Bug | Effort | 建议次序 |
|---|------|--------|---------|
| **B6** | App 报工审批转圈 | 2-4h | **1** (诊断优先, 客户测试卡住) |
| **B1** | 生产计划工序下拉错读 LaborCostConfig | 2h | 2 |
| **B2** | 调拨单不能选批次 | 6-8h | 3 (新货业务必需) |

### P1 (workaround 存在但客户明确要求)

| # | Bug | Effort | 建议次序 |
|---|------|--------|---------|
| **B3** | 生产开始无库存校验 | 3-4h | 4 |
| **B4** | 调拨单缺"现有库存"列 | 2-3h | 5 |
| **B8** | BOM 关联原料未联动 | 30min | 6 (super quick win) |
| **B5** | 分仓库存查询页 | 1d | 7 |

### P2 (UX polish, 可延后)

| # | Bug | Effort |
|---|------|--------|
| **B7** | 销售订单弹窗太小 (旧 bug) | 15min |
| **B9** | 手动新建调拨单入口 | 4-6h |

### 总 effort: ~3-4 工作日 (单人)

---

## 3. Top 3 Quick Wins (15-30 min)

1. **B7** dialog width fix — `el-dialog width="720px"` → `width="80%"` (1 行,client 多次抱怨)
2. **B8** BOM 关联原料 @change — 1 个 onMaterialLink 函数,30 分钟
3. **B4** transfer "现有库存" 列 (前端只加列 + 1 个 batch query,2h 可破)

## Top 3 Complex Fixes (>1 day)

1. **B5** 分仓库存查询页 (新 page + 2 tab + factoryId multi-tenancy 模型对齐)
2. **B2** 调拨单批次选择 (BE 改逻辑 + FE 加 dropdown + 联动 ship 流程 + 测试)
3. **B6** App 报工诊断 (诊断 + 可能需重打包 + APK 分发)

---

## 4. Sister-chat Dispatch Plan

| Bug | Subagent 任务 | Effort | Stacking | 触发依赖 |
|-----|-------------|---------|----------|---------|
| **B6** | 诊断 + 服务器 curl 测 + APK rebuild | 2-4h | Independent | F006 测试 token |
| **B1** | FE 1 行改 + E2E 验证 | 2h | Independent | 无 |
| **B7** | FE 1 行 dialog width | 15min | Independent | 无 |
| **B8** | FE @change handler | 30min | Independent | 无 |
| **B4** | BE 加 availableStock 字段 + FE 加列 | 2-3h | Independent | 无 |
| **B3** | BE 库存校验逻辑 + 单测 | 3-4h | Independent | 无 |
| **B2** | BE 批次指定路径 + FE 下拉 + 测试 | 6-8h | Independent | B9 联动 |
| **B9** | FE 新对话框 + items 编辑 | 4-6h | Independent | B2 联动 |
| **B5** | 新 page + 2 tab | 1d | Independent | Steve 决定 multi-tenancy UX |

**并行建议**: B6 / B1 / B7 / B8 同时分 4 个 chat 跑 (各 <4h),今日内可完成 4 个 P0/quick-win;B3/B4 第 2 个 chat 跑;B2+B9 联动需要 spec 决定先行。

---

## 5. Steve Sign-off Needed

- **B1**: 是否保留"通用"作为 fallback (建议: 删,改成 UI 提示)
- **B2**: 调拨单 CREATE 时还是 SHIP 时选批次? (建议 SHIP)
- **B5**: 分仓 / 总仓 multi-tenancy 模型 — 用户 factoryId 切换? 或者 dropdown 选 branch?
- **B6**: 是否客户 APK 走 OTA 还是手动 APK 分发? (build-android-apk skill 可用)
- **B8**: 选择关联原料后, unitPrice 是否也带出 (m.latestPurchasePrice)? 或保持手输?
- **B9**: 手动调拨单业务规则 — 是否要审批环节? 或 DRAFT → 直接 SHIPPED?

---

## 6. Whisper 转录质量警告

转录在以下点可能不准, 修复前请人工二次复核 SRT 时间戳 `D:\Temp\transcript.srt`:

- "P 次" / "P 四" 实际是"批次" (line 31-33 多次出现, 不影响 audit 结论)
- "BOM" 转录为 "爆木 / 爆墨 / 爆幕" (不影响)
- "调拨数量 166.67" (line 23) — 数字应该是 (200 / 0.58 / 1000) × 100 ≈ 0.345kg × 100 = **34.5kg** 还是别的算法? 客户原话用 166.67 但前置上下文是 100 份产品 + 200g/份 + 58% 出成率 → 需要回放确认 BOM 计算公式
- 中段约 31:00 客户提到二级单位 50kg/包盐 vs 1-2g 配方 → 决策 D1 已解决 (统一克 + 后端 1:1000 换算), 但需确认 UI 显示不会出 0.0000001 这种 (建议 P3 follow-up)

---

## 7. 与历史 dispatch / 部署的关联

- T6.4 cascade (2026-05-09 cretas SmartBI 100% Python) **不影响** work-reporting (Java only),排除 B6 因 T6.4 副作用
- PR #185 (Chat G datasource stub impl, 2026-05-08) 改的是 SmartBI datasource, 与 9 bug 无关
- 9 bug 都是核心业务模块, 与 SmartBI Phase 2A 工作流隔离

---

## 8. 审计 sign-off

- **Audit by**: Claude Opus 4.7 (organizer subagent)
- **Audit date**: 2026-05-10
- **9 bugs all classified NEW**: 0 命中 GitHub issue / memory / 历史 dispatch
- **P0/P1/P2 breakdown**: 3 / 4 / 2
- **Total effort estimate**: 22-30 工时 (~3-4 工作日 单人)
- **Recommended dispatch**: 4 个 sister chat 并行处理 B6+B1+B7+B8 (今日完成); B3+B4+B2/B9 后续; B5 + spec decisions Steve sign-off 后启动
