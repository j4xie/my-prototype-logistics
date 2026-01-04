import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  ActivityIndicator,
  Divider,
  Avatar,
  Switch,
  Menu,
  Badge,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../store/authStore';
import { createLogger } from '../../../utils/logger';
import { isAxiosError } from 'axios';
import { ruleConfigApiClient } from '../../../services/api/ruleConfigApiClient';

const logger = createLogger('RulePackDetailScreen');

// Route params type
type RulePackDetailRouteParams = {
  RulePackDetail: {
    packId: string;
  };
};

// Mock types - replace with actual API types when available
interface RulePack {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'enabled' | 'disabled' | 'draft';
  ruleCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  category: string;
  rules: RuleItem[];
  versionHistory: VersionHistoryItem[];
}

interface RuleItem {
  id: string;
  name: string;
  group: string;
  priority: number;
  enabled: boolean;
}

interface VersionHistoryItem {
  version: string;
  createdAt: string;
  createdBy: string;
  changes: string;
}

// TODO: 待后端实现规则包详情API后替换
// 预期API: GET /api/platform/rule-packs/{packId}
// 预期响应格式:
// {
//   success: true,
//   data: {
//     id: string,
//     name: string,
//     description: string,
//     version: string,
//     status: 'enabled' | 'disabled' | 'draft',
//     ruleCount: number,
//     rules: RuleItem[],
//     versionHistory: VersionHistoryItem[],
//     ...
//   }
// }

const RulePackDetailScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object>>>();
  const route = useRoute<RouteProp<RulePackDetailRouteParams, 'RulePackDetail'>>();
  const { getFactoryId } = useAuthStore();
  const factoryId = getFactoryId();

  const { packId } = route.params || {};

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rulePack, setRulePack] = useState<RulePack | null>(null);
  const [packEnabled, setPackEnabled] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'rules' | 'history'>('rules');

  // Load rule pack
  useEffect(() => {
    loadRulePack();
  }, [packId]);

  const loadRulePack = async () => {
    try {
      setLoading(true);
      // TODO: 后端实现规则包详情API后启用以下代码
      // const response = await ruleConfigApiClient.getRulePackById(packId);
      // if (response.success && response.data) {
      //   setRulePack(response.data);
      //   setPackEnabled(response.data.status === 'enabled');
      // }

      // 临时等待以模拟网络请求
      await new Promise((resolve) => setTimeout(resolve, 300));
      // API未实现前返回null
      setRulePack(null);
      setPackEnabled(false);
    } catch (error) {
      logger.error('Failed to load rule pack', error);
      if (isAxiosError(error)) {
        Alert.alert(t('common.error'), error.response?.data?.message || t('rules.loadFailed'));
      } else if (error instanceof Error) {
        Alert.alert(t('common.error'), error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRulePack();
  };

  // Toggle pack enabled status
  const handleTogglePack = async (enabled: boolean) => {
    try {
      setPackEnabled(enabled);
      // TODO: Call API to toggle pack status
      logger.info(`Rule pack ${enabled ? 'enabled' : 'disabled'}`, { packId });
    } catch (error) {
      logger.error('Failed to toggle rule pack', error);
      setPackEnabled(!enabled);
      Alert.alert(t('common.error'), t('rules.toggleFailed'));
    }
  };

  // Toggle individual rule
  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    if (!rulePack) return;

    setRulePack({
      ...rulePack,
      rules: rulePack.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled } : rule
      ),
    });
    // TODO: Call API to toggle rule status
  };

  // Navigate to edit
  const handleEdit = () => {
    setMenuVisible(false);
    // TODO: Navigate to edit screen
    Alert.alert(t('common.info'), t('rules.editNotImplemented'));
  };

  // Delete pack
  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      t('rules.deleteConfirm', 'Delete Rule Pack'),
      t('rules.deletePackMessage', 'Are you sure you want to delete this rule pack? This action cannot be undone.'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            // TODO: Call API to delete pack
            navigation.goBack();
          },
        },
      ]
    );
  };

  // Get status config
  const getStatusConfig = (status: string): { label: string; color: string; bgColor: string } => {
    const defaultConfig = { label: t('rules.draft', 'Draft'), color: '#faad14', bgColor: '#fffbe6' };
    const configs: Record<string, { label: string; color: string; bgColor: string }> = {
      enabled: { label: t('rules.enabled', 'Enabled'), color: '#52c41a', bgColor: '#f6ffed' },
      disabled: { label: t('rules.disabled', 'Disabled'), color: '#8c8c8c', bgColor: '#f5f5f5' },
      draft: defaultConfig,
    };
    return configs[status] ?? defaultConfig;
  };

  // Get rule group config
  const getRuleGroupConfig = (group: string): { color: string; icon: string } => {
    const defaultConfig = { color: '#1890ff', icon: 'check-circle' };
    const configs: Record<string, { color: string; icon: string }> = {
      validation: defaultConfig,
      workflow: { color: '#52c41a', icon: 'sitemap' },
      quality: { color: '#722ed1', icon: 'shield-check' },
      costing: { color: '#fa8c16', icon: 'currency-usd' },
      alert: { color: '#f5222d', icon: 'alert' },
    };
    return configs[group] ?? defaultConfig;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!rulePack) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('rules.rulePackDetail', 'Rule Pack Detail')} />
        </Appbar.Header>
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="alert-circle" color="#999" style={{ backgroundColor: '#f0f0f0' }} />
          <Text style={styles.emptyText}>{t('rules.packNotFound', 'Rule pack not found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = getStatusConfig(packEnabled ? 'enabled' : 'disabled');
  const enabledRulesCount = rulePack.rules.filter((r) => r.enabled).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#1890ff', '#096dd9']} style={styles.header}>
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
          <Appbar.Content
            title={t('rules.rulePackDetail', 'Rule Pack Detail')}
            titleStyle={styles.headerTitle}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Appbar.Action
                icon="dots-vertical"
                color="#fff"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              leadingIcon="pencil"
              onPress={handleEdit}
              title={t('common.edit', 'Edit')}
            />
            <Divider />
            <Menu.Item
              leadingIcon="delete"
              onPress={handleDelete}
              title={t('common.delete', 'Delete')}
              titleStyle={{ color: '#f5222d' }}
            />
          </Menu>
        </Appbar.Header>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Pack Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <View style={styles.infoLeft}>
                <Text style={styles.packName}>{rulePack.name}</Text>
                <View style={styles.infoMeta}>
                  <Chip
                    compact
                    style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
                    textStyle={{ color: statusConfig.color }}
                  >
                    {statusConfig.label}
                  </Chip>
                  <Text style={styles.versionText}>v{rulePack.version}</Text>
                </View>
              </View>
              <Switch
                value={packEnabled}
                onValueChange={handleTogglePack}
                color="#52c41a"
              />
            </View>

            <Text style={styles.description}>{rulePack.description}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{rulePack.ruleCount}</Text>
                <Text style={styles.statLabel}>{t('rules.totalRules', 'Total Rules')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#52c41a' }]}>{enabledRulesCount}</Text>
                <Text style={styles.statLabel}>{t('rules.enabledRules', 'Enabled')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#8c8c8c' }]}>
                  {rulePack.ruleCount - enabledRulesCount}
                </Text>
                <Text style={styles.statLabel}>{t('rules.disabledRules', 'Disabled')}</Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <IconButton icon="account" size={16} iconColor="#999" style={styles.metaIcon} />
                <Text style={styles.metaText}>{rulePack.createdBy}</Text>
              </View>
              <View style={styles.metaItem}>
                <IconButton icon="calendar" size={16} iconColor="#999" style={styles.metaIcon} />
                <Text style={styles.metaText}>{formatDate(rulePack.updatedAt)}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'rules' && styles.tabActive]}
            onPress={() => setSelectedTab('rules')}
          >
            <Text style={[styles.tabText, selectedTab === 'rules' && styles.tabTextActive]}>
              {t('rules.includedRules', 'Included Rules')}
            </Text>
            <Badge style={styles.tabBadge}>{rulePack.rules.length}</Badge>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'history' && styles.tabActive]}
            onPress={() => setSelectedTab('history')}
          >
            <Text style={[styles.tabText, selectedTab === 'history' && styles.tabTextActive]}>
              {t('rules.versionHistory', 'Version History')}
            </Text>
            <Badge style={styles.tabBadge}>{rulePack.versionHistory.length}</Badge>
          </TouchableOpacity>
        </View>

        {/* Rules List */}
        {selectedTab === 'rules' && (
          <Card style={styles.listCard}>
            <Card.Content>
              {rulePack.rules.map((rule, index) => {
                const groupConfig = getRuleGroupConfig(rule.group);
                return (
                  <React.Fragment key={rule.id}>
                    <TouchableOpacity
                      style={styles.ruleItem}
                      onPress={() => {
                        navigation.navigate('RuleEdit', { ruleId: rule.id });
                      }}
                    >
                      <View style={styles.ruleInfo}>
                        <View style={styles.ruleHeader}>
                          <View
                            style={[styles.ruleIndicator, { backgroundColor: groupConfig.color }]}
                          />
                          <Text style={styles.ruleName}>{rule.name}</Text>
                        </View>
                        <View style={styles.ruleMeta}>
                          <Chip
                            compact
                            style={[styles.ruleGroupChip, { backgroundColor: groupConfig.color + '20' }]}
                            textStyle={{ color: groupConfig.color, fontSize: 10 }}
                          >
                            {rule.group}
                          </Chip>
                          <Text style={styles.rulePriority}>
                            {t('rules.priority', 'Priority')}: {rule.priority}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={rule.enabled}
                        onValueChange={(enabled) => handleToggleRule(rule.id, enabled)}
                        color="#52c41a"
                      />
                    </TouchableOpacity>
                    {index < rulePack.rules.length - 1 && <Divider style={styles.ruleDivider} />}
                  </React.Fragment>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Version History */}
        {selectedTab === 'history' && (
          <Card style={styles.listCard}>
            <Card.Content>
              {rulePack.versionHistory.map((history, index) => (
                <React.Fragment key={history.version}>
                  <View style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                      <View style={styles.historyDot} />
                      {index < rulePack.versionHistory.length - 1 && (
                        <View style={styles.historyLine} />
                      )}
                    </View>
                    <View style={styles.historyContent}>
                      <View style={styles.historyHeader}>
                        <Chip compact style={styles.versionChip}>
                          v{history.version}
                        </Chip>
                        <Text style={styles.historyDate}>
                          {formatDate(history.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.historyChanges}>{history.changes}</Text>
                      <Text style={styles.historyAuthor}>
                        {t('rules.by', 'by')} {history.createdBy}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <Button
          mode="outlined"
          icon="test-tube"
          onPress={() => navigation.navigate('RuleTest', { packId })}
          style={styles.testButton}
        >
          {t('rules.testPack', 'Test Pack')}
        </Button>
        <Button
          mode="contained"
          icon="pencil"
          onPress={handleEdit}
          style={styles.editButton}
        >
          {t('common.edit', 'Edit')}
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  header: {
    paddingBottom: 8,
  },
  appbar: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Info Card
  infoCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoLeft: {
    flex: 1,
    marginRight: 16,
  },
  packName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    height: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1890ff',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  divider: {
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    margin: 0,
    marginRight: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  // Tab Container
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#e6f7ff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#1890ff',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#1890ff',
  },
  // List Card
  listCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  // Rule Item
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  ruleInfo: {
    flex: 1,
    marginRight: 12,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ruleIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  ruleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  ruleGroupChip: {
    height: 20,
  },
  rulePriority: {
    fontSize: 12,
    color: '#999',
  },
  ruleDivider: {
    backgroundColor: '#f0f0f0',
  },
  // History Item
  historyItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  historyLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1890ff',
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e8e8e8',
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  versionChip: {
    backgroundColor: '#e6f7ff',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  historyChanges: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  historyAuthor: {
    fontSize: 12,
    color: '#999',
  },
  // Action Bar
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    gap: 12,
  },
  testButton: {
    flex: 1,
  },
  editButton: {
    flex: 2,
    backgroundColor: '#1890ff',
  },
  bottomSpacing: {
    height: 80,
  },
});

export default RulePackDetailScreen;
