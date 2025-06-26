# 生产加工模块 - 数据库表结构设计 (V2)

> **设计目标**: 本套表结构旨在替代原有的基于JSON模板的松散结构，采用关系型数据库的维度/事实建模思想，为精细化的成本核算、全流程追溯、以及高级数据分析（如趋势预测、决策支持）提供坚实、可靠的数据基础。

---

## 核心设计理念

*   **维度表 (Dimension Tables)**: 存储相对静态的主数据，如供应商、物料、产品、员工、设备等。它们为业务事件提供上下文，回答"谁"、"什么"、"在哪里"、"用什么"等问题。
*   **事实表 (Fact Tables)**: 存储业务流程中发生的事件和测量数据，如入库、生产、称重、消耗等。它们是数据分析的核心，记录了"发生了什么"。

---

## 一、 维度表 (Dimension Tables) - 上下文主数据

### 1. `dim_suppliers` (供应商维度表)
> 存储所有供应商信息。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `supplier_id` | INT | PK | 供应商唯一ID (自增) |
| `supplier_name` | VARCHAR(255) | | 供应商名称 |
| `contact_person`| VARCHAR(100) | | 联系人 |
| `phone` | VARCHAR(50) | | 联系电话 |
| `address` | TEXT | | 地址 |
| `supplier_category`| VARCHAR(50) | | 供应商分类 (如：原料、辅料) |
| `is_active` | BOOLEAN | | 是否启用 |

### 2. `dim_materials` (物料维度表)
> 存储所有用到的物料，包括原料、辅料、调料、包装材料等。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `material_id` | INT | PK | 物料唯一ID (自增) |
| `material_name` | VARCHAR(255) | | 物料名称 (如：西门塔尔牛肉、食盐、PA/PE复合膜) |
| `material_type` | VARCHAR(50) | | 物料类型 (如：肉类原料、调料、包装材料) |
| `specification` | VARCHAR(255) | | 规格描述 (如：一级、50kg/袋) |
| `default_unit` | VARCHAR(20) | | 默认单位 (如：kg, g, L, m) |
| `is_active` | BOOLEAN | | 是否启用 |

### 3. `dim_products` (成品维度表)
> 存储最终生产出的产品信息。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `product_id` | INT | PK | 成品唯一ID (自增) |
| `product_sku` | VARCHAR(100) | | 成品SKU编码 |
| `product_name` | VARCHAR(255) | | 成品名称 (如：精装牛排500g) |
| `specification` | VARCHAR(255) | | 规格描述 (如：500g/包) |
| `shelf_life_days`| INT | | 保质期（天） |
| `is_active` | BOOLEAN | | 是否启用 |

### 4. `dim_staff` (员工维度表)
> 存储所有参与生产流程的员工。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `staff_id` | INT | PK | 员工唯一ID (自增) |
| `staff_name` | VARCHAR(100) | | 员工姓名 |
| `role` | VARCHAR(50) | | 角色 (如：操作员, 质检员, 仓库管理员) |
| `is_active` | BOOLEAN | | 是否在职 |

### 5. `dim_equipment` (设备维度表)
> 存储所有生产设备信息。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `equipment_id` | INT | PK | 设备唯一ID (自增) |
| `equipment_name` | VARCHAR(255) | | 设备名称 (如：1号滚揉机, 2号速冻线) |
| `equipment_type` | VARCHAR(100) | | 设备类型 (如：滚揉机, 速冻机, 清洗机) |
| `location` | VARCHAR(100) | | 所在位置 (如：A车间) |
| `is_active` | BOOLEAN | | 是否启用 |

### 6. `dim_process_stages` (工艺阶段维度表)
> 定义了标准化的生产工艺流程。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `stage_id` | INT | PK | 阶段唯一ID (自增) |
| `stage_name` | VARCHAR(100) | | 阶段名称 (如：原料入库, 屠宰分割, 清洗, 滚揉, 速冻) |
| `stage_description`| TEXT | | 阶段描述 |
| `sequence_order`| INT | | 流程顺序 |

