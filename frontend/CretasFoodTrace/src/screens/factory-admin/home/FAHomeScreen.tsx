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
import { FAHomeStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';
import { dashboardAPI, DashboardOverviewData, AlertsDashboardData } from '../../../services/api/dashboardApiClient';

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
    message: '正在分析今日生产数据...',
    metrics: { qualityRate: 0, unitCost: 0, avgCycle: 0 },
  });

  // 获取当前日期
  const getFormattedDate = () => {
    const now = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDay = weekDays[now.getDay()];
    return `${month}月${day}日 ${weekDay}`;
  };

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
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

      // 本地计算 AI 洞察
      if (overviewRes.success && overviewRes.data) {
        const kpi = overviewRes.data.kpi;
        const qualityRate = kpi?.qualityPassRate ?? 98.5;
        const efficiency = kpi?.productionEfficiency ?? 92;

        // 生成简单的洞察文字
        let insightMessage = '今日生产运行正常';
        if (qualityRate < 95) {
          insightMessage = '今日良品率偏低，建议关注质检环节';
        } else if (efficiency < 85) {
          insightMessage = '生产效率有提升空间，可优化排产';
        } else if (qualityRate >= 98 && efficiency >= 95) {
          insightMessage = '生产状态极佳，各项指标优于预期';
        }

        setAIInsight({
          status: 'success',
          message: insightMessage,
          metrics: {
            qualityRate,
            unitCost: 12.5, // 示例值，实际应从 AI 服务获取
            avgCycle: 4.2,  // 示例值
          },
        });
      }
    } catch (err) {
      console.error('加载 Dashboard 数据失败:', err);
      setError('数据加载失败，请下拉刷新重试');
      setAIInsight({
        status: 'error',
        message: '暂时无法获取洞察数据',
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
        label: '今日产量(kg)',
        icon: 'scale',
        color: '#667eea',
        trend: outputTrend,
        onPress: () => navigation.navigate('TodayProduction'),
      },
      {
        value: todayStats?.totalBatches ?? overviewData?.summary?.totalBatches ?? '--',
        label: '今日批次',
        icon: 'package-variant',
        color: '#48bb78',
        trend: batchTrend,
        onPress: () => navigation.navigate('TodayBatches'),
      },
      {
        value: todayStats?.materialReceived ?? '--',
        label: '原料批次',
        icon: 'truck-delivery',
        color: '#ed8936',
        onPress: () => navigation.navigate('MaterialBatch'),
      },
      {
        value: alertsSummary?.activeAlerts ?? overviewData?.summary?.activeAlerts ?? '--',
        label: '今日告警',
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
      label: '新建计划',
      color: '#667eea',
      onPress: () => {
        navigation.getParent()?.navigate('FAAITab', { screen: 'CreatePlan' });
      },
    },
    {
      icon: 'chart-line',
      label: '数据报表',
      color: '#48bb78',
      onPress: () => {
        navigation.getParent()?.navigate('FAAITab', { screen: 'AIReport' });
      },
    },
    {
      icon: 'account-group',
      label: '人员管理',
      color: '#ed8936',
      onPress: () => {
        navigation.getParent()?.navigate('FAManagementTab', { screen: 'EmployeeList' });
      },
    },
    {
      icon: 'cog',
      label: '系统配置',
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
          <Text style={styles.loadingText}>加载中...</Text>
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
              {getGreeting()}，{user?.username ?? '管理员'}
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
              <Text style={styles.aiTitle}>AI 智能洞察</Text>
            </View>
            <View style={[
              styles.aiStatusBadge,
              aiInsight.status === 'success' ? styles.aiStatusSuccess : styles.aiStatusLoading
            ]}>
              <Text style={styles.aiStatusText}>
                {aiInsight.status === 'success' ? '已分析' : '分析中'}
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
              <Text style={styles.aiMetricLabel}>良品率</Text>
            </View>
            <View style={styles.aiMetricDivider} />
            <View style={styles.aiMetricItem}>
              <Text style={styles.aiMetricValue}>
                ¥{aiInsight.metrics.unitCost.toFixed(1)}
              </Text>
              <Text style={styles.aiMetricLabel}>单位成本</Text>
            </View>
            <View style={styles.aiMetricDivider} />
            <View style={styles.aiMetricItem}>
              <Text style={styles.aiMetricValue}>
                {aiInsight.metrics.avgCycle.toFixed(1)}h
              </Text>
              <Text style={styles.aiMetricLabel}>平均周期</Text>
            </View>
          </View>
        </View>

        {/* 统计卡片 */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>今日概览</Text>
          <View style={styles.statsGrid}>
            {getStatCards().map(renderStatCard)}
          </View>
        </View>

        {/* 快捷操作 */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map(renderQuickAction)}
          </View>
        </View>

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
