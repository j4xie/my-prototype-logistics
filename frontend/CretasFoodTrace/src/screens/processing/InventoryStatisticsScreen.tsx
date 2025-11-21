import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Surface,
  ActivityIndicator,
  DataTable,
  Chip,
  ProgressBar,
  Button,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { materialBatchApiClient } from '../../services/api/materialBatchApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建InventoryStatistics专用logger
const inventoryStatsLogger = logger.createContextLogger('InventoryStatistics');

/**
 * 库存统计分析页面
 * P1-库存: 集成库存统计、价值、低库存警告API
 *
 * 功能:
 * - 库存统计概览
 * - 库存价值分析
 * - 低库存警告列表
 * - 批次状态分布
 */
export default function InventoryStatisticsScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [statistics, setStatistics] = useState<any>(null);
  const [valuation, setValuation] = useState<any>(null);
  const [lowStockBatches, setLowStockBatches] = useState<any[]>([]);

  /**
   * 加载库存数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      inventoryStatsLogger.debug('加载库存统计数据', { factoryId });

      // 并行加载3个API
      const [statsResponse, valuationResponse, lowStockResponse] = await Promise.all([
        // API 1: 库存统计
        materialBatchApiClient.getInventoryStatistics(factoryId).catch(() => ({ data: null })),
        // API 2: 库存价值
        materialBatchApiClient.getInventoryValuation(factoryId).catch(() => ({ data: null })),
        // API 3: 低库存警告
        materialBatchApiClient.getLowStockBatches(factoryId).catch(() => ({ data: [] })),
      ]);

      // 更新状态
      setStatistics(statsResponse.data);
      setValuation(valuationResponse.data);
      setLowStockBatches(Array.isArray(lowStockResponse.data) ? lowStockResponse.data : []);

      inventoryStatsLogger.info('库存统计数据加载成功', {
        factoryId,
        hasStatistics: !!statsResponse.data,
        hasValuation: !!valuationResponse.data,
        lowStockCount: (Array.isArray(lowStockResponse.data) ? lowStockResponse.data : []).length,
      });
    } catch (error) {
      inventoryStatsLogger.error('加载库存统计数据失败', error as Error, {
        factoryId,
      });
      const errorMessage = error.response?.data?.message || error.message || '无法加载库存数据，请稍后重试';
      Alert.alert('加载失败', errorMessage);

      // 清空数据（不降级）
      setStatistics(null);
      setValuation(null);
      setLowStockBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  /**
   * 格式化货币
   */
  const formatCurrency = (value: number): string => {
    if (!value) return '¥0';
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(2)}万`;
    }
    return `¥${value.toFixed(2)}`;
  };

  /**
   * 获取批次状态分布
   */
  const getBatchDistribution = () => {
    if (!statistics) {
      return {
        totalBatches: 0,
        availableBatches: 0,
        reservedBatches: 0,
        depletedBatches: 0,
        expiredBatches: 0,
      };
    }

    return {
      totalBatches: statistics.totalBatches || 0,
      availableBatches: statistics.availableBatches || 0,
      reservedBatches: statistics.reservedBatches || 0,
      depletedBatches: statistics.depletedBatches || 0,
      expiredBatches: statistics.expiredBatches || 0,
    };
  };

  /**
   * 获取库存价值
   */
  const getValuationData = () => {
    if (!valuation) {
      return {
        totalValue: 0,
        totalCost: 0,
        averageUnitPrice: 0,
        valuationDate: new Date().toISOString().split('T')[0],
      };
    }

    return {
      totalValue: valuation.totalValue || valuation.totalInventoryValue || 0,
      totalCost: valuation.totalCost || 0,
      averageUnitPrice: valuation.averageUnitPrice || valuation.avgUnitPrice || 0,
      valuationDate: valuation.valuationDate || new Date().toISOString().split('T')[0],
    };
  };

  const batchDistribution = getBatchDistribution();
  const valuationData = getValuationData();

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="库存统计" />
        <Appbar.Action icon="refresh" onPress={loadData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 库存价值 */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            库存价值
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : (
            <>
              <View style={styles.valueRow}>
                <View style={styles.valueItem}>
                  <Text variant="headlineMedium" style={styles.valueAmount}>
                    {formatCurrency(valuationData.totalValue)}
                  </Text>
                  <Text variant="bodySmall" style={styles.valueLabel}>
                    总库存价值
                  </Text>
                </View>
                <View style={styles.valueItem}>
                  <Text variant="headlineMedium" style={[styles.valueAmount, { color: '#FF9800' }]}>
                    {formatCurrency(valuationData.totalCost)}
                  </Text>
                  <Text variant="bodySmall" style={styles.valueLabel}>
                    总成本
                  </Text>
                </View>
              </View>

              <View style={styles.valueMeta}>
                <Text variant="bodySmall" style={styles.metaText}>
                  平均单价: {formatCurrency(valuationData.averageUnitPrice)}/kg
                </Text>
                <Text variant="bodySmall" style={styles.metaText}>
                  统计日期: {valuationData.valuationDate}
                </Text>
              </View>
            </>
          )}
        </Surface>

        {/* 批次状态分布 */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            批次状态分布
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{batchDistribution.totalBatches}</Text>
                  <Text style={styles.statLabel}>总批次</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                    {batchDistribution.availableBatches}
                  </Text>
                  <Text style={styles.statLabel}>可用</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: '#2196F3' }]}>
                    {batchDistribution.reservedBatches}
                  </Text>
                  <Text style={styles.statLabel}>已预留</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: '#9E9E9E' }]}>
                    {batchDistribution.depletedBatches}
                  </Text>
                  <Text style={styles.statLabel}>已耗尽</Text>
                </View>
              </View>

              {/* 状态进度条 */}
              <View style={styles.progressSection}>
                <View style={styles.progressItem}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>可用批次</Text>
                    <Text style={styles.progressValue}>
                      {batchDistribution.totalBatches > 0
                        ? ((batchDistribution.availableBatches / batchDistribution.totalBatches) * 100).toFixed(1)
                        : 0}
                      %
                    </Text>
                  </View>
                  <ProgressBar
                    progress={
                      batchDistribution.totalBatches > 0
                        ? batchDistribution.availableBatches / batchDistribution.totalBatches
                        : 0
                    }
                    color="#4CAF50"
                    style={styles.progressBar}
                  />
                </View>

                <View style={styles.progressItem}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>已预留批次</Text>
                    <Text style={styles.progressValue}>
                      {batchDistribution.totalBatches > 0
                        ? ((batchDistribution.reservedBatches / batchDistribution.totalBatches) * 100).toFixed(1)
                        : 0}
                      %
                    </Text>
                  </View>
                  <ProgressBar
                    progress={
                      batchDistribution.totalBatches > 0
                        ? batchDistribution.reservedBatches / batchDistribution.totalBatches
                        : 0
                    }
                    color="#2196F3"
                    style={styles.progressBar}
                  />
                </View>
              </View>
            </>
          )}
        </Surface>

        {/* 低库存警告 */}
        {lowStockBatches.length > 0 && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              低库存警告 ({lowStockBatches.length})
            </Text>

            <DataTable>
              <DataTable.Header>
                <DataTable.Title>批次号</DataTable.Title>
                <DataTable.Title>物料</DataTable.Title>
                <DataTable.Title numeric>剩余</DataTable.Title>
                <DataTable.Title>状态</DataTable.Title>
              </DataTable.Header>

              {lowStockBatches.slice(0, 10).map((batch, index) => (
                <DataTable.Row key={batch.id || index}>
                  <DataTable.Cell>
                    <Text variant="bodySmall" numberOfLines={1}>
                      {batch.batchNumber}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall" numberOfLines={1}>
                      {batch.materialType || batch.materialTypeId}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: batch.remainingQuantity < 10 ? '#F44336' : '#FF9800',
                        fontWeight: 'bold',
                      }}
                    >
                      {batch.remainingQuantity?.toFixed(1) || 0}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Chip
                      mode="flat"
                      compact
                      style={{
                        backgroundColor: batch.remainingQuantity < 10 ? '#FFEBEE' : '#FFF3E0',
                      }}
                      textStyle={{
                        color: batch.remainingQuantity < 10 ? '#F44336' : '#FF9800',
                        fontSize: 11,
                      }}
                    >
                      {batch.remainingQuantity < 10 ? '紧急' : '预警'}
                    </Chip>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            {lowStockBatches.length > 10 && (
              <View style={styles.moreButton}>
                <Button mode="text" onPress={() => Alert.alert('提示', '查看全部低库存批次功能即将上线')}>
                  查看全部 {lowStockBatches.length} 条警告
                </Button>
              </View>
            )}
          </Surface>
        )}

        {/* 无低库存警告时显示 */}
        {!loading && lowStockBatches.length === 0 && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              低库存警告
            </Text>
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                ✅ 所有批次库存充足
              </Text>
            </View>
          </Surface>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
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
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
    color: '#212121',
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
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  valueItem: {
    alignItems: 'center',
  },
  valueAmount: {
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  valueLabel: {
    color: '#666',
  },
  valueMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    color: '#999',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  statCard: {
    width: '45%',
    margin: 6,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  progressSection: {
    gap: 16,
  },
  progressItem: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  moreButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  bottomPadding: {
    height: 80,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
