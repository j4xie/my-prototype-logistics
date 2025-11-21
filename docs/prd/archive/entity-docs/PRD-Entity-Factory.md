# PRD-Entity-Factory

## 文档信息

| 项目 | 内容 |
|------|------|
| 实体名称 | Factory（工厂） |
| 表名 | `factories` |
| 业务域 | 平台与工厂管理 |
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

**Factory**是白垩纪食品溯源系统的**多租户根节点实体**，代表一个**工厂（租户）**。

每个工厂是一个独立的**SaaS租户**，拥有：
- 🏭 独立的用户体系（员工账号）
- 📦 独立的生产数据（批次、质检、设备）
- 🤖 独立的AI配额（DeepSeek API调用限制）
- 💼 独立的订阅计划（BASIC/STANDARD/PREMIUM/ENTERPRISE）

### 1.2 核心价值

1. **多租户隔离**：实现数据隔离，不同工厂之间数据互不干扰
2. **中央管理**：平台管理员统一管理所有工厂
3. **成本控制**：通过AI配额管理控制每个工厂的API调用成本
4. **灵活订阅**：支持不同规模的工厂选择合适的订阅计划

### 1.3 生命周期

```
创建 → 激活 → 正常运营 ⇄ 停用 → 删除（软删除）→ 重新激活（可选）
  ↓      ↓        ↓           ↓           ↓
  1      2        3           4           5
```

**状态说明**：
1. **创建**：平台管理员创建新工厂租户（`POST /api/platform/factories`）
2. **激活**：`isActive = true`，工厂用户可以登录使用系统
3. **正常运营**：日常使用，创建批次、用户、设备等数据
4. **停用**：`isActive = false`，工厂用户无法登录，但数据保留
5. **删除**：软删除（设置`isActive = false`），可通过激活接口恢复

---

## 2. 字段详解

### 2.1 基础字段（继承自BaseEntity）

| 字段名 | 类型 | 可空 | 说明 |
|--------|------|------|------|
| id | String | 否 | 工厂ID（主键，手动生成） |
| createdAt | LocalDateTime | 否 | 创建时间（自动） |
| updatedAt | LocalDateTime | 否 | 更新时间（自动） |

### 2.2 工厂标识字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **id** | String | ❌ | - | 工厂ID，格式：`{industryCode}_{regionCode}_{序号}`<br>示例：`FISH_2025_001` |
| **name** | String | ❌ | - | 工厂名称（全局唯一）<br>示例："白垩纪水产品工厂" |
| **legacyId** | String | ✅ | null | 旧系统ID（用于数据迁移） |
| **industryCode** | String | ✅ | null | 行业代码（2-10位大写字母）<br>示例："FISH"、"FRUIT"、"MEAT" |
| **regionCode** | String | ✅ | null | 地区代码（4位数字）<br>示例："2025"、"2026" |
| **factoryYear** | Integer | ✅ | null | 工厂创建年份<br>示例：2025 |
| **sequenceNumber** | Integer | ✅ | null | 序号（同一行业+地区的递增序号）<br>示例：1, 2, 3, ... |

### 2.3 工厂基本信息

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **industry** | String | ✅ | null | 行业名称（可读性文本）<br>示例："水产品加工"、"水果加工" |
| **address** | String | ✅ | null | 工厂地址<br>示例："北京市朝阳区XXX路123号" |
| **employeeCount** | Integer | ✅ | null | 员工数量（统计用） |

### 2.4 联系方式

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **contactName** | String | ✅ | null | 联系人姓名<br>示例："张三" |
| **contactPhone** | String | ✅ | null | 联系电话（11位手机号）<br>示例："13800138000" |
| **contactEmail** | String | ✅ | null | 联系邮箱<br>示例："contact@factory.com" |

### 2.5 订阅与配额

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **subscriptionPlan** | String | ✅ | null | 订阅计划<br>可选值：BASIC, STANDARD, PREMIUM, ENTERPRISE |
| **aiWeeklyQuota** | Integer | ❌ | 20 | AI每周调用配额（次数）<br>范围：0-1000 |

### 2.6 状态与验证

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **isActive** | Boolean | ❌ | true | 是否激活<br>true=激活（用户可登录），false=停用 |
| **manuallyVerified** | Boolean | ❌ | false | 是否手动验证<br>true=已人工审核，false=未审核 |
| **confidence** | Float | ✅ | null | 置信度（AI推断的准确度）<br>范围：0.0-1.0 |

