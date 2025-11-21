# PRD-Entity-ProductType（产品类型）

**实体名称**: ProductType
**数据库表名**: `product_types`
**核心程度**: ⭐⭐⭐⭐⭐ (产品定义的核心主数据)
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

**ProductType（产品类型）** 是白垩纪食品溯源系统中的**核心主数据实体**，定义了工厂可以生产的所有产品类型（SKU）。它是**产品目录**的基础，规定了产品的基本属性、生产参数、定价和包装规格。

### 核心作用

1. **产品目录管理**: 定义工厂的产品组合（如"冷冻鱼片"、"速冻虾仁"、"即食海参"）
2. **生产计划基础**: 生产计划必须基于已定义的产品类型
3. **原材料配方管理**: 通过 `MaterialProductConversion` 关联，定义哪些原材料可以生产这个产品
4. **成本核算**: 提供标准生产时长、转换率，用于成本估算
5. **定价基准**: 记录产品单价，用于销售和利润分析

### 生命周期

```
创建 → 配置转换率 → 启用 → 生产计划引用 → (可选)禁用
  ↓        ↓          ↓           ↓              ↓
NEW    CONFIGURED  ACTIVE     IN_USE         INACTIVE
```

**状态管理**:
- `isActive = true`: 产品启用，可以创建生产计划
- `isActive = false`: 产品禁用，不能新建计划（已有计划不受影响）

**注意**: ProductType **不应该删除**，只能禁用（`isActive = false`），因为：
1. 已有的生产计划会引用产品类型
2. 溯源系统需要保留历史产品信息

---

## 字段详情

### 主键和标识

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | VARCHAR(191) | PRIMARY KEY, NOT NULL | UUID | 产品类型唯一ID，使用UUID生成 |
| `code` | VARCHAR(50) | NOT NULL, UNIQUE(factory_id, code) | - | 产品编码，工厂内唯一 |

**产品编码规则** (`code`):
- 格式建议: `{类别代码}-{序号}` (例如：`FISH-001`, `SHRIMP-002`)
- 工厂内唯一（通过 `uniqueConstraints` 保证）
- 不可修改（一旦创建，不能更改）
- 用于对接外部系统（ERP、WMS等）

**示例**:

```java
// 三文鱼产品编码
code = "SALMON-FILLET-001"  // 三文鱼鱼片-001

// 虾产品编码
code = "SHRIMP-FROZEN-002"  // 速冻虾-002
```

---

### 基本信息

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `factory_id` | VARCHAR(191) | NOT NULL, FK → factories.id | - | 工厂ID，多租户隔离 |
| `name` | VARCHAR(191) | NOT NULL | - | 产品名称（中文，如"冷冻鱼片"） |
| `category` | VARCHAR(50) | NULL | - | 产品类别（如"冷冻水产"、"速冻食品"） |
| `unit` | VARCHAR(20) | NOT NULL | - | 计量单位（如：kg、箱、包） |
| `created_by` | INT | NOT NULL, FK → users.id | - | 创建人ID |

**字段说明**:
- `factory_id`: 多租户核心字段，确保数据隔离
- `name`: 产品显示名称，用于UI展示
- `category`: 产品分类，用于统计和筛选
  - 示例分类: "冷冻水产"、"速冻食品"、"即食产品"、"调理食品"
- `unit`: 销售/生产单位，必须与原材料单位匹配转换

---

### 价格和时间

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `unit_price` | DECIMAL(10,2) | NULL | - | 单价（元/单位），销售参考价 |
| `production_time_minutes` | INT | NULL | - | 标准生产时长（分钟） |
| `shelf_life_days` | INT | NULL | - | 保质期（天数） |

**价格说明**:
- `unit_price`: 销售参考价，实际销售价格由订单确定
- 用于利润分析：`利润 = 销售价 - 生产成本`

**生产时长**:
- `production_time_minutes`: 生产1单位产品的标准时长
- 用于生产计划排期、人工成本估算
- 示例: 生产1kg冷冻鱼片需要30分钟

**保质期**:
- `shelf_life_days`: 成品保质期天数
- 用于成品过期检查、库存周转分析
- 示例: 冷冻鱼片保质期365天

---

### 包装和状态

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `package_spec` | VARCHAR(100) | NULL | - | 包装规格（如"500g/袋，20袋/箱"） |
| `is_active` | BOOLEAN | NOT NULL | true | 是否启用（true=可用，false=禁用） |
| `notes` | TEXT | NULL | - | 备注说明 |

**包装规格示例**:

