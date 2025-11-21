# PRD-Entity-ProcessingBatch

## 文档信息

| 项目 | 内容 |
|------|------|
| 实体名称 | ProcessingBatch（加工批次） |
| 表名 | `processing_batches` |
| 业务域 | 生产批次管理 |
| 核心程度 | ⭐⭐⭐⭐⭐ (最核心) |
| 文档版本 | v1.0.0 |
| 创建日期 | 2025-11-20 |
| 最后更新 | 2025-11-20 |

---

## 目录

- [1. 实体概述](#1-实体概述)
- [2. 字段详解](#2-字段详解)
- [3. 关联关系](#3-关联关系)
- [4. 索引设计](#4-索引设计)
- [5. 数据流转](#5-数据流转)
- [6. SQL示例](#6-sql示例)

---

## 1. 实体概述

### 1.1 业务含义

**ProcessingBatch**是白垩纪食品溯源系统的**核心生产实体**，代表一个**加工批次**。

每个ProcessingBatch代表：
- 📦 一次完整的生产加工活动
- 🏭 从原料到成品的转换过程
- 💰 成本核算的基本单元
- 📊 生产追溯的核心数据
- ⏱️ 工时和设备使用的载体

### 1.2 核心价值

1. **生产追溯**：记录完整的生产过程（开始时间、结束时间、负责人）
2. **成本核算**：分项记录物料、人工、设备、其他成本
3. **质量管理**：关联质检记录，确保产品质量
4. **效率分析**：通过开始/结束时间和产量计算生产效率
5. **工时管理**：关联批次工时记录（BatchWorkSession）

### 1.3 生命周期

```
创建(pending) → 开始生产(processing) → 完成(completed)
                                     ↓
                                 取消(cancelled)
```

**状态流转**：
1. **pending（计划中）**：批次已创建，等待开始生产
2. **processing（进行中）**：批次正在生产，记录开始时间
3. **completed（已完成）**：批次生产完成，记录结束时间和实际产量
4. **cancelled（已取消）**：批次取消，不再生产

**状态枚举**：
```java
public enum BatchStatus {
    PLANNING,      // 计划中（对应pending）
    IN_PROGRESS,   // 进行中（对应processing）
    COMPLETED,     // 已完成（对应completed）
    CANCELLED      // 已取消（对应cancelled）
}
```

### 1.4 与ProductionBatch的区别

**历史背景**：
- **ProductionBatch**：旧版生产批次实体（已废弃）
- **ProcessingBatch**：新版加工批次实体（当前使用）

**主要区别**：
- ProcessingBatch更专注于**加工过程**
- 增强了**成本核算**功能（5项成本）
- 优化了**状态管理**（4个明确状态）
- 改进了**关联关系**（工时、设备使用）

---

## 2. 字段详解

### 2.1 基础字段（继承自BaseEntity）

| 字段名 | 类型 | 可空 | 说明 |
|--------|------|------|------|
| id | String | 否 | 批次ID（主键，手动生成） |
| createdAt | LocalDateTime | 否 | 创建时间（自动） |
| updatedAt | LocalDateTime | 否 | 更新时间（自动） |

### 2.2 批次标识字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **id** | String | ❌ | - | 批次ID（主键，长度191）<br>示例："BATCH-20251120-001" |
| **factoryId** | String | ❌ | - | 所属工厂ID（外键）<br>示例："FISH_2025_001" |
| **batchNumber** | String | ❌ | - | 批次号（全局唯一，长度50）<br>示例："BATCH-001"、"20251120-001" |

### 2.3 产品信息字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **productName** | String | ❌ | - | 产品名称<br>示例："冷冻鱼片"、"鱼罐头" |
| **quantity** | BigDecimal | ❌ | - | 计划产量（precision=10, scale=2）<br>示例：1000.00 |
| **outputQuantity** | BigDecimal | ✅ | null | 实际产量（映射到actual_quantity字段）<br>示例：980.50 |
| **unit** | String | ❌ | - | 单位（长度20）<br>示例："kg"、"箱"、"件" |

**字段映射说明**：
- `outputQuantity` 在Java中的字段名
- `actual_quantity` 在数据库中的列名
- 通过`@Column(name = "actual_quantity")`映射

### 2.4 时间字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **startTime** | LocalDateTime | ✅ | null | 开始生产时间<br>状态变为processing时设置 |
| **endTime** | LocalDateTime | ✅ | null | 结束生产时间<br>状态变为completed时设置 |

### 2.5 状态与负责人字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **status** | String | ❌ | "pending" | 批次状态（长度20）<br>可选值：pending, processing, completed, cancelled |
| **supervisorId** | Integer | ✅ | null | 监管员ID（外键，关联users表）<br>负责该批次的监管员 |

### 2.6 成本字段（5项成本）

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **materialCost** | BigDecimal | ✅ | null | 物料成本（precision=10, scale=2）<br>原料、辅料等成本 |
| **laborCost** | BigDecimal | ✅ | null | 人工成本（precision=10, scale=2）<br>根据工时记录计算 |
| **equipmentCost** | BigDecimal | ✅ | null | 设备成本（precision=10, scale=2）<br>设备折旧、维护成本 |
| **otherCost** | BigDecimal | ✅ | null | 其他成本（precision=10, scale=2）<br>水电、包装等成本 |
| **totalCost** | BigDecimal | ✅ | null | 总成本（precision=10, scale=2）<br>= 物料 + 人工 + 设备 + 其他 |

**成本计算公式**：
```
totalCost = materialCost + laborCost + equipmentCost + otherCost
```

### 2.7 其他字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **notes** | String (TEXT) | ✅ | null | 备注信息<br>记录批次的特殊说明 |
| **productionEfficiency** | BigDecimal | ✅ | null | 生产效率（百分比，precision=5, scale=2）<br>用于Dashboard KPI计算<br>示例：95.50（表示95.5%） |

**生产效率计算公式**：
```
productionEfficiency = (outputQuantity / quantity) * 100
```

示例：
- 计划产量：1000 kg
- 实际产量：980 kg
- 生产效率：(980 / 1000) * 100 = 98.00%

---

## 3. 关联关系

### 3.1 多对一关系（ManyToOne）

| 关联实体 | 关系 | 外键字段 | 说明 |
|---------|------|---------|------|
| **Factory** | N:1 | `factoryId` | 批次所属工厂 |
| **User (supervisor)** | N:1 | `supervisorId` | 批次监管员 |

### 3.2 一对多关系（OneToMany）

| 关联实体 | 关系 | 映射字段 | 业务含义 |
|---------|------|---------|---------|
| **BatchWorkSession** | 1:N | `batchWorkSessions` | 批次工时记录（员工在该批次的工作时间） |
| **BatchEquipmentUsage** | 1:N | `equipmentUsages` | 批次设备使用记录（设备在该批次的使用时间） |

### 3.3 关联关系图

```
                    ProcessingBatch (加工批次)
                           │
        ┌──────────────────┼──────────────────┬──────────────────┐
        │                  │                  │                  │
        ▼                  ▼                  ▼                  ▼
   Factory(N:1)      User/supervisor(N:1)  BatchWorkSession(1:N)  BatchEquipmentUsage(1:N)
   (所属工厂)        (监管员)              (批次工时)           (设备使用)
                                              │                    │
                                              ├─ employee(User)    ├─ equipment(Equipment)
                                              ├─ workMinutes       ├─ usageMinutes
                                              └─ laborCost         └─ equipmentCost
```

**数据流向**：
1. **创建批次**：指定factory和supervisor
2. **开始生产**：创建BatchWorkSession记录工时
3. **设备使用**：创建BatchEquipmentUsage记录设备使用
4. **计算成本**：汇总工时和设备使用计算laborCost和equipmentCost
5. **完成批次**：设置endTime，计算totalCost和productionEfficiency

### 3.4 级联操作

**级联策略：CascadeType.ALL**

这意味着：
- ✅ **创建批次**：可以同时创建工时记录、设备使用记录
- ✅ **更新批次**：会自动传播更新
- ⚠️ **删除批次**：会级联删除所有工时记录、设备使用记录（**危险！**）

**实际业务中**：
- 不应物理删除批次
- 应使用**状态管理**（设置status=cancelled）
- 保留所有历史数据用于追溯

### 3.5 懒加载策略

所有关联关系使用**FetchType.LAZY**（懒加载）：
- 查询ProcessingBatch时**不会自动加载**关联的factory、supervisor等
- 只有在**显式访问**关联对象时才加载
- 减少N+1查询问题

**注意**：
- `@ToString(exclude = {...})` 排除关联字段，避免循环引用
- 避免在`toString()`中触发懒加载导致性能问题

---

## 4. 索引设计

### 4.1 主键索引

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| PRIMARY | 主键 | `id` | 批次ID（String类型） |

### 4.2 唯一索引

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `uk_batch_number` | UNIQUE | `batch_number` | 批次号全局唯一 |

### 4.3 单列索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_batch_factory` | `factory_id` | 按工厂查询批次 |
| `idx_batch_number` | `batch_number` | 批次号查询（虽然有唯一约束，但显式创建索引加速） |
| `idx_batch_status` | `status` | 按状态查询批次 |

### 4.4 索引使用场景

**场景1：查询某工厂的所有批次**
```sql
-- 使用 idx_batch_factory 索引
SELECT * FROM processing_batches WHERE factory_id = 'FISH_2025_001';
```

**场景2：查询批次详情**
```sql
-- 使用 uk_batch_number 唯一索引
SELECT * FROM processing_batches WHERE batch_number = 'BATCH-001';
```

**场景3：查询进行中的批次**
```sql
-- 使用 idx_batch_status 索引
SELECT * FROM processing_batches WHERE status = 'processing';
```

**场景4：按工厂和状态查询**
```sql
-- 建议添加复合索引：idx_factory_status (factory_id, status)
SELECT * FROM processing_batches
WHERE factory_id = 'FISH_2025_001' AND status = 'completed';
```

---

## 5. 数据流转

### 5.1 创建流程

**触发场景**：创建新的生产批次

**API端点**：`POST /api/mobile/{factoryId}/processing/batches`

**创建步骤**：
1. **验证数据**：
   - 检查batch_number是否已存在（唯一约束）
   - 验证factoryId是否有效
   - 验证supervisorId是否存在
2. **生成ID**：
   - 自动生成或手动指定批次ID
   - 格式：`BATCH-{日期}-{序号}`
3. **设置默认值**：
   - `status = "pending"`
   - `startTime = null`（未开始）
   - `endTime = null`（未结束）
   - 所有成本字段 = null（未计算）
4. **插入数据库**：保存ProcessingBatch记录

**SQL示例**：
```sql
INSERT INTO processing_batches (
  id, factory_id, batch_number, product_name,
  quantity, unit, status, supervisor_id,
  created_at, updated_at
) VALUES (
  'BATCH-20251120-001',
  'FISH_2025_001',
  'BATCH-001',
  '冷冻鱼片',
  1000.00,
  'kg',
  'pending',
  123,  -- supervisor_id
  NOW(),
  NOW()
);
```

### 5.2 开始生产流程

**触发场景**：批次开始生产

**API端点**：`PUT /api/mobile/{factoryId}/processing/batches/{id}/start`

**业务规则**：
- 只有`status = "pending"`的批次可以开始
- 设置`startTime = NOW()`
- 更新`status = "processing"`

**SQL示例**：
```sql
UPDATE processing_batches
SET
  status = 'processing',
  start_time = NOW(),
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001' AND status = 'pending';
```

**后续操作**：
- 创建BatchWorkSession记录员工工时
- 创建BatchEquipmentUsage记录设备使用

### 5.3 完成生产流程

**触发场景**：批次生产完成

**API端点**：`PUT /api/mobile/{factoryId}/processing/batches/{id}/complete`

**业务规则**：
- 只有`status = "processing"`的批次可以完成
- 设置`endTime = NOW()`
- 记录`outputQuantity`（实际产量）
- 计算`productionEfficiency`
- 汇总所有成本，计算`totalCost`
- 更新`status = "completed"`

**成本计算**：
```sql
-- 1. 计算人工成本（从BatchWorkSession汇总）
UPDATE processing_batches pb
SET labor_cost = (
  SELECT SUM(bws.work_minutes * u.ccr_rate)
  FROM batch_work_sessions bws
  JOIN users u ON bws.employee_id = u.id
  WHERE bws.batch_id = pb.id
)
WHERE pb.id = 'BATCH-20251120-001';

-- 2. 计算设备成本（从BatchEquipmentUsage汇总）
UPDATE processing_batches pb
SET equipment_cost = (
  SELECT SUM(beu.usage_minutes * e.hourly_cost / 60)
  FROM batch_equipment_usages beu
  JOIN equipment e ON beu.equipment_id = e.id
  WHERE beu.batch_id = pb.id
)
WHERE pb.id = 'BATCH-20251120-001';

-- 3. 计算总成本
UPDATE processing_batches
SET
  total_cost = COALESCE(material_cost, 0)
             + COALESCE(labor_cost, 0)
             + COALESCE(equipment_cost, 0)
             + COALESCE(other_cost, 0)
WHERE id = 'BATCH-20251120-001';

-- 4. 计算生产效率
UPDATE processing_batches
SET
  production_efficiency = (output_quantity / quantity) * 100
WHERE id = 'BATCH-20251120-001';

-- 5. 完成批次
UPDATE processing_batches
SET
  status = 'completed',
  end_time = NOW(),
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001' AND status = 'processing';
```

### 5.4 取消批次流程

**触发场景**：批次取消生产

**API端点**：`PUT /api/mobile/{factoryId}/processing/batches/{id}/cancel`

**业务规则**：
- `status = "pending"`或`status = "processing"`的批次可以取消
- 更新`status = "cancelled"`
- 保留已记录的工时和设备使用数据

**SQL示例**：
```sql
UPDATE processing_batches
SET
  status = 'cancelled',
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001'
  AND status IN ('pending', 'processing');
```

### 5.5 查询流程

**常见查询场景**：

**场景1：查询某工厂的所有批次**
```sql
SELECT * FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
ORDER BY created_at DESC;
```

**场景2：查询进行中的批次**
```sql
SELECT * FROM processing_batches
WHERE factory_id = 'FISH_2025_001' AND status = 'processing'
ORDER BY start_time ASC;
```

**场景3：查询已完成批次并计算平均效率**
```sql
SELECT
  COUNT(*) as total_batches,
  AVG(production_efficiency) as avg_efficiency,
  SUM(output_quantity) as total_output
FROM processing_batches
WHERE factory_id = 'FISH_2025_001' AND status = 'completed'
  AND DATE(created_at) = CURDATE();  -- 今日
```

**场景4：查询成本最高的批次**
```sql
SELECT * FROM processing_batches
WHERE factory_id = 'FISH_2025_001' AND status = 'completed'
ORDER BY total_cost DESC
LIMIT 10;
```

---

## 6. SQL示例

### 6.1 基础CRUD操作

#### 6.1.1 创建批次

```sql
-- 创建新批次
INSERT INTO processing_batches (
  id, factory_id, batch_number, product_name,
  quantity, unit, status, supervisor_id,
  notes, created_at, updated_at
) VALUES (
  'BATCH-20251120-001',
  'FISH_2025_001',
  'BATCH-001',
  '冷冻鱼片',
  1000.00,
  'kg',
  'pending',
  123,
  '批次备注信息',
  NOW(),
  NOW()
);
```

#### 6.1.2 查询批次

```sql
-- 基础查询
SELECT * FROM processing_batches WHERE id = 'BATCH-20251120-001';

-- 查询批次及监管员信息
SELECT
  pb.*,
  u.full_name as supervisor_name,
  u.phone as supervisor_phone
FROM processing_batches pb
LEFT JOIN users u ON pb.supervisor_id = u.id
WHERE pb.id = 'BATCH-20251120-001';

-- 查询批次及成本汇总
SELECT
  pb.*,
  (SELECT COUNT(*) FROM batch_work_sessions WHERE batch_id = pb.id) as work_sessions_count,
  (SELECT SUM(work_minutes) FROM batch_work_sessions WHERE batch_id = pb.id) as total_work_minutes,
  (SELECT COUNT(*) FROM batch_equipment_usages WHERE batch_id = pb.id) as equipment_usages_count
FROM processing_batches pb
WHERE pb.id = 'BATCH-20251120-001';
```

#### 6.1.3 更新批次

```sql
-- 更新计划产量
UPDATE processing_batches
SET
  quantity = 1200.00,
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001';

-- 更新监管员
UPDATE processing_batches
SET
  supervisor_id = 456,
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001';

-- 更新备注
UPDATE processing_batches
SET
  notes = '新的备注信息',
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001';
```

#### 6.1.4 状态变更

```sql
-- 开始生产
UPDATE processing_batches
SET
  status = 'processing',
  start_time = NOW(),
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001' AND status = 'pending';

-- 完成生产
UPDATE processing_batches
SET
  status = 'completed',
  end_time = NOW(),
  output_quantity = 980.50,
  production_efficiency = (980.50 / quantity) * 100,
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001' AND status = 'processing';

-- 取消批次
UPDATE processing_batches
SET
  status = 'cancelled',
  updated_at = NOW()
WHERE id = 'BATCH-20251120-001';
```

### 6.2 高级查询

#### 6.2.1 按状态统计批次数量

```sql
SELECT
  status,
  COUNT(*) as batch_count,
  SUM(quantity) as total_planned_quantity,
  SUM(output_quantity) as total_actual_quantity
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
GROUP BY status
ORDER BY
  FIELD(status, 'pending', 'processing', 'completed', 'cancelled');
```

#### 6.2.2 查询今日批次列表

```sql
SELECT
  id,
  batch_number,
  product_name,
  quantity,
  output_quantity,
  status,
  start_time,
  end_time,
  TIMESTAMPDIFF(MINUTE, start_time, COALESCE(end_time, NOW())) as duration_minutes
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
  AND DATE(created_at) = CURDATE()
ORDER BY created_at DESC;
```

#### 6.2.3 查询生产效率最高的批次

```sql
SELECT
  id,
  batch_number,
  product_name,
  quantity,
  output_quantity,
  production_efficiency,
  total_cost
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
  AND status = 'completed'
  AND production_efficiency IS NOT NULL
ORDER BY production_efficiency DESC
LIMIT 10;
```

#### 6.2.4 查询成本分析

```sql
SELECT
  id,
  batch_number,
  product_name,
  total_cost,
  material_cost,
  labor_cost,
  equipment_cost,
  other_cost,
  ROUND((material_cost / total_cost) * 100, 2) as material_cost_pct,
  ROUND((labor_cost / total_cost) * 100, 2) as labor_cost_pct,
  ROUND((equipment_cost / total_cost) * 100, 2) as equipment_cost_pct,
  ROUND((other_cost / total_cost) * 100, 2) as other_cost_pct
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
  AND status = 'completed'
  AND total_cost > 0
ORDER BY total_cost DESC
LIMIT 10;
```

#### 6.2.5 查询超时批次（生产时间超过预期）

```sql
SELECT
  id,
  batch_number,
  product_name,
  start_time,
  end_time,
  TIMESTAMPDIFF(HOUR, start_time, end_time) as actual_hours,
  CASE
    WHEN TIMESTAMPDIFF(HOUR, start_time, end_time) > 24 THEN '超时'
    ELSE '正常'
  END as status_label
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
  AND status = 'completed'
  AND start_time IS NOT NULL
  AND end_time IS NOT NULL
  AND TIMESTAMPDIFF(HOUR, start_time, end_time) > 24
ORDER BY actual_hours DESC;
```

#### 6.2.6 查询某监管员负责的批次统计

```sql
SELECT
  u.full_name as supervisor_name,
  COUNT(pb.id) as total_batches,
  SUM(CASE WHEN pb.status = 'completed' THEN 1 ELSE 0 END) as completed_batches,
  SUM(CASE WHEN pb.status = 'processing' THEN 1 ELSE 0 END) as in_progress_batches,
  AVG(pb.production_efficiency) as avg_efficiency,
  SUM(pb.total_cost) as total_cost
FROM processing_batches pb
JOIN users u ON pb.supervisor_id = u.id
WHERE pb.factory_id = 'FISH_2025_001'
GROUP BY u.id, u.full_name
ORDER BY completed_batches DESC;
```

#### 6.2.7 查询月度生产报表

```sql
SELECT
  DATE_FORMAT(created_at, '%Y-%m') as month,
  COUNT(*) as total_batches,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_batches,
  SUM(quantity) as total_planned_quantity,
  SUM(output_quantity) as total_actual_quantity,
  AVG(production_efficiency) as avg_efficiency,
  SUM(total_cost) as total_cost
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month DESC;
```

#### 6.2.8 查询产品类型统计

```sql
SELECT
  product_name,
  COUNT(*) as batch_count,
  SUM(quantity) as total_planned_quantity,
  SUM(output_quantity) as total_actual_quantity,
  AVG(production_efficiency) as avg_efficiency,
  AVG(total_cost) as avg_cost_per_batch
FROM processing_batches
WHERE factory_id = 'FISH_2025_001'
  AND status = 'completed'
GROUP BY product_name
ORDER BY batch_count DESC;
```

### 6.3 数据完整性检查

#### 6.3.1 检查批次号重复

```sql
-- 查找重复的批次号
SELECT batch_number, COUNT(*) as count
FROM processing_batches
GROUP BY batch_number
HAVING count > 1;
```

#### 6.3.2 检查孤立批次（工厂不存在）

```sql
-- 查找工厂不存在的批次
SELECT pb.*
FROM processing_batches pb
LEFT JOIN factories f ON pb.factory_id = f.id
WHERE f.id IS NULL;
```

#### 6.3.3 检查监管员无效

```sql
-- 查找监管员不存在的批次
SELECT pb.*
FROM processing_batches pb
LEFT JOIN users u ON pb.supervisor_id = u.id
WHERE pb.supervisor_id IS NOT NULL AND u.id IS NULL;
```

#### 6.3.4 检查成本计算错误

```sql
-- 查找总成本计算不正确的批次
SELECT
  id,
  batch_number,
  material_cost,
  labor_cost,
  equipment_cost,
  other_cost,
  total_cost,
  (COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
   COALESCE(equipment_cost, 0) + COALESCE(other_cost, 0)) as calculated_total,
  ABS(total_cost - (COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
                     COALESCE(equipment_cost, 0) + COALESCE(other_cost, 0))) as diff
FROM processing_batches
WHERE total_cost IS NOT NULL
  AND ABS(total_cost - (COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) +
                         COALESCE(equipment_cost, 0) + COALESCE(other_cost, 0))) > 0.01;
```

#### 6.3.5 检查生产效率异常

```sql
-- 查找生产效率异常的批次（<50%或>100%）
SELECT
  id,
  batch_number,
  quantity,
  output_quantity,
  production_efficiency
FROM processing_batches
WHERE status = 'completed'
  AND production_efficiency IS NOT NULL
  AND (production_efficiency < 50 OR production_efficiency > 100);
```

#### 6.3.6 检查时间逻辑错误

```sql
-- 查找结束时间早于开始时间的批次
SELECT
  id,
  batch_number,
  start_time,
  end_time,
  TIMESTAMPDIFF(MINUTE, start_time, end_time) as duration_minutes
FROM processing_batches
WHERE start_time IS NOT NULL
  AND end_time IS NOT NULL
  AND end_time < start_time;
```

---

## 7. 业务规则总结

### 7.1 批次号规则

- **全局唯一**：跨所有工厂，批次号不能重复
- **格式建议**：`BATCH-{日期}-{序号}`或`{年月日}-{序号}`
- **示例**：`BATCH-20251120-001`、`20251120-001`

### 7.2 状态流转规则

**允许的状态流转**：
- `pending` → `processing`（开始生产）
- `processing` → `completed`（完成生产）
- `pending` → `cancelled`（取消）
- `processing` → `cancelled`（取消）

**禁止的状态流转**：
- `completed` → `processing`（已完成不能回到进行中）
- `cancelled` → `processing`（已取消不能恢复）
- `completed` → `cancelled`（已完成不能取消）

### 7.3 成本核算规则

**5项成本**：
1. **materialCost（物料成本）**：原料、辅料、包装材料等
2. **laborCost（人工成本）**：从BatchWorkSession汇总计算
   - 公式：`SUM(work_minutes * ccr_rate)`
3. **equipmentCost（设备成本）**：从BatchEquipmentUsage汇总计算
   - 公式：`SUM(usage_minutes * hourly_cost / 60)`
4. **otherCost（其他成本）**：水电、燃气、清洁等
5. **totalCost（总成本）**：= 物料 + 人工 + 设备 + 其他

**成本计算时机**：
- 批次完成时计算所有成本
- 可在批次进行中实时更新成本

### 7.4 生产效率规则

**计算公式**：
```
productionEfficiency = (outputQuantity / quantity) * 100
```

**正常范围**：
- 90% - 100%：优秀
- 80% - 90%：良好
- 70% - 80%：一般
- < 70%：需要改进
- > 100%：超额完成（可能是计划产量设置过低）

**异常情况**：
- < 50%：严重异常，需要调查原因
- > 110%：可能是数据错误

### 7.5 时间管理规则

- **startTime**：状态变为processing时设置
- **endTime**：状态变为completed时设置
- **生产时长**：`endTime - startTime`
- **约束**：`endTime` >= `startTime`

### 7.6 数据隔离规则

- 所有批次通过`factoryId`关联到工厂
- 不同工厂的批次完全隔离
- 批次号全局唯一（跨工厂）

---

## 8. 性能优化建议

### 8.1 索引优化

**已有索引**：3个索引

**建议新增索引**：
```sql
-- 复合索引：工厂+状态（常用查询组合）
CREATE INDEX idx_factory_status ON processing_batches(factory_id, status);

-- 复合索引：工厂+创建时间（按时间查询）
CREATE INDEX idx_factory_created ON processing_batches(factory_id, created_at DESC);

-- 监管员索引（如果经常按监管员查询）
CREATE INDEX idx_supervisor ON processing_batches(supervisor_id);

-- 生产时间索引（用于时间范围查询）
CREATE INDEX idx_time_range ON processing_batches(start_time, end_time);
```

### 8.2 查询优化

**避免全表扫描**：
```sql
-- ❌ BAD: 全表扫描
SELECT * FROM processing_batches WHERE product_name LIKE '%鱼%';

-- ✅ GOOD: 使用索引
SELECT * FROM processing_batches
WHERE factory_id = 'FISH_2025_001' AND product_name = '冷冻鱼片';
```

**使用覆盖索引**：
```sql
-- ✅ GOOD: 只查询需要的字段
SELECT id, batch_number, product_name, status
FROM processing_batches
WHERE factory_id = 'FISH_2025_001' AND status = 'processing';
```

### 8.3 成本计算优化

**批量计算成本**：
```sql
-- 一次性更新所有已完成批次的成本
UPDATE processing_batches pb
SET
  labor_cost = (
    SELECT SUM(bws.work_minutes * u.ccr_rate)
    FROM batch_work_sessions bws
    JOIN users u ON bws.employee_id = u.id
    WHERE bws.batch_id = pb.id
  ),
  equipment_cost = (
    SELECT SUM(beu.usage_minutes * e.hourly_cost / 60)
    FROM batch_equipment_usages beu
    JOIN equipment e ON beu.equipment_id = e.id
    WHERE beu.batch_id = pb.id
  )
WHERE factory_id = 'FISH_2025_001'
  AND status = 'completed'
  AND labor_cost IS NULL;

-- 然后计算总成本
UPDATE processing_batches
SET total_cost = COALESCE(material_cost, 0)
               + COALESCE(labor_cost, 0)
               + COALESCE(equipment_cost, 0)
               + COALESCE(other_cost, 0)
WHERE factory_id = 'FISH_2025_001'
  AND status = 'completed'
  AND total_cost IS NULL;
```

---

## 9. 常见问题（FAQ）

### 9.1 为什么批次ID是String类型？

**原因**：
1. **灵活性**：支持自定义格式（如BATCH-20251120-001）
2. **可读性**：ID本身包含日期等业务信息
3. **兼容性**：便于与外部系统集成

### 9.2 outputQuantity和quantity的区别？

- **quantity**：计划产量（批次创建时设定）
- **outputQuantity**：实际产量（批次完成时记录）
- **用途**：计算生产效率 = (实际/计划) × 100%

### 9.3 如何计算批次的生产时长？

```sql
-- 方法1：使用TIMESTAMPDIFF
SELECT
  id,
  batch_number,
  TIMESTAMPDIFF(MINUTE, start_time, end_time) as duration_minutes,
  TIMESTAMPDIFF(HOUR, start_time, end_time) as duration_hours
FROM processing_batches
WHERE id = 'BATCH-20251120-001';

-- 方法2：使用TIMEDIFF
SELECT
  id,
  batch_number,
  TIMEDIFF(end_time, start_time) as duration
FROM processing_batches
WHERE id = 'BATCH-20251120-001';
```

### 9.4 如何处理跨天的批次？

**批次可以跨天**：
- `startTime`和`endTime`可以相差多天
- 系统会正确计算总时长
- 报表统计时按`created_at`或`end_time`归属到具体日期

### 9.5 批次可以修改吗？

**可修改字段**（批次进行中）：
- ✅ supervisor_id（更换监管员）
- ✅ quantity（调整计划产量）
- ✅ notes（更新备注）

**不可修改字段**（批次完成后）：
- ❌ batch_number（批次号）
- ❌ factory_id（所属工厂）
- ❌ status = 'completed'后不建议修改任何字段

---

**文档结束**

下一步：[PRD-Entity-MaterialBatch（原料批次）](./PRD-Entity-MaterialBatch.md)
