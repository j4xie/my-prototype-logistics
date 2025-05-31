# useApi v2 迁移指南

## 概述

由于原版本 `useApi` 存在严重的无限循环问题，我们开发了 `useApi-v2` 版本来解决这些问题。本指南将帮助您顺利迁移到新版本。

## 问题背景

原版本存在的问题：
- ✗ React Hook 无限循环导致内存溢出
- ✗ 复杂的依赖管理导致性能问题
- ✗ 缺少请求取消机制
- ✗ 无法处理组件快速卸载的情况

## 新版本优势

V2版本的改进：
- ✅ 彻底解决无限循环问题
- ✅ 增加 AbortController 请求取消功能
- ✅ 简化的依赖管理，更好的性能
- ✅ 改进的错误处理和重试机制
- ✅ 完全向后兼容的API设计

## 迁移步骤

### 1. 导入更改

```typescript
// 原版本 (已弃用)
import { useBaseApi, useTrace, useProduct } from '@/hooks/useApi';

// 新版本
import { useSimpleApi, useTraceV2, useProductV2 } from '@/hooks/useApi-v2';
```

### 2. Hook替换对照表

| 原版本 (V1) | 新版本 (V2) | 说明 |
|-------------|-------------|------|
| `useBaseApi` | `useSimpleApi` | 核心API Hook |
| `useAuth().useLogin` | `useAuthV2().useLogin` | 认证相关 |
| `useTrace().useTraces` | `useTraceV2().useTraces` | 溯源相关 |
| `useProduct().useProducts` | `useProductV2().useProducts` | 产品相关 |
| `useUser().useProfile` | `useUserV2().useProfile` | 用户相关 |
| `useDashboard().useStats` | `useDashboardV2().useStats` | 仪表板相关 |

### 3. API签名变化

#### 基础API Hook

```typescript
// V1 (有问题的版本)
const { data, loading, error, refetch, clearCache } = useBaseApi(
  () => api.getData(),
  { 
    cacheKey: 'data-key',
    immediate: true 
  }
);

// V2 (修复版本)
const { data, loading, error, refetch, cancel } = useSimpleApi(
  (signal) => api.getData(), // 支持AbortSignal
  { 
    cacheKey: 'data-key',
    immediate: true,
    timeout: 30000 // 新增：请求超时
  }
);
```

#### 业务Hook

```typescript
// V1
const { data: traces } = useTrace().useTraces({ page: 1 });

// V2
const { data: traces } = useTraceV2().useTraces({ page: 1 });
```

### 4. 新增功能

#### 请求取消

```typescript
const { data, loading, cancel } = useSimpleApi(
  (signal) => fetch('/api/data', { signal }),
  { immediate: true }
);

// 组件卸载时自动取消
// 或手动取消
const handleCancel = () => {
  cancel();
};
```

#### 改进的错误处理

```typescript
const { data, error, refetch } = useSimpleApi(
  (signal) => api.getData(),
  {
    retry: true,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000
  }
);
```

#### 轮询优化

```typescript
const { data } = useSimpleApi(
  (signal) => api.getStats(),
  {
    polling: true,
    pollingInterval: 30000, // 30秒轮询
    // 轮询期间不会中断正在进行的请求
  }
);
```

## 完整迁移示例

### 溯源列表组件

```typescript
// ❌ 原版本
import { useTrace } from '@/hooks/useApi';

export function TraceList() {
  const { data: traces, loading, error, refetch } = useTrace().useTraces({ 
    page: 1 
  });

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      {traces?.map(trace => (
        <div key={trace.id}>{trace.batchCode}</div>
      ))}
      <button onClick={refetch}>刷新</button>
    </div>
  );
}
```

```typescript
// ✅ 新版本
import { useTraceV2 } from '@/hooks/useApi-v2';

export function TraceList() {
  const { data: traces, loading, error, refetch, cancel } = useTraceV2().useTraces({ 
    page: 1 
  });

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      {traces?.map(trace => (
        <div key={trace.id}>{trace.batchCode}</div>
      ))}
      <button onClick={refetch}>刷新</button>
      <button onClick={cancel}>取消请求</button>
    </div>
  );
}
```

### 自定义API Hook

```typescript
// ❌ 原版本
import { useBaseApi } from '@/hooks/useApi';

export function useCustomData(params: any) {
  return useBaseApi(() => api.getCustomData(params), {
    cacheKey: `custom-${JSON.stringify(params)}`,
    immediate: true
  });
}
```

```typescript
// ✅ 新版本
import { useSimpleApi } from '@/hooks/useApi-v2';

export function useCustomData(params: any) {
  return useSimpleApi(
    (signal) => api.getCustomData(params, { signal }), // 支持请求取消
    {
      cacheKey: `custom-${JSON.stringify(params)}`,
      immediate: true,
      timeout: 10000, // 10秒超时
      retry: true,
      retryAttempts: 2
    }
  );
}
```

## 测试迁移

### 运行测试

```bash
# 测试新版本功能
npm test -- tests/unit/hooks/useApi-v2.test.tsx

# 运行比较测试
npm test -- tests/unit/hooks/useApi-comparison.test.tsx

# 运行所有Hook测试
npm test -- tests/unit/hooks/
```

### 性能测试

```typescript
// 测试无限循环修复
import { useSimpleApi } from '@/hooks/useApi-v2';

function TestComponent() {
  const { data } = useSimpleApi(
    () => fetch('/api/test'),
    { immediate: true }
  );
  
  // 应该不会导致无限重新渲染
  console.log('组件渲染次数');
  
  return <div>{data?.message}</div>;
}
```

## 渐进式迁移计划

### 阶段1：并行运行 (1-2周)
- 保留原版本代码
- 新组件使用V2版本
- 运行两套测试确保一致性

### 阶段2：逐步迁移 (2-3周)
- 迁移关键业务组件
- 重点测试无限循环修复
- 监控性能指标

### 阶段3：完全替换 (1周)
- 替换所有组件
- 删除原版本代码
- 更新文档和类型定义

## 注意事项

### 1. 服务层适配

确保您的服务层支持AbortSignal：

```typescript
// ✅ 正确的服务实现
export class ApiService {
  async getData(params: any, options?: { signal?: AbortSignal }) {
    return fetch('/api/data', {
      signal: options?.signal,
      body: JSON.stringify(params)
    });
  }
}
```

### 2. 错误处理

新版本区分AbortError和其他错误：

```typescript
const { error } = useSimpleApi(apiCall, {
  onError: (error) => {
    if (error.name === 'AbortError') {
      console.log('请求被取消');
    } else {
      console.error('API错误:', error);
    }
  }
});
```

### 3. 缓存策略

缓存行为保持一致，但建议清理旧缓存：

```typescript
import { clearAllCache } from '@/hooks/useApi-v2';

// 在应用启动时清理缓存
clearAllCache();
```

## 故障排除

### 常见问题

1. **类型错误**：确保导入路径正确
2. **测试失败**：检查Mock函数是否支持signal参数
3. **性能问题**：验证是否正确使用了缓存key

### 回滚计划

如果遇到问题，可以快速回滚：

```typescript
// 临时回滚到V1（不推荐长期使用）
import { useBaseApi as useSimpleApi } from '@/hooks/useApi';
```

## 总结

V2版本不仅解决了关键的无限循环问题，还提供了更好的用户体验和开发体验。建议尽快完成迁移，享受更稳定、更高性能的API调用体验。

如有问题，请参考代码示例或联系开发团队。 