### 2.7 扩展字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **inferenceData** | String (JSON) | ✅ | null | AI推断数据（JSON格式）<br>存储AI分析的原始数据 |

---

## 3. 关联关系

### 3.1 一对多关系（OneToMany）

Factory是**多租户的根节点**，与多个实体有一对多关系：

| 关联实体 | 关系 | 映射字段 | 级联策略 | 说明 |
|---------|------|---------|---------|------|
| **User** | 1:N | `users` | CascadeType.ALL | 工厂下的所有用户 |
| **Supplier** | 1:N | `suppliers` | CascadeType.ALL | 工厂的供应商列表 |
| **Customer** | 1:N | `customers` | CascadeType.ALL | 工厂的客户列表 |
| **ProductionPlan** | 1:N | `productionPlans` | CascadeType.ALL | 工厂的生产计划 |
| **MaterialBatch** | 1:N | `materialBatches` | CascadeType.ALL | 工厂的原料批次 |
| **RawMaterialType** | 1:N | `rawMaterialTypes` | CascadeType.ALL | 工厂的原料类型 |
| **ProductType** | 1:N | `productTypes` | CascadeType.ALL | 工厂的产品类型 |
| **WorkType** | 1:N | `workTypes` | CascadeType.ALL | 工厂的工作类型 |
| **FactoryEquipment** | 1:N | `equipment` | CascadeType.ALL | 工厂的设备列表 |

### 3.2 关联关系图

```
                    Factory (工厂)
                        │
        ┌───────────────┼───────────────┬────────────────┬──────────────┐
        │               │               │                │              │
        ▼               ▼               ▼                ▼              ▼
    User(1:N)     Supplier(1:N)  ProductionPlan(1:N)  MaterialBatch(1:N)  Equipment(1:N)
    Department    Customer       ProductType           RawMaterialType     ...
    ...           ...            ...                   ...

所有关联都是 1:N (一个工厂对多个子实体)
```

### 3.3 级联操作

**级联策略：CascadeType.ALL**

这意味着：
- ✅ **创建工厂**：可以同时创建关联的用户、供应商等
- ✅ **更新工厂**：会自动传播更新到关联实体
- ⚠️ **删除工厂**：会级联删除所有关联的用户、批次、设备等（**危险操作！**）

**实际业务中**：
- 不应物理删除工厂
- 应使用**软删除**（设置`isActive = false`）
- 保留所有历史数据

### 3.4 懒加载策略

所有关联关系使用**FetchType.LAZY**（懒加载）：
- 查询Factory时**不会自动加载**关联的users、suppliers等
- 只有在**显式访问**关联集合时才加载
- 减少数据库查询，提升性能

**注意**：
- `@ToString(exclude = {"users", "suppliers", ...})` 排除关联字段，避免循环引用
- 避免在`toString()`中触发懒加载导致性能问题

---

## 4. 索引设计

### 4.1 主键索引

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| PRIMARY | 主键 | `id` | 工厂ID（String类型） |

### 4.2 唯一索引

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `uk_name` | UNIQUE | `name` | 工厂名称全局唯一 |

### 4.3 复合索引

| 索引名 | 字段组合 | 用途 |
|--------|---------|------|
| `idx_factory_code` | `industry_code`, `region_code`, `factory_year` | 快速查找同行业、同地区、同年份的工厂 |

### 4.4 单列索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_legacy_id` | `legacy_id` | 旧系统ID查询（数据迁移） |
| `idx_industry` | `industry_code` | 按行业查询工厂 |
| `idx_region` | `region_code` | 按地区查询工厂 |
| `idx_year` | `factory_year` | 按年份查询工厂 |
| `idx_name` | `name` | 工厂名称查询（虽然有唯一约束，但显式创建索引加速） |

### 4.5 索引使用场景

**场景1：按行业查找工厂**
```sql
-- 使用 idx_industry 索引
SELECT * FROM factories WHERE industry_code = 'FISH';
```

**场景2：按行业+地区查找工厂**
```sql
-- 使用 idx_factory_code 复合索引
SELECT * FROM factories
WHERE industry_code = 'FISH' AND region_code = '2025';
```

