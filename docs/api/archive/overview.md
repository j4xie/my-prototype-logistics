# 食品溯源系统API概览

<!-- updated for: Phase-3技术栈现代化 - API文档与客户端封装同步优化 -->
<!-- authority: docs/api/api-specification.md - 详细API接口规范的权威来源 -->
<!-- last-sync: 2025-01-22 -->

> **⚠️ 重要说明**: 本文档提供API总览信息，详细的接口规范、数据类型定义、Mock环境配置等内容请参阅：
> **[API接口规范文档](./api-specification.md)** - 权威来源

## 1. API设计原则

食品溯源系统的API设计遵循RESTful架构原则，提供标准化的接口用于前端与后端的通信。在Phase-3技术栈现代化过程中，我们实现了完整的TypeScript API客户端封装，确保类型安全和开发效率。

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
- **TypeScript支持**：Phase-3提供完整的类型定义和客户端封装

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

系统使用基于JWT（JSON Web Token）的认证机制，Phase-3的API客户端自动处理认证流程。

### 2.1 认证流程

1. 客户端通过登录接口提供用户凭证
2. 服务器验证凭证并生成JWT令牌
3. **Phase-3客户端自动将令牌存储在localStorage中**
4. **后续请求客户端自动附加Authorization头部**
5. 服务器验证令牌的有效性和权限

### 2.2 Phase-3客户端认证使用

```typescript
import { apiClient } from '@/lib/api';

// 登录 - 令牌会自动存储
const loginResponse = await apiClient.post<LoginResponse>('/v1/auth/login', {
  username: 'user@example.com',
  password: 'password123'
});

// 后续API调用会自动附加认证头部
const userProfile = await apiClient.get<UserProfile>('/v1/profile/me');
```

### 2.3 令牌格式

JWT令牌由三部分组成：
- 头部（Header）：指定令牌类型和签名算法
- 载荷（Payload）：包含用户信息和权限
- 签名（Signature）：确保令牌完整性和真实性

### 2.4 认证请求示例

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
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "tokenType": "Bearer",
    "user": {
      "id": "user-123",
      "username": "user@example.com",
      "role": "farmer"
    }
  }
}
```

### 2.5 令牌刷新

令牌有效期为24小时，Phase-3客户端支持自动令牌刷新：

```typescript
// 手动刷新令牌
const refreshResponse = await apiClient.post<RefreshResponse>('/v1/auth/refresh');
```

## 3. 错误处理

Phase-3 API客户端提供统一的错误处理机制，使用标准化的`ApiError`类。

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

### 3.2 Phase-3客户端错误处理

```typescript
import { ApiError } from '@/lib/api';

