# D1 双仓流转 — Spec Amendment (推翻 V3 P0-5 B2 "Rejected" ADR)

**Decision date**: 2026-05-10 customer meeting + Steve sign-off PR #309 (A1 = A)
**Branch**: `ops-a1-d1-spec-amend`
**Status**: Draft — for spec sign-off before Phase 4 schema impl dispatch
**Supersedes**:
- `docs/plans/p0-5-b2-warehouse-dimension-adr.md` (2026-04-11 "Rejected / Deferred" — 整个 ADR 被推翻)
- `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md` §9 line 392: "P0-5 B2 warehouse dimension — ADR Rejected, 整个特性不存在"
- `backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__factory_warehouses.sql:1-7` 头注释 ("仅为 FMR.sourceWarehouseId / targetWarehouseId 提供 reference data. 当前不参与 stock query")

**Related**:
- `docs/superpowers/specs/2026-05-10-customer-meeting-design-decisions-impl-plan.md` §2 (D1 reference design — 本 amendment 是 D1 的 schema 决策细化)
- PR #309 Steve sign-off (A1 = A, 完整 +warehouse_id 路径)

---

## 0. TL;DR

V3 P0-5 ADR (2026-04-11) 当时基于"客户六扇门未明确要求 warehouse 维度"决定**不给 MaterialBatch 加 warehouseId**。2026-05-10 F006 客户会议 (transcript line 39-41) 客户明确描述了**双仓业务模型**:

- 工厂 = 线边仓 (WH-WKS), 当天清空, 不持久库存
- 总仓 = 物流仓 (WH-LOG), 持久库存, 是销售/调拨基础
- 工厂不直接对客户发货, 产成品 + 偏差余料 → 总仓 → 销售

ADR §174 "触发条件"列出的 case #5 "实际业务痛点" 已被客户明确表达, ADR 触发条件满足. PR #309 Steve sign-off A1 = A 选择**完整 +warehouse_id 路径**, 推翻原 ADR.

**核心 schema 变更**: 给 `material_batches` + `finished_goods_batches` 加 `warehouse_id` 字段, FK 到 `factory_warehouses(factory_id, code)` (复合 UK).

**Cascade**: 解锁 4 个 PR #309 sign-off items (A3 反向调拨 / A5 销售从 WH-LOG 出 / B1 SHIP 阶段批次选择 / B2 分仓查询页).

**Impl effort**: ~3.5-4d (本 spec 不含 impl, 仅决策 + scope 锁定).

---

## 1. 业务模型 (客户原话)

### 1.1 客户描述 (2026-05-10 transcript line 39-41)

> 这个线边仓的原则就是当天生产完结束以后是没有库存的. 原料会全部生产完, 我领了多少料我生产多少料, 生产结束了我用的料就结束了, 那我所有的库存就没有了. 那我生效的是我的成品库存, 我的成品库存我会调拨给那个总仓去, 然后因为仓库所有的仓库是那个总仓的仓库. 把你我的线边仓是我今天要生产所以有些临时库存.
>
> 那个工厂是不发货的 ⋯ 是这样子, 你工厂他其实是调拨到那个总仓去的, 总仓在会去安排什么时候发给那个客户.

### 1.2 业务实质

| 实体 | 客户名 | 标准名 | type 值 | 持久性 |
|---|---|---|---|---|
| 物流仓 / 总仓 | 总仓 | LOGISTICS warehouse | `LOGISTICS` | 持久库存 |
| 线边仓 / 鲜棉仓 / 车间仓 / 工厂仓 | 线边仓 | WORKSHOP warehouse | `WORKSHOP` | 当天清空 |

### 1.3 业务流程

