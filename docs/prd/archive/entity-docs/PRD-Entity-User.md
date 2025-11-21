# PRD-Entity-User

## 文档信息

| 项目 | 内容 |
|------|------|
| 实体名称 | User（用户） |
| 表名 | `users` |
| 业务域 | 用户与权限管理 |
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

**User**是白垩纪食品溯源系统的**核心用户实体**，代表系统中的**员工账号**。

每个User代表：
- 👤 一个工厂的员工账号
- 🔑 具有特定角色和权限的操作者
- 📊 生产活动的创建者和记录者
- 💰 有薪资和成本核算的人力资源

### 1.2 8角色系统

白垩纪系统支持**8种用户角色**，分为**平台角色**和**工厂角色**：

**平台角色**（2个）：
1. **super_admin**（超级管理员）：平台最高权限
2. **platform_admin**（平台管理员）：平台管理权限

**工厂角色**（6个）：
3. **factory_super_admin**（工厂超管）：工厂最高权限
4. **permission_admin**（权限管理员）：管理用户和权限
5. **department_admin**（部门管理员）：管理部门员工
6. **supervisor**（监管员）：监管生产流程
7. **operator**（操作员）：执行生产操作
8. **factory_worker**（工厂工人）：普通员工

### 1.3 核心价值

1. **身份认证**：用户登录、权限验证
2. **数据溯源**：记录谁创建了哪些数据
3. **成本核算**：工资、工时、CCR成本计算
4. **生产追踪**：工作会话、批次操作记录

### 1.4 生命周期

```
创建 → 激活 → 正常使用 ⇄ 停用 → 删除（软删除）→ 重新激活（可选）
  ↓      ↓        ↓          ↓           ↓
  1      2        3          4           5
```

**状态说明**：
1. **创建**：管理员创建新用户账号（`POST /api/users/`）
2. **激活**：`isActive = true`，用户可以登录
3. **正常使用**：日常登录、操作生产数据
4. **停用**：`isActive = false`，用户无法登录
5. **删除**：软删除（设置`isActive = false`）

---

## 2. 字段详解

### 2.1 基础字段（继承自BaseEntity）

| 字段名 | 类型 | 可空 | 说明 |
|--------|------|------|------|
| id | Integer | 否 | 用户ID（主键，自增） |
| createdAt | LocalDateTime | 否 | 创建时间（自动） |
| updatedAt | LocalDateTime | 否 | 更新时间（自动） |

### 2.2 身份标识字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **id** | Integer | ❌ | 自增 | 用户ID（主键） |
| **factoryId** | String | ❌ | - | 所属工厂ID（外键）<br>示例："FISH_2025_001" |
| **username** | String | ❌ | - | 用户名（全局唯一）<br>示例："zhangsan"、"admin" |
| **passwordHash** | String | ❌ | - | 密码哈希（BCrypt加密）<br>不存储明文密码！ |

### 2.3 个人信息字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **fullName** | String | ✅ | null | 用户全名<br>示例："张三"、"John Doe" |
| **phone** | String | ✅ | null | 手机号（11位）<br>示例："13800138000" |

### 2.4 组织架构字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **department** | String | ✅ | null | 部门名称<br>示例："生产部"、"质检部" |
| **position** | String | ✅ | null | 职位/角色<br>可选值：见1.2节的8角色 |
| **roleCode** | String | ✅ | null | 角色代码（补充position）<br>示例："factory_super_admin" |

### 2.5 状态字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **isActive** | Boolean | ❌ | true | 是否激活<br>true=可登录，false=已停用 |
| **lastLogin** | LocalDateTime | ✅ | null | 最后登录时间<br>用于统计活跃度 |

### 2.6 薪资与成本字段

| 字段名 | 类型 | 可空 | 默认值 | 说明 |
|--------|------|------|--------|------|
| **monthlySalary** | BigDecimal | ✅ | null | 月薪（元）<br>示例：8000.00 |
| **expectedWorkMinutes** | Integer | ✅ | null | 预期工作分钟数/月<br>示例：10080（168小时×60分钟） |
| **ccrRate** | BigDecimal | ✅ | null | CCR比率（成本核算率）<br>计算公式：monthlySalary / expectedWorkMinutes |

