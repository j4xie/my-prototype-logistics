# 离线模式实现文档

## 概述

离线模式是白垩纪食品溯源系统的核心功能之一，支持在弱网或无网络环境下的数据采集和延迟同步。本文档详细介绍离线模式的实现原理、使用方法和最佳实践。

## 特性

- ✅ 自动检测网络状态
- ✅ 离线数据本地化存储 (AsyncStorage)
- ✅ 网络恢复后自动同步
- ✅ 同步失败自动重试 (最多3次)
- ✅ 冲突处理策略 (服务端优先)
- ✅ 队列优先级管理
- ✅ 批量同步优化
- ✅ 实时状态 UI 指示器

## 架构设计

```
┌──────────────────────────────────────────────────────────┐
│                     应用层                                │
│  (React Components / Screens)                            │
└────────────────┬─────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ useOfflineQueue │ ← Hook 层
         │      Hook       │
         └───────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐ ┌────▼─────┐ ┌────▼─────┐
│ Queue  │ │ Network  │ │   Sync   │ ← 服务层
│Service │ │ Monitor  │ │ Service  │
└───┬────┘ └────┬─────┘ └────┬─────┘
    │           │            │
    ▼           ▼            ▼
┌─────────────────────────────────┐
│     AsyncStorage / NetInfo      │ ← 底层依赖
└─────────────────────────────────┘
```

## 核心组件

### 1. OfflineQueueService

**职责**: 管理离线操作队列，提供入队/出队/持久化功能

**主要方法**:

```typescript
// 添加项目到队列
await offlineQueueService.enqueue({
  entityType: 'material_batch',
  operation: 'CREATE',
  endpoint: '/api/mobile/F001/materials',
  method: 'POST',
  payload: { batchNumber: 'MB001', quantity: 100 },
  maxRetries: 3,
  priority: 8,
});

// 获取队列统计
const stats = await offlineQueueService.getStats();
// { total: 5, pending: 3, syncing: 0, synced: 1, failed: 1, ... }

// 清空已同步项目
await offlineQueueService.clearSynced();
```

**存储结构**:

```typescript
interface OfflineQueueItem {
  id: string;                    // UUID
  entityType: EntityType;        // 实体类型
  operation: OperationType;      // CREATE | UPDATE | DELETE
  endpoint: string;              // API 路径
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: Record<string, unknown>;
  status: SyncStatus;            // pending | syncing | synced | failed
  retryCount: number;
  maxRetries: number;
  createdAt: string;             // ISO timestamp
  lastSyncAttempt?: string;
  error?: string;
  factoryId?: string;
  priority?: number;             // 1-10, 10最高
}
```

### 2. NetworkMonitor

**职责**: 监听网络状态变化，支持在线/离线检测

**主要方法**:

```typescript
// 检查是否在线
const isOnline = await networkMonitor.isOnline();

// 获取网络状态
const state = await networkMonitor.getState();
// { status: 'online', type: 'wifi', isConnected: true, ... }

// 订阅网络变化
const unsubscribe = networkMonitor.subscribe((state) => {
  console.log('Network changed:', state.status);
});

// 等待网络恢复
const recovered = await networkMonitor.waitForOnline(30000); // 30秒超时
```

**网络状态枚举**:

```typescript
type NetworkStatus = 'online' | 'offline' | 'unknown';
type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'none' | 'unknown';
```

### 3. SyncService

**职责**: 执行队列同步，处理重试和错误

**主要方法**:

```typescript
// 同步所有待同步项目
const result = await syncService.syncAll();
// { total: 5, succeeded: 4, failed: 1, results: [...] }

// 重试失败项目
const retryResult = await syncService.retryFailed();

// 订阅同步事件
const unsubscribe = syncService.subscribe((event) => {
  if (event.type === 'sync_start') {
    console.log('Sync started');
  } else if (event.type === 'sync_complete') {
    console.log('Sync completed:', event.data);
  }
});
```

**同步流程**:

```
1. 检查网络连接
2. 获取所有 pending 状态的队列项
3. 按优先级排序
4. 批量同步 (默认每批10项)
5. 失败项目标记为 failed，等待重试
6. 成功项目标记为 synced
7. 触发同步完成事件
```

### 4. useOfflineQueue Hook