```
1. 销售订单 (从 WH-LOG 减库存)
   ↓
2. 生产计划 → 调拨单 (WH-LOG → WH-WKS, transferType=HQ_TO_BRANCH)
   ↓
3. 报工 (WH-WKS 原料消耗, 成品入 WH-WKS)
   ↓
4. 收工/反向调拨 (WH-WKS → WH-LOG, transferType=BRANCH_TO_HQ)
   ├─ 成品全部回 WH-LOG (后续销售从 WH-LOG 出货)
   └─ 偏差余料 (原料 leftover) 也回 WH-LOG
   ↓
5. 销售发货 (从 WH-LOG 减库存, 工厂不参与发货)
```

### 1.4 关键不变量

- WH-WKS 在 day-end (cron 23:50) 应该 = 0 库存 — 残留视为告警
- 所有跨工厂销售/调拨基础 = WH-LOG (工厂之间不直连发货, 全经 HQ logistics)
- 同一 batch_number 在生命周期内会经过 WH-LOG → WH-WKS → WH-LOG (split lineage 不在本 spec scope, P2 跟进)

---

## 2. 推翻 ADR 的依据

### 2.1 原 ADR §174 "触发条件" 列举的 5 个 case

ADR 原文 `docs/plans/p0-5-b2-warehouse-dimension-adr.md:174-182`:

> 将来满足以下 **任一** 条件时重启评估:
> 1. **2+ 客户** 同时要求 multi-warehouse 精细化库存
> 2. 某个客户有 **跨工厂总部-分厂调拨** 场景
> 3. **SmartBI 报表** 需要按 warehouse 维度生成
> 4. **合规要求** 某产品必须独立 warehouse 存储
> 5. **实际业务痛点**: 客户反馈"查库存只看到总数, 不知道哪个车间有货, 现场找料浪费时间"

### 2.2 2026-05-10 F006 (登录账号 `f006_admin`) 触发了 case 5

客户透过 transcript line 39-41 明确表达了:

- 工厂日间生产链路必须分仓 (WH-WKS 临时 vs WH-LOG 持久) — case 5 直接 hit
- 销售流程要求工厂不直接发货, WH-LOG 才是出货起点 — case 5 升级 (不仅是 "现场找料浪费时间", 而是 "业务模型本身需要")
- B5 客户要求加分仓库存查询页 (transcript line 31-33 推断) — case 3 部分 hit

### 2.3 PR #309 Steve sign-off

Steve 在 PR #309 选择 **A1 = A** (完整 +warehouse_id 路径). 其他 schema-only 替代 (B/C) 都被 reject. 此 amendment 是 Steve 决策的 spec 化.

---

## 3. Schema changes

### 3.1 Migration V20260510_01__add_warehouse_id_to_material_batch.sql

```sql
-- Add warehouse_id to material_batches
ALTER TABLE material_batches ADD COLUMN warehouse_id VARCHAR(64);

-- Backfill: 所有现有 batch 默认归 WH-LOG (物流仓)
-- 该 ID 是 factory_warehouses 表里的 PRIMARY KEY (UUID), 不是 code 字符串
UPDATE material_batches mb
   SET warehouse_id = (
       SELECT fw.id FROM factory_warehouses fw
        WHERE fw.factory_id = mb.factory_id AND fw.code = 'WH-LOG' LIMIT 1
   )
 WHERE mb.warehouse_id IS NULL;

-- 保护: 无 WH-LOG seed 的工厂会出现 NULL — 在 NOT NULL 前先 verify
DO $$
DECLARE missing_count INT;
BEGIN
    SELECT COUNT(*) INTO missing_count FROM material_batches WHERE warehouse_id IS NULL;
    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration aborted: % material_batches rows have NULL warehouse_id (factory missing WH-LOG seed)', missing_count;
    END IF;
END $$;

ALTER TABLE material_batches ALTER COLUMN warehouse_id SET NOT NULL;

-- FK 到 factory_warehouses.id (PK, UUID) — 不是 (factory_id, code) 复合 UK
-- 理由: factory_warehouses 已有 uk_fw_factory_code 但 id 是 PK, FK 应指向 PK
ALTER TABLE material_batches ADD CONSTRAINT fk_material_batch_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES factory_warehouses(id);

CREATE INDEX idx_material_batch_warehouse ON material_batches(factory_id, warehouse_id);
COMMENT ON COLUMN material_batches.warehouse_id IS 'FK to factory_warehouses.id. 客户 D1 双仓流转 (2026-05-10).';
```

