import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { getFactoryId } from '../../types/auth';

/**
 * 生产报表页面
 * 集成数据来源:
 * - processingApiClient: 加工批次数据、生产统计
 *
 * 展示内容:
 * - 生产总量统计
 * - 批次完成情况
 * - 日/周/月生产趋势
 */
export default function ProductionReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week'); // day, week, month

  // 数据状态
  const [productionStats, setProductionStats] = useState<any>(null);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);

  /**
   * 加载生产数据
   */
  const loadProductionData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      console.log('📊 Loading production data...', { timeRange, factoryId });

      // 加载最近的批次列表
      const batchesResponse = await processingApiClient.getBatches(
        {
          page: 0,
          size: 10,
          status: 'completed', // 只看已完成的批次
        },
        factoryId
      );

      if (batchesResponse.success && batchesResponse.data) {
        const batches = batchesResponse.data.content || batchesResponse.data || [];
        setRecentBatches(Array.isArray(batches) ? batches : []);

        // 计算统计数据
        const stats = calculateProductionStats(batches);
        setProductionStats(stats);

        console.log('✅ Production data loaded:', { stats, batchCount: batches.length });
      } else {
        console.warn('获取生产数据失败:', batchesResponse.message);
        setRecentBatches([]);
        setProductionStats(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to load production data:', error);
      const errorMessage =
        error.response?.data?.message || error.message || '加载生产数据失败，请稍后重试';
      Alert.alert('加载失败', errorMessage);
      setRecentBatches([]);
      setProductionStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算生产统计
   */
  const calculateProductionStats = (batches: any[]) => {
    const totalBatches = batches.length;
    const totalOutput = batches.reduce((sum, batch) => {
      const output = batch.actualOutput || batch.targetOutput || 0;
      return sum + output;
    }, 0);

    const completedBatches = batches.filter(
      (b) => b.status === 'completed' || b.status === 'COMPLETED'
    ).length;

    const avgOutput = totalBatches > 0 ? totalOutput / totalBatches : 0;

    // 计算合格率（如果有质检数据）
    const batchesWithQuality = batches.filter((b) => b.qualityRate !== undefined);
    const avgQualityRate =
      batchesWithQuality.length > 0
        ? batchesWithQuality.reduce((sum, b) => sum + (b.qualityRate || 0), 0) /
          batchesWithQuality.length
        : null;

    return {
      totalBatches,
      totalOutput,
      completedBatches,
      avgOutput,
      avgQualityRate,
      completionRate: totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0,
    };
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProductionData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadProductionData();
    }, [timeRange])
  );

  /**
   * 格式化数量
   */
  const formatQuantity = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
  };

  /**
   * 获取状态标签
   */
  const getStatusChip = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; color: string; bgColor: string }
    > = {
      completed: { label: '已完成', color: '#4CAF50', bgColor: '#E8F5E9' },
      COMPLETED: { label: '已完成', color: '#4CAF50', bgColor: '#E8F5E9' },
      in_progress: { label: '进行中', color: '#2196F3', bgColor: '#E3F2FD' },
      pending: { label: '待开始', color: '#FF9800', bgColor: '#FFF3E0' },
      cancelled: { label: '已取消', color: '#F44336', bgColor: '#FFEBEE' },
    };

    const config = statusMap[status] || statusMap['pending'];

    return (
      <Chip
        mode="flat"
        compact
        style={{ backgroundColor: config.bgColor }}
        textStyle={{ color: config.color, fontSize: 12 }}
      >
        {config.label}
      </Chip>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="生产报表" />
        <Appbar.Action icon="refresh" onPress={loadProductionData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <Text variant="bodyMedium" style={styles.sectionLabel}>
            时间范围
          </Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {/* 统计概览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            生产统计
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : productionStats ? (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{productionStats.totalBatches}</Text>
                <Text style={styles.statLabel}>生产批次</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                  {formatQuantity(productionStats.totalOutput)}
                </Text>
                <Text style={styles.statLabel}>总产量(kg)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#2196F3' }]}>
                  {productionStats.completionRate.toFixed(1)}%
                </Text>
                <Text style={styles.statLabel}>完成率</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#FF9800' }]}>
                  {formatQuantity(productionStats.avgOutput)}
                </Text>
                <Text style={styles.statLabel}>平均产量</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无统计数据</Text>
            </View>
          )}
        </Surface>

        {/* 最近批次列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="最近完成批次" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>批次号</DataTable.Title>
              <DataTable.Title>产品</DataTable.Title>
              <DataTable.Title numeric>产量</DataTable.Title>
              <DataTable.Title>状态</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : recentBatches.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无批次记录
                </Text>
              </View>
            ) : (
              recentBatches.slice(0, 10).map((batch, index) => (
                <DataTable.Row key={batch.id || index}>
                  <DataTable.Cell>
                    <Text variant="bodySmall">{batch.batchNumber || `批次${batch.id}`}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall">
                      {batch.productTypeName || batch.productType || '-'}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text variant="bodySmall">
                      {formatQuantity(batch.actualOutput || batch.targetOutput)}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>{getStatusChip(batch.status)}</DataTable.Cell>
                </DataTable.Row>
              ))
            )}
          </DataTable>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  timeRangeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  segmentedButtons: {
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 12,
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  bottomPadding: {
    height: 80,
  },
});