### 7. `dim_measurement_types` (测量类型维度表)
> 定义了所有需要采集的数据点类型，便于统一管理和分析。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `m_type_id` | INT | PK | 测量类型ID (自增) |
| `m_type_name` | VARCHAR(100) | | 测量类型名称 (如：入库前重量, 滚揉后重量, 失水率) |
| `m_type_category`| VARCHAR(50) | | 分类 (如：重量, 温度, 时长, 比例, 计数) |
| `default_unit` | VARCHAR(20) | | 默认单位 (如：kg, °C, min, %) |

---

## 二、 事实表 (Fact Tables) - 业务流程数据

### 8. `fact_material_arrivals` (原料到货事实表)
> 流程起点：记录每一批次原料的到货情况。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `arrival_id` | BIGINT | PK | 到货唯一ID (自增) |
| `material_id` | INT | FK -> `dim_materials` | 到货物料ID |
| `supplier_id` | INT | FK -> `dim_suppliers` | 供应商ID |
| `arrival_timestamp`| DATETIME | | 到货时间 |
| `purchase_order_id`| VARCHAR(100)| | 采购订单号 |
| `arrival_weight` | DECIMAL(10,3)| | 到货重量 |
| `unit` | VARCHAR(20) | | 单位 |
| `purchase_cost` | DECIMAL(12,2)| | 采购成本 |
| `quality_status` | VARCHAR(20) | | 质量状态 (如：待检, 合格, 不合格) |
| `staff_id` | INT | FK -> `dim_staff` | 接收人ID |

### 9. `fact_production_batches` (生产批次事实表)
> 核心表：定义了一个生产任务的基本信息。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `batch_id` | BIGINT | PK | 生产批次唯一ID (自增) |
| `batch_code` | VARCHAR(100) | | 生产批次号 (如：PRO-20241210-001) |
| `product_id` | INT | FK -> `dim_products` | 计划生产的成品ID |
| `planned_quantity`| DECIMAL(10,3)| | 计划产量 |
| `creation_timestamp`| DATETIME | | 批次创建时间 |
| `status` | VARCHAR(50) | | 批次状态 (如：计划中, 生产中, 已完成, 已取消) |
| `manager_id` | INT | FK -> `dim_staff` | 负责人ID |

### 10. `link_batch_arrivals` (批次用料关联表)
> 建立生产批次与原料到货之间的多对多关系。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `link_id` | BIGINT | PK | 关联ID (自增) |
| `batch_id` | BIGINT | FK -> `fact_production_batches`| 生产批次ID |
| `arrival_id` | BIGINT | FK -> `fact_material_arrivals`| 原料到货ID |
| `weight_used` | DECIMAL(10,3)| | 从该批到货中使用的重量 |
| `unit` | VARCHAR(20) | | 单位 |

### 11. `fact_process_events` (工艺事件事实表)
> 最核心的事件记录表，记录生产中每一个有意义的操作。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `event_id` | BIGINT | PK | 事件唯一ID (自增) |
| `batch_id` | BIGINT | FK -> `fact_production_batches`| 所属生产批次ID |
| `stage_id` | INT | FK -> `dim_process_stages`| 所属工艺阶段ID |
| `equipment_id` | INT | FK -> `dim_equipment` | 使用的设备ID (可为空) |
| `staff_id` | INT | FK -> `dim_staff` | 操作员ID |
| `start_timestamp`| DATETIME | | 事件开始时间 |
| `end_timestamp` | DATETIME | | 事件结束时间 |
| `status` | VARCHAR(20) | | 事件状态 (如：成功, 失败) |
| `notes` | TEXT | | 备注 |

### 12. `fact_event_measurements` (事件测量事实表)
> 详细记录每个工艺事件中产生的所有量化数据，完全取代原有的JSON结构。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `measurement_id`| BIGINT | PK | 测量唯一ID (自增) |
| `event_id` | BIGINT | FK -> `fact_process_events` | 关联的工艺事件ID |
| `m_type_id` | INT | FK -> `dim_measurement_types`| 测量的类型ID |
| `value` | DECIMAL(10,3)| | 测量值 |
| `unit` | VARCHAR(20) | | 单位 |
| `record_timestamp`| DATETIME | | 测量记录时间 |

