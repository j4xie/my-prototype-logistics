/**
 * AI 意图配置详情页面
 *
 * 功能：
 * - 显示意图基本信息
 * - 编辑参数配置
 * - 编辑规则配置
 * - 测试意图执行
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  TextInput,
  Switch,
  IconButton,
  Divider,
  Portal,
  Modal,
  SegmentedButtons,
  List,
  ActivityIndicator,
  FAB,
  Menu,
  Surface,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import type { FAManagementStackParamList } from '../../../types/navigation';
import intentConfigApiClient, {
  AIIntentConfig,
  IntentRule,
  IntentParameter,
  IntentTestResult,
  SensitivityLevel,
  IntentCategory,
  ParameterDataType,
} from '../../../services/api/intentConfigApiClient';

// 导航类型
type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'IntentConfigDetail'>;
type RouteType = RouteProp<FAManagementStackParamList, 'IntentConfigDetail'>;

// 分类配置
const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ANALYSIS: { label: '分析类', color: '#1890ff', icon: 'chart-line' },
  DATA_OP: { label: '数据操作', color: '#52c41a', icon: 'database-edit' },
  FORM: { label: '表单类', color: '#722ed1', icon: 'form-select' },
  SCHEDULE: { label: '排程类', color: '#fa8c16', icon: 'calendar-clock' },
  SYSTEM: { label: '系统类', color: '#8c8c8c', icon: 'cog' },
  QUERY: { label: '查询类', color: '#13c2c2', icon: 'magnify' },
  EQUIPMENT: { label: '设备类', color: '#eb2f96', icon: 'chip' },
  HR: { label: '人事类', color: '#f5222d', icon: 'badge-account' },
};

// 敏感度配置
const SENSITIVITY_CONFIG: Record<SensitivityLevel, { label: string; color: string }> = {
  LOW: { label: '低', color: '#52c41a' },
  MEDIUM: { label: '中', color: '#fa8c16' },
  HIGH: { label: '高', color: '#f5222d' },
  CRITICAL: { label: '严重', color: '#722ed1' },
};

// 规则类型配置
const RULE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  REGEX: { label: '正则表达式', color: '#1890ff' },
  KEYWORD: { label: '关键词', color: '#52c41a' },
  CONDITION: { label: '条件判断', color: '#fa8c16' },
  SCRIPT: { label: '脚本', color: '#722ed1' },
};

// 参数类型配置
const PARAMETER_TYPE_CONFIG: Record<ParameterDataType, { label: string; color: string }> = {
  STRING: { label: '字符串', color: '#1890ff' },
  NUMBER: { label: '数字', color: '#52c41a' },
  BOOLEAN: { label: '布尔值', color: '#fa8c16' },
  DATE: { label: '日期', color: '#722ed1' },
  DATETIME: { label: '日期时间', color: '#eb2f96' },
  ENUM: { label: '枚举', color: '#13c2c2' },
  ARRAY: { label: '数组', color: '#f5222d' },
  OBJECT: { label: '对象', color: '#8c8c8c' },
};

// Tab 类型
type TabType = 'basic' | 'parameters' | 'rules' | 'test';

export function IntentConfigDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { t } = useTranslation('home');
  const { user } = useAuthStore();
  const factoryId = user?.factoryId ?? '';

  const { intentCode } = route.params;

  // 状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  // 数据状态
  const [intentConfig, setIntentConfig] = useState<AIIntentConfig | null>(null);
  const [parameters, setParameters] = useState<IntentParameter[]>([]);
  const [rules, setRules] = useState<IntentRule[]>([]);

  // 编辑状态
  const [editedConfig, setEditedConfig] = useState<Partial<AIIntentConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // 测试状态
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<IntentTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // 模态框状态
  const [parameterModalVisible, setParameterModalVisible] = useState(false);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingParameter, setEditingParameter] = useState<IntentParameter | null>(null);
  const [editingRule, setEditingRule] = useState<IntentRule | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [configData, paramsData, rulesData] = await Promise.all([
        intentConfigApiClient.getIntent(intentCode, factoryId),
        intentConfigApiClient.getIntentParameters(intentCode, factoryId).catch(() => []),
        intentConfigApiClient.getIntentRules(intentCode, factoryId).catch(() => []),
      ]);

      if (configData) {
        setIntentConfig(configData);
        setEditedConfig({
          intentName: configData.intentName,
          description: configData.description,
          priority: configData.priority,
          sensitivityLevel: configData.sensitivityLevel,
          enabled: configData.enabled,
          keywords: configData.keywords,
          regexPatterns: configData.regexPatterns,
        });
      }
      setParameters(paramsData);
      setRules(rulesData);
    } catch (error) {
      console.error('加载意图配置失败:', error);
      Alert.alert('加载失败', '无法加载意图配置详情');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [intentCode, factoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 保存基本配置
  const handleSaveBasic = async () => {
    if (!intentConfig) return;

    try {
      setSaving(true);
      await intentConfigApiClient.updateIntent(intentCode, editedConfig, factoryId);
      Alert.alert('保存成功', '意图配置已更新');
      setHasChanges(false);
      loadData();
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert('保存失败', '无法保存意图配置');
    } finally {
      setSaving(false);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async () => {
    if (!intentConfig) return;

    try {
      await intentConfigApiClient.setIntentActive(intentCode, !intentConfig.enabled, factoryId);
      loadData();
    } catch (error) {
      console.error('切换状态失败:', error);
      Alert.alert('操作失败', '无法切换启用状态');
    }
  };

  // 执行测试
  const handleTest = async () => {
    if (!testInput.trim()) {
      Alert.alert('请输入测试文本');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const result = await intentConfigApiClient.testIntent(intentCode, testInput, factoryId);
      setTestResult(result);
    } catch (error) {
      console.error('测试失败:', error);
      Alert.alert('测试失败', '意图测试执行失败');
    } finally {
      setTesting(false);
    }
  };

  // 保存参数
  const handleSaveParameter = async (parameter: IntentParameter) => {
    try {
      const updatedParams = editingParameter
        ? parameters.map(p => p.id === editingParameter.id ? parameter : p)
        : [...parameters, { ...parameter, sortOrder: parameters.length }];

      await intentConfigApiClient.updateIntentParameters(intentCode, updatedParams, factoryId);
      setParameterModalVisible(false);
      setEditingParameter(null);
      loadData();
      Alert.alert('保存成功', '参数配置已更新');
    } catch (error) {
      console.error('保存参数失败:', error);
      Alert.alert('保存失败', '无法保存参数配置');
    }
  };

  // 删除参数
  const handleDeleteParameter = (param: IntentParameter) => {
    Alert.alert('确认删除', `确定要删除参数 "${param.displayName}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const updatedParams = parameters.filter(p => p.id !== param.id);
            await intentConfigApiClient.updateIntentParameters(intentCode, updatedParams, factoryId);
            loadData();
          } catch (error) {
            console.error('删除参数失败:', error);
            Alert.alert('删除失败', '无法删除参数');
          }
        },
      },
    ]);
  };

  // 保存规则
  const handleSaveRule = async (rule: IntentRule) => {
    try {
      const updatedRules = editingRule
        ? rules.map(r => r.id === editingRule.id ? rule : r)
        : [...rules, { ...rule, priority: rules.length }];

      await intentConfigApiClient.updateIntentRules(intentCode, updatedRules, factoryId);
      setRuleModalVisible(false);
      setEditingRule(null);
      loadData();
      Alert.alert('保存成功', '规则配置已更新');
    } catch (error) {
      console.error('保存规则失败:', error);
      Alert.alert('保存失败', '无法保存规则配置');
    }
  };

  // 删除规则
  const handleDeleteRule = (rule: IntentRule) => {
    Alert.alert('确认删除', `确定要删除规则 "${rule.ruleName}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const updatedRules = rules.filter(r => r.id !== rule.id);
            await intentConfigApiClient.updateIntentRules(intentCode, updatedRules, factoryId);
            loadData();
          } catch (error) {
            console.error('删除规则失败:', error);
            Alert.alert('删除失败', '无法删除规则');
          }
        },
      },
    ]);
  };

  // 更新编辑配置
  const updateEditedConfig = (key: keyof AIIntentConfig, value: unknown) => {
    setEditedConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // 渲染基本信息 Tab
  const renderBasicTab = () => {
    if (!intentConfig) return null;

    const categoryConfig = CATEGORY_CONFIG[intentConfig.intentCategory] || { label: intentConfig.intentCategory, color: '#8c8c8c', icon: 'help-circle' };
    const sensitivityConfig = SENSITIVITY_CONFIG[intentConfig.sensitivityLevel] || { label: '未知', color: '#8c8c8c' };

    return (
      <ScrollView style={styles.tabContent}>
        {/* 基本信息卡片 */}
        <Card style={styles.card}>
          <Card.Title
            title="基本信息"
            left={(props) => <IconButton {...props} icon="information" />}
          />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.label}>意图代码</Text>
              <Text style={styles.codeValue}>{intentConfig.intentCode}</Text>
            </View>

            <Divider style={styles.divider} />

            <TextInput
              label="意图名称"
              value={editedConfig.intentName || ''}
              onChangeText={(text) => updateEditedConfig('intentName', text)}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="描述"
              value={editedConfig.description || ''}
              onChangeText={(text) => updateEditedConfig('description', text)}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            <View style={styles.infoRow}>
              <Text style={styles.label}>分类</Text>
              <Chip
                style={[styles.categoryChip, { backgroundColor: categoryConfig.color + '20' }]}
                textStyle={{ color: categoryConfig.color }}
                icon={categoryConfig.icon}
              >
                {categoryConfig.label}
              </Chip>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.label}>敏感度</Text>
              <Chip
                style={[styles.sensitivityChip, { backgroundColor: sensitivityConfig.color + '20' }]}
                textStyle={{ color: sensitivityConfig.color }}
              >
                {sensitivityConfig.label}
              </Chip>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.label}>优先级</Text>
              <TextInput
                value={String(editedConfig.priority || 50)}
                onChangeText={(text) => updateEditedConfig('priority', parseInt(text) || 50)}
                style={styles.priorityInput}
                mode="outlined"
                keyboardType="numeric"
                dense
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>启用状态</Text>
                <Text style={styles.hint}>控制意图是否可被识别和执行</Text>
              </View>
              <Switch
                value={intentConfig.enabled}
                onValueChange={handleToggleEnabled}
              />
            </View>
          </Card.Content>
        </Card>

        {/* 关键词卡片 */}
        <Card style={styles.card}>
          <Card.Title
            title="匹配关键词"
            subtitle={`${intentConfig.keywords?.length || 0} 个关键词`}
            left={(props) => <IconButton {...props} icon="tag-multiple" />}
          />
          <Card.Content>
            <View style={styles.keywordsContainer}>
              {intentConfig.keywords?.map((keyword, index) => (
                <Chip
                  key={index}
                  style={styles.keywordChip}
                  onClose={() => {
                    const newKeywords = intentConfig.keywords.filter((_, i) => i !== index);
                    updateEditedConfig('keywords', newKeywords);
                  }}
                >
                  {keyword}
                </Chip>
              ))}
            </View>
            <TextInput
              label="添加关键词"
              placeholder="输入后按回车添加"
              style={styles.input}
              mode="outlined"
              dense
              onSubmitEditing={(e) => {
                const text = e.nativeEvent.text.trim();
                if (text && !intentConfig.keywords?.includes(text)) {
                  updateEditedConfig('keywords', [...(intentConfig.keywords || []), text]);
                }
              }}
            />
          </Card.Content>
        </Card>

        {/* 正则表达式卡片 */}
        <Card style={styles.card}>
          <Card.Title
            title="匹配正则"
            subtitle={`${intentConfig.regexPatterns?.length || 0} 个正则表达式`}
            left={(props) => <IconButton {...props} icon="regex" />}
          />
          <Card.Content>
            {intentConfig.regexPatterns?.map((pattern, index) => (
              <View key={index} style={styles.regexRow}>
                <Text style={styles.regexText} numberOfLines={1}>
                  {pattern}
                </Text>
                <IconButton
                  icon="close"
                  size={16}
                  onPress={() => {
                    const newPatterns = intentConfig.regexPatterns.filter((_, i) => i !== index);
                    updateEditedConfig('regexPatterns', newPatterns);
                  }}
                />
              </View>
            ))}
            <TextInput
              label="添加正则表达式"
              placeholder="输入正则表达式"
              style={styles.input}
              mode="outlined"
              dense
              onSubmitEditing={(e) => {
                const text = e.nativeEvent.text.trim();
                if (text) {
                  updateEditedConfig('regexPatterns', [...(intentConfig.regexPatterns || []), text]);
                }
              }}
            />
          </Card.Content>
        </Card>

        {hasChanges && (
          <Button
            mode="contained"
            onPress={handleSaveBasic}
            loading={saving}
            style={styles.saveButton}
          >
            保存更改
          </Button>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  // 渲染参数 Tab
  const renderParametersTab = () => (
    <View style={styles.tabContent}>
      <ScrollView>
        {parameters.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <IconButton icon="format-list-bulleted" size={48} />
              <Text style={styles.emptyText}>暂无参数配置</Text>
              <Text style={styles.emptyHint}>点击右下角按钮添加参数</Text>
            </Card.Content>
          </Card>
        ) : (
          parameters.map((param) => (
            <Card key={param.id} style={styles.itemCard}>
              <Card.Content>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{param.displayName}</Text>
                    <Text style={styles.itemCode}>{param.parameterName}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => {
                        setEditingParameter(param);
                        setParameterModalVisible(true);
                      }}
                    />
                    <IconButton
                      icon="delete"
                      size={20}
                      iconColor="#f5222d"
                      onPress={() => handleDeleteParameter(param)}
                    />
                  </View>
                </View>

                <View style={styles.itemTags}>
                  <Chip
                    compact
                    style={[styles.typeChip, { backgroundColor: (PARAMETER_TYPE_CONFIG[param.dataType]?.color || '#8c8c8c') + '20' }]}
                    textStyle={{ color: PARAMETER_TYPE_CONFIG[param.dataType]?.color || '#8c8c8c', fontSize: 11 }}
                  >
                    {PARAMETER_TYPE_CONFIG[param.dataType]?.label || param.dataType}
                  </Chip>
                  {param.required && (
                    <Chip compact style={styles.requiredChip} textStyle={styles.requiredChipText}>
                      必填
                    </Chip>
                  )}
                  {!param.enabled && (
                    <Chip compact style={styles.disabledChip} textStyle={styles.disabledChipText}>
                      已禁用
                    </Chip>
                  )}
                </View>

                {param.description && (
                  <Text style={styles.itemDescription}>{param.description}</Text>
                )}

                {param.defaultValue && (
                  <Text style={styles.defaultValue}>默认值: {param.defaultValue}</Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setEditingParameter(null);
          setParameterModalVisible(true);
        }}
      />
    </View>
  );

  // 渲染规则 Tab
  const renderRulesTab = () => (
    <View style={styles.tabContent}>
      <ScrollView>
        {rules.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <IconButton icon="script-text" size={48} />
              <Text style={styles.emptyText}>暂无规则配置</Text>
              <Text style={styles.emptyHint}>点击右下角按钮添加规则</Text>
            </Card.Content>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} style={styles.itemCard}>
              <Card.Content>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{rule.ruleName}</Text>
                    <Text style={styles.itemCode}>优先级: {rule.priority}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => {
                        setEditingRule(rule);
                        setRuleModalVisible(true);
                      }}
                    />
                    <IconButton
                      icon="delete"
                      size={20}
                      iconColor="#f5222d"
                      onPress={() => handleDeleteRule(rule)}
                    />
                  </View>
                </View>

                <View style={styles.itemTags}>
                  <Chip
                    compact
                    style={[styles.typeChip, { backgroundColor: (RULE_TYPE_CONFIG[rule.ruleType]?.color || '#8c8c8c') + '20' }]}
                    textStyle={{ color: RULE_TYPE_CONFIG[rule.ruleType]?.color || '#8c8c8c', fontSize: 11 }}
                  >
                    {RULE_TYPE_CONFIG[rule.ruleType]?.label || rule.ruleType}
                  </Chip>
                  {!rule.enabled && (
                    <Chip compact style={styles.disabledChip} textStyle={styles.disabledChipText}>
                      已禁用
                    </Chip>
                  )}
                </View>

                <View style={styles.ruleExpressionBox}>
                  <Text style={styles.ruleExpression} numberOfLines={3}>
                    {rule.ruleExpression}
                  </Text>
                </View>

                {rule.description && (
                  <Text style={styles.itemDescription}>{rule.description}</Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setEditingRule(null);
          setRuleModalVisible(true);
        }}
      />
    </View>
  );

  // 渲染测试 Tab
  const renderTestTab = () => (
    <KeyboardAvoidingView
      style={styles.tabContent}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView>
        <Card style={styles.card}>
          <Card.Title
            title="意图测试"
            subtitle="输入测试文本验证意图匹配"
            left={(props) => <IconButton {...props} icon="play-circle" />}
          />
          <Card.Content>
            <TextInput
              label="测试输入"
              placeholder="输入要测试的文本..."
              value={testInput}
              onChangeText={setTestInput}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={3}
            />
            <Button
              mode="contained"
              onPress={handleTest}
              loading={testing}
              disabled={!testInput.trim()}
              style={styles.testButton}
              icon="play"
            >
              执行测试
            </Button>
          </Card.Content>
        </Card>

        {testResult && (
          <Card style={styles.resultCard}>
            <Card.Title
              title="测试结果"
              left={(props) => (
                <IconButton
                  {...props}
                  icon={testResult.matched ? 'check-circle' : 'close-circle'}
                  iconColor={testResult.matched ? '#52c41a' : '#f5222d'}
                />
              )}
            />
            <Card.Content>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>匹配状态</Text>
                <Chip
                  style={[
                    styles.resultChip,
                    { backgroundColor: testResult.matched ? '#f6ffed' : '#fff1f0' },
                  ]}
                  textStyle={{ color: testResult.matched ? '#52c41a' : '#f5222d' }}
                >
                  {testResult.matched ? '匹配成功' : '未匹配'}
                </Chip>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>置信度</Text>
                <View style={styles.confidenceContainer}>
                  <ProgressBar
                    progress={testResult.confidence}
                    color={testResult.confidence > 0.7 ? '#52c41a' : testResult.confidence > 0.4 ? '#fa8c16' : '#f5222d'}
                    style={styles.confidenceBar}
                  />
                  <Text style={styles.confidenceValue}>
                    {(testResult.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>匹配方法</Text>
                <Chip compact>{testResult.matchMethod}</Chip>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>执行耗时</Text>
                <Text style={styles.resultValue}>{testResult.executionTimeMs}ms</Text>
              </View>

              {testResult.matchedKeywords && testResult.matchedKeywords.length > 0 && (
                <>
                  <Divider style={styles.divider} />
                  <Text style={styles.resultLabel}>匹配关键词</Text>
                  <View style={styles.keywordsContainer}>
                    {testResult.matchedKeywords.map((kw, index) => (
                      <Chip key={index} compact style={styles.matchedKeywordChip}>
                        {kw}
                      </Chip>
                    ))}
                  </View>
                </>
              )}

              {testResult.extractedParameters && Object.keys(testResult.extractedParameters).length > 0 && (
                <>
                  <Divider style={styles.divider} />
                  <Text style={styles.resultLabel}>提取参数</Text>
                  <View style={styles.paramsContainer}>
                    {Object.entries(testResult.extractedParameters).map(([key, value]) => (
                      <View key={key} style={styles.paramRow}>
                        <Text style={styles.paramKey}>{key}:</Text>
                        <Text style={styles.paramValue}>{String(value)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {testResult.executionResult && (
                <>
                  <Divider style={styles.divider} />
                  <Text style={styles.resultLabel}>执行结果</Text>
                  <Surface style={styles.executionResultBox}>
                    <Text style={styles.executionResultText}>
                      {testResult.executionResult.message || JSON.stringify(testResult.executionResult.data, null, 2)}
                    </Text>
                  </Surface>
                </>
              )}

              {testResult.errorMessage && (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.errorBox}>
                    <IconButton icon="alert-circle" size={16} iconColor="#f5222d" />
                    <Text style={styles.errorText}>{testResult.errorMessage}</Text>
                  </View>
                </>
              )}
            </Card.Content>
          </Card>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // 渲染参数编辑模态框
  const renderParameterModal = () => {
    const [formData, setFormData] = useState<Partial<IntentParameter>>(
      editingParameter || {
        parameterName: '',
        displayName: '',
        dataType: 'STRING',
        required: false,
        enabled: true,
        sortOrder: parameters.length,
      }
    );

    useEffect(() => {
      setFormData(
        editingParameter || {
          parameterName: '',
          displayName: '',
          dataType: 'STRING',
          required: false,
          enabled: true,
          sortOrder: parameters.length,
        }
      );
    }, [editingParameter, parameterModalVisible]);

    return (
      <Portal>
        <Modal
          visible={parameterModalVisible}
          onDismiss={() => {
            setParameterModalVisible(false);
            setEditingParameter(null);
          }}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              {editingParameter ? '编辑参数' : '添加参数'}
            </Text>

            <TextInput
              label="参数名称 *"
              value={formData.parameterName || ''}
              onChangeText={(text) => setFormData({ ...formData, parameterName: text })}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="显示名称 *"
              value={formData.displayName || ''}
              onChangeText={(text) => setFormData({ ...formData, displayName: text })}
              style={styles.input}
              mode="outlined"
            />

            <Text style={styles.sectionLabel}>数据类型</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {Object.entries(PARAMETER_TYPE_CONFIG).map(([type, config]) => (
                <Chip
                  key={type}
                  selected={formData.dataType === type}
                  onPress={() => setFormData({ ...formData, dataType: type as ParameterDataType })}
                  style={styles.selectionChip}
                >
                  {config.label}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="描述"
              value={formData.description || ''}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              style={styles.input}
              mode="outlined"
              multiline
            />

            <TextInput
              label="默认值"
              value={formData.defaultValue || ''}
              onChangeText={(text) => setFormData({ ...formData, defaultValue: text })}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label="验证规则"
              value={formData.validationRule || ''}
              onChangeText={(text) => setFormData({ ...formData, validationRule: text })}
              style={styles.input}
              mode="outlined"
              placeholder="例如: ^[a-zA-Z]+$"
            />

            <List.Item
              title="必填参数"
              right={() => (
                <Switch
                  value={formData.required || false}
                  onValueChange={(value) => setFormData({ ...formData, required: value })}
                />
              )}
            />

            <List.Item
              title="启用"
              right={() => (
                <Switch
                  value={formData.enabled !== false}
                  onValueChange={(value) => setFormData({ ...formData, enabled: value })}
                />
              )}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => {
                  setParameterModalVisible(false);
                  setEditingParameter(null);
                }}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSaveParameter(formData as IntentParameter)}
                disabled={!formData.parameterName || !formData.displayName}
              >
                保存
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  // 渲染规则编辑模态框
  const renderRuleModal = () => {
    const [formData, setFormData] = useState<Partial<IntentRule>>(
      editingRule || {
        ruleName: '',
        ruleType: 'KEYWORD',
        ruleExpression: '',
        priority: rules.length,
        enabled: true,
      }
    );

    useEffect(() => {
      setFormData(
        editingRule || {
          ruleName: '',
          ruleType: 'KEYWORD',
          ruleExpression: '',
          priority: rules.length,
          enabled: true,
        }
      );
    }, [editingRule, ruleModalVisible]);

    return (
      <Portal>
        <Modal
          visible={ruleModalVisible}
          onDismiss={() => {
            setRuleModalVisible(false);
            setEditingRule(null);
          }}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              {editingRule ? '编辑规则' : '添加规则'}
            </Text>

            <TextInput
              label="规则名称 *"
              value={formData.ruleName || ''}
              onChangeText={(text) => setFormData({ ...formData, ruleName: text })}
              style={styles.input}
              mode="outlined"
            />

            <Text style={styles.sectionLabel}>规则类型</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {Object.entries(RULE_TYPE_CONFIG).map(([type, config]) => (
                <Chip
                  key={type}
                  selected={formData.ruleType === type}
                  onPress={() => setFormData({ ...formData, ruleType: type as IntentRule['ruleType'] })}
                  style={styles.selectionChip}
                >
                  {config.label}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="规则表达式 *"
              value={formData.ruleExpression || ''}
              onChangeText={(text) => setFormData({ ...formData, ruleExpression: text })}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder={
                formData.ruleType === 'REGEX'
                  ? '输入正则表达式，如: ^查询(.+)批次$'
                  : formData.ruleType === 'KEYWORD'
                    ? '输入关键词，多个用逗号分隔'
                    : '输入规则表达式'
              }
            />

            <TextInput
              label="优先级"
              value={String(formData.priority || 0)}
              onChangeText={(text) => setFormData({ ...formData, priority: parseInt(text) || 0 })}
              style={styles.input}
              mode="outlined"
              keyboardType="numeric"
            />

            <TextInput
              label="描述"
              value={formData.description || ''}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              style={styles.input}
              mode="outlined"
              multiline
            />

            <List.Item
              title="启用"
              right={() => (
                <Switch
                  value={formData.enabled !== false}
                  onValueChange={(value) => setFormData({ ...formData, enabled: value })}
                />
              )}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => {
                  setRuleModalVisible(false);
                  setEditingRule(null);
                }}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSaveRule(formData as IntentRule)}
                disabled={!formData.ruleName || !formData.ruleExpression}
              >
                保存
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (!intentConfig) {
    return (
      <View style={styles.errorContainer}>
        <IconButton icon="alert-circle" size={48} iconColor="#f5222d" />
        <Text style={styles.errorText}>意图配置不存在</Text>
        <Button mode="outlined" onPress={() => navigation.goBack()}>
          返回
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab 选择器 */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        buttons={[
          { value: 'basic', label: '基本信息', icon: 'information' },
          { value: 'parameters', label: '参数', icon: 'format-list-bulleted' },
          { value: 'rules', label: '规则', icon: 'script-text' },
          { value: 'test', label: '测试', icon: 'play-circle' },
        ]}
        style={styles.tabSelector}
      />

      {/* Tab 内容 */}
      <View style={styles.tabContainer}>
        {activeTab === 'basic' && renderBasicTab()}
        {activeTab === 'parameters' && renderParametersTab()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'test' && renderTestTab()}
      </View>

      {/* 模态框 */}
      {renderParameterModal()}
      {renderRuleModal()}
    </View>
  );
}

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginVertical: 12,
    color: '#f5222d',
  },
  tabSelector: {
    margin: 16,
    marginBottom: 0,
  },
  tabContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  codeValue: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#1890ff',
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  priorityInput: {
    width: 80,
  },
  divider: {
    marginVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  categoryChip: {
    height: 32,
  },
  sensitivityChip: {
    height: 32,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  keywordChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  regexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
    paddingLeft: 12,
  },
  regexText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#722ed1',
  },
  saveButton: {
    margin: 16,
  },
  emptyCard: {
    margin: 16,
    marginTop: 60,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  itemCard: {
    margin: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  itemCode: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  itemActions: {
    flexDirection: 'row',
  },
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  typeChip: {
    height: 24,
  },
  requiredChip: {
    height: 24,
    backgroundColor: '#fff1f0',
  },
  requiredChipText: {
    fontSize: 11,
    color: '#f5222d',
  },
  disabledChip: {
    height: 24,
    backgroundColor: '#f0f0f0',
  },
  disabledChipText: {
    fontSize: 11,
    color: '#999',
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  defaultValue: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  ruleExpressionBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  ruleExpression: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1890ff',
  },
  testButton: {
    marginTop: 8,
  },
  resultCard: {
    margin: 16,
    marginTop: 0,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultChip: {
    height: 28,
  },
  confidenceContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  confidenceValue: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 50,
    textAlign: 'right',
  },
  matchedKeywordChip: {
    backgroundColor: '#e6f7ff',
    marginRight: 4,
    marginTop: 8,
  },
  paramsContainer: {
    marginTop: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  paramRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  paramKey: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginRight: 8,
  },
  paramValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  executionResultBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  executionResultText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#f5222d',
  },
  modal: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  chipRow: {
    marginBottom: 12,
  },
  selectionChip: {
    marginRight: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  bottomPadding: {
    height: 80,
  },
});

export default IntentConfigDetailScreen;
