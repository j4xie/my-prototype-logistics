/**
 * EfficiencyDashboardScreen
 *
 * Dashboard for worker efficiency analysis.
 * Displays:
 * - Summary KPIs (total workers, avg efficiency, quality rate)
 * - Top/bottom performers ranking
 * - Efficiency trends
 * - Department breakdown
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator, Surface, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { smartBIApi } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';

import type {
  SmartBIStackParamList,
  EfficiencySummary,
  WorkerEfficiencyData,
} from '../../types/smartbi';

import MobileBarChart from '../../components/smartbi/MobileBarChart';
import MobileLineChart from '../../components/smartbi/MobileLineChart';
import MobileGaugeChart from '../../components/smartbi/MobileGaugeChart';
import { CHART_SIZES } from '../../components/smartbi/chartSizes';

type NavigationProp = NativeStackNavigationProp<SmartBIStackParamList, 'EfficiencyDashboard'>;
type EfficiencyRouteProp = RouteProp<SmartBIStackParamList, 'EfficiencyDashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme colors
const THEME = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
};

// Period options
type PeriodType = 'day' | 'week' | 'month';

/**
 * Summary KPI Card
 */
interface SummaryKPIProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: string;
  color: string;
  change?: number;
}

function SummaryKPI({ title, value, unit, icon, color, change }: SummaryKPIProps): React.ReactElement {
  const cardWidth = (SCREEN_WIDTH - 48) / 2;

  return (
    <Surface style={[styles.kpiCard, { width: cardWidth }]} elevation={2}>
      <View style={[styles.kpiIconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.kpiContent}>
        <Text style={styles.kpiTitle}>{title}</Text>
        <View style={styles.kpiValueRow}>
          <Text style={styles.kpiValue}>{value}</Text>
          {unit && <Text style={styles.kpiUnit}>{unit}</Text>}
        </View>
        {change !== undefined && (
          <View style={styles.kpiChange}>
            <MaterialCommunityIcons
              name={change >= 0 ? 'trending-up' : 'trending-down'}
              size={14}
              color={change >= 0 ? THEME.success : THEME.danger}
            />
            <Text
              style={[
                styles.kpiChangeText,
                { color: change >= 0 ? THEME.success : THEME.danger },
              ]}
            >
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </Surface>
  );
}

/**
 * Worker Ranking Item
 */
interface RankingItemProps {
  worker: WorkerEfficiencyData;
  rank: number;
  isTop: boolean;
}

function RankingItem({ worker, rank, isTop }: RankingItemProps): React.ReactElement {
  const getRankColor = () => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return isTop ? THEME.success : THEME.danger;
  };

  return (
    <View style={styles.rankingItem}>
      <View style={[styles.rankBadge, { backgroundColor: getRankColor() + '20' }]}>
        <Text style={[styles.rankNumber, { color: getRankColor() }]}>{rank}</Text>
      </View>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName}>{worker.workerName}</Text>
        <Text style={styles.rankDept}>{worker.department}</Text>
      </View>
      <View style={styles.rankMetrics}>
        <Text style={styles.rankEfficiency}>
          {worker.efficiencyScore.toFixed(1)}
        </Text>
        <View style={styles.rankQuality}>
          <MaterialCommunityIcons
            name="check-circle"
            size={12}
            color={worker.qualityRate >= 95 ? THEME.success : THEME.warning}
          />
          <Text style={styles.rankQualityText}>
            {worker.qualityRate.toFixed(1)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * EfficiencyDashboardScreen Component
 */
export default function EfficiencyDashboardScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EfficiencyRouteProp>();
  const { getFactoryId } = useAuthStore();

  // State
  const [period, setPeriod] = useState<PeriodType>(
    (route.params?.period as PeriodType) || 'day'
  );
  const [summary, setSummary] = useState<EfficiencySummary | null>(null);
  const [ranking, setRanking] = useState<WorkerEfficiencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount and when period changes
  useEffect(() => {
    loadData();
  }, [period]);

  /**
   * Load efficiency data
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const factoryId = getFactoryId();

      // Load summary and ranking in parallel
      const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10);
      const [summaryRes, rankingRes] = await Promise.all([
        smartBIApi.getEfficiencySummary(period, factoryId || undefined),
        smartBIApi.getEfficiencyRanking(
          today,
          10,
          factoryId || undefined
        ),
      ]);

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }

      if (rankingRes.success && rankingRes.data) {
        setRanking(rankingRes.data);
      }
    } catch (err) {
      console.error('Load efficiency data failed:', err);
      setError('加载人效数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, getFactoryId]);

  /**
   * Refresh handler
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Loading state
  if (loading && !summary) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>加载人效数据...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <View style={styles.periodContainer}>
          <SegmentedButtons
            value={period}
            onValueChange={(value) => setPeriod(value as PeriodType)}
            buttons={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={THEME.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {summary && (
          <>
            {/* Summary KPIs */}
            <View style={styles.kpiGrid}>
              <SummaryKPI
                title="员工总数"
                value={summary.totalWorkers}
                unit="人"
                icon="account-group"
                color={THEME.primary}
              />
              <SummaryKPI
                title="平均效率"
                value={summary.avgEfficiency.toFixed(1)}
                unit="%"
                icon="speedometer"
                color={THEME.secondary}
                change={2.5} // Example change value
              />
              <SummaryKPI
                title="平均质量率"
                value={summary.avgQualityRate.toFixed(1)}
                unit="%"
                icon="check-decagram"
                color={THEME.success}
              />
              <SummaryKPI
                title="总产量"
                value={summary.totalOutput.toLocaleString()}
                unit="件"
                icon="package-variant"
                color={THEME.warning}
              />
            </View>

            {/* Efficiency Gauge */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>效率总览</Text>
              <View style={styles.gaugeContainer}>
                <MobileGaugeChart
                  title="平均效率"
                  value={summary.avgEfficiency}
                  unit="%"
                  size={180}
                  thresholds={{ red: 60, yellow: 80, green: 80 }}
                />
              </View>
            </View>

            {/* Top Performers */}
            {summary.topPerformers.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons
                      name="trophy"
                      size={20}
                      color={THEME.warning}
                    />
                    <Text style={styles.sectionTitle}>效率之星</Text>
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.viewAll}>查看全部</Text>
                  </TouchableOpacity>
                </View>
                <Surface style={styles.rankingCard} elevation={1}>
                  {summary.topPerformers.slice(0, 5).map((worker, index) => (
                    <RankingItem
                      key={`top-${worker.workerId}`}
                      worker={worker}
                      rank={index + 1}
                      isTop={true}
                    />
                  ))}
                </Surface>
              </View>
            )}

            {/* Bottom Performers */}
            {summary.bottomPerformers.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons
                      name="alert-circle"
                      size={20}
                      color={THEME.danger}
                    />
                    <Text style={styles.sectionTitle}>需关注员工</Text>
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.viewAll}>查看全部</Text>
                  </TouchableOpacity>
                </View>
                <Surface style={styles.rankingCard} elevation={1}>
                  {summary.bottomPerformers.slice(0, 3).map((worker, index) => (
                    <RankingItem
                      key={`bottom-${worker.workerId}`}
                      worker={worker}
                      rank={index + 1}
                      isTop={false}
                    />
                  ))}
                </Surface>
              </View>
            )}

            {/* Efficiency Distribution Chart */}
            {ranking.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>效率分布</Text>
                <MobileBarChart
                  title=""
                  labels={ranking.slice(0, 8).map((w) => w.workerName.slice(0, 4))}
                  data={ranking.slice(0, 8).map((w) => w.efficiencyScore)}
                  horizontal
                  yAxisSuffix="%"
                  barColors={ranking.slice(0, 8).map((w) =>
                    w.efficiencyScore >= 80
                      ? THEME.success
                      : w.efficiencyScore >= 60
                        ? THEME.warning
                        : THEME.danger
                  )}
                />
              </View>
            )}
          </>
        )}

        {/* Empty State */}
        {!summary && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="account-clock"
              size={64}
              color="#9CA3AF"
            />
            <Text style={styles.emptyTitle}>暂无人效数据</Text>
            <Text style={styles.emptyText}>
              当视频分析模块采集到工人效率数据后，将在此展示
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: THEME.textSecondary,
  },
  periodContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedButtons: {
    backgroundColor: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: THEME.danger,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  kpiContent: {
    flex: 1,
  },
  kpiTitle: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  kpiUnit: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginLeft: 4,
  },
  kpiChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  kpiChangeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    color: THEME.primary,
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  rankingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  rankInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  rankDept: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  rankMetrics: {
    alignItems: 'flex-end',
  },
  rankEfficiency: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  rankQuality: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  rankQualityText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});
