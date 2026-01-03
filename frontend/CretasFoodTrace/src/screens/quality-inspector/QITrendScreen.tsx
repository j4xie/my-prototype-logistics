/**
 * 趋势分析页面
 * Quality Inspector - Trend Analysis Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  QI_COLORS,
  GRADE_COLORS,
} from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;

interface TrendData {
  dates: string[];
  passRates: number[];
  avgScores: number[];
  inspectionCounts: number[];
  gradesTrend: {
    A: number[];
    B: number[];
    C: number[];
    D: number[];
  };
}

type MetricType = 'passRate' | 'avgScore' | 'count';

export default function QITrendScreen() {
  const { t } = useTranslation('quality');
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<TrendData | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [metric, setMetric] = useState<MetricType>('passRate');

  useEffect(() => {
    if (factoryId) {
      qualityInspectorApi.setFactoryId(factoryId);
      loadData();
    }
  }, [factoryId, period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await qualityInspectorApi.getTrendData(period);
      setData(result);
    } catch (error) {
      console.error(t('trend.loading'), error);
      // 使用模拟数据
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const dates = Array.from({ length: Math.min(days, 7) }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (Math.min(days, 7) - 1 - i));
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });

      setData({
        dates,
        passRates: dates.map(() => 85 + Math.random() * 12),
        avgScores: dates.map(() => 80 + Math.random() * 15),
        inspectionCounts: dates.map(() => Math.floor(15 + Math.random() * 10)),
        gradesTrend: {
          A: dates.map(() => Math.floor(8 + Math.random() * 5)),
          B: dates.map(() => Math.floor(6 + Math.random() * 4)),
          C: dates.map(() => Math.floor(2 + Math.random() * 3)),
          D: dates.map(() => Math.floor(Math.random() * 2)),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [period]);

  const getMetricData = (): number[] => {
    if (!data) return [];
    switch (metric) {
      case 'passRate':
        return data.passRates;
      case 'avgScore':
        return data.avgScores;
      case 'count':
        return data.inspectionCounts;
      default:
        return [];
    }
  };

  const getMetricLabel = (): string => {
    switch (metric) {
      case 'passRate':
        return `${t('analysis.passRate')} (%)`;
      case 'avgScore':
        return t('analysis.avgScore');
      case 'count':
        return t('trend.inspectionCount');
      default:
        return '';
    }
  };

  const getMetricColor = (): string => {
    switch (metric) {
      case 'passRate':
        return QI_COLORS.success;
      case 'avgScore':
        return QI_COLORS.primary;
      case 'count':
        return QI_COLORS.secondary;
      default:
        return QI_COLORS.primary;
    }
  };

  // 简单折线图渲染
  const renderLineChart = () => {
    const values = getMetricData();
    if (values.length === 0) return null;

    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    const chartHeight = 160;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartLabel}>{getMetricLabel()}</Text>
        <View style={styles.chart}>
          {/* Y轴刻度 */}
          <View style={styles.yAxis}>
            <Text style={styles.yAxisLabel}>{maxValue.toFixed(metric === 'count' ? 0 : 1)}</Text>
            <Text style={styles.yAxisLabel}>
              {((maxValue + minValue) / 2).toFixed(metric === 'count' ? 0 : 1)}
            </Text>
            <Text style={styles.yAxisLabel}>{minValue.toFixed(metric === 'count' ? 0 : 1)}</Text>
          </View>

          {/* 图表区域 */}
          <View style={styles.chartArea}>
            {/* 网格线 */}
            <View style={styles.gridLines}>
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
            </View>

            {/* 数据点和线 */}
            <View style={styles.dataPoints}>
              {values.map((value, index) => {
                const x = (index / (values.length - 1)) * 100;
                const y = ((maxValue - value) / range) * 100;
                return (
                  <View
                    key={index}
                    style={[
                      styles.dataPoint,
                      {
                        left: `${x}%`,
                        top: `${y}%`,
                        backgroundColor: getMetricColor(),
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* X轴标签 */}
            <View style={styles.xAxis}>
              {data?.dates.map((date, index) => (
                <Text key={index} style={styles.xAxisLabel}>
                  {date}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // 等级趋势堆叠条形图
  const renderGradesTrend = () => {
    if (!data || !data.gradesTrend) return null;

    const { A = [], B = [], C = [], D = [] } = data.gradesTrend;
    const totals = data.dates.map((_, i) =>
      (A[i] ?? 0) + (B[i] ?? 0) + (C[i] ?? 0) + (D[i] ?? 0)
    );
    const maxTotal = Math.max(...totals, 1); // Avoid division by zero

    return (
      <View style={styles.gradesTrendContainer}>
        <Text style={styles.sectionTitle}>{t('trend.gradeTrend')}</Text>
        <View style={styles.gradesTrendChart}>
          {data.dates.map((date, i) => {
            const total = totals[i] ?? 1;
            const height = (total / maxTotal) * 120;
            const aH = ((A[i] ?? 0) / total) * height;
            const bH = ((B[i] ?? 0) / total) * height;
            const cH = ((C[i] ?? 0) / total) * height;
            const dH = ((D[i] ?? 0) / total) * height;

            return (
              <View key={i} style={styles.stackedBar}>
                <View style={styles.stackedBarInner}>
                  <View style={[styles.stackedSegment, { height: dH, backgroundColor: GRADE_COLORS.D }]} />
                  <View style={[styles.stackedSegment, { height: cH, backgroundColor: GRADE_COLORS.C }]} />
                  <View style={[styles.stackedSegment, { height: bH, backgroundColor: GRADE_COLORS.B }]} />
                  <View style={[styles.stackedSegment, { height: aH, backgroundColor: GRADE_COLORS.A }]} />
                </View>
                <Text style={styles.stackedBarLabel}>{date}</Text>
              </View>
            );
          })}
        </View>

        {/* 图例 */}
        <View style={styles.legend}>
          {(['A', 'B', 'C', 'D'] as const).map((grade) => (
            <View key={grade} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GRADE_COLORS[grade] }]} />
              <Text style={styles.legendText}>{grade}级</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPeriodTab = (p: '7d' | '30d' | '90d', label: string) => (
    <TouchableOpacity
      style={[styles.periodTab, period === p && styles.periodTabActive]}
      onPress={() => setPeriod(p)}
    >
      <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderMetricTab = (m: MetricType, label: string, icon: string) => (
    <TouchableOpacity
      style={[styles.metricTab, metric === m && styles.metricTabActive]}
      onPress={() => setMetric(m)}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={metric === m ? QI_COLORS.primary : QI_COLORS.textSecondary}
      />
      <Text style={[styles.metricText, metric === m && styles.metricTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QI_COLORS.primary} />
        <Text style={styles.loadingText}>{t('trend.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[QI_COLORS.primary]}
        />
      }
    >
      {/* 时间周期选择 */}
      <View style={styles.periodBar}>
        {renderPeriodTab('7d', t('trend.period.week'))}
        {renderPeriodTab('30d', t('trend.period.month'))}
        {renderPeriodTab('90d', t('trend.period.quarter'))}
      </View>

      {/* 指标选择 */}
      <View style={styles.metricBar}>
        {renderMetricTab('passRate', t('analysis.passRate'), 'checkmark-circle-outline')}
        {renderMetricTab('avgScore', t('analysis.avgScore'), 'star-outline')}
        {renderMetricTab('count', t('trend.inspectionCount'), 'layers-outline')}
      </View>

      {/* 折线图 */}
      <View style={styles.chartCard}>
        {renderLineChart()}
      </View>

      {/* 统计摘要 */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('trend.maxValue')}</Text>
          <Text style={styles.summaryValue}>
            {Math.max(...getMetricData()).toFixed(metric === 'count' ? 0 : 1)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('trend.minValue')}</Text>
          <Text style={styles.summaryValue}>
            {Math.min(...getMetricData()).toFixed(metric === 'count' ? 0 : 1)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('trend.avgValue')}</Text>
          <Text style={styles.summaryValue}>
            {(
              getMetricData().reduce((a, b) => a + b, 0) / getMetricData().length
            ).toFixed(metric === 'count' ? 0 : 1)}
          </Text>
        </View>
      </View>

      {/* 等级趋势 */}
      <View style={styles.card}>
        {renderGradesTrend()}
      </View>

      {/* 分析说明 */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Ionicons name="bulb-outline" size={20} color={QI_COLORS.warning} />
          <Text style={styles.insightTitle}>{t('trend.trendAnalysis')}</Text>
        </View>
        <Text style={styles.insightText}>
          {metric === 'passRate' && t('trend.passRateInsight')}
          {metric === 'avgScore' && t('trend.avgScoreInsight')}
          {metric === 'count' && t('trend.countInsight')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: QI_COLORS.textSecondary,
    fontSize: 14,
  },

  // 时间周期
  periodBar: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: QI_COLORS.primary,
  },
  periodText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  periodTextActive: {
    color: '#fff',
    fontWeight: '500',
  },

  // 指标选择
  metricBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: QI_COLORS.card,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  metricTabActive: {
    borderColor: QI_COLORS.primary,
    backgroundColor: '#E8F5E9',
  },
  metricText: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
  },
  metricTextActive: {
    color: QI_COLORS.primary,
    fontWeight: '500',
  },

  // 图表卡片
  chartCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartContainer: {},
  chartLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: QI_COLORS.text,
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    height: 180,
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  yAxisLabel: {
    fontSize: 11,
    color: QI_COLORS.textSecondary,
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: QI_COLORS.border,
  },
  dataPoints: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
  },
  dataPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    marginTop: -5,
  },
  xAxis: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xAxisLabel: {
    fontSize: 10,
    color: QI_COLORS.textSecondary,
  },

  // 统计摘要
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: QI_COLORS.border,
  },
  summaryLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: QI_COLORS.text,
  },

  // 等级趋势
  card: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: QI_COLORS.text,
    marginBottom: 16,
  },
  gradesTrendContainer: {},
  gradesTrendChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingBottom: 20,
  },
  stackedBar: {
    alignItems: 'center',
    width: 32,
  },
  stackedBarInner: {
    width: 24,
    flexDirection: 'column-reverse',
    borderRadius: 4,
    overflow: 'hidden',
  },
  stackedSegment: {},
  stackedBarLabel: {
    fontSize: 10,
    color: QI_COLORS.textSecondary,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: QI_COLORS.textSecondary,
  },

  // 分析说明
  insightCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: QI_COLORS.text,
  },
  insightText: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    lineHeight: 20,
  },
});
