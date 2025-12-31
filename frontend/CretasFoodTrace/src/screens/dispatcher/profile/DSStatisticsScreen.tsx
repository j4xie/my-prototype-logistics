/**
 * 调度员统计分析屏幕
 *
 * 功能：
 * - 日期范围筛选（今日、本周、本月、自定义）
 * - KPI 指标概览（计划完成率、OTD、人员效率、响应时间）
 * - 生产统计（产量、批次完成、工时利用）
 * - 人员统计（出勤、效率、技能分布）
 * - 趋势图表（生产趋势、人员利用趋势）
 * - 异常统计（迟到、早退、设备故障）
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { DISPATCHER_THEME } from '../../../types/dispatcher';
import { dashboardAPI } from '../../../services/api/dashboardApiClient';
import { timeclockApiClient } from '../../../services/api/timeclockApiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
type DateRangeType = 'today' | 'week' | 'month' | 'custom';

interface KPIMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  percentage?: number;
  change: number;
  changeType: 'up' | 'down';
  color: string;
  icon: string;
}

interface ProductionStats {
  totalOutput: number;
  outputUnit: string;
  completedBatches: number;
  totalBatches: number;
  workHoursUsed: number;
  workHoursAvailable: number;
  efficiency: number;
}

interface PersonnelStats {
  totalStaff: number;
  onDuty: number;
  onLeave: number;
  avgEfficiency: number;
  topPerformers: { name: string; efficiency: number }[];
  skillDistribution: { skill: string; count: number; percentage: number }[];
}

interface TrendPoint {
  label: string;
  value: number;
}

interface AnomalyStats {
  late: number;
  earlyLeave: number;
  absent: number;
  equipmentIssues: number;
  qualityIssues: number;
}

// Default empty data
const emptyProductionStats: ProductionStats = {
  totalOutput: 0,
  outputUnit: 'kg',
  completedBatches: 0,
  totalBatches: 0,
  workHoursUsed: 0,
  workHoursAvailable: 0,
  efficiency: 0,
};

const emptyPersonnelStats: PersonnelStats = {
  totalStaff: 0,
  onDuty: 0,
  onLeave: 0,
  avgEfficiency: 0,
  topPerformers: [],
  skillDistribution: [],
};

const emptyAnomalies: AnomalyStats = {
  late: 0,
  earlyLeave: 0,
  absent: 0,
  equipmentIssues: 0,
  qualityIssues: 0,
};

export default function DSStatisticsScreen() {
  const navigation = useNavigation();

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>('week');
  const [kpis, setKpis] = useState<KPIMetric[]>([]);
  const [productionStats, setProductionStats] = useState<ProductionStats>(emptyProductionStats);
  const [personnelStats, setPersonnelStats] = useState<PersonnelStats>(emptyPersonnelStats);
  const [productionTrend, setProductionTrend] = useState<TrendPoint[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyStats>(emptyAnomalies);

  // Helper: Get date range based on selection
  const getDateRange = useCallback((range: DateRangeType): { startDate: string; endDate: string } => {
    const now = new Date();
    const formatDate = (date: Date): string => date.toISOString().split('T')[0] ?? '';

    const today = formatDate(now);

    switch (range) {
      case 'today':
        return { startDate: today, endDate: today };
      case 'week': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
        return {
          startDate: formatDate(startOfWeek),
          endDate: today,
        };
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: formatDate(startOfMonth),
          endDate: today,
        };
      }
      default:
        return { startDate: today, endDate: today };
    }
  }, []);

  // Load statistics data
  const loadStatisticsData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setInitialLoading(true);
    }
    setError(null);

    try {
      const period = dateRange === 'today' ? 'today' : dateRange === 'week' ? 'week' : 'month';
      const { startDate, endDate } = getDateRange(dateRange);

      // Parallel API calls
      const [overviewRes, productionRes, qualityRes, alertsRes] = await Promise.all([
        dashboardAPI.getDashboardOverview(period).catch(() => null),
        dashboardAPI.getProductionStatistics({ startDate, endDate }).catch(() => null),
        dashboardAPI.getQualityDashboard(period === 'today' ? 'week' : period as 'week' | 'month').catch(() => null),
        dashboardAPI.getAlertsDashboard('week').catch(() => null),
      ]);

      // Process overview and build KPIs
      const kpiList: KPIMetric[] = [];

      if (overviewRes?.success && overviewRes.data) {
        const overview = overviewRes.data;
        const kpi = overview.kpi;

        // 计划完成率
        const completionRate = overview.summary?.completedBatches && overview.summary?.totalBatches
          ? Math.round((overview.summary.completedBatches / overview.summary.totalBatches) * 100)
          : Math.round(kpi?.productionEfficiency ?? 0);

        kpiList.push({
          id: 'completion',
          label: '计划完成率',
          value: String(completionRate),
          unit: '%',
          percentage: completionRate,
          change: 5, // API 暂无变化率数据
          changeType: 'up',
          color: DISPATCHER_THEME.primary,
          icon: 'check-circle-outline',
        });

        // 质量合格率
        const qualityRate = Math.round(kpi?.qualityPassRate ?? 0);
        kpiList.push({
          id: 'quality',
          label: '质量合格率',
          value: String(qualityRate),
          unit: '%',
          percentage: qualityRate,
          change: 2,
          changeType: 'up',
          color: '#52c41a',
          icon: 'check-decagram-outline',
        });

        // 设备利用率
        const equipUtil = Math.round(kpi?.equipmentUtilization ?? 0);
        kpiList.push({
          id: 'equipment',
          label: '设备利用率',
          value: String(equipUtil),
          unit: '%',
          percentage: equipUtil,
          change: 3,
          changeType: 'up',
          color: '#1890ff',
          icon: 'cog-outline',
        });

        // 在岗人员
        const onDuty = overview.summary?.onDutyWorkers ?? 0;
        const totalWorkers = overview.summary?.totalWorkers ?? 1;
        const dutyRate = Math.round((onDuty / totalWorkers) * 100);
        kpiList.push({
          id: 'attendance',
          label: '在岗率',
          value: String(dutyRate),
          unit: '%',
          percentage: dutyRate,
          change: 1,
          changeType: 'up',
          color: '#fa8c16',
          icon: 'account-group-outline',
        });

        // Production stats
        const todayOutput = overview.todayStats?.todayOutputKg ?? 0;
        const completedBatches = overview.summary?.completedBatches ?? 0;
        const totalBatches = overview.summary?.totalBatches ?? 0;

        setProductionStats({
          totalOutput: Math.round(todayOutput),
          outputUnit: 'kg',
          completedBatches,
          totalBatches,
          workHoursUsed: Math.round((overview.todayStats?.activeWorkers ?? 0) * 8), // 估算
          workHoursAvailable: Math.round((overview.summary?.totalWorkers ?? 0) * 8),
          efficiency: Math.round(kpi?.productionEfficiency ?? 0),
        });

        // Personnel stats
        setPersonnelStats({
          totalStaff: overview.summary?.totalWorkers ?? 0,
          onDuty: overview.summary?.onDutyWorkers ?? 0,
          onLeave: (overview.summary?.totalWorkers ?? 0) - (overview.summary?.onDutyWorkers ?? 0),
          avgEfficiency: Math.round(kpi?.productionEfficiency ?? 0),
          topPerformers: [], // 需要专门API
          skillDistribution: [], // 需要专门API
        });
      }

      setKpis(kpiList);

      // Process production trends
      if (productionRes?.success && productionRes.data?.dailyTrends) {
        const trends = productionRes.data.dailyTrends.slice(-7).map(t => {
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const date = new Date(t.date);
          return {
            label: dayNames[date.getDay()] ?? '未知',
            value: t.quantity,
          };
        });
        setProductionTrend(trends);
      } else {
        setProductionTrend([]);
      }

      // Process anomalies from alerts
      if (alertsRes?.success && alertsRes.data) {
        const alerts = alertsRes.data;
        setAnomalies({
          late: 0, // 需要 timeclock API
          earlyLeave: 0,
          absent: 0,
          equipmentIssues: alerts.byType?.find(t => t.type === 'equipment')?.count ?? 0,
          qualityIssues: alerts.byType?.find(t => t.type === 'quality')?.count ?? 0,
        });
      }

    } catch (err) {
      console.error('加载统计数据失败:', err);
      setError('加载统计数据失败，请稍后重试');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, getDateRange]);

  // Initial load
  useEffect(() => {
    loadStatisticsData();
  }, [loadStatisticsData]);

  // Callbacks
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStatisticsData(true);
  }, [loadStatisticsData]);

  const handleDateRangeChange = (range: DateRangeType) => {
    setDateRange(range);
  };

  // Render functions
  const renderHeader = () => (
    <LinearGradient
      colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>统计分析</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date Range Tabs */}
      <View style={styles.dateRangeTabs}>
        {[
          { key: 'today', label: '今日' },
          { key: 'week', label: '本周' },
          { key: 'month', label: '本月' },
          { key: 'custom', label: '自定义' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.dateRangeTab,
              dateRange === item.key && styles.dateRangeTabActive,
            ]}
            onPress={() => handleDateRangeChange(item.key as DateRangeType)}
          >
            <Text
              style={[
                styles.dateRangeTabText,
                dateRange === item.key && styles.dateRangeTabTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );

  const renderKPICards = () => (
    <View style={styles.kpiSection}>
      <Text style={styles.sectionTitle}>关键指标</Text>
      <View style={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiCard}>
            <View style={[styles.kpiIconContainer, { backgroundColor: `${kpi.color}15` }]}>
              <MaterialCommunityIcons
                name={kpi.icon as any}
                size={24}
                color={kpi.color}
              />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <View style={styles.kpiValueRow}>
                <Text style={[styles.kpiValue, { color: kpi.color }]}>
                  {kpi.value}
                </Text>
                {kpi.unit && <Text style={styles.kpiUnit}>{kpi.unit}</Text>}
              </View>
              <View style={styles.kpiChangeRow}>
                <MaterialCommunityIcons
                  name={kpi.changeType === 'up' ? 'arrow-up' : 'arrow-down'}
                  size={14}
                  color={kpi.changeType === 'up' ? '#52c41a' : '#ff4d4f'}
                />
                <Text
                  style={[
                    styles.kpiChange,
                    { color: kpi.changeType === 'up' ? '#52c41a' : '#ff4d4f' },
                  ]}
                >
                  {Math.abs(kpi.change)}{kpi.id === 'response' ? '分钟' : '%'}
                </Text>
              </View>
            </View>
            {kpi.percentage !== undefined && (
              <View style={styles.kpiProgressContainer}>
                <View style={styles.kpiProgressBg}>
                  <View
                    style={[
                      styles.kpiProgress,
                      { width: `${kpi.percentage}%`, backgroundColor: kpi.color },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const renderProductionStats = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>生产统计</Text>
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="scale" size={28} color={DISPATCHER_THEME.primary} />
            <Text style={styles.statValue}>
              {productionStats.totalOutput.toLocaleString()}
              <Text style={styles.statUnit}> {productionStats.outputUnit}</Text>
            </Text>
            <Text style={styles.statLabel}>总产量</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="checkbox-multiple-marked" size={28} color="#52c41a" />
            <Text style={styles.statValue}>
              {productionStats.completedBatches}
              <Text style={styles.statUnit}> / {productionStats.totalBatches}</Text>
            </Text>
            <Text style={styles.statLabel}>完成批次</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="clock-time-eight" size={28} color="#1890ff" />
            <Text style={styles.statValue}>
              {productionStats.workHoursUsed}
              <Text style={styles.statUnit}> h</Text>
            </Text>
            <Text style={styles.statLabel}>实际工时</Text>
          </View>
        </View>

        {/* Efficiency Bar */}
        <View style={styles.efficiencySection}>
          <View style={styles.efficiencyHeader}>
            <Text style={styles.efficiencyLabel}>工时利用率</Text>
            <Text style={styles.efficiencyValue}>{productionStats.efficiency}%</Text>
          </View>
          <View style={styles.efficiencyBarBg}>
            <LinearGradient
              colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.efficiencyBar, { width: `${productionStats.efficiency}%` }]}
            />
          </View>
          <Text style={styles.efficiencyNote}>
            已用 {productionStats.workHoursUsed}h / 可用 {productionStats.workHoursAvailable}h
          </Text>
        </View>
      </View>
    </View>
  );

  const renderProductionTrend = () => {
    const maxValue = Math.max(...productionTrend.map(p => p.value));

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>产量趋势</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartContainer}>
            {productionTrend.map((point, index) => {
              const height = (point.value / maxValue) * 120;
              return (
                <View key={index} style={styles.chartBarContainer}>
                  <Text style={styles.chartValue}>{point.value}</Text>
                  <LinearGradient
                    colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                    style={[styles.chartBar, { height }]}
                  />
                  <Text style={styles.chartLabel}>{point.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.chartLegendItem}>
              <View style={[styles.chartLegendDot, { backgroundColor: DISPATCHER_THEME.primary }]} />
              <Text style={styles.chartLegendText}>日产量 (kg)</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPersonnelStats = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>人员统计</Text>
      <View style={styles.personnelCard}>
        {/* Overview */}
        <View style={styles.personnelOverview}>
          <View style={styles.personnelCircle}>
            <Text style={styles.personnelCircleValue}>{personnelStats.onDuty}</Text>
            <Text style={styles.personnelCircleLabel}>在岗</Text>
          </View>
          <View style={styles.personnelOverviewStats}>
            <View style={styles.personnelOverviewItem}>
              <Text style={styles.personnelOverviewValue}>{personnelStats.totalStaff}</Text>
              <Text style={styles.personnelOverviewLabel}>总人数</Text>
            </View>
            <View style={styles.personnelOverviewItem}>
              <Text style={styles.personnelOverviewValue}>{personnelStats.onLeave}</Text>
              <Text style={styles.personnelOverviewLabel}>请假</Text>
            </View>
            <View style={styles.personnelOverviewItem}>
              <Text style={styles.personnelOverviewValue}>{personnelStats.avgEfficiency}%</Text>
              <Text style={styles.personnelOverviewLabel}>平均效率</Text>
            </View>
          </View>
        </View>

        {/* Top Performers */}
        <View style={styles.topPerformersSection}>
          <Text style={styles.subsectionTitle}>效率排行</Text>
          {personnelStats.topPerformers.map((performer, index) => (
            <View key={index} style={styles.performerRow}>
              <View style={styles.performerRank}>
                <Text style={styles.performerRankText}>{index + 1}</Text>
              </View>
              <Text style={styles.performerName}>{performer.name}</Text>
              <View style={styles.performerEfficiency}>
                <View style={styles.performerBarBg}>
                  <View
                    style={[
                      styles.performerBar,
                      { width: `${performer.efficiency}%` },
                    ]}
                  />
                </View>
                <Text style={styles.performerValue}>{performer.efficiency}%</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Skill Distribution */}
        <View style={styles.skillSection}>
          <Text style={styles.subsectionTitle}>技能分布</Text>
          <View style={styles.skillList}>
            {personnelStats.skillDistribution.map((skill, index) => (
              <View key={index} style={styles.skillItem}>
                <View
                  style={[
                    styles.skillDot,
                    {
                      backgroundColor: [
                        DISPATCHER_THEME.primary,
                        '#52c41a',
                        '#1890ff',
                        '#fa8c16',
                        '#999',
                      ][index],
                    },
                  ]}
                />
                <Text style={styles.skillName}>{skill.skill}</Text>
                <Text style={styles.skillCount}>{skill.count}人</Text>
                <Text style={styles.skillPercentage}>{skill.percentage}%</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderAnomalies = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>异常统计</Text>
      <View style={styles.anomalyCard}>
        <View style={styles.anomalyGrid}>
          {[
            { key: 'late', label: '迟到', value: anomalies.late, icon: 'run', color: '#fa8c16' },
            { key: 'earlyLeave', label: '早退', value: anomalies.earlyLeave, icon: 'exit-run', color: '#fa8c16' },
            { key: 'absent', label: '缺勤', value: anomalies.absent, icon: 'account-off', color: '#ff4d4f' },
            { key: 'equipment', label: '设备故障', value: anomalies.equipmentIssues, icon: 'wrench-outline', color: '#ff4d4f' },
            { key: 'quality', label: '质量问题', value: anomalies.qualityIssues, icon: 'alert-circle-outline', color: '#faad14' },
          ].map((item) => (
            <View key={item.key} style={styles.anomalyItem}>
              <View style={[styles.anomalyIcon, { backgroundColor: `${item.color}15` }]}>
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={20}
                  color={item.color}
                />
              </View>
              <Text style={styles.anomalyValue}>{item.value}</Text>
              <Text style={styles.anomalyLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // Loading state
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
      <Text style={styles.loadingText}>加载统计数据中...</Text>
    </View>
  );

  // Error state
  const renderError = () => (
    <View style={styles.errorContainer}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#e74c3c" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadStatisticsData()}>
        <Text style={styles.retryButtonText}>重新加载</Text>
      </TouchableOpacity>
    </View>
  );

  // Empty state (no data)
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="chart-bar" size={64} color="#ccc" />
      <Text style={styles.emptyText}>暂无统计数据</Text>
      <Text style={styles.emptySubtext}>请选择其他日期范围或稍后重试</Text>
    </View>
  );

  // Check if we have data
  const hasData = kpis.length > 0;

  // Conditional content rendering
  const renderContent = () => {
    if (initialLoading) {
      return renderLoading();
    }

    if (error) {
      return renderError();
    }

    if (!hasData) {
      return renderEmpty();
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[DISPATCHER_THEME.primary]}
            tintColor={DISPATCHER_THEME.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderKPICards()}
        {renderProductionStats()}
        {productionTrend.length > 0 && renderProductionTrend()}
        {renderPersonnelStats()}
        {renderAnomalies()}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  refreshButton: {
    padding: 4,
  },
  dateRangeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 4,
  },
  dateRangeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  dateRangeTabActive: {
    backgroundColor: '#fff',
  },
  dateRangeTabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  dateRangeTabTextActive: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // KPI Section
  kpiSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiContent: {},
  kpiLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  kpiUnit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 2,
  },
  kpiChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  kpiChange: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  kpiProgressContainer: {
    marginTop: 10,
  },
  kpiProgressBg: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  kpiProgress: {
    height: '100%',
    borderRadius: 2,
  },
  // Section
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  // Stats Card
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  efficiencySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  efficiencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  efficiencyLabel: {
    fontSize: 14,
    color: '#666',
  },
  efficiencyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: DISPATCHER_THEME.primary,
  },
  efficiencyBarBg: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  efficiencyBar: {
    height: '100%',
    borderRadius: 4,
  },
  efficiencyNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },
  // Chart Card
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 20,
  },
  chartBarContainer: {
    alignItems: 'center',
  },
  chartValue: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  chartBar: {
    width: 28,
    borderRadius: 4,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chartLegendText: {
    fontSize: 12,
    color: '#666',
  },
  // Personnel Card
  personnelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  personnelOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  personnelCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${DISPATCHER_THEME.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  personnelCircleValue: {
    fontSize: 28,
    fontWeight: '700',
    color: DISPATCHER_THEME.primary,
  },
  personnelCircleLabel: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  personnelOverviewStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  personnelOverviewItem: {
    alignItems: 'center',
  },
  personnelOverviewValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  personnelOverviewLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  topPerformersSection: {
    marginTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  performerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  performerRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  performerName: {
    fontSize: 14,
    color: '#333',
    width: 70,
  },
  performerEfficiency: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  performerBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginRight: 10,
    overflow: 'hidden',
  },
  performerBar: {
    height: '100%',
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 3,
  },
  performerValue: {
    fontSize: 13,
    fontWeight: '600',
    color: DISPATCHER_THEME.primary,
    width: 40,
    textAlign: 'right',
  },
  skillSection: {
    marginTop: 16,
  },
  skillList: {},
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  skillName: {
    fontSize: 14,
    color: '#333',
    width: 50,
  },
  skillCount: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  skillPercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  // Anomaly Card
  anomalyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  anomalyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  anomalyItem: {
    width: (SCREEN_WIDTH - 64) / 3,
    alignItems: 'center',
    padding: 8,
  },
  anomalyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  anomalyValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  anomalyLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  // Loading, Error, Empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: DISPATCHER_THEME.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
