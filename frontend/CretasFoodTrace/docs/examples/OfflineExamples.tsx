/**
 * 离线模式使用示例
 *
 * 展示如何在不同场景下使用离线模式功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useOfflineQueue, useNetworkState } from '../../hooks/useOfflineQueue';
import { OfflineIndicator } from '../../components/offline';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import { apiClient } from '../../services/api/apiClient';
import type { OfflineQueueItem } from '../../services/offline/types';

// ==================== 示例1: 基础离线表单 ====================

/**
 * 基础离线表单示例
 * 演示最简单的离线模式集成
 */
export function BasicOfflineFormExample() {
  const { isOnline, enqueue } = useOfflineQueue();
  const factoryId = getCurrentFactoryId();

  const handleSubmit = async () => {
    const formData = {
      batchNumber: 'MB' + Date.now(),
      materialType: '带鱼',
      quantity: 100,
      unit: 'kg',
      temperature: -18,
    };

    try {
      if (isOnline) {
        // 在线：直接提交
        const response = await apiClient.post(
          `/api/mobile/${factoryId}/materials`,
          formData
        );

        if (response.success) {
          Alert.alert('成功', '数据已提交');
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
          maxRetries: 3,
        });

        Alert.alert('离线模式', '数据已保存，网络恢复后自动同步');
      }
    } catch (error) {
      console.error('Submit failed:', error);
      Alert.alert('错误', '提交失败');
    }
  };

  return (
    <View style={styles.container}>
      <OfflineIndicator />
      <Text style={styles.status}>
        当前状态: {isOnline ? '在线' : '离线'}
      </Text>
      <Button title="提交表单" onPress={handleSubmit} />
    </View>
  );
}

// ==================== 示例2: 队列监控面板 ====================

/**
 * 队列监控面板
 * 显示队列统计和手动同步功能
 */
