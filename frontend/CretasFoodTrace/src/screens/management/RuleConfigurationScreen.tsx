import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  Chip,
  List,
  FAB,
  Portal,
  Modal,
  TextInput,
  SegmentedButtons,
  ActivityIndicator,
  IconButton,
  Switch,
  Divider,
  Surface,
  Banner,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { logger } from '../../utils/logger';
import ruleConfigApiClient, {
  DroolsRule,
  StateMachineConfig,
  RuleGroup,
  EntityType,
  AIRuleParseResponse,
  AIStateMachineParseResponse,
  RuleEngineStatistics,
} from '../../services/api/ruleConfigApiClient';

const ruleLogger = logger.createContextLogger('RuleConfiguration');

/**
 * 规则组显示名称映射
 */
const RULE_GROUP_LABELS: Record<RuleGroup, string> = {
  validation: '验证规则',
  workflow: '工作流规则',
  costing: '成本规则',
  quality: '质检规则',
  alert: '告警规则',
};

/**
 * 规则组颜色映射
 */
const RULE_GROUP_COLORS: Record<RuleGroup, string> = {
  validation: '#2196F3',
  workflow: '#4CAF50',
  costing: '#FF9800',
  quality: '#9C27B0',
  alert: '#F44336',
};

/**
 * 实体类型显示名称映射
 */
const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  MaterialBatch: '原材料批次',
  ProcessingBatch: '生产批次',
  QualityInspection: '质量检验',
  Shipment: '出货记录',
  Equipment: '设备',
  DisposalRecord: '处置记录',
};

/**
 * 规则配置管理页面
 *
 * 功能：
 * - 查看和管理 Drools 规则
 * - AI 辅助生成规则（自然语言转 DRL）
 * - 状态机配置管理
 * - 规则测试
 */
