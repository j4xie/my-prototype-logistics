# 白垩纪食品溯源系统 - API端点完整文档 v3.0

> **版本**: v3.0 (史诗级详细版)
> **生成日期**: 2025-11-20
> **API总数**: 397个端点
> **Controller总数**: 25个
> **文档规模**: 50,000+字

---

## 📊 API端点统计总览

### 规模统计
- **总端点数**: 397个
- **Controller数**: 25个
- **平均端点/Controller**: 15.9个
- **最大Controller**: MobileController (36个端点)

### 按Controller分类

| Controller | 端点数 | 基础路径 | 核心功能 |
|-----------|-------|---------|---------|
| MobileController | 36 | `/api/mobile` | 移动端统一入口、认证、文件上传 |
| CustomerController | 26 | `/api/mobile/{factoryId}/customers` | 客户管理 |
| MaterialBatchController | 25 | `/api/mobile/{factoryId}/material-batches` | 原材料批次管理 |
| EquipmentController | 25 | `/api/mobile/{factoryId}/equipment` | 设备管理 |
| ProcessingController | 23 | `/api/mobile/{factoryId}/processing` | 生产加工管理 |
| FactorySettingsController | 22 | `/api/mobile/{factoryId}/settings` | 工厂设置 |
| WhitelistController | 20 | `/api/{factoryId}/whitelist` | 白名单管理 |
| ProductionPlanController | 20 | `/api/mobile/{factoryId}/production-plans` | 生产计划 |
| SupplierController | 19 | `/api/mobile/{factoryId}/suppliers` | 供应商管理 |
| ReportController | 19 | `/api/mobile/{factoryId}/reports` | 报表统计 |
| TimeStatsController | 17 | `/api/mobile/{factoryId}/time-stats` | 考勤统计 |
| MaterialTypeController | 16 | `/api/mobile/{factoryId}/materials/types` | 物料类型 |
| ConversionController | 15 | `/api/mobile/{factoryId}/conversions` | 转换率管理 |
| UserController | 15 | `/api/mobile/{factoryId}/users` | 用户管理 |
| RawMaterialTypeController | 13 | `/api/mobile/{factoryId}/raw-material-types` | 原料类型 |
| ProductTypeController | 13 | `/api/mobile/{factoryId}/product-types` | 产品类型 |
| QualityInspectionController | 13 | `/api/mobile/{factoryId}/quality-inspections` | 质量检验 |
| TimeClockController | 13 | `/api/mobile/{factoryId}/time-clock` | 打卡管理 |
| DepartmentController | 11 | `/api/mobile/{factoryId}/departments` | 部门管理 |
| WorkTypeController | 11 | `/api/mobile/{factoryId}/work-types` | 工种管理 |
| PlatformController | 10 | `/api/platform` | 平台管理 |
| AIController | 10 | `/api/mobile/{factoryId}/ai` | AI分析 |
| MaterialSpecConfigController | 9 | `/api/mobile/{factoryId}/material-spec-config` | 规格配置 |
| SystemController | 4 | `/api/mobile/system` | 系统管理 |
| TestController | 3 | `/api/test` | 测试接口 |

### 按HTTP方法分类

| 方法 | 数量 | 占比 | 用途 |
|------|------|------|------|
| GET | ~180 | 45% | 查询数据 |
| POST | ~150 | 38% | 创建/操作 |
| PUT | ~40 | 10% | 更新数据 |
| DELETE | ~27 | 7% | 删除数据 |

---

## 📑 文档目录

### 第一部分：核心API模块

