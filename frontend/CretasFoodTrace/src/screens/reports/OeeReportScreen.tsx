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
import { reportApiClient, OeeReportDTO } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { GaugeChart } from '../../components/charts';

// 创建OeeReport专用logger
const oeeReportLogger = logger.createContextLogger('OeeReport');

// 目标OEE值
const TARGET_OEE = 85;

/**
 * OEE报表页面
 *
 * 展示内容:
 * - OEE总览 (大型仪表盘)
 * - 三个子指标: 可用性、表现性、质量率 (小型仪表盘)
 * - 设备OEE列表
 * - 每日OEE趋势图
 * - 损失帕累托图
 */
export default function OeeReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  // 数据状态
  const [oeeData, setOeeData] = useState<OeeReportDTO | null>(null);

  /**
   * 计算日期范围
   */
  const getDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();

    if (timeRange === 'week') {
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
   * 加载OEE数据
   */
  const loadOeeData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息');
        return;
      }

      const { startDate, endDate } = getDateRange();

      oeeReportLogger.debug('加载OEE报表数据', { timeRange, factoryId, startDate, endDate });

      const response = await reportApiClient.getOeeReport({
        factoryId,
        startDate,
        endDate,
      });

      if (response) {
        setOeeData(response);
        oeeReportLogger.info('OEE报表数据加载成功', {
          factoryId,
          overallOee: response.overallOee,
          availability: response.availability,
          performance: response.performance,
          quality: response.quality,
        });
      } else {
        oeeReportLogger.warn('获取OEE数据失败', { factoryId });
        setOeeData(null);
      }
    } catch (error) {
      oeeReportLogger.error('加载OEE报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage = getErrorMsg(error) || '加载OEE数据失败';
      Alert.alert('加载失败', errorMessage);
      setOeeData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOeeData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadOeeData();
    }, [timeRange])
  );

  /**
   * 获取OEE状态颜色
   */
  const getOeeStatusColor = (value: number): string => {
    if (value >= 85) return '#4CAF50';
    if (value >= 60) return '#FF9800';
    return '#F44336';
  };

  /**
   * 获取OEE状态标签
   */
  const getOeeStatusLabel = (value: number): string => {
    if (value >= 85) return '优秀';
    if (value >= 60) return '良好';
    if (value >= 40) return '一般';
    return '待改善';
  };

  /**
   * 格式化日期标签
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

  // 图表配置
  const screenWidth = Dimensions.get('window').width - 64;
  const chartConfig = {
    backgroundColor: '#FFF',
    backgroundGradientFrom: '#FFF',
    backgroundGradientTo: '#FFF',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#2196F3',
    },
  };

  // 准备趋势图数据
  const trendChartData = oeeData?.dailyOeeTrend && oeeData.dailyOeeTrend.length > 0
    ? {
        labels: oeeData.dailyOeeTrend.slice(-7).map((item) => formatDateLabel(item.date)),
        datasets: [
          {
            data: oeeData.dailyOeeTrend.slice(-7).map((item) => item.oee),
            strokeWidth: 2,
          },
        ],
      }
    : null;

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="OEE 设备效率报表" />
        <Appbar.Action icon="refresh" onPress={loadOeeData} />
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
        ) : oeeData ? (
          <>
            {/* OEE 总览卡片 */}
            <Surface style={styles.oeeOverviewCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                综合设备效率 (OEE)
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.mainGaugeContainer}>
                <GaugeChart
                  value={oeeData.overallOee ?? 0}
                  maxValue={100}
                  title="OEE"
                  unit="%"
                  size={200}
                  thresholds={{ warning: 60, danger: 85 }}
                  showTicks={true}
                  showLabels={true}
                />
              </View>

              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>目标: {oeeData.targetOee || TARGET_OEE}%</Text>
                <Chip
                  mode="flat"
                  style={[
                    styles.statusChip,
                    { backgroundColor: `${getOeeStatusColor(oeeData.overallOee ?? 0)}20` },
                  ]}
                  textStyle={[styles.statusChipText, { color: getOeeStatusColor(oeeData.overallOee ?? 0) }]}
                >
                  {getOeeStatusLabel(oeeData.overallOee ?? 0)}
                </Chip>
              </View>

              {(oeeData.overallOee ?? 0) >= (oeeData.targetOee || TARGET_OEE) ? (
                <View style={styles.achievementBadge}>
                  <Text style={styles.achievementText}>
                    已达成目标 (+{((oeeData.overallOee ?? 0) - (oeeData.targetOee || TARGET_OEE)).toFixed(1)}%)
                  </Text>
                </View>
              ) : (
                <View style={styles.gapBadge}>
                  <Text style={styles.gapText}>
                    距目标差 {((oeeData.targetOee || TARGET_OEE) - (oeeData.overallOee ?? 0)).toFixed(1)}%
                  </Text>
                </View>
              )}
            </Surface>

            {/* 三个子指标 */}
            <Surface style={styles.subIndicatorsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                OEE 组成因素
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.subGaugesRow}>
                <View style={styles.subGaugeItem}>
                  <GaugeChart
                    value={oeeData.availability ?? 0}
                    maxValue={100}
                    title="可用性"
                    unit="%"
                    size={110}
                    color="#2196F3"
                    thresholds={{ warning: 85, danger: 95 }}
                    showTicks={false}
                    showLabels={false}
                  />
                  <Text style={styles.subGaugeDesc}>设备运行时间</Text>
                </View>

                <View style={styles.subGaugeItem}>
                  <GaugeChart
                    value={oeeData.performance ?? 0}
                    maxValue={100}
                    title="表现性"
                    unit="%"
                    size={110}
                    color="#4CAF50"
                    thresholds={{ warning: 85, danger: 95 }}
                    showTicks={false}
                    showLabels={false}
                  />
                  <Text style={styles.subGaugeDesc}>实际产出效率</Text>
                </View>

                <View style={styles.subGaugeItem}>
                  <GaugeChart
                    value={oeeData.quality ?? 0}
                    maxValue={100}
                    title="质量率"
                    unit="%"
                    size={110}
                    color="#FF9800"
                    thresholds={{ warning: 95, danger: 99 }}
                    showTicks={false}
                    showLabels={false}
                  />
                  <Text style={styles.subGaugeDesc}>合格品比率</Text>
                </View>
              </View>

              <View style={styles.formulaContainer}>
                <Text style={styles.formulaText}>
                  OEE = 可用性 x 表现性 x 质量率
                </Text>
                <Text style={styles.formulaCalc}>
                  {(oeeData.overallOee ?? 0).toFixed(1)}% = {(oeeData.availability ?? 0).toFixed(1)}% x{' '}
                  {(oeeData.performance ?? 0).toFixed(1)}% x {(oeeData.quality ?? 0).toFixed(1)}%
                </Text>
              </View>
            </Surface>

            {/* 设备OEE列表 */}
            {oeeData.oeeByEquipment && oeeData.oeeByEquipment.length > 0 && (
              <Card style={styles.card} mode="elevated">
                <Card.Title title="设备OEE明细" titleVariant="titleMedium" />
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>设备名称</DataTable.Title>
                    <DataTable.Title numeric>OEE</DataTable.Title>
                    <DataTable.Title numeric>可用</DataTable.Title>
                    <DataTable.Title numeric>表现</DataTable.Title>
                    <DataTable.Title numeric>质量</DataTable.Title>
                  </DataTable.Header>

                  {oeeData.oeeByEquipment.map((equipment) => (
                    <DataTable.Row key={equipment.equipmentId}>
                      <DataTable.Cell>
                        <Text variant="bodySmall" numberOfLines={1}>
                          {equipment.equipmentName}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text
                          variant="bodySmall"
                          style={{ color: getOeeStatusColor(equipment.oee ?? 0), fontWeight: '600' }}
                        >
                          {(equipment.oee ?? 0).toFixed(1)}%
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text variant="bodySmall">{(equipment.availability ?? 0).toFixed(1)}%</Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text variant="bodySmall">{(equipment.performance ?? 0).toFixed(1)}%</Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text variant="bodySmall">{(equipment.quality ?? 0).toFixed(1)}%</Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </Card>
            )}

            {/* 每日OEE趋势图 */}
            {trendChartData && (
              <Surface style={styles.chartCard} elevation={1}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  OEE 趋势
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
                    <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={styles.legendText}>OEE值</Text>
                  </View>
                  <View style={styles.targetLine}>
                    <View style={styles.targetDash} />
                    <Text style={styles.legendText}>目标线 ({oeeData.targetOee || TARGET_OEE}%)</Text>
                  </View>
                </View>
              </Surface>
            )}

            {/* 损失帕累托图 */}
            {oeeData.topLosses && oeeData.topLosses.length > 0 && (
              <Surface style={styles.lossesCard} elevation={1}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  主要损失分析
                </Text>
                <Divider style={styles.divider} />

                {oeeData.topLosses.map((loss, index) => {
                  const barColor =
                    loss.category === '可用性损失'
                      ? '#F44336'
                      : loss.category === '表现性损失'
                      ? '#FF9800'
                      : '#9C27B0';

                  return (
                    <View key={index} style={styles.lossItem}>
                      <View style={styles.lossHeader}>
                        <View style={styles.lossLeft}>
                          <View style={[styles.lossCategoryDot, { backgroundColor: barColor }]} />
                          <Text style={styles.lossType}>{loss.lossType}</Text>
                        </View>
                        <Text style={styles.lossValue}>{loss.lossMinutes} 分钟</Text>
                      </View>
                      <View style={styles.lossBarContainer}>
                        <ProgressBar
                          progress={(loss.percentage ?? 0) / 100}
                          color={barColor}
                          style={styles.lossBar}
                        />
                        <Text style={styles.lossPercentage}>{(loss.percentage ?? 0).toFixed(1)}%</Text>
                      </View>
                      <Text style={styles.lossCategory}>{loss.category}</Text>
                    </View>
                  );
                })}

                <View style={styles.lossLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.legendText}>可用性损失</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={styles.legendText}>表现性损失</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
                    <Text style={styles.legendText}>质量损失</Text>
                  </View>
                </View>
              </Surface>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无OEE数据</Text>
            <Text style={styles.emptySubtext}>请确认工厂已配置设备效率监控</Text>
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
  oeeOverviewCard: {
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
    marginBottom: 4,
  },
  formulaCalc: {
    fontSize: 13,
    color: '#212121',
    fontWeight: '600',
  },
  card: {
    margin: 16,
    marginBottom: 8,
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
  lossesCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  lossItem: {
    marginBottom: 16,
  },
  lossHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lossLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lossCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lossType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
  },
  lossValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  lossBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lossBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  lossPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    minWidth: 50,
    textAlign: 'right',
  },
  lossCategory: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    marginLeft: 16,
  },
  lossLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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
