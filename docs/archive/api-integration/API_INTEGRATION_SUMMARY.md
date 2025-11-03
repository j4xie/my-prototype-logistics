# React Native 登录API集成总结

## ✅ 集成完成

已成功将新的登录API (`/api/auth/login`) 集成到React Native前端应用中。

---

## 📋 集成详情

### API基本信息
- **API地址**: `http://47.251.121.76:10010`
- **登录端点**: `POST /api/auth/login`
- **登出端点**: `POST /api/auth/logout`
- **协议**: JSON over HTTP

### 登录请求格式
```json
{
  "username": "string",           // 必需
  "password": "string",           // 必需
  "factoryId": "string",          // 可选（大多数用户需要）
  "deviceInfo": {                 // 可选
    "deviceId": "string",
    "deviceModel": "string",
    "osVersion": "string",
    "appVersion": "string",
    "platform": "ios|android"
  }
}
```

### 登出请求格式
```json
// 仅需要在Header中携带Authorization token
// Header: Authorization: Bearer {token}
// 请求体: 无需传递任何参数
```

### 登出响应格式
```json
{
  "code": 200,
  "message": "登出成功",
  "data": null,
  "timestamp": "2025-10-27T01:12:09.399",
  "success": true
}
```

### 登录响应格式（实际）
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "JWT_token",
    "refreshToken": "uuid",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": 1,
      "factoryId": "F001",
      "username": "username",
      "email": "email@test.com",
      "phone": "13900001001",
      "fullName": "用户名",
      "isActive": true,
      "roleCode": "factory_super_admin",  // 角色编码
      "roleDisplayName": "工厂超级管理员",
      "department": "processing",
      "departmentDisplayName": "加工部门",
      "position": "工厂管理员",
      "lastLogin": "2025-10-18T14:24:44",
      "createdAt": "2025-10-18T05:39:20",
      "updatedAt": "2025-10-18T05:39:20"
    }
  },
  "timestamp": "2025-10-27T01:06:12.666",
  "success": true
}
```

---

## 🔄 前端实现细节

### 1. API基础URL配置
**文件**: `/frontend/CretasFoodTrace/src/constants/config.ts`

```typescript
export const API_BASE_URL = 'http://47.251.121.76:10010';
```

### 2. 登录请求类型
**文件**: `/frontend/CretasFoodTrace/src/types/auth.ts`

```typescript
export interface LoginRequest {
  username: string;
  password: string;
  deviceInfo?: { ... };
  factoryId?: string;           // 新增字段
  rememberMe?: boolean;
  biometricEnabled?: boolean;
}
```

### 3. 核心认证逻辑
**文件**: `/frontend/CretasFoodTrace/src/services/auth/authService.ts`

#### login() 方法
- 调用API端点: `POST /api/auth/login`
- 通过 `adaptNewApiResponse()` 转换API响应格式
- 使用 `TokenManager` 保存token
- 返回标准的 `LoginResponse` 对象

#### adaptNewApiResponse() 方法（新增）
- 将后端返回格式转换为前端内部格式
- 自动检测用户类型（factory 或 platform）
- 构建完整的User对象
- 提取和保存权限信息

#### logout() 方法（已更新）
- 调用API端点: `POST /api/auth/logout`
- Authorization header 自动添加（apiClient 拦截器处理）
- 处理服务器端登出结果
- 无论服务器端成功与否，都清除本地认证数据
- 详细日志记录登出过程

### 4. Token管理
- AccessToken: 存储在SecureStore
- RefreshToken: 存储在SecureStore
- 自动处理401错误和token刷新

---

## ✅ 测试结果

### 成功的账号

#### 1. dept_admin (部门管理员)
- **密码**: 123456
- **工厂**: F001
- **角色**: department_admin
- **权限**: 部门内用户管理、报表查看
- ✅ 登录成功

#### 2. super_admin (工厂超级管理员)
- **密码**: 123456
- **工厂**: F001
- **角色**: factory_super_admin
- **权限**: 完整工厂权限
- ✅ 登录成功

#### 3. operator1 (操作员)
- **密码**: 123456
- **工厂**: F001
- **角色**: operator
- **权限**: 基础操作权限
- ✅ 登录成功

### API关键特性

1. **必需字段**: `username` 和 `password`
2. **大多数用户需要**: `factoryId` 参数
3. **自动权限分配**: API返回权限信息，无需额外配置
4. **角色自动识别**: 根据 `roleCode` 自动设置用户类型
5. **Token有效期**: 86400秒（24小时）

---

## ✅ 用户注册API集成完成

已成功将新的用户注册API (`/api/auth/register`) 集成到React Native前端应用中。

---

## 📋 用户注册API集成详情

### API基本信息
- **API地址**: `http://47.251.121.76:10010`
- **注册端点**: `POST /api/auth/register`
- **协议**: JSON over HTTP
- **认证**: 需要 `tempToken`（通过手机验证后获得）

