# ADR — 不做 MaterialBatch.warehouseId 维度重构 (P0-5 "B2" 澄清)

**日期**: 2026-04-11
**状态**: ❌ **Rejected / Deferred** — 此 ADR 记录"不做"的决定
**关联**: P0-5 FactoryMaterialRequisition (V3 六扇门客户), commit `dfae273fd` (B1 InternalTransfer 记账)

---

## 🔍 背景

Apr 7 六扇门客户会议后, P0-5 "物料需求单 + 双仓制" 落地第一阶段 (B1) commit `dfae273fd` 实现了:

- `FactoryMaterialRequisition` entity + state machine
- `transferToFactory` / `close` 调用 `TransferService.createTransfer` 生成 InternalTransfer **流水记账单**
- `InternalTransfer` entity 加 `sourceWarehouseId` / `targetWarehouseId` 字段
- FMR entity 加 `outboundTransferId` / `returnTransferId` 关联

B1 留下 **"B2: MaterialBatch.warehouseId 真实更新"** 作为 TODO, memory 记录为"技术债"。

Apr 11 继续修复 session 里尝试评估 B2 时做了 discovery: **`MaterialBatch` 从未有 `warehouseId` 字段**。

---

## 🎯 Discovery 发现

### Grep 证据

`backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialBatch.java`:

- 零处 `warehouse_id` / `warehouseId` (文件内 grep 无命中)
- 字段列表: factoryId / batchNumber / materialTypeId / supplierId / inboundDate / productionDate / purchaseDate / expireDate / receiptQuantity / usedQuantity / reservedQuantity / status / unitPrice / ... (全部按 factory 维度)
- Index: `idx_batch_factory`, `idx_batch_status`, `idx_batch_expire`, `idx_batch_material` — **无 warehouse index**

### Repository 查询证据

`MaterialBatchRepository.java` L161-167:

```java
@Query("SELECT m FROM MaterialBatch m WHERE m.factoryId = :factoryId " +
       "AND m.materialTypeId = :materialTypeId " +
       "AND m.status = 'AVAILABLE' " +
       "AND (m.receiptQuantity - m.usedQuantity - m.reservedQuantity) > 0 " +
       "ORDER BY m.expireDate ASC NULLS LAST, m.receiptDate ASC, m.id ASC")
List<MaterialBatch> findAvailableBatchesFEFO(@Param("factoryId") String factoryId,
                                              @Param("materialTypeId") String materialTypeId);
```

**FEFO 按 factory + material 过滤, 无 warehouse 维度**。

其他关键查询同样无 warehouse:
- `calculateInventoryValue(factoryId)` — 工厂级库存总值
- `sumQuantityByMaterialType(factoryId)` — 按材料类型统计
- `findExpiringBatches(factoryId, warningDate)`

### 结论

**系统从设计之初就没有 warehouse 粒度库存管理。** 这不是遗漏或 bug,是**架构层面的简化** — 所有库存以 factory 为最小单位。

---

## 💡 "B2" 的真实意义

之前的 "B2: MaterialBatch.warehouseId 真实更新" 描述**误导性** — 暗示这是一个"字段更新"的技术债,实际上是一个**库存架构重构 epic**。

**真实的 B2 = 引入 warehouse 维度库存管理**,完整 scope 如下:

### 1. Entity 层 (~1 周)
- `MaterialBatch` 加 `warehouseId` 字段 (nullable 兼容旧数据) + index
- `MaterialBatch` 加 `parentBatchId` + `splitVersion` 追溯 split lineage (可选)
- `FinishedGoodsBatch` 同样加 `warehouseId`
- 其他批次类 (e.g. `SalesDeliveryItemBatchAllocation`) review 是否需要 warehouse

### 2. Repository 层 (~3-5 天)
- `findAvailableBatchesFEFO` 改成 `(factoryId, materialTypeId, warehouseId)` 签名
- `calculateInventoryValue` 改成按 warehouse 聚合
- `sumQuantityByMaterialType` 加 warehouse dimension
- `findByFactoryIdAndMaterialTypeId` 同上
- 全 repository `@Query` 加 warehouse 过滤