### 3.2 Migration V20260510_02__add_warehouse_id_to_finished_goods_batch.sql

```sql
ALTER TABLE finished_goods_batches ADD COLUMN warehouse_id VARCHAR(64);

-- Backfill: 成品批次默认归 WH-WKS (车间仓), 反映报工产出落在车间仓
-- (与 MaterialBatch 默认 WH-LOG 不同 — 因为成品诞生于生产, 在反向调拨前应在车间)
UPDATE finished_goods_batches fgb
   SET warehouse_id = (
       SELECT fw.id FROM factory_warehouses fw
        WHERE fw.factory_id = fgb.factory_id AND fw.code = 'WH-WKS' LIMIT 1
   )
 WHERE fgb.warehouse_id IS NULL;

DO $$
DECLARE missing_count INT;
BEGIN
    SELECT COUNT(*) INTO missing_count FROM finished_goods_batches WHERE warehouse_id IS NULL;
    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration aborted: % finished_goods_batches rows have NULL warehouse_id', missing_count;
    END IF;
END $$;

ALTER TABLE finished_goods_batches ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE finished_goods_batches ADD CONSTRAINT fk_finished_batch_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES factory_warehouses(id);
CREATE INDEX idx_finished_batch_warehouse ON finished_goods_batches(factory_id, warehouse_id);
COMMENT ON COLUMN finished_goods_batches.warehouse_id IS 'FK to factory_warehouses.id. 客户 D1 双仓流转 (2026-05-10).';
```

### 3.3 设计要点

| 决策点 | 选项 | 决定 | 理由 |
|---|---|---|---|
| FK target | (a) `factory_warehouses.id` (PK) (b) `(factory_id, code)` 复合 UK | **a** | factory_warehouses 已有 `id VARCHAR(64) PRIMARY KEY` (V20260411_03:9-10). FK 应指向 PK, 不指向 UK. 复合 FK 维护成本高. |
| 默认值 (MaterialBatch) | (a) WH-LOG (b) WH-WKS (c) factory's first warehouse | **a** | 原料默认在物流仓持久库存, 调拨进车间才到 WH-WKS. |
| 默认值 (FinishedGoodsBatch) | (a) WH-LOG (b) WH-WKS | **b** | 成品诞生于生产, 在反向调拨前在车间仓. 反向调拨后才到 WH-LOG. |
| Nullable | (a) NOT NULL after backfill (b) Nullable | **a** | 业务模型要求 batch 必属于一个 warehouse. nullable 等于回到现状, 没意义. |
| Backfill abort | (a) RAISE EXCEPTION if NULL (b) 默认 0 strict | **a** | 防御性 — 若有 factory 缺 WH-LOG seed (V20260411_03 seed 用 INSERT...WHERE NOT EXISTS, 应该都有, 但防御性 abort 是 cheap insurance). |

### 3.4 Rollback path

```sql
-- 反向 (按需用):
ALTER TABLE material_batches DROP CONSTRAINT fk_material_batch_warehouse;
DROP INDEX idx_material_batch_warehouse;
ALTER TABLE material_batches DROP COLUMN warehouse_id;
-- (同样 finished_goods_batches)
```

⚠️ 注意: rollback 前必须先 revert 应用代码 — 应用已依赖 warehouse_id 字段时直接 drop column 会导致 NPE / SQL error.

---

## 4. Entity changes

### 4.1 MaterialBatch.java