**CCR (Cost Conversion Rate) 说明**：
- 用于计算每分钟人工成本
- 示例：月薪8000元，预期工作168小时（10080分钟）
- CCR = 8000 / 10080 ≈ 0.7937 元/分钟

---

## 3. 关联关系

### 3.1 多对一关系（ManyToOne）

| 关联实体 | 关系 | 外键字段 | 说明 |
|---------|------|---------|------|
| **Factory** | N:1 | `factoryId` | 用户所属工厂 |

### 3.2 一对多关系（OneToMany）

User作为**数据创建者**和**操作记录者**，与多个实体有关联：

| 关联实体 | 关系 | 映射字段 | 业务含义 |
|---------|------|---------|---------|
| **Session** | 1:N | `sessions` | 用户的登录会话 |
| **EmployeeWorkSession** | 1:N | `workSessions` | 员工工时记录 |
| **MaterialConsumption** | 1:N | `materialConsumptions` | 物料消耗记录（记录人） |
| **BatchWorkSession** | 1:N | `batchWorkSessions` | 批次工时记录 |
| **RawMaterialType** | 1:N | `createdMaterialTypes` | 创建的原料类型 |
| **ProductType** | 1:N | `createdProductTypes` | 创建的产品类型 |
| **Supplier** | 1:N | `createdSuppliers` | 创建的供应商 |
| **Customer** | 1:N | `createdCustomers` | 创建的客户 |
| **ProductionPlan** | 1:N | `createdProductionPlans` | 创建的生产计划 |
| **MaterialBatch** | 1:N | `createdMaterialBatches` | 创建的原料批次 |
| **MaterialBatchAdjustment** | 1:N | `batchAdjustments` | 批次调整记录（操作人） |

### 3.3 关联关系图

```
                        User (用户)
                           │
        ┌──────────────────┼──────────────────┬───────────────┐
        │                  │                  │               │
        ▼                  ▼                  ▼               ▼
   Factory(N:1)      Session(1:N)     WorkSession(1:N)  MaterialConsumption(1:N)
   (所属工厂)        (登录会话)        (工时记录)        (物料消耗记录)

        │
        └─ 作为创建者 (createdBy) ──────┬──────────┬──────────┬──────────┐
                                       │          │          │          │
                                       ▼          ▼          ▼          ▼
                              RawMaterialType ProductType Supplier Customer
                              (原料类型)     (产品类型)   (供应商)  (客户)
                                       │          │          │          │
                                       ▼          ▼          ▼          ▼
                              ProductionPlan MaterialBatch BatchAdjustment
                              (生产计划)     (原料批次)    (批次调整)
```

### 3.4 级联操作

**级联策略：CascadeType.ALL**

这意味着：
- ✅ **创建用户**：可以同时创建会话、工时记录等
- ✅ **更新用户**：会自动传播更新
- ⚠️ **删除用户**：会级联删除所有关联的会话、工时记录等（**危险！**）

**实际业务中**：
- 不应物理删除用户
- 应使用**软删除**（设置`isActive = false`）
- 保留所有历史数据和审计记录

### 3.5 懒加载策略

所有关联关系使用**FetchType.LAZY**（懒加载）：
- 查询User时**不会自动加载**关联的sessions、workSessions等
- 只有在**显式访问**关联集合时才加载
- 减少N+1查询问题

**注意**：
- `@ToString(exclude = {...})` 排除关联字段，避免循环引用
- 避免在`toString()`中触发懒加载导致性能问题

---

## 4. 索引设计

### 4.1 主键索引

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| PRIMARY | 主键 | `id` | 用户ID（自增Integer） |

### 4.2 唯一索引

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `uk_username` | UNIQUE | `username` | 用户名全局唯一 |

### 4.3 复合索引

| 索引名 | 字段组合 | 用途 |
|--------|---------|------|
| `idx_factory_username` | `factory_id`, `username` | 快速查找某工厂的用户 |
| `idx_active_users` | `is_active`, `factory_id` | 查询活跃用户 |

