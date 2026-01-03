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
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建ProductionReport专用logger
const productionReportLogger = logger.createContextLogger('ProductionReport');

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
  const { t } = useTranslation('reports');

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
        Alert.alert(t('production.error'), t('production.cannotGetFactoryInfo'));
        return;
      }

      productionReportLogger.debug('加载生产报表数据', { timeRange, factoryId });

      // 加载最近的批次列表
      const batchesResponse = await processingApiClient.getBatches({
        page: 1,
        size: 10,
        status: 'completed', // 只看已完成的批次
        factoryId: factoryId
      });

      if (batchesResponse.success && batchesResponse.data) {
        const batches = batchesResponse.data.content || batchesResponse.data || [];
        setRecentBatches(Array.isArray(batches) ? batches : []);

        // 计算统计数据
        const stats = calculateProductionStats(batches);
        setProductionStats(stats);

        productionReportLogger.info('生产报表数据加载成功', {
          batchCount: batches.length,
          totalOutput: stats.totalOutput,
          completionRate: stats.completionRate.toFixed(1) + '%',
          factoryId,
        });
      } else {
        productionReportLogger.warn('获取生产数据失败', {
          message: batchesResponse.message,
          factoryId,
        });
        setRecentBatches([]);
        setProductionStats(null);
      }
    } catch (error) {
      productionReportLogger.error('加载生产报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      handleError(error, {
        title: t('production.loadFailed'),
        customMessage: t('production.loadProductionDataFailed'),
      });
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
      completed: { label: t('status.completed'), color: '#4CAF50', bgColor: '#E8F5E9' },
      COMPLETED: { label: t('status.completed'), color: '#4CAF50', bgColor: '#E8F5E9' },
      in_progress: { label: t('status.inProgress'), color: '#2196F3', bgColor: '#E3F2FD' },
      pending: { label: t('status.pending'), color: '#FF9800', bgColor: '#FFF3E0' },
      cancelled: { label: t('status.cancelled'), color: '#F44336', bgColor: '#FFEBEE' },
    };

    const config = statusMap[status] || statusMap['pending'] || { label: t('status.unknown'), color: '#666', bgColor: '#f5f5f5' };

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
        <Appbar.Content title={t('production.title')} />
        <Appbar.Action icon="refresh" onPress={loadProductionData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <Text variant="bodyMedium" style={styles.sectionLabel}>
            {t('production.timeRange')}
          </Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'day', label: t('production.today') },
              { value: 'week', label: t('production.thisWeek') },
              { value: 'month', label: t('production.thisMonth') },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {/* 统计概览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            {t('production.productionStats')}
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : productionStats ? (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{productionStats.totalBatches}</Text>
                <Text style={styles.statLabel}>{t('production.productionBatches')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                  {formatQuantity(productionStats.totalOutput)}
                </Text>
                <Text style={styles.statLabel}>{t('production.totalOutput')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#2196F3' }]}>
                  {productionStats.completionRate.toFixed(1)}%
                </Text>
                <Text style={styles.statLabel}>{t('production.completionRate')}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#FF9800' }]}>
                  {formatQuantity(productionStats.avgOutput)}
                </Text>
                <Text style={styles.statLabel}>{t('production.avgOutput')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('production.noStatsData')}</Text>
            </View>
          )}
        </Surface>

        {/* 最近批次列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('production.recentCompletedBatches')} titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>{t('production.batchNumber')}</DataTable.Title>
              <DataTable.Title>{t('production.product')}</DataTable.Title>
              <DataTable.Title numeric>{t('production.output')}</DataTable.Title>
              <DataTable.Title>{t('production.status')}</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : recentBatches.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {t('production.noBatchRecords')}
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
