import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
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
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { requireFactoryId } from '../../utils/factoryIdHelper';

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
      const factoryId = requireFactoryId();

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
        batchIds,
      });
      const errorMessage = getErrorMsg(error) || '加载成本对比数据失败';
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

  // Helper: format cost with appropriate units
  const formatCost = (cost: number): string => {
    if (cost === undefined || cost === null || isNaN(cost)) return '--';
    if (cost >= 10000) {
      return (cost / 10000).toFixed(2) + '万';
    } else if (cost >= 1000) {
      return cost.toFixed(0);
    } else {
      return cost.toFixed(2);
    }
  };

  // Helper: format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return '--';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

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
              ¥{(maxUnitCost - minUnitCost).toFixed(2)}/kg
              {minUnitCost > 0 && (
                <Text> ({((maxUnitCost - minUnitCost) / minUnitCost * 100).toFixed(1)}%)</Text>
              )}
            </Text>
          </View>
        </Surface>

        {/* Table or Chart View */}
        {viewMode === 'table' ? (
          <View>
            <Text variant="titleMedium" style={styles.cardSectionTitle}>
              成本明细对比
            </Text>

            {/* Batch Cards */}
            {batchesData.map((batch, index) => {
              const isLowest = batch.unitCost === minUnitCost;
              const isHighest = batch.unitCost === maxUnitCost;
              const diffFromAvg = avgUnitCost > 0
                ? ((batch.unitCost - avgUnitCost) / avgUnitCost * 100)
                : 0;

              return (
                <Surface
                  key={batch.batchId}
                  style={[
                    styles.batchCard,
                    isLowest && styles.batchCardBest,
                    isHighest && styles.batchCardWorst,
                  ]}
                  elevation={1}
                >
                  {/* Header */}
                  <View style={styles.batchCardHeader}>
                    <View style={styles.batchCardHeaderLeft}>
                      <Text style={styles.batchCardNumber}>
                        {batch.batchNumber || `批次 ${index + 1}`}
                      </Text>
                      {batch.productType && (
                        <Chip
                          mode="outlined"
                          compact
                          style={styles.productTypeChip}
                          textStyle={styles.productTypeChipText}
                        >
                          {batch.productType}
                        </Chip>
                      )}
                    </View>
                    {isLowest && (
                      <Chip mode="flat" style={styles.bestBadge} textStyle={styles.bestBadgeText} icon="trophy">
                        最优
                      </Chip>
                    )}
                    {isHighest && (
                      <Chip mode="flat" style={styles.worstBadge} textStyle={styles.worstBadgeText} icon="alert">
                        待优化
                      </Chip>
                    )}
                  </View>

                  {/* Meta Info */}
                  <View style={styles.batchCardMeta}>
                    {batch.date && (
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>日期</Text>
                        <Text style={styles.metaValue}>{formatDate(batch.date)}</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>数量</Text>
                      <Text style={styles.metaValue}>{batch.quantity?.toFixed(1) || '--'} kg</Text>
                    </View>
                  </View>

                  <Divider style={styles.batchCardDivider} />

                  {/* Cost Grid */}
                  <View style={styles.costGrid}>
                    <View style={styles.costGridItem}>
                      <Text style={styles.costGridLabel}>总成本</Text>
                      <Text style={styles.costGridValue}>¥{formatCost(batch.totalCost)}</Text>
                    </View>
                    <View style={styles.costGridItem}>
                      <View style={[styles.costGridDot, { backgroundColor: '#2196F3' }]} />
                      <Text style={styles.costGridLabel}>人工</Text>
                      <Text style={styles.costGridValue}>¥{formatCost(batch.laborCost)}</Text>
                    </View>
                    <View style={styles.costGridItem}>
                      <View style={[styles.costGridDot, { backgroundColor: '#4CAF50' }]} />
                      <Text style={styles.costGridLabel}>原料</Text>
                      <Text style={styles.costGridValue}>¥{formatCost(batch.materialCost)}</Text>
                    </View>
                    <View style={styles.costGridItem}>
                      <View style={[styles.costGridDot, { backgroundColor: '#FF9800' }]} />
                      <Text style={styles.costGridLabel}>设备</Text>
                      <Text style={styles.costGridValue}>¥{formatCost(batch.equipmentCost)}</Text>
                    </View>
                    <View style={styles.costGridItem}>
                      <View style={[styles.costGridDot, { backgroundColor: '#9E9E9E' }]} />
                      <Text style={styles.costGridLabel}>其他</Text>
                      <Text style={styles.costGridValue}>¥{formatCost(batch.otherCost)}</Text>
                    </View>
                  </View>

                  {/* Cost Bar */}
                  <View style={styles.costBarContainer}>
                    <View style={styles.costBar}>
                      <View
                        style={[
                          styles.costBarSegment,
                          { width: `${(batch.laborCost / batch.totalCost) * 100}%`, backgroundColor: '#2196F3' },
                        ]}
                      />
                      <View
                        style={[
                          styles.costBarSegment,
                          { width: `${(batch.materialCost / batch.totalCost) * 100}%`, backgroundColor: '#4CAF50' },
                        ]}
                      />
                      <View
                        style={[
                          styles.costBarSegment,
                          { width: `${(batch.equipmentCost / batch.totalCost) * 100}%`, backgroundColor: '#FF9800' },
                        ]}
                      />
                      <View
                        style={[
                          styles.costBarSegment,
                          { width: `${(batch.otherCost / batch.totalCost) * 100}%`, backgroundColor: '#9E9E9E' },
                        ]}
                      />
                    </View>
                  </View>

                  <Divider style={styles.batchCardDivider} />

                  {/* Unit Cost - Highlighted */}
                  <View style={styles.unitCostRow}>
                    <Text style={styles.unitCostLabel}>单位成本</Text>
                    <View style={styles.unitCostRight}>
                      <Text
                        style={[
                          styles.unitCostValue,
                          isLowest && styles.unitCostBest,
                          isHighest && styles.unitCostWorst,
                        ]}
                      >
                        ¥{batch.unitCost.toFixed(2)}/kg
                      </Text>
                      {avgUnitCost > 0 && (
                        <Text
                          style={[
                            styles.unitCostDiff,
                            diffFromAvg < 0 ? styles.unitCostDiffGood : styles.unitCostDiffBad,
                          ]}
                        >
                          {diffFromAvg > 0 ? '+' : ''}{diffFromAvg.toFixed(1)}%
                        </Text>
                      )}
                    </View>
                  </View>
                </Surface>
              );
            })}

            {/* Cost Legend */}
            <View style={styles.cardLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.legendText}>人工</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>原料</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.legendText}>设备</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#9E9E9E' }]} />
                <Text style={styles.legendText}>其他</Text>
              </View>
            </View>
          </View>
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
  // Card-based table styles
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#212121',
  },
  batchCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
  },
  batchCardBest: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#FAFFF8',
  },
  batchCardWorst: {
    borderLeftColor: '#F44336',
    backgroundColor: '#FFFAFA',
  },
  batchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  batchCardHeaderLeft: {
    flex: 1,
    gap: 6,
  },
  batchCardNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
  },
  productTypeChip: {
    alignSelf: 'flex-start',
    height: 24,
    borderColor: '#E0E0E0',
  },
  productTypeChipText: {
    fontSize: 11,
    color: '#666',
  },
  bestBadge: {
    backgroundColor: '#E8F5E9',
  },
  bestBadgeText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '600',
  },
  worstBadge: {
    backgroundColor: '#FFEBEE',
  },
  worstBadgeText: {
    color: '#F44336',
    fontSize: 11,
    fontWeight: '600',
  },
  batchCardMeta: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  metaValue: {
    fontSize: 13,
    color: '#424242',
    fontWeight: '500',
  },
  batchCardDivider: {
    marginVertical: 12,
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  costGridItem: {
    minWidth: '18%',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  costGridDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  costGridLabel: {
    fontSize: 10,
    color: '#757575',
    marginBottom: 4,
  },
  costGridValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
  },
  costBarContainer: {
    marginBottom: 4,
  },
  costBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  costBarSegment: {
    height: '100%',
  },
  unitCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitCostLabel: {
    fontSize: 14,
    color: '#666',
  },
  unitCostRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitCostValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  unitCostBest: {
    color: '#4CAF50',
  },
  unitCostWorst: {
    color: '#F44336',
  },
  unitCostDiff: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unitCostDiffGood: {
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
  },
  unitCostDiffBad: {
    backgroundColor: '#FFEBEE',
    color: '#F44336',
  },
  cardLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 16,
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