### 3. Service 层 (~3-5 天)
- 所有 stock query 支持 warehouse 过滤 (可选参数保持向后兼容)
- `MaterialBatchService.pick()` 按 warehouse 锁定
- `confirmPicking` 在 FMR 里改用按 warehouse FEFO
- `transferToFactory` 真实 split batch (创建 child batch at target warehouse, 扣减 parent)
- `close` 反向 split (从 target 退料 → source)

### 4. Stock query + Report (~3-5 天)
Grep `materialBatchRepository.` 命中 **29 个文件**,都需要 review 是否需要按 warehouse 展示:

- `ProductionReportServiceImpl` — 生产报表
- `DashboardStatisticsServiceImpl` — 仪表板统计
- `BatchConsumptionServiceImpl` — 批次消耗
- `TraceabilityServiceImpl` — 溯源
- `InventoryHealthAnalysisServiceImpl` — SmartBI 库存健康
- `ProcurementAnalysisServiceImpl` — SmartBI 采购分析
- `RestaurantWastage*` tools × 3 — 餐饮损耗
- `RestaurantIngredient*` tools × 5 — 餐饮食材
- `ReportInventoryTool` / `ReportExportService` — 库存报表/导出
- ... 其他

### 5. UI 层 (~1 周)
- 所有库存展示页加 warehouse 选择器
- 采购入库、销售出库、调拨单 UI 按 warehouse 录入
- BOM 展开按 warehouse 查可用物料
- Factory settings 管理 warehouse 清单 (Warehouse entity 可能需要补齐)

### 6. 数据迁移 (~2-3 天)
- 已有 batch 需要赋默认 warehouseId (可用 factory 的 "default warehouse"; 但 factory 现在无 default warehouse 概念,需先建)
- 历史 InternalTransfer 的 warehouse 字段回填 (新字段 B1 已加但 null)
- 历史 Report/KPI 可能需要 re-aggregate

### 7. 回归测试 (~1 周)
- 所有 stock query endpoint 按 warehouse 维度重测
- FEFO pick 正确性验证 (跨 warehouse 不混)
- 所有 SmartBI 报表数值 sanity check (和旧版差异原因说清楚)
- Report 导出格式兼容性

### 总工时估算

**~3-4 周专职开发 + 1 周回归** = 4-5 周。团队 1-2 人。

---

## ❌ Decision: 不做 (Reject)

### 理由

#### 1. 客户 v3 P0-5 不要求 warehouse 维度

v3 §4.1 P0-5 原文: "物料需求单实体 (G3) — 新建 `MaterialRequisition`",仅要求**实体 + CRUD**。客户原话 (会议 3128-3252s) 只描述了业务流程 "需求单 → 备料 → 调拨 → 报工 → 退料",没要求系统区分"物流仓"和"工厂鲜棉仓"的实际库存位置 — 客户要的是**流程可追溯**,不是**物理位置管理**。

#### 2. B1 (commit `dfae273fd`) 已满足客户可见需求

- `InternalTransfer` 流水单记录每次"备料调出 / 退料调入"
- FMR 关联 `outboundTransferId` / `returnTransferId` 提供 end-to-end 追溯
- 客户演示时看到 "这个物料需求单生成了 2 张调拨单,流水可追" 即可
- **批次的真实物理位置** 在当前 1 工厂单客户场景下无业务价值 (六扇门目前 1 个工厂,即使分"物流仓"和"工厂仓"也是逻辑划分)

#### 3. 架构改动的 ROI 不成立

- 4-5 周工时 + 1-2 人 + 回归风险
- 当前 1 个客户 (六扇门) 没提此需求
- 29 个文件需要 review,其中 5 个是 SmartBI 报表,改动涉及数据口径变化,可能需要对齐历史报表
- 数据迁移 + "default warehouse" 概念引入是非 trivial 的

#### 4. v3 文档里降级的部分