**场景3：工厂名称唯一性检查**
```sql
-- 使用 uk_name 唯一索引
SELECT * FROM factories WHERE name = '白垩纪水产品工厂';
```

**场景4：数据迁移查询**
```sql
-- 使用 idx_legacy_id 索引
SELECT * FROM factories WHERE legacy_id = 'OLD_FACTORY_123';
```

---

## 5. 数据流转

### 5.1 创建流程

**触发场景**：平台管理员创建新工厂租户

**API端点**：`POST /api/platform/factories`

**创建步骤**：
1. **验证数据**：检查工厂名称是否已存在（唯一约束）
2. **生成ID**：根据`industryCode`、`regionCode`、`factoryYear`生成工厂ID
   - 格式：`{industryCode}_{regionCode}_{序号}`
   - 示例：`FISH_2025_001`
3. **设置默认值**：
   - `isActive = true`
   - `manuallyVerified = false`
   - `aiWeeklyQuota = 20`（或根据订阅计划设置）
4. **插入数据库**：保存Factory记录
5. **初始化数据**：
   - 创建默认超级管理员账号（User）
   - 初始化基础配置数据（Department、WorkType等）

**SQL示例**：
```sql
INSERT INTO factories (
  id, name, industry_code, region_code, factory_year, sequence_number,
  industry, address, contact_name, contact_phone, contact_email,
  subscription_plan, ai_weekly_quota, is_active, manually_verified,
  created_at, updated_at
) VALUES (
  'FISH_2025_001',
  '白垩纪水产品工厂',
  'FISH',
  '2025',
  2025,
  1,
  '水产品加工',
  '北京市朝阳区XXX路123号',
  '张三',
  '13800138000',
  'contact@factory.com',
  'PREMIUM',
  50,
  true,
  false,
  NOW(),
  NOW()
);
```

### 5.2 更新流程

**触发场景**：平台管理员更新工厂信息

**API端点**：`PUT /api/platform/factories/{factoryId}`

**可更新字段**：
- 基本信息：`name`, `address`, `industry`
- 联系方式：`contactName`, `contactPhone`, `contactEmail`
- 订阅计划：`subscriptionPlan`, `aiWeeklyQuota`
- 状态：`isActive`, `manuallyVerified`

**不可更新字段**：
- ❌ `id`（主键）
- ❌ `industryCode`、`regionCode`、`factoryYear`（ID组成部分）
- ❌ `createdAt`（创建时间）

**SQL示例**：
```sql
UPDATE factories
SET
  name = '白垩纪水产品加工厂',
  address = '北京市朝阳区新地址456号',
  subscription_plan = 'ENTERPRISE',
  ai_weekly_quota = 100,
  updated_at = NOW()
WHERE id = 'FISH_2025_001';
```

### 5.3 激活/停用流程

**触发场景**：平台管理员激活或停用工厂

**API端点**：
- 激活：`POST /api/platform/factories/{factoryId}/activate`
- 停用：`POST /api/platform/factories/{factoryId}/deactivate`

**业务规则**：
- **激活**（`isActive = true`）：工厂用户可以登录
- **停用**（`isActive = false`）：工厂用户无法登录，但数据保留

**影响范围**：
- ✅ 用户登录：停用后所有工厂用户无法登录
- ✅ 新建数据：停用后无法创建新批次、用户等
- ✅ 查询数据：停用后仍可查询历史数据

**SQL示例**：
```sql
-- 停用工厂
UPDATE factories
SET is_active = false, updated_at = NOW()
WHERE id = 'FISH_2025_001';

-- 激活工厂
UPDATE factories
SET is_active = true, updated_at = NOW()
WHERE id = 'FISH_2025_001';
```

### 5.4 删除流程（软删除）

**触发场景**：平台管理员删除工厂

**API端点**：`DELETE /api/platform/factories/{factoryId}`

**业务规则**：
- ⚠️ **软删除**：不物理删除数据库记录，只设置`isActive = false`
- ⚠️ **可恢复**：通过激活接口可重新恢复工厂

**SQL示例**：
```sql
-- 软删除（等同于停用）
UPDATE factories
SET is_active = false, updated_at = NOW()
WHERE id = 'FISH_2025_001';
```