### 4.4 单列索引

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_username` | `username` | 用户名查询（虽然有唯一约束，但显式创建索引加速） |

### 4.5 索引使用场景

**场景1：用户登录**
```sql
-- 使用 uk_username 唯一索引
SELECT * FROM users WHERE username = 'zhangsan';
```

**场景2：查询某工厂的所有用户**
```sql
-- 使用 idx_factory_username 复合索引
SELECT * FROM users WHERE factory_id = 'FISH_2025_001';
```

**场景3：查询活跃用户**
```sql
-- 使用 idx_active_users 复合索引
SELECT * FROM users
WHERE is_active = true AND factory_id = 'FISH_2025_001';
```

**场景4：检查用户名是否存在**
```sql
-- 使用 uk_username 唯一索引
SELECT COUNT(*) FROM users WHERE username = 'newuser';
```

---

## 5. 数据流转

### 5.1 创建流程

**触发场景**：管理员创建新用户账号

**API端点**：`POST /api/users/`

**创建步骤**：
1. **验证数据**：
   - 检查用户名是否已存在（唯一约束）
   - 验证工厂ID是否有效
   - 验证角色是否合法
2. **密码加密**：
   - 使用BCrypt算法加密密码
   - 不存储明文密码
3. **计算CCR**：
   - 如果提供了`monthlySalary`和`expectedWorkMinutes`
   - 计算`ccrRate = monthlySalary / expectedWorkMinutes`
4. **设置默认值**：
   - `isActive = true`
   - `lastLogin = null`（首次登录时更新）
5. **插入数据库**：保存User记录

**SQL示例**：
```sql
INSERT INTO users (
  factory_id, username, password_hash, full_name, phone,
  department, position, role_code, is_active,
  monthly_salary, expected_work_minutes, ccr_rate,
  created_at, updated_at
) VALUES (
  'FISH_2025_001',
  'zhangsan',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1nZh8kFi8f7rY5XqJ5.8bN5tTZ5gIZy',  -- BCrypt哈希
  '张三',
  '13800138000',
  '生产部',
  'supervisor',
  'supervisor',
  true,
  8000.00,
  10080,  -- 168小时 × 60分钟
  0.7937,  -- 8000 / 10080
  NOW(),
  NOW()
);
```

### 5.2 登录流程

**触发场景**：用户登录系统

**API端点**：`POST /api/auth/login`

**登录步骤**：
1. **查询用户**：根据`username`查找用户
2. **验证密码**：使用BCrypt验证密码哈希
3. **检查状态**：验证`isActive = true`
4. **更新登录时间**：设置`lastLogin = NOW()`
5. **创建会话**：插入Session记录
6. **生成Token**：返回JWT AccessToken和RefreshToken

**SQL示例**：
```sql
-- 步骤1: 查询用户
SELECT id, factory_id, username, password_hash, is_active, position
FROM users
WHERE username = 'zhangsan';

-- 步骤2: 验证密码（在应用层使用BCrypt）
-- passwordEncoder.matches(rawPassword, passwordHash)

-- 步骤3: 检查状态
WHERE is_active = true

-- 步骤4: 更新登录时间
UPDATE users
SET last_login = NOW(), updated_at = NOW()
WHERE id = 123;

-- 步骤5: 创建会话
INSERT INTO sessions (user_id, access_token, refresh_token, created_at, expires_at)
VALUES (123, 'eyJhbGc...', 'eyJhbGc...', NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY));
```

### 5.3 更新流程

**触发场景**：管理员更新用户信息

**API端点**：`PUT /api/users/{userId}`

**可更新字段**：
- 个人信息：`fullName`, `phone`
- 组织架构：`department`, `position`, `roleCode`
- 薪资成本：`monthlySalary`, `expectedWorkMinutes`, `ccrRate`
- 状态：`isActive`

**不可更新字段**：
- ❌ `id`（主键）
- ❌ `factoryId`（所属工厂，如需转移需重新创建账号）
- ❌ `username`（用户名，如需修改需重新创建账号）
- ❌ `createdAt`（创建时间）

**修改密码**：
- 使用专门的修改密码接口
- 需要验证旧密码
- 新密码使用BCrypt重新加密

**SQL示例**：
```sql
-- 更新基本信息
UPDATE users
SET
  full_name = '张三（新）',
  phone = '13900139000',
  department = '质检部',
  position = 'department_admin',
  updated_at = NOW()
WHERE id = 123;

-- 更新薪资和CCR
UPDATE users
SET
  monthly_salary = 10000.00,
  expected_work_minutes = 10080,
  ccr_rate = 0.9921,  -- 10000 / 10080
  updated_at = NOW()
