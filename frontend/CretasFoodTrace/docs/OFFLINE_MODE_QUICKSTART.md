# 离线模式快速开始指南

## 5分钟快速集成

### 1. 引入依赖

离线模式已内置在项目中，无需安装额外依赖。

### 2. 在应用入口添加离线指示器

```tsx
// App.tsx
import React from 'react';
import { SafeAreaView } from 'react-native';
import { OfflineIndicator } from './src/components/offline';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* 全局离线状态指示器 */}
      <OfflineIndicator showDetails={true} />

      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaView>
  );
}
```

### 3. 在表单页面使用离线模式

```tsx
// MaterialBatchCreateScreen.tsx
import React from 'react';
import { View, Alert } from 'react-native';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { getCurrentFactoryId } from '@/utils/factoryIdHelper';
import { DynamicForm } from '@/formily/core';
import { apiClient } from '@/services/api';

export function MaterialBatchCreateScreen() {
  const { isOnline, enqueue } = useOfflineQueue();
  const factoryId = getCurrentFactoryId();

  const handleSubmit = async (formData: any) => {
    try {
      if (isOnline) {
        // 在线：直接提交API
        const response = await apiClient.post(
          `/api/mobile/${factoryId}/materials`,
          formData
        );

        if (response.success) {
          Alert.alert('成功', '原料批次创建成功');
        }
      } else {
        // 离线：添加到队列
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
          '数据已保存，网络恢复后将自动同步'
        );
      }
    } catch (error) {
      console.error('Submit failed:', error);
      Alert.alert('错误', '提交失败，请稍后重试');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <DynamicForm
        entityType="material_batch"
        onSubmit={handleSubmit}
      />
    </View>
  );
}
```

### 4. 完成！

就是这么简单！现在你的应用已支持离线模式。

## 常见使用场景

### 场景1: 原料批次录入

```typescript
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

function MaterialBatchScreen() {
  const { isOnline, enqueue } = useOfflineQueue();

  const handleCreateBatch = async (data) => {
    if (isOnline) {
      await apiClient.post('/api/materials', data);
    } else {
      await enqueue({
        entityType: 'material_batch',
        operation: 'CREATE',
        endpoint: '/api/materials',
        method: 'POST',
        payload: data,
      });
    }
  };

  return <BatchForm onSubmit={handleCreateBatch} />;
}
```

### 场景2: 加工批次记录

```typescript
function ProcessingBatchScreen() {
  const { isOnline, enqueue } = useOfflineQueue();

  const handleRecordProcessing = async (data) => {
    if (isOnline) {
      await apiClient.post('/api/processing', data);
    } else {
      await enqueue({
        entityType: 'processing_batch',
        operation: 'CREATE',
        endpoint: '/api/processing',
        method: 'POST',
        payload: data,
        priority: 9, // 加工数据优先级高
      });
    }
  };

  return <ProcessingForm onSubmit={handleRecordProcessing} />;
}
```

### 场景3: 质检记录

```typescript
function QualityInspectionScreen() {
  const { isOnline, enqueue } = useOfflineQueue();

  const handleInspection = async (data) => {
    if (isOnline) {
      await apiClient.post('/api/quality-inspections', data);
    } else {
      await enqueue({
        entityType: 'quality_inspection',
        operation: 'CREATE',
        endpoint: '/api/quality-inspections',
        method: 'POST',
        payload: data,
        priority: 10, // 质检数据最高优先级
      });
    }
  };

  return <InspectionForm onSubmit={handleInspection} />;
}
```

## 高级用法

### 1. 监听队列状态

```typescript
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

function Dashboard() {
  const { queueStats, isSyncing } = useOfflineQueue();

  return (
    <View>
      <Text>待同步: {queueStats.pending} 项</Text>
      <Text>已同步: {queueStats.synced} 项</Text>
      <Text>失败: {queueStats.failed} 项</Text>
      {isSyncing && <ActivityIndicator />}
    </View>
  );
}
```

### 2. 手动触发同步

