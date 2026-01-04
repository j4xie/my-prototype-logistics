import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  ProgressBar,
  Avatar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Line, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

// Define local navigation type for quota screens
type QuotaStackParamList = {
  QuotaOverview: undefined;
  QuotaRules: undefined;
  QuotaRuleEdit: { ruleId?: string };
  QuotaUsageStats: undefined;
};

type Props = NativeStackScreenProps<QuotaStackParamList, 'QuotaUsageStats'>;

type TimePeriod = 'today' | 'week' | 'month' | 'custom';

interface FeatureUsage {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

interface FactoryRanking {
  rank: number;
  name: string;
  code: string;
  usage: number;
  change: number;
}

/**
 * QuotaUsageStatsScreen - Usage Statistics for Platform Admin
 * Shows usage charts, trends, feature distribution, and factory rankings
 */
export default function QuotaUsageStatsScreen({ navigation }: Props) {
  const { t } = useTranslation('platform');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');

  // Mock data
  const [stats] = useState({
    totalCalls: 36582,
    dailyAverage: 5226,
    changePercent: 12,
    successRate: 98.5,
  });

  const [featureUsages] = useState<FeatureUsage[]>([
    {
      name: t('quotaUsageStats.features.formGeneration', { defaultValue: '表单智能生成' }),
      count: 12456,
      color: '#1890ff',
      percentage: 65,
    },
    {
      name: t('quotaUsageStats.features.scheduling', { defaultValue: '智能排产调度' }),
      count: 8234,
      color: '#52c41a',
      percentage: 43,
    },
    {
      name: t('quotaUsageStats.features.costAnalysis', { defaultValue: '成本分析预测' }),
      count: 6892,
      color: '#722ed1',
      percentage: 36,
    },
    {
      name: t('quotaUsageStats.features.qualityDiagnosis', { defaultValue: '质量异常诊断' }),
      count: 5678,
      color: '#fa8c16',
      percentage: 30,
    },
    {
      name: t('quotaUsageStats.features.otherAI', { defaultValue: '其他AI功能' }),
      count: 3322,
      color: '#8c8c8c',
      percentage: 17,
    },
  ]);

  const [factoryRankings] = useState<FactoryRanking[]>([
    { rank: 1, name: t('aiQuota.factoryNames.frozen', { defaultValue: '速冻食品厂' }), code: 'F002', usage: 12456, change: 18 },
    { rank: 2, name: t('aiQuota.factoryNames.seafood', { defaultValue: '海鲜加工一厂' }), code: 'F001', usage: 9876, change: 12 },
    { rank: 3, name: t('aiQuota.factoryNames.dairy', { defaultValue: '乳制品加工厂' }), code: 'F004', usage: 7234, change: -5 },
    { rank: 4, name: t('aiQuota.factoryNames.meat', { defaultValue: '肉类加工中心' }), code: 'F003', usage: 5012, change: 8 },
    { rank: 5, name: t('quotaUsageStats.factoryNames.seasoning', { defaultValue: '调味品加工厂' }), code: 'F005', usage: 2004, change: 0 },
  ]);

  const timePeriods: Array<{ key: TimePeriod; label: string }> = [
    { key: 'today', label: t('quotaUsageStats.periods.today', { defaultValue: '今日' }) },
    { key: 'week', label: t('quotaUsageStats.periods.week', { defaultValue: '本周' }) },
    { key: 'month', label: t('quotaUsageStats.periods.month', { defaultValue: '本月' }) },
    { key: 'custom', label: t('quotaUsageStats.periods.custom', { defaultValue: '自定义' }) },
  ];

  const weekDays = [
    t('quotaUsageStats.weekDays.mon', { defaultValue: '周一' }),
    t('quotaUsageStats.weekDays.tue', { defaultValue: '周二' }),
    t('quotaUsageStats.weekDays.wed', { defaultValue: '周三' }),
    t('quotaUsageStats.weekDays.thu', { defaultValue: '周四' }),
    t('quotaUsageStats.weekDays.fri', { defaultValue: '周五' }),
    t('quotaUsageStats.weekDays.sat', { defaultValue: '周六' }),
    t('quotaUsageStats.weekDays.sun', { defaultValue: '周日' }),
  ];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const getRankBadgeColors = (rank: number): [string, string] => {
    switch (rank) {
      case 1:
        return ['#faad14', '#d48806'];
      case 2:
        return ['#bfbfbf', '#8c8c8c'];
      case 3:
        return ['#d48806', '#ad6800'];
      default:
        return ['#f0f0f0', '#f0f0f0'];
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Simple line chart path data (simulated weekly trend)
  const chartWidth = width - 64;
  const chartHeight = 120;
  const dataPoints = [80, 70, 85, 55, 45, 50, 35];
  const maxValue = 100;
  const xStep = chartWidth / (dataPoints.length - 1);

  const pathData = dataPoints
    .map((value, index) => {
      const x = index * xStep;
      const y = chartHeight - (value / maxValue) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaPathData = `${pathData} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>
            {t('quotaUsageStats.title', { defaultValue: '使用统计' })}
          </Text>
          <IconButton
            icon="download"
            iconColor="#fff"
            size={24}
            onPress={() => {}}
          />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Time Period Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periodSelector}
          contentContainerStyle={styles.periodSelectorContent}
        >
          {timePeriods.map((period) => (
            <Pressable
              key={period.key}
              onPress={() => setSelectedPeriod(period.key)}
            >
              {selectedPeriod === period.key ? (
                <LinearGradient
                  colors={['#1a1a2e', '#16213e']}
                  style={styles.periodChip}
                >
                  <Text style={styles.periodChipTextActive}>{period.label}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.periodChip, styles.periodChipInactive]}>
                  <Text style={styles.periodChipText}>{period.label}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Total Stats Card */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.totalStatsCard}
        >
          <Text style={styles.totalStatsLabel}>
            {t('quotaUsageStats.weeklyTotal', { defaultValue: '本周总调用' })}
          </Text>
          <Text style={styles.totalStatsValue}>
            {formatNumber(stats.totalCalls)}{' '}
            <Text style={styles.totalStatsUnit}>
              {t('quotaUsageStats.times', { defaultValue: '次' })}
            </Text>
          </Text>

          <View style={styles.totalStatsGrid}>
            <View style={styles.totalStatItem}>
              <Text style={styles.totalStatItemValue}>
                {formatNumber(stats.dailyAverage)}
              </Text>
              <Text style={styles.totalStatItemLabel}>
                {t('quotaUsageStats.dailyAverage', { defaultValue: '日均' })}
              </Text>
            </View>
            <View style={styles.totalStatItem}>
              <Text style={styles.totalStatItemValue}>+{stats.changePercent}%</Text>
              <Text style={styles.totalStatItemLabel}>
                {t('quotaUsageStats.momChange', { defaultValue: '环比' })}
              </Text>
            </View>
            <View style={styles.totalStatItem}>
              <Text style={styles.totalStatItemValue}>{stats.successRate}%</Text>
              <Text style={styles.totalStatItemLabel}>
                {t('quotaUsageStats.successRate', { defaultValue: '成功率' })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Trend Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('quotaUsageStats.callTrend', { defaultValue: '调用趋势' })}
          </Text>
        </View>

        <Card style={styles.chartCard}>
          <Card.Content>
            <View style={styles.chartContainer}>
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#1890ff" stopOpacity={0.3} />
                    <Stop offset="100%" stopColor="#1890ff" stopOpacity={0} />
                  </SvgLinearGradient>
                </Defs>

                {/* Grid lines */}
                <Line x1="0" y1="30" x2={chartWidth} y2="30" stroke="#f0f0f0" strokeWidth="1" />
                <Line x1="0" y1="60" x2={chartWidth} y2="60" stroke="#f0f0f0" strokeWidth="1" />
                <Line x1="0" y1="90" x2={chartWidth} y2="90" stroke="#f0f0f0" strokeWidth="1" />

                {/* Area fill */}
                <Path d={areaPathData} fill="url(#areaGradient)" />

                {/* Line */}
                <Path d={pathData} fill="none" stroke="#1890ff" strokeWidth="2" />

                {/* Data points */}
                {dataPoints.map((value, index) => {
                  const x = index * xStep;
                  const y = chartHeight - (value / maxValue) * chartHeight;
                  return (
                    <Circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={4}
                      fill="#1890ff"
                    />
                  );
                })}
              </Svg>
              <View style={styles.chartLabels}>
                {weekDays.map((day, index) => (
                  <Text key={index} style={styles.chartLabel}>
                    {day}
                  </Text>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Feature Distribution */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('quotaUsageStats.featureDistribution', { defaultValue: '功能分布' })}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            {featureUsages.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureHeader}>
                  <Text style={styles.featureName}>{feature.name}</Text>
                  <Text style={[styles.featureCount, { color: feature.color }]}>
                    {formatNumber(feature.count)} {t('quotaUsageStats.times', { defaultValue: '次' })}
                  </Text>
                </View>
                <ProgressBar
                  progress={feature.percentage / 100}
                  color={feature.color}
                  style={styles.featureProgress}
                />
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Factory Ranking */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('quotaUsageStats.factoryRanking', { defaultValue: '工厂使用排行' })}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={{ padding: 0 }}>
            {factoryRankings.map((factory, index) => (
              <View
                key={factory.code}
                style={[
                  styles.rankingItem,
                  index < factoryRankings.length - 1 && styles.rankingItemBorder,
                ]}
              >
                <LinearGradient
                  colors={getRankBadgeColors(factory.rank)}
                  style={[
                    styles.rankBadge,
                    factory.rank > 3 && styles.rankBadgeDefault,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankBadgeText,
                      factory.rank > 3 && styles.rankBadgeTextDefault,
                    ]}
                  >
                    {factory.rank}
                  </Text>
                </LinearGradient>

                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingName}>{factory.name}</Text>
                  <Text style={styles.rankingCode}>{factory.code}</Text>
                </View>

                <View style={styles.rankingStats}>
                  <Text style={styles.rankingUsage}>
                    {formatNumber(factory.usage)}
                  </Text>
                  <Text
                    style={[
                      styles.rankingChange,
                      {
                        color:
                          factory.change > 0
                            ? '#52c41a'
                            : factory.change < 0
                            ? '#f5222d'
                            : '#8c8c8c',
                      },
                    ]}
                  >
                    {factory.change > 0 ? '+' : ''}
                    {factory.change}%
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  periodSelector: {
    marginBottom: 20,
    marginHorizontal: -16,
  },
  periodSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  periodChipInactive: {
    backgroundColor: '#f0f0f0',
  },
  periodChipText: {
    fontSize: 13,
    color: '#595959',
  },
  periodChipTextActive: {
    fontSize: 13,
    color: '#fff',
  },
  totalStatsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  totalStatsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  totalStatsValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  totalStatsUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
  },
  totalStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  totalStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  totalStatItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalStatItemLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  chartCard: {
    marginBottom: 20,
    borderRadius: 12,
  },
  chartContainer: {
    paddingTop: 20,
    paddingBottom: 0,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  chartLabel: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  card: {
    marginBottom: 20,
    borderRadius: 12,
  },
  featureItem: {
    marginBottom: 16,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureName: {
    fontSize: 14,
    color: '#262626',
  },
  featureCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  featureProgress: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
  },
  rankingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeDefault: {
    backgroundColor: '#f0f0f0',
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  rankBadgeTextDefault: {
    color: '#8c8c8c',
  },
  rankingInfo: {
    flex: 1,
  },
  rankingName: {
    fontSize: 14,
    color: '#262626',
  },
  rankingCode: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  rankingStats: {
    alignItems: 'flex-end',
  },
  rankingUsage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  rankingChange: {
    fontSize: 11,
    marginTop: 2,
  },
});
