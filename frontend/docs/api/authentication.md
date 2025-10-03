# 认证API文档

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

## 概述

认证API提供用户认证、授权和权限管理功能，支持登录、注册、令牌刷新等操作。所有API遵循RESTful设计原则，使用JWT作为认证机制。

## 基础信息

**基础路径**: `/v1/auth`

**需要认证**: 部分接口需要（令牌刷新、注销等）

## 用户认证

### 用户登录

用户使用用户名/邮箱和密码进行登录。

**请求**:

```http
POST /v1/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123",
  "rememberMe": true
}
```

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| username | 字符串 | 是 | 用户名或邮箱地址 |
| password | 字符串 | 是 | 用户密码 |
| rememberMe | 布尔值 | 否 | 是否延长令牌有效期，默认false |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer",
    "user": {
      "id": "user123",
      "username": "johndoe",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "manager",
      "permissions": ["read:traces", "write:traces", "read:farms"],
      "createdAt": "2023-01-15T08:30:00Z",
      "lastLogin": "2023-05-20T14:25:10Z"
    }
  }
}
```

**错误响应**:

- 401 Unauthorized: 用户名或密码不正确
- 403 Forbidden: 账户已锁定或禁用
- 429 Too Many Requests: 登录尝试次数过多，账户暂时锁定

### 用户注册

创建新用户账户。

**请求**:

```http
POST /v1/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securepassword123",
  "name": "New User",
  "company": "Example Corp",
  "phone": "+1234567890",
  "acceptTerms": true
}
```

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| username | 字符串 | 是 | 用户名（4-20个字符） |
| email | 字符串 | 是 | 电子邮件地址 |
| password | 字符串 | 是 | 用户密码（至少8个字符） |
| name | 字符串 | 是 | 用户姓名 |
| company | 字符串 | 否 | 公司名称 |
| phone | 字符串 | 否 | 电话号码 |
| acceptTerms | 布尔值 | 是 | 用户是否接受服务条款 |

**响应** (201 Created):

```json
{
  "status": "success",
  "data": {
    "id": "user456",
    "username": "newuser",
    "email": "newuser@example.com",
    "name": "New User",
    "role": "user",
    "verificationStatus": "pending",
    "createdAt": "2023-05-21T10:15:30Z",
    "message": "Registration successful. Please verify your email."
  }
}
```

**错误响应**:

- 400 Bad Request: 请求格式错误
- 409 Conflict: 用户名或邮箱已存在
- 422 Unprocessable Entity: 验证错误（如密码不复杂）

### 邮箱验证

验证用户注册邮箱。

**请求**:

```http
GET /v1/auth/verify-email?token=abc123def456
```

**查询参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| token | 字符串 | 邮箱验证令牌 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Email successfully verified. You can now log in.",
    "verified": true
  }
}
```

**错误响应**:

- 400 Bad Request: 缺少验证令牌
- 404 Not Found: 无效的验证令牌
- 410 Gone: 验证令牌已过期

### 忘记密码

发送密码重置链接到用户邮箱。

**请求**:

```http
POST /v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| email | 字符串 | 是 | 注册邮箱地址 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Password reset instructions sent to your email."
  }
}
```

**注意**: 为了安全，无论邮箱是否存在，API都返回成功响应。

### 重置密码

使用重置令牌设置新密码。

**请求**:

```http
POST /v1/auth/reset-password
Content-Type: application/json

{
  "token": "xyz789abc012",
  "password": "newSecurePassword123",
  "confirmPassword": "newSecurePassword123"
}
```

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| token | 字符串 | 是 | 密码重置令牌 |
| password | 字符串 | 是 | 新密码（至少8个字符） |
| confirmPassword | 字符串 | 是 | 确认新密码（必须与password相同） |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Password successfully reset. You can now log in with your new password."
  }
}
```

**错误响应**:

- 400 Bad Request: 缺少令牌或密码不匹配
- 404 Not Found: 无效的重置令牌
- 410 Gone: 重置令牌已过期
- 422 Unprocessable Entity: 新密码不符合复杂度要求

## 令牌管理

### 刷新令牌

使用刷新令牌获取新的访问令牌。

**请求**:

```http
POST /v1/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| refreshToken | 字符串 | 是 | 刷新令牌 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**错误响应**:

- 400 Bad Request: 缺少刷新令牌
- 401 Unauthorized: 无效的刷新令牌
- 403 Forbidden: 刷新令牌已被撤销

### 验证令牌

验证访问令牌的有效性。

**请求**:

