/**
 * 待检批次列表页面
 * Quality Inspector - Pending Batches List Screen
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
import { useTranslation } from 'react-i18next';

import { QI_COLORS, QualityInspectorStackParamList, QIBatch, BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';
import { useAuthStore } from '../../store/authStore';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;

export default function QIInspectListScreen() {
  const { t } = useTranslation('quality');
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batches, setBatches] = useState<QIBatch[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (factoryId) {
      qualityInspectorApi.setFactoryId(factoryId);
      loadBatches(1, true);
    }
  }, [factoryId]);

  const loadBatches = async (pageNum: number, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const result = await qualityInspectorApi.getPendingBatches({
        page: pageNum,
        size: 20,
        status: 'pending_inspection',
      });

      if (reset) {
        setBatches(result.content);
      } else {
        setBatches(prev => [...prev, ...result.content]);
      }

      setTotalCount(result.totalElements);
      setPage(pageNum);
      setHasMore(pageNum < result.totalPages);
    } catch (error) {
      console.error('加载批次失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBatches(1, true);
    setRefreshing(false);
  }, []);

  const onEndReached = () => {
    if (!loadingMore && hasMore) {
      loadBatches(page + 1, false);
    }
  };

  const handleScanPress = () => {
    navigation.navigate('QIScan');
  };

  const handleBatchPress = (batch: QIBatch) => {
    navigation.navigate('QIForm', {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
    });
  };

  const formatWaitTime = (createdAt: string): string => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚到达';
    if (diffMins < 60) return `等待 ${diffMins}分钟`;
    const diffHours = Math.floor(diffMins / 60);
    return `等待 ${diffHours}小时${diffMins % 60}分钟`;
  };

  const renderBatchItem = ({ item }: { item: QIBatch }) => (
    <TouchableOpacity
      style={styles.batchCard}
      onPress={() => handleBatchPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.batchHeader}>
        <Text style={styles.batchNumber}>{item.batchNumber}</Text>
        <Text style={styles.waitTime}>{formatWaitTime(item.createdAt)}</Text>
      </View>
      <View style={styles.batchInfo}>
        <Text style={styles.batchDetail}>
          产品: <Text style={styles.batchDetailValue}>{item.productName}</Text>
        </Text>
        {item.sourceProcess && (
          <Text style={styles.batchDetail}>
            来源: <Text style={styles.batchDetailValue}>{item.sourceProcess}</Text>
          </Text>
        )}
      </View>
      <View style={styles.batchFooter}>
        <Text style={styles.quantityText}>
          {item.quantity} {item.unit}
        </Text>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => handleBatchPress(item)}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          <Text style={styles.startBtnText}>开始检验</Text>
        </TouchableOpacity>
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
        <Ionicons name="checkmark-done-circle-outline" size={64} color={QI_COLORS.disabled} />
        <Text style={styles.emptyTitle}>暂无待检批次</Text>
        <Text style={styles.emptySubtitle}>所有批次都已检验完成</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 扫码入口 */}
      <TouchableOpacity style={styles.scanCard} onPress={handleScanPress} activeOpacity={0.8}>
        <View style={styles.scanIcon}>
          <Ionicons name="scan" size={40} color="#fff" />
        </View>
        <Text style={styles.scanTitle}>扫描批次二维码</Text>
        <Text style={styles.scanSubtitle}>快速开始检验</Text>
      </TouchableOpacity>

      {/* 分隔线 */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>或从列表选择</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* 列表标题 */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>待检批次</Text>
        <Text style={styles.listCount}>{totalCount}个</Text>
      </View>

      {/* 批次列表 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={QI_COLORS.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => item.id}
          renderItem={renderBatchItem}
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

  // 扫码入口
  scanCard: {
    backgroundColor: QI_COLORS.primary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  scanIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  scanSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },

  // 分隔线
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: QI_COLORS.border,
  },
  dividerText: {
    color: QI_COLORS.textSecondary,
    fontSize: 13,
    marginHorizontal: 12,
  },

  // 列表标题
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  listCount: {
    fontSize: 14,
    color: QI_COLORS.primary,
    fontWeight: '500',
  },

  // 列表
  listContent: {
    paddingHorizontal: 16,
  },

  // 批次卡片
  batchCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  waitTime: {
    fontSize: 13,
    color: QI_COLORS.warning,
  },
  batchInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  batchDetail: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  batchDetailValue: {
    color: QI_COLORS.text,
  },
  batchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
  },
  quantityText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QI_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 14,
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
