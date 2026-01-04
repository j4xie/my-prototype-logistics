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
  Chip,
  IconButton,
  ProgressBar,
  Avatar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

// Define local navigation type for quota screens
type QuotaStackParamList = {
  QuotaOverview: undefined;
  QuotaRules: undefined;
  QuotaRuleEdit: { ruleId?: string };
  QuotaUsageStats: undefined;
};

type Props = NativeStackScreenProps<QuotaStackParamList, 'QuotaOverview'>;

interface FactoryQuota {
  id: string;
  name: string;
  code: string;
  industry: string;
  used: number;
  total: number;
  status: 'normal' | 'warning' | 'exceeded';
  daysUntilLimit?: number;
  exceededAmount?: number;
  avatarColor: string[];
  avatarText: string;
}

/**
 * QuotaOverviewScreen - AI Quota Overview for Platform Admin
 * Shows total platform quota usage, stats cards, and factory breakdown
 */
export default function QuotaOverviewScreen({ navigation }: Props) {
  const { t } = useTranslation('platform');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - in production, this would come from API
  const [quotaData] = useState({
    used: 1234567,
    total: 2000000,
    remaining: 765433,
    usagePercent: 62,
    monthlyUsage: 156789,
    monthlyGrowth: 12,
    connectedFactories: 12,
    warningFactories: 3,
    dailyAverage: 5226,
  });

  const [factories] = useState<FactoryQuota[]>([
    {
      id: 'F001',
      name: t('aiQuota.factoryNames.seafood', { defaultValue: '海鲜加工一厂' }),
      code: 'F001',
      industry: t('aiQuota.industries.seafood', { defaultValue: '水产加工' }),
      used: 45678,
      total: 100000,
      status: 'normal',
      avatarColor: ['#1890ff', '#096dd9'],
      avatarText: '海',
    },
    {
      id: 'F002',
      name: t('aiQuota.factoryNames.frozen', { defaultValue: '速冻食品厂' }),
      code: 'F002',
      industry: t('aiQuota.industries.frozen', { defaultValue: '速冻食品' }),
      used: 82456,
      total: 100000,
      status: 'warning',
      daysUntilLimit: 8,
      avatarColor: ['#52c41a', '#389e0d'],
      avatarText: '速',
    },
    {
      id: 'F003',
      name: t('aiQuota.factoryNames.meat', { defaultValue: '肉类加工中心' }),
      code: 'F003',
      industry: t('aiQuota.industries.meat', { defaultValue: '肉类加工' }),
      used: 28345,
      total: 80000,
      status: 'normal',
      avatarColor: ['#722ed1', '#531dab'],
      avatarText: '肉',
    },
    {
      id: 'F004',
      name: t('aiQuota.factoryNames.dairy', { defaultValue: '乳制品加工厂' }),
      code: 'F004',
      industry: t('aiQuota.industries.dairy', { defaultValue: '乳制品' }),
      used: 52345,
      total: 50000,
      status: 'exceeded',
      exceededAmount: 2345,
      avatarColor: ['#fa8c16', '#d46b08'],
      avatarText: '乳',
    },
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const getStatusChip = (status: FactoryQuota['status']) => {
    switch (status) {
      case 'normal':
        return (
          <Chip
            mode="flat"
            compact
            style={[styles.statusChip, { backgroundColor: '#f6ffed' }]}
            textStyle={{ color: '#52c41a', fontSize: 12, fontWeight: '600' }}
          >
            {t('aiQuota.status.normal', { defaultValue: '正常' })}
          </Chip>
        );
      case 'warning':
        return (
          <Chip
            mode="flat"
            compact
            style={[styles.statusChip, { backgroundColor: '#fff7e6' }]}
            textStyle={{ color: '#faad14', fontSize: 12, fontWeight: '600' }}
          >
            {t('aiQuota.status.warning', { defaultValue: '预警' })}
          </Chip>
        );
      case 'exceeded':
        return (
          <Chip
            mode="flat"
            compact
            style={[styles.statusChip, { backgroundColor: '#fff1f0' }]}
            textStyle={{ color: '#f5222d', fontSize: 12, fontWeight: '600' }}
          >
            {t('aiQuota.status.exceeded', { defaultValue: '超限' })}
          </Chip>
        );
    }
  };

  const getProgressColor = (status: FactoryQuota['status']) => {
    switch (status) {
      case 'normal':
        return '#52c41a';
      case 'warning':
        return '#faad14';
      case 'exceeded':
        return '#f5222d';
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
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
          <Text style={styles.headerTitle}>
            {t('aiQuota.title', { defaultValue: 'AI配额管理' })}
          </Text>
          <IconButton
            icon="cog"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.navigate('QuotaRules')}
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
        {/* Platform Quota Card */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.quotaCard}
        >
          <Text style={styles.quotaLabel}>
            {t('aiQuota.platformQuota', { defaultValue: '平台AI配额' })}
          </Text>
          <View style={styles.quotaValueRow}>
            <Text style={styles.quotaValue}>{formatNumber(quotaData.used)}</Text>
            <Text style={styles.quotaTotalText}>
              / {formatNumber(quotaData.total)} {t('aiQuota.times', { defaultValue: '次' })}
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={['#52c41a', '#95de64']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${quotaData.usagePercent}%` }]}
              />
            </View>
          </View>
          <View style={styles.quotaFooter}>
            <Text style={styles.quotaFooterText}>
              {t('aiQuota.used', { defaultValue: '已使用' })} {quotaData.usagePercent}%
            </Text>
            <Text style={styles.quotaFooterText}>
              {t('aiQuota.remaining', { defaultValue: '剩余' })} {formatNumber(quotaData.remaining)} {t('aiQuota.times', { defaultValue: '次' })}
            </Text>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <View style={styles.statIconRow}>
                <View style={[styles.statIcon, { backgroundColor: '#e6f7ff' }]}>
                  <Avatar.Icon
                    icon="calendar"
                    size={28}
                    color="#1890ff"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
                <Text style={styles.statLabel}>
                  {t('aiQuota.monthlyUsage', { defaultValue: '本月使用' })}
                </Text>
              </View>
              <Text style={styles.statValue}>{formatNumber(quotaData.monthlyUsage)}</Text>
              <Text style={[styles.statChange, { color: '#52c41a' }]}>
                {t('aiQuota.vsLastMonth', { defaultValue: '较上月' })} +{quotaData.monthlyGrowth}%
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <View style={styles.statIconRow}>
                <View style={[styles.statIcon, { backgroundColor: '#f6ffed' }]}>
                  <Avatar.Icon
                    icon="factory"
                    size={28}
                    color="#52c41a"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
                <Text style={styles.statLabel}>
                  {t('aiQuota.connectedFactories', { defaultValue: '接入工厂' })}
                </Text>
              </View>
              <Text style={styles.statValue}>{quotaData.connectedFactories}</Text>
              <Text style={styles.statSubtext}>
                {t('aiQuota.allAllocated', { defaultValue: '全部配额已分配' })}
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <View style={styles.statIconRow}>
                <View style={[styles.statIcon, { backgroundColor: '#fff7e6' }]}>
                  <Avatar.Icon
                    icon="alert"
                    size={28}
                    color="#fa8c16"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
                <Text style={styles.statLabel}>
                  {t('aiQuota.warningFactories', { defaultValue: '预警工厂' })}
                </Text>
              </View>
              <Text style={[styles.statValue, { color: '#fa8c16' }]}>
                {quotaData.warningFactories}
              </Text>
              <Text style={[styles.statChange, { color: '#fa8c16' }]}>
                {t('aiQuota.quotaUsageOver80', { defaultValue: '配额使用 >80%' })}
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <View style={styles.statIconRow}>
                <View style={[styles.statIcon, { backgroundColor: '#f9f0ff' }]}>
                  <Avatar.Icon
                    icon="chart-line"
                    size={28}
                    color="#722ed1"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
                <Text style={styles.statLabel}>
                  {t('aiQuota.dailyAverage', { defaultValue: '日均调用' })}
                </Text>
              </View>
              <Text style={styles.statValue}>{formatNumber(quotaData.dailyAverage)}</Text>
              <Text style={styles.statSubtext}>
                {t('aiQuota.timesPerDay', { defaultValue: '次/天' })}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Factory List Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('aiQuota.factoryQuotaAllocation', { defaultValue: '工厂配额分配' })}
          </Text>
          <Pressable onPress={() => navigation.navigate('QuotaUsageStats')}>
            <Text style={styles.sectionLink}>
              {t('aiQuota.usageStats', { defaultValue: '使用统计' })}
            </Text>
          </Pressable>
        </View>

        {/* Factory Cards */}
        {factories.map((factory) => (
          <Pressable
            key={factory.id}
            onPress={() => {}}
          >
            <Card
              style={[
                styles.factoryCard,
                factory.status === 'warning' && styles.factoryCardWarning,
                factory.status === 'exceeded' && styles.factoryCardExceeded,
              ]}
            >
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
                      <Text style={styles.factoryName}>{factory.name}</Text>
                      <Text style={styles.factoryMeta}>
                        {factory.code} {'\u00B7'} {factory.industry}
                      </Text>
                    </View>
                  </View>
                  {getStatusChip(factory.status)}
                </View>

                <View style={styles.factoryProgress}>
                  <View style={styles.factoryProgressHeader}>
                    <Text style={styles.factoryProgressText}>
                      {t('aiQuota.used', { defaultValue: '已用' })} {formatNumber(factory.used)} / {formatNumber(factory.total)}
                    </Text>
                    <Text
                      style={[
                        styles.factoryProgressPercent,
                        { color: getProgressColor(factory.status) },
                      ]}
                    >
                      {Math.round((factory.used / factory.total) * 100)}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={Math.min(factory.used / factory.total, 1)}
                    color={getProgressColor(factory.status)}
                    style={styles.factoryProgressBar}
                  />
                </View>

                {factory.status === 'warning' && factory.daysUntilLimit && (
                  <View style={styles.factoryAlert}>
                    <Avatar.Icon
                      icon="alert-circle"
                      size={20}
                      color="#faad14"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <Text style={[styles.factoryAlertText, { color: '#faad14' }]}>
                      {t('aiQuota.daysUntilLimit', {
                        defaultValue: '预计 {{days}} 天后达到上限',
                        days: factory.daysUntilLimit
                      })}
                    </Text>
                  </View>
                )}

                {factory.status === 'exceeded' && factory.exceededAmount && (
                  <View style={styles.factoryAlert}>
                    <Avatar.Icon
                      icon="alert-circle"
                      size={20}
                      color="#f5222d"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <Text style={[styles.factoryAlertText, { color: '#f5222d' }]}>
                      {t('aiQuota.exceededQuota', {
                        defaultValue: '已超出配额 {{amount}} 次，服务已限流',
                        amount: formatNumber(factory.exceededAmount),
                      })}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          </Pressable>
        ))}

        {/* View All Link */}
        <View style={styles.viewAllContainer}>
          <Pressable onPress={() => {}}>
            <Text style={styles.viewAllText}>
              {t('aiQuota.viewAllFactories', {
                defaultValue: '查看全部 {{count}} 个工厂配额',
                count: quotaData.connectedFactories,
              })}
            </Text>
          </Pressable>
        </View>
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
  quotaCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  quotaLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  quotaValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  quotaValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  quotaTotalText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  quotaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quotaFooterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 44) / 2,
    borderRadius: 12,
  },
  statContent: {
    padding: 4,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#262626',
  },
  statChange: {
    fontSize: 12,
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionLink: {
    fontSize: 13,
    color: '#667eea',
  },
  factoryCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  factoryCardWarning: {
    borderWidth: 1,
    borderColor: '#faad14',
  },
  factoryCardExceeded: {
    borderWidth: 1,
    borderColor: '#f5222d',
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
    fontSize: 16,
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
  statusChip: {
    height: 24,
  },
  factoryProgress: {
    marginBottom: 8,
  },
  factoryProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  factoryProgressText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  factoryProgressPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
  factoryProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f0f0f0',
  },
  factoryAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  factoryAlertText: {
    fontSize: 12,
  },
  viewAllContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#667eea',
  },
});
