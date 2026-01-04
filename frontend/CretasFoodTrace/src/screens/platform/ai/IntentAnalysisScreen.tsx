import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  Chip,
  ProgressBar,
  Avatar,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<PlatformStackParamList, 'IntentAnalysis'>;

interface IntentStat {
  intent: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface FactoryIntentStat {
  factoryId: string;
  factoryName: string;
  totalRequests: number;
  topIntents: Array<{ intent: string; count: number }>;
  successRate: number;
  avatarColor: string[];
  avatarText: string;
}

interface TrendDataPoint {
  label: string;
  value: number;
}

/**
 * IntentAnalysisScreen - Intent Analysis Statistics Page
 * Shows intent recognition accuracy, distribution, and trends
 */
export default function IntentAnalysisScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState('week');

  // Overall statistics
  const [overallStats] = useState({
    totalRequests: 15678,
    successfulIntents: 14245,
    accuracyRate: 90.9,
    llmFallbackRate: 8.5,
    avgConfidence: 0.87,
    avgResponseTime: 1.1,
  });

  // Top 10 intents distribution
  const [topIntents] = useState<IntentStat[]>([
    { intent: 'material_query', label: 'Material Query', count: 3456, percentage: 22.0, color: '#1890ff', trend: 'up', trendValue: 12 },
    { intent: 'batch_create', label: 'Batch Create', count: 2890, percentage: 18.4, color: '#52c41a', trend: 'up', trendValue: 8 },
    { intent: 'quality_check', label: 'Quality Check', count: 2345, percentage: 15.0, color: '#722ed1', trend: 'stable', trendValue: 0 },
    { intent: 'production_status', label: 'Production Status', count: 1987, percentage: 12.7, color: '#fa8c16', trend: 'up', trendValue: 5 },
    { intent: 'inventory_query', label: 'Inventory Query', count: 1654, percentage: 10.5, color: '#13c2c2', trend: 'down', trendValue: -3 },
    { intent: 'shipment_track', label: 'Shipment Track', count: 1234, percentage: 7.9, color: '#eb2f96', trend: 'up', trendValue: 15 },
    { intent: 'report_generate', label: 'Report Generate', count: 876, percentage: 5.6, color: '#f5222d', trend: 'stable', trendValue: 1 },
    { intent: 'equipment_status', label: 'Equipment Status', count: 567, percentage: 3.6, color: '#faad14', trend: 'down', trendValue: -8 },
    { intent: 'personnel_query', label: 'Personnel Query', count: 432, percentage: 2.8, color: '#a0d911', trend: 'up', trendValue: 20 },
    { intent: 'alert_check', label: 'Alert Check', count: 237, percentage: 1.5, color: '#2f54eb', trend: 'up', trendValue: 35 },
  ]);

  // Factory intent statistics
  const [factoryStats] = useState<FactoryIntentStat[]>([
    {
      factoryId: 'F001',
      factoryName: 'Seafood Processing #1',
      totalRequests: 5678,
      topIntents: [
        { intent: 'material_query', count: 1234 },
        { intent: 'batch_create', count: 987 },
        { intent: 'quality_check', count: 765 },
      ],
      successRate: 92.5,
      avatarColor: ['#1890ff', '#096dd9'],
      avatarText: 'S1',
    },
    {
      factoryId: 'F002',
      factoryName: 'Frozen Food Factory',
      totalRequests: 4532,
      topIntents: [
        { intent: 'production_status', count: 876 },
        { intent: 'batch_create', count: 765 },
        { intent: 'inventory_query', count: 543 },
      ],
      successRate: 89.8,
      avatarColor: ['#52c41a', '#389e0d'],
      avatarText: 'FF',
    },
    {
      factoryId: 'F003',
      factoryName: 'Meat Processing Center',
      totalRequests: 3456,
      topIntents: [
        { intent: 'quality_check', count: 654 },
        { intent: 'material_query', count: 543 },
        { intent: 'shipment_track', count: 432 },
      ],
      successRate: 91.2,
      avatarColor: ['#722ed1', '#531dab'],
      avatarText: 'MC',
    },
    {
      factoryId: 'F004',
      factoryName: 'Dairy Products Plant',
      totalRequests: 2012,
      topIntents: [
        { intent: 'batch_create', count: 432 },
        { intent: 'equipment_status', count: 321 },
        { intent: 'alert_check', count: 198 },
      ],
      successRate: 88.5,
      avatarColor: ['#fa8c16', '#d46b08'],
      avatarText: 'DP',
    },
  ]);

