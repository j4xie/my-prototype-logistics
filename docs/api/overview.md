# 食品溯源系统API概览

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

## 1. API设计原则

食品溯源系统的API设计遵循RESTful架构原则，提供标准化的接口用于前端与后端的通信。我们的API设计秉承以下原则：

### 1.1 基本原则

- **资源导向**：API以资源为中心进行设计，每个端点代表一个资源
- **HTTP方法语义**：使用标准HTTP方法表达操作语义
  - GET：获取资源
  - POST：创建资源
  - PUT：完全替换资源
  - PATCH：部分更新资源
  - DELETE：删除资源
- **状态码规范**：使用标准HTTP状态码表达请求结果
- **无状态**：API调用不依赖服务器状态，每个请求包含所有必要信息
- **分页与筛选**：支持资源集合的分页、排序和筛选
- **版本控制**：通过URL路径进行版本控制
- **文档化**：每个API端点都有详细文档

### 1.2 URL结构

API使用以下URL结构：

```
https://api.example.com/v1/{resource}/{id}/{sub-resource}
```

例如：
- `GET /v1/traces` - 获取所有溯源批次
- `GET /v1/traces/{id}` - 获取特定溯源批次
- `GET /v1/traces/{id}/logs` - 获取特定溯源批次的日志记录
- `POST /v1/traces` - 创建新的溯源批次
- `PATCH /v1/traces/{id}` - 更新溯源批次信息
- `DELETE /v1/traces/{id}` - 删除溯源批次

### 1.3 命名约定

- URL使用小写字母
- 使用连字符（-）连接复合词，而不是下划线（_）
- 资源名使用复数形式（如`/traces`而不是`/trace`）
- 查询参数使用camelCase（如`?sortBy=createdAt`）

## 2. 认证机制

系统使用基于JWT（JSON Web Token）的认证机制，确保API访问的安全性。

### 2.1 认证流程

1. 客户端通过登录接口提供用户凭证
2. 服务器验证凭证并生成JWT令牌
3. 客户端在后续请求中通过Authorization头部附带令牌
4. 服务器验证令牌的有效性和权限

### 2.2 令牌格式

JWT令牌由三部分组成：
- 头部（Header）：指定令牌类型和签名算法
- 载荷（Payload）：包含用户信息和权限
- 签名（Signature）：确保令牌完整性和真实性

### 2.3 认证请求示例

**请求**：
```http
POST /v1/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}
```

**响应**：
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "tokenType": "Bearer"
}
```

### 2.4 使用令牌示例

**请求**：
```http
GET /v1/traces
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.5 令牌刷新

令牌有效期为24小时，可以通过刷新接口延长会话时间：

**请求**：
```http
POST /v1/auth/refresh
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. 错误处理

API使用标准HTTP状态码指示请求结果，并提供结构化的错误响应。

### 3.1 常用状态码

- **2xx**：成功
  - 200 OK：请求成功
  - 201 Created：资源创建成功
  - 204 No Content：请求成功但无返回内容
- **4xx**：客户端错误
  - 400 Bad Request：请求格式错误
  - 401 Unauthorized：未认证
  - 403 Forbidden：无权限
  - 404 Not Found：资源不存在
  - 422 Unprocessable Entity：验证错误
- **5xx**：服务器错误
  - 500 Internal Server Error：服务器内部错误
  - 503 Service Unavailable：服务不可用

### 3.2 错误响应格式

```json
{
  "status": "error",
  "code": "RESOURCE_NOT_FOUND",
  "message": "The requested resource was not found",
  "details": [
    {
      "field": "traceId",
      "message": "Trace with ID 123 does not exist"
    }
  ]
}
```

### 3.3 验证错误示例

```json
{
  "status": "error",
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    },
    {
      "field": "quantity",
      "message": "Quantity must be a positive number"
    }
  ]
}
```

## 4. 请求与响应格式

### 4.1 请求格式

大多数非GET请求使用JSON作为请求体格式：

```http
POST /v1/traces
Content-Type: application/json

{
  "name": "Apple Batch A123",
  "productId": "apple-01",
  "quantity": 1000,
  "unitWeight": 0.2,
  "harvestDate": "2023-05-15T08:00:00Z",
  "farmId": "farm-123"
}
```

### 4.2 响应格式

成功响应通常返回以下格式：

```json
{
  "status": "success",
  "data": {
    "id": "trace-456",
    "name": "Apple Batch A123",
    "productId": "apple-01",
    "quantity": 1000,
    "unitWeight": 0.2,
    "harvestDate": "2023-05-15T08:00:00Z",
    "farmId": "farm-123",
    "createdAt": "2023-05-15T10:30:00Z",
    "updatedAt": "2023-05-15T10:30:00Z"
  },
  "meta": {
    "serverTime": "2023-05-15T10:30:00Z"
  }
}
```

对于集合资源，返回包含分页信息：

```json
{
  "status": "success",
  "data": [
    {
      "id": "trace-456",
      "name": "Apple Batch A123",
      // 其他字段...
    },
    {
      "id": "trace-457",
      "name": "Apple Batch A124",
      // 其他字段...
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5,
    "serverTime": "2023-05-15T10:35:00Z"
  }
}
```

## 5. 通用参数

### 5.1 分页参数

所有集合资源支持以下分页参数：

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | 整数 | 1 | 页码，从1开始 |
| limit | 整数 | 10 | 每页项目数，最大值100 |

示例：`GET /v1/traces?page=2&limit=20`

### 5.2 排序参数

集合资源支持排序：

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| sortBy | 字符串 | createdAt | 排序字段 |
| sortDir | 字符串 | desc | 排序方向：asc（升序）或desc（降序） |

示例：`GET /v1/traces?sortBy=name&sortDir=asc`

### 5.3 过滤参数

过滤参数因资源类型而异，常见参数包括：

| 参数 | 类型 | 描述 |
|------|------|------|
| search | 字符串 | 搜索关键词，用于全文搜索 |
| status | 字符串 | 按状态筛选（如active、archived） |
| fromDate | ISO日期 | 开始日期范围 |
| toDate | ISO日期 | 结束日期范围 |

示例：`GET /v1/traces?status=active&fromDate=2023-01-01T00:00:00Z`

### 5.4 字段选择

支持选择性返回字段，减少数据传输：

| 参数 | 类型 | 描述 |
|------|------|------|
| fields | 字符串 | 以逗号分隔的字段列表 |

示例：`GET /v1/traces/123?fields=id,name,status,farmId`

## 6. 速率限制

为保护API免受滥用，实施了速率限制：

- 认证请求：20次/分钟
- 一般API请求：300次/分钟
- 批量操作：10次/分钟

超过限制时，返回429 Too Many Requests状态码，并包含以下响应头：

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1620000000
```

## 7. 跨域资源共享（CORS）

API支持跨域资源共享，配置如下：

- 允许的域：应用域名
- 允许的方法：GET, POST, PUT, PATCH, DELETE, OPTIONS
- 允许的头部：Content-Type, Authorization, X-Requested-With
- 凭证支持：是
- 最大缓存时间：86400秒（1天）

## 8. API版本控制

API使用URL路径进行版本控制，格式为：`/v{major_version}/...`

当前版本为v1，未来重大更改将引入新版本，同时保持旧版本向后兼容。

## 9. 文档与工具

- 完整的API文档使用OpenAPI（Swagger）规范提供
- 在线API文档可通过`/docs`路径访问
- API文档包含示例请求和响应
- 提供Postman集合用于测试和开发 