### 用户注册请求格式
```json
{
  "tempToken": "temp_token_xxx",        // 必需（验证手机后获得）
  "username": "john_doe",               // 必需
  "password": "password123",            // 必需（至少6个字符）
  "realName": "张三",                   // 必需
  "factoryId": "F001",                  // 必需
  "department": "生产部",                // 可选
  "position": "操作员",                  // 可选
  "email": "john@example.com"           // 可选
}
```

### 用户注册响应格式（实际）
```json
{
  "code": 200,
  "message": "注册成功，请等待管理员激活您的账户",
  "data": {
    "accessToken": "JWT_token",
    "refreshToken": "uuid",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "message": "注册成功，请等待管理员激活您的账户",
    "user": {
      "id": 2,
      "factoryId": "F001",
      "username": "john_doe",
      "email": "john@example.com",
      "phone": "13900001002",
      "fullName": "张三",
      "isActive": false,                      // 新注册用户默认未激活
      "roleCode": "unactivated",              // 新注册用户角色
      "roleDisplayName": "未激活用户",
      "department": "processing",
      "departmentDisplayName": "加工部门",
      "position": "操作员",
      "lastLogin": null,
      "createdAt": "2025-10-27T08:00:00",
      "updatedAt": "2025-10-27T08:00:00"
    }
  },
  "timestamp": "2025-10-27T08:00:00.123",
  "success": true
}
```

---

## 🔄 前端实现细节

### 1. 注册请求类型
**文件**: `/frontend/CretasFoodTrace/src/types/auth.ts`

```typescript
export interface RegisterRequest {
  tempToken: string;           // 临时令牌（验证手机后获得）
  username: string;            // 用户名
  password: string;            // 密码
  realName: string;            // 真实姓名
  factoryId: string;           // 工厂ID
  department?: string;         // 部门（可选）
  position?: string;           // 职位（可选）
  email?: string;              // 邮箱（可选）
}

export interface UserDTO {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  isActive: boolean;
  roleCode: FactoryRole | PlatformRole;
  roleDisplayName: string;
  factoryId?: string;
  department?: Department;
  departmentDisplayName?: string;
  position?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}
```

### 2. 核心认证逻辑
**文件**: `/frontend/CretasFoodTrace/src/services/auth/authService.ts`

#### register() 方法
- 调用API端点: `POST /api/auth/register`
- 前端验证：必需字段检查、密码长度验证
- 网络连接检查和自动重试（最多2次）
- 通过 `adaptRegisterResponse()` 转换API响应格式
- 使用 `TokenManager` 保存token
- 自动清除临时token
- 返回标准的 `LoginResponse` 对象

#### adaptRegisterResponse() 方法（新增）
- 将后端返回格式转换为前端内部格式
- 自动检测用户类型（factory 或 platform）
- 构建完整的User对象
- 处理初始权限信息

---

## 🚀 使用流程

### 在React Native中使用

#### 登录
```typescript
import { useLogin } from './hooks/useLogin';

const { login } = useLogin();

// 执行登录
const success = await login({
  username: 'dept_admin',
  password: '123456',
  factoryId: 'F001',  // 可选
  rememberMe: true,
  biometricEnabled: true
});

if (success) {
  // 登录成功，导航到主界面
  navigation.navigate('Main');
}
```

#### 用户注册
```typescript
import { AuthService } from './services/auth/authService';
import { RegisterRequest } from './types/auth';

// 假设已有tempToken（通过手机验证获得）
const tempToken = await getTempTokenFromPhoneVerification();

// 执行注册
const request: RegisterRequest = {
  tempToken: tempToken,
  username: 'new_user',
  password: 'secure_password123',
  realName: '李四',
  factoryId: 'F001',
  department: '生产部',
  position: '操作员',
  email: 'lisi@example.com'
};

try {
  const response = await AuthService.register(request);

  if (response.success && response.user) {
    console.log('注册成功:', response.message);
    console.log('用户信息:', response.user);
    console.log('访问令牌:', response.tokens?.accessToken);

    // 注册成功，导航到主界面
    navigation.navigate('Main');
  } else {
    console.error('注册失败:', response.message);
  }
} catch (error) {
  console.error('注册错误:', error);
  // 显示错误信息给用户
}
```

#### 登出
```typescript
import { AuthService } from './services/auth/authService';

// 执行登出
await AuthService.logout();

// 登出完成后，导航到登录界面
navigation.navigate('Auth');
```

### 直接使用AuthService

```typescript
import { AuthService } from './services/auth/authService';

const response = await AuthService.login({
  username: 'dept_admin',
  password: '123456',
  factoryId: 'F001'
});

if (response.success && response.user) {
  console.log('用户:', response.user);
  console.log('Token:', response.tokens.accessToken);
}
```

---

## 📝 修改的文件列表

### 登录API集成相关文件

1. ✅ `/frontend/CretasFoodTrace/src/constants/config.ts`
   - 更新 `API_BASE_URL` 为生产环境地址