### 13. `fact_event_consumptions` (事件消耗事实表)
> 记录每个事件中消耗的辅料、调料、水、电等。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `consumption_id`| BIGINT | PK | 消耗唯一ID (自增) |
| `event_id` | BIGINT | FK -> `fact_process_events` | 关联的工艺事件ID |
| `material_id` | INT | FK -> `dim_materials` | 消耗的物料ID (如：水、电、调料) |
| `quantity` | DECIMAL(10,3)| | 消耗数量 |
| `unit` | VARCHAR(20) | | 消耗单位 |
| `cost` | DECIMAL(12,2)| | 此次消耗的成本 |

### 14. `fact_packaging` (包装事实表)
> 记录产品包装和生成最终库存单位的过程。

| 字段名 | 数据类型 | 主/外键 | 说明 |
| :--- | :--- | :--- | :--- |
| `package_id` | BIGINT | PK | 包装唯一ID (自增) |
| `event_id` | BIGINT | FK -> `fact_process_events` | 关联的包装事件ID |
| `product_id` | INT | FK -> `dim_products` | 包装后的成品ID |
| `package_code` | VARCHAR(255) | | 包装码/追溯码 |
| `quantity` | INT | | 该包装码下的单位数量 (如：1) |
| `weight` | DECIMAL(10,3)| | 包装后重量 |
| `expiry_date` | DATE | | 有效期至 |

---

## 三、业务场景示例：一次完整的滚揉操作

### 场景描述
假设我们要对500kg的西门塔尔牛肉进行滚揉保水和调料包浆处理。

### 数据记录流程

**1. 开始滚揉事件**
```sql
-- 在 fact_process_events 中创建滚揉事件
INSERT INTO fact_process_events (
    batch_id, stage_id, equipment_id, staff_id,
    start_timestamp, status
) VALUES (
    1001,  -- 生产批次ID
    4,     -- 滚揉阶段ID
    3,     -- 1号滚揉机ID
    205,   -- 操作员张师傅ID
    '2024-12-10 09:00:00',
    '进行中'
);
-- 返回 event_id = 5001
```

**2. 记录滚揉前重量**
```sql
-- 在 fact_event_measurements 中记录称重数据
INSERT INTO fact_event_measurements (
    event_id, m_type_id, value, unit, record_timestamp
) VALUES (
    5001,  -- 上面创建的事件ID
    101,   -- "滚揉前重量"测量类型ID
    500.0, -- 500kg
    'kg',
    '2024-12-10 09:05:00'
);
```

**3. 记录调料消耗**
```sql
-- 记录食盐消耗
INSERT INTO fact_event_consumptions (
    event_id, material_id, quantity, unit, cost
) VALUES (
    5001,  -- 滚揉事件ID
    301,   -- 食盐物料ID
    12.5,  -- 12.5kg
    'kg',
    45.00  -- 成本45元
);

-- 记录水的消耗
INSERT INTO fact_event_consumptions (
    event_id, material_id, quantity, unit, cost
) VALUES (
    5001,  -- 滚揉事件ID
    302,   -- 水物料ID
    25.0,  -- 25kg
    'kg',
    0.10   -- 成本0.1元
);
```

**4. 记录滚揉过程参数**
```sql
-- 记录滚揉温度
INSERT INTO fact_event_measurements (
    event_id, m_type_id, value, unit, record_timestamp
) VALUES (
    5001, 102, 4.0, '°C', '2024-12-10 09:30:00');

-- 记录滚揉时长
INSERT INTO fact_event_measurements (
    event_id, m_type_id, value, unit, record_timestamp
) VALUES (
    5001, 103, 120, 'min', '2024-12-10 11:00:00');
```

**5. 结束滚揉并记录结果**
```sql
-- 更新事件结束时间
UPDATE fact_process_events
SET end_timestamp = '2024-12-10 11:00:00', status = '完成'
WHERE event_id = 5001;

-- 记录滚揉后重量
INSERT INTO fact_event_measurements (
    event_id, m_type_id, value, unit, record_timestamp
) VALUES (
    5001, 104, 532.8, 'kg', '2024-12-10 11:05:00');
```

### 数据分析查询示例