WHERE id = 123;

-- 修改密码
UPDATE users
SET
  password_hash = '$2a$10$NewHashValue...',
  updated_at = NOW()
WHERE id = 123;
```

### 5.4 激活/停用流程

**触发场景**：管理员激活或停用用户

**API端点**：
- 激活：`PUT /api/users/{userId}/activate`
- 停用：`PUT /api/users/{userId}/deactivate`

**业务规则**：
- **停用**（`isActive = false`）：用户无法登录，现有会话失效
- **激活**（`isActive = true`）：用户可以重新登录

**影响范围**：
- ✅ 用户登录：停用后无法登录
- ✅ 现有会话：停用后立即失效
- ✅ 历史数据：停用后仍保留所有历史记录

**SQL示例**：
```sql
-- 停用用户
UPDATE users
SET is_active = false, updated_at = NOW()
WHERE id = 123;

-- 使现有会话失效
DELETE FROM sessions WHERE user_id = 123;

-- 激活用户
UPDATE users
SET is_active = true, updated_at = NOW()
WHERE id = 123;
```

### 5.5 删除流程（软删除）

**触发场景**：管理员删除用户

**API端点**：`DELETE /api/users/{userId}`

**业务规则**：
- ⚠️ **软删除**：不物理删除记录，只设置`isActive = false`
- ⚠️ **保留数据**：所有创建的生产数据（批次、计划等）仍保留

**SQL示例**：
```sql
-- 软删除（等同于停用）
UPDATE users
SET is_active = false, updated_at = NOW()
WHERE id = 123;
```

**注意**：
- 由于有`CascadeType.ALL`，如果执行真正的`DELETE`操作，会级联删除所有关联数据
- **强烈建议**：永远不要执行物理删除，只使用软删除

---

## 6. SQL示例

### 6.1 基础CRUD操作

#### 6.1.1 创建用户

```sql
-- 创建普通员工
INSERT INTO users (
  factory_id, username, password_hash, full_name, phone,
  department, position, role_code, is_active,
  monthly_salary, expected_work_minutes, ccr_rate,
  created_at, updated_at
) VALUES (
  'FISH_2025_001',
  'worker001',
  '$2a$10$BCryptHashValue...',
  '李四',
  '13800138001',
  '生产部',
  'factory_worker',
  'factory_worker',
  true,
  5000.00,
  10080,
  0.4960,
  NOW(),
  NOW()
);

-- 创建管理员
INSERT INTO users (
  factory_id, username, password_hash, full_name, phone,
  department, position, role_code, is_active,
  created_at, updated_at
) VALUES (
  'FISH_2025_001',
  'admin',
  '$2a$10$BCryptHashValue...',
  '管理员',
  '13800138888',
  '管理部',
  'factory_super_admin',
  'factory_super_admin',
  true,
  NOW(),
  NOW()
);
```

#### 6.1.2 查询用户

```sql
-- 基础查询
SELECT * FROM users WHERE id = 123;

-- 查询用户及所属工厂
SELECT
  u.*,
  f.name as factory_name
FROM users u
JOIN factories f ON u.factory_id = f.id
WHERE u.id = 123;

-- 查询用户及创建的数据统计
SELECT
  u.*,
  (SELECT COUNT(*) FROM material_batches WHERE created_by_user_id = u.id) as created_batches,
  (SELECT COUNT(*) FROM production_plans WHERE created_by_user_id = u.id) as created_plans
FROM users u
WHERE u.id = 123;
```

#### 6.1.3 更新用户

```sql
-- 更新基本信息
UPDATE users
SET
  full_name = '李四（更新）',
  phone = '13900139001',
  updated_at = NOW()
WHERE id = 123;

-- 晋升用户（修改职位）
UPDATE users
SET
  position = 'supervisor',
  role_code = 'supervisor',
  department = '生产管理部',
  updated_at = NOW()
WHERE id = 123;
```

#### 6.1.4 停用/激活用户

```sql
-- 停用用户
UPDATE users
SET is_active = false, updated_at = NOW()
WHERE id = 123;

