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
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError , getErrorMsg} from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建CostReport专用logger
const costReportLogger = logger.createContextLogger('CostReport');

/**
 * 成本报表页面
 * 集成数据来源:
 * - processingApiClient: 批次成本数据、物料消耗
 *
 * 展示内容:
 * - 成本总览统计
 * - 批次成本分析
 * - 成本趋势
 */
export default function CostReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  // 数据状态
  const [costStats, setCostStats] = useState<any>(null);
  const [batchCosts, setBatchCosts] = useState<any[]>([]);

  /**
   * 加载成本数据
   */
  const loadCostData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      costReportLogger.debug('加载成本报表数据', { timeRange, factoryId });

      // 加载批次列表（包含成本信息）
      const batchesResponse = await processingApiClient.getBatches({
        factoryId,
        page: 0,
        size: 20
      });

      if (batchesResponse.success && batchesResponse.data) {
        const batches = batchesResponse.data.content || batchesResponse.data || [];
        setBatchCosts(Array.isArray(batches) ? batches : []);

        // 计算成本统计
        const stats = calculateCostStats(batches);
        setCostStats(stats);

        costReportLogger.info('成本报表数据加载成功', {
          batchCount: batches.length,
          totalCost: stats.totalCost.toFixed(2),
          avgCostPerBatch: stats.avgCostPerBatch.toFixed(2),
          factoryId,
        });
      } else {
        costReportLogger.warn('获取成本数据失败', {
          message: batchesResponse.message,
          factoryId,
        });
        setBatchCosts([]);
        setCostStats(null);
      }
    } catch (error) {
      costReportLogger.error('加载成本报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage =
        getErrorMsg(error) || '加载成本数据失败，请稍后重试';
      Alert.alert('加载失败', errorMessage);
      setBatchCosts([]);
      setCostStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算成本统计
   */
  const calculateCostStats = (batches: any[]) => {
    const totalBatches = batches.length;
    let totalCost = 0;
    let totalMaterialCost = 0;
    let totalLaborCost = 0;
    let totalOverheadCost = 0;

    batches.forEach((batch) => {
      // 尝试从多个可能的字段获取成本数据
      const batchTotalCost = batch.totalCost || batch.cost || 0;
      const materialCost = batch.materialCost || batch.rawMaterialCost || 0;
      const laborCost = batch.laborCost || batch.labourCost || 0;
      const overheadCost = batch.overheadCost || batch.overhead || 0;

      totalCost += batchTotalCost;
      totalMaterialCost += materialCost;
      totalLaborCost += laborCost;
      totalOverheadCost += overheadCost;
    });

    const avgCostPerBatch = totalBatches > 0 ? totalCost / totalBatches : 0;

    // 计算各成本占比
    const materialCostRatio = totalCost > 0 ? (totalMaterialCost / totalCost) * 100 : 0;
    const laborCostRatio = totalCost > 0 ? (totalLaborCost / totalCost) * 100 : 0;
    const overheadCostRatio = totalCost > 0 ? (totalOverheadCost / totalCost) * 100 : 0;

    return {
      totalBatches,
      totalCost,
      totalMaterialCost,
      totalLaborCost,
      totalOverheadCost,
      avgCostPerBatch,
      materialCostRatio,
      laborCostRatio,
      overheadCostRatio,
    };
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCostData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadCostData();
    }, [timeRange])
  );

  /**
   * 格式化金额
   */
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `¥${value.toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="成本报表" />
        <Appbar.Action icon="refresh" onPress={loadCostData} />
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

        {/* 成本总览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            成本总览
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : costStats ? (
            <>
              <View style={styles.totalCostContainer}>
                <Text style={styles.totalCostLabel}>总成本</Text>
                <Text style={styles.totalCostValue}>{formatCurrency(costStats.totalCost)}</Text>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#FF9800' }]}>
                    {formatCurrency(costStats.totalMaterialCost)}
                  </Text>
                  <Text style={styles.statLabel}>
                    物料成本 ({costStats.materialCostRatio.toFixed(1)}%)
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#2196F3' }]}>
                    {formatCurrency(costStats.totalLaborCost)}
                  </Text>
                  <Text style={styles.statLabel}>
                    人工成本 ({costStats.laborCostRatio.toFixed(1)}%)
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#9C27B0' }]}>
                    {formatCurrency(costStats.totalOverheadCost)}
                  </Text>
                  <Text style={styles.statLabel}>
                    间接成本 ({costStats.overheadCostRatio.toFixed(1)}%)
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#4CAF50' }]}>
                    {formatCurrency(costStats.avgCostPerBatch)}
                  </Text>
                  <Text style={styles.statLabel}>批次平均成本</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无成本数据</Text>
            </View>
          )}
        </Surface>

        {/* 批次成本列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="批次成本明细" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>批次号</DataTable.Title>
              <DataTable.Title>产品</DataTable.Title>
              <DataTable.Title numeric>总成本</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : batchCosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无批次数据
                </Text>
              </View>
            ) : (
              batchCosts.slice(0, 10).map((batch, index) => {
                const batchCost = batch.totalCost || batch.cost || 0;
                return (
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
                      <Text variant="bodySmall" style={{ color: '#FF9800' }}>
                        {formatCurrency(batchCost)}
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })
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
  totalCostContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalCostLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  totalCostValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FF9800',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