**职责**: React Hook 封装，简化离线操作

**使用示例**:

```typescript
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

function MaterialBatchScreen() {
  const { isOnline, queueStats, enqueue, sync, isSyncing } = useOfflineQueue();

  const handleSubmit = async (data) => {
    if (isOnline) {
      // 在线：直接调用API
      await apiClient.post('/api/materials', data);
      Alert.alert('成功', '数据已提交');
    } else {
      // 离线：添加到队列
      await enqueue({
        entityType: 'material_batch',
        operation: 'CREATE',
        endpoint: '/api/materials',
        method: 'POST',
        payload: data,
        maxRetries: 3,
        priority: 8,
      });
      Alert.alert('离线模式', '数据已保存，网络恢复后自动同步');
    }
  };

  return (
    <View>
      {/* 显示离线状态 */}
      <OfflineIndicator />

      {/* 显示队列统计 */}
      <Text>待同步: {queueStats.pending} 项</Text>

      {/* 手动同步按钮 */}
      <Button
        title="手动同步"
        onPress={sync}
        disabled={isSyncing || !isOnline}
      />
    </View>
  );
}
```

### 5. OfflineIndicator 组件

**职责**: UI 指示器，显示网络状态和队列信息

**使用示例**:

```tsx
import { OfflineIndicator } from '@/components/offline';

// 基础用法
<OfflineIndicator />

// 显示详细信息
<OfflineIndicator showDetails={true} />

// 监听同步事件
<OfflineIndicator
  showDetails={true}
  onSyncComplete={() => Alert.alert('同步完成')}
  onSyncError={(error) => Alert.alert('同步失败', error.message)}
/>

// 简化版本
import { OfflineBanner } from '@/components/offline';
<OfflineBanner />
```

**显示效果**:

```
┌──────────────────────────────────────┐
│ ● 离线模式         [3]      [同步]    │ ← 离线状态
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ● 已连接           [2]      [同步]    │ ← 在线状态 (有待同步项)
└──────────────────────────────────────┘
```

## 使用场景

### 场景1: 原料批次录入 (离线支持)

```typescript
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { getCurrentFactoryId } from '@/utils/factoryIdHelper';

function MaterialBatchCreateScreen() {
  const { isOnline, enqueue } = useOfflineQueue();
  const factoryId = getCurrentFactoryId();

  const handleSubmit = async (formData) => {
    try {
      if (isOnline) {
        // 在线：直接提交
        const response = await apiClient.post(
          `/api/mobile/${factoryId}/materials`,
          formData
        );

        if (response.success) {
          Alert.alert('成功', '原料批次创建成功');
          navigation.goBack();
        }
      } else {
        // 离线：入队
        await enqueue({
          entityType: 'material_batch',
          operation: 'CREATE',
          endpoint: `/api/mobile/${factoryId}/materials`,
          method: 'POST',
          payload: formData,
          factoryId,
          priority: 8,
          maxRetries: 3,
        });

        Alert.alert(
          '离线模式',
          '数据已保存到本地队列，网络恢复后将自动上传'
        );
        navigation.goBack();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      Alert.alert('错误', '提交失败');
    }
  };

  return (
    <View>
      <OfflineIndicator />
      <DynamicForm onSubmit={handleSubmit} />
    </View>
  );
}
```

### 场景2: 质检记录 (离线支持)

```typescript
function QualityInspectionScreen() {
  const { isOnline, enqueue } = useOfflineQueue();
  const factoryId = getCurrentFactoryId();

  const handleInspection = async (inspectionData) => {
    if (isOnline) {
      await apiClient.post(
        `/api/mobile/${factoryId}/quality-inspections`,
        inspectionData
      );
    } else {
      await enqueue({
        entityType: 'quality_inspection',
        operation: 'CREATE',
        endpoint: `/api/mobile/${factoryId}/quality-inspections`,
        method: 'POST',
        payload: inspectionData,
        factoryId,
        priority: 9, // 质检数据优先级高
      });
    }
  };

  return <InspectionForm onSubmit={handleInspection} />;
}
```

### 场景3: 全局离线状态监控

```typescript
// App.tsx
import { OfflineIndicator } from '@/components/offline';

function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* 全局离线指示器 */}
      <OfflineIndicator showDetails={true} />

      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaView>
  );
}
```

