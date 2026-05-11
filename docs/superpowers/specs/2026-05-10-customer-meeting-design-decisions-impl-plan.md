# 2026-05-10 客户对接 5 设计决策 — 实施方案

**Source**: `.tmp-transcripts/2026-05-10-customer-meeting.md`
**Decided by**: Steve + 客户 (F006 系列, 登录账号 `f006_admin`)
**Doc date**: 2026-05-10
**Status**: Draft — 待 Steve sign-off
**Branch (this doc)**: `ops-2026-05-10-design-decisions-impl-plan`

---

## 0. TL;DR

5 个设计决策从 56 分钟客户会议中提炼。共 6 个 Action Item 涉及代码改动，4 个最大的改动已有现成基础设施（`factory_warehouses` 表 / `BomItem.yieldRate` 字段 / `UnitOfMeasurement` 换算 / `FinishedGoodsBatch` + `InternalTransfer.transferType` 双向调拨），主要工作是 **wire-up + UI 暴露 + 删除一段自动 FEFO 默认行为**，不需要新表。

### Decision matrix

| # | Decision | Effort | Dependencies | Dispatch ready |
|---|---|---|---|---|
| D1 | 工厂 = 线边仓 / 双仓 + 反向调拨 | 3-4d | A1 (B1 工序未关联) 优先 | ⚠️ 部分 (UI 部分需先确认) |
| D2 | BOM 配方算法 (成品 g + 出成率% → 自动算原料用量) | 0.5-1d | 无 — `BomItem.getActualQuantity()` 已实现 | ✅ yes |
| D3 | BOM 单位 1:1000 后台换算 (g ↔ kg) | 2-3d | D2 (绑定 BOM 录入流程) | ✅ yes |
| D4 | RPF (MaterialProductConversion) 保留不删 | 0.5d | 无 — 仅文档化 + UI 提示 | ✅ yes |
| D5 | 销售订单流转 (工厂不发货, 总仓销售) | 2-3d | D1 (反向调拨先就绪) | ⚠️ blocked on D1 |

### 推荐 dispatch 顺序

1. **Quick win**: D4 文档化 (0.5d) — 不阻塞别的, 也释放后续 BOM PR 的认知负担
2. **Quick win**: D2 验证 + UI 实时计算补完 (0.5-1d) — 后端已实现, 前端需检查
3. **Medium**: D3 g/kg 换算 (2-3d) — D2 完成后立即可做
4. **Medium**: D1 双仓流转 + 反向调拨 + 手动批次选择 (3-4d) — 触及 transfer 流程, 单独 PR
5. **Medium**: D5 销售订单走总仓库存 (2-3d) — D1 ready 之后

总工作量预估：**8-12 个工作日**, 可拆 4-5 个独立 PR。

---

## 1. 背景

### 1.1 客户场景

F006 卤味食品工厂，案例产品「叮咚好时光卤猪蹄 200g」(出成率 58%) 。客户走通了一条完整链路：

```
销售订单 → BOM 配方 → 生产计划 → 调拨单 (总仓→工厂) → 报工 → 成品入库 → 反向调拨 (工厂→总仓) → 销售出库
```

客户在测试过程中提出 9 个功能 bug (B1-B9) 与 5 个设计决策 (D1-D5)，本文档专注 5 个设计决策的实施方案。功能 bug 的修复直接由 Action Item A1-A9 跟进 (另 dispatch)。

### 1.2 关键名词

| 客户原话 | 标准名 | 代码字段 |
|---|---|---|
| 总仓 / 物流仓 | 总仓 (Logistics warehouse) | `factory_warehouses.type = 'LOGISTICS'` |
| 工厂仓 / 线边仓 / 鲜棉仓 / 车间仓 | 线边仓 (Workshop warehouse) | `factory_warehouses.type = 'WORKSHOP'` |
| 爆木 / 爆墨 / 爆幕 | BOM (Bill of Materials) | `bom_items` |
| 出成率 | yield rate (%) | `bom_items.yield_rate` |
| 成品含量 | standard quantity (单份产品标准用量) | `bom_items.standard_quantity` |
| 转换率 (旧字段) | RPF — Rate Per Factor | `material_product_conversions.conversion_rate` |
| 批次 / P 次 / P 四 | batch | `material_batches.batch_number` |

### 1.3 现有基础设施盘点

