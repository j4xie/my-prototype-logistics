/**
 * 编码规则详情/编辑页面
 *
 * 功能:
 * - 显示编码规则基本信息
 * - 编辑规则名称和描述
 * - 配置编码组成部分（前缀、日期格式、序号长度等）
 * - 预览生成的编码样例
 * - 测试编码生成
 * - 启用/禁用规则
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Icon,
  ActivityIndicator,
  Chip,
  Button,
  Divider,
  TextInput,
  Switch,
  SegmentedButtons,
  Surface,
  Portal,
  Dialog,
  IconButton,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { FAManagementStackParamList } from '../../../types/navigation';
import {
  encodingRuleApiClient,
  EncodingRule,
  EncodingEntityType,
  ResetCycle,
  UpdateEncodingRuleRequest,
  PlaceholderInfo,
  EntityTypeInfo,
} from '../../../services/api/encodingRuleApiClient';
import { useAuthStore } from '../../../store/authStore';
import { getFactoryId } from '../../../types/auth';
import { logger } from '../../../utils/logger';

const configLogger = logger.createContextLogger('CodeRuleDetail');

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'CodeRuleDetail'>;
type RouteProps = RouteProp<FAManagementStackParamList, 'CodeRuleDetail'>;

type TabType = 'info' | 'config' | 'test';

// 重置周期选项
const RESET_CYCLE_OPTIONS: { value: ResetCycle; label: string; labelEn: string }[] = [
  { value: 'DAILY', label: '每日', labelEn: 'Daily' },
  { value: 'MONTHLY', label: '每月', labelEn: 'Monthly' },
  { value: 'YEARLY', label: '每年', labelEn: 'Yearly' },
  { value: 'NEVER', label: '永不', labelEn: 'Never' },
];

export function CodeRuleDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { ruleId, isNew } = route.params;
  const { t, i18n } = useTranslation('home');
  const isZh = i18n.language.startsWith('zh');
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  // 状态
  const [loading, setLoading] = useState(!isNew);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<EncodingRule | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityTypeInfo[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [hasChanges, setHasChanges] = useState(false);

  // 表单字段
  const [formEntityType, setFormEntityType] = useState<EncodingEntityType>('MATERIAL_BATCH');
  const [formRuleName, setFormRuleName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPattern, setFormPattern] = useState('{PREFIX}-{FACTORY}-{YYYYMMDD}-{SEQ:4}');
  const [formPrefix, setFormPrefix] = useState('MB');
  const [formResetCycle, setFormResetCycle] = useState<ResetCycle>('DAILY');
  const [formSeqLength, setFormSeqLength] = useState('4');
  const [formSeparator, setFormSeparator] = useState('-');
  const [formIncludeFactory, setFormIncludeFactory] = useState(true);
  const [formEnabled, setFormEnabled] = useState(true);

  // 预览和测试
  const [previewCode, setPreviewCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generateLoading, setGenerateLoading] = useState(false);

  // 占位符帮助对话框
  const [placeholderHelpVisible, setPlaceholderHelpVisible] = useState(false);

  /**
   * 加载规则数据
   */
  const loadRule = useCallback(async () => {
    if (isNew || !ruleId) return;

    try {
      configLogger.info('加载规则数据', { ruleId });
      const ruleData = await encodingRuleApiClient.getRuleById(ruleId, factoryId ?? undefined);

      if (ruleData) {
        setRule(ruleData);
        setFormEntityType(ruleData.entityType);
        setFormRuleName(ruleData.ruleName);
        setFormDescription(ruleData.ruleDescription ?? '');
        setFormPattern(ruleData.encodingPattern);
        setFormPrefix(ruleData.prefix ?? '');
        setFormResetCycle(ruleData.resetCycle);
        setFormSeqLength(String(ruleData.sequenceLength));
        setFormSeparator(ruleData.separator ?? '-');
        setFormIncludeFactory(ruleData.includeFactoryCode);
        setFormEnabled(ruleData.enabled);
        configLogger.info('规则数据加载完成', { ruleName: ruleData.ruleName });
      } else {
        Alert.alert(isZh ? '错误' : 'Error', isZh ? '规则不存在' : 'Rule not found');
        navigation.goBack();
      }
    } catch (error: unknown) {
      configLogger.error('加载规则失败', error);
      const errorMessage = error instanceof Error ? error.message : isZh ? '加载失败' : 'Load failed';
      Alert.alert(isZh ? '错误' : 'Error', errorMessage);
    }
  }, [ruleId, isNew, factoryId, isZh, navigation]);

  /**
   * 加载元数据
   */
  const loadMetadata = useCallback(async () => {
    try {
      const [typesRes, phRes] = await Promise.all([
        encodingRuleApiClient.getEntityTypes(factoryId ?? undefined),
        encodingRuleApiClient.getPlaceholders(factoryId ?? undefined),
      ]);
      setEntityTypes(typesRes);
      setPlaceholders(phRes);
    } catch (error: unknown) {
      configLogger.warn('加载元数据失败', error);
    }
  }, [factoryId]);

  /**
   * 加载全部数据
   */
  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      await Promise.all([loadRule(), loadMetadata()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadRule, loadMetadata]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 获取实体类型名称
   */
  const getEntityTypeName = (code: string): string => {
    const found = entityTypes.find((t) => t.code === code);
    return found?.name ?? code;
  };

  /**
   * 获取重置周期名称
   */
  const getResetCycleName = (cycle: ResetCycle): string => {
    const found = RESET_CYCLE_OPTIONS.find((o) => o.value === cycle);
    return isZh ? (found?.label ?? cycle) : (found?.labelEn ?? cycle);
  };

  /**
   * 预览编码
   */
  const handlePreview = async () => {
    if (!rule?.entityType && !formEntityType) return;

    try {
      setPreviewLoading(true);
      const code = await encodingRuleApiClient.previewCode(
        rule?.entityType ?? formEntityType,
        factoryId ?? undefined
      );
      setPreviewCode(code);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : isZh ? '预览失败' : 'Preview failed';
      setPreviewCode(isZh ? `预览失败: ${errorMessage}` : `Failed: ${errorMessage}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * 测试生成编码
   */
  const handleGenerateCode = async () => {
    if (!rule?.entityType) {
      Alert.alert(isZh ? '提示' : 'Note', isZh ? '请先保存规则' : 'Please save the rule first');
      return;
    }

    Alert.alert(
      isZh ? '确认生成' : 'Confirm Generate',
      isZh ? '生成编码将消耗一个序列号，确定继续？' : 'This will consume a sequence number. Continue?',
      [
        { text: isZh ? '取消' : 'Cancel', style: 'cancel' },
        {
          text: isZh ? '确定' : 'Confirm',
          onPress: async () => {
            try {
              setGenerateLoading(true);
              const code = await encodingRuleApiClient.generateCode(
                rule.entityType,
                {},
                factoryId ?? undefined
              );
              setGeneratedCode(code);
              // 刷新规则数据以更新序列号
              loadRule();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : isZh ? '生成失败' : 'Generate failed';
              Alert.alert(isZh ? '错误' : 'Error', errorMessage);
            } finally {
              setGenerateLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * 保存规则
   */
  const handleSave = async () => {
    if (!formRuleName.trim()) {
      Alert.alert(isZh ? '提示' : 'Note', isZh ? '请输入规则名称' : 'Please enter rule name');
      return;
    }
    if (!formPattern.trim()) {
      Alert.alert(isZh ? '提示' : 'Note', isZh ? '请输入编码模板' : 'Please enter encoding pattern');
      return;
    }

    try {
      setSaving(true);

      if (isNew) {
        // 创建新规则
        await encodingRuleApiClient.createRule(
          {
            entityType: formEntityType,
            ruleName: formRuleName.trim(),
            ruleDescription: formDescription.trim() || undefined,
            encodingPattern: formPattern.trim(),
            prefix: formPrefix.trim() || undefined,
            resetCycle: formResetCycle,
            sequenceLength: parseInt(formSeqLength, 10) || 4,
            separator: formSeparator || '-',
            includeFactoryCode: formIncludeFactory,
          },
          factoryId ?? undefined
        );
        Alert.alert(isZh ? '成功' : 'Success', isZh ? '规则创建成功' : 'Rule created successfully');
        navigation.goBack();
      } else if (ruleId) {
        // 更新现有规则
        const updateRequest: UpdateEncodingRuleRequest = {
          ruleName: formRuleName.trim(),
          ruleDescription: formDescription.trim() || undefined,
          encodingPattern: formPattern.trim(),
          prefix: formPrefix.trim() || undefined,
          resetCycle: formResetCycle,
          sequenceLength: parseInt(formSeqLength, 10) || 4,
          separator: formSeparator || '-',
          includeFactoryCode: formIncludeFactory,
        };

        await encodingRuleApiClient.updateRule(ruleId, updateRequest, factoryId ?? undefined);
        setHasChanges(false);
        Alert.alert(isZh ? '成功' : 'Success', isZh ? '规则更新成功' : 'Rule updated successfully');
        loadRule();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : isZh ? '保存失败' : 'Save failed';
      Alert.alert(isZh ? '错误' : 'Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 切换启用状态
   */
  const handleToggleEnabled = async (enabled: boolean) => {
    if (!ruleId) return;

    try {
      await encodingRuleApiClient.toggleEnabled(ruleId, enabled, factoryId ?? undefined);
      setFormEnabled(enabled);
      if (rule) {
        setRule({ ...rule, enabled });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : isZh ? '操作失败' : 'Operation failed';
      Alert.alert(isZh ? '错误' : 'Error', errorMessage);
    }
  };

  /**
   * 重置序列号
   */
  const handleResetSequence = () => {
    if (!ruleId) return;

    Alert.alert(
      isZh ? '确认重置' : 'Confirm Reset',
      isZh ? '重置后序列号将从1开始，此操作不可撤销。确定继续？' : 'Sequence will reset to 1. This cannot be undone. Continue?',
      [
        { text: isZh ? '取消' : 'Cancel', style: 'cancel' },
        {
          text: isZh ? '确定重置' : 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await encodingRuleApiClient.resetSequence(ruleId, factoryId ?? undefined);
              Alert.alert(isZh ? '成功' : 'Success', isZh ? '序列号已重置' : 'Sequence reset successfully');
              loadRule();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : isZh ? '重置失败' : 'Reset failed';
              Alert.alert(isZh ? '错误' : 'Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  /**
   * 删除规则
   */
  const handleDelete = () => {
    if (!ruleId) return;

    Alert.alert(
      isZh ? '确认删除' : 'Confirm Delete',
      isZh ? `确定删除规则"${formRuleName}"吗？此操作不可撤销。` : `Delete rule "${formRuleName}"? This cannot be undone.`,
      [
        { text: isZh ? '取消' : 'Cancel', style: 'cancel' },
        {
          text: isZh ? '删除' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await encodingRuleApiClient.deleteRule(ruleId, factoryId ?? undefined);
              Alert.alert(isZh ? '成功' : 'Success', isZh ? '规则已删除' : 'Rule deleted');
              navigation.goBack();
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : isZh ? '删除失败' : 'Delete failed';
              Alert.alert(isZh ? '错误' : 'Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  /**
   * 处理返回
   */
  const handleGoBack = () => {
    if (hasChanges) {
      Alert.alert(
        isZh ? '未保存的更改' : 'Unsaved Changes',
        isZh ? '您有未保存的更改，确定离开？' : 'You have unsaved changes. Leave anyway?',
        [
          { text: isZh ? '取消' : 'Cancel', style: 'cancel' },
          { text: isZh ? '离开' : 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  /**
   * 插入占位符
   */
  const insertPlaceholder = (placeholder: string) => {
    setFormPattern((prev) => prev + placeholder);
    setPlaceholderHelpVisible(false);
    setHasChanges(true);
  };

  // 计算预览编码
  const computedPreview = useMemo(() => {
    let preview = formPattern;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(1).padStart(parseInt(formSeqLength, 10) || 4, '0');

    preview = preview
      .replace('{PREFIX}', formPrefix || 'XX')
      .replace('{FACTORY}', factoryId ?? 'F001')
      .replace('{YYYYMMDD}', `${year}${month}${day}`)
      .replace('{YYYY}', String(year))
      .replace('{YY}', String(year).slice(-2))
      .replace('{MM}', month)
      .replace('{DD}', day)
      .replace(/\{SEQ:\d+\}/, seq)
      .replace('{SEQ}', seq);

    return preview;
  }, [formPattern, formPrefix, formSeqLength, factoryId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{isZh ? '加载中...' : 'Loading...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isNew ? (isZh ? '新建编码规则' : 'New Code Rule') : (isZh ? '编码规则详情' : 'Code Rule Details')}
          </Text>
          {!isNew && rule && (
            <View style={styles.headerMeta}>
              <Chip
                style={[styles.statusChip, { backgroundColor: formEnabled ? '#f6ffed' : '#fff2e8' }]}
                textStyle={{ fontSize: 11, color: formEnabled ? '#52c41a' : '#fa8c16' }}
              >
                {formEnabled ? (isZh ? '已启用' : 'Enabled') : (isZh ? '已禁用' : 'Disabled')}
              </Chip>
              <Text style={styles.versionBadge}>v{rule.version}</Text>
            </View>
          )}
        </View>
        {!isNew && (
          <View style={styles.headerActions}>
            <Switch
              value={formEnabled}
              onValueChange={handleToggleEnabled}
              color="#52c41a"
            />
          </View>
        )}
      </View>

      {/* Tab */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'info' && styles.tabItemActive]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
            {isZh ? '基本信息' : 'Info'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'config' && styles.tabItemActive]}
          onPress={() => setActiveTab('config')}
        >
          <Text style={[styles.tabText, activeTab === 'config' && styles.tabTextActive]}>
            {isZh ? '编码配置' : 'Config'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'test' && styles.tabItemActive]}
          onPress={() => setActiveTab('test')}
          disabled={isNew}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'test' && styles.tabTextActive,
              isNew && styles.tabTextDisabled,
            ]}
          >
            {isZh ? '测试生成' : 'Test'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* 基本信息 Tab */}
          {activeTab === 'info' && (
            <View style={styles.tabContent}>
              {/* 实体类型 (仅新建时可选) */}
              {isNew && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>{isZh ? '实体类型' : 'Entity Type'} *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.entityTypeGrid}>
                      {entityTypes.map((type) => (
                        <TouchableOpacity
                          key={type.code}
                          style={[
                            styles.entityTypeItem,
                            formEntityType === type.code && styles.entityTypeItemActive,
                          ]}
                          onPress={() => {
                            setFormEntityType(type.code);
                            setFormPrefix(type.defaultPrefix);
                            setHasChanges(true);
                          }}
                        >
                          <Text
                            style={[
                              styles.entityTypeText,
                              formEntityType === type.code && styles.entityTypeTextActive,
                            ]}
                          >
                            {type.name}
                          </Text>
                          <Text style={styles.entityTypePrefixHint}>{type.defaultPrefix}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* 规则名称 */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{isZh ? '规则名称' : 'Rule Name'} *</Text>
                <TextInput
                  value={formRuleName}
                  onChangeText={(text) => {
                    setFormRuleName(text);
                    setHasChanges(true);
                  }}
                  mode="outlined"
                  style={styles.textInput}
                  placeholder={isZh ? '如: 原材料批次编码规则' : 'e.g. Material Batch Code Rule'}
                  outlineColor="#e0e0e0"
                  activeOutlineColor="#667eea"
                />
              </View>

              {/* 规则描述 */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{isZh ? '规则描述' : 'Description'}</Text>
                <TextInput
                  value={formDescription}
                  onChangeText={(text) => {
                    setFormDescription(text);
                    setHasChanges(true);
                  }}
                  mode="outlined"
                  style={styles.textInput}
                  placeholder={isZh ? '描述规则的用途和特点' : 'Describe the purpose and features'}
                  multiline
                  numberOfLines={3}
                  outlineColor="#e0e0e0"
                  activeOutlineColor="#667eea"
                />
              </View>

              {/* 当前状态 (仅查看模式) */}
              {!isNew && rule && (
                <Surface style={styles.statusCard} elevation={1}>
                  <Text style={styles.statusCardTitle}>{isZh ? '当前状态' : 'Current Status'}</Text>
                  <View style={styles.statusGrid}>
                    <View style={styles.statusItem}>
                      <Text style={styles.statusValue}>{rule.currentSequence}</Text>
                      <Text style={styles.statusLabel}>{isZh ? '当前序号' : 'Current Seq'}</Text>
                    </View>
                    <View style={styles.statusItem}>
                      <Text style={styles.statusValue}>{getResetCycleName(rule.resetCycle)}</Text>
                      <Text style={styles.statusLabel}>{isZh ? '重置周期' : 'Reset Cycle'}</Text>
                    </View>
                    <View style={styles.statusItem}>
                      <Text style={styles.statusValue}>{rule.sequenceLength}{isZh ? '位' : ' digits'}</Text>
                      <Text style={styles.statusLabel}>{isZh ? '序号长度' : 'Seq Length'}</Text>
                    </View>
                    <View style={styles.statusItem}>
                      <Text style={styles.statusValue}>v{rule.version}</Text>
                      <Text style={styles.statusLabel}>{isZh ? '版本' : 'Version'}</Text>
                    </View>
                  </View>
                  {rule.lastResetDate && (
                    <Text style={styles.lastResetText}>
                      {isZh ? '上次重置: ' : 'Last Reset: '}{new Date(rule.lastResetDate).toLocaleString()}
                    </Text>
                  )}
                </Surface>
              )}
            </View>
          )}

          {/* 编码配置 Tab */}
          {activeTab === 'config' && (
            <View style={styles.tabContent}>
              {/* 编码模板 */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{isZh ? '编码模板' : 'Encoding Pattern'} *</Text>
                  <TouchableOpacity
                    style={styles.helpButton}
                    onPress={() => setPlaceholderHelpVisible(true)}
                  >
                    <Icon source="help-circle" size={20} color="#667eea" />
                    <Text style={styles.helpButtonText}>{isZh ? '占位符' : 'Placeholders'}</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={formPattern}
                  onChangeText={(text) => {
                    setFormPattern(text);
                    setHasChanges(true);
                  }}
                  mode="outlined"
                  style={[styles.textInput, styles.patternInput]}
                  placeholder="{PREFIX}-{FACTORY}-{YYYYMMDD}-{SEQ:4}"
                  outlineColor="#e0e0e0"
                  activeOutlineColor="#667eea"
                />
                <Surface style={styles.previewBox} elevation={1}>
                  <Text style={styles.previewLabel}>{isZh ? '预览效果:' : 'Preview:'}</Text>
                  <Text style={styles.previewValue}>{computedPreview}</Text>
                </Surface>
              </View>

              {/* 前缀和序号长度 */}
              <View style={styles.formRow}>
                <View style={[styles.formSection, styles.halfSection]}>
                  <Text style={styles.sectionTitle}>{isZh ? '固定前缀' : 'Prefix'}</Text>
                  <TextInput
                    value={formPrefix}
                    onChangeText={(text) => {
                      setFormPrefix(text.toUpperCase());
                      setHasChanges(true);
                    }}
                    mode="outlined"
                    style={styles.textInput}
                    placeholder="MB"
                    maxLength={10}
                    outlineColor="#e0e0e0"
                    activeOutlineColor="#667eea"
                  />
                </View>
                <View style={[styles.formSection, styles.halfSection]}>
                  <Text style={styles.sectionTitle}>{isZh ? '序号长度' : 'Seq Length'}</Text>
                  <TextInput
                    value={formSeqLength}
                    onChangeText={(text) => {
                      setFormSeqLength(text.replace(/[^0-9]/g, ''));
                      setHasChanges(true);
                    }}
                    mode="outlined"
                    style={styles.textInput}
                    placeholder="4"
                    keyboardType="numeric"
                    maxLength={2}
                    outlineColor="#e0e0e0"
                    activeOutlineColor="#667eea"
                  />
                </View>
              </View>

              {/* 分隔符 */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{isZh ? '分隔符' : 'Separator'}</Text>
                <SegmentedButtons
                  value={formSeparator}
                  onValueChange={(value) => {
                    setFormSeparator(value);
                    setHasChanges(true);
                  }}
                  buttons={[
                    { value: '-', label: '- (dash)' },
                    { value: '_', label: '_ (underscore)' },
                    { value: '', label: isZh ? '无' : 'None' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>

              {/* 重置周期 */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{isZh ? '序号重置周期' : 'Reset Cycle'}</Text>
                <SegmentedButtons
                  value={formResetCycle}
                  onValueChange={(value) => {
                    setFormResetCycle(value as ResetCycle);
                    setHasChanges(true);
                  }}
                  buttons={RESET_CYCLE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: isZh ? o.label : o.labelEn,
                  }))}
                  style={styles.segmentedButtons}
                />
              </View>

              {/* 包含工厂代码 */}
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>{isZh ? '包含工厂代码' : 'Include Factory Code'}</Text>
                  <Text style={styles.switchHint}>
                    {isZh ? '在编码中包含 {FACTORY} 占位符' : 'Include {FACTORY} placeholder in code'}
                  </Text>
                </View>
                <Switch
                  value={formIncludeFactory}
                  onValueChange={(value) => {
                    setFormIncludeFactory(value);
                    setHasChanges(true);
                  }}
                  color="#667eea"
                />
              </View>
            </View>
          )}

          {/* 测试生成 Tab */}
          {activeTab === 'test' && !isNew && (
            <View style={styles.tabContent}>
              {/* 预览编码 */}
              <Surface style={styles.testCard} elevation={1}>
                <View style={styles.testCardHeader}>
                  <Icon source="eye" size={20} color="#667eea" />
                  <Text style={styles.testCardTitle}>{isZh ? '预览编码' : 'Preview Code'}</Text>
                </View>
                <Text style={styles.testCardHint}>
                  {isZh ? '预览下一个编码，不消耗序号' : 'Preview next code without consuming sequence'}
                </Text>
                <Button
                  mode="outlined"
                  onPress={handlePreview}
                  loading={previewLoading}
                  disabled={previewLoading}
                  style={styles.testButton}
                  icon="eye"
                >
                  {isZh ? '预览' : 'Preview'}
                </Button>
                {previewCode && (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultLabel}>{isZh ? '预览结果:' : 'Result:'}</Text>
                    <Text style={styles.resultCode}>{previewCode}</Text>
                  </View>
                )}
              </Surface>

              {/* 生成编码 */}
              <Surface style={styles.testCard} elevation={1}>
                <View style={styles.testCardHeader}>
                  <Icon source="plus-circle" size={20} color="#fa8c16" />
                  <Text style={styles.testCardTitle}>{isZh ? '生成编码' : 'Generate Code'}</Text>
                </View>
                <Text style={styles.testCardHint}>
                  {isZh ? '生成并使用一个编码，会消耗序号' : 'Generate and use a code, consumes sequence'}
                </Text>
                <Button
                  mode="contained"
                  onPress={handleGenerateCode}
                  loading={generateLoading}
                  disabled={generateLoading}
                  style={styles.testButton}
                  buttonColor="#fa8c16"
                  icon="plus"
                >
                  {isZh ? '生成' : 'Generate'}
                </Button>
                {generatedCode && (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultLabel}>{isZh ? '生成的编码:' : 'Generated:'}</Text>
                    <Text style={[styles.resultCode, styles.generatedCode]}>{generatedCode}</Text>
                  </View>
                )}
              </Surface>

              {/* 序号管理 */}
              <Surface style={styles.testCard} elevation={1}>
                <View style={styles.testCardHeader}>
                  <Icon source="restore" size={20} color="#f5222d" />
                  <Text style={styles.testCardTitle}>{isZh ? '序号管理' : 'Sequence Management'}</Text>
                </View>
                <View style={styles.sequenceInfo}>
                  <Text style={styles.sequenceLabel}>{isZh ? '当前序号:' : 'Current Sequence:'}</Text>
                  <Text style={styles.sequenceValue}>{rule?.currentSequence ?? 0}</Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={handleResetSequence}
                  style={styles.testButton}
                  textColor="#f5222d"
                  icon="restore"
                >
                  {isZh ? '重置序号' : 'Reset Sequence'}
                </Button>
              </Surface>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        {!isNew && (
          <Button
            mode="outlined"
            onPress={handleDelete}
            style={styles.deleteButton}
            textColor="#f5222d"
            icon="delete"
          >
            {isZh ? '删除' : 'Delete'}
          </Button>
        )}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
          buttonColor="#667eea"
          icon="content-save"
        >
          {isZh ? '保存' : 'Save'}
        </Button>
      </View>

      {/* 占位符帮助对话框 */}
      <Portal>
        <Dialog
          visible={placeholderHelpVisible}
          onDismiss={() => setPlaceholderHelpVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{isZh ? '支持的占位符' : 'Supported Placeholders'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              {placeholders.map((ph, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.placeholderItem}
                  onPress={() => insertPlaceholder(ph.placeholder)}
                >
                  <View style={styles.placeholderMain}>
                    <Text style={styles.placeholderCode}>{ph.placeholder}</Text>
                    <IconButton
                      icon="plus-circle"
                      size={18}
                      iconColor="#667eea"
                      onPress={() => insertPlaceholder(ph.placeholder)}
                    />
                  </View>
                  <Text style={styles.placeholderDesc}>{ph.description}</Text>
                  <Text style={styles.placeholderExample}>
                    {isZh ? '示例: ' : 'Example: '}{ph.example}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setPlaceholderHelpVisible(false)}>
              {isZh ? '关闭' : 'Close'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
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
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusChip: {
    height: 22,
    marginRight: 8,
  },
  versionBadge: {
    fontSize: 12,
    color: '#999',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  tabTextDisabled: {
    color: '#ccc',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  helpButtonText: {
    fontSize: 12,
    color: '#667eea',
    marginLeft: 4,
  },
  textInput: {
    backgroundColor: '#fff',
  },
  patternInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0f5ff',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  previewValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1d39c4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfSection: {
    flex: 1,
  },
  segmentedButtons: {
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  switchHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  entityTypeGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  entityTypeItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  entityTypeItemActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f5ff',
  },
  entityTypeText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  entityTypeTextActive: {
    color: '#667eea',
  },
  entityTypePrefixHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statusLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  lastResetText: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  testCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  testCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  testCardHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  testButton: {
    alignSelf: 'flex-start',
  },
  resultBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f6ffed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  resultLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  resultCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#52c41a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  generatedCode: {
    color: '#fa8c16',
  },
  sequenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sequenceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  sequenceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  deleteButton: {
    borderColor: '#f5222d',
  },
  saveButton: {
    minWidth: 120,
  },
  dialog: {
    maxHeight: '80%',
  },
  dialogScrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  placeholderItem: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  placeholderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  placeholderDesc: {
    fontSize: 13,
    color: '#333',
    marginTop: 4,
  },
  placeholderExample: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default CodeRuleDetailScreen;