```
"500g/袋，20袋/箱"         // 小包装+箱装
"1kg真空包装"              // 单一包装
"2.5kg托盘装，冷冻保存"    // 托盘+存储要求
"散装，按公斤计量"          // 散装产品
```

**状态管理**:
- `isActive = true`: 产品可用，可以创建生产计划
- `isActive = false`: 产品已禁用，不能新建计划
- **禁用原因**: 停产、配方变更、法规限制等

---

### 审计字段（继承自 BaseEntity）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

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
                 ┌────────────┼────────────┐
                 │            │            │
                 │ N          │ N          │ N
         ┌───────▼──────┐    │     ┌──────▼─────┐
         │     User     │    │     │ProductType │
         │   (users)    │    │     │  (product_ │
         └──────────────┘    │     │   types)   │
                              │     │            │
                              │     │ • code     │
                              │     │ • name     │
                              │     │ • unitPrice│
                              │     └─────┬──────┘
                              │           │ 1
                              │           │
         ┌────────────────────┼───────────┼────────────────────┐
         │ N                  │ N         │ N                  │ N
         │                    │           │                    │
┌────────▼──────────┐  ┌──────▼──────┐  │         ┌──────────▼────────────┐
│MaterialProduct    │  │ Production  │  │         │  RawMaterialType      │
│  Conversion       │  │    Plan     │  │         │  (raw_material_types) │
│(material_product_ │  │(production_ │  │         └────────┬──────────────┘
│  conversions)     │  │   plans)    │  │                  │ 1
│                   │  │             │  │                  │
│ • conversionRate  │  │ • planNumber│  │                  │ N
│ • wastageRate     │  │ • quantity  │  └──────────────────┘
│ • standardUsage   │  │ • status    │
└───────────────────┘  └─────────────┘
         │ N
         │
         ▼ 1
┌─────────────────┐
│RawMaterialType  │
│(raw_material_   │
│     types)      │
└─────────────────┘
```

### N:1 关系（ProductType → 其他实体）

| 关联实体 | 外键字段 | 关系类型 | 说明 |
|----------|----------|----------|------|
| **Factory** | `factory_id` | N:1, LAZY | 所属工厂（多租户隔离） |
| **User** | `created_by` | N:1, LAZY | 创建人 |

**说明**:
- 所有关系使用 `FetchType.LAZY` 延迟加载
- `insertable=false, updatable=false` 避免双向绑定冲突

---

### 1:N 关系（ProductType → 子记录）

| 子实体 | 映射字段 | 级联策略 | 说明 |
|--------|----------|----------|------|
| **MaterialProductConversion** | `conversions` | CascadeType.ALL | 原材料转换率配置（配方） |
| **ProductionPlan** | `productionPlans` | CascadeType.ALL | 基于此产品的生产计划 |

**级联删除风险**:
- ⚠️ `CascadeType.ALL` 包含 `REMOVE`，删除产品类型会删除所有转换率配置和生产计划！
- **建议**: ProductType **不允许物理删除**，只能禁用（`isActive = false`）
- **原因**:
  1. 生产计划引用产品类型（历史追溯）
  2. 转换率配置是企业核心配方数据

---

### 关联实体详解

#### 1. MaterialProductConversion（原材料-产品转换率）

**业务含义**: 定义哪些原材料可以生产这个产品，以及转换比率（配方）。

**关键字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `material_type_id` | VARCHAR(191) | 原材料类型ID |
| `product_type_id` | VARCHAR(191) | 产品类型ID |
| `conversion_rate` | DECIMAL(10,4) | 转换率（1单位原材料 → X单位产品） |
| `wastage_rate` | DECIMAL(5,2) | 损耗率（百分比，0-100） |
| `standard_usage` | DECIMAL(10,4) | 标准用量（生产1单位产品需要的原材料数量） |
| `min_batch_size` | DECIMAL(10,2) | 最小批量 |
| `max_batch_size` | DECIMAL(10,2) | 最大批量 |

**核心公式**:

```java
// 转换率和标准用量互为倒数
standardUsage = 1 / conversionRate

// 实际用量 = 标准用量 × (1 + 损耗率)
actualUsage = standardUsage × quantity × (1 + wastageRate / 100)
```

**示例**:

```sql
-- 三文鱼 → 冷冻鱼片
INSERT INTO material_product_conversions (
    factory_id, material_type_id, product_type_id,
    conversion_rate, wastage_rate, standard_usage
) VALUES (
    'FISH_2025_001',
    'uuid-material-salmon',        -- 三文鱼
    'uuid-product-fillet',         -- 冷冻鱼片
    0.75,                          -- 转换率: 1kg三文鱼 → 0.75kg鱼片
    5.00,                          -- 损耗率: 5%
    1.3333                         -- 标准用量: 1 / 0.75 = 1.33kg (生产1kg鱼片需要1.33kg三文鱼)
);