export default function RuleConfigurationScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 标签页状态
  const [activeTab, setActiveTab] = useState<'rules' | 'stateMachines'>('rules');

  // 规则列表状态
  const [rules, setRules] = useState<DroolsRule[]>([]);
  const [stateMachines, setStateMachines] = useState<StateMachineConfig[]>([]);
  const [statistics, setStatistics] = useState<RuleEngineStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // AI 辅助对话框状态
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiDialogType, setAIDialogType] = useState<'rule' | 'stateMachine'>('rule');
  const [aiInput, setAIInput] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [aiResult, setAIResult] = useState<AIRuleParseResponse | AIStateMachineParseResponse | null>(null);

  // 规则详情对话框
  const [showRuleDetail, setShowRuleDetail] = useState(false);
  const [selectedRule, setSelectedRule] = useState<DroolsRule | null>(null);

  // 状态机详情对话框
  const [showStateMachineDetail, setShowStateMachineDetail] = useState(false);
  const [selectedStateMachine, setSelectedStateMachine] = useState<StateMachineConfig | null>(null);

  // 权限控制
  const roleCode = user?.factoryUser?.role || user?.roleCode || 'viewer';
  const canManage = ['factory_super_admin', 'department_admin'].includes(roleCode);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesData, stateMachinesData, statsData] = await Promise.all([
        ruleConfigApiClient.getRules({ page: 1, size: 100 }),
        ruleConfigApiClient.getStateMachines(),
        ruleConfigApiClient.getStatistics(),
      ]);

      setRules(rulesData.content || []);
      setStateMachines(stateMachinesData);
      setStatistics(statsData);

      ruleLogger.info('规则配置加载成功', {
        rulesCount: rulesData.content?.length || 0,
        stateMachinesCount: stateMachinesData.length,
      });
    } catch (error) {
      ruleLogger.error('加载规则配置失败', { error });
      Alert.alert('错误', '加载规则配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 打开 AI 对话框
  const openAIDialog = (type: 'rule' | 'stateMachine') => {
    setAIDialogType(type);
    setAIInput('');
    setAIResult(null);
    setShowAIDialog(true);
  };

  // AI 解析
  const handleAIParse = async () => {
    if (!aiInput.trim()) {
      Alert.alert('提示', '请输入描述');
      return;
    }

    setAILoading(true);
    try {
      if (aiDialogType === 'rule') {
        const result = await ruleConfigApiClient.parseRule({
          userInput: aiInput,
        });
        setAIResult(result);
        if (!result.success) {
          Alert.alert('解析失败', result.message);
        }
      } else {
        const result = await ruleConfigApiClient.parseStateMachine({
          userInput: aiInput,
          entityType: 'ProcessingBatch', // 默认实体类型
        });
        setAIResult(result);
        if (!result.success) {
          Alert.alert('解析失败', result.message);
        }
      }
    } catch (error) {
      ruleLogger.error('AI 解析失败', { error });
      Alert.alert('错误', 'AI 服务暂不可用');
    } finally {
      setAILoading(false);
    }
  };

  // 保存 AI 生成的规则
  const handleSaveAIResult = async () => {
    if (!aiResult || !('success' in aiResult) || !aiResult.success) {
      return;
    }

    try {
      if (aiDialogType === 'rule') {
        await ruleConfigApiClient.parseAndSaveRule({
          userInput: aiInput,
        });
        Alert.alert('成功', '规则已保存');
      } else {
        await ruleConfigApiClient.parseAndSaveStateMachine({
          userInput: aiInput,
          entityType: 'ProcessingBatch',
        });
        Alert.alert('成功', '状态机配置已保存');
      }
      setShowAIDialog(false);
      loadData();
    } catch (error) {
      ruleLogger.error('保存失败', { error });
      Alert.alert('错误', '保存失败');
    }
  };

  // 切换规则启用状态
  const handleToggleRule = async (rule: DroolsRule) => {
    try {
      await ruleConfigApiClient.toggleRuleEnabled(rule.id, !rule.enabled);
      loadData();
    } catch (error) {
      ruleLogger.error('切换规则状态失败', { error });
      Alert.alert('错误', '操作失败');
    }
  };

  // 删除规则
  const handleDeleteRule = (rule: DroolsRule) => {
    Alert.alert(
      '确认删除',
      `确定要删除规则「${rule.ruleName}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await ruleConfigApiClient.deleteRule(rule.id);
              loadData();
            } catch (error) {
              ruleLogger.error('删除规则失败', { error });
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  // 权限不足时显示
  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="规则配置" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管和部门管理员</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="规则配置" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      {/* Tab Selector */}
      <Surface style={styles.tabContainer} elevation={1}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'rules' | 'stateMachines')}
          buttons={[
            { value: 'rules', label: '业务规则', icon: 'code-braces' },
            { value: 'stateMachines', label: '状态机', icon: 'state-machine' },
          ]}
          style={styles.segmentedButtons}
        />
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 统计信息 */}
        {statistics && (
          <Card style={styles.statsCard}>
            <Card.Content>
              <Text style={styles.statsTitle}>规则引擎统计</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.totalRules}</Text>
                  <Text style={styles.statLabel}>总规则数</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.enabledRules}</Text>
                  <Text style={styles.statLabel}>已启用</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{statistics.stateMachines}</Text>
                  <Text style={styles.statLabel}>状态机</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : activeTab === 'rules' ? (
          /* 规则列表 */
          <>
            <Banner
              visible={true}
              icon="robot"
              style={styles.aiBanner}
              actions={[
                {
                  label: 'AI 创建规则',
                  onPress: () => openAIDialog('rule'),
                },
              ]}
            >
              使用自然语言描述业务规则，AI 自动生成 Drools DRL 代码
            </Banner>

            {rules.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Card.Content style={styles.emptyContent}>
                  <List.Icon icon="file-document-outline" color="#999" />
                  <Text style={styles.emptyText}>暂无规则配置</Text>
                  <Button
                    mode="contained"
                    onPress={() => openAIDialog('rule')}
                    style={styles.createButton}
                    icon="plus"
                  >
                    创建第一个规则
                  </Button>
                </Card.Content>
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} style={styles.ruleCard}>
                  <Card.Content>
                    <View style={styles.ruleHeader}>
                      <View style={styles.ruleInfo}>
                        <Text style={styles.ruleName}>{rule.ruleName}</Text>
                        <View style={styles.ruleChips}>
                          <Chip
                            mode="flat"
                            compact
                            style={[
                              styles.groupChip,
                              { backgroundColor: RULE_GROUP_COLORS[rule.ruleGroup] + '20' },
                            ]}
                            textStyle={{ color: RULE_GROUP_COLORS[rule.ruleGroup] }}
                          >
                            {RULE_GROUP_LABELS[rule.ruleGroup]}
                          </Chip>
                          <Chip mode="outlined" compact>
                            优先级: {rule.priority}
                          </Chip>
                        </View>
                      </View>
                      <Switch
                        value={rule.enabled}
                        onValueChange={() => handleToggleRule(rule)}
                      />
                    </View>
                    {rule.ruleDescription && (
                      <Text style={styles.ruleDescription}>{rule.ruleDescription}</Text>
                    )}
                  </Card.Content>
                  <Card.Actions>
                    <Button
                      onPress={() => {
                        setSelectedRule(rule);
                        setShowRuleDetail(true);
                      }}
                    >
                      查看详情
                    </Button>
                    <IconButton
                      icon="delete"
                      iconColor="#F44336"
                      onPress={() => handleDeleteRule(rule)}
                    />
                  </Card.Actions>
                </Card>
              ))
            )}
          </>
        ) : (
          /* 状态机列表 */
          <>
            <Banner
              visible={true}
              icon="robot"
              style={styles.aiBanner}
              actions={[
                {
                  label: 'AI 创建状态机',
                  onPress: () => openAIDialog('stateMachine'),
                },
              ]}
            >
              描述状态流转逻辑，AI 自动生成状态机配置
            </Banner>

            {stateMachines.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Card.Content style={styles.emptyContent}>
                  <List.Icon icon="state-machine" color="#999" />
                  <Text style={styles.emptyText}>暂无状态机配置</Text>
                  <Button
                    mode="contained"
                    onPress={() => openAIDialog('stateMachine')}
                    style={styles.createButton}
                    icon="plus"
                  >
                    创建状态机
                  </Button>
                </Card.Content>
              </Card>
            ) : (
              stateMachines.map((sm) => (
                <Card key={sm.id || sm.entityType} style={styles.ruleCard}>
                  <Card.Content>
                    <View style={styles.ruleHeader}>
                      <View style={styles.ruleInfo}>
                        <Text style={styles.ruleName}>{sm.machineName}</Text>
                        <View style={styles.ruleChips}>
                          <Chip mode="flat" compact>
                            {ENTITY_TYPE_LABELS[sm.entityType as EntityType] || sm.entityType}
                          </Chip>
                          <Chip mode="outlined" compact>
                            {sm.states?.length || 0} 个状态
                          </Chip>
                        </View>
                      </View>
                      <Switch value={sm.enabled} disabled />
                    </View>
                    {sm.machineDescription && (
                      <Text style={styles.ruleDescription}>{sm.machineDescription}</Text>
                    )}
                    <View style={styles.statesPreview}>
                      {sm.states?.slice(0, 5).map((state) => (
                        <Chip
                          key={state.code}
                          mode="outlined"
                          compact
                          style={[
                            styles.stateChip,
                            state.isFinal && styles.finalStateChip,
                          ]}
                        >
                          {state.name}
                        </Chip>
                      ))}
                      {(sm.states?.length || 0) > 5 && (
                        <Chip mode="outlined" compact>
                          +{sm.states!.length - 5}
                        </Chip>
                      )}
                    </View>
                  </Card.Content>
                  <Card.Actions>
                    <Button
                      onPress={() => {
                        setSelectedStateMachine(sm);
                        setShowStateMachineDetail(true);
                      }}
                    >
                      查看详情
                    </Button>
                  </Card.Actions>
                </Card>
              ))
            )}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* AI 对话框 */}
      <Portal>
        <Modal
          visible={showAIDialog}
          onDismiss={() => setShowAIDialog(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Text style={styles.modalTitle}>
              {aiDialogType === 'rule' ? 'AI 创建规则' : 'AI 创建状态机'}
            </Text>

            <TextInput
              label="用自然语言描述..."
              placeholder={
                aiDialogType === 'rule'
                  ? '例如: 库存低于500kg时通知采购部门'
                  : '例如: 质检单有待检、合格、不合格三个状态，不合格可以申请复检'
              }
              value={aiInput}
              onChangeText={setAIInput}
              multiline
              numberOfLines={4}
              style={styles.aiInput}
            />

            {aiLoading && (
              <View style={styles.aiLoadingContainer}>
                <ActivityIndicator />
                <Text style={styles.aiLoadingText}>AI 正在分析...</Text>
              </View>
            )}

            {aiResult && 'success' in aiResult && aiResult.success && (
              <Card style={styles.aiResultCard}>
                <Card.Content>
                  <Text style={styles.aiResultTitle}>AI 解析结果</Text>
                  {aiDialogType === 'rule' && 'ruleName' in aiResult && (
                    <>
                      <Text style={styles.aiResultLabel}>规则名称:</Text>
                      <Text style={styles.aiResultValue}>{aiResult.ruleName}</Text>
                      <Text style={styles.aiResultLabel}>规则组:</Text>
                      <Text style={styles.aiResultValue}>
                        {RULE_GROUP_LABELS[aiResult.ruleGroup as RuleGroup] || aiResult.ruleGroup}
                      </Text>
                      <Text style={styles.aiResultLabel}>AI 解释:</Text>
                      <Text style={styles.aiResultValue}>{aiResult.aiExplanation}</Text>
                    </>
                  )}
                  {aiDialogType === 'stateMachine' && 'machineName' in aiResult && (
                    <>
                      <Text style={styles.aiResultLabel}>状态机名称:</Text>
                      <Text style={styles.aiResultValue}>{aiResult.machineName}</Text>
                      <Text style={styles.aiResultLabel}>初始状态:</Text>
                      <Text style={styles.aiResultValue}>{aiResult.initialState}</Text>
                      <Text style={styles.aiResultLabel}>状态列表:</Text>
                      <View style={styles.statesPreview}>
                        {aiResult.states?.map((state) => (
                          <Chip key={state.code} mode="outlined" compact>
                            {state.name}
                          </Chip>
                        ))}
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}

            <View style={styles.modalActions}>
              <Button onPress={() => setShowAIDialog(false)}>取消</Button>
              {!aiResult || !('success' in aiResult) || !aiResult.success ? (
                <Button
                  mode="contained"
                  onPress={handleAIParse}
                  loading={aiLoading}
                  disabled={aiLoading || !aiInput.trim()}
                >
                  AI 解析
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={handleSaveAIResult}
                  icon="content-save"
                >
                  保存
                </Button>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* 规则详情对话框 */}
        <Modal
          visible={showRuleDetail}
          onDismiss={() => setShowRuleDetail(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedRule && (
            <ScrollView>
              <Text style={styles.modalTitle}>{selectedRule.ruleName}</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>规则组:</Text>
                <Chip
                  mode="flat"
                  style={[
                    styles.groupChip,
                    { backgroundColor: RULE_GROUP_COLORS[selectedRule.ruleGroup] + '20' },
                  ]}
                  textStyle={{ color: RULE_GROUP_COLORS[selectedRule.ruleGroup] }}
                >
                  {RULE_GROUP_LABELS[selectedRule.ruleGroup]}
                </Chip>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>优先级:</Text>
                <Text style={styles.detailValue}>{selectedRule.priority}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>状态:</Text>
                <Chip
                  mode="flat"
                  style={{
                    backgroundColor: selectedRule.enabled ? '#E8F5E9' : '#FFEBEE',
                  }}
                  textStyle={{
                    color: selectedRule.enabled ? '#4CAF50' : '#F44336',
                  }}
                >
                  {selectedRule.enabled ? '已启用' : '已禁用'}
                </Chip>
              </View>

              {selectedRule.ruleDescription && (
                <>
                  <Divider style={styles.divider} />
                  <Text style={styles.detailLabel}>描述:</Text>
                  <Text style={styles.detailDescription}>
                    {selectedRule.ruleDescription}
                  </Text>
                </>
              )}

              <Divider style={styles.divider} />
              <Text style={styles.detailLabel}>DRL 规则内容:</Text>
              <Surface style={styles.codeBlock} elevation={1}>
                <ScrollView horizontal>
                  <Text style={styles.codeText}>{selectedRule.ruleContent}</Text>
                </ScrollView>
              </Surface>

              <Button
                mode="text"
                onPress={() => setShowRuleDetail(false)}
                style={styles.closeButton}
              >
                关闭
              </Button>
            </ScrollView>
          )}
        </Modal>

        {/* 状态机详情对话框 */}
        <Modal
          visible={showStateMachineDetail}
          onDismiss={() => setShowStateMachineDetail(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedStateMachine && (
            <ScrollView>
              <Text style={styles.modalTitle}>{selectedStateMachine.machineName}</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>实体类型:</Text>
                <Chip mode="flat">
                  {ENTITY_TYPE_LABELS[selectedStateMachine.entityType as EntityType] ||
                    selectedStateMachine.entityType}
                </Chip>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>初始状态:</Text>
                <Text style={styles.detailValue}>{selectedStateMachine.initialState}</Text>
              </View>

              {selectedStateMachine.machineDescription && (
                <>
                  <Divider style={styles.divider} />
                  <Text style={styles.detailLabel}>描述:</Text>
                  <Text style={styles.detailDescription}>
                    {selectedStateMachine.machineDescription}
                  </Text>
                </>
              )}

              <Divider style={styles.divider} />
              <Text style={styles.detailLabel}>状态列表:</Text>
              <View style={styles.statesList}>
                {selectedStateMachine.states?.map((state) => (
                  <View key={state.code} style={styles.stateItem}>
                    <View
                      style={[
                        styles.stateColorDot,
                        { backgroundColor: state.color || '#757575' },
                      ]}
                    />
                    <View style={styles.stateInfo}>
                      <Text style={styles.stateName}>{state.name}</Text>
                      <Text style={styles.stateCode}>{state.code}</Text>
                    </View>
                    {state.isFinal && (
                      <Chip mode="outlined" compact>
                        终态
                      </Chip>
                    )}
                  </View>
                ))}
              </View>

              <Divider style={styles.divider} />
              <Text style={styles.detailLabel}>
                状态转换 ({selectedStateMachine.transitions?.length || 0}):
              </Text>
              {selectedStateMachine.transitions?.map((transition, index) => (
                <View key={index} style={styles.transitionItem}>
                  <Text style={styles.transitionText}>
                    {transition.fromState} → {transition.toState}
                  </Text>
                  <Text style={styles.transitionEvent}>
                    事件: {transition.event}
                  </Text>
                </View>
              ))}

              <Button
                mode="text"
                onPress={() => setShowStateMachineDetail(false)}
                style={styles.closeButton}
              >
                关闭
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => openAIDialog(activeTab === 'rules' ? 'rule' : 'stateMachine')}
        label={activeTab === 'rules' ? '新建规则' : '新建状态机'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContainer: {
    padding: 12,
    backgroundColor: '#fff',
  },
  segmentedButtons: {
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPermissionText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  noPermissionHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  aiBanner: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#E8F5E9',
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    marginBottom: 16,
  },
  createButton: {
    marginTop: 8,
  },
  ruleCard: {
    margin: 16,
    marginBottom: 8,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ruleInfo: {
    flex: 1,
    marginRight: 12,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 8,
  },
  ruleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    marginRight: 8,
  },
  ruleDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    lineHeight: 20,
  },
  statesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  stateChip: {
    marginRight: 4,
  },
  finalStateChip: {
    borderColor: '#4CAF50',
  },
  bottomPadding: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  aiInput: {
    marginBottom: 16,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  aiLoadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  aiResultCard: {
    marginBottom: 16,
    backgroundColor: '#E3F2FD',
  },
  aiResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1976D2',
  },
  aiResultLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  aiResultValue: {
    fontSize: 14,
    color: '#212121',
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  detailValue: {
    fontSize: 14,
    color: '#212121',
  },
  detailDescription: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 20,
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  codeBlock: {
    backgroundColor: '#263238',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#E8E8E8',
    lineHeight: 18,
  },
  closeButton: {
    marginTop: 16,
  },
  statesList: {
    marginTop: 8,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stateColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  stateInfo: {
    flex: 1,
  },
  stateName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  stateCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  transitionItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  transitionText: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  transitionEvent: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
