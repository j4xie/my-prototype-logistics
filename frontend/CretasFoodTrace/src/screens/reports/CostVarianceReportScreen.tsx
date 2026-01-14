import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Dimensions } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  DataTable,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Rect, Line, Text as SvgText, G, Circle, Path } from 'react-native-svg';
import { useAuthStore } from '../../store/authStore';
import { reportApiClient, CostVarianceReportDTO } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { WaterfallChart, WaterfallDataItem } from '../../components/charts';
import { theme } from '../../theme';

// 创建 CostVarianceReport 专用 logger
const costVarianceLogger = logger.createContextLogger('CostVarianceReport');

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * 成本差异报表页面
 *
 * 展示内容:
 * - 成本差异总览（计划成本、实际成本、差异金额、差异率）
 * - 成本组成瀑布图（WaterfallChart）
 * - 按类别差异分析
 * - 差异最大项目列表
 * - 差异趋势图
 */
export default function CostVarianceReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  const [reportData, setReportData] = useState<CostVarianceReportDTO | null>(null);

  /**
   * 计算日期范围
   */
  const getDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();

    if (timeRange === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0] as string,
      endDate: endDate.toISOString().split('T')[0] as string,
    };
  }, [timeRange]);

  /**
   * 加载成本差异数据
   */
  const loadCostVarianceData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      const { startDate, endDate } = getDateRange();

      costVarianceLogger.debug('加载成本差异报表数据', { timeRange, factoryId, startDate, endDate });

      const data = await reportApiClient.getCostVarianceReport({
        startDate,
        endDate,
        factoryId,
      });

      setReportData(data);

      costVarianceLogger.info('成本差异报表数据加载成功', {
        totalPlannedCost: data.totalPlannedCost?.toFixed(2),
        totalActualCost: data.totalActualCost?.toFixed(2),
        totalVariance: data.totalVariance?.toFixed(2),
        totalVarianceRate: data.totalVarianceRate?.toFixed(2),
        factoryId,
      });
    } catch (error) {
      costVarianceLogger.error('加载成本差异报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage = getErrorMsg(error) || '加载成本差异报表失败';
      Alert.alert('加载失败', errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCostVarianceData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadCostVarianceData();
    }, [timeRange])
  );

  /**
   * 格式化金额
   */
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /**
   * 格式化百分比
   */
  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  /**
   * 生成瀑布图数据
   */
  const waterfallData = useMemo((): WaterfallDataItem[] => {
    if (!reportData || !reportData.varianceByCategory) return [];

    const data: WaterfallDataItem[] = [
      { name: '计划成本', value: reportData.totalPlannedCost || 0, type: 'start' },
    ];

    // 按差异大小排序并添加各类别差异
    const sortedCategories = [...reportData.varianceByCategory].sort(
      (a, b) => Math.abs(b.variance) - Math.abs(a.variance)
    );

    sortedCategories.forEach((category) => {
      if (category.variance !== 0) {
        data.push({
          name: category.category,
          value: Math.abs(category.variance),
          type: category.variance > 0 ? 'increase' : 'decrease',
        });
      }
    });

    data.push({ name: '实际成本', value: reportData.totalActualCost || 0, type: 'total' });

    return data;
  }, [reportData]);

  /**
   * 渲染趋势图
   */
  const renderTrendChart = () => {
    if (!reportData?.varianceTrend || reportData.varianceTrend.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无趋势数据</Text>
        </View>
      );
    }

    const trend = reportData.varianceTrend;
    const chartWidth = SCREEN_WIDTH - 64;
    const chartHeight = 200;
    const padding = { top: 20, right: 16, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // 计算数据范围
    const allValues = trend.flatMap((d) => [d.plannedCost, d.actualCost]);
    const minValue = Math.min(...allValues) * 0.9;
    const maxValue = Math.max(...allValues) * 1.1;

    // 缩放函数
    const xScale = (index: number) => (index / (trend.length - 1)) * innerWidth;
    const yScale = (value: number) =>
      innerHeight - ((value - minValue) / (maxValue - minValue)) * innerHeight;

    // 生成路径
    const plannedPath = trend
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.plannedCost)}`)
      .join(' ');
    const actualPath = trend
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.actualCost)}`)
      .join(' ');

    return (
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          <G transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Y轴网格线 */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = innerHeight * (1 - ratio);
              const value = minValue + (maxValue - minValue) * ratio;
              return (
                <G key={`grid-${index}`}>
                  <Line
                    x1={0}
                    y1={y}
                    x2={innerWidth}
                    y2={y}
                    stroke={theme.colors.divider}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={-8}
                    y={y + 4}
                    fontSize={10}
                    fill={theme.colors.textSecondary}
                    textAnchor="end"
                  >
                    {formatCurrency(value).replace('¥', '')}
                  </SvgText>
                </G>
              );
            })}

            {/* 计划成本线 */}
            <Path d={plannedPath} stroke={theme.colors.primary} strokeWidth={2} fill="none" />

            {/* 实际成本线 */}
            <Path d={actualPath} stroke={theme.colors.error} strokeWidth={2} fill="none" />

            {/* 数据点 */}
            {trend.map((d, i) => (
              <G key={`points-${i}`}>
                <Circle cx={xScale(i)} cy={yScale(d.plannedCost)} r={4} fill={theme.colors.primary} />
                <Circle cx={xScale(i)} cy={yScale(d.actualCost)} r={4} fill={theme.colors.error} />
              </G>
            ))}

            {/* X轴标签 */}
            {trend.map((d, i) => {
              if (i % Math.ceil(trend.length / 5) !== 0 && i !== trend.length - 1) return null;
              const date = new Date(d.date);
              const label = `${date.getMonth() + 1}/${date.getDate()}`;
              return (
                <SvgText
                  key={`x-label-${i}`}
                  x={xScale(i)}
                  y={innerHeight + 16}
                  fontSize={10}
                  fill={theme.colors.textSecondary}
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              );
            })}
          </G>
        </Svg>

        {/* 图例 */}
        <View style={styles.trendLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: theme.colors.primary }]} />
            <Text style={styles.legendText}>计划成本</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: theme.colors.error }]} />
            <Text style={styles.legendText}>实际成本</Text>
          </View>
        </View>
      </View>
    );
  };

  /**
   * 获取差异状态颜色
   */
  const getVarianceColor = (variance: number): string => {
    if (variance > 0) return theme.colors.error; // 超支 - 红色
    if (variance < 0) return theme.colors.success; // 节约 - 绿色
    return theme.colors.textSecondary; // 持平 - 灰色
  };

  /**
   * 获取差异状态文字
   */
  const getVarianceStatus = (varianceRate: number): string => {
    if (varianceRate > 10) return '严重超支';
    if (varianceRate > 5) return '超支';
    if (varianceRate > 0) return '轻微超支';
    if (varianceRate === 0) return '持平';
    if (varianceRate > -5) return '轻微节约';
    if (varianceRate > -10) return '节约';
    return '大幅节约';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="成本差异分析" />
        <Appbar.Action icon="refresh" onPress={loadCostVarianceData} />
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
            onValueChange={(value) => setTimeRange(value as 'week' | 'month')}
            buttons={[
              { value: 'week', label: '近一周' },
              { value: 'month', label: '近一月' },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {/* 成本差异总览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            成本差异总览
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : reportData ? (
            <>
              {/* 差异金额和差异率 */}
              <View style={styles.varianceHighlight}>
                <View style={styles.varianceMainContainer}>
                  <Text style={styles.varianceLabel}>总差异金额</Text>
                  <Text
                    style={[
                      styles.varianceValue,
                      { color: getVarianceColor(reportData.totalVariance) },
                    ]}
                  >
                    {reportData.totalVariance >= 0 ? '+' : ''}
                    {formatCurrency(reportData.totalVariance)}
                  </Text>
                </View>
                <View style={styles.varianceRateContainer}>
                  <Text
                    style={[
                      styles.varianceRateValue,
                      { color: getVarianceColor(reportData.totalVarianceRate) },
                    ]}
                  >
                    {formatPercent(reportData.totalVarianceRate)}
                  </Text>
                  <Text style={styles.varianceStatus}>
                    {getVarianceStatus(reportData.totalVarianceRate)}
                  </Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* 计划成本与实际成本对比 */}
              <View style={styles.costComparisonGrid}>
                <View style={styles.costBox}>
                  <Text style={styles.costBoxLabel}>计划成本</Text>
                  <Text style={[styles.costBoxValue, { color: theme.colors.primary }]}>
                    {formatCurrency(reportData.totalPlannedCost)}
                  </Text>
                </View>
                <View style={styles.costBox}>
                  <Text style={styles.costBoxLabel}>实际成本</Text>
                  <Text style={[styles.costBoxValue, { color: theme.colors.error }]}>
                    {formatCurrency(reportData.totalActualCost)}
                  </Text>
                </View>
              </View>

              {/* 差异进度条 */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>实际/计划</Text>
                  <Text style={styles.progressValue}>
                    {reportData.totalPlannedCost > 0
                      ? `${((reportData.totalActualCost / reportData.totalPlannedCost) * 100).toFixed(1)}%`
                      : '-'}
                  </Text>
                </View>
                <ProgressBar
                  progress={
                    reportData.totalPlannedCost > 0
                      ? Math.min(reportData.totalActualCost / reportData.totalPlannedCost, 1.5)
                      : 0
                  }
                  color={
                    reportData.totalActualCost > reportData.totalPlannedCost
                      ? theme.colors.error
                      : theme.colors.success
                  }
                  style={styles.progressBar}
                />
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无成本差异数据</Text>
            </View>
          )}
        </Surface>

        {/* 成本组成瀑布图 */}
        {reportData && waterfallData.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="成本组成分析" titleVariant="titleMedium" />
            <Card.Content>
              <WaterfallChart
                data={waterfallData}
                width={SCREEN_WIDTH - 64}
                height={280}
                showConnectors={true}
                showLabels={true}
                formatValue={(v) => `¥${(v / 1000).toFixed(1)}k`}
              />
            </Card.Content>
          </Card>
        )}

        {/* 按类别差异分析 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="按类别差异分析" titleVariant="titleMedium" />
          <Card.Content>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
              </View>
            ) : reportData?.varianceByCategory && reportData.varianceByCategory.length > 0 ? (
              <View>
                {reportData.varianceByCategory.map((category, index) => (
                  <View key={index} style={styles.categoryItem}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryName}>{category.category}</Text>
                      <Text
                        style={[
                          styles.categoryVariance,
                          { color: getVarianceColor(category.variance) },
                        ]}
                      >
                        {category.variance >= 0 ? '+' : ''}
                        {formatCurrency(category.variance)}
                      </Text>
                    </View>
                    <View style={styles.categoryDetails}>
                      <Text style={styles.categoryDetailText}>
                        计划: {formatCurrency(category.plannedCost)}
                      </Text>
                      <Text style={styles.categoryDetailText}>
                        实际: {formatCurrency(category.actualCost)}
                      </Text>
                      <Text
                        style={[
                          styles.categoryRateText,
                          { color: getVarianceColor(category.varianceRate) },
                        ]}
                      >
                        {formatPercent(category.varianceRate)}
                      </Text>
                    </View>
                    <ProgressBar
                      progress={
                        category.plannedCost > 0
                          ? Math.min(category.actualCost / category.plannedCost, 1.5)
                          : 0
                      }
                      color={category.variance > 0 ? theme.colors.error : theme.colors.success}
                      style={styles.categoryProgress}
                    />
                    {index < reportData.varianceByCategory.length - 1 && (
                      <Divider style={styles.categoryDivider} />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无类别差异数据</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* 差异最大项目列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="差异最大项目" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>项目</DataTable.Title>
              <DataTable.Title>类别</DataTable.Title>
              <DataTable.Title numeric>差异</DataTable.Title>
              <DataTable.Title numeric>差异率</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : reportData?.topVarianceItems && reportData.topVarianceItems.length > 0 ? (
              reportData.topVarianceItems.slice(0, 10).map((item, index) => (
                <DataTable.Row key={index}>
                  <DataTable.Cell>
                    <Text variant="bodySmall" numberOfLines={1}>
                      {item.itemName}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall" numberOfLines={1}>
                      {item.category}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text
                      variant="bodySmall"
                      style={{ color: getVarianceColor(item.variance) }}
                    >
                      {item.variance >= 0 ? '+' : ''}
                      {formatCurrency(item.variance)}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text
                      variant="bodySmall"
                      style={{ color: getVarianceColor(item.varianceRate) }}
                    >
                      {formatPercent(item.varianceRate)}
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无差异项目数据
                </Text>
              </View>
            )}
          </DataTable>
        </Card>

        {/* 差异趋势图 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="成本差异趋势" titleVariant="titleMedium" />
          <Card.Content>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
              </View>
            ) : (
              renderTrendChart()
            )}
          </Card.Content>
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
  varianceHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  varianceMainContainer: {
    flex: 1,
  },
  varianceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  varianceValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  varianceRateContainer: {
    alignItems: 'flex-end',
  },
  varianceRateValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  varianceStatus: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  costComparisonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  costBox: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  costBoxLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  costBoxValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 8,
  },
  categoryItem: {
    paddingVertical: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryVariance: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryDetailText: {
    fontSize: 12,
    color: '#666',
  },
  categoryRateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryProgress: {
    height: 6,
    borderRadius: 3,
  },
  categoryDivider: {
    marginTop: 12,
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
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
