# PRD-Entity-MaterialBatch（原料批次）

**实体名称**: MaterialBatch
**数据库表名**: `material_batches`
**核心程度**: ⭐⭐⭐⭐⭐ (食品溯源系统最核心的实体之一)
**文档版本**: 1.0.0
**最后更新**: 2025-11-20

---

## 📋 目录

1. [实体概述](#实体概述)
2. [字段详情](#字段详情)
3. [关系映射](#关系映射)
4. [索引设计](#索引设计)
5. [数据流程](#数据流程)
6. [SQL示例](#sql示例)
7. [业务规则总结](#业务规则总结)

---

## 实体概述

### 业务定义

**MaterialBatch（原料批次）** 是白垩纪食品溯源系统中最核心的实体之一，代表**一批次采购入库的原材料**。它是实现**全链条食品溯源**的基础，记录从供应商采购的每一批原材料的完整生命周期：入库 → 质检 → 存储 → 预留 → 消耗 → 耗尽。

### 核心作用

1. **溯源基础**: 记录每批原材料的来源（供应商）、入库时间、过期时间，实现向上溯源
2. **库存管理**: 跟踪原材料的实时库存（入库数量、已用数量、预留数量、剩余数量）
3. **成本核算**: 记录单价和总价，支持成本分析
4. **质量管理**: 关联质量证书、存储位置、过期日期
5. **消耗追踪**: 关联生产计划和加工批次，记录原材料在哪个产品中被消耗

### 生命周期

```
入库 → 质检 → 可用 → 预留 → 消耗 → 耗尽/用完/过期/报废
  ↓      ↓      ↓      ↓      ↓         ↓
FRESH  INSPECTING AVAILABLE RESERVED DEPLETED  USED_UP/EXPIRED/SCRAPPED
```

**状态转换规则**:
- `FRESH/FROZEN` (新入库) → `INSPECTING` (质检中) → `AVAILABLE` (可用)
- `AVAILABLE` → `RESERVED` (被生产计划预留) → `DEPLETED` (剩余为0但还有预留) → `USED_UP` (全部消耗)
- `AVAILABLE/RESERVED/DEPLETED` → `EXPIRED` (过期) 或 `SCRAPPED` (报废)

### 关键指标

- **当前可用数量**: `currentQuantity = receiptQuantity - usedQuantity - reservedQuantity`
- **库存占用率**: `usageRate = usedQuantity / receiptQuantity × 100%`
- **总价值**: `totalPrice = unitPrice × receiptQuantity`
- **总重量**: `totalWeight = weightPerUnit × receiptQuantity`
- **剩余天数**: `remainingDays = expireDate - TODAY`

---

## 字段详情

### 主键和标识

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | VARCHAR(191) | PRIMARY KEY, NOT NULL | UUID | 批次唯一ID，使用UUID生成 |
| `batch_number` | VARCHAR(50) | UNIQUE, NOT NULL | - | 批次号，全局唯一，格式：`MAT-{YYYYMMDD}-{序号}` |

**批次号生成规则**:
- 格式: `MAT-{YYYYMMDD}-{序号}` (例如：`MAT-20251120-001`)
- `MAT`: Material的缩写，表示原材料批次
- `YYYYMMDD`: 入库日期（8位数字）
- `序号`: 当天批次的流水号（3位数字，001起）

---

### 基本信息

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `factory_id` | VARCHAR(191) | NOT NULL, FK → factories.id | - | 工厂ID，多租户隔离关键字段 |
| `material_type_id` | VARCHAR(191) | NOT NULL, FK → raw_material_types.id | - | 原材料类型ID（UUID） |
| `supplier_id` | VARCHAR(191) | NULL, FK → suppliers.id | - | 供应商ID（UUID），可为空（内部生产） |
| `created_by` | INT | NOT NULL, FK → users.id | - | 创建人ID（录入员工） |

**字段说明**:
- `factory_id`: 必须字段，用于多租户数据隔离
- `material_type_id`: 关联原材料类型定义（如"三文鱼"、"白虾"）
- `supplier_id`: 可选，外部采购填写供应商，内部生产可为NULL
- `created_by`: 记录哪个员工录入了这批原材料

---

### 时间字段

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `receipt_date` | DATE | NOT NULL (映射到 `inbound_date`) | - | 入库日期（收货日期） |
| `purchase_date` | DATE | NULL | - | 采购日期（下单日期） |
| `expire_date` | DATE | NULL | - | 过期日期（保质期截止日期） |
| `last_used_at` | DATETIME | NULL | - | 最后一次消耗时间 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 记录创建时间 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | 记录更新时间 |

**时间逻辑**:
- `receipt_date` (入库日期) 通常 ≥ `purchase_date` (采购日期)
- `expire_date` = `receipt_date` + `raw_material_types.shelf_life_days`
- 系统每天检查 `expire_date < TODAY` 自动更新 `status = EXPIRED`
- `last_used_at` 在每次消耗时更新

---

### 数量和库存

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `receipt_quantity` | DECIMAL(10,2) | NOT NULL | - | 入库数量（初始数量，不可修改） |
| `quantity_unit` | VARCHAR(20) | NOT NULL | - | 数量单位（如：kg、箱、条） |
| `weight_per_unit` | DECIMAL(10,3) | NULL | - | 每单位重量（kg），用于重量换算 |
| `used_quantity` | DECIMAL(10,2) | NOT NULL | 0.00 | 已消耗数量（累加） |
| `reserved_quantity` | DECIMAL(10,2) | NOT NULL | 0.00 | 已预留数量（生产计划预留） |

**数量计算公式**:

```java
// 当前可用数量（动态计算，不存储）
currentQuantity = receiptQuantity - usedQuantity - reservedQuantity

// 总重量（动态计算）
totalWeight = weightPerUnit × receiptQuantity

// 库存占用率
usageRate = usedQuantity / receiptQuantity × 100%
```

**约束条件**:
- `receipt_quantity > 0` (入库数量必须 > 0)
- `used_quantity >= 0` (已用数量不能为负)
- `reserved_quantity >= 0` (预留数量不能为负)
- `used_quantity + reserved_quantity <= receipt_quantity` (已用+预留 ≤ 入库数量)

---

### 价格和成本

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `unit_price` | DECIMAL(10,2) | NULL | - | 单价（元/单位），用于成本核算 |

**价格计算**:

```java
// 总价值（动态计算，不存储）
totalPrice = unitPrice × receiptQuantity

// 已消耗成本
usedCost = unitPrice × usedQuantity

// 剩余价值
remainingValue = unitPrice × currentQuantity
```

---

### 状态和质量

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `status` | ENUM | NOT NULL | `AVAILABLE` | 批次状态（10种状态） |
| `storage_location` | VARCHAR(100) | NULL | - | 存储位置（如：冷库A-03、干货架B-12） |
| `quality_certificate` | VARCHAR(100) | NULL | - | 质量证书编号或文件路径 |
| `notes` | TEXT | NULL | - | 备注说明 |

**状态枚举** (`MaterialBatchStatus`):

| 枚举值 | 显示名称 | 描述 | 业务含义 |
|--------|----------|------|----------|
| `IN_STOCK` | 库存中 | 批次在库存中（兼容旧数据） | 已入库但未分类 |
| `AVAILABLE` | 可用 | 批次可以正常使用 | 质检通过，可用于生产 |
| `FRESH` | 鲜品 | 新鲜原材料批次 | 新入库的鲜品（0-4℃存储） |
| `FROZEN` | 冻品 | 已冻结原材料批次 | 新入库的冻品（-18℃存储） |
| `DEPLETED` | 已耗尽 | 剩余=0，但还有预留 | `currentQuantity=0 且 reservedQuantity>0` |
| `USED_UP` | 已用完 | 批次已全部消耗 | `usedQuantity = receiptQuantity` |
| `EXPIRED` | 已过期 | 批次已超过保质期 | `expire_date < TODAY` |
| `INSPECTING` | 质检中 | 批次正在质量检验 | 入库后质检阶段 |
| `SCRAPPED` | 已报废 | 批次已报废处理 | 质量问题/损坏报废 |
| `RESERVED` | 已预留 | 批次已被预留，等待使用 | 被生产计划锁定 |

**状态转换逻辑**:

```java
// 入库时自动设置
if (materialType.storageType == "fresh") {
    status = FRESH;
} else if (materialType.storageType == "frozen") {
    status = FROZEN;
} else {
    status = AVAILABLE;
}

// 质检流程
FRESH/FROZEN → (开始质检) → INSPECTING → (质检通过) → AVAILABLE
                                         → (质检不通过) → SCRAPPED

// 预留流程
AVAILABLE → (生产计划预留) → RESERVED → (生产消耗) → DEPLETED → USED_UP

// 过期检查（定时任务）
if (expireDate != null && expireDate < TODAY) {
    status = EXPIRED;
}

// 数量变化触发状态更新
if (currentQuantity == 0 && reservedQuantity > 0) {
    status = DEPLETED;
} else if (usedQuantity >= receiptQuantity) {
    status = USED_UP;
}
```

---

### 计算字段（@Transient）

这些字段**不存储在数据库中**，由Java代码动态计算：

| 方法名 | 返回类型 | 计算公式 | 说明 |
|--------|----------|----------|------|
| `getCurrentQuantity()` | BigDecimal | `receiptQuantity - usedQuantity - reservedQuantity` | 当前可用数量 |
| `getRemainingQuantity()` | BigDecimal | 同上 | 剩余数量（别名） |
| `getTotalQuantity()` | BigDecimal | `receiptQuantity` | 总数量（别名） |
| `getInitialQuantity()` | BigDecimal | `receiptQuantity` | 初始数量（别名） |
| `getTotalPrice()` | BigDecimal | `unitPrice × receiptQuantity` | 总价值 |
| `getTotalValue()` | BigDecimal | 同上 | 总价值（别名） |
| `getTotalWeight()` | BigDecimal | `weightPerUnit × receiptQuantity` | 总重量（kg） |

---

## 关系映射

### ER 关系图

```
                     ┌─────────────────┐
                     │     Factory     │
                     │   (factories)   │
                     └────────┬────────┘
                              │ 1
                              │
                              │ N
         ┌────────────────────┼─────────────────────┐
         │                    │                     │
         │                    │                     │
    ┌────▼────────┐    ┌──────▼─────────┐   ┌──────▼─────────┐
    │  Supplier   │    │ RawMaterialType│   │      User      │
    │ (suppliers) │    │(raw_material_  │   │    (users)     │
    │             │    │     types)     │   │                │
    └────┬────────┘    └──────┬─────────┘   └──────┬─────────┘
         │ 1                  │ 1                  │ 1
         │                    │                    │
         │                    │                    │
         │            N       │ N           N      │
         └────────────────────┼────────────────────┘
                              │
                              │
                     ┌────────▼─────────┐
                     │  MaterialBatch   │
                     │(material_batches)│
                     │                  │
                     │ • batchNumber    │
                     │ • receiptQuantity│
                     │ • usedQuantity   │
                     │ • reservedQuantity│
                     │ • status         │
                     └────────┬─────────┘
                              │ 1
                              │
         ┌────────────────────┼─────────────────────────┐
         │ N                  │ N                       │ N
         │                    │                         │
┌────────▼──────────┐  ┌──────▼────────────┐  ┌────────▼────────────────┐
│MaterialConsumption│  │MaterialBatch      │  │ProductionPlanBatchUsage │
│  (material_       │  │  Adjustment       │  │  (production_plan_      │
│  consumptions)    │  │(material_batch_   │  │   batch_usages)         │
│                   │  │  adjustments)     │  │                         │
│ • quantity        │  │ • adjustmentType  │  │ • reservedQuantity      │
│ • unitPrice       │  │ • quantityBefore  │  │                         │
│ • totalCost       │  │ • quantityAfter   │  │                         │
└───────────────────┘  └───────────────────┘  └─────────────────────────┘
         │                                              │
         │ N                                            │ N
         │                                              │
         ▼ 1                                            ▼ 1
┌─────────────────┐                          ┌──────────────────┐
│ ProductionPlan  │                          │ ProductionPlan   │
│(production_     │                          │ (production_     │
│   plans)        │                          │    plans)        │
└─────────────────┘                          └──────────────────┘
```

### N:1 关系（MaterialBatch → 其他实体）

| 关联实体 | 外键字段 | 关系类型 | 说明 |
|----------|----------|----------|------|
| **Factory** | `factory_id` | N:1, LAZY | 所属工厂（多租户隔离） |
| **RawMaterialType** | `material_type_id` | N:1, LAZY, @BatchSize(20) | 原材料类型定义 |
| **Supplier** | `supplier_id` | N:1, LAZY, @BatchSize(10) | 供应商（可为NULL） |
| **User** | `created_by` | N:1, LAZY | 创建人（录入员工） |

**说明**:
- 所有关系都使用 `FetchType.LAZY` (延迟加载) 避免性能问题
- `@BatchSize` 注解优化N+1查询问题（一次查询预加载多个关联）
- `insertable=false, updatable=false` 避免双向绑定冲突

---

### 1:N 关系（MaterialBatch → 子记录）

| 子实体 | 映射字段 | 级联策略 | 说明 |
|--------|----------|----------|------|
| **MaterialConsumption** | `consumptions` | CascadeType.ALL | 消耗记录（在哪个生产计划中用了多少） |
| **MaterialBatchAdjustment** | `adjustments` | CascadeType.ALL | 调整记录（报损、报溢、修正） |
| **ProductionPlanBatchUsage** | `planBatchUsages` | CascadeType.ALL | 生产计划预留记录 |

**级联删除风险**:
- ⚠️ `CascadeType.ALL` 包含 `REMOVE`，删除批次会删除所有消耗记录！
- **建议**: MaterialBatch **不应该物理删除**，只能归档（状态改为 `SCRAPPED` 或 `USED_UP`）
- **原因**: 食品溯源系统必须保留所有历史消耗记录，否则无法追溯产品原料来源

---

### 关联实体详解

#### 1. MaterialConsumption（原材料消耗记录）

记录这批原材料在哪个生产计划中被消耗了多少。

**关键字段**:
- `batch_id`: 关联 MaterialBatch
- `production_plan_id`: 关联生产计划
- `production_batch_id`: 关联加工批次
- `quantity`: 消耗数量
- `unit_price`: 消耗时的单价
- `total_cost`: 消耗成本 (`quantity × unit_price`)
- `consumption_time`: 消耗时间

**业务逻辑**:
```java
// 消耗原材料时
MaterialConsumption consumption = new MaterialConsumption();
consumption.setBatchId(materialBatch.getId());
consumption.setQuantity(usedQty);
consumption.setUnitPrice(materialBatch.getUnitPrice());
consumption.setTotalCost(usedQty.multiply(materialBatch.getUnitPrice()));

// 更新批次已用数量
materialBatch.setUsedQuantity(
    materialBatch.getUsedQuantity().add(usedQty)
);
```

---

#### 2. MaterialBatchAdjustment（原材料批次调整记录）

记录库存调整操作（报损、报溢、修正、退货）。

**关键字段**:
- `adjustment_type`: 调整类型（`loss`/`damage`/`correction`/`return`）
- `quantity_before`: 调整前数量
- `adjustment_quantity`: 调整数量（正数=增加，负数=减少）
- `quantity_after`: 调整后数量
- `reason`: 调整原因
- `adjusted_by`: 调整人

**调整类型说明**:

| 类型 | 英文名 | 说明 | 数量变化 |
|------|--------|------|----------|
| 报损 | `loss` | 原材料自然损耗、过期损失 | 减少（负数） |
| 报溢 | `damage` | 盘点发现数量多于记录 | 增加（正数） |
| 修正 | `correction` | 录入错误修正 | 正负均可 |
| 退货 | `return` | 退回供应商 | 减少（负数） |

**业务逻辑**:
```java
// 创建调整记录
MaterialBatchAdjustment adjustment = new MaterialBatchAdjustment();
adjustment.setQuantityBefore(materialBatch.getReceiptQuantity());
adjustment.setAdjustmentQuantity(adjustQty); // 如 -10.5 (报损)
adjustment.setQuantityAfter(
    materialBatch.getReceiptQuantity().add(adjustQty)
);

// 更新批次入库数量（注意：修改的是receiptQuantity，不是usedQuantity）
materialBatch.setReceiptQuantity(
    materialBatch.getReceiptQuantity().add(adjustQty)
);
```

---

#### 3. ProductionPlanBatchUsage（生产计划批次预留）

记录生产计划预留了哪些批次的原材料。

**关键字段**:
- `production_plan_id`: 生产计划ID
- `material_batch_id`: 原材料批次ID
- `reserved_quantity`: 预留数量

**业务逻辑**:
```java
// 生产计划创建时预留原材料
ProductionPlanBatchUsage usage = new ProductionPlanBatchUsage();
usage.setProductionPlanId(planId);
usage.setMaterialBatchId(batchId);
usage.setReservedQuantity(needQty);

// 更新批次预留数量
materialBatch.setReservedQuantity(
    materialBatch.getReservedQuantity().add(needQty)
);
materialBatch.setStatus(MaterialBatchStatus.RESERVED);
```

---

## 索引设计

### 索引列表

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `PRIMARY` | `id` | PRIMARY KEY | 主键索引（UUID） |
| `UNIQUE` | `batch_number` | UNIQUE | 批次号全局唯一 |
| `idx_batch_factory` | `factory_id` | INDEX | 工厂数据隔离（最常用） |
| `idx_batch_status` | `status` | INDEX | 按状态筛选（库存查询） |
| `idx_batch_expire` | `expire_date` | INDEX | 过期检查（定时任务） |
| `idx_batch_material` | `material_type_id` | INDEX | 按原材料类型查询 |

---

### 索引使用场景

#### 1. `idx_batch_factory` (工厂ID索引)

**最常用索引**，几乎所有查询都需要按工厂过滤。

```sql
-- 查询某工厂所有原材料批次
SELECT * FROM material_batches
WHERE factory_id = 'FISH_2025_001'
ORDER BY receipt_date DESC;
-- ✅ 使用索引: idx_batch_factory

-- 工厂库存汇总
SELECT
    material_type_id,
    COUNT(*) as batch_count,
    SUM(receipt_quantity - used_quantity - reserved_quantity) as total_stock
FROM material_batches
WHERE factory_id = 'FISH_2025_001' AND status IN ('AVAILABLE', 'RESERVED')
GROUP BY material_type_id;
-- ✅ 使用索引: idx_batch_factory
```

---

#### 2. `idx_batch_status` (状态索引)

用于库存查询、过期检查等状态筛选场景。

```sql
-- 查询所有可用批次
SELECT * FROM material_batches
WHERE status = 'AVAILABLE'
ORDER BY expire_date ASC;
-- ✅ 使用索引: idx_batch_status

-- 查询即将过期的批次（FIFO发料提醒）
SELECT * FROM material_batches
WHERE status IN ('AVAILABLE', 'RESERVED')
  AND expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
ORDER BY expire_date ASC;
-- ✅ 使用索引: idx_batch_status, idx_batch_expire (复合条件)
```

---

#### 3. `idx_batch_expire` (过期日期索引)

支持定时任务检查过期批次。

```sql
-- 定时任务：标记过期批次
UPDATE material_batches
SET status = 'EXPIRED', updated_at = NOW()
WHERE expire_date < CURDATE()
  AND status NOT IN ('USED_UP', 'EXPIRED', 'SCRAPPED');
-- ✅ 使用索引: idx_batch_expire

-- 过期预警（未来7天将过期）
SELECT * FROM material_batches
WHERE expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND status IN ('AVAILABLE', 'RESERVED')
ORDER BY expire_date ASC;
-- ✅ 使用索引: idx_batch_expire
```

---

#### 4. `idx_batch_material` (原材料类型索引)

按原材料类型查询库存。

```sql
-- 查询某种原材料的所有批次
SELECT * FROM material_batches
WHERE material_type_id = 'UUID-SALMON-001'
  AND status IN ('AVAILABLE', 'RESERVED')
ORDER BY expire_date ASC;  -- FIFO原则：先进先出
-- ✅ 使用索引: idx_batch_material
```

---

### 复合索引建议

当前索引设计可能存在优化空间，建议添加复合索引：

```sql
-- 1. 工厂+状态复合索引（最常用组合）
CREATE INDEX idx_batch_factory_status
ON material_batches(factory_id, status);

-- 2. 工厂+过期日期复合索引（过期检查）
CREATE INDEX idx_batch_factory_expire
ON material_batches(factory_id, expire_date);

-- 3. 工厂+原材料类型+状态（库存查询）
CREATE INDEX idx_batch_factory_material_status
ON material_batches(factory_id, material_type_id, status);
```

**为什么需要复合索引？**

```sql
-- 没有复合索引时（需要两次索引查找）
WHERE factory_id = 'FISH_2025_001' AND status = 'AVAILABLE'
-- 先用 idx_batch_factory 找到工厂数据，再逐行检查 status

-- 有复合索引时（一次索引查找）
WHERE factory_id = 'FISH_2025_001' AND status = 'AVAILABLE'
-- 使用 idx_batch_factory_status 直接定位
```

---

## 数据流程

### 1. 创建原材料批次（入库）

**业务场景**: 供应商送货，仓库管理员验货入库。

**数据流**:

```
供应商送货 → 仓库验收 → 录入系统 → 自动生成批次号 → 入库完成
```

**SQL 示例**:

```sql
-- Step 1: 生成批次ID和批次号
-- Java代码生成:
--   id = UUID.randomUUID().toString()
--   batchNumber = "MAT-" + LocalDate.now().format("yyyyMMdd") + "-" + getNextSequence()

-- Step 2: 插入批次记录
INSERT INTO material_batches (
    id,
    factory_id,
    batch_number,
    material_type_id,
    supplier_id,
    receipt_date,
    purchase_date,
    expire_date,
    receipt_quantity,
    quantity_unit,
    weight_per_unit,
    used_quantity,
    reserved_quantity,
    unit_price,
    status,
    storage_location,
    quality_certificate,
    notes,
    created_by,
    created_at,
    updated_at
) VALUES (
    'uuid-generated-123',                    -- id
    'FISH_2025_001',                         -- factory_id
    'MAT-20251120-001',                      -- batch_number
    'uuid-material-salmon',                  -- material_type_id
    'uuid-supplier-seafood-co',              -- supplier_id
    '2025-11-20',                            -- receipt_date (入库日期)
    '2025-11-18',                            -- purchase_date (采购日期)
    DATE_ADD('2025-11-20', INTERVAL 30 DAY), -- expire_date (入库日期+保质期)
    500.00,                                  -- receipt_quantity
    'kg',                                    -- quantity_unit
    1.000,                                   -- weight_per_unit (每kg重1kg)
    0.00,                                    -- used_quantity (初始为0)
    0.00,                                    -- reserved_quantity (初始为0)
    45.50,                                   -- unit_price (元/kg)
    'FRESH',                                 -- status (鲜品)
    '冷库A-03',                               -- storage_location
    'QC-2025-11-20-001',                     -- quality_certificate
    '智利进口三文鱼，品质优良',                 -- notes
    1,                                       -- created_by (员工ID)
    NOW(),                                   -- created_at
    NOW()                                    -- updated_at
);

-- Step 3: 验证插入
SELECT
    id,
    batch_number,
    receipt_quantity,
    quantity_unit,
    receipt_quantity - used_quantity - reserved_quantity AS current_quantity,
    unit_price * receipt_quantity AS total_value,
    status
FROM material_batches
WHERE batch_number = 'MAT-20251120-001';

-- 预期结果:
-- current_quantity = 500.00 kg
-- total_value = 22,750.00 元 (500 × 45.50)
-- status = FRESH
```

**业务规则**:
1. `batch_number` 必须全局唯一（通过UNIQUE约束保证）
2. `expire_date` 根据原材料类型的保质期自动计算
3. 初始状态根据存储类型设置：鲜品=`FRESH`，冻品=`FROZEN`，其他=`AVAILABLE`
4. `used_quantity` 和 `reserved_quantity` 初始为 0

---

### 2. 质检流程

**业务场景**: 入库后进行质量检验。

```sql
-- 开始质检
UPDATE material_batches
SET status = 'INSPECTING', updated_at = NOW()
WHERE id = 'uuid-generated-123'
  AND status IN ('FRESH', 'FROZEN');

-- 质检通过
UPDATE material_batches
SET
    status = 'AVAILABLE',
    quality_certificate = 'QC-PASS-2025-11-20-001',
    updated_at = NOW()
WHERE id = 'uuid-generated-123'
  AND status = 'INSPECTING';

-- 质检不通过（报废）
UPDATE material_batches
SET
    status = 'SCRAPPED',
    notes = CONCAT(notes, '\n质检不合格，已报废。原因：细菌超标'),
    updated_at = NOW()
WHERE id = 'uuid-generated-123'
  AND status = 'INSPECTING';
```

---

### 3. 生产计划预留原材料

**业务场景**: 创建生产计划时，系统自动预留所需原材料。

**数据流**:

```
创建生产计划 → 计算所需原材料 → 查找可用批次(FIFO) → 预留数量 → 更新批次状态
```

**SQL 示例**:

```sql
-- Step 1: 查找可用批次（FIFO原则：先进先出）
SELECT
    id,
    batch_number,
    receipt_quantity - used_quantity - reserved_quantity AS available_qty,
    expire_date
FROM material_batches
WHERE factory_id = 'FISH_2025_001'
  AND material_type_id = 'uuid-material-salmon'
  AND status = 'AVAILABLE'
  AND (expire_date IS NULL OR expire_date >= CURDATE())
ORDER BY
    expire_date ASC,  -- 先过期的先用
    receipt_date ASC  -- 先入库的先用
LIMIT 10;

-- Step 2: 预留原材料（假设需要100kg三文鱼）
-- 假设查询结果返回批次 'uuid-batch-001' 有200kg可用
UPDATE material_batches
SET
    reserved_quantity = reserved_quantity + 100.00,
    status = 'RESERVED',
    updated_at = NOW()
WHERE id = 'uuid-batch-001'
  AND factory_id = 'FISH_2025_001';

-- Step 3: 记录预留关系
INSERT INTO production_plan_batch_usages (
    production_plan_id,
    material_batch_id,
    reserved_quantity,
    created_at
) VALUES (
    'uuid-plan-001',
    'uuid-batch-001',
    100.00,
    NOW()
);

-- Step 4: 验证预留
SELECT
    batch_number,
    receipt_quantity,
    used_quantity,
    reserved_quantity,
    receipt_quantity - used_quantity - reserved_quantity AS current_available,
    status
FROM material_batches
WHERE id = 'uuid-batch-001';

-- 预期结果:
-- receipt_quantity = 500.00
-- reserved_quantity = 100.00
-- current_available = 400.00
-- status = RESERVED
```

---

### 4. 生产消耗原材料

**业务场景**: 生产批次开始生产，消耗预留的原材料。

**数据流**:

```
生产开始 → 释放预留 → 记录消耗 → 更新已用数量 → 检查是否耗尽
```

**SQL 示例**:

```sql
-- Step 1: 释放预留，增加消耗（假设实际用了95kg）
START TRANSACTION;

-- 更新批次数量
UPDATE material_batches
SET
    reserved_quantity = reserved_quantity - 100.00,  -- 释放预留
    used_quantity = used_quantity + 95.00,           -- 增加消耗
    last_used_at = NOW(),
    updated_at = NOW()
WHERE id = 'uuid-batch-001'
  AND factory_id = 'FISH_2025_001';

-- Step 2: 记录消耗
INSERT INTO material_consumptions (
    factory_id,
    production_plan_id,
    production_batch_id,
    batch_id,
    quantity,
    unit_price,
    total_cost,
    consumption_time,
    consumed_at,
    recorded_by,
    notes,
    created_at,
    updated_at
) VALUES (
    'FISH_2025_001',
    'uuid-plan-001',
    'uuid-prod-batch-001',
    'uuid-batch-001',
    95.00,                          -- 消耗数量
    45.50,                          -- 单价（从批次获取）
    95.00 * 45.50,                  -- 总成本 = 4322.50元
    NOW(),
    NOW(),
    1,                              -- 记录人
    '生产批次 BATCH-001 消耗',
    NOW(),
    NOW()
);

-- Step 3: 更新批次状态
UPDATE material_batches
SET status = CASE
    -- 已用完
    WHEN used_quantity >= receipt_quantity THEN 'USED_UP'
    -- 剩余为0但还有预留
    WHEN (receipt_quantity - used_quantity - reserved_quantity) = 0
         AND reserved_quantity > 0 THEN 'DEPLETED'
    -- 还有剩余，恢复可用
    WHEN (receipt_quantity - used_quantity - reserved_quantity) > 0 THEN 'AVAILABLE'
    ELSE status
END,
updated_at = NOW()
WHERE id = 'uuid-batch-001';

COMMIT;

-- Step 4: 验证消耗
SELECT
    batch_number,
    receipt_quantity,
    used_quantity,
    reserved_quantity,
    receipt_quantity - used_quantity - reserved_quantity AS current_quantity,
    unit_price * used_quantity AS used_cost,
    status
FROM material_batches
WHERE id = 'uuid-batch-001';

-- 预期结果:
-- receipt_quantity = 500.00
-- used_quantity = 95.00
-- reserved_quantity = 0.00
-- current_quantity = 405.00
-- used_cost = 4322.50 元
-- status = AVAILABLE
```

---

### 5. 库存调整（报损/报溢）

**业务场景**: 盘点发现数量与记录不符，需要调整。

**SQL 示例**:

```sql
-- 报损示例：发现10kg三文鱼损坏
START TRANSACTION;

-- Step 1: 获取调整前数量
SET @quantity_before = (
    SELECT receipt_quantity
    FROM material_batches
    WHERE id = 'uuid-batch-001'
);

-- Step 2: 更新批次数量
UPDATE material_batches
SET
    receipt_quantity = receipt_quantity - 10.00,
    updated_at = NOW()
WHERE id = 'uuid-batch-001';

-- Step 3: 记录调整
INSERT INTO material_batch_adjustments (
    id,
    material_batch_id,
    adjustment_type,
    quantity_before,
    adjustment_quantity,
    quantity_after,
    reason,
    adjustment_time,
    adjusted_by,
    notes,
    created_at,
    updated_at
) VALUES (
    UUID(),
    'uuid-batch-001',
    'loss',                        -- 报损
    @quantity_before,              -- 调整前: 500.00
    -10.00,                        -- 调整量: -10.00 (负数表示减少)
    @quantity_before - 10.00,      -- 调整后: 490.00
    '冷库温度异常导致部分三文鱼变质',
    NOW(),
    1,                             -- 调整人
    '已报废处理',
    NOW(),
    NOW()
);

COMMIT;

-- 验证调整
SELECT
    batch_number,
    receipt_quantity,
    used_quantity,
    receipt_quantity - used_quantity - reserved_quantity AS current_quantity
FROM material_batches
WHERE id = 'uuid-batch-001';

-- 预期结果:
-- receipt_quantity = 490.00 (原500 - 报损10)
-- current_quantity = 395.00 (原405 - 报损10)
```

---

### 6. 过期检查（定时任务）

**业务场景**: 每天凌晨1点自动检查过期批次。

**Cron Job SQL**:

```sql
-- 标记过期批次
UPDATE material_batches
SET
    status = 'EXPIRED',
    updated_at = NOW()
WHERE expire_date < CURDATE()
  AND status NOT IN ('USED_UP', 'EXPIRED', 'SCRAPPED');

-- 记录过期日志
INSERT INTO system_logs (event_type, message, created_at)
SELECT
    'MATERIAL_EXPIRED',
    CONCAT('批次 ', batch_number, ' 已过期，原材料：', material_type_id),
    NOW()
FROM material_batches
WHERE status = 'EXPIRED'
  AND DATE(updated_at) = CURDATE();
```

---

## SQL示例

### 基础查询

#### 1. 查询工厂所有原材料批次

```sql
SELECT
    mb.id,
    mb.batch_number,
    rmt.name AS material_name,
    rmt.category AS material_category,
    s.name AS supplier_name,
    mb.receipt_date,
    mb.expire_date,
    mb.receipt_quantity,
    mb.quantity_unit,
    mb.used_quantity,
    mb.reserved_quantity,
    mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity AS current_quantity,
    mb.unit_price,
    mb.unit_price * mb.receipt_quantity AS total_value,
    mb.status,
    mb.storage_location,
    u.full_name AS created_by_name,
    mb.created_at
FROM material_batches mb
LEFT JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
LEFT JOIN suppliers s ON mb.supplier_id = s.id
LEFT JOIN users u ON mb.created_by = u.id
WHERE mb.factory_id = 'FISH_2025_001'
ORDER BY mb.receipt_date DESC, mb.batch_number DESC;
```

---

#### 2. 查询可用库存（FIFO发料）

```sql
-- FIFO (First In First Out): 先进先出原则
SELECT
    mb.id,
    mb.batch_number,
    rmt.name AS material_name,
    mb.receipt_date,
    mb.expire_date,
    DATEDIFF(mb.expire_date, CURDATE()) AS remaining_days,
    mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity AS available_quantity,
    mb.quantity_unit,
    mb.unit_price,
    mb.storage_location
FROM material_batches mb
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
WHERE mb.factory_id = 'FISH_2025_001'
  AND mb.status = 'AVAILABLE'
  AND (mb.expire_date IS NULL OR mb.expire_date >= CURDATE())
  AND (mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) > 0
ORDER BY
    mb.expire_date ASC,   -- 先过期的先发
    mb.receipt_date ASC   -- 先入库的先发
LIMIT 20;
```

---

### 库存统计

#### 3. 原材料库存汇总

```sql
SELECT
    rmt.id AS material_type_id,
    rmt.code AS material_code,
    rmt.name AS material_name,
    rmt.category AS material_category,
    rmt.unit,
    COUNT(mb.id) AS batch_count,
    SUM(mb.receipt_quantity) AS total_receipt,
    SUM(mb.used_quantity) AS total_used,
    SUM(mb.reserved_quantity) AS total_reserved,
    SUM(mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) AS total_available,
    SUM(mb.unit_price * mb.receipt_quantity) AS total_value,
    SUM(mb.unit_price * (mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity)) AS available_value
FROM material_batches mb
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
WHERE mb.factory_id = 'FISH_2025_001'
  AND mb.status IN ('AVAILABLE', 'RESERVED', 'DEPLETED')
GROUP BY rmt.id, rmt.code, rmt.name, rmt.category, rmt.unit
ORDER BY available_value DESC;
```

---

#### 4. 即将过期预警

```sql
-- 查询未来7天将过期的批次
SELECT
    mb.id,
    mb.batch_number,
    rmt.name AS material_name,
    mb.expire_date,
    DATEDIFF(mb.expire_date, CURDATE()) AS days_until_expire,
    mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity AS available_quantity,
    mb.quantity_unit,
    mb.unit_price * (mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) AS available_value,
    mb.storage_location,
    mb.status
FROM material_batches mb
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
WHERE mb.factory_id = 'FISH_2025_001'
  AND mb.expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND mb.status IN ('AVAILABLE', 'RESERVED')
  AND (mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) > 0
ORDER BY mb.expire_date ASC, available_value DESC;
```

---

### 成本分析

#### 5. 原材料消耗成本分析

```sql
-- 按月统计原材料消耗成本
SELECT
    DATE_FORMAT(mc.consumption_time, '%Y-%m') AS month,
    rmt.name AS material_name,
    rmt.category AS material_category,
    COUNT(DISTINCT mc.batch_id) AS batch_count,
    SUM(mc.quantity) AS total_consumed_qty,
    rmt.unit,
    SUM(mc.total_cost) AS total_cost,
    AVG(mc.unit_price) AS avg_unit_price
FROM material_consumptions mc
JOIN material_batches mb ON mc.batch_id = mb.id
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
WHERE mc.factory_id = 'FISH_2025_001'
  AND mc.consumption_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
GROUP BY
    DATE_FORMAT(mc.consumption_time, '%Y-%m'),
    rmt.id,
    rmt.name,
    rmt.category,
    rmt.unit
ORDER BY month DESC, total_cost DESC;
```

---

#### 6. 批次成本明细

```sql
-- 查询单个批次的完整成本明细
SELECT
    mb.batch_number,
    rmt.name AS material_name,
    s.name AS supplier_name,
    mb.receipt_date,
    mb.receipt_quantity AS initial_qty,
    mb.used_quantity,
    mb.reserved_quantity,
    mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity AS current_qty,
    mb.quantity_unit,
    mb.unit_price,
    mb.unit_price * mb.receipt_quantity AS total_value,
    mb.unit_price * mb.used_quantity AS used_value,
    mb.unit_price * (mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) AS remaining_value,
    -- 消耗次数
    (SELECT COUNT(*) FROM material_consumptions WHERE batch_id = mb.id) AS consumption_count,
    -- 调整次数
    (SELECT COUNT(*) FROM material_batch_adjustments WHERE material_batch_id = mb.id) AS adjustment_count,
    mb.status,
    mb.last_used_at
FROM material_batches mb
LEFT JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
LEFT JOIN suppliers s ON mb.supplier_id = s.id
WHERE mb.batch_number = 'MAT-20251120-001';
```

---

### 溯源查询

#### 7. 原材料消耗追溯（哪些产品用了这批原材料）

```sql
-- 查询批次 MAT-20251120-001 被用在了哪些产品中
SELECT
    mc.consumption_time,
    pp.plan_number,
    pp.product_name,
    pb.batch_number AS production_batch_number,
    mc.quantity AS consumed_qty,
    mb.quantity_unit,
    mc.total_cost,
    u.full_name AS recorded_by_name,
    mc.notes
FROM material_consumptions mc
JOIN material_batches mb ON mc.batch_id = mb.id
LEFT JOIN production_plans pp ON mc.production_plan_id = pp.id
LEFT JOIN processing_batches pb ON mc.production_batch_id = pb.id
LEFT JOIN users u ON mc.recorded_by = u.id
WHERE mb.batch_number = 'MAT-20251120-001'
ORDER BY mc.consumption_time DESC;
```

---

#### 8. 产品原材料来源追溯（这个产品用了哪些批次的原材料）

```sql
-- 查询生产批次 BATCH-001 使用了哪些原材料
SELECT
    mb.batch_number,
    rmt.name AS material_name,
    s.name AS supplier_name,
    mb.receipt_date,
    mb.expire_date,
    mc.quantity AS consumed_qty,
    mb.quantity_unit,
    mc.unit_price,
    mc.total_cost,
    mc.consumption_time,
    mb.quality_certificate
FROM material_consumptions mc
JOIN material_batches mb ON mc.batch_id = mb.id
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
LEFT JOIN suppliers s ON mb.supplier_id = s.id
WHERE mc.production_batch_id = 'uuid-prod-batch-001'
ORDER BY mc.consumption_time ASC;
```

---

### 数据完整性检查

#### 9. 检查数量异常

```sql
-- 检查数量逻辑错误
SELECT
    batch_number,
    receipt_quantity,
    used_quantity,
    reserved_quantity,
    receipt_quantity - used_quantity - reserved_quantity AS calculated_current,
    status,
    CASE
        WHEN used_quantity < 0 THEN '已用数量为负数'
        WHEN reserved_quantity < 0 THEN '预留数量为负数'
        WHEN used_quantity + reserved_quantity > receipt_quantity THEN '已用+预留 > 入库数量'
        WHEN status = 'USED_UP' AND used_quantity < receipt_quantity THEN '状态为已用完但数量不符'
        WHEN status = 'DEPLETED' AND (receipt_quantity - used_quantity - reserved_quantity) != 0 THEN '状态为耗尽但剩余不为0'
        ELSE 'OK'
    END AS error_type
FROM material_batches
WHERE factory_id = 'FISH_2025_001'
HAVING error_type != 'OK';
```

---

#### 10. 检查过期状态

```sql
-- 检查过期日期与状态不一致
SELECT
    batch_number,
    expire_date,
    DATEDIFF(expire_date, CURDATE()) AS days_diff,
    status,
    '已过期但状态未更新' AS issue
FROM material_batches
WHERE factory_id = 'FISH_2025_001'
  AND expire_date < CURDATE()
  AND status NOT IN ('EXPIRED', 'USED_UP', 'SCRAPPED')
UNION ALL
SELECT
    batch_number,
    expire_date,
    DATEDIFF(expire_date, CURDATE()),
    status,
    '未过期但状态为已过期' AS issue
FROM material_batches
WHERE factory_id = 'FISH_2025_001'
  AND (expire_date IS NULL OR expire_date >= CURDATE())
  AND status = 'EXPIRED';
```

---

### 复杂分析

#### 11. 库存周转率分析

```sql
-- 计算每种原材料的库存周转天数
SELECT
    rmt.name AS material_name,
    rmt.category AS material_category,
    -- 平均库存（过去30天）
    AVG(mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) AS avg_inventory,
    -- 总消耗量（过去30天）
    COALESCE(SUM(mc.quantity), 0) AS total_consumed,
    -- 库存周转率 = 消耗量 / 平均库存
    CASE
        WHEN AVG(mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) > 0
        THEN COALESCE(SUM(mc.quantity), 0) / AVG(mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity)
        ELSE 0
    END AS turnover_rate,
    -- 库存周转天数 = 30 / 周转率
    CASE
        WHEN COALESCE(SUM(mc.quantity), 0) > 0
        THEN 30.0 * AVG(mb.receipt_quantity - mb.used_quantity - mb.reserved_quantity) / COALESCE(SUM(mc.quantity), 1)
        ELSE 999
    END AS days_of_inventory,
    rmt.unit
FROM material_batches mb
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
LEFT JOIN material_consumptions mc ON mc.batch_id = mb.id
    AND mc.consumption_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE mb.factory_id = 'FISH_2025_001'
  AND mb.status IN ('AVAILABLE', 'RESERVED', 'DEPLETED')
GROUP BY rmt.id, rmt.name, rmt.category, rmt.unit
HAVING avg_inventory > 0
ORDER BY days_of_inventory ASC;
```

---

#### 12. 原材料使用效率

```sql
-- 分析原材料使用效率（调整次数、报损率）
SELECT
    mb.batch_number,
    rmt.name AS material_name,
    mb.receipt_quantity AS initial_qty,
    -- 调整总量
    COALESCE(SUM(mba.adjustment_quantity), 0) AS total_adjustment,
    -- 报损数量
    COALESCE(SUM(CASE WHEN mba.adjustment_type = 'loss' THEN mba.adjustment_quantity ELSE 0 END), 0) AS loss_qty,
    -- 报损率
    CASE
        WHEN mb.receipt_quantity > 0
        THEN ABS(COALESCE(SUM(CASE WHEN mba.adjustment_type = 'loss' THEN mba.adjustment_quantity ELSE 0 END), 0)) / mb.receipt_quantity * 100
        ELSE 0
    END AS loss_rate,
    -- 调整次数
    COUNT(mba.id) AS adjustment_count,
    mb.quantity_unit
FROM material_batches mb
JOIN raw_material_types rmt ON mb.material_type_id = rmt.id
LEFT JOIN material_batch_adjustments mba ON mba.material_batch_id = mb.id
WHERE mb.factory_id = 'FISH_2025_001'
  AND mb.receipt_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
GROUP BY mb.id, mb.batch_number, rmt.name, mb.receipt_quantity, mb.quantity_unit
HAVING adjustment_count > 0
ORDER BY loss_rate DESC;
```

---

## 业务规则总结

### 数量管理规则

1. **数量约束**:
   - `receipt_quantity > 0` (入库数量必须 > 0)
   - `used_quantity >= 0` (已用数量不能为负)
   - `reserved_quantity >= 0` (预留数量不能为负)
   - `used_quantity + reserved_quantity <= receipt_quantity` (已用+预留 ≤ 入库)

2. **当前可用数量计算**:
   ```
   currentQuantity = receiptQuantity - usedQuantity - reservedQuantity
   ```

3. **预留和消耗流程**:
   ```
   预留: reserved_quantity += 预留量
   消耗: reserved_quantity -= 预留量, used_quantity += 实际消耗量
   注意: 实际消耗量可能 < 预留量（有损耗）
   ```

---

### 状态转换规则

1. **入库时状态**:
   - 鲜品（fresh存储） → `FRESH`
   - 冻品（frozen存储） → `FROZEN`
   - 干货（dry存储） → `AVAILABLE`

2. **质检流程**:
   ```
   FRESH/FROZEN → INSPECTING → AVAILABLE (通过)
                              → SCRAPPED (不通过)
   ```

3. **使用流程**:
   ```
   AVAILABLE → RESERVED (预留) → DEPLETED (消耗至剩余=0) → USED_UP (全部消耗)
   ```

4. **过期检查** (定时任务):
   ```
   if (expireDate < TODAY && status != USED_UP/EXPIRED/SCRAPPED) {
       status = EXPIRED
   }
   ```

5. **状态自动更新** (数量变化触发):
   ```java
   if (currentQuantity == 0 && reservedQuantity > 0) {
       status = DEPLETED;  // 剩余为0但还有预留
   } else if (usedQuantity >= receiptQuantity) {
       status = USED_UP;   // 全部消耗
   } else if (currentQuantity > 0 && status == RESERVED) {
       status = AVAILABLE; // 预留释放后恢复可用
   }
   ```

---

### FIFO原则（先进先出）

原材料发料必须遵循**FIFO原则**，优先使用：
1. **过期日期最早**的批次
2. **入库日期最早**的批次

```sql
-- FIFO排序
ORDER BY
    COALESCE(expire_date, '9999-12-31') ASC,  -- NULL视为永不过期
    receipt_date ASC,
    batch_number ASC
```

---

### 成本核算规则

1. **批次总价值**:
   ```
   totalValue = unitPrice × receiptQuantity
   ```

2. **消耗成本**:
   ```
   consumptionCost = unitPrice × consumedQuantity
   ```
   - 消耗时使用**批次的单价**（不是原材料类型的单价）
   - 确保追溯到实际采购成本

3. **剩余价值**:
   ```
   remainingValue = unitPrice × currentQuantity
   ```

---

### 调整规则

1. **调整类型**:
   - `loss` (报损): 损耗、过期、变质 → 减少 `receipt_quantity`
   - `damage` (报溢): 盘点发现多了 → 增加 `receipt_quantity`
   - `correction` (修正): 录入错误 → 正负均可
   - `return` (退货): 退回供应商 → 减少 `receipt_quantity`

2. **调整数据完整性**:
   ```java
   quantityAfter = quantityBefore + adjustmentQuantity
   ```
   - 必须记录调整前、调整量、调整后三个值
   - 必须记录调整原因和调整人

---

### 溯源规则

1. **向上溯源** (产品 → 原材料 → 供应商):
   ```
   ProcessingBatch → MaterialConsumption → MaterialBatch → Supplier
   ```

2. **向下溯源** (原材料 → 产品):
   ```
   MaterialBatch → MaterialConsumption → ProcessingBatch → 成品
   ```

3. **关键溯源字段**:
   - `batch_number` (批次号): 唯一标识
   - `supplier_id` (供应商): 原料来源
   - `receipt_date` (入库日期): 采购时间
   - `quality_certificate` (质量证书): 质检证明

---

### 安全规则

1. **不允许物理删除**:
   - MaterialBatch **不允许 DELETE**
   - 只能更新状态为 `SCRAPPED` (报废)
   - 原因: 食品溯源需要保留所有历史记录

2. **级联删除风险**:
   - 当前使用 `CascadeType.ALL` (包含 `REMOVE`)
   - ⚠️ 如果删除 MaterialBatch，会级联删除所有消耗记录！
   - **建议**: 移除 `CascadeType.REMOVE`，改为 `CascadeType.PERSIST, MERGE, REFRESH`

3. **数据完整性约束**:
   - 外键约束防止孤立数据
   - 唯一约束防止批次号重复
   - 检查约束防止数量异常

---

### 性能优化建议

1. **索引优化**:
   - 添加复合索引 `(factory_id, status)`
   - 添加复合索引 `(factory_id, material_type_id, status)`
   - 添加复合索引 `(factory_id, expire_date)`

2. **查询优化**:
   - 避免 `SELECT *`，只查询需要的字段
   - 使用 `@BatchSize` 注解解决N+1查询问题
   - 大数据量查询添加 `LIMIT` 分页

3. **定时任务优化**:
   - 过期检查使用 `idx_batch_expire` 索引
   - 批量更新使用事务
   - 避免在业务高峰期执行

---

**文档结束**

下一步：[PRD-Entity-ProductType（产品类型）](./PRD-Entity-ProductType.md)
