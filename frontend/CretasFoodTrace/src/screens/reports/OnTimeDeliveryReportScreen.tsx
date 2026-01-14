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
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { useAuthStore } from '../../store/authStore';
import { reportApiClient, OnTimeDeliveryReport } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { GaugeChart } from '../../components/charts';

// Create OTIF Report specific logger
const otifReportLogger = logger.createContextLogger('OtifReport');

// Default target OTIF value
const DEFAULT_TARGET_OTIF = 95;

/**
 * On-Time Delivery (OTIF) Report Screen
 *
 * Displays:
 * - OTIF Overview (main gauge)
 * - Three sub-indicators: OTIF Rate, On-Time Rate, In-Full Rate
 * - Order Statistics
 * - Order Details Table
 * - Daily OTIF Trend Chart
 */
export default function OnTimeDeliveryReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  // Data state
  const [otifData, setOtifData] = useState<OnTimeDeliveryReport | null>(null);

  /**
   * Calculate date range based on selected time range
   */
  const getDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();

    if (timeRange === 'day') {
      startDate.setDate(endDate.getDate() - 1);
    } else if (timeRange === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0] as string,
      endDate: endDate.toISOString().split('T')[0] as string,
    };
  }, [timeRange]);

  /**
   * Load OTIF data
   */
  const loadOtifData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息');
        return;
      }

      const { startDate, endDate } = getDateRange();

      otifReportLogger.debug('加载OTIF报表数据', { timeRange, factoryId, startDate, endDate });

      const response = await reportApiClient.getOnTimeDeliveryReport({
        factoryId,
        startDate,
        endDate,
      });

      if (response) {
        setOtifData(response);
        otifReportLogger.info('OTIF报表数据加载成功', {
          factoryId,
          otifRate: response.otifRate,
          onTimeRate: response.onTimeRate,
          inFullRate: response.inFullRate,
          totalOrders: response.totalOrders,
        });
      } else {
        otifReportLogger.warn('获取OTIF数据失败', { factoryId });
        setOtifData(null);
      }
    } catch (error) {
      otifReportLogger.error('加载OTIF报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage = getErrorMsg(error) || '加载OTIF数据失败';
      Alert.alert('加载失败', errorMessage);
      setOtifData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh data
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOtifData();
    setRefreshing(false);
  };

  /**
   * Load data when screen is focused
   */
  useFocusEffect(
    useCallback(() => {
      loadOtifData();
    }, [timeRange])
  );

  /**
   * Get status color based on OTIF value
   */
  const getOtifStatusColor = (value: number, target: number = DEFAULT_TARGET_OTIF): string => {
    if (value >= target) return '#4CAF50';
    if (value >= target - 10) return '#FF9800';
    return '#F44336';
  };

  /**
   * Get status label based on OTIF value
   */
  const getOtifStatusLabel = (value: number, target: number = DEFAULT_TARGET_OTIF): string => {
    if (value >= target) return '优秀';
    if (value >= target - 10) return '良好';
    if (value >= target - 20) return '一般';
    return '待改善';
  };

  /**
   * Get order status color
   */
  const getOrderStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return '#4CAF50'; // green
      case 'shipped':
        return '#2196F3'; // blue
      case 'pending':
        return '#FF9800'; // orange
      default:
        return '#9E9E9E'; // grey
    }
  };

  /**
   * Get order status label in Chinese
   */
  const getOrderStatusLabel = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return '已送达';
      case 'shipped':
        return '运输中';
      case 'pending':
        return '待发货';
      default:
        return status;
    }
  };

  /**
   * Format date label for chart
   */
  const formatDateLabel = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateString.slice(-5);
    }
  };

  /**
   * Format date for display
   */
  const formatShipmentDate = (dateString: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateString;
    }
  };

  // Chart configuration
  const screenWidth = Dimensions.get('window').width - 64;
  const chartConfig = {
    backgroundColor: '#FFF',
    backgroundGradientFrom: '#FFF',
    backgroundGradientTo: '#FFF',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4CAF50',
    },
  };

  // Prepare trend chart data
  const trendChartData = otifData?.dailyTrend && otifData.dailyTrend.length > 0
    ? {
        labels: otifData.dailyTrend.slice(-7).map((item) => formatDateLabel(item.date)),
        datasets: [
          {
            data: otifData.dailyTrend.slice(-7).map((item) => item.otifRate),
            strokeWidth: 2,
          },
        ],
      }
    : null;

  const targetOtif = otifData?.target || DEFAULT_TARGET_OTIF;

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="准时交付率 (OTIF)" />
        <Appbar.Action icon="refresh" onPress={loadOtifData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Time Range Selector */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <Text variant="bodyMedium" style={styles.sectionLabel}>
            时间范围
          </Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '近7天' },
              { value: 'month', label: '近30天' },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : otifData ? (
          <>
            {/* OTIF Overview Card */}
            <Surface style={styles.otifOverviewCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                准时足量交付率 (OTIF)
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.mainGaugeContainer}>
                <GaugeChart
                  value={otifData.otifRate ?? 0}
                  maxValue={100}
                  title="OTIF"
                  unit="%"
                  size={200}
                  thresholds={{ warning: targetOtif - 10, danger: targetOtif }}
                  showTicks={true}
                  showLabels={true}
                />
              </View>

              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>目标: {targetOtif}%</Text>
                <Chip
                  mode="flat"
                  style={[
                    styles.statusChip,
                    { backgroundColor: `${getOtifStatusColor(otifData.otifRate ?? 0, targetOtif)}20` },
                  ]}
                  textStyle={[styles.statusChipText, { color: getOtifStatusColor(otifData.otifRate ?? 0, targetOtif) }]}
                >
                  {getOtifStatusLabel(otifData.otifRate ?? 0, targetOtif)}
                </Chip>
              </View>

              {(otifData.otifRate ?? 0) >= targetOtif ? (
                <View style={styles.achievementBadge}>
                  <Text style={styles.achievementText}>
                    已达成目标 (+{((otifData.otifRate ?? 0) - targetOtif).toFixed(1)}%)
                  </Text>
                </View>
              ) : (
                <View style={styles.gapBadge}>
                  <Text style={styles.gapText}>
                    距目标差 {(targetOtif - (otifData.otifRate ?? 0)).toFixed(1)}%
                  </Text>
                </View>
              )}
            </Surface>

            {/* Three Sub-Indicators */}
            <Surface style={styles.subIndicatorsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                交付指标明细
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.subGaugesRow}>
                <View style={styles.subGaugeItem}>
                  <GaugeChart
                    value={otifData.otifRate ?? 0}
                    maxValue={100}
                    title="OTIF率"
                    unit="%"
                    size={110}
                    color="#4CAF50"
                    thresholds={{ warning: 85, danger: 95 }}
                    showTicks={false}
                    showLabels={false}
                  />
                  <Text style={styles.subGaugeDesc}>准时且足量</Text>
                </View>

                <View style={styles.subGaugeItem}>
                  <GaugeChart
                    value={otifData.onTimeRate ?? 0}
                    maxValue={100}
                    title="准时率"
                    unit="%"
                    size={110}
                    color="#2196F3"
                    thresholds={{ warning: 85, danger: 95 }}
                    showTicks={false}
                    showLabels={false}
                  />
                  <Text style={styles.subGaugeDesc}>按时交付</Text>
                </View>

                <View style={styles.subGaugeItem}>
                  <GaugeChart
                    value={otifData.inFullRate ?? 0}
                    maxValue={100}
                    title="足量率"
                    unit="%"
                    size={110}
                    color="#FF9800"
                    thresholds={{ warning: 85, danger: 95 }}
                    showTicks={false}
                    showLabels={false}
                  />
                  <Text style={styles.subGaugeDesc}>数量完整</Text>
                </View>
              </View>
            </Surface>

            {/* Order Statistics */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                订单统计
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{otifData.totalOrders}</Text>
                  <Text style={styles.statLabel}>总订单</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>{otifData.onTimeOrders}</Text>
                  <Text style={styles.statLabel}>准时订单</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#2196F3' }]}>{otifData.otifOrders}</Text>
                  <Text style={styles.statLabel}>OTIF订单</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#FF9800' }]}>{otifData.inFullOrders}</Text>
                  <Text style={styles.statLabel}>足量订单</Text>
                </View>
              </View>

              {/* Progress bars */}
              <View style={styles.progressSection}>
                <View style={styles.progressItem}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>准时率</Text>
                    <Text style={styles.progressValue}>{(otifData.onTimeRate ?? 0).toFixed(1)}%</Text>
                  </View>
                  <ProgressBar
                    progress={(otifData.onTimeRate ?? 0) / 100}
                    color="#4CAF50"
                    style={styles.progressBar}
                  />
                </View>

                <View style={styles.progressItem}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>足量率</Text>
                    <Text style={styles.progressValue}>{(otifData.inFullRate ?? 0).toFixed(1)}%</Text>
                  </View>
                  <ProgressBar
                    progress={(otifData.inFullRate ?? 0) / 100}
                    color="#FF9800"
                    style={styles.progressBar}
                  />
                </View>

                <View style={styles.progressItem}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>OTIF率</Text>
                    <Text style={styles.progressValue}>{(otifData.otifRate ?? 0).toFixed(1)}%</Text>
                  </View>
                  <ProgressBar
                    progress={(otifData.otifRate ?? 0) / 100}
                    color="#2196F3"
                    style={styles.progressBar}
                  />
                </View>
              </View>
            </Surface>

            {/* Order Details Table */}
            {otifData.orderDetails && otifData.orderDetails.length > 0 && (
              <Card style={styles.card} mode="elevated">
                <Card.Title title="近期订单明细" titleVariant="titleMedium" />
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>订单号</DataTable.Title>
                    <DataTable.Title numeric>数量</DataTable.Title>
                    <DataTable.Title>日期</DataTable.Title>
                    <DataTable.Title>状态</DataTable.Title>
                    <DataTable.Title>OTIF</DataTable.Title>
                  </DataTable.Header>

                  {otifData.orderDetails.slice(0, 10).map((order) => (
                    <DataTable.Row key={order.shipmentId}>
                      <DataTable.Cell>
                        <Text variant="bodySmall" numberOfLines={1}>
                          {order.orderNumber}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text variant="bodySmall">{order.quantity}</Text>
                      </DataTable.Cell>
                      <DataTable.Cell>
                        <Text variant="bodySmall">{formatShipmentDate(order.shipmentDate)}</Text>
                      </DataTable.Cell>
                      <DataTable.Cell>
                        <Chip
                          mode="flat"
                          compact
                          style={[
                            styles.orderStatusChip,
                            { backgroundColor: `${getOrderStatusColor(order.status)}20` },
                          ]}
                          textStyle={[styles.orderStatusText, { color: getOrderStatusColor(order.status) }]}
                        >
                          {getOrderStatusLabel(order.status)}
                        </Chip>
                      </DataTable.Cell>
                      <DataTable.Cell>
                        <View style={styles.otifIndicators}>
                          <View
                            style={[
                              styles.indicator,
                              { backgroundColor: order.onTime ? '#4CAF50' : '#F44336' },
                            ]}
                          >
                            <Text style={styles.indicatorText}>T</Text>
                          </View>
                          <View
                            style={[
                              styles.indicator,
                              { backgroundColor: order.inFull ? '#4CAF50' : '#F44336' },
                            ]}
                          >
                            <Text style={styles.indicatorText}>F</Text>
                          </View>
                        </View>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </Card>
            )}

            {/* Daily OTIF Trend Chart */}
            {trendChartData && (
              <Surface style={styles.chartCard} elevation={1}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  OTIF 趋势
                </Text>
                <Divider style={styles.divider} />

                <LineChart
                  data={trendChartData}
                  width={screenWidth}
                  height={220}
                  yAxisSuffix="%"
                  chartConfig={chartConfig}
                  style={styles.chart}
                  bezier
                  fromZero
                  yAxisInterval={20}
                />

                <View style={styles.trendLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.legendText}>OTIF率</Text>
                  </View>
                  <View style={styles.targetLine}>
                    <View style={styles.targetDash} />
                    <Text style={styles.legendText}>目标线 ({targetOtif}%)</Text>
                  </View>
                </View>
              </Surface>
            )}

            {/* Legend Explanation */}
            <Surface style={styles.legendCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                指标说明
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.legendExplanation}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendIndicator, { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.legendIndicatorText}>T</Text>
                  </View>
                  <Text style={styles.legendDesc}>On-Time: 准时交付</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendIndicator, { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.legendIndicatorText}>F</Text>
                  </View>
                  <Text style={styles.legendDesc}>In-Full: 足量交付</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendIndicator, { backgroundColor: '#F44336' }]}>
                    <Text style={styles.legendIndicatorText}>T/F</Text>
                  </View>
                  <Text style={styles.legendDesc}>红色: 未达成</Text>
                </View>
              </View>

              <View style={styles.formulaContainer}>
                <Text style={styles.formulaText}>
                  OTIF = 准时且足量订单数 / 总订单数 x 100%
                </Text>
              </View>
            </Surface>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无OTIF数据</Text>
            <Text style={styles.emptySubtext}>请确认工厂已配置交付监控</Text>
          </View>
        )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  otifOverviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  mainGaugeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  targetLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  achievementBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  achievementText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  gapBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  gapText: {
    color: '#FF9800',
    fontWeight: '600',
    fontSize: 14,
  },
  subIndicatorsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  subGaugesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  subGaugeItem: {
    alignItems: 'center',
  },
  subGaugeDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  progressSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
  },
  progressItem: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: '#666',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  orderStatusChip: {
    height: 24,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  otifIndicators: {
    flexDirection: 'row',
    gap: 4,
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  targetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetDash: {
    width: 16,
    height: 2,
    backgroundColor: '#F44336',
  },
  legendCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  legendExplanation: {
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendIndicator: {
    width: 28,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendIndicatorText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  legendDesc: {
    fontSize: 13,
    color: '#666',
  },
  formulaContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  formulaText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  bottomPadding: {
    height: 80,
  },
});