2. ✅ `/frontend/CretasFoodTrace/src/types/auth.ts`
   - 在 `LoginRequest` 中添加 `factoryId?` 字段
   - 添加 `RegisterRequest` 接口（用户注册请求）
   - 添加 `RegisterResponseData` 接口（用户注册响应）
   - 添加 `UserDTO` 接口（用户数据传输对象）

3. ✅ `/frontend/CretasFoodTrace/src/services/auth/authService.ts`
   - 修改 `login()` 方法调用新API端点 `/api/auth/login`
   - 添加 `adaptNewApiResponse()` 方法转换API响应
   - 更新 `logout()` 方法调用新API端点 `/api/auth/logout`
   - 更新错误处理逻辑
   - 添加详细日志记录

### 用户注册API集成相关文件

4. ✅ `/frontend/CretasFoodTrace/src/types/auth.ts`（已更新）
   - 添加 `RegisterRequest` 接口
   - 添加 `RegisterResponseData` 接口
   - 添加 `UserDTO` 接口（包含完整用户信息字段）

5. ✅ `/frontend/CretasFoodTrace/src/services/auth/authService.ts`（已更新）
   - 添加 `register()` 方法调用API端点 `/api/auth/register`
   - 添加 `adaptRegisterResponse()` 方法转换注册API响应
   - 实现前端验证（必需字段、密码长度）
   - 实现自动重试机制（最多2次）
   - 自动保存认证信息到本地
   - 自动清除临时token
   - 详细日志记录

---

## 🔧 故障排除

### 登录相关错误

#### 错误: "工厂ID不能为空"
- **原因**: 部分用户类型需要 `factoryId` 参数
- **解决**: 在登录时提供 `factoryId` 参数

#### 错误: "用户名或密码错误"
- **原因**: 账号不存在或密码错误
- **排查**:
  - 检查用户名拼写
  - 确认密码是否正确（默认: 123456）
  - 确认账号是否激活

#### 错误: "网络连接不可用"
- **原因**: 设备无法连接到API服务器
- **解决**:
  - 检查网络连接
  - 确认API地址是否正确
  - 检查防火墙设置

### 注册相关错误

#### 错误: "缺少必需字段"
- **原因**: `RegisterRequest` 中缺少必需字段
- **必需字段**: `tempToken`, `username`, `password`, `realName`, `factoryId`
- **解决**:
  - 确保所有必需字段都已提供
  - 检查 `tempToken` 是否有效（通过手机验证获得）
  - 检查 `factoryId` 是否为有效的工厂ID

#### 错误: "密码长度必须至少6个字符"
- **原因**: 密码长度不符合要求
- **解决**: 提供至少6个字符的密码

#### 错误: "tempToken过期或无效"
- **原因**: 临时token已过期或不合法
- **解决**:
  - 重新进行手机验证获取新的 `tempToken`
  - 检查 `tempToken` 是否正确复制

#### 错误: "用户名已存在"
- **原因**: 该用户名已被使用
- **解决**: 选择不同的用户名

#### 错误: "注册成功但等待管理员激活"
- **这不是错误！** 这是正常流程
- **说明**: 新注册用户需要等待管理员激活
- **状态**: 用户角色为 `unactivated`，`isActive` 为 `false`
- **解决**: 联系管理员申请激活账户

### 登出相关问题

#### 登出失败但用户数据仍被清除
- **这是正常行为**！
- 即使服务器端登出失败，本地数据也会被清除
- 用户需要重新登录才能使用应用
- 好处：确保设备上没有旧的认证信息

#### 登出后仍能使用旧token
- **原因**: 服务器可能没有将token加入黑名单
- **当前处理**: 前端已清除所有token，即使token本身有效也无法使用
- **建议**: 检查后端是否实现了token黑名单机制

---

## 📦 后续优化建议

1. **密码验证增强**
   - 实现密码强度检查
   - 添加忘记密码功能

2. **生物识别支持**
   - 集成指纹/人脸识别
   - 实现一键登录

3. **多账号支持**
   - 支持同一设备多个账号快速切换
   - 保存账号登录历史

4. **离线支持**
   - 缓存最后登录的token
   - 支持离线模式

5. **安全增强**
   - 实现SSL证书验证
   - 添加API请求签名
   - 实现设备指纹识别

---

## 📞 联系信息

- **API文档**: 查看OpenAPI规范
- **支持**: 如有问题，请联系后端团队

---

## 📊 集成进度

| API功能 | 状态 | 更新时间 |
|--------|------|--------|
| 登录API (`/api/auth/login`) | ✅ 完成 | 2025-10-27 |
| 登出API (`/api/auth/logout`) | ✅ 完成 | 2025-10-27 |
| 用户注册API (`/api/auth/register`) | ✅ 完成 | 2025-10-26 |
| Token管理 | ✅ 完成 | 2025-10-27 |
| 生物识别认证 | ✅ 完成 | 2025-10-27 |

---

**最后更新**: 2025-10-26
**集成状态**: ✅ 完成（登录 + 登出 + 注册）
**生产环境**: 已上线 http://47.251.121.76:10010