-- 激活用户
UPDATE users
SET is_active = true, updated_at = NOW()
WHERE id = 123;
```

### 6.2 高级查询

#### 6.2.1 按工厂查询用户列表

```sql
SELECT
  id,
  username,
  full_name,
  department,
  position,
  is_active,
  last_login
FROM users
WHERE factory_id = 'FISH_2025_001'
ORDER BY created_at DESC;
```

#### 6.2.2 按角色查询用户

```sql
-- 查询所有管理员
SELECT * FROM users
WHERE position IN ('factory_super_admin', 'permission_admin', 'department_admin')
  AND is_active = true
  AND factory_id = 'FISH_2025_001';

-- 查询所有生产操作员
SELECT * FROM users
WHERE position IN ('supervisor', 'operator', 'factory_worker')
  AND is_active = true
  AND factory_id = 'FISH_2025_001';
```

#### 6.2.3 查询活跃用户（最近30天登录）

```sql
SELECT
  id,
  username,
  full_name,
  last_login,
  DATEDIFF(NOW(), last_login) as days_since_login
FROM users
WHERE last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND is_active = true
  AND factory_id = 'FISH_2025_001'
ORDER BY last_login DESC;
```

#### 6.2.4 查询未登录用户（僵尸账号）

```sql
SELECT
  id,
  username,
  full_name,
  created_at,
  last_login,
  DATEDIFF(NOW(), created_at) as days_since_created
FROM users
WHERE (last_login IS NULL OR last_login < DATE_SUB(NOW(), INTERVAL 90 DAY))
  AND is_active = true
  AND factory_id = 'FISH_2025_001'
ORDER BY created_at DESC;
```

#### 6.2.5 按部门统计用户数量

```sql
SELECT
  department,
  COUNT(*) as user_count,
  SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_count
FROM users
WHERE factory_id = 'FISH_2025_001'
GROUP BY department
ORDER BY user_count DESC;
```

#### 6.2.6 按职位统计用户分布

```sql
SELECT
  position,
  COUNT(*) as user_count,
  AVG(monthly_salary) as avg_salary,
  MIN(monthly_salary) as min_salary,
  MAX(monthly_salary) as max_salary
FROM users
WHERE factory_id = 'FISH_2025_001' AND is_active = true
GROUP BY position
ORDER BY
  FIELD(position, 'factory_super_admin', 'permission_admin', 'department_admin', 'supervisor', 'operator', 'factory_worker');
```

#### 6.2.7 查询人工成本最高的用户

```sql
SELECT
  id,
  username,
  full_name,
  department,
  position,
  monthly_salary,
  ccr_rate
FROM users
WHERE factory_id = 'FISH_2025_001' AND is_active = true
ORDER BY monthly_salary DESC
LIMIT 10;
```

#### 6.2.8 查询创建数据最多的用户

```sql
SELECT
  u.id,
  u.username,
  u.full_name,
  u.department,
  u.position,
  COUNT(mb.id) as created_batches_count
FROM users u
LEFT JOIN material_batches mb ON u.id = mb.created_by_user_id
WHERE u.factory_id = 'FISH_2025_001' AND u.is_active = true
GROUP BY u.id, u.username, u.full_name, u.department, u.position
ORDER BY created_batches_count DESC
LIMIT 10;
```

### 6.3 数据完整性检查

#### 6.3.1 检查用户名重复

```sql
-- 查找重复的用户名
SELECT username, COUNT(*) as count
FROM users
GROUP BY username
HAVING count > 1;
```

#### 6.3.2 检查孤立用户（工厂不存在）

```sql
-- 查找工厂不存在的用户
SELECT u.*
FROM users u
LEFT JOIN factories f ON u.factory_id = f.id
WHERE f.id IS NULL;
```

#### 6.3.3 检查CCR计算错误

```sql
-- 查找CCR计算不正确的用户
SELECT
  id,
  username,
  monthly_salary,
  expected_work_minutes,
  ccr_rate,
  (monthly_salary / expected_work_minutes) as calculated_ccr,
  ABS(ccr_rate - (monthly_salary / expected_work_minutes)) as diff
FROM users
WHERE monthly_salary IS NOT NULL
  AND expected_work_minutes IS NOT NULL
  AND expected_work_minutes > 0
  AND ABS(ccr_rate - (monthly_salary / expected_work_minutes)) > 0.01;  -- 差异大于0.01
