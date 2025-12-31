# API 响应处理规范

## 统一响应格式

```json
// 成功
{ "success": true, "data": {...}, "message": "操作成功" }

// 失败
{ "success": false, "data": null, "message": "错误信息", "code": "ERROR_CODE" }

// 分页
{ "success": true, "data": { "content": [], "totalElements": 100, "totalPages": 10 } }
```

---

## 前端解析

```typescript
const response = await apiClient.get('/endpoint');
if (!response.success) {
  throw new ApiError(response.message, response.code);
}
return response.data;
```

---

## 错误处理

```typescript
// ✅ 正确
import { isAxiosError } from 'axios';

catch (error) {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) handleAuthExpired();
    else if (status === 403) Alert.alert('权限不足');
    else Alert.alert('请求失败', error.response?.data?.message);
  }
}

// ❌ 禁止
catch (error: any) { ... }           // 使用 any
catch (error) { console.log(error) } // 静默失败
catch (error) { return { items: [] } } // 返回假数据
```
