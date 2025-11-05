# Cretas食品溯源系统 MVP API参考文档

## 📋 文档说明

本文档是**Cretas食品溯源系统MVP版本**的完整API参考手册,包含**155个核心API**,涵盖移动端开发所需的全部接口。

### 🔄 最新更新 (2025-01-XX)

**API去重优化已完成** ✅

- ✅ **删除**: Web端重复认证接口 (`/api/auth/login`, `/api/auth/register`, `/api/auth/logout` 等5个)
- ✅ **删除**: 移动端废弃接口 (`/api/mobile/auth/mobile-login`, `/api/mobile/auth/device-login`)
- ✅ **标准化**: 移动端认证API命名 (添加标准别名如 `/auth/refresh`, `/auth/me`, `/auth/send-code`)

**详见**: [API清理报告](./API_CLEANUP_REPORT.md)

### MVP vs 完整版差异

- **MVP版本 (155个API)**: 聚焦核心业务流程,满足Phase 1-3开发需求
- **完整版本 (325个API)**: 包含高级统计、财务分析、数据导出等扩展功能

**移除的API类型**:
- 高级统计和趋势分析 (如供应商评级、客户财务分析)
- 批量导入导出功能 (保留基础CRUD)
- 详细的成本核算和设备管理
- 复杂的报表生成和数据可视化

### 使用指南

1. **API组织结构**: 按Phase分组,每个Phase内按业务模块分组
2. **Phase标注**: 
   - **P0**: Phase 1必须实现 (认证与权限)
   - **P1**: Phase 2核心业务功能
   - **P2**: Phase 2-3配置与系统支持
3. **PRD依据**: 每个API标注对应的PRD章节 (基于合理推断)
4. **TypeScript示例**: 关键API提供完整的请求/响应类型定义

---

## 🚀 快速导航