```

#### 6.3.4 检查无效角色

```sql
-- 查找角色不在允许列表中的用户
SELECT id, username, position, role_code
FROM users
WHERE position NOT IN (
  'super_admin', 'platform_admin',
  'factory_super_admin', 'permission_admin', 'department_admin',
  'supervisor', 'operator', 'factory_worker'
)
AND position IS NOT NULL;
```

### 6.4 权限相关查询

#### 6.4.1 查询某用户的权限字符串

```sql
-- 在应用层调用getPermissions()方法
-- 这里展示查询用户角色
SELECT
  id,
  username,
  position,
  role_code,
  CASE position
    WHEN 'super_admin' THEN 'admin:all'
    WHEN 'permission_admin' THEN 'admin:users,admin:permissions'
    WHEN 'supervisor' THEN 'manager:all,production:all,employee:all'
    WHEN 'operator' THEN 'production:view,production:manage,timeclock:manage'
    ELSE ''
  END as permissions
FROM users
WHERE id = 123;
```

#### 6.4.2 查询具有特定权限的用户

```sql
-- 查询所有管理权限的用户
SELECT * FROM users
WHERE position IN ('super_admin', 'factory_super_admin', 'permission_admin')
  AND is_active = true
  AND factory_id = 'FISH_2025_001';
```

---

## 7. 业务规则总结

### 7.1 用户名规则

- **全局唯一**：跨所有工厂，用户名不能重复
- **格式建议**：小写字母+数字，3-20字符
- **不可修改**：创建后不能修改用户名

### 7.2 密码规则

- **存储方式**：BCrypt加密，不存储明文
- **强度要求**（建议）：
  - 最少8个字符
  - 包含大小写字母、数字、特殊字符
  - 不能是常见弱密码
- **修改密码**：需要验证旧密码

### 7.3 角色与权限

**8种角色**（见1.2节）：
- 平台角色（2个）：super_admin, platform_admin
- 工厂角色（6个）：factory_super_admin, permission_admin, department_admin, supervisor, operator, factory_worker

**权限映射**：
- super_admin：所有权限
- factory_super_admin：工厂所有权限
- supervisor：生产管理权限
- operator：生产操作权限
- factory_worker：基础员工权限

### 7.4 薪资与成本核算

**CCR计算公式**：
```
ccrRate = monthlySalary / expectedWorkMinutes
```

**示例**：
- 月薪：8000元
- 预期工作时间：168小时/月（21天×8小时）
- 预期工作分钟数：10080分钟（168×60）
- CCR：8000 / 10080 = 0.7937 元/分钟

**使用场景**：
- 批次成本核算
- 工时成本计算
- 人工成本报表

### 7.5 软删除规则

- ✅ 使用`isActive = false`实现软删除
- ❌ 禁止物理删除用户记录（会级联删除所有创建的数据）
- ✅ 软删除后可通过激活接口恢复
- ✅ 停用的用户创建的数据仍保留

### 7.6 多租户隔离

- 所有用户通过`factoryId`关联到工厂
- 不同工厂的用户完全隔离
- 平台管理员可跨工厂查询用户
- 工厂管理员只能查询本工厂用户

---

## 8. 性能优化建议

### 8.1 索引优化

**已有索引**：3个索引已覆盖大部分查询场景

**建议新增索引**（如有需要）：
```sql
-- 如果经常按部门查询
CREATE INDEX idx_department ON users(factory_id, department, is_active);

-- 如果经常按职位查询
CREATE INDEX idx_position ON users(factory_id, position, is_active);

-- 如果经常按最后登录时间查询
CREATE INDEX idx_last_login ON users(last_login DESC);
```

### 8.2 查询优化

**避免全表扫描**：
```sql
-- ❌ BAD: 全表扫描
SELECT * FROM users WHERE full_name LIKE '%张%';

-- ✅ GOOD: 使用索引
SELECT * FROM users WHERE factory_id = 'FISH_2025_001' AND username = 'zhangsan';
```

**避免在WHERE中使用函数**：
```sql
-- ❌ BAD: 函数导致索引失效
SELECT * FROM users WHERE YEAR(created_at) = 2025;

