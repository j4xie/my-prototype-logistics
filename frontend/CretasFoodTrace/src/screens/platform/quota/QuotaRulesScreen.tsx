import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Avatar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Define local navigation type for quota screens
type QuotaStackParamList = {
  QuotaOverview: undefined;
  QuotaRules: undefined;
  QuotaRuleEdit: { ruleId?: string };
  QuotaUsageStats: undefined;
};

type Props = NativeStackScreenProps<QuotaStackParamList, 'QuotaRules'>;

interface QuotaRule {
  id: string;
  name: string;
  code: string;
  description: string;
  enabled: boolean;
  type: 'warning' | 'limit' | 'auto_scale' | 'daily_limit' | 'concurrent';
  tags: Array<{ label: string; color: string; bgColor: string }>;
}

interface FactoryRule {
  id: string;
  name: string;
  avatarText: string;
  avatarColor: string[];
  customRulesCount: number;
}

/**
 * QuotaRulesScreen - Quota Rules List for Platform Admin
 * Shows global rules, factory-specific rules with conditions and actions
 */
export default function QuotaRulesScreen({ navigation }: Props) {
  const { t } = useTranslation('platform');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data
  const [ruleStats] = useState({
    globalRules: 5,
    factoryRules: 12,
    enabledRules: 4,
  });

  const [globalRules] = useState<QuotaRule[]>([
    {
      id: 'QUOTA-WARN-001',
      name: t('quotaRules.rules.warningRule.name', { defaultValue: '配额预警规则' }),
      code: 'QUOTA-WARN-001',
      description: t('quotaRules.rules.warningRule.description', {
        defaultValue: '当工厂配额使用率达到阈值时触发预警通知',
      }),
      enabled: true,
      type: 'warning',
      tags: [
        { label: t('quotaRules.threshold', { defaultValue: '阈值' }) + ': 80%', color: '#fa8c16', bgColor: '#fff7e6' },
        { label: t('quotaRules.notification', { defaultValue: '通知' }) + ': ' + t('quotaRules.emailSms', { defaultValue: '邮件+短信' }), color: '#1890ff', bgColor: '#e6f7ff' },
      ],
    },
    {
      id: 'QUOTA-LIMIT-001',
      name: t('quotaRules.rules.limitRule.name', { defaultValue: '超限限流规则' }),
      code: 'QUOTA-LIMIT-001',
      description: t('quotaRules.rules.limitRule.description', {
        defaultValue: '配额用尽时自动限流，保障平台整体稳定性',
      }),
      enabled: true,
      type: 'limit',
      tags: [
        { label: t('quotaRules.trigger', { defaultValue: '触发' }) + ': 100%', color: '#f5222d', bgColor: '#fff1f0' },
        { label: t('quotaRules.action', { defaultValue: '动作' }) + ': ' + t('quotaRules.rejectRequest', { defaultValue: '拒绝请求' }), color: '#595959', bgColor: '#f0f0f0' },
      ],
    },
    {
      id: 'QUOTA-AUTO-001',
      name: t('quotaRules.rules.autoScaleRule.name', { defaultValue: '自动扩容规则' }),
      code: 'QUOTA-AUTO-001',
      description: t('quotaRules.rules.autoScaleRule.description', {
        defaultValue: '配额不足时自动申请临时扩容',
      }),
      enabled: false,
      type: 'auto_scale',
      tags: [
        { label: t('quotaRules.trigger', { defaultValue: '触发' }) + ': 95%', color: '#52c41a', bgColor: '#f6ffed' },
        { label: t('quotaRules.expand', { defaultValue: '扩容' }) + ': +20%', color: '#595959', bgColor: '#f0f0f0' },
      ],
    },
    {
      id: 'QUOTA-DAILY-001',
      name: t('quotaRules.rules.dailyLimitRule.name', { defaultValue: '日调用限制' }),
      code: 'QUOTA-DAILY-001',
      description: t('quotaRules.rules.dailyLimitRule.description', {
        defaultValue: '限制单工厂每日最大调用次数',
      }),
      enabled: true,
      type: 'daily_limit',
      tags: [
        { label: t('quotaRules.limit', { defaultValue: '限制' }) + ': 10,000' + t('quotaRules.timesPerDay', { defaultValue: '次/日' }), color: '#1890ff', bgColor: '#e6f7ff' },
        { label: t('quotaRules.reset', { defaultValue: '重置' }) + ': 00:00', color: '#595959', bgColor: '#f0f0f0' },
      ],
    },
    {
      id: 'QUOTA-CONC-001',
      name: t('quotaRules.rules.concurrentRule.name', { defaultValue: '并发限制规则' }),
      code: 'QUOTA-CONC-001',
      description: t('quotaRules.rules.concurrentRule.description', {
        defaultValue: '限制单工厂同时并发请求数',
      }),
      enabled: true,
      type: 'concurrent',
      tags: [
        { label: t('quotaRules.concurrent', { defaultValue: '并发' }) + ': 50' + t('quotaRules.perFactory', { defaultValue: '个/工厂' }), color: '#722ed1', bgColor: '#f9f0ff' },
        { label: t('quotaRules.queue', { defaultValue: '队列' }) + ': 100', color: '#595959', bgColor: '#f0f0f0' },
      ],
    },
  ]);

  const [factoryRules] = useState<FactoryRule[]>([
    {
      id: 'F001',
      name: t('aiQuota.factoryNames.seafood', { defaultValue: '海鲜加工一厂' }),
      avatarText: '海',
      avatarColor: ['#1890ff', '#096dd9'],
      customRulesCount: 3,
    },
    {
      id: 'F002',
      name: t('aiQuota.factoryNames.frozen', { defaultValue: '速冻食品厂' }),
      avatarText: '速',
      avatarColor: ['#52c41a', '#389e0d'],
      customRulesCount: 2,
    },
    {
      id: 'F003',
      name: t('aiQuota.factoryNames.meat', { defaultValue: '肉类加工中心' }),
      avatarText: '肉',
      avatarColor: ['#722ed1', '#531dab'],
      customRulesCount: 0,
    },
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const getRuleBorderColor = (type: QuotaRule['type']) => {
    switch (type) {
      case 'warning':
        return '#faad14';
      case 'limit':
        return '#f5222d';
      case 'auto_scale':
        return '#52c41a';
      case 'daily_limit':
        return '#1890ff';
      case 'concurrent':
        return '#722ed1';
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
          <Text style={styles.headerTitle}>
            {t('quotaRules.title', { defaultValue: '配额规则' })}
          </Text>
          <Pressable onPress={() => navigation.navigate('QuotaRuleEdit', {})}>
            <Text style={styles.headerAction}>
              + {t('quotaRules.newRule', { defaultValue: '新规则' })}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Info Banner */}
        <LinearGradient
          colors={['#722ed1', '#531dab']}
          style={styles.infoBanner}
        >
          <View style={styles.infoBannerContent}>
            <View style={styles.infoBannerIcon}>
              <Avatar.Icon
                icon="shield-check"
                size={40}
                color="#fff"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              />
            </View>
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>
                {t('quotaRules.smartQuotaManagement', { defaultValue: '智能配额管理' })}
              </Text>
              <Text style={styles.infoBannerDescription}>
                {t('quotaRules.configureThresholds', {
                  defaultValue: '配置预警阈值、限流策略和自动扩容规则，确保AI服务稳定运行',
                })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text style={[styles.statValue, { color: '#1890ff' }]}>
                {ruleStats.globalRules}
              </Text>
              <Text style={styles.statLabel}>
                {t('quotaRules.globalRules', { defaultValue: '全局规则' })}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text style={[styles.statValue, { color: '#52c41a' }]}>
                {ruleStats.factoryRules}
              </Text>
              <Text style={styles.statLabel}>
                {t('quotaRules.factoryRules', { defaultValue: '工厂规则' })}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text style={[styles.statValue, { color: '#722ed1' }]}>
                {ruleStats.enabledRules}
              </Text>
              <Text style={styles.statLabel}>
                {t('quotaRules.enabledRules', { defaultValue: '已启用' })}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Global Rules Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('quotaRules.globalRulesSection', { defaultValue: '全局规则' })}
          </Text>
        </View>

        {globalRules.map((rule) => (
          <Pressable
            key={rule.id}
            onPress={() => navigation.navigate('QuotaRuleEdit', { ruleId: rule.id })}
          >
            <Card
              style={[
                styles.ruleCard,
                { borderLeftColor: getRuleBorderColor(rule.type) },
              ]}
            >
              <Card.Content>
                <View style={styles.ruleHeader}>
                  <View>
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    <Text style={styles.ruleCode}>{rule.code}</Text>
                  </View>
                  <Chip
                    mode="flat"
                    compact
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: rule.enabled ? '#f6ffed' : '#f0f0f0',
                      },
                    ]}
                    textStyle={{
                      color: rule.enabled ? '#52c41a' : '#8c8c8c',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {rule.enabled
                      ? t('quotaRules.enabled', { defaultValue: '启用' })
                      : t('quotaRules.disabled', { defaultValue: '停用' })}
                  </Chip>
                </View>

                <Text style={styles.ruleDescription}>{rule.description}</Text>

                <View style={styles.ruleTags}>
                  {rule.tags.map((tag, index) => (
                    <View
                      key={index}
                      style={[styles.ruleTag, { backgroundColor: tag.bgColor }]}
                    >
                      <Text style={[styles.ruleTagText, { color: tag.color }]}>
                        {tag.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          </Pressable>
        ))}

        {/* Factory Rules Section */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>
            {t('quotaRules.factoryRulesSection', { defaultValue: '工厂级规则' })}
          </Text>
        </View>

        <Card style={styles.factoryRulesCard}>
          <Card.Content>
            <Text style={styles.factoryRulesHint}>
              {t('quotaRules.factoryRulesHint', {
                defaultValue: '工厂可以设置独立的配额规则，覆盖全局规则',
              })}
            </Text>

            {factoryRules.map((factory) => (
              <Pressable key={factory.id} onPress={() => {}}>
                <View style={styles.factoryRuleItem}>
                  <View style={styles.factoryRuleInfo}>
                    <LinearGradient
                      colors={factory.avatarColor as [string, string]}
                      style={styles.factoryAvatar}
                    >
                      <Text style={styles.factoryAvatarText}>
                        {factory.avatarText}
                      </Text>
                    </LinearGradient>
                    <View>
                      <Text style={styles.factoryName}>{factory.name}</Text>
                      <Text style={styles.factoryRuleCount}>
                        {factory.customRulesCount > 0
                          ? t('quotaRules.customRulesCount', {
                              defaultValue: '{{count}}个自定义规则',
                              count: factory.customRulesCount,
                            })
                          : t('quotaRules.useGlobalRules', { defaultValue: '使用全局规则' })}
                      </Text>
                    </View>
                  </View>
                  <Avatar.Icon
                    icon="chevron-right"
                    size={24}
                    color="#8c8c8c"
                    style={{ backgroundColor: 'transparent' }}
                  />
                </View>
              </Pressable>
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
  headerAction: {
    fontSize: 14,
    color: '#fff',
    marginRight: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  infoBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  infoBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoBannerIcon: {
    flexShrink: 0,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  infoBannerDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
  },
  statContent: {
    alignItems: 'center',
    padding: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    color: '#8c8c8c',
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
  ruleCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ruleName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 4,
  },
  ruleCode: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  statusChip: {
    height: 24,
  },
  ruleDescription: {
    fontSize: 13,
    color: '#595959',
    marginBottom: 10,
    lineHeight: 20,
  },
  ruleTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ruleTagText: {
    fontSize: 12,
  },
  factoryRulesCard: {
    borderRadius: 12,
  },
  factoryRulesHint: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 12,
  },
  factoryRuleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    marginBottom: 8,
  },
  factoryRuleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  factoryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factoryAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  factoryName: {
    fontSize: 14,
    color: '#262626',
  },
  factoryRuleCount: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
});
