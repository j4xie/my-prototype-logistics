# PRD-API-MobileController

**文档版本**: v1.0
**创建日期**: 2025-11-20
**Controller**: MobileController
**端点数量**: 36个（其中5个设备告警端点已记录在EquipmentController）
**E2E测试覆盖**: ✅ 部分验证 (Dashboard E2E 24/24通过)
**文档类型**: Controller分文档（中等详细5维度分析）

---

## 📋 目录

- [概述](#概述)
- [认证相关端点](#认证相关端点)
  - [1. 核心认证 (E2E验证)](#1-核心认证-e2e验证)
  - [2. 密码管理](#2-密码管理)
  - [3. 注册流程](#3-注册流程)
- [移动端功能端点](#移动端功能端点)
  - [4. 文件上传](#4-文件上传)
  - [5. 仪表盘数据 (E2E验证)](#5-仪表盘数据-e2e验证)
  - [6. 数据同步](#6-数据同步)
  - [7. 推送通知](#7-推送通知)
  - [8. 设备管理](#8-设备管理)
  - [9. 版本与配置](#9-版本与配置)
- [业务数据端点](#业务数据端点)
  - [10. 人员报表](#10-人员报表)
  - [11. 成本对比](#11-成本对比)
  - [12. 用户反馈](#12-用户反馈)
  - [13. 监控上报](#13-监控上报)
- [E2E测试验证](#e2e测试验证)
- [核心业务逻辑](#核心业务逻辑)
- [数据模型](#数据模型)

---

## 概述

### Controller信息

| 属性 | 值 |
|-----|-----|
| **Controller类** | `MobileController.java` |
| **基础路径** | `/api/mobile` |
| **认证要求** | 大部分端点需要JWT Bearer Token |
| **主要功能** | 移动端统一接口、认证、数据同步、文件上传 |
| **业务模块** | 移动端核心功能 |

### 功能分类

**认证与账户** (13端点):
- 核心认证: 统一登录、Token刷新、登出 (✅ E2E验证)
- 密码管理: 发送验证码、验证重置码、忘记密码、修改密码、重置密码
- 注册流程: 两阶段注册、设备激活
- 工具接口: Token验证、获取当前用户

**移动端功能** (10端点):
- 文件上传: 移动端优化的文件上传
- 仪表盘: Dashboard数据 (✅ E2E验证)
- 数据同步: 在线同步、离线数据包
- 推送通知: 注册推送、取消注册
- 设备管理: 设备列表、移除设备
- 版本配置: 版本检查、移动端配置

**业务数据** (8端点):
- 人员报表: 统计、工时排行、加班统计、绩效
- 成本对比: 批次成本对比
- 用户反馈: 提交反馈
- 监控上报: 崩溃日志、性能数据

**设备告警** (5端点, 已记录):
- 已在 [EquipmentController](./PRD-API-EquipmentController.md) 中详细记录

### E2E测试状态

| 测试套件 | 状态 | 通过率 | 修复内容 |
|---------|------|--------|---------|
| Dashboard E2E | ✅ 完美通过 | 24/24 (100%) | P1-1: completedBatches, P1-2: avgPassRate |
| Authentication | ✅ 部分验证 | - | 统一登录、Token刷新功能正常 |

---

## 认证相关端点

### 1. 核心认证 (E2E验证)

#### 1.1 统一登录接口 ✅ E2E验证

**端点**: `POST /api/mobile/auth/unified-login`
**功能**: 移动端统一登录，自动识别平台用户和工厂用户
**权限**: 无需认证（登录接口）
**超详细版本**: [主文档 §1](./PRD-API端点完整文档-v3.0.md#11-统一登录)

##### 请求参数

**Body** (`LoginRequest`):
```typescript
{
  username: string,      // 用户名（必填）
  password: string,      // 密码（必填）
  factoryId?: string,    // 工厂ID（工厂用户必填）
  deviceId?: string,     // 设备ID（用于设备绑定）
  deviceInfo?: {
    platform: string,    // 平台 (ios/android)
    model: string,       // 设备型号
    osVersion: string,   // 系统版本
    appVersion: string   // App版本
  }
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 86400,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "factory_super_admin",
      "factoryId": "CRETAS_2024_001",
      "factoryName": "白垩纪食品加工厂",
      "permissions": ["batch.create", "batch.view", ...]
    }
  }
}
```

##### 业务逻辑核心

1. **用户类型识别**:
   - 如果提供factoryId → 工厂用户登录
   - 如果不提供factoryId → 平台用户登录
2. **验证用户名密码**: BCrypt密码验证
3. **生成JWT Token**:
   - accessToken: 有效期24小时
   - refreshToken: 有效期7天
4. **设备绑定**: 如果提供deviceId，绑定设备到用户
5. **返回用户信息**: 包括权限列表

##### 代码示例

**TypeScript (React Native)**:
```typescript
import { apiClient } from '@/services/api/apiClient';

const unifiedLogin = async (credentials: {
  username: string;
  password: string;
  factoryId?: string;
  deviceId?: string;
}) => {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/api/mobile/auth/unified-login',
    credentials
  );

  // 保存Token到SecureStore
  if (response.data.success) {
    await SecureStore.setItemAsync('access_token', response.data.data.accessToken);
    await SecureStore.setItemAsync('refresh_token', response.data.data.refreshToken);
  }

  return response.data;
};

// 使用示例
const result = await unifiedLogin({
  username: 'admin',
  password: 'Admin@123456',
  factoryId: 'CRETAS_2024_001',
  deviceId: await DeviceInfo.getUniqueId()
});
```

---

#### 1.2 刷新访问令牌 ✅ E2E验证

**端点**: `POST /api/mobile/auth/refresh`
**功能**: 使用refreshToken获取新的accessToken
**权限**: 需要有效的refreshToken
**超详细版本**: [主文档 §2](./PRD-API端点完整文档-v3.0.md#12-token刷新)

##### 请求参数

**Query Parameters**:
```typescript
{
  refreshToken: string  // 刷新令牌（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "accessToken": "eyJhbGc...",  // 新的访问令牌
    "refreshToken": "eyJhbGc...", // 新的刷新令牌
    "expiresIn": 86400,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "factory_super_admin"
    }
  }
}
```

##### 业务逻辑核心

1. **验证refreshToken**: 检查Token有效性和过期时间
2. **生成新Token**:
   - 新accessToken: 24小时有效期
   - 新refreshToken: 7天有效期（Rotating Refresh Token模式）
3. **旧Token失效**: 旧refreshToken立即失效
4. **返回用户信息**: 完整的用户信息和权限

##### 代码示例

```typescript
const refreshAccessToken = async (refreshToken: string) => {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/api/mobile/auth/refresh',
    null,
    { params: { refreshToken } }
  );

  // 更新Token
  await SecureStore.setItemAsync('access_token', response.data.data.accessToken);
  await SecureStore.setItemAsync('refresh_token', response.data.data.refreshToken);

  return response.data;
};
```

---

#### 1.3 用户登出 ✅ E2E验证

**端点**: `POST /api/mobile/auth/logout`
**功能**: 用户登出，使Token失效
**权限**: 需要JWT Token
**超详细版本**: [主文档 §3](./PRD-API端点完整文档-v3.0.md#13-用户登出)

##### 请求参数

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

**Query Parameters**:
```typescript
{
  deviceId?: string  // 设备ID（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "登出成功",
  "data": null
}
```

##### 业务逻辑核心

1. **提取userId**: 从JWT Token中获取用户ID
2. **Token失效**: 将accessToken和refreshToken加入黑名单（Redis）
3. **解绑设备**: 如果提供deviceId，解除设备绑定
4. **清除推送**: 移除推送通知注册

##### 代码示例

```typescript
const logout = async (deviceId?: string) => {
  const response = await apiClient.post<ApiResponse<null>>(
    '/api/mobile/auth/logout',
    null,
    { params: { deviceId } }
  );

  // 清除本地Token
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');

  return response.data;
};
```

---

#### 1.4 Token验证

**端点**: `GET /api/mobile/auth/validate`
**功能**: 验证Token是否有效
**权限**: 需要JWT Token

##### 请求参数

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": true  // Token有效
}
```

**失败响应** (401):
```json
{
  "code": 401,
  "message": "Token已失效",
  "data": false
}
```

##### 业务逻辑核心

1. **解析Token**: 验证JWT签名
2. **检查过期**: 验证exp字段
3. **检查黑名单**: 查询Redis黑名单
4. **返回结果**: true/false

---

#### 1.5 获取当前用户信息

**端点**: `GET /api/mobile/auth/me`
**功能**: 获取当前登录用户的详细信息
**权限**: 需要JWT Token

##### 请求参数

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "id": 1,
    "username": "admin",
    "realName": "系统管理员",
    "phoneNumber": "13800138000",
    "email": "admin@cretas.com",
    "role": "factory_super_admin",
    "factoryId": "CRETAS_2024_001",
    "factoryName": "白垩纪食品加工厂",
    "departmentId": null,
    "departmentName": null,
    "permissions": ["batch.create", "batch.view", "batch.edit", ...],
    "createdAt": "2024-01-01T00:00:00",
    "lastLoginAt": "2025-11-20T08:00:00"
  }
}
```

##### 业务逻辑核心

1. **提取Token**: 从Authorization header提取
2. **解析userId**: 从JWT payload获取userId
3. **查询用户**: 完整的用户信息（含工厂、部门、权限）
4. **返回DTO**: UserDTO完整信息

##### 代码示例

```typescript
const getCurrentUser = async () => {
  const response = await apiClient.get<ApiResponse<UserDTO>>(
    '/api/mobile/auth/me'
  );
  return response.data;
};
```

---

### 2. 密码管理

#### 2.1 发送验证码 ✅ E2E验证

**端点**: `POST /api/mobile/auth/send-verification-code`
**功能**: 发送手机验证码（用于注册、忘记密码）
**权限**: 无需认证
**超详细版本**: [主文档 §4](./PRD-API端点完整文档-v3.0.md#14-发送验证码)

##### 请求参数

**Body** (`SendVerificationCodeRequest`):
```typescript
{
  phoneNumber: string,       // 手机号（必填，格式验证）
  verificationType: string   // 类型: "REGISTER" / "RESET_PASSWORD"
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "验证码已发送",
  "data": {
    "phoneNumber": "13800138000",
    "expiresIn": 300,        // 5分钟有效期（秒）
    "rateLimitSeconds": 60   // 60秒后可重新发送
  }
}
```

##### 业务逻辑核心

1. **手机号验证**: 11位数字，1开头
2. **类型验证**: REGISTER或RESET_PASSWORD
3. **频率限制**: 同一手机号60秒内只能发送一次
4. **生成验证码**: 6位随机数字
5. **存储Redis**: key=`verification:${phone}:${type}`, TTL=5分钟
6. **发送短信**: 调用短信服务（阿里云SMS等）

##### 代码示例

```typescript
const sendVerificationCode = async (
  phoneNumber: string,
  verificationType: 'REGISTER' | 'RESET_PASSWORD'
) => {
  const response = await apiClient.post<ApiResponse<SendVerificationCodeResponse>>(
    '/api/mobile/auth/send-verification-code',
    { phoneNumber, verificationType }
  );
  return response.data;
};
```

---

#### 2.2 验证重置验证码

**端点**: `POST /api/mobile/auth/verify-reset-code`
**功能**: 验证忘记密码的验证码
**权限**: 无需认证

##### 请求参数

**Body** (`VerifyResetCodeRequest`):
```typescript
{
  phoneNumber: string,    // 手机号
  code: string            // 验证码（6位）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "验证码正确",
  "data": {
    "verified": true,
    "resetToken": "eyJhbGc...",  // 重置令牌（临时，5分钟有效）
    "expiresIn": 300
  }
}
```

**错误响应**:
- `400`: 验证码错误或已过期
- `429`: 验证次数过多（5次限制）

##### 业务逻辑核心

1. **查询Redis**: key=`verification:${phone}:RESET_PASSWORD`
2. **比对验证码**: 与存储的验证码比对
3. **次数限制**: 最多尝试5次
4. **生成resetToken**: 临时Token，5分钟有效，用于后续重置密码
5. **删除验证码**: 验证成功后删除Redis中的验证码

---

#### 2.3 忘记密码-重置密码

**端点**: `POST /api/mobile/auth/forgot-password`
**功能**: 使用验证码重置密码
**权限**: 需要resetToken

##### 请求参数

**Body** (`ForgotPasswordRequest`):
```typescript
{
  phoneNumber: string,     // 手机号
  resetToken: string,      // 重置令牌（从verify-reset-code获取）
  newPassword: string      // 新密码（8-20字符，含大小写字母和数字）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "密码重置成功",
  "data": {
    "success": true,
    "userId": 1,
    "username": "admin"
  }
}
```

##### 业务逻辑核心

1. **验证resetToken**: 检查Token有效性和过期时间
2. **查询用户**: 根据手机号查询用户
3. **密码验证**: 新密码格式验证（长度、复杂度）
4. **更新密码**: BCrypt加密后更新数据库
5. **使Token失效**: resetToken立即失效
6. **记录日志**: 审计日志记录密码重置操作

##### 代码示例

```typescript
const forgotPassword = async (
  phoneNumber: string,
  resetToken: string,
  newPassword: string
) => {
  const response = await apiClient.post<ApiResponse<ForgotPasswordResponse>>(
    '/api/mobile/auth/forgot-password',
    { phoneNumber, resetToken, newPassword }
  );
  return response.data;
};
```

---

#### 2.4 修改密码

**端点**: `POST /api/mobile/auth/change-password`
**功能**: 已登录用户修改密码
**权限**: 需要JWT Token

##### 请求参数

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

**Query Parameters**:
```typescript
{
  oldPassword: string,   // 原密码（必填）
  newPassword: string    // 新密码（必填，8-20字符）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "密码修改成功",
  "data": null
}
```

**错误响应**:
- `400`: 原密码错误
- `400`: 新密码格式不符合要求

##### 业务逻辑核心

1. **获取userId**: 从JWT Token提取
2. **验证原密码**: BCrypt验证oldPassword
3. **验证新密码**: 格式验证（长度、复杂度）
4. **更新密码**: BCrypt加密后更新
5. **使旧Token失效**: 所有旧Token加入黑名单
6. **发送通知**: 邮件/短信通知密码已修改

##### 代码示例

```typescript
const changePassword = async (oldPassword: string, newPassword: string) => {
  const response = await apiClient.post<ApiResponse<null>>(
    '/api/mobile/auth/change-password',
    null,
    { params: { oldPassword, newPassword } }
  );
  return response.data;
};
```

---

#### 2.5 重置密码（管理员功能）

**端点**: `POST /api/mobile/auth/reset-password`
**功能**: 管理员重置用户密码
**权限**: 工厂管理员、平台管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  factoryId: string,    // 工厂ID（必填）
  username: string,     // 用户名（必填）
  newPassword: string   // 新密码（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "密码重置成功",
  "data": null
}
```

##### 业务逻辑核心

1. **权限验证**: 检查当前用户是否为管理员
2. **查询目标用户**: 根据factoryId和username查询
3. **更新密码**: BCrypt加密后更新
4. **使所有Token失效**: 目标用户的所有Token加入黑名单
5. **发送通知**: 邮件/短信通知用户密码已被重置
6. **记录审计日志**: 记录管理员重置密码操作

---

### 3. 注册流程

#### 3.1 移动端注册-第一阶段（验证手机号）

**端点**: `POST /api/mobile/auth/register-phase-one`
**功能**: 注册第一阶段，验证手机号和验证码
**权限**: 无需认证

##### 请求参数

**Body** (`RegisterPhaseOneRequest`):
```typescript
{
  phoneNumber: string,   // 手机号（必填）
  verificationCode: string  // 验证码（必填，6位）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "验证成功，请继续完善信息",
  "data": {
    "phoneNumber": "13800138000",
    "tempToken": "eyJhbGc...",  // 临时令牌（用于第二阶段）
    "expiresIn": 600              // 10分钟有效期
  }
}
```

##### 业务逻辑核心

1. **验证码检查**: 从Redis查询并验证
2. **检查手机号**: 验证是否已注册
3. **生成tempToken**: 临时令牌，10分钟有效，用于第二阶段
4. **删除验证码**: 验证成功后删除Redis中的验证码

##### 代码示例

```typescript
const registerPhaseOne = async (phoneNumber: string, verificationCode: string) => {
  const response = await apiClient.post<ApiResponse<RegisterPhaseOneResponse>>(
    '/api/mobile/auth/register-phase-one',
    { phoneNumber, verificationCode }
  );
  return response.data;
};
```

---

#### 3.2 移动端注册-第二阶段（创建账户）

**端点**: `POST /api/mobile/auth/register-phase-two`
**功能**: 注册第二阶段，完成账户创建
**权限**: 需要tempToken

##### 请求参数

**Body** (`RegisterPhaseTwoRequest`):
```typescript
{
  tempToken: string,       // 临时令牌（从第一阶段获取）
  factoryId: string,       // 工厂ID（必填）
  username: string,        // 用户名（必填，4-20字符）
  password: string,        // 密码（必填，8-20字符）
  realName: string,        // 真实姓名（必填）
  email?: string,          // 邮箱（可选）
  departmentId?: number    // 部门ID（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "userId": 1,
    "username": "newuser",
    "factoryId": "CRETAS_2024_001",
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 86400
  }
}
```

##### 业务逻辑核心

1. **验证tempToken**: 检查Token有效性
2. **验证工厂**: 检查factoryId是否存在
3. **用户名唯一性**: 检查工厂内username唯一
4. **创建用户**:
   - password: BCrypt加密
   - role: 默认为"worker"
   - status: ACTIVE
5. **生成Token**: accessToken和refreshToken
6. **发送欢迎邮件**: 如果提供了email

##### 代码示例

```typescript
const registerPhaseTwo = async (data: {
  tempToken: string;
  factoryId: string;
  username: string;
  password: string;
  realName: string;
  email?: string;
}) => {
  const response = await apiClient.post<ApiResponse<RegisterPhaseTwoResponse>>(
    '/api/mobile/auth/register-phase-two',
    data
  );

  // 保存Token
  await SecureStore.setItemAsync('access_token', response.data.data.accessToken);
  await SecureStore.setItemAsync('refresh_token', response.data.data.refreshToken);

  return response.data;
};
```

---

#### 3.3 设备激活

**端点**: `POST /api/mobile/activation/activate`
**功能**: 使用激活码激活移动设备
**权限**: 无需认证

##### 请求参数

**Body** (`ActivationRequest`):
```typescript
{
  activationCode: string,   // 激活码（必填，12-16字符）
  deviceId: string,         // 设备唯一标识（必填）
  deviceInfo?: {
    platform: string,       // ios/android
    model: string,
    osVersion: string,
    appVersion: string
  }
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备激活成功",
  "data": {
    "activated": true,
    "factoryId": "CRETAS_2024_001",
    "factoryName": "白垩纪食品加工厂",
    "expiresAt": "2026-11-20T00:00:00",  // 激活有效期
    "deviceId": "device-uuid-123"
  }
}
```

##### 业务逻辑核心

1. **验证激活码**: 查询activation_codes表
2. **检查状态**: 激活码是否已使用、是否过期
3. **绑定设备**: 将deviceId绑定到激活码
4. **更新状态**: 激活码状态 = USED, activatedAt = now()
5. **返回工厂信息**: 激活成功后返回所属工厂信息

##### 代码示例

```typescript
const activateDevice = async (activationCode: string, deviceId: string) => {
  const response = await apiClient.post<ApiResponse<ActivationResponse>>(
    '/api/mobile/activation/activate',
    { activationCode, deviceId }
  );
  return response.data;
};
```

---

## 移动端功能端点

### 4. 文件上传

#### 4.1 移动端文件上传

**端点**: `POST /api/mobile/upload`
**功能**: 移动端优化的文件上传（支持图片压缩、多文件）
**权限**: 需要JWT Token

##### 请求参数

**Headers**:
```typescript
{
  "Content-Type": "multipart/form-data",
  "Authorization": "Bearer <access_token>"
}
```

**Body** (FormData):
```typescript
{
  files: File[],          // 文件数组（必填，最多10个）
  category?: string,      // 文件分类（可选: "avatar", "quality_check", "batch_photo"）
  metadata?: string       // 元数据JSON字符串（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "文件上传成功",
  "data": {
    "uploadedFiles": [
      {
        "fileId": "file-uuid-123",
        "fileName": "IMG_20251120_143000.jpg",
        "fileUrl": "https://cdn.cretas.com/uploads/2025/11/20/file-uuid-123.jpg",
        "thumbnailUrl": "https://cdn.cretas.com/uploads/2025/11/20/thumb_file-uuid-123.jpg",
        "fileSize": 1024567,      // 字节
        "mimeType": "image/jpeg",
        "uploadedAt": "2025-11-20T14:30:00"
      }
    ],
    "totalSize": 1024567,
    "count": 1
  }
}
```

##### 业务逻辑核心

1. **文件验证**:
   - 数量限制: 最多10个文件
   - 大小限制: 单个文件≤10MB
   - 类型限制: image/*, application/pdf, video/* (根据category)
2. **移动端优化**:
   - 图片自动压缩: 宽度≤1920px, 质量80%
   - 生成缩略图: 200x200px
3. **文件存储**:
   - 生成UUID作为fileId
   - 上传到OSS (阿里云/AWS S3)
   - 保存记录到uploaded_files表
4. **返回URL**: CDN URL供前端使用

##### 代码示例

**TypeScript (React Native)**:
```typescript
import * as ImagePicker from 'expo-image-picker';

const uploadFiles = async (
  files: File[],
  category?: string,
  metadata?: Record<string, any>
) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  if (category) {
    formData.append('category', category);
  }

  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const response = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/mobile/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
};

// 使用示例：上传质检照片
const pickAndUploadImage = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (!result.canceled) {
    const file = {
      uri: result.assets[0].uri,
      type: 'image/jpeg',
      name: 'quality_check.jpg',
    };

    const uploadResult = await uploadFiles([file], 'quality_check', {
      batchId: 'BATCH-123',
      inspector: 'user-456'
    });

    return uploadResult.data.uploadedFiles[0].fileUrl;
  }
};
```

---

### 5. 仪表盘数据 (E2E验证)

#### 5.1 获取移动端仪表盘数据 ✅ E2E验证

**端点**: `GET /api/mobile/dashboard/{factoryId}`
**功能**: 获取移动端仪表盘汇总数据
**权限**: 工厂所有角色
**E2E测试**: ✅ 24/24通过 (Dashboard E2E)

##### 请求参数

**Path Parameters**:
- `factoryId`: string (工厂ID)

**Headers**:
```typescript
{
  "Authorization": "Bearer <access_token>"
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "todayOutput": 1850,           // ✅ E2E验证
    "completedBatches": 12,        // ✅ P1-1修复: completedBatches字段
    "activeBatches": 3,
    "avgPassRate": 98.5,           // ✅ P1-2修复: avgPassRate提升为顶层字段
    "pendingQualityInspections": 5,
    "activeAlerts": 2,
    "todayAttendance": {
      "present": 48,
      "total": 52,
      "rate": 92.3
    },
    "recentBatches": [
      {
        "id": "BATCH-001",
        "batchNumber": "BATCH-20251120-001",
        "status": "IN_PROGRESS",
        "progress": 65,
        "startedAt": "2025-11-20T08:00:00"
      }
    ],
    "summary": {
      "totalEquipment": 48,
      "runningEquipment": 28,
      "maintenanceNeeded": 4
    }
  }
}
```

##### 业务逻辑核心

1. **今日产出统计**:
   - SUM(actualQuantity) WHERE DATE(completedAt) = TODAY
2. **批次统计**:
   - completedBatches: COUNT(*) WHERE status=COMPLETED AND DATE(completedAt)=TODAY
   - activeBatches: COUNT(*) WHERE status=IN_PROGRESS
3. **质量合格率**:
   - avgPassRate = (SUM(passedQuantity) / SUM(actualQuantity)) * 100
4. **告警统计**: COUNT(*) WHERE status=ACTIVE
5. **考勤统计**: 今日打卡人数 / 总人数
6. **缓存**: Redis缓存5分钟

##### E2E测试验证点

| 测试场景 | 状态 | 验证点 |
|---------|------|--------|
| 响应码200 | ✅ 通过 | code字段返回200 |
| todayOutput字段 | ✅ 通过 | 今日产出数据存在 |
| **completedBatches字段** | ✅ 通过 | **P1-1修复: 字段正常返回** |
| **avgPassRate提升** | ✅ 通过 | **P1-2修复: 提升为顶层字段** |
| recentBatches数组 | ✅ 通过 | 最近批次列表存在 |

##### 代码示例

```typescript
const getMobileDashboard = async (factoryId: string) => {
  const response = await apiClient.get<ApiResponse<DashboardData>>(
    `/api/mobile/dashboard/${factoryId}`
  );
  return response.data;
};

// 使用示例
const DashboardScreen = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      const result = await getMobileDashboard('CRETAS_2024_001');
      setDashboard(result.data);
    };

    loadDashboard();
  }, []);

  return (
    <View>
      <Text>今日产出: {dashboard?.todayOutput} kg</Text>
      <Text>完成批次: {dashboard?.completedBatches}</Text>
      <Text>平均合格率: {dashboard?.avgPassRate}%</Text>
    </View>
  );
};
```

---

### 6. 数据同步

#### 6.1 数据同步

**端点**: `POST /api/mobile/sync/{factoryId}`
**功能**: 移动端数据同步（上传本地数据，下载服务器更新）
**权限**: 工厂所有角色

##### 请求参数

**Path Parameters**:
- `factoryId`: string

**Body** (`SyncRequest`):
```typescript
{
  lastSyncTime: string,     // 上次同步时间 (ISO 8601)
  localChanges: {
    batches?: Array<{       // 本地新增/修改的批次
      id: string,
      action: "CREATE" | "UPDATE",
      data: object
    }>,
    qualityInspections?: Array<{
      id: string,
      action: "CREATE" | "UPDATE",
      data: object
    }>,
    attendance?: Array<{
      id: string,
      action: "CREATE",
      data: object
    }>
  }
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "同步成功",
  "data": {
    "syncTime": "2025-11-20T14:30:00",
    "serverChanges": {
      "batches": [
        {
          "id": "BATCH-001",
          "action": "UPDATE",
          "data": { /* 批次数据 */ }
        }
      ],
      "users": [
        {
          "id": 1,
          "action": "UPDATE",
          "data": { /* 用户数据 */ }
        }
      ]
    },
    "conflicts": [
      {
        "entityType": "batch",
        "entityId": "BATCH-002",
        "localVersion": 5,
        "serverVersion": 6,
        "resolution": "SERVER_WINS"  // 冲突解决策略
      }
    ],
    "uploadedCount": 3,
    "downloadedCount": 8,
    "conflictCount": 1
  }
}
```

##### 业务逻辑核心

1. **上传本地变更**:
   - 解析localChanges
   - 验证数据完整性
   - 批量插入/更新数据库
   - 处理冲突（版本号比对）
2. **下载服务器变更**:
   - 查询 WHERE updatedAt > lastSyncTime
   - 按实体类型分组（batches, users, settings等）
3. **冲突检测**:
   - 版本号比对
   - 最后修改时间比对
4. **冲突解决策略**:
   - SERVER_WINS: 服务器版本覆盖本地
   - CLIENT_WINS: 本地版本覆盖服务器
   - MANUAL: 需要用户手动选择

##### 代码示例

```typescript
const syncData = async (factoryId: string, syncRequest: SyncRequest) => {
  const response = await apiClient.post<ApiResponse<SyncResponse>>(
    `/api/mobile/sync/${factoryId}`,
    syncRequest
  );
  return response.data;
};
```

---

#### 6.2 获取离线数据包

**端点**: `GET /api/mobile/offline/{factoryId}`
**功能**: 获取完整的离线数据包（用于初次安装或完全离线场景）
**权限**: 工厂所有角色

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "version": "2025-11-20T14:30:00",
    "factoryInfo": {
      "id": "CRETAS_2024_001",
      "name": "白垩纪食品加工厂",
      "address": "上海市浦东新区"
    },
    "users": [
      { /* 用户数据 */ }
    ],
    "productTypes": [
      { /* 产品类型 */ }
    ],
    "suppliers": [
      { /* 供应商 */ }
    ],
    "equipment": [
      { /* 设备 */ }
    ],
    "recentBatches": [
      { /* 最近30天批次 */ }
    ],
    "settings": {
      /* 工厂配置 */
    },
    "totalSize": 2048576  // 数据包大小（字节）
  }
}
```

##### 业务逻辑核心

1. **数据范围**: 最近30天的业务数据 + 全部基础数据
2. **数据压缩**: gzip压缩减少传输大小
3. **缓存策略**: Redis缓存1小时
4. **增量更新**: 返回version用于后续增量同步

---

### 7. 推送通知

#### 7.1 注册推送通知

**端点**: `POST /api/mobile/push/register`
**功能**: 注册设备推送通知（支持iOS APNs和Android FCM）
**权限**: 需要JWT Token

##### 请求参数

**Body** (`PushRegistration`):
```typescript
{
  deviceToken: string,      // 推送Token（必填）
  platform: string,         // 平台: "ios" / "android"（必填）
  deviceId: string,         // 设备唯一标识（必填）
  appVersion?: string,      // App版本
  language?: string         // 语言偏好
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "推送注册成功",
  "data": null
}
```

##### 业务逻辑核心

1. **提取userId**: 从JWT Token获取
2. **保存注册信息**: push_registrations表
   - (userId, deviceToken, platform, deviceId)
   - UNIQUE KEY (userId, deviceId)
3. **更新已有注册**: 如果设备已注册，更新deviceToken
4. **订阅主题**: 根据用户角色订阅相应的推送主题

##### 代码示例

```typescript
import * as Notifications from 'expo-notifications';

const registerPushNotification = async () => {
  // 1. 请求权限
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('推送权限被拒绝');
    return;
  }

  // 2. 获取设备Token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const deviceToken = tokenData.data;

  // 3. 注册到服务器
  const response = await apiClient.post<ApiResponse<null>>(
    '/api/mobile/push/register',
    {
      deviceToken,
      platform: Platform.OS,
      deviceId: await DeviceInfo.getUniqueId(),
      appVersion: await DeviceInfo.getVersion(),
      language: 'zh-CN'
    }
  );

  return response.data;
};
```

---

#### 7.2 取消推送通知注册

**端点**: `DELETE /api/mobile/push/unregister`
**功能**: 取消设备推送通知注册
**权限**: 需要JWT Token

##### 请求参数

**Query Parameters**:
```typescript
{
  deviceToken: string  // 推送Token（必填）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "推送已取消",
  "data": null
}
```

##### 业务逻辑核心

1. **提取userId**: 从JWT Token获取
2. **删除注册**: DELETE FROM push_registrations WHERE userId = ? AND deviceToken = ?
3. **取消订阅**: 取消所有主题订阅

---

### 8. 设备管理

#### 8.1 获取用户设备列表

**端点**: `GET /api/mobile/devices`
**功能**: 获取当前用户绑定的所有设备
**权限**: 需要JWT Token

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "deviceId": "device-uuid-123",
      "deviceName": "iPhone 13 Pro",
      "platform": "ios",
      "osVersion": "17.2",
      "appVersion": "1.2.0",
      "lastActiveAt": "2025-11-20T14:30:00",
      "bindedAt": "2025-11-01T08:00:00",
      "isCurrent": true  // 是否为当前设备
    },
    {
      "deviceId": "device-uuid-456",
      "deviceName": "Xiaomi 13",
      "platform": "android",
      "osVersion": "13",
      "appVersion": "1.2.0",
      "lastActiveAt": "2025-11-18T10:00:00",
      "bindedAt": "2025-10-15T09:00:00",
      "isCurrent": false
    }
  ]
}
```

##### 业务逻辑核心

1. **提取userId**: 从JWT Token获取
2. **查询设备**: FROM user_devices WHERE userId = ?
3. **标记当前设备**: 根据请求中的deviceId标记isCurrent

---

#### 8.2 移除设备

**端点**: `DELETE /api/mobile/devices/{deviceId}`
**功能**: 移除设备绑定（用于丢失设备或更换设备）
**权限**: 需要JWT Token

##### 请求参数

**Path Parameters**:
- `deviceId`: string (设备ID)

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "设备已移除",
  "data": null
}
```

##### 业务逻辑核心

1. **提取userId**: 从JWT Token获取
2. **删除设备**: DELETE FROM user_devices WHERE userId = ? AND deviceId = ?
3. **使Token失效**: 该设备的所有Token加入黑名单
4. **取消推送**: 删除该设备的推送注册

---

### 9. 版本与配置

#### 9.1 检查应用版本

**端点**: `GET /api/mobile/version/check`
**功能**: 检查App是否需要更新
**权限**: 无需认证

##### 请求参数

**Query Parameters**:
```typescript
{
  currentVersion: string,  // 当前版本（必填，如"1.2.0"）
  platform: string         // 平台（必填，"ios"/"android"）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "latestVersion": "1.3.0",
    "updateRequired": true,      // 是否强制更新
    "updateAvailable": true,     // 是否有新版本
    "releaseNotes": "1. 新增批次成本分析\n2. 修复若干问题",
    "downloadUrl": "https://app.cretas.com/downloads/android/1.3.0.apk",
    "releaseDate": "2025-11-15T00:00:00",
    "minimumVersion": "1.1.0"    // 最低支持版本
  }
}
```

##### 业务逻辑核心

1. **版本比对**: 使用语义化版本号比对（semver）
2. **强制更新判断**:
   - currentVersion < minimumVersion → 强制更新
   - currentVersion < latestVersion → 可选更新
3. **平台区分**: iOS和Android分别管理版本
4. **返回下载链接**: iOS返回AppStore链接，Android返回APK下载链接

##### 代码示例

```typescript
const checkAppVersion = async (currentVersion: string, platform: string) => {
  const response = await apiClient.get<ApiResponse<VersionCheckResponse>>(
    '/api/mobile/version/check',
    { params: { currentVersion, platform } }
  );

  const data = response.data.data;

  if (data.updateRequired) {
    // 强制更新，阻断用户继续使用
    Alert.alert(
      '需要更新',
      `发现新版本 ${data.latestVersion}，请立即更新。`,
      [{ text: '立即更新', onPress: () => Linking.openURL(data.downloadUrl) }],
      { cancelable: false }
    );
  } else if (data.updateAvailable) {
    // 可选更新
    Alert.alert(
      '发现新版本',
      `${data.latestVersion}\n\n${data.releaseNotes}`,
      [
        { text: '稍后更新', style: 'cancel' },
        { text: '立即更新', onPress: () => Linking.openURL(data.downloadUrl) }
      ]
    );
  }

  return response.data;
};
```

---

#### 9.2 获取移动端配置

**端点**: `GET /api/mobile/config/{factoryId}`
**功能**: 获取移动端动态配置（功能开关、UI配置等）
**权限**: 需要JWT Token

##### 请求参数

**Path Parameters**:
- `factoryId`: string

**Query Parameters**:
```typescript
{
  platform: string  // 平台（"ios"/"android"）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "features": {
      "aiAnalysis": true,           // AI成本分析功能
      "offlineMode": true,          // 离线模式
      "biometricAuth": true,        // 生物识别登录
      "darkMode": false             // 深色模式
    },
    "limits": {
      "maxUploadSize": 10485760,   // 最大上传大小（字节）
      "maxUploadFiles": 10,         // 最大上传文件数
      "syncInterval": 300           // 同步间隔（秒）
    },
    "ui": {
      "primaryColor": "#1976D2",
      "logo": "https://cdn.cretas.com/logo.png",
      "theme": "light"
    },
    "apiEndpoints": {
      "deepseekApi": "https://api.deepseek.com/v1"
    }
  }
}
```

##### 业务逻辑核心

1. **工厂配置**: 从factory_settings表读取
2. **平台区分**: iOS和Android可能有不同配置
3. **缓存**: Redis缓存10分钟
4. **动态开关**: 支持灰度发布和A/B测试

---

## 业务数据端点

### 10. 人员报表

#### 10.1 获取人员总览统计

**端点**: `GET /api/mobile/{factoryId}/personnel/statistics`
**功能**: 获取人员总览统计（考勤、工时、绩效）
**权限**: 工厂管理员、人事管理员

##### 请求参数

**Path Parameters**:
- `factoryId`: string

**Query Parameters**:
```typescript
{
  startDate?: string,  // 开始日期 (YYYY-MM-DD, 可选)
  endDate?: string     // 结束日期 (YYYY-MM-DD, 可选)
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "totalEmployees": 52,
    "activeEmployees": 48,
    "avgAttendanceRate": 92.3,
    "totalWorkHours": 9856,
    "avgWorkHoursPerPerson": 205.3,
    "totalOvertimeHours": 156,
    "avgOvertimePerPerson": 3.25,
    "departments": [
      {
        "departmentId": 1,
        "departmentName": "生产部",
        "employeeCount": 30,
        "attendanceRate": 93.5,
        "avgWorkHours": 210
      }
    ]
  }
}
```

##### 业务逻辑核心

1. **考勤统计**: 出勤率 = 实际出勤人次 / 应出勤人次 × 100%
2. **工时统计**: SUM(打卡时长) 按人员和部门聚合
3. **加班统计**: SUM(超过8小时的部分)
4. **按部门分组**: GROUP BY departmentId

---

#### 10.2 获取工时排行榜

**端点**: `GET /api/mobile/{factoryId}/personnel/work-hours-ranking`
**功能**: 获取工时排行榜（Top N）
**权限**: 工厂管理员、人事管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  startDate: string,   // 开始日期（必填）
  endDate: string,     // 结束日期（必填）
  limit?: number       // 返回前N名（默认10）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "rank": 1,
      "userId": 10,
      "realName": "张三",
      "departmentName": "生产部",
      "totalWorkHours": 248,
      "workDays": 24,
      "avgDailyHours": 10.3,
      "overtimeHours": 48
    },
    {
      "rank": 2,
      "userId": 15,
      "realName": "李四",
      "departmentName": "生产部",
      "totalWorkHours": 236,
      "workDays": 24,
      "avgDailyHours": 9.8,
      "overtimeHours": 40
    }
  ]
}
```

##### 业务逻辑核心

1. **工时聚合**: SUM(duration) GROUP BY userId
2. **排序**: ORDER BY totalWorkHours DESC
3. **限制数量**: LIMIT N
4. **计算指标**: 工作天数、日均工时、加班时长

---

#### 10.3 获取加班统计

**端点**: `GET /api/mobile/{factoryId}/personnel/overtime-statistics`
**功能**: 获取加班统计（总时长、人数、部门分布）
**权限**: 工厂管理员、人事管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  startDate: string,        // 开始日期（必填）
  endDate: string,          // 结束日期（必填）
  departmentId?: string     // 部门ID筛选（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": {
    "totalOvertimeHours": 356,
    "avgOvertimePerPerson": 7.4,
    "overtimePeopleCount": 48,
    "byDepartment": [
      {
        "departmentId": 1,
        "departmentName": "生产部",
        "overtimeHours": 240,
        "peopleCount": 30
      }
    ],
    "topOvertimeEmployees": [
      {
        "userId": 10,
        "realName": "张三",
        "overtimeHours": 48
      }
    ]
  }
}
```

##### 业务逻辑核心

1. **加班时长**: SUM(duration - 8小时) WHERE duration > 8
2. **人数统计**: COUNT(DISTINCT userId) WHERE 有加班记录
3. **部门分布**: GROUP BY departmentId
4. **Top排行**: ORDER BY overtimeHours DESC LIMIT 5

---

#### 10.4 获取人员绩效统计

**端点**: `GET /api/mobile/{factoryId}/personnel/performance`
**功能**: 获取人员绩效统计（产量、质检合格率、出勤率）
**权限**: 工厂管理员、人事管理员

##### 请求参数

**Query Parameters**:
```typescript
{
  startDate: string,   // 开始日期（必填）
  endDate: string,     // 结束日期（必填）
  userId?: number      // 用户ID筛选（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "userId": 10,
      "realName": "张三",
      "departmentName": "生产部",
      "metrics": {
        "totalOutput": 2850,        // 总产量（kg）
        "avgDailyOutput": 118.75,   // 日均产量
        "qualityPassRate": 98.5,    // 质检合格率 (%)
        "attendanceRate": 95.8,     // 出勤率 (%)
        "workHours": 248,           // 工时
        "completedBatches": 15      // 完成批次数
      },
      "score": 95.2  // 综合绩效得分
    }
  ]
}
```

##### 业务逻辑核心

1. **产量统计**: SUM(actualQuantity) WHERE supervisorId = userId
2. **质检合格率**: (SUM(passedQuantity) / SUM(actualQuantity)) × 100
3. **出勤率**: 实际出勤天数 / 应出勤天数 × 100
4. **综合得分**: 加权计算 (产量30% + 质检40% + 出勤20% + 工时10%)

---

### 11. 成本对比

#### 11.1 获取批次成本对比数据

**端点**: `GET /api/mobile/{factoryId}/processing/cost-comparison`
**功能**: 获取多个批次的成本对比数据（用于AI成本分析）
**权限**: 工厂管理员、生产管理员、财务

##### 请求参数

**Path Parameters**:
- `factoryId`: string

**Query Parameters**:
```typescript
{
  batchIds: string  // 批次ID列表（逗号分隔，必填，如"BATCH-001,BATCH-002"）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": null,
  "data": [
    {
      "batchId": "BATCH-001",
      "batchNumber": "BATCH-20251120-001",
      "productTypeName": "冻品猪肉",
      "costs": {
        "materialCost": 15800,        // 原材料成本（元）
        "laborCost": 2400,            // 人工成本
        "equipmentCost": 800,         // 设备折旧成本
        "utilityCost": 350,           // 水电成本
        "overheadCost": 450,          // 其他开销
        "totalCost": 19800            // 总成本
      },
      "quantity": 200,                 // 产量（kg）
      "unitCost": 99,                  // 单位成本（元/kg）
      "passRate": 98.5,                // 合格率 (%)
      "efficiency": 85.3               // 效率评分
    },
    {
      "batchId": "BATCH-002",
      "batchNumber": "BATCH-20251119-002",
      "productTypeName": "冻品猪肉",
      "costs": {
        "materialCost": 16200,
        "laborCost": 2600,
        "equipmentCost": 850,
        "utilityCost": 370,
        "overheadCost": 480,
        "totalCost": 20500
      },
      "quantity": 195,
      "unitCost": 105.13,
      "passRate": 97.2,
      "efficiency": 82.1
    }
  ]
}
```

##### 业务逻辑核心

1. **批次查询**: WHERE batchId IN (...)
2. **成本计算**:
   - materialCost: SUM(material_usages.quantity × material_batches.unit_price)
   - laborCost: SUM(work_hours × hourly_rate)
   - equipmentCost: SUM(equipment_depreciation_per_hour × running_hours)
   - utilityCost: 基于产量和工厂平均单耗
   - overheadCost: 总成本的2-3%
3. **单位成本**: totalCost / quantity
4. **效率评分**: 基于单位成本、合格率、时长的综合评分

##### 代码示例

```typescript
const getBatchCostComparison = async (factoryId: string, batchIds: string[]) => {
  const response = await apiClient.get<ApiResponse<BatchCostData[]>>(
    `/api/mobile/${factoryId}/processing/cost-comparison`,
    { params: { batchIds: batchIds.join(',') } }
  );
  return response.data;
};

// 使用示例：对比两个批次
const compareCosts = async () => {
  const costData = await getBatchCostComparison('CRETAS_2024_001', [
    'BATCH-20251120-001',
    'BATCH-20251119-002'
  ]);

  // 计算差异
  const [batch1, batch2] = costData.data;
  const costDiff = batch2.unitCost - batch1.unitCost;
  const costDiffPercent = (costDiff / batch1.unitCost) * 100;

  console.log(`单位成本差异: ${costDiff.toFixed(2)}元/kg (${costDiffPercent.toFixed(1)}%)`);
};
```

---

### 12. 用户反馈

#### 12.1 提交用户反馈

**端点**: `POST /api/mobile/{factoryId}/feedback`
**功能**: 用户提交反馈（问题反馈、功能建议等）
**权限**: 工厂所有角色

##### 请求参数

**Path Parameters**:
- `factoryId`: string

**Body** (`SubmitFeedbackRequest`):
```typescript
{
  type: string,           // 反馈类型: "BUG" / "FEATURE" / "IMPROVEMENT" / "OTHER"
  title: string,          // 标题（必填，1-100字符）
  content: string,        // 内容（必填，10-1000字符）
  attachments?: string[], // 附件URL数组（可选）
  priority?: string,      // 优先级: "LOW" / "MEDIUM" / "HIGH"（默认MEDIUM）
  contactInfo?: string    // 联系方式（可选）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "反馈提交成功",
  "data": {
    "feedbackId": 123,
    "ticketNumber": "FB-20251120-123",
    "status": "PENDING",
    "submittedAt": "2025-11-20T14:30:00",
    "estimatedResponseTime": "2025-11-21T14:30:00"  // 预计响应时间（24小时）
  }
}
```

##### 业务逻辑核心

1. **验证输入**: 类型、标题、内容格式验证
2. **生成工单号**: ticketNumber = `FB-${date}-${seq}`
3. **保存反馈**: user_feedbacks表
4. **发送通知**: 邮件通知管理员和开发团队
5. **自动分类**: 根据关键词自动打标签

##### 代码示例

```typescript
const submitFeedback = async (
  factoryId: string,
  feedback: {
    type: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'OTHER';
    title: string;
    content: string;
    attachments?: string[];
  }
) => {
  const response = await apiClient.post<ApiResponse<FeedbackResponse>>(
    `/api/mobile/${factoryId}/feedback`,
    feedback
  );
  return response.data;
};

// 使用示例
const reportBug = async () => {
  const result = await submitFeedback('CRETAS_2024_001', {
    type: 'BUG',
    title: '批次列表加载失败',
    content: '在点击批次列表时，App显示加载中但一直无法显示数据。重启App后仍然无法解决。',
    attachments: ['https://cdn.cretas.com/screenshots/bug-001.jpg']
  });

  Alert.alert('提交成功', `您的反馈工单号为: ${result.data.ticketNumber}`);
};
```

---

### 13. 监控上报

#### 13.1 上报崩溃日志

**端点**: `POST /api/mobile/report/crash`
**功能**: 上报App崩溃日志（用于监控和问题诊断）
**权限**: 无需认证（允许未登录时上报）

##### 请求参数

**Body**:
```typescript
{
  deviceInfo: {
    platform: string,      // ios/android
    model: string,
    osVersion: string,
    appVersion: string,
    deviceId: string
  },
  crashLog: string,        // 崩溃堆栈信息
  timestamp: string,       // 崩溃时间
  userId?: number          // 用户ID（如果已登录）
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "崩溃日志已上报",
  "data": null
}
```

##### 业务逻辑核心

1. **解析崩溃日志**: 提取关键错误信息
2. **保存日志**: crash_reports表
3. **错误聚合**: 相同错误归类到同一Issue
4. **告警触发**: 高频崩溃自动创建告警

---

#### 13.2 上报性能数据

**端点**: `POST /api/mobile/report/performance`
**功能**: 上报App性能数据（启动时间、内存占用等）
**权限**: 无需认证

##### 请求参数

**Body**:
```typescript
{
  deviceInfo: { /* 设备信息 */ },
  data: {
    coldStartTime: number,     // 冷启动时间（毫秒）
    hotStartTime: number,      // 热启动时间（毫秒）
    memoryUsage: number,       // 内存占用（MB）
    batteryDrain: number,      // 电池消耗 (%)
    networkLatency: number,    // 网络延迟（毫秒）
    crashCount: number         // 崩溃次数
  },
  timestamp: string
}
```

##### 响应结构

**成功响应** (200):
```json
{
  "code": 200,
  "message": "性能数据已上报",
  "data": null
}
```

##### 业务逻辑核心

1. **保存性能数据**: performance_metrics表
2. **聚合分析**: 按设备型号、App版本聚合
3. **性能监控**: 启动时间、内存占用等指标监控
4. **告警触发**: 性能劣化自动告警

---

## E2E测试验证

### Dashboard E2E测试总结

**测试时间**: 2025-11-20
**测试环境**: http://localhost:10010
**测试套件**: Dashboard E2E
**通过率**: 24/24 (100%) ✅

#### 测试覆盖

| 测试步骤 | API端点 | 验证点 | 状态 |
|---------|---------|--------|------|
| 1.1 获取Dashboard数据 | GET /dashboard/{factoryId} | 响应码200 | ✅ |
| 1.2 验证todayOutput | - | 今日产出字段存在 | ✅ |
| **1.3 验证completedBatches** | - | **P1-1修复: completedBatches字段** | ✅ |
| 1.4 验证activeBatches | - | 活跃批次字段存在 | ✅ |
| **1.5 验证avgPassRate** | - | **P1-2修复: avgPassRate提升为顶层** | ✅ |
| 1.6 验证recentBatches | - | 最近批次数组存在 | ✅ |

#### E2E修复内容

**修复1: P1-1 - completedBatches字段** (已完成✅)

**问题描述**: Dashboard响应缺少completedBatches字段

**修复代码** (`MobileServiceImpl.java`):
```java
// 统计今日完成的批次数量
long completedBatches = processingBatchRepository.countByFactoryIdAndStatusAndCompletedAtBetween(
    factoryId,
    BatchStatus.COMPLETED,
    today.atStartOfDay(),
    today.plusDays(1).atStartOfDay()
);

dashboardData.setCompletedBatches((int) completedBatches);
```

**验证结果**:
```json
{
  "code": 200,
  "data": {
    "completedBatches": 12,  // ✅ 字段正常返回
    "todayOutput": 1850
  }
}
```

---

**修复2: P1-2 - avgPassRate提升** (已完成✅)

**问题描述**: avgPassRate被嵌套在quality对象中，前端期望在顶层

**修复前结构**:
```json
{
  "quality": {
    "avgPassRate": 98.5
  }
}
```

**修复后结构**:
```json
{
  "avgPassRate": 98.5,  // ✅ 提升到顶层
  "quality": {
    // 其他质检数据
  }
}
```

**修复代码**:
```java
// 提升avgPassRate到顶层
dashboardData.setAvgPassRate(qualityData.getAvgPassRate());
```

---

## 核心业务逻辑

### JWT Token生命周期

**Token类型**:
1. **accessToken**: 访问令牌，24小时有效期
2. **refreshToken**: 刷新令牌，7天有效期
3. **tempToken**: 临时令牌，5-10分钟有效期（用于注册、重置密码）
4. **resetToken**: 重置令牌，5分钟有效期（用于重置密码）

**Token刷新流程** (Rotating Refresh Token):
```
用户持有: accessToken(T1) + refreshToken(R1)
         ↓ accessToken过期
使用refreshToken(R1)刷新
         ↓
获得新Token: accessToken(T2) + refreshToken(R2)
旧Token失效: refreshToken(R1)立即加入黑名单
```

**Token黑名单** (Redis):
- Key: `token:blacklist:${tokenId}`
- TTL: Token原有效期
- 用途: 登出、密码修改、设备移除时使Token失效

### 移动端数据同步策略

**同步模式**:
1. **实时同步**: 在线时每个操作立即同步到服务器
2. **定时同步**: 每5分钟自动同步一次（后台运行）
3. **手动同步**: 用户手动触发同步
4. **离线模式**: 本地SQLite存储，网络恢复后自动同步

**冲突解决策略**:
- **SERVER_WINS** (默认): 服务器版本覆盖本地
- **CLIENT_WINS**: 本地版本覆盖服务器（需要管理员权限）
- **MANUAL**: 提示用户手动选择

**同步优先级**:
1. 高优先级: 批次数据、质检记录、考勤记录
2. 中优先级: 用户信息、设备信息
3. 低优先级: 配置、统计数据

### 文件上传优化

**移动端优化措施**:
1. **图片压缩**:
   - 宽度限制: 最大1920px
   - 质量: 80%
   - 格式: JPEG
2. **生成缩略图**: 200x200px
3. **断点续传**: 支持大文件分片上传
4. **队列管理**: 失败文件自动重试3次
5. **本地缓存**: 上传成功后的URL缓存到本地

---

## 数据模型

### MobileDTO类定义

**LoginRequest**:
```typescript
interface LoginRequest {
  username: string;
  password: string;
  factoryId?: string;
  deviceId?: string;
  deviceInfo?: DeviceInfo;
}
```

**LoginResponse**:
```typescript
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDTO;
}
```

**DashboardData**:
```typescript
interface DashboardData {
  todayOutput: number;
  completedBatches: number;      // P1-1修复
  activeBatches: number;
  avgPassRate: number;           // P1-2修复
  pendingQualityInspections: number;
  activeAlerts: number;
  todayAttendance: {
    present: number;
    total: number;
    rate: number;
  };
  recentBatches: BatchSummary[];
  summary: EquipmentSummary;
}
```

**UploadResponse**:
```typescript
interface UploadResponse {
  uploadedFiles: {
    fileId: string;
    fileName: string;
    fileUrl: string;
    thumbnailUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  }[];
  totalSize: number;
  count: number;
}
```

---

## 总结

### 端点概览

**认证与账户** (13端点):
- 核心认证: 3个 (统一登录、刷新、登出) ✅ E2E验证
- 密码管理: 5个
- 注册流程: 3个
- 工具接口: 2个

**移动端功能** (10端点):
- 文件上传: 1个
- 仪表盘: 1个 ✅ E2E验证
- 数据同步: 2个
- 推送通知: 2个
- 设备管理: 2个
- 版本配置: 2个

**业务数据** (8端点):
- 人员报表: 4个
- 成本对比: 1个
- 用户反馈: 1个
- 监控上报: 2个

**设备告警** (5端点):
- 已记录在 [EquipmentController](./PRD-API-EquipmentController.md)

**总计**: 36个端点

### E2E测试覆盖

- ✅ Dashboard E2E: 24/24 (100%)
- ✅ Authentication: 部分验证通过

### 关键业务价值

1. **统一认证**: 平台用户和工厂用户统一登录入口
2. **移动端优化**: 文件上传、数据同步、离线模式
3. **完整的Dashboard**: 实时业务概览
4. **人员管理**: 工时、考勤、绩效统计
5. **成本分析**: 批次成本对比支持AI分析
6. **应用监控**: 崩溃日志、性能数据上报

### 文档链接

- **主文档**: [PRD-API端点完整文档-v3.0.md](./PRD-API端点完整文档-v3.0.md) (超详细8维度)
- **API索引**: [PRD-API索引文档-v1.0.md](./PRD-API索引文档-v1.0.md) (导航中心)
- **其他Controller**:
  - [ProcessingController](./PRD-API-ProcessingController.md) (23端点)
  - [MaterialBatchController](./PRD-API-MaterialBatchController.md) (25端点)
  - [EquipmentController](./PRD-API-EquipmentController.md) (30端点，含设备告警)

---

**文档生成时间**: 2025-11-20
**生成者**: Claude Code
**版本**: v1.0
**总字数**: ~18,000字
