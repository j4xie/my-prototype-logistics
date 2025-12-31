# 离线模式服务

## 目录结构

```
src/services/offline/
├── types.ts                  # 类型定义
├── OfflineQueueService.ts    # 队列服务
├── NetworkMonitor.ts         # 网络监控
├── SyncService.ts            # 同步服务
├── index.ts                  # 导出文件
└── README.md                 # 本文档

src/hooks/
└── useOfflineQueue.ts        # React Hook

src/components/offline/
├── OfflineIndicator.tsx      # UI 组件
└── index.ts                  # 导出文件
```

## 快速开始

### 1. 引入 Hook

```typescript
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

function MyComponent() {
  const { isOnline, enqueue } = useOfflineQueue();
  // ...
}
```

### 2. 添加离线支持

```typescript
const handleSubmit = async (data) => {
  if (isOnline) {
    await apiClient.post('/api/endpoint', data);
  } else {
    await enqueue({
      entityType: 'material_batch',
      operation: 'CREATE',
      endpoint: '/api/endpoint',
      method: 'POST',
      payload: data,
    });
  }
};
```

### 3. 显示离线状态

```tsx
import { OfflineIndicator } from '@/components/offline';

<OfflineIndicator showDetails={true} />
```

## 核心功能

### OfflineQueueService

**职责**: 管理离线操作队列

```typescript
import { offlineQueueService } from '@/services/offline';

// 添加到队列
await offlineQueueService.enqueue({...});

// 获取统计
const stats = await offlineQueueService.getStats();

// 清空队列
await offlineQueueService.clear();
```

### NetworkMonitor

**职责**: 监听网络状态

```typescript
import { networkMonitor } from '@/services/offline';

// 检查在线状态
const isOnline = await networkMonitor.isOnline();

// 订阅状态变化
const unsubscribe = networkMonitor.subscribe((state) => {
  console.log('Network:', state.status);
});
```

### SyncService

**职责**: 同步队列数据

```typescript
import { syncService } from '@/services/offline';

// 同步所有
const result = await syncService.syncAll();

// 重试失败
await syncService.retryFailed();

// 监听同步事件
syncService.subscribe((event) => {
  console.log('Sync event:', event.type);
});
```

## API 参考

### useOfflineQueue()

```typescript
interface UseOfflineQueueReturn {
  isOnline: boolean;
  queueStats: QueueStats;
  isSyncing: boolean;
  enqueue: (item) => Promise<string>;
  sync: () => Promise<SyncResult>;
  clearQueue: () => Promise<void>;
  getQueueItems: () => Promise<OfflineQueueItem[]>;
  removeQueueItem: (id: string) => Promise<void>;
  retryFailed: () => Promise<SyncResult>;
}
```

### OfflineQueueItem

```typescript
interface OfflineQueueItem {
  id: string;
  entityType: EntityType;
  operation: OperationType;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: Record<string, unknown>;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastSyncAttempt?: string;
  error?: string;
  factoryId?: string;
  priority?: number;
}
```

### QueueStats

```typescript
interface QueueStats {
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  byEntityType: Record<EntityType, number>;
  oldestItem?: string;
  newestItem?: string;
}
```

## 配置

### 队列配置

```typescript
offlineQueueService.updateConfig({
  maxQueueSize: 500,
  defaultMaxRetries: 3,
  retryDelay: 2000,
  autoSync: true,
});
```

### 同步配置

```typescript
syncService.updateConfig({
  batchSize: 10,
  wifiOnly: false,
  concurrency: 3,
});
```

## 最佳实践

1. **总是检查网络状态**
   ```typescript
   if (isOnline) {
     // 在线操作
   } else {
     // 离线操作
   }
   ```

2. **使用 OfflineIndicator**
   ```tsx
   <OfflineIndicator showDetails={true} />
   ```

3. **设置合理的优先级**
   ```typescript
   priority: 10 // 紧急数据
   priority: 5  // 普通数据
   ```

4. **处理同步结果**
   ```typescript
   const result = await sync();
   if (result.failed > 0) {
     // 处理失败
   }
   ```

## 故障排查

### 队列数据丢失

检查 AsyncStorage:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
const keys = await AsyncStorage.getAllKeys();
console.log('Keys:', keys);
```

### 网络恢复不同步

检查网络监听:
```typescript
const state = await networkMonitor.getState();
console.log('Network:', state);
```

### 同步一直失败

查看错误信息:
```typescript
const items = await offlineQueueService.getAll('failed');
items.forEach(item => console.log(item.error));
```

## 完整文档

- [OFFLINE_MODE.md](../../../docs/OFFLINE_MODE.md) - 完整功能文档
- [OFFLINE_MODE_QUICKSTART.md](../../../docs/OFFLINE_MODE_QUICKSTART.md) - 快速开始
- [OfflineExamples.tsx](../../../docs/examples/OfflineExamples.tsx) - 示例代码

## 技术支持

如有问题，请查看完整文档或联系开发团队。