**注意**：
- 由于有`CascadeType.ALL`，如果执行真正的`DELETE`操作，会级联删除所有关联数据（用户、批次、设备等）
- **强烈建议**：永远不要执行物理删除，只使用软删除

### 5.5 查询流程

**常见查询场景**：

1. **查询所有活跃工厂**
```sql
SELECT * FROM factories
WHERE is_active = true
ORDER BY created_at DESC;
```

2. **按行业查询工厂**
```sql
SELECT * FROM factories
WHERE industry_code = 'FISH' AND is_active = true;
```

3. **按订阅计划查询工厂**
```sql
SELECT * FROM factories
WHERE subscription_plan = 'PREMIUM' AND is_active = true;
```

4. **查询AI配额超限工厂**（需要关联AI使用日志）
```sql
SELECT f.*, COUNT(a.id) as quota_used
FROM factories f
LEFT JOIN ai_usage_logs a ON f.id = a.factory_id
  AND YEARWEEK(a.created_at, 1) = YEARWEEK(NOW(), 1)
WHERE f.is_active = true
GROUP BY f.id
HAVING quota_used >= f.ai_weekly_quota;
```

---

## 6. SQL示例

### 6.1 基础CRUD操作

#### 6.1.1 创建工厂

```sql
INSERT INTO factories (
  id, name, industry_code, region_code, factory_year, sequence_number,
  industry, address, contact_name, contact_phone, contact_email,
  subscription_plan, ai_weekly_quota, is_active, manually_verified,
  created_at, updated_at
) VALUES (
  'FISH_2025_001',
  '白垩纪水产品工厂',
  'FISH',
  '2025',
  2025,
  1,
  '水产品加工',
  '北京市朝阳区XXX路123号',
  '张三',
  '13800138000',
  'contact@factory.com',
  'PREMIUM',
  50,
  true,
  false,
  NOW(),
  NOW()
);
```

#### 6.1.2 查询工厂详情

```sql
-- 基础查询
SELECT * FROM factories WHERE id = 'FISH_2025_001';

-- 查询工厂及其用户数量
SELECT
  f.*,
  COUNT(u.id) as user_count
FROM factories f
LEFT JOIN users u ON f.id = u.factory_id
WHERE f.id = 'FISH_2025_001'
GROUP BY f.id;

-- 查询工厂及所有关联统计
SELECT
  f.*,
  (SELECT COUNT(*) FROM users WHERE factory_id = f.id) as user_count,
  (SELECT COUNT(*) FROM processing_batches WHERE factory_id = f.id) as batch_count,
  (SELECT COUNT(*) FROM equipment WHERE factory_id = f.id) as equipment_count
FROM factories f
WHERE f.id = 'FISH_2025_001';
```

#### 6.1.3 更新工厂信息

```sql
-- 更新基本信息
UPDATE factories
SET
  name = '白垩纪水产品加工厂',
  address = '北京市朝阳区新地址456号',
  updated_at = NOW()
WHERE id = 'FISH_2025_001';

-- 升级订阅计划
UPDATE factories
SET
  subscription_plan = 'ENTERPRISE',
  ai_weekly_quota = 100,
  updated_at = NOW()
WHERE id = 'FISH_2025_001';
```

#### 6.1.4 停用/激活工厂

```sql
-- 停用工厂
UPDATE factories
SET is_active = false, updated_at = NOW()
WHERE id = 'FISH_2025_001';

-- 激活工厂
UPDATE factories
SET is_active = true, updated_at = NOW()
WHERE id = 'FISH_2025_001';
```

### 6.2 高级查询

#### 6.2.1 按行业和地区统计工厂数量

```sql
SELECT
  industry_code,
  region_code,
  COUNT(*) as factory_count,
  SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_count
FROM factories
GROUP BY industry_code, region_code
ORDER BY industry_code, region_code;
```

#### 6.2.2 查询AI配额使用率最高的工厂

```sql
SELECT
  f.id,
  f.name,
  f.ai_weekly_quota,
  COUNT(a.id) as quota_used,
  ROUND(COUNT(a.id) * 100.0 / f.ai_weekly_quota, 2) as utilization_rate
FROM factories f
LEFT JOIN ai_usage_logs a ON f.id = a.factory_id
  AND YEARWEEK(a.created_at, 1) = YEARWEEK(NOW(), 1)  -- 本周
WHERE f.is_active = true AND f.ai_weekly_quota > 0
GROUP BY f.id, f.name, f.ai_weekly_quota
ORDER BY utilization_rate DESC
LIMIT 10;
```

