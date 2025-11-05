# Cretas食品溯源系统 - 移动端API专用指南

**适用范围**: React Native移动应用开发（Phase 1-3）
**服务器地址**: http://47.251.121.76:10010/
**认证方式**: Bearer Token (JWT)
**前端集成状态**: ✅ 已全部集成

---

## 📱 移动端API概览

本文档专注于移动端专用的**14个独立API接口**（21个API中，7个认证API已在authService.ts实现），这些接口针对React Native应用优化，提供：

- 🔐 统一认证和注册流程（已在authService.ts实现）
- 📱 设备激活和管理
- 📤 文件上传优化
- 🔄 离线数据同步
- 🔔 推送通知
- 📊 性能监控和崩溃上报

**重要提示**：本文档中的认证相关API（7个）已在 `authService.ts` 中实现，无需重复创建。

## 📑 API分类目录

### 🔐 认证相关 (7个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/mobile/auth/logout` | 用户登出 |
| `POST` | `/api/mobile/auth/refresh` | 刷新访问令牌 |
| `POST` | `/api/mobile/auth/register-phase-one` | 移动端注册-第一阶段（验证手机号） |
| `POST` | `/api/mobile/auth/register-phase-two` | 移动端注册-第二阶段（创建账户） |
| `POST` | `/api/mobile/auth/send-code` | 发送验证码 |
| `POST` | `/api/mobile/auth/unified-login` | 统一登录接口 |
| `POST` | `/api/mobile/auth/verify-code` | 验证手机验证码 |

### 📱 设备管理 (3个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/mobile/activation/activate` | 设备激活 |
| `GET` | `/api/mobile/devices` | 获取用户设备列表 |
| `DELETE` | `/api/mobile/devices/{deviceId}` | 移除设备 |

### 📤 文件上传 (1个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/mobile/upload` | 移动端文件上传 |

### 🔄 数据同步 (2个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/offline/{factoryId}` | 获取离线数据包 |
| `POST` | `/api/mobile/sync/{factoryId}` | 数据同步 |

### 🔔 推送通知 (2个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/mobile/push/register` | 注册推送通知 |
| `DELETE` | `/api/mobile/push/unregister` | 取消推送通知注册 |

### ⚙️ 系统监控 (4个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/health` | 健康检查 |
| `POST` | `/api/mobile/report/crash` | 上报崩溃日志 |
| `POST` | `/api/mobile/report/performance` | 上报性能数据 |
| `GET` | `/api/mobile/version/check` | 检查应用版本 |

### 📊 配置和仪表盘 (2个)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mobile/config/{factoryId}` | 获取移动端配置 |
| `GET` | `/api/mobile/dashboard/{factoryId}` | 获取仪表盘数据 |

---

## 🔐 认证相关

### POST /api/mobile/auth/logout

**功能**: 用户登出

#### 请求参数

**查询参数**:

- `deviceId` (string) **[可选]**: 设备ID

#### 响应

**200 OK**:

返回类型: `ApiResponse«Void»`