## 配置选项

### OfflineQueueService 配置

```typescript
import { offlineQueueService } from '@/services/offline';

offlineQueueService.updateConfig({
  maxQueueSize: 500,              // 最大队列大小
  defaultMaxRetries: 3,           // 默认重试次数
  retryDelay: 2000,               // 重试延迟 (毫秒)
  conflictResolution: 'server_wins', // 冲突策略
  autoSync: true,                 // 自动同步
  syncOnWifiOnly: false,          // 仅WiFi同步
  syncBatchSize: 10,              // 批量同步大小
});
```

### SyncService 配置

```typescript
import { syncService } from '@/services/offline';

syncService.updateConfig({
  batchSize: 10,       // 每批同步项目数
  retryDelay: 2000,    // 重试延迟
  wifiOnly: false,     // 仅WiFi同步
  concurrency: 3,      // 并发请求数
});
```

## 数据流程

### 离线数据提交流程

```
用户填写表单
    ↓
检测网络状态
    ↓
┌──────────┬──────────┐
│  在线    │  离线    │
│  ↓       │  ↓       │
│ 直接API  │ 入队列   │
│  ↓       │  ↓       │
│ 服务器   │ AsyncStorage │
│  ↓       │  ↓       │
│ 成功提示 │ 离线提示 │
└──────────┴──────────┘
```

### 网络恢复同步流程

```
网络状态变为在线
    ↓
触发自动同步
    ↓
从队列中取出 pending 项目
    ↓
批量发送到服务器
    ↓
┌────────┬─────────┐
│ 成功   │  失败   │
│  ↓     │   ↓     │
│ synced │ failed  │
│  ↓     │   ↓     │
│ 清理   │ 等待重试 │
└────────┴─────────┘
```

## 错误处理

### 同步失败处理

```typescript
const { sync } = useOfflineQueue();

try {
  const result = await sync();

  if (result.failed > 0) {
    Alert.alert(
      '部分同步失败',
      `${result.succeeded} 项成功，${result.failed} 项失败`,
      [
        { text: '查看详情', onPress: () => showFailedItems() },
        { text: '重试', onPress: () => retryFailed() },
        { text: '取消', style: 'cancel' },
      ]
    );
  } else {
    Alert.alert('同步成功', `已同步 ${result.succeeded} 项数据`);
  }
} catch (error) {
  Alert.alert('同步失败', error.message);
}
```

### 队列满处理

```typescript
try {
  await enqueue({...});
} catch (error) {
  if (error.message.includes('队列已满')) {
    Alert.alert(
      '队列已满',
      '请先同步已有数据或清理队列',
      [
        { text: '立即同步', onPress: sync },
        { text: '清理已同步', onPress: clearSynced },
      ]
    );
  }
}
```

## 性能优化

### 1. 批量同步

```typescript
// 避免逐项同步
for (const item of items) {
  await syncItem(item); // ❌ 低效
}

// 使用批量同步
await syncService.syncAll(); // ✅ 高效
```

### 2. 优先级队列

```typescript
// 高优先级数据优先同步
await enqueue({
  ...data,
  priority: 10, // 紧急数据
});

await enqueue({
  ...normalData,
  priority: 5, // 普通数据
});
```

### 3. 清理已同步数据

```typescript
// 定期清理已同步数据，减少队列大小
useEffect(() => {
  const interval = setInterval(async () => {
    await offlineQueueService.clearSynced();
  }, 1000 * 60 * 60); // 每小时清理

  return () => clearInterval(interval);
}, []);
```

## 最佳实践

### 1. 总是检查网络状态

```typescript
// ✅ 正确
const { isOnline, enqueue } = useOfflineQueue();

if (isOnline) {
  await apiClient.post(...);
} else {
  await enqueue(...);
}

// ❌ 错误 - 不检查网络
await apiClient.post(...); // 可能失败
```

### 2. 使用 OfflineIndicator 提供用户反馈

```tsx
// ✅ 正确 - 让用户知道离线状态
<View>
  <OfflineIndicator showDetails={true} />
  <YourForm />
</View>

// ❌ 错误 - 用户不知道处于离线模式
<YourForm />
```

### 3. 设置合理的重试次数