  // Weekly trend data
  const [trendData] = useState<TrendDataPoint[]>([
    { label: 'Mon', value: 2134 },
    { label: 'Tue', value: 2456 },
    { label: 'Wed', value: 2234 },
    { label: 'Thu', value: 2678 },
    { label: 'Fri', value: 2890 },
    { label: 'Sat', value: 1567 },
    { label: 'Sun', value: 1234 },
  ]);

  const maxTrendValue = Math.max(...trendData.map(d => d.value));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'minus';
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '#52c41a';
      case 'down':
        return '#f5222d';
      default:
        return '#8c8c8c';
    }
  };

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
          <Text style={styles.headerTitle}>Intent Analysis</Text>
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
        <SegmentedButtons
          value={timePeriod}
          onValueChange={setTimePeriod}
          buttons={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          style={styles.segmentedButtons}
        />

        {/* Overall Accuracy Card */}
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.accuracyCard}>
          <Text style={styles.accuracyLabel}>Intent Recognition Accuracy</Text>
          <View style={styles.accuracyValueRow}>
            <Text style={styles.accuracyValue}>{overallStats.accuracyRate}%</Text>
            <Chip
              mode="flat"
              compact
              icon="check-circle"
              style={styles.accuracyChip}
              textStyle={styles.accuracyChipText}
            >
              Good
            </Chip>
          </View>
          <View style={styles.accuracyStats}>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyStatValue}>{formatNumber(overallStats.totalRequests)}</Text>
              <Text style={styles.accuracyStatLabel}>Total Requests</Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyStatValue}>{formatNumber(overallStats.successfulIntents)}</Text>
              <Text style={styles.accuracyStatLabel}>Successful</Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyStatValue}>{overallStats.avgConfidence.toFixed(2)}</Text>
              <Text style={styles.accuracyStatLabel}>Avg Confidence</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#fff1f0' }]}>
                <Avatar.Icon
                  icon="robot"
                  size={28}
                  color="#f5222d"
                  style={{ backgroundColor: 'transparent' }}
                />
              </View>
              <Text style={styles.statLabel}>LLM Fallback Rate</Text>
              <Text style={[styles.statValue, { color: '#f5222d' }]}>{overallStats.llmFallbackRate}%</Text>
              <Text style={styles.statSubtext}>{Math.round(overallStats.totalRequests * overallStats.llmFallbackRate / 100)} requests</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <View style={[styles.statIcon, { backgroundColor: '#e6f7ff' }]}>
                <Avatar.Icon
                  icon="clock-fast"
                  size={28}
                  color="#1890ff"
                  style={{ backgroundColor: 'transparent' }}
                />
              </View>
              <Text style={styles.statLabel}>Avg Response Time</Text>
              <Text style={styles.statValue}>{overallStats.avgResponseTime}s</Text>
              <Text style={styles.statSubtext}>Per request</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Weekly Trend Chart */}
        <Card style={styles.trendCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Weekly Request Trend</Text>
            <View style={styles.trendChart}>
              {trendData.map((point, index) => (
                <View key={index} style={styles.trendBarContainer}>
                  <View style={styles.trendBarWrapper}>
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={[
                        styles.trendBar,
                        { height: `${(point.value / maxTrendValue) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.trendLabel}>{point.label}</Text>
                  <Text style={styles.trendValue}>{point.value}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Top 10 Intents */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top 10 Intents</Text>
        </View>

        <Card style={styles.intentListCard}>
          <Card.Content>
            {topIntents.map((intent, index) => (
              <View key={intent.intent} style={styles.intentItem}>
                <View style={styles.intentRank}>
                  <Text style={styles.intentRankText}>{index + 1}</Text>
                </View>
                <View style={styles.intentInfo}>
                  <View style={styles.intentHeader}>
                    <Text style={styles.intentLabel}>{intent.label}</Text>
                    <View style={styles.intentTrend}>
                      <Avatar.Icon
                        icon={getTrendIcon(intent.trend)}
                        size={16}
                        color={getTrendColor(intent.trend)}
                        style={{ backgroundColor: 'transparent' }}
                      />
                      <Text style={[styles.intentTrendText, { color: getTrendColor(intent.trend) }]}>
                        {intent.trendValue > 0 ? '+' : ''}{intent.trendValue}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.intentProgress}>
                    <ProgressBar
                      progress={intent.percentage / 100}
                      color={intent.color}
                      style={styles.intentProgressBar}
                    />
                  </View>
                  <View style={styles.intentMeta}>
                    <Text style={styles.intentCount}>{formatNumber(intent.count)} requests</Text>
                    <Text style={styles.intentPercentage}>{intent.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Factory Intent Distribution */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Factory Intent Distribution</Text>
        </View>

        {factoryStats.map((factory) => (
          <Card key={factory.factoryId} style={styles.factoryCard}>
            <Card.Content>
              <View style={styles.factoryHeader}>
                <View style={styles.factoryInfo}>
                  <LinearGradient
                    colors={factory.avatarColor as [string, string]}
                    style={styles.factoryAvatar}
                  >
                    <Text style={styles.factoryAvatarText}>{factory.avatarText}</Text>
                  </LinearGradient>
                  <View>
                    <Text style={styles.factoryName}>{factory.factoryName}</Text>
                    <Text style={styles.factoryMeta}>
                      {formatNumber(factory.totalRequests)} requests
                    </Text>
                  </View>
                </View>
                <Chip
                  mode="flat"
                  compact
                  style={[
                    styles.successChip,
                    { backgroundColor: factory.successRate >= 90 ? '#f6ffed' : '#fff7e6' }
                  ]}
                  textStyle={[
                    styles.successChipText,
                    { color: factory.successRate >= 90 ? '#52c41a' : '#fa8c16' }
                  ]}
                >
                  {factory.successRate}% Success
                </Chip>
              </View>

              <View style={styles.factoryIntents}>
                <Text style={styles.factoryIntentsLabel}>Top Intents:</Text>
                <View style={styles.factoryIntentChips}>
                  {factory.topIntents.map((intent) => (
                    <Chip
                      key={intent.intent}
                      mode="outlined"
                      compact
                      style={styles.factoryIntentChip}
                      textStyle={styles.factoryIntentChipText}
                    >
                      {intent.intent.replace('_', ' ')} ({intent.count})
                    </Chip>
                  ))}
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
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
  segmentedButtons: {
    marginBottom: 16,
  },
  accuracyCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  accuracyLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  accuracyValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  accuracyValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
  },
  accuracyChip: {
    backgroundColor: 'rgba(82, 196, 26, 0.2)',
    borderColor: '#52c41a',
    borderWidth: 1,
  },
  accuracyChipText: {
    color: '#52c41a',
    fontSize: 12,
  },
  accuracyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accuracyStat: {
    alignItems: 'center',
  },
  accuracyStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  accuracyStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
  },
  statContent: {
    alignItems: 'center',
    padding: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#262626',
  },
  statSubtext: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  trendCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    marginTop: 16,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  trendBarWrapper: {
    height: 100,
    width: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    borderRadius: 4,
  },
  trendLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 6,
  },
  trendValue: {
    fontSize: 10,
    color: '#262626',
    fontWeight: '500',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  intentListCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  intentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  intentRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  intentRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  intentInfo: {
    flex: 1,
  },
  intentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  intentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  intentTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  intentTrendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  intentProgress: {
    marginBottom: 6,
  },
  intentProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f0f0f0',
  },
  intentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intentCount: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  intentPercentage: {
    fontSize: 12,
    fontWeight: '500',
    color: '#262626',
  },
  factoryCard: {
    borderRadius: 12,
    marginBottom: 12,
  },
  factoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  factoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factoryAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factoryAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  factoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  factoryMeta: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  successChip: {
    height: 24,
  },
  successChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  factoryIntents: {
    marginTop: 4,
  },
  factoryIntentsLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 8,
  },
  factoryIntentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factoryIntentChip: {
    height: 26,
    backgroundColor: '#f5f5f5',
  },
  factoryIntentChipText: {
    fontSize: 11,
    color: '#595959',
  },
});
