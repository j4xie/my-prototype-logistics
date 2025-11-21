import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Appbar,
  Button,
  Chip,
  Surface,
  DataTable,
  Divider,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建CostComparison专用logger
const costComparisonLogger = logger.createContextLogger('CostComparison');

// Types
type CostComparisonScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'CostComparison'
>;
type CostComparisonScreenRouteProp = RouteProp<
  ProcessingStackParamList,
  'CostComparison'
>;

interface BatchCostData {
  batchId: string;
  batchNumber: string;
  productType: string;
  totalCost: number;
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  otherCost: number;
  quantity: number;
  unitCost: number;
  date: string;
}

/**
 * 成本对比分析页面
 * P1-003: 成本对比分析
 *
 * 功能:
 * - 多批次成本对比
 * - 成本明细对比表
 * - 趋势图表展示
 * - 单位成本对比
 * - 成本结构分析
 */
export default function CostComparisonScreen() {
  const navigation = useNavigation<CostComparisonScreenNavigationProp>();
  const route = useRoute<CostComparisonScreenRouteProp>();
  const { batchIds } = route.params;

  // Data state
  const [batchesData, setBatchesData] = useState<BatchCostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  useFocusEffect(
    useCallback(() => {
      fetchComparisonData();
    }, [batchIds])
  );

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      const { user } = useAuthStore.getState();
      const factoryId = user?.factoryId || user?.platformUser?.factoryId || 'CRETAS_2024_001';

      costComparisonLogger.debug('获取成本对比数据', { batchIds, factoryId, batchCount: batchIds.length });

      const response = await processingApiClient.getBatchCostComparison(batchIds, factoryId);

      if (response.success && response.data) {
        setBatchesData(response.data);
        costComparisonLogger.info('成本对比数据加载成功', {
          factoryId,
          batchIds,
          batchCount: response.data.length,
          avgTotalCost: response.data.reduce((sum, b) => sum + b.totalCost, 0) / response.data.length,
        });
      } else {
        setBatchesData([]);
        Alert.alert('提示', '未找到批次成本数据');
      }
    } catch (error) {
      costComparisonLogger.error('获取成本对比数据失败', error as Error, {
        factoryId: useAuthStore.getState().user?.factoryId,
        batchIds,
      });
      const errorMessage = error.response?.data?.message || error.message || '加载成本对比数据失败';
      Alert.alert('加载失败', errorMessage);
      setBatchesData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchComparisonData();
    setRefreshing(false);
  };

  // Calculate statistics
  const avgTotalCost =
    batchesData.length > 0
      ? batchesData.reduce((sum, b) => sum + b.totalCost, 0) / batchesData.length
      : 0;

  const avgUnitCost =
    batchesData.length > 0
      ? batchesData.reduce((sum, b) => sum + b.unitCost, 0) / batchesData.length
      : 0;

  const minUnitCost =
    batchesData.length > 0
      ? Math.min(...batchesData.map((b) => b.unitCost))
      : 0;

  const maxUnitCost =
    batchesData.length > 0
      ? Math.max(...batchesData.map((b) => b.unitCost))
      : 0;

  const bestBatch = batchesData.find((b) => b.unitCost === minUnitCost);
  const worstBatch = batchesData.find((b) => b.unitCost === maxUnitCost);

  // Chart data
  const chartLabels = batchesData.map((b) => b.batchNumber.slice(-3)); // Last 3 chars
  const chartTotalCostData = batchesData.map((b) => b.totalCost);
  const chartUnitCostData = batchesData.map((b) => b.unitCost);

  const chartConfig = {
    backgroundColor: '#FFF',
    backgroundGradientFrom: '#FFF',
    backgroundGradientTo: '#FFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
  };

  const screenWidth = Dimensions.get('window').width - 32;

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="成本对比" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="成本对比" />
        <Appbar.Action
          icon={viewMode === 'table' ? 'chart-line' : 'table'}
          onPress={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <Surface style={styles.summaryCard} elevation={1}>
            <Text style={styles.summaryLabel}>对比批次</Text>
            <Text style={styles.summaryValue}>{batchesData.length}</Text>
          </Surface>

          <Surface style={styles.summaryCard} elevation={1}>
            <Text style={styles.summaryLabel}>平均总成本</Text>
            <Text style={styles.summaryValue}>¥{avgTotalCost.toFixed(0)}</Text>
          </Surface>

          <Surface style={styles.summaryCard} elevation={1}>
            <Text style={styles.summaryLabel}>平均单位成本</Text>
            <Text style={styles.summaryValue}>¥{avgUnitCost.toFixed(2)}</Text>
          </Surface>
        </View>

        {/* Best/Worst Batch */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            成本表现
          </Text>

          {bestBatch && (
            <View style={styles.performanceRow}>
              <View style={styles.performanceLeft}>
                <Chip
                  mode="flat"
                  style={styles.bestChip}
                  textStyle={styles.bestChipText}
                  icon="trophy"
                >
                  最优
                </Chip>
                <Text style={styles.performanceBatch}>
                  {bestBatch.batchNumber}
                </Text>
              </View>
              <Text style={styles.performanceCost}>
                ¥{bestBatch.unitCost.toFixed(2)}/kg
              </Text>
            </View>
          )}

          {worstBatch && (
            <View style={styles.performanceRow}>
              <View style={styles.performanceLeft}>
                <Chip
                  mode="flat"
                  style={styles.worstChip}
                  textStyle={styles.worstChipText}
                  icon="alert-circle"
                >
                  待优化
                </Chip>
                <Text style={styles.performanceBatch}>
                  {worstBatch.batchNumber}
                </Text>
              </View>
              <Text style={styles.performanceCost}>
                ¥{worstBatch.unitCost.toFixed(2)}/kg
              </Text>
            </View>
          )}

          <Divider style={styles.divider} />

          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>成本差异</Text>
            <Text style={styles.rangeValue}>
              ¥{(maxUnitCost - minUnitCost).toFixed(2)}/kg (
              {((maxUnitCost - minUnitCost) / minUnitCost * 100).toFixed(1)}%)
            </Text>
          </View>
        </Surface>

        {/* Table or Chart View */}
        {viewMode === 'table' ? (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              成本明细对比
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={styles.tableHeaderCell}>
                    批次
                  </DataTable.Title>
                  <DataTable.Title numeric style={styles.tableCell}>
                    总成本
                  </DataTable.Title>
                  <DataTable.Title numeric style={styles.tableCell}>
                    人工
                  </DataTable.Title>
                  <DataTable.Title numeric style={styles.tableCell}>
                    原料
                  </DataTable.Title>
                  <DataTable.Title numeric style={styles.tableCell}>
                    设备
                  </DataTable.Title>
                  <DataTable.Title numeric style={styles.tableCell}>
                    其他
                  </DataTable.Title>
                  <DataTable.Title numeric style={styles.tableCell}>
                    单位成本
                  </DataTable.Title>
                </DataTable.Header>

                {batchesData.map((batch) => (
                  <DataTable.Row key={batch.batchId}>
                    <DataTable.Cell style={styles.tableHeaderCell}>
                      <Text style={styles.batchNumberCell}>
                        {batch.batchNumber.slice(-7)}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={styles.tableCell}>
                      ¥{(batch.totalCost / 1000).toFixed(1)}k
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={styles.tableCell}>
                      ¥{(batch.laborCost / 1000).toFixed(1)}k
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={styles.tableCell}>
                      ¥{(batch.materialCost / 1000).toFixed(1)}k
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={styles.tableCell}>
                      ¥{(batch.equipmentCost / 1000).toFixed(1)}k
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={styles.tableCell}>
                      ¥{(batch.otherCost / 1000).toFixed(1)}k
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={styles.tableCell}>
                      <Text
                        style={[
                          styles.unitCostCell,
                          {
                            color:
                              batch.unitCost === minUnitCost
                                ? '#4CAF50'
                                : batch.unitCost === maxUnitCost
                                ? '#F44336'
                                : '#212121',
                          },
                        ]}
                      >
                        ¥{batch.unitCost.toFixed(2)}
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </ScrollView>
          </Surface>
        ) : (
          <>
            {/* Total Cost Chart */}
            <Surface style={styles.section} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                总成本对比
              </Text>
              {batchesData.length > 0 && (
                <BarChart
                  data={{
                    labels: chartLabels,
                    datasets: [{ data: chartTotalCostData }],
                  }}
                  width={screenWidth - 32}
                  height={220}
                  yAxisLabel="¥"
                  yAxisSuffix=""
                  chartConfig={chartConfig}
                  style={styles.chart}
                  verticalLabelRotation={0}
                  showValuesOnTopOfBars
                />
              )}
            </Surface>

            {/* Unit Cost Chart */}
            <Surface style={styles.section} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                单位成本趋势
              </Text>
              {batchesData.length > 0 && (
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [{ data: chartUnitCostData }],
                  }}
                  width={screenWidth - 32}
                  height={220}
                  yAxisLabel="¥"
                  yAxisSuffix=""
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  }}
                  style={styles.chart}
                  bezier
                />
              )}
            </Surface>

            {/* Cost Structure Comparison */}
            <Surface style={styles.section} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                成本结构对比
              </Text>

              {batchesData.map((batch) => {
                const laborPercent = (batch.laborCost / batch.totalCost) * 100;
                const materialPercent =
                  (batch.materialCost / batch.totalCost) * 100;
                const equipmentPercent =
                  (batch.equipmentCost / batch.totalCost) * 100;
                const otherPercent = (batch.otherCost / batch.totalCost) * 100;

                return (
                  <View key={batch.batchId} style={styles.structureItem}>
                    <Text style={styles.structureBatch}>
                      {batch.batchNumber.slice(-7)}
                    </Text>
                    <View style={styles.structureBar}>
                      <View
                        style={[
                          styles.structureSegment,
                          {
                            width: `${laborPercent}%`,
                            backgroundColor: '#2196F3',
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.structureSegment,
                          {
                            width: `${materialPercent}%`,
                            backgroundColor: '#4CAF50',
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.structureSegment,
                          {
                            width: `${equipmentPercent}%`,
                            backgroundColor: '#FF9800',
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.structureSegment,
                          {
                            width: `${otherPercent}%`,
                            backgroundColor: '#9E9E9E',
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.structureLabels}>
                      <Text style={styles.structureLabel}>
                        人工 {laborPercent.toFixed(0)}%
                      </Text>
                      <Text style={styles.structureLabel}>
                        原料 {materialPercent.toFixed(0)}%
                      </Text>
                      <Text style={styles.structureLabel}>
                        设备 {equipmentPercent.toFixed(0)}%
                      </Text>
                      <Text style={styles.structureLabel}>
                        其他 {otherPercent.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendColor, { backgroundColor: '#2196F3' }]}
                  />
                  <Text style={styles.legendText}>人工成本</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendColor, { backgroundColor: '#4CAF50' }]}
                  />
                  <Text style={styles.legendText}>原料成本</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendColor, { backgroundColor: '#FF9800' }]}
                  />
                  <Text style={styles.legendText}>设备成本</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendColor, { backgroundColor: '#9E9E9E' }]}
                  />
                  <Text style={styles.legendText}>其他成本</Text>
                </View>
              </View>
            </Surface>
          </>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="file-export"
            onPress={() => {}}
            style={styles.actionButton}
          >
            导出报告
          </Button>
          <Button
            mode="contained"
            icon="robot"
            onPress={() => {}}
            style={styles.actionButton}
          >
            AI分析
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  performanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bestChip: {
    backgroundColor: '#E8F5E9',
  },
  bestChipText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 12,
  },
  worstChip: {
    backgroundColor: '#FFEBEE',
  },
  worstChipText: {
    color: '#F44336',
    fontWeight: '600',
    fontSize: 12,
  },
  performanceBatch: {
    fontSize: 13,
    color: '#212121',
  },
  performanceCost: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rangeLabel: {
    fontSize: 14,
    color: '#666',
  },
  rangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  tableHeaderCell: {
    minWidth: 80,
  },
  tableCell: {
    minWidth: 70,
  },
  batchNumberCell: {
    fontSize: 11,
    fontWeight: '600',
  },
  unitCostCell: {
    fontWeight: '600',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  structureItem: {
    marginBottom: 20,
  },
  structureBatch: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  structureBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  structureSegment: {
    height: '100%',
  },
  structureLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  structureLabel: {
    fontSize: 11,
    color: '#666',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
});