```typescript
// ✅ 正确 - 根据数据重要性设置重试
await enqueue({
  ...criticalData,
  maxRetries: 5, // 关键数据多次重试
});

await enqueue({
  ...logData,
  maxRetries: 1, // 日志数据少次重试
});

// ❌ 错误 - 所有数据都无限重试
maxRetries: 999
```

### 4. 处理同步事件

```typescript
// ✅ 正确 - 监听同步事件
const { sync } = useOfflineQueue();

const handleSync = async () => {
  try {
    const result = await sync();
    showSuccessMessage(result);
  } catch (error) {
    showErrorMessage(error);
  }
};

// ❌ 错误 - 不处理同步结果
await sync(); // 用户不知道是否成功
```

## 测试建议

### 1. 模拟离线场景

```typescript
// 在开发模式下测试离线功能
// 使用 iOS Simulator 或 Android Emulator 的网络开关
// 或使用 Network Link Conditioner (Mac)
```

### 2. 验证数据持久化

```typescript
// 1. 离线状态下提交数据
// 2. 关闭应用
// 3. 重新打开应用
// 4. 检查队列是否保留数据
const stats = await offlineQueueService.getStats();
console.log('Pending items:', stats.pending);
```

### 3. 测试冲突处理

```typescript
// 1. 离线修改数据A
// 2. 服务器上同时修改数据A
// 3. 网络恢复后同步
// 4. 验证冲突处理策略是否生效
```

## 故障排查

### 问题1: 队列数据丢失

**原因**: AsyncStorage 清除或初始化失败

**解决**:
```typescript
// 检查存储权限
import AsyncStorage from '@react-native-async-storage/async-storage';

try {
  const keys = await AsyncStorage.getAllKeys();
  console.log('Storage keys:', keys);
} catch (error) {
  console.error('Storage access failed:', error);
}
```

### 问题2: 网络恢复后不自动同步

**原因**: NetworkMonitor 未正确初始化

**解决**:
```typescript
// 确保在 App 启动时初始化
useEffect(() => {
  networkMonitor.initialize();
}, []);

// 检查网络监听
const state = await networkMonitor.getState();
console.log('Network state:', state);
```

### 问题3: 同步一直失败

**原因**: Token 过期或 API 错误

**解决**:
```typescript
// 检查队列项的错误信息
const items = await offlineQueueService.getAll('failed');
items.forEach(item => {
  console.log('Failed item:', item.id, item.error);
});

// 检查是否为认证问题
if (item.error.includes('401')) {
  // 刷新 Token 后重试
  await refreshToken();
  await syncService.retryFailed();
}
```

## 未来扩展

### 1. SQLite 支持

对于大量数据，可以考虑使用 expo-sqlite 替代 AsyncStorage:

```typescript
import * as SQLite from 'expo-sqlite';

// 创建数据库表
const db = SQLite.openDatabase('offline_queue.db');
db.transaction(tx => {
  tx.executeSql(
    'CREATE TABLE IF NOT EXISTS queue (id TEXT PRIMARY KEY, data TEXT);'
  );
});
```

### 2. 冲突解决 UI

提供手动解决冲突的界面:

```tsx
<ConflictResolver
  conflicts={conflicts}
  onResolve={(resolution) => handleConflict(resolution)}
/>
```

### 3. 增量同步

只同步修改的字段，减少网络流量:

```typescript
{
  operation: 'UPDATE',
  payload: {
    id: 'MB001',
    changedFields: { quantity: 150 } // 只同步修改的字段
  }
}
```

## 总结

离线模式为白垩纪系统提供了在弱网环境下的可靠数据采集能力。通过合理使用 OfflineQueueService、NetworkMonitor 和 SyncService，可以实现无缝的离线/在线切换体验。

**关键要点**:
- ✅ 始终检查网络状态
- ✅ 使用 OfflineIndicator 提供用户反馈
- ✅ 设置合理的重试策略
- ✅ 定期清理已同步数据
- ✅ 处理同步事件和错误

## 相关文档

- [API Response Handling](./.claude/rules/api-response-handling.md)
- [TypeScript Type Safety](./.claude/rules/typescript-type-safety.md)
- [Database Entity Sync](./.claude/rules/database-entity-sync.md)
