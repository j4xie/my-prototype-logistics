/**
 * SmartBI - Executive Dashboard Screen
 *
 * Displays executive-level KPIs, rankings, trends, and AI insights
 * for business intelligence and decision-making.
 *
 * Features:
 * - Time period selector (today/week/month/quarter/year)
 * - KPI cards (sales, orders, completion rate, profit)
 * - Department and regional rankings
 * - Trend charts
 * - AI insight cards
 * - Quick question entry point
 *
 * @version 1.0.0
 * @since 2026-01-18
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Text, Card, Surface, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';

// Type for MaterialCommunityIcons names
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const { width: screenWidth } = Dimensions.get('window');

// Theme colors for SmartBI
const SMARTBI_THEME = {
  primary: '#4F46E5',
  secondary: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

// Time period options
type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface TimePeriodOption {
  key: TimePeriod;
  label: string;
}

// KPI Card data
interface KPIData {
  sales: number;
  salesChange: number;
  orders: number;
  ordersChange: number;
  completionRate: number;
  completionRateChange: number;
  profit: number;
  profitChange: number;
}

// Ranking item
interface RankingItem {
  rank: number;
  name: string;
  value: number;
  change: number;
}

// AI Insight
interface AIInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'trend' | 'anomaly';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

// Quick question
interface QuickQuestion {
  id: string;
  text: string;
}

interface DashboardData {
  kpi: KPIData;
  departmentRanking: RankingItem[];
  regionRanking: RankingItem[];
  aiInsights: AIInsight[];
  quickQuestions: QuickQuestion[];
  trendData: Array<{ date: string; value: number }>;
}

// Adapter: transform backend DashboardResponse to frontend DashboardData
// Backend returns: { kpiCards: [...], rankings: { department: [...], region: [...] }, insights: [...], ... }
// Frontend expects: { kpi: {...}, departmentRanking: [...], regionRanking: [...], aiInsights: [...], ... }
function adaptDashboardResponse(raw: any): DashboardData {
  // If already in expected format, return as-is
  if (raw?.kpi && raw?.departmentRanking) {
    return raw as DashboardData;
  }

  // Map kpiCards array to kpi object
  const kpiCards: any[] = raw?.kpiCards || [];
  const findKpi = (key: string) => kpiCards.find((k: any) => k.key === key || k.type === key);
  const salesKpi = findKpi('sales') || findKpi('revenue') || kpiCards[0];
  const ordersKpi = findKpi('orders') || findKpi('order_count') || kpiCards[1];
  const completionKpi = findKpi('completion_rate') || findKpi('completionRate') || kpiCards[2];
  const profitKpi = findKpi('profit') || findKpi('net_profit') || kpiCards[3];

  const kpi: KPIData = {
    sales: salesKpi?.value ?? 0,
    salesChange: salesKpi?.change ?? salesKpi?.changeRate ?? 0,
    orders: ordersKpi?.value ?? 0,
    ordersChange: ordersKpi?.change ?? ordersKpi?.changeRate ?? 0,
    completionRate: completionKpi?.value ?? 0,
    completionRateChange: completionKpi?.change ?? completionKpi?.changeRate ?? 0,
    profit: profitKpi?.value ?? 0,
    profitChange: profitKpi?.change ?? profitKpi?.changeRate ?? 0,
  };

  // Map rankings
  const rankings = raw?.rankings || {};
  const mapRanking = (items: any[]): RankingItem[] =>
    (items || []).map((item: any, idx: number) => ({
      rank: item.rank ?? idx + 1,
      name: item.name || item.label || '',
      value: item.value ?? item.amount ?? 0,
      change: item.change ?? item.changeRate ?? 0,
    }));

  const departmentRanking = mapRanking(rankings.department || raw?.departmentRanking || []);
  const regionRanking = mapRanking(rankings.region || raw?.regionRanking || []);

  // Map AI insights
  const rawInsights: any[] = raw?.insights || raw?.aiInsights || [];
  const aiInsights: AIInsight[] = rawInsights.map((item: any, idx: number) => ({
    id: item.id || String(idx),
    type: item.type || 'trend',
    title: item.title || '',
    description: item.description || item.content || '',
    priority: item.priority || 'medium',
  }));

  // Map quick questions
  const rawQuestions: any[] = raw?.quickQuestions || raw?.suggestedQuestions || [];
  const quickQuestions: QuickQuestion[] = rawQuestions.map((item: any, idx: number) => ({
    id: item.id || String(idx),
    text: item.text || item.question || '',
  }));

  // Trend data
  const trendData = raw?.trendData || raw?.trend || [];

  return { kpi, departmentRanking, regionRanking, aiInsights, quickQuestions, trendData };
}

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string;
  change: number;
  icon: MaterialCommunityIconName;
  color: string;
  onPress?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, color, onPress }) => {
  const isPositive = change >= 0;

  return (
    <TouchableOpacity
      style={styles.kpiCardWrapper}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Surface style={styles.kpiCard} elevation={2}>
        <View style={[styles.kpiIconContainer, { backgroundColor: color + '20' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiTitle}>{title}</Text>
        <View style={styles.kpiChangeContainer}>
          <MaterialCommunityIcons
            name={isPositive ? 'trending-up' : 'trending-down'}
            size={14}
            color={isPositive ? SMARTBI_THEME.success : SMARTBI_THEME.danger}
          />
          <Text
            style={[
              styles.kpiChange,
              { color: isPositive ? SMARTBI_THEME.success : SMARTBI_THEME.danger },
            ]}
          >
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </Text>
        </View>
      </Surface>
    </TouchableOpacity>
  );
};

// Ranking Item Component
interface RankingItemComponentProps {
  item: RankingItem;
  type: 'department' | 'region';
}

const RankingItemComponent: React.FC<RankingItemComponentProps> = ({ item, type }) => {
  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return SMARTBI_THEME.textSecondary;
  };

  return (
    <View style={styles.rankingItem}>
      <View style={[styles.rankBadge, { backgroundColor: getRankColor(item.rank) + '20' }]}>
        <Text style={[styles.rankNumber, { color: getRankColor(item.rank) }]}>
          {item.rank}
        </Text>
      </View>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName}>{item.name}</Text>
        <Text style={styles.rankValue}>
          {type === 'department' ? `${(item.value / 10000).toFixed(1)}W` : `${item.value}`}
        </Text>
      </View>
      <View style={styles.rankChange}>
        <MaterialCommunityIcons
          name={item.change >= 0 ? 'arrow-up' : 'arrow-down'}
          size={16}
          color={item.change >= 0 ? SMARTBI_THEME.success : SMARTBI_THEME.danger}
        />
        <Text
          style={[
            styles.rankChangeText,
            { color: item.change >= 0 ? SMARTBI_THEME.success : SMARTBI_THEME.danger },
          ]}
        >
          {Math.abs(item.change).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
};

// AI Insight Card Component
interface AIInsightCardProps {
  insight: AIInsight;
  onPress?: () => void;
}

const AIInsightCard: React.FC<AIInsightCardProps> = ({ insight, onPress }) => {
  const getInsightConfig = (type: AIInsight['type']): { icon: MaterialCommunityIconName; color: string } => {
    switch (type) {
      case 'opportunity':
        return { icon: 'lightbulb-on', color: SMARTBI_THEME.success };
      case 'warning':
        return { icon: 'alert-circle', color: SMARTBI_THEME.warning };
      case 'trend':
        return { icon: 'chart-line', color: SMARTBI_THEME.info };
      case 'anomaly':
        return { icon: 'alert-octagon', color: SMARTBI_THEME.danger };
      default:
        return { icon: 'information', color: SMARTBI_THEME.info };
    }
  };

  const config = getInsightConfig(insight.type);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.insightCard}>
        <Card.Content style={styles.insightContent}>
          <View style={[styles.insightIcon, { backgroundColor: config.color + '20' }]}>
            <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
          </View>
          <View style={styles.insightText}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightDescription} numberOfLines={2}>
              {insight.description}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={SMARTBI_THEME.textMuted}
          />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

export default function ExecutiveDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const TIME_PERIODS: TimePeriodOption[] = [
    { key: 'today', label: t('periods.today', { defaultValue: '今日' }) },
    { key: 'week', label: t('periods.week', { defaultValue: '本周' }) },
    { key: 'month', label: t('periods.month', { defaultValue: '本月' }) },
    { key: 'quarter', label: t('periods.quarter', { defaultValue: '本季' }) },
    { key: 'year', label: t('periods.year', { defaultValue: '本年' }) },
  ];

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const factoryId = getFactoryId();

      const response = await smartBIApiClient.getExecutiveDashboard(selectedPeriod, factoryId || undefined);

      if (response.success && response.data) {
        setDashboardData(adaptDashboardResponse(response.data));
      } else {
        // Even on failure, show empty dashboard instead of blank screen
        setDashboardData(adaptDashboardResponse({}));
        setError(response.message || t('errors.loadFailed', { defaultValue: '加载失败' }));
      }
    } catch (err) {
      console.error('Load executive dashboard failed:', err);
      // Show empty dashboard with error message instead of blank screen
      if (!dashboardData) {
        setDashboardData(adaptDashboardResponse({}));
      }
      setError(t('errors.loadFailed', { defaultValue: '数据加载失败，请重试' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, getFactoryId, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatCurrency = (value: number): string => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return value.toLocaleString();
  };

  const handleQuickQuestion = (question: QuickQuestion) => {
    navigation.navigate('NLQuery', { initialQuery: question.text });
  };

  const navigateToNLQuery = () => {
    navigation.navigate('NLQuery');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SMARTBI_THEME.primary} />
          <Text style={styles.loadingText}>{t('common.loading', { defaultValue: '加载中...' })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>
                {t('executive.title', { defaultValue: '经营驾驶舱' })}
              </Text>
              <Text style={styles.headerSubtitle}>
                {user?.username || t('common.user', { defaultValue: '用户' })}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <IconButton
                icon="magnify"
                iconColor="#fff"
                size={24}
                onPress={navigateToNLQuery}
              />
              <IconButton
                icon="bell-outline"
                iconColor="#fff"
                size={24}
                onPress={() => Alert.alert(t('common.tip', { defaultValue: '提示' }), t('common.comingSoon', { defaultValue: '功能开发中' }))}
              />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[SMARTBI_THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Time Period Selector */}
        <View style={styles.periodSelector}>
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.periodButton,
                selectedPeriod === period.key && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period.key && styles.periodButtonTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={SMARTBI_THEME.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* KPI Cards */}
        {dashboardData?.kpi && (
          <View style={styles.kpiGrid}>
            <KPICard
              title={t('kpi.sales', { defaultValue: '销售额' })}
              value={formatCurrency(dashboardData.kpi.sales ?? 0)}
              change={dashboardData.kpi.salesChange ?? 0}
              icon="currency-cny"
              color={SMARTBI_THEME.primary}
            />
            <KPICard
              title={t('kpi.orders', { defaultValue: '订单数' })}
              value={(dashboardData.kpi.orders ?? 0).toLocaleString()}
              change={dashboardData.kpi.ordersChange ?? 0}
              icon="shopping"
              color={SMARTBI_THEME.info}
            />
            <KPICard
              title={t('kpi.completionRate', { defaultValue: '完成率' })}
              value={`${(dashboardData.kpi.completionRate ?? 0).toFixed(1)}%`}
              change={dashboardData.kpi.completionRateChange ?? 0}
              icon="check-circle"
              color={SMARTBI_THEME.success}
            />
            <KPICard
              title={t('kpi.profit', { defaultValue: '利润' })}
              value={formatCurrency(dashboardData.kpi.profit ?? 0)}
              change={dashboardData.kpi.profitChange ?? 0}
              icon="trending-up"
              color={SMARTBI_THEME.secondary}
            />
          </View>
        )}

        {/* Rankings Section */}
        {dashboardData && (dashboardData.departmentRanking?.length > 0 || dashboardData.regionRanking?.length > 0) && (
          <View style={styles.rankingSection}>
            {/* Department Ranking */}
            <View style={styles.rankingCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('ranking.department', { defaultValue: '部门排行' })}
                </Text>
                <TouchableOpacity>
                  <Text style={styles.viewAll}>
                    {t('common.viewAll', { defaultValue: '查看全部' })}
                  </Text>
                </TouchableOpacity>
              </View>
              {dashboardData.departmentRanking.slice(0, 5).map((item) => (
                <RankingItemComponent key={item.rank} item={item} type="department" />
              ))}
            </View>

            {/* Region Ranking */}
            <View style={styles.rankingCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('ranking.region', { defaultValue: '区域排行' })}
                </Text>
                <TouchableOpacity>
                  <Text style={styles.viewAll}>
                    {t('common.viewAll', { defaultValue: '查看全部' })}
                  </Text>
                </TouchableOpacity>
              </View>
              {dashboardData.regionRanking.slice(0, 5).map((item) => (
                <RankingItemComponent key={item.rank} item={item} type="region" />
              ))}
            </View>
          </View>
        )}

        {/* AI Insights */}
        {dashboardData && dashboardData.aiInsights?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="robot"
                  size={20}
                  color={SMARTBI_THEME.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t('insights.title', { defaultValue: 'AI 洞察' })}
                </Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.viewAll}>
                  {t('common.viewAll', { defaultValue: '查看全部' })}
                </Text>
              </TouchableOpacity>
            </View>
            {dashboardData.aiInsights.slice(0, 3).map((insight) => (
              <AIInsightCard
                key={insight.id}
                insight={insight}
                onPress={() => Alert.alert(insight.title, insight.description)}
              />
            ))}
          </View>
        )}

        {/* Quick Questions */}
        {dashboardData && dashboardData.quickQuestions?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons
                  name="comment-question"
                  size={20}
                  color={SMARTBI_THEME.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t('quickQuestions.title', { defaultValue: '快捷问答' })}
                </Text>
              </View>
            </View>
            <View style={styles.quickQuestions}>
              {dashboardData.quickQuestions.map((question) => (
                <TouchableOpacity
                  key={question.id}
                  style={styles.quickQuestionChip}
                  onPress={() => handleQuickQuestion(question)}
                >
                  <Text style={styles.quickQuestionText}>{question.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Ask AI Button */}
        <TouchableOpacity style={styles.askAIButton} onPress={navigateToNLQuery}>
          <MaterialCommunityIcons name="robot" size={24} color="#fff" />
          <Text style={styles.askAIButtonText}>
            {t('common.askAI', { defaultValue: '向 AI 提问' })}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SMARTBI_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: SMARTBI_THEME.textSecondary,
  },
  header: {
    backgroundColor: SMARTBI_THEME.primary,
  },
  headerGradient: {
    backgroundColor: SMARTBI_THEME.primary,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: SMARTBI_THEME.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: SMARTBI_THEME.textSecondary,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: SMARTBI_THEME.danger,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  kpiCardWrapper: {
    width: '50%',
    padding: 6,
  },
  kpiCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    alignItems: 'center',
  },
  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: SMARTBI_THEME.textPrimary,
  },
  kpiTitle: {
    fontSize: 14,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 4,
  },
  kpiChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  kpiChange: {
    fontSize: 12,
    fontWeight: '500',
  },
  rankingSection: {
    marginBottom: 16,
  },
  rankingCard: {
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    color: SMARTBI_THEME.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    color: SMARTBI_THEME.primary,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  rankInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankName: {
    fontSize: 14,
    color: SMARTBI_THEME.textPrimary,
  },
  rankValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  rankChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    width: 60,
    justifyContent: 'flex-end',
  },
  rankChangeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  insightCard: {
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightText: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  insightDescription: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  quickQuestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickQuestionChip: {
    backgroundColor: SMARTBI_THEME.primary + '10',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SMARTBI_THEME.primary + '30',
  },
  quickQuestionText: {
    fontSize: 13,
    color: SMARTBI_THEME.primary,
  },
  askAIButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SMARTBI_THEME.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  askAIButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacer: {
    height: 80,
  },
});