#### 6.2.3 查询新创建的工厂（最近30天）

```sql
SELECT
  id,
  name,
  industry_code,
  region_code,
  subscription_plan,
  created_at
FROM factories
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY created_at DESC;
```

#### 6.2.4 按订阅计划统计工厂分布

```sql
SELECT
  subscription_plan,
  COUNT(*) as factory_count,
  SUM(ai_weekly_quota) as total_quota,
  AVG(ai_weekly_quota) as avg_quota
FROM factories
WHERE is_active = true
GROUP BY subscription_plan
ORDER BY
  FIELD(subscription_plan, 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE');
```

#### 6.2.5 查询工厂ID生成序号（用于创建新工厂）

```sql
-- 查询同一行业+地区的最大序号
SELECT
  COALESCE(MAX(sequence_number), 0) + 1 as next_sequence
FROM factories
WHERE industry_code = 'FISH' AND region_code = '2025';
```

### 6.3 数据完整性检查

#### 6.3.1 检查工厂名称重复

```sql
-- 查找重复的工厂名称
SELECT name, COUNT(*) as count
FROM factories
GROUP BY name
HAVING count > 1;
```

#### 6.3.2 检查孤立的工厂（无用户）

```sql
-- 查找没有用户的工厂
SELECT f.*
FROM factories f
LEFT JOIN users u ON f.id = u.factory_id
WHERE f.is_active = true
GROUP BY f.id
HAVING COUNT(u.id) = 0;
```

#### 6.3.3 检查AI配额异常

```sql
-- 查找配额为0或异常的工厂
SELECT id, name, ai_weekly_quota
FROM factories
WHERE ai_weekly_quota < 0 OR ai_weekly_quota > 1000
ORDER BY ai_weekly_quota DESC;
```

---

## 7. 业务规则总结

### 7.1 工厂ID生成规则

**格式**：`{industryCode}_{regionCode}_{序号}`

**规则**：
1. `industryCode`：2-10位大写字母
2. `regionCode`：4位数字
3. `序号`：3位数字（001, 002, 003, ...）
4. 序号在同一`industryCode`和`regionCode`组合内递增

**示例**：
- 第1个水产行业、2025地区工厂：`FISH_2025_001`
- 第2个水产行业、2025地区工厂：`FISH_2025_002`
- 第1个水果行业、2025地区工厂：`FRUIT_2025_001`

### 7.2 工厂名称唯一性

- 工厂名称全局唯一（跨所有行业和地区）
- 创建或更新工厂时必须检查名称是否已存在
- 使用数据库唯一约束保证数据完整性

### 7.3 订阅计划与AI配额

| 订阅计划 | 默认AI配额（次/周） | 推荐使用场景 |
|---------|-------------------|-------------|
| BASIC | 10 | 小型工厂、试用阶段 |
| STANDARD | 30 | 中小型工厂、基本使用 |
| PREMIUM | 50 | 大型工厂、频繁使用 |
| ENTERPRISE | 100 | 超大型工厂、高频使用 |

**规则**：
- 创建工厂时可手动指定配额（优先于默认值）
- 配额范围：0-1000次/周
- 配额按ISO周（周一00:00自动重置）

### 7.4 软删除规则

- ✅ 使用`isActive = false`实现软删除
- ❌ 禁止物理删除工厂记录（会级联删除所有关联数据）
- ✅ 软删除后可通过激活接口恢复
- ✅ 停用的工厂数据仍保留，可查询

### 7.5 数据隔离规则

- 所有业务数据通过`factoryId`关联到工厂
- 不同工厂的数据完全隔离
- 平台管理员可跨工厂查询数据
- 工厂管理员只能查询本工厂数据

---

## 8. 性能优化建议

### 8.1 索引优化

**已有索引**：6个索引已覆盖大部分查询场景

**建议新增索引**（如有需要）：
```sql
-- 如果经常按订阅计划查询
CREATE INDEX idx_subscription_plan ON factories(subscription_plan);

-- 如果经常按激活状态查询
CREATE INDEX idx_is_active ON factories(is_active);

-- 复合索引（订阅计划+激活状态）
CREATE INDEX idx_sub_active ON factories(subscription_plan, is_active);
```