**计算保水增重效果：**
```sql
SELECT
    e.event_id,
    e.batch_id,
    pre_weight.value AS 滚揉前重量,
    post_weight.value AS 滚揉后重量,
    (post_weight.value - pre_weight.value) AS 增重量,
    ROUND((post_weight.value - pre_weight.value) / pre_weight.value * 100, 2) AS 增重率_百分比
FROM fact_process_events e
JOIN fact_event_measurements pre_weight ON e.event_id = pre_weight.event_id AND pre_weight.m_type_id = 101
JOIN fact_event_measurements post_weight ON e.event_id = post_weight.event_id AND post_weight.m_type_id = 104
WHERE e.stage_id = 4; -- 滚揉阶段
```

**计算单位调料成本：**
```sql
SELECT
    e.batch_id,
    m.material_name AS 调料名称,
    c.quantity AS 使用量,
    c.unit AS 单位,
    c.cost AS 总成本,
    post_weight.value AS 最终重量,
    ROUND(c.cost / post_weight.value, 4) AS 单位重量调料成本
FROM fact_process_events e
JOIN fact_event_consumptions c ON e.event_id = c.event_id
JOIN dim_materials m ON c.material_id = m.material_id
JOIN fact_event_measurements post_weight ON e.event_id = post_weight.event_id AND post_weight.m_type_id = 104
WHERE e.stage_id = 4 AND m.material_type = '调料';
```

---

## 四、关键分析查询模板

### 4.1 成本分析查询

**批次总成本分析：**
```sql
SELECT
    b.batch_code AS 批次号,
    p.product_name AS 产品名称,
    -- 原料成本
    SUM(CASE WHEN ma.arrival_id IS NOT NULL THEN
        (lba.weight_used / ma.arrival_weight) * ma.purchase_cost
        ELSE 0 END) AS 原料成本,
    -- 辅料调料成本
    SUM(CASE WHEN dm.material_type IN ('调料', '辅料') THEN ec.cost ELSE 0 END) AS 辅料调料成本,
    -- 水电等资源成本
    SUM(CASE WHEN dm.material_type IN ('水', '电', '燃气') THEN ec.cost ELSE 0 END) AS 资源成本,
    -- 总成本
    SUM(CASE WHEN ma.arrival_id IS NOT NULL THEN
        (lba.weight_used / ma.arrival_weight) * ma.purchase_cost
        ELSE 0 END) + SUM(ec.cost) AS 总成本
FROM fact_production_batches b
JOIN dim_products p ON b.product_id = p.product_id
LEFT JOIN link_batch_arrivals lba ON b.batch_id = lba.batch_id
LEFT JOIN fact_material_arrivals ma ON lba.arrival_id = ma.arrival_id
LEFT JOIN fact_process_events pe ON b.batch_id = pe.batch_id
LEFT JOIN fact_event_consumptions ec ON pe.event_id = ec.event_id
LEFT JOIN dim_materials dm ON ec.material_id = dm.material_id
GROUP BY b.batch_id, b.batch_code, p.product_name;
```

### 4.2 质量追溯查询

**产品全程追溯：**
```sql
-- 根据包装码追溯到原料来源
SELECT
    fp.package_code AS 包装码,
    dp.product_name AS 产品名称,
    fb.batch_code AS 生产批次,
    dm.material_name AS 原料名称,
    ds.supplier_name AS 供应商,
    ma.arrival_timestamp AS 原料到货时间,
    ma.purchase_order_id AS 采购订单号
FROM fact_packaging fp
JOIN fact_process_events pe ON fp.event_id = pe.event_id
JOIN fact_production_batches fb ON pe.batch_id = fb.batch_id
JOIN link_batch_arrivals lba ON fb.batch_id = lba.batch_id
JOIN fact_material_arrivals ma ON lba.arrival_id = ma.arrival_id
JOIN dim_materials dm ON ma.material_id = dm.material_id
JOIN dim_suppliers ds ON ma.supplier_id = ds.supplier_id
JOIN dim_products dp ON fp.product_id = dp.product_id
WHERE fp.package_code = 'PKG-20241210-001';
```

### 4.3 工艺效率分析