```typescript
function SyncButton() {
  const { sync, isSyncing, isOnline } = useOfflineQueue();

  const handleSync = async () => {
    try {
      const result = await sync();
      Alert.alert(
        '同步完成',
        `成功: ${result.succeeded}, 失败: ${result.failed}`
      );
    } catch (error) {
      Alert.alert('同步失败', error.message);
    }
  };

  return (
    <Button
      title="同步"
      onPress={handleSync}
      disabled={isSyncing || !isOnline}
    />
  );
}
```

### 3. 重试失败项目

```typescript
function FailedItemsScreen() {
  const { retryFailed, queueStats } = useOfflineQueue();

  const handleRetry = async () => {
    try {
      const result = await retryFailed();
      Alert.alert('重试完成', `成功: ${result.succeeded}`);
    } catch (error) {
      Alert.alert('重试失败', error.message);
    }
  };

  return (
    <View>
      <Text>失败项目: {queueStats.failed}</Text>
      <Button title="重试" onPress={handleRetry} />
    </View>
  );
}
```

### 4. 查看队列详情

```typescript
function QueueViewer() {
  const { getQueueItems } = useOfflineQueue();
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const queueItems = await getQueueItems();
    setItems(queueItems);
  };

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => (
        <View>
          <Text>{item.entityType}</Text>
          <Text>{item.status}</Text>
          <Text>{item.createdAt}</Text>
        </View>
      )}
    />
  );
}
```

## 自定义配置

### 修改队列配置

```typescript
import { offlineQueueService } from '@/services/offline';

// 在应用启动时配置
useEffect(() => {
  offlineQueueService.updateConfig({
    maxQueueSize: 1000,        // 增加队列大小
    defaultMaxRetries: 5,      // 增加重试次数
    syncBatchSize: 20,         // 增加批量大小
  });
}, []);
```

### 修改同步配置

```typescript
import { syncService } from '@/services/offline';

useEffect(() => {
  syncService.updateConfig({
    batchSize: 15,             // 每批同步15项
    wifiOnly: true,            // 仅WiFi下同步
    concurrency: 5,            // 增加并发数
  });
}, []);
```

## 调试技巧

### 1. 查看队列统计

```typescript
import { offlineQueueService } from '@/services/offline';

const stats = await offlineQueueService.getStats();
console.log('Queue stats:', stats);
// {
//   total: 10,
//   pending: 5,
//   syncing: 0,
//   synced: 3,
//   failed: 2,
//   byEntityType: { material_batch: 5, quality_inspection: 5 }
// }
```

### 2. 查看网络状态

```typescript
import { networkMonitor } from '@/services/offline';

const state = await networkMonitor.getState();
console.log('Network state:', state);
// {
//   status: 'online',
//   type: 'wifi',
//   isConnected: true,
//   isInternetReachable: true
// }
```

### 3. 监听同步事件

```typescript
import { syncService } from '@/services/offline';

useEffect(() => {
  const unsubscribe = syncService.subscribe((event) => {
    console.log('Sync event:', event.type, event.data);
  });

  return unsubscribe;
}, []);
```

## 常见问题

### Q1: 离线数据会丢失吗？

**A**: 不会。数据保存在 AsyncStorage 中，应用关闭后重新打开仍然存在。

### Q2: 网络恢复后会自动同步吗？

**A**: 是的。NetworkMonitor 检测到网络恢复时会自动触发同步。

### Q3: 同步失败怎么办？

**A**: 失败的项目会自动重试（默认最多3次）。用户也可以手动触发重试。

### Q4: 如何知道数据是否已同步？

**A**: 使用 `queueStats` 查看队列状态，或使用 `OfflineIndicator` 组件显示实时状态。

### Q5: 可以清空队列吗？

**A**: 可以。使用 `clearQueue()` 清空所有项目，或 `clearSynced()` 只清理已同步的项目。

## 下一步

- 阅读完整文档: [OFFLINE_MODE.md](./OFFLINE_MODE.md)
- 查看示例代码: [examples/OfflineExamples.tsx](./examples/OfflineExamples.tsx)
- 了解高级配置: [OFFLINE_MODE.md#配置选项](./OFFLINE_MODE.md#配置选项)

## 技术支持

如有问题，请联系开发团队或查看项目文档。