export function QueueMonitorExample() {
  const { queueStats, isSyncing, sync, retryFailed, clearQueue } =
    useOfflineQueue();

  const handleSync = async () => {
    try {
      const result = await sync();
      Alert.alert(
        '同步完成',
        `成功: ${result.succeeded}\n失败: ${result.failed}\n总计: ${result.total}`
      );
    } catch (error) {
      Alert.alert('同步失败', error instanceof Error ? error.message : '未知错误');
    }
  };

  const handleRetry = async () => {
    try {
      const result = await retryFailed();
      Alert.alert('重试完成', `成功: ${result.succeeded}`);
    } catch (error) {
      Alert.alert('重试失败', error instanceof Error ? error.message : '未知错误');
    }
  };

  const handleClear = () => {
    Alert.alert(
      '确认清空',
      '确定要清空所有队列吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            await clearQueue();
            Alert.alert('成功', '队列已清空');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>队列监控</Text>

      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>总计:</Text>
          <Text style={styles.statValue}>{queueStats.total}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>待同步:</Text>
          <Text style={[styles.statValue, styles.pending]}>
            {queueStats.pending}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>已同步:</Text>
          <Text style={[styles.statValue, styles.synced]}>
            {queueStats.synced}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>失败:</Text>
          <Text style={[styles.statValue, styles.failed]}>
            {queueStats.failed}
          </Text>
        </View>
      </View>

      {isSyncing && (
        <View style={styles.syncingIndicator}>
          <ActivityIndicator size="small" color="#1890ff" />
          <Text style={styles.syncingText}>同步中...</Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        <Button title="同步" onPress={handleSync} disabled={isSyncing} />
        <Button
          title="重试失败"
          onPress={handleRetry}
          disabled={isSyncing || queueStats.failed === 0}
        />
        <Button title="清空队列" onPress={handleClear} color="#ff4d4f" />
      </View>
    </View>
  );
}

// ==================== 示例3: 队列项目列表 ====================

/**
 * 队列项目列表
 * 显示所有队列项目的详细信息
 */
export function QueueItemsListExample() {
  const { getQueueItems, removeQueueItem } = useOfflineQueue();
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const queueItems = await getQueueItems();
      setItems(queueItems);
    } catch (error) {
      console.error('Load items failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个队列项吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await removeQueueItem(id);
            await loadItems(); // 重新加载列表
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#fa8c16';
      case 'syncing':
        return '#1890ff';
      case 'synced':
        return '#52c41a';
      case 'failed':
        return '#ff4d4f';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待同步';
      case 'syncing':
        return '同步中';
      case 'synced':
        return '已同步';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>队列为空</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>队列项目 ({items.length})</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemType}>{item.entityType}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {getStatusText(item.status)}
                </Text>
              </View>
            </View>

            <View style={styles.itemBody}>
              <Text style={styles.itemLabel}>操作: {item.operation}</Text>
              <Text style={styles.itemLabel}>端点: {item.endpoint}</Text>
              <Text style={styles.itemLabel}>
                重试次数: {item.retryCount} / {item.maxRetries}
              </Text>
              <Text style={styles.itemLabel}>
                创建时间: {new Date(item.createdAt).toLocaleString()}
              </Text>

              {item.error && (
                <Text style={styles.errorText}>错误: {item.error}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
            >
              <Text style={styles.deleteButtonText}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

// ==================== 示例4: 网络状态监控 ====================

/**
 * 网络状态监控
 * 实时显示网络连接状态
 */
export function NetworkStatusExample() {
  const { isOnline, isWiFi, networkType } = useNetworkState();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>网络状态</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#52c41a' : '#ff4d4f' },
            ]}
          />
          <Text style={styles.statusLabel}>
            {isOnline ? '在线' : '离线'}
          </Text>
        </View>

        {isOnline && (
          <>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>网络类型:</Text>
              <Text style={styles.statusValue}>{networkType}</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>WiFi:</Text>
              <Text style={styles.statusValue}>{isWiFi ? '是' : '否'}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ==================== 示例5: 完整离线表单页面 ====================

/**
 * 完整离线表单页面
 * 集成所有离线功能的完整示例
 */
export function CompleteOfflineFormExample() {
  const { isOnline, queueStats, enqueue, sync, isSyncing } = useOfflineQueue();
  const factoryId = getCurrentFactoryId();
  const [formData, setFormData] = useState({
    batchNumber: '',
    quantity: '',
    temperature: '',
  });

  const handleSubmit = async () => {
    if (!formData.batchNumber || !formData.quantity) {
      Alert.alert('错误', '请填写必填字段');
      return;
    }

    const payload = {
      batchNumber: formData.batchNumber,
      materialType: '带鱼',
      quantity: parseFloat(formData.quantity),
      unit: 'kg',
      temperature: parseFloat(formData.temperature) || -18,
    };

    try {
      if (isOnline) {
        // 在线提交
        const response = await apiClient.post(
          `/api/mobile/${factoryId}/materials`,
          payload
        );

        if (response.success) {
          Alert.alert('成功', '数据已提交');
          resetForm();
        }
      } else {
        // 离线入队
        await enqueue({
          entityType: 'material_batch',
          operation: 'CREATE',
          endpoint: `/api/mobile/${factoryId}/materials`,
          method: 'POST',
          payload,
          factoryId,
          priority: 8,
          maxRetries: 3,
        });

        Alert.alert(
          '离线模式',
          '数据已保存到队列，网络恢复后将自动同步'
        );
        resetForm();
      }
    } catch (error) {
      console.error('Submit failed:', error);
      Alert.alert('错误', '提交失败，请稍后重试');
    }
  };

  const resetForm = () => {
    setFormData({
      batchNumber: '',
      quantity: '',
      temperature: '',
    });
  };

  const handleManualSync = async () => {
    try {
      const result = await sync();
      Alert.alert(
        '同步完成',
        `成功: ${result.succeeded}\n失败: ${result.failed}`
      );
    } catch (error) {
      Alert.alert('同步失败', error instanceof Error ? error.message : '未知错误');
    }
  };

  return (
    <View style={styles.container}>
      {/* 离线状态指示器 */}
      <OfflineIndicator showDetails={true} />

      {/* 表单 */}
      <View style={styles.form}>
        <Text style={styles.formLabel}>批次号 *</Text>
        <Text style={styles.formInput}>
          {/* 实际项目中使用 TextInput */}
          批次号输入框
        </Text>

        <Text style={styles.formLabel}>数量 (kg) *</Text>
        <Text style={styles.formInput}>数量输入框</Text>

        <Text style={styles.formLabel}>温度 (°C)</Text>
        <Text style={styles.formInput}>温度输入框</Text>

        <Button title="提交" onPress={handleSubmit} />
      </View>

      {/* 队列统计 */}
      <View style={styles.queueStats}>
        <Text style={styles.statsTitle}>队列统计</Text>
        <Text>待同步: {queueStats.pending}</Text>
        <Text>已同步: {queueStats.synced}</Text>
        <Text>失败: {queueStats.failed}</Text>

        {queueStats.pending > 0 && (
          <Button
            title="手动同步"
            onPress={handleManualSync}
            disabled={isSyncing || !isOnline}
          />
        )}
      </View>
    </View>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },

  status: {
    fontSize: 16,
    marginBottom: 16,
    color: '#666',
  },

  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },

  statLabel: {
    fontSize: 14,
    color: '#666',
  },

  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  pending: {
    color: '#fa8c16',
  },

  synced: {
    color: '#52c41a',
  },

  failed: {
    color: '#ff4d4f',
  },

  syncingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  syncingText: {
    marginLeft: 8,
    color: '#1890ff',
  },

  buttonGroup: {
    gap: 8,
  },

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },

  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  itemType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },

  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  itemBody: {
    marginBottom: 12,
  },

  itemLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  errorText: {
    fontSize: 12,
    color: '#ff4d4f',
    marginTop: 8,
  },

  deleteButton: {
    backgroundColor: '#ff4d4f',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },

  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },

  statusLabel: {
    fontSize: 16,
    color: '#333',
  },

  statusValue: {
    fontSize: 14,
    color: '#666',
  },

  form: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },

  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  formInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    color: '#666',
  },

  queueStats: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },

  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },

  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default CompleteOfflineFormExample;