```java
// 新增字段 (放在 expireDate 后, 现有字段保持不动):
@Column(name = "warehouse_id", nullable = false, length = 64)
private String warehouseId;
```

新增 `@Index(name = "idx_batch_warehouse", columnList = "factory_id, warehouse_id")` 到 `@Table` indexes 数组.

### 4.2 FinishedGoodsBatch.java

```java
@NotBlank
@Column(name = "warehouse_id", nullable = false, length = 64)
private String warehouseId;
```

新增 `@Index(name = "idx_fgb_warehouse", columnList = "factory_id, warehouse_id")` 到 `@Table` indexes 数组.

### 4.3 关联 entity (可选 P2)

`FactoryWarehouse` entity 可以加 `@OneToMany` 反向关联到 `MaterialBatch` / `FinishedGoodsBatch`, 但**本 spec 不要求** (lazy load, 实际不太用得到).

---

## 5. Query updates (~20 sites)

以下是必须支持 warehouse_id 过滤的 repository / service 方法. **签名变更策略**: 加 nullable `warehouseId` 参数, null = 全 warehouse (backward compat); non-null = 单 warehouse.

### 5.1 MaterialBatchRepository (8 sites)

`backend/java/cretas-api/src/main/java/com/cretas/aims/repository/MaterialBatchRepository.java`:

| Line | Method | 改动 |
|---|---|---|
| 156-157 | `findAvailableBatchesFIFO(factoryId, materialTypeId)` | 加 `warehouseId` 参数 (nullable); SQL: `AND (:warehouseId IS NULL OR m.warehouseId = :warehouseId)` |
| 167-168 | `findAvailableBatchesFEFO(factoryId, materialTypeId)` | 同上 |
| 176-177 | `findExpiringBatches(factoryId, warningDate)` | 同上 |
| 197 | `calculateInventoryValue(factoryId)` | 同上 (按 warehouse 聚合) |
| 205 | `sumQuantityByMaterialType(factoryId)` | 改 SELECT 加 `m.warehouseId` GROUP BY |
| 217-219 | `sumAvailableQuantityByMaterialType(factoryId, materialTypeId)` | 加 `warehouseId` 参数 |
| 263 | `findByFactoryIdAndMaterialTypeId(factoryId, materialTypeId)` | 加 重载方法 `findByFactoryIdAndMaterialTypeIdAndWarehouseId(...)` |
| 282-284 | `findAvailableBatchesFIFOByStatus(factoryId, materialTypeId, status)` | 加 `warehouseId` 参数 |

### 5.2 FinishedGoodsBatchRepository (3 sites)

`backend/java/cretas-api/src/main/java/com/cretas/aims/repository/inventory/FinishedGoodsBatchRepository.java`:

| Line | Method | 改动 |
|---|---|---|
| 29-31 | `findAvailableBatches(factoryId, productTypeId)` | 加 `warehouseId` 参数 |
| 38-40 | `findAvailableBatchesFifo(factoryId, productTypeId)` | 同上 |
| 47-49 | `sumAvailableQuantityByProductType(factoryId, productTypeId)` | 加 `warehouseId` 参数 |

### 5.3 Service / Tool 调用站点 (~12 sites)