-- 计算实际用量（生产100kg鱼片）
-- 标准用量: 100kg × 1.3333 = 133.33kg
-- 加上5%损耗: 133.33kg × (1 + 5/100) = 140kg 三文鱼
```

**唯一约束**: `(factory_id, material_type_id, product_type_id)` 三元组唯一
- 同一工厂，同一原材料和产品组合，只能有一条转换率记录

---

#### 2. ProductionPlan（生产计划）

**业务含义**: 基于某个产品类型创建的生产计划。

**关键字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `product_type_id` | VARCHAR(191) | 产品类型ID（FK） |
| `plan_number` | VARCHAR(50) | 计划编号（唯一） |
| `planned_quantity` | DECIMAL(10,2) | 计划生产数量 |
| `actual_quantity` | DECIMAL(10,2) | 实际生产数量 |
| `status` | ENUM | 计划状态（PENDING/IN_PROGRESS/COMPLETED/CANCELLED） |
| `estimated_material_cost` | DECIMAL(10,2) | 预估原材料成本 |
| `actual_material_cost` | DECIMAL(10,2) | 实际原材料成本 |

**业务逻辑**:
```java
// 创建生产计划时自动计算预估成本
估计原材料成本 = SUM(原材料单价 × 标准用量 × 计划数量 × (1 + 损耗率))
估计人工成本 = 计划数量 × 标准生产时长 × 人工单价
估计总成本 = 估计原材料成本 + 估计人工成本 + 估计设备成本 + 其他成本
```

**约束条件**:
- 只能选择 `isActive = true` 的产品类型
- 计划数量必须 > 0
- 必须有可用的原材料批次

---

## 索引设计

### 索引列表

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| `PRIMARY` | `id` | PRIMARY KEY | 主键索引（UUID） |
| `UNIQUE` | `(factory_id, code)` | UNIQUE CONSTRAINT | 产品编码工厂内唯一 |
| `idx_product_factory` | `factory_id` | INDEX | 工厂数据隔离（最常用） |
| `idx_product_is_active` | `is_active` | INDEX | 按启用状态筛选 |

---

### 索引使用场景

#### 1. `idx_product_factory` (工厂ID索引)

**最常用索引**，几乎所有查询都需要按工厂过滤。

```sql
-- 查询工厂所有产品类型
SELECT * FROM product_types
WHERE factory_id = 'FISH_2025_001'
ORDER BY category, code;
-- ✅ 使用索引: idx_product_factory

-- 工厂产品统计
SELECT
    category,
    COUNT(*) as product_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM product_types
WHERE factory_id = 'FISH_2025_001'
GROUP BY category;
-- ✅ 使用索引: idx_product_factory
```

---

#### 2. `idx_product_is_active` (启用状态索引)

用于筛选可用产品。

```sql
-- 查询所有启用的产品
SELECT * FROM product_types
WHERE is_active = true
ORDER BY category, name;
-- ✅ 使用索引: idx_product_is_active

-- 创建生产计划时，只能选择启用的产品
SELECT id, code, name, unit_price
FROM product_types
WHERE factory_id = 'FISH_2025_001'
  AND is_active = true
ORDER BY category, name;
-- ✅ 使用索引: idx_product_factory (优先级更高，因为工厂过滤更严格)
```

---

#### 3. `UNIQUE (factory_id, code)` (唯一约束)

保证产品编码在工厂内唯一。

```sql
-- 插入产品时自动检查编码唯一性
INSERT INTO product_types (id, factory_id, code, name, unit, is_active, created_by)
VALUES (UUID(), 'FISH_2025_001', 'SALMON-001', '冷冻鱼片', 'kg', true, 1);
-- ✅ 成功

-- 重复编码报错
INSERT INTO product_types (id, factory_id, code, name, unit, is_active, created_by)
VALUES (UUID(), 'FISH_2025_001', 'SALMON-001', '鱼片', 'kg', true, 1);
-- ❌ 错误: Duplicate entry 'FISH_2025_001-SALMON-001' for key 'product_types.UNIQUE'
```

---

### 复合索引建议

当前索引设计可能存在优化空间，建议添加：

```sql
-- 1. 工厂+启用状态复合索引（最常用组合）
CREATE INDEX idx_product_factory_active
ON product_types(factory_id, is_active);

