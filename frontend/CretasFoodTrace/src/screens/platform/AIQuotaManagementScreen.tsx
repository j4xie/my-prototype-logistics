import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  TextInput,
  Button,
  Divider,
  ActivityIndicator,
  IconButton,
  List,
  ProgressBar,
  SegmentedButtons,
  Chip,
  Switch,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { platformAPI } from '../../services/api/platformApiClient';
import type {
  FactoryAIQuota,
  PlatformAIUsageStats,
  AIQuotaRule,
  CreateAIQuotaRuleRequest,
} from '../../types/processing';
import { logger } from '../../utils/logger';

// 创建AIQuotaManagement专用logger
const aiQuotaLogger = logger.createContextLogger('AIQuotaManagement');

/**
 * AI配额管理界面
 * 仅平台管理员可访问
 */
export default function AIQuotaManagementScreen() {
  const navigation = useNavigation();

  // Tab状态
  const [activeTab, setActiveTab] = useState<'usage' | 'rules'>('usage');

  // 使用概览状态
  const [factories, setFactories] = useState<FactoryAIQuota[]>([]);
  const [stats, setStats] = useState<PlatformAIUsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingFactory, setEditingFactory] = useState<string | null>(null);
  const [editQuota, setEditQuota] = useState<string>('');

  // 规则配置状态
  const [quotaRules, setQuotaRules] = useState<AIQuotaRule[]>([]);
  const [globalRule, setGlobalRule] = useState<AIQuotaRule | null>(null);
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [editRuleQuota, setEditRuleQuota] = useState<string>('');
  const [editRuleResetDay, setEditRuleResetDay] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'usage') {
        const [factoriesRes, statsRes] = await Promise.all([
          platformAPI.getFactoryAIQuotas(),
          platformAPI.getPlatformAIUsageStats(),
        ]);

        if (factoriesRes.success) setFactories(factoriesRes.data);
        if (statsRes.success) setStats(statsRes.data);

        aiQuotaLogger.info('AI配额数据加载成功', {
          factoryCount: factoriesRes.success ? factoriesRes.data.length : 0,
          totalUsed: statsRes.success ? statsRes.data.totalUsed : 0,
          currentWeek: statsRes.success ? statsRes.data.currentWeek : '',
        });
      } else {
        const [rulesRes, globalRuleRes] = await Promise.all([
          platformAPI.getAllQuotaRules(),
          platformAPI.getGlobalDefaultQuotaRule(),
        ]);

        if (rulesRes.success) {
          setQuotaRules(rulesRes.data.filter((r) => r.factoryId !== null));
        }
        if (globalRuleRes.success) setGlobalRule(globalRuleRes.data);

        aiQuotaLogger.info('AI配额规则加载成功', {
          ruleCount: rulesRes.success ? rulesRes.data.length : 0,
          hasGlobalRule: globalRuleRes.success,
        });
      }
    } catch (error) {
      aiQuotaLogger.error('加载数据失败', error as Error);
      Alert.alert('错误', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEditQuota = (factoryId: string, currentQuota: number) => {
    setEditingFactory(factoryId);
    setEditQuota(currentQuota.toString());
  };

  const handleSaveQuota = async (factoryId: string) => {
    const newQuota = parseInt(editQuota);

    if (isNaN(newQuota) || newQuota < 0 || newQuota > 1000) {
      Alert.alert('错误', '配额应在0-1000之间');
      return;
    }

    try {
      const response = await platformAPI.updateFactoryAIQuota({
        factoryId,
        weeklyQuota: newQuota,
      });

      if (response.success) {
        aiQuotaLogger.info('AI配额更新成功', {
          factoryId,
          oldQuota: factories.find(f => f.id === factoryId)?.aiWeeklyQuota,
          newQuota,
        });
        Alert.alert('成功', '配额已更新');
        setEditingFactory(null);
        loadData(); // 重新加载数据
      }
    } catch (error) {
      aiQuotaLogger.error('保存配额失败', error as Error, {
        factoryId,
        newQuota,
      });
      Alert.alert('错误', '保存失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingFactory(null);
    setEditQuota('');
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return '#EF5350'; // 红色：高使用率
    if (utilization >= 50) return '#FFA726'; // 橙色：中等
    return '#66BB6A'; // 绿色：低使用率
  };

  // 规则管理函数
  const handleEditRule = (rule: AIQuotaRule) => {
    setEditingRule(rule.id || null);
    setEditRuleQuota(rule.weeklyQuota.toString());
    setEditRuleResetDay(rule.resetDayOfWeek.toString());
  };

  const handleSaveRule = async (ruleId: number) => {
    const newQuota = parseInt(editRuleQuota);
    const newResetDay = parseInt(editRuleResetDay);

    if (isNaN(newQuota) || newQuota < 0 || newQuota > 10000) {
      Alert.alert('错误', '配额应在0-10000之间');
      return;
    }

    try {
      const response = await platformAPI.updateQuotaRule(ruleId, {
        weeklyQuota: newQuota,
        resetDayOfWeek: newResetDay,
      });

      if (response.success) {
        Alert.alert('成功', '规则已更新');
        setEditingRule(null);
        loadData();
      }
    } catch (error) {
      aiQuotaLogger.error('保存规则失败', error as Error);
      Alert.alert('错误', '保存失败');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    Alert.alert('确认删除', '确定要删除这条配额规则吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await platformAPI.deleteQuotaRule(ruleId);
            Alert.alert('成功', '规则已删除');
            loadData();
          } catch (error) {
            aiQuotaLogger.error('删除规则失败', error as Error);
            Alert.alert('错误', '删除失败');
          }
        },
      },
    ]);
  };

  const handleSaveGlobalRule = async () => {
    if (!globalRule) return;

    const newQuota = parseInt(editRuleQuota);

    if (isNaN(newQuota) || newQuota < 0 || newQuota > 10000) {
      Alert.alert('错误', '配额应在0-10000之间');
      return;
    }

    try {
      const response = await platformAPI.createOrUpdateGlobalDefaultRule({
        weeklyQuota: newQuota,
        resetDayOfWeek: globalRule.resetDayOfWeek,
        enabled: true,
      });

      if (response.success) {
        Alert.alert('成功', '全局默认规则已更新');
        setEditingRule(null);
        loadData();
      }
    } catch (error) {
      aiQuotaLogger.error('保存全局规则失败', error as Error);
      Alert.alert('错误', '保存失败');
    }
  };

  const renderFactoryCard = (factory: FactoryAIQuota) => {
    const factoryStat = stats?.factories.find((f) => f.factoryId === factory.id);
    const isEditing = editingFactory === factory.id;
    const utilization = factoryStat ? parseFloat(factoryStat.utilization) : 0;

    return (
      <Card key={factory.id} style={styles.factoryCard} mode="elevated">
        <Card.Content>
          {/* 工厂名称 */}
          <View style={styles.factoryHeader}>
            <View style={styles.factoryNameContainer}>
              <List.Icon icon="factory" />
              <Text variant="titleMedium" style={styles.factoryName}>
                {factory.name}
              </Text>
            </View>
            {!isEditing && (
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => handleEditQuota(factory.id, factory.aiWeeklyQuota)}
              />
            )}
          </View>

          <Divider style={styles.cardDivider} />

          {/* 配额设置 */}
          <View style={styles.quotaSection}>
            <Text variant="bodyMedium" style={styles.sectionLabel}>
              每周配额
            </Text>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  mode="outlined"
                  value={editQuota}
                  onChangeText={setEditQuota}
                  keyboardType="numeric"
                  style={styles.quotaInput}
                  dense
                />
                <Text variant="bodyMedium">次/周</Text>
                <Button mode="contained" onPress={() => handleSaveQuota(factory.id)} compact>
                  保存
                </Button>
                <Button mode="text" onPress={handleCancelEdit} compact>
                  取消
                </Button>
              </View>
            ) : (
              <View style={styles.quotaDisplayRow}>
                <Text variant="headlineMedium" style={styles.quotaValueLarge}>
                  {factory.aiWeeklyQuota}
                </Text>
                <Text variant="bodyMedium" style={styles.quotaUnit}>
                  次/周
                </Text>
              </View>
            )}
          </View>

          {/* 使用情况 */}
          {factoryStat && (
            <>
              <Divider style={styles.cardDivider} />
              <View style={styles.usageSection}>
                <View style={styles.usageHeader}>
                  <Text variant="bodyMedium" style={styles.sectionLabel}>
                    本周使用
                  </Text>
                  <Text
                    variant="titleSmall"
                    style={{ color: getUtilizationColor(utilization) }}
                  >
                    {factoryStat.used}/{factoryStat.weeklyQuota} ({factoryStat.utilization}%)
                  </Text>
                </View>
                <ProgressBar
                  progress={utilization / 100}
                  color={getUtilizationColor(utilization)}
                  style={styles.progressBar}
                />
                <Text variant="bodySmall" style={styles.remainingText}>
                  剩余: {factoryStat.remaining}次
                </Text>
              </View>
            </>
          )}

          {/* 历史统计 */}
          <Divider style={styles.cardDivider} />
          <View style={styles.historySection}>
            <Text variant="bodySmall" style={styles.historyText}>
              历史总调用: {factory._count.aiUsageLogs}次
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading && factories.length === 0) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="AI配额管理" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载配额数据中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="AI配额管理" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      {/* Tab 选择器 */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as 'usage' | 'rules');
            setTimeout(() => loadData(), 100);
          }}
          buttons={[
            { value: 'usage', label: '使用概览', icon: 'chart-bar' },
            { value: 'rules', label: '规则配置', icon: 'cog' },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {activeTab === 'usage' ? (
          <>
            {/* 平台使用概览 */}
            {stats && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title="📊 平台使用概览" />
            <Card.Content>
              <View style={styles.overviewGrid}>
                <View style={styles.overviewItem}>
                  <Text variant="bodySmall" style={styles.overviewLabel}>
                    本周期
                  </Text>
                  <Text variant="titleMedium" style={styles.overviewValue}>
                    {stats.currentWeek}
                  </Text>
                </View>
                <View style={styles.overviewItem}>
                  <Text variant="bodySmall" style={styles.overviewLabel}>
                    总使用量
                  </Text>
                  <Text variant="titleMedium" style={styles.overviewValue}>
                    {stats.totalUsed}次
                  </Text>
                </View>
                <View style={styles.overviewItem}>
                  <Text variant="bodySmall" style={styles.overviewLabel}>
                    工厂数量
                  </Text>
                  <Text variant="titleMedium" style={styles.overviewValue}>
                    {stats.factories.length}个
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 工厂配额列表 */}
        <View style={styles.factoriesSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            🏭 工厂配额列表
          </Text>
          {factories.map(renderFactoryCard)}
        </View>

        {/* 配额建议 */}
        {stats && (
          <Card style={styles.tipsCard} mode="elevated">
            <Card.Title title="💡 配额建议" />
            <Card.Content>
              {stats.factories.map((factory) => {
                const util = parseFloat(factory.utilization);
                let suggestion = '';
                let icon = '';
                let color = '';

                if (util >= 90) {
                  suggestion = `${factory.factoryName}: 利用率${util}%，已达高峰，建议增加配额`;
                  icon = 'alert-circle';
                  color = '#EF5350';
                } else if (util >= 80) {
                  suggestion = `${factory.factoryName}: 利用率${util}%，接近上限，建议关注`;
                  icon = 'alert';
                  color = '#FFA726';
                } else if (util < 30 && factory.used > 0) {
                  suggestion = `${factory.factoryName}: 利用率${util}%，较低，可适当降低配额`;
                  icon = 'information';
                  color = '#66BB6A';
                }

                return suggestion ? (
                  <View key={factory.factoryId} style={styles.tipRow}>
                    <List.Icon icon={icon} color={color} />
                    <Text variant="bodySmall" style={[styles.tipText, { color }]}>
                      {suggestion}
                    </Text>
                  </View>
                ) : null;
              })}
            </Card.Content>
          </Card>
        )}

            <View style={styles.bottomPadding} />
          </>
        ) : (
          <>
            {/* 规则配置 Tab */}
            {/* 全局默认规则 */}
            {globalRule && (
              <Card style={styles.card} mode="elevated">
                <Card.Title title="🌍 全局默认规则" />
                <Card.Content>
                  <Text variant="bodySmall" style={styles.ruleDescription}>
                    适用于所有未配置特定规则的工厂
                  </Text>
                  <Divider style={styles.cardDivider} />
                  <View style={styles.ruleRow}>
                    <Text variant="bodyMedium">周配额:</Text>
                    {editingRule === 0 ? (
                      <View style={styles.editContainer}>
                        <TextInput
                          mode="outlined"
                          value={editRuleQuota}
                          onChangeText={setEditRuleQuota}
                          keyboardType="numeric"
                          style={styles.quotaInput}
                          dense
                        />
                        <Button mode="contained" onPress={handleSaveGlobalRule} compact>
                          保存
                        </Button>
                        <Button mode="text" onPress={() => setEditingRule(null)} compact>
                          取消
                        </Button>
                      </View>
                    ) : (
                      <View style={styles.quotaDisplayRow}>
                        <Text variant="titleMedium" style={styles.quotaValueLarge}>
                          {globalRule.weeklyQuota}
                        </Text>
                        <Text variant="bodyMedium">次/周</Text>
                        <IconButton
                          icon="pencil"
                          size={20}
                          onPress={() => {
                            setEditingRule(0);
                            setEditRuleQuota(globalRule.weeklyQuota.toString());
                          }}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.ruleRow}>
                    <Text variant="bodyMedium">重置周期:</Text>
                    <Chip>
                      {
                        ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
                          globalRule.resetDayOfWeek === 7 ? 0 : globalRule.resetDayOfWeek
                        ]
                      }
                    </Chip>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* 工厂特定规则 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title
                title="🏭 工厂特定规则"
                subtitle={`共${quotaRules.length}个工厂配置了特定规则`}
              />
              <Card.Content>
                {quotaRules.length === 0 ? (
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    暂无工厂特定规则，所有工厂使用全局默认规则
                  </Text>
                ) : (
                  quotaRules.map((rule) => (
                    <Card key={rule.id} style={styles.ruleCard} mode="outlined">
                      <Card.Content>
                        <View style={styles.ruleHeader}>
                          <Text variant="titleMedium" style={styles.factoryName}>
                            {rule.factoryName}
                          </Text>
                          {editingRule !== rule.id && (
                            <IconButton
                              icon="delete"
                              size={20}
                              onPress={() => rule.id && handleDeleteRule(rule.id)}
                            />
                          )}
                        </View>
                        <Divider style={styles.cardDivider} />
                        <View style={styles.ruleRow}>
                          <Text variant="bodyMedium">周配额:</Text>
                          {editingRule === rule.id ? (
                            <View style={styles.editContainer}>
                              <TextInput
                                mode="outlined"
                                value={editRuleQuota}
                                onChangeText={setEditRuleQuota}
                                keyboardType="numeric"
                                style={styles.quotaInput}
                                dense
                              />
                              <Button
                                mode="contained"
                                onPress={() => rule.id && handleSaveRule(rule.id)}
                                compact
                              >
                                保存
                              </Button>
                              <Button mode="text" onPress={() => setEditingRule(null)} compact>
                                取消
                              </Button>
                            </View>
                          ) : (
                            <View style={styles.quotaDisplayRow}>
                              <Text variant="titleMedium" style={styles.quotaValueLarge}>
                                {rule.weeklyQuota}
                              </Text>
                              <Text variant="bodyMedium">次/周</Text>
                              <IconButton
                                icon="pencil"
                                size={20}
                                onPress={() => handleEditRule(rule)}
                              />
                            </View>
                          )}
                        </View>
                        {rule.description && (
                          <Text variant="bodySmall" style={styles.ruleDescription}>
                            {rule.description}
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  ))
                )}
              </Card.Content>
            </Card>

            <View style={styles.bottomPadding} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },
  card: {
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewItem: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  overviewLabel: {
    color: '#757575',
    marginBottom: 4,
  },
  overviewValue: {
    fontWeight: '700',
    color: '#1976D2',
  },
  factoriesSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
    color: '#1976D2',
  },
  factoryCard: {
    marginBottom: 12,
  },
  factoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factoryNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  factoryName: {
    fontWeight: '600',
    marginLeft: 8,
  },
  cardDivider: {
    marginVertical: 12,
  },
  quotaSection: {
    marginVertical: 8,
  },
  sectionLabel: {
    color: '#757575',
    marginBottom: 8,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotaInput: {
    flex: 1,
    maxWidth: 100,
  },
  quotaDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  quotaValueLarge: {
    fontWeight: '700',
    color: '#1976D2',
  },
  quotaUnit: {
    color: '#757575',
  },
  usageSection: {
    marginVertical: 8,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  remainingText: {
    color: '#757575',
  },
  historySection: {
    marginTop: 4,
  },
  historyText: {
    color: '#9E9E9E',
  },
  tipsCard: {
    backgroundColor: '#FFF9C4',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 20,
  },
  tabContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  ruleCard: {
    marginBottom: 12,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  ruleDescription: {
    color: '#757575',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9E9E9E',
    padding: 20,
  },
});