| File:Line | Method | warehouse 选择策略 |
|---|---|---|
| `service/inventory/impl/TransferServiceImpl.java:199` | `sumAvailableQuantityByMaterialType` | source warehouse (调拨单 sourceWarehouseId) |
| `service/inventory/impl/TransferServiceImpl.java:204` | `sumAvailableQuantityByProductType` | 同上 |
| `service/inventory/impl/TransferServiceImpl.java:402` | `findAvailableBatchesFEFO` (FEFO 扣减) | source warehouse |
| `service/inventory/impl/TransferServiceImpl.java:429` | `findAvailableBatches` (成品 FEFO) | source warehouse |
| `service/inventory/impl/SalesServiceImpl.java:801` | `findAvailableBatches` (销售批次预占) | **WH-LOG 固定** (D1: 销售只从 WH-LOG 出) |
| `service/inventory/impl/SalesServiceImpl.java:975` | `findAvailableBatches` (销售发货) | **WH-LOG 固定** |
| `service/orchestration/InventoryMatchingService.java:68` | `sumAvailableQuantityByProductType` | **WH-LOG 固定** (D5 销售从总仓) |
| `service/orchestration/InventoryMatchingService.java:108` | `findAvailableBatches` (FEFO reserve) | **WH-LOG 固定** |
| `service/orchestration/BomExpansionService.java:102` | `findAvailableBatchesFEFO` (BOM 物料分配) | **WH-WKS 优先 → fallback WH-LOG** (生产先用车间仓余料, 不够回 LOG 拿) |
| `service/impl/BatchConsumptionServiceImpl.java:210` | `findAvailableBatchesFEFO` (报工消耗) | **WH-WKS 固定** (报工只在车间) |
| `service/impl/MaterialBatchServiceImpl.java:476` | `findExpiringBatches` (过期监控) | 全 warehouse (监控不分仓) |
| `service/impl/MaterialBatchServiceImpl.java:665` | `calculateInventoryValue` (库存总值) | 全 warehouse (报表用) |

### 5.4 Report / SmartBI 调用站点 (~7 sites, P2 优先级)

| File:Line | Method | 改动建议 |
|---|---|---|
| `service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java:147` | `calculateInventoryValue` | 加 warehouse drill-down 维度 (可选) |
| `service/smartbi/impl/InventoryHealthAnalysisServiceImpl.java:221,294` | `findExpiringBatches` | 全 warehouse (默认) |
| `service/report/impl/ProductionReportServiceImpl.java:93,104,111,626` | 4 处 | 加 warehouse 维度 GROUP BY (可选) |
| `service/report/impl/DashboardStatisticsServiceImpl.java:188,190,353` | 3 处 | 全 warehouse (默认) |
| `ai/tool/impl/restaurant/RestaurantProcurementSuggestionTool.java:89` | `findExpiringBatches` | 全 warehouse |
| `ai/tool/impl/restaurant/RestaurantIngredientExpiryAlertTool.java:72` | `findExpiringBatches` | 全 warehouse |

**P2 简化方案**: Report / SmartBI 调用不强制改, 保持全 warehouse view 即可 (报表本来就是 factory-level 聚合). 后续 stakeholder 提出再加 drill-down.

### 5.5 DTO + API

- `CreateMaterialBatchRequest` (purchase receive 入库) → 加 nullable `warehouseId` 字段 (default WH-LOG)
- `CreateReceiveRecordRequest` → 同上 (已存在 `targetWarehouseId` 字段, 验证一致)
- 库存查询 API → 加 optional `warehouseId` query param

### 5.6 ProductionWorkflowOrchestrator (production start)

PR #305 (餐饮 P1) 已验证 production start 触发批次锁定. D1 后:

- 默认: WH-WKS 优先 (车间仓)
- Fallback: WH-WKS 不足 → 自动从 WH-LOG 拿 (调拨进车间)

具体策略落到 impl PR, 此处仅 spec 化.

---

## 6. Cascade — 解锁 4 个 PR #309 sign-off items

D1 落地后, 以下 PR #309 sign-off items 可立即 dispatch:

| Item | Description | 依赖原因 |
|---|---|---|
| **A3** 反向调拨自动触发 | 报工 status=COMPLETED → 自动生成 BRANCH_TO_HQ 调拨单 (草稿态, 用户确认) | 需要 `warehouse_id` 区分 source / target warehouse, 当前无字段无法精确触发 |
| **A5** D5 销售从 WH-LOG 出 (feature flag for cross-factory) | 销售订单 reserve / ship 默认从 WH-LOG, 跨工厂场景 feature flag 控制 | InventoryMatchingService + SalesServiceImpl 必须按 `warehouse_id = 'WH-LOG'` 过滤 |
| **B1** SHIP 阶段批次选择 (CREATE 默认 FEFO + SHIP 可改两阶段) | 调拨创建时默认 FEFO, 发货阶段用户可改 | UI 批次下拉需要按 source warehouse 过滤显示, 当前 batch 无 warehouse 字段无法过滤 |
| **B2** 分仓批次 dropdown (跨 factoryId) | UI 下拉按 warehouse 分组显示批次 | Frontend 需要 warehouse_id 字段才能 group |