### Phase 1 - 认证与权限管理 (28个)
- [认证授权 (7个)](#认证授权-7个)
- [设备激活 (3个)](#设备激活-3个)
- [用户管理 (14个)](#用户管理-14个)
- [白名单管理 (4个)](#白名单管理-4个)

### Phase 2 - 核心业务功能 (78个)
- [生产加工 (12个)](#生产加工-12个)
- [原材料批次 (14个)](#原材料批次-14个)
- [生产计划 (12个)](#生产计划-12个)
- [转换率 (10个)](#转换率-10个)
- [供应商 (8个)](#供应商-8个)
- [客户 (8个)](#客户-8个)
- [考勤工时 (14个)](#考勤工时-14个)

### Phase 2-3 - 配置与系统 (49个)
- [工厂设置 (8个)](#工厂设置-8个)
- [产品类型 (12个)](#产品类型-12个)
- [原料类型 (13个)](#原料类型-13个)
- [工作类型 (10个)](#工作类型-10个)
- [文件上传 (1个)](#文件上传-1个)
- [数据同步 (3个)](#数据同步-3个)
- [系统监控 (2个)](#系统监控-2个)

---

## 📖 通用说明

### 通用响应格式

所有API遵循统一的响应格式:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}
```

### 通用状态码

| 状态码 | 说明 | 场景 |
|--------|------|------|
| 200 | 成功 | 请求正常处理 |
| 201 | 已创建 | 资源创建成功 |
| 400 | 请求错误 | 参数验证失败 |
| 401 | 未授权 | Token无效或过期 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 资源不存在 | 请求的资源未找到 |
| 500 | 服务器错误 | 服务器内部错误 |

### 认证方式

除登录、注册等公开接口外,所有API需要在Header中携带JWT Token:

```
Authorization: Bearer <access_token>
```

---

# Phase 1 - 认证与权限管理

> **Phase标注**: P0 (必须)
> **PRD依据**: 第3章 系统功能需求 > 3.1 认证与权限管理
> **API数量**: 28个

---

## ⚠️ API变更通知 (2025-01-XX)

本Phase包含的认证接口已进行去重和标准化优化:

### 📌 已删除的API
```
❌ POST /api/auth/login              (使用 /api/mobile/auth/unified-login)
❌ POST /api/auth/register           (使用 /api/mobile/auth/register-phase-one/two)
❌ POST /api/auth/logout             (使用 /api/mobile/auth/logout)
❌ POST /api/auth/verify-phone       (使用 /api/mobile/auth/send-code)
❌ POST /api/auth/platform-login     (使用 /api/mobile/auth/unified-login)
❌ POST /api/mobile/auth/mobile-login (使用 /api/mobile/auth/unified-login)
❌ POST /api/mobile/auth/device-login (使用 /api/mobile/auth/unified-login)
```

### ✅ 标准化的API
```
POST   /api/mobile/auth/refresh    ← 别名: /auth/refresh-token
GET    /api/mobile/auth/me         ← 别名: /auth/profile
POST   /api/mobile/auth/send-code  ← 别名: /auth/send-verification
POST   /api/mobile/auth/verify-code (新增)
```

**前端应使用标准名称，旧名称保留用于向后兼容。详见**: [API清理报告](./API_CLEANUP_REPORT.md)

---

## 认证授权 (7个)

### 1. 统一登录接口

**功能说明**: 移动端智能登录,自动识别平台用户和工厂用户

**PRD依据**: 3.1.1 用户登录

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/unified-login`
- **认证**: 公开接口

**请求参数**:
```typescript
interface LoginRequest {
  username?: string;
  phoneNumber?: string;  // username和phoneNumber二选一
  password: string;
  deviceId?: string;
  factoryId?: string;    // 工厂用户必填
}
```

**响应类型**:
```typescript
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    role: string;
    factoryId?: string;
    department?: string;
    permissions: string[];
  };
  expiresIn: number;  // 秒
}
```

**使用示例**:
```typescript
// 工厂用户登录
const response = await fetch('/api/mobile/auth/unified-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'operator001',
    password: 'Password123',
    factoryId: 'FAC001',
    deviceId: 'device-uuid-123'
  })
});

// 平台管理员登录
const platformResponse = await fetch('/api/mobile/auth/unified-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'Admin@123456'
  })
});
```

---

### 2. 注册第一阶段 (手机验证)

**功能说明**: 移动端注册流程第一步,验证手机号并检查白名单

**PRD依据**: 3.1.2 用户注册

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/register-phase-one`
- **认证**: 公开接口

**请求参数**:
```typescript
interface RegisterPhaseOneRequest {
  phoneNumber: string;
  verificationCode: string;
  verificationType: 'registration' | 'password_reset';
}
```

**响应类型**:
```typescript
interface RegisterPhaseOneResponse {
  tempToken: string;        // 临时令牌,有效期5分钟
  whitelistInfo: {
    factoryId: string;
    factoryName: string;
    allowedRoles: string[];
    expiresAt: string;
  };
}
```

---

### 3. 注册第二阶段 (创建账户)

**功能说明**: 使用临时令牌完成用户账户创建

**PRD依据**: 3.1.2 用户注册

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/register-phase-two`
- **认证**: 需要tempToken (Header: `X-Temp-Token`)

**请求参数**:
```typescript
interface RegisterPhaseTwoRequest {
  tempToken: string;
  username: string;
  password: string;
  fullName: string;
  department?: string;
  position?: string;
  deviceId?: string;
}
```

**响应类型**: 同LoginResponse

---

### 4. 发送验证码

**功能说明**: 发送手机短信验证码

**PRD依据**: 3.1.2 手机验证

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/send-code`
- **认证**: 公开接口

**请求参数**:
- **phoneNumber** (Query, 必填): 手机号 - `string`

**响应类型**: `boolean` (发送成功返回true)

**限流规则**: 同一手机号60秒内只能发送一次

---

### 5. 验证验证码

**功能说明**: 验证手机验证码是否正确

**PRD依据**: 3.1.2 手机验证

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/verify-code`
- **认证**: 公开接口

**请求参数**:
- **phoneNumber** (Query, 必填): 手机号 - `string`
- **code** (Query, 必填): 验证码 - `string`

**响应类型**: `boolean`

---

### 6. 刷新令牌

**功能说明**: 使用refreshToken获取新的accessToken

**PRD依据**: 3.1.3 Token管理

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/refresh`
- **认证**: 需要refreshToken

**请求参数**:
- **refreshToken** (Query, 可选): 刷新令牌 - `string`

**响应类型**: `LoginResponse`

**最佳实践**:
```typescript
// 在axios interceptor中自动刷新token
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = await getRefreshToken();
      const { data } = await axios.post('/api/mobile/auth/refresh', { refreshToken });
      saveTokens(data.accessToken, data.refreshToken);
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

### 7. 用户登出

**功能说明**: 退出登录,清除服务端session

**PRD依据**: 3.1.4 会话管理

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/auth/logout`
- **认证**: 需要accessToken

**请求参数**:
- **deviceId** (Query, 可选): 设备ID - `string`

**响应类型**: `void`

---

## 设备激活 (3个)

### 1. 设备激活

**功能说明**: 使用激活码激活移动设备

**PRD依据**: 3.1.5 设备管理

**Phase**: P0

**接口信息**:
- **路径**: `POST /api/mobile/activation/activate`
- **认证**: 公开接口

**请求参数**:
```typescript
interface ActivationRequest {
  activationCode: string;
  deviceId: string;
  deviceInfo: {
    model: string;
    osVersion: string;
    appVersion: string;
  };
}
```

**响应类型**:
```typescript
interface ActivationResponse {
  success: boolean;
  deviceId: string;
  activatedAt: string;
  expiresAt: string;
  factoryId?: string;
}
```

---

### 2. 获取用户设备列表

**功能说明**: 获取当前用户已绑定的所有设备

**PRD依据**: 3.1.5 设备管理

**Phase**: P0

**接口信息**:
- **路径**: `GET /api/mobile/devices`
- **认证**: 需要Token

**请求参数**: 无

**响应类型**:
```typescript
interface DeviceInfo {
  id: string;
  deviceId: string;
  deviceName: string;
  model: string;
  osVersion: string;
  lastActiveAt: string;
  isActive: boolean;
}

type Response = Array<DeviceInfo>;
```

---

### 3. 移除设备

**功能说明**: 解除设备绑定

**PRD依据**: 3.1.5 设备管理

**Phase**: P0

**接口信息**:
- **路径**: `DELETE /api/mobile/devices/{deviceId}`
- **认证**: 需要Token

**请求参数**:
- **deviceId** (Path, 必填): 设备ID

**响应类型**: `void`

---

## 用户管理 (14个)

> 工厂用户的完整CRUD管理,包括角色权限、部门管理等

**PRD依据**: 3.2 用户与组织管理

**Phase**: P0

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/{factoryId}/users` | 获取用户列表（分页） |
| 2 | POST | `/api/{factoryId}/users` | 创建用户 |
| 3 | GET | `/api/{factoryId}/users/check/email` | 检查邮箱是否存在 |
| 4 | GET | `/api/{factoryId}/users/check/username` | 检查用户名是否存在 |
| 5 | GET | `/api/{factoryId}/users/export` | 导出用户列表 |
| 6 | POST | `/api/{factoryId}/users/import` | 批量导入用户 |
| 7 | GET | `/api/{factoryId}/users/role/{roleCode}` | 按角色获取用户列表 |
| 8 | GET | `/api/{factoryId}/users/search` | 搜索用户 |
| 9 | GET | `/api/{factoryId}/users/{userId}` | 获取用户详情 |
| 10 | PUT | `/api/{factoryId}/users/{userId}` | 更新用户信息 |
| 11 | DELETE | `/api/{factoryId}/users/{userId}` | 删除用户 |
| 12 | POST | `/api/{factoryId}/users/{userId}/activate` | 激活用户 |
| 13 | POST | `/api/{factoryId}/users/{userId}/deactivate` | 停用用户 |
| 14 | PUT | `/api/{factoryId}/users/{userId}/role` | 更新用户角色 |

**TypeScript类型定义**:
```typescript
interface UserDTO {
  id: number;
  username: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  role: UserRole;
  department?: string;
  position?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

type UserRole = 
  | 'factory_super_admin'
  | 'permission_admin'
  | 'department_admin'
  | 'operator'
  | 'viewer'
  | 'unactivated';

interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  role: UserRole;
  department?: string;
  position?: string;
}

interface UpdateUserRequest {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  role?: UserRole;
  department?: string;
  position?: string;
  isActive?: boolean;
}
```

**关键接口示例**:

#### 1. 获取用户列表 (分页)
```
GET /api/{factoryId}/users?page=0&size=20&role=operator&isActive=true
```

#### 2. 创建用户
```
POST /api/{factoryId}/users
Body: CreateUserRequest
```

#### 3. 更新用户信息
```
PUT /api/{factoryId}/users/{userId}
Body: UpdateUserRequest
```

#### 4. 修改用户角色
```
PUT /api/{factoryId}/users/{userId}/role?role=operator
```

#### 5. 批量激活/停用用户
```
PUT /api/{factoryId}/users/batch/activate?isActive=true
Body: [userId1, userId2, ...]
```

---

## 白名单管理 (4个)

> 用于注册前的手机号预审核机制

**PRD依据**: 3.1.2 用户注册 > 白名单机制

**Phase**: P0

### 1. 获取白名单列表

**接口信息**: `GET /api/{factoryId}/whitelist`

### 2. 批量删除白名单

**接口信息**: `DELETE /api/{factoryId}/whitelist/batch`

### 3. 清理已删除的记录

**接口信息**: `DELETE /api/{factoryId}/whitelist/cleanup`

### 4. 删除白名单

**接口信息**: `DELETE /api/{factoryId}/whitelist/{id}`


**TypeScript类型定义**:
```typescript
interface WhitelistEntry {
  id: number;
  factoryId: string;
  phoneNumber: string;
  allowedRoles: UserRole[];
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  isUsed: boolean;
}

interface CreateWhitelistRequest {
  phoneNumber: string;
  allowedRoles: UserRole[];
  expiresAt?: string;  // ISO 8601格式
  note?: string;
}
```

**使用流程**:
1. 管理员添加手机号到白名单
2. 用户注册时系统验证白名单
3. 注册成功后标记白名单为已使用
4. 过期白名单自动失效

---


---

# Phase 2 - 核心业务功能

> **Phase标注**: P1 (核心)  
> **PRD依据**: 第4章 业务流程  
> **API数量**: 78个

---

## 生产加工 (12个)

> 生产批次管理、原料消耗、质检记录等核心加工功能

**PRD依据**: 4.1 生产加工管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | POST | `/api/mobile/{factoryId}/processing/batches/{batchId}/cancel` | 取消生产 |
| 2 | POST | `/api/mobile/{factoryId}/processing/batches/{batchId}/complete` | 完成生产 |
| 3 | POST | `/api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption` | 记录原材料消耗 |
| 4 | POST | `/api/mobile/{factoryId}/processing/batches/{batchId}/start` | 开始生产 |
| 5 | GET | `/api/mobile/{factoryId}/processing/dashboard/overview` | 生产概览 |
| 6 | GET | `/api/mobile/{factoryId}/processing/dashboard/quality` | 质量仪表盘 |
| 7 | POST | `/api/mobile/{factoryId}/processing/material-receipt` | 原材料接收 |
| 8 | GET | `/api/mobile/{factoryId}/processing/materials` | 获取原材料列表 |
| 9 | GET | `/api/mobile/{factoryId}/processing/quality/inspections` | 获取质检记录 |
| 10 | POST | `/api/mobile/{factoryId}/processing/quality/inspections` | 提交质检记录 |
| 11 | GET | `/api/mobile/{factoryId}/processing/quality/statistics` | 质量统计 |
| 12 | GET | `/api/mobile/{factoryId}/processing/quality/trends` | 质量趋势 |

**TypeScript类型定义**:
```typescript
interface ProcessingBatch {
  id: number;
  batchNumber: string;
  productTypeId: number;
  productTypeName: string;
  planId?: number;
  status: 'planned' | 'in_progress' | 'quality_check' | 'completed' | 'cancelled';
  plannedQuantity: number;
  actualQuantity?: number;
  startTime?: string;
  endTime?: string;
  qualityCheckResult?: 'passed' | 'failed' | 'partial';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface StartProcessingRequest {
  batchId: number;
  startTime: string;
  operators: number[];  // User IDs
  equipment?: string[];
}

interface MaterialConsumption {
  materialBatchId: number;
  materialTypeName: string;
  quantity: number;
  unit: string;
  consumedAt: string;
  consumedBy: string;
}

interface QualityCheckRecord {
  id: number;
  batchId: number;
  checkTime: string;
  checkBy: string;
  result: 'passed' | 'failed' | 'partial';
  passedQuantity: number;
  failedQuantity: number;
  notes?: string;
  attachments?: string[];
}
```

**关键业务流程**:

#### 1. 创建生产批次
```typescript
POST /api/{factoryId}/processing/batches
Body: {
  productTypeId: 1,
  plannedQuantity: 1000,
  planId: 123,  // 可选,关联生产计划
  notes: "优先批次"
}
```

#### 2. 开始生产
```typescript
POST /api/{factoryId}/processing/batches/{batchId}/start
Body: {
  startTime: "2025-10-18T09:00:00Z",
  operators: [1, 2, 3]
}
```

#### 3. 记录原料消耗
```typescript
POST /api/{factoryId}/processing/batches/{batchId}/material-consumption
Body: {
  materialBatchId: 456,
  quantity: 50.5,
  consumedAt: "2025-10-18T10:30:00Z"
}
```

#### 4. 完成生产
```typescript
POST /api/{factoryId}/processing/batches/{batchId}/complete
Body: {
  actualQuantity: 980,
  endTime: "2025-10-18T17:00:00Z",
  notes: "正常完成"
}
```

#### 5. 质检记录
```typescript
POST /api/{factoryId}/processing/batches/{batchId}/quality-check
Body: {
  result: "passed",
  passedQuantity: 970,
  failedQuantity: 10,
  checkBy: "张三",
  notes: "10件外观瑕疵"
}
```

---

## 原材料批次 (14个)

> 原料入库、FIFO管理、库存预警、过期处理等

**PRD依据**: 4.2 原材料管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/material-batches` | 获取原材料批次列表（分页） |
| 2 | POST | `/api/mobile/{factoryId}/material-batches` | 创建原材料批次 |
| 3 | POST | `/api/mobile/{factoryId}/material-batches/batch` | 批量创建材料批次 |
| 4 | GET | `/api/mobile/{factoryId}/material-batches/expired` | 获取已过期的批次 |
| 5 | GET | `/api/mobile/{factoryId}/material-batches/expiring` | 获取即将过期的批次 |
| 6 | GET | `/api/mobile/{factoryId}/material-batches/export` | 导出库存报表 |
| 7 | GET | `/api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}` | 获取FIFO批次（先进先出） |
| 8 | POST | `/api/mobile/{factoryId}/material-batches/handle-expired` | 处理过期批次 |
| 9 | GET | `/api/mobile/{factoryId}/material-batches/inventory/statistics` | 获取库存统计 |
| 10 | GET | `/api/mobile/{factoryId}/material-batches/inventory/valuation` | 获取库存价值 |
| 11 | GET | `/api/mobile/{factoryId}/material-batches/low-stock` | 获取低库存警告 |
| 12 | GET | `/api/mobile/{factoryId}/material-batches/material-type/{materialTypeId}` | 按材料类型获取批次 |
| 13 | GET | `/api/mobile/{factoryId}/material-batches/status/{status}` | 按状态获取批次 |
| 14 | GET | `/api/mobile/{factoryId}/material-batches/{batchId}` | 获取原材料批次详情 |

**TypeScript类型定义**:
```typescript
interface MaterialBatch {
  id: number;
  batchNumber: string;
  materialTypeId: number;
  materialTypeName: string;
  supplierId?: number;
  supplierName?: string;
  quantity: number;
  remainingQuantity: number;
  unit: string;
  purchasePrice?: number;
  receiveDate: string;
  productionDate: string;
  expiryDate: string;
  status: 'available' | 'reserved' | 'in_use' | 'depleted' | 'expired';
  storageLocation?: string;
  qualityStatus: 'pending' | 'passed' | 'failed';
  notes?: string;
}

interface ReserveMaterialRequest {
  batchId: number;
  quantity: number;
  reservedFor: string;  // 用途说明
  reservedBy: number;   // User ID
}

interface ConsumeMaterialRequest {
  batchId: number;
  quantity: number;
  consumedBy: number;
  purpose: string;
  notes?: string;
}
```

**关键功能**:

#### 1. FIFO出库建议
```typescript
GET /api/{factoryId}/material-batches/fifo?materialTypeId=1&requiredQuantity=100
Response: Array<{ batchId, quantity, expiryDate }>
```

#### 2. 库存预警
```typescript
// 低库存预警
GET /api/{factoryId}/material-batches/low-stock?threshold=100

// 即将过期 (30天内)
GET /api/{factoryId}/material-batches/expiring?days=30

// 已过期
GET /api/{factoryId}/material-batches/expired
```

#### 3. 原料预留
```typescript
POST /api/{factoryId}/material-batches/reserve
Body: {
  batchId: 123,
  quantity: 50,
  reservedFor: "生产批次#456",
  reservedBy: 1
}
```

#### 4. 原料使用
```typescript
POST /api/{factoryId}/material-batches/use
Body: {
  batchId: 123,
  quantity: 50,
  consumedBy: 1,
  purpose: "生产批次#456"
}
```

---

## 生产计划 (12个)

> 生产计划编排、执行管理、进度跟踪

**PRD依据**: 4.3 生产计划管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/production-plans` | 获取生产计划列表（分页） |
| 2 | POST | `/api/mobile/{factoryId}/production-plans` | 创建生产计划 |
| 3 | POST | `/api/mobile/{factoryId}/production-plans/batch` | 批量创建生产计划 |
| 4 | GET | `/api/mobile/{factoryId}/production-plans/date-range` | 按日期范围获取生产计划 |
| 5 | GET | `/api/mobile/{factoryId}/production-plans/export` | 导出生产计划 |
| 6 | GET | `/api/mobile/{factoryId}/production-plans/pending-execution` | 获取待执行的计划 |
| 7 | GET | `/api/mobile/{factoryId}/production-plans/statistics` | 获取生产统计 |
| 8 | GET | `/api/mobile/{factoryId}/production-plans/status/{status}` | 按状态获取生产计划 |
| 9 | GET | `/api/mobile/{factoryId}/production-plans/today` | 获取今日生产计划 |
| 10 | GET | `/api/mobile/{factoryId}/production-plans/{planId}` | 获取生产计划详情 |
| 11 | PUT | `/api/mobile/{factoryId}/production-plans/{planId}` | 更新生产计划 |
| 12 | DELETE | `/api/mobile/{factoryId}/production-plans/{planId}` | 删除生产计划 |

**TypeScript类型定义**:
```typescript
interface ProductionPlan {
  id: number;
  planNumber: string;
  productTypeId: number;
  productTypeName: string;
  plannedQuantity: number;
  completedQuantity: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  assignedTo?: number[];  // User IDs
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface CreatePlanRequest {
  productTypeId: number;
  plannedQuantity: number;
  startDate: string;
  endDate: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: number[];
  notes?: string;
}
```

**关键功能**:

#### 1. 今日计划
```typescript
GET /api/{factoryId}/production-plans/today
Response: Array<ProductionPlan>
```

#### 2. 待执行计划
```typescript
GET /api/{factoryId}/production-plans/pending-execution?priority=high
```

#### 3. 开始执行计划
```typescript
POST /api/{factoryId}/production-plans/{planId}/start
Body: {
  actualStartDate: "2025-10-18T08:00:00Z",
  assignedTo: [1, 2, 3]
}
```

#### 4. 完成计划
```typescript
POST /api/{factoryId}/production-plans/{planId}/complete
Body: {
  completedQuantity: 1000,
  actualEndDate: "2025-10-18T18:00:00Z",
  notes: "按时完成"
}
```

---

## 转换率 (10个)

> 原材料到产品的转换率配置与计算

**PRD依据**: 4.4 转换率管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/conversions` | 分页查询转换率配置 |
| 2 | POST | `/api/mobile/{factoryId}/conversions` | 创建转换率配置 |
| 3 | POST | `/api/mobile/{factoryId}/conversions/calculate/material-requirement` | 计算原材料需求量 |
| 4 | POST | `/api/mobile/{factoryId}/conversions/calculate/product-output` | 计算产品产出量 |
| 5 | GET | `/api/mobile/{factoryId}/conversions/export` | 导出转换率配置 |
| 6 | POST | `/api/mobile/{factoryId}/conversions/import` | 批量导入转换率配置 |
| 7 | GET | `/api/mobile/{factoryId}/conversions/material/{materialTypeId}` | 根据原材料类型查询转换率 |
| 8 | GET | `/api/mobile/{factoryId}/conversions/product/{productTypeId}` | 根据产品类型查询转换率 |
| 9 | GET | `/api/mobile/{factoryId}/conversions/rate` | 获取特定原材料和产品的转换率 |
| 10 | GET | `/api/mobile/{factoryId}/conversions/statistics` | 获取转换率统计信息 |

**TypeScript类型定义**:
```typescript
interface ConversionRate {
  id: number;
  materialTypeId: number;
  materialTypeName: string;
  productTypeId: number;
  productTypeName: string;
  conversionRate: number;  // 转换率 (0-1)
  wastageRate: number;      // 损耗率 (0-1)
  unit: string;
  isActive: boolean;
  effectiveDate: string;
  expiryDate?: string;
  notes?: string;
}

interface MaterialRequirement {
  materialTypeId: number;
  materialTypeName: string;
  requiredQuantity: number;
  unit: string;
}

interface ProductOutput {
  productTypeId: number;
  productTypeName: string;
  estimatedQuantity: number;
  unit: string;
}
```

**关键功能**:

#### 1. 计算原料需求
```typescript
POST /api/{factoryId}/conversions/calculate/material-requirement
Body: {
  productTypeId: 1,
  productQuantity: 1000
}
Response: Array<MaterialRequirement>
```

#### 2. 计算产品产出
```typescript
POST /api/{factoryId}/conversions/calculate/product-output
Body: {
  materialTypeId: 1,
  materialQuantity: 500
}
Response: Array<ProductOutput>
```

---

## 供应商 (8个)

> 供应商基本管理,不含复杂评级和财务分析

**PRD依据**: 4.5 供应商管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/suppliers` | 获取供应商列表（分页） |
| 2 | POST | `/api/mobile/{factoryId}/suppliers` | 创建供应商 |
| 3 | GET | `/api/mobile/{factoryId}/suppliers/active` | 获取活跃供应商列表 |
| 4 | GET | `/api/mobile/{factoryId}/suppliers/search` | 搜索供应商 |
| 5 | GET | `/api/mobile/{factoryId}/suppliers/{supplierId}/history` | 获取供应商供货历史 |
| 6 | PUT | `/api/mobile/{factoryId}/suppliers/{supplierId}/status` | 切换供应商状态 |

**TypeScript类型定义**:
```typescript
interface Supplier {
  id: number;
  code: string;
  name: string;
  contact: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  category: string;  // 原材料类别
  isActive: boolean;
  certifications?: string[];
  notes?: string;
  createdAt: string;
}
```

---

## 客户 (8个)

> 客户基本管理,不含财务和评级功能

**PRD依据**: 4.6 客户管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/customers` | 获取客户列表（分页） |
| 2 | POST | `/api/mobile/{factoryId}/customers` | 创建客户 |
| 3 | GET | `/api/mobile/{factoryId}/customers/active` | 获取活跃客户列表 |
| 4 | GET | `/api/mobile/{factoryId}/customers/search` | 搜索客户 |
| 5 | PUT | `/api/mobile/{factoryId}/customers/{customerId}/status` | 切换客户状态 |

**TypeScript类型定义**:
```typescript
interface Customer {
  id: number;
  code: string;
  name: string;
  contact: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  type: 'distributor' | 'retailer' | 'direct_consumer';
  isActive: boolean;
  notes?: string;
  createdAt: string;
}
```

---

## 考勤工时 (14个)

> 考勤打卡、工时统计、生产力分析

**PRD依据**: 4.7 考勤工时管理

**Phase**: P1

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | POST | `/api/mobile/{factoryId}/timeclock/clock-in` | 上班打卡 |
| 2 | POST | `/api/mobile/{factoryId}/timeclock/clock-out` | 下班打卡 |
| 3 | GET | `/api/mobile/{factoryId}/timeclock/department/{department}` | 部门考勤 |
| 4 | PUT | `/api/mobile/{factoryId}/timeclock/records/{recordId}` | 修改打卡记录 |
| 5 | GET | `/api/mobile/{factoryId}/time-stats/anomaly` | 获取异常统计 |
| 6 | GET | `/api/mobile/{factoryId}/time-stats/by-department` | 按部门统计 |
| 7 | GET | `/api/mobile/{factoryId}/time-stats/by-work-type` | 按工作类型统计 |
| 8 | GET | `/api/mobile/{factoryId}/time-stats/comparative` | 获取对比分析 |
| 9 | GET | `/api/mobile/{factoryId}/time-stats/daily` | 获取日统计 |
| 10 | GET | `/api/mobile/{factoryId}/time-stats/daily/range` | 获取日期范围统计 |
| 11 | GET | `/api/mobile/{factoryId}/time-stats/monthly` | 获取月统计 |
| 12 | GET | `/api/mobile/{factoryId}/time-stats/productivity` | 获取生产力分析 |
| 13 | GET | `/api/mobile/{factoryId}/time-stats/realtime` | 获取实时统计 |

**TypeScript类型定义**:
```typescript
interface ClockRecord {
  id: number;
  userId: number;
  userName: string;
  clockInTime: string;
  clockOutTime?: string;
  workDate: string;
  workTypeId?: number;
  workTypeName?: string;
  totalHours?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

interface WorkHourStatistics {
  userId: number;
  userName: string;
  department: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  period: string;
}
```

**关键功能**:

#### 1. 打卡操作
```typescript
// 上班打卡
POST /api/{factoryId}/time-clock/clock-in
Body: {
  userId: 1,
  clockInTime: "2025-10-18T08:00:00Z",
  location: { latitude: 30.123, longitude: 120.456 },
  workTypeId: 1
}

// 下班打卡
POST /api/{factoryId}/time-clock/clock-out
Body: {
  userId: 1,
  clockOutTime: "2025-10-18T17:00:00Z"
}
```

#### 2. 工时统计
```typescript
// 每日工时
GET /api/{factoryId}/time-statistics/daily?date=2025-10-18

// 月度工时
GET /api/{factoryId}/time-statistics/monthly?year=2025&month=10

// 部门工时
GET /api/{factoryId}/time-statistics/by-department?department=生产部

// 个人工时
GET /api/{factoryId}/time-statistics/employee?userId=1&startDate=2025-10-01&endDate=2025-10-31
```

#### 3. 实时监控
```typescript
// 当前在岗
GET /api/{factoryId}/time-statistics/realtime

// 异常打卡
GET /api/{factoryId}/time-statistics/anomaly?type=late,early_leave
```

---


---

# Phase 2-3 - 配置与系统支持

> **Phase标注**: P2 (支撑)  
> **PRD依据**: 第5章 系统配置与管理  
> **API数量**: 49个

---

## 工厂设置 (8个)

> 工厂级配置管理,包括生产、库存、AI等配置

**PRD依据**: 5.1 工厂配置管理

**Phase**: P2

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/{factoryId}/settings` | 获取工厂完整配置 |
| 2 | PUT | `/api/{factoryId}/settings` | 更新工厂配置 |
| 3 | GET | `/api/{factoryId}/settings/production` | 获取生产配置 |
| 4 | PUT | `/api/{factoryId}/settings/production` | 更新生产配置 |
| 5 | GET | `/api/{factoryId}/settings/inventory` | 获取库存配置 |
| 6 | PUT | `/api/{factoryId}/settings/inventory` | 更新库存配置 |
| 7 | GET | `/api/{factoryId}/settings/ai` | 获取AI配置 |
| 8 | PUT | `/api/{factoryId}/settings/ai` | 更新AI配置 |

**TypeScript类型定义**:
```typescript
interface FactorySettings {
  factoryId: string;
  factoryName: string;
  productionSettings: ProductionSettings;
  inventorySettings: InventorySettings;
  aiSettings: AISettings;
  updatedAt: string;
}

interface ProductionSettings {
  workingHours: {
    start: string;  // "08:00"
    end: string;    // "17:00"
  };
  shiftMode: 'single' | 'double' | 'triple';
  qualityCheckRequired: boolean;
  batchNumberPrefix: string;
  defaultWastageRate: number;
}

interface InventorySettings {
  lowStockThreshold: number;
  expiryWarningDays: number;
  fifoEnabled: boolean;
  autoReserveEnabled: boolean;
}

interface AISettings {
  deepseekEnabled: boolean;
  deepseekModel: string;
  monthlyBudget: number;  // 月度预算(元)
  cacheEnabled: boolean;
  cacheDuration: number;  // 分钟
}
```

---

## 产品类型 (12个)

> 产品类型的完整CRUD管理

**PRD依据**: 5.2 基础数据管理 > 产品类型

**Phase**: P2

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/products/types` | 获取产品类型列表 |
| 2 | POST | `/api/mobile/{factoryId}/products/types` | 创建产品类型 |
| 3 | GET | `/api/mobile/{factoryId}/products/types/active` | 获取激活的产品类型 |
| 4 | PUT | `/api/mobile/{factoryId}/products/types/batch/status` | 批量更新状态 |
| 5 | GET | `/api/mobile/{factoryId}/products/types/categories` | 获取产品类别列表 |
| 6 | GET | `/api/mobile/{factoryId}/products/types/category/{category}` | 根据类别获取产品类型 |
| 7 | GET | `/api/mobile/{factoryId}/products/types/check-code` | 检查产品编码 |
| 8 | POST | `/api/mobile/{factoryId}/products/types/init-defaults` | 初始化默认产品类型 |
| 9 | GET | `/api/mobile/{factoryId}/products/types/search` | 搜索产品类型 |
| 10 | GET | `/api/mobile/{factoryId}/products/types/{id}` | 获取产品类型详情 |
| 11 | PUT | `/api/mobile/{factoryId}/products/types/{id}` | 更新产品类型 |
| 12 | DELETE | `/api/mobile/{factoryId}/products/types/{id}` | 删除产品类型 |

**TypeScript类型定义**:
```typescript
interface ProductType {
  id: number;
  code: string;
  name: string;
  category: string;
  specification?: string;
  unit: string;
  shelfLife?: number;  // 保质期(天)
  storageConditions?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
}
```

---

## 原料类型 (13个)

> 原材料类型的完整CRUD管理

**PRD依据**: 5.2 基础数据管理 > 原材料类型

**Phase**: P2

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/materials/types` | 获取原材料类型列表 |
| 2 | POST | `/api/mobile/{factoryId}/materials/types` | 创建原材料类型 |
| 3 | GET | `/api/mobile/{factoryId}/materials/types/active` | 获取激活的原材料类型 |
| 4 | PUT | `/api/mobile/{factoryId}/materials/types/batch/status` | 批量更新状态 |
| 5 | GET | `/api/mobile/{factoryId}/materials/types/categories` | 获取原材料类别列表 |
| 6 | GET | `/api/mobile/{factoryId}/materials/types/category/{category}` | 根据类别获取原材料类型 |
| 7 | GET | `/api/mobile/{factoryId}/materials/types/check-code` | 检查原材料编码 |
| 8 | GET | `/api/mobile/{factoryId}/materials/types/low-stock` | 获取库存预警 |
| 9 | GET | `/api/mobile/{factoryId}/materials/types/search` | 搜索原材料类型 |
| 10 | GET | `/api/mobile/{factoryId}/materials/types/storage-type/{storageType}` | 根据存储类型获取原材料类型 |
| 11 | GET | `/api/mobile/{factoryId}/materials/types/{id}` | 获取原材料类型详情 |
| 12 | PUT | `/api/mobile/{factoryId}/materials/types/{id}` | 更新原材料类型 |
| 13 | DELETE | `/api/mobile/{factoryId}/materials/types/{id}` | 删除原材料类型 |

**TypeScript类型定义**:
```typescript
interface MaterialType {
  id: number;
  code: string;
  name: string;
  category: string;
  specification?: string;
  unit: string;
  shelfLife?: number;  // 保质期(天)
  storageConditions?: string;
  isActive: boolean;
  supplierIds?: number[];
  description?: string;
  createdAt: string;
}
```

---

## 工作类型 (10个)

> 工时类型配置,用于考勤分类

**PRD依据**: 5.2 基础数据管理 > 工作类型

**Phase**: P2

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/{factoryId}/work-types` | 获取工作类型列表 |
| 2 | POST | `/api/mobile/{factoryId}/work-types` | 创建工作类型 |
| 3 | GET | `/api/mobile/{factoryId}/work-types/active` | 获取所有活跃的工作类型 |
| 4 | PUT | `/api/mobile/{factoryId}/work-types/display-order` | 更新显示顺序 |
| 5 | POST | `/api/mobile/{factoryId}/work-types/initialize-defaults` | 初始化默认工作类型 |
| 6 | GET | `/api/mobile/{factoryId}/work-types/stats` | 获取工作类型统计信息 |
| 7 | GET | `/api/mobile/{factoryId}/work-types/{id}` | 获取工作类型详情 |
| 8 | PUT | `/api/mobile/{factoryId}/work-types/{id}` | 更新工作类型 |
| 9 | DELETE | `/api/mobile/{factoryId}/work-types/{id}` | 删除工作类型 |
| 10 | PUT | `/api/mobile/{factoryId}/work-types/{id}/toggle-status` | 切换工作类型状态 |

**TypeScript类型定义**:
```typescript
interface WorkType {
  id: number;
  code: string;
  name: string;
  description?: string;
  hourlyRate?: number;  // 时薪
  overtimeMultiplier?: number;  // 加班倍率
  isActive: boolean;
  createdAt: string;
}
```

---

## 文件上传 (1个)

> 移动端文件上传,支持图片、文档等

**PRD依据**: 5.3 文件管理

**Phase**: P2

### 接口信息

**路径**: `POST /api/mobile/upload`

**功能说明**: 移动端文件上传,支持批量上传和自动压缩

**请求参数**:
- **files** (Form, 必填): 文件数组 - `File[]`
- **category** (Query, 可选): 文件分类 (如: product_image, quality_check, document) - `string`
- **metadata** (Query, 可选): 元数据JSON字符串 - `string`

**响应类型**:
```typescript
interface UploadResponse {
  files: Array<{
    originalName: string;
    fileName: string;
    url: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }>;
  totalSize: number;
}
```

**使用示例**:
```typescript
const formData = new FormData();
formData.append('files', imageFile1);
formData.append('files', imageFile2);
formData.append('category', 'quality_check');
formData.append('metadata', JSON.stringify({
  batchId: 123,
  checkType: 'appearance'
}));

const response = await fetch('/api/mobile/upload?category=quality_check', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

---

## 数据同步 (3个)

> 离线数据同步、版本检查

**PRD依据**: 5.4 数据同步管理

**Phase**: P2

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | POST | `/api/mobile/sync/{factoryId}` | 数据同步 |
| 2 | GET | `/api/mobile/offline/{factoryId}` | 获取离线数据包 |
| 3 | GET | `/api/mobile/version/check` | 检查应用版本 |

**TypeScript类型定义**:
```typescript
interface SyncRequest {
  lastSyncTime?: string;
  dataTypes: Array<'users' | 'products' | 'materials' | 'batches' | 'plans'>;
  changedRecords?: {
    [key: string]: any[];  // 本地修改的记录
  };
}

interface SyncResponse {
  syncTime: string;
  updates: {
    [dataType: string]: any[];  // 服务端更新的记录
  };
  conflicts?: Array<{
    dataType: string;
    recordId: string | number;
    localVersion: any;
    serverVersion: any;
  }>;
}

interface OfflineDataPackage {
  factoryId: string;
  packageTime: string;
  expiresAt: string;
  data: {
    productTypes: ProductType[];
    materialTypes: MaterialType[];
    workTypes: WorkType[];
    users: UserDTO[];
    settings: FactorySettings;
  };
  checksum: string;
}

interface VersionCheckResponse {
  currentVersion: string;
  latestVersion: string;
  updateRequired: boolean;
  updateAvailable: boolean;
  updateUrl?: string;
  releaseNotes?: string;
  minSupportedVersion: string;
}
```

**使用示例**:
```typescript
// 数据同步
const syncResponse = await fetch(`/api/mobile/sync/${factoryId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lastSyncTime: '2025-10-18T06:00:00Z',
    dataTypes: ['products', 'materials', 'batches'],
    changedRecords: {
      batches: [{ id: 123, status: 'completed', localUpdatedAt: '...' }]
    }
  })
});

// 离线数据包
const offlineData = await fetch(`/api/mobile/offline/${factoryId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 版本检查
const versionCheck = await fetch(
  '/api/mobile/version/check?currentVersion=1.0.0&platform=android'
);
```

---

## 系统监控 (2个)

> 健康检查、崩溃上报

**PRD依据**: 5.5 系统监控

**Phase**: P2

### 核心接口列表

| # | 方法 | 路径 | 功能说明 |
|---|------|------|----------|
| 1 | GET | `/api/mobile/health` | 系统健康检查 |
| 2 | POST | `/api/mobile/report/crash` | 上报崩溃日志 |

**TypeScript类型定义**:
```typescript
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    cache: 'up' | 'down';
    storage: 'up' | 'down';
  };
  version: string;
}

interface CrashReport {
  deviceId: string;
  appVersion: string;
  osVersion: string;
  timestamp: string;
  errorMessage: string;
  stackTrace: string;
  context?: {
    screen: string;
    userId?: number;
    factoryId?: string;
    [key: string]: any;
  };
}
```

---

# 附录

## A. 最佳实践

### 1. 错误处理

```typescript
// 统一的API调用封装
async function apiCall<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token过期,尝试刷新
        await refreshToken();
        return apiCall(url, options);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.data as T;
  } catch (error) {
    // 离线处理
    if (error.message === 'Network request failed') {
      return getFromOfflineCache<T>(url);
    }
    throw error;
  }
}
```

### 2. 离线优先策略

```typescript
// 离线数据管理
class OfflineManager {
  async syncData(factoryId: string) {
    const lastSyncTime = await getLastSyncTime();
    
    // 上传本地修改
    const localChanges = await getLocalChanges();
    
    const response = await apiCall<SyncResponse>(
      `/api/mobile/sync/${factoryId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          lastSyncTime,
          dataTypes: ['products', 'materials', 'batches'],
          changedRecords: localChanges
        })
      }
    );

    // 处理服务端更新
    await applyServerUpdates(response.updates);
    
    // 处理冲突
    if (response.conflicts) {
      await resolveConflicts(response.conflicts);
    }

    // 更新同步时间
    await setLastSyncTime(response.syncTime);
  }
}
```

### 3. Token管理

```typescript
// Token自动刷新
class TokenManager {
  private refreshPromise: Promise<void> | null = null;

  async getToken(): Promise<string> {
    const token = await getStoredToken();
    
    if (this.isTokenExpiringSoon(token)) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshToken();
      }
      await this.refreshPromise;
      this.refreshPromise = null;
    }

    return getStoredToken();
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = await getStoredRefreshToken();
    
    const response = await fetch('/api/mobile/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });

    const { accessToken, refreshToken: newRefreshToken } = 
      await response.json();

    await storeTokens(accessToken, newRefreshToken);
  }

  private isTokenExpiringSoon(token: string): boolean {
    // JWT解析,检查过期时间
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = payload.exp - Date.now() / 1000;
    return expiresIn < 300;  // 5分钟内过期
  }
}
```

### 4. 批量操作优化

```typescript
// 批量请求优化
async function batchUpdateUsers(
  factoryId: string,
  userIds: number[],
  updates: Partial<UserDTO>
) {
  // 分批处理,避免请求过大
  const batchSize = 50;
  const batches = chunk(userIds, batchSize);

  const results = await Promise.all(
    batches.map(batch =>
      apiCall(`/api/${factoryId}/users/batch`, {
        method: 'PUT',
        body: JSON.stringify({
          ids: batch,
          updates
        })
      })
    )
  );

  return results.flat();
}
```

### 5. 文件上传优化

```typescript
// 图片压缩和上传
async function uploadImages(
  images: File[],
  category: string
) {
  // 压缩图片
  const compressedImages = await Promise.all(
    images.map(img => compressImage(img, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8
    }))
  );

  // 批量上传
  const formData = new FormData();
  compressedImages.forEach(img => {
    formData.append('files', img);
  });
  formData.append('category', category);

  return apiCall<UploadResponse>('/api/mobile/upload', {
    method: 'POST',
    body: formData
  });
}
```

---

## B. 移除API说明

以下API在完整版中存在,但在MVP版本中移除:

### 生产加工 (移除9个)
- 暂停/恢复生产
- 成本分析
- 批次时间线
- 设备使用记录
- 详细统计仪表盘

### 原材料批次 (移除8个)
- 批量导入导出
- 库存估值
- 原料调整记录
- 使用历史详情

### 生产计划 (移除8个)
- 批量分配
- 成本更新
- 详细统计报表
- 日期范围查询

### 转换率 (移除5个)
- 批量导入导出
- 详细统计
- 数据验证

### 供应商 (移除10个)
- 供应商评级
- 信用管理
- 财务统计
- 高级分析

### 客户 (移除16个)
- 客户评级
- 财务管理
- 订单统计
- 销售分析

### 考勤工时 (移除3个)
- 详细导出功能
- 高级趋势分析
- 预测分析

### 工厂设置 (移除14个)
- 通知配置
- 安全设置
- 集成配置
- 高级功能开关

---

## C. API开发优先级

根据Phase开发顺序,建议按以下优先级实现前端:

### 第一优先级 (Week 1-3: Phase 1)
1. 认证授权 (7个) - **必须完成**
2. 设备激活 (3个) - **必须完成**
3. 用户管理 (14个) - **必须完成**
4. 白名单管理 (4个) - **必须完成**

### 第二优先级 (Week 4-6: Phase 2 核心)
5. 生产加工 (12个) - **核心业务**
6. 原材料批次 (14个) - **核心业务**
7. 生产计划 (12个) - **核心业务**
8. 考勤工时 (14个) - **核心业务**

### 第三优先级 (Week 7-8: Phase 2 辅助)
9. 转换率 (10个)
10. 供应商 (8个)
11. 客户 (8个)

### 第四优先级 (Week 9: Phase 2-3 配置)
12. 产品类型 (12个)
13. 原料类型 (13个)
14. 工作类型 (10个)
15. 工厂设置 (8个)
16. 文件上传 (1个)
17. 数据同步 (3个)
18. 系统监控 (2个)

---

## D. 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2025-10-18 | 初始版本,包含155个MVP API |

---

## E. 联系方式

**技术支持**: support@cretas.com  
**文档反馈**: docs@cretas.com  
**API问题**: api@cretas.com

---

**文档生成时间**: 2025-10-18  
**API版本**: v1.0  
**总计API数量**: 155个

---

*本文档基于Swagger API规范自动生成,由Claude Code辅助整理*