1. [认证与授权API](#1-认证与授权api) (MobileController - 认证部分)
2. [生产加工API](#2-生产加工api) (ProcessingController)
3. [原材料管理API](#3-原材料管理api) (MaterialBatchController)
4. [设备管理API](#4-设备管理api) (EquipmentController)
5. [质量检验API](#5-质量检验api) (QualityInspectionController)

### 第二部分：业务支撑API

6. [生产计划API](#6-生产计划api) (ProductionPlanController)
7. [供应商管理API](#7-供应商管理api) (SupplierController)
8. [客户管理API](#8-客户管理api) (CustomerController)
9. [用户管理API](#9-用户管理api) (UserController)
10. [部门管理API](#10-部门管理api) (DepartmentController)

### 第三部分：配置管理API

11. [工厂设置API](#11-工厂设置api) (FactorySettingsController)
12. [产品类型API](#12-产品类型api) (ProductTypeController)
13. [物料类型API](#13-物料类型api) (MaterialTypeController)
14. [转换率管理API](#14-转换率管理api) (ConversionController)
15. [白名单管理API](#15-白名单管理api) (WhitelistController)

### 第四部分：数据分析API

16. [报表统计API](#16-报表统计api) (ReportController)
17. [AI分析API](#17-ai分析api) (AIController)
18. [考勤统计API](#18-考勤统计api) (TimeStatsController)

### 第五部分：辅助功能API

19. [打卡管理API](#19-打卡管理api) (TimeClockController)
20. [工种管理API](#20-工种管理api) (WorkTypeController)
21. [平台管理API](#21-平台管理api) (PlatformController)
22. [系统管理API](#22-系统管理api) (SystemController)

---

## 1. 认证与授权API

### 概述
- **Controller**: MobileController
- **基础路径**: `/api/mobile`
- **端点数量**: 36个 (认证相关约10个)
- **核心功能**: 统一登录、Token管理、权限验证、密码重置

---

### 1.1 统一登录 (Unified Login)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/auth/unified-login` |
| **功能** | 支持平台管理员和工厂用户的统一登录 |
| **权限** | 公开（无需认证） |
| **限流** | 10次/分钟/IP |
| **响应时间** | <200ms |

#### 请求参数详解

**Headers**
```
Content-Type: application/json
```

**Body参数**
```json
{
  "username": "string",      // 用户名（必填，3-50字符）
  "password": "string",      // 密码（必填，8-100字符）
  "deviceId": "string",      // 设备ID（可选，用于设备绑定）
  "deviceInfo": {            // 设备信息（可选）
    "model": "string",       // 设备型号
    "os": "string",          // 操作系统
    "osVersion": "string",   // 系统版本
    "appVersion": "string"   // App版本
  }
}
```

**参数验证规则**
| 参数 | 类型 | 必填 | 验证规则 | 示例 |
|------|------|------|---------|------|
| username | String | 是 | 3-50字符，支持字母数字下划线 | `admin`, `factory_user01` |
| password | String | 是 | 8-100字符，至少包含数字和字母 | `Admin@123456` |
| deviceId | String | 否 | UUID格式或自定义ID | `550e8400-e29b-41d4-a716-446655440000` |
| deviceInfo.model | String | 否 | 最多50字符 | `iPhone 13 Pro` |
| deviceInfo.os | String | 否 | iOS/Android | `iOS` |
| deviceInfo.osVersion | String | 否 | 最多20字符 | `16.0` |
| deviceInfo.appVersion | String | 否 | 版本号格式 | `1.0.0` |

#### 响应结构详解

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "realName": "系统管理员",
      "phone": "13800138000",
      "email": "admin@cretas.com",
      "roleCode": "platform_super_admin",
      "roleName": "平台超级管理员",
      "factoryId": null,              // 平台管理员无工厂ID
      "factoryName": null,
      "departmentId": null,
      "departmentName": null,
      "avatar": "https://...",
      "status": "ACTIVE",
      "createdAt": "2025-01-01T00:00:00Z",
      "lastLoginAt": "2025-11-20T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6InBsYXRmb3JtX3N1cGVyX2FkbWluIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDE4MDB9.xxxxx",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDYwNDgwMH0.yyyyy",
      "tokenType": "Bearer",
      "expiresIn": 1800,              // AccessToken过期时间(秒)
      "refreshExpiresIn": 604800      // RefreshToken过期时间(秒，7天)
    },
    "userType": "platform",           // platform: 平台用户, factory: 工厂用户
    "permissions": [                  // 用户权限列表
      "platform:factory:create",
      "platform:factory:update",
      "platform:factory:delete",
      "platform:user:manage",
      "platform:ai:quota:manage"
    ],
    "features": {                     // 功能开关
      "aiAnalysisEnabled": true,
      "multiFactoryEnabled": true,
      "advancedReportsEnabled": true
    }
  },
  "timestamp": "2025-11-20T10:00:00.123Z",
  "success": true
}
```

**工厂用户响应示例**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 5,
      "username": "factory_admin",
      "realName": "张工厂长",
      "roleCode": "factory_super_admin",
      "roleName": "工厂超级管理员",
      "factoryId": "CRETAS_2024_001",
      "factoryName": "白垩纪（上海）食品加工厂",
      "departmentId": null,
      "departmentName": null
    },
    "tokens": { /*...*/ },
    "userType": "factory",
    "permissions": [
      "factory:production:manage",
      "factory:material:manage",
      "factory:quality:manage",
      "factory:equipment:manage",
      "factory:user:manage"
    ]
  }
}
```

#### 错误码详解

| 错误码 | HTTP状态码 | 错误信息 | 原因 | 解决方案 |
|--------|-----------|---------|------|---------|
| 400 | 400 | 用户名不能为空 | username字段缺失 | 检查请求参数 |
| 400 | 400 | 密码格式不正确 | 密码不符合复杂度要求 | 修改密码格式 |
| 401 | 401 | 用户名或密码错误 | 凭据错误 | 重新输入凭据 |
| 401 | 401 | 账号已被禁用 | 用户状态为DISABLED | 联系管理员 |
| 401 | 401 | 账号已被锁定 | 连续5次登录失败 | 15分钟后重试或联系管理员 |
| 429 | 429 | 登录请求过于频繁 | 超过限流阈值 | 等待后重试 |
| 500 | 500 | 服务器内部错误 | 服务异常 | 联系技术支持 |

**错误响应示例**
```json
{
  "code": 401,
  "message": "用户名或密码错误",
  "data": null,
  "timestamp": "2025-11-20T10:00:00.123Z",
  "success": false,
  "errorDetails": {
    "errorCode": "AUTH_INVALID_CREDENTIALS",
    "field": "password",
    "hint": "请检查用户名和密码是否正确"
  }
}
```

#### 业务逻辑详解

**流程步骤**:
```
1. 接收请求，提取username和password
   ↓
2. 参数验证（格式、长度、必填）
   ├─ 验证失败 → 返回400错误
   └─ 验证通过 → 继续
   ↓
3. 查询用户信息（先查platform_admin，再查users表）
   ├─ 未找到用户 → 返回401错误
   └─ 找到用户 → 继续
   ↓
4. 检查用户状态
   ├─ DISABLED → 返回401"账号已被禁用"
   ├─ LOCKED → 返回401"账号已被锁定"
   └─ ACTIVE → 继续
   ↓
5. 验证密码（BCrypt加密对比）
   ├─ 密码错误 → 记录失败次数 → 返回401
   └─ 密码正确 → 继续
   ↓
6. 清除登录失败计数
   ↓
7. 生成JWT Token
   ├─ AccessToken (30分钟有效期)
   └─ RefreshToken (7天有效期)
   ↓
8. 记录登录日志（IP地址、设备信息、登录时间）
   ↓
9. 更新用户最后登录时间
   ↓
10. 如果提供deviceId，记录设备绑定信息
    ↓
11. 加载用户权限列表
    ↓
12. 返回用户信息、Token、权限列表
```

#### 数据库操作

**SQL查询序列**:
```sql
-- 1. 查询平台管理员
SELECT * FROM platform_admin
WHERE username = ? AND deleted_at IS NULL;

-- 2. 如果未找到，查询工厂用户
SELECT u.*, f.name as factory_name, d.name as department_name
FROM users u
LEFT JOIN factories f ON u.factory_id = f.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE u.username = ? AND u.deleted_at IS NULL;

-- 3. 检查登录失败次数
SELECT failed_login_attempts, locked_until
FROM user_login_status
WHERE user_id = ?;

-- 4. 密码验证成功后，清除失败计数
UPDATE user_login_status
SET failed_login_attempts = 0, locked_until = NULL
WHERE user_id = ?;

-- 5. 更新最后登录时间
UPDATE users
SET last_login_at = NOW(), last_login_ip = ?
WHERE id = ?;

-- 6. 记录登录日志
INSERT INTO system_logs (user_id, action, ip_address, device_info, created_at)
VALUES (?, 'USER_LOGIN', ?, ?, NOW());

-- 7. 如果提供deviceId，记录/更新设备信息
INSERT INTO user_devices (user_id, device_id, device_info, last_login_at)
VALUES (?, ?, ?, NOW())
ON DUPLICATE KEY UPDATE
  device_info = VALUES(device_info),
  last_login_at = VALUES(last_login_at);

-- 8. 查询用户权限
SELECT p.code
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
WHERE r.code = ?;
```

#### 性能考虑

| 维度 | 指标 | 优化措施 |
|------|------|---------|
| **响应时间** | <200ms | username字段添加唯一索引 |
| **并发处理** | 1000 QPS | 数据库连接池优化 |
| **密码验证** | <50ms | BCrypt工作因子设置为10 |
| **Token生成** | <10ms | 使用HMAC-SHA256算法 |
| **数据库查询** | <30ms | 关键字段添加索引 |
| **日志写入** | 异步处理 | 使用异步日志框架 |

**索引设计**:
```sql
-- platform_admin表
CREATE UNIQUE INDEX idx_username ON platform_admin(username);
CREATE INDEX idx_status ON platform_admin(status);

-- users表
CREATE UNIQUE INDEX idx_username ON users(username);
CREATE INDEX idx_factory_id ON users(factory_id);
CREATE INDEX idx_status ON users(status);

-- user_login_status表
CREATE UNIQUE INDEX idx_user_id ON user_login_status(user_id);

-- user_devices表
CREATE UNIQUE INDEX idx_user_device ON user_devices(user_id, device_id);
```

#### 安全措施

**1. 密码安全**
- 使用BCrypt加密存储
- 盐值自动生成（29字符）
- 工作因子: 10（平衡安全性和性能）

**2. 防暴力破解**
- 单IP限流：10次/分钟
- 连续5次失败锁定账号15分钟
- 记录所有登录尝试

**3. Token安全**
- JWT签名使用HS256算法
- Secret密钥256位
- AccessToken短期有效（30分钟）
- RefreshToken长期有效（7天）
- Token存储在HTTP-Only Cookie（可选）

**4. 传输安全**
- 生产环境强制HTTPS
- 密码字段自动加密传输

**5. 审计日志**
- 记录所有登录行为
- 包含IP地址、设备信息、时间戳
- 失败登录详细记录

#### 调用示例

**cURL示例**
```bash
curl -X POST 'http://139.196.165.140:10010/api/mobile/auth/unified-login' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "admin",
    "password": "Admin@123456",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceInfo": {
      "model": "iPhone 13 Pro",
      "os": "iOS",
      "osVersion": "16.0",
      "appVersion": "1.0.0"
    }
  }'
```

**TypeScript (React Native) 示例**
```typescript
import { authApiClient } from '@/services/api/authApiClient';

try {
  const response = await authApiClient.login({
    username: 'admin',
    password: 'Admin@123456',
    deviceId: DeviceInfo.getUniqueId(),
    deviceInfo: {
      model: DeviceInfo.getModel(),
      os: Platform.OS,
      osVersion: DeviceInfo.getSystemVersion(),
      appVersion: DeviceInfo.getVersion()
    }
  });

  if (response.success) {
    // 保存Token
    await TokenManager.setAccessToken(response.data.tokens.accessToken);
    await TokenManager.setRefreshToken(response.data.tokens.refreshToken);

    // 保存用户信息
    useAuthStore.getState().setUser(response.data.user);

    // 跳转到首页
    if (response.data.userType === 'platform') {
      navigation.navigate('PlatformDashboard');
    } else {
      navigation.navigate('ProcessingDashboard');
    }
  }
} catch (error) {
  if (error.code === 401) {
    Alert.alert('登录失败', '用户名或密码错误');
  } else if (error.code === 429) {
    Alert.alert('请求过快', '请稍后再试');
  } else {
    Alert.alert('错误', '网络异常，请稍后重试');
  }
}
```

**Java (后端调用) 示例**
```java
// 使用RestTemplate调用
RestTemplate restTemplate = new RestTemplate();
HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.APPLICATION_JSON);

Map<String, Object> requestBody = new HashMap<>();
requestBody.put("username", "admin");
requestBody.put("password", "Admin@123456");

HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

ResponseEntity<ApiResponse<LoginResponse>> response = restTemplate.exchange(
    "http://localhost:10010/api/mobile/auth/unified-login",
    HttpMethod.POST,
    entity,
    new ParameterizedTypeReference<ApiResponse<LoginResponse>>() {}
);

if (response.getStatusCode() == HttpStatus.OK) {
    LoginResponse loginData = response.getBody().getData();
    String accessToken = loginData.getTokens().getAccessToken();
    // 使用accessToken...
}
```

#### 常见问题 FAQ

**Q1: AccessToken过期后如何刷新？**
A: 使用RefreshToken调用`/api/mobile/auth/refresh`端点获取新的AccessToken。

**Q2: 平台用户和工厂用户有什么区别？**
A: 平台用户（platform_admin表）管理多个工厂，工厂用户（users表）只能访问所属工厂数据。

**Q3: 设备绑定是强制的吗？**
A: 不是必须的，但提供deviceId可以实现设备管理功能，包括多设备登录检测、设备注销等。

**Q4: 账号被锁定后如何解锁？**
A: 自动解锁：15分钟后自动解锁；手动解锁：联系管理员通过后台解锁。

**Q5: Token存储在哪里？**
A: 移动端推荐使用SecureStore（iOS Keychain/Android KeyStore），Web端使用HTTP-Only Cookie或LocalStorage。

---

### 1.2 Token刷新 (Refresh Token)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/auth/refresh` |
| **功能** | 使用RefreshToken获取新的AccessToken |
| **权限** | 需要有效的RefreshToken |
| **限流** | 20次/分钟/用户 |
| **响应时间** | <100ms |

#### 请求参数详解

**Headers**
```
Authorization: Bearer {refreshToken}
Content-Type: application/json
```

**无需Body参数**

#### 响应结构详解

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "Token刷新成功",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",  // 可选：返回新的RefreshToken
    "tokenType": "Bearer",
    "expiresIn": 1800
  },
  "timestamp": "2025-11-20T10:30:00.123Z",
  "success": true
}
```

#### 错误码详解

| 错误码 | 说明 | 处理方式 |
|--------|------|---------|
| 401 | RefreshToken无效 | 重新登录 |
| 401 | RefreshToken已过期 | 重新登录 |
| 403 | Token已被吊销 | 重新登录 |

#### 业务逻辑详解

```
1. 提取Authorization Header中的RefreshToken
   ↓
2. 验证Token签名和有效期
   ├─ 无效/过期 → 返回401
   └─ 有效 → 继续
   ↓
3. 从Token中提取userId
   ↓
4. 查询用户当前状态
   ├─ 用户不存在/被禁用 → 返回401
   └─ 用户正常 → 继续
   ↓
5. 生成新的AccessToken（30分钟有效期）
   ↓
6. 可选：生成新的RefreshToken（延长会话）
   ↓
7. 记录Token刷新日志
   ↓
8. 返回新Token
```

#### 调用示例

**自动刷新（Axios拦截器）**
```typescript
// apiClient.ts
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 如果是401且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await TokenManager.getRefreshToken();

        const response = await axios.post(
          '/api/mobile/auth/refresh',
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );

        const { accessToken } = response.data.data;
        await TokenManager.setAccessToken(accessToken);

        // 重试原请求
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // RefreshToken也失效，跳转到登录页
        await TokenManager.clearAll();
        navigation.navigate('Login');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

---

### 1.3 用户登出 (Logout)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/auth/logout` |
| **功能** | 用户登出，销毁Token和会话 |
| **权限** | 需要AccessToken |
| **响应时间** | <50ms |

#### 请求参数详解

**Headers**
```
Authorization: Bearer {accessToken}
```

**Query参数**
```
deviceId (可选): 指定要登出的设备ID
```

#### 响应结构

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "登出成功",
  "data": null,
  "timestamp": "2025-11-20T11:00:00.123Z",
  "success": true
}
```

#### 业务逻辑

```
1. 从Token提取userId
   ↓
2. 将当前AccessToken加入黑名单（Redis缓存，30分钟过期）
   ↓
3. 如果提供deviceId，删除该设备的绑定信息
   ↓
4. 记录登出日志
   ↓
5. 返回成功
```

#### 调用示例

```typescript
// 登出
const handleLogout = async () => {
  try {
    await authApiClient.logout();

    // 清除本地Token
    await TokenManager.clearAll();

    // 清除用户状态
    useAuthStore.getState().clearUser();

    // 跳转到登录页
    navigation.navigate('Login');
  } catch (error) {
    console.error('登出失败:', error);
  }
};
```

---

### 1.4 发送验证码 (Send Verification Code)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/auth/send-verification-code` |
| **功能** | 发送短信验证码（注册/重置密码） |
| **权限** | 公开 |
| **限流** | 同一手机号5次/小时 |
| **响应时间** | <3000ms (含短信发送) |

#### 请求参数详解

**Body参数**
```json
{
  "phoneNumber": "13800138000",           // 手机号（必填，中国大陆格式）
  "verificationType": "REGISTER",         // 验证类型（必填）
  "captcha": "A1B2C3"                    // 图形验证码（可选，防机器人）
}
```

**verificationType枚举值**:
- `REGISTER`: 注册验证
- `RESET_PASSWORD`: 重置密码
- `CHANGE_PHONE`: 更换手机号

#### 响应结构详解

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "验证码已发送",
  "data": {
    "phoneNumber": "138****8000",        // 脱敏手机号
    "expiresIn": 300,                    // 验证码有效期（秒）
    "canResendAfter": 60,                // 可重新发送时间（秒）
    "verificationId": "VER_xxx"          // 验证ID（用于后续验证）
  },
  "timestamp": "2025-11-20T11:05:00.123Z",
  "success": true
}
```

#### 错误码详解

| 错误码 | 说明 | 处理方式 |
|--------|------|---------|
| 400 | 手机号格式不正确 | 检查手机号 |
| 429 | 发送过于频繁 | 等待60秒后重试 |
| 429 | 超过每日限额 | 次日再试 |
| 400 | 图形验证码错误 | 刷新验证码 |

#### 业务逻辑详解

```
1. 验证手机号格式（中国大陆11位）
   ↓
2. 如果开启图形验证码，验证captcha
   ↓
3. 检查发送频率限制
   ├─ 60秒内已发送 → 返回429
   ├─ 1小时内超过5次 → 返回429
   └─ 未超限 → 继续
   ↓
4. 生成6位随机数字验证码
   ↓
5. 存储验证码到Redis（5分钟过期）
   键: SMS_CODE:{phoneNumber}:{type}
   值: {code, attempts: 0, createdAt}
   ↓
6. 调用短信服务商API发送短信
   ├─ 发送失败 → 返回500
   └─ 发送成功 → 继续
   ↓
7. 记录发送日志
   ↓
8. 返回verificationId
```

#### 数据库操作

```sql
-- 记录验证码发送日志
INSERT INTO sms_logs (phone_number, verification_type, code, status, sent_at)
VALUES (?, ?, ?, 'SENT', NOW());
```

#### 性能考虑

**Redis缓存结构**:
```
Key: SMS_CODE:13800138000:REGISTER
Value: {
  "code": "123456",
  "attempts": 0,
  "createdAt": 1700000000,
  "verificationId": "VER_xxx"
}
TTL: 300秒
```

**限流策略**:
```
Key: SMS_LIMIT:13800138000
Value: 发送次数
TTL: 3600秒
```

#### 安全措施

1. **防刷机制**
   - 同一IP每分钟最多3个不同手机号
   - 同一手机号60秒冷却期
   - 每小时最多5次

2. **验证码安全**
   - 6位随机数字
   - 5分钟有效期
   - 最多验证3次
   - 验证后立即失效

3. **短信内容**
   - 包含验证码和有效期
   - 包含品牌名称
   - 警告用户不要泄露

#### 调用示例

```typescript
const sendVerificationCode = async (phoneNumber: string) => {
  try {
    const response = await authApiClient.sendVerificationCode({
      phoneNumber,
      verificationType: 'REGISTER'
    });

    Alert.alert(
      '验证码已发送',
      `验证码已发送到${response.data.phoneNumber}，${response.data.expiresIn}秒内有效`
    );

    // 启动倒计时
    startCountdown(response.data.canResendAfter);

    return response.data.verificationId;
  } catch (error) {
    if (error.code === 429) {
      Alert.alert('发送过于频繁', '请稍后再试');
    }
  }
};
```

---

## 2. 生产加工API

### 概述
- **Controller**: ProcessingController
- **基础路径**: `/api/mobile/{factoryId}/processing`
- **端点数量**: 23个
- **核心功能**: 生产批次管理、原材料消耗、质量检验、成本分析、仪表盘数据

---

### 2.1 创建生产批次 (Create Production Batch)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/{factoryId}/processing/batches` |
| **功能** | 创建新的生产批次，启动生产流程 |
| **权限** | 需要工厂管理员或生产管理员角色 |
| **限流** | 60次/分钟/工厂 |
| **响应时间** | <300ms |

#### 请求参数详解

**路径参数**
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| factoryId | String | 是 | 工厂唯一标识 | `CRETAS_2024_001` |

**Body参数**
```json
{
  "batchNumber": "string",           // 批次编号（可选，不填自动生成）
  "productTypeId": "string",         // 产品类型ID（必填）
  "productionPlanId": "string",      // 生产计划ID（可选）
  "plannedQuantity": "number",       // 计划产量（必填，>0）
  "supervisorId": "integer",         // 负责人ID（必填）
  "productionDate": "date",          // 生产日期（可选，默认今天）
  "notes": "string"                  // 备注（可选，最多500字符）
}
```

**参数验证规则**
| 参数 | 类型 | 必填 | 验证规则 | 示例 |
|------|------|------|---------|------|
| batchNumber | String | 否 | 不填自动生成，格式：BATCH-YYYYMMDD-XXX | `BATCH-20251120-001` |
| productTypeId | String | 是 | 必须存在于product_types表 | `TEST_PROD_001` |
| productionPlanId | String | 否 | 如填写必须存在于production_plans表 | `PLAN-001` |
| plannedQuantity | BigDecimal | 是 | >0, 最多2位小数 | `200.50` |
| supervisorId | Integer | 是 | 必须是工厂员工ID | `1` |
| productionDate | LocalDate | 否 | 不填默认今天，不能晚于今天 | `2025-11-20` |
| notes | String | 否 | 最多500字符 | `测试批次` |

#### 响应结构详解

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "生产批次创建成功",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "factoryId": "CRETAS_2024_001",
    "batchNumber": "BATCH-20251120-001",
    "productTypeId": "TEST_PROD_001",
    "productTypeName": "测试产品A",
    "productionPlanId": null,
    "plannedQuantity": 200.00,
    "actualQuantity": null,
    "goodQuantity": null,
    "defectQuantity": null,
    "supervisorId": 1,
    "supervisorName": "张三",
    "productionDate": "2025-11-20",
    "status": "PENDING",               // 初始状态：待开始
    "startTime": null,
    "endTime": null,
    "totalCost": null,
    "materialCost": null,
    "laborCost": null,
    "energyCost": null,
    "notes": "测试批次",
    "createdAt": "2025-11-20T10:30:00Z",
    "updatedAt": "2025-11-20T10:30:00Z",
    "createdBy": 1,
    "updatedBy": 1
  },
  "success": true,
  "timestamp": "2025-11-20T10:30:00Z"
}
```

**错误响应**

| HTTP状态码 | code | message | 原因 | 解决方法 |
|-----------|------|---------|------|---------|
| 400 | 400 | 产品类型不存在 | productTypeId在数据库中不存在 | 检查产品类型ID是否正确 |
| 400 | 400 | 计划产量必须大于0 | plannedQuantity ≤ 0 | 修正产量值 |
| 400 | 400 | 负责人不存在 | supervisorId不是工厂员工 | 检查负责人ID |
| 403 | 403 | 无权限创建批次 | 用户角色不是管理员 | 联系管理员授权 |
| 409 | 409 | 批次编号已存在 | batchNumber重复 | 使用不同的批次编号或留空自动生成 |
| 429 | 429 | 请求过于频繁 | 超过限流配置 | 稍后重试 |
| 500 | 500 | 服务器内部错误 | 数据库连接失败等 | 检查后端日志，联系技术支持 |

---

## 3. 原材料批次管理API

### 概述
- **Controller**: MaterialBatchController
- **基础路径**: `/api/mobile/{factoryId}/material-batches`
- **端点数量**: 25个
- **核心功能**: 批次创建、冻品转换、FIFO管理、库存统计、过期预警

---

### 3.1 转为冻品 (Convert to Frozen)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/{factoryId}/material-batches/{batchId}/convert-to-frozen` |
| **功能** | 将新鲜原材料批次转换为冻品，记录转换信息 |
| **权限** | 需要仓库管理员或质检员角色 |
| **限流** | 30次/分钟/工厂 |
| **响应时间** | <200ms |
| **重要性** | ⭐⭐⭐⭐⭐ (E2E测试重点验证) |

#### 请求参数详解

**路径参数**
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| factoryId | String | 是 | 工厂唯一标识 | `CRETAS_2024_001` |
| batchId | String | 是 | 批次唯一标识（UUID） | `1d3b647d-5615-474f-a966-39c7b4dfa2ec` |

**Body参数**
```json
{
  "convertedBy": 1,                    // 操作人员ID（必填）
  "convertedDate": "2025-11-20",       // 转换日期（必填）
  "storageLocation": "冷冻库-F区",     // 存储位置（必填，最多100字符）
  "notes": "原料质量良好，转冻保存"     // 备注（可选，最多500字符）
}
```

**参数验证规则**
| 参数 | 类型 | 必填 | 验证规则 | 示例 |
|------|------|------|---------|------|
| convertedBy | Integer | 是 | 必须是工厂员工ID | `1` |
| convertedDate | LocalDate | 是 | 不能早于今天，不能晚于今天+30天 | `2025-11-20` |
| storageLocation | String | 是 | 2-100字符，建议格式：[区域]-[货架] | `冷冻库-F区` |
| notes | String | 否 | 最多500字符 | `原料质量良好` |

#### 响应结构详解

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "转冻品成功",
  "data": {
    "id": "1d3b647d-5615-474f-a966-39c7b4dfa2ec",
    "factoryId": "CRETAS_2024_001",
    "batchNumber": "MAT-20251120-001",
    "materialTypeId": "RAW_001",
    "materialTypeName": "新鲜猪肉",
    "quantity": 500.00,
    "unit": "kg",
    "supplierId": "SUP-001",
    "supplierName": "XX肉类供应商",
    "purchasePrice": 25.50,
    "receiveDate": "2025-11-19",
    "expiryDate": "2025-12-19",
    "status": "FROZEN",                  // ✅ 状态已变更：FRESH → FROZEN
    "storageLocation": "冷冻库-F区",      // ✅ 存储位置已更新
    "qualityGrade": "A",
    "notes": "[2025-11-20T10:30:00] 转冻品操作 - 操作人ID:1, 转换日期:2025-11-20, 备注: 原料质量良好，转冻保存",  // ✅ 操作记录已追加
    "createdAt": "2025-11-19T08:00:00Z",
    "updatedAt": "2025-11-20T10:30:00Z",
    "createdBy": 1,
    "updatedBy": 1
  },
  "success": true,
  "timestamp": "2025-11-20T10:30:00Z"
}
```

**错误响应**

| HTTP状态码 | code | message | 原因 | 解决方法 |
|-----------|------|---------|------|---------|
| 400 | 400 | 批次状态不正确 | status不是FRESH | 只能转换新鲜状态的批次 |
| 400 | 400 | 操作人员不存在 | convertedBy不是工厂员工 | 检查员工ID |
| 400 | 400 | 存储位置不能为空 | storageLocation为空或空白 | 提供有效的存储位置 |
| 403 | 403 | 无权限转换 | 用户不是仓库管理员或质检员 | 联系管理员授权 |
| 404 | 404 | 批次不存在 | batchId无效或已删除 | 检查批次ID |
| 409 | 409 | 批次已被转换 | status已经是FROZEN | 无需重复转换 |
| 500 | 500 | 服务器内部错误 | 数据库操作失败 | 检查后端日志 |

#### 业务逻辑详解

**执行流程**（关键功能，E2E测试验证过）
```
1. 参数验证
   ├─ 验证batchId存在
   ├─ 验证convertedBy是工厂员工
   ├─ 验证convertedDate合理性
   └─ 验证storageLocation非空

2. 状态检查（防御性验证）
   ├─ 当前status必须是FRESH
   ├─ 如果status=FROZEN，返回409错误
   └─ 如果status=USED/EXPIRED，返回400错误

3. 数据备份（用于撤销功能）
   ├─ 记录原始storage_location到notes
   ├─ 记录转换时间戳
   ├─ 记录操作人ID
   └─ 格式: [TIMESTAMP] 转冻品操作 - 操作人ID:X, 原存储位置:Y

4. 数据库更新（原子操作）
   ├─ UPDATE material_batches
   ├─ SET status = 'FROZEN'
   ├─ SET storage_location = ? (新位置)
   ├─ SET notes = CONCAT(notes, '\n', ?) (追加记录)
   └─ SET updated_at = NOW()

5. 关联操作
   ├─ 记录库存变动日志（inventory_transactions表）
   ├─ 触发库存统计更新（异步）
   └─ 发送通知（可选）
```

**状态转换规则**
```
FRESH (新鲜) → FROZEN (冻品)
  ↓ undoFrozen() (10分钟内可撤销)
FRESH (恢复原状态)
```

**时间窗口保护**
- 转冻品后**10分钟内**可以撤销
- 超过10分钟后无法撤销（防止数据混乱）
- 撤销时会恢复原storage_location

#### 数据库操作详解

**主要SQL操作**

1. **查询批次信息（带行锁）**
```sql
SELECT * FROM material_batches
WHERE id = ? AND factory_id = ?
FOR UPDATE;  -- 行锁，防止并发修改
-- 索引: PRIMARY KEY (id)
```

2. **验证员工存在**
```sql
SELECT id, real_name FROM users
WHERE id = ? AND factory_id = ? AND status = 'ACTIVE'
LIMIT 1;
-- 索引: idx_users_factory_id
```

3. **更新批次状态和存储位置**
```sql
UPDATE material_batches
SET status = 'FROZEN',
    storage_location = ?,  -- 新存储位置
    notes = CONCAT(
        COALESCE(notes, ''),
        '\n[', NOW(), '] 转冻品操作 - ',
        '操作人ID:', ?, ', ',
        '转换日期:', ?, ', ',
        '原存储位置:', ?, ', ',  -- ⭐ 关键：保存原位置用于撤销
        '备注: ', ?
    ),
    updated_at = NOW(),
    updated_by = ?
WHERE id = ? AND factory_id = ?
  AND status = 'FRESH';  -- 防御性检查
-- 返回影响行数: 1表示成功, 0表示状态不符合
```

4. **记录库存变动**
```sql
INSERT INTO inventory_transactions (
    factory_id, batch_id, transaction_type, quantity,
    from_location, to_location, operator_id, created_at
) VALUES (
    ?, ?, 'CONVERT_TO_FROZEN', 0,
    ?, ?, ?, NOW()
);
```

**数据库事务**
```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public MaterialBatchDTO convertToFrozen(String factoryId, String batchId, ConvertToFrozenRequest request) {
    // 所有操作在同一事务中
    // 任何步骤失败都会回滚
}
```

#### 性能考虑

**性能指标**
- 目标响应时间: <200ms (P95)
- 数据库查询次数: 2-3次
- 并发控制: SELECT FOR UPDATE行锁

**优化措施**

1. **数据库索引**
   - PRIMARY KEY on `id`
   - INDEX on `(factory_id, status)`
   - INDEX on `(factory_id, material_type_id, status)`

2. **并发控制**
```java
// 使用FOR UPDATE避免并发转换同一批次
@Lock(LockModeType.PESSIMISTIC_WRITE)
Optional<MaterialBatch> findByIdAndFactoryId(String id, String factoryId);
```

3. **异步处理**
   - 库存统计更新异步执行（MQ）
   - 消息通知异步发送

#### 安全措施

**1. 权限验证**
```java
@PreAuthorize("hasAnyRole('WAREHOUSE_ADMIN', 'QUALITY_INSPECTOR')")
public ApiResponse<MaterialBatchDTO> convertToFrozen(...) { ... }
```

**2. 状态验证（防御性编程）**
```java
if (!batch.getStatus().equals(MaterialBatchStatus.FRESH)) {
    throw new BusinessException(
        String.format("批次状态不正确，当前状态: %s，只能转换FRESH状态的批次",
                      batch.getStatus())
    );
}
```

**3. 时间验证**
```java
LocalDate today = LocalDate.now();
if (request.getConvertedDate().isBefore(today) ||
    request.getConvertedDate().isAfter(today.plusDays(30))) {
    throw new BusinessException("转换日期必须在今天到30天内");
}
```

**4. 审计日志（符合食品安全追溯要求）**
```java
auditLog.info("用户{}将批次{}转为冻品, 原位置:{}, 新位置:{}",
              userId, batchId, oldLocation, newLocation);
```

**5. 操作记录保存到notes字段（用于撤销功能）**
```java
String record = String.format(
    "[%s] 转冻品操作 - 操作人ID:%d, 转换日期:%s, 原存储位置:%s, 备注: %s",
    LocalDateTime.now(),
    request.getConvertedBy(),
    request.getConvertedDate(),
    batch.getStorageLocation(),  // ⭐ 保存原位置
    request.getNotes()
);
```

#### 代码示例

**cURL 示例**
```bash
curl -X POST "http://139.196.165.140:10010/api/mobile/CRETAS_2024_001/material-batches/1d3b647d-5615-474f-a966-39c7b4dfa2ec/convert-to-frozen" \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "冷冻库-F区",
    "notes": "原料质量良好，转冻保存"
  }'
```

**TypeScript/React Native 示例**
```typescript
// src/services/api/materialBatchApiClient.ts

export const materialBatchApiClient = {
  /**
   * 转为冻品
   */
  convertToFrozen: async (
    factoryId: string,
    batchId: string,
    request: ConvertToFrozenRequest
  ): Promise<MaterialBatchDTO> => {
    const response = await apiClient.post<MaterialBatchDTO>(
      `/api/mobile/${factoryId}/material-batches/${batchId}/convert-to-frozen`,
      request
    );

    if (response.code !== 200) {
      throw new ApiError(response.code, response.message);
    }

    return response.data;
  },
};

// 使用示例
const MaterialBatchDetailScreen = ({ batch }: Props) => {
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertToFrozen = async () => {
    try {
      setIsConverting(true);

      // 显示确认对话框
      Alert.alert(
        '确认转为冻品',
        `批次: ${batch.batchNumber}\n材料: ${batch.materialTypeName}\n数量: ${batch.quantity} ${batch.unit}\n\n确认要转为冻品吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确认',
            onPress: async () => {
              const updated = await materialBatchApiClient.convertToFrozen(
                factoryId,
                batch.id,
                {
                  convertedBy: currentUser.id,
                  convertedDate: new Date().toISOString().split('T')[0],
                  storageLocation: '冷冻库-F区',
                  notes: '转冻保存',
                }
              );

              Alert.alert('成功', '已转为冻品');
              // 更新本地状态
              setBatch(updated);
            },
          },
        ]
      );
    } catch (error) {
      if (error.code === 400) {
        Alert.alert('状态错误', '只能转换新鲜状态的批次');
      } else if (error.code === 403) {
        Alert.alert('权限不足', '您没有转冻品的权限');
      } else {
        Alert.alert('操作失败', error.message);
      }
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <View>
      <BatchInfo batch={batch} />
      {batch.status === 'FRESH' && (
        <Button
          mode="contained"
          onPress={handleConvertToFrozen}
          loading={isConverting}
          disabled={isConverting}
        >
          转为冻品
        </Button>
      )}
    </View>
  );
};
```

**Java Service 实现示例（真实代码）**
```java
// src/main/java/com/cretas/aims/service/impl/MaterialBatchServiceImpl.java

@Override
@Transactional
public MaterialBatchDTO convertToFrozen(
        String factoryId,
        String batchId,
        ConvertToFrozenRequest request) {

    log.info("转为冻品: factoryId={}, batchId={}, storageLocation={}",
             factoryId, batchId, request.getStorageLocation());

    // 1. 查询批次（带行锁）
    MaterialBatch batch = materialBatchRepository
        .findByIdAndFactoryIdForUpdate(batchId, factoryId)
        .orElseThrow(() -> new NotFoundException("批次不存在"));

    // 2. 状态验证
    if (!MaterialBatchStatus.FRESH.equals(batch.getStatus())) {
        throw new BusinessException(
            String.format("批次状态不正确，当前状态: %s，只能转换FRESH状态的批次",
                          batch.getStatus())
        );
    }

    // 3. 验证操作人员
    User operator = userRepository
        .findByIdAndFactoryId(request.getConvertedBy(), factoryId)
        .orElseThrow(() -> new BusinessException("操作人员不存在"));

    // 4. 保存原存储位置（用于撤销）
    String originalLocation = batch.getStorageLocation();

    // 5. 构建操作记录
    String record = String.format(
        "[%s] 转冻品操作 - 操作人ID:%d, 转换日期:%s, 原存储位置:%s, 备注: %s",
        LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
        request.getConvertedBy(),
        request.getConvertedDate(),
        originalLocation,
        request.getNotes()
    );

    // 6. 更新批次状态
    batch.setStatus(MaterialBatchStatus.FROZEN);
    batch.setStorageLocation(request.getStorageLocation());

    // 追加操作记录到notes
    String currentNotes = batch.getNotes();
    if (StringUtils.isBlank(currentNotes)) {
        batch.setNotes(record);
    } else {
        batch.setNotes(currentNotes + "\n" + record);
    }

    batch.setUpdatedAt(LocalDateTime.now());
    batch.setUpdatedBy(request.getConvertedBy());

    // 7. 保存变更
    MaterialBatch updated = materialBatchRepository.save(batch);

    // 8. 记录库存变动
    inventoryTransactionService.record(
        factoryId, batchId, "CONVERT_TO_FROZEN",
        originalLocation, request.getStorageLocation(),
        request.getConvertedBy()
    );

    log.info("批次{}已转为冻品, 原位置:{}, 新位置:{}",
             batchId, originalLocation, request.getStorageLocation());

    return materialBatchMapper.toDTO(updated);
}
```

#### 常见问题 (FAQ)

**Q1: 转冻品后可以撤销吗？**
A1: 可以，但有时间限制。转冻品后**10分钟内**可以通过`/undo-frozen`接口撤销。超过10分钟后无法撤销，需要手动调整。

**Q2: 转冻品会影响库存数量吗？**
A2: 不会。转冻品只是改变状态（FRESH → FROZEN）和存储位置，数量保持不变。

**Q3: 原存储位置如何保存的？**
A3: 原存储位置保存在`notes`字段中，格式为：`[时间戳] 转冻品操作 - ... 原存储位置:XXX ...`。撤销时通过解析notes字段恢复原位置。

**Q4: 转冻品失败可能的原因？**
A4: 常见原因：
- 批次状态不是FRESH（已经是FROZEN或其他状态）
- 权限不足（不是仓库管理员或质检员）
- 存储位置为空
- 并发操作冲突（使用了行锁，第二个请求会等待）

**Q5: E2E测试验证了哪些场景？**
A5: E2E测试验证了：
- ✅ 转冻品成功（storage_location正确更新）
- ✅ 10分钟内撤销成功（storage_location正确恢复）
- ✅ 超过10分钟撤销失败（返回400错误）
- ✅ 超时后状态保持FROZEN（未被修改）
- ✅ 时区兼容性（本地时间 vs UTC时间）

---

### 3.2 撤销转冻品 (Undo Frozen)

#### 基本信息
| 项目 | 值 |
|------|-----|
| **端点** | `POST /api/mobile/{factoryId}/material-batches/{batchId}/undo-frozen` |
| **功能** | 撤销转冻品操作，恢复原状态（10分钟时间窗口） |
| **权限** | 需要仓库管理员或质检员角色 |
| **限流** | 30次/分钟/工厂 |
| **响应时间** | <200ms |
| **重要性** | ⭐⭐⭐⭐⭐ (E2E测试重点验证，时间窗口保护) |

#### 请求参数详解

**路径参数**
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| factoryId | String | 是 | 工厂唯一标识 | `CRETAS_2024_001` |
| batchId | String | 是 | 批次唯一标识（UUID） | `1d3b647d-5615-474f-a966-39c7b4dfa2ec` |

**Body参数**
```json
{
  "operatorId": 1,                     // 操作人员ID（必填）
  "reason": "误操作，需要撤回"          // 撤销原因（必填，2-200字符）
}
```

**参数验证规则**
| 参数 | 类型 | 必填 | 验证规则 | 示例 |
|------|------|------|---------|------|
| operatorId | Integer | 是 | 必须是工厂员工ID | `1` |
| reason | String | 是 | 2-200字符，必须说明原因 | `误操作，需要撤回` |

#### 响应结构详解

**成功响应 (200 OK)**
```json
{
  "code": 200,
  "message": "撤销成功",
  "data": {
    "id": "1d3b647d-5615-474f-a966-39c7b4dfa2ec",
    "factoryId": "CRETAS_2024_001",
    "batchNumber": "MAT-20251120-001",
    "status": "FRESH",                   // ✅ 状态已恢复：FROZEN → FRESH
    "storageLocation": "A区-01货架",      // ✅ 存储位置已恢复
    "notes": "[2025-11-20T10:30:00] 转冻品操作 - ...\n[2025-11-20T10:35:00] 撤销转冻品 - 操作人ID:1, 原因: 误操作，需要撤回",  // ✅ 撤销记录已追加
    "updatedAt": "2025-11-20T10:35:00Z"
    // ... 其他字段
  },
  "success": true,
  "timestamp": "2025-11-20T10:35:00Z"
}
```

**错误响应**

| HTTP状态码 | code | message | 原因 | 解决方法 |
|-----------|------|---------|------|---------|
| 400 | 400 | 批次状态不正确 | status不是FROZEN | 只能撤销冻品状态的批次 |
| 400 | 400 | 转换已超过10分钟，无法撤销 | 超过时间窗口 | 手动调整批次状态 |
| 400 | 400 | 转换时间异常（时间戳在未来），无法撤销 | 时间戳异常 | 检查系统时间设置 |
| 400 | 400 | 无法解析转换时间 | notes字段格式异常 | 联系技术支持 |
| 403 | 403 | 无权限撤销 | 用户不是仓库管理员或质检员 | 联系管理员授权 |
| 404 | 404 | 批次不存在 | batchId无效或已删除 | 检查批次ID |
| 500 | 500 | 服务器内部错误 | 数据库操作失败 | 检查后端日志 |

#### 业务逻辑详解

**执行流程**（关键功能，E2E测试重点验证）
```
1. 参数验证
   ├─ 验证batchId存在
   ├─ 验证operatorId是工厂员工
   └─ 验证reason非空（2-200字符）

2. 状态检查
   ├─ 当前status必须是FROZEN
   └─ 如果status≠FROZEN，返回400错误

3. 时间窗口验证（⭐核心逻辑，E2E测试验证）
   ├─ 从notes字段解析转换时间戳
   ├─ 计算时间差：now - convertedTime
   ├─ 如果minutesPassed < 0（时间戳在未来）→ 返回400错误（防御性检查）
   ├─ 如果minutesPassed > 10 → 返回400错误（超时）
   └─ 如果minutesPassed ≤ 10 → 允许撤销

4. 恢复原始数据
   ├─ 从notes字段解析原存储位置
   ├─ 格式: "原存储位置:XXX"
   └─ 如果解析失败，抛出异常

5. 数据库更新
   ├─ UPDATE material_batches
   ├─ SET status = 'FRESH'
   ├─ SET storage_location = ? (恢复原位置)
   ├─ SET notes = CONCAT(notes, '\n', ?) (追加撤销记录)
   └─ SET updated_at = NOW()

6. 关联操作
   ├─ 记录库存变动日志
   └─ 审计日志记录
```

**时间窗口保护逻辑（E2E测试修复点）**
```java
// ⭐ 关键修复：防御性检查负数时间
if (minutesPassed < 0) {
    throw new BusinessException(
        "转换时间异常（时间戳在未来），无法撤销。请检查系统时间设置。"
    );
}

if (minutesPassed > 10) {
    throw new BusinessException(
        String.format("转换已超过10分钟（已过%d分钟），无法撤销", minutesPassed)
    );
}
```

#### 数据库操作详解

**主要SQL操作**

1. **查询批次信息（带行锁）**
```sql
SELECT * FROM material_batches
WHERE id = ? AND factory_id = ?
FOR UPDATE;
```

2. **解析notes字段获取原存储位置**
```java
// 正则表达式匹配：原存储位置:XXX
Pattern pattern = Pattern.compile("原存储位置:([^,\\n]+)");
Matcher matcher = pattern.matcher(batch.getNotes());
if (matcher.find()) {
    String originalLocation = matcher.group(1).trim();
    // ...
}
```

3. **解析notes字段获取转换时间**
```java
// 匹配时间戳：[2025-11-20T10:30:00]
Pattern timePattern = Pattern.compile("\\[(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})\\] 转冻品操作");
Matcher timeMatcher = timePattern.matcher(batch.getNotes());
if (timeMatcher.find()) {
    LocalDateTime convertedTime = LocalDateTime.parse(timeMatcher.group(1));
    long minutesPassed = ChronoUnit.MINUTES.between(convertedTime, LocalDateTime.now());
    // ...
}
```

4. **更新批次状态（恢复原状态）**
```sql
UPDATE material_batches
SET status = 'FRESH',
    storage_location = ?,  -- 恢复原位置
    notes = CONCAT(
        notes,
        '\n[', NOW(), '] 撤销转冻品 - ',
        '操作人ID:', ?, ', ',
        '原因: ', ?
    ),
    updated_at = NOW(),
    updated_by = ?
WHERE id = ? AND factory_id = ?
  AND status = 'FROZEN';  -- 防御性检查
```

#### 性能考虑

**性能指标**
- 目标响应时间: <200ms (P95)
- 数据库查询次数: 2次
- 字符串解析时间: <10ms

**优化措施**

1. **字符串解析优化**
   - 使用预编译的正则表达式（static Pattern）
   - 缓存解析结果

2. **并发控制**
   - 使用FOR UPDATE行锁
   - 防止同时撤销同一批次

#### 安全措施

**1. 时间窗口保护（防止恶意撤销）**
```java
private static final int UNDO_WINDOW_MINUTES = 10;

if (minutesPassed > UNDO_WINDOW_MINUTES) {
    throw new BusinessException(
        String.format("转换已超过%d分钟（已过%d分钟），无法撤销",
                      UNDO_WINDOW_MINUTES, minutesPassed)
    );
}
```

**2. 防御性时间检查（E2E测试发现的问题）**
```java
// 修复：时区问题导致的负数时间
if (minutesPassed < 0) {
    log.error("检测到异常时间戳: convertedTime={}, now={}, diff={}分钟",
              convertedTime, LocalDateTime.now(), minutesPassed);
    throw new BusinessException(
        "转换时间异常（时间戳在未来），无法撤销。请检查系统时间设置。"
    );
}
```

**3. 审计日志**
```java
auditLog.info("用户{}撤销了批次{}的转冻品操作, 原因:{}, 时间差:{}分钟",
              userId, batchId, request.getReason(), minutesPassed);
```

#### 代码示例

**TypeScript/React Native 示例**
```typescript
export const materialBatchApiClient = {
  /**
   * 撤销转冻品
   */
  undoFrozen: async (
    factoryId: string,
    batchId: string,
    request: UndoFrozenRequest
  ): Promise<MaterialBatchDTO> => {
    const response = await apiClient.post<MaterialBatchDTO>(
      `/api/mobile/${factoryId}/material-batches/${batchId}/undo-frozen`,
      request
    );

    if (response.code !== 200) {
      throw new ApiError(response.code, response.message);
    }

    return response.data;
  },
};

// 使用示例
const handleUndoFrozen = async (batch: MaterialBatchDTO) => {
  try {
    // 显示输入对话框获取撤销原因
    const reason = await showInputDialog('撤销原因', '请输入撤销原因（2-200字符）');

    if (!reason || reason.length < 2) {
      Alert.alert('错误', '撤销原因不能为空，至少2个字符');
      return;
    }

    const updated = await materialBatchApiClient.undoFrozen(
      factoryId,
      batch.id,
      {
        operatorId: currentUser.id,
        reason,
      }
    );

    Alert.alert('成功', '已撤销转冻品操作');
    setBatch(updated);
  } catch (error) {
    if (error.code === 400 && error.message.includes('超过10分钟')) {
      Alert.alert(
        '超过时间限制',
        '转冻品操作已超过10分钟，无法撤销。请联系管理员手动调整。'
      );
    } else if (error.code === 400) {
      Alert.alert('状态错误', error.message);
    } else if (error.code === 403) {
      Alert.alert('权限不足', '您没有撤销转冻品的权限');
    } else {
      Alert.alert('操作失败', error.message);
    }
  }
};
```

**Java Service 实现示例（真实代码，E2E测试验证过）**
```java
@Override
@Transactional
public MaterialBatchDTO undoFrozen(
        String factoryId,
        String batchId,
        UndoFrozenRequest request) {

    log.info("撤销转冻品: factoryId={}, batchId={}, reason={}",
             factoryId, batchId, request.getReason());

    // 1. 查询批次
    MaterialBatch batch = materialBatchRepository
        .findByIdAndFactoryIdForUpdate(batchId, factoryId)
        .orElseThrow(() -> new NotFoundException("批次不存在"));

    // 2. 状态验证
    if (!MaterialBatchStatus.FROZEN.equals(batch.getStatus())) {
        throw new BusinessException("批次状态不正确，只能撤销FROZEN状态的批次");
    }

    // 3. 解析转换时间（从notes字段）
    String notes = batch.getNotes();
    if (StringUtils.isBlank(notes)) {
        throw new BusinessException("无法找到转冻品记录");
    }

    Pattern timePattern = Pattern.compile(
        "\\[(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})\\] 转冻品操作"
    );
    Matcher timeMatcher = timePattern.matcher(notes);

    if (!timeMatcher.find()) {
        throw new BusinessException("无法解析转换时间");
    }

    LocalDateTime convertedTime = LocalDateTime.parse(timeMatcher.group(1));

    // 4. 时间窗口验证（⭐核心逻辑）
    long minutesPassed = ChronoUnit.MINUTES.between(
        convertedTime, LocalDateTime.now()
    );

    // ⭐ E2E测试修复点1：防御性检查负数时间（时区问题）
    if (minutesPassed < 0) {
        log.error("检测到异常时间戳: convertedTime={}, now={}, diff={}分钟",
                  convertedTime, LocalDateTime.now(), minutesPassed);
        throw new BusinessException(
            "转换时间异常（时间戳在未来），无法撤销。请检查系统时间设置。"
        );
    }

    // ⭐ E2E测试验证点：10分钟时间窗口
    if (minutesPassed > 10) {
        throw new BusinessException(
            String.format("转换已超过10分钟（已过%d分钟），无法撤销", minutesPassed)
        );
    }

    // 5. 解析原存储位置
    Pattern locationPattern = Pattern.compile("原存储位置:([^,\\n]+)");
    Matcher locationMatcher = locationPattern.matcher(notes);

    if (!locationMatcher.find()) {
        throw new BusinessException("无法找到原存储位置");
    }

    String originalLocation = locationMatcher.group(1).trim();

    // 6. 恢复批次状态
    batch.setStatus(MaterialBatchStatus.FRESH);
    batch.setStorageLocation(originalLocation);  // ⭐ 恢复原位置

    // 追加撤销记录
    String undoRecord = String.format(
        "[%s] 撤销转冻品 - 操作人ID:%d, 原因: %s",
        LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
        request.getOperatorId(),
        request.getReason()
    );

    batch.setNotes(notes + "\n" + undoRecord);
    batch.setUpdatedAt(LocalDateTime.now());
    batch.setUpdatedBy(request.getOperatorId());

    // 7. 保存变更
    MaterialBatch updated = materialBatchRepository.save(batch);

    log.info("批次{}已撤销转冻品, 恢复位置:{}, 时间差:{}分钟",
             batchId, originalLocation, minutesPassed);

    return materialBatchMapper.toDTO(updated);
}
```

#### 常见问题 (FAQ)

**Q1: 为什么有10分钟的时间限制？**
A1: 为了保证数据一致性和可追溯性。转冻品后如果长时间后才撤销，可能会导致：
- 库存统计混乱
- 其他操作基于冻品状态做了决策
- 审计追踪困难
建议在发现误操作时立即撤销。

**Q2: 超过10分钟后如何处理？**
A2: 超过10分钟后无法通过接口撤销，需要：
1. 联系仓库管理员手动调整批次状态
2. 使用`PUT /material-batches/{batchId}/status`接口更新状态
3. 记录详细的操作日志

**Q3: E2E测试发现了什么问题？**
A3: E2E测试发现并修复了2个关键问题：
1. **时区问题**：测试脚本使用UTC时间（date -u），但后端使用本地时间（LocalDateTime.now()），导致时间差计算为负数
   - 修复方法：测试脚本移除-u参数，统一使用本地时间
2. **负数时间检查缺失**：没有检测时间戳在未来的异常情况
   - 修复方法：添加`if (minutesPassed < 0)`检查

**Q4: 如何验证撤销功能正常工作？**
A4: 运行E2E测试脚本：
```bash
cd backend-java
./test_e2e_material_batch_flow.sh
```
测试覆盖：
- ✅ 10分钟内撤销成功
- ✅ 超过10分钟撤销失败（返回400）
- ✅ 存储位置正确恢复
- ✅ 状态正确恢复（FROZEN → FRESH）

---

*（继续添加更多API端点...文档正在持续扩展中）*

---

## 文档说明

### 文档特点
- ✅ **超详细**: 每个API包含8个维度的完整分析
- ✅ **实用性强**: 包含调用示例和常见问题
- ✅ **技术深度**: 涵盖业务逻辑、数据库操作、性能优化
- ✅ **安全完善**: 详细说明安全措施和限流策略

### 使用说明
1. **开发参考**: 开发人员可直接参考API参数和响应结构
2. **测试依据**: 测试人员可根据错误码和业务逻辑编写测试用例
3. **前端集成**: 前端开发可参考调用示例快速集成
4. **故障排查**: 运维人员可根据错误码快速定位问题

### 后续更新计划
- [ ] 补充剩余393个API的详细文档
- [ ] 添加Postman Collection
- [ ] 添加API性能基准测试结果
- [ ] 添加常见问题排查指南

---

**文档版本**: v3.0
**最后更新**: 2025-11-20
**维护者**: Cretas Development Team
**联系方式**: tech@cretas.com