```http
POST /v1/auth/verify-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "valid": true,
    "user": {
      "id": "user123",
      "role": "manager",
      "permissions": ["read:traces", "write:traces", "read:farms"]
    }
  }
}
```

**错误响应**:

- 401 Unauthorized: 无效或过期的令牌

### 注销

撤销当前用户的所有活动令牌。

**请求**:

```http
POST /v1/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Successfully logged out."
  }
}
```

## 用户管理

### 获取当前用户信息

获取当前登录用户的详细信息。

**请求**:

```http
GET /v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "id": "user123",
    "username": "johndoe",
    "email": "user@example.com",
    "name": "John Doe",
    "company": "Example Corp",
    "phone": "+1234567890",
    "role": "manager",
    "permissions": ["read:traces", "write:traces", "read:farms"],
    "preferences": {
      "language": "en",
      "timezone": "America/New_York",
      "notifications": {
        "email": true,
        "sms": false,
        "app": true
      }
    },
    "createdAt": "2023-01-15T08:30:00Z",
    "lastLogin": "2023-05-21T14:25:10Z"
  }
}
```

### 更新用户信息

更新当前用户的个人信息。

**请求**:

```http
PATCH /v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "John A. Doe",
  "phone": "+1987654321",
  "preferences": {
    "language": "fr",
    "notifications": {
      "sms": true
    }
  }
}
```

**参数**:

可更新的字段：

| 参数 | 类型 | 描述 |
|------|------|------|
| name | 字符串 | 用户姓名 |
| company | 字符串 | 公司名称 |
| phone | 字符串 | 电话号码 |
| preferences | 对象 | 用户偏好设置 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "id": "user123",
    "username": "johndoe",
    "email": "user@example.com",
    "name": "John A. Doe",
    "company": "Example Corp",
    "phone": "+1987654321",
    "preferences": {
      "language": "fr",
      "timezone": "America/New_York",
      "notifications": {
        "email": true,
        "sms": true,
        "app": true
      }
    },
    "updatedAt": "2023-05-21T15:30:45Z"
  }
}
```

### 更改密码

更改当前用户的密码。

**请求**:

```http
POST /v1/auth/change-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "currentPassword": "currentSecurePassword123",
  "newPassword": "newSecurePassword456",
  "confirmPassword": "newSecurePassword456"
}
```

**参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| currentPassword | 字符串 | 是 | 当前密码 |
| newPassword | 字符串 | 是 | 新密码（至少8个字符） |
| confirmPassword | 字符串 | 是 | 确认新密码 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "message": "Password successfully changed."
  }
}
```

**错误响应**:

- 400 Bad Request: 新密码与确认密码不匹配
- 401 Unauthorized: 当前密码不正确
- 422 Unprocessable Entity: 新密码不符合复杂度要求

## 权限管理

### 获取角色列表

获取系统中所有可用角色。

**请求**:

```http
GET /v1/auth/roles
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应** (200 OK):

```json
{
  "status": "success",
  "data": [
    {
      "id": "admin",
      "name": "Administrator",
      "description": "Full system access",
      "permissions": ["*"]
    },
    {
      "id": "manager",
      "name": "Manager",
      "description": "Manage traces and users",
      "permissions": ["read:*", "write:traces", "write:farms", "write:processing"]
    },
    {
      "id": "user",
      "name": "Standard User",
      "description": "Basic system access",
      "permissions": ["read:traces", "read:farms", "read:processing"]
    },
    {
      "id": "guest",
      "name": "Guest",
      "description": "Limited read access",
      "permissions": ["read:traces"]
    }
  ]
}
```

### 获取权限列表

获取系统中所有可用权限。

**请求**:

```http
GET /v1/auth/permissions
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应** (200 OK):

```json
{
  "status": "success",
  "data": [
    {
      "id": "read:traces",
      "name": "Read Traces",
      "description": "View trace information"
    },
    {
      "id": "write:traces",
      "name": "Write Traces",
      "description": "Create and modify traces"
    },
    {
      "id": "delete:traces",
      "name": "Delete Traces",
      "description": "Delete trace records"
    },
    // 更多权限...
  ]
}
```

## 错误响应示例

### 认证错误

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "status": "error",
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid username or password",
  "details": []
}
```

### 验证错误

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "status": "error",
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters and include uppercase, lowercase, number and special character"
    },
    {
      "field": "confirmPassword",
      "message": "Passwords do not match"
    }
  ]
}
```

### 凭证错误

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "status": "error",
  "code": "CREDENTIAL_TAKEN",
  "message": "The provided credentials are already in use",
  "details": [
    {
      "field": "email",
      "message": "Email address is already registered"
    }
  ]
}
``` 