### 8.2 查询优化

**避免全表扫描**：
```sql
-- ❌ BAD: 全表扫描
SELECT * FROM factories WHERE YEAR(created_at) = 2025;

-- ✅ GOOD: 使用范围查询
SELECT * FROM factories
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
```

**避免在WHERE中使用函数**：
```sql
-- ❌ BAD: 函数导致索引失效
SELECT * FROM factories WHERE UPPER(name) = 'FISH FACTORY';

-- ✅ GOOD: 直接比较
SELECT * FROM factories WHERE name = 'Fish Factory';
```

### 8.3 懒加载优化

由于Factory有9个OneToMany关联，查询时要注意：

**场景1：只需要工厂基本信息**
```java
// ✅ GOOD: 不访问关联字段，不会触发懒加载
Factory factory = factoryRepository.findById("FISH_2025_001");
String name = factory.getName(); // OK
```

**场景2：需要关联数据**
```java
// ❌ BAD: N+1查询问题
List<Factory> factories = factoryRepository.findAll();
for (Factory f : factories) {
  int userCount = f.getUsers().size(); // 每个工厂触发一次查询
}

// ✅ GOOD: 使用JOIN FETCH
@Query("SELECT f FROM Factory f LEFT JOIN FETCH f.users WHERE f.id = :id")
Factory findByIdWithUsers(@Param("id") String id);
```

---

## 9. 数据迁移指南

### 9.1 从旧系统迁移

如果从旧系统迁移数据，使用`legacyId`字段：

```sql
-- 步骤1：插入迁移数据，保留旧ID
INSERT INTO factories (
  id, name, legacy_id, industry_code, region_code, factory_year, sequence_number,
  is_active, created_at, updated_at
) VALUES (
  'FISH_2025_001',  -- 新ID
  '旧系统工厂A',
  'OLD_FACTORY_123',  -- 旧系统ID
  'FISH',
  '2025',
  2025,
  1,
  true,
  '2020-01-01 00:00:00',  -- 保留旧创建时间
  NOW()
);

-- 步骤2：通过legacy_id查找新ID
SELECT id FROM factories WHERE legacy_id = 'OLD_FACTORY_123';
-- 返回: FISH_2025_001

-- 步骤3：更新关联表的外键
UPDATE users
SET factory_id = 'FISH_2025_001'
WHERE factory_id = 'OLD_FACTORY_123';
```

### 9.2 ID格式转换

如果旧系统使用数字ID，需要转换：

```sql
-- 旧ID: 123
-- 新ID: FISH_2025_001

-- 批量转换示例
UPDATE factories
SET id = CONCAT(industry_code, '_', region_code, '_', LPAD(sequence_number, 3, '0'))
WHERE id LIKE 'OLD_%';
```

---

## 10. 常见问题（FAQ）

### 10.1 为什么工厂ID是String类型而不是Long？

**原因**：
1. **可读性**：`FISH_2025_001`比`123456`更直观
2. **业务含义**：ID包含行业、地区、年份信息
3. **灵活性**：支持字母和数字组合
4. **迁移性**：便于从旧系统迁移（保留原ID格式）

### 10.2 为什么不使用物理删除？

**原因**：
1. **数据安全**：误删除后无法恢复
2. **审计需求**：保留历史记录用于审计
3. **关联数据**：物理删除会级联删除所有用户、批次等数据
4. **法律合规**：某些行业要求保留数据N年

### 10.3 AI配额如何计费？

- 每周一00:00自动重置使用量
- 超过配额后拒绝新的AI调用
- 平台管理员可临时提升配额
- 建议根据实际使用量选择合适的订阅计划

### 10.4 如何快速查找某个工厂的所有数据？

```sql
-- 工厂基本信息
SELECT * FROM factories WHERE id = 'FISH_2025_001';

-- 用户
SELECT * FROM users WHERE factory_id = 'FISH_2025_001';

-- 加工批次
SELECT * FROM processing_batches WHERE factory_id = 'FISH_2025_001';

-- 设备
SELECT * FROM equipment WHERE factory_id = 'FISH_2025_001';

-- ... 其他关联表类似
```

---

**文档结束**

下一步：[PRD-Entity-User（用户）](./PRD-Entity-User.md)