-- 2. 工厂+类别复合索引（分类查询）
CREATE INDEX idx_product_factory_category
ON product_types(factory_id, category);
```

---

## 数据流程

### 1. 创建产品类型

**业务场景**: 工厂管理员定义新产品。

**数据流**:

```
定义产品 → 录入基本信息 → 配置转换率 → 启用产品 → 可用于生产计划
```

**SQL 示例**:

```sql
-- Step 1: 创建产品类型
INSERT INTO product_types (
    id,
    factory_id,
    code,
    name,
    category,
    unit,
    unit_price,
    production_time_minutes,
    shelf_life_days,
    package_spec,
    is_active,
    notes,
    created_by,
    created_at,
    updated_at
) VALUES (
    'uuid-product-salmon-fillet',      -- id
    'FISH_2025_001',                   -- factory_id
    'SALMON-FILLET-001',               -- code (工厂内唯一)
    '冷冻三文鱼鱼片',                   -- name
    '冷冻水产',                         -- category
    'kg',                              -- unit
    98.00,                             -- unit_price (元/kg)
    30,                                -- production_time_minutes (30分钟/kg)
    365,                               -- shelf_life_days (1年保质期)
    '500g/袋，20袋/箱，冷冻-18℃保存',  -- package_spec
    true,                              -- is_active
    '优质三文鱼鱼片，适合烤、煎、蒸',   -- notes
    1,                                 -- created_by
    NOW(),
    NOW()
);

-- Step 2: 配置转换率（三文鱼原材料 → 冷冻鱼片）
INSERT INTO material_product_conversions (
    factory_id,
    material_type_id,
    product_type_id,
    conversion_rate,
    wastage_rate,
    standard_usage,
    min_batch_size,
    max_batch_size,
    is_active,
    created_by,
    created_at,
    updated_at
) VALUES (
    'FISH_2025_001',
    'uuid-material-salmon',            -- 三文鱼原材料
    'uuid-product-salmon-fillet',      -- 冷冻鱼片产品
    0.75,                              -- 转换率: 1kg三文鱼 → 0.75kg鱼片 (75%出成率)
    5.00,                              -- 损耗率: 5%
    1.3333,                            -- 标准用量: 1 / 0.75 (自动计算)
    50.00,                             -- 最小批量: 50kg
    500.00,                            -- 最大批量: 500kg
    true,
    1,
    NOW(),
    NOW()
);

-- Step 3: 验证创建
SELECT
    pt.code,
    pt.name,
    pt.category,
    pt.unit_price,
    pt.production_time_minutes,
    pt.shelf_life_days,
    -- 转换率信息
    (SELECT COUNT(*) FROM material_product_conversions
     WHERE product_type_id = pt.id) AS conversion_count
FROM product_types pt
WHERE pt.code = 'SALMON-FILLET-001';
```

---

### 2. 禁用产品类型

**业务场景**: 产品停产，禁用但保留数据。

```sql
-- 禁用产品
UPDATE product_types
SET
    is_active = false,
    notes = CONCAT(notes, '\n[2025-11-20] 产品已停产，不再接受新订单'),
    updated_at = NOW()
WHERE id = 'uuid-product-salmon-fillet'
  AND factory_id = 'FISH_2025_001';

-- 同时禁用所有转换率配置
UPDATE material_product_conversions
SET
    is_active = false,
    updated_at = NOW()
WHERE product_type_id = 'uuid-product-salmon-fillet';

-- 验证（已有生产计划不受影响）
SELECT
    pt.name AS product_name,
    pt.is_active AS product_active,
    pp.plan_number,
    pp.status AS plan_status,
    pp.planned_quantity
FROM production_plans pp
JOIN product_types pt ON pp.product_type_id = pt.id
WHERE pt.id = 'uuid-product-salmon-fillet'
ORDER BY pp.created_at DESC
LIMIT 5;

-- 预期结果: 产品已禁用，但历史生产计划仍然可见
```

---

### 3. 查询产品配方（转换率配置）

**业务场景**: 查看生产某个产品需要哪些原材料。

```sql
-- 查询产品的完整配方
SELECT
    pt.code AS product_code,
    pt.name AS product_name,
    pt.unit AS product_unit,
    rmt.code AS material_code,
    rmt.name AS material_name,
    rmt.unit AS material_unit,
    mpc.conversion_rate,
    mpc.wastage_rate,
    mpc.standard_usage,
    -- 计算生产100kg产品需要的原材料
    ROUND(100 * mpc.standard_usage * (1 + mpc.wastage_rate / 100), 2) AS material_needed_for_100kg,
    mpc.min_batch_size,
    mpc.max_batch_size