-- ✅ GOOD: 使用范围查询
SELECT * FROM users
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
```

### 8.3 懒加载优化

由于User有11个OneToMany关联，查询时要注意：

**场景1：只需要用户基本信息**
```java
// ✅ GOOD: 不访问关联字段，不会触发懒加载
User user = userRepository.findById(123);
String name = user.getFullName(); // OK
```

**场景2：需要关联数据**
```java
// ❌ BAD: N+1查询问题
List<User> users = userRepository.findAll();
for (User u : users) {
  int sessionCount = u.getSessions().size(); // 每个用户触发一次查询
}

// ✅ GOOD: 使用JOIN FETCH
@Query("SELECT u FROM User u LEFT JOIN FETCH u.sessions WHERE u.id = :id")
User findByIdWithSessions(@Param("id") Integer id);
```

---

## 9. 安全最佳实践

### 9.1 密码安全

**存储**：
- ✅ 使用BCrypt加密（自动加盐）
- ❌ 不存储明文密码
- ❌ 不使用MD5/SHA1（已不安全）

**传输**：
- ✅ HTTPS传输密码
- ✅ 前端不记录密码到日志

**验证**：
```java
// ✅ GOOD: 使用BCrypt验证
boolean matches = passwordEncoder.matches(rawPassword, user.getPasswordHash());

// ❌ BAD: 明文比较
if (rawPassword.equals(user.getPasswordHash())) { ... }
```

### 9.2 会话安全

- 使用JWT Token（AccessToken + RefreshToken）
- AccessToken有效期：1小时
- RefreshToken有效期：7天
- 停用用户时立即清除所有会话

### 9.3 权限验证

```java
// ✅ GOOD: 使用Spring Security注解
@PreAuthorize("hasAuthority('supervisor')")
public void supervisorOnlyMethod() { ... }

// ✅ GOOD: 手动验证
if (!user.getPosition().equals("supervisor")) {
  throw new ForbiddenException("权限不足");
}
```

---

## 10. 常见问题（FAQ）

### 10.1 为什么用户名全局唯一而不是工厂内唯一？

**原因**：
1. **简化登录**：用户只需输入用户名，不需要选择工厂
2. **避免混淆**：防止不同工厂的同名用户混淆
3. **数据安全**：防止跨工厂的用户名猜测攻击

### 10.2 为什么有position和roleCode两个字段？

**原因**：
- **position**：旧字段，兼容历史数据
- **roleCode**：新字段，更明确的角色标识
- **便捷方法**：`getRole()`优先返回`roleCode`，如果为空则返回`position`

### 10.3 CCR比率如何使用？

**计算每分钟人工成本**：
```sql
-- 批次工时成本
SELECT
  b.batch_number,
  SUM(ws.work_minutes) as total_minutes,
  SUM(ws.work_minutes * u.ccr_rate) as labor_cost
FROM batch_work_sessions ws
JOIN users u ON ws.employee_id = u.id
WHERE ws.batch_id = 'BATCH_001'
GROUP BY b.batch_number;
```

### 10.4 如何批量导入用户？

```sql
-- 使用INSERT INTO ... VALUES批量插入
INSERT INTO users (factory_id, username, password_hash, full_name, is_active, created_at, updated_at)
VALUES
  ('FISH_2025_001', 'user1', '$2a$10$hash1...', '用户1', true, NOW(), NOW()),
  ('FISH_2025_001', 'user2', '$2a$10$hash2...', '用户2', true, NOW(), NOW()),
  ('FISH_2025_001', 'user3', '$2a$10$hash3...', '用户3', true, NOW(), NOW());
```

### 10.5 如何快速查找某用户创建的所有数据？

```sql
-- 原料批次
SELECT * FROM material_batches WHERE created_by_user_id = 123;

-- 生产计划
SELECT * FROM production_plans WHERE created_by_user_id = 123;

-- 原料类型
SELECT * FROM raw_material_types WHERE created_by_user_id = 123;

-- 产品类型
SELECT * FROM product_types WHERE created_by_user_id = 123;

-- 供应商
SELECT * FROM suppliers WHERE created_by_user_id = 123;

-- 客户
SELECT * FROM customers WHERE created_by_user_id = 123;
```

---

**文档结束**

下一步：[PRD-Entity-ProcessingBatch（加工批次）](./PRD-Entity-ProcessingBatch.md)
