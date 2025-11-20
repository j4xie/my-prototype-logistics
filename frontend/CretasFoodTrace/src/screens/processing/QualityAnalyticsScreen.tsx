import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  SegmentedButtons,
  Chip,
  ActivityIndicator,
  DataTable,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import {
  qualityInspectionApiClient,
  type QualityStatistics,
  type QualityTrendPoint,
} from '../../services/api/qualityInspectionApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建QualityAnalytics专用logger
const qualityAnalyticsLogger = logger.createContextLogger('QualityAnalytics');

const { width } = Dimensions.get('window');

/**
 * 质检统计分析页面
 * P1-002: 质检完整流程 - 质检统计分析
 *
 * 功能：
 * - 合格率趋势图 (使用 GET /quality/trends)
 * - 质检统计概览 (使用 GET /quality/statistics)
 * - 数据可视化展示
 */
export default function QualityAnalyticsScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  // Backend API data (QualityStatistics from API)
  const [statistics, setStatistics] = useState<QualityStatistics | null>(null);
  const [trends, setTrends] = useState<QualityTrendPoint[]>([]);

  /**
   * 计算日期范围
   */
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
    }

    return {
      startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  /**
   * 计算趋势天数
   */
  const getTrendDays = () => {
    switch (timeRange) {
      case 'week':
        return 7;
      case 'month':
        return 30;
      case 'quarter':
        return 90;
      default:
        return 30;
    }
  };

  /**
   * 加载数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const trendDays = getTrendDays();

      qualityAnalyticsLogger.debug('加载质检统计分析', {
        factoryId,
        startDate,
        endDate,
        trendDays,
        timeRange,
      });

      // 并行加载统计和趋势数据
      const [statsResponse, trendsResponse] = await Promise.all([
        // API 1: 获取质量统计
        qualityInspectionApiClient.getStatistics(
          { startDate, endDate },
          factoryId
        ),
        // API 2: 获取质量趋势
        qualityInspectionApiClient.getTrends(trendDays, factoryId),
      ]);

      qualityAnalyticsLogger.info('质检统计数据加载成功', {
        hasStatistics: !!statsResponse.data,
        hasTrends: !!trendsResponse.data,
        trendPoints: trendsResponse.data?.length || 0,
        factoryId,
      });

      // 更新状态
      if (statsResponse.success && statsResponse.data) {
        setStatistics(statsResponse.data);
      }

      if (trendsResponse.success && trendsResponse.data) {
        setTrends(trendsResponse.data);
      }
    } catch (error) {
      qualityAnalyticsLogger.error('加载质检统计分析失败', error as Error, {
        factoryId,
        timeRange,
      });
      const errorMessage = error.response?.data?.message || error.message || '无法加载质检统计，请稍后重试';
      Alert.alert('加载失败', errorMessage);

      // Clear data on error
      setStatistics(null);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [timeRange])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 转换趋势数据为图表格式
  const getTrendChartData = () => {
    if (!trends || trends.length === 0) {
      return {
        labels: ['暂无数据'],
        datasets: [{ data: [0], color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, strokeWidth: 2 }],
      };
    }

    // Sort trends by date
    const sortedTrends = [...trends].sort((a, b) => a.date.localeCompare(b.date));

    // Generate labels based on time range
    const labels = sortedTrends.map((trend, index) => {
      const date = new Date(trend.date);
      if (timeRange === 'week') {
        return date.toLocaleDateString('zh-CN', { month: 'M', day: 'D' });
      } else if (timeRange === 'month') {
        const weekNum = Math.floor(index / 7) + 1;
        return `第${weekNum}周`;
      } else {
        const monthNum = date.getMonth() + 1;
        return `${monthNum}月`;
      }
    });

    // Extract pass rates
    const data = sortedTrends.map(trend => trend.passRate || 0);

    return {
      labels: labels.slice(0, 10), // Limit to 10 labels to avoid crowding
      datasets: [
        {
          data: data.slice(0, 10),
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  // 计算统计概览数据
  const getStatsOverview = () => {
    if (!statistics) {
      return {
        qualificationRate: 0,
        totalInspections: 0,
        averagePassRate: 0,
      };
    }

    const totalInspections = statistics.totalInspections || 0;
    const passedInspections = statistics.passedInspections || 0;
    const qualificationRate = totalInspections > 0
      ? (passedInspections / totalInspections) * 100
      : 0;

    return {
      qualificationRate: qualificationRate.toFixed(2),
      totalInspections,
      averagePassRate: (statistics.averagePassRate || 0).toFixed(2),
    };
  };

  const trendData = getTrendChartData();
  const statsOverview = getStatsOverview();

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="质检统计分析" />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 时间范围选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <SegmentedButtons
              value={timeRange}
              onValueChange={(value) => {
                if (value === 'week' || value === 'month' || value === 'quarter') {
                  setTimeRange(value);
                }
              }}
              buttons={[
                { value: 'week', label: '本周' },
                { value: 'month', label: '本月' },
                { value: 'quarter', label: '本季度' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* 统计概览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="统计概览" />
          <Card.Content>
            {!statistics || loading ? (
              <View style={styles.statsRow}>
                <Text variant="bodyMedium" style={{ color: '#999' }}>
                  加载中...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={styles.statValue}>
                      {statsOverview.qualificationRate}%
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      合格率
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statValue, { color: '#FF9800' }]}>
                      {statsOverview.averagePassRate}%
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      平均合格率
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statValue, { color: '#4CAF50' }]}>
                      {statsOverview.totalInspections}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      总检测数
                    </Text>
                  </View>
                </View>
                <View style={styles.statsDetailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>合格数:</Text>
                    <Text style={styles.detailValue}>{statistics.passedInspections}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>不合格:</Text>
                    <Text style={styles.detailValue}>{statistics.failedInspections}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>条件合格:</Text>
                    <Text style={styles.detailValue}>{statistics.conditionalInspections}</Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* 合格率趋势 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="合格率趋势" />
          <Card.Content>
            {trends.length === 0 || loading ? (
              <View style={styles.emptyChart}>
                <Text variant="bodyMedium" style={{ color: '#999' }}>
                  {loading ? '加载中...' : '暂无趋势数据'}
                </Text>
              </View>
            ) : (
              <LineChart
                data={trendData}
                width={width - 64}
                height={200}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: '6', strokeWidth: '2', stroke: '#4CAF50' },
                }}
                bezier
                style={styles.chart}
              />
            )}
          </Card.Content>
        </Card>

        {/* 质检数据详细信息 */}
        {statistics && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="质检数据详情" />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>指标</DataTable.Title>
                  <DataTable.Title numeric>数量</DataTable.Title>
                </DataTable.Header>
                <DataTable.Row>
                  <DataTable.Cell>样本总数</DataTable.Cell>
                  <DataTable.Cell numeric>{statistics.totalSampleSize || 0}</DataTable.Cell>
                </DataTable.Row>
                <DataTable.Row>
                  <DataTable.Cell>合格样本数</DataTable.Cell>
                  <DataTable.Cell numeric>{statistics.totalPassCount || 0}</DataTable.Cell>
                </DataTable.Row>
                <DataTable.Row>
                  <DataTable.Cell>不合格样本数</DataTable.Cell>
                  <DataTable.Cell numeric>{statistics.totalFailCount || 0}</DataTable.Cell>
                </DataTable.Row>
              </DataTable>
            </Card.Content>
          </Card>
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
  card: {
    margin: 16,
    marginBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  statsDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
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