FROM product_types pt
JOIN material_product_conversions mpc ON pt.id = mpc.product_type_id
JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
WHERE pt.code = 'SALMON-FILLET-001'
  AND mpc.is_active = true
ORDER BY rmt.name;

-- 预期结果示例:
-- product_code: SALMON-FILLET-001
-- product_name: 冷冻三文鱼鱼片
-- material_name: 三文鱼
-- conversion_rate: 0.75 (1kg三文鱼 → 0.75kg鱼片)
-- wastage_rate: 5.00% (5%损耗)
-- standard_usage: 1.3333 (生产1kg鱼片需要1.33kg三文鱼)
-- material_needed_for_100kg: 140.00 kg (100 × 1.3333 × 1.05 = 140kg)
```

---

### 4. 创建生产计划时的产品选择

**业务场景**: 创建生产计划，只能选择启用的产品。

```sql
-- 查询可用产品（带库存和成本信息）
SELECT
    pt.id,
    pt.code,
    pt.name,
    pt.category,
    pt.unit,
    pt.unit_price,
    pt.production_time_minutes,
    -- 配方数量
    (SELECT COUNT(*)
     FROM material_product_conversions mpc
     WHERE mpc.product_type_id = pt.id
       AND mpc.is_active = true) AS conversion_count,
    -- 最近生产记录
    (SELECT MAX(pp.created_at)
     FROM production_plans pp
     WHERE pp.product_type_id = pt.id
       AND pp.status = 'COMPLETED') AS last_production_date,
    -- 最近生产数量
    (SELECT SUM(pp.actual_quantity)
     FROM production_plans pp
     WHERE pp.product_type_id = pt.id
       AND pp.status = 'COMPLETED'
       AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS last_30d_quantity
FROM product_types pt
WHERE pt.factory_id = 'FISH_2025_001'
  AND pt.is_active = true
ORDER BY pt.category, pt.code;
```

---

## SQL示例

### 基础查询

#### 1. 查询工厂所有产品

```sql
SELECT
    pt.id,
    pt.code,
    pt.name,
    pt.category,
    pt.unit,
    pt.unit_price,
    pt.production_time_minutes,
    pt.shelf_life_days,
    pt.package_spec,
    pt.is_active,
    u.full_name AS created_by_name,
    pt.created_at,
    pt.updated_at,
    -- 统计信息
    (SELECT COUNT(*) FROM production_plans
     WHERE product_type_id = pt.id) AS total_plans,
    (SELECT COUNT(*) FROM production_plans
     WHERE product_type_id = pt.id AND status = 'COMPLETED') AS completed_plans
FROM product_types pt
LEFT JOIN users u ON pt.created_by = u.id
WHERE pt.factory_id = 'FISH_2025_001'
ORDER BY pt.category, pt.code;
```

---

#### 2. 按类别统计产品

```sql
SELECT
    category,
    COUNT(*) AS total_products,
    COUNT(CASE WHEN is_active = true THEN 1 END) AS active_products,
    COUNT(CASE WHEN is_active = false THEN 1 END) AS inactive_products,
    ROUND(AVG(unit_price), 2) AS avg_price,
    ROUND(AVG(production_time_minutes), 0) AS avg_production_time
FROM product_types
WHERE factory_id = 'FISH_2025_001'
GROUP BY category
ORDER BY total_products DESC;
```

---

### 转换率查询

#### 3. 查询产品配方（BOM - Bill of Materials）

```sql
-- 产品物料清单（BOM）
SELECT
    pt.code AS product_code,
    pt.name AS product_name,
    pt.unit AS product_unit,
    rmt.code AS material_code,
    rmt.name AS material_name,
    rmt.unit AS material_unit,
    rmt.unit_price AS material_unit_price,
    mpc.conversion_rate,
    mpc.wastage_rate,
    mpc.standard_usage,
    -- 生产成本估算（1单位产品）
    ROUND(mpc.standard_usage * (1 + mpc.wastage_rate / 100) * rmt.unit_price, 2) AS material_cost_per_unit
FROM product_types pt
JOIN material_product_conversions mpc ON pt.id = mpc.product_type_id
JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
WHERE pt.factory_id = 'FISH_2025_001'
  AND pt.is_active = true
  AND mpc.is_active = true
ORDER BY pt.category, pt.code, rmt.name;
```

---

#### 4. 计算生产指定数量产品所需原材料

```sql
-- 计算生产1000kg冷冻鱼片需要的原材料
SET @product_code = 'SALMON-FILLET-001';
SET @target_quantity = 1000;

SELECT
    pt.name AS product_name,
    @target_quantity AS target_quantity,
    pt.unit AS product_unit,
    rmt.name AS material_name,
    rmt.unit AS material_unit,
    mpc.standard_usage AS standard_usage_per_unit,
    mpc.wastage_rate,
    -- 标准用量（不含损耗）
    ROUND(@target_quantity * mpc.standard_usage, 2) AS standard_material_qty,
    -- 实际用量（含损耗）
    ROUND(@target_quantity * mpc.standard_usage * (1 + mpc.wastage_rate / 100), 2) AS actual_material_qty,
    rmt.unit_price AS material_unit_price,
    -- 原材料成本
    ROUND(@target_quantity * mpc.standard_usage * (1 + mpc.wastage_rate / 100) * rmt.unit_price, 2) AS total_material_cost
FROM product_types pt
JOIN material_product_conversions mpc ON pt.id = mpc.product_type_id
JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
WHERE pt.code = @product_code
  AND mpc.is_active = true;

-- 预期结果（假设三文鱼45.5元/kg）:
-- product_name: 冷冻三文鱼鱼片
-- target_quantity: 1000 kg
-- material_name: 三文鱼
-- standard_usage_per_unit: 1.3333
-- wastage_rate: 5.00%
-- standard_material_qty: 1333.30 kg
-- actual_material_qty: 1400.00 kg (含5%损耗)
-- material_unit_price: 45.50 元/kg
-- total_material_cost: 63,700.00 元
```

---

### 生产统计

#### 5. 产品生产量统计（按月）

```sql
-- 按月统计各产品生产量
SELECT
    DATE_FORMAT(pp.created_at, '%Y-%m') AS month,
    pt.category,
    pt.name AS product_name,
    pt.unit,
    COUNT(pp.id) AS plan_count,
    SUM(pp.planned_quantity) AS total_planned,
    SUM(pp.actual_quantity) AS total_actual,
    ROUND(AVG(pp.actual_quantity / NULLIF(pp.planned_quantity, 0)) * 100, 2) AS avg_completion_rate,
    -- 估算总成本
    SUM(pp.actual_material_cost + pp.actual_labor_cost + pp.actual_equipment_cost + pp.actual_other_cost) AS total_cost
FROM production_plans pp
JOIN product_types pt ON pp.product_type_id = pt.id
WHERE pp.factory_id = 'FISH_2025_001'
  AND pp.status = 'COMPLETED'
  AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY
    DATE_FORMAT(pp.created_at, '%Y-%m'),
    pt.id,
    pt.category,
    pt.name,
    pt.unit
ORDER BY month DESC, total_actual DESC;
```

---

#### 6. 产品利润分析

```sql
-- 产品利润分析（销售价 - 生产成本）
SELECT
    pt.code,
    pt.name AS product_name,
    pt.unit_price AS selling_price,
    -- 原材料成本（从BOM计算）
    (SELECT SUM(mpc.standard_usage * (1 + mpc.wastage_rate / 100) * rmt.unit_price)
     FROM material_product_conversions mpc
     JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
     WHERE mpc.product_type_id = pt.id
       AND mpc.is_active = true) AS material_cost,
    -- 人工成本估算（生产时长 × 平均工资）
    ROUND(pt.production_time_minutes / 60.0 * 50, 2) AS estimated_labor_cost,
    -- 总成本
    ROUND(
        (SELECT SUM(mpc.standard_usage * (1 + mpc.wastage_rate / 100) * rmt.unit_price)
         FROM material_product_conversions mpc
         JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
         WHERE mpc.product_type_id = pt.id
           AND mpc.is_active = true)
        + pt.production_time_minutes / 60.0 * 50,
    2) AS total_cost,
    -- 利润
    ROUND(
        pt.unit_price -
        (SELECT SUM(mpc.standard_usage * (1 + mpc.wastage_rate / 100) * rmt.unit_price)
         FROM material_product_conversions mpc
         JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
         WHERE mpc.product_type_id = pt.id
           AND mpc.is_active = true)
        - pt.production_time_minutes / 60.0 * 50,
    2) AS profit,
    -- 利润率
    ROUND(
        (pt.unit_price -
         (SELECT SUM(mpc.standard_usage * (1 + mpc.wastage_rate / 100) * rmt.unit_price)
          FROM material_product_conversions mpc
          JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
          WHERE mpc.product_type_id = pt.id
            AND mpc.is_active = true)
         - pt.production_time_minutes / 60.0 * 50)
        / NULLIF(pt.unit_price, 0) * 100,
    2) AS profit_margin_percent
FROM product_types pt
WHERE pt.factory_id = 'FISH_2025_001'
  AND pt.is_active = true
  AND pt.unit_price IS NOT NULL
ORDER BY profit_margin_percent DESC;
```

---

### 数据完整性检查

#### 7. 检查产品配置完整性

```sql
-- 检查产品是否配置了转换率
SELECT
    pt.code,
    pt.name,
    pt.is_active,
    (SELECT COUNT(*) FROM material_product_conversions
     WHERE product_type_id = pt.id AND is_active = true) AS conversion_count,
    CASE
        WHEN (SELECT COUNT(*) FROM material_product_conversions
              WHERE product_type_id = pt.id AND is_active = true) = 0
        THEN '缺少配方配置'
        WHEN pt.unit_price IS NULL THEN '缺少单价'
        WHEN pt.production_time_minutes IS NULL THEN '缺少生产时长'
        ELSE 'OK'
    END AS config_status
FROM product_types pt
WHERE pt.factory_id = 'FISH_2025_001'
HAVING config_status != 'OK'
ORDER BY pt.is_active DESC, pt.code;
```

---

#### 8. 检查转换率逻辑错误

```sql
-- 检查转换率配置异常
SELECT
    mpc.id,
    pt.code AS product_code,
    pt.name AS product_name,
    rmt.name AS material_name,
    mpc.conversion_rate,
    mpc.standard_usage,
    1.0 / mpc.conversion_rate AS calculated_standard_usage,
    ABS(mpc.standard_usage - 1.0 / mpc.conversion_rate) AS diff,
    CASE
        WHEN mpc.conversion_rate <= 0 THEN '转换率必须>0'
        WHEN mpc.wastage_rate < 0 OR mpc.wastage_rate > 100 THEN '损耗率范围0-100'
        WHEN ABS(mpc.standard_usage - 1.0 / mpc.conversion_rate) > 0.01 THEN '标准用量与转换率不匹配'
        WHEN mpc.min_batch_size > mpc.max_batch_size THEN '最小批量>最大批量'
        ELSE 'OK'
    END AS error_type
FROM material_product_conversions mpc
JOIN product_types pt ON mpc.product_type_id = pt.id
JOIN raw_material_types rmt ON mpc.material_type_id = rmt.id
WHERE mpc.factory_id = 'FISH_2025_001'
HAVING error_type != 'OK';
```

---

### 高级分析

#### 9. 产品生产效率分析

```sql
-- 分析产品生产效率（实际生产时长 vs 标准时长）
SELECT
    pt.code,
    pt.name AS product_name,
    pt.production_time_minutes AS standard_time,
    -- 实际生产时长（从加工批次计算）
    ROUND(AVG(TIMESTAMPDIFF(MINUTE, pb.start_time, pb.end_time) /
              NULLIF(pb.output_quantity, 0)), 2) AS avg_actual_time_per_unit,
    -- 效率比
    ROUND(pt.production_time_minutes /
          NULLIF(AVG(TIMESTAMPDIFF(MINUTE, pb.start_time, pb.end_time) /
                     NULLIF(pb.output_quantity, 0)), 0) * 100, 2) AS efficiency_percent,
    COUNT(pb.id) AS sample_count
FROM product_types pt
LEFT JOIN processing_batches pb ON pt.name = pb.product_name
    AND pb.factory_id = pt.factory_id
    AND pb.status = 'COMPLETED'
    AND pb.start_time IS NOT NULL
    AND pb.end_time IS NOT NULL
WHERE pt.factory_id = 'FISH_2025_001'
  AND pt.production_time_minutes IS NOT NULL
GROUP BY pt.id, pt.code, pt.name, pt.production_time_minutes
HAVING sample_count > 0
ORDER BY efficiency_percent DESC;
```

---

#### 10. 产品库存周转分析

```sql
-- 产品库存周转率（假设有成品库存表 finished_goods_inventory）
-- 注：当前系统可能没有成品库存表，这里提供框架SQL
SELECT
    pt.code,
    pt.name AS product_name,
    pt.unit,
    -- 过去30天生产量
    (SELECT SUM(pp.actual_quantity)
     FROM production_plans pp
     WHERE pp.product_type_id = pt.id
       AND pp.status = 'COMPLETED'
       AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS last_30d_production,
    -- 平均库存（假设）
    100.00 AS avg_inventory,
    -- 周转率
    ROUND(
        (SELECT SUM(pp.actual_quantity)
         FROM production_plans pp
         WHERE pp.product_type_id = pt.id
           AND pp.status = 'COMPLETED'
           AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
        / NULLIF(100.00, 0),
    2) AS turnover_rate,
    -- 周转天数
    ROUND(30.0 * 100.00 /
          NULLIF((SELECT SUM(pp.actual_quantity)
                  FROM production_plans pp
                  WHERE pp.product_type_id = pt.id
                    AND pp.status = 'COMPLETED'
                    AND pp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0),
    2) AS days_of_inventory
FROM product_types pt
WHERE pt.factory_id = 'FISH_2025_001'
  AND pt.is_active = true
ORDER BY turnover_rate DESC;
```

---

## 业务规则总结

### 产品定义规则

1. **产品编码规则**:
   - 格式建议: `{类别}-{序号}` (如 `SALMON-FILLET-001`)
   - 工厂内唯一（通过唯一约束保证）
   - 不可修改（一旦创建，code不能更改）

2. **产品分类**:
   - 建议分类: "冷冻水产"、"速冻食品"、"即食产品"、"调理食品"
   - 用于报表统计和产品筛选

3. **单位管理**:
   - 产品单位必须与原材料单位兼容
   - 示例: 产品单位=kg, 原材料单位=kg → 转换率直接计算
   - 示例: 产品单位=箱, 原材料单位=kg → 需要定义每箱重量

---

### 转换率规则

1. **转换率计算**:
   ```
   conversion_rate = 产品产出量 / 原材料投入量
   standard_usage = 1 / conversion_rate
   ```

2. **实际用量计算**:
   ```
   实际用量 = 计划产量 × standard_usage × (1 + wastage_rate / 100)
   ```

3. **约束条件**:
   - `conversion_rate > 0`
   - `wastage_rate >= 0 AND wastage_rate <= 100`
   - `standard_usage = 1 / conversion_rate` (自动计算)
   - `min_batch_size <= max_batch_size`

---

### 启用/禁用规则

1. **启用产品** (`isActive = true`):
   - 可以创建新生产计划
   - 可以配置转换率
   - 出现在产品选择列表

2. **禁用产品** (`isActive = false`):
   - **不能**创建新生产计划
   - **可以**查看历史生产记录
   - **不会**删除已有数据

3. **删除规则**:
   - ❌ **不允许物理删除** ProductType
   - ✅ 只能禁用（`isActive = false`）
   - 原因: 保留历史生产计划引用

---

### 成本核算规则

1. **原材料成本**:
   ```
   原材料成本 = SUM(原材料单价 × 标准用量 × (1 + 损耗率) × 产量)
   ```

2. **人工成本**:
   ```
   人工成本 = 生产时长 × 产量 × 人工单价
   ```

3. **总成本**:
   ```
   总成本 = 原材料成本 + 人工成本 + 设备成本 + 其他成本
   ```

4. **利润**:
   ```
   利润 = 销售价 - 总成本
   利润率 = 利润 / 销售价 × 100%
   ```

---

### 数据完整性规则

1. **必需配置**:
   - 每个产品至少有1条转换率配置（否则无法生产）
   - `unit_price` 建议必填（用于利润分析）
   - `production_time_minutes` 建议必填（用于排期）

2. **唯一约束**:
   - `(factory_id, code)` 唯一
   - `(factory_id, material_type_id, product_type_id)` 转换率唯一

3. **外键约束**:
   - `factory_id` → factories.id
   - `created_by` → users.id
   - `product_type_id` → product_types.id (在转换率表)

---

### 性能优化建议

1. **索引优化**:
   - 添加 `(factory_id, is_active)` 复合索引
   - 添加 `(factory_id, category)` 复合索引

2. **查询优化**:
   - 避免 `SELECT *`，只查询需要的字段
   - 使用 `@BatchSize` 注解优化N+1查询
   - 转换率查询使用 JOIN 而不是子查询

3. **缓存策略**:
   - 产品类型数据变化不频繁，适合缓存
   - 转换率配置可以缓存到Redis（TTL 1小时）

---

**文档结束**

下一步：[PRD-Entity-Supplier（供应商）](./PRD-Entity-Supplier.md)