详见 [数据模型: ApiResponse«Void»](./api-models.md#apiresponse«void»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/auth/refresh

**功能**: 刷新访问令牌

#### 请求参数

**查询参数**:

- `refreshToken` (string) **[可选]**: 刷新令牌

#### 响应

**200 OK**:

返回类型: `ApiResponse«LoginResponse»`

详见 [数据模型: ApiResponse«LoginResponse»](./api-models.md#apiresponse«loginresponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/auth/register-phase-one

**功能**: 移动端注册-第一阶段（验证手机号）

#### 请求参数

**请求体**:

- `request` **[必填]**: RegisterPhaseOneRequest
  - request

  详见 [数据模型: RegisterPhaseOneRequest](./api-models.md#registerphaseonerequest)

#### 响应

**200 OK**:

返回类型: `ApiResponse«RegisterPhaseOneResponse»`

详见 [数据模型: ApiResponse«RegisterPhaseOneResponse»](./api-models.md#apiresponse«registerphaseoneresponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

#### React Native 使用示例

```typescript
// 注册第一阶段：验证手机号
const handlePhaseOne = async (phoneNumber: string, code: string) => {
  const result = await authService.registerPhaseOne({
    phoneNumber,
    verificationCode: code,
    factoryId: 'FAC001',
    deviceInfo: await getDeviceInfo()
  });
  
  // 保存临时token用于第二阶段
  await AsyncStorage.setItem('tempToken', result.tempToken);
  
  return result;
};
```

---

### POST /api/mobile/auth/register-phase-two

**功能**: 移动端注册-第二阶段（创建账户）

#### 请求参数

**请求体**:

- `request` **[必填]**: RegisterPhaseTwoRequest
  - request

  详见 [数据模型: RegisterPhaseTwoRequest](./api-models.md#registerphasetworequest)

#### 响应

**200 OK**:

返回类型: `ApiResponse«RegisterPhaseTwoResponse»`

详见 [数据模型: ApiResponse«RegisterPhaseTwoResponse»](./api-models.md#apiresponse«registerphasetworesponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/auth/send-code

**功能**: 发送验证码

#### 请求参数

**查询参数**:

- `phoneNumber` (string) **[可选]**: 手机号

#### 响应

**200 OK**:

返回类型: `ApiResponse«boolean»`

详见 [数据模型: ApiResponse«boolean»](./api-models.md#apiresponse«boolean»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/auth/unified-login

**功能**: 统一登录接口

#### 请求参数

**请求体**:

- `request` **[必填]**: LoginRequest
  - request

  详见 [数据模型: LoginRequest](./api-models.md#loginrequest)

#### 响应

**200 OK**:

返回类型: `ApiResponse«LoginResponse»`

详见 [数据模型: ApiResponse«LoginResponse»](./api-models.md#apiresponse«loginresponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

#### React Native 使用示例

```typescript
import { authService } from '@/services/authService';

// 统一登录
const handleLogin = async (username: string, password: string) => {
  try {
    const result = await authService.unifiedLogin({
      username,
      password,
      factoryId: 'FAC001', // 可选
      deviceInfo: {
        deviceId: await getDeviceId(),
        deviceType: Platform.OS,
        model: await getDeviceModel(),
        osVersion: Platform.Version,
      }
    });
    
    // 保存token和用户信息
    await authStore.setAuth(result);
    
    return result;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
};
```

---

### POST /api/mobile/auth/verify-code

**功能**: 验证手机验证码

#### 请求参数

**查询参数**:

- `phoneNumber` (string) **[可选]**: 手机号
- `code` (string) **[可选]**: 验证码

#### 响应

**200 OK**:

返回类型: `ApiResponse«boolean»`

详见 [数据模型: ApiResponse«boolean»](./api-models.md#apiresponse«boolean»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

## 📱 设备管理

### POST /api/mobile/activation/activate

**功能**: 设备激活

#### 请求参数

**请求体**:

- `request` **[必填]**: ActivationRequest
  - request

  详见 [数据模型: ActivationRequest](./api-models.md#activationrequest)

#### 响应

**200 OK**:

返回类型: `ApiResponse«ActivationResponse»`

详见 [数据模型: ApiResponse«ActivationResponse»](./api-models.md#apiresponse«activationresponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

#### React Native 使用示例

```typescript
// 设备激活
const handleActivation = async (code: string) => {
  const result = await activationService.activate({
    activationCode: code,
    deviceInfo: await getDeviceInfo()
  });
  
  if (result.success) {
    // 保存激活状态和配置
    await activationStore.setActivation(result);
  }
  
  return result;
};
```

---

### GET /api/mobile/devices

**功能**: 获取用户设备列表

#### 响应

**200 OK**:

返回类型: `ApiResponse«List«DeviceInfo»»`

详见 [数据模型: ApiResponse«List«DeviceInfo»»](./api-models.md#apiresponse«list«deviceinfo»»)

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### DELETE /api/mobile/devices/{deviceId}

**功能**: 移除设备

#### 请求参数

**路径参数**:

- `deviceId` (string) **[可选]**: 设备ID

#### 响应

**200 OK**:

返回类型: `ApiResponse«Void»`

详见 [数据模型: ApiResponse«Void»](./api-models.md#apiresponse«void»)

**204 No Content**

**401 Unauthorized**

**403 Forbidden**

---

## 📤 文件上传

### POST /api/mobile/upload

**功能**: 移动端文件上传

#### 请求参数

**查询参数**:

- `files` (array) **[必填]**: files
- `category` (string) **[可选]**: 文件分类
- `metadata` (string) **[可选]**: 元数据

#### 响应

**200 OK**:

返回类型: `ApiResponse«UploadResponse»`

详见 [数据模型: ApiResponse«UploadResponse»](./api-models.md#apiresponse«uploadresponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

## 🔄 数据同步

### GET /api/mobile/offline/{factoryId}

**功能**: 获取离线数据包

#### 请求参数

**路径参数**:

- `factoryId` (string) **[可选]**: 工厂ID

#### 响应

**200 OK**:

返回类型: `ApiResponse«OfflineDataPackage»`

详见 [数据模型: ApiResponse«OfflineDataPackage»](./api-models.md#apiresponse«offlinedatapackage»)

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/sync/{factoryId}

**功能**: 数据同步

#### 请求参数

**路径参数**:

- `factoryId` (string) **[可选]**: 工厂ID

**请求体**:

- `request` **[必填]**: SyncRequest
  - request

  详见 [数据模型: SyncRequest](./api-models.md#syncrequest)

#### 响应

**200 OK**:

返回类型: `ApiResponse«SyncResponse»`

详见 [数据模型: ApiResponse«SyncResponse»](./api-models.md#apiresponse«syncresponse»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

## 🔔 推送通知

### POST /api/mobile/push/register

**功能**: 注册推送通知

#### 请求参数

**请求体**:

- `registration` **[必填]**: PushRegistration
  - registration

  详见 [数据模型: PushRegistration](./api-models.md#pushregistration)

#### 响应

**200 OK**:

返回类型: `ApiResponse«Void»`

详见 [数据模型: ApiResponse«Void»](./api-models.md#apiresponse«void»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### DELETE /api/mobile/push/unregister

**功能**: 取消推送通知注册

#### 请求参数

**查询参数**:

- `deviceToken` (string) **[可选]**: 设备令牌

#### 响应

**200 OK**:

返回类型: `ApiResponse«Void»`

详见 [数据模型: ApiResponse«Void»](./api-models.md#apiresponse«void»)

**204 No Content**

**401 Unauthorized**

**403 Forbidden**

---

## ⚙️ 系统监控

### GET /api/mobile/health

**功能**: 健康检查

#### 响应

**200 OK**:

返回类型: `ApiResponse«Map«string,object»»`

详见 [数据模型: ApiResponse«Map«string,object»»](./api-models.md#apiresponse«map«string,object»»)

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/report/crash

**功能**: 上报崩溃日志

#### 请求参数

**请求体**:


#### 响应

**200 OK**:

返回类型: `ApiResponse«Void»`

详见 [数据模型: ApiResponse«Void»](./api-models.md#apiresponse«void»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### POST /api/mobile/report/performance

**功能**: 上报性能数据

#### 请求参数

**请求体**:


#### 响应

**200 OK**:

返回类型: `ApiResponse«Void»`

详见 [数据模型: ApiResponse«Void»](./api-models.md#apiresponse«void»)

**201 Created**

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### GET /api/mobile/version/check

**功能**: 检查应用版本

#### 请求参数

**查询参数**:

- `currentVersion` (string) **[可选]**: 当前版本
- `platform` (string) **[可选]**: 平台

#### 响应

**200 OK**:

返回类型: `ApiResponse«VersionCheckResponse»`

详见 [数据模型: ApiResponse«VersionCheckResponse»](./api-models.md#apiresponse«versioncheckresponse»)

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

## 📊 配置和仪表盘

### GET /api/mobile/config/{factoryId}

**功能**: 获取移动端配置

#### 请求参数

**路径参数**:

- `factoryId` (string) **[可选]**: 工厂ID

**查询参数**:

- `platform` (string) **[可选]**: 平台

#### 响应

**200 OK**:

返回类型: `ApiResponse«object»`

详见 [数据模型: ApiResponse«object»](./api-models.md#apiresponse«object»)

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---

### GET /api/mobile/dashboard/{factoryId}

**功能**: 获取仪表盘数据

#### 请求参数

**路径参数**:

- `factoryId` (string) **[可选]**: 工厂ID

#### 响应

**200 OK**:

返回类型: `ApiResponse«DashboardData»`

详见 [数据模型: ApiResponse«DashboardData»](./api-models.md#apiresponse«dashboarddata»)

**401 Unauthorized**

**403 Forbidden**

**404 Not Found**

---


## 📚 最佳实践

### 认证流程

1. **首次使用**: 设备激活 → 手机号注册/登录
2. **后续使用**: 自动登录（本地token） / 生物识别登录
3. **Token刷新**: 在accessToken过期前使用refreshToken刷新

### 错误处理

```typescript
// 统一错误处理
try {
  const result = await apiCall();
} catch (error) {
  if (error.code === 'TOKEN_EXPIRED') {
    // 尝试刷新token
    await refreshToken();
  } else if (error.code === 'NETWORK_ERROR') {
    // 离线模式
    await useOfflineMode();
  } else {
    // 显示错误消息
    showError(error.message);
  }
}
```

### 离线支持

1. **定期同步**: 使用 `/api/mobile/sync/{factoryId}` 同步数据
2. **离线数据包**: 使用 `/api/mobile/offline/{factoryId}` 下载离线数据
3. **本地存储**: 使用AsyncStorage/SQLite缓存关键数据

### 性能优化

1. **图片上传**: 使用 `/api/mobile/upload` 并在上传前压缩
2. **批量操作**: 尽量使用批量API减少请求次数
3. **缓存策略**: 实现合理的缓存策略（5分钟缓存相似查询）

---

## 🔗 相关文档

- [完整API参考文档](./swagger-api-reference.md)
- [API数据模型字典](./api-models.md)
- [项目开发指南](../../CLAUDE.md)

---

**Swagger文档地址**: http://47.251.121.76:10010/swagger-ui.html