v3 §4.4 P2 把 "采购/人事/财务" 降级,客户原话 5049s "这一部分不特别紧急"。warehouse 维度库存管理属于**仓储精细化**,本质上是 P2+ 功能,不在 v1.0 范围。

#### 5. "FEFO + factory level" 对食品行业足够合规

食品行业合规核心是 **先进先出 + 批次追溯**,FEFO + 单一 factory 维度已满足这两点。Warehouse 划分是**运营精细化**,不是合规硬要求。

---

## ✅ B1 已覆盖的追溯性

B1 (commit `dfae273fd`) 让客户看到这些:

| 客户问 | 系统答 |
|---|---|
| "这批物料从哪来?" | FMR.requisitionNo + FMR.sourceWarehouseId |
| "从哪调到哪?" | InternalTransfer.sourceWarehouseId → targetWarehouseId (B1 加) |
| "退料退回哪?" | FMR.returnTransferId → 反向 InternalTransfer |
| "谁领的?" | FMR.pickedBy + pickedAt |
| "谁签收?" | FMR.receivedBy + receivedAt |
| "谁关单?" | FMR.closedBy + closedAt |
| "消耗多少?退多少?" | FMR items: pickedQty / issuedQty / consumedQty / returnedQty |

**这就是客户原话"物料需求单 → 备料 → 调拨 → 报工 → 退料"的全程追溯。** 批次是否真的在 物理"工厂鲜棉仓" vs "物流仓" 对客户 不 visible。

---

## 🔮 触发条件 (什么时候启动 warehouse epic)

将来满足以下 **任一** 条件时重启评估:

1. **2+ 客户** 同时要求 multi-warehouse 精细化库存 (当前仅六扇门, 且未要求)
2. 某个客户有 **跨工厂总部-分厂调拨** 场景 (当前 InternalTransfer 有 source/target factoryId 基础, 扩展到 warehouse 是增量)
3. **SmartBI 报表** 需要按 warehouse 维度生成 (当前无此报表需求)
4. **合规要求** 某产品必须独立 warehouse 存储 (e.g. 冷链食品强制独立区域管理, 需核对食品安全法规)
5. **实际业务痛点**: 客户反馈"查库存只看到总数, 不知道哪个车间有货, 现场找料浪费时间"

### 如果触发,启动路径:

1. **Spike 3-5 天**: Proof of concept — 单一 table (MaterialBatch) 加 warehouseId + FEFO 改造
2. **可行后**: 全 epic 4-5 周 (参考本 ADR §B2 scope)
3. **不可行**: 换方案 — 可能引入 `WarehouseStock` 独立 aggregate entity, 不动 MaterialBatch

---

## 📝 关于之前 memory 里的 "B2 TODO"

memory `project_apr7_session_summary.md` 和后续提及的 "InventoryTransfer 双向真实集成 (备料调出 + 退料调入)" **容易被误解为** "MaterialBatch.warehouseId 要真实更新"。澄清:

- **正确理解**: memory 的 TODO 指的是 **InternalTransfer 流水单的生成**, B1 (commit `dfae273fd`) 已完成
- **错误理解**: 把它当成 "batch 位置物理流动",这是本 ADR 纠正的误解
- **memory 建议更新**: 把 "B2 = warehouse epic, rejected per ADR" 作为 clarification 记录

---

## 🔗 参考

- **Commit**: `dfae273fd` (B1 FMR ↔ InternalTransfer 记账)
- **Entity**: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/MaterialBatch.java` (无 warehouseId 确认)
- **Repository**: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/MaterialBatchRepository.java` L161-167 (FEFO 无 warehouse)
- **v3 文档**: `docs/plans/customer-meeting-apr7-requirements-v3.md` §4.1 P0-5
- **Test**: `FactoryMaterialRequisitionTransferIntegrationTest` 3 场景 (Mockito 验证流水生成)

---

**本 ADR 目的**: 把一个模糊的 "technical debt" 澄清为 "不该做的 feature",避免未来 session 重复评估浪费时间。
