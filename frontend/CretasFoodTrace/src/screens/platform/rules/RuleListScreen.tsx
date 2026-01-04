import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Chip,
  FAB,
  Searchbar,
  Menu,
  Divider,
  ActivityIndicator,
  Avatar,
  Badge,
  Switch,
  IconButton,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import {
  ruleConfigApiClient,
  DroolsRule,
  RuleGroup,
  RuleEngineStatistics,
} from '../../../services/api/ruleConfigApiClient';
import { useAuthStore } from '../../../store/authStore';
import { createLogger } from '../../../utils/logger';

const ruleLogger = createLogger('RuleListScreen');

// Rule category configuration type
type CategoryConfig = {
  key: RuleGroup | 'all';
  label: string;
  labelEn: string;
  color: string;
  icon: string;
};

// Rule category configuration with colors
const RULE_CATEGORIES: CategoryConfig[] = [
  { key: 'all', label: '全部规则', labelEn: 'All Rules', color: '#666', icon: 'format-list-bulleted' },
  { key: 'validation', label: '验证规则', labelEn: 'Validation', color: '#1890ff', icon: 'check-circle' },
  { key: 'workflow', label: '工作流', labelEn: 'Workflow', color: '#52c41a', icon: 'sitemap' },
  { key: 'costing', label: '成本', labelEn: 'Costing', color: '#fa8c16', icon: 'currency-usd' },
  { key: 'quality', label: '质检', labelEn: 'Quality', color: '#722ed1', icon: 'shield-check' },
  { key: 'alert', label: '告警', labelEn: 'Alert', color: '#f5222d', icon: 'alert' },
];

// Default category for fallback
const DEFAULT_CATEGORY: CategoryConfig = RULE_CATEGORIES[0]!;

const getCategoryConfig = (group: RuleGroup | 'all'): CategoryConfig => {
  return RULE_CATEGORIES.find(c => c.key === group) ?? DEFAULT_CATEGORY;
};