try {
  const trace = await apiClient.get<Trace>('/v1/traces/invalid-id');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API错误 [${error.code}]: ${error.message}`);
    console.error(`状态: ${error.status}`);
    
    // 处理特定错误
    switch (error.code) {
      case 404:
        showMessage('溯源批次不存在');
        break;
      case 401:
        redirectToLogin();
        break;
      case 422:
        showValidationErrors(error.message);
        break;
      case 408:
        showMessage('请求超时，请重试');
        break;
      default:
        showMessage('操作失败，请稍后重试');
    }
  }
}
```

### 3.3 标准错误响应格式

服务器返回的错误响应格式：

```json
{
  "success": false,
  "message": "The requested resource was not found",
  "code": "RESOURCE_NOT_FOUND",
  "details": [
    {
      "field": "traceId",
      "message": "Trace with ID 123 does not exist"
    }
  ]
}
```

### 3.4 验证错误示例

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_FAILED",
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

### 4.1 Phase-3客户端请求示例

```typescript
// GET请求 - 获取溯源批次列表
const traces = await apiClient.get<TracePaginatedResponse>('/v1/traces?page=1&limit=20');

// POST请求 - 创建新的溯源批次
const newTrace = await apiClient.post<Trace>('/v1/traces', {
  name: "Apple Batch A123",
  productId: "apple-01",
  quantity: 1000,
  unitWeight: 0.2,
  harvestDate: "2023-05-15T08:00:00Z",
  farmId: "farm-123"
});

// PATCH请求 - 更新溯源批次状态
const updatedTrace = await apiClient.patch<Trace>('/v1/traces/trace-456', {
  status: 'COMPLETED'
});

// DELETE请求 - 删除溯源批次
await apiClient.delete('/v1/traces/trace-456');
```

### 4.2 标准响应格式

**成功响应**：
```json
{
  "success": true,
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
  }
}
```

**分页响应**：
```json
{
  "success": true,
  "data": [
    { 
      "id": "trace-001",
      "name": "批次A001"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### 4.3 Phase-3客户端响应处理

Phase-3的API客户端自动处理不同格式的响应：

```typescript
// 客户端自动提取data字段，你只需要处理业务数据
const trace = await apiClient.get<Trace>('/v1/traces/123');
console.log(trace.name); // 直接访问业务数据

// 分页数据的处理
const { data: traces, meta } = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces');
console.log(`共${meta.total}条记录，当前第${meta.page}页`);
```

## 5. 查询参数和分页

### 5.1 分页参数

所有返回集合数据的API都支持分页：

```typescript
// 基本分页
const traces = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?page=1&limit=20');

// 自定义分页大小
const traces = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?page=2&limit=50');
```

**标准分页参数**：
- `page`：页码，从1开始（默认：1）
- `limit`：每页数量（默认：20，最大：100）

### 5.2 排序参数

```typescript
// 按创建时间降序排序
const traces = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?sort=createdAt&order=desc');

// 按名称升序排序
const traces = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?sort=name&order=asc');
```

**排序参数**：
- `sort`：排序字段
- `order`：排序方向（`asc` 或 `desc`，默认：`asc`）

### 5.3 筛选参数

```typescript
// 按状态筛选
const activeTraces = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?filter=status:active');

// 多重筛选
const filtered = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?filter=status:active,type:organic');

// 日期范围筛选
const dateFiltered = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?startDate=2023-01-01&endDate=2023-12-31');
```

### 5.4 搜索参数

```typescript
// 模糊搜索
const searchResults = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?search=有机西红柿');

// 精确字段搜索
const exactMatch = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?batchCode=A001');
```

### 5.5 字段选择

```typescript
// 只返回特定字段
const lightTraces = await apiClient.get<PaginatedResponse<Partial<Trace>>>('/v1/traces?fields=id,name,status');

// 包含关联数据
const tracesWithFarm = await apiClient.get<PaginatedResponse<Trace>>('/v1/traces?include=farm,product');
```

## 6. API版本控制

### 6.1 版本策略

- **URL版本控制**：通过URL路径指定版本（如 `/v1/`, `/v2/`）
- **向后兼容**：新版本保持向后兼容性
- **废弃通知**：废弃的API会在响应头中提供通知

### 6.2 Phase-3客户端版本处理

```typescript
// 指定API版本（当前默认v1）
const api_v1 = new ApiClient('/api/v1');
const api_v2 = new ApiClient('/api/v2');

// 检查API版本兼容性
const version = await apiClient.get<ApiVersion>('/version');
console.log(`当前API版本: ${version.current}, 支持的版本: ${version.supported.join(', ')}`);
```

## 7. 超时和重试机制

### 7.1 超时配置

```typescript
// 全局超时设置
const apiClient = new ApiClient('/api/v1', 15000); // 15秒超时

// 单次请求超时
const data = await apiClient.get<Data>('/v1/endpoint', { timeout: 5000 });
```

### 7.2 重试策略

```typescript
// 实现重试逻辑
async function apiWithRetry<T>(
  apiCall: () => Promise<T>, 
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error instanceof ApiError && error.code >= 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// 使用重试机制
const traces = await apiWithRetry(() => 
  apiClient.get<Trace[]>('/v1/traces')
);
```

## 8. Phase-3客户端最佳实践

### 8.1 类型安全

```typescript
// 定义完整的TypeScript接口
interface TraceCreateRequest {
  name: string;
  productId: string;
  quantity: number;
  unitWeight?: number;
  harvestDate: string;
  farmId: string;
}

interface TraceResponse {
  id: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

// 使用类型安全的API调用
const newTrace = await apiClient.post<TraceResponse>('/v1/traces', traceData);
```

### 8.2 错误边界处理

```typescript
// 创建API错误处理hook
const useApiCall = <T>(apiCall: () => Promise<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
};
```

### 8.3 性能优化

```typescript
// 使用SWR进行数据缓存
import useSWR from 'swr';

const useTraces = (page: number = 1, limit: number = 20) => {
  const { data, error } = useSWR(
    `/v1/traces?page=${page}&limit=${limit}`,
    (url) => apiClient.get<PaginatedResponse<Trace>>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1分钟内相同请求去重
    }
  );

  return {
    traces: data?.data,
    meta: data?.meta,
    isLoading: !error && !data,
    error
  };
};

// 批量请求优化
const batchLoad = async (ids: string[]) => {
  // 使用批量接口而不是多个单独请求
  return apiClient.post<Trace[]>('/v1/traces/batch', { ids });
};
```

### 8.4 环境配置

```typescript
// 环境变量配置
const getApiConfig = () => {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'development':
      return {
        baseURL: 'http://localhost:3001/api/v1',
        timeout: 10000,
        debug: true
      };
    case 'staging':
      return {
        baseURL: 'https://staging-api.example.com/v1',
        timeout: 15000,
        debug: false
      };
    case 'production':
      return {
        baseURL: 'https://api.example.com/v1',
        timeout: 20000,
        debug: false
      };
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
};

// 初始化客户端
const config = getApiConfig();
export const apiClient = new ApiClient(config.baseURL, config.timeout);
```

## 9. 安全考虑

### 9.1 请求验证

```typescript
// CSRF保护
const apiClient = new ApiClient('/api/v1', 10000, {
  headers: {
    'X-CSRF-Token': getCsrfToken()
  }
});

// 请求签名验证
const signedRequest = await apiClient.post('/v1/sensitive-operation', data, {
  headers: {
    'X-Request-Signature': generateSignature(data)
  }
});
```

### 9.2 敏感数据处理

```typescript
// 敏感数据不记录在日志中
const sensitiveApiCall = async (data: any) => {
  try {
    return await apiClient.post('/v1/auth/login', data);
  } catch (error) {
    // 不记录包含密码的请求数据
    console.error('Login failed:', error.message);
    throw error;
  }
};
```

---

**最后更新**：2025-05-22 (Phase-3技术栈现代化)

**注意事项**：
- 本文档与`web-app-next/src/lib/api.ts`中的实现保持同步
- Phase-3客户端提供完整的TypeScript类型支持
- 所有示例代码都可以直接在项目中使用
- 遵循最新的API接口设计规范 