| 实体/表 | 文件 | 状态 |
|---|---|---|
| `bom_items` (`BomItem.java:29`) | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/BomItem.java` | 已有 `yieldRate` (默认 100) + `standardQuantity` + `getActualQuantity()` 计算方法 |
| `material_product_conversions` (`MaterialProductConversion.java:34`) | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialProductConversion.java` | RPF 实体, 已有 `conversionRate` + `wastageRate` + `calculateActualUsage()` |
| `factory_warehouses` | `backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__factory_warehouses.sql` | 已 seed 每工厂 2 个仓 (WH-LOG 物流仓 + WH-WKS 鲜棉仓), 仅作 reference data, 未参与库存查询 |
| `internal_transfers` (`InternalTransfer.java:50`) | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/InternalTransfer.java` | 已支持 `HQ_TO_BRANCH` / `BRANCH_TO_HQ` 双向, 有 `sourceWarehouseId` / `targetWarehouseId` 字段 |
| `finished_goods_batches` (`FinishedGoodsBatch.java:45`) | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/FinishedGoodsBatch.java` | 成品批次已有 (生产→销售缺失环节填补) |
| `unit_of_measurements` (`UnitOfMeasurement.java:36`) | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/UnitOfMeasurement.java` | 单位换算实体, 有 `conversionFactor` + `toBaseUnit()` / `fromBaseUnit()` 双向方法 |
| `BomExpansionService` | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/BomExpansionService.java` | ⚠️ **当前 BOM 展开走 RPF 不走 BomItem** (与 D4 冲突, 见 §5) |
| `TransferServiceImpl.deductSourceInventory()` | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/TransferServiceImpl.java:359-386` | 自动 FEFO 扣减, 无手动批次选择路径 |

---

## 2. D1 — 工厂 = 线边仓, 双仓流转

### 2.1 Decision text

> 这个线边仓的原则就是当天生产完结束以后是没有库存的。原料会全部生产完, 我领了多少料我生产多少料, 生产结束了我用的料就结束了, 那我所有的库存就没有了。那我生效的是我的成品库存, 我的成品库存我会调拨给那个总仓去, 然后因为仓库所有的仓库是那个总仓的仓库。把你我的线边仓是我今天要生产所以有些临时库存。
>
> 那个工厂是不发货的 ⋯ 是这样子, 你工厂他其实是调拨到那个总仓去的, 总仓在会去安排什么时候发给那个客户。

(transcript line 39-41)

### 2.2 客户 + Steve 决策理由

- **客户痛点**: 工厂当天生产是 throw-away workshop, 当天领料当天用光, 留库存会导致库存盘点不准 + BOM 偏差余料无处可去
- **客户业务模型**: 总仓负责对客户发货, 工厂只对总仓发货 — 工厂 ≠ 直销主体
- **数据完整性**: 工厂仓必须是当天清仓的, 任何成品/剩余原料隔夜留存视为异常 (需告警或自动调回总仓)
- **现有基础设施支持**: `factory_warehouses` 表已经 seed 了 WH-LOG (物流仓 = 总仓) + WH-WKS (鲜棉仓 = 线边仓) 双仓; `InternalTransfer` 已支持 `HQ_TO_BRANCH` (调拨进厂) 和 `BRANCH_TO_HQ` (调回总仓)

### 2.3 Current state

| 位置 | 状态 | 引用 |
|---|---|---|
| `factory_warehouses` 表 | ✅ 已存在, 双仓已 seed | `V20260411_03__factory_warehouses.sql:33-61` |
| `InternalTransfer.sourceWarehouseId` / `targetWarehouseId` | ✅ 字段存在, 但**当前不参与库存查询** | `InternalTransfer.java:82-88` (注释明确说"V3 P0-5 调入仓库ID, null = 跨工厂调拨"; 详见 ADR `2026-04-11-v1-e2e-framework-redesign.md:217`) |
| `TransferType` enum | ✅ `HQ_TO_BRANCH` + `BRANCH_TO_BRANCH` + `BRANCH_TO_HQ` 全有 | `TransferType.java:6-10` |
| 反向调拨 (工厂→总仓) UI | ❌ 客户原话"调拨单也加一下 ⋯ 你不可能调拨单不管再新建一个出库", 当前**无**手动新建反向调拨入口 | (B9 在 transcript 第 33 段) |
| 分仓库存查询 (按仓库维度) | ❌ MaterialBatch 无 `warehouseId` 字段, ADR 显示"P0-5 B2 决定不加" | (B5 客户要求加分仓库存查询页) |
| 成品→总仓回调 | ❌ 报工完成→FinishedGoodsBatch 创建后, 无自动反向调拨触发 | 需新增 trigger |

### 2.4 Spec impact

- **新建** `docs/superpowers/specs/2026-05-10-d1-dual-warehouse-flow-design.md` (~300 LOC)
  - §1 当前双仓 ADR 重新评估 (V3 P0-5 ADR "不加 warehouseId" 是否仍然成立 — D1 客户明确要求看分仓库存, **必须 revisit**)
  - §2 业务流程: 计划→FMR→车间仓 (WH-WKS)→报工→收工→退回物流仓 (WH-LOG)
  - §3 数据模型: 决定是给 `material_batches` 加 `warehouse_id` (B-option) 还是用 `factory_warehouses` 单独维护虚拟视图 (A-option)
  - §4 反向调拨触发器: 报工 status=COMPLETED → 自动生成 BRANCH_TO_HQ 调拨单 (草稿态, 用户确认)
  - §5 异常处理: 当天结束时 WH-WKS 残留库存告警 (cron 23:50 扫描)

- **更新** `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md` §2.9 — 把"双仓体系仅作 reference data"的注释改成"WH-WKS 参与库存维度", 并补 G3 链 step 6 (退回物流仓自动调拨)

### 2.5 Code impact

| 模块 | 文件 | 改动 |
|---|---|---|
| Entity | `MaterialBatch.java` | 添加 `@Column warehouse_id` (nullable, 默认 = factoryId 的 WH-LOG) |
| Entity | `FinishedGoodsBatch.java` | 同上 (默认 WH-WKS — 生产产出到车间仓) |
| Repository | `MaterialBatchRepository`, `FinishedGoodsBatchRepository` | 增加 `findByWarehouseIdAndProductType()` 方法 |
| Service | `ProductionWorkflowOrchestrator` | `generateTransferFromPlan()` 加 `targetWarehouseId = WH-WKS` (transcript: 调拨进厂时入车间仓) |
| Service (新) | `ReverseTransferService` (新建) | 报工 COMPLETED 事件订阅 → 自动生成 BRANCH_TO_HQ 调拨单草稿 |
| Service | `WorkReportingServiceImpl` | 发布 `ProductionCompletedEvent` (现有 `WorkReportSubmittedEvent` 之上加新事件) |
| Controller | `TransferController` (`backend/java/cretas-api/src/main/java/com/cretas/aims/controller/inventory/TransferController.java`) | 加 `POST /api/mobile/{factoryId}/transfers/manual` — 手动新建调拨单 (B9) |
| Frontend | `web-admin/src/views/inventory/transfers/index.vue` | 加"分仓维度"切换 + "新建调拨单"按钮 + 反向调拨流程 |
| Frontend (新) | `web-admin/src/views/inventory/warehouse-stock/index.vue` (新建) | 分仓库存查询页 (B5) |

### 2.6 Schema impact

- **新 migration**: `V20260510_01__material_batch_warehouse_id.sql`
  - `ALTER TABLE material_batches ADD COLUMN warehouse_id VARCHAR(64);`
  - `CREATE INDEX idx_mb_warehouse ON material_batches(warehouse_id);`
  - 数据回填: 所有已有 batch.warehouse_id 默认 = (factoryId 的 WH-LOG.id)
- **新 migration**: `V20260510_02__finished_goods_batch_warehouse_id.sql` (同上, 默认 WH-WKS)
- **新 migration**: `V20260510_03__production_completed_event_log.sql` (event sourcing 持久化, 用于幂等触发反向调拨)

### 2.7 Frontend impact

| 页面 | 改动 |
|---|---|
| `web-admin/src/views/inventory/transfers/index.vue` | (a) 列表加 `warehouseId` 过滤 (b) 新建调拨单 dialog 加 source/target warehouse 下拉 (c) 反向调拨入口按钮 |
| `web-admin/src/views/inventory/warehouse-stock/index.vue` (新) | 双 tab: 原辅料库存 / 成品库存, 按仓库分组 |
| RN App `frontend/CretasFoodTrace/src/screens/inventory/*` | 同步 (优先级 P2, 客户主要在 web-admin) |
| Vue 菜单 `web-admin/src/router/index.ts` | 加 `/inventory/warehouse-stock` 入口 + 权限 |

### 2.8 Migration plan

1. 部署后端 migration (V20260510_01-03), 自动回填 warehouse_id 默认值
2. 客户 F006 验证: 现有库存全部归属 WH-LOG, 0 数据丢失
3. 启用新 UI (warehouse-stock 页), 客户验证 view
4. 启用反向调拨自动触发 (灰度: 仅 F006, 通过 `feature_flags` 表)
5. 灰度 1 周, 0 告警后全工厂启用

### 2.9 Effort estimate

| 任务 | 估时 |
|---|---|
| Spec 写作 + Steve review | 0.5d |
| Entity + migration + repository | 0.5d |
| Service: 反向调拨自动触发 | 1d |
| Controller: 手动新建调拨单 (B9 一同修) | 0.5d |
| Frontend: 双仓 UI + 库存查询页 | 1-1.5d |
| 测试 + 灰度 | 0.5d |
| **合计** | **3-4d** |

### 2.10 Dependencies

- ⚠️ B1 (工序未关联) 应**优先**修复 — 客户当前流程卡在生产计划下拉只有"通用"工序 (transcript line 21)
- ⚠️ V3 P0-5 ADR "MaterialBatch 不加 warehouseId" 需要 Steve 明确推翻 → 推荐 sign-off
- B2 (调拨手动选批次) 是 D1 的必要补充, 应一起做 (transcript line 31-33)

### 2.11 Sister-chat dispatch plan

- **Ready**: 部分 (需先 Steve sign-off ADR 推翻)
- **Prerequisite**: B1 (A1 工序未关联) 先 land
- **Recommended sister chat**: dual-warehouse-flow chat (单独 PR, 不要混 BOM)
- **Marching order outline**:
  1. Read spec doc (~10 min)
  2. Implement Schema migration V20260510_01-03
  3. Add Entity field + Repository methods
  4. Add `ReverseTransferService` + event subscription
  5. Add controller endpoint for B9
  6. Add Vue view warehouse-stock page
  7. Local smoke + commit + PR

---

## 3. D2 — BOM 配方算法 (成品 g + 出成率% → 自动算原料用量)

### 3.1 Decision text

> 比如说那个我我做那个这个珠奇一个成品是 200 克, 那我就写个 200 克, 那么我出程率是 58%, 自动折算的话就是 250.58, 就算出来我的原材料一共用多少, 就这样吧。

(transcript line 27)

数学: `actual_quantity = standard_quantity / (yield_rate / 100)` → 200 / 0.58 = **344.83g** (客户原话 250.58 系不正确, **正确公式 200 / 0.58 = 344.83**; 100 份计划即 100 × 344.83 = 34483g = **34.48 kg**)

### 3.2 客户 + Steve 决策理由

- **客户痛点**: 不想手动输入"加损耗后的原料用量", 想输入"成品标准量 + 出成率%", 系统自动算出原料用量
- **数学背景**: 出成率 58% 意味着原料 100g 只能做 58g 成品。所以做 200g 成品需要原料 200 ÷ 0.58 = 344.83g
- **Steve 默认共识**: 上文已有 BomItem.yieldRate 实现这个公式 (transcript 没明确反对), 客户只是不熟悉 UI 在哪里输入

### 3.3 Current state

| 位置 | 状态 | 引用 |
|---|---|---|
| `BomItem.standardQuantity` | ✅ 存在 (precision 15,4) | `BomItem.java:67-69` |
| `BomItem.yieldRate` | ✅ 存在, 默认 100 | `BomItem.java:73-76` |
| `BomItem.getActualQuantity()` | ✅ 实现: `standardQuantity / (yieldRate / 100)` | `BomItem.java:122-131` |
| `BomItem.calculateCost()` | ✅ 用 `getActualQuantity() × unitPrice` | `BomItem.java:137-143` |
| BOM 录入 UI (Vue) | ✅ 有"成品含量"字段 + "出成率%"字段 | `web-admin/src/views/production/bom/index.vue:881-887` |
| 实时计算 | ⚠️ 列表显示有 (`bom/index.vue:734`), 但**录入 dialog 无实时预览** | `bom/index.vue:881-900` |

### 3.4 Spec impact

- **无需新建 spec** — 现有实现已完整
- **可选**: 在 `2026-04-11-v1-e2e-framework-redesign.md` 或 `2026-04-29-factory-product-manual-design.md` 加 §"BOM 算法 reference" subsection (~30 LOC)

### 3.5 Code impact

| 模块 | 文件 | 改动 |
|---|---|---|
| Backend | 无 | 已实现 |
| Frontend | `web-admin/src/views/production/bom/index.vue:870-905` | BOM 录入 dialog 加"实际原料用量 (自动计算)" 只读字段, 实时展示 standardQuantity / (yieldRate/100) |
| Frontend | 同上 | 加 form-tip 说明: "输入 200g 成品 + 58% 出成率 → 自动算原料 344.83g" |

### 3.6 Schema impact

无。

### 3.7 Frontend impact

仅 `bom/index.vue` 一个文件, 加一个 computed 字段:

```typescript
const computedActualQuantity = computed(() => {
  const sq = bomForm.value.standardQuantity || 0;
  const yr = (bomForm.value.yieldRate || 100) / 100;
  if (yr <= 0) return 0;
  return (sq / yr).toFixed(4);
});
```

### 3.8 Migration plan

无 — 仅 UI 改动, 无数据迁移。

### 3.9 Effort estimate

| 任务 | 估时 |
|---|---|
| Vue dialog 加实时预览 | 0.5h |
| Smoke + commit + PR | 0.5h |
| **合计** | **0.5-1d** (含 review/QA) |

### 3.10 Dependencies

无。

### 3.11 Sister-chat dispatch plan

- **Ready**: ✅ yes
- **Prerequisite**: 无
- **Recommended dispatch**: 与 D3 g/kg 换算合并一个 PR (单元一致性)

---

## 4. D3 — BOM 单位 1:1000 后台换算 (g ↔ kg)

### 4.1 Decision text

> BOM 配方都是按克 ⋯ 主要就是克跟千克 ⋯ 就 1 比 1000 的意思 ⋯ 我们做那个调拨单的时候会自动甩换成共金 [千克], 共金数给到商铺。

(transcript line 27)

具体: BOM 配方层用 **克 (g)**, 仓库 / 调拨层用 **千克 (kg)**, 系统在调拨单生成时**后台自动 ÷ 1000** 把 g 转 kg.

### 4.2 客户 + Steve 决策理由

- **客户痛点**: 仓库管理按千克 (盐 50kg/包), 但 BOM 配方按克 (一份成品里只有 1-2g 盐) — 如果统一 kg, 小数点会拉到 0.0000001, 客户原话"恶心"
- **客户痛点-2**: 二级单位 (一袋盐 = 50kg, 一包 = 一袋) 在 BOM 层引入会让录入复杂
- **客户决策**: 不用二级单位, **配方层 g + 仓库层 kg**, 系统 1:1000 自动换算
- **Steve 简化**: "你这个东西还惯着他了是吧" → 用最少的 unit conversion 处理这个特例
- **现有基础设施支持**: `UnitOfMeasurement` 实体已有 `conversionFactor` + 双向 `toBaseUnit()/fromBaseUnit()` 方法

### 4.3 Current state

| 位置 | 状态 | 引用 |
|---|---|---|
| `BomItem.unit` 字段 | ✅ `VARCHAR(20)` 自由文本 | `BomItem.java:80-82` |
| `unit_of_measurements` 表 | ✅ 已有 g + kg + 换算系数 | `UnitOfMeasurement.java:84-86` (g 系数 0.001, kg 系数 1.0) |
| BomExpansion 单位处理 | ❌ `ProductionWorkflowOrchestrator.buildTransferRequest():122` 直接读 `RawMaterialType.unit` (默认 "kg"), 无单位换算 |
| TransferRequest 单位 | ❌ 不参与单位换算, 1:1 透传 |
| Vue BOM 单位输入 | ⚠️ 自由文本 (`<el-input>`), 无下拉, 客户可能写 "克" / "克 (g)" / "g" 不统一 |

### 4.4 Spec impact

- **新建** `docs/superpowers/specs/2026-05-10-d3-bom-unit-conversion-design.md` (~150 LOC)
  - §1 单位约定: BOM 层 `unit = 'g'` (强制), 仓库 / Transfer 层 `unit = 'kg'`
  - §2 换算公式: Transfer.quantity = BomItem.actualQuantity × planQuantity / 1000
  - §3 显示规则: 调拨单 UI 展示 kg (2 位小数); BOM 录入 UI 展示 g
  - §4 异常: BOM unit 不是 g 时 (历史数据), 走原 1:1 逻辑 + 一次性数据回填
  - §5 验证规则: BOM 录入时 unit 字段下拉锁定 g (新建); 历史数据 lazy migration

### 4.5 Code impact

| 模块 | 文件 | 改动 |
|---|---|---|
| Service | `ProductionWorkflowOrchestrator.buildTransferRequest()` line 100-137 | 加单位换算: 若 `requirement.unit == 'g'` 且 `materialType.unit == 'kg'`, 则 `quantity = required / 1000`, item.unit = 'kg' |
| Service | `BomExpansionService.expandBOM()` | 调用方接收的 MaterialRequirement 加 `sourceUnit` + `targetUnit` 双字段 |
| Service (新) | `UnitConversionService` (or extend `UnitOfMeasurement` static helper) | `convert(value, fromUnit, toUnit)` 工具方法 |
| DTO | `MaterialRequirement.java` | 加 `unit` 字段 |
| Entity | `BomItem.unit` 字段 | 默认值改为 `'g'` (新建 BOM 时) |
| Frontend | `web-admin/src/views/production/bom/index.vue:888-890` | 单位字段改成下拉 (g 默认 + 可选 kg) |
| Frontend | 同上 | 新增提示: "BOM 单位建议用 g, 系统会在调拨时自动换算为 kg" |

### 4.6 Schema impact

- **新 migration**: `V20260510_04__bom_item_default_unit_g.sql`
  - 仅修改 default value: `ALTER TABLE bom_items ALTER COLUMN unit SET DEFAULT 'g';`
  - 历史数据**不回填** (保留客户当前 unit), spec §4 走 lazy migration

### 4.7 Frontend impact

仅 `bom/index.vue` 改 unit 字段为下拉选择 (`<el-select>` with options g / kg / 自定义); 调拨单页面的 quantity 显示带单位 (kg)。

### 4.8 Migration plan

1. 部署 schema migration (default 'g')
2. 通知客户 BOM 录入时 unit 选择 g (UI 已锁定 default)
3. 历史 BOM 数据 lazy migration: 由客户自己在测试中遇到时手动调整 unit (不主动批量)
4. 1 周后审计: `SELECT unit, COUNT(*) FROM bom_items GROUP BY unit;` 如果还有 != 'g' 的, 人工跟进

### 4.9 Effort estimate

| 任务 | 估时 |
|---|---|
| Spec 写作 + Steve review | 0.5d |
| Service 单位换算逻辑 + DTO | 0.5d |
| Vue 单位下拉 + 提示 | 0.5d |
| Smoke (生产计划→调拨单 end-to-end) + commit + PR | 0.5d |
| **合计** | **2d** |

### 4.10 Dependencies

- D2 (BOM 算法验证) 先 ready — D3 是 D2 的输出格式问题

### 4.11 Sister-chat dispatch plan

- **Ready**: ✅ yes (可与 D2 合并)
- **Prerequisite**: 无
- **Recommended dispatch**: 合并 D2+D3 一个 PR — `bom-yield-rate-and-unit-conversion`

---

## 5. D4 — RPF (MaterialProductConversion) 保留不删

### 5.1 Decision text

> 转换率就是你单个原料类型的转换 ⋯ 这个其实是之前就是最早期那个版本, 就是原来的 BOOM, 是我把设计生转换率的。但其实就是原本的 RPF 足足足足够了。但是我还是先留下来 ⋯ 因为刚刚的功能其实有重叠的嘛。

(transcript line 29)

### 5.2 客户 + Steve 决策理由

- **客户原话**: 转换率 (RPF, `MaterialProductConversion`) 是早期版本的 BOM 替代方案, 现在已被 `BomItem` 取代
- **决策**: 保留不删 — 重叠功能但暂不下线, 避免历史数据破坏
- **Steve 默认共识**: 这是文档化决策, 不动代码

### 5.3 Current state

| 位置 | 状态 | 引用 |
|---|---|---|
| `MaterialProductConversion` entity | ✅ 存在 | `entity/MaterialProductConversion.java:34` |
| `BomItem` entity | ✅ 存在 (新版) | `entity/bom/BomItem.java:29` |
| **关键冲突** | ⚠️ `BomExpansionService.expandBOM()` **仍使用 RPF**, 不用 BomItem | `BomExpansionService.java:51-80` |
| Vue UI: 两个独立 tab | ✅ "BOM 成本管理" + "转换率" 两个 tab 并存 | `web-admin/src/views/production/bom/index.vue:623` + `web-admin/src/views/production/conversions/index.vue` |
| 用户提示 | ⚠️ `bom/index.vue:623` 已有 `<ConceptDisambiguationAlert>` 说明: "复杂配方用 BOM, 简单出成率用转换率" |

### 5.4 Spec impact

- **新建** `docs/superpowers/specs/2026-05-10-d4-rpf-bom-coexistence-design.md` (~80 LOC)
  - §1 现状: RPF 早于 BOM, 功能 100% 被 BomItem 覆盖
  - §2 决策: 保留不删 — 历史数据 + 简单场景仍可用
  - §3 推荐: 新工厂默认走 BOM, 老工厂保留 RPF, **未来 Phase 4 评估下线**
  - §4 ⚠️ **关键: BomExpansionService 当前用 RPF 是旧实现, 应改为读 BomItem** — 客户原话"原本的 RPF 足足够了"是指概念上, 但代码层 `expandBOM()` 应读 `bom_items` 表, 不是 `material_product_conversions`
  - §5 验证: F006 工厂应同时有 RPF 和 BOM 配置, 验证 expandBOM 数学结果用谁

### 5.5 Code impact

⚠️ **此决策暴露出一个隐藏分歧**:

- `BomServiceImpl` (新版, 用 BomItem) ←→ `BomExpansionService` (旧版, 用 RPF 即 `MaterialProductConversion`)
- 这两个 service 走两套数据源, 客户 BOM 配置可能不被生产计划展开使用

**两种处理路径**:

| 路径 | 工作量 | 风险 |
|---|---|---|
| **A. 仅文档化 RPF (保留旧 BomExpansionService)** | 0.5d | 客户在 BOM 页面录的配方不被 expandBOM 用 → 客户困惑 |
| **B. 改 BomExpansionService 读 BomItem (推荐)** | 2-3d | 改动核心服务, 需 regression 测试 |

**推荐: 路径 B**, 因为客户在 transcript 中明确使用 BOM 录入页面, 期望该数据被生产计划用。但**这超出 D4 仅"文档化"的初衷**, 需要 Steve 决策。

### 5.6 Schema impact

无 (RPF 表保留)。

### 5.7 Frontend impact

- `web-admin/src/views/production/bom/index.vue:623` 的 `ConceptDisambiguationAlert` 文案更新, 加一行: "新工厂建议主用 BOM, 转换率为历史兼容字段"
- `web-admin/src/views/production/conversions/index.vue` 顶部加 Banner: "此页面为历史兼容字段, 新工厂请使用 BOM 成本管理"

### 5.8 Migration plan

路径 A: 无迁移。
路径 B:
1. F006 数据稽查: 同时有 BOM + RPF 的产品, 验证两者一致
2. 灰度: F006 启用 BomItem-based expandBOM, 老工厂走旧 RPF
3. feature flag `BOM_EXPANSION_USE_BOM_ITEMS` (默认 false)

### 5.9 Effort estimate

| 路径 | 估时 |
|---|---|
| A (仅文档) | **0.5d** |
| B (改 service + 灰度) | **2-3d** |

### 5.10 Dependencies

⚠️ **关键 Steve 决策**: A or B?

### 5.11 Sister-chat dispatch plan

- **Ready**: ✅ yes (A) / ⚠️ partial (B 需 Steve sign-off)
- **Recommended dispatch**: 先做 A (0.5d), B 单独 spec + 单独 PR

---

## 6. D5 — 销售订单流转 (工厂不发货, 总仓销售)

### 6.1 Decision text

> 是啊所以就是总仓调到 ⋯ 总仓把东西发送到仓库不工厂, 然后生产出来, 然后再调回一个总仓进行销售啊, 进行就是售卖。

> [客户原话最后段]: 我现在模拟一下就是说我们爆工 [报工] 包完以后, 库存已经调播调回去总仓, 那么设计到一个销售出库的一个环节了 ⋯ 销售管理这边然后销售管理成品库存这有一个 ⋯ 哎没库存 ⋯ 你后台的好新店吗我让他建稍等一下, 你要不建一个成品库存吗。

(transcript line 41-43)

### 6.2 客户 + Steve 决策理由

- **客户业务模型**:
  - 销售订单的发货主体是**总仓**, 不是工厂
  - 工厂 (线边仓) 只对总仓发货, 不直接对客户发货
- **关键含义**:
  - SalesOrder 的库存匹配应该查**总仓 (WH-LOG) 的 FinishedGoodsBatch**, 不是工厂仓
  - 当前 `InventoryMatchingService.checkAvailability()` 按 `factoryId + productTypeId` 查批次, 没有 warehouse 维度 → 工厂仓 + 总仓库存被合并 → 与客户业务模型不一致
- **客户原话佐证**: "销售管理成品库存这有一个 ⋯ 哎没库存" — 客户在销售管理页面找成品库存, 找不到 → 系统应该走总仓库存

### 6.3 Current state

| 位置 | 状态 | 引用 |
|---|---|---|
| `InventoryMatchingService.checkAvailability()` | ⚠️ 按 `factoryId + productTypeId` 查 batch, 无 warehouse 维度 | `InventoryMatchingService.java:67-69` |
| `FinishedGoodsBatchRepository.sumAvailableQuantityByProductType()` | ⚠️ 同上 | `FinishedGoodsBatchRepository.java` |
| `SalesOrder.factoryId` | ✅ 字段存在 | `SalesOrder.java:67` |
| 销售出库 → 哪个仓出货 | ❌ 无明确定义, 默认走"factoryId 下所有 batch" | (业务逻辑分散) |

### 6.4 Spec impact

- **新建** `docs/superpowers/specs/2026-05-10-d5-sales-from-hq-warehouse-design.md` (~200 LOC)
  - §1 业务模型: 销售订单 → 总仓 (WH-LOG) 库存 → 客户; 工厂仓 (WH-WKS) 不对客户发货
  - §2 数据模型修改: `FinishedGoodsBatch.warehouse_id` 字段 (D1 已加), 销售库存查询固定走 `warehouse_id = WH-LOG`
  - §3 边界: 历史数据 (无 warehouse_id) 视为 WH-LOG (兼容)
  - §4 边界: 跨工厂销售场景? (transcript 没提, 默认单工厂内总仓销售)
  - §5 与 D1 协同: D1 反向调拨完成后 batch.warehouse_id = WH-LOG → 销售自动可见

### 6.5 Code impact

| 模块 | 文件 | 改动 |
|---|---|---|
| Service | `InventoryMatchingService.checkAvailability()` | 加 warehouse 过滤: `findByWarehouseTypeAndProductType(factoryId, 'LOGISTICS', productTypeId)` |
| Repository | `FinishedGoodsBatchRepository` | 加 `sumAvailableByWarehouseAndProductType()` |
| Service | `SalesServiceImpl` | 销售出库扣减时, 只扣 WH-LOG 批次 |
| Service | `InventoryMatchingService.reserveStock()` | 同上 |
| Frontend | `web-admin/src/views/sales/orders/*.vue` | 库存预览只显示总仓库存 |

### 6.6 Schema impact

无 (依赖 D1 的 `warehouse_id` 字段)。

### 6.7 Frontend impact

- 销售订单创建 dialog "可用库存"列固定显示总仓库存
- 加 hint: "销售订单库存来自总仓 (WH-LOG); 工厂仓库存不参与销售匹配"

### 6.8 Migration plan

1. D1 land 后, 数据回填: `UPDATE finished_goods_batches SET warehouse_id = (SELECT id FROM factory_warehouses WHERE code = 'WH-LOG' AND factory_id = ...);` (D1 已做)
2. 启用 InventoryMatchingService 新逻辑 — feature flag `SALES_USE_LOGISTICS_WAREHOUSE_ONLY` (default false)
3. F006 灰度
4. 1 周后全工厂启用

### 6.9 Effort estimate

| 任务 | 估时 |
|---|---|
| Spec 写作 + Steve review | 0.5d |
| Service + Repository 改动 | 1d |
| Frontend 提示 + 显示 | 0.5d |
| 灰度 feature flag + smoke + PR | 0.5d |
| **合计** | **2-3d** |

### 6.10 Dependencies

- ⚠️ **Blocked on D1**: 必须先有 `FinishedGoodsBatch.warehouse_id` 字段
- D1 land 后, D5 自然 unblock

### 6.11 Sister-chat dispatch plan

- **Ready**: ⚠️ blocked on D1
- **Prerequisite**: D1 service 层 + schema 已 ship
- **Recommended dispatch**: D1 PR merge 后立即 dispatch

---

## 7. 推荐 Dispatch 顺序

### 7.1 Phase 1 (Quick wins, 1-2 days, parallelizable)

| # | 任务 | Effort | Owner |
|---|---|---|---|
| P1.1 | D4 RPF 文档化 (路径 A) — 单独 PR | 0.5d | Sister chat A |
| P1.2 | D2 + D3 合并 PR: BOM 算法实时预览 + g/kg 换算 | 2.5d | Sister chat B |
| P1.3 | B1 工序未关联修复 (transcript A1) — 并行 | 1d | Sister chat C |

P1 完成后客户立刻能用 BOM 配方算法 + 单位换算 + 工序选择, **不依赖** D1/D5。

### 7.2 Phase 2 (D1, 3-4 days, 必须先于 D5)

| # | 任务 | Effort | Owner |
|---|---|---|---|
| P2.1 | D1 spec writing + Steve sign-off ADR 推翻 | 0.5d | Organizer + Steve |
| P2.2 | D1 schema migration (V20260510_01-03) | 0.5d | Sister chat D |
| P2.3 | D1 Service (ReverseTransferService 自动触发) | 1d | Sister chat D |
| P2.4 | D1 Controller (B9 手动新建调拨) | 0.5d | Sister chat D |
| P2.5 | D1 Frontend (warehouse-stock 页 + transfer 双仓 UI) | 1d | Sister chat D |
| P2.6 | D1 Smoke + PR + 灰度 F006 | 0.5d | Sister chat D |

### 7.3 Phase 3 (D5 + B2/B4/B5, 2-3 days, 解锁完整销售链)

| # | 任务 | Effort | Owner |
|---|---|---|---|
| P3.1 | D5 spec | 0.5d | Sister chat E |
| P3.2 | D5 service + repository + frontend | 2d | Sister chat E |
| P3.3 | B2 调拨手动选批次 (与 D5 同 PR, 都触及 transfer/sales 库存) | (already in 2d 内) | Sister chat E |
| P3.4 | B4 调拨单加"现有库存"列 + B3 库存校验 | 1d | Sister chat F |
| P3.5 | B5 分仓库存查询页 (D1 已有, 此处验证) | 0.5d | Sister chat F |

---

## 8. 待 Steve sign-off 项目

### 8.1 ADR 推翻

- ⚠️ **D1 触及**: V3 P0-5 "MaterialBatch 不加 warehouseId" ADR (`2026-04-11-v1-e2e-framework-redesign.md` G3 链注释 + `V20260411_03__factory_warehouses.sql:1-7`) 必须明确推翻
- 推荐: Steve 在 D1 spec PR 上 approve, 同时更新原 ADR

### 8.2 D4 路径选择

- ⚠️ **D4 路径 A vs B**: 客户决策仅说"保留不删", 但 `BomExpansionService` 当前用 RPF 不用 BomItem
- 推荐: Steve 决定 A (仅文档) 或 B (改 service); 推荐 B 因为客户期望 BOM 页面录入被生产计划使用
- 时间影响: A = 0.5d, B = 额外 2-3d

### 8.3 D1 反向调拨触发时机

- 客户原话: "我们爆工 [报工] 包完以后, 库存已经调播调回去总仓" (transcript line 43)
- 含义: 报工 COMPLETED 即自动反向调拨? 还是用户手动触发?
- 推荐: **自动生成草稿态 BRANCH_TO_HQ 调拨单, 用户确认后提交** (兼顾自动化 + 用户控制)
- 待 Steve 确认

### 8.4 D3 历史数据迁移

- 推荐: lazy migration (客户测试中遇到时手动调整 unit), **不主动批量回填**
- 待 Steve 确认是否启用 cron job 自动回填

### 8.5 D5 跨工厂销售场景

- transcript 未涉及客户是否有跨工厂销售场景 (F001 工厂 SO 用 F002 库存?)
- 默认假设: 单工厂内总仓销售 (factoryId 一致)
- 待 Steve 确认是否支持跨工厂

---

## 9. 与现有 spec 的冲突 / 一致性

### 9.1 冲突: V3 P0-5 ADR (D1 触发)

- **冲突点**: `V20260411_03__factory_warehouses.sql:5-7` 注释 "当前不参与 stock query, MaterialBatch 无 warehouseId 字段, 见 P0-5 B2 ADR"
- **D1 决策**: 必须推翻该 ADR (加 warehouse_id 到 MaterialBatch + FinishedGoodsBatch)
- **解决**: D1 spec §3 显式 ADR-revise, 引用客户业务需求作为推翻依据

### 9.2 隐藏分歧: BomExpansionService 用 RPF, BomServiceImpl 用 BomItem (D4 暴露)

- **冲突点**: `BomExpansionService.java:54` 读 `material_product_conversions`; `BomServiceImpl` 读 `bom_items`
- **客户期望**: BOM 页面录入应该被生产计划用
- **解决**: D4 路径 B (Steve sign-off 决定)

### 9.3 一致性: factory_warehouses 双仓 seed (D1 复用)

- **一致点**: `V20260411_03__factory_warehouses.sql:33-61` 已 seed WH-LOG + WH-WKS, 完全符合 D1 客户需求
- **解决**: D1 实施直接复用, 无需新建 seed

### 9.4 一致性: UnitOfMeasurement 换算系数 (D3 复用)

- **一致点**: `UnitOfMeasurement.java:84-86` 已有 g 系数 0.001 + kg 系数 1.0, `toBaseUnit() / fromBaseUnit()` 双向方法
- **解决**: D3 实施直接复用, 仅 wire-up

---

## 10. Open questions for Steve

1. ⚠️ **D1**: V3 P0-5 ADR 推翻 ok? 推荐: yes, 客户业务需求明确要求
2. ⚠️ **D4**: 路径 A (仅文档, 0.5d) or B (改 BomExpansionService 读 BomItem, 2-3d)? 推荐: B
3. ⚠️ **D1**: 反向调拨自动触发还是手动? 推荐: 报工完成自动生成草稿 + 用户确认提交
4. ⚠️ **D3**: BOM 历史数据 lazy or eager migration? 推荐: lazy
5. ⚠️ **D5**: 跨工厂销售场景支持? 推荐: 默认单工厂, 跨工厂另开 spec
6. ⚠️ **B1 优先级**: A1 工序未关联是 P0 (transcript 明确阻塞客户测试), 是否优先于 D2/D3 dispatch? 推荐: yes
7. ⚠️ **F006 admin 账号登录问题**: transcript line 37 客户提到登录不进去, 是否与 T6.4 cascade 切到 Python 有关? 推荐: 同步排查 (与本 doc 无关, 独立 ticket)

---

## 11. Action Items (本 doc 范围之外, 但 transcript 提到)

非本 plan doc 范围, 列在此处方便 cross-reference (详见 transcript line 80-92):

| # | 内容 | 优先级 | 触及 D? |
|---|---|---|---|
| A1 | B1 工序未关联修复 | P0 | 无 (独立) |
| A2 | B2 调拨/出库批次手选 | P0 | 间接 D1 |
| A3 | B3 生产计划开始按钮库存校验 | P1 | 无 |
| A4 | B4 调拨单加"现有库存"列 | P1 | 无 |
| A5 | B5 分仓库存查询页 | P1 | **D1** |
| A6 | B6 App 报工审批加载失败 | P0 | 无 (与 T6.4 cascade 相关?) |
| A7 | B7 销售订单弹窗太小 | P2 | 无 |
| A8 | B8 关联原料下拉 | P1 | 无 |
| A9 | B9 手动新建调拨单 | P2 | **D1** |
| A10 | D1 BOM g→kg 自动换算 | P0 | **D3** |

---

## 12. References

- Transcript: `.tmp-transcripts/2026-05-10-customer-meeting.md` (1016 SRT 段, 56 分钟)
- BOM entity: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/bom/BomItem.java:29-144`
- RPF entity: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialProductConversion.java:34-164`
- 双仓 migration: `backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__factory_warehouses.sql:1-61`
- Transfer entity: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/inventory/InternalTransfer.java:50-166`
- Transfer service: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/TransferServiceImpl.java:359-386`
- BOM expansion service: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/BomExpansionService.java:51-176`
- Production orchestrator: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/ProductionWorkflowOrchestrator.java:55-138`
- Inventory matching: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/InventoryMatchingService.java:52-93`
- BOM Vue view: `web-admin/src/views/production/bom/index.vue:715-905`
- 转换率 Vue view: `web-admin/src/views/production/conversions/index.vue` (391 LOC)
- UnitOfMeasurement: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/UnitOfMeasurement.java:36-164`
- E2E framework spec: `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md` (G3 链 line 28, 双仓 line 119, 217)