---

## 7. Spec 修订记录 (revision notes — 不直接 edit 旧 spec)

**本 spec amendment 不修改原 ADR 文件本身**. 旧 ADR (`docs/plans/p0-5-b2-warehouse-dimension-adr.md`) 保留 "Rejected / Deferred" 历史状态.

**新增 revision pointer**: 由 impl PR (V20260510_01 migration commit) 在以下位置加 amendment pointer:

1. `docs/plans/p0-5-b2-warehouse-dimension-adr.md` 顶部加 banner:
   ```markdown
   > ⚠️ **2026-05-10 SUPERSEDED**: 本 ADR "Rejected" 决定已被推翻, see `docs/superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md`. F006 客户 D1 业务模型触发 ADR §174 case 5, V3 P0-5 B2 升级为 P0 实施.
   ```

2. `backend/java/cretas-api/src/main/resources/db/migration/V20260411_03__factory_warehouses.sql` 头注释 (line 1-7) 更新:
   ```sql
   -- P1-4 双仓体系 v1 §2.9 — FactoryWarehouse 查询表
   --
   -- 客户原话 (会议 3225s): "物流仓 + 鲜棉仓, 鲜棉仓当天清仓"
   --
   -- 2026-05-10 UPDATE: D1 双仓流转生效 (PR #309 A1=A). 此 table 现 + 参与
   -- stock query (V20260510_01/02 加 material_batches.warehouse_id +
   -- finished_goods_batches.warehouse_id FK 到 factory_warehouses.id).
   -- See: docs/superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md
   ```

3. `docs/superpowers/specs/2026-04-11-v1-e2e-framework-redesign.md` §9 line 392 加 strikethrough + pointer:
   ```markdown
   - ~~**P0-5 B2 warehouse dimension** — ADR Rejected, 整个特性不存在~~
     **[2026-05-10 SUPERSEDED]** Reactivated as D1 dual-warehouse, see
     `docs/superpowers/specs/2026-05-10-d1-dual-warehouse-spec-amendment.md`.
   ```

⚠️ 旧 ADR `2026-04-11-v1-e2e-framework-redesign.md` §6.3 line 242-243 (覆盖矩阵) **不动**: V3 文档保留历史, 新决策由本 amendment 表达.

---

## 8. Test plan

### 8.1 Migration smoke (impl PR 自跑)

- 在 cretas_db 跑 V20260510_01 + 02 dry-run
- Verify: 所有 batches 都有 non-null warehouse_id
- Verify: FK constraint 生效 (insert non-existent warehouse_id 失败)
- Verify: index 创建成功

### 8.2 JUnit IT

- `MaterialBatchRepositoryTest` 新加: warehouseId 过滤 isolation (F001 batch 不能用 F002 warehouse 查到)
- `FinishedGoodsBatchRepositoryTest` 新加: 同上
- `InventoryMatchingServiceTest` 新加: WH-LOG 固定查询 (D5 销售源)
- `BomExpansionServiceTest` 新加: WH-WKS 优先 → WH-LOG fallback 链路

### 8.3 E2E (F006 客户场景)

1. 创建生产计划 → 调拨单 (WH-LOG → WH-WKS)
2. 报工 → 原料消耗在 WH-WKS, 成品入 WH-WKS
3. 反向调拨 → 成品 + 偏差余料回 WH-LOG
4. 销售订单 → 必须能从 WH-LOG 找到批次发货
5. WH-WKS 在 day-end 应该 = 0 库存