export default function RuleListScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || 'F001';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<DroolsRule[]>([]);
  const [statistics, setStatistics] = useState<RuleEngineStatistics | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RuleGroup | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      ruleLogger.info('Loading rules data');

      const [rulesResponse, statsData] = await Promise.all([
        ruleConfigApiClient.getRules({}, factoryId),
        ruleConfigApiClient.getStatistics(factoryId),
      ]);

      if (rulesResponse && rulesResponse.content) {
        setRules(rulesResponse.content);
        ruleLogger.info(`Loaded ${rulesResponse.content.length} rules`);
      }

      if (statsData) {
        setStatistics(statsData);
      }
    } catch (error) {
      ruleLogger.error('Failed to load rules', error as Error);
      Alert.alert(
        t('common.error', 'Error'),
        t('rules.loadError', 'Failed to load rules')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filter rules by category and search
  const filteredRules = rules.filter(rule => {
    const matchesCategory = selectedCategory === 'all' || rule.ruleGroup === selectedCategory;
    const matchesSearch = !searchQuery ||
      rule.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rule.ruleDescription?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Group rules by category for display
  const groupedRules = filteredRules.reduce((acc, rule) => {
    const group = rule.ruleGroup;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(rule);
    return acc;
  }, {} as Record<RuleGroup, DroolsRule[]>);

  // Toggle rule enabled status
  const handleToggleRule = async (rule: DroolsRule) => {
    setTogglingRule(rule.id);
    try {
      const result = await ruleConfigApiClient.toggleRuleEnabled(rule.id, !rule.enabled, factoryId);
      if (result) {
        setRules(prev => prev.map(r =>
          r.id === rule.id ? { ...r, enabled: !r.enabled } : r
        ));
        // Update statistics
        if (statistics) {
          setStatistics({
            ...statistics,
            enabledRules: rule.enabled
              ? statistics.enabledRules - 1
              : statistics.enabledRules + 1,
          });
        }
      }
    } catch (error) {
      ruleLogger.error('Failed to toggle rule', error as Error);
      Alert.alert(
        t('common.error', 'Error'),
        t('rules.toggleError', 'Failed to toggle rule status')
      );
    } finally {
      setTogglingRule(null);
    }
  };

  // Delete rule
  const handleDeleteRule = (rule: DroolsRule) => {
    Alert.alert(
      t('rules.deleteConfirm', 'Delete Rule'),
      t('rules.deleteMessage', `Are you sure you want to delete "${rule.ruleName}"?`),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ruleConfigApiClient.deleteRule(rule.id, factoryId);
              setRules(prev => prev.filter(r => r.id !== rule.id));
              if (statistics) {
                setStatistics({
                  ...statistics,
                  totalRules: statistics.totalRules - 1,
                  enabledRules: rule.enabled
                    ? statistics.enabledRules - 1
                    : statistics.enabledRules,
                  rulesByGroup: {
                    ...statistics.rulesByGroup,
                    [rule.ruleGroup]: (statistics.rulesByGroup[rule.ruleGroup] || 1) - 1,
                  },
                });
              }
            } catch (error) {
              ruleLogger.error('Failed to delete rule', error as Error);
              Alert.alert(
                t('common.error', 'Error'),
                t('rules.deleteError', 'Failed to delete rule')
              );
            }
          },
        },
      ]
    );
  };

  // Navigate to edit
  const handleEditRule = (rule: DroolsRule) => {
    setMenuVisible(null);
    navigation.navigate('RuleEdit', { ruleId: rule.id });
  };

  // Navigate to create
  const handleCreateRule = () => {
    navigation.navigate('RuleEdit', {});
  };

  // Navigate to test
  const handleTestRule = (rule: DroolsRule) => {
    setMenuVisible(null);
    navigation.navigate('RuleTest', { ruleId: rule.id });
  };

  // Quick actions
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'decision-table':
        navigation.navigate('RuleEdit', { type: 'decision-table' });
        break;
      case 'state-machine':
        navigation.navigate('StateMachineList');
        break;
      case 'rule-test':
        navigation.navigate('RuleTest', {});
        break;
    }
  };

  // Render statistics cards
  const renderStatistics = () => {
    if (!statistics) return null;

    const statsCards = [
      {
        label: t('rules.totalRules', 'Total Rules'),
        value: statistics.totalRules,
        color: '#1890ff',
        icon: 'file-document-outline',
      },
      {
        label: t('rules.enabledRules', 'Enabled'),
        value: statistics.enabledRules,
        color: '#52c41a',
        icon: 'check-circle-outline',
      },
      {
        label: t('rules.disabledRules', 'Disabled'),
        value: statistics.totalRules - statistics.enabledRules,
        color: '#ff4d4f',
        icon: 'close-circle-outline',
      },
    ];

    return (
      <View style={styles.statsContainer}>
        {statsCards.map((stat, index) => (
          <Card key={index} style={styles.statCard} mode="elevated">
            <Card.Content style={styles.statContent}>
              <Avatar.Icon
                size={40}
                icon={stat.icon}
                color="#fff"
                style={{ backgroundColor: stat.color }}
              />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    );
  };

  // Render quick actions
  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>{t('rules.quickActions', 'Quick Actions')}</Text>
      <View style={styles.quickActionsRow}>
        <Pressable
          style={styles.quickActionCard}
          onPress={() => handleQuickAction('decision-table')}
        >
          <Avatar.Icon size={44} icon="table" color="#fff" style={{ backgroundColor: '#1890ff' }} />
          <Text style={styles.quickActionLabel}>{t('rules.decisionTable', 'Decision Table')}</Text>
        </Pressable>
        <Pressable
          style={styles.quickActionCard}
          onPress={() => handleQuickAction('state-machine')}
        >
          <Avatar.Icon size={44} icon="state-machine" color="#fff" style={{ backgroundColor: '#52c41a' }} />
          <Text style={styles.quickActionLabel}>{t('rules.stateMachine', 'State Machine')}</Text>
        </Pressable>
        <Pressable
          style={styles.quickActionCard}
          onPress={() => handleQuickAction('rule-test')}
        >
          <Avatar.Icon size={44} icon="test-tube" color="#fff" style={{ backgroundColor: '#722ed1' }} />
          <Text style={styles.quickActionLabel}>{t('rules.ruleTest', 'Rule Test')}</Text>
        </Pressable>
      </View>
    </View>
  );

  // Render category tabs
  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryTabs}
      contentContainerStyle={styles.categoryTabsContent}
    >
      {RULE_CATEGORIES.map(category => {
        const isSelected = selectedCategory === category.key;
        const count = category.key === 'all'
          ? rules.length
          : (statistics?.rulesByGroup[category.key as RuleGroup] || 0);

        return (
          <Chip
            key={category.key}
            selected={isSelected}
            onPress={() => setSelectedCategory(category.key)}
            style={[
              styles.categoryChip,
              isSelected && { backgroundColor: category.color + '20' },
            ]}
            textStyle={[
              styles.categoryChipText,
              isSelected && { color: category.color },
            ]}
            icon={category.icon}
          >
            {i18n.language === 'en' ? category.labelEn : category.label}
            {count > 0 && ` (${count})`}
          </Chip>
        );
      })}
    </ScrollView>
  );

  // Render rule item
  const renderRuleItem = (rule: DroolsRule) => {
    const categoryConfig = getCategoryConfig(rule.ruleGroup);
    const isToggling = togglingRule === rule.id;

    return (
      <Card
        key={rule.id}
        style={[styles.ruleCard, { borderLeftColor: categoryConfig.color }]}
        mode="elevated"
      >
        <Pressable onPress={() => handleEditRule(rule)}>
          <Card.Content>
            <View style={styles.ruleHeader}>
              <View style={styles.ruleTitleRow}>
                <Avatar.Icon
                  size={36}
                  icon={categoryConfig.icon}
                  color="#fff"
                  style={{ backgroundColor: categoryConfig.color }}
                />
                <View style={styles.ruleTitleContainer}>
                  <Text style={styles.ruleTitle} numberOfLines={1}>
                    {rule.ruleName}
                  </Text>
                  <View style={styles.ruleMetaRow}>
                    <Chip
                      compact
                      style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}
                      textStyle={{ color: categoryConfig.color, fontSize: 10 }}
                    >
                      {i18n.language === 'en' ? categoryConfig.labelEn : categoryConfig.label}
                    </Chip>
                    <Text style={styles.rulePriority}>
                      {t('rules.priority', 'Priority')}: {rule.priority}
                    </Text>
                    <Text style={styles.ruleVersion}>v{rule.version}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.ruleActions}>
                {isToggling ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Switch
                    value={rule.enabled}
                    onValueChange={() => handleToggleRule(rule)}
                    color="#52c41a"
                  />
                )}
                <Menu
                  visible={menuVisible === rule.id}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      size={20}
                      onPress={() => setMenuVisible(rule.id)}
                    />
                  }
                >
                  <Menu.Item
                    leadingIcon="pencil"
                    onPress={() => handleEditRule(rule)}
                    title={t('common.edit', 'Edit')}
                  />
                  <Menu.Item
                    leadingIcon="test-tube"
                    onPress={() => handleTestRule(rule)}
                    title={t('rules.test', 'Test')}
                  />
                  <Divider />
                  <Menu.Item
                    leadingIcon="delete"
                    onPress={() => {
                      setMenuVisible(null);
                      handleDeleteRule(rule);
                    }}
                    title={t('common.delete', 'Delete')}
                    titleStyle={{ color: '#f5222d' }}
                  />
                </Menu>
              </View>
            </View>

            {rule.ruleDescription && (
              <Text style={styles.ruleDescription} numberOfLines={2}>
                {rule.ruleDescription}
              </Text>
            )}

            <View style={styles.ruleFooter}>
              <Text style={styles.ruleDate}>
                {t('rules.updated', 'Updated')}: {rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : '-'}
              </Text>
            </View>
          </Card.Content>
        </Pressable>
      </Card>
    );
  };

  // Render rules grouped by category
  const renderRulesGrouped = () => {
    if (selectedCategory !== 'all') {
      // Show flat list for specific category
      return (
        <View style={styles.rulesSection}>
          {filteredRules.length === 0 ? (
            <View style={styles.emptyState}>
              <Avatar.Icon size={64} icon="file-document-outline" color="#999" style={{ backgroundColor: '#f0f0f0' }} />
              <Text style={styles.emptyText}>{t('rules.noRules', 'No rules found')}</Text>
            </View>
          ) : (
            filteredRules.map(rule => renderRuleItem(rule))
          )}
        </View>
      );
    }

    // Show grouped list for "all" category
    return (
      <View style={styles.rulesSection}>
        {Object.keys(groupedRules).length === 0 ? (
          <View style={styles.emptyState}>
            <Avatar.Icon size={64} icon="file-document-outline" color="#999" style={{ backgroundColor: '#f0f0f0' }} />
            <Text style={styles.emptyText}>{t('rules.noRules', 'No rules found')}</Text>
          </View>
        ) : (
          Object.entries(groupedRules).map(([group, groupRules]) => {
            const categoryConfig = getCategoryConfig(group as RuleGroup);
            return (
              <View key={group} style={styles.ruleGroup}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIndicator, { backgroundColor: categoryConfig.color }]} />
                  <Text style={styles.groupTitle}>
                    {i18n.language === 'en' ? categoryConfig.labelEn : categoryConfig.label}
                  </Text>
                  <Badge style={{ backgroundColor: categoryConfig.color }}>{groupRules.length}</Badge>
                </View>
                {groupRules.map(rule => renderRuleItem(rule))}
              </View>
            );
          })
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('rules.title', 'Rule Engine')} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('rules.title', 'Rule Engine')} />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Factory Header */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.factoryHeader}
        >
          <View style={styles.factoryInfo}>
            <Avatar.Icon size={48} icon="factory" color="#fff" style={{ backgroundColor: '#4a90d9' }} />
            <View style={styles.factoryTextContainer}>
              <Text style={styles.factoryName}>{factoryId}</Text>
              <Text style={styles.factorySubtitle}>{t('rules.ruleEngine', 'Rule Engine Management')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Statistics */}
        {renderStatistics()}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder={t('rules.searchPlaceholder', 'Search rules...')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />
        </View>

        {/* Category Tabs */}
        {renderCategoryTabs()}

        {/* Rules List */}
        {renderRulesGrouped()}

        {/* Bottom spacing for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB for creating new rule */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleCreateRule}
        label={t('rules.createRule', 'New Rule')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#666',
  },

  // Factory Header
  factoryHeader: {
    padding: 20,
    marginBottom: 16,
  },
  factoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  factoryTextContainer: {
    marginLeft: 16,
  },
  factoryName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  factorySubtitle: {
    fontSize: 14,
    color: '#a0c4ff',
    marginTop: 4,
  },

  // Statistics
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Quick Actions
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    color: '#333',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchbar: {
    borderRadius: 12,
    elevation: 2,
  },

  // Category Tabs
  categoryTabs: {
    marginBottom: 16,
  },
  categoryTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#fff',
  },
  categoryChipText: {
    fontSize: 13,
  },

  // Rules Section
  rulesSection: {
    paddingHorizontal: 16,
  },
  ruleGroup: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  groupIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },

  // Rule Card
  ruleCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  ruleTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  ruleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    height: 22,
  },
  rulePriority: {
    fontSize: 12,
    color: '#666',
  },
  ruleVersion: {
    fontSize: 12,
    color: '#999',
  },
  ruleActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    lineHeight: 20,
  },
  ruleFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  ruleDate: {
    fontSize: 12,
    color: '#999',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1890ff',
  },
});
