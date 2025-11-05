# Cretas食品溯源系统 MVP 数据模型文档

## 📋 文档说明

本文档是**Cretas食品溯源系统MVP版本**的完整数据模型参考手册,包含**155个核心API**使用的所有数据模型。

### MVP vs 完整版差异

- **MVP版本**: 包含约80个核心数据模型,覆盖Phase 1-3所有功能
- **完整版本**: 包含222个数据模型,含高级统计、财务分析等扩展模型
- **移除的模型**: 设备管理、高级报表、财务分析、复杂统计模型(约140个)

### 使用指南

1. **模型组织**: 按Phase分组(Phase 1、Phase 2、Phase 2-3)
2. **TypeScript类型**: 每个模型提供完整的TypeScript类型定义
3. **字段说明**: 详细的字段说明和示例
4. **关联API**: 标注使用该模型的API列表
5. **最佳实践**: 实际开发中的使用建议

---

## 🚀 快速导航

### [Phase 1 - 认证与权限管理模型 (约25个)](#phase-1---认证与权限管理模型)
- [认证相关模型](#认证相关模型) - 登录、注册、Token管理
- [设备管理模型](#设备管理模型) - 设备激活、绑定
- [用户管理模型](#用户管理模型) - 用户信息、角色权限
- [白名单模型](#白名单模型) - 注册白名单

### [Phase 2 - 核心业务模型 (约40个)](#phase-2---核心业务模型)
- [生产加工模型](#生产加工模型) - 批次、质检、消耗
- [原材料模型](#原材料模型) - 批次、库存、FIFO
- [生产计划模型](#生产计划模型) - 计划、执行、统计
- [转换率模型](#转换率模型) - 转换率配置、计算
- [供应商模型](#供应商模型) - 供应商基本信息
- [客户模型](#客户模型) - 客户基本信息
- [考勤工时模型](#考勤工时模型) - 打卡、统计、分析

### [Phase 2-3 - 配置与系统模型 (约15个)](#phase-2-3---配置与系统模型)
- [工厂设置模型](#工厂设置模型) - 生产、库存、AI配置
- [产品类型模型](#产品类型模型) - 产品类型定义
- [原料类型模型](#原料类型模型) - 原料类型定义
- [工作类型模型](#工作类型模型) - 工作类型定义
- [文件上传模型](#文件上传模型) - 文件上传响应
- [数据同步模型](#数据同步模型) - 同步请求/响应
- [系统监控模型](#系统监控模型) - 健康检查、日志

---

## 📖 通用说明

### 通用响应格式

所有API使用统一的响应包装器:

```typescript
interface ApiResponse<T> {
  success: boolean;          // 请求是否成功
  code: number;              // HTTP状态码 (200, 400, 401, etc.)
  message: string;           // 响应消息
  data?: T;                  // 响应数据(泛型)
  timestamp: string;         // 响应时间戳 (ISO 8601)
}
```

### 通用分页格式

分页接口使用统一的分页响应:

```typescript
interface PageResponse<T> {
  content: T[];              // 当前页数据
  totalElements: number;     // 总记录数
  totalPages: number;        // 总页数
  page: number;              // 当前页码(0-based)
  size: number;              // 每页大小
  first: boolean;            // 是否第一页
  last: boolean;             // 是否最后一页
}
```

### 枚举类型说明

#### 用户角色 (UserRole)
```typescript
type UserRole =
  | 'developer'              // 系统开发者
  | 'platform_admin'         // 平台管理员
  | 'platform_operator'      // 平台操作员
  | 'factory_super_admin'    // 工厂超级管理员
  | 'permission_admin'       // 权限管理员
  | 'department_admin'       // 部门管理员
  | 'operator'               // 操作员
  | 'viewer'                 // 查看者
  | 'unactivated';           // 未激活
```

#### 批次状态 (BatchStatus)
```typescript
type BatchStatus =
  | 'planned'                // 已计划
  | 'in_progress'            // 进行中
  | 'quality_check'          // 质检中
  | 'completed'              // 已完成
  | 'cancelled';             // 已取消
```

#### 质检结果 (QualityResult)
```typescript
type QualityResult =
  | 'passed'                 // 合格
  | 'failed'                 // 不合格
  | 'partial';               // 部分合格
```

---

# Phase 1 - 认证与权限管理模型

> **Phase标注**: P0 (必须)
> **PRD依据**: 第3章 系统功能需求 > 3.1 认证与权限管理
> **模型数量**: 约25个

---

## 认证相关模型

### 1. LoginRequest - 登录请求

**用途**: 统一登录接口的请求参数,支持平台用户和工厂用户

**使用场景**: 移动端登录、Web登录

**TypeScript定义**:
```typescript
interface LoginRequest {
  username?: string;         // 用户名(与phoneNumber二选一)
  phoneNumber?: string;      // 手机号(与username二选一)
  password: string;          // 密码
  deviceId?: string;         // 设备ID(移动端必填)
  factoryId?: string;        // 工厂ID(工厂用户必填)
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| username | string | 可选 | 用户名(与phoneNumber二选一) | `operator001` |
| phoneNumber | string | 可选 | 手机号(与username二选一) | `+8613800000000` |
| password | string | 必填 | 用户密码 | `Password123` |
| deviceId | string | 可选 | 设备唯一标识(移动端建议填写) | `device-uuid-123` |
| factoryId | string | 可选 | 工厂ID(工厂用户必填) | `FAC001` |

**使用示例**:
```typescript
// 工厂用户登录
const factoryLogin: LoginRequest = {
  username: 'operator001',
  password: 'Password123',
  factoryId: 'FAC001',
  deviceId: 'device-uuid-123'
};

// 平台管理员登录
const platformLogin: LoginRequest = {
  username: 'admin',
  password: 'Admin@123456'
};

// 手机号登录
const phoneLogin: LoginRequest = {
  phoneNumber: '+8613800000000',
  password: 'Password123',
  factoryId: 'FAC001'
};
```

**关联API**:
- `POST /api/mobile/auth/unified-login` - 统一登录接口

---

### 2. LoginResponse - 登录响应

**用途**: 登录成功后的响应数据,包含Token和用户信息

**TypeScript定义**:
```typescript
interface LoginResponse {
  accessToken: string;       // 访问令牌(JWT)
  refreshToken: string;      // 刷新令牌
  user: UserDTO;             // 用户信息
  expiresIn: number;         // Token过期时间(秒)
  tokenType?: string;        // Token类型(默认"Bearer")
}

interface UserDTO {
  id: number;                // 用户ID
  username: string;          // 用户名
  fullName: string;          // 全名
  phoneNumber?: string;      // 手机号
  email?: string;            // 邮箱
  role: UserRole;            // 角色
  factoryId?: string;        // 工厂ID(工厂用户)
  department?: string;       // 部门
  position?: string;         // 职位
  permissions: string[];     // 权限列表
  isActive: boolean;         // 是否激活
  lastLoginAt?: string;      // 最后登录时间
  createdAt: string;         // 创建时间
}
```

**字段说明**:

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| accessToken | string | JWT访问令牌,有效期通常15分钟 | `eyJhbGciOiJIUzI1NiIs...` |
| refreshToken | string | 刷新令牌,有效期通常7天 | `eyJhbGciOiJIUzI1NiIs...` |
| user | UserDTO | 用户完整信息 | 见UserDTO定义 |
| expiresIn | number | Token过期时间(秒) | `900` (15分钟) |

**使用示例**:
```typescript
// 保存登录响应
async function handleLoginSuccess(response: LoginResponse) {
  // 保存Tokens到安全存储
  await SecureStore.setItemAsync('accessToken', response.accessToken);
  await SecureStore.setItemAsync('refreshToken', response.refreshToken);

  // 保存用户信息到状态管理
  authStore.setUser(response.user);

  // 设置Token过期提醒
  const expiresAt = Date.now() + response.expiresIn * 1000;
  scheduleTokenRefresh(expiresAt);

  // 基于角色导航
  navigateBasedOnRole(response.user.role);
}
```

**关联API**:
- `POST /api/mobile/auth/unified-login`
- `POST /api/mobile/auth/refresh`
- `POST /api/mobile/auth/register-phase-two`

---

### 3. RegisterPhaseOneRequest - 注册第一阶段请求

**用途**: 移动端注册流程第一步,验证手机号和验证码

**TypeScript定义**:
```typescript
interface RegisterPhaseOneRequest {
  phoneNumber: string;       // 手机号
  verificationCode: string;  // 验证码
  verificationType: 'registration' | 'password_reset';  // 验证类型
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| phoneNumber | string | 必填 | 手机号(国际格式) | `+8613800000000` |
| verificationCode | string | 必填 | 短信验证码 | `123456` |
| verificationType | string | 必填 | 验证类型 | `registration` |

**使用示例**:
```typescript
const request: RegisterPhaseOneRequest = {
  phoneNumber: '+8613800000000',
  verificationCode: '123456',
  verificationType: 'registration'
};
```

**关联API**:
- `POST /api/mobile/auth/register-phase-one`

---

### 4. RegisterPhaseOneResponse - 注册第一阶段响应

**用途**: 手机验证成功后返回临时令牌和白名单信息

**TypeScript定义**:
```typescript
interface RegisterPhaseOneResponse {
  tempToken: string;         // 临时令牌(有效期5分钟)
  whitelistInfo: {
    factoryId: string;       // 工厂ID
    factoryName: string;     // 工厂名称
    allowedRoles: UserRole[]; // 允许的角色
    expiresAt: string;       // 白名单过期时间
  };
}
```

**使用示例**:
```typescript
// 处理第一阶段响应
async function handlePhaseOneSuccess(response: RegisterPhaseOneResponse) {
  // 保存临时令牌
  await SecureStore.setItemAsync('tempToken', response.tempToken);

  // 显示工厂信息
  console.log(`您将加入: ${response.whitelistInfo.factoryName}`);
  console.log(`可选角色: ${response.whitelistInfo.allowedRoles.join(', ')}`);

  // 导航到第二阶段
  navigation.navigate('RegisterPhaseTwo', {
    tempToken: response.tempToken,
    factoryId: response.whitelistInfo.factoryId,
    allowedRoles: response.whitelistInfo.allowedRoles
  });
}
```

**关联API**:
- `POST /api/mobile/auth/register-phase-one`

---

### 5. RegisterPhaseTwoRequest - 注册第二阶段请求

**用途**: 使用临时令牌完成用户账户创建

**TypeScript定义**:
```typescript
interface RegisterPhaseTwoRequest {
  tempToken: string;         // 临时令牌
  username: string;          // 用户名
  password: string;          // 密码
  fullName: string;          // 全名
  department?: string;       // 部门
  position?: string;         // 职位
  deviceId?: string;         // 设备ID
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| tempToken | string | 必填 | 从Phase One获取的临时令牌 | `temp_xxx` |
| username | string | 必填 | 用户名(唯一) | `operator001` |
| password | string | 必填 | 密码(需符合强度要求) | `Password123!` |
| fullName | string | 必填 | 用户真实姓名 | `张三` |
| department | string | 可选 | 部门名称 | `生产部` |
| position | string | 可选 | 职位名称 | `生产主管` |
| deviceId | string | 可选 | 设备ID(移动端) | `device-uuid-123` |

**密码要求**:
- 最小长度: 8位
- 必须包含: 大写字母、小写字母、数字
- 建议包含: 特殊字符

**使用示例**:
```typescript
const request: RegisterPhaseTwoRequest = {
  tempToken: 'temp_xxx',
  username: 'operator001',
  password: 'Password123!',
  fullName: '张三',
  department: '生产部',
  position: '生产主管',
  deviceId: 'device-uuid-123'
};
```

**关联API**:
- `POST /api/mobile/auth/register-phase-two`

---

### 6. VerifyPhoneRequest - 验证手机请求

**TypeScript定义**:
```typescript
interface VerifyPhoneRequest {
  phoneNumber: string;       // 手机号
  verificationCode: string;  // 验证码
}
```

**关联API**:
- `POST /api/mobile/auth/verify-phone`

---

### 7. VerifyPhoneResponse - 验证手机响应

**TypeScript定义**:
```typescript
interface VerifyPhoneResponse {
  verified: boolean;         // 是否验证成功
  tempToken?: string;        // 临时令牌
  message?: string;          // 消息
}
```

---

## 设备管理模型

### 1. ActivationRequest - 设备激活请求

**用途**: 移动设备激活,使用激活码绑定设备到工厂

**TypeScript定义**:
```typescript
interface ActivationRequest {
  activationCode: string;    // 激活码
  deviceInfo: DeviceInfo;    // 设备信息
}

interface DeviceInfo {
  deviceId: string;          // 设备唯一标识
  deviceName?: string;       // 设备名称
  model: string;             // 设备型号
  osVersion: string;         // 操作系统版本
  appVersion: string;        // 应用版本
  manufacturer?: string;     // 制造商
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| activationCode | string | 必填 | 激活码(由管理员生成) | `CRETAS_2024_ABC123` |
| deviceInfo.deviceId | string | 必填 | 设备唯一标识 | `device-uuid-123` |
| deviceInfo.model | string | 必填 | 设备型号 | `iPhone 14 Pro` |
| deviceInfo.osVersion | string | 必填 | 操作系统版本 | `iOS 17.0` |
| deviceInfo.appVersion | string | 必填 | 应用版本 | `1.0.0` |

**使用示例**:
```typescript
// React Native中获取设备信息并激活
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const activateDevice = async (activationCode: string) => {
  const request: ActivationRequest = {
    activationCode,
    deviceInfo: {
      deviceId: Constants.deviceId || 'unknown',
      deviceName: Device.deviceName,
      model: Device.modelName || 'unknown',
      osVersion: Device.osVersion || 'unknown',
      appVersion: Constants.expoConfig?.version || '1.0.0',
      manufacturer: Device.manufacturer
    }
  };

  const response = await activateDeviceAPI(request);
  return response;
};
```

**关联API**:
- `POST /api/mobile/activation/activate`

---

### 2. ActivationResponse - 设备激活响应

**用途**: 激活成功后返回的设备和工厂信息

**TypeScript定义**:
```typescript
interface ActivationResponse {
  success: boolean;          // 激活是否成功
  deviceId: string;          // 设备ID
  activatedAt: string;       // 激活时间
  validUntil: string;        // 有效期至
  factoryId?: string;        // 绑定的工厂ID
  factoryName?: string;      // 工厂名称
  features?: string[];       // 启用的功能列表
  configuration?: any;       // 配置信息
}
```

**使用示例**:
```typescript
async function handleActivationSuccess(response: ActivationResponse) {
  // 保存激活信息
  await SecureStore.setItemAsync('deviceId', response.deviceId);
  await SecureStore.setItemAsync('factoryId', response.factoryId!);

  // 显示激活成功信息
  Alert.alert(
    '激活成功',
    `设备已绑定到 ${response.factoryName}\n有效期至: ${formatDate(response.validUntil)}`
  );

  // 导航到登录页
  navigation.navigate('Login');
}
```

**关联API**:
- `POST /api/mobile/activation/activate`

---

## 用户管理模型

### 1. UserDTO - 用户数据传输对象

**用途**: 用户完整信息,用于用户管理和展示

**TypeScript定义**:
```typescript
interface UserDTO {
  id: number;                // 用户ID
  username: string;          // 用户名
  fullName: string;          // 全名
  phoneNumber?: string;      // 手机号
  email?: string;            // 邮箱
  role: UserRole;            // 角色
  factoryId?: string;        // 工厂ID
  department?: string;       // 部门
  position?: string;         // 职位
  permissions: string[];     // 权限列表
  isActive: boolean;         // 是否激活
  lastLoginAt?: string;      // 最后登录时间
  createdAt: string;         // 创建时间
  updatedAt?: string;        // 更新时间
  createdBy?: string;        // 创建者
}
```

**关联API**:
- `GET /api/{factoryId}/users` - 获取用户列表
- `GET /api/{factoryId}/users/{userId}` - 获取用户详情
- `POST /api/{factoryId}/users` - 创建用户
- `PUT /api/{factoryId}/users/{userId}` - 更新用户

---

### 2. CreateUserRequest - 创建用户请求

**TypeScript定义**:
```typescript
interface CreateUserRequest {
  username: string;          // 用户名(唯一)
  password: string;          // 密码
  fullName: string;          // 全名
  phoneNumber?: string;      // 手机号
  email?: string;            // 邮箱
  role: UserRole;            // 角色
  department?: string;       // 部门
  position?: string;         // 职位
}
```

**关联API**:
- `POST /api/{factoryId}/users`

---

### 3. UpdateUserRequest - 更新用户请求

**TypeScript定义**:
```typescript
interface UpdateUserRequest {
  fullName?: string;         // 全名
  phoneNumber?: string;      // 手机号
  email?: string;            // 邮箱
  role?: UserRole;           // 角色
  department?: string;       // 部门
  position?: string;         // 职位
  isActive?: boolean;        // 是否激活
}
```

**关联API**:
- `PUT /api/{factoryId}/users/{userId}`

---

## 白名单模型

### 1. WhitelistEntry - 白名单条目

**用途**: 注册白名单,控制哪些手机号可以注册

**TypeScript定义**:
```typescript
interface WhitelistEntry {
  id: number;                // 白名单ID
  factoryId: string;         // 工厂ID
  phoneNumber: string;       // 手机号
  allowedRoles: UserRole[];  // 允许的角色
  expiresAt?: string;        // 过期时间
  createdBy: string;         // 创建者
  createdAt: string;         // 创建时间
  isUsed: boolean;           // 是否已使用
  usedAt?: string;           // 使用时间
  usedBy?: number;           // 使用者ID
}
```

**关联API**:
- `GET /api/{factoryId}/whitelist` - 获取白名单列表
- `POST /api/{factoryId}/whitelist` - 创建白名单
- `DELETE /api/{factoryId}/whitelist/{id}` - 删除白名单

---

# Phase 2 - 核心业务模型

> **Phase标注**: P1 (核心)
> **PRD依据**: 第4章 业务流程
> **模型数量**: 约40个

---

## 生产加工模型

### 1. ProcessingBatch - 生产批次

**用途**: 生产加工批次的完整信息

**TypeScript定义**:
```typescript
interface ProcessingBatch {
  id: number;                // 批次ID
  batchNumber: string;       // 批次号(唯一)
  productTypeId: number;     // 产品类型ID
  productTypeName: string;   // 产品类型名称
  planId?: number;           // 关联的生产计划ID
  status: BatchStatus;       // 批次状态
  plannedQuantity: number;   // 计划数量
  actualQuantity?: number;   // 实际数量
  startTime?: string;        // 开始时间
  endTime?: string;          // 结束时间
  qualityCheckResult?: QualityResult; // 质检结果
  operators?: number[];      // 操作员ID列表
  equipment?: string[];      // 使用的设备
  notes?: string;            // 备注
  createdBy: string;         // 创建者
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/start` - 开始生产
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/complete` - 完成生产
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/cancel` - 取消生产

---

### 2. MaterialConsumption - 原料消耗记录

**TypeScript定义**:
```typescript
interface MaterialConsumption {
  id: number;                // 消耗记录ID
  batchId: number;           // 生产批次ID
  materialBatchId: number;   // 原料批次ID
  materialTypeName: string;  // 原料类型名称
  quantity: number;          // 消耗数量
  unit: string;              // 单位
  consumedAt: string;        // 消耗时间
  consumedBy: string;        // 消耗者
  notes?: string;            // 备注
}
```

**关联API**:
- `POST /api/mobile/{factoryId}/processing/batches/{batchId}/material-consumption`

---

### 3. QualityCheckRecord - 质检记录

**TypeScript定义**:
```typescript
interface QualityCheckRecord {
  id: number;                // 质检记录ID
  batchId: number;           // 生产批次ID
  checkTime: string;         // 质检时间
  checkBy: string;           // 质检员
  result: QualityResult;     // 质检结果
  passedQuantity: number;    // 合格数量
  failedQuantity: number;    // 不合格数量
  defectTypes?: string[];    // 缺陷类型
  notes?: string;            // 备注
  attachments?: string[];    // 附件(图片等)
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/processing/quality/inspections`
- `POST /api/mobile/{factoryId}/processing/quality/inspections`

---

## 原材料模型

### 1. MaterialBatch - 原料批次

**用途**: 原材料批次的完整信息,支持FIFO管理

**TypeScript定义**:
```typescript
interface MaterialBatch {
  id: number;                // 批次ID
  batchNumber: string;       // 批次号
  materialTypeId: number;    // 原料类型ID
  materialTypeName: string;  // 原料类型名称
  supplierId?: number;       // 供应商ID
  supplierName?: string;     // 供应商名称
  quantity: number;          // 数量
  remainingQuantity: number; // 剩余数量
  unit: string;              // 单位
  purchasePrice?: number;    // 采购单价
  receiveDate: string;       // 接收日期
  productionDate: string;    // 生产日期
  expiryDate: string;        // 过期日期
  status: 'available' | 'reserved' | 'in_use' | 'depleted' | 'expired';
  storageLocation?: string;  // 存储位置
  qualityStatus: 'pending' | 'passed' | 'failed';
  notes?: string;            // 备注
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/material-batches` - 获取批次列表
- `POST /api/mobile/{factoryId}/material-batches` - 创建批次
- `GET /api/mobile/{factoryId}/material-batches/fifo/{materialTypeId}` - FIFO出库建议
- `GET /api/mobile/{factoryId}/material-batches/low-stock` - 低库存预警
- `GET /api/mobile/{factoryId}/material-batches/expiring` - 即将过期
- `GET /api/mobile/{factoryId}/material-batches/expired` - 已过期

---

### 2. MaterialType - 原料类型

**TypeScript定义**:
```typescript
interface MaterialType {
  id: number;                // 类型ID
  code: string;              // 编码
  name: string;              // 名称
  category: string;          // 类别
  specification?: string;    // 规格
  unit: string;              // 单位
  shelfLife?: number;        // 保质期(天)
  storageConditions?: string; // 存储条件
  isActive: boolean;         // 是否激活
  description?: string;      // 描述
}
```

---

## 生产计划模型

### 1. ProductionPlan - 生产计划

**用途**: 生产计划的完整信息

**TypeScript定义**:
```typescript
interface ProductionPlan {
  id: number;                // 计划ID
  planNumber: string;        // 计划编号
  productTypeId: number;     // 产品类型ID
  productTypeName: string;   // 产品类型名称
  plannedQuantity: number;   // 计划数量
  completedQuantity: number; // 已完成数量
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;         // 计划开始日期
  endDate: string;           // 计划结束日期
  actualStartDate?: string;  // 实际开始日期
  actualEndDate?: string;    // 实际结束日期
  assignedTo?: number[];     // 分配给的用户ID
  notes?: string;            // 备注
  createdBy: string;         // 创建者
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/production-plans` - 获取计划列表
- `POST /api/mobile/{factoryId}/production-plans` - 创建计划
- `GET /api/mobile/{factoryId}/production-plans/today` - 今日计划
- `GET /api/mobile/{factoryId}/production-plans/pending-execution` - 待执行计划

---

## 转换率模型

### 1. ConversionRate - 转换率配置

**用途**: 原材料到产品的转换率配置

**TypeScript定义**:
```typescript
interface ConversionRate {
  id: number;                // 转换率ID
  materialTypeId: number;    // 原料类型ID
  materialTypeName: string;  // 原料类型名称
  productTypeId: number;     // 产品类型ID
  productTypeName: string;   // 产品类型名称
  conversionRate: number;    // 转换率 (0-1)
  wastageRate: number;       // 损耗率 (0-1)
  unit: string;              // 单位
  isActive: boolean;         // 是否激活
  effectiveDate: string;     // 生效日期
  expiryDate?: string;       // 失效日期
  notes?: string;            // 备注
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/conversions` - 获取转换率列表
- `POST /api/mobile/{factoryId}/conversions` - 创建转换率
- `POST /api/mobile/{factoryId}/conversions/calculate/material-requirement` - 计算原料需求
- `POST /api/mobile/{factoryId}/conversions/calculate/product-output` - 计算产品产出

---

### 2. MaterialRequirement - 原料需求

**TypeScript定义**:
```typescript
interface MaterialRequirement {
  materialTypeId: number;    // 原料类型ID
  materialTypeName: string;  // 原料类型名称
  requiredQuantity: number;  // 需求数量
  unit: string;              // 单位
}
```

---

### 3. ProductOutput - 产品产出

**TypeScript定义**:
```typescript
interface ProductOutput {
  productTypeId: number;     // 产品类型ID
  productTypeName: string;   // 产品类型名称
  estimatedQuantity: number; // 预估数量
  unit: string;              // 单位
}
```

---

## 供应商模型

### 1. SupplierDTO - 供应商信息

**用途**: 供应商基本信息(MVP版本不含评级和财务)

**TypeScript定义**:
```typescript
interface SupplierDTO {
  id: number;                // 供应商ID
  code: string;              // 供应商编码
  name: string;              // 供应商名称
  contact: string;           // 联系人
  phoneNumber: string;       // 联系电话
  email?: string;            // 邮箱
  address?: string;          // 地址
  category: string;          // 类别(原材料类别)
  isActive: boolean;         // 是否激活
  certifications?: string[]; // 资质证书
  notes?: string;            // 备注
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/suppliers` - 获取供应商列表
- `POST /api/mobile/{factoryId}/suppliers` - 创建供应商
- `GET /api/mobile/{factoryId}/suppliers/active` - 获取活跃供应商
- `GET /api/mobile/{factoryId}/suppliers/search` - 搜索供应商

---

## 客户模型

### 1. CustomerDTO - 客户信息

**用途**: 客户基本信息(MVP版本不含财务和订单)

**TypeScript定义**:
```typescript
interface CustomerDTO {
  id: number;                // 客户ID
  code: string;              // 客户编码
  name: string;              // 客户名称
  contact: string;           // 联系人
  phoneNumber: string;       // 联系电话
  email?: string;            // 邮箱
  address?: string;          // 地址
  type: 'distributor' | 'retailer' | 'direct_consumer';
  isActive: boolean;         // 是否激活
  notes?: string;            // 备注
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/customers` - 获取客户列表
- `POST /api/mobile/{factoryId}/customers` - 创建客户
- `GET /api/mobile/{factoryId}/customers/active` - 获取活跃客户
- `GET /api/mobile/{factoryId}/customers/search` - 搜索客户

---

## 考勤工时模型

### 1. ClockRecord - 打卡记录

**用途**: 员工考勤打卡记录

**TypeScript定义**:
```typescript
interface ClockRecord {
  id: number;                // 打卡记录ID
  userId: number;            // 用户ID
  userName: string;          // 用户名称
  clockInTime: string;       // 上班打卡时间
  clockOutTime?: string;     // 下班打卡时间
  workDate: string;          // 工作日期
  workTypeId?: number;       // 工作类型ID
  workTypeName?: string;     // 工作类型名称
  totalHours?: number;       // 总工时
  regularHours?: number;     // 正常工时
  overtimeHours?: number;    // 加班工时
  location?: {               // 打卡位置
    latitude: number;
    longitude: number;
  };
  notes?: string;            // 备注
}
```

**关联API**:
- `POST /api/mobile/{factoryId}/timeclock/clock-in` - 上班打卡
- `POST /api/mobile/{factoryId}/timeclock/clock-out` - 下班打卡
- `GET /api/mobile/{factoryId}/timeclock/department/{department}` - 部门考勤

---

### 2. WorkHourStatistics - 工时统计

**TypeScript定义**:
```typescript
interface WorkHourStatistics {
  userId?: number;           // 用户ID(个人统计)
  userName?: string;         // 用户名称
  department?: string;       // 部门(部门统计)
  period: string;            // 统计周期
  totalHours: number;        // 总工时
  regularHours: number;      // 正常工时
  overtimeHours: number;     // 加班工时
  absenceHours?: number;     // 缺勤工时
  lateCount?: number;        // 迟到次数
  earlyLeaveCount?: number;  // 早退次数
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/time-stats/daily` - 日统计
- `GET /api/mobile/{factoryId}/time-stats/monthly` - 月统计
- `GET /api/mobile/{factoryId}/time-stats/by-department` - 按部门统计

---

# Phase 2-3 - 配置与系统模型

> **Phase标注**: P2 (支撑)
> **PRD依据**: 第5章 系统配置与管理
> **模型数量**: 约15个

---

## 工厂设置模型

### 1. FactorySettings - 工厂完整配置

**用途**: 工厂级别的所有配置信息

**TypeScript定义**:
```typescript
interface FactorySettings {
  factoryId: string;         // 工厂ID
  factoryName: string;       // 工厂名称
  productionSettings: ProductionSettings;
  inventorySettings: InventorySettings;
  aiSettings: AISettings;
  updatedAt: string;         // 更新时间
  updatedBy?: string;        // 更新者
}

interface ProductionSettings {
  workingHours: {
    start: string;           // "08:00"
    end: string;             // "17:00"
  };
  shiftMode: 'single' | 'double' | 'triple';
  qualityCheckRequired: boolean;
  batchNumberPrefix: string; // 批次号前缀
  defaultWastageRate: number; // 默认损耗率
}

interface InventorySettings {
  lowStockThreshold: number; // 低库存阈值
  expiryWarningDays: number; // 过期预警天数
  fifoEnabled: boolean;      // 是否启用FIFO
  autoReserveEnabled: boolean; // 自动预留
}

interface AISettings {
  enabled: boolean;          // 是否启用AI
  model: string;             // AI模型
  detailLevel: 'basic' | 'standard' | 'detailed';
  monthlyBudget: number;     // 月度预算(元)
  cacheEnabled: boolean;     // 缓存启用
  cacheDuration: number;     // 缓存时长(分钟)
  goal: 'cost_optimization' | 'quality_improvement' | 'efficiency';
  tone: 'professional' | 'casual' | 'technical';
}
```

**关联API**:
- `GET /api/{factoryId}/settings` - 获取完整配置
- `PUT /api/{factoryId}/settings` - 更新完整配置
- `GET /api/{factoryId}/settings/production` - 获取生产配置
- `PUT /api/{factoryId}/settings/production` - 更新生产配置
- `GET /api/{factoryId}/settings/inventory` - 获取库存配置
- `PUT /api/{factoryId}/settings/inventory` - 更新库存配置
- `GET /api/{factoryId}/settings/ai` - 获取AI配置
- `PUT /api/{factoryId}/settings/ai` - 更新AI配置

---

## 产品类型模型

### 1. ProductType - 产品类型

**TypeScript定义**:
```typescript
interface ProductType {
  id: number;                // 产品类型ID
  code: string;              // 产品编码
  name: string;              // 产品名称
  category: string;          // 产品类别
  specification?: string;    // 规格
  unit: string;              // 单位
  shelfLife?: number;        // 保质期(天)
  storageConditions?: string; // 存储条件
  isActive: boolean;         // 是否激活
  description?: string;      // 描述
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/products/types` - 获取产品类型列表
- `POST /api/mobile/{factoryId}/products/types` - 创建产品类型
- `GET /api/mobile/{factoryId}/products/types/active` - 获取活跃产品类型

---

## 原料类型模型

### 1. MaterialTypeDTO - 原料类型

**TypeScript定义**:
```typescript
interface MaterialTypeDTO {
  id: number;                // 原料类型ID
  code: string;              // 原料编码
  name: string;              // 原料名称
  category: string;          // 原料类别
  specification?: string;    // 规格
  unit: string;              // 单位
  shelfLife?: number;        // 保质期(天)
  storageConditions?: string; // 存储条件
  storageType?: string;      // 存储类型
  isActive: boolean;         // 是否激活
  supplierIds?: number[];    // 供应商ID列表
  description?: string;      // 描述
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/materials/types` - 获取原料类型列表
- `POST /api/mobile/{factoryId}/materials/types` - 创建原料类型

---

## 工作类型模型

### 1. WorkType - 工作类型

**用途**: 考勤工时的工作类型分类

**TypeScript定义**:
```typescript
interface WorkType {
  id: number;                // 工作类型ID
  code: string;              // 编码
  name: string;              // 名称
  description?: string;      // 描述
  hourlyRate?: number;       // 时薪
  overtimeMultiplier?: number; // 加班倍率
  isActive: boolean;         // 是否激活
  displayOrder?: number;     // 显示顺序
  createdAt: string;         // 创建时间
}
```

**关联API**:
- `GET /api/mobile/{factoryId}/work-types` - 获取工作类型列表
- `POST /api/mobile/{factoryId}/work-types` - 创建工作类型
- `GET /api/mobile/{factoryId}/work-types/active` - 获取活跃工作类型

---

## 文件上传模型

### 1. UploadResponse - 文件上传响应

**TypeScript定义**:
```typescript
interface UploadResponse {
  files: FileInfo[];         // 上传的文件列表
  totalSize: number;         // 总大小(字节)
}

interface FileInfo {
  originalName: string;      // 原始文件名
  fileName: string;          // 存储文件名
  url: string;               // 访问URL
  size: number;              // 文件大小(字节)
  mimeType: string;          // MIME类型
  uploadedAt: string;        // 上传时间
}
```

**关联API**:
- `POST /api/mobile/upload` - 移动端文件上传

---

## 数据同步模型

### 1. SyncRequest - 同步请求

**TypeScript定义**:
```typescript
interface SyncRequest {
  lastSyncTime?: string;     // 上次同步时间
  dataTypes: Array<'users' | 'products' | 'materials' | 'batches' | 'plans'>;
  changedRecords?: {         // 本地修改的记录
    [key: string]: any[];
  };
}
```

---

### 2. SyncResponse - 同步响应

**TypeScript定义**:
```typescript
interface SyncResponse {
  syncTime: string;          // 本次同步时间
  updates: {                 // 服务端更新的数据
    [dataType: string]: any[];
  };
  conflicts?: Array<{        // 冲突记录
    dataType: string;
    recordId: string | number;
    localVersion: any;
    serverVersion: any;
  }>;
}
```

---

### 3. OfflineDataPackage - 离线数据包

**TypeScript定义**:
```typescript
interface OfflineDataPackage {
  factoryId: string;         // 工厂ID
  packageTime: string;       // 打包时间
  expiresAt: string;         // 过期时间
  data: {
    productTypes: ProductType[];
    materialTypes: MaterialTypeDTO[];
    workTypes: WorkType[];
    users: UserDTO[];
    settings: FactorySettings;
  };
  checksum: string;          // 校验和
}
```

**关联API**:
- `POST /api/mobile/sync/{factoryId}` - 数据同步
- `GET /api/mobile/offline/{factoryId}` - 获取离线数据包

---

### 4. VersionCheckResponse - 版本检查响应

**TypeScript定义**:
```typescript
interface VersionCheckResponse {
  currentVersion: string;    // 当前版本
  latestVersion: string;     // 最新版本
  updateRequired: boolean;   // 是否强制更新
  updateAvailable: boolean;  // 是否有更新
  updateUrl?: string;        // 更新下载URL
  releaseNotes?: string;     // 更新说明
  minSupportedVersion: string; // 最低支持版本
}
```

**关联API**:
- `GET /api/mobile/version/check` - 检查应用版本

---

## 系统监控模型

### 1. HealthCheckResponse - 健康检查响应

**TypeScript定义**:
```typescript
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;         // 检查时间
  services: {
    database: 'up' | 'down';
    cache: 'up' | 'down';
    storage: 'up' | 'down';
  };
  version: string;           // 系统版本
}
```

**关联API**:
- `GET /api/mobile/health` - 系统健康检查

---

### 2. CrashReport - 崩溃报告

**TypeScript定义**:
```typescript
interface CrashReport {
  deviceId: string;          // 设备ID
  appVersion: string;        // 应用版本
  osVersion: string;         // 系统版本
  timestamp: string;         // 崩溃时间
  errorMessage: string;      // 错误消息
  stackTrace: string;        // 堆栈跟踪
  context?: {                // 上下文
    screen: string;
    userId?: number;
    factoryId?: string;
    [key: string]: any;
  };
}
```

**关联API**:
- `POST /api/mobile/report/crash` - 上报崩溃日志

---

### 3. DashboardData - 仪表盘数据

**TypeScript定义**:
```typescript
interface DashboardData {
  alerts: Alert[];           // 警报列表
  recentActivities: ActivityLog[]; // 最近活动
  quickStats: {              // 快速统计
    todayProduction: number;
    todayAttendance: number;
    lowStockItems: number;
    pendingQualityChecks: number;
  };
}

interface Alert {
  id: string;
  type: string;              // 警报类型
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
}

interface ActivityLog {
  id: string;
  type: string;              // 活动类型
  title: string;
  description: string;
  operator: string;
  time: string;
}
```

**关联API**:
- `GET /api/mobile/dashboard/{factoryId}` - 获取仪表盘数据

---

### 4. SystemLog - 系统日志

**TypeScript定义**:
```typescript
interface SystemLog {
  id: number;
  factoryId?: string;
  logType: string;           // 日志类型
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  details?: any;
  userId?: number;
  ipAddress?: string;
  timestamp: string;
}
```

**关联API**:
- `GET /api/mobile/system/logs` - 获取系统日志
- `POST /api/mobile/system/logs` - 记录系统日志

---

# 附录

## A. 模型关系图

### Phase 1 核心关系

```
LoginRequest → LoginResponse (含UserDTO)
                    ↓
              UserDTO ←→ WhitelistEntry
                    ↓
         ActivationRequest → ActivationResponse
```

### Phase 2 核心关系

```
ProductionPlan → ProcessingBatch → MaterialConsumption → MaterialBatch
                        ↓
                 QualityCheckRecord

MaterialType ←→ ConversionRate ←→ ProductType

MaterialBatch ←→ SupplierDTO

ClockRecord → WorkHourStatistics
```

---

## B. 最佳实践

### 1. 类型安全

```typescript
// 使用严格的TypeScript类型
import { UserDTO, LoginResponse, ApiResponse } from '@/types/models';

// API调用时使用泛型
async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<ApiResponse<LoginResponse>>(
    '/api/mobile/auth/unified-login',
    request
  );

  if (response.data.success) {
    return response.data.data!;
  } else {
    throw new Error(response.data.message);
  }
}
```

### 2. 状态管理

```typescript
// Zustand store示例
import { create } from 'zustand';
import { UserDTO, ProcessingBatch } from '@/types/models';

interface AppState {
  user: UserDTO | null;
  currentBatch: ProcessingBatch | null;
  setUser: (user: UserDTO) => void;
  setCurrentBatch: (batch: ProcessingBatch) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentBatch: null,
  setUser: (user) => set({ user }),
  setCurrentBatch: (batch) => set({ currentBatch: batch }),
}));
```

### 3. 数据验证

```typescript
// 使用Zod进行运行时验证
import { z } from 'zod';

const LoginRequestSchema = z.object({
  username: z.string().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().min(8),
  deviceId: z.string().optional(),
  factoryId: z.string().optional(),
}).refine(data => data.username || data.phoneNumber, {
  message: "username或phoneNumber必须提供一个"
});

// 验证数据
function validateLoginRequest(data: unknown): LoginRequest {
  return LoginRequestSchema.parse(data);
}
```

### 4. 离线处理

```typescript
// 离线数据缓存
import AsyncStorage from '@react-native-async-storage/async-storage';

class OfflineCache {
  async saveModel<T>(key: string, data: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  async getModel<T>(key: string): Promise<T | null> {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async saveProductTypes(types: ProductType[]): Promise<void> {
    await this.saveModel('productTypes', types);
  }

  async getProductTypes(): Promise<ProductType[]> {
    return await this.getModel('productTypes') || [];
  }
}
```

---

## C. 移除的模型说明

以下模型在完整版中存在,但在MVP版本中未包含:

### 设备管理相关 (约30个)
- Equipment, EquipmentDTO
- EquipmentMaintenance
- EquipmentUsageRecord
- EquipmentStatistics

### 高级财务分析 (约25个)
- SupplierFinancialAnalysis
- SupplierRating
- CustomerFinancialAnalysis
- CostAnalysis

### 高级统计报表 (约40个)
- DetailedStatistics
- TrendAnalysis
- PredictiveAnalysis
- ExportSettings

### 批量导入导出 (约15个)
- ImportRequest
- ImportResult
- ExportRequest
- ExportResult

### 其他高级功能 (约30个)
- NotificationSettings
- SecuritySettings
- IntegrationSettings
- WorkflowSettings

---

## D. 常见问题

### Q1: 如何选择使用username还是phoneNumber登录?

A: 两者都可以,建议:
- 移动端优先使用phoneNumber(便于验证码登录)
- Web端优先使用username(便于记忆)
- 系统会自动识别并处理

### Q2: Token过期如何处理?

A: 使用refreshToken自动刷新:
```typescript
// 在axios interceptor中处理
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Q3: 如何处理离线数据同步冲突?

A: MVP版本采用"服务端优先"策略:
1. 本地修改上传到服务端
2. 服务端返回冲突列表
3. 显示冲突,由用户手动选择保留哪个版本

### Q4: FIFO出库建议如何使用?

A: 调用FIFO API获取推荐批次:
```typescript
const fifoSuggestion = await api.get(
  `/api/${factoryId}/material-batches/fifo/${materialTypeId}`,
  { params: { requiredQuantity: 100 } }
);
// 返回按过期时间排序的批次列表
```

---

## E. 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2025-10-18 | 初始版本,包含MVP的80个核心数据模型 |

---

## F. 联系方式

**技术支持**: support@cretas.com
**文档反馈**: docs@cretas.com
**模型问题**: api@cretas.com

---

**文档生成时间**: 2025-10-18
**对应API版本**: v1.0
**MVP模型数量**: 约80个
**完整模型数量**: 222个

---

*本文档基于Swagger API规范自动生成,由Claude Code辅助整理*