### 8.4 Rollback drill

- Migration apply → rollback → re-apply 应该 idempotent

---

## 9. Effort breakdown

| Phase | 任务 | 估时 | 备注 |
|---|---|---|---|
| Phase A (本 spec) | Spec doc 写作 + Steve sign-off | 0.5d | 已 ship |
| Phase B | Migration V20260510_01 + V20260510_02 | 0.5d | 包括 dry-run on cretas_db |
| Phase C | Entity + Repository 签名扩展 (11 sites) | 1d | nullable warehouseId 参数 backward-compat |
| Phase D | Service / Tool / Orchestrator 调用站点 (12 sites) | 1.5d | warehouse 选择策略落地 |
| Phase E | DTO + API + 单元测试 | 0.5d | JUnit IT 8.2 |
| Phase F | E2E + Rollback drill | 0.5d | F006 全链路 |
| **Total** | | **3.5-4d** | dispatch ready after spec sign-off |

---

## 10. Out of scope (P2 / 后续)

明确**不在本 amendment**:

- 批次 split lineage (`parentBatchId` / `splitVersion`) — 反向调拨可能产生 split, 但本 spec 不实现 split 追溯, 仅记录 warehouseId 流动
- Report / SmartBI 按 warehouse drill-down 维度 — P2, 客户当前未明确要求
- WH-WKS 23:50 day-end 残留告警 cron job — D1 §2.5 客户原始 spec 已提, 但本 spec 不实现 (单独 P2 PR)
- 跨工厂 warehouse routing (e.g. F001 WH-LOG → F002 WH-WKS 直接调拨) — A5 feature flag 控制, 默认禁用, 单独 spec
- Mobile RN 端分仓 UI — P2, 客户优先 web-admin

---

## 11. Dispatch readiness

| Sub-task | 依赖 | Ready to dispatch |
|---|---|---|
| Schema migration V20260510_01/02 | 本 spec sign-off | ✅ ready (after merge) |
| Entity field + repository signatures | Schema migration land | ⏳ waiting on Phase B |
| Service / Tool / Orchestrator 调用 | Repository signatures land | ⏳ waiting on Phase C |
| DTO + API + tests | Service land | ⏳ waiting on Phase D |
| Frontend Dropdown / 分仓查询页 (B2/B5) | API land + B2 spec dispatch | ⏳ separate B2 follow-up |

**Recommended sister chat dispatch order** (after spec sign-off):
1. Phase B (Schema) — 1 chat
2. Phase C+D (Entity + Repository + Service) — 1 chat (避免 signature drift)
3. Phase E (DTO+API+test) — 1 chat
4. Phase F (E2E+rollback) — 1 chat or Steve self-run

---

## 12. Open questions (for Steve sign-off)

| # | Question | Default if no answer |
|---|---|---|
| Q1 | FK 选 `factory_warehouses.id` PK 还是 `(factory_id, code)` 复合 UK? | PK (§3.3 决策) |
| Q2 | MaterialBatch 默认 warehouse 选 WH-LOG 还是 WH-WKS? | WH-LOG (§3.3 决策) |
| Q3 | FinishedGoodsBatch 默认 warehouse 选 WH-LOG 还是 WH-WKS? | WH-WKS (§3.3 决策, 反映生产产出落点) |
| Q4 | Report / SmartBI 是否本 amendment 改? 还是 P2? | P2 (§5.4 推荐) |
| Q5 | 跨工厂 warehouse routing (A5 feature flag) 默认 on 还是 off? | off (A5 sign-off 决策) |
| Q6 | Backfill 时如果有 factory 缺 WH-LOG seed 是 abort 还是 auto-create? | abort + manual fix (§3.3 决策) |

如无 explicit override, 默认值生效进入 Phase B impl.
