/**
 * 工序管理 — 工序列表
 *
 * 入口: 系统管理 (ManagementHome / FAManagement) → 工序管理
 * Track D2 — M-WP-1
 *
 * 客户场景 (六扇门第四次会议 line 59-66):
 *   "系统管理 → 工序管理 → 看到了。产品工序配置..."
 *   "先是在工序里面配置有哪些工序, 然后再到产品工序配置里面去添加。"
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Card,
  Chip,
  FAB,
  IconButton,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { workProcessApiClient } from '../../../services/api/workProcessApiClient';
import { useAuthStore } from '../../../store/authStore';
import { getFactoryId } from '../../../types/auth';
import { logger } from '../../../utils/logger';
import type { ManagementStackParamList } from '../../../types/navigation';
import {
  WORK_PROCESS_CATEGORIES,
  type WorkProcess,
} from '../../../types/workProcess';

const workProcessLogger = logger.createContextLogger('WorkProcessList');

type NavigationProp = NativeStackNavigationProp<
  ManagementStackParamList,
  'WorkProcessList'
>;

function getCategoryLabel(value?: string): string {
  if (!value) return '-';
  const match = WORK_PROCESS_CATEGORIES.find((c) => c.value === value);
  return match ? match.label : value;
}

export default function WorkProcessListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  const [items, setItems] = useState<WorkProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadList = useCallback(
    async (silent = false) => {
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息, 请重新登录');
        setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        const list = await workProcessApiClient.listWorkProcesses({
          factoryId,
          page: 1,
          size: 100,
          sortBy: 'sortOrder',
          sortDirection: 'ASC',
        });
        setItems(list);
        workProcessLogger.info('工序列表加载成功', { count: list.length, factoryId });
      } catch (error) {
        const msg = error instanceof Error ? error.message : '加载工序列表失败';
        workProcessLogger.error('加载工序列表失败', error as Error, { factoryId });
        Alert.alert('错误', msg);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [factoryId],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  // 返回时刷新 (从 Create/Edit 页 goBack 后)
  useFocusEffect(
    useCallback(() => {
      loadList(true);
    }, [loadList]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadList(true);
  };

  const handleAdd = () => {
    navigation.navigate('WorkProcessCreate', { mode: 'create' });
  };

  const handleEdit = (item: WorkProcess) => {
    navigation.navigate('WorkProcessCreate', { mode: 'edit', id: item.id });
  };

  const handleToggleStatus = async (item: WorkProcess) => {
    if (!factoryId) return;
    try {
      await workProcessApiClient.toggleWorkProcessStatus(item.id, factoryId);
      await loadList(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '切换状态失败';
      Alert.alert('错误', msg);
    }
  };

  const handleDelete = (item: WorkProcess) => {
    Alert.alert('删除工序', `确认删除工序 "${item.processName}"?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          if (!factoryId) return;
          try {
            await workProcessApiClient.deleteWorkProcess(item.id, factoryId);
            await loadList(true);
          } catch (error) {
            const msg = error instanceof Error ? error.message : '删除失败';
            Alert.alert('错误', msg);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: WorkProcess }) => (
    <Card style={styles.card} onPress={() => handleEdit(item)}>
      <Card.Content>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleColumn}>
            <Text variant="titleMedium" style={styles.processName}>
              {item.processName}
            </Text>
            <View style={styles.chipRow}>
              {item.processCategory ? (
                <Chip compact style={styles.chip} textStyle={styles.chipText}>
                  {getCategoryLabel(item.processCategory)}
                </Chip>
              ) : null}
              <Chip
                compact
                style={[styles.chip, item.isActive ? styles.chipActive : styles.chipInactive]}
                textStyle={styles.chipText}
              >
                {item.isActive ? '启用' : '禁用'}
              </Chip>
            </View>
          </View>
          <View style={styles.actionRow}>
            <IconButton
              icon={item.isActive ? 'eye-off' : 'eye'}
              size={20}
              onPress={() => handleToggleStatus(item)}
              accessibilityLabel={item.isActive ? '禁用' : '启用'}
            />
            <IconButton
              icon="delete-outline"
              size={20}
              onPress={() => handleDelete(item)}
              accessibilityLabel="删除"
            />
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text variant="bodySmall" style={styles.metaText}>
            产出单位: {item.unit || '-'}
          </Text>
          <Text variant="bodySmall" style={styles.metaText}>
            预估工时:{' '}
            {item.estimatedMinutes !== undefined && item.estimatedMinutes !== null
              ? `${item.estimatedMinutes} 分钟`
              : '-'}
          </Text>
        </View>
        {item.description ? (
          <Text variant="bodySmall" style={styles.description}>
            {item.description}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="工序管理" subtitle="定义工序步骤, 用于产品工序配置" />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centerArea}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <TouchableOpacity onPress={handleAdd} style={styles.emptyArea}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                还没有工序, 点击新增第一个工序
              </Text>
              <Text variant="bodySmall" style={styles.emptyHint}>
                示例: 拆包 / 分割 / 卤制 / 分切 / 装筐
              </Text>
            </TouchableOpacity>
          }
        />
      )}

      <FAB icon="plus" style={styles.fab} onPress={handleAdd} label="新增工序" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  list: {
    padding: 12,
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: 8,
    color: '#aaa',
    textAlign: 'center',
  },
  card: {
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitleColumn: {
    flex: 1,
  },
  processName: {
    fontWeight: '600',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    height: 24,
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
  },
  chipActive: {
    backgroundColor: '#e8f5e9',
  },
  chipInactive: {
    backgroundColor: '#fafafa',
  },
  actionRow: {
    flexDirection: 'row',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  metaText: {
    color: '#555',
  },
  description: {
    marginTop: 6,
    color: '#888',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
