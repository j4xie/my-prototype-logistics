# PRD-API-WhitelistController

**控制器**: WhitelistController
**基础路径**: `/api/{factoryId}/whitelist`
**功能**: 白名单管理
**端点数量**: 21个
**文档版本**: v1.0.0
**最后更新**: 2025-01-20

---

## 📋 目录

- [控制器概览](#控制器概览)
- [API端点列表](#api端点列表)
- [详细API文档](#详细api文档)
  - [1. 基础CRUD操作](#1-基础crud操作)
  - [2. 验证与使用管理](#2-验证与使用管理)
  - [3. 统计与查询](#3-统计与查询)
  - [4. 状态管理](#4-状态管理)
  - [5. 导入导出](#5-导入导出)
  - [6. 维护操作](#6-维护操作)
- [前端集成指南](#前端集成指南)
- [业务规则](#业务规则)
- [错误处理](#错误处理)

---

## 控制器概览

### 核心功能
WhitelistController提供**完整的白名单管理功能**，用于控制哪些手机号可以注册和使用系统，支持批量操作、使用次数限制、有效期管理、导入导出等企业级需求。

### 技术特点
- **批量管理**: 支持批量添加、删除白名单
- **访问控制**: 基于手机号的精确访问控制
- **使用追踪**: 记录使用次数和最后使用时间
- **有效期管理**: 支持设置和延长有效期
- **智能验证**: 实时验证手机号是否在白名单中
- **数据分析**: 提供丰富的统计信息和活跃度分析
- **导入导出**: 支持CSV格式的批量导入导出
- **自动清理**: 自动更新过期状态，清理历史数据

### 业务价值
- 精确控制系统访问权限
- 提高系统安全性
- 支持临时访问授权（时效性）
- 防止滥用（使用次数限制）
- 便于批量管理大量用户
- 数据驱动的权限优化

---

## API端点列表

### 1. 基础CRUD操作 (6个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| POST | `/batch` | 批量添加白名单 | super_admin / factory_admin / permission_admin |
| GET | `/` | 获取白名单列表(分页) | super_admin / factory_admin / permission_admin |
| GET | `/{id}` | 获取白名单详情 | super_admin / factory_admin / permission_admin |
| PUT | `/{id}` | 更新白名单 | super_admin / factory_admin / permission_admin |
| DELETE | `/{id}` | 删除白名单 | super_admin / factory_admin / permission_admin |
| DELETE | `/batch` | 批量删除白名单 | super_admin / factory_admin / permission_admin |

### 2. 验证与使用管理 (2个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/validate/{phoneNumber}` | 验证手机号是否在白名单中 | 公开 |
| PUT | `/usage/{phoneNumber}` | 增加使用次数 | 公开 |

### 3. 统计与查询 (5个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/stats` | 获取白名单统计信息 | super_admin / factory_admin / permission_admin |
| GET | `/search` | 搜索白名单 | super_admin / factory_admin / permission_admin |
| GET | `/expiring` | 获取即将过期的白名单 | super_admin / factory_admin / permission_admin |
| GET | `/most-active` | 获取最活跃用户 | super_admin / factory_admin / permission_admin |
| GET | `/recently-used` | 获取最近使用的白名单 | super_admin / factory_admin / permission_admin |

### 4. 状态管理 (4个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| PUT | `/expired` | 更新过期的白名单状态 | super_admin / factory_admin / permission_admin |
| PUT | `/limit-reached` | 更新达到使用上限的状态 | super_admin / factory_admin / permission_admin |
| PUT | `/{id}/reset-usage` | 重置使用次数 | super_admin / factory_admin / permission_admin |
| PUT | `/{id}/extend` | 延长有效期 | super_admin / factory_admin / permission_admin |

### 5. 导入导出 (2个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| GET | `/export` | 导出白名单(CSV) | super_admin / factory_admin / permission_admin |
| POST | `/import` | 导入白名单(CSV) | super_admin / factory_admin / permission_admin |

### 6. 维护操作 (1个)
| 方法 | 路径 | 功能 | 权限要求 |
|------|------|------|----------|
| DELETE | `/cleanup` | 清理已删除的记录 | super_admin / factory_admin / permission_admin |

---

## 详细API文档

## 1. 基础CRUD操作

### 1.1 批量添加白名单

**接口定义**
```
POST /api/{factoryId}/whitelist/batch
```

**功能描述**
批量添加手机号到白名单，支持一次性添加多个用户，并统一设置有效期、使用次数限制等参数。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**请求Body**
```typescript
interface BatchAddRequest {
  entries: Array<{
    phoneNumber: string;      // 手机号(必填): 1[3-9]\d{9}
    name?: string;            // 姓名(可选, ≤50字符)
    position?: string;        // 职位(可选, ≤50字符)
  }>;                         // 1-100个条目
  expiresAt?: string;         // 过期时间(可选, 格式: yyyy-MM-dd HH:mm:ss)
  maxUsageCount?: number;     // 最大使用次数(可选, ≥1)
  department?: string;        // 部门(可选)
  role?: string;              // 角色(可选)
  notes?: string;             // 备注(可选)
}
```

**请求示例**
```json
{
  "entries": [
    {
      "phoneNumber": "13800138000",
      "name": "张三",
      "position": "操作员"
    },
    {
      "phoneNumber": "13900139000",
      "name": "李四",
      "position": "质检员"
    }
  ],
  "expiresAt": "2025-12-31 23:59:59",
  "maxUsageCount": 100,
  "department": "生产部",
  "role": "operator",
  "notes": "2025年第一批员工"
}
```

**响应数据结构**
```typescript
interface BatchResult {
  successCount: number;       // 成功添加数量
  failedCount: number;        // 失败数量
  successPhones: string[];    // 成功的手机号列表
  failedEntries: Array<{
    phoneNumber: string;
    reason: string;           // 失败原因
  }>;
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "successCount": 2,
    "failedCount": 0,
    "successPhones": [
      "13800138000",
      "13900139000"
    ],
    "failedEntries": []
  },
  "timestamp": "2025-01-20T10:30:00"
}
```

**业务规则**
- 单次批量添加限制: 1-100个
- 重复手机号: 跳过并记录为失败
- 手机号格式验证: 1[3-9]\d{9}
- 未设置过期时间: 默认永久有效
- 未设置使用次数: 默认无限制
- 所有条目共享相同的过期时间和使用次数限制

---

### 1.2 获取白名单列表

**接口定义**
```
GET /api/{factoryId}/whitelist?status={status}&department={department}&role={role}&keyword={keyword}&page={page}&size={size}&sortBy={sortBy}&sortDirection={sortDirection}
```

**功能描述**
分页获取白名单列表，支持多维度筛选和排序。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| status | String | Query | 否 | 状态: active/disabled/expired/limit_reached |
| department | String | Query | 否 | 部门筛选 |
| role | String | Query | 否 | 角色筛选 |
| keyword | String | Query | 否 | 搜索关键词(手机号、姓名) |
| page | Integer | Query | 否 | 页码，默认0(前端使用1-based，后端自动转换) |
| size | Integer | Query | 否 | 每页大小，默认20，最大100 |
| sortBy | String | Query | 否 | 排序字段，默认createdAt |
| sortDirection | String | Query | 否 | 排序方向: ASC/DESC，默认DESC |

**响应数据结构**
```typescript
interface PageResponse<WhitelistDTO> {
  items: WhitelistDTO[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface WhitelistDTO {
  id: number;
  factoryId: string;
  phoneNumber: string;        // 手机号
  name?: string;              // 姓名
  department?: string;        // 部门
  position?: string;          // 职位
  status: string;             // active/disabled/expired/limit_reached
  expiresAt?: string;         // 过期时间
  lastUsedAt?: string;        // 最后使用时间
  usageCount: number;         // 使用次数
  maxUsageCount?: number;     // 最大使用次数
  role?: string;              // 角色
  permissions?: string[];     // 权限列表
  notes?: string;             // 备注
  addedBy?: number;           // 添加人ID
  addedByName?: string;       // 添加人姓名
  createdAt: string;          // 创建时间
  updatedAt: string;          // 更新时间

  // 计算字段
  isValid: boolean;           // 是否有效
  isExpiringSoon: boolean;    // 是否即将过期
  remainingUsage?: number;    // 剩余使用次数
  daysUntilExpiry?: number;   // 距离过期天数
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "factoryId": "CRETAS_2024_001",
        "phoneNumber": "13800138000",
        "name": "张三",
        "department": "生产部",
        "position": "操作员",
        "status": "active",
        "expiresAt": "2025-12-31 23:59:59",
        "lastUsedAt": "2025-01-19 10:30:00",
        "usageCount": 25,
        "maxUsageCount": 100,
        "role": "operator",
        "permissions": ["batch_create", "batch_view"],
        "notes": "2025年第一批员工",
        "addedBy": 1,
        "addedByName": "管理员",
        "createdAt": "2025-01-01 00:00:00",
        "updatedAt": "2025-01-19 10:30:00",
        "isValid": true,
        "isExpiringSoon": false,
        "remainingUsage": 75,
        "daysUntilExpiry": 345
      }
    ],
    "total": 100,
    "page": 1,
    "size": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**业务规则**
- 默认按创建时间倒序排列
- isExpiringSoon: 距离过期 < 7天
- isValid: status=active && (expiresAt为空 || 未过期) && (maxUsageCount为空 || usageCount < maxUsageCount)
- 支持的排序字段: createdAt, updatedAt, usageCount, expiresAt

---

### 1.3 获取白名单详情

**接口定义**
```
GET /api/{factoryId}/whitelist/{id}
```

**功能描述**
根据ID获取单个白名单的详细信息。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | Integer | Path | 是 | 白名单ID |

**响应**
返回单个WhitelistDTO对象。

---

### 1.4 更新白名单

**接口定义**
```
PUT /api/{factoryId}/whitelist/{id}
```

**功能描述**
更新白名单信息，包括姓名、部门、职位、状态、过期时间、权限、备注等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | Integer | Path | 是 | 白名单ID |

**请求Body**
```typescript
interface UpdateRequest {
  name?: string;              // 姓名(≤50字符)
  department?: string;        // 部门(≤50字符)
  position?: string;          // 职位(≤50字符)
  status?: string;            // 状态: active/disabled
  expiresAt?: string;         // 过期时间
  notes?: string;             // 备注
  permissions?: string[];     // 权限列表
}
```

**请求示例**
```json
{
  "name": "张三(更新)",
  "department": "生产一部",
  "position": "高级操作员",
  "status": "active",
  "expiresAt": "2026-12-31 23:59:59",
  "notes": "晋升为高级操作员",
  "permissions": ["batch_create", "batch_view", "batch_edit"]
}
```

**响应**
返回更新后的WhitelistDTO对象。

**业务规则**
- 手机号不可修改
- 只能在active和disabled之间切换状态
- 过期时间必须是将来的时间
- 权限列表替换式更新(非增量)

---

### 1.5 删除白名单

**接口定义**
```
DELETE /api/{factoryId}/whitelist/{id}
```

**功能描述**
删除单个白名单记录。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | Integer | Path | 是 | 白名单ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**业务规则**
- 软删除(标记为已删除，不物理删除)
- 已删除记录可通过cleanup接口物理删除

---

### 1.6 批量删除白名单

**接口定义**
```
DELETE /api/{factoryId}/whitelist/batch
```

**功能描述**
批量删除多个白名单记录。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**请求Body**
```json
[1, 2, 3, 4, 5]  // 白名单ID列表
```

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": 5  // 删除的记录数
}
```

**业务规则**
- 单次批量删除限制: 最多100个
- 软删除模式

---

## 2. 验证与使用管理

### 2.1 验证手机号是否在白名单中

**接口定义**
```
GET /api/{factoryId}/whitelist/validate/{phoneNumber}
```

**功能描述**
验证手机号是否在白名单中，并返回该用户的权限信息。用于注册/登录前的预检查。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| phoneNumber | String | Path | 是 | 手机号 |

**响应数据结构**
```typescript
interface ValidationResponse {
  isValid: boolean;           // 是否有效
  phone: string;              // 手机号
  name?: string;              // 姓名
  role?: string;              // 角色
  permissions?: string[];     // 权限列表
  invalidReason?: string;     // 无效原因(当isValid=false时)
  expiresAt?: string;         // 过期时间
  remainingUsage?: number;    // 剩余使用次数
}
```

**响应示例 - 有效**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "isValid": true,
    "phone": "13800138000",
    "name": "张三",
    "role": "operator",
    "permissions": ["batch_create", "batch_view"],
    "expiresAt": "2025-12-31 23:59:59",
    "remainingUsage": 75
  }
}
```

**响应示例 - 无效**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "isValid": false,
    "phone": "13800138000",
    "invalidReason": "已过期"
  }
}
```

**业务规则**
- 公开端点，无需认证
- 验证条件:
  1. 白名单中存在该手机号
  2. status = 'active'
  3. 未过期(expiresAt为空 或 expiresAt > 当前时间)
  4. 未达到使用次数上限(maxUsageCount为空 或 usageCount < maxUsageCount)
- invalidReason可能值: "不在白名单中", "已禁用", "已过期", "达到使用次数上限"

---

### 2.2 增加使用次数

**接口定义**
```
PUT /api/{factoryId}/whitelist/usage/{phoneNumber}
```

**功能描述**
记录一次白名单使用(如注册、登录)，增加使用次数并更新最后使用时间。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| phoneNumber | String | Path | 是 | 手机号 |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**业务规则**
- 公开端点，无需认证
- 自动增加usageCount + 1
- 更新lastUsedAt为当前时间
- 如果达到maxUsageCount，自动将status设为'limit_reached'

---

## 3. 统计与查询

### 3.1 获取白名单统计信息

**接口定义**
```
GET /api/{factoryId}/whitelist/stats
```

**功能描述**
获取白名单的全面统计信息，包括总数、状态分布、部门分布、最活跃用户等。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应数据结构**
```typescript
interface WhitelistStats {
  // 基础统计
  totalCount: number;         // 总数
  activeCount: number;        // 活跃数
  disabledCount: number;      // 禁用数
  expiredCount: number;       // 已过期数
  limitReachedCount: number;  // 达到使用上限数
  todayAddedCount: number;    // 今日新增
  expiringSoonCount: number;  // 即将过期数(7天内)
  activeUsersCount: number;   // 活跃用户数(7天内使用过)

  // 分布统计
  countByDepartment: {
    [department: string]: number;
  };
  countByRole: {
    [role: string]: number;
  };

  // Top用户列表
  mostActiveUsers: WhitelistDTO[];      // 最活跃用户(前10)
  recentlyUsedUsers: WhitelistDTO[];    // 最近使用(前10)
  expiringSoonUsers: WhitelistDTO[];    // 即将过期(前10)

  // 使用统计
  averageUsage: number;       // 平均使用次数
  totalUsageCount: number;    // 总使用次数

  // 元信息
  lastUpdated: string;        // 最后更新时间
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalCount": 500,
    "activeCount": 450,
    "disabledCount": 30,
    "expiredCount": 15,
    "limitReachedCount": 5,
    "todayAddedCount": 10,
    "expiringSoonCount": 25,
    "activeUsersCount": 380,
    "countByDepartment": {
      "生产部": 200,
      "质检部": 100,
      "仓储部": 150,
      "其他": 50
    },
    "countByRole": {
      "operator": 300,
      "supervisor": 100,
      "inspector": 80,
      "admin": 20
    },
    "mostActiveUsers": [
      {
        "id": 1,
        "phoneNumber": "13800138000",
        "name": "张三",
        "usageCount": 150,
        ...
      }
    ],
    "recentlyUsedUsers": [...],
    "expiringSoonUsers": [...],
    "averageUsage": 25.5,
    "totalUsageCount": 12750,
    "lastUpdated": "2025-01-20T10:30:00"
  }
}
```

**业务规则**
- 统计数据实时计算
- 即将过期: 距离过期 < 7天
- 活跃用户: 最近7天内使用过
- Top用户按使用次数降序排列

---

### 3.2 搜索白名单

**接口定义**
```
GET /api/{factoryId}/whitelist/search?keyword={keyword}&page={page}&size={size}
```

**功能描述**
全文搜索白名单，支持按手机号、姓名、部门、职位等字段搜索。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| keyword | String | Query | 是 | 搜索关键词 |
| page | Integer | Query | 否 | 页码，默认0 |
| size | Integer | Query | 否 | 每页大小，默认20 |

**响应**
返回PageResponse<WhitelistDTO>。

**业务规则**
- 搜索字段: 手机号、姓名、部门、职位、备注
- 模糊匹配
- 按相关度排序

---

### 3.3 获取即将过期的白名单

**接口定义**
```
GET /api/{factoryId}/whitelist/expiring?days={days}
```

**功能描述**
获取即将过期的白名单列表，用于提前预警。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| days | Integer | Query | 否 | 天数阈值，默认7天 |

**响应**
返回WhitelistDTO[]列表。

**业务规则**
- 返回expiresAt在未来{days}天内的记录
- 按过期时间升序排列
- 最多返回100条

---

### 3.4 获取最活跃用户

**接口定义**
```
GET /api/{factoryId}/whitelist/most-active?limit={limit}
```

**功能描述**
获取使用次数最多的用户列表。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| limit | Integer | Query | 否 | 返回数量，默认10 |

**响应**
返回WhitelistDTO[]列表。

**业务规则**
- 按usageCount降序排列
- limit最大50

---

### 3.5 获取最近使用的白名单

**接口定义**
```
GET /api/{factoryId}/whitelist/recently-used?limit={limit}
```

**功能描述**
获取最近使用的白名单列表。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| limit | Integer | Query | 否 | 返回数量，默认10 |

**响应**
返回WhitelistDTO[]列表。

**业务规则**
- 按lastUsedAt降序排列
- limit最大50

---

## 4. 状态管理

### 4.1 更新过期的白名单状态

**接口定义**
```
PUT /api/{factoryId}/whitelist/expired
```

**功能描述**
批量更新所有过期白名单的状态为'expired'。通常由定时任务调用。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": 15  // 更新的记录数
}
```

**业务规则**
- 查找所有expiresAt < 当前时间 且 status != 'expired' 的记录
- 批量更新status为'expired'
- 返回更新数量

---

### 4.2 更新达到使用上限的白名单状态

**接口定义**
```
PUT /api/{factoryId}/whitelist/limit-reached
```

**功能描述**
批量更新所有达到使用次数上限的白名单状态为'limit_reached'。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": 5  // 更新的记录数
}
```

**业务规则**
- 查找所有usageCount >= maxUsageCount 且 status != 'limit_reached' 的记录
- 批量更新status为'limit_reached'

---

### 4.3 重置使用次数

**接口定义**
```
PUT /api/{factoryId}/whitelist/{id}/reset-usage
```

**功能描述**
重置指定白名单的使用次数为0。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | Integer | Path | 是 | 白名单ID |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**业务规则**
- 设置usageCount = 0
- 如果status = 'limit_reached'，自动改为'active'

---

### 4.4 延长有效期

**接口定义**
```
PUT /api/{factoryId}/whitelist/{id}/extend?days={days}
```

**功能描述**
延长指定白名单的有效期。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| id | Integer | Path | 是 | 白名单ID |
| days | Integer | Query | 是 | 延长天数(1-365) |

**响应**
返回更新后的WhitelistDTO对象。

**业务规则**
- 在原有expiresAt基础上增加days天
- 如果原expiresAt为空，则从当前时间开始计算
- 如果status = 'expired'，自动改为'active'
- days范围: 1-365天

---

## 5. 导入导出

### 5.1 导出白名单

**接口定义**
```
GET /api/{factoryId}/whitelist/export?status={status}
```

**功能描述**
导出白名单为CSV格式，支持按状态筛选。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| status | String | Query | 否 | 状态筛选 |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": "phoneNumber,name,department,position,role,status,expiresAt,usageCount,maxUsageCount,notes\n13800138000,张三,生产部,操作员,operator,active,2025-12-31 23:59:59,25,100,备注\n..."
}
```

**CSV格式**
```csv
phoneNumber,name,department,position,role,status,expiresAt,usageCount,maxUsageCount,notes
13800138000,张三,生产部,操作员,operator,active,2025-12-31 23:59:59,25,100,备注
13900139000,李四,质检部,质检员,inspector,active,2025-12-31 23:59:59,30,100,
```

**业务规则**
- 返回纯CSV文本(字符串)
- UTF-8编码
- 包含表头
- 最多导出10000条记录

---

### 5.2 导入白名单

**接口定义**
```
POST /api/{factoryId}/whitelist/import
```

**功能描述**
从CSV数据批量导入白名单。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |

**请求Body**(纯文本CSV)
```csv
phoneNumber,name,department,position,role,expiresAt,maxUsageCount,notes
13800138000,张三,生产部,操作员,operator,2025-12-31 23:59:59,100,备注
13900139000,李四,质检部,质检员,inspector,2025-12-31 23:59:59,100,
```

**响应**
返回BatchResult对象。

**业务规则**
- 必须包含表头
- 必填字段: phoneNumber
- 最多导入1000条
- 重复手机号: 跳过并记录为失败
- 格式错误: 跳过并记录为失败

---

## 6. 维护操作

### 6.1 清理已删除的记录

**接口定义**
```
DELETE /api/{factoryId}/whitelist/cleanup?daysOld={daysOld}
```

**功能描述**
物理删除已软删除且超过指定天数的记录，释放存储空间。

**请求参数**
| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| factoryId | String | Path | 是 | 工厂ID |
| daysOld | Integer | Query | 否 | 多少天前的记录，默认30天 |

**响应**
```json
{
  "code": 200,
  "message": "success",
  "data": 50  // 物理删除的记录数
}
```

**业务规则**
- 仅删除已软删除(deleted=true)的记录
- 仅删除deletedAt < (当前时间 - daysOld天) 的记录
- 物理删除，无法恢复
- 建议定期执行(每月)

---

## 前端集成指南

### API客户端封装

```typescript
// whitelistApiClient.ts
import { apiClient } from './apiClient';
import type {
  WhitelistDTO,
  BatchAddRequest,
  UpdateRequest,
  BatchResult,
  WhitelistStats,
  ValidationResponse,
} from '../types/whitelist';
import type { PageResponse } from '../types/common';

export const whitelistApiClient = {
  // 1. 基础CRUD
  batchAdd: async (
    factoryId: string,
    request: BatchAddRequest
  ): Promise<BatchResult> => {
    return apiClient.post(`/api/${factoryId}/whitelist/batch`, request);
  },

  getList: async (
    factoryId: string,
    params?: {
      status?: string;
      department?: string;
      role?: string;
      keyword?: string;
      page?: number;
      size?: number;
      sortBy?: string;
      sortDirection?: string;
    }
  ): Promise<PageResponse<WhitelistDTO>> => {
    return apiClient.get(`/api/${factoryId}/whitelist`, { params });
  },

  getById: async (
    factoryId: string,
    id: number
  ): Promise<WhitelistDTO> => {
    return apiClient.get(`/api/${factoryId}/whitelist/${id}`);
  },

  update: async (
    factoryId: string,
    id: number,
    request: UpdateRequest
  ): Promise<WhitelistDTO> => {
    return apiClient.put(`/api/${factoryId}/whitelist/${id}`, request);
  },

  delete: async (factoryId: string, id: number): Promise<void> => {
    return apiClient.delete(`/api/${factoryId}/whitelist/${id}`);
  },

  batchDelete: async (
    factoryId: string,
    ids: number[]
  ): Promise<number> => {
    return apiClient.delete(`/api/${factoryId}/whitelist/batch`, {
      data: ids,
    });
  },

  // 2. 验证与使用
  validate: async (
    factoryId: string,
    phoneNumber: string
  ): Promise<ValidationResponse> => {
    return apiClient.get(`/api/${factoryId}/whitelist/validate/${phoneNumber}`);
  },

  incrementUsage: async (
    factoryId: string,
    phoneNumber: string
  ): Promise<void> => {
    return apiClient.put(`/api/${factoryId}/whitelist/usage/${phoneNumber}`);
  },

  // 3. 统计与查询
  getStats: async (factoryId: string): Promise<WhitelistStats> => {
    return apiClient.get(`/api/${factoryId}/whitelist/stats`);
  },

  search: async (
    factoryId: string,
    keyword: string,
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<WhitelistDTO>> => {
    return apiClient.get(`/api/${factoryId}/whitelist/search`, {
      params: { keyword, page, size },
    });
  },

  getExpiringSoon: async (
    factoryId: string,
    days: number = 7
  ): Promise<WhitelistDTO[]> => {
    return apiClient.get(`/api/${factoryId}/whitelist/expiring`, {
      params: { days },
    });
  },

  getMostActive: async (
    factoryId: string,
    limit: number = 10
  ): Promise<WhitelistDTO[]> => {
    return apiClient.get(`/api/${factoryId}/whitelist/most-active`, {
      params: { limit },
    });
  },

  getRecentlyUsed: async (
    factoryId: string,
    limit: number = 10
  ): Promise<WhitelistDTO[]> => {
    return apiClient.get(`/api/${factoryId}/whitelist/recently-used`, {
      params: { limit },
    });
  },

  // 4. 状态管理
  updateExpired: async (factoryId: string): Promise<number> => {
    return apiClient.put(`/api/${factoryId}/whitelist/expired`);
  },

  updateLimitReached: async (factoryId: string): Promise<number> => {
    return apiClient.put(`/api/${factoryId}/whitelist/limit-reached`);
  },

  resetUsage: async (factoryId: string, id: number): Promise<void> => {
    return apiClient.put(`/api/${factoryId}/whitelist/${id}/reset-usage`);
  },

  extendExpiration: async (
    factoryId: string,
    id: number,
    days: number
  ): Promise<WhitelistDTO> => {
    return apiClient.put(`/api/${factoryId}/whitelist/${id}/extend`, null, {
      params: { days },
    });
  },

  // 5. 导入导出
  export: async (
    factoryId: string,
    status?: string
  ): Promise<string> => {
    return apiClient.get(`/api/${factoryId}/whitelist/export`, {
      params: status ? { status } : {},
    });
  },

  import: async (
    factoryId: string,
    csvData: string
  ): Promise<BatchResult> => {
    return apiClient.post(`/api/${factoryId}/whitelist/import`, csvData, {
      headers: { 'Content-Type': 'text/plain' },
    });
  },

  // 6. 维护
  cleanup: async (
    factoryId: string,
    daysOld: number = 30
  ): Promise<number> => {
    return apiClient.delete(`/api/${factoryId}/whitelist/cleanup`, {
      params: { daysOld },
    });
  },
};
```

### React Native使用示例

#### 1. 白名单管理页面

```typescript
// WhitelistManagementScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  IconButton,
  FAB,
  Searchbar,
} from 'react-native-paper';
import { whitelistApiClient } from '../services/api/whitelistApiClient';
import type { WhitelistDTO } from '../types/whitelist';

export const WhitelistManagementScreen: React.FC = () => {
  const [whitelist, setWhitelist] = useState<WhitelistDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();

  const loadWhitelist = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const factoryId = 'CRETAS_2024_001';
      const response = await whitelistApiClient.getList(factoryId, {
        status: statusFilter,
        keyword: searchKeyword,
        page: pageNum,
        size: 20,
      });
      setWhitelist(pageNum === 1 ? response.items : [...whitelist, ...response.items]);
      setPage(pageNum);
    } catch (error) {
      console.error('加载白名单失败:', error);
      Alert.alert('错误', '加载白名单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelist();
  }, [statusFilter, searchKeyword]);

  const handleDelete = async (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除该白名单记录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await whitelistApiClient.delete('CRETAS_2024_001', id);
              Alert.alert('成功', '删除成功');
              loadWhitelist();
            } catch (error) {
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleExtend = async (id: number) => {
    Alert.prompt(
      '延长有效期',
      '请输入延长天数',
      async (days) => {
        try {
          const daysNum = parseInt(days, 10);
          if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
            Alert.alert('错误', '天数必须在1-365之间');
            return;
          }
          await whitelistApiClient.extendExpiration('CRETAS_2024_001', id, daysNum);
          Alert.alert('成功', `已延长${daysNum}天`);
          loadWhitelist();
        } catch (error) {
          Alert.alert('错误', '延长失败');
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'disabled':
        return '#9e9e9e';
      case 'expired':
        return '#f44336';
      case 'limit_reached':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  const renderItem = ({ item }: { item: WhitelistDTO }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View>
            <Title>{item.name || item.phoneNumber}</Title>
            <Paragraph>{item.phoneNumber}</Paragraph>
          </View>
          <Chip
            style={{ backgroundColor: getStatusColor(item.status) }}
            textStyle={{ color: '#fff' }}
          >
            {item.status}
          </Chip>
        </View>

        {item.department && (
          <Paragraph>部门: {item.department} | 职位: {item.position}</Paragraph>
        )}

        <View style={styles.stats}>
          <Paragraph>
            使用次数: {item.usageCount}
            {item.maxUsageCount && `/${item.maxUsageCount}`}
          </Paragraph>
          {item.daysUntilExpiry !== undefined && (
            <Paragraph style={item.isExpiringSoon ? styles.warning : {}}>
              剩余: {item.daysUntilExpiry}天
            </Paragraph>
          )}
        </View>

        {item.isExpiringSoon && (
          <Chip style={styles.warningChip} textStyle={{ color: '#fff' }}>
            即将过期
          </Chip>
        )}
      </Card.Content>

      <Card.Actions>
        <Button onPress={() => handleExtend(item.id)}>延长</Button>
        <Button onPress={() => handleDelete(item.id)} color="#f44336">
          删除
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="搜索手机号、姓名..."
        onChangeText={setSearchKeyword}
        value={searchKeyword}
        style={styles.searchbar}
      />

      <View style={styles.filters}>
        <Chip
          selected={!statusFilter}
          onPress={() => setStatusFilter(undefined)}
          style={styles.filterChip}
        >
          全部
        </Chip>
        <Chip
          selected={statusFilter === 'active'}
          onPress={() => setStatusFilter('active')}
          style={styles.filterChip}
        >
          活跃
        </Chip>
        <Chip
          selected={statusFilter === 'expired'}
          onPress={() => setStatusFilter('expired')}
          style={styles.filterChip}
        >
          已过期
        </Chip>
        <Chip
          selected={statusFilter === 'limit_reached'}
          onPress={() => setStatusFilter('limit_reached')}
          style={styles.filterChip}
        >
          达上限
        </Chip>
      </View>

      <FlatList
        data={whitelist}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={() => loadWhitelist(page + 1)}
        onEndReachedThreshold={0.5}
        refreshing={loading}
        onRefresh={() => loadWhitelist(1)}
      />

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => {
          // 导航到批量添加页面
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchbar: {
    margin: 8,
  },
  filters: {
    flexDirection: 'row',
    padding: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  card: {
    margin: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stats: {
    marginTop: 8,
  },
  warning: {
    color: '#ff9800',
    fontWeight: 'bold',
  },
  warningChip: {
    backgroundColor: '#ff9800',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
```

#### 2. 手机号验证(注册前)

```typescript
// RegistrationScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Paragraph } from 'react-native-paper';
import { whitelistApiClient } from '../services/api/whitelistApiClient';

export const RegistrationScreen: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      Alert.alert('错误', '请输入正确的手机号');
      return;
    }

    setLoading(true);
    try {
      const factoryId = 'CRETAS_2024_001';
      const result = await whitelistApiClient.validate(factoryId, phoneNumber);
      setValidationResult(result);

      if (result.isValid) {
        Alert.alert(
          '验证成功',
          `欢迎 ${result.name}！您可以继续注册。`,
          [
            {
              text: '继续注册',
              onPress: () => {
                // 导航到注册表单
              },
            },
          ]
        );
      } else {
        Alert.alert('验证失败', result.invalidReason || '该手机号无法注册');
      }
    } catch (error) {
      console.error('验证失败:', error);
      Alert.alert('错误', '验证失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="手机号"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        maxLength={11}
        style={styles.input}
      />

      {validationResult && !validationResult.isValid && (
        <Paragraph style={styles.error}>
          {validationResult.invalidReason}
        </Paragraph>
      )}

      {validationResult && validationResult.isValid && (
        <View style={styles.info}>
          <Paragraph>姓名: {validationResult.name}</Paragraph>
          <Paragraph>角色: {validationResult.role}</Paragraph>
          {validationResult.expiresAt && (
            <Paragraph>有效期至: {validationResult.expiresAt}</Paragraph>
          )}
          {validationResult.remainingUsage !== undefined && (
            <Paragraph>剩余使用次数: {validationResult.remainingUsage}</Paragraph>
          )}
        </View>
      )}

      <Button
        mode="contained"
        onPress={handleValidate}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        验证手机号
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  error: {
    color: '#f44336',
    marginBottom: 16,
  },
  info: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
  },
});
```

---

## 业务规则

### 1. 手机号格式
- 正则表达式: `^1[3-9]\d{9}$`
- 11位数字，以1开头，第二位为3-9

### 2. 状态定义
- `active`: 活跃，可正常使用
- `disabled`: 禁用，管理员手动禁用
- `expired`: 已过期，expiresAt < 当前时间
- `limit_reached`: 达到使用次数上限，usageCount >= maxUsageCount

### 3. 有效性判断
```
isValid = status === 'active'
  && (expiresAt === null || expiresAt > 当前时间)
  && (maxUsageCount === null || usageCount < maxUsageCount)
```

### 4. 即将过期判断
```
isExpiringSoon = expiresAt !== null
  && 距离过期 < 7天
  && 未过期
```

### 5. 批量操作限制
- 批量添加: 1-100个
- 批量删除: 最多100个
- 导入: 最多1000条
- 导出: 最多10000条

### 6. 权限控制
- 管理操作: super_admin / factory_admin / permission_admin
- 验证与使用: 公开端点，无需认证

### 7. 自动状态更新
- 过期检查: 建议每日定时任务调用`/expired`
- 使用上限检查: 每次使用后自动检查
- 清理: 建议每月执行一次`/cleanup`

---

## 错误处理

### 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 4001 | 手机号格式错误 | 检查手机号格式 |
| 4002 | 重复的手机号 | 该手机号已存在 |
| 4003 | 记录不存在 | 检查ID是否正确 |
| 4004 | 批量操作超限 | 减少批量操作数量 |
| 4005 | CSV格式错误 | 检查CSV格式 |
| 4006 | 无权限操作 | 检查用户角色 |
| 5001 | 服务器错误 | 稍后重试 |

### 错误处理示例

```typescript
try {
  const result = await whitelistApiClient.batchAdd(factoryId, request);
  if (result.failedCount > 0) {
    // 部分失败
    Alert.alert(
      '部分成功',
      `成功: ${result.successCount}, 失败: ${result.failedCount}`,
      [
        {
          text: '查看详情',
          onPress: () => {
            console.log('失败详情:', result.failedEntries);
          },
        },
      ]
    );
  } else {
    Alert.alert('成功', `成功添加${result.successCount}条记录`);
  }
} catch (error: any) {
  if (error.code === 4004) {
    Alert.alert('错误', '批量操作数量超限，请减少数量');
  } else if (error.code === 4002) {
    Alert.alert('错误', '部分手机号已存在');
  } else {
    Alert.alert('错误', error.message || '操作失败');
  }
}
```

---

## 总结

WhitelistController提供了**全面的白名单管理功能**，包含:

✅ **21个API端点**: 覆盖CRUD、验证、统计、导入导出、维护等全流程
✅ **灵活的访问控制**: 基于手机号的精确权限管理
✅ **智能状态管理**: 自动过期检测、使用次数限制
✅ **丰富的统计分析**: 活跃度、分布、Top用户等多维度分析
✅ **批量操作支持**: 批量添加、删除、导入导出
✅ **完整的生命周期管理**: 添加→使用→延期→删除→清理

这套白名单系统为系统提供了**安全可控的访问管理**，支持企业级的用户管理需求。