**设备利用率分析：**
```sql
SELECT
    de.equipment_name AS 设备名称,
    COUNT(pe.event_id) AS 使用次数,
    SUM(TIMESTAMPDIFF(MINUTE, pe.start_timestamp, pe.end_timestamp)) AS 总使用时长_分钟,
    AVG(TIMESTAMPDIFF(MINUTE, pe.start_timestamp, pe.end_timestamp)) AS 平均使用时长_分钟,
    -- 按月统计
    DATE_FORMAT(pe.start_timestamp, '%Y-%m') AS 统计月份
FROM fact_process_events pe
JOIN dim_equipment de ON pe.equipment_id = de.equipment_id
WHERE pe.start_timestamp >= '2024-12-01'
    AND pe.end_timestamp IS NOT NULL
GROUP BY de.equipment_id, de.equipment_name, DATE_FORMAT(pe.start_timestamp, '%Y-%m')
ORDER BY 统计月份, 总使用时长_分钟 DESC;
```

### 4.4 趋势预测数据准备

**按日聚合的关键指标：**
```sql
CREATE VIEW daily_production_metrics AS
SELECT
    DATE(pe.start_timestamp) AS 生产日期,
    COUNT(DISTINCT fb.batch_id) AS 批次数量,
    -- 总投入重量（原料）
    SUM(lba.weight_used) AS 总投入重量,
    -- 总产出重量（最终产品）
    SUM(fp.weight) AS 总产出重量,
    -- 平均成品率
    AVG(fp.weight / lba.weight_used) AS 平均成品率,
    -- 总成本
    SUM(ma.purchase_cost * (lba.weight_used / ma.arrival_weight) + ec.cost) AS 总成本,
    -- 单位成本
    SUM(ma.purchase_cost * (lba.weight_used / ma.arrival_weight) + ec.cost) / SUM(fp.weight) AS 单位成本
FROM fact_process_events pe
JOIN fact_production_batches fb ON pe.batch_id = fb.batch_id
JOIN link_batch_arrivals lba ON fb.batch_id = lba.batch_id
JOIN fact_material_arrivals ma ON lba.arrival_id = ma.arrival_id
LEFT JOIN fact_event_consumptions ec ON pe.event_id = ec.event_id
LEFT JOIN fact_packaging fp ON pe.event_id = fp.event_id
WHERE pe.start_timestamp IS NOT NULL
GROUP BY DATE(pe.start_timestamp)
ORDER BY 生产日期;
```

---

## 五、数据质量与完整性约束

### 5.1 核心业务规则约束

```sql
-- 确保滚揉后重量不超过滚揉前重量 + 所有添加物重量
ALTER TABLE fact_event_measurements
ADD CONSTRAINT chk_weight_logic
CHECK (
    -- 这里需要在应用层实现复杂的业务逻辑检查
    value >= 0
);

-- 确保事件的结束时间不早于开始时间
ALTER TABLE fact_process_events
ADD CONSTRAINT chk_event_time
CHECK (end_timestamp >= start_timestamp OR end_timestamp IS NULL);

-- 确保包装后的产品有有效期
ALTER TABLE fact_packaging
ADD CONSTRAINT chk_expiry_date
CHECK (expiry_date > CURDATE());
```

### 5.2 数据一致性检查视图

```sql
-- 创建数据一致性检查视图
CREATE VIEW data_consistency_check AS
SELECT
    'weight_balance' AS check_type,
    fb.batch_code,
    fb.batch_id,
    '重量平衡检查' AS check_description,
    CASE
        WHEN ABS(
            (SELECT SUM(value) FROM fact_event_measurements fem
             JOIN fact_process_events fpe ON fem.event_id = fpe.event_id
             WHERE fpe.batch_id = fb.batch_id AND fem.m_type_id = 101) -- 投入重量
            -
            (SELECT SUM(value) FROM fact_event_measurements fem
             JOIN fact_process_events fpe ON fem.event_id = fpe.event_id
             WHERE fpe.batch_id = fb.batch_id AND fem.m_type_id = 104) -- 产出重量
        ) > 50 THEN '异常'
        ELSE '正常'
    END AS status
FROM fact_production_batches fb
WHERE fb.status = '已完成';
```

