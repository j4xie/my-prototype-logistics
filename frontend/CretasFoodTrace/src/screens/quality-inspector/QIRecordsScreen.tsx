/**
 * 检验记录列表页面
 * Quality Inspector - Records List Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  QI_COLORS,
  QualityInspectorStackParamList,
  QualityRecord,
  GRADE_COLORS,
  GRADE_LABELS,
  formatDateTime,
} from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';
import { useAuthStore } from '../../store/authStore';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;

type FilterType = 'all' | 'passed' | 'failed' | 'today';

export default function QIRecordsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [records, setRecords] = useState<QualityRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (factoryId) {
      qualityInspectorApi.setFactoryId(factoryId);
      loadRecords(1, true);
    }
  }, [factoryId, filter]);

  const getFilterParams = () => {
    const now = new Date();
    switch (filter) {
      case 'today':
        return {
          startDate: now.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0],
        };
      case 'passed':
        return { grade: 'A,B,C' };
      case 'failed':
        return { grade: 'D' };
      default:
        return {};
    }
  };

  const loadRecords = async (pageNum: number, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const result = await qualityInspectorApi.getInspectionRecords({
        page: pageNum,
        size: 20,
        ...getFilterParams(),
      });

      if (reset) {
        setRecords(result.content);
      } else {
        setRecords(prev => [...prev, ...result.content]);
      }

      setPage(pageNum);
      setHasMore(pageNum < result.totalPages);
    } catch (error) {
      console.error('加载记录失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecords(1, true);
    setRefreshing(false);
  }, [filter]);

  const onEndReached = () => {
    if (!loadingMore && hasMore) {
      loadRecords(page + 1, false);
    }
  };

  const handleRecordPress = (record: QualityRecord) => {
    navigation.navigate('QIRecordDetail', { recordId: record.id });
  };

  const renderFilterTab = (type: FilterType, label: string) => (
    <TouchableOpacity
      style={[styles.filterTab, filter === type && styles.filterTabActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderRecordItem = ({ item }: { item: QualityRecord }) => (
    <TouchableOpacity
      style={styles.recordCard}
      onPress={() => handleRecordPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recordHeader}>
        <View style={styles.recordInfo}>
          <Text style={styles.batchNumber}>{item.batchNumber}</Text>
          <Text style={styles.productName}>{item.productName}</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[item.grade] }]}>
          <Text style={styles.gradeText}>{item.grade}</Text>
        </View>
      </View>

      <View style={styles.recordDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="star" size={14} color={QI_COLORS.warning} />
          <Text style={styles.detailText}>{item.totalScore}分</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="layers" size={14} color={QI_COLORS.textSecondary} />
          <Text style={styles.detailText}>{item.sampleSize}件</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="person" size={14} color={QI_COLORS.textSecondary} />
          <Text style={styles.detailText}>{item.inspector.name}</Text>
        </View>
      </View>

      <View style={styles.recordFooter}>
        <Text style={styles.timeText}>{formatDateTime(item.inspectedAt)}</Text>
        <View style={[styles.statusBadge, item.passed ? styles.statusPass : styles.statusFail]}>
          <Text style={styles.statusText}>{item.passed ? '合格' : '不合格'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={QI_COLORS.primary} />
        <Text style={styles.loadingText}>加载更多...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color={QI_COLORS.disabled} />
        <Text style={styles.emptyTitle}>暂无检验记录</Text>
        <Text style={styles.emptySubtitle}>完成质检后记录将显示在这里</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 筛选栏 */}
      <View style={styles.filterBar}>
        {renderFilterTab('all', '全部')}
        {renderFilterTab('today', '今日')}
        {renderFilterTab('passed', '合格')}
        {renderFilterTab('failed', '不合格')}
      </View>

      {/* 记录列表 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QI_COLORS.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderRecordItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[QI_COLORS.primary]}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },

  // 筛选栏
  filterBar: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
  },
  filterTabActive: {
    backgroundColor: QI_COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '500',
  },

  // 列表
  listContent: {
    padding: 16,
  },

  // 记录卡片
  recordCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recordInfo: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  gradeBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  recordDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 13,
    color: QI_COLORS.disabled,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusPass: {
    backgroundColor: '#E8F5E9',
  },
  statusFail: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // 加载状态
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    color: QI_COLORS.textSecondary,
    fontSize: 14,
  },

  // 空状态
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
});
