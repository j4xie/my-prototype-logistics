# API 响应处理规范

## 概述

统一前端 API 响应处理模式，确保类型安全和一致的错误处理。

**最后更新**: 2025-12-25
**触发原因**: 发现 59+ 处不一致的 `response.data?.` 处理模式

---

## Rule 1: 后端统一响应格式

后端所有 API 返回统一格式：

```java
// 成功响应
{
  "success": true,
  "data": { ... },      // 实际业务数据
  "message": "操作成功"
}

// 失败响应
{
  "success": false,
  "data": null,
  "message": "错误信息",
  "code": "ERROR_CODE"   // 可选的错误码
}

// 分页响应
{
  "success": true,
  "data": {
    "content": [...],    // 数据列表
    "totalElements": 100,
    "totalPages": 10,
    "number": 0,         // 当前页码 (0-based)
    "size": 10
  }
}
```

---

## Rule 2: 前端响应解析模式

### 标准模式

```typescript
// ✅ GOOD: 使用统一的响应解析
async function fetchData() {
  try {
    const response = await apiClient.get('/endpoint');

    // 检查业务成功
    if (!response.success) {
      throw new ApiError(response.message, response.code);
    }

    // 安全访问数据
    const data = response.data;
    if (!data) {
      throw new ApiError('返回数据为空');
    }

    return data;
  } catch (error) {
    // 错误处理 (见 Rule 3)
    handleApiError(error);
    throw error;
  }
}
```

### 分页数据模式

```typescript
// ✅ GOOD: 分页数据解析
interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

async function fetchPagedData<T>(page: number): Promise<PageResponse<T>> {
  const response = await apiClient.get('/endpoint', { params: { page, size: 10 } });

  if (!response.success || !response.data) {
    throw new ApiError('获取分页数据失败');
  }

  return response.data as PageResponse<T>;
}
```

---

## Rule 3: 错误处理规范

### 禁止的模式

```typescript
// ❌ BAD: 使用 any 类型
catch (error: any) {
  console.log(error.message);
}

// ❌ BAD: 静默失败
catch (error) {
  console.error(error);
  // 没有用户提示
}

// ❌ BAD: 返回假数据
catch (error) {
  return { items: [], total: 0 }; // 用户以为真的是空
}
```

### 正确的模式

```typescript
// ✅ GOOD: 类型安全的错误处理
import { isAxiosError } from 'axios';

catch (error) {
  if (isAxiosError(error)) {
    // Axios 错误，有 response
    const message = error.response?.data?.message || '网络请求失败';
    const status = error.response?.status;

    if (status === 401) {
      // 处理认证过期
      handleAuthExpired();
    } else if (status === 403) {
      Alert.alert('权限不足', '您没有权限执行此操作');
    } else {
      Alert.alert('请求失败', message);
    }
  } else if (error instanceof Error) {
    // 普通 Error
    Alert.alert('操作失败', error.message);
  } else {
    // 未知错误
    Alert.alert('未知错误', '请稍后重试');
  }

  // 记录错误 (开发环境)
  if (__DEV__) {
    console.error('API Error:', error);
  }
}
```

---

## Rule 4: API Client 封装

### 推荐的 API Client 结构

```typescript
// apiClient.ts
class ApiClient {
  private axios: AxiosInstance;

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axios.get(url, config);
    return this.handleResponse<T>(response);
  }

  private handleResponse<T>(response: AxiosResponse): ApiResponse<T> {
    // 统一处理响应格式
    const data = response.data;

    // 后端可能直接返回数据，也可能包装在 { success, data, message }
    if ('success' in data && 'data' in data) {
      return data as ApiResponse<T>;
    }

    // 兼容直接返回数据的情况
    return {
      success: true,
      data: data as T,
      message: 'OK'
    };
  }
}
```

---

## 常见问题

### Q: 后端返回格式不统一怎么办？

A: 在 API Client 层统一处理：
```typescript
// 在 apiClient 的响应拦截器中处理
axios.interceptors.response.use((response) => {
  const data = response.data;

  // 如果已经是标准格式，直接返回
  if (data && typeof data.success === 'boolean') {
    return data;
  }

  // 包装为标准格式
  return {
    success: true,
    data: data,
    message: 'OK'
  };
});
```

### Q: 如何处理文件下载响应？

A: 文件下载使用 `responseType: 'blob'`，跳过 JSON 解析：
```typescript
async downloadFile(url: string): Promise<Blob> {
  const response = await this.axios.get(url, {
    responseType: 'blob'
  });
  return response.data;
}
```

---

## 相关文件

- `frontend/.../services/api/apiClient.ts` - 主 API 客户端
- `frontend/.../utils/errorHandler.ts` - 错误处理工具
- `backend/.../exception/GlobalExceptionHandler.java` - 后端统一异常处理