---

## 六、与现有系统的集成方案

### 6.1 数据迁移策略

**现有JSON数据解析示例：**
```sql
-- 假设需要将现有的JSON数据迁移到新表结构
-- 原表：production_batches.process_step_data (JSON格式)
-- 新表：fact_event_measurements

INSERT INTO fact_event_measurements (event_id, m_type_id, value, unit, record_timestamp)
SELECT
    pe.event_id,
    101, -- 滚揉前重量的测量类型ID
    JSON_EXTRACT(old_pb.process_step_data, '$.preWeight'),
    'kg',
    pe.start_timestamp
FROM old_production_batches old_pb
JOIN fact_process_events pe ON old_pb.id = pe.batch_id
WHERE JSON_EXTRACT(old_pb.process_step_data, '$.preWeight') IS NOT NULL;
```

### 6.2 API接口适配

**新表结构对应的API设计：**

```javascript
// 创建生产事件的API
POST /api/v1/production/events
{
    "batch_id": 1001,
    "stage_name": "滚揉",
    "equipment_name": "1号滚揉机",
    "staff_name": "张师傅",
    "measurements": [
        {
            "type": "滚揉前重量",
            "value": 500.0,
            "unit": "kg"
        }
    ],
    "consumptions": [
        {
            "material_name": "食盐",
            "quantity": 12.5,
            "unit": "kg",
            "cost": 45.00
        }
    ]
}

// 系统自动处理维度表查找和事实表插入
```

---

## 七、维护和扩展指南

### 7.1 新增测量类型

当需要新增测量指标时，只需在 `dim_measurement_types` 表中添加记录：

```sql
INSERT INTO dim_measurement_types (m_type_name, m_type_category, default_unit)
VALUES ('包浆厚度', '长度', 'mm');
```

### 7.2 新增工艺阶段

```sql
INSERT INTO dim_process_stages (stage_name, stage_description, sequence_order)
VALUES ('真空包装', '使用真空设备对产品进行包装', 6);
```

### 7.3 历史数据清理策略

```sql
-- 清理超过2年的详细测量数据，保留汇总数据
DELETE FROM fact_event_measurements
WHERE record_timestamp < DATE_SUB(NOW(), INTERVAL 2 YEAR);

-- 但保留关键的汇总统计
-- 这部分数据应该已经聚合到专门的汇总表中
```

---

## 八、性能优化建议

### 8.1 索引策略

```sql
-- 事实表的关键索引
CREATE INDEX idx_process_events_batch_stage ON fact_process_events(batch_id, stage_id);
CREATE INDEX idx_measurements_event_type ON fact_event_measurements(event_id, m_type_id);
CREATE INDEX idx_consumptions_event_material ON fact_event_consumptions(event_id, material_id);

-- 时间范围查询索引
CREATE INDEX idx_events_timestamp ON fact_process_events(start_timestamp);
CREATE INDEX idx_arrivals_timestamp ON fact_material_arrivals(arrival_timestamp);

-- 追溯查询索引
CREATE INDEX idx_packaging_code ON fact_packaging(package_code);
```

### 8.2 分区策略

```sql
-- 按月分区大事实表
ALTER TABLE fact_process_events
PARTITION BY RANGE (YEAR(start_timestamp) * 100 + MONTH(start_timestamp)) (
    PARTITION p202412 VALUES LESS THAN (202501),
    PARTITION p202501 VALUES LESS THAN (202502),
    -- ... 其他分区
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

---

## 九、总结

本数据库表结构设计实现了以下核心目标：

1. **数据精细化**：每个测量点、每次消耗都有独立记录，支持精确的成本核算
2. **完整追溯**：从原料到成品的完整数据链条，支持质量问题快速定位
3. **灵活扩展**：维度表设计支持新增物料、设备、测量类型等
4. **分析友好**：事实表设计便于进行各种聚合分析和趋势预测
5. **性能优化**：合理的索引和分区策略确保查询性能

这套表结构为智能化的食品加工管理系统提供了强大的数据基础，支持实时监控、成本优化、质量管控和决策支持等高级功能。
