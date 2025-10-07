# 白垩纪食品溯源系统 - API接口文档

**服务地址**: `http://localhost:3001`
**数据库**: MySQL 8.0.42
**认证方式**: JWT Token (放在 Header: `Authorization: Bearer <token>`)

---

## 📱 移动端接口 (`/api/mobile`)

### 1. 登录注册

#### 1.1 统一登录（推荐）
```
POST /api/mobile/auth/unified-login
```
**请求参数**:
```json
{
  "username": "用户名",
  "password": "密码",
  "deviceInfo": {
    "deviceId": "设备ID",
    "deviceModel": "设备型号",
    "platform": "android/ios",
    "osVersion": "系统版本"
  }
}
```
**返回**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "userType": "factory/platform",
    "role": "角色代码",
    "permissions": ["权限列表"]
  },
  "token": "JWT令牌",
  "refreshToken": "刷新令牌"
}
```

#### 1.2 发送验证码
```
POST /api/mobile/auth/send-verification
```
**请求参数**:
```json
{
  "phoneNumber": "+8613800000000",
  "verificationType": "registration/login/reset_password"
}
```

#### 1.3 注册第一步 - 手机验证
```
POST /api/mobile/auth/register-phase-one
```
**请求参数**:
```json
{
  "phoneNumber": "+8613800000000",
  "verificationType": "registration"
}
```
**返回**:
```json
{
  "success": true,
  "tempToken": "临时令牌（用于第二步）",
  "message": "手机验证成功"
}
```

#### 1.4 注册第二步 - 完整信息
```
POST /api/mobile/auth/register-phase-two
```
**请求参数**:
```json
{
  "tempToken": "第一步返回的临时令牌",
  "username": "用户名",
  "password": "密码",
  "fullName": "真实姓名",
  "email": "邮箱（可选）",
  "department": "部门（可选）"
}
```

#### 1.5 刷新Token
```
POST /api/mobile/auth/refresh-token
```
**请求参数**:
```json
{
  "refreshToken": "刷新令牌",
  "deviceId": "设备ID（可选）"
}
```

#### 1.6 登出
```
POST /api/mobile/auth/logout
```
**需要认证**: 是（Header带Token）

#### 1.7 获取用户信息
```
GET /api/mobile/auth/profile
```
**需要认证**: 是

---

### 2. 设备管理

#### 2.1 绑定设备
```
POST /api/mobile/auth/bind-device
```
**需要认证**: 是
**请求参数**:
```json
{
  "deviceId": "设备唯一ID",
  "deviceInfo": {
    "deviceModel": "设备型号",
    "platform": "android/ios",
    "osVersion": "系统版本"
  }
}
```

#### 2.2 设备登录
```
POST /api/mobile/auth/device-login
```
**请求参数**:
```json
{
  "deviceId": "设备ID",
  "deviceToken": "设备令牌"
}
```

#### 2.3 查询绑定设备列表
```
GET /api/mobile/auth/devices
```
**需要认证**: 是

---

### 3. 应用激活

#### 3.1 激活应用
```
POST /api/mobile/activation/activate
```
**请求参数**:
```json
{
  "activationCode": "激活码",
  "deviceInfo": {
    "deviceId": "设备ID",
    "deviceModel": "设备型号"
  }
}
```
**有效激活码**: `DEV_TEST_2024`, `HEINIU_MOBILE_2024`, `PROD_ACTIVATION`

#### 3.2 验证激活状态
```
POST /api/mobile/activation/validate
```
**请求参数**:
```json
{
  "activationCode": "激活码",
  "deviceId": "设备ID"
}
```

---

### 4. 文件上传

#### 4.1 移动端文件上传
```
POST /api/mobile/upload/mobile
```
**需要认证**: 是
**Content-Type**: `multipart/form-data`
**请求参数**:
- `files`: 文件数组（最多10个）
- `category`: 分类（可选）
- `metadata`: 元数据（可选）

**支持格式**: JPG, PNG, WebP
**最大大小**: 10MB/文件

---

### 5. AI分析

#### 5.1 DeepSeek智能分析
```
POST /api/mobile/analysis/deepseek
```
**需要认证**: 是
**请求参数**:
```json
{
  "data": "需要分析的数据",
  "requestId": "请求ID（可选）"
}
```

---

### 6. 权限管理

#### 6.1 批量权限检查
```
POST /api/mobile/permissions/batch-check
```
**需要认证**: 是
**请求参数**:
```json
{
  "permissionChecks": [
    {
      "type": "permission/role/level",
      "values": ["权限或角色列表"],
      "operator": "AND/OR"
    }
  ]
}
```

---

### 7. 健康检查
```
GET /api/mobile/health
```
**无需认证**，返回服务状态

---

## 🏭 工厂用户接口 (`/api`)

### 1. 认证

#### 1.1 工厂用户登录
```
POST /api/auth/login
```
**请求参数**:
```json
{
  "factoryId": "工厂ID",
  "username": "用户名",
  "password": "密码"
}
```

#### 1.2 平台管理员登录
```
POST /api/auth/platform-login
```
**请求参数**:
```json
{
  "username": "用户名",
  "password": "密码"
}
```

#### 1.3 修改密码
```
PUT /api/auth/password
```
**需要认证**: 是
**请求参数**:
```json
{
  "oldPassword": "旧密码",
  "newPassword": "新密码"
}
```

---

### 2. 白名单管理

#### 2.1 获取白名单列表
```
GET /api/whitelist
```
**需要认证**: 是

#### 2.2 添加白名单
```
POST /api/whitelist
```
**需要认证**: 是
**请求参数**:
```json
{
  "phoneNumber": "+8613800000000",
  "expiresAt": "过期时间（可选）"
}
```

#### 2.3 删除白名单
```
DELETE /api/whitelist/:id
```
**需要认证**: 是

---

### 3. 用户管理

#### 3.1 获取用户列表
```
GET /api/users
```
**需要认证**: 是

#### 3.2 获取待激活用户
```
GET /api/users/pending
```
**需要认证**: 是

#### 3.3 激活用户
```
PUT /api/users/:id/activate
```
**需要认证**: 是
**请求参数**:
```json
{
  "roleCode": "角色代码",
  "roleLevel": "角色等级",
  "department": "部门（可选）",
  "position": "职位（可选）",
  "permissions": ["权限列表（可选）"]
}
```

#### 3.4 更新用户信息
```
PUT /api/users/:id
```
**需要认证**: 是

#### 3.5 重置用户密码
```
PUT /api/users/:id/reset-password
```
**需要认证**: 是（需要管理员权限）

---

### 4. 平台管理

#### 4.1 获取工厂列表
```
GET /api/platform/factories
```
**需要认证**: 是（平台管理员）

#### 4.2 创建工厂
```
POST /api/platform/factories
```
**需要认证**: 是（平台管理员）
**请求参数**:
```json
{
  "name": "工厂名称",
  "industry": "所属行业",
  "address": "地址",
  "contactName": "联系人",
  "contactPhone": "联系电话",
  "contactEmail": "联系邮箱"
}
```

#### 4.3 创建工厂超级管理员
```
POST /api/platform/factories/:factoryId/admin
```
**需要认证**: 是（平台管理员）
**请求参数**:
```json
{
  "username": "用户名",
  "password": "密码",
  "email": "邮箱",
  "fullName": "真实姓名"
}
```

---

## 🔑 角色权限说明

### 平台角色
- `developer` - 系统开发者（最高权限）
- `platform_admin` - 平台管理员

### 工厂角色（按权限从高到低）
- `factory_super_admin` - 工厂超级管理员
- `permission_admin` - 权限管理员
- `department_admin` - 部门管理员
- `operator` - 操作员
- `viewer` - 查看者
- `unactivated` - 未激活

---

## 📋 测试账号

### 平台管理员
- 用户名: `platform_admin`
- 密码: `Admin@123456`

### 工厂超级管理员
- 用户名: `factory_admin`
- 密码: `SuperAdmin@123`
- 工厂ID: `TEST_2024_001`

### 部门管理员
- 养殖: `farming_admin` / `DeptAdmin@123`
- 加工: `processing_admin` / `DeptAdmin@123`
- 物流: `logistics_admin` / `DeptAdmin@123`

---

## ❌ 错误代码说明

| 错误码 | 说明 |
|-------|------|
| `VALIDATION_ERROR` | 数据验证失败 |
| `AUTHENTICATION_ERROR` | 认证失败 |
| `AUTHORIZATION_ERROR` | 权限不足 |
| `NOT_FOUND_ERROR` | 资源不存在 |
| `CONFLICT_ERROR` | 数据冲突 |
| `DATABASE_ERROR` | 数据库操作失败 |

### 错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "code": "错误代码",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🚀 快速开始

### 1. 移动端登录流程
```
1. POST /api/mobile/auth/unified-login
   → 获取 token 和 refreshToken
2. 后续请求带上 Header: Authorization: Bearer <token>
3. Token过期时用 POST /api/mobile/auth/refresh-token 刷新
```

### 2. 新用户注册流程
```
1. POST /api/mobile/auth/register-phase-one
   → 验证手机号并获取 tempToken
2. POST /api/mobile/auth/register-phase-two
   → 用 tempToken 完成注册
3. POST /api/mobile/auth/unified-login
   → 登录获取正式 token
```

### 3. 应用激活流程
```
1. POST /api/mobile/activation/activate
   → 用激活码激活应用
2. POST /api/mobile/activation/validate
   → 验证激活状态（可选）
```

---

**最后更新**: 2025-10-05
**API版本**: v1.0
