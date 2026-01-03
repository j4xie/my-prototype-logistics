/**
 * Factory Admin 首页 Dashboard
 * 包含: 欢迎区 + AI洞察卡片 + 4个统计卡片 + 快捷操作
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAHomeStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';
import { dashboardAPI, DashboardOverviewData, AlertsDashboardData } from '../../../services/api/dashboardApiClient';
import { aiApiClient } from '../../../services/api/aiApiClient';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'FAHome'>;

// 统计卡片数据类型
interface StatCardData {
  value: string | number;
  label: string;
  icon: string;
  color: string;
  trend?: string;
  onPress: () => void;
}

// AI 洞察数据类型
interface AIInsight {
  status: 'loading' | 'success' | 'error';
  message: string;
  metrics: {
    qualityRate: number;
    unitCost: number;
    avgCycle: number;
  };
}

export function FAHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { t } = useTranslation('home');

  // 状态
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dashboard 数据
  const [overviewData, setOverviewData] = useState<DashboardOverviewData | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsDashboardData | null>(null);

  // AI 洞察 (本地计算，简化显示)
  const [aiInsight, setAIInsight] = useState<AIInsight>({
    status: 'loading',
    message: t('ai.analyzing'),
    metrics: { qualityRate: 0, unitCost: 0, avgCycle: 0 },
  });

  // 获取当前日期
  const getFormattedDate = () => {
    const now = new Date();
    const weekDays = [
      t('date.weekdays.sun'), t('date.weekdays.mon'), t('date.weekdays.tue'),
      t('date.weekdays.wed'), t('date.weekdays.thu'), t('date.weekdays.fri'),
      t('date.weekdays.sat')
    ];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDay = weekDays[now.getDay()];
    return `${month}${t('date.month')}${day}${t('date.day')} ${weekDay}`;
  };

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('greetings.earlyMorning');
    if (hour < 9) return t('greetings.morning');
    if (hour < 12) return t('greetings.lateMorning');
    if (hour < 14) return t('greetings.noon');
    if (hour < 18) return t('greetings.afternoon');
    if (hour < 22) return t('greetings.evening');
    return t('greetings.lateNight');
  };

  // 加载 Dashboard 数据
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);

      // 并行获取数据
      const [overviewRes, alertsRes] = await Promise.all([
        dashboardAPI.getDashboardOverview('today'),
        dashboardAPI.getAlertsDashboard('week'),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverviewData(overviewRes.data);
      }

      if (alertsRes.success && alertsRes.data) {
        setAlertsData(alertsRes.data);
      }

      // AI 洞察：使用后端真实数据 + 获取AI报告摘要
      if (overviewRes.success && overviewRes.data) {
        const kpi = overviewRes.data.kpi;
        const qualityRate = kpi?.qualityPassRate ?? 98.5;
        const efficiency = kpi?.productionEfficiency ?? 92;
        // 使用后端计算的真实数据
        const unitCost = kpi?.unitCost ?? 0;
        const avgCycle = kpi?.avgCycleHours ?? 0;

        // 尝试获取最新AI报告摘要作为洞察文字
        let insightMessage: string = t('ai.normalProduction');
        let useLocalRule = true;
        try {
          const reportsRes = await aiApiClient.getReports({ reportType: 'custom' });
          if (reportsRes?.reports && reportsRes.reports.length > 0) {
            // 获取最新报告的标题作为洞察摘要
            const latestReport = reportsRes.reports[0];
            const title = latestReport?.title;
            if (title && title.length > 10) {
              insightMessage = title;
              useLocalRule = false;
            }
          }
        } catch (aiError) {
          console.log('获取AI报告摘要失败，使用本地规则生成', aiError);
        }

        // 如果没有AI报告，使用本地规则生成洞察文字
        if (useLocalRule) {
          if (qualityRate < 95) {
            insightMessage = t('ai.lowQualityRate');
          } else if (efficiency < 85) {
            insightMessage = t('ai.lowEfficiency');
          } else if (qualityRate >= 98 && efficiency >= 95) {
            insightMessage = t('ai.excellentStatus');
          }
        }

        setAIInsight({
          status: 'success',
          message: insightMessage,
          metrics: {
            qualityRate,
            unitCost,
            avgCycle,
          },
        });
      }
    } catch (err) {
      console.error('加载 Dashboard 数据失败:', err);
      setError(t('error.loadFailed'));
      setAIInsight({
        status: 'error',
        message: t('ai.noData'),
        metrics: { qualityRate: 0, unitCost: 0, avgCycle: 0 },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // 计算涨幅百分比
  const calculateTrendPercent = (today: number | undefined, yesterday: number | undefined): string | undefined => {
    if (today === undefined || yesterday === undefined || yesterday === 0) {
      return undefined;
    }
    const change = ((today - yesterday) / yesterday) * 100;
    if (change > 0) {
      return `+${change.toFixed(0)}%`;
    } else if (change < 0) {
      return `${change.toFixed(0)}%`;
    }
    return undefined;
  };

  // 计算涨幅差值
  const calculateTrendDiff = (today: number | undefined, yesterday: number | undefined): string | undefined => {
    if (today === undefined || yesterday === undefined) {
      return undefined;
    }
    const diff = today - yesterday;
    if (diff > 0) {
      return `+${diff}`;
    } else if (diff < 0) {
      return `${diff}`;
    }
    return undefined;
  };

  // 统计卡片数据
  const getStatCards = (): StatCardData[] => {
    const todayStats = overviewData?.todayStats;
    const yesterdayStats = overviewData?.yesterdayStats;
    const alertsSummary = alertsData?.summary;

    // 计算产量涨幅
    const outputTrend = calculateTrendPercent(
      todayStats?.todayOutputKg,
      yesterdayStats?.outputKg
    );

    // 计算批次涨幅
    const batchTrend = calculateTrendDiff(
      todayStats?.totalBatches,
      yesterdayStats?.totalBatches
    );

    return [
      {
        value: todayStats?.todayOutputKg?.toFixed(0) ?? '--',
        label: t('stats.todayOutput'),
        icon: 'scale',
        color: '#667eea',
        trend: outputTrend,
        onPress: () => navigation.navigate('TodayProduction'),
      },
      {
        value: todayStats?.totalBatches ?? overviewData?.summary?.totalBatches ?? '--',
        label: t('stats.todayBatches'),
        icon: 'package-variant',
        color: '#48bb78',
        trend: batchTrend,
        onPress: () => navigation.navigate('TodayBatches'),
      },
      {
        value: todayStats?.totalMaterialBatches ?? todayStats?.materialReceived ?? '--',
        label: t('stats.materialBatches'),
        icon: 'truck-delivery',
        color: '#ed8936',
        onPress: () => navigation.navigate('MaterialBatch'),
      },
      {
        value: alertsSummary?.activeAlerts ?? overviewData?.summary?.activeAlerts ?? '--',
        label: t('stats.todayAlerts'),
        icon: 'alert-circle',
        color: alertsSummary?.criticalAlerts && alertsSummary.criticalAlerts > 0 ? '#e53e3e' : '#a0aec0',
        onPress: () => navigation.navigate('AIAlerts'),
      },
    ];
  };

  // 快捷操作数据
  const quickActions = [
    {
      icon: 'plus-circle',
      label: t('quickActions.createPlan'),
      color: '#667eea',
      onPress: () => {
        navigation.getParent()?.navigate('FAAITab', { screen: 'CreatePlan' });
      },
    },
    {
      icon: 'chart-line',
      label: t('quickActions.dataReport'),
      color: '#48bb78',
      onPress: () => {
        navigation.getParent()?.navigate('FAAITab', { screen: 'AIReport' });
      },
    },
    {
      icon: 'account-group',
      label: t('quickActions.staffManagement'),
      color: '#ed8936',
      onPress: () => {
        navigation.getParent()?.navigate('FAManagementTab', { screen: 'EmployeeList' });
      },
    },
    {
      icon: 'cog',
      label: t('quickActions.systemConfig'),
      color: '#805ad5',
      onPress: () => {
        navigation.getParent()?.navigate('FAProfileTab', { screen: 'SystemSettings' });
      },
    },
  ];

  // 渲染统计卡片
  const renderStatCard = (card: StatCardData, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.statCard}
      onPress={card.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.statIconWrapper, { backgroundColor: `${card.color}15` }]}>
        <Icon source={card.icon} size={24} color={card.color} />
      </View>
      <Text style={[styles.statValue, { color: card.color }]}>
        {card.value}
      </Text>
      <Text style={styles.statLabel}>{card.label}</Text>
      {card.trend && (
        <View style={styles.trendBadge}>
          <Icon source="trending-up" size={12} color="#48bb78" />
          <Text style={styles.trendText}>{card.trend}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // 渲染快捷操作
  const renderQuickAction = (action: typeof quickActions[0], index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.quickAction}
      onPress={action.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
        <Icon source={action.icon} size={28} color={action.color} />
      </View>
      <Text style={styles.quickActionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
      >
        {/* 欢迎区 */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}，{user?.username ?? t('greetings.defaultUser')}
            </Text>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Icon source="bell-outline" size={24} color="#666" />
            {(alertsData?.summary?.activeAlerts ?? 0) > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {alertsData?.summary?.activeAlerts}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 错误提示 */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* AI 洞察卡片 */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiTitleRow}>
              <Icon source="robot" size={20} color="#fff" />
              <Text style={styles.aiTitle}>{t('ai.title')}</Text>
            </View>
            <View style={[
              styles.aiStatusBadge,
              aiInsight.status === 'success' ? styles.aiStatusSuccess : styles.aiStatusLoading
            ]}>
              <Text style={styles.aiStatusText}>
                {aiInsight.status === 'success' ? t('ai.analyzed') : t('ai.analyzing_status')}
              </Text>
            </View>
          </View>

          <Text style={styles.aiMessage}>{aiInsight.message}</Text>

          {/* AI 指标 */}
          <View style={styles.aiMetrics}>
            <View style={styles.aiMetricItem}>
              <Text style={styles.aiMetricValue}>
                {aiInsight.metrics.qualityRate.toFixed(1)}%
              </Text>
              <Text style={styles.aiMetricLabel}>{t('ai.metrics.qualityRate')}</Text>
            </View>
            <View style={styles.aiMetricDivider} />
            <View style={styles.aiMetricItem}>
              <Text style={styles.aiMetricValue}>
                ¥{aiInsight.metrics.unitCost.toFixed(1)}
              </Text>
              <Text style={styles.aiMetricLabel}>{t('ai.metrics.unitCost')}</Text>
            </View>
            <View style={styles.aiMetricDivider} />
            <View style={styles.aiMetricItem}>
              <Text style={styles.aiMetricValue}>
                {aiInsight.metrics.avgCycle.toFixed(1)}h
              </Text>
              <Text style={styles.aiMetricLabel}>{t('ai.metrics.avgCycle')}</Text>
            </View>
          </View>
        </View>

        {/* 统计卡片 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>{t('sections.todayOverview')}</Text>
          <View style={styles.statsGrid}>
            {getStatCards().map(renderStatCard)}
          </View>
        </View>

        {/* 快捷操作 */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{t('sections.quickActions')}</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map(renderQuickAction)}
          </View>
        </View>

        {/* 开发者工具 - 仅在开发模式显示 */}
        {__DEV__ && (
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>{t('sections.devTools')}</Text>
            <TouchableOpacity
              style={[styles.quickAction, { backgroundColor: '#8B5CF6' }]}
              onPress={() => navigation.navigate('FormilyDemo')}
              activeOpacity={0.8}
            >
              <Icon source="form-select" size={24} color="#fff" />
              <Text style={styles.quickActionLabel}>{t('quickActions.formilyDemo')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 底部间距 */}
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
    fontSize: 14,
    color: '#666',
  },

  // 欢迎区
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  welcomeLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a202c',
  },
  dateText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f7fafc',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e53e3e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },

  // 错误提示
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },

  // AI 洞察卡片
  aiCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#667eea',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  aiStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiStatusSuccess: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  aiStatusLoading: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  aiStatusText: {
    fontSize: 12,
    color: '#fff',
  },
  aiMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
    marginBottom: 16,
  },
  aiMetrics: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  aiMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  aiMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  aiMetricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  aiMetricDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // 统计卡片
  statsSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#c6f6d5',
    borderRadius: 8,
  },
  trendText: {
    fontSize: 11,
    color: '#276749',
    marginLeft: 4,
    fontWeight: '500',
  },

  // 快捷操作
  quickActionsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '23%',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#4a5568',
    textAlign: 'center',
  },
});

export default FAHomeScreen;
