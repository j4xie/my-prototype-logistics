/**
 * 质量分析页面
 * 显示质检统计和趋势分析
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAAIStackParamList } from '../../../types/navigation';
import {
  qualityInspectionApiClient,
  QualityStatistics,
  QualityTrendPoint,
} from '../../../services/api/qualityInspectionApiClient';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'QualityAnalysis'>;

const { width: screenWidth } = Dimensions.get('window');

export function QualityAnalysisScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('management');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistics, setStatistics] = useState<QualityStatistics | null>(null);
  const [trends, setTrends] = useState<QualityTrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedDays);

      const formatDate = (d: Date): string => {
        const iso = d.toISOString();
        return iso.split('T')[0] ?? iso.substring(0, 10);
      };

      // 并行加载统计和趋势数据
      const [statsResponse, trendsResponse] = await Promise.all([
        qualityInspectionApiClient.getStatistics({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        }),
        qualityInspectionApiClient.getTrends(selectedDays),
      ]);

      if (statsResponse.success && statsResponse.data) {
        setStatistics(statsResponse.data);
      }
      if (trendsResponse.success && trendsResponse.data) {
        setTrends(trendsResponse.data);
      }
    } catch (err) {
      console.error('Load quality data failed:', err);
      setError(t('qualityAnalysis.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getPassRateColor = (rate: number): string => {
    if (rate >= 95) return '#48bb78';
    if (rate >= 85) return '#ed8936';
    return '#e53e3e';
  };

  const formatPercent = (value?: number): string => {
    if (value === undefined || value === null) return '-';
    return `${value.toFixed(1)}%`;
  };

  // 简化的趋势图组件
  const renderTrendChart = () => {
    if (trends.length === 0) {
      return (
        <View style={styles.chartEmpty}>
          <Icon source="chart-line" size={32} color="#ccc" />
          <Text style={styles.chartEmptyText}>{t('qualityAnalysis.noTrendData')}</Text>
        </View>
      );
    }

    const maxRate = Math.max(...trends.map((t) => t.passRate || 0), 100);
    const chartHeight = 120;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartBody}>
          {trends.slice(-7).map((point, index) => {
            const height = ((point.passRate || 0) / maxRate) * chartHeight;
            return (
              <View key={index} style={styles.chartBar}>
                <View
                  style={[
                    styles.chartBarFill,
                    {
                      height,
                      backgroundColor: getPassRateColor(point.passRate || 0),
                    },
                  ]}
                />
                <Text style={styles.chartBarLabel}>
                  {new Date(point.date).getDate()}{t('qualityAnalysis.dayUnit')}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          <Text style={styles.chartLegendText}>{t('qualityAnalysis.last7DaysTrend')}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon source="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('qualityAnalysis.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('qualityAnalysis.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* 时间范围选择 */}
        <View style={styles.periodSelector}>
          {[7, 30, 90].map((days) => (
            <TouchableOpacity
              key={days}
              style={[
                styles.periodBtn,
                selectedDays === days && styles.periodBtnActive,
              ]}
              onPress={() => setSelectedDays(days)}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  selectedDays === days && styles.periodBtnTextActive,
                ]}
              >
                {t('qualityAnalysis.days', { count: days })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 错误提示 */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 核心指标 */}
        {statistics && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#48bb7820' }]}>
                <Icon source="check-circle" size={24} color="#48bb78" />
              </View>
              <Text style={styles.statValue}>
                {formatPercent(statistics.averagePassRate)}
              </Text>
              <Text style={styles.statLabel}>{t('qualityAnalysis.averagePassRate')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#667eea20' }]}>
                <Icon source="clipboard-check" size={24} color="#667eea" />
              </View>
              <Text style={styles.statValue}>{statistics.totalInspections || 0}</Text>
              <Text style={styles.statLabel}>{t('qualityAnalysis.totalInspections')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#48bb7820' }]}>
                <Icon source="thumb-up" size={24} color="#48bb78" />
              </View>
              <Text style={styles.statValue}>{statistics.passedInspections || 0}</Text>
              <Text style={styles.statLabel}>{t('qualityAnalysis.passedBatches')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#e53e3e20' }]}>
                <Icon source="thumb-down" size={24} color="#e53e3e" />
              </View>
              <Text style={styles.statValue}>{statistics.failedInspections || 0}</Text>
              <Text style={styles.statLabel}>{t('qualityAnalysis.failedBatches')}</Text>
            </View>
          </View>
        )}

        {/* 趋势图 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('qualityAnalysis.passRateTrend')}</Text>
          <View style={styles.chartCard}>{renderTrendChart()}</View>
        </View>

        {/* 详细统计 */}
        {statistics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('qualityAnalysis.detailedStats')}</Text>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('qualityAnalysis.totalSampleSize')}</Text>
                <Text style={styles.detailValue}>{statistics.totalSampleSize || 0}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('qualityAnalysis.passCount')}</Text>
                <Text style={[styles.detailValue, { color: '#48bb78' }]}>
                  {statistics.totalPassCount || 0}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('qualityAnalysis.failCount')}</Text>
                <Text style={[styles.detailValue, { color: '#e53e3e' }]}>
                  {statistics.totalFailCount || 0}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('qualityAnalysis.conditionalPass')}</Text>
                <Text style={[styles.detailValue, { color: '#ed8936' }]}>
                  {statistics.conditionalInspections || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#667eea',
  },
  periodBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodBtnTextActive: {
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#c53030',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: (screenWidth - 48) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  chartContainer: {},
  chartBody: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingBottom: 20,
  },
  chartBar: {
    alignItems: 'center',
    width: 36,
  },
  chartBarFill: {
    width: 24,
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  chartLegend: {
    alignItems: 'center',
    marginTop: 8,
  },
  chartLegendText: {
    fontSize: 12,
    color: '#999',
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  chartEmptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
});

export default QualityAnalysisScreen;
