/**
 * 批次员工管理
 *
 * 功能:
 * - 显示批次分配的员工
 * - 添加/移除员工
 * - 查看工时详情
 *
 * 对应原型: /docs/prd/prototype/hr-admin/batch-workers.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, FAB, Avatar, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { HR_THEME, type HRStackParamList } from '../../../types/hrNavigation';

type RouteParams = RouteProp<HRStackParamList, 'BatchWorkers'>;

interface BatchWorker {
  id: number;
  userId: number;
  name: string;
  avatar?: string;
  department?: string;
  workMinutes: number;
  startTime?: string;
  endTime?: string;
  status: 'working' | 'completed' | 'paused';
}

export default function BatchWorkersScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { batchId, batchName } = route.params;
  const { t } = useTranslation('hr');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState<BatchWorker[]>([]);

  const loadData = useCallback(async () => {
    try {
      // getBatchWorkers returns { content: [...], totalElements } directly
      const res = await schedulingApiClient.getBatchWorkers(batchId);
      if (res?.content) {
        // Map API response (userName) to BatchWorker type (name)
        const mappedWorkers: BatchWorker[] = res.content.map((w: any) => ({
          id: w.id,
          userId: w.userId,
          name: w.userName || w.name, // API returns userName, UI expects name
          avatar: w.avatar,
          department: w.department || w.workType,
          workMinutes: w.workMinutes ?? 0,
          startTime: w.startTime,
          endTime: w.endTime,
          status: w.status || 'working',
        }));
        setWorkers(mappedWorkers);
      }
    } catch (error) {
      console.error('加载批次员工数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [batchId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleRemoveWorker = (worker: BatchWorker) => {
    Alert.alert(
      t('production.batchWorkers.removeWorker'),
      t('production.batchWorkers.removeConfirm', { name: worker.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await schedulingApiClient.removeWorkerFromBatch(batchId, worker.userId);
              loadData();
            } catch (error) {
              Alert.alert(t('messages.error'), t('production.batchWorkers.removeFailed'));
            }
          },
        },
      ]
    );
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'working':
        return { label: t('production.batchWorkers.status.working'), color: HR_THEME.success };
      case 'completed':
        return { label: t('production.batchWorkers.status.completed'), color: HR_THEME.info };
      case 'paused':
        return { label: t('production.batchWorkers.status.paused'), color: HR_THEME.warning };
      default:
        return { label: t('common.noData'), color: HR_THEME.textMuted };
    }
  };

  const renderItem = ({ item }: { item: BatchWorker }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Avatar.Text
            size={44}
            label={item.name?.substring(0, 1) || 'U'}
            style={{ backgroundColor: HR_THEME.primary }}
          />
          <View style={styles.workerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.workerName}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
            <Text style={styles.department}>{item.department || t('production.batchWorkers.noDepartment')}</Text>
            <View style={styles.timeRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={HR_THEME.textSecondary}
              />
              <Text style={styles.timeText}>
                {t('production.batchWorkers.workDuration')}: {formatMinutes(item.workMinutes)}
              </Text>
            </View>
          </View>
          <IconButton
            icon="close"
            size={20}
            iconColor={HR_THEME.danger}
            onPress={() => handleRemoveWorker(item)}
          />
        </Card.Content>
      </Card>
    );
  };

  const renderHeader = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{workers.length}</Text>
        <Text style={styles.summaryLabel}>{t('production.batchWorkers.totalCount')}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>
          {formatMinutes(workers.reduce((sum, w) => sum + w.workMinutes, 0))}
        </Text>
        <Text style={styles.summaryLabel}>{t('production.batchWorkers.totalHours')}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>
          {workers.filter((w) => w.status === 'working').length}
        </Text>
        <Text style={styles.summaryLabel}>{t('production.batchWorkers.working')}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('production.batchWorkers.title')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{batchName}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={workers}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>{t('production.batchWorkers.empty')}</Text>
            <Text style={styles.emptySubtext}>{t('production.batchWorkers.emptyHint')}</Text>
          </View>
        }
      />

      <FAB
        icon="account-plus"
        style={styles.fab}
        onPress={() => {
          // TODO: 打开添加员工弹窗
          Alert.alert(t('messages.tip'), t('production.batchWorkers.alerts.addComingSoon'));
        }}
        color="#fff"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HR_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  placeholder: {
    width: 32,
  },
  listContent: {
    padding: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: HR_THEME.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: HR_THEME.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: HR_THEME.border,
    marginVertical: 8,
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 15,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  department: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: HR_THEME.textSecondary,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: HR_THEME.textMuted,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: HR_THEME.primary,
  },
});
